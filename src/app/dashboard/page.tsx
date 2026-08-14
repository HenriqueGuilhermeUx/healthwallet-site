'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ArrowRight,
  Brain,
  CalendarDays,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  KeyRound,
  Loader2,
  MessageCircle,
  ReceiptText,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Users,
  Video,
} from 'lucide-react'

interface AccessCode {
  id: string
  code: string
  patient_id: string
  permissions: any
  expires_at: string
  used_at: string | null
  created_at: string
  patient_name?: string
}

type DashboardStats = {
  visits: number
  visitsToday: number
  activePatients: number
  appointmentsToday: number
  pendingAppointments: number
  completedVisits: number
}

const emptyStats: DashboardStats = {
  visits: 0,
  visitsToday: 0,
  activePatients: 0,
  appointmentsToday: 0,
  pendingAppointments: 0,
  completedVisits: 0,
}

const PROFESSIONAL_LABELS: Record<string, string> = {
  medico: 'médico(a)',
  nutricionista: 'nutricionista',
  fisioterapeuta: 'fisioterapeuta',
  psicologo: 'psicólogo(a)',
  terapeuta: 'terapeuta',
  enfermeiro: 'enfermeiro(a)',
  fonoaudiologo: 'fonoaudiólogo(a)',
  odonto: 'odontólogo(a)',
  farmaceutico: 'farmacêutico(a)',
  educador_fisico: 'educador(a) físico(a)',
  outro: 'profissional de saúde',
}

export default function DashboardPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [submitting, setSubmitting] = useState(false)
  const [recentAccess, setRecentAccess] = useState<AccessCode[]>([])
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const [stats, setStats] = useState<DashboardStats>(emptyStats)
  const [nextAppointment, setNextAppointment] = useState<any>(null)
  const [latestVisit, setLatestVisit] = useState<any>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && professional) loadDashboard()
  }, [user, professional])

  const professionalLabel = PROFESSIONAL_LABELS[professional?.professional_type || ''] || 'profissional de saúde'
  const canPrescribe = useMemo(() => canUsePrescriptions(professional), [professional])
  const verificationLabel = professional?.verification_status === 'verified' ? 'verificado' : 'autodeclarado'

  async function loadDashboard() {
    if (!professional || !user) return
    setLoadingDashboard(true)

    const today = new Date().toISOString().slice(0, 10)

    try {
      const [accessRes, visitsRes, appointmentsRes, crmRes] = await Promise.all([
        supabase
          .from('access_codes')
          .select('*')
          .eq('professional_id', professional.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('clinical_visits')
          .select('id, patient_name, status, created_at, started_at, ended_at, specialty')
          .eq('professional_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30),
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
      ])

      const visits = visitsRes.data || []
      const appointments = appointmentsRes.data || []
      const next = appointments.find((item: any) => item.preferred_date >= today && !['cancelled', 'completed'].includes(item.status)) || null

      setRecentAccess(accessRes.data || [])
      setLatestVisit(visits[0] || null)
      setNextAppointment(next)
      setStats({
        visits: visits.length,
        visitsToday: visits.filter((visit: any) => String(visit.created_at || '').startsWith(today)).length,
        activePatients: Math.max((crmRes.data || []).length, new Set(visits.map((visit: any) => visit.patient_name).filter(Boolean)).size),
        appointmentsToday: appointments.filter((item: any) => item.preferred_date === today).length,
        pendingAppointments: appointments.filter((item: any) => ['requested', 'scheduled', 'confirmed', 'reminder_sent'].includes(item.status)).length,
        completedVisits: visits.filter((visit: any) => ['completed', 'signed'].includes(visit.status)).length,
      })
    } catch {
      // Algumas tabelas são opcionais em instalações antigas. O dashboard continua navegável.
    } finally {
      setLoadingDashboard(false)
    }
  }

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('')
      const newCode = [...code]
      digits.forEach((digit, i) => { if (index + i < 6) newCode[index + i] = digit })
      setCode(newCode)
      const lastFilledIndex = Math.min(index + digits.length, 5)
      document.getElementById(`code-${lastFilledIndex}`)?.focus()
    } else {
      const newCode = [...code]
      newCode[index] = value.replace(/\D/g, '')
      setCode(newCode)
      if (value && index < 5) document.getElementById(`code-${index + 1}`)?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) document.getElementById(`code-${index - 1}`)?.focus()
  }

  const handleSubmit = async () => {
    const fullCode = code.join('')
    if (fullCode.length !== 6) {
      toast.error('Digite o código completo de 6 dígitos')
      return
    }
    setSubmitting(true)
    try {
      const { data: accessCode, error: findError } = await supabase
        .from('access_codes')
        .select('*')
        .eq('code', fullCode)
        .gte('expires_at', new Date().toISOString())
        .is('used_at', null)
        .single()

      if (findError || !accessCode) {
        toast.error('Código inválido ou expirado')
        setSubmitting(false)
        return
      }

      const { error: updateError } = await supabase
        .from('access_codes')
        .update({ used_at: new Date().toISOString(), professional_id: professional?.id })
        .eq('id', accessCode.id)

      if (updateError) {
        toast.error('Erro ao validar código')
        setSubmitting(false)
        return
      }

      toast.success('Acesso liberado')
      router.push(`/patient/${accessCode.id}`)
    } catch {
      toast.error('Erro ao validar código')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || !professional) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-violet-950 text-white shadow-xl">
        <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-6 p-6 md:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100 mb-4">
              <Sparkles className="w-4 h-4" /> O copiloto do pequeno consultório
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Atenda, registre e acompanhe pacientes sem virar refém da tela.</h1>
            <p className="mt-3 text-white/78 max-w-2xl">Olá, {professional.full_name}. Seu MyDataMed já sabe que você é {professionalLabel}{professional.specialty ? ` em ${professional.specialty}` : ''}. A partir daqui, a IA adapta perguntas, cards e resumos ao seu contexto profissional.</p>
            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              <HeroAction href="/consulta-assistida" icon={Brain} title="Novo atendimento com IA" description="Paciente avulso ou HealthWallet. Grave, transcreva e finalize." primary />
              <HeroAction href="/teleconsultas" icon={CalendarDays} title="Agenda / teleconsulta" description="Organize horário, link, cobrança e lembrete." />
              <HeroAction href="/meus-pacientes" icon={Users} title="Meus pacientes" description="Acompanhe vínculos, retornos e histórico." />
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 p-5 border border-white/10 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white/65">Status do workspace</p>
                <p className="text-2xl font-bold capitalize">{verificationLabel}</p>
              </div>
              <ShieldCheck className="w-9 h-9 text-emerald-200" />
            </div>
            <div className="mt-4 space-y-3 text-sm text-white/78">
              <StatusLine ok label="IA, pacientes, notas e CRM liberados" />
              <StatusLine ok={canPrescribe} label={canPrescribe ? 'Receitas/documentos regulados liberados' : 'Receitas/documentos regulados exigem verificação'} />
              <StatusLine ok label="LGPD e auditoria como parte do fluxo" />
            </div>
            <Link href="/meu-jeito-atender" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white text-slate-950 px-4 py-3 font-semibold hover:bg-emerald-50">
              Ajustar meu jeito de atender <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Atendimentos" value={stats.visits} loading={loadingDashboard} />
        <Stat label="Hoje" value={stats.visitsToday} loading={loadingDashboard} />
        <Stat label="Pacientes" value={stats.activePatients} loading={loadingDashboard} />
        <Stat label="Agenda hoje" value={stats.appointmentsToday} loading={loadingDashboard} />
        <Stat label="Pendentes" value={stats.pendingAppointments} loading={loadingDashboard} />
        <Stat label="Finalizados" value={stats.completedVisits} loading={loadingDashboard} />
      </section>

      <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Primeiro atendimento em 3 minutos</h2>
              <p className="text-sm text-gray-500">O caminho mais curto para o profissional sentir valor.</p>
            </div>
            <Link href="/consulta-assistida" className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-white font-semibold hover:bg-violet-800">
              Começar <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-5 gap-3">
            <Step number="1" title="Criar paciente" description="Avulso ou HealthWallet autorizado." />
            <Step number="2" title="Gravar" description="Atendimento por voz com consentimento." />
            <Step number="3" title="Cards IA" description="Perguntas, lacunas e pontos de atenção." />
            <Step number="4" title="Revisar" description="Resumo/evolução ajustado ao seu perfil." />
            <Step number="5" title="Acompanhar" description="Retorno, cobrança e relacionamento." />
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-emerald-700" /><h2 className="font-bold text-gray-900">Agora no consultório</h2></div>
          {nextAppointment ? (
            <div className="rounded-2xl bg-cyan-50 border border-cyan-200 p-4">
              <p className="text-sm font-semibold text-cyan-950">Próxima teleconsulta</p>
              <p className="text-sm text-cyan-900 mt-1">{nextAppointment.patient_name || 'Paciente'} • {formatDate(nextAppointment.preferred_date)} {nextAppointment.preferred_time ? `às ${String(nextAppointment.preferred_time).slice(0, 5)}` : ''}</p>
              <Link href="/teleconsultas" className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-cyan-800 hover:underline">Abrir agenda <ArrowRight className="w-4 h-4" /></Link>
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600">Nenhuma teleconsulta futura carregada. Use a Consulta Assistida para atender paciente avulso agora.</div>
          )}
          {latestVisit && (
            <div className="rounded-2xl bg-violet-50 border border-violet-200 p-4">
              <p className="text-sm font-semibold text-violet-950">Último atendimento</p>
              <p className="text-sm text-violet-900 mt-1">{latestVisit.patient_name || 'Paciente'} • {translateStatus(latestVisit.status)}</p>
              <Link href="/consulta-assistida" className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-violet-800 hover:underline">Continuar no copiloto <ArrowRight className="w-4 h-4" /></Link>
            </div>
          )}
        </div>
      </section>

      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ModuleCard href="/consultorio" icon={Stethoscope} title="Meu consultório" description="Painel simples de operação, pacientes, cobrança e próximos passos." />
        <ModuleCard href="/financeiro" icon={ReceiptText} title="Cobrança" description="Teleconsulta, Pix, planos e recorrência powered by NextGen." />
        <ModuleCard href="/lgpd-consultorio" icon={Shield} title="LGPD do consultório" description="Checklist, consentimentos, auditoria e dados sensíveis visíveis." />
        <ModuleCard href="/meu-jeito-atender" icon={SlidersHorizontal} title="Meu jeito de atender" description="Perguntas padrão, template, tom e instruções para a IA." />
        <ModuleCard href="/buscar" icon={Search} title="Buscar CPF/CNS" description="Localize pacientes já autorizados por CPF, CNS ou código." />
        <ModuleCard href="/teleconsultas" icon={Video} title="Teleconsultas" description="Agenda, sala, cobrança, lembretes e orientações." />
        <ModuleCard href={canPrescribe ? '/prescriptions' : '/prescriptions'} icon={FileText} title="Receitas e documentos" description={canPrescribe ? 'Prescrições digitais e rascunhos.' : 'Disponível após verificação de categoria e registro.'} />
        <ModuleCard href="/pro" icon={CreditCard} title="Modo Pro" description="Planos, CRM, automações e estrutura comercial para crescer." />
      </section>

      <section className="grid lg:grid-cols-[0.8fr_1.2fr] gap-6">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5"><KeyRound className="w-6 h-6 text-emerald-600" /><h2 className="font-bold text-gray-900">Código de acesso HealthWallet</h2></div>
          <div className="flex justify-center gap-2 mb-4">
            {code.map((digit, index) => <input key={index} id={`code-${index}`} type="text" inputMode="numeric" value={digit} onChange={(e) => handleCodeChange(index, e.target.value)} onKeyDown={(e) => handleKeyDown(index, e)} className="w-10 h-12 text-center text-xl font-bold rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" maxLength={6} />)}
          </div>
          <button onClick={handleSubmit} disabled={submitting || code.join('').length !== 6} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <><Loader2 className="w-5 h-5 animate-spin" />Validando...</> : <>Acessar paciente autorizado<ArrowRight className="w-5 h-5" /></>}
          </button>
          <p className="text-center text-xs text-gray-500 mt-3">Para paciente sem HealthWallet, use “Novo atendimento com IA”.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-purple-600" /><h2 className="font-bold text-gray-900">Relacionamento e retornos</h2></div><Link href="/consultorio" className="text-sm font-semibold text-emerald-700 hover:underline">Ver operação</Link></div>
          <div className="grid md:grid-cols-3 gap-3">
            <MiniFeature title="Pós-atendimento" description="Mensagem, orientação e retorno viram rotina." />
            <MiniFeature title="Paciente avulso" description="Atenda agora e converta depois para HealthWallet." />
            <MiniFeature title="SmartBots CRM" description="Lembretes e follow-up preparados para automação." />
          </div>

          {recentAccess.length > 0 && (
            <div className="mt-5 border-t pt-4">
              <div className="flex items-center gap-2 mb-3"><CheckCircle className="w-4 h-4 text-emerald-700" /><p className="font-semibold text-sm text-gray-900">Acessos recentes</p></div>
              <div className="space-y-2">
                {recentAccess.map((access) => (
                  <div key={access.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div><p className="font-medium text-gray-900">Código {access.code}</p><p className="text-xs text-gray-500">{new Date(access.created_at).toLocaleDateString('pt-BR')}</p></div>
                    <div className="flex gap-3"><Link href={`/consulta-assistida?patient=${access.patient_id}`} className="text-violet-700 text-sm font-medium hover:underline">Atender</Link><Link href={`/patient/${access.id}`} className="text-emerald-600 text-sm font-medium hover:underline">Ver</Link></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function HeroAction({ href, icon: Icon, title, description, primary = false }: any) {
  return (
    <Link href={href} className={`rounded-2xl p-4 border transition-all ${primary ? 'bg-white text-slate-950 border-white shadow-lg hover:bg-emerald-50' : 'bg-white/10 text-white border-white/10 hover:bg-white/15'}`}>
      <Icon className="w-6 h-6 mb-3" />
      <p className="font-bold">{title}</p>
      <p className={`text-xs mt-1 ${primary ? 'text-slate-600' : 'text-white/70'}`}>{description}</p>
    </Link>
  )
}

function StatusLine({ ok, label }: { ok: boolean; label: string }) {
  return <div className="flex items-start gap-2"><CheckCircle className={`w-4 h-4 mt-0.5 ${ok ? 'text-emerald-200' : 'text-amber-200'}`} /><span>{label}</span></div>
}

function Stat({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm"><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold text-gray-900 mt-1">{loading ? '—' : value}</p></div>
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4"><div className="w-8 h-8 rounded-full bg-violet-700 text-white flex items-center justify-center font-bold text-sm mb-3">{number}</div><p className="font-bold text-gray-900 text-sm">{title}</p><p className="text-xs text-gray-600 mt-1">{description}</p></div>
}

function ModuleCard({ href, icon: Icon, title, description }: any) {
  return <Link href={href} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-lg transition-shadow"><Icon className="w-7 h-7 text-emerald-700 mb-3" /><h3 className="font-bold text-gray-900">{title}</h3><p className="text-sm text-gray-600 mt-1">{description}</p><span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-emerald-700">Abrir <ArrowRight className="w-4 h-4" /></span></Link>
}

function MiniFeature({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4"><p className="font-semibold text-gray-900 text-sm">{title}</p><p className="text-xs text-gray-600 mt-1">{description}</p></div>
}

function canUsePrescriptions(professional: any) {
  if (!professional) return false
  const allowed = Array.isArray(professional.allowed_capabilities) ? professional.allowed_capabilities : []
  return professional.verification_status === 'verified' && allowed.includes('prescription')
}

function translateStatus(status: string) {
  const map: Record<string, string> = { draft: 'rascunho', in_progress: 'em andamento', paused: 'pausado', completed: 'concluído', signed: 'assinado', cancelled: 'cancelado' }
  return map[status] || status
}

function formatDate(date: string) {
  if (!date) return ''
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR')
}
