'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  HeartPulse,
  KeyRound,
  Loader2,
  PlayCircle,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserPlus,
  Users,
} from 'lucide-react'

const emptyForm = {
  patient_name: '',
  patient_cpf: '',
  patient_birth_date: '',
  patient_phone: '',
  patient_email: '',
  specialty: '',
  reason: '',
  health_plan_provider: '',
  health_plan_card_number: '',
  health_plan_type: '',
  plan_holder_name: '',
  intake_notes: '',
  patient_data_consent: true,
  plan_data_consent: false,
  lgpd_consent: true,
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  waiting: { label: 'Aguardando', cls: 'bg-slate-100 text-slate-700' },
  triage: { label: 'Em triagem', cls: 'bg-blue-100 text-blue-700' },
  ready: { label: 'Pronto', cls: 'bg-emerald-100 text-emerald-700' },
  in_care: { label: 'Em atendimento', cls: 'bg-violet-100 text-violet-700' },
  completed: { label: 'Concluído', cls: 'bg-gray-900 text-white' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
}

export default function EntradaPacientePage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [validatingCode, setValidatingCode] = useState(false)
  const [startingVisit, setStartingVisit] = useState(false)
  const [intakes, setIntakes] = useState<any[]>([])
  const [activeIntake, setActiveIntake] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)
  const [healthwalletCode, setHealthwalletCode] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && professional) loadIntakes()
  }, [user, professional])

  const stats = useMemo(() => ({
    total: intakes.length,
    waiting: intakes.filter((item) => item.status === 'waiting').length,
    ready: intakes.filter((item) => item.status === 'ready').length,
    inCare: intakes.filter((item) => item.status === 'in_care').length,
  }), [intakes])

  async function loadIntakes() {
    if (!user) return
    setLoading(true)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('patient_intakes')
      .select('*')
      .eq('professional_user_id', user.id)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
      .limit(80)

    if (error) {
      toast.error('Rode SQL_ENTRADA_PACIENTE_V1.sql no Supabase para ativar a Entrada do Paciente.')
      setIntakes([])
    } else {
      setIntakes(data || [])
      if (!activeIntake && data?.[0]) setActiveIntake(data[0])
    }
    setLoading(false)
  }

  function computeMissingFields(payload: any) {
    const missing: string[] = []
    if (!payload.patient_name?.trim()) missing.push('Nome do paciente')
    if (!payload.patient_phone?.trim() && !payload.patient_email?.trim()) missing.push('Contato do paciente')
    if (!payload.reason?.trim()) missing.push('Motivo do atendimento')
    if (!payload.patient_data_consent) missing.push('Consentimento para dados do atendimento')
    if (payload.health_plan_provider?.trim() && !payload.health_plan_card_number?.trim()) missing.push('Número da carteirinha')
    return missing
  }

  function buildChecklist(payload: any, source = 'manual') {
    const hasPlan = Boolean(payload.health_plan_provider || payload.health_plan_card_number)
    return {
      patient_identification: Boolean(payload.patient_name),
      contact_available: Boolean(payload.patient_phone || payload.patient_email),
      reason_registered: Boolean(payload.reason),
      consent_registered: Boolean(payload.patient_data_consent && payload.lgpd_consent),
      plan_informed: hasPlan,
      plan_card_available: hasPlan ? Boolean(payload.health_plan_card_number) : null,
      source,
      administrative_review: 'pending',
      glosa_prevention_note: hasPlan
        ? 'Dados de plano/carteirinha registrados para revisão administrativa antes do atendimento/faturamento.'
        : 'Atendimento sem plano informado ou particular. Confirmar forma de pagamento/cobertura quando aplicável.',
    }
  }

  async function createManualIntake() {
    if (!user || !professional) return
    if (!form.patient_name.trim()) {
      toast.error('Informe o nome do paciente')
      return
    }
    if (!form.patient_data_consent || !form.lgpd_consent) {
      toast.error('Confirme os consentimentos básicos de entrada e LGPD')
      return
    }

    setCreating(true)
    try {
      let guestPatientId = null
      try {
        const { data: guest } = await supabase
          .from('guest_patients')
          .insert({
            professional_id: professional.id,
            professional_user_id: user.id,
            name: form.patient_name,
            email: form.patient_email || null,
            phone: form.patient_phone || null,
            metadata: { created_from: 'entrada_paciente', cpf: onlyDigits(form.patient_cpf) || null },
          })
          .select('*')
          .single()
        guestPatientId = guest?.id || null
      } catch {
        guestPatientId = null
      }

      const payload = normalizeFormPayload(form)
      const missingFields = computeMissingFields(payload)
      const { data, error } = await supabase
        .from('patient_intakes')
        .insert({
          professional_id: professional.id,
          professional_user_id: user.id,
          clinic_name: professional.professional_context?.clinic_name || null,
          source: 'manual',
          status: missingFields.length ? 'waiting' : 'ready',
          guest_patient_id: guestPatientId,
          data_scope: 'intake_only',
          ...payload,
          missing_fields: missingFields,
          checklist: buildChecklist(payload, 'manual'),
          consent_text: 'Paciente/profissional confirmou uso dos dados informados para organizar a entrada do atendimento, com finalidade assistencial e administrativa.',
          consented_at: new Date().toISOString(),
          metadata: {
            created_from: 'entrada_paciente_manual',
            goal: 'reduzir_papelada_retrabalho_e_erros_administrativos',
          },
        })
        .select('*')
        .single()

      if (error) throw error
      await logEvent(data.id, 'intake_created', 'Entrada manual criada na recepção.', null, data.status)
      toast.success('Entrada criada')
      setForm(emptyForm)
      setShowForm(false)
      setActiveIntake(data)
      loadIntakes()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar entrada')
    } finally {
      setCreating(false)
    }
  }

  async function validateHealthWalletCode() {
    if (!user || !professional) return
    const code = healthwalletCode.replace(/\D/g, '')
    if (code.length !== 6) {
      toast.error('Digite o código HealthWallet de 6 dígitos')
      return
    }

    setValidatingCode(true)
    try {
      const { data: accessCode, error: findError } = await supabase
        .from('access_codes')
        .select('*')
        .eq('code', code)
        .gte('expires_at', new Date().toISOString())
        .maybeSingle()

      if (findError || !accessCode?.patient_id) {
        toast.error('Código inválido ou expirado')
        return
      }

      if (!accessCode.used_at) {
        await supabase
          .from('access_codes')
          .update({ used_at: new Date().toISOString(), professional_id: professional.id })
          .eq('id', accessCode.id)
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', accessCode.patient_id)
        .maybeSingle()

      const payload = {
        patient_name: profile?.full_name || accessCode.patient_name || 'Paciente HealthWallet',
        patient_cpf: onlyDigits(profile?.cpf || '') || null,
        patient_birth_date: profile?.birth_date || null,
        patient_phone: profile?.phone || null,
        patient_email: profile?.email || null,
        specialty: professional.specialty || professional.consultation_template || 'Atendimento',
        reason: 'Entrada via código HealthWallet',
        health_plan_provider: profile?.health_plan_provider || profile?.insurance_provider || null,
        health_plan_card_number: profile?.health_plan_card_number || profile?.insurance_card_number || null,
        health_plan_type: profile?.health_plan_type || null,
        plan_holder_name: profile?.full_name || null,
        intake_notes: 'Paciente validado por código HealthWallet.',
        patient_data_consent: true,
        plan_data_consent: Boolean(profile?.health_plan_provider || profile?.insurance_provider),
        lgpd_consent: true,
      }

      const missingFields = computeMissingFields(payload)
      const { data, error } = await supabase
        .from('patient_intakes')
        .insert({
          professional_id: professional.id,
          professional_user_id: user.id,
          source: 'healthwallet_code',
          status: missingFields.length ? 'waiting' : 'ready',
          patient_user_id: accessCode.patient_id,
          data_scope: 'healthwallet_authorized',
          healthwallet_access_code: code,
          ...payload,
          missing_fields: missingFields,
          checklist: buildChecklist(payload, 'healthwallet_code'),
          consent_text: 'Entrada criada a partir de código HealthWallet válido apresentado pelo paciente.',
          consented_at: new Date().toISOString(),
          metadata: {
            access_code_id: accessCode.id,
            permissions: accessCode.permissions || {},
            created_from: 'healthwallet_access_code',
          },
        })
        .select('*')
        .single()

      if (error) throw error
      await logEvent(data.id, 'healthwallet_code_validated', 'Código HealthWallet validado e entrada criada.', null, data.status, { access_code_id: accessCode.id })
      toast.success('Paciente HealthWallet validado')
      setHealthwalletCode('')
      setActiveIntake(data)
      loadIntakes()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao validar código')
    } finally {
      setValidatingCode(false)
    }
  }

  async function updateStatus(intake: any, status: string) {
    if (!user) return
    const now = new Date().toISOString()
    const timestamps: Record<string, any> = {
      triage: { triage_started_at: now },
      ready: { ready_at: now },
      in_care: { care_started_at: now },
      completed: { completed_at: now },
    }

    const { data, error } = await supabase
      .from('patient_intakes')
      .update({ status, ...(timestamps[status] || {}) })
      .eq('id', intake.id)
      .eq('professional_user_id', user.id)
      .select('*')
      .single()

    if (error) {
      toast.error('Erro ao atualizar status')
      return
    }

    await logEvent(intake.id, 'status_changed', `Status alterado para ${STATUS_LABELS[status]?.label || status}.`, intake.status, status)
    setActiveIntake(data)
    setIntakes((current) => current.map((item) => item.id === data.id ? data : item))
  }

  async function startAssistedVisit(intake: any) {
    if (!user || !professional) return
    setStartingVisit(true)
    try {
      const { data: visit, error } = await supabase
        .from('clinical_visits')
        .insert({
          professional_id: professional.id,
          professional_user_id: user.id,
          patient_user_id: intake.patient_user_id || null,
          guest_patient_id: intake.guest_patient_id || null,
          patient_name: intake.patient_name || null,
          patient_email: intake.patient_email || null,
          patient_phone: intake.patient_phone || null,
          specialty: intake.specialty || professional.specialty || professional.consultation_template || 'Atendimento',
          reason: intake.reason || 'Atendimento iniciado pela Entrada do Paciente',
          status: 'draft',
          data_scope: intake.data_scope === 'healthwallet_authorized' ? 'healthwallet_authorized' : 'visit_only',
          consent_audio_recording: false,
          consent_ai_transcription: false,
          consent_ai_support: true,
          ai_disclaimer_ack: true,
          metadata: {
            patient_intake_id: intake.id,
            intake_source: intake.source,
            intake_checklist: intake.checklist || {},
            intake_missing_fields: intake.missing_fields || [],
            administrative_context: {
              health_plan_provider: intake.health_plan_provider || null,
              health_plan_card_number: intake.health_plan_card_number || null,
              health_plan_type: intake.health_plan_type || null,
            },
            ai_policy: 'support_only_health_professional_final_decision',
          },
        })
        .select('*')
        .single()

      if (error) throw error

      const now = new Date().toISOString()
      await supabase
        .from('patient_intakes')
        .update({ status: 'in_care', started_visit_id: visit.id, care_started_at: now })
        .eq('id', intake.id)
        .eq('professional_user_id', user.id)

      await logEvent(intake.id, 'assisted_visit_started', 'Consulta Assistida iniciada a partir da entrada do paciente.', intake.status, 'in_care', { visit_id: visit.id })
      toast.success('Atendimento iniciado')
      router.push('/consulta-assistida')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao iniciar atendimento')
    } finally {
      setStartingVisit(false)
    }
  }

  async function logEvent(intakeId: string, eventType: string, description: string, fromStatus?: string | null, toStatus?: string | null, metadata: any = {}) {
    if (!user) return
    try {
      await supabase.from('patient_intake_events').insert({
        intake_id: intakeId,
        professional_user_id: user.id,
        actor_user_id: user.id,
        event_type: eventType,
        description,
        from_status: fromStatus || null,
        to_status: toStatus || null,
        metadata,
      })
    } catch {}
  }

  if (authLoading || !professional) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-6 md:p-9">
        <div className="absolute -right-16 -top-24 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -left-16 bottom-0 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5">
              <Sparkles className="w-4 h-4" /> Entrada do Paciente — menos papelada, mais dados organizados
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">Comece o atendimento com os dados certos.</h1>
            <p className="text-white/70 mt-4 text-lg max-w-3xl">
              Organize a chegada do paciente, valide dados autorizados, registre plano/carteirinha quando informado e inicie a Consulta Assistida com contexto administrativo e assistencial.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <button onClick={() => setShowForm(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold hover:bg-emerald-600">
                <UserPlus className="w-5 h-5" /> Nova entrada manual
              </button>
              <Link href="/consulta-assistida" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-3 font-semibold hover:bg-white/15">
                <Stethoscope className="w-5 h-5" /> Consulta Assistida
              </Link>
              <Link href="/lgpd-consultorio" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-3 font-semibold hover:bg-white/15">
                <ShieldCheck className="w-5 h-5" /> LGPD
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 border border-white/10 p-4 backdrop-blur">
            <div className="rounded-2xl bg-white text-gray-900 p-5 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><QrCode className="w-5 h-5" /></div>
                <div><p className="font-bold">Código HealthWallet</p><p className="text-xs text-gray-500">Use quando o paciente trouxer um código autorizado.</p></div>
              </div>
              <div className="flex gap-2">
                <input value={healthwalletCode} onChange={(e) => setHealthwalletCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-center text-xl tracking-[0.35em] font-bold outline-none focus:ring-2 focus:ring-emerald-500/20" />
                <button onClick={validateHealthWalletCode} disabled={validatingCode} className="rounded-xl bg-emerald-600 text-white px-4 py-3 font-semibold disabled:opacity-60">
                  {validatingCode ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Validar'}
                </button>
              </div>
              <p className="text-xs text-gray-500">Sem código? Cadastre a entrada manualmente e convide o paciente a usar o HealthWallet depois.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-3">
        <StatCard label="Entradas hoje" value={stats.total} icon={Users} tone="emerald" />
        <StatCard label="Aguardando" value={stats.waiting} icon={Clock} tone="slate" />
        <StatCard label="Prontos" value={stats.ready} icon={BadgeCheck} tone="blue" />
        <StatCard label="Em atendimento" value={stats.inCare} icon={HeartPulse} tone="violet" />
      </section>

      {showForm && (
        <section className="bg-white rounded-3xl border border-gray-100 shadow-lg p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Nova entrada manual</h2>
              <p className="text-sm text-gray-600 mt-1">Use para paciente avulso, paciente sem app ou quando a recepção precisa registrar dados mínimos antes do atendimento.</p>
            </div>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-900">Fechar</button>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Input label="Nome do paciente *" value={form.patient_name} onChange={(v: string) => setForm({ ...form, patient_name: v })} />
            <Input label="CPF" value={form.patient_cpf} onChange={(v: string) => setForm({ ...form, patient_cpf: v })} />
            <Input label="Nascimento" type="date" value={form.patient_birth_date} onChange={(v: string) => setForm({ ...form, patient_birth_date: v })} />
            <Input label="Telefone" value={form.patient_phone} onChange={(v: string) => setForm({ ...form, patient_phone: v })} />
            <Input label="E-mail" value={form.patient_email} onChange={(v: string) => setForm({ ...form, patient_email: v })} />
            <Input label="Especialidade/serviço" value={form.specialty} onChange={(v: string) => setForm({ ...form, specialty: v })} placeholder={professional.specialty || 'Atendimento'} />
          </div>

          <Input label="Motivo do atendimento" value={form.reason} onChange={(v: string) => setForm({ ...form, reason: v })} placeholder="Ex: retorno, avaliação, consulta, procedimento, orientação" />

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-blue-950"><FileText className="w-5 h-5" /><strong>Plano/carteirinha quando informado</strong></div>
            <div className="grid md:grid-cols-4 gap-3">
              <Input label="Operadora" value={form.health_plan_provider} onChange={(v: string) => setForm({ ...form, health_plan_provider: v })} />
              <Input label="Carteirinha" value={form.health_plan_card_number} onChange={(v: string) => setForm({ ...form, health_plan_card_number: v })} />
              <Input label="Tipo/plano" value={form.health_plan_type} onChange={(v: string) => setForm({ ...form, health_plan_type: v })} />
              <Input label="Titular" value={form.plan_holder_name} onChange={(v: string) => setForm({ ...form, plan_holder_name: v })} />
            </div>
            <p className="text-xs text-blue-800">Esta camada prepara dados para conferência administrativa, TISS/TUSS, autorização/elegibilidade e prevenção de glosas em fases futuras.</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1 block">Observações da recepção</label>
            <textarea value={form.intake_notes} onChange={(e) => setForm({ ...form, intake_notes: e.target.value })} className="w-full min-h-[90px] rounded-2xl border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Documento pendente, confirmação de plano, chegada com acompanhante, prioridade, observações administrativas." />
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2 text-sm text-amber-950">
            <Check label="Paciente autorizou uso dos dados informados para organizar a entrada do atendimento" checked={form.patient_data_consent} onChange={(v: boolean) => setForm({ ...form, patient_data_consent: v })} />
            <Check label="Paciente autorizou registrar dados de plano/carteirinha quando informados" checked={form.plan_data_consent} onChange={(v: boolean) => setForm({ ...form, plan_data_consent: v })} />
            <Check label="Registro orientado à LGPD: mínimo necessário, finalidade assistencial/administrativa e auditoria" checked={form.lgpd_consent} onChange={(v: boolean) => setForm({ ...form, lgpd_consent: v })} />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border font-semibold">Cancelar</button>
            <button onClick={createManualIntake} disabled={creating} className="flex-1 py-3 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-60">
              {creating ? 'Criando...' : 'Criar entrada'}
            </button>
          </div>
        </section>
      )}

      <section className="grid lg:grid-cols-[360px_1fr] gap-6">
        <aside className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Fila de hoje</h2>
            <button onClick={loadIntakes} className="text-sm text-emerald-700 font-semibold inline-flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Atualizar</button>
          </div>
          {loading ? <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div> : intakes.length ? (
            <div className="space-y-2">
              {intakes.map((item) => <IntakeListItem key={item.id} item={item} active={activeIntake?.id === item.id} onClick={() => setActiveIntake(item)} />)}
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-gray-500">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              Nenhuma entrada hoje.
            </div>
          )}
        </aside>

        <main className="space-y-5">
          {!activeIntake ? (
            <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
              <ClipboardCheck className="w-14 h-14 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900">Selecione ou crie uma entrada</h2>
              <p className="text-gray-600 mt-2">A recepção organiza o paciente antes do atendimento e reduz retrabalho na consulta.</p>
            </section>
          ) : (
            <>
              <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-xs font-bold rounded-full px-3 py-1 ${STATUS_LABELS[activeIntake.status]?.cls || 'bg-gray-100 text-gray-700'}`}>{STATUS_LABELS[activeIntake.status]?.label || activeIntake.status}</span>
                      <span className="text-xs rounded-full bg-emerald-50 text-emerald-700 px-3 py-1">{activeIntake.source === 'healthwallet_code' ? 'HealthWallet' : 'Manual'}</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{activeIntake.patient_name}</h2>
                    <p className="text-gray-600 mt-1">{activeIntake.reason || 'Motivo não informado'} • {activeIntake.specialty || 'Atendimento'}</p>
                    <p className="text-xs text-gray-500 mt-1">Entrada: {formatDateTime(activeIntake.checked_in_at || activeIntake.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => updateStatus(activeIntake, 'triage')} className="rounded-xl border border-blue-200 px-4 py-2 text-blue-700 font-semibold hover:bg-blue-50">Triagem</button>
                    <button onClick={() => updateStatus(activeIntake, 'ready')} className="rounded-xl border border-emerald-200 px-4 py-2 text-emerald-700 font-semibold hover:bg-emerald-50">Pronto</button>
                    <button onClick={() => startAssistedVisit(activeIntake)} disabled={startingVisit} className="rounded-xl bg-violet-700 px-4 py-2 text-white font-semibold hover:bg-violet-800 disabled:opacity-60 inline-flex items-center gap-2"><PlayCircle className="w-4 h-4" /> Atender com IA</button>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <Info label="Contato" value={activeIntake.patient_phone || activeIntake.patient_email || 'Não informado'} />
                  <Info label="CPF" value={activeIntake.patient_cpf || 'Não informado'} />
                  <Info label="Nascimento" value={activeIntake.patient_birth_date ? formatDate(activeIntake.patient_birth_date) : 'Não informado'} />
                </div>
              </section>

              <section className="grid lg:grid-cols-2 gap-5">
                <Panel title="Checklist pré-atendimento" icon={ClipboardCheck}>
                  <div className="space-y-3">
                    <ChecklistItem ok={Boolean(activeIntake.patient_name)} label="Identificação do paciente" />
                    <ChecklistItem ok={Boolean(activeIntake.patient_phone || activeIntake.patient_email)} label="Contato para retorno/follow-up" />
                    <ChecklistItem ok={Boolean(activeIntake.reason)} label="Motivo do atendimento" />
                    <ChecklistItem ok={Boolean(activeIntake.patient_data_consent && activeIntake.lgpd_consent)} label="Consentimento e finalidade registrados" />
                    <ChecklistItem ok={activeIntake.health_plan_provider ? Boolean(activeIntake.health_plan_card_number) : true} label="Plano/carteirinha conferidos quando aplicável" />
                  </div>
                  {activeIntake.missing_fields?.length ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mt-4 text-sm text-amber-950">
                      <strong>Pendências:</strong>
                      <ul className="list-disc list-inside mt-2 space-y-1">{activeIntake.missing_fields.map((item: string) => <li key={item}>{item}</li>)}</ul>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 mt-4 text-sm text-emerald-900">Dados mínimos organizados para iniciar o atendimento.</div>
                  )}
                </Panel>

                <Panel title="Plano, carteirinha e base para faturamento" icon={FileText}>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Info label="Operadora" value={activeIntake.health_plan_provider || 'Não informado / Particular'} />
                    <Info label="Carteirinha" value={activeIntake.health_plan_card_number || 'Não informado'} />
                    <Info label="Tipo/plano" value={activeIntake.health_plan_type || 'Não informado'} />
                    <Info label="Titular" value={activeIntake.plan_holder_name || activeIntake.patient_name || 'Não informado'} />
                  </div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 mt-4 text-sm text-blue-950 flex gap-2">
                    <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span>Próxima evolução: elegibilidade, autorização, TISS/TUSS, conferência de guia e apoio à redução de glosas administrativas.</span>
                  </div>
                </Panel>
              </section>

              <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-3"><ShieldCheck className="w-5 h-5 text-emerald-700" /><h2 className="font-bold text-gray-900">Auditoria e LGPD da entrada</h2></div>
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <Info label="Escopo de dados" value={activeIntake.data_scope === 'healthwallet_authorized' ? 'HealthWallet autorizado' : 'Somente entrada'} />
                  <Info label="Consentimento" value={activeIntake.lgpd_consent ? 'Registrado' : 'Pendente'} />
                  <Info label="Código HealthWallet" value={activeIntake.healthwallet_access_code || 'Não usado'} />
                </div>
                {activeIntake.intake_notes && <p className="rounded-2xl bg-gray-50 border p-4 mt-4 text-sm text-gray-700"><strong>Observações:</strong> {activeIntake.intake_notes}</p>}
              </section>

              <div className="flex justify-end">
                <button onClick={() => updateStatus(activeIntake, 'completed')} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50">
                  <CheckCircle className="w-5 h-5" /> Marcar como concluído
                </button>
              </div>
            </>
          )}
        </main>
      </section>
    </main>
  )
}

function normalizeFormPayload(form: any) {
  return {
    patient_name: form.patient_name.trim(),
    patient_cpf: onlyDigits(form.patient_cpf) || null,
    patient_birth_date: form.patient_birth_date || null,
    patient_phone: form.patient_phone || null,
    patient_email: form.patient_email || null,
    specialty: form.specialty || null,
    reason: form.reason || null,
    health_plan_provider: form.health_plan_provider || null,
    health_plan_card_number: form.health_plan_card_number || null,
    health_plan_type: form.health_plan_type || null,
    plan_holder_name: form.plan_holder_name || null,
    intake_notes: form.intake_notes || null,
    patient_data_consent: Boolean(form.patient_data_consent),
    plan_data_consent: Boolean(form.plan_data_consent),
    lgpd_consent: Boolean(form.lgpd_consent),
  }
}

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function StatCard({ label, value, icon: Icon, tone }: any) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
  }
  return <div className={`rounded-3xl border p-5 ${colors[tone] || colors.emerald}`}><Icon className="w-7 h-7 mb-3" /><p className="text-sm opacity-75">{label}</p><p className="text-3xl font-bold mt-1">{value}</p></div>
}

function IntakeListItem({ item, active, onClick }: any) {
  return <button onClick={onClick} className={`w-full text-left rounded-2xl border p-4 transition-colors ${active ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-sm text-gray-900">{item.patient_name}</p><p className="text-xs text-gray-500 mt-1">{item.reason || item.specialty || 'Entrada'}</p></div><span className={`text-[10px] rounded-full px-2 py-1 font-bold whitespace-nowrap ${STATUS_LABELS[item.status]?.cls || 'bg-gray-100 text-gray-700'}`}>{STATUS_LABELS[item.status]?.label || item.status}</span></div><p className="text-[11px] text-gray-400 mt-2">{formatDateTime(item.checked_in_at || item.created_at)}</p></button>
}

function Panel({ title, icon: Icon, children }: any) {
  return <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6"><div className="flex items-center gap-2 mb-4"><div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Icon className="w-5 h-5" /></div><h2 className="font-bold text-gray-900">{title}</h2></div>{children}</section>
}

function Info({ label, value }: any) {
  return <div className="rounded-2xl border bg-gray-50 p-3"><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-semibold text-gray-900 mt-1 break-words">{value || 'Não informado'}</p></div>
}

function ChecklistItem({ ok, label }: any) {
  return <div className={`rounded-2xl border p-3 flex gap-2 text-sm ${ok ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-amber-50 border-amber-100 text-amber-950'}`}>{ok ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}<span>{label}</span></div>
}

function Input({ label, value, onChange, placeholder, type = 'text' }: any) {
  return <div><label className="text-sm font-semibold text-gray-700 mb-1 block">{label}</label><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20" /></div>
}

function Check({ label, checked, onChange }: any) {
  return <label className="flex items-start gap-3"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" /><span>{label}</span></label>
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : ''
}

function formatDateTime(value: string) {
  return value ? new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
}
