'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  CalendarDays,
  Copy,
  CreditCard,
  FileText,
  Loader2,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Wallet,
} from 'lucide-react'

const intervalOptions = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'yearly', label: 'Anual' },
]

export default function PlanosPage() {
  const { user, session, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [chargingId, setChargingId] = useState<string | null>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [form, setForm] = useState({
    patient_id: '',
    patient_name: '',
    patient_email: '',
    patient_cpf: '',
    plan_name: 'Plano mensal de acompanhamento',
    description: 'Acompanhamento com retornos, mensagens, revisão de exames e orientações.',
    amount: '299',
    interval: 'monthly',
  })

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (professional) loadPlans()
  }, [professional])

  async function loadPlans() {
    if (!professional) return
    const { data, error } = await supabase
      .from('professional_patient_plans')
      .select('*')
      .eq('professional_id', professional.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      toast.error('Erro ao carregar planos. Rode SQL_NEXTGEN_PLANOS_PACIENTE_V1.sql.')
      return
    }

    setPlans(data || [])
  }

  async function createPlan() {
    if (!session?.access_token) {
      toast.error('Sessão expirada')
      return
    }

    if (!form.patient_name || !form.amount) {
      toast.error('Informe paciente e valor')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/billing/nextgen/create-patient-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(form),
      })

      const payload = await response.json()

      if (!response.ok) {
        toast.error(payload.error || 'Erro ao criar plano')
        return
      }

      toast.success(payload.payment_url || payload.pix_copy_paste ? 'Plano criado com Pix inicial' : 'Plano criado em rascunho')

      if (payload.payment_url || payload.pix_copy_paste) {
        await copyPlanMessage(form.patient_name, form.plan_name, form.amount, form.interval, payload.payment_url, payload.pix_copy_paste)
      }

      setForm({
        patient_id: '',
        patient_name: '',
        patient_email: '',
        patient_cpf: '',
        plan_name: 'Plano mensal de acompanhamento',
        description: 'Acompanhamento com retornos, mensagens, revisão de exames e orientações.',
        amount: '299',
        interval: 'monthly',
      })
      await loadPlans()
    } finally {
      setLoading(false)
    }
  }

  async function createPlanCharge(plan: any) {
    if (!session?.access_token) {
      toast.error('Sessão expirada')
      return
    }

    setChargingId(plan.id)

    try {
      const response = await fetch('/api/billing/nextgen/create-plan-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ patient_plan_id: plan.id }),
      })

      const payload = await response.json()

      if (!response.ok) {
        toast.error(payload.error || 'Erro ao gerar cobrança do plano')
        return
      }

      toast.success(payload.payment_url || payload.pix_copy_paste ? 'Cobrança Pix gerada' : 'Cobrança criada em rascunho')

      if (payload.payment_url || payload.pix_copy_paste) {
        await copyPlanMessage(plan.patient_name, plan.plan_name, String((plan.amount_cents || 0) / 100), plan.interval, payload.payment_url, payload.pix_copy_paste)
      }

      await loadPlans()
    } finally {
      setChargingId(null)
    }
  }

  async function copyPlanMessage(patientName: string, planName: string, amount: string, interval: string, paymentUrl?: string, pixCopyPaste?: string) {
    const message = `Olá, ${patientName || 'paciente'}. Segue o plano ${planName} do MyDataMed no valor de R$ ${amount}/${intervalLabel(interval).toLowerCase()}.\n${paymentUrl ? `Link de pagamento: ${paymentUrl}` : ''}\n${pixCopyPaste ? `Pix copia e cola: ${pixCopyPaste}` : ''}`
    try {
      await navigator.clipboard.writeText(message)
      toast.success('Mensagem do plano copiada')
    } catch {
      // não trava
    }
  }

  async function copy(value?: string) {
    if (!value) return
    await navigator.clipboard.writeText(value)
    toast.success('Copiado')
  }

  if (authLoading || !professional) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <header className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-7 md:p-10">
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1fr_0.9fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-indigo-100 mb-5">
              <Sparkles className="w-4 h-4" /> Powered by NextGen + SmartBots
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">Planos mensais de acompanhamento por paciente.</h1>
            <p className="text-white/70 mt-4 text-lg max-w-3xl">
              Crie planos para cuidado contínuo com cobrança inicial, CRM SmartBots, Staff administrativo, DocWallet e teleatendimento dentro do MyDataMed.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <Link href="/financeiro" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-3 font-semibold hover:bg-white/15">
                <Wallet className="w-5 h-5" /> Financeiro
              </Link>
              <Link href="/teleconsultas" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold hover:bg-emerald-600">
                <CalendarDays className="w-5 h-5" /> Teleconsultas
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 border border-white/10 p-4 backdrop-blur">
            <div className="rounded-2xl bg-white text-gray-900 p-5 shadow-2xl grid grid-cols-2 gap-3">
              <MiniMetric label="Planos" value={plans.length} />
              <MiniMetric label="Ativos" value={plans.filter((p) => p.status === 'active').length} />
              <MiniMetric label="Pendentes" value={plans.filter((p) => ['draft','pix_generated','waiting_payment'].includes(p.last_charge_status)).length} />
              <MiniMetric label="Pausados" value={plans.filter((p) => p.status === 'paused').length} />
            </div>
          </div>
        </div>
      </header>

      <section className="grid lg:grid-cols-[0.85fr_1.15fr] gap-5">
        <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center"><CreditCard className="w-5 h-5" /></div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Novo plano de acompanhamento</h2>
              <p className="text-sm text-gray-500">Plano mensal, recorrente ou pacote de cuidado contínuo.</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input label="Nome do paciente" value={form.patient_name} onChange={(v: string) => setForm({ ...form, patient_name: v })} />
            <Input label="E-mail do paciente" value={form.patient_email} onChange={(v: string) => setForm({ ...form, patient_email: v })} placeholder="opcional" />
            <Input label="CPF do paciente" value={form.patient_cpf} onChange={(v: string) => setForm({ ...form, patient_cpf: v })} placeholder="opcional" />
            <Input label="Patient ID HealthWallet" value={form.patient_id} onChange={(v: string) => setForm({ ...form, patient_id: v })} placeholder="opcional" />
            <Input label="Nome do plano" value={form.plan_name} onChange={(v: string) => setForm({ ...form, plan_name: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Valor R$" value={form.amount} onChange={(v: string) => setForm({ ...form, amount: v })} />
              <div>
                <label className="text-sm font-medium text-gray-700">Recorrência</label>
                <select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm">
                  {intervalOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
            </div>
            <Textarea label="Descrição" value={form.description} onChange={(v: string) => setForm({ ...form, description: v })} />
            <button onClick={createPlan} disabled={loading} className="w-full rounded-xl bg-indigo-700 text-white py-3 font-semibold hover:bg-indigo-800 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
              Criar plano e cobrança inicial
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <section className="grid md:grid-cols-4 gap-4">
            <PoweredCard icon={MessageCircle} title="SmartBots" text="Follow-up, retorno e lembretes." />
            <PoweredCard icon={CalendarDays} title="Staff" text="Agenda e apoio administrativo." />
            <PoweredCard icon={FileText} title="DocWallet" text="Documentos e arquivo do paciente." />
            <PoweredCard icon={Wallet} title="NextGen" text="Pix, cobrança inicial e recorrência." />
          </section>

          <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Planos recentes</h2>
                <p className="text-sm text-gray-500">Acompanhamento contínuo autorizado pelo profissional e paciente.</p>
              </div>
              <button onClick={loadPlans} className="rounded-xl border px-3 py-2 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Atualizar</button>
            </div>

            <div className="space-y-3">
              {plans.length === 0 && <Empty text="Nenhum plano criado ainda." />}
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-2xl border bg-gray-50 p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{plan.plan_name}</p>
                      <p className="text-sm text-gray-500">{plan.patient_name || 'Paciente'} • {formatMoney(plan.amount_cents)} • {intervalLabel(plan.interval)} • {plan.status}</p>
                      <p className="text-xs text-gray-500 mt-1">Próxima cobrança: {formatDate(plan.next_charge_at)} • Última: {plan.last_charge_status || 'sem cobrança'}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => createPlanCharge(plan)} disabled={chargingId === plan.id} className="rounded-xl bg-indigo-700 text-white px-3 py-2 text-sm font-semibold flex items-center gap-1 disabled:opacity-60">
                        {chargingId === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                        Cobrar agora
                      </button>
                      {plan.last_charge_id && <Link href="/financeiro" className="rounded-xl bg-emerald-600 text-white px-3 py-2 text-sm font-semibold">Ver financeiro</Link>}
                      <button onClick={() => copy(plan.id)} className="rounded-xl border px-3 py-2 text-sm flex items-center gap-1"><Copy className="w-4 h-4" /> ID</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

function MiniMetric({ label, value }: any) {
  return <div className="rounded-2xl bg-gray-50 border p-3"><p className="text-2xl font-bold text-indigo-700">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
}

function PoweredCard({ icon: Icon, title, text }: any) {
  return <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm"><Icon className="w-6 h-6 text-indigo-700 mb-3" /><p className="font-semibold text-gray-900">{title}</p><p className="text-xs text-gray-500 mt-1">{text}</p></div>
}

function Input({ label, value, onChange, placeholder = '' }: any) {
  return <div><label className="text-sm font-medium text-gray-700">{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm" /></div>
}

function Textarea({ label, value, onChange }: any) {
  return <div><label className="text-sm font-medium text-gray-700">{label}</label><textarea value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm min-h-[90px]" /></div>
}

function Empty({ text }: any) {
  return <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-gray-500">{text}</div>
}

function formatMoney(cents?: number) {
  return ((cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function intervalLabel(value: string) {
  const map: Record<string, string> = { weekly: 'Semanal', monthly: 'Mensal', quarterly: 'Trimestral', yearly: 'Anual' }
  return map[value] || value
}

function formatDate(value?: string) {
  if (!value) return 'não definida'
  return new Date(value).toLocaleDateString('pt-BR')
}
