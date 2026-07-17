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

function hasAutomationSecret(req: NextRequest) {
  const expected = process.env.AUTOMATION_API_SECRET || process.env.N8N_AUTOPILOT_SECRET
  if (!expected) return false
  return req.headers.get('x-automation-secret') === expected || req.nextUrl.searchParams.get('secret') === expected
}

async function authenticate(req: NextRequest, supabase: ReturnType<typeof getSupabaseAdmin>) {
  if (hasAutomationSecret(req)) return { mode: 'secret', user: null as any }

  const token = getBearerToken(req)
  if (!token) return { mode: 'none', user: null as any }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return { mode: 'none', user: null as any }
  return { mode: 'user', user: data.user }
}

async function maybeDispatchToN8n(event: any) {
  const webhookUrl = process.env.N8N_AUTOPILOT_WEBHOOK_URL
  if (!webhookUrl) return { dispatched: false }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_AUTOPILOT_SECRET ? { 'x-automation-secret': process.env.N8N_AUTOPILOT_SECRET } : {}),
      },
      body: JSON.stringify({ event }),
    })

    return {
      dispatched: response.ok,
      status: response.status,
    }
  } catch (error: any) {
    return { dispatched: false, error: error?.message || 'dispatch_failed' }
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const auth = await authenticate(req, supabase)
    if (auth.mode === 'none') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    if (!body.event_type) return NextResponse.json({ error: 'event_type obrigatório' }, { status: 400 })

    const eventPayload = {
      event_type: body.event_type,
      source_app: body.source_app || 'mydatamed',
      source_table: body.source_table || null,
      source_id: body.source_id || null,
      actor_user_id: body.actor_user_id || auth.user?.id || null,
      actor_role: body.actor_role || (auth.user ? 'user' : 'system'),
      patient_id: body.patient_id || null,
      professional_id: body.professional_id || null,
      care_link_id: body.care_link_id || null,
      task_id: body.task_id || null,
      appointment_id: body.appointment_id || null,
      charge_id: body.charge_id || null,
      payload: body.payload || {},
      metadata: {
        ...(body.metadata || {}),
        created_by_api: true,
        auth_mode: auth.mode,
      },
      status: body.status || 'pending',
      priority: Number(body.priority || 5),
      scheduled_for: body.scheduled_for || new Date().toISOString(),
    }

    const { data: event, error } = await supabase
      .from('automation_events')
      .insert(eventPayload)
      .select('*')
      .single()

    if (error || !event) {
      return NextResponse.json({ error: `${error?.message || 'Erro ao criar evento'}. Rode SQL_AUTOMATION_EVENTS_V1.sql.` }, { status: 500 })
    }

    const dispatch = await maybeDispatchToN8n(event)
    if (dispatch.dispatched || dispatch.error) {
      await supabase
        .from('automation_events')
        .update({
          metadata: {
            ...(event.metadata || {}),
            n8n_dispatch: dispatch,
            n8n_dispatched_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id)
    }

    return NextResponse.json({ ok: true, event, dispatch })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    if (!hasAutomationSecret(req)) return NextResponse.json({ error: 'Segredo inválido' }, { status: 401 })

    const status = req.nextUrl.searchParams.get('status') || 'pending'
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 20), 100)

    let query = supabase
      .from('automation_events')
      .select('*')
      .eq('status', status)
      .lte('scheduled_for', new Date().toISOString())
      .order('priority', { ascending: true })
      .order('scheduled_for', { ascending: true })
      .limit(limit)

    if (status === 'pending') query = query.lt('attempts', 3)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, events: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    if (!hasAutomationSecret(req)) return NextResponse.json({ error: 'Segredo inválido' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    if (!body.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    const nextStatus = body.status || 'processed'
    const updatePayload: any = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
      metadata: body.metadata || {},
    }

    if (nextStatus === 'processed') updatePayload.processed_at = new Date().toISOString()
    if (nextStatus === 'processing') {
      updatePayload.locked_at = new Date().toISOString()
      updatePayload.locked_by = body.locked_by || 'n8n'
    }
    if (nextStatus === 'failed') {
      updatePayload.last_error = body.last_error || 'Erro informado pelo n8n'
      updatePayload.attempts = Number(body.attempts || 1)
    }

    const { data, error } = await supabase
      .from('automation_events')
      .update(updatePayload)
      .eq('id', body.id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, event: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
