import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service role env vars missing')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

function hasAutomationSecret(req: NextRequest) {
  const expected = process.env.AUTOMATION_API_SECRET || process.env.N8N_AUTOPILOT_SECRET
  if (!expected) return false
  return req.headers.get('x-automation-secret') === expected || req.nextUrl.searchParams.get('secret') === expected
}

function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function safeJson(value: any) {
  return value && typeof value === 'object' ? value : {}
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

function bookingFromEvent(event: any) {
  const payload = safeJson(event.payload)
  const booking = payload.normalized_booking || payload.booking || payload
  const startTime = booking.start_time || booking.startTime || booking.start || null

  return {
    ...booking,
    external_booking_id: booking.external_booking_id || booking.uid || booking.id || event.source_id || null,
    preferred_date: booking.preferred_date || datePart(startTime),
    preferred_time: booking.preferred_time || timePart(startTime),
    duration_minutes: Number(booking.duration_minutes || booking.duration || 30),
    start_time: startTime,
  }
}

async function loadEvent(supabase: ReturnType<typeof getSupabaseAdmin>, body: any) {
  if (body.event?.id) return body.event
  if (!body.event_id) throw new Error('event_id obrigatório')

  const { data, error } = await supabase
    .from('automation_events')
    .select('*')
    .eq('id', body.event_id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Evento não encontrado')
  return data
}

async function markEvent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  event: any,
  status: 'processing' | 'processed' | 'failed' | 'skipped',
  metadata: any = {},
  lastError?: string
) {
  if (!event?.id) return null

  const payload: any = {
    status,
    updated_at: new Date().toISOString(),
    metadata: {
      ...(event.metadata || {}),
      ...(metadata || {}),
      processed_by: 'mydatamed-autopilot-api',
    },
  }

  if (status === 'processing') {
    payload.locked_at = new Date().toISOString()
    payload.locked_by = 'n8n-oracle'
  }

  if (status === 'processed' || status === 'skipped') {
    payload.processed_at = new Date().toISOString()
  }

  if (status === 'failed') {
    payload.last_error = lastError || 'Falha no processamento Autopilot'
    payload.attempts = Number(event.attempts || 0) + 1
  }

  const { data } = await supabase
    .from('automation_events')
    .update(payload)
    .eq('id', event.id)
    .select('*')
    .maybeSingle()

  return data
}

async function logCareLinkEvent(supabase: ReturnType<typeof getSupabaseAdmin>, careLinkId: string, eventType: string, description: string, metadata: any = {}) {
  if (!careLinkId) return
  await supabase.from('professional_care_link_events').insert({
    care_link_id: careLinkId,
    actor_role: 'system',
    event_type: eventType,
    description,
    metadata: {
      source: 'mydatamed-autopilot',
      ...metadata,
    },
  })
}

async function logTelemedicineEvent(supabase: ReturnType<typeof getSupabaseAdmin>, appointment: any, professional: any, type: string, description: string, metadata: any = {}) {
  if (!appointment?.id) return
  try {
    await supabase.from('telemedicine_events').insert({
      appointment_id: appointment.id,
      actor_user_id: professional?.user_id || appointment.professional_user_id || null,
      professional_id: appointment.professional_id || professional?.id || null,
      patient_id: appointment.patient_id || appointment.user_id || null,
      type,
      description,
      metadata: {
        source: 'mydatamed-autopilot',
        ...metadata,
      },
    })
  } catch {
    // Não trava o processamento caso a tabela de eventos ainda não exista.
  }
}

async function createTaskOnce(supabase: ReturnType<typeof getSupabaseAdmin>, careLink: any, template: any) {
  const autopilotType = template.autopilot_type

  const { data: existing } = await supabase
    .from('professional_crm_tasks')
    .select('id')
    .eq('professional_user_id', careLink.professional_user_id)
    .eq('patient_id', careLink.patient_id)
    .contains('metadata', { care_link_id: careLink.id, autopilot_type: autopilotType })
    .limit(1)
    .maybeSingle()

  if (existing?.id) return { id: existing.id, skipped: true }

  const { data, error } = await supabase
    .from('professional_crm_tasks')
    .insert({
      professional_user_id: careLink.professional_user_id,
      patient_id: careLink.patient_id,
      task_type: template.task_type,
      title: template.title,
      description: template.description,
      channel: template.channel || 'manual',
      message_template: template.message_template || template.description,
      status: 'pending',
      due_at: template.due_at,
      metadata: {
        source: 'mydatamed-autopilot',
        powered_by: 'SmartBots + Staff',
        care_link_id: careLink.id,
        professional_id: careLink.professional_id,
        patient_name: careLink.patient_name || null,
        autopilot_type: autopilotType,
        n8n_ready: true,
      },
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

async function createAppointmentTaskOnce(supabase: ReturnType<typeof getSupabaseAdmin>, professional: any, appointment: any, template: any) {
  if (!professional?.user_id) return { skipped: true, reason: 'professional_user_id ausente' }

  const autopilotType = template.autopilot_type
  const { data: existing } = await supabase
    .from('professional_crm_tasks')
    .select('id')
    .eq('professional_user_id', professional.user_id)
    .eq('appointment_id', appointment.id)
    .contains('metadata', { autopilot_type: autopilotType })
    .limit(1)
    .maybeSingle()

  if (existing?.id) return { id: existing.id, skipped: true }

  const { data, error } = await supabase
    .from('professional_crm_tasks')
    .insert({
      professional_user_id: professional.user_id,
      patient_id: appointment.patient_id || appointment.user_id || null,
      appointment_id: appointment.id,
      task_type: template.task_type,
      title: template.title,
      description: template.description,
      channel: template.channel || 'manual',
      message_template: template.message_template || template.description,
      status: 'pending',
      due_at: template.due_at,
      metadata: {
        source: 'mydatamed-autopilot-calendar',
        powered_by: 'Cal.com + n8n + SmartBots + Staff',
        appointment_id: appointment.id,
        calcom_booking_id: appointment.calcom_booking_id || null,
        professional_id: professional.id,
        patient_name: appointment.patient_name || null,
        patient_email: appointment.patient_email || null,
        autopilot_type: autopilotType,
        n8n_ready: true,
      },
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

async function upsertCrmContact(supabase: ReturnType<typeof getSupabaseAdmin>, professional: any, appointment: any) {
  if (!professional?.user_id || !appointment?.patient_id) return

  try {
    const { data: existing } = await supabase
      .from('professional_crm_contacts')
      .select('id')
      .eq('professional_user_id', professional.user_id)
      .eq('patient_id', appointment.patient_id)
      .maybeSingle()

    if (existing?.id) {
      await supabase
        .from('professional_crm_contacts')
        .update({
          patient_name: appointment.patient_name || null,
          patient_email: appointment.patient_email || null,
          lifecycle_stage: 'patient',
          last_contact_at: new Date().toISOString(),
          metadata: {
            source: 'calcom-autopilot',
            last_appointment_id: appointment.id,
            calcom_booking_id: appointment.calcom_booking_id || null,
          },
        })
        .eq('id', existing.id)
      return
    }

    await supabase.from('professional_crm_contacts').insert({
      professional_user_id: professional.user_id,
      patient_id: appointment.patient_id,
      patient_name: appointment.patient_name || null,
      patient_email: appointment.patient_email || null,
      source: 'calcom',
      lifecycle_stage: 'patient',
      last_contact_at: new Date().toISOString(),
      metadata: {
        appointment_id: appointment.id,
        calcom_booking_id: appointment.calcom_booking_id || null,
      },
    })
  } catch {
    // CRM pode ainda não estar ativado no Supabase.
  }
}

async function loadProfessionalForBooking(supabase: ReturnType<typeof getSupabaseAdmin>, event: any, booking: any) {
  const professionalId = event.professional_id || booking.professional_id || booking.metadata?.professional_id

  if (professionalId) {
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', professionalId)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  const email = booking.professional_email || booking.organizer_email
  const username = booking.professional_username

  if (email || username) {
    let query = supabase
      .from('professional_calendar_integrations')
      .select('*')
      .eq('provider', booking.provider || 'calcom')
      .eq('status', 'active')
      .limit(1)

    if (email) query = query.eq('external_user_email', String(email).toLowerCase())
    else query = query.eq('external_username', username)

    const { data: integration } = await query.maybeSingle()
    if (integration?.professional_id) {
      const { data } = await supabase
        .from('professionals')
        .select('*')
        .eq('id', integration.professional_id)
        .maybeSingle()
      if (data) return data
    }
  }

  return null
}

async function processCareLinkApproved(supabase: ReturnType<typeof getSupabaseAdmin>, event: any) {
  if (!event.care_link_id) throw new Error('care_link_id ausente no evento')

  const { data: careLink, error } = await supabase
    .from('professional_care_links')
    .select('*')
    .eq('id', event.care_link_id)
    .maybeSingle()

  if (error) throw error
  if (!careLink) throw new Error('Vínculo assistencial não encontrado')

  const expired = careLink.expires_at && new Date(careLink.expires_at).getTime() < Date.now()
  if (careLink.status !== 'active' || expired || !careLink.patient_id) {
    return {
      skipped: true,
      reason: 'Vínculo não está ativo, expirou ou não possui patient_id aprovado.',
      care_link_status: careLink.status,
    }
  }

  const tasks = [
    {
      autopilot_type: 'initial_review',
      task_type: 'care_link_onboarding',
      title: 'Revisar paciente recém-vinculado',
      description: 'Abra o painel do paciente, revise Passport, exames, medicamentos, alergias e resumo antes do primeiro acompanhamento.',
      due_at: addDays(0),
    },
    {
      autopilot_type: 'missing_data_request',
      task_type: 'data_update_request',
      title: 'Solicitar atualização de dados do paciente',
      description: 'Pedir ao paciente para atualizar Passport, medicamentos, alergias, CNS/UBS e exames recentes no HealthWallet.',
      due_at: addDays(1),
    },
    {
      autopilot_type: 'follow_up_7d',
      task_type: 'follow_up',
      title: 'Follow-up do vínculo assistencial em 7 dias',
      description: 'Verificar se o paciente atualizou os dados e se precisa de retorno, orientação ou teleconsulta.',
      due_at: addDays(7),
    },
    {
      autopilot_type: 'plan_review_30d',
      task_type: 'care_plan_review',
      title: 'Revisar acompanhamento em 30 dias',
      description: 'Avaliar evolução, pendências, exames e necessidade de plano mensal, teleconsulta ou novo documento.',
      due_at: addDays(30),
    },
  ]

  const createdTasks = []
  for (const task of tasks) {
    createdTasks.push(await createTaskOnce(supabase, careLink, task))
  }

  await logCareLinkEvent(
    supabase,
    careLink.id,
    'autopilot_care_link_approved_processed',
    'Autopilot processou vínculo aprovado e preparou tarefas iniciais de acompanhamento.',
    { task_count: createdTasks.length, tasks: createdTasks.map((task: any) => task.id).filter(Boolean) }
  )

  return {
    care_link_id: careLink.id,
    patient_id: careLink.patient_id,
    professional_id: careLink.professional_id,
    created_or_existing_tasks: createdTasks.map((task: any) => ({ id: task.id, skipped: Boolean(task.skipped) })),
  }
}

async function processSmartBotsTaskCreated(supabase: ReturnType<typeof getSupabaseAdmin>, event: any) {
  if (!event.task_id) return { skipped: true, reason: 'task_id ausente' }

  const { data: task, error } = await supabase
    .from('professional_crm_tasks')
    .select('*')
    .eq('id', event.task_id)
    .maybeSingle()

  if (error) throw error
  if (!task) return { skipped: true, reason: 'Tarefa SmartBots não encontrada' }

  if (event.care_link_id) {
    await logCareLinkEvent(
      supabase,
      event.care_link_id,
      'autopilot_smartbots_task_ready',
      'Autopilot identificou tarefa SmartBots pronta para execução operacional.',
      { task_id: task.id, task_type: task.task_type, channel: task.channel }
    )
  }

  return {
    task_id: task.id,
    task_type: task.task_type,
    status: task.status,
    channel: task.channel,
    delivery_state: task.channel === 'manual' ? 'manual_action_required' : 'ready_for_channel_integration',
  }
}

async function processCareLinkRevoked(supabase: ReturnType<typeof getSupabaseAdmin>, event: any) {
  if (!event.care_link_id) throw new Error('care_link_id ausente no evento')

  const { data: pendingTasks } = await supabase
    .from('professional_crm_tasks')
    .select('id, metadata')
    .contains('metadata', { care_link_id: event.care_link_id })
    .eq('status', 'pending')

  const taskIds = (pendingTasks || []).map((task: any) => task.id)

  if (taskIds.length > 0) {
    await supabase
      .from('professional_crm_tasks')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
        metadata: {
          source: 'mydatamed-autopilot',
          cancelled_reason: 'care_link_revoked',
          care_link_id: event.care_link_id,
        },
      })
      .in('id', taskIds)
  }

  await logCareLinkEvent(
    supabase,
    event.care_link_id,
    'autopilot_care_link_revoked_processed',
    'Autopilot processou revogação do vínculo e interrompeu tarefas pendentes relacionadas.',
    { cancelled_task_ids: taskIds }
  )

  return {
    care_link_id: event.care_link_id,
    cancelled_task_count: taskIds.length,
    cancelled_task_ids: taskIds,
  }
}

async function findAppointmentByBooking(supabase: ReturnType<typeof getSupabaseAdmin>, bookingId: string) {
  if (!bookingId) return null
  const { data, error } = await supabase
    .from('telemedicine_appointments')
    .select('*')
    .eq('calcom_booking_id', bookingId)
    .maybeSingle()

  if (error) throw error
  return data
}

function buildAppointmentPayload(booking: any, professional: any) {
  if (!booking.external_booking_id) throw new Error('external_booking_id ausente no booking')
  if (!booking.preferred_date || !booking.preferred_time) throw new Error('Data ou horário ausente no booking Cal.com')

  const scheduledAt = booking.start_time || `${booking.preferred_date}T${booking.preferred_time}:00`
  const location = typeof booking.location === 'string' ? booking.location : ''
  const videoUrl = location.startsWith('http') ? location : null

  return {
    user_id: booking.patient_id || null,
    patient_id: booking.patient_id || null,
    patient_name: booking.patient_name || null,
    patient_email: booking.patient_email || null,
    professional_id: professional.id,
    professional_name: professional.full_name || professional.name || 'Profissional MyDataMed',
    professional_email: booking.professional_email || null,
    specialty: booking.specialty || professional.specialty || booking.title || 'Consulta',
    reason: booking.reason || booking.title || 'Agendamento via Cal.com',
    preferred_date: booking.preferred_date,
    preferred_time: booking.preferred_time,
    scheduled_at: scheduledAt,
    duration_minutes: Number(booking.duration_minutes || 30),
    status: 'scheduled',
    provider: 'calcom',
    room_url: videoUrl,
    meet_url: videoUrl,
    professional_confirmed: true,
    professional_confirmed_at: new Date().toISOString(),
    shared_data_permissions: {
      summary: true,
      exams: true,
      medications: true,
      timeline: true,
      passport: true,
      medscore: true,
    },
    payment_status: 'not_required',
    payment_required: false,
    billing_metadata: {
      source: 'calcom',
      nextgen_ready: true,
      charge_policy: 'manual_or_plan',
    },
    calendar_provider: booking.provider || 'calcom',
    calcom_booking_id: booking.external_booking_id,
    external_booking_url: booking.booking_url || null,
    external_reschedule_url: booking.reschedule_url || null,
    external_cancel_url: booking.cancel_url || null,
    calendar_metadata: {
      source: 'calcom-webhook',
      provider: booking.provider || 'calcom',
      raw_start_time: booking.start_time || null,
      raw_end_time: booking.end_time || null,
      timezone: booking.timezone || null,
      metadata: booking.metadata || {},
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

async function processCalendarBookingCreated(supabase: ReturnType<typeof getSupabaseAdmin>, event: any) {
  const booking = bookingFromEvent(event)
  const existing = await findAppointmentByBooking(supabase, booking.external_booking_id)
  if (existing?.id) {
    return { skipped: true, reason: 'Teleconsulta já existe para esse booking.', appointment_id: existing.id, calcom_booking_id: booking.external_booking_id }
  }

  const professional = await loadProfessionalForBooking(supabase, event, booking)
  if (!professional?.id) {
    return {
      skipped: true,
      reason: 'Profissional não encontrado. Envie professional_id no metadata do Cal.com ou cadastre professional_calendar_integrations.',
      professional_email: booking.professional_email || null,
      professional_username: booking.professional_username || null,
    }
  }

  const appointmentPayload = buildAppointmentPayload(booking, professional)
  const { data: appointment, error } = await supabase
    .from('telemedicine_appointments')
    .insert(appointmentPayload)
    .select('*')
    .single()

  if (error) throw new Error(`${error.message}. Rode SQL_CALCOM_AGENDA_V1.sql e os SQLs de teleconsulta.`)

  await logTelemedicineEvent(supabase, appointment, professional, 'calendar_booking_created', 'Cal.com criou agendamento e Autopilot gerou teleconsulta MyDataMed.', { booking })
  await upsertCrmContact(supabase, professional, appointment)

  const tasks = [
    {
      autopilot_type: 'calendar_pre_consultation',
      task_type: 'pre_consultation',
      title: 'Preparar consulta agendada via Cal.com',
      description: 'Revisar paciente, dados autorizados, motivo da consulta e pendências antes da teleconsulta.',
      due_at: booking.start_time || `${booking.preferred_date}T${booking.preferred_time}:00`,
    },
    {
      autopilot_type: 'calendar_reminder',
      task_type: 'reminder',
      title: 'Enviar lembrete da consulta agendada',
      description: `Lembrar ${appointment.patient_name || 'paciente'} sobre a consulta ${appointment.specialty || ''} em ${appointment.preferred_date} às ${String(appointment.preferred_time).slice(0, 5)}.`,
      due_at: booking.start_time ? new Date(new Date(booking.start_time).getTime() - 24 * 60 * 60 * 1000).toISOString() : addDays(0),
    },
  ]

  const createdTasks = []
  for (const task of tasks) createdTasks.push(await createAppointmentTaskOnce(supabase, professional, appointment, task))

  return {
    appointment_id: appointment.id,
    calcom_booking_id: booking.external_booking_id,
    professional_id: professional.id,
    patient_id: appointment.patient_id || null,
    created_or_existing_tasks: createdTasks.map((task: any) => ({ id: task.id, skipped: Boolean(task.skipped) })),
  }
}

async function processCalendarBookingRescheduled(supabase: ReturnType<typeof getSupabaseAdmin>, event: any) {
  const booking = bookingFromEvent(event)
  const appointment = await findAppointmentByBooking(supabase, booking.external_booking_id)
  if (!appointment?.id) return { skipped: true, reason: 'Teleconsulta não encontrada para reagendamento.', calcom_booking_id: booking.external_booking_id }

  const professional = await loadProfessionalForBooking(supabase, event, booking)
  const updates: any = {
    preferred_date: booking.preferred_date || appointment.preferred_date,
    preferred_time: booking.preferred_time || appointment.preferred_time,
    scheduled_at: booking.start_time || appointment.scheduled_at,
    duration_minutes: Number(booking.duration_minutes || appointment.duration_minutes || 30),
    status: 'scheduled',
    external_booking_url: booking.booking_url || appointment.external_booking_url || null,
    external_reschedule_url: booking.reschedule_url || appointment.external_reschedule_url || null,
    external_cancel_url: booking.cancel_url || appointment.external_cancel_url || null,
    calendar_metadata: {
      ...(appointment.calendar_metadata || {}),
      rescheduled_at: new Date().toISOString(),
      raw_start_time: booking.start_time || null,
      raw_end_time: booking.end_time || null,
      metadata: booking.metadata || {},
    },
    updated_at: new Date().toISOString(),
  }

  const { data: updated, error } = await supabase
    .from('telemedicine_appointments')
    .update(updates)
    .eq('id', appointment.id)
    .select('*')
    .single()

  if (error) throw error

  await logTelemedicineEvent(supabase, updated, professional, 'calendar_booking_rescheduled', 'Cal.com reagendou teleconsulta.', { booking })

  return { appointment_id: updated.id, calcom_booking_id: booking.external_booking_id, status: updated.status, preferred_date: updated.preferred_date, preferred_time: updated.preferred_time }
}

async function processCalendarBookingCancelled(supabase: ReturnType<typeof getSupabaseAdmin>, event: any) {
  const booking = bookingFromEvent(event)
  const appointment = await findAppointmentByBooking(supabase, booking.external_booking_id)
  if (!appointment?.id) return { skipped: true, reason: 'Teleconsulta não encontrada para cancelamento.', calcom_booking_id: booking.external_booking_id }

  const { data: updated, error } = await supabase
    .from('telemedicine_appointments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      calendar_metadata: {
        ...(appointment.calendar_metadata || {}),
        cancelled_by_calendar: true,
        cancelled_at: new Date().toISOString(),
        cancel_reason: booking.reason || null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointment.id)
    .select('*')
    .single()

  if (error) throw error

  const { data: pendingTasks } = await supabase
    .from('professional_crm_tasks')
    .select('id')
    .eq('appointment_id', appointment.id)
    .eq('status', 'pending')

  const taskIds = (pendingTasks || []).map((task: any) => task.id)
  if (taskIds.length > 0) {
    await supabase
      .from('professional_crm_tasks')
      .update({ status: 'cancelled', updated_at: new Date().toISOString(), metadata: { source: 'calendar_cancelled', appointment_id: appointment.id } })
      .in('id', taskIds)
  }

  await logTelemedicineEvent(supabase, updated, null, 'calendar_booking_cancelled', 'Cal.com cancelou teleconsulta e Autopilot interrompeu tarefas pendentes.', { booking, cancelled_task_ids: taskIds })

  return { appointment_id: updated.id, calcom_booking_id: booking.external_booking_id, cancelled_task_count: taskIds.length }
}

async function processEvent(supabase: ReturnType<typeof getSupabaseAdmin>, event: any) {
  switch (event.event_type) {
    case 'care_link_approved':
      return processCareLinkApproved(supabase, event)
    case 'smartbots_task_created':
      return processSmartBotsTaskCreated(supabase, event)
    case 'care_link_revoked':
      return processCareLinkRevoked(supabase, event)
    case 'calendar_booking_created':
      return processCalendarBookingCreated(supabase, event)
    case 'calendar_booking_rescheduled':
      return processCalendarBookingRescheduled(supabase, event)
    case 'calendar_booking_cancelled':
    case 'calendar_booking_canceled':
      return processCalendarBookingCancelled(supabase, event)
    default:
      return { skipped: true, reason: `Evento ${event.event_type} ainda não possui processador Autopilot.` }
  }
}

export async function POST(req: NextRequest) {
  let event: any = null

  try {
    if (!hasAutomationSecret(req)) return NextResponse.json({ error: 'Segredo inválido' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const body = await req.json().catch(() => ({}))
    event = await loadEvent(supabase, body)

    await markEvent(supabase, event, 'processing', { workflow: 'mydatamed_autopilot_processor_v1' })

    const result = await processEvent(supabase, event)
    const finalStatus = result?.skipped ? 'skipped' : 'processed'

    const updated = await markEvent(supabase, event, finalStatus, {
      workflow: 'mydatamed_autopilot_processor_v1',
      result,
    })

    return NextResponse.json({ ok: true, status: finalStatus, result, event: updated })
  } catch (error: any) {
    try {
      const supabase = getSupabaseAdmin()
      if (event?.id) {
        await markEvent(supabase, event, 'failed', { workflow: 'mydatamed_autopilot_processor_v1' }, error?.message)
      }
    } catch {}

    return NextResponse.json({ error: error?.message || 'Erro inesperado no Autopilot' }, { status: 500 })
  }
}
