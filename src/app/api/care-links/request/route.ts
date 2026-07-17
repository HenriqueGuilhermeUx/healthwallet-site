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

const DEFAULT_SCOPE = {
  summary: true,
  exams: true,
  medications: true,
  timeline: true,
  passport: true,
  medscore: true,
  documents: true,
  family: false,
}

function normalizeScope(input: any) {
  return { ...DEFAULT_SCOPE, ...(input || {}) }
}

function expiresAt(durationDays: number, continuous: boolean) {
  if (continuous) return null
  const days = Number(durationDays || 365)
  return new Date(Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString()
}

async function emitAutomationEvent(supabase: ReturnType<typeof getSupabaseAdmin>, payload: any) {
  try {
    await supabase.from('automation_events').insert({
      event_type: payload.event_type,
      source_app: 'mydatamed',
      source_table: 'professional_care_links',
      source_id: payload.care_link_id || null,
      actor_user_id: payload.actor_user_id || null,
      actor_role: 'professional',
      patient_id: payload.patient_id || null,
      professional_id: payload.professional_id || null,
      care_link_id: payload.care_link_id || null,
      payload: payload.payload || {},
      metadata: {
        powered_by: 'MyDataMed Autopilot',
        n8n_ready: true,
        ...(payload.metadata || {}),
      },
      priority: payload.priority || 4,
      status: 'pending',
    })
  } catch {
    // Não trava solicitação se a fila Autopilot ainda não estiver no banco.
  }
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

    const patientId = body.patient_id || null
    const patientEmail = body.patient_email || null
    const patientName = body.patient_name || null
    if (!patientId && !patientEmail) {
      return NextResponse.json({ error: 'Informe Patient ID ou e-mail do paciente' }, { status: 400 })
    }

    const { data: professional } = await supabase
      .from('professionals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!professional) return NextResponse.json({ error: 'Cadastro profissional não encontrado' }, { status: 404 })

    const durationDays = Number(body.duration_days || 365)
    const continuous = Boolean(body.continuous)
    const scope = normalizeScope(body.scope)

    const { data: existing } = await supabase
      .from('professional_care_links')
      .select('*')
      .eq('professional_user_id', user.id)
      .or(patientId ? `patient_id.eq.${patientId}` : `patient_email.eq.${patientEmail}`)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      const { data: updated, error: updateError } = await supabase
        .from('professional_care_links')
        .update({
          patient_name: patientName || existing.patient_name,
          patient_email: patientEmail || existing.patient_email,
          patient_id: patientId || existing.patient_id,
          requested_scope: scope,
          scope,
          duration_days: durationDays,
          continuous,
          request_note: body.request_note || existing.request_note,
          expires_at: existing.status === 'active' ? expiresAt(durationDays, continuous) : existing.expires_at,
          updated_at: new Date().toISOString(),
          metadata: { ...(existing.metadata || {}), renewed_request: true, powered_by: 'MyDataMed' },
        })
        .eq('id', existing.id)
        .select('*')
        .single()

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

      await supabase.from('professional_care_link_events').insert({
        care_link_id: existing.id,
        actor_user_id: user.id,
        actor_role: 'professional',
        event_type: 'request_updated',
        description: 'Profissional atualizou solicitação de vínculo assistencial.',
        metadata: { scope, duration_days: durationDays, continuous },
      })

      await emitAutomationEvent(supabase, {
        event_type: 'care_link_request_updated',
        actor_user_id: user.id,
        professional_id: professional.id,
        patient_id: patientId || existing.patient_id,
        care_link_id: existing.id,
        payload: { scope, duration_days: durationDays, continuous, patient_email: patientEmail || existing.patient_email, patient_name: patientName || existing.patient_name },
      })

      return NextResponse.json({ ok: true, care_link: updated, mode: 'updated' })
    }

    const { data: careLink, error } = await supabase
      .from('professional_care_links')
      .insert({
        professional_user_id: user.id,
        professional_id: professional.id,
        professional_name: professional.full_name,
        professional_email: user.email,
        patient_id: patientId,
        patient_name: patientName,
        patient_email: patientEmail,
        status: 'pending',
        scope,
        requested_scope: scope,
        duration_days: durationDays,
        continuous,
        request_note: body.request_note || null,
        expires_at: null,
        metadata: {
          source: 'mydatamed-care-link-request',
          powered_by: 'MyDataMed Intelligence',
          smartbots: 'follow-up e relacionamento',
          staff: 'agenda e apoio administrativo',
          docwallet: 'documentos e arquivos',
          nextgen: 'planos e cobranças quando aplicável',
        },
      })
      .select('*')
      .single()

    if (error || !careLink) {
      return NextResponse.json({ error: `${error?.message || 'Erro ao solicitar vínculo'}. Rode SQL_VINCULO_ASSISTENCIAL_V1.sql.` }, { status: 500 })
    }

    await supabase.from('professional_care_link_events').insert({
      care_link_id: careLink.id,
      actor_user_id: user.id,
      actor_role: 'professional',
      event_type: 'requested',
      description: 'Profissional solicitou vínculo assistencial contínuo.',
      metadata: { scope, duration_days: durationDays, continuous },
    })

    await emitAutomationEvent(supabase, {
      event_type: 'care_link_requested',
      actor_user_id: user.id,
      professional_id: professional.id,
      patient_id: patientId,
      care_link_id: careLink.id,
      payload: { scope, duration_days: durationDays, continuous, patient_email: patientEmail, patient_name: patientName, professional_name: professional.full_name },
    })

    return NextResponse.json({ ok: true, care_link: careLink })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
