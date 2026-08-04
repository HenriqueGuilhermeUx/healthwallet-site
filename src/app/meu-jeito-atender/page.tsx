'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Brain, CheckCircle, Loader2, Save, ShieldCheck, Sparkles, SlidersHorizontal } from 'lucide-react'

const TEMPLATE_LABELS: Record<string, string> = {
  clinical_soap: 'SOAP clínico',
  nutritional_evolution: 'Evolução nutricional',
  functional_rehab_evolution: 'Evolução fisioterapêutica / funcional',
  therapeutic_session_note: 'Registro terapêutico',
  nursing_triage_followup: 'Triagem / acompanhamento de enfermagem',
  therapy_evolution: 'Evolução terapêutica',
  dental_visit_note: 'Nota odontológica',
  pharmaceutical_care_note: 'Cuidado farmacêutico',
  training_health_followup: 'Acompanhamento de treino/saúde',
  general_health_visit: 'Nota geral de atendimento',
}

const TEMPLATE_OPTIONS = Object.entries(TEMPLATE_LABELS).map(([value, label]) => ({ value, label }))

const TYPE_LABELS: Record<string, string> = {
  medico: 'Médico(a)',
  nutricionista: 'Nutricionista',
  fisioterapeuta: 'Fisioterapeuta',
  psicologo: 'Psicólogo(a)',
  terapeuta: 'Terapeuta',
  enfermeiro: 'Enfermeiro(a)',
  fonoaudiologo: 'Fonoaudiólogo(a)',
  odonto: 'Odontólogo(a)',
  farmaceutico: 'Farmacêutico(a)',
  educador_fisico: 'Educador(a) físico(a)',
  outro: 'Profissional de saúde',
}

function defaultsFor(professionalType?: string) {
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
  return map[professionalType || ''] || ['Queixa/objetivo principal', 'Histórico relevante', 'Orientações dadas', 'Plano de acompanhamento']
}

function templateFor(professionalType?: string) {
  const map: Record<string, string> = {
    medico: 'clinical_soap',
    nutricionista: 'nutritional_evolution',
    fisioterapeuta: 'functional_rehab_evolution',
    psicologo: 'therapeutic_session_note',
    terapeuta: 'therapeutic_session_note',
    enfermeiro: 'nursing_triage_followup',
    fonoaudiologo: 'therapy_evolution',
    odonto: 'dental_visit_note',
    farmaceutico: 'pharmaceutical_care_note',
    educador_fisico: 'training_health_followup',
  }
  return map[professionalType || ''] || 'general_health_visit'
}

export default function MeuJeitoAtenderPage() {
  const { user, professional, loading: authLoading, refreshProfessional } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferenceId, setPreferenceId] = useState<string | null>(null)
  const [form, setForm] = useState({
    note_template: 'general_health_visit',
    preferred_summary_style: 'structured',
    preferred_tone: 'professional_clear',
    patient_audience: '',
    service_style: '',
    required_questions: '',
    default_follow_up_message: '',
    custom_instructions: '',
  })

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && professional) loadPreferences()
  }, [user, professional])

  const typeLabel = TYPE_LABELS[professional?.professional_type || ''] || professional?.professional_type || 'Profissional de saúde'
  const allowedCapabilities = Array.isArray(professional?.allowed_capabilities) ? professional?.allowed_capabilities : []
  const blockedCapabilities = Array.isArray(professional?.blocked_capabilities) ? professional?.blocked_capabilities : []

  const previewCards = useMemo(() => {
    const questions = form.required_questions.split('\n').map((item) => item.trim()).filter(Boolean)
    return questions.slice(0, 6)
  }, [form.required_questions])

  async function loadPreferences() {
    if (!user || !professional) return
    setLoading(true)

    const { data } = await supabase
      .from('professional_ai_preferences')
      .select('*')
      .eq('professional_user_id', user.id)
      .maybeSingle()

    const practicePreferences = professional.practice_preferences || {}
    const required = data?.required_questions || practicePreferences.required_questions || defaultsFor(professional.professional_type)

    setPreferenceId(data?.id || null)
    setForm({
      note_template: data?.note_template || professional.consultation_template || practicePreferences.note_template || templateFor(professional.professional_type),
      preferred_summary_style: data?.preferred_summary_style || practicePreferences.preferred_summary_style || 'structured',
      preferred_tone: data?.preferred_tone || professional.professional_context?.preferred_tone || 'professional_clear',
      patient_audience: data?.patient_audience || professional.professional_context?.patient_audience || '',
      service_style: data?.service_style || professional.professional_context?.service_style || '',
      required_questions: Array.isArray(required) ? required.join('\n') : String(required || ''),
      default_follow_up_message: data?.default_follow_up_message || practicePreferences.default_follow_up_message || '',
      custom_instructions: data?.custom_instructions || practicePreferences.custom_instructions || 'IA deve atuar apenas como apoio. O profissional revisa, edita, valida e assume responsabilidade dentro do seu escopo profissional.',
    })

    setLoading(false)
  }

  async function savePreferences() {
    if (!user || !professional) return
    setSaving(true)

    const requiredQuestions = form.required_questions.split('\n').map((item) => item.trim()).filter(Boolean)
    const preferencePayload = {
      professional_id: professional.id,
      professional_user_id: user.id,
      professional_type: professional.professional_type,
      specialty: professional.specialty || null,
      note_template: form.note_template,
      preferred_summary_style: form.preferred_summary_style,
      preferred_tone: form.preferred_tone,
      patient_audience: form.patient_audience || null,
      service_style: form.service_style || null,
      required_questions: requiredQuestions,
      default_follow_up_message: form.default_follow_up_message || null,
      custom_instructions: form.custom_instructions || null,
      capabilities_snapshot: {
        verification_status: professional.verification_status || 'self_declared',
        allowed_capabilities: allowedCapabilities,
        blocked_capabilities: blockedCapabilities,
      },
      updated_at: new Date().toISOString(),
    }

    const professionalPatch = {
      consultation_template: form.note_template,
      practice_preferences: {
        note_template: form.note_template,
        preferred_summary_style: form.preferred_summary_style,
        preferred_tone: form.preferred_tone,
        required_questions: requiredQuestions,
        default_follow_up_message: form.default_follow_up_message || '',
        custom_instructions: form.custom_instructions || '',
      },
      professional_context: {
        ...(professional.professional_context || {}),
        professional_type: professional.professional_type,
        specialty: professional.specialty || null,
        patient_audience: form.patient_audience || null,
        service_style: form.service_style || null,
        preferred_tone: form.preferred_tone,
        note_template: form.note_template,
        updated_from: 'meu_jeito_atender',
      },
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    }

    const { error: profError } = await supabase
      .from('professionals')
      .update(professionalPatch)
      .eq('user_id', user.id)

    if (profError) {
      toast.error(profError.message || 'Erro ao salvar perfil profissional')
      setSaving(false)
      return
    }

    const upsertPayload = preferenceId ? { id: preferenceId, ...preferencePayload } : preferencePayload
    const { data, error } = await supabase
      .from('professional_ai_preferences')
      .upsert(upsertPayload, { onConflict: 'professional_user_id' })
      .select('*')
      .single()

    if (error) {
      toast.error(`${error.message}. Rode SQL_PROFESSIONAL_PERSONALIZATION_V1.sql.`)
      setSaving(false)
      return
    }

    setPreferenceId(data?.id || preferenceId)
    await refreshProfessional()
    setSaving(false)
    toast.success('Seu jeito de atender foi salvo. A IA já usará esse contexto nos próximos atendimentos.')
  }

  if (authLoading || !professional || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800 mb-3">
            <SlidersHorizontal className="w-4 h-4" /> Meu jeito de atender
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Personalize a IA do MyDataMed</h1>
          <p className="text-gray-600 mt-1">O sistema usa sua profissão, especialidade e preferências para adaptar perguntas, cards, resumo e plano de cuidado.</p>
        </div>
        <Link href="/consulta-assistida" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-white font-semibold hover:bg-violet-800">
          <Brain className="w-5 h-5" /> Abrir Consulta Assistida
        </Link>
      </div>

      <section className="grid md:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Profissão</p>
          <p className="font-bold text-lg text-gray-900 mt-1">{typeLabel}</p>
          <p className="text-sm text-gray-500 mt-1">{professional.specialty || 'Especialidade não informada'}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5">
          <p className="text-sm text-emerald-700">Status</p>
          <p className="font-bold text-lg text-emerald-950 mt-1">{professional.verification_status === 'verified' ? 'Verificado' : 'Autodeclarado'}</p>
          <p className="text-sm text-emerald-800 mt-1">Workspace, IA, notas e CRM liberados.</p>
        </div>
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
          <p className="text-sm text-amber-700">Recursos regulados</p>
          <p className="font-bold text-lg text-amber-950 mt-1">Verificação depois</p>
          <p className="text-sm text-amber-800 mt-1">Prescrição/assinatura ficam bloqueadas até validação.</p>
        </div>
      </section>

      <section className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-5">
          <h2 className="font-bold text-lg">Preferências do atendimento</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <Select label="Modelo de nota" value={form.note_template} onChange={(value: string) => setForm({ ...form, note_template: value })} options={TEMPLATE_OPTIONS} />
            <Select label="Estilo do resumo" value={form.preferred_summary_style} onChange={(value: string) => setForm({ ...form, preferred_summary_style: value })} options={[
              { value: 'structured', label: 'Estruturado e objetivo' },
              { value: 'detailed', label: 'Mais detalhado' },
              { value: 'brief', label: 'Curto para revisão rápida' },
            ]} />
            <Select label="Tom das orientações" value={form.preferred_tone} onChange={(value: string) => setForm({ ...form, preferred_tone: value })} options={[
              { value: 'professional_clear', label: 'Profissional e claro' },
              { value: 'warm_human', label: 'Acolhedor e humano' },
              { value: 'direct_practical', label: 'Direto e prático' },
            ]} />
            <Input label="Público atendido" value={form.patient_audience} onChange={(value: string) => setForm({ ...form, patient_audience: value })} placeholder="Ex: adultos, idosos, atletas, gestantes..." />
          </div>

          <Textarea label="Como você atende?" value={form.service_style} onChange={(value: string) => setForm({ ...form, service_style: value })} placeholder="Ex: gosto de registrar metas, retorno em 30 dias, plano prático e linguagem simples." />
          <Textarea label="Perguntas/campos obrigatórios para seus atendimentos" value={form.required_questions} onChange={(value: string) => setForm({ ...form, required_questions: value })} placeholder="Uma pergunta por linha" rows={8} />
          <Textarea label="Mensagem padrão de follow-up" value={form.default_follow_up_message} onChange={(value: string) => setForm({ ...form, default_follow_up_message: value })} placeholder="Ex: Olá! Como foi sua evolução desde nosso último atendimento?" />
          <Textarea label="Instruções personalizadas para a IA" value={form.custom_instructions} onChange={(value: string) => setForm({ ...form, custom_instructions: value })} rows={5} />

          <button onClick={savePreferences} disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Salvando...' : 'Salvar personalização'}
          </button>
        </div>

        <aside className="space-y-4">
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3"><Sparkles className="w-5 h-5 text-violet-700" /><h3 className="font-bold text-violet-950">Como a IA vai usar isso</h3></div>
            <p className="text-sm text-violet-900">Cada atendimento recebe seu contexto profissional: profissão, especialidade, modelo de nota, público, tom, perguntas obrigatórias e capacidades permitidas.</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold mb-3">Cards que a IA vai cobrar</h3>
            <div className="space-y-2">
              {previewCards.length > 0 ? previewCards.map((item) => <div key={item} className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm text-gray-700 flex gap-2"><CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />{item}</div>) : <p className="text-sm text-gray-500">Adicione perguntas obrigatórias para guiar os cards.</p>}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-950">
            <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-5 h-5" /><strong>Capacidades</strong></div>
            <p>Liberado: workspace, IA, notas, plano de cuidado, follow-up e CRM.</p>
            <p className="mt-2">Bloqueado até verificação: prescrição, assinatura oficial e documentos regulados.</p>
          </div>
        </aside>
      </section>
    </div>
  )
}

function Input({ label, value, onChange, placeholder }: any) {
  return <div><label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20" /></div>
}

function Textarea({ label, value, onChange, placeholder, rows = 4 }: any) {
  return <div><label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label><textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20" /></div>
}

function Select({ label, value, onChange, options }: any) {
  return <div><label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20">{options.map((item: any) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
}
