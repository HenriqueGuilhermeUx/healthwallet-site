'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowRight, Banknote, CalendarDays, CheckCircle, CreditCard, Loader2, PackagePlus, Plus, Receipt, RefreshCw, Save, WalletCards } from 'lucide-react'

const planMeta: Record<string, any> = {
  free: { label: 'Free Dados', price: 'R$ 0', visits: 0 },
  start: { label: 'Start', price: 'R$ 129', visits: 100 },
  pro: { label: 'Pro', price: 'R$ 199', visits: 200 },
  clinic: { label: 'Clinic', price: 'R$ 399', visits: 400 },
}

const emptyService = { name: '', description: '', service_type: 'consultation', duration_minutes: 50, price_cents: 0, sessions_included: 1, is_public: true }
const emptyEntry = { entry_type: 'receivable', description: '', category: '', amount_cents: 0, due_date: '', patient_name: '', patient_email: '', patient_phone: '', payment_method: 'not_defined' }

export default function BackofficePage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<any>(null)
  const [services, setServices] = useState<any[]>([])
  const [entries, setEntries] = useState<any[]>([])
  const [serviceForm, setServiceForm] = useState<any>(emptyService)
  const [entryForm, setEntryForm] = useState<any>(emptyEntry)
  const [savingService, setSavingService] = useState(false)
  const [savingEntry, setSavingEntry] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && professional) loadData()
  }, [user, professional])

  const totals = useMemo(() => {
    const receivable = entries.filter((e) => e.entry_type === 'receivable' && e.status !== 'cancelled').reduce((sum, e) => sum + Number(e.amount_cents || 0), 0)
    const payable = entries.filter((e) => e.entry_type === 'payable' && e.status !== 'cancelled').reduce((sum, e) => sum + Number(e.amount_cents || 0), 0)
    const paid = entries.filter((e) => e.status === 'paid' && e.entry_type === 'receivable').reduce((sum, e) => sum + Number(e.amount_cents || 0), 0)
    return { receivable, payable, paid, balance: receivable - payable }
  }, [entries])

  async function loadData() {
    if (!user) return
    setLoading(true)
    try {
      const [subRes, servicesRes, entriesRes] = await Promise.all([
        supabase.from('professional_commercial_subscriptions').select('*').eq('professional_user_id', user.id).maybeSingle(),
        supabase.from('professional_services').select('*').eq('professional_user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('professional_financial_entries').select('*').eq('professional_user_id', user.id).order('created_at', { ascending: false }).limit(100),
      ])

      if (subRes.error || servicesRes.error || entriesRes.error) {
        toast.error('Rode SQL_MYDATAMED_COMMERCE_BACKOFFICE_V1.sql no Supabase para ativar o Backoffice.')
      }

      setSubscription(subRes.data || null)
      setServices(servicesRes.data || [])
      setEntries(entriesRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  async function bootstrapPlan(planCode = 'start') {
    if (!user || !professional) return
    const meta = planMeta[planCode]
    const { error } = await supabase.from('professional_commercial_subscriptions').upsert({
      professional_id: professional.id,
      professional_user_id: user.id,
      plan_code: planCode,
      status: 'trial',
      included_assisted_visits: meta.visits,
      used_assisted_visits: 0,
      included_modo_credits: planCode === 'pro' ? 500 : planCode === 'clinic' ? 1200 : 0,
      used_modo_credits: 0,
      metadata: { created_from: 'backoffice_bootstrap' },
    }, { onConflict: 'professional_user_id' })
    if (error) toast.error(error.message)
    else { toast.success('Plano inicial configurado'); loadData() }
  }

  async function createService() {
    if (!user || !professional || !serviceForm.name.trim()) return toast.error('Informe o nome do serviço')
    setSavingService(true)
    try {
      const { error } = await supabase.from('professional_services').insert({
        professional_id: professional.id,
        professional_user_id: user.id,
        ...serviceForm,
        price_cents: Number(serviceForm.price_cents || 0),
        duration_minutes: Number(serviceForm.duration_minutes || 0) || null,
        sessions_included: Number(serviceForm.sessions_included || 1),
        metadata: { created_from: 'backoffice' },
      })
      if (error) throw error
      toast.success('Serviço/pacote criado')
      setServiceForm(emptyService)
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar serviço')
    } finally {
      setSavingService(false)
    }
  }

  async function createEntry() {
    if (!user || !professional || !entryForm.description.trim()) return toast.error('Informe a descrição')
    setSavingEntry(true)
    try {
      const { error } = await supabase.from('professional_financial_entries').insert({
        professional_id: professional.id,
        professional_user_id: user.id,
        ...entryForm,
        amount_cents: Number(entryForm.amount_cents || 0),
        due_date: entryForm.due_date || null,
        metadata: { created_from: 'backoffice', visible_provider_name: 'pagamento_integrado_ou_direto' },
      })
      if (error) throw error
      toast.success('Lançamento financeiro criado')
      setEntryForm(emptyEntry)
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar lançamento')
    } finally {
      setSavingEntry(false)
    }
  }

  async function markPaid(entry: any) {
    const { error } = await supabase.from('professional_financial_entries').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', entry.id).eq('professional_user_id', user?.id)
    if (error) toast.error('Erro ao marcar como pago')
    else loadData()
  }

  if (authLoading || !professional || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  const plan = subscription ? planMeta[subscription.plan_code] || planMeta.free : null
  const used = Number(subscription?.used_assisted_visits || 0)
  const included = Number(subscription?.included_assisted_visits || plan?.visits || 0)
  const usagePercent = included ? Math.min(100, Math.round((used / included) * 100)) : 0

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <section className="rounded-[2rem] bg-slate-950 text-white p-6 md:p-9 grid lg:grid-cols-[1fr_0.9fr] gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5"><WalletCards className="w-4 h-4" /> Backoffice MyDataMed</div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">Agenda, serviços, pacotes, cobrança e financeiro em um só lugar.</h1>
          <p className="text-white/70 mt-4 text-lg">Este é o esqueleto operacional do consultório digital. As integrações de pagamento, CRM e tarefas rodam nos bastidores; para o cliente, aparece apenas operação simples.</p>
        </div>
        <div className="rounded-3xl bg-white text-gray-900 p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs text-gray-500">Plano atual</p>
              <h2 className="text-2xl font-bold">{plan?.label || 'Não configurado'}</h2>
            </div>
            <Link href="/planos" className="text-sm font-semibold text-emerald-700">Ver planos</Link>
          </div>
          {subscription ? (
            <>
              <p className="text-sm text-gray-600">{used} de {included} atendimentos assistidos usados neste ciclo.</p>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden mt-3"><div className="h-full bg-emerald-600" style={{ width: `${usagePercent}%` }} /></div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Configure um plano inicial para controlar volume.</p>
              <div className="flex flex-wrap gap-2">
                {['start', 'pro', 'clinic'].map((code) => <button key={code} onClick={() => bootstrapPlan(code)} className="rounded-xl border px-3 py-2 text-sm font-semibold">{planMeta[code].label}</button>)}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-4">
        <Metric title="A receber" value={formatMoney(totals.receivable)} icon={CreditCard} />
        <Metric title="A pagar" value={formatMoney(totals.payable)} icon={Banknote} />
        <Metric title="Recebido" value={formatMoney(totals.paid)} icon={CheckCircle} />
        <Metric title="Saldo previsto" value={formatMoney(totals.balance)} icon={WalletCards} />
      </section>

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
        <Card title="Criar serviço ou pacote" icon={PackagePlus}>
          <div className="grid gap-3">
            <Field label="Nome" value={serviceForm.name} onChange={(v: string) => setServiceForm({ ...serviceForm, name: v })} placeholder="Consulta, retorno, pacote 4 sessões..." />
            <Area label="Descrição" value={serviceForm.description} onChange={(v: string) => setServiceForm({ ...serviceForm, description: v })} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Preço em centavos" type="number" value={serviceForm.price_cents} onChange={(v: string) => setServiceForm({ ...serviceForm, price_cents: v })} />
              <Field label="Minutos" type="number" value={serviceForm.duration_minutes} onChange={(v: string) => setServiceForm({ ...serviceForm, duration_minutes: v })} />
              <Field label="Sessões" type="number" value={serviceForm.sessions_included} onChange={(v: string) => setServiceForm({ ...serviceForm, sessions_included: v })} />
            </div>
            <button onClick={createService} disabled={savingService} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white px-4 py-3 font-semibold disabled:opacity-60"><Save className="w-4 h-4" /> Criar serviço</button>
          </div>
        </Card>

        <Card title="Serviços e pacotes" icon={CalendarDays}>
          {services.length ? <div className="space-y-3">{services.map((service) => <ServiceRow key={service.id} service={service} />)}</div> : <Empty text="Nenhum serviço criado ainda." />}
        </Card>
      </section>

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
        <Card title="Novo lançamento financeiro" icon={Plus}>
          <div className="grid gap-3">
            <select value={entryForm.entry_type} onChange={(e) => setEntryForm({ ...entryForm, entry_type: e.target.value })} className="rounded-xl border px-3 py-3"><option value="receivable">Conta a receber</option><option value="payable">Conta a pagar</option></select>
            <Field label="Descrição" value={entryForm.description} onChange={(v: string) => setEntryForm({ ...entryForm, description: v })} />
            <div className="grid grid-cols-2 gap-3"><Field label="Valor em centavos" type="number" value={entryForm.amount_cents} onChange={(v: string) => setEntryForm({ ...entryForm, amount_cents: v })} /><Field label="Vencimento" type="date" value={entryForm.due_date} onChange={(v: string) => setEntryForm({ ...entryForm, due_date: v })} /></div>
            <Field label="Paciente/fornecedor" value={entryForm.patient_name} onChange={(v: string) => setEntryForm({ ...entryForm, patient_name: v })} />
            <div className="grid grid-cols-2 gap-3"><Field label="E-mail" value={entryForm.patient_email} onChange={(v: string) => setEntryForm({ ...entryForm, patient_email: v })} /><Field label="Telefone" value={entryForm.patient_phone} onChange={(v: string) => setEntryForm({ ...entryForm, patient_phone: v })} /></div>
            <select value={entryForm.payment_method} onChange={(e) => setEntryForm({ ...entryForm, payment_method: e.target.value })} className="rounded-xl border px-3 py-3"><option value="not_defined">Forma não definida</option><option value="platform_pix">Pix pela plataforma</option><option value="direct_pix">Pix direto</option><option value="cash">Dinheiro</option><option value="card">Cartão</option><option value="bank_transfer">Transferência</option><option value="other">Outro</option></select>
            <button onClick={createEntry} disabled={savingEntry} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 text-white px-4 py-3 font-semibold disabled:opacity-60"><Save className="w-4 h-4" /> Criar lançamento</button>
          </div>
        </Card>

        <Card title="Fluxo financeiro" icon={RefreshCw}>
          {entries.length ? <div className="space-y-3">{entries.map((entry) => <EntryRow key={entry.id} entry={entry} onPaid={markPaid} />)}</div> : <Empty text="Nenhum lançamento ainda." />}
        </Card>
      </section>
    </main>
  )
}

function formatMoney(cents: number) { return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function Metric({ title, value, icon: Icon }: any) { return <div className="rounded-3xl bg-white border border-gray-100 p-5 shadow-sm"><Icon className="w-6 h-6 text-emerald-700 mb-3" /><p className="text-sm text-gray-500">{title}</p><p className="text-2xl font-bold text-gray-900">{value}</p></div> }
function Card({ title, icon: Icon, children }: any) { return <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5"><h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><Icon className="w-5 h-5 text-emerald-700" /> {title}</h2>{children}</section> }
function Field({ label, value, onChange, type = 'text', placeholder = '' }: any) { return <label className="block"><span className="text-sm font-semibold text-gray-700 mb-1 block">{label}</span><input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" /></label> }
function Area({ label, value, onChange }: any) { return <label className="block"><span className="text-sm font-semibold text-gray-700 mb-1 block">{label}</span><textarea value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full min-h-[90px] rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" /></label> }
function Empty({ text }: any) { return <div className="rounded-2xl border border-dashed p-8 text-center text-gray-500">{text}</div> }
function ServiceRow({ service }: any) { return <div className="rounded-2xl border bg-gray-50 p-4"><p className="font-bold text-gray-900">{service.name}</p><p className="text-sm text-gray-600 mt-1">{service.description || 'Sem descrição'}</p><p className="text-sm font-semibold text-emerald-700 mt-2">{formatMoney(service.price_cents)} • {service.sessions_included || 1} sessão(ões)</p></div> }
function EntryRow({ entry, onPaid }: any) {
  const isPaidReceivable = entry.status === 'paid' && entry.entry_type === 'receivable'
  return (
    <div className="rounded-2xl border bg-gray-50 p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div>
        <p className="font-bold text-gray-900">{entry.description}</p>
        <p className="text-sm text-gray-600">{entry.entry_type === 'receivable' ? 'A receber' : 'A pagar'} • {entry.status}</p>
        {entry.patient_name && <p className="text-xs text-gray-500 mt-1">{entry.patient_name}</p>}
        <p className="text-sm font-semibold text-emerald-700 mt-1">{formatMoney(entry.amount_cents)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {entry.status !== 'paid' && <button onClick={() => onPaid(entry)} className="rounded-xl bg-emerald-600 text-white px-3 py-2 text-sm font-semibold">Pago</button>}
        {isPaidReceivable && <Link href={`/recibos/${entry.id}`} className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm font-semibold"><Receipt className="w-4 h-4" /> Recibo</Link>}
      </div>
    </div>
  )
}
