import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service role env vars missing')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

function hasWebhookSecret(req: NextRequest) {
  const expected = process.env.CALCOM_WEBHOOK_SECRET || process.env.AUTOMATION_API_SECRET || process.env.N8N_AUTOPILOT_SECRET
  if (!expected) return false

  return (
    req.headers.get('x-calcom-secret') === expected ||
    req.headers.get('x-automation-secret') === expected ||
    req.headers.get('x-webhook-secret') === expected ||
    req.nextUrl.searchParams.get('secret') === expected
  )
}

function first<T>(value: T | T[] | undefined | null): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function readPath(source: any, paths: string[]) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => {
      if (acc == null) return undefined
      if (key.endsWith(']')) {
        const match = key.match(/(.+)\[(\d+)\]/)
        if (!match) return acc[key]
        return acc[match[1]]?.[Number(match[2])]
      }
      return acc[key]
    }, source)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

function normalizeEventType(raw: any) {
  const text = String(raw || '').trim().toLowerCase().replace(/[.\s-]+/g, '_')

  if (text.includes('resched')) return 'calendar_booking_rescheduled'
  if (text.includes('cancel')) return 'calendar_booking_cancelled'
  if (text.includes('created') || text.includes('booked') || text.includes('booking_create')) return 'calendar_booking_created'

  return text ? `calendar_${text}` : 'calendar_booking_unknown'
}

function datePart(value: any) {
  const text = String(value || '')
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] || null
}

function timePart(value: any) {
  const text = String(value || '')
  const match = text.match(/T(\d{2}:\d{2})/)
  return match?.[1] || null
}

function minutesBetween(start: any, end: any) {
  const startDate = new Date(start || '')
  const endDate = new Date(end || '')
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null
  return Math.max(15, Math.round((endDate.getTime() - startDate.getTime()) / 60000))
}

function normalizeBooking(body: any, req: NextRequest) {
  const payload = body.payload || body.data || body.booking || body
  const attendee = first(payload.attendees) || payload.attendee || payload.invitee || payload.guest || {}
  const organizer = payload.organizer || payload.user || first(payload.hosts) || payload.host || {}
  const metadata = payload.metadata || payload.responses?.metadata || body.metadata || {}

  const rawType = body.triggerEvent || body.eventType || body.event || body.type || payload.triggerEvent || payload.eventType || payload.status
  const eventType = normalizeEventType(rawType)

  const startTime = readPath(payload, ['startTime', 'start_time', 'start', 'scheduledAt', 'scheduled_at', 'booking.startTime'])
  const endTime = readPath(payload, ['endTime', 'end_time', 'end', 'booking.endTime'])
  const duration = Number(readPath(payload, ['duration', 'durationMinutes', 'length']) || minutesBetween(startTime, endTime) || 30)

  const externalBookingId = String(
    readPath(payload, ['uid', 'bookingUid', 'booking_uid', 'bookingId', 'booking_id', 'id', 'eventId']) ||
    readPath(body, ['uid', 'bookingUid', 'booking_id', 'id']) ||
    ''
  )

  const attendeeName =
    readPath(attendee, ['name', 'fullName', 'full_name']) ||
    readPath(payload, ['responses.name.value', 'responses.name', 'name']) ||
    readPath(body, ['name'])

  const attendeeEmail =
    readPath(attendee, ['email']) ||
    readPath(payload, ['responses.email.value', 'responses.email', 'email', 'attendeeEmail']) ||
    readPath(body, ['email'])

  const organizerEmail =
    readPath(organizer, ['email']) ||
    readPath(payload, ['organizerEmail', 'user.email', 'host.email', 'owner.email']) ||
    readPath(body, ['organizerEmail'])

  const organizerUsername =
    readPath(organizer, ['username', 'slug']) ||
    readPath(payload, ['username', 'user.username', 'eventType.slug'])

  const title =
    readPath(payload, ['title', 'eventTitle', 'eventType.title', 'eventType.name']) ||
    readPath(body, ['title']) ||
    'Consulta MyDataMed'

  const location = readPath(payload, ['location', 'locationUrl', 'videoCallUrl', 'meetingUrl', 'conferenceUrl'])
  const bookingUrl = readPath(payload, ['bookingUrl', 'eventUrl', 'rescheduleUrl']) || readPath(body, ['bookingUrl'])
  const cancelUrl = readPath(payload, ['cancelUrl', 'cancellationUrl'])
  const rescheduleUrl = readPath(payload, ['rescheduleUrl'])

  return {
    provider: req.nextUrl.searchParams.get('provider') || 'calcom',
    event_type: eventType,
    external_booking_id: externalBookingId,
    title,
    reason: readPath(payload, ['description', 'notes', 'reason', 'responses.reason.value', 'responses.reason']) || title,
    start_time: startTime,
    end_time: endTime,
    preferred_date: datePart(startTime),
    preferred_time: timePart(startTime),
    duration_minutes: duration,
    timezone: readPath(payload, ['timeZone', 'timezone', 'attendee.timeZone']) || null,
    patient_id: metadata.patient_id || req.nextUrl.searchParams.get('patient_id') || null,
    patient_name: metadata.patient_name || attendeeName || null,
    patient_email: metadata.patient_email || attendeeEmail || null,
    professional_id: metadata.professional_id || req.nextUrl.searchParams.get('professional_id') || null,
    professional_user_id: metadata.professional_user_id || null,
    professional_email: metadata.professional_email || organizerEmail || null,
    professional_username: metadata.professional_username || organizerUsername || null,
    specialty: metadata.specialty || title || 'Consulta',
    location,
    booking_url: bookingUrl,
    cancel_url: cancelUrl,
    reschedule_url: rescheduleUrl,
    metadata,
  }
}

async function findCalendarIntegration(supabase: ReturnType<typeof getSupabaseAdmin>, booking: any) {
  if (booking.professional_id || booking.professional_user_id) return null

  let query = supabase
    .from('professional_calendar_integrations')
    .select('*')
    .eq('provider', booking.provider || 'calcom')
    .eq('status', 'active')
    .limit(1)

  if (booking.professional_email) {
    const { data } = await query.eq('external_user_email', String(booking.professional_email).toLowerCase()).maybeSingle()
    if (data) return data
  }

  if (booking.professional_username) {
    const { data } = await supabase
      .from('professional_calendar_integrations')
      .select('*')
      .eq('provider', booking.provider || 'calcom')
      .eq('status', 'active')
      .eq('external_username', booking.professional_username)
      .limit(1)
      .maybeSingle()
    if (data) return data
  }

  return null
}

async function insertRawWebhookLog(supabase: ReturnType<typeof getSupabaseAdmin>, booking: any, body: any) {
  try {
    const { data } = await supabase
      .from('calcom_webhook_events')
      .insert({
        provider: booking.provider,
        event_type: booking.event_type,
        external_booking_id: booking.external_booking_id || null,
        professional_id: booking.professional_id || null,
        patient_id: booking.patient_id || null,
        patient_email: booking.patient_email || null,
        professional_email: booking.professional_email || null,
        normalized_payload: booking,
        raw_payload: body,
        status: 'received',
      })
      .select('id')
      .maybeSingle()
    return data?.id || null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasWebhookSecret(req)) return NextResponse.json({ error: 'Segredo inválido' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const supabase = getSupabaseAdmin()
    const booking = normalizeBooking(body, req)

    const integration = await findCalendarIntegration(supabase, booking)
    if (integration) {
      booking.professional_id = booking.professional_id || integration.professional_id
      booking.professional_user_id = booking.professional_user_id || integration.professional_user_id
      booking.metadata = {
        ...(booking.metadata || {}),
        calendar_integration_id: integration.id,
      }
    }

    const rawLogId = await insertRawWebhookLog(supabase, booking, body)

    const { data: event, error } = await supabase
      .from('automation_events')
      .insert({
        event_type: booking.event_type,
        source_app: booking.provider,
        source_table: 'calcom_booking',
        source_id: booking.external_booking_id || rawLogId,
        actor_user_id: booking.professional_user_id || null,
        actor_role: 'calendar_webhook',
        patient_id: booking.patient_id || null,
        professional_id: booking.professional_id || null,
        payload: {
          normalized_booking: booking,
          raw_payload: body,
        },
        metadata: {
          powered_by: 'MyDataMed Autopilot + n8n',
          n8n_ready: true,
          provider: booking.provider,
          raw_webhook_log_id: rawLogId,
        },
        priority: 3,
        status: 'pending',
      })
      .select('*')
      .single()

    if (error || !event) {
      return NextResponse.json({ error: `${error?.message || 'Erro ao criar evento'}. Rode SQL_AUTOMATION_EVENTS_V1.sql e SQL_CALCOM_AGENDA_V1.sql.` }, { status: 500 })
    }

    if (rawLogId) {
      await supabase
        .from('calcom_webhook_events')
        .update({ automation_event_id: event.id })
        .eq('id', rawLogId)
    }

    return NextResponse.json({ ok: true, event, booking })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado no webhook Cal.com' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'MyDataMed Cal.com webhook', status: 'ready' })
}
