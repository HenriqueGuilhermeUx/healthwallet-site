'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
} from 'lucide-react'

const emptyForm = {
  patient_name: '',
  patient_cpf: '',
  patient_birth_date: '',
  patient_phone: '',
  patient_email: '',
  companion_name: '',
  companion_phone: '',
  reason: '',
  symptoms: '',
  current_medications: '',
  allergies: '',
  relevant_history: '',
  administrative_notes: '',
  health_plan_provider: '',
  health_plan_card_number: '',
  health_plan_type: '',
  plan_holder_name: '',
  plan_valid_until: '',
  consent_lgpd: false,
  consent_contact: false,
  consent_plan_data: false,
}

export default function PublicPreAtendimentoPage() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [link, setLink] = useState<any>(null)
  const [form, setForm] = useState<any>(emptyForm)

  useEffect(() => {
    const pathToken = window.location.pathname.split('/').filter(Boolean).pop() || ''
    setToken(pathToken)
  }, [])

  useEffect(() => {
    if (token) loadLink(token)
  }, [token])

  const missingPreview = useMemo(() => computeMissingFields(form, link), [form, link])

  async function loadLink(publicToken: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('patient_precheck_links')
      .select('id, professional_user_id, public_token, title, clinic_name, specialty, default_reason, landing_message, status, expires_at, max_submissions, submission_count, require_cpf, require_health_plan, allow_plan_data, allow_companion_data')
      .eq('public_token', publicToken)
      .maybeSingle()

    if (error || !data) {
      setLink(null)
      setLoading(false)
      return
    }

    setLink(data)
    setForm((current: any) => ({
      ...current,
      reason: current.reason || data.default_reason || '',
    }))

    try {
      await supabase.from('patient_precheck_events').insert({
        link_id: data.id,
        professional_user_id: data.professional_user_id,
        event_type: 'public_form_opened',
        description: 'Formulário público de pré-atendimento aberto.',
        metadata: { public_token: publicToken, user_agent: navigator.userAgent },
      })
    } catch {}

    setLoading(false)
  }

  function buildChecklist(payload: any, source = 'public_precheck') {
    const hasPlan = Boolean(payload.health_plan_provider || payload.health_plan_card_number)
    return {
      source,
      patient_identification: Boolean(payload.patient_name),
      contact_available: Boolean(payload.patient_phone || payload.patient_email),
      reason_registered: Boolean(payload.reason),
      symptoms_registered: Boolean(payload.symptoms),
      medications_declared: Boolean(payload.current_medications),
      allergies_declared: Boolean(payload.allergies),
      consent_registered: Boolean(payload.consent_lgpd),
      plan_informed: hasPlan,
      plan_card_available: hasPlan ? Boolean(payload.health_plan_card_number) : null,
      administrative_review: 'pending',
      pre_arrival_note: 'Dados preenchidos pelo paciente antes da chegada para conferência da recepção.',
    }
  }

  async function submitForm() {
    if (!link) return
    const missing = computeMissingFields(form, link)
    if (missing.length) {
      toast.error(`Preencha: ${missing.join(', ')}`)
      return
    }
    if (!form.consent_lgpd) {
      toast.error('Confirme o consentimento LGPD para enviar')
      return
    }

    setSubmitting(true)
    try {
      const payload = normalizePayload(form)
      const { data, error } = await supabase
        .from('patient_precheck_submissions')
        .insert({
          link_id: link.id,
          professional_user_id: link.professional_user_id,
          patient_name: payload.patient_name,
          patient_cpf: payload.patient_cpf,
          patient_birth_date: payload.patient_birth_date,
          patient_phone: payload.patient_phone,
          patient_email: payload.patient_email,
          companion_name: payload.companion_name,
          companion_phone: payload.companion_phone,
          specialty: link.specialty || null,
          reason: payload.reason,
          symptoms: payload.symptoms,
          current_medications: payload.current_medications,
          allergies: payload.allergies,
          relevant_history: payload.relevant_history,
          administrative_notes: payload.administrative_notes,
          health_plan_provider: payload.health_plan_provider,
          health_plan_card_number: payload.health_plan_card_number,
          health_plan_type: payload.health_plan_type,
          plan_holder_name: payload.plan_holder_name,
          plan_valid_until: payload.plan_valid_until,
          consent_lgpd: Boolean(payload.consent_lgpd),
          consent_contact: Boolean(payload.consent_contact),
          consent_plan_data: Boolean(payload.consent_plan_data),
          consent_text: 'Paciente preencheu pré-atendimento e autorizou uso dos dados para finalidade assistencial, administrativa e organização da chegada.',
          missing_fields: [],
          checklist: buildChecklist(payload),
          user_agent: navigator.userAgent,
          metadata: {
            source: 'public_pre_atendimento_page',
            public_token: link.public_token,
            clinic_name: link.clinic_name || null,
            title: link.title,
          },
        })
        .select('id')
        .single()

      if (error) throw error

      try {
        await supabase.from('patient_precheck_events').insert({
          link_id: link.id,
          submission_id: data?.id || null,
          professional_user_id: link.professional_user_id,
          event_type: 'public_form_submitted',
          description: 'Paciente enviou formulário público de pré-atendimento.',
          metadata: { public_token: link.public_token },
        })
      } catch {}

      setSubmitted(true)
      toast.success('Pré-atendimento enviado')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar pré-atendimento')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-9 h-9 animate-spin text-emerald-400" /></main>
  }

  if (!link) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <section className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-2xl">
          <AlertTriangle className="w-14 h-14 text-amber-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Link indisponível</h1>
          <p className="text-gray-600 mt-2">Este formulário pode estar fechado, expirado ou ter atingido o limite de envios.</p>
        </section>
      </main>
    )
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-blue-950 px-4 py-10 flex items-center justify-center">
        <section className="max-w-xl rounded-[2rem] bg-white p-8 text-center shadow-2xl">
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Pré-atendimento enviado</h1>
          <p className="text-gray-600 mt-3">Seus dados foram enviados para a equipe conferir antes do atendimento. Na chegada, avise que você já preencheu o pré-atendimento.</p>
          <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-900">
            O envio não substitui consulta, avaliação ou conduta profissional. A equipe poderá solicitar confirmação de dados e documentos.
          </div>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-white font-semibold hover:bg-slate-800">
            Voltar <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-950 px-4 py-8">
      <section className="max-w-4xl mx-auto space-y-5">
        <header className="rounded-[2rem] bg-white/10 border border-white/10 p-6 md:p-8 text-white shadow-xl backdrop-blur">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5">
            <Sparkles className="w-4 h-4" /> MyDataMed • Pré-atendimento
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">{link.title || 'Pré-atendimento'}</h1>
          <p className="text-white/75 mt-4 text-lg max-w-3xl">{link.landing_message || 'Preencha seus dados antes da chegada para agilizar o atendimento.'}</p>
          <div className="grid md:grid-cols-3 gap-3 mt-6 text-sm">
            <Info icon={Stethoscope} label="Serviço" value={link.specialty || 'Atendimento'} />
            <Info icon={HeartPulse} label="Unidade" value={link.clinic_name || 'MyDataMed'} />
            <Info icon={ShieldCheck} label="Dados" value="Consentimento obrigatório" />
          </div>
        </header>

        <section className="rounded-[2rem] bg-white p-5 md:p-7 shadow-2xl space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><User className="w-5 h-5 text-emerald-700" /> Seus dados</h2>
            <p className="text-sm text-gray-600 mt-1">Preencha o mínimo necessário para a equipe preparar sua chegada.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Nome completo *" value={form.patient_name} onChange={(v: string) => setForm({ ...form, patient_name: v })} />
            <Field label={`CPF${link.require_cpf ? ' *' : ''}`} value={form.patient_cpf} onChange={(v: string) => setForm({ ...form, patient_cpf: v })} />
            <Field label="Data de nascimento" type="date" value={form.patient_birth_date} onChange={(v: string) => setForm({ ...form, patient_birth_date: v })} />
            <Field label="Telefone/WhatsApp *" value={form.patient_phone} onChange={(v: string) => setForm({ ...form, patient_phone: v })} />
            <Field label="E-mail" type="email" value={form.patient_email} onChange={(v: string) => setForm({ ...form, patient_email: v })} />
            {link.allow_companion_data !== false && <Field label="Nome do acompanhante/responsável" value={form.companion_name} onChange={(v: string) => setForm({ ...form, companion_name: v })} />}
            {link.allow_companion_data !== false && <Field label="Telefone do acompanhante" value={form.companion_phone} onChange={(v: string) => setForm({ ...form, companion_phone: v })} />}
          </div>

          <div className="grid gap-3">
            <Field label="Motivo do atendimento *" value={form.reason} onChange={(v: string) => setForm({ ...form, reason: v })} placeholder="Consulta, retorno, exame, avaliação, procedimento..." />
            <Area label="Sintomas, queixa ou relato principal" value={form.symptoms} onChange={(v: string) => setForm({ ...form, symptoms: v })} />
            <Area label="Medicamentos em uso" value={form.current_medications} onChange={(v: string) => setForm({ ...form, current_medications: v })} />
            <Area label="Alergias" value={form.allergies} onChange={(v: string) => setForm({ ...form, allergies: v })} />
            <Area label="Histórico relevante ou observações" value={form.relevant_history} onChange={(v: string) => setForm({ ...form, relevant_history: v })} />
          </div>

          {link.allow_plan_data !== false && (
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4 space-y-3">
              <h2 className="font-bold text-blue-950 flex items-center gap-2"><FileText className="w-5 h-5" /> Plano/carteirinha quando aplicável</h2>
              <div className="grid md:grid-cols-2 gap-3">
                <Field label={`Operadora${link.require_health_plan ? ' *' : ''}`} value={form.health_plan_provider} onChange={(v: string) => setForm({ ...form, health_plan_provider: v })} />
                <Field label={`Número da carteirinha${link.require_health_plan ? ' *' : ''}`} value={form.health_plan_card_number} onChange={(v: string) => setForm({ ...form, health_plan_card_number: v })} />
                <Field label="Tipo/plano" value={form.health_plan_type} onChange={(v: string) => setForm({ ...form, health_plan_type: v })} />
                <Field label="Nome do titular" value={form.plan_holder_name} onChange={(v: string) => setForm({ ...form, plan_holder_name: v })} />
                <Field label="Validade" type="date" value={form.plan_valid_until} onChange={(v: string) => setForm({ ...form, plan_valid_until: v })} />
              </div>
              <Check label="Autorizo o uso dos dados de plano/carteirinha para conferência administrativa do atendimento." checked={form.consent_plan_data} onChange={(v: boolean) => setForm({ ...form, consent_plan_data: v })} />
            </div>
          )}

          <Area label="Observações administrativas" value={form.administrative_notes} onChange={(v: string) => setForm({ ...form, administrative_notes: v })} placeholder="Ex: horário de chegada, documentos, preferências de contato, necessidades de acessibilidade." />

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 space-y-3 text-sm text-amber-950">
            <h2 className="font-bold flex items-center gap-2"><Lock className="w-5 h-5" /> Consentimentos</h2>
            <Check label="Autorizo o uso dos dados informados para organização da chegada, finalidade assistencial e administrativa." checked={form.consent_lgpd} onChange={(v: boolean) => setForm({ ...form, consent_lgpd: v })} />
            <Check label="Autorizo contato por telefone, WhatsApp ou e-mail para confirmação do atendimento." checked={form.consent_contact} onChange={(v: boolean) => setForm({ ...form, consent_contact: v })} />
          </div>

          {missingPreview.length > 0 && (
            <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-800">
              <strong>Antes de enviar, preencha:</strong> {missingPreview.join(', ')}
            </div>
          )}

          <button onClick={submitForm} disabled={submitting || missingPreview.length > 0} className="w-full rounded-2xl bg-emerald-700 text-white py-4 font-bold disabled:opacity-50 hover:bg-emerald-800 flex items-center justify-center gap-2">
            {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</> : <><ClipboardCheck className="w-5 h-5" /> Enviar pré-atendimento</>}
          </button>

          <p className="text-center text-xs text-gray-500">O formulário agiliza a chegada, mas a equipe poderá confirmar dados e solicitar documentos no atendimento.</p>
        </section>
      </section>
    </main>
  )
}

function computeMissingFields(payload: any, link: any) {
  const missing: string[] = []
  if (!payload.patient_name?.trim()) missing.push('nome completo')
  if (link?.require_cpf && !onlyDigits(payload.patient_cpf)) missing.push('CPF')
  if (!payload.patient_phone?.trim() && !payload.patient_email?.trim()) missing.push('telefone ou e-mail')
  if (!payload.reason?.trim()) missing.push('motivo do atendimento')
  if (link?.require_health_plan) {
    if (!payload.health_plan_provider?.trim()) missing.push('operadora')
    if (!payload.health_plan_card_number?.trim()) missing.push('número da carteirinha')
  }
  if (!payload.consent_lgpd) missing.push('consentimento LGPD')
  return missing
}

function normalizePayload(payload: any) {
  return {
    ...payload,
    patient_cpf: onlyDigits(payload.patient_cpf) || null,
    patient_birth_date: payload.patient_birth_date || null,
    patient_phone: payload.patient_phone || null,
    patient_email: payload.patient_email || null,
    companion_name: payload.companion_name || null,
    companion_phone: payload.companion_phone || null,
    plan_valid_until: payload.plan_valid_until || null,
    health_plan_provider: payload.health_plan_provider || null,
    health_plan_card_number: payload.health_plan_card_number || null,
    health_plan_type: payload.health_plan_type || null,
    plan_holder_name: payload.plan_holder_name || null,
  }
}

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function Info({ icon: Icon, label, value }: any) {
  return <div className="rounded-2xl bg-white/10 border border-white/10 p-3"><Icon className="w-5 h-5 text-emerald-200 mb-2" /><p className="text-xs text-white/55">{label}</p><p className="font-semibold">{value}</p></div>
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }: any) {
  return <label className="block"><span className="text-sm font-semibold text-gray-700 mb-1 block">{label}</span><input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" /></label>
}

function Area({ label, value, onChange, placeholder = '' }: any) {
  return <label className="block"><span className="text-sm font-semibold text-gray-700 mb-1 block">{label}</span><textarea value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full min-h-[90px] rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" /></label>
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-start gap-2"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" /><span>{label}</span></label>
}
