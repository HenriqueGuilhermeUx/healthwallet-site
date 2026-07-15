'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ArrowRight,
  Bot,
  Brain,
  CalendarDays,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'

const scopeOptions = [
  ['summary', 'Resumo'],
  ['exams', 'Exames'],
  ['medications', 'Medicamentos'],
  ['timeline', 'Timeline'],
  ['passport', 'Passport'],
  ['medscore', 'MedScore'],
  ['documents', 'Documentos'],
  ['family', 'Família/dependentes'],
]

export default function MeusPacientesPage() {
  const { user, session, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [links, setLinks] = useState<any[]>([])
  const [form, setForm] = useState({
    patient_id: '',
    patient_name: '',
    patient_email: '',
    duration_days: '365',
    continuous: false,
    request_note: 'Solicito vínculo assistencial contínuo para acompanhar dados autorizados, retornos, exames e orientações.',
    scope: {
      summary: true,
      exams: true,
      medications: true,
      timeline: true,
      passport: true,
      medscore: true,
      documents: true,
      family: false,
    } as any,
  })

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (professional) loadLinks()
  }, [professional])

  async function loadLinks() {
    if (!professional) return
    setLoading(true)
    const { data, error } = await supabase
      .from('professional_care_links')
      .select('*')
      .eq('professional_id', professional.id)
      .order('created_at', { ascending: false })
      .limit(80)

    if (error) {
      toast.error('Erro ao carregar vínculos. Rode SQL_VINCULO_ASSISTENCIAL_V1.sql.')
      setLoading(false)
      return
    }

    setLinks(data || [])
    setLoading(false)
  }

  async function requestLink() {
    if (!session?.access_token) {
      toast.error('Sessão expirada')
      return
    }

    if (!form.patient_id && !form.patient_email) {
      toast.error('Informe Patient ID ou e-mail do paciente')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/care-links/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          patient_id: form.patient_id || null,
          patient_email: form.patient_email || null,
          patient_name: form.patient_name || null,
          duration_days: Number(form.duration_days || 365),
          continuous: form.continuous,
          scope: form.scope,
          request_note: form.request_note,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        toast.error(payload.error || 'Erro ao solicitar vínculo')
        return
      }

      toast.success('Solicitação de vínculo criada')
      setForm({
        patient_id: '',
        patient_name: '',
        patient_email: '',
        duration_days: '365',
        continuous: false,
        request_note: 'Solicito vínculo assistencial contínuo para acompanhar dados autorizados, retornos, exames e orientações.',
        scope: {
          summary: true,
          exams: true,
          medications: true,
          timeline: true,
          passport: true,
          medscore: true,
          documents: true,
          family: false,
        },
      })
      await loadLinks()
    } finally {
      setSubmitting(false)
    }
  }

  async function cancelRequest(item: any) {
    if (!confirm('Cancelar/revogar este vínculo?')) return
    const { error } = await supabase
      .from('professional_care_links')
      .update({ status: 'cancelled', revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', item.id)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Vínculo cancelado')
    loadLinks()
  }

  const stats = useMemo(() => ({
    total: links.length,
    active: links.filter((l) => l.status === 'active').length,
    pending: links.filter((l) => l.status === 'pending').length,
    revoked: links.filter((l) => ['revoked', 'cancelled', 'rejected'].includes(l.status)).length,
  }), [links])

  if (authLoading || !professional) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <header className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-7 md:p-10">
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1fr_0.9fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5">
              <ShieldCheck className="w-4 h-4" /> Vínculo assistencial permanente
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">Meus pacientes acompanhados.</h1>
            <p className="text-white/70 mt-4 text-lg max-w-3xl">
              Solicite acompanhamento contínuo autorizado para ver histórico, exames, medicamentos, timeline, Passport, IA, CRM, agenda, documentos e planos em um só lugar.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <Link href="/copiloto" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold hover:bg-emerald-600"><Brain className="w-5 h-5" /> Copiloto IA</Link>
              <Link href="/planos" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-3 font-semibold hover:bg-white/15"><Wallet className="w-5 h-5" /> Planos</Link>
            </div>
          </div>
          <div className="rounded-3xl bg-white/10 border border-white/10 p-4 backdrop-blur">
            <div className="rounded-2xl bg-white text-gray-900 p-5 shadow-2xl grid grid-cols-2 gap-3">
              <MiniMetric label="Total" value={stats.total} />
              <MiniMetric label="Ativos" value={stats.active} />
              <MiniMetric label="Pendentes" value={stats.pending} />
              <MiniMetric label="Encerrados" value={stats.revoked} />
            </div>
          </div>
        </div>
      </header>

      <section className="grid lg:grid-cols-[0.85fr_1.15fr] gap-5">
        <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><UserPlus className="w-5 h-5" /></div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Solicitar vínculo</h2>
              <p className="text-sm text-gray-500">O paciente aprova no HealthWallet e pode revogar depois.</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input label="Patient ID HealthWallet" value={form.patient_id} onChange={(v: string) => setForm({ ...form, patient_id: v })} placeholder="opcional se usar e-mail" />
            <Input label="Nome do paciente" value={form.patient_name} onChange={(v: string) => setForm({ ...form, patient_name: v })} />
            <Input label="E-mail do paciente" value={form.patient_email} onChange={(v: string) => setForm({ ...form, patient_email: v })} placeholder="opcional se usar Patient ID" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Prazo</label>
                <select value={form.duration_days} disabled={form.continuous} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm disabled:opacity-50">
                  <option value="30">30 dias</option>
                  <option value="90">90 dias</option>
                  <option value="180">180 dias</option>
                  <option value="365">1 ano</option>
                </select>
              </div>
              <label className="mt-6 flex items-center gap-2 rounded-xl border px-3 py-3 text-sm text-gray-700">
                <input type="checkbox" checked={form.continuous} onChange={(e) => setForm({ ...form, continuous: e.target.checked })} /> Contínuo
              </label>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Escopo solicitado</p>
              <div className="grid grid-cols-2 gap-2">
                {scopeOptions.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                    <input type="checkbox" checked={Boolean(form.scope[key])} onChange={(e) => setForm({ ...form, scope: { ...form.scope, [key]: e.target.checked } })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <Textarea label="Mensagem ao paciente" value={form.request_note} onChange={(v: string) => setForm({ ...form, request_note: v })} />
            <button onClick={requestLink} disabled={submitting} className="w-full rounded-xl bg-emerald-600 text-white py-3 font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
              Solicitar vínculo assistencial
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <section className="grid md:grid-cols-4 gap-4">
            <PoweredCard icon={Brain} title="IA" text="Resumo e pré-consulta recorrente." />
            <PoweredCard icon={MessageCircle} title="SmartBots" text="Follow-up, lembrete e retorno." />
            <PoweredCard icon={CalendarDays} title="Staff" text="Agenda e apoio administrativo." />
            <PoweredCard icon={FileText} title="DocWallet" text="Documentos por paciente." />
          </section>

          <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Vínculos recentes</h2>
                <p className="text-sm text-gray-500">Pacientes acompanhados de forma contínua e autorizada.</p>
              </div>
              <button onClick={loadLinks} className="rounded-xl border px-3 py-2 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Atualizar</button>
            </div>

            {loading ? <div className="py-8 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div> : (
              <div className="space-y-3">
                {links.length === 0 && <Empty text="Nenhum vínculo assistencial criado ainda." />}
                {links.map((item) => (
                  <div key={item.id} className="rounded-2xl border bg-gray-50 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-900">{item.patient_name || item.patient_email || `Paciente ${String(item.patient_id || '').slice(0, 8)}`}</p>
                          <StatusBadge status={item.status} />
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{item.patient_email || 'Sem e-mail'} • {item.continuous ? 'Contínuo' : expiresText(item.expires_at, item.duration_days)}</p>
                        <p className="text-xs text-gray-500 mt-1">Escopo: {scopeLabel(item.scope || item.requested_scope)}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {item.patient_id && <Link href={`/copiloto?patient=${item.patient_id}`} className="rounded-xl bg-violet-700 text-white px-3 py-2 text-sm font-semibold">Copiloto</Link>}
                        {item.patient_id && <Link href={`/patient/by-patient/${item.patient_id}`} className="rounded-xl bg-emerald-600 text-white px-3 py-2 text-sm font-semibold">Dados</Link>}
                        {item.patient_id && <Link href={`/planos?patient=${item.patient_id}`} className="rounded-xl border px-3 py-2 text-sm font-semibold">Plano</Link>}
                        {['pending', 'active'].includes(item.status) && <button onClick={() => cancelRequest(item)} className="rounded-xl border border-red-200 text-red-600 px-3 py-2 text-sm font-semibold"><XCircle className="w-4 h-4 inline mr-1" />Encerrar</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  )
}

function MiniMetric({ label, value }: any) {
  return <div className="rounded-2xl bg-gray-50 border p-3"><p className="text-2xl font-bold text-emerald-700">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
}

function PoweredCard({ icon: Icon, title, text }: any) {
  return <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm"><Icon className="w-6 h-6 text-emerald-700 mb-3" /><p className="font-semibold text-gray-900">{title}</p><p className="text-xs text-gray-500 mt-1">{text}</p></div>
}

function Input({ label, value, onChange, placeholder = '' }: any) {
  return <div><label className="text-sm font-medium text-gray-700">{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm" /></div>
}

function Textarea({ label, value, onChange }: any) {
  return <div><label className="text-sm font-medium text-gray-700">{label}</label><textarea value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm min-h-[92px]" /></div>
}

function Empty({ text }: any) {
  return <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-gray-500">{text}</div>
}

function StatusBadge({ status }: any) {
  const cls = status === 'active' ? 'bg-emerald-100 text-emerald-700' : status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
  const label: Record<string, string> = { active: 'Ativo', pending: 'Pendente', rejected: 'Recusado', revoked: 'Revogado', expired: 'Expirado', cancelled: 'Cancelado' }
  return <span className={`text-xs rounded-full px-2 py-0.5 ${cls}`}>{label[status] || status}</span>
}

function expiresText(expiresAt?: string, days?: number) {
  if (expiresAt) return `até ${new Date(expiresAt).toLocaleDateString('pt-BR')}`
  return `${days || 365} dias após aprovação`
}

function scopeLabel(scope: any) {
  const labels: Record<string, string> = { summary: 'resumo', exams: 'exames', medications: 'medicamentos', timeline: 'timeline', passport: 'passport', medscore: 'medscore', documents: 'docs', family: 'família' }
  return Object.keys(scope || {}).filter((key) => scope[key]).map((key) => labels[key] || key).join(', ') || 'não definido'
}
