import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service role env vars missing')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

function onlyDigits(value: any) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeText(value: any) {
  return String(value || '').trim()
}

function normalizeDate(value: any) {
  const text = normalizeText(value)
  return text || null
}

function computeMissingFields(payload: any, link: any) {
  const missing: string[] = []
  if (!payload.patient_name) missing.push('Nome do paciente')
  if (link?.require_cpf && !payload.patient_cpf) missing.push('CPF')
  if (!payload.patient_phone && !payload.patient_email) missing.push('Contato do paciente')
  if (!payload.reason) missing.push('Motivo do atendimento')
  if (link?.require_health_plan) {
    if (!payload.health_plan_provider) missing.push('Operadora')
    if (!payload.health_plan_card_number) missing.push('Número da carteirinha')
  }
  if (!payload.consent_lgpd) missing.push('Consentimento LGPD')
  return missing
}

function buildChecklist(payload: any, link: any) {
  const hasPlan = Boolean(payload.health_plan_provider || payload.health_plan_card_number)
  return {
    source: 'self_checkin_public_qr',
    patient_identification: Boolean(payload.patient_name),
    contact_available: Boolean(payload.patient_phone || payload.patient_email),
    reason_registered: Boolean(payload.reason),
    symptoms_registered: Boolean(payload.symptoms),
    medications_declared: Boolean(payload.current_medications),
    allergies_declared: Boolean(payload.allergies),
    consent_registered: Boolean(payload.consent_lgpd),
    plan_required: Boolean(link?.require_health_plan),
    plan_informed: hasPlan,
    plan_card_available: hasPlan ? Boolean(payload.health_plan_card_number) : null,
    administrative_review: 'pending',
    reception_mode: 'paciente_preenche_sozinho',
    glosa_prevention_note: hasPlan
      ? 'Dados de plano/carteirinha enviados pelo paciente por QR Code para conferência administrativa antes do atendimento/faturamento.'
      : 'Paciente não informou plano/carteirinha. Recepção deve confirmar cobertura/forma de atendimento quando aplicável.',
  }
}

function normalizePayload(input: any) {
  return {
    patient_name: normalizeText(input.patient_name),
    patient_cpf: onlyDigits(input.patient_cpf) || null,
    patient_birth_date: normalizeDate(input.patient_birth_date),
    patient_phone: normalizeText(input.patient_phone) || null,
    patient_email: normalizeText(input.patient_email) || null,
    companion_name: normalizeText(input.companion_name) || null,
    companion_phone: normalizeText(input.companion_phone) || null,
    reason: normalizeText(input.reason),
    symptoms: normalizeText(input.symptoms) || null,
    current_medications: normalizeText(input.current_medications) || null,
    allergies: normalizeText(input.allergies) || null,
    relevant_history: normalizeText(input.relevant_history) || null,
    administrative_notes: normalizeText(input.administrative_notes) || null,
    health_plan_provider: normalizeText(input.health_plan_provider) || null,
    health_plan_card_number: normalizeText(input.health_plan_card_number) || null,
    health_plan_type: normalizeText(input.health_plan_type) || null,
    plan_holder_name: normalizeText(input.plan_holder_name) || null,
    plan_valid_until: normalizeDate(input.plan_valid_until),
    consent_lgpd: Boolean(input.consent_lgpd),
    consent_contact: Boolean(input.consent_contact),
    consent_plan_data: Boolean(input.consent_plan_data),
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const token = normalizeText(body.public_token || body.token)
    if (!token) return NextResponse.json({ error: 'Token ausente.' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: link, error: linkError } = await supabase
      .from('patient_precheck_links')
      .select('*')
      .eq('public_token', token)
      .maybeSingle()

    if (linkError || !link) return NextResponse.json({ error: 'Link indisponível.' }, { status: 404 })
    if (link.status !== 'open') return NextResponse.json({ error: 'Este check-in não está aberto.' }, { status: 403 })
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Este link expirou.' }, { status: 403 })
    }
    if (link.max_submissions && Number(link.submission_count || 0) >= Number(link.max_submissions)) {
      return NextResponse.json({ error: 'Limite de envios atingido.' }, { status: 403 })
    }

    const payload = normalizePayload(body.form || body)
    const missingFields = computeMissingFields(payload, link)
    if (missingFields.length) {
      return NextResponse.json({ error: `Campos pendentes: ${missingFields.join(', ')}`, missingFields }, { status: 400 })
    }

    const checklist = buildChecklist(payload, link)
    const userAgent = req.headers.get('user-agent') || ''
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
    const consentText = 'Paciente realizou autoatendimento por QR Code/link e autorizou uso dos dados para finalidade assistencial, administrativa, organização da chegada e conferência pela equipe.'

    const { data: submission, error: submissionError } = await supabase
      .from('patient_precheck_submissions')
      .insert({
        link_id: link.id,
        professional_user_id: link.professional_user_id,
        status: 'converted',
        patient_name: payload.patient_name,
        patient_cpf: payload.patient_cpf,
        patient_birth_date: payload.patient_birth_date,
        patient_phone: payload.patient_phone,
        patient_email: payload.patient_email,
        companion_name: payload.companion_name,
        companion_phone: payload.companion_phone,
        specialty: link.specialty || null,
        reason: payload.reason,
        symptoms: payload.symptoms,
        current_medications: payload.current_medications,
        allergies: payload.allergies,
        relevant_history: payload.relevant_history,
        administrative_notes: payload.administrative_notes,
        health_plan_provider: payload.health_plan_provider,
        health_plan_card_number: payload.health_plan_card_number,
        health_plan_type: payload.health_plan_type,
        plan_holder_name: payload.plan_holder_name,
        plan_valid_until: payload.plan_valid_until,
        consent_lgpd: payload.consent_lgpd,
        consent_contact: payload.consent_contact,
        consent_plan_data: payload.consent_plan_data,
        consent_text: consentText,
        missing_fields: missingFields,
        checklist,
        source_ip: ip,
        user_agent: userAgent,
        metadata: {
          source: 'self_checkin_public_qr',
          public_token: token,
          clinic_name: link.clinic_name || null,
          title: link.title,
          reception_mode: 'patient_self_service',
        },
      })
      .select('*')
      .single()

    if (submissionError) throw submissionError

    let guestPatientId = null
    try {
      const { data: guest } = await supabase
        .from('guest_patients')
        .insert({
          professional_id: link.professional_id || null,
          professional_user_id: link.professional_user_id,
          name: payload.patient_name,
          email: payload.patient_email,
          phone: payload.patient_phone,
          metadata: {
            created_from: 'self_checkin_public_qr',
            precheck_submission_id: submission.id,
            cpf: payload.patient_cpf,
          },
        })
        .select('*')
        .single()
      guestPatientId = guest?.id || null
    } catch {}

    const { data: intake, error: intakeError } = await supabase
      .from('patient_intakes')
      .insert({
        professional_id: link.professional_id || null,
        professional_user_id: link.professional_user_id,
        clinic_name: link.clinic_name || link.title || null,
        source: 'import',
        status: missingFields.length ? 'waiting' : 'ready',
        guest_patient_id: guestPatientId,
        patient_name: payload.patient_name,
        patient_cpf: payload.patient_cpf,
        patient_birth_date: payload.patient_birth_date,
        patient_phone: payload.patient_phone,
        patient_email: payload.patient_email,
        specialty: link.specialty || null,
        reason: payload.reason,
        health_plan_provider: payload.health_plan_provider,
        health_plan_card_number: payload.health_plan_card_number,
        health_plan_type: payload.health_plan_type,
        plan_holder_name: payload.plan_holder_name,
        plan_valid_until: payload.plan_valid_until,
        plan_payload: {},
        intake_notes: [
          payload.symptoms ? `Sintomas/relato: ${payload.symptoms}` : '',
          payload.current_medications ? `Medicamentos: ${payload.current_medications}` : '',
          payload.allergies ? `Alergias: ${payload.allergies}` : '',
          payload.relevant_history ? `Histórico: ${payload.relevant_history}` : '',
          payload.administrative_notes ? `Obs. administrativas: ${payload.administrative_notes}` : '',
        ].filter(Boolean).join('\n\n'),
        patient_data_consent: payload.consent_lgpd,
        plan_data_consent: payload.consent_plan_data,
        lgpd_consent: payload.consent_lgpd,
        data_scope: 'precheck_only',
        missing_fields: missingFields,
        checklist,
        consent_text: consentText,
        consented_at: new Date().toISOString(),
        consent_method: 'self_checkin_qr',
        metadata: {
          created_from: 'self_checkin_public_qr',
          precheck_submission_id: submission.id,
          precheck_link_id: link.id,
          public_token: token,
          reception_mode: 'patient_self_service',
          companion: {
            name: payload.companion_name,
            phone: payload.companion_phone,
          },
        },
      })
      .select('*')
      .single()

    if (intakeError) throw intakeError

    await supabase
      .from('patient_precheck_submissions')
      .update({ converted_at: new Date().toISOString(), converted_intake_id: intake.id })
      .eq('id', submission.id)

    await supabase.from('patient_precheck_events').insert({
      link_id: link.id,
      submission_id: submission.id,
      professional_user_id: link.professional_user_id,
      event_type: 'self_checkin_created_intake',
      description: 'Paciente fez autoatendimento por QR Code/link e a Entrada do Paciente foi criada automaticamente.',
      metadata: { intake_id: intake.id, public_token: token, source_ip: ip },
    })

    await supabase.from('patient_intake_events').insert({
      intake_id: intake.id,
      professional_user_id: link.professional_user_id,
      event_type: 'self_checkin_created',
      description: 'Entrada criada automaticamente a partir de autoatendimento do paciente.',
      to_status: intake.status,
      metadata: { submission_id: submission.id, public_token: token },
    })

    return NextResponse.json({ success: true, submissionId: submission.id, intakeId: intake.id, status: intake.status })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao registrar autoatendimento.' }, { status: 500 })
  }
}
