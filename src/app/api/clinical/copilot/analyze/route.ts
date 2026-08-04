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

function containsAny(text: string, words: string[]) {
  const normalized = text.toLowerCase()
  return words.some((word) => normalized.includes(word.toLowerCase()))
}

function firstSentence(text: string, max = 240) {
  const cleaned = normalizeText(text)
  if (!cleaned) return ''
  const sentence = cleaned.split(/[.!?]\s/)[0] || cleaned
  return sentence.length > max ? `${sentence.slice(0, max).trim()}...` : sentence
}

function compactSummary(text: string) {
  const cleaned = normalizeText(text)
  if (!cleaned) return 'Sem transcrição suficiente para resumo.'
  const chunks = cleaned.split(/[.!?]\s/).filter(Boolean).slice(-4)
  const summary = chunks.join('. ')
  return summary.length > 700 ? `${summary.slice(0, 700).trim()}...` : summary
}

function buildSoap(transcript: string, patientName?: string, reason?: string) {
  const cleaned = normalizeText(transcript)
  const first = firstSentence(cleaned, 360)

  return {
    soap_subjective: [
      reason ? `Motivo informado: ${reason}.` : '',
      first ? `Relato principal registrado: ${first}` : 'Relato subjetivo ainda insuficiente. Completar queixa principal, início, duração, intensidade, fatores de melhora/piora e sintomas associados.',
    ].filter(Boolean).join('\n'),
    soap_objective: containsAny(cleaned, ['pressão', 'pa ', 'temperatura', 'febre medida', 'saturação', 'peso', 'exame físico'])
      ? 'Dados objetivos mencionados na conversa. Revisar sinais vitais, exame físico, resultados de exames e achados mensuráveis antes de salvar.'
      : 'Dados objetivos não estruturados na transcrição. Registrar sinais vitais, exame físico e exames disponíveis, se aplicável.',
    soap_assessment: 'Campo de avaliação clínica para preenchimento/revisão pelo médico. A IA não estabelece diagnóstico; organize aqui hipóteses, impressão clínica e raciocínio após revisão profissional.',
    soap_plan: 'Campo de plano para revisão do médico: orientações, exames solicitados, prescrição, sinais de alarme, retorno e acompanhamento. Não alterar conduta apenas com base na IA.',
    summary_text: `${patientName ? `Paciente: ${patientName}. ` : ''}${compactSummary(cleaned)}`,
  }
}

function buildCards(transcript: string, dataScope: string) {
  const text = normalizeText(transcript)
  const cards: Array<{ type: string; title: string; content: string; severity: string; metadata?: any }> = []

  if (!text || text.length < 60) {
    cards.push({
      type: 'missing_data',
      title: 'Transcrição insuficiente',
      content: 'Ainda há pouco conteúdo para análise. Continue a consulta ou registre manualmente queixa principal, alergias e medicamentos em uso.',
      severity: 'info',
    })
    return cards
  }

  if (dataScope === 'visit_only') {
    cards.push({
      type: 'attention_point',
      title: 'Histórico completo não disponível',
      content: 'Análise baseada apenas nas informações deste atendimento. Confirmar alergias, medicamentos em uso, antecedentes e exames prévios antes de concluir.',
      severity: 'warning',
      metadata: { safety_scope: 'guest_or_unshared_patient' },
    })
  }

  if (!containsAny(text, ['alerg', 'reação', 'anafil', 'intolerância'])) {
    cards.push({
      type: 'missing_data',
      title: 'Alergias ainda não registradas',
      content: 'Pergunte e registre alergias medicamentosas, alimentares ou reações adversas relevantes antes de prescrever.',
      severity: 'warning',
    })
  }

  if (!containsAny(text, ['medicamento', 'remédio', 'uso contínuo', 'toma ', 'uso de ', 'dose', 'posologia'])) {
    cards.push({
      type: 'suggested_question',
      title: 'Confirmar medicamentos em uso',
      content: 'Pergunta sugerida: “Quais medicamentos, suplementos ou fitoterápicos você usa diariamente ou usou recentemente?”',
      severity: 'info',
    })
  }

  if (!containsAny(text, ['antecedente', 'histórico', 'diabetes', 'hipertensão', 'cirurgia', 'internação', 'família'])) {
    cards.push({
      type: 'suggested_question',
      title: 'Histórico e antecedentes',
      content: 'Pergunta sugerida: confirmar antecedentes pessoais, familiares, cirurgias, internações e condições crônicas relevantes.',
      severity: 'info',
    })
  }

  if (containsAny(text, ['dor no peito', 'falta de ar', 'desmaio', 'confusão mental', 'fraqueza súbita', 'sangramento intenso', 'convulsão', 'pior dor', 'rigidez de nuca'])) {
    cards.push({
      type: 'attention_point',
      title: 'Possível sinal de alarme mencionado',
      content: 'A transcrição contém termo potencialmente relevante para gravidade. Avaliar contexto, sinais vitais, exame físico e necessidade de conduta urgente conforme julgamento médico.',
      severity: 'critical',
    })
  }

  if (containsAny(text, ['antibiótico', 'anticoagulante', 'insulina', 'lítio', 'varfarina', 'metotrexato', 'creatinina', 'rim', 'renal', 'hepático', 'fígado'])) {
    cards.push({
      type: 'medication_safety',
      title: 'Revisão de segurança medicamentosa',
      content: 'Foi mencionado medicamento/condição que pode exigir checagem de alergias, interações, função renal/hepática, dose e acompanhamento.',
      severity: 'warning',
    })
  }

  cards.push({
    type: 'summary',
    title: 'Resumo parcial',
    content: compactSummary(text),
    severity: 'info',
  })

  cards.push({
    type: 'next_action',
    title: 'Antes de finalizar',
    content: 'Revise SOAP, registre observações próprias, confirme orientações dadas ao paciente e salve apenas após validação médica.',
    severity: 'info',
  })

  return cards.slice(0, 8)
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
    const transcriptText = normalizeText(body.transcript_text || '')
    const mode = body.mode === 'final' ? 'final' : 'partial'

    if (!visitId) return NextResponse.json({ error: 'visit_id obrigatório' }, { status: 400 })

    const { data: professional } = await supabase
      .from('professionals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!professional) return NextResponse.json({ error: 'Cadastro profissional não encontrado' }, { status: 404 })

    const { data: visit, error: visitError } = await supabase
      .from('clinical_visits')
      .select('*')
      .eq('id', visitId)
      .eq('professional_user_id', user.id)
      .maybeSingle()

    if (visitError || !visit) return NextResponse.json({ error: 'Atendimento não encontrado' }, { status: 404 })

    const mergedTranscript = transcriptText || visit.transcript_text || ''
    const cards = buildCards(mergedTranscript, visit.data_scope || 'visit_only')
    const soap = buildSoap(mergedTranscript, visit.patient_name, visit.reason)

    await supabase
      .from('clinical_ai_cards')
      .delete()
      .eq('visit_id', visitId)
      .eq('professional_user_id', user.id)
      .in('status', ['pending'])

    const rows = cards.map((card) => ({
      visit_id: visitId,
      professional_user_id: user.id,
      type: card.type,
      title: card.title,
      content: card.content,
      severity: card.severity,
      metadata: {
        generated_by: 'mydatamed_copilot_mvp',
        mode,
        rule_based: true,
        ...(card.metadata || {}),
      },
    }))

    const { data: insertedCards } = rows.length
      ? await supabase.from('clinical_ai_cards').insert(rows).select('*')
      : { data: [] as any[] }

    const updatePayload: any = {
      transcript_text: mergedTranscript,
      summary_text: soap.summary_text,
      updated_at: new Date().toISOString(),
      metadata: {
        ...(visit.metadata || {}),
        ai_support_used: true,
        last_ai_analysis_at: new Date().toISOString(),
        ai_analysis_mode: mode,
      },
    }

    if (mode === 'final') {
      updatePayload.soap_subjective = soap.soap_subjective
      updatePayload.soap_objective = soap.soap_objective
      updatePayload.soap_assessment = soap.soap_assessment
      updatePayload.soap_plan = soap.soap_plan
    }

    await supabase.from('clinical_visits').update(updatePayload).eq('id', visitId)

    await supabase.from('clinical_ai_usage_logs').insert({
      visit_id: visitId,
      professional_user_id: user.id,
      tool_type: mode === 'final' ? 'soap_summary_generation' : 'live_consultation_cards',
      model_provider: 'mydatamed_copilot_mvp',
      input_scope: visit.data_scope === 'healthwallet_authorized' ? 'authorized_patient_data_and_visit_transcript' : 'visit_transcript_only',
      output_summary: `${cards.length} card(s) gerados; resumo SOAP ${mode === 'final' ? 'preparado' : 'parcial'}.`,
      reviewed_by_doctor: false,
      metadata: {
        professional_id: professional.id,
        mode,
        decision_owner: 'physician',
        ai_is_support_tool: true,
      },
    })

    return NextResponse.json({ ok: true, cards: insertedCards || [], soap, disclaimer: 'IA usada apenas como apoio. Médico deve revisar, validar e assinar.' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
