'use client'

import { useEffect, useMemo, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Brain,
  CalendarDays,
  FileText,
  Loader2,
  MessageCircle,
  Pill,
  ShieldCheck,
  Stethoscope,
  User,
  Video,
  Wallet,
} from 'lucide-react'

export default function CareLinkPatientPage({ params }: { params: Promise<{ linkId: string }> }) {
  const resolvedParams = use(params)
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [careLink, setCareLink] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const [medications, setMedications] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [score, setScore] = useState<any>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (professional && resolvedParams.linkId) load()
  }, [professional, resolvedParams.linkId])

  async function safeList(table: string, field: string, value: string, orderField = 'created_at') {
    try {
      const { data } = await supabase.from(table).select('*').eq(field, value).order(orderField, { ascending: false }).limit(20)
      return data || []
    } catch {
      return []
    }
  }

  async function safeSingle(table: string, field: string, value: string, orderField?: string) {
    try {
      let query = supabase.from(table).select('*').eq(field, value)
      if (orderField) query = query.order(orderField, { ascending: false })
      const { data } = await query.limit(1).maybeSingle()
      return data || null
    } catch {
      return null
    }
  }

  async function load() {
    if (!professional) return
    setLoading(true)

    const { data: link, error } = await supabase
      .from('professional_care_links')
      .select('*')
      .eq('id', resolvedParams.linkId)
      .eq('professional_id', professional.id)
      .maybeSingle()

    if (error || !link) {
      toast.error('Vínculo assistencial não encontrado')
      router.push('/meus-pacientes')
      return
    }

    const expired = link.expires_at && new Date(link.expires_at).getTime() < Date.now()
    if (link.status !== 'active' || expired || !link.patient_id) {
      toast.error('Este vínculo ainda não está ativo ou não possui Patient ID aprovado')
      router.push('/meus-pacientes')
      return
    }

    setCareLink(link)
    await supabase.from('professional_care_links').update({ last_accessed_at: new Date().toISOString() }).eq('id', link.id)

    const patientId = link.patient_id
    const [profileData, summaryData, scoreData, recordsData, medsData, timelineData] = await Promise.all([
      safeSingle('profiles', 'id', patientId),
      safeSingle('health_summaries', 'user_id', patientId, 'created_at'),
      safeSingle('health_scores', 'user_id', patientId, 'calculated_at'),
      safeList('medical_records', 'user_id', patientId, 'created_at'),
      safeList('medications', 'user_id', patientId, 'created_at'),
      safeList('medical_events', 'user_id', patientId, 'event_date'),
    ])

    setProfile(profileData)
    setSummary(summaryData)
    setScore(scoreData)
    setRecords(recordsData)
    setMedications(medsData)
    setTimeline(timelineData)
    setLoading(false)
  }

  const scope = careLink?.scope || {}
  const activeMeds = useMemo(() => medications.filter((item) => item.is_active !== false), [medications])
  const patientName = profile?.full_name || profile?.name || careLink?.patient_name || careLink?.patient_email || 'Paciente acompanhado'

  if (authLoading || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <header className="rounded-[2rem] bg-slate-950 text-white p-7 md:p-10 relative overflow-hidden">
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative">
          <Link href="/meus-pacientes" className="inline-flex items-center gap-2 text-sm text-emerald-100 hover:underline mb-5">
            <ArrowLeft className="w-4 h-4" /> Voltar para Meus Pacientes
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5 ml-0 md:ml-4">
            <ShieldCheck className="w-4 h-4" /> Vínculo assistencial ativo
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">{patientName}</h1>
          <p className="text-white/70 mt-4 max-w-3xl text-lg">
            Painel de acompanhamento contínuo autorizado: histórico, exames, medicamentos, IA, agenda, CRM, documentos, teleatendimento e planos em um só lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-7">
            <Link href={`/copiloto?careLink=${careLink.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold hover:bg-emerald-600"><Brain className="w-5 h-5" /> Copiloto IA</Link>
            <Link href={`/teleconsultas?patient=${careLink.patient_id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-3 font-semibold hover:bg-white/15"><Video className="w-5 h-5" /> Teleconsulta</Link>
            <Link href={`/planos?patient=${careLink.patient_id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-3 font-semibold hover:bg-white/15"><Wallet className="w-5 h-5" /> Plano</Link>
          </div>
        </div>
      </header>

      <section className="grid md:grid-cols-5 gap-3">
        <InfoCard icon={User} title="Paciente" value={patientName} />
        <InfoCard icon={Brain} title="MedScore" value={score?.score ? `${score.score}/100` : 'Não calculado'} />
        <InfoCard icon={FileText} title="Exames/docs" value={records.length} />
        <InfoCard icon={Pill} title="Medicamentos" value={activeMeds.length} />
        <InfoCard icon={CalendarDays} title="Eventos" value={timeline.length} />
      </section>

      <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-900 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 mt-0.5" />
        <div>
          <p className="font-semibold">Escopo autorizado: {scopeLabel(scope)}</p>
          <p>{careLink.continuous ? 'Acesso contínuo até revogação do paciente.' : `Acesso autorizado até ${formatDate(careLink.expires_at)}.`}</p>
        </div>
      </section>

      <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-5">
        <Panel title="Resumo inteligente" icon={Brain}>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {summary?.professional_summary || summary?.summary || summary?.patient_summary || buildFallbackSummary(patientName, records, activeMeds, timeline)}
          </p>
        </Panel>

        <Panel title="Preparação do acompanhamento" icon={Stethoscope}>
          <div className="space-y-2 text-sm text-gray-700">
            <Bullet text="Revisar exames/documentos recentes antes do atendimento." />
            <Bullet text="Confirmar medicamentos ativos, dose, frequência e adesão." />
            <Bullet text="Checar alergias, Passport, CNS/UBS e contatos de emergência." />
            <Bullet text="Criar follow-up no CRM SmartBots quando houver retorno pendente." />
          </div>
        </Panel>
      </section>

      <section className="grid lg:grid-cols-3 gap-5">
        <DataSection title="Exames e documentos" icon={FileText} items={scope.exams === false ? [] : records} empty={scope.exams === false ? 'Escopo não autorizado para exames.' : 'Nenhum exame/documento encontrado.'} render={(item: any) => (
          <div><p className="font-medium text-gray-900">{item.exam_type || item.title || item.file_name || 'Exame/documento'}</p><p className="text-xs text-gray-500">{formatDate(item.record_date || item.created_at)}</p></div>
        )} />
        <DataSection title="Medicamentos" icon={Pill} items={scope.medications === false ? [] : activeMeds} empty={scope.medications === false ? 'Escopo não autorizado para medicamentos.' : 'Nenhum medicamento ativo encontrado.'} render={(item: any) => (
          <div><p className="font-medium text-gray-900">{item.name || item.medication_name || 'Medicamento'}</p><p className="text-sm text-gray-600">{[item.dosage, item.frequency].filter(Boolean).join(' · ') || 'Dose/frequência não informadas'}</p></div>
        )} />
        <DataSection title="Timeline" icon={CalendarDays} items={scope.timeline === false ? [] : timeline} empty={scope.timeline === false ? 'Escopo não autorizado para timeline.' : 'Nenhum evento encontrado.'} render={(item: any) => (
          <div><p className="font-medium text-gray-900">{item.title || item.type || 'Evento'}</p><p className="text-xs text-gray-500">{formatDate(item.event_date || item.created_at)}</p>{item.description && <p className="text-sm text-gray-700 mt-1">{item.description}</p>}</div>
        )} />
      </section>

      <section className="grid md:grid-cols-4 gap-4">
        <ActionCard href="/crm" icon={MessageCircle} title="CRM SmartBots" text="Follow-up, retorno e lembretes." />
        <ActionCard href="/teleconsultas" icon={Video} title="Agenda/Teleconsulta" text="Criar atendimento com cobrança e Daily." />
        <ActionCard href="/assinaturas" icon={FileText} title="DocWallet" text="Documentos, orientações e assinatura." />
        <ActionCard href="/financeiro" icon={Wallet} title="NextGen" text="Cobranças, Pix e planos." />
      </section>
    </main>
  )
}

function buildFallbackSummary(name: string, records: any[], meds: any[], timeline: any[]) {
  return `${name} possui ${records.length} exame(s)/documento(s), ${meds.length} medicamento(s) ativo(s) e ${timeline.length} evento(s) na timeline. Use esta tela como apoio operacional: confirme dados, revise pendências e registre conduta profissional.`
}

function scopeLabel(scope: any) {
  const labels: Record<string, string> = { summary: 'resumo', exams: 'exames', medications: 'medicamentos', timeline: 'timeline', passport: 'passport', medscore: 'medscore', documents: 'documentos', family: 'família' }
  return Object.keys(scope || {}).filter((key) => scope[key]).map((key) => labels[key] || key).join(', ') || 'escopo não informado'
}

function InfoCard({ icon: Icon, title, value }: any) {
  return <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"><Icon className="w-5 h-5 text-emerald-600 mb-2" /><p className="text-xs text-gray-500">{title}</p><p className="font-bold text-gray-900 mt-1 break-words">{value}</p></div>
}

function Panel({ title, icon: Icon, children }: any) {
  return <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><div className="flex items-center gap-2 mb-4"><Icon className="w-5 h-5 text-emerald-600" /><h2 className="font-bold text-lg">{title}</h2></div>{children}</section>
}

function DataSection({ title, icon: Icon, items, empty, render }: any) {
  return <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><div className="flex items-center gap-2 mb-4"><Icon className="w-5 h-5 text-emerald-600" /><h2 className="font-bold text-lg">{title}</h2></div>{items.length > 0 ? <div className="space-y-3">{items.map((item: any) => <div key={item.id || item.created_at} className="rounded-xl border border-gray-100 bg-gray-50 p-3">{render(item)}</div>)}</div> : <p className="text-sm text-gray-500">{empty}</p>}</section>
}

function Bullet({ text }: any) {
  return <div className="rounded-xl bg-gray-50 border p-3">{text}</div>
}

function ActionCard({ href, icon: Icon, title, text }: any) {
  return <Link href={href} className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm hover:bg-emerald-50 hover:border-emerald-100 transition-colors"><Icon className="w-6 h-6 text-emerald-700 mb-3" /><p className="font-semibold text-gray-900">{title}</p><p className="text-xs text-gray-500 mt-1">{text}</p></Link>
}

function formatDate(date?: string) {
  if (!date) return 'sem prazo definido'
  return new Date(date).toLocaleDateString('pt-BR')
}
