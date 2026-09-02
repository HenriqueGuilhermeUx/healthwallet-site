import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service role env vars missing')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
}

function getAverage(rows: any[], key: string) {
  const values = rows.map((row) => Number(row[key])).filter((value) => Number.isFinite(value) && value > 0)
  if (!values.length) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function buildWindow(rows: any[]) {
  return {
    days: rows.length,
    avg_steps: getAverage(rows, 'steps'),
    avg_sleep_minutes: getAverage(rows, 'sleep_minutes'),
    avg_resting_heart_rate: getAverage(rows, 'resting_heart_rate'),
    avg_spo2: getAverage(rows, 'spo2_avg'),
    avg_device_context_score: getAverage(rows, 'device_context_score'),
    latest_weight_kg: rows[0]?.weight_kg || null,
    latest_blood_pressure: rows[0]?.systolic_bp && rows[0]?.diastolic_bp ? `${rows[0].systolic_bp}/${rows[0].diastolic_bp}` : null,
  }
}

async function getProfessional(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('professionals')
    .select('id,user_id,full_name,professional_type,specialty')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

async function getCareLinkById(supabase: any, careLinkId: string, professionalId: string) {
  try {
    const { data } = await supabase
      .from('professional_care_links')
      .select('*')
      .eq('id', careLinkId)
      .eq('professional_id', professionalId)
      .maybeSingle()
    return data || null
  } catch {
    return null
  }
}

async function getCareLinkByPatientEmail(supabase: any, patientEmail: string, professionalId: string) {
  try {
    const { data } = await supabase
      .from('professional_care_links')
      .select('*')
      .eq('professional_id', professionalId)
      .eq('status', 'active')
      .ilike('patient_email', patientEmail)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data || null
  } catch {
    return null
  }
}

async function listAuthorizedPatients(supabase: any, professional: any) {
  const { data: consents, error } = await supabase
    .from('health_data_consents')
    .select('*')
    .eq('status', 'active')
    .eq('professional_id', professional.id)
    .contains('allowed_categories', ['device_data'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  const rows = consents || []
  const careLinkIds = rows.map((item: any) => item.care_link_id).filter(Boolean)
  let careLinks: any[] = []

  if (careLinkIds.length) {
    try {
      const { data } = await supabase
        .from('professional_care_links')
        .select('*')
        .in('id', careLinkIds)
      careLinks = data || []
    } catch {
      careLinks = []
    }
  }

  const linkMap = new Map(careLinks.map((item) => [item.id, item]))

  return rows.map((consent: any) => {
    const link = consent.care_link_id ? linkMap.get(consent.care_link_id) : null
    return {
      consent_id: consent.id,
      patient_id: consent.patient_id,
      care_link_id: consent.care_link_id,
      patient_name: link?.patient_name || consent.metadata?.patient_name || 'Paciente HealthWallet',
      patient_email: link?.patient_email || consent.metadata?.patient_email || null,
      allowed_categories: consent.allowed_categories || [],
      expires_at: consent.expires_at || null,
      authorized_at: consent.created_at,
      source: link ? 'professional_care_links' : 'health_data_consents',
    }
  })
}

async function resolveConsent(supabase: any, professional: any, params: { patientId?: string | null; careLinkId?: string | null; patientEmail?: string | null }) {
  let effectivePatientId = params.patientId || null
  let effectiveCareLinkId = params.careLinkId || null
  let careLink: any = null

  if (effectiveCareLinkId) {
    careLink = await getCareLinkById(supabase, effectiveCareLinkId, professional.id)
    if (careLink?.patient_id) effectivePatientId = careLink.patient_id
  }

  if (!effectivePatientId && params.patientEmail) {
    careLink = await getCareLinkByPatientEmail(supabase, params.patientEmail, professional.id)
    if (careLink?.id) effectiveCareLinkId = careLink.id
    if (careLink?.patient_id) effectivePatientId = careLink.patient_id
  }

  let consentQuery = supabase
    .from('health_data_consents')
    .select('*')
    .eq('status', 'active')
    .eq('professional_id', professional.id)
    .contains('allowed_categories', ['device_data'])

  if (effectiveCareLinkId) consentQuery = consentQuery.eq('care_link_id', effectiveCareLinkId)
  if (effectivePatientId) consentQuery = consentQuery.eq('patient_id', effectivePatientId)

  const { data: consent, error } = await consentQuery.order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  if (!consent) return { consent: null, careLink, patientId: effectivePatientId }

  return {
    consent,
    careLink,
    patientId: effectivePatientId || consent.patient_id,
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req)
    if (!token) return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: authUser, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authUser?.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const professional = await getProfessional(supabase, authUser.user.id)
    if (!professional?.id) return NextResponse.json({ error: 'Profissional não encontrado.' }, { status: 403 })

    const url = new URL(req.url)
    const patientId = url.searchParams.get('patient_id')
    const careLinkId = url.searchParams.get('care_link_id')
    const patientEmail = url.searchParams.get('patient_email')

    if (!patientId && !careLinkId && !patientEmail) {
      const patients = await listAuthorizedPatients(supabase, professional)
      return NextResponse.json({
        success: true,
        professional_id: professional.id,
        patients,
        disclaimer: 'A lista mostra apenas pacientes que autorizaram dados de dispositivos para este profissional.',
      })
    }

    const { consent, careLink, patientId: effectivePatientId } = await resolveConsent(supabase, professional, { patientId, careLinkId, patientEmail })
    if (!consent || !effectivePatientId) {
      return NextResponse.json({ error: 'Dados de dispositivos não autorizados para este profissional.' }, { status: 403 })
    }

    const [{ data: summaries, error: summaryError }, { data: latestScore }] = await Promise.all([
      supabase
        .from('health_daily_summaries')
        .select('*')
        .eq('user_id', effectivePatientId)
        .order('summary_date', { ascending: false })
        .limit(30),
      supabase
        .from('health_scores')
        .select('*')
        .eq('user_id', effectivePatientId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (summaryError) throw summaryError

    await supabase.from('health_data_audit_logs').insert({
      patient_id: effectivePatientId,
      actor_user_id: authUser.user.id,
      actor_role: 'professional',
      action: 'professional_viewed_device_summary',
      data_category: 'device_data',
      reason: url.searchParams.get('reason') || 'care_context',
      source_app: 'mydatamed',
      reference_table: 'health_data_consents',
      reference_id: consent.id,
      metadata: {
        professional_id: professional.id,
        care_link_id: consent.care_link_id || null,
        patient_email: patientEmail || careLink?.patient_email || null,
      },
    })

    const rows = summaries || []
    const latest = rows[0] || null

    return NextResponse.json({
      success: true,
      patient: {
        id: effectivePatientId,
        name: careLink?.patient_name || consent.metadata?.patient_name || 'Paciente HealthWallet',
        email: careLink?.patient_email || consent.metadata?.patient_email || patientEmail || null,
      },
      consent_id: consent.id,
      care_link_id: consent.care_link_id || careLink?.id || null,
      latest,
      window_30d: buildWindow(rows),
      medscore: latestScore || null,
      disclaimer: 'Dados de dispositivos pessoais são complementares e não substituem avaliação profissional.',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar resumo autorizado.' }, { status: 500 })
  }
}
