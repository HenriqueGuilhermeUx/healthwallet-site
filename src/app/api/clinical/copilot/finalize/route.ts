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

function normalizeText(value: any) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function getSectionLabels(professionalType?: string) {
  if (professionalType === 'nutricionista') return ['Relato/objetivo nutricional', 'Dados objetivos/rotina', 'Avaliação nutricional', 'Plano alimentar/orientações']
  if (professionalType === 'fisioterapeuta') return ['Relato funcional', 'Avaliação objetiva funcional', 'Evolução/avaliação fisioterapêutica', 'Plano de exercícios/orientações']
  if (['psicologo', 'terapeuta'].includes(professionalType || '')) return ['Relato da sessão', 'Observações/intervenções', 'Evolução terapêutica', 'Plano/próxima sessão']
  if (professionalType === 'enfermeiro') return ['Relato/queixa', 'Triagem/dados objetivos', 'Avaliação de enfermagem', 'Orientações/encaminhamento']
  return ['S - Subjetivo', 'O - Objetivo', 'A - Avaliação', 'P - Plano']
}

function buildFinalText(body: any, professionalType?: string) {
  const labels = getSectionLabels(professionalType)
  const parts = [
    [labels[0], body.soap_subjective],
    [labels[1], body.soap_objective],
    [labels[2], body.soap_assessment],
    [labels[3], body.soap_plan],
    ['Observações do profissional', body.doctor_observations],
  ]
  return parts
    .map(([title, value]) => `${title}\n${normalizeText(value) || 'Não informado.'}`)
    .join('\n\n')
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
    const visitId = body.visit_id

    if (!visitId) return NextResponse.json({ error: 'visit_id obrigatório' }, { status: 400 })

    const { data: professional } = await supabase
      .from('professionals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!professional) return NextResponse.json({ error: 'Cadastro profissional não encontrado' }, { status: 404 })

    const professionalType = professional.professional_type || 'outro'

    const { data: visit, error: visitError } = await supabase
      .from('clinical_visits')
      .select('*')
      .eq('id', visitId)
      .eq('professional_user_id', user.id)
      .maybeSingle()

    if (visitError || !visit) return NextResponse.json({ error: 'Atendimento não encontrado' }, { status: 404 })

    const finalText = normalizeText(body.final_note) || buildFinalText(body, professionalType)
    const signed = Boolean(body.signed_by_doctor)
    const now = new Date().toISOString()

    const notePayload = {
      visit_id: visitId,
      professional_user_id: user.id,
      soap_subjective: normalizeText(body.soap_subjective) || null,
      soap_objective: normalizeText(body.soap_objective) || null,
      soap_assessment: normalizeText(body.soap_assessment) || null,
      soap_plan: normalizeText(body.soap_plan) || null,
      doctor_observations: normalizeText(body.doctor_observations) || null,
      final_text: finalText,
      reviewed_by_doctor: true,
      signed_by_doctor: signed,
      signed_at: signed ? now : null,
      metadata: {
        ai_used_as_support: true,
        professional_review_required: true,
        decision_owner: 'health_professional',
        professional_type: professionalType,
        note_template: professional.consultation_template || professional.practice_preferences?.note_template || null,
        scope_safe_wording: true,
      },
    }

    const { data: note, error: noteError } = await supabase
      .from('clinical_notes')
      .insert(notePayload)
      .select('*')
      .single()

    if (noteError) return NextResponse.json({ error: noteError.message }, { status: 500 })

    const visitUpdate = {
      status: signed ? 'signed' : 'completed',
      soap_subjective: notePayload.soap_subjective,
      soap_objective: notePayload.soap_objective,
      soap_assessment: notePayload.soap_assessment,
      soap_plan: notePayload.soap_plan,
      doctor_observations: notePayload.doctor_observations,
      final_note: finalText,
      signed_by_doctor: signed,
      signed_at: signed ? now : null,
      ended_at: visit.ended_at || now,
      updated_at: now,
      metadata: {
        ...(visit.metadata || {}),
        ai_used_as_support: true,
        professional_reviewed: true,
        last_clinical_note_id: note.id,
        professional_context: {
          professional_type: professionalType,
          specialty: professional.specialty || null,
          verification_status: professional.verification_status || 'self_declared',
          decision_owner: 'health_professional',
        },
      },
    }

    await supabase.from('clinical_visits').update(visitUpdate).eq('id', visitId)

    if (visit.appointment_id) {
      try {
        await supabase
          .from('telemedicine_appointments')
          .update({
            professional_notes: finalText,
            clinical_summary: finalText,
            updated_at: now,
          })
          .eq('id', visit.appointment_id)
      } catch {
        // Campos podem não existir em instalações antigas; não trava a conclusão.
      }
    }

    await supabase.from('clinical_ai_usage_logs').insert({
      visit_id: visitId,
      professional_user_id: user.id,
      tool_type: 'final_note_review_and_signature',
      model_provider: 'mydatamed_copilot_mvp',
      input_scope: visit.data_scope === 'healthwallet_authorized' ? 'authorized_patient_data_and_visit_transcript' : 'visit_transcript_only',
      output_summary: signed ? 'Nota revisada e assinada pelo profissional.' : 'Nota revisada e salva pelo profissional.',
      reviewed_by_doctor: true,
      metadata: {
        professional_id: professional.id,
        professional_type: professionalType,
        note_id: note.id,
        signed_by_doctor: signed,
        ai_is_support_tool: true,
        decision_owner: 'health_professional',
      },
    })

    try {
      await supabase.from('telemedicine_events').insert({
        appointment_id: visit.appointment_id || null,
        actor_user_id: user.id,
        professional_id: professional.id,
        patient_id: visit.patient_user_id || null,
        type: 'clinical_copilot_finalized',
        description: signed ? 'Profissional revisou e assinou nota gerada com apoio de IA.' : 'Profissional revisou e salvou nota gerada com apoio de IA.',
        metadata: {
          visit_id: visitId,
          note_id: note.id,
          ai_support_used: true,
          reviewed_by_professional: true,
          professional_type: professionalType,
        },
      })
    } catch {}

    return NextResponse.json({ ok: true, note, visit: { ...visit, ...visitUpdate } })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
