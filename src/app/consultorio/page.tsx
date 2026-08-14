'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  ArrowRight,
  Brain,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  CreditCard,
  FileText,
  Loader2,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react'

type Stats = {
  visits: number
  signed: number
  appointments: number
  patients: number
  pendingPayments: number
  crmTasks: number
}

const emptyStats: Stats = { visits: 0, signed: 0, appointments: 0, patients: 0, pendingPayments: 0, crmTasks: 0 }

export default function ConsultorioPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>(emptyStats)
  const [recentVisits, setRecentVisits] = useState<any[]>([])
  const [nextAppointments, setNextAppointments] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && professional) load()
  }, [user, professional])

  async function load() {
    if (!user || !professional) return
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [visitsRes, appointmentsRes, contactsRes, tasksRes] = await Promise.all([
        supabase
          .from('clinical_visits')
          .select('id, patient_name, status, specialty, created_at')
          .eq('professional_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('telemedicine_appointments')
          .select('id, patient_name, preferred_date, preferred_time, specialty, status, payment_status')
          .eq('professional_id', professional.id)
          .order('preferred_date', { ascending: true })
          .order('preferred_time', { ascending: true })
          .limit(30),
        supabase
          .from('professional_crm_contacts')
          .select('id')
          .eq('professional_user_id', user.id)
          .limit(1000),
        supabase
          .from('professional_crm_tasks')
          .select('id,status')
          .eq('professional_user_id', user.id)
          .neq('status', 'done')
          .limit(1000),
      ])

      const visits = visitsRes.data || []
      const appointments = appointmentsRes.data || []
      const upcoming = appointments.filter((item: any) => item.preferred_date >= today && !['cancelled', 'completed'].includes(item.status))

      setRecentVisits(visits.slice(0, 5))
      setNextAppointments(upcoming.slice(0, 5))
      setStats({
        visits: visits.length,
        signed: visits.filter((visit: any) => visit.status === 'signed').length,
        appointments: upcoming.length,
        patients: Math.max((contactsRes.data || []).length, new Set(visits.map((visit: any) => visit.patient_name).filter(Boolean)).size),
        pendingPayments: appointments.filter((item: any) => item.payment_status && !['paid', 'not_required'].includes(item.payment_status)).length,
        crmTasks: (tasksRes.data || []).length,
      })
    } catch {
      // Painel segue utilizável mesmo se algum módulo opcional ainda não existir.
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !professional) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-emerald-900 via-slate-950 to-violet-950 text-white p-6 md:p-8 shadow-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold mb-4"><Stethoscope className="w-4 h-4" /> Painel do consultório pequeno</div>
          <h1 className="text-3xl md:text-4xl font-bold">Operação simples para atender, registrar, cobrar e acompanhar.</h1>
          <p className="text-white/75 mt-3">Uma visão prática do dia a dia: atendimento com IA, agenda, pacientes, cobrança, LGPD e retornos. Sem cara de ERP pesado.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link href="/consulta-assistida" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-slate-950 px-5 py-3 font-semibold hover:bg-emerald-50"><Brain className="w-5 h-5" /> Novo atendimento com IA</Link>
            <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 font-semibold hover:bg-white/10">Voltar ao dashboard</Link>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Atendimentos" value={stats.visits} loading={loading} />
        <Stat label="Notas assinadas" value={stats.signed} loading={loading} />
        <Stat label="Agenda futura" value={stats.appointments} loading={loading} />
        <Stat label="Pacientes" value={stats.patients} loading={loading} />
        <Stat label="Pagamentos pendentes" value={stats.pendingPayments} loading={loading} />
        <Stat label="Tarefas CRM" value={stats.crmTasks} loading={loading} />
      </section>

      <section className="grid lg:grid-cols-4 gap-4">
        <Pillar href="/consulta-assistida" icon={Brain} title="Atendimento" description="Transcrição por voz, cards de apoio, evolução e nota final revisada." cta="Atender agora" />
        <Pillar href="/meus-pacientes" icon={Users} title="Pacientes" description="Paciente avulso ou HealthWallet, vínculos, histórico e acompanhamento." cta="Ver pacientes" />
        <Pillar href="/financeiro" icon={ReceiptText} title="Cobrança" description="Pix, teleconsulta, planos, recorrência e controle de pagamento." cta="Cobrar" />
        <Pillar href="/lgpd-consultorio" icon={ShieldCheck} title="LGPD" description="Consentimentos, auditoria, dados sensíveis e checklist do consultório." cta="Organizar LGPD" />
      </section>

      <section className="grid lg:grid-cols-[1fr_1fr] gap-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-cyan-700" /><h2 className="font-bold text-gray-900">Agenda e próximos atendimentos</h2></div><Link href="/teleconsultas" className="text-sm font-semibold text-cyan-700 hover:underline">Abrir agenda</Link></div>
          {nextAppointments.length ? (
            <div className="space-y-3">
              {nextAppointments.map((item) => <TimelineRow key={item.id} title={item.patient_name || 'Paciente'} subtitle={`${formatDate(item.preferred_date)} ${item.preferred_time ? `às ${String(item.preferred_time).slice(0, 5)}` : ''} • ${item.specialty || 'Atendimento'}`} badge={translateStatus(item.status)} />)}
            </div>
          ) : <EmptyState title="Sem agenda futura" description="Crie teleconsultas ou atenda paciente avulso agora pela Consulta Assistida." />}
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-violet-700" /><h2 className="font-bold text-gray-900">Evoluções recentes</h2></div><Link href="/consulta-assistida" className="text-sm font-semibold text-violet-700 hover:underline">Abrir IA</Link></div>
          {recentVisits.length ? (
            <div className="space-y-3">
              {recentVisits.map((item) => <TimelineRow key={item.id} title={item.patient_name || 'Paciente'} subtitle={`${item.specialty || 'Atendimento'} • ${formatDate(item.created_at)}`} badge={translateStatus(item.status)} />)}
            </div>
          ) : <EmptyState title="Nenhuma evolução ainda" description="Faça o primeiro atendimento com IA e salve uma nota estruturada." />}
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4"><Sparkles className="w-5 h-5 text-emerald-700" /><h2 className="font-bold text-gray-900">Próxima evolução do consultório</h2></div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          <RoadmapItem title="Convite do paciente" description="Enviar link/QR/WhatsApp para paciente avulso virar HealthWallet." />
          <RoadmapItem title="Retorno automático" description="Criar tarefa de retorno após cada atendimento finalizado." />
          <RoadmapItem title="TISS Lite" description="Controle simples de autorização, glosa e pagamento por convênio." />
          <RoadmapItem title="LGPD visível" description="Exportar relatório de consentimentos e acessos do consultório." />
        </div>
      </section>
    </div>
  )
}

function Pillar({ href, icon: Icon, title, description, cta }: any) {
  return <Link href={href} className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm hover:shadow-lg transition-shadow"><Icon className="w-8 h-8 text-emerald-700 mb-4" /><h3 className="font-bold text-lg text-gray-900">{title}</h3><p className="text-sm text-gray-600 mt-1">{description}</p><span className="inline-flex items-center gap-1 mt-5 text-sm font-semibold text-emerald-700">{cta} <ArrowRight className="w-4 h-4" /></span></Link>
}

function Stat({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm"><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold text-gray-900 mt-1">{loading ? '—' : value}</p></div>
}

function TimelineRow({ title, subtitle, badge }: { title: string; subtitle: string; badge: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 border border-gray-100 p-3"><div><p className="font-semibold text-gray-900 text-sm">{title}</p><p className="text-xs text-gray-500 mt-1">{subtitle}</p></div><span className="rounded-full bg-white px-2 py-1 text-xs text-gray-600 border">{badge}</span></div>
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5 text-center"><p className="font-semibold text-gray-900">{title}</p><p className="text-sm text-gray-500 mt-1">{description}</p></div>
}

function RoadmapItem({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><CheckCircle className="w-5 h-5 text-emerald-700 mb-2" /><p className="font-semibold text-emerald-950 text-sm">{title}</p><p className="text-xs text-emerald-800 mt-1">{description}</p></div>
}

function translateStatus(status: string) {
  const map: Record<string, string> = { requested: 'solicitado', scheduled: 'agendado', confirmed: 'confirmado', reminder_sent: 'lembrete enviado', draft: 'rascunho', in_progress: 'em andamento', paused: 'pausado', completed: 'concluído', signed: 'assinado', cancelled: 'cancelado' }
  return map[status] || status
}

function formatDate(date: string) {
  if (!date) return ''
  const safeDate = String(date).includes('T') ? date : `${date}T12:00:00`
  return new Date(safeDate).toLocaleDateString('pt-BR')
}
