'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle,
  Copy,
  CreditCard,
  FileText,
  Loader2,
  MessageCircle,
  ReceiptText,
  RefreshCw,
  Sparkles,
  Users,
  Video,
  Wallet,
} from 'lucide-react'

const chargeTypes = [
  { value: 'teleconsultation', label: 'Teleconsulta', title: 'Teleconsulta MyDataMed', amount: '150' },
  { value: 'consultation', label: 'Consulta avulsa', title: 'Consulta profissional', amount: '200' },
  { value: 'monthly_plan', label: 'Plano mensal', title: 'Plano mensal de acompanhamento', amount: '299' },
  { value: 'recurring_plan', label: 'Plano recorrente', title: 'Acompanhamento recorrente', amount: '399' },
  { value: 'custom', label: 'Cobrança livre', title: 'Cobrança profissional', amount: '100' },
]

export default function FinanceiroPage() {
  const { user, session, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [charges, setCharges] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [form, setForm] = useState({
    charge_type: 'teleconsultation',
    title: 'Teleconsulta MyDataMed',
    amount: '150',
    patient_name: '',
    patient_email: '',
    description: '',
    recurrence_interval: 'monthly',
  })

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (professional) loadFinance()
  }, [professional])

  async function loadFinance() {
    if (!professional) return
    const [chargesRes, plansRes] = await Promise.allSettled([
      supabase.from('professional_payment_charges').select('*').eq('professional_id', professional.id).order('created_at', { ascending: false }).limit(12),
      supabase.from('professional_billing_plans').select('*').eq('professional_id', professional.id).order('created_at', { ascending: false }).limit(8),
    ])

    if (chargesRes.status === 'fulfilled') setCharges(chargesRes.value.data || [])
    if (plansRes.status === 'fulfilled') setPlans(plansRes.value.data || [])
  }

  function selectType(value: string) {
    const type = chargeTypes.find((item) => item.value === value) || chargeTypes[0]
    setForm({ ...form, charge_type: value, title: type.title, amount: type.amount })
  }

  async function createCharge() {
    if (!session?.access_token) {
      toast.error('Sessão expirada')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/billing/nextgen/create-charge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      })

      const payload = await response.json()

      if (!response.ok) {
        toast.error(payload.error || 'Erro ao criar cobrança')
        return
      }

      toast.success(payload.payment_url || payload.pix_copy_paste ? 'Cobrança Pix criada' : 'Cobrança criada como rascunho')
      await loadFinance()
    } finally {
      setLoading(false)
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
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1fr_0.9fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5">
              <Sparkles className="w-4 h-4" /> Powered by NextGen
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">Central financeira para teleconsultas, planos e recorrência.</h1>
            <p className="text-white/70 mt-4 text-lg max-w-3xl">
              Crie cobranças Pix, organize planos mensais, acompanhe status e conecte a receita do profissional com agenda, teleconsulta, CRM SmartBots, Staff e documentos.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <Link href="/teleconsultas" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-3 font-semibold hover:bg-white/15">
                <Video className="w-5 h-5" /> Teleconsultas
              </Link>
              <Link href="/copiloto" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold hover:bg-emerald-600">
                <Bot className="w-5 h-5" /> Copiloto IA
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 border border-white/10 p-4 backdrop-blur">
            <div className="rounded-2xl bg-white text-gray-900 p-5 shadow-2xl grid grid-cols-2 gap-3">
              <MiniMetric label="Cobranças" value={charges.length} />
              <MiniMetric label="Planos" value={plans.length} />
              <MiniMetric label="Geradas" value={charges.filter((c) => ['pix_generated', 'waiting_payment'].includes(c.status)).length} />
              <MiniMetric label="Pagas" value={charges.filter((c) => c.status === 'paid').length} />
            </div>
          </div>
        </div>
      </header>

      <section className="grid lg:grid-cols-[0.85fr_1.15fr] gap-5">
        <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><ReceiptText className="w-5 h-5" /></div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Nova cobrança NextGen</h2>
              <p className="text-sm text-gray-500">Teleconsulta, consulta, plano mensal ou cobrança livre.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Tipo</label>
              <select value={form.charge_type} onChange={(e) => selectType(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm">
                {chargeTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <Input label="Título" value={form.title} onChange={(v: string) => setForm({ ...form, title: v })} />
            <Input label="Valor (R$)" value={form.amount} onChange={(v: string) => setForm({ ...form, amount: v })} />
            <Input label="Paciente / cliente" value={form.patient_name} onChange={(v: string) => setForm({ ...form, patient_name: v })} placeholder="Opcional" />
            <Input label="E-mail para cobrança" value={form.patient_email} onChange={(v: string) => setForm({ ...form, patient_email: v })} placeholder="Opcional" />
            {['monthly_plan', 'recurring_plan', 'subscription'].includes(form.charge_type) && (
              <div>
                <label className="text-sm font-medium text-gray-700">Recorrência</label>
                <select value={form.recurrence_interval} onChange={(e) => setForm({ ...form, recurrence_interval: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm">
                  <option value="monthly">Mensal</option>
                  <option value="weekly">Semanal</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
            )}
            <Textarea label="Descrição" value={form.description} onChange={(v: string) => setForm({ ...form, description: v })} placeholder="Ex: teleconsulta de retorno, plano de acompanhamento, pacote mensal..." />
            <button onClick={createCharge} disabled={loading} className="w-full rounded-xl bg-emerald-600 text-white py-3 font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
              Criar cobrança
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <section className="grid md:grid-cols-4 gap-4">
            <PoweredCard icon={MessageCircle} title="SmartBots" text="Lembretes, cobrança amigável e follow-up." />
            <PoweredCard icon={CalendarDays} title="Staff" text="Agenda, confirmação e apoio administrativo." />
            <PoweredCard icon={FileText} title="DocWallet" text="Documentos, recibos, termos e arquivo." />
            <PoweredCard icon={CreditCard} title="NextGen" text="Pix, planos mensais, recorrência e repasse." />
          </section>

          <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Cobranças recentes</h2>
                <p className="text-sm text-gray-500">Criadas por MyDataMed / NextGen.</p>
              </div>
              <button onClick={loadFinance} className="rounded-xl border px-3 py-2 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Atualizar</button>
            </div>

            <div className="space-y-3">
              {charges.length === 0 && <Empty text="Nenhuma cobrança criada ainda." />}
              {charges.map((charge) => (
                <div key={charge.id} className="rounded-2xl border bg-gray-50 p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{charge.title || charge.charge_type || 'Cobrança'}</p>
                      <p className="text-sm text-gray-500">{formatMoney(charge.amount_cents)} • {statusLabel(charge.status)} • {charge.provider || 'nextgen'}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {charge.payment_url && <a href={charge.payment_url} target="_blank" className="rounded-xl bg-emerald-600 text-white px-3 py-2 text-sm font-semibold">Abrir Pix</a>}
                      {charge.pix_copy_paste && <button onClick={() => copy(charge.pix_copy_paste)} className="rounded-xl border px-3 py-2 text-sm flex items-center gap-1"><Copy className="w-4 h-4" /> Copiar Pix</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="rounded-3xl bg-slate-950 text-white p-6 md:p-8">
        <div className="grid md:grid-cols-[1fr_0.9fr] gap-8 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Onde isso encaixa no MyDataMed?</h2>
            <p className="text-white/70 mt-3">
              O profissional pode cobrar teleconsulta, consulta avulsa, acompanhamento mensal ou planos recorrentes. SmartBots lembra e acompanha, Staff ajuda na agenda e administração, DocWallet guarda documentos e NextGen organiza cobrança e Pix.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Check text="Cobranças para teleconsulta" />
            <Check text="Planos mensais de acompanhamento" />
            <Check text="Cobrança recorrente por programa" />
            <Check text="Base para clínicas, equipes e prefeituras" />
          </div>
        </div>
      </section>
    </main>
  )
}

function MiniMetric({ label, value }: any) {
  return <div className="rounded-2xl bg-gray-50 border p-3"><p className="text-2xl font-bold text-emerald-700">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
}

function PoweredCard({ icon: Icon, title, text }: any) {
  return <div className="rounded-3xl bg-white border border-gray-100 p-5 shadow-sm"><Icon className="w-7 h-7 text-emerald-600 mb-3" /><p className="font-bold text-gray-900">Powered by {title}</p><p className="text-sm text-gray-500 mt-2">{text}</p></div>
}

function Input({ label, value, onChange, placeholder = '' }: any) {
  return <div><label className="text-sm font-medium text-gray-700">{label}</label><input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm" /></div>
}

function Textarea({ label, value, onChange, placeholder = '' }: any) {
  return <div><label className="text-sm font-medium text-gray-700">{label}</label><textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm min-h-[90px]" /></div>
}

function Empty({ text }: any) {
  return <p className="text-sm text-gray-500 rounded-2xl border border-dashed p-4">{text}</p>
}

function Check({ text }: any) {
  return <div className="rounded-2xl bg-white/10 border border-white/10 p-3 text-sm text-white/80 flex gap-2"><CheckCircle className="w-4 h-4 text-emerald-300 mt-0.5 flex-shrink-0" /><span>{text}</span></div>
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft: 'rascunho',
    pix_generated: 'Pix gerado',
    waiting_payment: 'aguardando pagamento',
    paid: 'pago',
    cancelled: 'cancelado',
  }
  return map[status] || status || 'rascunho'
}
