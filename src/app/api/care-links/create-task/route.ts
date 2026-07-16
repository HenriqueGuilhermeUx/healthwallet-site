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

function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(9, 0, 0, 0)
  return date.toISOString()
}

const templates: Record<string, any> = {
  follow_up_7d: {
    task_type: 'follow_up',
    title: 'Follow-up em 7 dias',
    description: 'Entrar em contato com o paciente para avaliar evolução, adesão às orientações e necessidade de retorno.',
    due_days: 7,
  },
  follow_up_30d: {
    task_type: 'follow_up',
    title: 'Retorno em 30 dias',
    description: 'Agendar ou confirmar retorno para revisar evolução, exames e plano de cuidado.',
    due_days: 30,
  },
  request_exams: {
    task_type: 'document',
    title: 'Solicitar exames/documentos pendentes',
    description: 'Pedir ao paciente que atualize exames, laudos, medicamentos, alergias ou documentos importantes no HealthWallet.',
    due_days: 1,
  },
  update_profile: {
    task_type: 'manual',
    title: 'Atualizar dados clínicos do paciente',
    description: 'Solicitar atualização de Passport, CNS/UBS, alergias, medicamentos, contatos de emergência e histórico recente.',
    due_days: 3,
  },
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req)
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData.user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const user = authData.user
    const body = await req.json().catch(() => ({}))
    const careLinkId = body.care_link_id
    const action = body.action || 'follow_up_7d'
    if (!careLinkId) return NextResponse.json({ error: 'care_link_id obrigatório' }, { status: 400 })

    const template = templates[action] || templates.follow_up_7d

    const { data: professional } = await supabase
      .from('professionals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!professional) return NextResponse.json({ error: 'Cadastro profissional não encontrado' }, { status: 404 })

    const { data: careLink, error: linkError } = await supabase
      .from('professional_care_links')
      .select('*')
      .eq('id', careLinkId)
      .eq('professional_id', professional.id)
      .maybeSingle()

    if (linkError || !careLink) return NextResponse.json({ error: 'Vínculo assistencial não encontrado' }, { status: 404 })
    const expired = careLink.expires_at && new Date(careLink.expires_at).getTime() < Date.now()
    if (careLink.status !== 'active' || expired || !careLink.patient_id) {
      return NextResponse.json({ error: 'Vínculo não está ativo' }, { status: 403 })
    }

    const messageTemplate = body.message_template || template.description
    const dueAt = body.due_at || addDays(Number(template.due_days || 7))

    const { data: task, error: taskError } = await supabase
      .from('professional_crm_tasks')
      .insert({
        professional_user_id: user.id,
        patient_id: careLink.patient_id,
        task_type: template.task_type,
        title: body.title || template.title,
        description: messageTemplate,
        channel: body.channel || 'manual',
        message_template: messageTemplate,
        status: 'pending',
        due_at: dueAt,
        metadata: {
          source: 'care-link-panel',
          powered_by: 'SmartBots',
          care_link_id: careLink.id,
          professional_id: professional.id,
          patient_name: careLink.patient_name || null,
          action,
        },
      })
      .select('*')
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: `${taskError?.message || 'Erro ao criar tarefa'}. Rode os SQLs de CRM/SmartBots.` }, { status: 500 })
    }

    await supabase.from('professional_care_link_events').insert({
      care_link_id: careLink.id,
      actor_user_id: user.id,
      actor_role: 'professional',
      event_type: 'smartbots_task_created',
      description: `Tarefa criada pelo painel do vínculo: ${template.title}.`,
      metadata: { task_id: task.id, action, due_at: dueAt },
    })

    return NextResponse.json({ ok: true, task })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
