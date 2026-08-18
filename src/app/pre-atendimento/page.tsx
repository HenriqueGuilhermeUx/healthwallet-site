'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ArrowRight,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Copy,
  FileText,
  Link as LinkIcon,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserPlus,
  Users,
} from 'lucide-react'

const emptyLinkForm = {
  title: 'Pré-atendimento',
  clinic_name: '',
  specialty: '',
  default_reason: '',
  landing_message: 'Preencha seus dados antes da chegada para agilizar o atendimento.',
  require_cpf: false,
  require_health_plan: false,
  expires_at: '',
  max_submissions: '',
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  open: { label: 'Aberto', cls: 'bg-emerald-100 text-emerald-700' },
  paused: { label: 'Pausado', cls: 'bg-amber-100 text-amber-700' },
  closed: { label: 'Fechado', cls: 'bg-slate-100 text-slate-700' },
  expired: { label: 'Expirado', cls: 'bg-red-100 text-red-700' },
}

export default function PreAtendimentoPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState<string | null>(null)
  const [links, setLinks] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>(emptyLinkForm)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && professional) loadData()
  }, [user, professional])

  const stats = useMemo(() => ({
    linksOpen: links.filter((item) => item.status === 'open').length,
    submissionsNew: submissions.filter((item) => item.status === 'new').length,
    converted: submissions.filter((item) => item.status === 'converted').length,
  }), [links, submissions])

  async function loadData() {
    if (!user) return
    setLoading(true)
    try {
      const [linksRes, submissionsRes] = await Promise.all([
        supabase
          .from('patient_precheck_links')
          .select('*')
          .eq('professional_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('patient_precheck_submissions')
          .select('*, patient_precheck_links(title, public_token)')
          .eq('professional_user_id', user.id)
          .order('submitted_at', { ascending: false })
          .limit(100),
      ])

      if (linksRes.error || submissionsRes.error) {
        toast.error('Rode SQL_PRE_ATENDIMENTO_V1.sql no Supabase para ativar o Pré-atendimento.')
      }

      setLinks(linksRes.data || [])
      setSubmissions(submissionsRes.data || [])
    } catch {
      toast.error('Erro ao carregar pré-atendimentos')
    } finally {
      setLoading(false)
    }
  }

  function generateToken() {
    const bytes = new Uint8Array(18)
    crypto.getRandomValues(bytes)
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  function publicUrl(token: string) {
    const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://mydatamed.com')
    return `${base.replace(/\/$/, '')}/pre-atendimento/${token}`
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value)
    toast.success('Link copiado')
  }

  async function createLink() {
    if (!user || !professional) return
    if (!form.title.trim()) {
      toast.error('Informe um título para o link')
      return
    }

    setSaving(true)
    try {
      const token = generateToken()
      const payload = {
        professional_id: professional.id,
        professional_user_id: user.id,
        public_token: token,
        title: form.title,
        clinic_name: form.clinic_name || professional.professional_context?.clinic_name || null,
        specialty: form.specialty || professional.specialty || null,
        default_reason: form.default_reason || null,
        landing_message: form.landing_message || null,
        require_cpf: Boolean(form.require_cpf),
        require_health_plan: Boolean(form.require_health_plan),
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        max_submissions: form.max_submissions ? Number(form.max_submissions) : null,
        metadata: {
          created_from: 'pre_atendimento_workspace',
          goal: 'coletar_dados_antes_da_chegada_e_reduzir_retrabalho',
        },
      }

      const { data, error } = await supabase
        .from('patient_precheck_links')
        .insert(payload)
        .select('*')
        .single()

      if (error) throw error

      await supabase.from('patient_precheck_events').insert({
        link_id: data.id,
        professional_user_id: user.id,
        actor_user_id: user.id,
        event_type: 'link_created',
        description: 'Link de pré-atendimento criado pelo profissional.',
        metadata: { public_token: data.public_token },
      })

      toast.success('Link criado')
      setForm(emptyLinkForm)
      setShowForm(false)
      loadData()
      copy(publicUrl(data.public_token))
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar link')
    } finally {
      setSaving(false)
    }
  }

  async function updateLinkStatus(link: any, status: string) {
    if (!user) return
    const { error } = await supabase
      .from('patient_precheck_links')
      .update({ status })
      .eq('id', link.id)
      .eq('professional_user_id', user.id)

    if (error) {
      toast.error('Erro ao atualizar link')
      return
    }
    await supabase.from('patient_precheck_events').insert({
      link_id: link.id,
      professional_user_id: user.id,
      actor_user_id: user.id,
      event_type: 'link_status_changed',
      description: `Status do link alterado para ${status}.`,
      metadata: { from: link.status, to: status },
    })
    loadData()
  }

  function computeMissingFields(submission: any) {
    const missing: string[] = []
    if (!submission.patient_name) missing.push('Nome do paciente')
    if (!submission.patient_phone && !submission.patient_email) missing.push('Contato do paciente')
    if (!submission.reason) missing.push('Motivo do atendimento')
    if (!submission.consent_lgpd) missing.push('Consentimento LGPD')
    if (submission.health_plan_provider && !submission.health_plan_card_number) missing.push('Número da carteirinha')
    return missing
  }

  function buildChecklist(submission: any) {
    const hasPlan = Boolean(submission.health_plan_provider || submission.health_plan_card_number)
    return {
      source: 'pre_atendimento_publico',
      patient_identification: Boolean(submission.patient_name),
      contact_available: Boolean(submission.patient_phone || submission.patient_email),
      reason_registered: Boolean(submission.reason),
      symptoms_registered: Boolean(submission.symptoms),
      medications_declared: Boolean(submission.current_medications),
      allergies_declared: Boolean(submission.allergies),
      consent_registered: Boolean(submission.consent_lgpd),
      plan_informed: hasPlan,
      plan_card_available: hasPlan ? Boolean(submission.health_plan_card_number) : null,
      administrative_review: 'pending',
      glosa_prevention_note: hasPlan
        ? 'Dados de plano/carteirinha enviados pelo paciente para conferência administrativa antes do atendimento/faturamento.'
        : 'Paciente não informou plano/carteirinha. Confirmar forma de atendimento/cobertura quando aplicável.',
    }
  }

  async function convertToIntake(submission: any) {
    if (!user || !professional) return
    setConverting(submission.id)
    try {
      let guestPatientId = null
      try {
        const { data: guest } = await supabase
          .from('guest_patients')
          .insert({
            professional_id: professional.id,
            professional_user_id: user.id,
            name: submission.patient_name,
            email: submission.patient_email || null,
            phone: submission.patient_phone || null,
            metadata: {
              created_from: 'pre_atendimento',
              precheck_submission_id: submission.id,
              cpf: onlyDigits(submission.patient_cpf || '') || null,
            },
          })
          .select('*')
          .single()
        guestPatientId = guest?.id || null
      } catch {
        guestPatientId = null
      }

      const missingFields = computeMissingFields(submission)
      const checklist = buildChecklist(submission)
      const { data: intake, error } = await supabase
        .from('patient_intakes')
        .insert({
          professional_id: professional.id,
          professional_user_id: user.id,
          clinic_name: submission.patient_precheck_links?.title || null,
          source: 'import',
          status: missingFields.length ? 'waiting' : 'ready',
          guest_patient_id: guestPatientId,
          patient_name: submission.patient_name,
          patient_cpf: onlyDigits(submission.patient_cpf || '') || null,
          patient_birth_date: submission.patient_birth_date || null,
          patient_phone: submission.patient_phone || null,
          patient_email: submission.patient_email || null,
          specialty: submission.specialty || professional.specialty || 'Atendimento',
          reason: submission.reason || 'Pré-atendimento enviado pelo paciente',
          health_plan_provider: submission.health_plan_provider || null,
          health_plan_card_number: submission.health_plan_card_number || null,
          health_plan_type: submission.health_plan_type || null,
          plan_holder_name: submission.plan_holder_name || null,
          plan_valid_until: submission.plan_valid_until || null,
          plan_payload: submission.plan_payload || {},
          intake_notes: [
            submission.symptoms ? `Sintomas/relato: ${submission.symptoms}` : '',
            submission.current_medications ? `Medicamentos: ${submission.current_medications}` : '',
            submission.allergies ? `Alergias: ${submission.allergies}` : '',
            submission.relevant_history ? `Histórico: ${submission.relevant_history}` : '',
            submission.administrative_notes ? `Obs. administrativas: ${submission.administrative_notes}` : '',
          ].filter(Boolean).join('\n\n'),
          patient_data_consent: Boolean(submission.consent_lgpd),
          plan_data_consent: Boolean(submission.consent_plan_data),
          lgpd_consent: Boolean(submission.consent_lgpd),
          data_scope: 'precheck_only',
          missing_fields: missingFields,
          checklist,
          consent_text: submission.consent_text || 'Paciente preencheu formulário de pré-atendimento e autorizou uso dos dados para finalidade assistencial/administrativa.',
          consented_at: submission.submitted_at || new Date().toISOString(),
          metadata: {
            created_from: 'pre_atendimento_submission',
            precheck_submission_id: submission.id,
            precheck_link_id: submission.link_id,
            companion: {
              name: submission.companion_name || null,
              phone: submission.companion_phone || null,
            },
          },
        })
        .select('*')
        .single()

      if (error) throw error

      await supabase
        .from('patient_precheck_submissions')
        .update({ status: 'converted', converted_at: new Date().toISOString(), converted_intake_id: intake.id })
        .eq('id', submission.id)
        .eq('professional_user_id', user.id)

      await supabase.from('patient_precheck_events').insert({
        link_id: submission.link_id,
        submission_id: submission.id,
        professional_user_id: user.id,
        actor_user_id: user.id,
        event_type: 'submission_converted_to_intake',
        description: 'Pré-atendimento convertido em Entrada do Paciente.',
        metadata: { intake_id: intake.id },
      })

      toast.success('Pré-atendimento convertido em Entrada do Paciente')
      loadData()
      router.push('/entrada-paciente')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao converter pré-atendimento')
    } finally {
      setConverting(null)
    }
  }

  if (authLoading || !professional) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-950 text-white p-6 md:p-9">
        <div className="absolute -right-14 -top-20 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5">
              <Sparkles className="w-4 h-4" /> Pré-atendimento Inteligente
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">O atendimento começa antes da chegada.</h1>
            <p className="text-white/70 mt-4 text-lg max-w-3xl">
              Envie um link para o paciente preencher dados, motivo, plano/carteirinha e consentimentos. A recepção só confere e converte em Entrada do Paciente.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <button onClick={() => setShowForm(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold hover:bg-emerald-600">
                <Plus className="w-5 h-5" /> Criar link
              </button>
              <Link href="/entrada-paciente" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-3 font-semibold hover:bg-white/15">
                <ClipboardCheck className="w-5 h-5" /> Entrada do Paciente
              </Link>
              <Link href="/consulta-assistida" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-3 font-semibold hover:bg-white/15">
                <Stethoscope className="w-5 h-5" /> Consulta Assistida
              </Link>
            </div>
          </div>
          <div className="rounded-3xl bg-white/10 border border-white/10 p-4 backdrop-blur">
            <div className="rounded-2xl bg-white text-gray-900 p-5 shadow-2xl grid grid-cols-3 gap-3">
              <MiniStat label="Links abertos" value={stats.linksOpen} />
              <MiniStat label="Novos envios" value={stats.submissionsNew} />
              <MiniStat label="Convertidos" value={stats.converted} />
            </div>
          </div>
        </div>
      </section>

      {showForm && (
        <section className="bg-white rounded-3xl border border-gray-100 shadow-lg p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Criar link de pré-atendimento</h2>
              <p className="text-sm text-gray-600 mt-1">Use em WhatsApp, e-mail, QR Code na recepção ou mensagem de confirmação de agenda.</p>
            </div>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-900">Fechar</button>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Título" value={form.title} onChange={(v: string) => setForm({ ...form, title: v })} />
            <Field label="Clínica/unidade" value={form.clinic_name} onChange={(v: string) => setForm({ ...form, clinic_name: v })} placeholder="Opcional" />
            <Field label="Especialidade/serviço" value={form.specialty} onChange={(v: string) => setForm({ ...form, specialty: v })} placeholder={professional.specialty || 'Atendimento'} />
            <Field label="Motivo padrão" value={form.default_reason} onChange={(v: string) => setForm({ ...form, default_reason: v })} placeholder="Consulta, retorno, triagem..." />
            <Field label="Expira em" type="datetime-local" value={form.expires_at} onChange={(v: string) => setForm({ ...form, expires_at: v })} />
            <Field label="Limite de envios" type="number" value={form.max_submissions} onChange={(v: string) => setForm({ ...form, max_submissions: v })} placeholder="Sem limite" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1 block">Mensagem para o paciente</label>
            <textarea value={form.landing_message} onChange={(e) => setForm({ ...form, landing_message: e.target.value })} className="w-full min-h-[80px] rounded-2xl border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" />
          </div>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <Check label="Exigir CPF" checked={form.require_cpf} onChange={(v: boolean) => setForm({ ...form, require_cpf: v })} />
            <Check label="Exigir dados de plano/carteirinha" checked={form.require_health_plan} onChange={(v: boolean) => setForm({ ...form, require_health_plan: v })} />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border font-semibold">Cancelar</button>
            <button onClick={createLink} disabled={saving} className="flex-1 py-3 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-60">
              {saving ? 'Criando...' : 'Criar e copiar link'}
            </button>
          </div>
        </section>
      )}

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2"><LinkIcon className="w-5 h-5 text-emerald-700" /> Links criados</h2>
            <button onClick={loadData} className="text-sm text-emerald-700 font-semibold inline-flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Atualizar</button>
          </div>
          {loading ? <Loading /> : links.length ? (
            <div className="space-y-3">
              {links.map((link) => <LinkCard key={link.id} link={link} url={publicUrl(link.public_token)} onCopy={copy} onStatus={updateLinkStatus} />)}
            </div>
          ) : (
            <Empty title="Nenhum link ainda" text="Crie um link e envie ao paciente antes da consulta." />
          )}
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><ClipboardList className="w-5 h-5 text-blue-700" /> Envios recebidos</h2>
          {loading ? <Loading /> : submissions.length ? (
            <div className="space-y-3">
              {submissions.map((submission) => <SubmissionCard key={submission.id} item={submission} converting={converting === submission.id} onConvert={convertToIntake} />)}
            </div>
          ) : (
            <Empty title="Nenhum envio recebido" text="Quando o paciente preencher o formulário, ele aparecerá aqui para conferência da recepção." />
          )}
        </div>
      </section>
    </main>
  )
}

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-gray-50 border p-3 text-center"><p className="text-2xl font-bold text-emerald-700">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }: any) {
  return <label className="block"><span className="text-sm font-semibold text-gray-700 mb-1 block">{label}</span><input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" /></label>
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-start gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-3"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" /><span>{label}</span></label>
}

function LinkCard({ link, url, onCopy, onStatus }: any) {
  const badge = STATUS_LABELS[link.status] || STATUS_LABELS.open
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div><p className="font-bold text-gray-900">{link.title}</p><p className="text-xs text-gray-500 break-all mt-1">{url}</p></div>
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
        <span>Envios: {link.submission_count || 0}</span>
        <span>{link.specialty || 'Sem especialidade'}</span>
        <span>{link.expires_at ? `Expira ${new Date(link.expires_at).toLocaleDateString('pt-BR')}` : 'Sem expiração'}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onCopy(url)} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 text-white px-3 py-2 text-sm font-semibold"><Copy className="w-4 h-4" /> Copiar</button>
        {link.status === 'open' ? <button onClick={() => onStatus(link, 'paused')} className="rounded-xl border px-3 py-2 text-sm font-semibold">Pausar</button> : <button onClick={() => onStatus(link, 'open')} className="rounded-xl border px-3 py-2 text-sm font-semibold">Reabrir</button>}
        <button onClick={() => onStatus(link, 'closed')} className="rounded-xl border px-3 py-2 text-sm font-semibold text-red-700">Fechar</button>
      </div>
    </div>
  )
}

function SubmissionCard({ item, converting, onConvert }: any) {
  const status = item.status === 'converted' ? 'Convertido' : item.status === 'reviewed' ? 'Revisado' : 'Novo'
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <p className="font-bold text-gray-900">{item.patient_name}</p>
          <p className="text-xs text-gray-500">{item.patient_phone || item.patient_email || 'Contato não informado'} • {new Date(item.submitted_at || item.created_at).toLocaleString('pt-BR')}</p>
          <p className="text-sm text-gray-700 mt-2"><strong>Motivo:</strong> {item.reason || 'Não informado'}</p>
          {item.symptoms && <p className="text-sm text-gray-700 mt-1"><strong>Relato:</strong> {item.symptoms}</p>}
          {(item.health_plan_provider || item.health_plan_card_number) && <p className="text-sm text-blue-800 mt-2"><strong>Plano:</strong> {[item.health_plan_provider, item.health_plan_card_number].filter(Boolean).join(' • ')}</p>}
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <span className="rounded-full bg-white border px-3 py-1 text-xs font-semibold text-gray-700">{status}</span>
          {item.status !== 'converted' ? (
            <button onClick={() => onConvert(item)} disabled={converting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60">
              {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Converter em entrada
            </button>
          ) : (
            <Link href="/entrada-paciente" className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold">Ver entrada</Link>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {item.consent_lgpd && <Tag icon={ShieldCheck} text="LGPD autorizado" />}
        {item.current_medications && <Tag icon={FileText} text="Medicamentos informados" />}
        {item.allergies && <Tag icon={CheckCircle} text="Alergias informadas" />}
      </div>
    </div>
  )
}

function Tag({ icon: Icon, text }: any) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-white border px-2 py-1 text-gray-600"><Icon className="w-3 h-3" /> {text}</span>
}

function Loading() {
  return <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center"><Users className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="font-bold text-gray-900">{title}</p><p className="text-sm text-gray-500 mt-1">{text}</p></div>
}
