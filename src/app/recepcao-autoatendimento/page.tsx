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
  Clock,
  Copy,
  Loader2,
  MonitorSmartphone,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  waiting: { label: 'Aguardando conferência', cls: 'bg-amber-100 text-amber-800' },
  triage: { label: 'Em triagem', cls: 'bg-blue-100 text-blue-800' },
  ready: { label: 'Pronto para atendimento', cls: 'bg-emerald-100 text-emerald-800' },
  in_care: { label: 'Em atendimento', cls: 'bg-violet-100 text-violet-800' },
  completed: { label: 'Concluído', cls: 'bg-gray-900 text-white' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-100 text-red-800' },
}

export default function RecepcaoAutoatendimentoPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [link, setLink] = useState<any>(null)
  const [queue, setQueue] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && professional) loadReception()
  }, [user, professional])

  useEffect(() => {
    if (!user || !professional) return
    const timer = setInterval(() => loadQueueOnly(), 15000)
    return () => clearInterval(timer)
  }, [user, professional])

  const url = link ? publicUrl(link.public_token) : ''
  const qrUrl = url ? `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=16&data=${encodeURIComponent(url)}` : ''

  const stats = useMemo(() => ({
    total: queue.length,
    waiting: queue.filter((item) => item.status === 'waiting').length,
    ready: queue.filter((item) => item.status === 'ready').length,
    inCare: queue.filter((item) => item.status === 'in_care').length,
  }), [queue])

  function publicUrl(token: string) {
    const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://mydatamed.com')
    return `${base.replace(/\/$/, '')}/pre-atendimento/${token}`
  }

  function generateToken() {
    const bytes = new Uint8Array(18)
    crypto.getRandomValues(bytes)
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  async function loadReception() {
    if (!user) return
    setLoading(true)
    await Promise.all([loadLink(), loadQueueOnly()])
    setLoading(false)
  }

  async function loadQueueOnly() {
    if (!user) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('patient_intakes')
      .select('*')
      .eq('professional_user_id', user.id)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
      .limit(40)
    setQueue(data || [])
  }

  async function loadLink() {
    if (!user) return
    const { data } = await supabase
      .from('patient_precheck_links')
      .select('*')
      .eq('professional_user_id', user.id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(30)

    const selfServiceLink = (data || []).find((item: any) => item.metadata?.purpose === 'reception_self_checkin') || null
    setLink(selfServiceLink)
  }

  async function createReceptionLink() {
    if (!user || !professional) return
    setCreating(true)
    try {
      const token = generateToken()
      const { data, error } = await supabase
        .from('patient_precheck_links')
        .insert({
          professional_id: professional.id,
          professional_user_id: user.id,
          public_token: token,
          title: 'Check-in de Recepção',
          clinic_name: professional.professional_context?.clinic_name || professional.full_name || 'MyDataMed',
          specialty: professional.specialty || 'Atendimento',
          default_reason: '',
          landing_message: 'Faça seu check-in pelo celular. Preencha seus dados e aguarde ser chamado pela equipe.',
          status: 'open',
          require_cpf: false,
          require_health_plan: false,
          allow_plan_data: true,
          allow_companion_data: true,
          metadata: {
            purpose: 'reception_self_checkin',
            created_from: 'recepcao_autoatendimento',
            goal: 'paciente_preenche_sozinho_e_recepcao_apenas_confere',
          },
        })
        .select('*')
        .single()

      if (error) throw error
      setLink(data)
      toast.success('QR Code de recepção criado')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar QR Code')
    } finally {
      setCreating(false)
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value)
    toast.success('Link copiado')
  }

  if (authLoading || !professional || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-3">
              <Sparkles className="w-4 h-4" /> Recepção Autoatendimento
            </div>
            <h1 className="text-3xl md:text-5xl font-bold">O paciente faz o check-in sozinho.</h1>
            <p className="text-white/65 mt-3 max-w-3xl">Deixe esta tela aberta na recepção. O paciente escaneia o QR Code, preenche no celular e entra automaticamente na fila. A equipe só confere pendências e exceções.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={loadReception} className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/10 px-4 py-3 font-semibold hover:bg-white/15">
              <RefreshCw className="w-5 h-5" /> Atualizar
            </button>
            <Link href="/entrada-paciente" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-400">
              Ver fila completa <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </header>

        <section className="grid lg:grid-cols-[0.85fr_1.15fr] gap-6 items-stretch">
          <div className="rounded-[2rem] bg-white text-slate-950 p-6 shadow-2xl flex flex-col items-center text-center">
            {link ? (
              <>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 mb-4">
                  <QrCode className="w-4 h-4" /> QR Code ativo
                </div>
                <img src={qrUrl} alt="QR Code de autoatendimento" className="w-full max-w-[360px] rounded-3xl border border-gray-100 shadow-sm" />
                <h2 className="text-2xl font-bold mt-5">Faça seu check-in</h2>
                <p className="text-gray-600 mt-2">Aponte a câmera do celular para o QR Code e preencha seus dados.</p>
                <div className="mt-4 w-full rounded-2xl bg-gray-50 border border-gray-100 p-3 text-xs break-all text-gray-500">{url}</div>
                <button onClick={() => copy(url)} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 font-semibold hover:bg-gray-50">
                  <Copy className="w-4 h-4" /> Copiar link
                </button>
              </>
            ) : (
              <div className="py-16">
                <MonitorSmartphone className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold">Crie o QR Code da recepção</h2>
                <p className="text-gray-600 mt-2 max-w-sm">Este QR fica na tela do balcão ou em um tablet/totem para o paciente fazer tudo sozinho.</p>
                <button onClick={createReceptionLink} disabled={creating} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />} Gerar QR da recepção
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-4 gap-3">
              <Stat label="Entradas hoje" value={stats.total} />
              <Stat label="Aguardando" value={stats.waiting} />
              <Stat label="Prontos" value={stats.ready} />
              <Stat label="Em atendimento" value={stats.inCare} />
            </div>

            <div className="rounded-[2rem] bg-white/8 border border-white/10 p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5 text-emerald-300" /> Fila recebida</h2>
                  <p className="text-sm text-white/55">Atualiza automaticamente a cada 15 segundos.</p>
                </div>
                <Link href="/pre-atendimento" className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 hover:underline">Links e envios <ArrowRight className="w-4 h-4" /></Link>
              </div>

              {queue.length ? (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {queue.map((item) => <QueueItem key={item.id} item={item} />)}
                </div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
                  <Smartphone className="w-12 h-12 text-white/25 mx-auto mb-3" />
                  <p className="font-bold">Nenhum check-in ainda</p>
                  <p className="text-sm text-white/50 mt-1">Quando o paciente escanear o QR e enviar, ele aparece aqui.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-3 text-sm text-white/70">
          <InfoBox icon={Smartphone} title="Paciente preenche" text="Nome, contato, motivo, plano/carteirinha, consentimentos e observações pelo próprio celular." />
          <InfoBox icon={ClipboardCheck} title="Recepção confere" text="A equipe acompanha a fila, valida exceções e não precisa começar tudo do zero." />
          <InfoBox icon={ShieldCheck} title="Atendimento começa melhor" text="Dados mínimos, checklist e trilha de auditoria seguem para a Entrada do Paciente e Consulta Assistida." />
        </section>
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/10 border border-white/10 p-4"><p className="text-sm text-white/55">{label}</p><p className="text-3xl font-bold mt-1">{value}</p></div>
}

function QueueItem({ item }: any) {
  const badge = STATUS_LABELS[item.status] || STATUS_LABELS.waiting
  const missing = Array.isArray(item.missing_fields) ? item.missing_fields : []
  return (
    <div className="rounded-2xl bg-white text-slate-950 p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
        {item.status === 'ready' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold truncate">{item.patient_name || 'Paciente'}</p>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
        </div>
        <p className="text-sm text-gray-600 mt-1">{item.reason || 'Motivo não informado'} • {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        {(item.health_plan_provider || item.health_plan_card_number) && <p className="text-xs text-blue-700 mt-1">Plano: {[item.health_plan_provider, item.health_plan_card_number].filter(Boolean).join(' • ')}</p>}
        {missing.length > 0 && <p className="text-xs text-amber-700 mt-1">Pendências: {missing.join(', ')}</p>}
      </div>
    </div>
  )
}

function InfoBox({ icon: Icon, title, text }: any) {
  return <div className="rounded-2xl bg-white/8 border border-white/10 p-4"><Icon className="w-6 h-6 text-emerald-300 mb-2" /><p className="font-bold text-white">{title}</p><p className="mt-1">{text}</p></div>
}
