import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase env vars missing')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function buildBaseUrl(req: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.URL
  if (envUrl) return envUrl.replace(/\/$/, '')

  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  return `${proto}://${host}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const token = String(body.token || '').trim()
    const signerCpf = onlyDigits(body.signer_cpf || body.cpf || '')
    const signerName = String(body.signer_name || body.name || '').trim()
    const signerEmail = String(body.signer_email || body.email || '').trim()
    const acceptedTerms = Boolean(body.accepted_terms)

    if (!token || !signerCpf || signerCpf.length < 11 || !acceptedTerms) {
      return NextResponse.json({ error: 'Dados de assinatura incompletos' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const now = new Date().toISOString()
    const baseUrl = buildBaseUrl(req)
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    const { data: signToken, error: tokenError } = await supabase
      .from('sign_tokens')
      .select('*')
      .eq('token', token)
      .in('status', ['pending', 'viewed'])
      .gt('expires_at', now)
      .maybeSingle()

    if (tokenError || !signToken) {
      return NextResponse.json({ error: 'Token inválido, expirado ou já assinado' }, { status: 404 })
    }

    const { data: document, error: docError } = await supabase
      .from('professional_clinical_documents')
      .select('*')
      .eq('id', signToken.document_id)
      .maybeSingle()

    if (docError || !document) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
    }

    const signerRole = signToken.signer_role || 'professional'

    const documentSnapshot = {
      document_id: document.id,
      appointment_id: document.appointment_id,
      professional_user_id: document.professional_user_id,
      professional_id: document.professional_id,
      patient_id: document.patient_id,
      document_type: document.document_type,
      title: document.title,
      body: document.body,
      legal_notice: document.legal_notice,
      created_at: document.created_at,
      signed_at: now,
      signer_role: signerRole,
      signer_name: signerName || signToken.patient_name || null,
      signer_email: signerEmail || signToken.patient_email || null,
      signer_cpf_last4: signerCpf.slice(-4),
    }

    const canonicalPayload = JSON.stringify({
      snapshot: documentSnapshot,
      token_id: signToken.id,
      signer_cpf: signerCpf,
      signed_at: now,
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    const documentHash = createHash('sha256').update(canonicalPayload).digest('hex')
    const verificationSlug = documentHash
    const verificationUrl = `${baseUrl}/validar/${verificationSlug}`

    const auditTrail = {
      steps: [
        { type: 'token_created', at: signToken.created_at },
        { type: 'document_viewed', at: signToken.viewed_at || now },
        { type: signerRole === 'professional' ? 'professional_terms_accepted' : 'terms_accepted', at: now },
        { type: signerRole === 'professional' ? 'professional_signed' : 'signed', at: now },
      ],
      ip_address: ipAddress,
      user_agent: userAgent,
      token_expires_at: signToken.expires_at,
    }

    const { data: signature, error: signatureError } = await supabase
      .from('signatures')
      .insert({
        token_id: signToken.id,
        document_id: document.id,
        appointment_id: document.appointment_id || signToken.appointment_id || null,
        professional_user_id: document.professional_user_id || signToken.professional_user_id || null,
        professional_id: document.professional_id || signToken.professional_id || null,
        patient_id: document.patient_id || signToken.patient_id || null,
        signer_role: signerRole,
        signer_name: signerName || signToken.patient_name || null,
        signer_email: signerEmail || signToken.patient_email || null,
        signer_cpf: signerCpf,
        accepted_terms: true,
        signed_at: now,
        ip_address: ipAddress,
        user_agent: userAgent,
        document_hash: documentHash,
        document_snapshot: documentSnapshot,
        verification_slug: verificationSlug,
        verification_url: verificationUrl,
        audit_trail: auditTrail,
        status: 'valid',
      })
      .select('*')
      .single()

    if (signatureError || !signature) {
      return NextResponse.json({ error: signatureError?.message || 'Erro ao registrar assinatura' }, { status: 500 })
    }

    await supabase
      .from('sign_tokens')
      .update({
        status: 'signed',
        signed_at: now,
        signer_cpf: signerCpf,
        signature_id: signature.id,
      })
      .eq('id', signToken.id)

    await supabase
      .from('professional_clinical_documents')
      .update({
        status: 'signed',
        signed_at: now,
        simple_signature_id: signature.id,
        simple_signature_token_id: signToken.id,
        signature_provider: 'mydatamed_simple',
        signature_level: signerRole === 'professional' ? 'professional_simple_audit_trail' : 'patient_acknowledgement_audit_trail',
        signature_validation_url: verificationUrl,
        verification_url: verificationUrl,
        qr_payload: verificationUrl,
        document_hash: documentHash,
        sent_to_patient_at: signerRole === 'professional' ? now : document.sent_to_patient_at || now,
      })
      .eq('id', document.id)

    if (document.appointment_id) {
      await supabase
        .from('telemedicine_appointments')
        .update({
          clinical_document_status: 'signed',
          clinical_document_signed_at: now,
          clinical_document_signature_provider: 'mydatamed_simple',
          clinical_document_signature_level: signerRole === 'professional' ? 'professional_simple_audit_trail' : 'patient_acknowledgement_audit_trail',
          clinical_document_validation_url: verificationUrl,
          clinical_document_hash: documentHash,
        })
        .eq('id', document.appointment_id)
    }

    return NextResponse.json({
      ok: true,
      signature_id: signature.id,
      document_hash: documentHash,
      verification_url: verificationUrl,
      signer_role: signerRole,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
