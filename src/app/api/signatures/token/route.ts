import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isValidSignToken } from '@/lib/server/supabaseAdmin'

// Loads one pending signing link by its exact token and marks it as viewed.
// Returns only what the signing page renders.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const token = String(body.token || '').trim()

    if (!isValidSignToken(token)) {
      return NextResponse.json({ error: 'Link inválido, expirado ou já assinado.' }, { status: 404 })
    }

    const supabase = getSupabaseAdmin()
    const now = new Date().toISOString()

    const { data: signToken, error: tokenError } = await supabase
      .from('sign_tokens')
      .select('id, document_id, status, expires_at, patient_name, patient_email, signer_role')
      .eq('token', token)
      .in('status', ['pending', 'viewed'])
      .gt('expires_at', now)
      .maybeSingle()

    if (tokenError || !signToken) {
      return NextResponse.json({ error: 'Link inválido, expirado ou já assinado.' }, { status: 404 })
    }

    const { data: document, error: docError } = await supabase
      .from('professional_clinical_documents')
      .select('id, title, document_type, body, legal_notice')
      .eq('id', signToken.document_id)
      .maybeSingle()

    if (docError || !document) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
    }

    if (signToken.status === 'pending') {
      await supabase
        .from('sign_tokens')
        .update({ status: 'viewed', viewed_at: now })
        .eq('id', signToken.id)
        .eq('status', 'pending')
    }

    return NextResponse.json({
      token: {
        expires_at: signToken.expires_at,
        patient_name: signToken.patient_name,
        patient_email: signToken.patient_email,
        signer_role: signToken.signer_role,
      },
      document: {
        title: document.title,
        document_type: document.document_type,
        body: document.body,
        legal_notice: document.legal_notice,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erro ao carregar o link de assinatura.' }, { status: 500 })
  }
}
