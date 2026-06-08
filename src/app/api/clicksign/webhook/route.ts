/**
 * POST /api/clicksign/webhook
 *
 * Clicksign chama este endpoint quando o documento tem mudança de status.
 * Eventos relevantes:
 *   - "sign"        → signatário acabou de assinar
 *   - "upload_done" → todos assinaram, PDF final está pronto
 *   - "deadline"    → expirou
 *   - "canceled"    → cancelado
 *
 * No upload_done:
 *   1) Baixa o PDF final (signed_file_url)
 *   2) Sobe pro Supabase Storage (bucket `prescriptions`)
 *   3) Atualiza receita (status, pdf_final_path, assinado_em)
 *   4) Insere em `received_documents` (app do paciente consome via realtime)
 *   5) Envia email pro paciente via Resend
 *
 * Segurança: Clicksign assina o body com HMAC-SHA256 no header `Content-Hmac-Sha256`.
 * Verificamos a assinatura com o mesmo access_token como chave.
 *
 * IMPORTANTE: o endpoint NÃO exige auth de usuário (é o Clicksign chamando).
 * O service role é usado para fazer as inserções.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendPrescriptionReadyEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ClicksignWebhookPayload = {
  event: {
    name: string;          // 'sign' | 'upload_done' | 'deadline' | 'canceled' | etc.
    occurred_at: string;
  };
  document?: {
    key: string;
    status: 'running' | 'completed' | 'canceled' | 'expired';
    signed_file_url?: string;
    file_url?: string;
  };
};

function verifyClicksignHmac(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const accessToken = process.env.CLICKSIGN_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn('[clicksign/webhook] CLICKSIGN_ACCESS_TOKEN não definido — não é possível verificar HMAC');
    return false;
  }
  // Clicksign usa o access_token como chave HMAC
  const expected = crypto
    .createHmac('sha256', accessToken)
    .update(rawBody, 'utf8')
    .digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('content-hmac-sha256');

  // Em produção, EXIGIR verificação. Em dev, deixar passar com warning.
  if (process.env.NODE_ENV === 'production' && !verifyClicksignHmac(rawBody, signature)) {
    console.error('[clicksign/webhook] HMAC inválido. Rejeitando.');
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: ClicksignWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const eventName = payload.event?.name;
  const documentKey = payload.document?.key;
  if (!eventName || !documentKey) {
    return NextResponse.json({ error: 'payload incompleto' }, { status: 400 });
  }

  console.log(`[clicksign/webhook] event=${eventName} document=${documentKey}`);

  if (eventName !== 'upload_done') {
    // Eventos intermediários: só logamos
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await handleUploadDone(payload, documentKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[clicksign/webhook] upload_done error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'erro interno' },
      { status: 500 },
    );
  }
}

async function handleUploadDone(
  payload: ClicksignWebhookPayload,
  documentKey: string,
) {
  const admin = getSupabaseAdmin();

  // 1) Achar a receita com esse document_key
  const { data: receita, error: rErr } = await admin
    .from('receitas')
    .select('id, medico_id, paciente_id, status, pdf_final_path')
    .eq('clicksign_document_key', documentKey)
    .single();

  if (rErr || !receita) {
    throw new Error(`Receita com clicksign_document_key=${documentKey} não encontrada`);
  }
  if (receita.status === 'assinada') {
    console.log(`[clicksign/webhook] receita ${receita.id} já está como 'assinada' — ignorando`);
    return;
  }

  const signedFileUrl = payload.document?.signed_file_url;
  if (!signedFileUrl) {
    throw new Error('signed_file_url ausente no payload');
  }

  // 2) Baixar o PDF assinado
  const pdfRes = await fetch(signedFileUrl);
  if (!pdfRes.ok) throw new Error(`Falha ao baixar PDF: ${pdfRes.status}`);
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

  // 3) Subir pro Supabase Storage
  const path = `${receita.paciente_id}/receita_${receita.id}.pdf`;
  const { error: uploadErr } = await admin.storage
    .from('prescriptions')
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (uploadErr) throw new Error(`Storage upload falhou: ${uploadErr.message}`);

  // Gerar signed URL (válida por 7 dias) — para o email
  const { data: signedUrlData } = await admin.storage
    .from('prescriptions')
    .createSignedUrl(path, 60 * 60 * 24 * 7);

  // 4) Atualizar receita
  const now = new Date().toISOString();
  await admin
    .from('receitas')
    .update({
      status: 'assinada',
      pdf_final_path: path,
      pdf_assinado_url: signedUrlData?.signedUrl || null,
      assinado_em: now,
    })
    .eq('id', receita.id);

  // 5) Inserir em `received_documents` — para o app do paciente
  const { data: prof } = await admin
    .from('professionals')
    .select('full_name, specialty, professional_register, register_state')
    .eq('id', receita.medico_id)
    .single();

  const { data: pacienteProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', receita.paciente_id)
    .single();

  const { data: pacienteAuth } = await admin.auth.admin.getUserById(receita.paciente_id);

  const title = `Receita — Dr(a). ${prof?.full_name || 'Profissional'}`;
  const content = `Receita digital emitida em ${new Date(now).toLocaleString('pt-BR')}. ` +
    `Assinada com certificado digital ICP-Brasil (Clicksign). ` +
    (prof?.specialty ? `Especialidade: ${prof.specialty}. ` : '') +
    `CRM/${prof?.register_state} ${prof?.professional_register}.`;

  await admin.from('received_documents').insert({
    patient_id: receita.paciente_id,
    professional_id: receita.medico_id,
    document_type: 'receita',
    title,
    content,
    file_url: signedUrlData?.signedUrl || null,
    sent_at: now,
    digital_signature: {
      provider: 'Clicksign',
      document_key: documentKey,
      signed_at: now,
      signed_file_url: signedFileUrl,
      crm: prof?.professional_register,
      uf: prof?.register_state,
    },
  });

  // 6) Inserir notificação (sino do app)
  await admin.from('notifications').insert({
    user_id: receita.paciente_id,
    type: 'document_received',
    title,
    body: `Dr(a). ${prof?.full_name || 'Profissional'} enviou uma receita.`,
    link: `/documents`,
    read: false,
  });

  // 7) Email
  if (pacienteAuth?.user?.email && signedUrlData?.signedUrl) {
    try {
      await sendPrescriptionReadyEmail({
        to: pacienteAuth.user.email,
        patientName: pacienteProfile?.full_name || pacienteAuth.user.email,
        professionalName: prof?.full_name || 'Profissional',
        specialty: prof?.specialty || null,
        documentType: 'receita',
        pdfUrl: signedUrlData.signedUrl,
        healthwalletAppUrl: process.env.HEALTHWALLET_APP_URL || 'https://app.healthwallet.pro',
      });
      // Marca receita como enviada
      await admin
        .from('receitas')
        .update({ enviado_paciente_em: now })
        .eq('id', receita.id);
    } catch (emailErr) {
      console.error('[clicksign/webhook] email falhou (não-bloqueante):', emailErr);
    }
  }
}
