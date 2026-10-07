'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  HeartPulse,
  Loader2,
  ShieldCheck,
  Stethoscope,
  Target,
  UserCheck,
  Users,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const roleLabels: Record<string, string> = {
  nurse: 'Enfermagem',
  doctor: 'Médico',
  care_coordinator: 'Coordenação',
  admin: 'Administração',
}

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

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function priorityScore(item: any) {
  const urgency = item.urgency === 'urgent_redirect' ? 300 : item.urgency === 'priority' ? 200 : 100
  const status = ['escalated_medical', 'medical_review'].includes(item.status)
    ? 40
    : ['new', 'waiting_nurse'].includes(item.status)
      ? 30
      : item.status === 'in_triage'
        ? 20
        : 0
  const age = Math.max(0, Math.min(72, Math.floor((Date.now() - new Date(item.created_at).getTime()) / 36e5)))
  return urgency + status + age
}

function visibleForRole(item: any, role: string, userId?: string) {
  if (role === 'admin' || role === 'care_coordinator') return true
  if (role === 'doctor') {
    return item.assigned_doctor_id === userId
      || (!item.assigned_doctor_id && ['escalated_medical', 'medical_review'].includes(item.status))
  }
  if (role === 'nurse') {
    return item.assigned_nurse_id === userId
      || (!item.assigned_nurse_id && !item.assigned_doctor_id && ['new', 'waiting_nurse', 'in_triage'].includes(item.status))
  }
  return false
}

export default function ConciergeProfessionalPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<any>(null)
  const [memberships, setMemberships] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [actions, setActions] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user) void load()
  }, [user?.id])

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const { data: self, error: selfError } = await supabase
        .from('concierge_staff')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (selfError) throw selfError
      setStaff(self)

      if (!self?.active) {
        setMemberships([])
        setRequests([])
        setActions([])
        setAlerts([])
        setEvents([])
        setAssignments([])
        return
      }

      if (['admin', 'care_coordinator'].includes(self.role)) {
        try {
          await supabase.rpc('concierge_refresh_time_alerts')
        } catch {
          // Alert refresh must never block access to the professional workspace.
        }
      }

      const [membershipRes, requestRes, actionRes, alertRes, eventRes, assignmentRes] = await Promise.all([
        supabase.from('concierge_memberships').select('*').in('status', ['pilot', 'active', 'paused']).order('created_at', { ascending: false }).limit(500),
        supabase.from('concierge_requests').select('*').not('status', 'in', '(closed,resolved)').order('created_at', { ascending: true }).limit(500),
        supabase.from('concierge_actions').select('*').in('status', ['pending', 'in_progress']).order('due_date', { ascending: true, nullsFirst: false }).limit(500),
        supabase.from('concierge_alerts').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(500),
        supabase.from('concierge_request_events').select('id,patient_id,request_id,event_type,actor_role,message,created_at,visibility').order('created_at', { ascending: false }).limit(500),
        supabase.from('concierge_assignments').select('*').eq('status', 'active').order('created_at', { ascending: true }).limit(500),
      ])

      if (membershipRes.error) throw membershipRes.error
      if (requestRes.error) throw requestRes.error
      if (actionRes.error) throw actionRes.error
      if (alertRes.error) throw alertRes.error
      if (eventRes.error) throw eventRes.error
      if (assignmentRes.error) throw assignmentRes.error

      setMemberships(membershipRes.data || [])
      setRequests(requestRes.data || [])
      setActions(actionRes.data || [])
      setAlerts(alertRes.data || [])
      setEvents(eventRes.data || [])
      setAssignments(assignmentRes.data || [])
    } catch (error) {
      console.error('MyDataMed Concierge professional workspace unavailable:', error)
      setStaff(null)
    } finally {
      setLoading(false)
    }
  }

  const roleRequests = useMemo(
    () => requests
      .filter((item) => visibleForRole(item, staff?.role || '', user?.id))
      .sort((a, b) => priorityScore(b) - priorityScore(a)),
    [requests, staff?.role, user?.id],
  )

  const patientRows = useMemo(() => memberships.map((member) => {
    const patientRequests = requests.filter((item) => item.patient_id === member.patient_id)
    const patientActions = actions.filter((item) => item.patient_id === member.patient_id)
    const patientAlerts = alerts.filter((item) => item.patient_id === member.patient_id)
    const patientEvents = events.filter((item) => item.patient_id === member.patient_id)
    const nurse = assignments.find((item) => item.patient_id === member.patient_id && item.is_primary && ['nurse', 'care_coordinator'].includes(item.role))
    const doctor = assignments.find((item) => item.patient_id === member.patient_id && item.is_primary && item.role === 'doctor')
    const nextAction = [...patientActions].sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')))[0]

    return {
      member,
      name: member.metadata?.patient_name || member.metadata?.patient_email || `Paciente ${String(member.patient_id).slice(0, 8)}`,
      activeCases: patientRequests.filter((item) => !['resolved', 'closed'].includes(item.status)).length,
      actions: patientActions.length,
      alerts: patientAlerts.length,
      lastContact: patientEvents[0]?.created_at || patientRequests[0]?.updated_at || member.updated_at,
      nextAction,
      nurse,
      doctor,
    }
  }), [memberships, requests, actions, alerts, events, assignments])

  const visiblePatients = useMemo(() => {
    if (!staff || ['admin', 'care_coordinator'].includes(staff.role)) return patientRows
    return patientRows.filter((row) =>
      row.nurse?.professional_id === user?.id
      || row.doctor?.professional_id === user?.id
      || requests.some((item) => item.patient_id === row.member.patient_id && visibleForRole(item, staff.role, user?.id)),
    )
  }, [patientRows, requests, staff, user?.id])

  const stats = {
    actionNow: roleRequests.filter((item) => item.urgency === 'urgent_redirect').length,
    attention: roleRequests.filter((item) => item.urgency === 'priority').length + alerts.filter((item) => ['attention', 'high'].includes(item.severity)).length,
    medical: roleRequests.filter((item) => ['escalated_medical', 'medical_review'].includes(item.status)).length,
    patients: visiblePatients.length,
  }

  if (authLoading || loading) {
    return <div className="min-h-[65vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  if (!user) return null

  if (!staff?.active) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7">
          <div className="flex gap-3"><ShieldCheck className="w-6 h-6 text-amber-700 shrink-0" /><div>
            <h1 className="text-xl font-bold text-amber-950">Acesso ao Concierge Profissional ainda não habilitado</h1>
            <p className="mt-2 text-sm text-amber-900/80">Seu login MyDataMed está ativo, mas este módulo exige vínculo em <code>concierge_staff</code>. Isso mantém o acesso ao acompanhamento longitudinal separado do restante do consultório e sujeito às autorizações do paciente.</p>
          </div></div>
        </section>
      </main>
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-teal-950 to-emerald-900 text-white shadow-xl">
        <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              <HeartPulse className="w-4 h-4" /> MyDataMed Concierge · Portal Profissional
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">Quem precisa de atenção, por quê e qual é o próximo passo.</h1>
            <p className="mt-3 max-w-3xl text-white/75">Uma visão longitudinal compartilhada pela equipe. Enfermagem coordena, médico decide quando necessário e o Concierge acompanha até o loop ser fechado.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1.5">{roleLabels[staff.role] || staff.role}</span>
              {staff.specialty && <span className="rounded-full bg-white/10 px-3 py-1.5">{staff.specialty}</span>}
              <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-emerald-100">Acesso autorizado e auditável</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <HeroMetric label="Ação imediata" value={stats.actionNow} tone="red" />
            <HeroMetric label="Precisa atenção" value={stats.attention} tone="amber" />
            <HeroMetric label="Decisão médica" value={stats.medical} tone="violet" />
            <HeroMetric label="Minha carteira" value={stats.patients} tone="emerald" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <SignalCard icon={AlertTriangle} title="Agora" value={stats.actionNow} text="Redirecionamentos e situações que não podem ficar escondidos na lista." tone="red" />
        <SignalCard icon={Clock3} title="Acompanhar" value={roleRequests.filter((item) => ['new', 'in_triage', 'waiting_nurse', 'waiting_patient'].includes(item.status)).length} text="Casos com uma próxima ação operacional." tone="amber" />
        <SignalCard icon={Stethoscope} title="Médico" value={stats.medical} text="Casos estruturados que dependem de decisão clínica." tone="violet" />
        <SignalCard icon={Target} title="Planos" value={actions.length} text="Pendências e próximos passos ainda abertos." tone="emerald" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Fila priorizada</p>
              <h2 className="mt-1 text-xl font-bold text-gray-900">{staff.role === 'doctor' ? 'Decisões clínicas' : 'Trabalho que precisa acontecer'}</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{roleRequests.length}</span>
          </div>

          <div className="mt-4 space-y-3">
            {roleRequests.length === 0 && <Empty text="Nenhum caso pendente para a sua função agora." />}
            {roleRequests.slice(0, 12).map((item) => {
              const member = memberships.find((m) => m.patient_id === item.patient_id)
              const name = member?.metadata?.patient_name || member?.metadata?.patient_email || `Paciente ${String(item.patient_id).slice(0, 8)}`
              return (
                <Link key={item.id} href={`/concierge/profissional/paciente/${item.patient_id}`} className="block rounded-2xl border bg-gray-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/30">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.urgency === 'urgent_redirect' ? 'bg-red-100 text-red-700' : item.urgency === 'priority' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}><Users className="w-5 h-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full bg-white px-2 py-1 font-semibold text-slate-700">{statusLabels[item.status] || item.status}</span>
                        {item.urgency !== 'routine' && <span className={`rounded-full px-2 py-1 font-semibold ${item.urgency === 'urgent_redirect' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{item.urgency === 'urgent_redirect' ? 'Ação imediata' : 'Prioridade'}</span>}
                      </div>
                      <p className="mt-2 truncate font-bold text-gray-900">{name}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">{item.title}</p>
                    </div>
                    <ArrowRight className="mt-2 w-4 h-4 text-gray-400" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Patient Command Center</p>
              <h2 className="mt-1 text-xl font-bold text-gray-900">Carteira longitudinal</h2>
              <p className="mt-1 text-sm text-gray-500">Não é uma lista de pacientes: é uma lista de cuidados em andamento.</p>
            </div>
            <Link href="/meus-pacientes" className="text-sm font-semibold text-emerald-700 hover:underline">Vínculos assistenciais</Link>
          </div>

          <div className="mt-4 space-y-3">
            {visiblePatients.length === 0 && <Empty text="Nenhum paciente Concierge atribuído à sua carteira." />}
            {visiblePatients.slice(0, 20).map((row) => (
              <Link key={row.member.id} href={`/concierge/profissional/paciente/${row.member.patient_id}`} className="block rounded-2xl border p-4 transition hover:border-emerald-300">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white"><UserCheck className="w-5 h-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold text-gray-900">{row.name}</p>
                      {row.alerts > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{row.alerts} alerta{row.alerts === 1 ? '' : 's'}</span>}
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
                      <span>{row.activeCases} caso(s) ativo(s) · {row.actions} ação(ões)</span>
                      <span>Último movimento: {formatDateTime(row.lastContact)}</span>
                    </div>
                    <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-700">
                      <span className="font-semibold">Próximo passo:</span> {row.nextAction?.title || 'Nenhuma ação aberta definida'}
                      {row.nextAction?.due_date ? ` · ${new Date(row.nextAction.due_date).toLocaleDateString('pt-BR')}` : ''}
                    </div>
                  </div>
                  <ArrowRight className="mt-2 w-4 h-4 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 w-5 h-5 shrink-0 text-emerald-700" />
          <div>
            <p className="font-bold text-emerald-950">O loop só termina quando o próximo passo aconteceu.</p>
            <p className="mt-1 text-sm leading-relaxed text-emerald-900/80">Pedido → agendamento → realização → resultado → revisão → conduta → novo próximo passo. O portal profissional organiza a decisão; o Concierge coordena a execução; o que for relevante volta para o HealthWallet do paciente.</p>
          </div>
        </div>
      </section>
    </main>
  )
}

function HeroMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    red: 'bg-red-400/15 text-red-100 border-red-300/15',
    amber: 'bg-amber-300/15 text-amber-100 border-amber-200/15',
    violet: 'bg-violet-400/15 text-violet-100 border-violet-300/15',
    emerald: 'bg-emerald-400/15 text-emerald-100 border-emerald-300/15',
  }
  return <div className={`rounded-2xl border p-4 ${tones[tone] || tones.emerald}`}><p className="text-3xl font-bold">{value}</p><p className="mt-1 text-xs font-semibold">{label}</p></div>
}

function SignalCard({ icon: Icon, title, value, text, tone }: any) {
  const tones: Record<string, string> = {
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }
  return <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone] || tones.emerald}`}><Icon className="w-5 h-5" /></div><p className="mt-3 text-2xl font-bold text-gray-900">{value}</p><p className="text-sm font-semibold text-gray-800">{title}</p><p className="mt-1 text-xs leading-relaxed text-gray-500">{text}</p></div>
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed bg-gray-50 p-6 text-center text-sm text-gray-500">{text}</div>
}
