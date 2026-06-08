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
