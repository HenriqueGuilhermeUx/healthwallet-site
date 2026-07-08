'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  Bot,
  CalendarDays,
  CheckCircle,
  Copy,
  CreditCard,
  Gift,
  Loader2,
  QrCode,
  Shield,
  Sparkles,
  Video,
  Wallet,
} from 'lucide-react'

export default function ProPage() {
  const { user, session, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [startingTrial, setStartingTrial] = useState(false)
  const [creatingPix, setCreatingPix] = useState(false)
  const [subscription, setSubscription] = useState<any>(null)
  const [features, setFeatures] = useState<any[]>([])
  const [charges, setCharges] = useState<any[]>([])
  const [pix, setPix] = useState<any>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && professional) load()
  }, [user, professional])

  const planStatus = useMemo(() => {
    if (!subscription) return 'free'
    if (subscription.status === 'active') return 'active'
    if (subscription.status === 'trial') return 'trial'
    return subscription.status || 'free'
  }, [subscription])

  async function load() {
    if (!user) return
    setLoading(true)

    const [{ data: sub }, { data: feat }, { data: chargeRows }] = await Promise.all([
      supabase
        .from('professional_subscriptions')
        .select('*')
        .eq('professional_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('professional_feature_access')
        .select('*')
        .eq('professional_user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('professional_payment_charges')
        .select('*')
        .eq('professional_user_id', user.id)
        .eq('charge_type', 'subscription')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    setSubscription(sub || null)
    setFeatures(feat || [])
    setCharges(chargeRows || [])
    setLoading(false)
  }

  async function startTrial() {
    if (!session?.access_token) return
    setStartingTrial(true)

    const response = await fetch('/api/billing/start-trial', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    const payload = await response.json()

    if (!response.ok) {
      toast.error(payload.error || 'Erro ao ativar trial')
      setStartingTrial(false)
      return
    }

    toast.success('Trial Pro ativado por 15 dias')
    await load()
    setStartingTrial(false)
  }

  async function createPixCharge() {
    if (!session?.access_token) return
    setCreatingPix(true)
    setPix(null)

    const response = await fetch('/api/billing/woovi/create-pro-charge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    const payload = await response.json()

    if (!response.ok) {
      toast.error(payload.error || 'Erro ao gerar Pix')
      setCreatingPix(false)
      return
    }

    setPix(payload)
    toast.success('Pix Pro gerado')
    await load()
    setCreatingPix(false)
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Copiado')
    } catch {
      toast.error('Não consegui copiar automaticamente')
    }
  }

  if (authLoading || !professional || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="rounded-3xl bg-slate-950 text-white p-6 md:p-8 overflow-hidden relative">
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="relative grid md:grid-cols-[1fr_0.75fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-4">
              <Sparkles className="w-4 h-4" />
              MyDataMed Pro
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Área comercial profissional</h1>
            <p className="text-white/75 max-w-2xl">
              Teleconsulta, agenda, CRM SmartBots, pagamentos NextGen/Woovi, documentos profissionais e automações para pequenas clínicas e profissionais liberais.
            </p>
          </div>

          <div className="rounded-3xl bg-white text-gray-900 p-5">
            <p className="text-sm text-gray-500">Status atual</p>
            <p className="text-3xl font-bold mt-1">{translateStatus(planStatus)}</p>
            <p className="text-sm text-gray-500 mt-2">
              {subscription?.current_period_ends_at
                ? `Válido até ${new Date(subscription.current_period_ends_at).toLocaleDateString('pt-BR')}`
                : 'Acesso gratuito a dados de pacientes permanece ativo.'}
            </p>
          </div>
        </div>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <FeatureCard icon={Shield} title="Free sempre" text="Acesso gratuito aos dados autorizados por pacientes mediante cadastro profissional." active />
        <FeatureCard icon={Gift} title="15 dias livres" text="Teste teleconsulta, CRM, pagamentos e documentos sem cobrança inicial." active={planStatus === 'trial' || planStatus === 'active'} />
        <FeatureCard icon={CreditCard} title="R$ 79,90/mês" text="Pix Woovi para ativar/renovar o modo profissional Pro." active={planStatus === 'active'} />
      </section>

      <section className="grid lg:grid-cols-[1fr_0.9fr] gap-6">
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Ativar modo profissional</h2>
          <p className="text-gray-600">
            O acesso aos dados autorizados continua grátis. O Pro libera a área comercial: teleconsultas, CRM/Bots, pagamentos e documentos.
          </p>

          <div className="grid md:grid-cols-2 gap-3">
            <button
              onClick={startTrial}
              disabled={startingTrial || planStatus === 'trial' || planStatus === 'active'}
              className="rounded-2xl bg-emerald-600 text-white p-5 text-left disabled:opacity-50"
            >
              <Gift className="w-7 h-7 mb-3" />
              <p className="font-bold">Ativar 15 dias grátis</p>
              <p className="text-sm text-white/75 mt-1">Sem Pix agora. Libera os recursos comerciais em trial.</p>
            </button>

            <button
              onClick={createPixCharge}
              disabled={creatingPix}
              className="rounded-2xl bg-slate-950 text-white p-5 text-left disabled:opacity-50"
            >
              {creatingPix ? <Loader2 className="w-7 h-7 mb-3 animate-spin" /> : <Wallet className="w-7 h-7 mb-3" />}
              <p className="font-bold">Gerar Pix R$ 79,90</p>
              <p className="text-sm text-white/75 mt-1">Pagamento via Woovi. Webhook ativa o Pro por 30 dias.</p>
            </button>
          </div>

          {pix && (
            <div className="rounded-3xl bg-emerald-50 border border-emerald-200 p-5">
              <h3 className="font-bold text-emerald-950 flex items-center gap-2 mb-3">
                <QrCode className="w-5 h-5" />
                Pix gerado
              </h3>
              {pix.payment_url && (
                <a href={pix.payment_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white px-4 py-2 font-semibold mb-3">
                  Abrir pagamento Woovi
                </a>
              )}
              {pix.pix_copy_paste && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-emerald-900">Pix copia e cola</p>
                  <div className="rounded-xl bg-white border p-3 text-xs break-all text-emerald-900">{pix.pix_copy_paste}</div>
                  <button onClick={() => copy(pix.pix_copy_paste)} className="inline-flex items-center gap-2 rounded-xl bg-white border border-emerald-200 text-emerald-700 px-4 py-2 text-sm font-semibold">
                    <Copy className="w-4 h-4" />
                    Copiar Pix
                  </button>
                </div>
              )}
              {!pix.pix_copy_paste && !pix.payment_url && (
                <p className="text-sm text-emerald-800">Cobrança criada. Confira o painel da Woovi se o QR não aparecer.</p>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-3">Recursos Pro</h2>
            <div className="space-y-2">
              <FeatureLine icon={Video} text="Agenda e teleconsulta" />
              <FeatureLine icon={CalendarDays} text="Google Meet/Calendar em implantação" />
              <FeatureLine icon={Bot} text="SmartBots CRM e follow-up" />
              <FeatureLine icon={Wallet} text="NextGen/Woovi Pix e repasses" />
              <FeatureLine icon={CheckCircle} text="Documentos profissionais e assinatura" />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-3">Últimas cobranças</h2>
            {charges.length > 0 ? (
              <div className="space-y-2">
                {charges.map((charge) => (
                  <div key={charge.id} className="rounded-xl border bg-gray-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">R$ {(charge.amount_cents / 100).toFixed(2).replace('.', ',')}</span>
                      <span className="text-xs rounded-full bg-white border px-2 py-0.5">{charge.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{new Date(charge.created_at).toLocaleString('pt-BR')}</p>
                    {charge.pix_copy_paste && (
                      <button onClick={() => copy(charge.pix_copy_paste)} className="text-xs text-emerald-700 mt-2 inline-flex items-center gap-1">
                        <Copy className="w-3 h-3" /> Copiar Pix
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Nenhuma cobrança ainda.</p>
            )}
          </div>
        </aside>
      </section>

      <section className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900">
        <strong>Próxima evolução:</strong> quando o webhook da Woovi confirmar pagamento, o sistema muda seu plano para Pro ativo e libera os recursos comerciais por 30 dias.
      </section>
    </main>
  )
}

function FeatureCard({ icon: Icon, title, text, active }: any) {
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${active ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}>
      <Icon className={`w-7 h-7 mb-3 ${active ? 'text-emerald-700' : 'text-gray-500'}`} />
      <h3 className="font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{text}</p>
    </div>
  )
}

function FeatureLine({ icon: Icon, text }: any) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <Icon className="w-4 h-4 text-emerald-600" />
      <span>{text}</span>
    </div>
  )
}

function translateStatus(status: string) {
  const map: Record<string, string> = {
    free: 'Free',
    trial: 'Trial Pro',
    active: 'Pro ativo',
    past_due: 'Pagamento pendente',
    cancelled: 'Cancelado',
    blocked: 'Bloqueado',
  }

  return map[status] || status
}
