import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role env vars missing')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
}

function isFuture(value?: string | null) {
  if (!value) return false
  return new Date(value).getTime() > Date.now()
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

async function hasProAccess(supabase: any, userId: string) {
  const { data: sub } = await supabase
    .from('professional_subscriptions')
    .select('*')
    .eq('professional_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sub) return false
  if (sub.status === 'active' && isFuture(sub.current_period_ends_at)) return true
  if (sub.status === 'trial' && isFuture(sub.trial_ends_at || sub.current_period_ends_at)) return true
  return false
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req)
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const dailyApiKey = process.env.DAILY_API_KEY
    const dailyBaseUrl = (process.env.DAILY_API_BASE_URL || 'https://api.daily.co/v1').replace(/\/$/, '')

    if (!dailyApiKey) {
      return NextResponse.json({ error: 'DAILY_API_KEY não configurada no Netlify' }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const appointmentId = String(body.appointment_id || '').trim()

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointment_id obrigatório' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: authData, error: authError } = await supabase.auth.getUser(token)

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    const user = authData.user

    const { data: professional } = await supabase
      .from('professionals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!professional) {
      return NextResponse.json({ error: 'Cadastro profissional não encontrado' }, { status: 404 })
    }

    const allowed = await hasProAccess(supabase, user.id)
    if (!allowed) {
      return NextResponse.json({ error: 'Daily premium exige MyDataMed Pro ou Trial ativo' }, { status: 403 })
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from('telemedicine_appointments')
      .select('*')
      .eq('id', appointmentId)
      .maybeSingle()

    if (appointmentError || !appointment) {
      return NextResponse.json({ error: 'Teleconsulta não encontrada' }, { status: 404 })
    }

    if (appointment.professional_id && appointment.professional_id !== professional.id) {
      return NextResponse.json({ error: 'Teleconsulta pertence a outro profissional' }, { status: 403 })
    }

    const now = Math.floor(Date.now() / 1000)
    const durationMinutes = Number(appointment.duration_minutes || 30)
    const roomExp = now + Math.max(durationMinutes + 120, 180) * 60
    const roomName = slugify(`mydatamed-${appointment.id}-${Date.now().toString(36)}`)

    const dailyPayload = {
      name: roomName,
      privacy: 'public',
      properties: {
        exp: roomExp,
        max_participants: 6,
        enable_prejoin_ui: true,
        enable_screenshare: true,
        enable_chat: true,
        enable_people_ui: true,
        enable_pip_ui: true,
        enable_network_ui: true,
        enable_noise_cancellation_ui: true,
        start_video_off: false,
        start_audio_off: false,
        eject_at_room_exp: true,
        lang: 'pt-BR',
      },
    }

    const response = await fetch(`${dailyBaseUrl}/rooms`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${dailyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dailyPayload),
    })

    const dailyResponse = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json({ error: dailyResponse?.error || dailyResponse?.info || 'Erro ao criar sala Daily', details: dailyResponse }, { status: 502 })
    }

    const roomUrl = dailyResponse.url || dailyResponse.room_url || dailyResponse.config?.url
    if (!roomUrl) {
      return NextResponse.json({ error: 'Daily criou sala sem URL retornada', details: dailyResponse }, { status: 502 })
    }

    const metadata = {
      ...(appointment.metadata || {}),
      daily: {
        room_name: dailyResponse.name || roomName,
        room_url: roomUrl,
        exp: roomExp,
        created_at: new Date().toISOString(),
        provider_payload: dailyResponse,
      },
    }

    const { data: updatedAppointment, error: updateError } = await supabase
      .from('telemedicine_appointments')
      .update({
        professional_id: appointment.professional_id || professional.id,
        professional_name: appointment.professional_name || professional.full_name,
        professional_email: appointment.professional_email || professional.email || user.email,
        provider: 'daily',
        room_url: roomUrl,
        meet_url: roomUrl,
        status: ['requested', 'scheduled'].includes(appointment.status) ? 'scheduled' : appointment.status,
        professional_confirmed: true,
        professional_confirmed_at: appointment.professional_confirmed_at || new Date().toISOString(),
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointment.id)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message || 'Sala criada, mas erro ao salvar teleconsulta' }, { status: 500 })
    }

    await supabase.from('telemedicine_events').insert({
      appointment_id: appointment.id,
      actor_user_id: user.id,
      professional_id: professional.id,
      patient_id: appointment.patient_id || appointment.user_id || null,
      type: 'daily_room_created',
      description: 'Sala Daily premium criada para a teleconsulta.',
      metadata: {
        room_url: roomUrl,
        room_name: dailyResponse.name || roomName,
        exp: roomExp,
      },
    })

    return NextResponse.json({
      ok: true,
      appointment: updatedAppointment,
      room_url: roomUrl,
      room_name: dailyResponse.name || roomName,
      exp: roomExp,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
