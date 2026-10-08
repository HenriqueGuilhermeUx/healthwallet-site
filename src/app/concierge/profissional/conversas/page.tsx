'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bot,
  Circle,
  Clock3,
  Headphones,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const complexTypes = new Set(['insurance_authorization','reimbursement','claim_denial','hospitalization','surgery','complex_case','caregiver_coordination'])

const operationalLabels: Record<string, string> = {
  insurance_authorization: 'Autorização',
  reimbursement: 'Reembolso',
  claim_denial: 'Glosa / negativa',
  hospitalization: 'Internação',
  surgery: 'Cirurgia',
  complex_case: 'Caso complexo',
  caregiver_coordination: 'Cuidado familiar',
  provider_search: 'Busca de prestador',
  scheduling: 'Agendamento',
  general_navigation: 'Navegação',
}

const statusLabels: Record<string, string> = {
  ai_active: 'IA atendendo',
  attention: 'Precisa atenção',
  human_requested: 'Humano solicitado',
  human_active: 'Humano na conversa',
  closed: 'Encerrada',
}

function formatTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function isOnline(value?: string | null) {
  if (!value) return false
  return Date.now() - new Date(value).getTime() < 2 * 60 * 1000
}

export default function ConciergeLiveConversationsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [memberships, setMemberships] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    void bootstrap()
  }, [user?.id])

  useEffect(() => {
    if (!staff?.active || !user) return

    const channel = supabase
      .channel(`concierge-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'concierge_chat_sessions' }, () => {
        void loadQueue(false)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'concierge_chat_messages' }, (payload: any) => {
        if (selectedId && payload.new?.session_id === selectedId) void loadMessages(selectedId)
        void loadQueue(false)
      })
      .subscribe()

    const timer = window.setInterval(() => {
      void loadQueue(false)
      if (selectedId) void loadMessages(selectedId)
    }, 15000)

    return () => {
      window.clearInterval(timer)
      void supabase.removeChannel(channel)
    }
  }, [staff?.active, selectedId, user?.id])

  async function bootstrap() {
    if (!user) return
    setLoading(true)
    setUnavailable(false)
    try {
      const [{ data: conciergeSelf, error: conciergeError }, { data: teamSelf, error: teamError }] = await Promise.all([
        supabase
          .from('concierge_staff')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('mydatamed_team_members')
          .select('user_id,role,display_name,active')
          .eq('user_id', user.id)
          .maybeSingle(),
      ])

      if (conciergeError) throw conciergeError
      if (teamError) throw teamError

      const self = conciergeSelf?.active
        ? conciergeSelf
        : teamSelf?.active && ['master','admin','care_coordinator','concierge_agent','nurse','doctor'].includes(teamSelf.role)
          ? {
              user_id: teamSelf.user_id,
              role: teamSelf.role,
              display_name: teamSelf.display_name,
              active: true,
            }
          : null

      setStaff(self)
      if (!self?.active) return

      await loadQueue(false)
    } catch (error: any) {
      console.error('Live Concierge conversations unavailable:', error)
      if (String(error?.message || '').includes('concierge_chat_sessions')) setUnavailable(true)
    } finally {
      setLoading(false)
    }
  }

  async function loadQueue(showToast = false) {
    try {
      const [sessionRes, membershipRes] = await Promise.all([
        supabase
          .from('concierge_chat_sessions')
          .select('*')
          .neq('status', 'closed')
          .order('last_activity_at', { ascending: false })
          .limit(100),
        supabase
          .from('concierge_memberships')
          .select('patient_id,status,plan_code,metadata')
          .in('status', ['pilot', 'active', 'paused'])
          .limit(500),
      ])

      if (sessionRes.error) throw sessionRes.error
      if (membershipRes.error) throw membershipRes.error

      setSessions(sessionRes.data || [])
      setMemberships(membershipRes.data || [])

      if (showToast) toast.success('Fila atualizada')
    } catch (error: any) {
      console.error('Conversation queue refresh failed:', error)
      if (String(error?.message || '').includes('concierge_chat_sessions')) setUnavailable(true)
    }
  }

  async function loadMessages(sessionId: string) {
    const { data, error } = await supabase
      .from('concierge_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) {
      console.error('Conversation messages unavailable:', error)
      return
    }

    setMessages(data || [])
  }

  async function selectSession(sessionId: string) {
    setSelectedId(sessionId)
    await loadMessages(sessionId)
  }

  async function takeSession(sessionId: string) {
    try {
      const { error } = await supabase.rpc('concierge_chat_staff_take', {
        p_session_id: sessionId,
      })
      if (error) throw error
      toast.success('Você entrou na conversa.')
      await loadQueue()
      await loadMessages(sessionId)
    } catch (error) {
      console.error('Could not take conversation:', error)
      toast.error('Não foi possível entrar na conversa.')
    }
  }

  async function returnToAI(sessionId: string) {
    try {
      const { error } = await supabase.rpc('concierge_chat_staff_return_to_ai', {
        p_session_id: sessionId,
      })
      if (error) throw error
      toast.success('Conversa devolvida ao Concierge Digital.')
      await loadQueue()
      await loadMessages(sessionId)
    } catch {
      toast.error('Não foi possível devolver a conversa à IA.')
    }
  }

  async function markAttention(sessionId: string) {
    try {
      const { error } = await supabase
        .from('concierge_chat_sessions')
        .update({
          status: 'attention',
          attention_reason: 'Marcado manualmente pela equipe',
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', sessionId)

      if (error) throw error
      toast.success('Conversa marcada para atenção.')
      await loadQueue()
    } catch {
      toast.error('Não foi possível marcar atenção.')
    }
  }

  async function sendHumanReply() {
    const session = sessions.find((item) => item.id === selectedId)
    const body = reply.trim()
    if (!session || !body || !user || !staff) return

    setSending(true)
    try {
      if (session.status !== 'human_active' || session.assigned_staff_id !== user.id) {
        await takeSession(session.id)
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Sessão expirada.')

      const response = await fetch('/api/concierge/chat/reply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          content: body,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'Não foi possível enviar a mensagem.')

      setReply('')
      await loadMessages(session.id)
      await loadQueue()

      if (session.channel === 'whatsapp' && result.delivered) {
        toast.success('Mensagem enviada pelo WhatsApp.')
      }
    } catch (error: any) {
      console.error('Human reply failed:', error)
      toast.error(error?.message || 'Não foi possível enviar a mensagem.')
    } finally {
      setSending(false)
    }
  }

  const queue = useMemo(
    () => [...sessions].sort((a, b) => {
      const priority = (item: any) => {
        if (item.status === 'human_requested') return 60
        if (item.metadata?.attention_level === 'high') return 55
        if (complexTypes.has(item.metadata?.operational_type)) return 50
        if (item.status === 'attention') return 40
        if (item.status === 'human_active') return 30
        if (item.metadata?.attention_level === 'watch') return 20
        return 10
      }
      const byPriority = priority(b) - priority(a)
      return byPriority || String(b.last_activity_at || '').localeCompare(String(a.last_activity_at || ''))
    }),
    [sessions],
  )

  const selected = sessions.find((item) => item.id === selectedId) || null

  const patientName = (patientId: string) => {
    const member = memberships.find((item) => item.patient_id === patientId)
    return member?.metadata?.patient_name
      || member?.metadata?.patient_email
      || `Paciente ${String(patientId).slice(0, 8)}`
  }

  const subjectLabel = (session: any) => {
    const subject = session?.metadata?.subject_name
    const relationship = session?.metadata?.subject_relationship
    if (!subject) return patientName(session.patient_id)
    return `${patientName(session.patient_id)} cuidando de ${subject}${relationship ? ` · ${relationship}` : ''}`
  }

  const stats = {
    live: sessions.filter((item) => isOnline(item.last_activity_at)).length,
    human: sessions.filter((item) => item.status === 'human_requested').length,
    attention: sessions.filter((item) => item.status === 'attention').length,
    ai: sessions.filter((item) => item.status === 'ai_active').length,
  }

  if (authLoading || loading) {
    return <div className="min-h-[65vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
  }

  if (!user) return null

  if (!staff?.active) {
    return <main className="max-w-4xl mx-auto px-4 py-10"><div className="rounded-2xl border bg-white p-6 text-center text-sm text-gray-500">Acesso restrito à equipe Concierge.</div></main>
  }

  if (unavailable) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="font-bold text-amber-950">Central de conversas pronta para ativação</h1>
          <p className="mt-2 text-sm text-amber-900/80">A interface já está instalada nesta branch. Falta aplicar a migration <code>SQL_CONCIERGE_DIGITAL_AI_V1.sql</code> no Supabase compartilhado.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-900 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/concierge/profissional" className="inline-flex items-center gap-2 text-sm text-white/65"><ArrowLeft className="h-4 w-4" /> Concierge</Link>
            <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-wider text-white/60"><MessageCircle className="h-4 w-4" /> Conversas ao vivo</div>
            <h1 className="mt-2 text-3xl font-bold">Quem está conversando agora?</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/75">A IA atende primeiro. A equipe enxerga a conversa, percebe quando precisa ajudar e pode entrar antes mesmo de o paciente pedir.</p>
          </div>
          <button onClick={() => void loadQueue(true)} className="rounded-xl bg-white/10 p-3"><RefreshCw className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2">
          <Stat label="Ao vivo" value={stats.live} />
          <Stat label="Pediu humano" value={stats.human} />
          <Stat label="Atenção" value={stats.attention} />
          <Stat label="IA atendendo" value={stats.ai} />
        </div>
      </section>

      <section className="grid min-h-[620px] gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Fila de conversas</h2>
            <span className="text-xs text-gray-500">{queue.length} abertas</span>
          </div>

          <div className="mt-4 space-y-2">
            {queue.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-gray-500">Nenhuma conversa aberta agora.</div>}
            {queue.map((item) => (
              <button
                key={item.id}
                onClick={() => void selectSession(item.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === item.id ? 'border-emerald-400 bg-emerald-50' : 'bg-white hover:border-emerald-200'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.status === 'human_requested' ? 'bg-blue-100 text-blue-700' : item.status === 'attention' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {item.status === 'ai_active' ? <Bot className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold">{subjectLabel(item)}</p>
                      {isOnline(item.last_activity_at) && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700"><Circle className="h-2.5 w-2.5 fill-current" /> AO VIVO</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{statusLabels[item.status] || item.status}</span>
                      {item.metadata?.operational_type && operationalLabels[item.metadata.operational_type] && (
                        <span className={`rounded-full px-2 py-1 ${complexTypes.has(item.metadata.operational_type) ? 'bg-rose-100 text-rose-800' : 'bg-blue-50 text-blue-700'}`}>
                          {operationalLabels[item.metadata.operational_type]}
                        </span>
                      )}
                      {item.metadata?.attention_level === 'high' && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">PRIORIDADE</span>}
                    </div>
                    {item.attention_reason && <p className="mt-1 line-clamp-2 text-xs text-amber-700">{item.attention_reason}</p>}
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400"><Clock3 className="h-3 w-3" /> {formatTime(item.last_activity_at)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-[620px] flex-col rounded-3xl border bg-white p-4 shadow-sm">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-center">
              <div><Sparkles className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-3 font-bold">Selecione uma conversa</p><p className="mt-1 text-sm text-gray-500">Você pode apenas acompanhar ou entrar quando fizer sentido.</p></div>
            </div>
          ) : (
            <>
              <div className="border-b pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{subjectLabel(selected)}</p>
                    <p className="mt-1 text-xs text-gray-500">{statusLabels[selected.status] || selected.status} · última atividade {formatTime(selected.last_activity_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.status !== 'human_active' && (
                      <button onClick={() => void takeSession(selected.id)} className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white">Entrar na conversa</button>
                    )}
                    {selected.status === 'human_active' && (
                      <button onClick={() => void returnToAI(selected.id)} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Devolver à IA</button>
                    )}
                    {!['attention','human_requested'].includes(selected.status) && (
                      <button onClick={() => void markAttention(selected.id)} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Marcar atenção</button>
                    )}
                    <Link href={`/concierge/profissional/paciente/${selected.patient_id}`} className="rounded-xl border px-3 py-2 text-xs font-bold">Abrir paciente</Link>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto py-4">
                {messages.map((message) => {
                  const patient = message.actor_role === 'patient'
                  const ai = message.actor_role === 'ai'
                  return (
                    <div key={message.id} className={`flex ${patient ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${patient ? 'bg-slate-100 text-slate-900 rounded-bl-md' : ai ? 'bg-emerald-50 text-emerald-950 rounded-br-md' : 'bg-blue-700 text-white rounded-br-md'}`}>
                        <p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${patient ? 'text-slate-500' : ai ? 'text-emerald-700' : 'text-blue-100'}`}>
                          {patient ? 'Paciente' : ai ? 'Concierge Digital' : 'Equipe Concierge'}
                        </p>
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        <p className={`mt-1 text-[10px] ${patient || ai ? 'text-gray-400' : 'text-blue-100'}`}>{formatTime(message.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="border-t pt-3">
                <div className="flex gap-2">
                  <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} placeholder="Entre na conversa e escreva para o paciente…" className="flex-1 resize-none rounded-xl border px-3 py-3 text-sm" />
                  <button onClick={() => void sendHumanReply()} disabled={!reply.trim() || sending} className="flex w-12 items-center justify-center rounded-xl bg-blue-700 text-white disabled:opacity-40">
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/10 p-3 text-center"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-[11px] text-white/65">{label}</p></div>
}
