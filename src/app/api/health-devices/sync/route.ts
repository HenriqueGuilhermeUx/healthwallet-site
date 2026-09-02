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

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function countDataPoints(summary: any) {
  return [
    summary.steps,
    summary.sleep_minutes,
    summary.resting_heart_rate,
    summary.avg_heart_rate,
    summary.hrv_avg,
    summary.spo2_avg,
    summary.systolic_bp,
    summary.diastolic_bp,
    summary.weight_kg,
    summary.temperature_c,
    summary.active_calories,
    summary.activity_minutes,
  ].filter((value) => nullableNumber(value) !== null).length
}

const allowedProviders = new Set(['apple_health', 'health_connect', 'fitbit', 'garmin', 'oura', 'withings', 'polar', 'samsung_health', 'manual', 'other'])
const allowedObservationTypes = new Set(['steps', 'sleep', 'heart_rate', 'resting_heart_rate', 'avg_heart_rate', 'spo2', 'blood_pressure_systolic', 'blood_pressure_diastolic', 'weight', 'temperature', 'hrv', 'activity', 'calories_active', 'respiratory_rate', 'other'])

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req)
    if (!token) return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: authUser, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authUser?.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const userId = authUser.user.id
    const body = await req.json()
    const provider = String(body.provider || body.connection?.provider || 'manual')
    if (!allowedProviders.has(provider)) return NextResponse.json({ error: 'Provider inválido.' }, { status: 400 })

    let connection: any = null

    if (body.connection || body.create_connection) {
      const { data: existing } = await supabase
        .from('health_device_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .neq('status', 'revoked')
        .maybeSingle()

      const connectionPayload = {
        user_id: userId,
        provider,
        provider_user_id: body.connection?.provider_user_id || null,
        display_name: body.connection?.display_name || body.connection?.source_device || provider,
        source_device: body.connection?.source_device || body.connection?.display_name || provider,
        status: body.connection?.status || 'connected',
        scopes_authorized: body.connection?.scopes_authorized || body.scopes_authorized || [],
        last_sync_at: new Date().toISOString(),
        metadata: {
          ...(body.connection?.metadata || {}),
          source_app: body.source_app || 'healthwallet_mobile',
          consent_required_for_sharing: true,
        },
      }

      const result = existing?.id
        ? await supabase.from('health_device_connections').update(connectionPayload).eq('id', existing.id).select('*').single()
        : await supabase.from('health_device_connections').insert(connectionPayload).select('*').single()

      if (result.error) throw result.error
      connection = result.data
    }

    const savedSummaries: any[] = []
    const summaries = Array.isArray(body.summaries) ? body.summaries : body.summary ? [body.summary] : []

    for (const summary of summaries) {
      const summaryDate = summary.summary_date || summary.date || todayIsoDate()
      const dataPoints = summary.data_points || countDataPoints(summary)

      const rpcResult = await supabase.rpc('upsert_health_daily_summary', {
        p_user_id: userId,
        p_summary_date: summaryDate,
        p_sources: summary.sources?.length ? summary.sources : [provider],
        p_data_points: dataPoints,
        p_steps: nullableNumber(summary.steps),
        p_sleep_minutes: nullableNumber(summary.sleep_minutes),
        p_resting_heart_rate: nullableNumber(summary.resting_heart_rate),
        p_avg_heart_rate: nullableNumber(summary.avg_heart_rate),
        p_hrv_avg: nullableNumber(summary.hrv_avg),
        p_spo2_avg: nullableNumber(summary.spo2_avg),
        p_systolic_bp: nullableNumber(summary.systolic_bp),
        p_diastolic_bp: nullableNumber(summary.diastolic_bp),
        p_weight_kg: nullableNumber(summary.weight_kg),
        p_temperature_c: nullableNumber(summary.temperature_c),
        p_active_calories: nullableNumber(summary.active_calories),
        p_activity_minutes: nullableNumber(summary.activity_minutes),
        p_metadata: {
          ...(summary.metadata || {}),
          provider,
          source_app: body.source_app || 'healthwallet_mobile',
          synced_via: 'api',
        },
      })

      if (rpcResult.error) throw rpcResult.error
      savedSummaries.push({ id: rpcResult.data, summary_date: summaryDate })
    }

    const observations = Array.isArray(body.observations) ? body.observations : []
    const validObservations = observations
      .filter((item: any) => allowedObservationTypes.has(String(item.observation_type || item.type || 'other')))
      .map((item: any) => ({
        user_id: userId,
        connection_id: connection?.id || item.connection_id || null,
        provider,
        source_device: item.source_device || connection?.source_device || null,
        observation_type: item.observation_type || item.type || 'other',
        code: item.code || null,
        value_numeric: nullableNumber(item.value_numeric ?? item.value),
        value_text: item.value_text || null,
        unit: item.unit || null,
        observed_at: item.observed_at || item.start_time || new Date().toISOString(),
        start_time: item.start_time || null,
        end_time: item.end_time || null,
        external_id: item.external_id || null,
        metadata: item.metadata || {},
      }))

    if (validObservations.length) {
      const { error } = await supabase.from('health_observations').upsert(validObservations, { onConflict: 'user_id,provider,external_id' })
      if (error) throw error
    }

    const { data: latest } = await supabase
      .from('health_daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('summary_date', { ascending: false })
      .limit(30)

    return NextResponse.json({
      success: true,
      connection,
      savedSummaries,
      observations: validObservations.length,
      latest: latest || [],
      disclaimer: 'Dados de dispositivos pessoais são complementares e não substituem avaliação profissional.',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao sincronizar dados de dispositivos.' }, { status: 500 })
  }
}
