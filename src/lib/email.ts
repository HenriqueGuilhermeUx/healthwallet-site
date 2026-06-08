/**
 * Cliente de email — Resend
 * https://resend.com/docs/api-reference/emails/send-email
 *
 * Env vars:
 *   RESEND_API_KEY
 *   RESEND_FROM   — ex: "HealthWallet Pro <noreply@healthwallet.pro>"
 */

import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY não definido');
  _resend = new Resend(key);
  return _resend;
}

function getFrom(): string {
  return process.env.RESEND_FROM || 'HealthWallet Pro <noreply@healthwallet.pro>';
}

export async function sendPrescriptionReadyEmail(input: {
  to: string;
  patientName: string;
  professionalName: string;
  specialty: string | null;
  documentType: 'receita' | 'pedido_exame' | 'atestado' | 'outro';
  pdfUrl: string;
  healthwalletAppUrl: string;
}) {
  const docLabel = {
    receita: 'Receita Digital',
    pedido_exame: 'Pedido de Exame',
    atestado: 'Atestado Médico',
    outro: 'Documento Médico',
  }[input.documentType];

  const subject = `📄 ${docLabel} disponível — Dr(a). ${input.professionalName}`;

  const html = `
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f7faf9; padding: 20px; color: #1a202c;">
    <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 28px 24px; text-align: center;">
        <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 700;">HealthWallet</h1>
      </div>
      <div style="padding: 28px 24px;">
        <h2 style="margin: 0 0 8px; color: #111827; font-size: 18px;">Olá, ${escapeHtml(input.patientName)}</h2>
        <p style="margin: 0 0 18px; color: #4b5563; font-size: 15px; line-height: 1.6;">
          Dr(a). <strong>${escapeHtml(input.professionalName)}</strong>${input.specialty ? ` (${escapeHtml(input.specialty)})` : ''} enviou um novo documento para você:
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 18px 0;">
          <p style="margin: 0 0 4px; color: #065f46; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Documento</p>
          <p style="margin: 0; color: #064e3b; font-size: 16px; font-weight: 700;">${docLabel}</p>
        </div>
        <p style="margin: 20px 0 8px; color: #4b5563; font-size: 14px; line-height: 1.6;">
          Acesse pelo app HealthWallet para visualizar com seu histórico completo, ou abra o PDF abaixo:
        </p>
        <div style="text-align: center; margin: 24px 0 12px;">
          <a href="${input.pdfUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 15px;">
            📄 Abrir PDF
          </a>
        </div>
        <div style="text-align: center; margin: 8px 0 24px;">
          <a href="${input.healthwalletAppUrl}" style="color: #059669; text-decoration: none; font-size: 14px; font-weight: 500;">
            ou abra no app HealthWallet →
          </a>
        </div>
        <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; line-height: 1.5;">
          Este documento é assinado digitalmente com certificado ICP-Brasil e tem validade legal conforme resolução CFM.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const res = await getResend().emails.send({
    from: getFrom(),
    to: input.to,
    subject,
    html,
  });
  if (res.error) throw new Error(`Resend error: ${res.error.message}`);
  return res.data;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =====================================================================
// SISTEMA PRÓPRIO DE ENTREGA (substitui Clicksign como provider padrão)
// =====================================================================

import { createHash, randomBytes } from 'crypto';
import { getSupabaseAdmin } from './supabase-server';

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'HealthWallet Pro <onboarding@resend.dev>';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://healthwallet.pro';

const resendClient = apiKey ? new Resend(apiKey) : null;

export type DeliveryEmailArgs = {
  documentType: 'receita' | 'exame';
  documentId: number;
  medico: {
    id: string;
    full_name: string;
    professional_register: string;
    register_state: string;
    specialty: string | null;
  };
  paciente: {
    id: string;
    full_name: string;
    email: string;
  };
  pdfBuffer: Buffer;
  subject: string;
  documentHash?: string;
};

export type DeliveryEmailResult = {
  ok: boolean;
  deliveryId: number;
  confirmToken: string;
  verifyUrl: string;
  mode: 'sent' | 'dry_run' | 'failed';
  error?: string;
};

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function sendDeliveryEmail(args: DeliveryEmailArgs): Promise<DeliveryEmailResult> {
  const admin = getSupabaseAdmin();
  const hash = args.documentHash || sha256(args.pdfBuffer);
  const confirmToken = generateToken();
  const verifyUrl = `${appUrl}/verify/${confirmToken}`;

  // 1) Cria o registro do delivery PRIMEIRO
  const { data: delivery, error: dErr } = await admin
    .from('document_deliveries')
    .insert({
      document_type: args.documentType,
      document_id: args.documentId,
      medico_id: args.medico.id,
      paciente_id: args.paciente.id,
      recipient_email: args.paciente.email,
      subject: args.subject,
      document_hash: hash,
      confirm_token: confirmToken,
      confirmation_status: 'pendente',
      delivery_status: resendClient ? 'enviado' : 'dry_run',
    })
    .select('id')
    .single();

  if (dErr || !delivery) {
    return {
      ok: false,
      deliveryId: 0,
      confirmToken,
      verifyUrl,
      mode: 'failed',
      error: dErr?.message || 'Falha ao criar registro de delivery',
    };
  }

  // 2) Monta o email
  const docLabel = args.documentType === 'receita' ? 'Receita Digital' : 'Pedido de Exame';
  const html = buildDeliveryHtml({
    patientName: args.paciente.full_name,
    medicoName: args.medico.full_name,
    medicoCrm: `${args.medico.professional_register}/${args.medico.register_state}`,
    medicoSpecialty: args.medico.specialty,
    docLabel,
    subject: args.subject,
    verifyUrl,
    confirmToken,
    documentHash: hash,
    deliveryId: delivery.id,
  });

  // 3) Envia
  if (!resendClient) {
    await admin.from('email_outbox').insert({
      to_email: args.paciente.email,
      subject: args.subject,
      body_html: html,
      attachment_pdf: args.pdfBuffer,
      attachment_name: `${docLabel.toLowerCase().replace(/\s+/g, '-')}-${args.documentId}.pdf`,
      status: 'pending',
    });
    return { ok: true, deliveryId: delivery.id, confirmToken, verifyUrl, mode: 'dry_run' };
  }

  try {
    const res = await resendClient.emails.send({
      from: fromAddress,
      to: args.paciente.email,
      subject: args.subject,
      html,
      attachments: [{
        filename: `${docLabel.toLowerCase().replace(/\s+/g, '-')}-${args.documentId}.pdf`,
        content: args.pdfBuffer,
      }],
    });

    if (res.error) {
      await admin.from('document_deliveries')
        .update({ delivery_status: 'falhou', error_message: res.error.message })
        .eq('id', delivery.id);
      return { ok: false, deliveryId: delivery.id, confirmToken, verifyUrl, mode: 'failed', error: res.error.message };
    }

    await admin.from('document_deliveries')
      .update({ resend_message_id: res.data?.id || null })
      .eq('id', delivery.id);

    return { ok: true, deliveryId: delivery.id, confirmToken, verifyUrl, mode: 'sent' };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'unknown';
    await admin.from('document_deliveries')
      .update({ delivery_status: 'falhou', error_message: errMsg })
      .eq('id', delivery.id);
    return { ok: false, deliveryId: delivery.id, confirmToken, verifyUrl, mode: 'failed', error: errMsg };
  }
}

function buildDeliveryHtml(args: {
  patientName: string;
  medicoName: string;
  medicoCrm: string;
  medicoSpecialty: string | null;
  docLabel: string;
  subject: string;
  verifyUrl: string;
  confirmToken: string;
  documentHash: string;
  deliveryId: number;
}): string {
  const crmLine = args.medicoCrm + (args.medicoSpecialty ? ` (${args.medicoSpecialty})` : '');
  const shortHash = args.documentHash.slice(0, 12);
  return `<!doctype html>
<html lang="pt-BR">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f7faf9; padding: 20px; color: #1a202c; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 28px 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 700;">HealthWallet</h1>
      <p style="margin: 6px 0 0; color: rgba(255,255,255,0.9); font-size: 13px;">Documento médico digital</p>
    </div>
    <div style="padding: 28px 24px;">
      <h2 style="margin: 0 0 8px; color: #111827; font-size: 18px;">Olá, ${escapeHtml(args.patientName)}</h2>
      <p style="margin: 0 0 18px; color: #4b5563; font-size: 15px; line-height: 1.6;">
        <strong>Dr(a). ${escapeHtml(args.medicoName)}</strong> enviou um documento para você:
      </p>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 18px 0;">
        <p style="margin: 0 0 4px; color: #065f46; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Documento</p>
        <p style="margin: 0; color: #064e3b; font-size: 18px; font-weight: 700;">${escapeHtml(args.docLabel)}</p>
        <p style="margin: 8px 0 0; color: #047857; font-size: 12px;">📎 PDF anexado • Emitido por ${escapeHtml(crmLine)}</p>
      </div>
      <p style="margin: 20px 0 8px; color: #4b5563; font-size: 14px; line-height: 1.6;">
        Para registrar que você recebeu e leu o documento, clique no botão abaixo. Sua confirmação fica no audit trail com data, hora e IP.
      </p>
      <div style="text-align: center; margin: 24px 0 12px;">
        <a href="${args.verifyUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 15px;">
          ✓ Confirmar leitura
        </a>
      </div>
      <div style="background: #f9fafb; border-radius: 10px; padding: 14px; margin: 20px 0; font-size: 11px; color: #6b7280; font-family: monospace;">
        <div style="margin-bottom: 4px;"><strong style="color: #374151;">ID da entrega:</strong> ${args.deliveryId}</div>
        <div style="margin-bottom: 4px;"><strong style="color: #374151;">Hash do documento:</strong> ${shortHash}…</div>
        <div style="word-break: break-all;"><strong style="color: #374151;">Verificação:</strong> ${args.verifyUrl}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
