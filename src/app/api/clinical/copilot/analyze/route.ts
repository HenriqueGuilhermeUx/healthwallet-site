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

type ProfessionalContext = {
  professionalType: string
  specialty?: string | null
  noteTemplate: string
  preferredTone: string
  patientAudience?: string | null
  serviceStyle?: string | null
  requiredQuestions: string[]
  customInstructions?: string | null
  verificationStatus: string
  allowedCapabilities: any
  blockedCapabilities: any
}

function defaultQuestionsFor(professionalType: string) {
  const map: Record<string, string[]> = {
    medico: ['Queixa principal', 'Alergias', 'Medicamentos em uso', 'Antecedentes', 'Sinais de alarme'],
    nutricionista: ['Recordatório alimentar', 'Hidratação', 'Sono', 'Treino/atividade', 'Restrições e preferências', 'Objetivo nutricional'],
    fisioterapeuta: ['Local da dor', 'Escala de dor', 'Movimento que piora', 'Movimento que melhora', 'Limitação funcional', 'Exercícios orientados'],
    psicologo: ['Queixa principal', 'Contexto emocional', 'Sono', 'Rede de apoio', 'Objetivos terapêuticos', 'Pontos para próxima sessão'],
    terapeuta: ['Queixa principal', 'Contexto emocional', 'Sono', 'Rede de apoio', 'Objetivos terapêuticos', 'Pontos para próxima sessão'],
    enfermeiro: ['Sinais vitais', 'Queixa atual', 'Procedimentos realizados', 'Orientações dadas', 'Encaminhamentos'],
    fonoaudiologo: ['Queixa principal', 'Função afetada', 'Exercícios orientados', 'Evolução', 'Tarefas para casa'],
    odonto: ['Queixa principal', 'Dor', 'Procedimento realizado', 'Orientações', 'Retorno'],
    farmaceutico: ['Medicamentos em uso', 'Adesão', 'Interações possíveis', 'Orientações', 'Acompanhamento'],
    educador_fisico: ['Objetivo', 'Rotina de treino', 'Limitações', 'Dor/desconforto', 'Plano de evolução'],
  }
  return map[professionalType] || ['Queixa/objetivo principal', 'Histórico relevante', 'Orientações dadas', 'Plano de acompanhamento']
}

function normalizeContext(professional: any, preference: any): ProfessionalContext {
  const professionalType = professional?.professional_type || preference?.professional_type || 'outro'
  const practice = professional?.practice_preferences || {}
  const context = professional?.professional_context || {}
  const requiredQuestions = preference?.required_questions || practice?.required_questions || defaultQuestionsFor(professionalType)

  return {
    professionalType,
    specialty: preference?.specialty || professional?.specialty || null,
    noteTemplate: preference?.note_template || professional?.consultation_template || practice?.note_template || context?.note_template || 'general_health_visit',
    preferredTone: preference?.preferred_tone || practice?.preferred_tone || context?.preferred_tone || 'professional_clear',
    patientAudience: preference?.patient_audience || context?.patient_audience || null,
    serviceStyle: preference?.service_style || context?.service_style || null,
    requiredQuestions: Array.isArray(requiredQuestions) ? requiredQuestions : defaultQuestionsFor(professionalType),
    customInstructions: preference?.custom_instructions || practice?.custom_instructions || null,
    verificationStatus: professional?.verification_status || 'self_declared',
    allowedCapabilities: professional?.allowed_capabilities || [],
    blockedCapabilities: professional?.blocked_capabilities || [],
  }
}

function buildSoap(transcript: string, patientName?: string, reason?: string, context?: ProfessionalContext) {
  const cleaned = normalizeText(transcript)
  const first = firstSentence(cleaned, 360)
  const type = context?.professionalType || 'outro'
  const template = context?.noteTemplate || 'general_health_visit'
  const professionalLabel = type === 'medico' ? 'médico' : 'profissional'

  if (type === 'nutricionista' || template === 'nutritional_evolution') {
    return {
      soap_subjective: [reason ? `Motivo/objetivo informado: ${reason}.` : '', first ? `Relato alimentar e objetivo principal: ${first}` : 'Completar objetivo nutricional, rotina, preferências, restrições e dificuldades de adesão.'].filter(Boolean).join('\n'),
      soap_objective: containsAny(cleaned, ['peso', 'altura', 'imc', 'circunferência', 'bioimpedância', 'glicemia', 'colesterol'])
        ? 'Dados objetivos/nutricionais mencionados. Revisar antropometria, exames, rotina alimentar, treino, sono e hidratação antes de salvar.'
        : 'Dados objetivos não estruturados. Registrar antropometria, exames disponíveis, rotina alimentar, sono, treino e hidratação, se aplicável.',
      soap_assessment: 'Avaliação nutricional para revisão do nutricionista: objetivo, barreiras, padrões alimentares, adesão, risco nutricional e pontos de acompanhamento dentro do escopo profissional.',
      soap_plan: 'Plano nutricional/orientações para revisão: metas, ajustes alimentares, hidratação, suplementação quando aplicável ao escopo, retorno e acompanhamento.',
      summary_text: `${patientName ? `Paciente: ${patientName}. ` : ''}${compactSummary(cleaned)}`,
    }
  }

  if (type === 'fisioterapeuta' || template === 'functional_rehab_evolution') {
    return {
      soap_subjective: [reason ? `Queixa/objetivo funcional: ${reason}.` : '', first ? `Relato funcional principal: ${first}` : 'Completar queixa funcional, dor, início, movimentos que pioram/melhoram e limitações.'].filter(Boolean).join('\n'),
      soap_objective: containsAny(cleaned, ['dor', 'eva', 'amplitude', 'força', 'mobilidade', 'marcha', 'teste funcional'])
        ? 'Dados funcionais mencionados. Revisar escala de dor, mobilidade, força, amplitude de movimento, testes e limitações antes de salvar.'
        : 'Dados objetivos funcionais não estruturados. Registrar escala de dor, mobilidade, força, amplitude, testes e função, se aplicável.',
      soap_assessment: 'Avaliação fisioterapêutica/funcional para revisão do profissional: limitações, evolução, resposta ao tratamento e objetivos terapêuticos.',
      soap_plan: 'Plano de cuidado para revisão: exercícios, orientações domiciliares, progressão, restrições, sinais de alerta e retorno.',
      summary_text: `${patientName ? `Paciente: ${patientName}. ` : ''}${compactSummary(cleaned)}`,
    }
  }

  if (['psicologo', 'terapeuta'].includes(type) || template === 'therapeutic_session_note') {
    return {
      soap_subjective: [reason ? `Tema/queixa da sessão: ${reason}.` : '', first ? `Relato principal da sessão: ${first}` : 'Completar queixa, contexto emocional, objetivos terapêuticos e eventos relevantes.'].filter(Boolean).join('\n'),
      soap_objective: 'Registro terapêutico objetivo para revisão: comportamento observado, temas trabalhados, intervenções realizadas, tarefas combinadas e pontos para acompanhamento.',
      soap_assessment: 'Evolução terapêutica para revisão do profissional: hipóteses de trabalho, padrões observados, adesão, riscos e objetivos da continuidade dentro do escopo profissional.',
      soap_plan: 'Plano da próxima sessão para revisão: intervenções, combinados, tarefas, rede de apoio e eventual encaminhamento quando necessário.',
      summary_text: `${patientName ? `Paciente: ${patientName}. ` : ''}${compactSummary(cleaned)}`,
    }
  }

  if (type === 'enfermeiro' || template === 'nursing_triage_followup') {
    return {
      soap_subjective: [reason ? `Queixa/necessidade informada: ${reason}.` : '', first ? `Relato principal: ${first}` : 'Completar queixa, sintomas, antecedentes e necessidade de acompanhamento.'].filter(Boolean).join('\n'),
      soap_objective: containsAny(cleaned, ['pressão', 'temperatura', 'saturação', 'frequência', 'glicemia', 'procedimento'])
        ? 'Dados de triagem/procedimento mencionados. Revisar sinais vitais, procedimento realizado, materiais, orientação e encaminhamento.'
        : 'Dados objetivos não estruturados. Registrar sinais vitais, triagem, procedimentos e encaminhamentos, se aplicável.',
      soap_assessment: 'Avaliação/triagem de enfermagem para revisão: necessidade identificada, riscos, acompanhamento e critérios de encaminhamento dentro do escopo.',
      soap_plan: 'Plano/orientações para revisão: cuidado, retorno, sinais de alerta, encaminhamento e acompanhamento.',
      summary_text: `${patientName ? `Paciente: ${patientName}. ` : ''}${compactSummary(cleaned)}`,
    }
  }

  return {
    soap_subjective: [reason ? `Motivo informado: ${reason}.` : '', first ? `Relato principal registrado: ${first}` : 'Relato ainda insuficiente. Completar queixa/objetivo, contexto, histórico relevante e informações essenciais.'].filter(Boolean).join('\n'),
    soap_objective: containsAny(cleaned, ['pressão', 'pa ', 'temperatura', 'febre medida', 'saturação', 'peso', 'exame físico'])
      ? 'Dados objetivos mencionados. Revisar sinais, achados, exames e dados mensuráveis antes de salvar.'
      : 'Dados objetivos não estruturados. Registrar achados, medidas, exames ou observações relevantes, se aplicável.',
    soap_assessment: `Campo de avaliação para preenchimento/revisão pelo ${professionalLabel}. A IA não estabelece diagnóstico nem conduta autônoma; organize aqui raciocínio, evolução e pontos de acompanhamento após revisão profissional.`,
    soap_plan: `Campo de plano para revisão do ${professionalLabel}: orientações, tarefas, retorno, encaminhamentos e acompanhamento dentro do escopo profissional.`,
    summary_text: `${patientName ? `Paciente: ${patientName}. ` : ''}${compactSummary(cleaned)}`,
  }
}

function addRequiredQuestionCards(cards: any[], text: string, context: ProfessionalContext) {
  for (const question of context.requiredQuestions || []) {
    const keyword = question.toLowerCase().split(/[\s/]+/)[0]
    if (keyword && !text.toLowerCase().includes(keyword)) {
      cards.push({
        type: 'missing_data',
        title: `Campo importante: ${question}`,
        content: `Pelo seu jeito de atender, vale confirmar e registrar: ${question}.`,
        severity: 'info',
        metadata: { from_professional_preferences: true },
      })
    }
    if (cards.length >= 4) break
  }
}

function buildProfessionalCards(transcript: string, dataScope: string, context: ProfessionalContext) {
  const text = normalizeText(transcript)
  const cards: Array<{ type: string; title: string; content: string; severity: string; metadata?: any }> = []
  const type = context.professionalType

  if (!text || text.length < 60) {
    cards.push({
      type: 'missing_data',
      title: 'Transcrição insuficiente',
      content: `Ainda há pouco conteúdo para análise. Continue o atendimento ou registre manualmente: ${context.requiredQuestions.slice(0, 4).join(', ')}.`,
      severity: 'info',
    })
    return cards
  }

  if (dataScope === 'visit_only') {
    cards.push({
      type: 'attention_point',
      title: 'Histórico completo não disponível',
      content: 'Análise baseada apenas nas informações deste atendimento. Confirmar dados essenciais antes de concluir.',
      severity: 'warning',
      metadata: { safety_scope: 'guest_or_unshared_patient' },
    })
  }

  if (type === 'nutricionista') {
    if (!containsAny(text, ['recordatório', 'café', 'almoço', 'jantar', 'lanche', 'come', 'aliment'])) cards.push({ type: 'suggested_question', title: 'Recordatório alimentar', content: 'Pergunta sugerida: “Como foi sua alimentação nas últimas 24 horas, incluindo horários, quantidades e lanches?”', severity: 'info' })
    if (!containsAny(text, ['água', 'hidrata', 'sono', 'treino', 'atividade'])) cards.push({ type: 'missing_data', title: 'Rotina além da dieta', content: 'Confirmar hidratação, sono, treino/atividade física e rotina de trabalho, pois impactam adesão e plano alimentar.', severity: 'info' })
    if (!containsAny(text, ['restrição', 'intoler', 'alerg', 'preferência', 'vegetariano'])) cards.push({ type: 'missing_data', title: 'Restrições e preferências', content: 'Registrar alergias/intolerâncias alimentares, preferências, aversões e restrições culturais/éticas.', severity: 'warning' })
  } else if (type === 'fisioterapeuta') {
    if (!containsAny(text, ['dor', 'eva', 'escala', 'intensidade'])) cards.push({ type: 'suggested_question', title: 'Escala de dor', content: 'Pergunta sugerida: “De 0 a 10, qual a intensidade da dor agora e nos piores momentos?”', severity: 'info' })
    if (!containsAny(text, ['movimento', 'piora', 'melhora', 'limita', 'mobilidade', 'amplitude'])) cards.push({ type: 'missing_data', title: 'Limitação funcional', content: 'Confirmar movimentos que pioram/melhoram, função limitada, amplitude, força e objetivos funcionais.', severity: 'info' })
    if (containsAny(text, ['perda de força', 'formigamento', 'dormência', 'queda', 'trauma', 'incontinência'])) cards.push({ type: 'attention_point', title: 'Possível alerta funcional/neurológico', content: 'Termo de possível gravidade foi mencionado. Avaliar contexto e necessidade de encaminhamento conforme escopo e julgamento profissional.', severity: 'critical' })
  } else if (['psicologo', 'terapeuta'].includes(type)) {
    if (!containsAny(text, ['sono', 'apetite', 'humor', 'ansiedade', 'estresse'])) cards.push({ type: 'suggested_question', title: 'Contexto emocional e rotina', content: 'Pergunta sugerida: confirmar sono, apetite, humor, ansiedade/estresse e funcionamento diário.', severity: 'info' })
    if (!containsAny(text, ['apoio', 'família', 'rede', 'trabalho', 'relacionamento'])) cards.push({ type: 'missing_data', title: 'Rede e contexto', content: 'Registrar rede de apoio, contexto familiar/social e eventos relevantes para continuidade terapêutica.', severity: 'info' })
    if (containsAny(text, ['me matar', 'suicídio', 'autoagressão', 'sem vontade de viver', 'me ferir'])) cards.push({ type: 'attention_point', title: 'Possível risco mencionado', content: 'A transcrição contém termo sensível de risco. Avaliar imediatamente conforme protocolo, escopo profissional e rede de apoio/encaminhamento.', severity: 'critical' })
  } else if (type === 'enfermeiro') {
    if (!containsAny(text, ['pressão', 'temperatura', 'saturação', 'glicemia', 'frequência'])) cards.push({ type: 'missing_data', title: 'Sinais vitais', content: 'Registrar sinais vitais e dados objetivos de triagem quando aplicável.', severity: 'info' })
    if (!containsAny(text, ['orientação', 'procedimento', 'curativo', 'medicação', 'encaminhamento'])) cards.push({ type: 'suggested_question', title: 'Procedimentos e orientações', content: 'Confirmar procedimento realizado, orientação fornecida, retorno e necessidade de encaminhamento.', severity: 'info' })
  } else {
    addRequiredQuestionCards(cards, text, context)
  }

  if (type === 'medico') {
    if (!containsAny(text, ['alerg', 'reação', 'anafil', 'intolerância'])) cards.push({ type: 'missing_data', title: 'Alergias ainda não registradas', content: 'Pergunte e registre alergias medicamentosas ou reações adversas relevantes antes de prescrever.', severity: 'warning' })
    if (!containsAny(text, ['medicamento', 'remédio', 'uso contínuo', 'toma ', 'dose', 'posologia'])) cards.push({ type: 'suggested_question', title: 'Confirmar medicamentos em uso', content: 'Pergunta sugerida: “Quais medicamentos, suplementos ou fitoterápicos você usa diariamente ou usou recentemente?”', severity: 'info' })
    if (containsAny(text, ['dor no peito', 'falta de ar', 'desmaio', 'confusão mental', 'fraqueza súbita', 'sangramento intenso', 'convulsão', 'pior dor', 'rigidez de nuca'])) cards.push({ type: 'attention_point', title: 'Possível sinal de alarme mencionado', content: 'A transcrição contém termo potencialmente relevante para gravidade. Avaliar contexto, sinais vitais, exame físico e necessidade de conduta urgente conforme julgamento médico.', severity: 'critical' })
  }

  if (containsAny(text, ['antibiótico', 'anticoagulante', 'insulina', 'lítio', 'varfarina', 'metotrexato', 'creatinina', 'rim', 'renal', 'hepático', 'fígado'])) {
    cards.push({
      type: 'medication_safety',
      title: 'Revisão de segurança medicamentosa',
      content: 'Foi mencionado medicamento/condição que pode exigir checagem de alergias, interações, função renal/hepática, dose e acompanhamento dentro do escopo profissional.',
      severity: 'warning',
    })
  }

  addRequiredQuestionCards(cards, text, context)

  cards.push({ type: 'summary', title: 'Resumo parcial', content: compactSummary(text), severity: 'info' })
  cards.push({ type: 'next_action', title: 'Antes de finalizar', content: 'Revise a nota estruturada, registre observações próprias e salve apenas após validação profissional.', severity: 'info' })

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

    const { data: preference } = await supabase
      .from('professional_ai_preferences')
      .select('*')
      .eq('professional_user_id', user.id)
      .maybeSingle()

    const professionalContext = normalizeContext(professional, preference)

    const { data: visit, error: visitError } = await supabase
      .from('clinical_visits')
      .select('*')
      .eq('id', visitId)
      .eq('professional_user_id', user.id)
      .maybeSingle()

    if (visitError || !visit) return NextResponse.json({ error: 'Atendimento não encontrado' }, { status: 404 })

    const mergedTranscript = transcriptText || visit.transcript_text || ''
    const cards = buildProfessionalCards(mergedTranscript, visit.data_scope || 'visit_only', professionalContext)
    const soap = buildSoap(mergedTranscript, visit.patient_name, visit.reason, professionalContext)

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
        professional_context: {
          professional_type: professionalContext.professionalType,
          specialty: professionalContext.specialty,
          note_template: professionalContext.noteTemplate,
          verification_status: professionalContext.verificationStatus,
        },
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
        professional_context: {
          professional_type: professionalContext.professionalType,
          specialty: professionalContext.specialty,
          note_template: professionalContext.noteTemplate,
          verification_status: professionalContext.verificationStatus,
          capability_scope: 'workspace_ai_notes_only_until_verification',
        },
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
      tool_type: mode === 'final' ? 'structured_note_generation' : 'live_consultation_cards',
      model_provider: 'mydatamed_copilot_mvp',
      input_scope: visit.data_scope === 'healthwallet_authorized' ? 'authorized_patient_data_and_visit_transcript' : 'visit_transcript_only',
      output_summary: `${cards.length} card(s) gerados; nota estruturada ${mode === 'final' ? 'preparada' : 'parcial'} para ${professionalContext.professionalType}.`,
      reviewed_by_doctor: false,
      metadata: {
        professional_id: professional.id,
        professional_type: professionalContext.professionalType,
        note_template: professionalContext.noteTemplate,
        mode,
        decision_owner: 'health_professional',
        ai_is_support_tool: true,
      },
    })

    return NextResponse.json({
      ok: true,
      cards: insertedCards || [],
      soap,
      professional_context: professionalContext,
      disclaimer: 'IA usada apenas como apoio. O profissional deve revisar, validar e assumir a decisão dentro do seu escopo.',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
