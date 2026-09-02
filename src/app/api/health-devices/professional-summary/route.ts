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

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req)
    if (!token) return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: authUser, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authUser?.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const url = new URL(req.url)
    const patientId = url.searchParams.get('patient_id')
    const careLinkId = url.searchParams.get('care_link_id')

    if (!patientId && !careLinkId) {
      return NextResponse.json({ error: 'Informe patient_id ou care_link_id.' }, { status: 400 })
    }

    const { data: professional } = await supabase
      .from('professionals')
      .select('id,user_id,full_name')
      .eq('user_id', authUser.user.id)
      .maybeSingle()

    if (!professional?.id) {
      return NextResponse.json({ error: 'Profissional não encontrado.' }, { status: 403 })
    }

    let consentQuery = supabase
      .from('health_data_consents')
      .select('*')
      .eq('status', 'active')
      .eq('professional_id', professional.id)
      .contains('allowed_categories', ['device_data'])

    if (careLinkId) consentQuery = consentQuery.eq('care_link_id', careLinkId)
    if (patientId) consentQuery = consentQuery.eq('patient_id', patientId)

    const { data: consent, error: consentError } = await consentQuery.order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (consentError) throw consentError
    if (!consent) return NextResponse.json({ error: 'Dados de dispositivos não autorizados para este profissional.' }, { status: 403 })

    const effectivePatientId = patientId || consent.patient_id

    const { data: summaries, error: summaryError } = await supabase
      .from('health_daily_summaries')
      .select('*')
      .eq('user_id', effectivePatientId)
      .order('summary_date', { ascending: false })
      .limit(30)

    if (summaryError) throw summaryError

    await supabase.from('health_data_audit_logs').insert({
      patient_id: effectivePatientId,
      actor_user_id: authUser.user.id,
      actor_role: 'professional',
      action: 'professional_viewed_device_summary',
      data_category: 'device_data',
      source_app: 'mydatamed',
      reference_table: 'health_data_consents',
      reference_id: consent.id,
      metadata: {
        professional_id: professional.id,
        care_link_id: consent.care_link_id || null,
      },
    })

    const rows = summaries || []
    const latest = rows[0] || null

    return NextResponse.json({
      success: true,
      patient_id: effectivePatientId,
      consent_id: consent.id,
      latest,
      window_30d: {
        days: rows.length,
        avg_steps: getAverage(rows, 'steps'),
        avg_sleep_minutes: getAverage(rows, 'sleep_minutes'),
        avg_resting_heart_rate: getAverage(rows, 'resting_heart_rate'),
        avg_spo2: getAverage(rows, 'spo2_avg'),
        avg_device_context_score: getAverage(rows, 'device_context_score'),
      },
      disclaimer: 'Dados de dispositivos pessoais são complementares e não substituem avaliação profissional.',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar resumo autorizado.' }, { status: 500 })
  }
}
