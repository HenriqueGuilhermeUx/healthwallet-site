'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileHeart,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  Target,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const statusLabels: Record<string, string> = {
  new: 'Novo',
  in_triage: 'Em triagem',
  waiting_patient: 'Aguardando paciente',
  waiting_nurse: 'Aguardando equipe',
  escalated_medical: 'Encaminhado ao médico',
  medical_review: 'Revisão médica',
  action_plan: 'Plano de ação',
  resolved: 'Resolvido',
  closed: 'Encerrado',
}

const roleLabels: Record<string, string> = {
  master: 'Master',
  admin: 'Administração',
  care_coordinator: 'Coordenação',
  concierge_agent: 'Concierge',
  nurse: 'Enfermagem',
  doctor: 'Médico',
  specialist: 'Especialista',
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR')
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function isOverdue(value?: string | null) {
  if (!value) return false
  return new Date(value + 'T23:59:59').getTime() < Date.now()
}

export default function ConciergePatientCommandCenter() {
  const params = useParams<{ patientId: string }>()
  const patientId = String(params?.patientId || '')
  const router = useRouter()
  const { user, professional, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<any>(null)
  const [membership, setMembership] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [actions, setActions] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [careLink, setCareLink] = useState<any>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && patientId) void load()
  }, [user?.id, professional?.id, patientId])

  async function load() {
    if (!user || !patientId) return
    setLoading(true)
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
          ? { ...teamSelf, active: true }
          : null

      setStaff(self)
      if (!self?.active) return

      const [membershipRes, assignmentRes, requestRes, actionRes, alertRes, eventRes, reviewRes] = await Promise.all([
        supabase.from('concierge_memberships').select('*').eq('patient_id', patientId).maybeSingle(),
        supabase.from('concierge_assignments').select('*').eq('patient_id', patientId).eq('status', 'active').order('is_primary', { ascending: false }),
        supabase.from('concierge_requests').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(100),
        supabase.from('concierge_actions').select('*').eq('patient_id', patientId).order('due_date', { ascending: true, nullsFirst: false }).limit(100),
        supabase.from('concierge_alerts').select('*').eq('patient_id', patientId).eq('status', 'open').order('created_at', { ascending: false }).limit(100),
        supabase.from('concierge_request_events').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(100),
        supabase.from('concierge_clinical_reviews').select('*').eq('patient_id', patientId).order('updated_at', { ascending: false }).limit(30),
      ])

      if (membershipRes.error) throw membershipRes.error
      if (assignmentRes.error) throw assignmentRes.error
      if (requestRes.error) throw requestRes.error
      if (actionRes.error) throw actionRes.error
      if (alertRes.error) throw alertRes.error
      if (eventRes.error) throw eventRes.error
      if (reviewRes.error) throw reviewRes.error

      setMembership(membershipRes.data)
      setAssignments(assignmentRes.data || [])
      setRequests(requestRes.data || [])
      setActions(actionRes.data || [])
      setAlerts(alertRes.data || [])
      setEvents(eventRes.data || [])
      setReviews(reviewRes.data || [])

      if (professional?.id) {
        const { data } = await supabase
          .from('professional_care_links')
          .select('*')
          .eq('professional_id', professional.id)
          .eq('patient_id', patientId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        setCareLink(data || null)
      }
    } catch (error) {
      console.error('Patient Command Center unavailable:', error)
      setMembership(null)
    } finally {
      setLoading(false)
    }
  }

  const openRequests = useMemo(() => requests.filter((item) => !['resolved', 'closed'].includes(item.status)), [requests])
  const openActions = useMemo(() => actions.filter((item) => !['completed', 'cancelled'].includes(item.status)), [actions])
  const overdueActions = useMemo(() => openActions.filter((item) => isOverdue(item.due_date)), [openActions])
  const primaryNurse = assignments.find((item) => item.is_primary && ['nurse', 'care_coordinator'].includes(item.role))
  const primaryDoctor = assignments.find((item) => item.is_primary && item.role === 'doctor')
  const patientName = membership?.metadata?.patient_name || membership?.metadata?.patient_email || `Paciente ${patientId.slice(0, 8)}`

  const currentFocus = useMemo(() => {
    const urgent = openRequests.find((item) => item.urgency === 'urgent_redirect')
    if (urgent) return { tone: 'red', title: urgent.title, detail: 'Caso com redirecionamento urgente aberto.', href: `/concierge/profissional/caso/${urgent.id}` }
    const high = alerts.find((item) => item.severity === 'high')
    if (high) return { tone: 'red', title: high.title, detail: high.suggested_action || 'Alerta de alta atenção pendente.' }
    if (overdueActions[0]) return { tone: 'amber', title: overdueActions[0].title, detail: `Ação vencida desde ${formatDate(overdueActions[0].due_date)}.` }
    const priority = openRequests.find((item) => item.urgency === 'priority')
    if (priority) return { tone: 'amber', title: priority.title, detail: 'Caso priorizado para acompanhamento.', href: `/concierge/profissional/caso/${priority.id}` }
    if (openActions[0]) return { tone: 'emerald', title: openActions[0].title, detail: openActions[0].due_date ? `Próximo prazo: ${formatDate(openActions[0].due_date)}.` : 'Próxima ação definida no plano.' }
    return { tone: 'slate', title: 'Nenhuma pendência imediata', detail: 'A carteira está sem ação aberta definida neste momento.' }
  }, [openRequests, alerts, overdueActions, openActions])

  async function completeAction(action: any) {
    if (!confirm(`Concluir a ação “${action.title}”?`)) return
    setBusyId(action.id)
    const { error } = await supabase
      .from('concierge_actions')
      .update({ status: 'completed', completed_at: new Date().toISOString(), completion_note: 'Concluída pelo Portal Profissional MyDataMed.' })
      .eq('id', action.id)
    setBusyId(null)
    if (error) return toast.error(error.message)
    toast.success('Ação concluída')
    await load()
  }

  async function acknowledgeAlert(alert: any) {
    if (!user) return
    setBusyId(alert.id)
    const { error } = await supabase
      .from('concierge_alerts')
      .update({ status: 'acknowledged', acknowledged_by: user.id, acknowledged_at: new Date().toISOString() })
      .eq('id', alert.id)
    setBusyId(null)
    if (error) return toast.error(error.message)
    toast.success('Alerta reconhecido')
    await load()
  }

  if (authLoading || loading) return <div className="min-h-[65vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>

  if (!staff?.active || !membership) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <Link href="/concierge/profissional" className="inline-flex items-center gap-2 text-sm text-gray-600"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-bold text-amber-950">Paciente indisponível neste contexto</p>
          <p className="mt-2 text-sm text-amber-900/80">O acesso depende de vínculo Concierge ativo, função profissional e autorizações aplicáveis. O Portal não amplia permissões existentes.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <Link href="/concierge/profissional" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Carteira Concierge</Link>

      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-teal-950 to-emerald-900 p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1.5">{membership.status}</span>
              <span className={`rounded-full px-3 py-1.5 ${membership.consent_status === 'accepted' ? 'bg-emerald-400/20 text-emerald-100' : 'bg-amber-300/20 text-amber-100'}`}>consentimento {membership.consent_status || 'pendente'}</span>
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold">{patientName}</h1>
            <p className="mt-2 text-white/70">Patient Command Center · {roleLabels[staff.role] || staff.role}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={'/concierge/profissional/coordenacao?patient=' + encodeURIComponent(patientId) + '&name=' + encodeURIComponent(patientName)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950"
            >
              <CalendarCheck className="w-4 h-4" /> Coordenar exame / consulta
            </Link>
            {careLink ? (
              <Link href={`/patient/care-link/${careLink.id}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950"><FileHeart className="w-4 h-4" /> Contexto clínico autorizado <ExternalLink className="w-4 h-4" /></Link>
            ) : (
              <Link href="/meus-pacientes" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white"><ShieldCheck className="w-4 h-4" /> Solicitar vínculo clínico</Link>
            )}
          </div>
        </div>
      </section>

      <section className={`rounded-3xl border p-5 ${currentFocus.tone === 'red' ? 'border-red-200 bg-red-50' : currentFocus.tone === 'amber' ? 'border-amber-200 bg-amber-50' : currentFocus.tone === 'emerald' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={`mt-0.5 w-5 h-5 shrink-0 ${currentFocus.tone === 'red' ? 'text-red-700' : currentFocus.tone === 'amber' ? 'text-amber-700' : 'text-emerald-700'}`} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Precisa de atenção agora</p>
            <p className="mt-1 font-bold text-gray-950">{currentFocus.title}</p>
            <p className="mt-1 text-sm text-gray-600">{currentFocus.detail}</p>
          </div>
          {currentFocus.href && <Link href={currentFocus.href} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">Abrir</Link>}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="Casos ativos" value={openRequests.length} />
        <Metric label="Ações abertas" value={openActions.length} attention={overdueActions.length > 0} />
        <Metric label="Alertas" value={alerts.length} attention={alerts.length > 0} />
        <Metric label="Revisões" value={reviews.length} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-6">
          <Panel icon={Users} title="Equipe de referência">
            <TeamRow label="Enfermagem / coordenação" member={primaryNurse} />
            <TeamRow label="Médico" member={primaryDoctor} />
            {assignments.filter((item) => !item.is_primary || item.role === 'specialist').map((item) => <TeamRow key={item.id} label={roleLabels[item.role] || item.role} member={item} />)}
          </Panel>

          <Panel icon={ShieldCheck} title="Acesso e continuidade">
            <InfoRow label="Consentimento Concierge" value={membership.consent_status || 'pendente'} />
            <InfoRow label="Plano operacional" value={membership.plan_code || '—'} />
            <InfoRow label="Último movimento" value={formatDateTime(events[0]?.created_at || requests[0]?.updated_at)} />
            <InfoRow label="Próxima ação" value={openActions[0]?.title || 'Nenhuma ação aberta'} />
            <div className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">Dados clínicos completos continuam sujeitos ao vínculo assistencial e ao escopo autorizado. O Concierge coordena o cuidado sem criar um prontuário paralelo.</div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel icon={Stethoscope} title="Casos em andamento">
            {openRequests.length === 0 && <Empty text="Nenhum caso ativo." />}
            {openRequests.map((item) => (
              <Link key={item.id} href={`/concierge/profissional/caso/${item.id}`} className="flex items-start gap-3 rounded-2xl border bg-gray-50 p-4 hover:border-emerald-300">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.urgency === 'urgent_redirect' ? 'bg-red-100 text-red-700' : item.urgency === 'priority' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}><Stethoscope className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1"><p className="font-semibold text-gray-900">{item.title}</p><p className="mt-1 text-xs text-gray-500">{statusLabels[item.status] || item.status} · aberto em {formatDate(item.created_at)}</p></div>
                <ArrowRight className="mt-2 w-4 h-4 text-gray-400" />
              </Link>
            ))}
          </Panel>

          <Panel icon={Target} title="Plano de ação">
            {openActions.length === 0 && <Empty text="Nenhuma ação aberta." />}
            {openActions.map((item) => (
              <div key={item.id} className={`rounded-2xl border p-4 ${isOverdue(item.due_date) ? 'border-amber-200 bg-amber-50' : 'bg-gray-50'}`}>
                <div className="flex items-start gap-3">
                  <CalendarClock className="mt-0.5 w-4 h-4 text-emerald-700" />
                  <div className="min-w-0 flex-1"><p className="font-semibold text-gray-900">{item.title}</p><p className="mt-1 text-xs text-gray-500">{item.status}{item.due_date ? ` · prazo ${formatDate(item.due_date)}` : ''}{isOverdue(item.due_date) ? ' · vencida' : ''}</p>{item.description && <p className="mt-2 text-sm text-gray-600">{item.description}</p>}</div>
                  <button onClick={() => completeAction(item)} disabled={busyId === item.id} className="rounded-xl border bg-white px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50">{busyId === item.id ? '...' : 'Concluir'}</button>
                </div>
              </div>
            ))}
          </Panel>

          <Panel icon={AlertTriangle} title="Alertas abertos">
            {alerts.length === 0 && <Empty text="Nenhum alerta aberto." />}
            {alerts.map((item) => (
              <div key={item.id} className={`rounded-2xl border p-4 ${item.severity === 'high' ? 'border-red-200 bg-red-50' : item.severity === 'attention' ? 'border-amber-200 bg-amber-50' : 'bg-gray-50'}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 w-4 h-4 text-amber-700" />
                  <div className="min-w-0 flex-1"><p className="font-semibold text-gray-900">{item.title}</p>{item.explanation && <p className="mt-1 text-sm text-gray-600">{item.explanation}</p>}{item.suggested_action && <p className="mt-2 text-xs font-semibold text-gray-700">Próximo passo sugerido: {item.suggested_action}</p>}</div>
                  <button onClick={() => acknowledgeAlert(item)} disabled={busyId === item.id} className="rounded-xl border bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">{busyId === item.id ? '...' : 'Reconhecer'}</button>
                </div>
              </div>
            ))}
          </Panel>

          <Panel icon={ClipboardList} title="Revisões profissionais">
            {reviews.length === 0 && <Empty text="Nenhuma revisão estruturada registrada." />}
            {reviews.map((item) => (
              <Link key={item.id} href={`/concierge/profissional/caso/${item.request_id}`} className="block rounded-2xl border bg-gray-50 p-4 hover:border-emerald-300">
                <div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-gray-900">{item.case_summary || item.review_type}</p><p className="mt-1 text-xs text-gray-500">{item.status} · atualizado {formatDateTime(item.updated_at)}</p></div><ArrowRight className="w-4 h-4 text-gray-400" /></div>
              </Link>
            ))}
          </Panel>

          <Panel icon={MessageCircle} title="Linha do tempo do Concierge">
            {events.length === 0 && <Empty text="Nenhum movimento registrado." />}
            {events.slice(0, 25).map((item) => (
              <div key={item.id} className="border-l-2 border-emerald-200 pl-4 py-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500"><span>{formatDateTime(item.created_at)}</span><span>·</span><span>{roleLabels[item.actor_role] || item.actor_role}</span>{item.visibility === 'staff_only' && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">interno</span>}</div>
                <p className="mt-1 text-sm text-gray-800">{item.message || item.event_type}</p>
              </div>
            ))}
          </Panel>
        </div>
      </section>
    </main>
  )
}

function Metric({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${attention ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'}`}><p className="text-2xl font-bold text-gray-900">{value}</p><p className="mt-1 text-xs text-gray-500">{label}</p></div>
}

function Panel({ icon: Icon, title, children }: any) {
  return <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Icon className="w-5 h-5 text-emerald-700" /><h2 className="font-bold text-gray-900">{title}</h2></div><div className="space-y-3">{children}</div></section>
}

function TeamRow({ label, member }: { label: string; member?: any }) {
  return <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</p><p className="mt-1 font-semibold text-gray-900">{member?.professional_name || 'Não atribuído'}</p>{member?.specialty && <p className="mt-1 text-xs text-gray-500">{member.specialty}</p>}</div>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2 last:border-0"><span className="text-xs text-gray-500">{label}</span><span className="text-right text-xs font-semibold text-gray-800">{value}</span></div>
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed bg-gray-50 p-5 text-center text-sm text-gray-500">{text}</div>
}
