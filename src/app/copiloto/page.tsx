'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  Clock,
  FileText,
  FolderOpen,
  HeartPulse,
  Loader2,
  MessageCircle,
  Pill,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  Video,
} from 'lucide-react'

type AccessRow = {
  id: string
  code?: string
  patient_id: string
  patient_name?: string
  created_at?: string
  used_at?: string | null
  permissions?: any
}

const demoProfile = {
  full_name: 'Paciente autorizado',
  birth_date: null,
  blood_type: 'Não informado',
  allergies: ['Preencher alergias'],
  chronic_conditions: '',
  current_medications: '',
  med_score: null,
  cns_number: '',
  sus_ubs_reference: '',
}

export default function CopilotoPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [accesses, setAccesses] = useState<AccessRow[]>([])
  const [selectedAccessId, setSelectedAccessId] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [medications, setMedications] = useState<any[]>([])
  const [conditions, setConditions] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (professional) loadAccesses()
  }, [professional])

  useEffect(() => {
    const selected = accesses.find((item) => item.id === selectedAccessId)
    if (selected?.patient_id) loadPatient(selected.patient_id)
  }, [selectedAccessId])

  async function loadAccesses() {
    if (!professional) return
    setLoading(true)

    const { data } = await supabase
      .from('access_codes')
      .select('*')
      .eq('professional_id', professional.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const rows = data || []
    setAccesses(rows)

    if (rows[0]?.id) {
      setSelectedAccessId(rows[0].id)
      await loadPatient(rows[0].patient_id)
    }

    setLoading(false)
  }

  async function loadPatient(patientId: string) {
    setLoading(true)

    const profileRes = await supabase
      .from('profiles')
      .select('*')
      .eq('id', patientId)
      .maybeSingle()

    setProfile(profileRes.data || { ...demoProfile, id: patientId })

    const [recordsRes, eventsRes, medsRes, conditionsRes, plansRes] = await Promise.allSettled([
      supabase.from('medical_records').select('*').eq('user_id', patientId).order('created_at', { ascending: false }).limit(12),
      supabase.from('medical_events').select('*').eq('user_id', patientId).order('event_date', { ascending: false }).limit(12),
      supabase.from('medications').select('*').eq('user_id', patientId).limit(20),
      supabase.from('patient_conditions').select('*').eq('user_id', patientId).limit(20),
      supabase.from('health_plans').select('*').eq('user_id', patientId).limit(5),
    ])

    setRecords(getRows(recordsRes))
    setEvents(getRows(eventsRes))
    setMedications(getRows(medsRes))
    setConditions(getRows(conditionsRes))
    setPlans(getRows(plansRes))
    setLoading(false)
  }

  const selectedAccess = useMemo(() => accesses.find((item) => item.id === selectedAccessId), [accesses, selectedAccessId])
  const activeMeds = useMemo(() => medications.filter((med) => med.is_active !== false), [medications])
  const allergies = normalizeAllergies(profile?.allergies)

  const missingFields = useMemo(() => {
    return [
      !profile?.blood_type && 'Tipo sanguíneo',
      allergies.length === 0 && 'Alergias',
      activeMeds.length === 0 && !profile?.current_medications && 'Medicamentos em uso',
      records.length === 0 && 'Exames/documentos recentes',
      events.length === 0 && 'Timeline clínica',
      !profile?.emergency_contact_name && 'Contato de emergência',
      !profile?.cns_number && !profile?.sus_card_number && 'CNS / Cartão SUS',
      plans.length === 0 && 'Plano/SUS',
    ].filter(Boolean)
  }, [profile, allergies.length, activeMeds.length, records.length, events.length, plans.length])

  const intelligence = useMemo(() => buildIntelligence({ profile, records, events, medications: activeMeds, conditions, allergies, missingFields }), [profile, records, events, activeMeds, conditions, allergies, missingFields])

  if (authLoading || !professional) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <header className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-6 md:p-9">
        <div className="absolute -right-12 -top-20 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -left-16 bottom-0 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5">
              <Sparkles className="w-4 h-4" />
              Copiloto clínico operacional — apoio, não diagnóstico automático
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">Dashboard inteligente do paciente autorizado.</h1>
            <p className="text-white/70 mt-4 max-w-3xl text-lg">
              Resumo, timeline, exames, medicamentos, alertas, preparação pré-consulta, pós-consulta, anamnese, CRM, agenda, documentos e teleatendimento em uma visão simples para o profissional.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <Link href="/buscar" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold hover:bg-emerald-600">
                <Search className="w-5 h-5" /> Buscar paciente CPF/CNS
              </Link>
              <Link href="/teleconsultas" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-3 font-semibold hover:bg-white/15">
                <Video className="w-5 h-5" /> Abrir teleconsulta
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 border border-white/10 p-4 backdrop-blur">
            <div className="rounded-2xl bg-white text-gray-900 p-5 shadow-2xl space-y-3">
              <p className="text-sm text-gray-500">Paciente em análise</p>
              <select
                value={selectedAccessId}
                onChange={(e) => setSelectedAccessId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {accesses.length === 0 ? <option value="">Nenhum acesso autorizado ainda</option> : null}
                {accesses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.patient_name || `Paciente ${String(item.patient_id).slice(0, 8)}`} • código {item.code || item.id.slice(0, 6)}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <MiniMetric label="Exames/docs" value={records.length} />
                <MiniMetric label="Eventos" value={events.length} />
                <MiniMetric label="Medicamentos" value={activeMeds.length || (profile?.current_medications ? 1 : 0)} />
                <MiniMetric label="Pendências" value={missingFields.length} />
              </div>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-900">
                Dados somente quando autorizados pelo paciente. A IA organiza, resume e aponta pendências; a decisão continua sendo do profissional habilitado.
              </div>
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <section className="bg-white rounded-3xl border p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></section>
      ) : accesses.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section className="grid md:grid-cols-4 gap-4">
            <HealthPulseCard score={intelligence.readinessScore} />
            <StatCard icon={Brain} label="Resumo IA" value={intelligence.summaryStatus} text="Visão pré-consulta pronta para revisão." />
            <StatCard icon={Activity} label="Timeline" value={`${events.length} eventos`} text="Histórico ordenado para leitura rápida." />
            <StatCard icon={AlertTriangle} label="Pontos de atenção" value={intelligence.attentionPoints.length} text="Pendências, riscos operacionais e lacunas." />
          </section>

          <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-5">
            <Panel title="Resumo inteligente do paciente" icon={Brain} action="Apoio à análise">
              <p className="text-gray-700 leading-relaxed">{intelligence.smartSummary}</p>
              <div className="grid sm:grid-cols-2 gap-3 mt-5">
                <Info label="Paciente" value={profileName(profile, selectedAccess)} />
                <Info label="CNS / Cartão SUS" value={profile?.cns_number || profile?.sus_card_number || 'Não informado'} />
                <Info label="UBS referência" value={profile?.sus_ubs_reference || 'Não informado'} />
                <Info label="MedScore" value={profile?.med_score ? `${profile.med_score}/100` : 'Não calculado'} />
              </div>
            </Panel>

            <Panel title="Preparação pré-consulta" icon={ClipboardList} action="Checklist">
              <div className="space-y-3">
                {intelligence.preConsult.map((item) => <InsightRow key={item} icon={CheckCircle} text={item} tone="emerald" />)}
              </div>
            </Panel>
          </section>

          <section className="grid lg:grid-cols-3 gap-5">
            <Panel title="Exames e tendências" icon={FileText} action={`${records.length} item(ns)`}>
              <div className="space-y-3">
                {records.slice(0, 5).map((record) => <ExamRow key={record.id || record.created_at} item={record} />)}
                {records.length === 0 && <EmptyText text="Nenhum exame/documento recente encontrado. Solicite envio antes da consulta." />}
              </div>
            </Panel>

            <Panel title="Medicamentos e pontos de atenção" icon={Pill} action={`${activeMeds.length || (profile?.current_medications ? 1 : 0)} ativo(s)`}>
              <div className="space-y-3">
                {activeMeds.slice(0, 5).map((med) => <MedicationRow key={med.id || med.name || med.medication_name} item={med} />)}
                {activeMeds.length === 0 && profile?.current_medications && <InsightRow icon={Pill} text={profile.current_medications} tone="orange" />}
                {activeMeds.length === 0 && !profile?.current_medications && <EmptyText text="Medicamentos em uso não informados." />}
              </div>
            </Panel>

            <Panel title="Alertas e dados faltantes" icon={AlertTriangle} action={`${missingFields.length} pendência(s)`}>
              <div className="space-y-3">
                {missingFields.map((item: any) => <InsightRow key={String(item)} icon={AlertTriangle} text={String(item)} tone="amber" />)}
                {missingFields.length === 0 && <InsightRow icon={CheckCircle} text="Perfil essencial bem preenchido para atendimento." tone="emerald" />}
              </div>
            </Panel>
          </section>

          <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-5">
            <Panel title="Linha do tempo clínica automática" icon={Clock} action="Eventos relevantes">
              <div className="space-y-3">
                {timelineItems(events, records).slice(0, 7).map((item) => <TimelineRow key={item.key} item={item} />)}
                {timelineItems(events, records).length === 0 && <EmptyText text="Sem timeline suficiente. O copiloto vai melhorar conforme exames, eventos e consultas forem registrados." />}
              </div>
            </Panel>

            <Panel title="Perguntas sugeridas para anamnese" icon={Stethoscope} action="Sugestões">
              <div className="grid md:grid-cols-2 gap-3">
                {intelligence.questions.map((item) => <QuestionCard key={item} text={item} />)}
              </div>
            </Panel>
          </section>

          <section className="grid lg:grid-cols-3 gap-5">
            <Panel title="Resumo pós-consulta" icon={FileText} action="Pronto para documentar">
              <div className="space-y-3 text-sm text-gray-700">
                {intelligence.postConsult.map((item) => <InsightRow key={item} icon={FileText} text={item} tone="blue" />)}
              </div>
            </Panel>

            <Panel title="CRM SmartBots" icon={MessageCircle} action="Acompanhamento">
              <div className="space-y-3">
                <AutomationCard title="Lembrete de retorno" text="Criar tarefa para retorno em 7, 15 ou 30 dias." />
                <AutomationCard title="Pedir exame/documento" text="Solicitar dados faltantes antes da próxima consulta." />
                <AutomationCard title="Follow-up pós-consulta" text="Mensagem de acompanhamento com orientação e próximos passos." />
              </div>
            </Panel>

            <Panel title="Operação conectada" icon={Bot} action="Staff + DocWallet">
              <div className="grid gap-3">
                <ActionLink href="/teleconsultas" icon={Video} title="Teleatendimento" text="Abrir agenda, Daily e orientações." />
                <ActionLink href="/crm" icon={MessageCircle} title="CRM" text="Tarefas, lembretes e follow-up." />
                <ActionLink href="/assinaturas" icon={FolderOpen} title="DocWallet / documentos" text="Documentos, assinatura e validação." />
              </div>
            </Panel>
          </section>
        </>
      )}
    </main>
  )
}

function buildIntelligence({ profile, records, events, medications, conditions, allergies, missingFields }: any) {
  const name = profileName(profile, null)
  const hasMeds = medications.length > 0 || profile?.current_medications
  const hasRecords = records.length > 0
  const hasEvents = events.length > 0
  const readinessScore = Math.max(20, Math.min(100, 100 - (missingFields.length * 9)))
  const attentionPoints = [
    ...missingFields.slice(0, 4).map((item: string) => `Pendente: ${item}`),
    allergies.length > 0 ? `Alergias registradas: ${allergies.join(', ')}` : '',
    hasMeds ? 'Revisar medicamentos ativos, dose, frequência e adesão.' : '',
  ].filter(Boolean)

  return {
    readinessScore,
    summaryStatus: readinessScore >= 75 ? 'Boa base' : readinessScore >= 50 ? 'Atenção' : 'Incompleto',
    attentionPoints,
    smartSummary: `${name} possui ${conditions.length || profile?.chronic_conditions ? 'condições/histórico informado' : 'histórico clínico ainda incompleto'}, ${hasRecords ? 'exames ou documentos recentes cadastrados' : 'sem exames recentes cadastrados'} e ${hasMeds ? 'medicamentos em uso para revisão' : 'medicamentos ainda não informados'}. Antes da consulta, revise alergias, medicamentos, eventos relevantes, dados faltantes e necessidade de documentos complementares.`,
    preConsult: [
      hasRecords ? 'Revisar últimos exames/documentos antes de iniciar a consulta.' : 'Solicitar exames ou documentos recentes ao paciente.',
      hasMeds ? 'Confirmar medicamentos ativos, dose, frequência, adesão e efeitos percebidos.' : 'Perguntar medicamentos em uso, automedicação e suplementos.',
      allergies.length ? 'Confirmar alergias registradas e gravidade das reações.' : 'Perguntar alergias medicamentosas, alimentares e outras reações.',
      hasEvents ? 'Ler eventos recentes da timeline para entender evolução.' : 'Construir linha do tempo inicial: queixa, início, evolução e atendimentos prévios.',
    ],
    questions: [
      'Qual é a principal queixa hoje e quando começou?',
      'O que mudou desde a última consulta ou exame?',
      'Quais medicamentos está usando e em quais horários?',
      'Teve alergia, reação ou efeito adverso recente?',
      'Há exames pendentes ou resultados fora do habitual?',
      'O paciente teve internação, pronto atendimento ou queda recente?',
      'Existe dificuldade para seguir tratamento, retorno ou compra de medicamento?',
      'Quem da família/cuidador acompanha a rotina de saúde?',
    ],
    postConsult: [
      'Gerar orientação clara ao paciente e salvar no prontuário/documentos.',
      'Registrar conduta, sinais de alerta e plano de retorno.',
      'Criar tarefa de CRM para follow-up ou retorno.',
      'Solicitar atualização de exames, medicamentos e alergias se necessário.',
    ],
  }
}

function getRows(result: any) {
  if (result.status !== 'fulfilled') return []
  return result.value?.data || []
}

function normalizeAllergies(value: any) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (!value) return []
  return String(value).split(',').map((item) => item.trim()).filter(Boolean)
}

function profileName(profile: any, access: any) {
  return profile?.full_name || profile?.name || access?.patient_name || 'Paciente autorizado'
}

function timelineItems(events: any[], records: any[]) {
  const fromEvents = events.map((item) => ({
    key: `event-${item.id || item.event_date}`,
    date: item.event_date || item.created_at,
    title: item.title || item.type || 'Evento clínico',
    text: item.description || item.notes || 'Evento registrado na timeline.',
  }))
  const fromRecords = records.map((item) => ({
    key: `record-${item.id || item.created_at}`,
    date: item.record_date || item.created_at,
    title: item.file_name || item.exam_type || item.title || 'Exame/documento',
    text: item.status ? `Status: ${item.status}` : 'Documento enviado pelo paciente.',
  }))
  return [...fromEvents, ...fromRecords].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
}

function HealthPulseCard({ score }: any) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-sm">
      <HeartPulse className="w-8 h-8 mb-4" />
      <p className="text-sm text-white/75">Prontidão pré-consulta</p>
      <p className="text-4xl font-bold mt-1">{score}%</p>
      <div className="h-2 bg-white/20 rounded-full mt-4 overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${score}%` }} /></div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, text }: any) {
  return (
    <div className="rounded-3xl bg-white border border-gray-100 p-5 shadow-sm">
      <Icon className="w-8 h-8 text-emerald-600 mb-4" />
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-sm text-gray-500 mt-2">{text}</p>
    </div>
  )
}

function Panel({ title, icon: Icon, action, children }: any) {
  return (
    <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Icon className="w-5 h-5" /></div>
          <h2 className="font-bold text-gray-900 text-lg">{title}</h2>
        </div>
        <span className="text-xs rounded-full bg-gray-100 text-gray-600 px-3 py-1">{action}</span>
      </div>
      {children}
    </section>
  )
}

function MiniMetric({ label, value }: any) {
  return <div className="rounded-2xl bg-gray-50 border p-3"><p className="text-2xl font-bold text-emerald-700">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
}

function Info({ label, value }: any) {
  return <div className="rounded-2xl border bg-gray-50 p-3"><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-semibold text-gray-900 mt-1 break-words">{value || 'Não informado'}</p></div>
}

function InsightRow({ icon: Icon, text, tone }: any) {
  const cls = tone === 'amber' ? 'bg-amber-50 text-amber-900 border-amber-100' : tone === 'orange' ? 'bg-orange-50 text-orange-900 border-orange-100' : tone === 'blue' ? 'bg-blue-50 text-blue-900 border-blue-100' : 'bg-emerald-50 text-emerald-900 border-emerald-100'
  return <div className={`rounded-2xl border p-3 text-sm flex gap-2 ${cls}`}><Icon className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{text}</span></div>
}

function ExamRow({ item }: any) {
  return <div className="rounded-2xl border bg-gray-50 p-3"><p className="font-semibold text-sm text-gray-900">{item.file_name || item.exam_type || item.title || 'Exame/documento'}</p><p className="text-xs text-gray-500 mt-1">{formatDate(item.record_date || item.created_at)} • {item.status || 'registrado'}</p></div>
}

function MedicationRow({ item }: any) {
  return <div className="rounded-2xl border bg-orange-50 border-orange-100 p-3"><p className="font-semibold text-sm text-orange-950">{item.name || item.medication_name || 'Medicamento'}</p><p className="text-xs text-orange-800 mt-1">{[item.dosage, item.frequency].filter(Boolean).join(' • ') || 'Dose/frequência não informadas'}</p></div>
}

function TimelineRow({ item }: any) {
  return <div className="relative pl-5 border-l border-emerald-200"><div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-emerald-500" /><p className="text-xs text-gray-500">{formatDate(item.date)}</p><p className="font-semibold text-gray-900 text-sm">{item.title}</p><p className="text-sm text-gray-600 mt-1">{item.text}</p></div>
}

function QuestionCard({ text }: any) {
  return <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-sm text-indigo-950"><Stethoscope className="w-4 h-4 mb-2 text-indigo-700" />{text}</div>
}

function AutomationCard({ title, text }: any) {
  return <div className="rounded-2xl border bg-gray-50 p-3"><p className="font-semibold text-gray-900 text-sm">{title}</p><p className="text-xs text-gray-500 mt-1">{text}</p></div>
}

function ActionLink({ href, icon: Icon, title, text }: any) {
  return <Link href={href} className="rounded-2xl border bg-gray-50 p-3 hover:bg-emerald-50 hover:border-emerald-100 transition-colors flex gap-3"><Icon className="w-5 h-5 text-emerald-700 mt-0.5" /><span><span className="block font-semibold text-gray-900 text-sm">{title}</span><span className="block text-xs text-gray-500 mt-1">{text}</span></span></Link>
}

function EmptyText({ text }: any) {
  return <p className="text-sm text-gray-500 rounded-2xl border border-dashed p-4">{text}</p>
}

function EmptyState() {
  return (
    <section className="rounded-3xl bg-white border border-gray-100 p-8 text-center shadow-sm">
      <ShieldCheck className="w-14 h-14 text-emerald-600 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-900">Nenhum paciente autorizado ainda</h2>
      <p className="text-gray-600 mt-2 max-w-2xl mx-auto">Valide um código do HealthWallet ou busque por CPF/CNS. Depois disso, o copiloto monta o dashboard inteligente com resumo, timeline, exames, medicamentos, pendências e preparo de consulta.</p>
      <Link href="/buscar" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold hover:bg-emerald-700">Buscar paciente <ArrowRight className="w-5 h-5" /></Link>
    </section>
  )
}

function formatDate(date: string) {
  if (!date) return 'Data não informada'
  return new Date(date).toLocaleDateString('pt-BR')
}
