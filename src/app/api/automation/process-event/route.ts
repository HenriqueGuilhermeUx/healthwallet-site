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

async function processEvent(supabase: ReturnType<typeof getSupabaseAdmin>, event: any) {
  switch (event.event_type) {
    case 'care_link_approved':
      return processCareLinkApproved(supabase, event)
    case 'smartbots_task_created':
      return processSmartBotsTaskCreated(supabase, event)
    case 'care_link_revoked':
      return processCareLinkRevoked(supabase, event)
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
