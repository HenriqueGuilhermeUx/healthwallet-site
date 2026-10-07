'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileHeart,
  FileText,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Pill,
  Save,
  Send,
  ShieldCheck,
  Stethoscope,
  Target,
  UserCheck,
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
  nurse: 'Enfermagem',
  doctor: 'Médico',
  care_coordinator: 'Coordenação',
  admin: 'Administração',
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ConciergeProfessionalCasePage() {
  const params = useParams<{ requestId: string }>()
  const requestId = String(params?.requestId || '')
  const router = useRouter()
  const { user, professional, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<any>(null)
  const [request, setRequest] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [actions, setActions] = useState<any[]>([])
  const [review, setReview] = useState<any>(null)
  const [context, setContext] = useState<any>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [noteVisibility, setNoteVisibility] = useState<'patient' | 'staff_only'>('staff_only')
  const [actionTitle, setActionTitle] = useState('')
  const [actionDescription, setActionDescription] = useState('')
  const [actionDueDate, setActionDueDate] = useState('')
  const [actionPriority, setActionPriority] = useState('normal')
  const [caseSummary, setCaseSummary] = useState('')
  const [relevantFindings, setRelevantFindings] = useState('')
  const [pointsToConsider, setPointsToConsider] = useState('')
  const [uncertainties, setUncertainties] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [nextSteps, setNextSteps] = useState('')
  const [questionsForPatient, setQuestionsForPatient] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && requestId) void load()
  }, [user?.id, requestId])

  async function load() {
    if (!user || !requestId) return
    setLoading(true)
    try {
      const { data: self, error: selfError } = await supabase
        .from('concierge_staff')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (selfError) throw selfError
      setStaff(self)
      if (!self?.active) return

      const requestRes = await supabase
        .from('concierge_requests')
        .select('*')
        .eq('id', requestId)
        .single()
      if (requestRes.error) throw requestRes.error
      setRequest(requestRes.data)

      const [eventRes, actionRes, reviewRes] = await Promise.all([
        supabase.from('concierge_request_events').select('*').eq('request_id', requestId).order('created_at', { ascending: true }),
        supabase.from('concierge_actions').select('*').eq('request_id', requestId).order('created_at', { ascending: false }),
        supabase.from('concierge_clinical_reviews').select('*').eq('request_id', requestId).maybeSingle(),
      ])
      if (eventRes.error) throw eventRes.error
      if (actionRes.error) throw actionRes.error
      if (reviewRes.error) throw reviewRes.error

      setEvents(eventRes.data || [])
      setActions(actionRes.data || [])
      setReview(reviewRes.data || null)

      const existing = reviewRes.data
      setCaseSummary(existing?.case_summary || '')
      setRelevantFindings(existing?.relevant_findings || '')
      setPointsToConsider(existing?.points_to_consider || '')
      setUncertainties(existing?.uncertainties || '')
      setRecommendations(existing?.recommendations || '')
      setNextSteps(existing?.next_steps || '')
      setQuestionsForPatient(existing?.questions_for_patient || '')
    } catch (error) {
      console.error('Concierge case workspace unavailable:', error)
      setRequest(null)
    } finally {
      setLoading(false)
    }
  }

  const canPublish = ['doctor', 'admin'].includes(staff?.role)
  const canCoordinate = ['nurse', 'care_coordinator', 'admin'].includes(staff?.role)
  const canOpenExternalCoordination = ['nurse', 'care_coordinator', 'admin', 'doctor'].includes(staff?.role)
  const patientName = request?.subject_name || request?.context_snapshot?.patient_name || `Paciente ${String(request?.patient_id || '').slice(0, 8)}`
  const contextMedications = Array.isArray(context?.active_medications) ? context.active_medications : []
  const contextExams = Array.isArray(context?.linked_exams) ? context.linked_exams : []
  const contextDevices = Array.isArray(context?.recent_device_summaries) ? context.recent_device_summaries : []
  const latestDevice = contextDevices[0] || null

  const nextOpenAction = useMemo(
    () => actions.filter((item) => !['completed', 'cancelled'].includes(item.status))
      .sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')))[0],
    [actions],
  )

  async function loadAuthorizedContext() {
    if (!requestId) return
    setContextLoading(true)
    try {
      const { data, error } = await supabase.rpc('concierge_get_request_context', { target_request: requestId })
      if (error) throw error
      setContext(data || {})
      toast.success('Contexto autorizado carregado e acesso registrado')
    } catch (error: any) {
      console.error('Authorized context unavailable:', error)
      toast.error(error?.message?.toLowerCase?.().includes('consent')
        ? 'O consentimento necessário não está ativo para este caso.'
        : 'Não foi possível carregar o contexto autorizado.')
    } finally {
      setContextLoading(false)
    }
  }

  async function addEvent() {
    if (!user || !request || !note.trim()) return
    setBusy(true)
    try {
      const { error } = await supabase.from('concierge_request_events').insert({
        request_id: request.id,
        patient_id: request.patient_id,
        actor_user_id: user.id,
        actor_role: staff.role,
        event_type: noteVisibility === 'patient' ? 'professional_message' : 'professional_note',
        visibility: noteVisibility,
        message: note.trim(),
        payload: {},
      })
      if (error) throw error
      setNote('')
      toast.success(noteVisibility === 'patient' ? 'Mensagem registrada para o paciente' : 'Nota interna registrada')
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível registrar a nota.')
    } finally {
      setBusy(false)
    }
  }

  async function addAction() {
    if (!user || !request || !actionTitle.trim()) return
    setBusy(true)
    try {
      const { error } = await supabase.from('concierge_actions').insert({
        patient_id: request.patient_id,
        request_id: request.id,
        created_by: user.id,
        assigned_professional_id: user.id,
        category: 'general',
        title: actionTitle.trim(),
        description: actionDescription.trim() || null,
        due_date: actionDueDate || null,
        priority: actionPriority,
        status: 'pending',
        metadata: { source: 'mydatamed_concierge_professional' },
      })
      if (error) throw error

      await supabase.from('concierge_request_events').insert({
        request_id: request.id,
        patient_id: request.patient_id,
        actor_user_id: user.id,
        actor_role: staff.role,
        event_type: 'action_created',
        visibility: 'patient',
        message: `Próximo passo registrado: ${actionTitle.trim()}`,
        payload: { due_date: actionDueDate || null, priority: actionPriority },
      })

      setActionTitle('')
      setActionDescription('')
      setActionDueDate('')
      setActionPriority('normal')
      toast.success('Próximo passo criado')
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível criar a ação.')
    } finally {
      setBusy(false)
    }
  }

  async function updateRequestStatus(status: string, message: string, visibility: 'patient' | 'staff_only' = 'patient') {
    if (!user || !request) return
    setBusy(true)
    try {
      const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
      if (status === 'in_triage') patch.triaged_at = new Date().toISOString()
      if (status === 'escalated_medical') patch.escalated_at = new Date().toISOString()
      if (status === 'resolved') patch.resolved_at = new Date().toISOString()

      const { error } = await supabase.from('concierge_requests').update(patch).eq('id', request.id)
      if (error) throw error

      await supabase.from('concierge_request_events').insert({
        request_id: request.id,
        patient_id: request.patient_id,
        actor_user_id: user.id,
        actor_role: staff.role,
        event_type: `status_${status}`,
        visibility,
        message,
        payload: { status },
      })

      toast.success('Status atualizado')
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar o caso.')
    } finally {
      setBusy(false)
    }
  }

  async function saveReview(status: 'draft' | 'ready_for_physician' | 'completed') {
    if (!user || !request) return
    if (status === 'completed' && !canPublish) {
      toast.error('A conclusão clínica visível ao paciente exige médico habilitado.')
      return
    }

    setBusy(true)
    try {
      const payload = {
        request_id: request.id,
        patient_id: request.patient_id,
        review_type: ['second_analysis', 'exam_review', 'medication_review'].includes(request.category) ? request.category : 'medical_review',
        status,
        patient_visible: status === 'completed',
        case_summary: caseSummary.trim() || null,
        relevant_findings: relevantFindings.trim() || null,
        points_to_consider: pointsToConsider.trim() || null,
        uncertainties: uncertainties.trim() || null,
        recommendations: recommendations.trim() || null,
        next_steps: nextSteps.trim() || null,
        questions_for_patient: questionsForPatient.trim() || null,
        metadata: { source: 'mydatamed_concierge_professional_v2' },
      }

      const { data, error } = await supabase
        .from('concierge_clinical_reviews')
        .upsert(payload, { onConflict: 'request_id' })
        .select('*')
        .single()
      if (error) throw error
      setReview(data)

      if (status === 'ready_for_physician') {
        await updateRequestStatus('escalated_medical', 'O caso foi estruturado pela equipe e encaminhado para revisão médica.', 'patient')
      } else if (status === 'completed') {
        await updateRequestStatus('action_plan', 'A revisão profissional foi concluída. Os próximos passos estão sendo coordenados.', 'patient')
      } else {
        toast.success('Rascunho da revisão salvo')
        await load()
      }
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível salvar a revisão.')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading || loading) return <div className="min-h-[65vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>

  if (!staff?.active || !request) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <Link href="/concierge/profissional" className="inline-flex items-center gap-2 text-sm text-gray-600"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-bold text-amber-950">Caso indisponível</p>
          <p className="mt-2 text-sm text-amber-900/80">Seu perfil não possui autorização para abrir este caso, ou o caso deixou de estar disponível.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <Link href={`/concierge/profissional/paciente/${request.patient_id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> {patientName}</Link>

      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-teal-950 to-emerald-900 p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1.5">{statusLabels[request.status] || request.status}</span>
              <span className={`rounded-full px-3 py-1.5 ${request.urgency === 'urgent_redirect' ? 'bg-red-400/20 text-red-100' : request.urgency === 'priority' ? 'bg-amber-300/20 text-amber-100' : 'bg-emerald-400/15 text-emerald-100'}`}>{request.urgency === 'urgent_redirect' ? 'Redirecionamento urgente' : request.urgency === 'priority' ? 'Prioridade' : 'Rotina'}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">{roleLabels[staff.role] || staff.role}</span>
            </div>
            <p className="mt-4 text-sm text-white/60">{patientName}</p>
            <h1 className="mt-1 text-3xl md:text-4xl font-bold">{request.title}</h1>
            <p className="mt-3 max-w-3xl text-white/75">{request.description}</p>
            {canOpenExternalCoordination && (
              <Link
                href={'/concierge/profissional/coordenacao?patient=' + encodeURIComponent(request.patient_id) + '&name=' + encodeURIComponent(patientName) + '&request=' + encodeURIComponent(request.id)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-slate-950"
              >
                <CalendarCheck className="w-4 h-4" /> Abrir coordenação externa
              </Link>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 min-w-[240px]">
            <p className="text-xs text-white/60">Próximo passo aberto</p>
            <p className="mt-1 font-bold">{nextOpenAction?.title || 'Ainda não definido'}</p>
            {nextOpenAction?.due_date && <p className="mt-1 text-xs text-white/60">Prazo: {new Date(nextOpenAction.due_date).toLocaleDateString('pt-BR')}</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 w-5 h-5 shrink-0 text-blue-700" />
              <div className="flex-1">
                <h2 className="font-bold text-blue-950">Contexto clínico autorizado</h2>
                <p className="mt-1 text-xs leading-relaxed text-blue-900/75">Os dados não são carregados automaticamente. Abra o contexto somente quando necessário para este caso. O acesso continua sujeito a consentimento e auditoria.</p>
                {!context && <button onClick={loadAuthorizedContext} disabled={contextLoading} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{contextLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Carregar contexto autorizado</button>}
                {context && <button onClick={loadAuthorizedContext} disabled={contextLoading} className="mt-3 text-xs font-bold text-blue-700">Atualizar contexto</button>}
              </div>
            </div>

            {context && (
              <div className="mt-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MiniMetric icon={FileHeart} label="MedScore" value={context?.medscore?.score ?? '—'} />
                  <MiniMetric icon={Activity} label="Dados contínuos" value={contextDevices.length ? `${contextDevices.length}d` : '—'} />
                </div>

                {latestDevice && <div className="rounded-2xl bg-white p-3 text-xs text-gray-600"><p className="font-bold text-gray-800">Último resumo de dispositivo</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{latestDevice.summary_date && <span>{latestDevice.summary_date}</span>}{latestDevice.steps != null && <span>{latestDevice.steps} passos</span>}{latestDevice.sleep_minutes != null && <span>{latestDevice.sleep_minutes} min sono</span>}{latestDevice.avg_heart_rate != null && <span>FC {latestDevice.avg_heart_rate}</span>}{latestDevice.weight_kg != null && <span>{latestDevice.weight_kg} kg</span>}</div></div>}

                {contextMedications.length > 0 && <div className="rounded-2xl bg-white p-3"><div className="flex items-center gap-2 text-sm font-bold text-gray-900"><Pill className="w-4 h-4 text-violet-700" /> Medicamentos ativos</div><div className="mt-2 space-y-2">{contextMedications.slice(0, 10).map((item: any) => <div key={item.id} className="rounded-xl bg-violet-50 p-2.5 text-xs"><p className="font-semibold">{item.name}</p><p className="mt-1 text-gray-500">{[item.dosage, item.frequency].filter(Boolean).join(' · ') || 'Sem posologia estruturada'}</p></div>)}</div></div>}

                {contextExams.length > 0 && <div className="rounded-2xl bg-white p-3"><div className="flex items-center gap-2 text-sm font-bold text-gray-900"><FileText className="w-4 h-4 text-teal-700" /> Exames vinculados</div><div className="mt-2 space-y-2">{contextExams.map((item: any) => <div key={item.id} className="rounded-xl bg-teal-50 p-2.5 text-xs"><p className="font-semibold">{item.exam_type || item.file_name || 'Exame'}</p><p className="mt-1 text-gray-500">{[item.exam_date, item.laboratory].filter(Boolean).join(' · ')}</p></div>)}</div></div>}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Target className="w-5 h-5 text-emerald-700" /><h2 className="font-bold text-gray-900">Criar próximo passo</h2></div>
            <div className="mt-4 space-y-3">
              <input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} placeholder="Ex.: agendar ultrassom" className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm" />
              <textarea value={actionDescription} onChange={(e) => setActionDescription(e.target.value)} placeholder="Detalhes, preparo, preferência, prestador, documentação..." rows={3} className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={actionDueDate} onChange={(e) => setActionDueDate(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-3 text-sm" />
                <select value={actionPriority} onChange={(e) => setActionPriority(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option></select>
              </div>
              <button onClick={addAction} disabled={busy || !actionTitle.trim()} className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Adicionar ao plano</button>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-emerald-700" /><h2 className="font-bold text-gray-900">Registrar comunicação</h2></div>
            <div className="mt-4 space-y-3">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Mensagem, tentativa de contato, informação recebida, orientação operacional..." className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm" />
              <select value={noteVisibility} onChange={(e) => setNoteVisibility(e.target.value as 'patient' | 'staff_only')} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"><option value="staff_only">Nota interna da equipe</option><option value="patient">Visível ao paciente</option></select>
              <button onClick={addEvent} disabled={busy || !note.trim()} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 disabled:opacity-50">Registrar</button>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              {canPublish ? <Stethoscope className="mt-0.5 w-5 h-5 text-emerald-700" /> : <ClipboardList className="mt-0.5 w-5 h-5 text-emerald-700" />}
              <div><h2 className="font-bold text-gray-900">Revisão estruturada do caso</h2><p className="mt-1 text-xs text-gray-500">{canPublish ? 'Revise o caso, registre a decisão profissional e publique o que for adequado ao paciente.' : 'Estruture contexto, lacunas e próximos passos. A conclusão clínica visível ao paciente fica para o médico.'}</p></div>
            </div>

            {review?.status && <div className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Status: {review.status}</div>}

            <div className="mt-4 grid gap-3">
              <Field label="Resumo do caso" value={caseSummary} onChange={setCaseSummary} placeholder="Motivo, evolução e contexto relevante para esta necessidade." />
              <Field label="Achados relevantes" value={relevantFindings} onChange={setRelevantFindings} placeholder="Dados pertinentes observados ou trazidos pelo paciente/documentos." />
              <Field label="Pontos a considerar" value={pointsToConsider} onChange={setPointsToConsider} placeholder="Aspectos que merecem avaliação profissional." />
              <Field label="Incertezas / informações faltantes" value={uncertainties} onChange={setUncertainties} placeholder="O que ainda não está claro ou precisa ser obtido?" />
              <Field label="Orientações / decisão profissional" value={recommendations} onChange={setRecommendations} placeholder="Registrar somente dentro do escopo e da responsabilidade profissional." />
              <Field label="Próximos passos" value={nextSteps} onChange={setNextSteps} placeholder="Exames, retorno, encaminhamento, monitoramento ou outra ação." />
              <Field label="Perguntas ao paciente" value={questionsForPatient} onChange={setQuestionsForPatient} placeholder="Informações que ainda precisam ser coletadas." />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button onClick={() => saveReview('draft')} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold disabled:opacity-50"><Save className="w-4 h-4" /> Salvar rascunho</button>
              {!canPublish && <button onClick={() => saveReview('ready_for_physician')} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-xs font-bold text-white disabled:opacity-50"><Send className="w-4 h-4" /> Enviar ao médico</button>}
              {canPublish && <button onClick={() => saveReview('completed')} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="w-4 h-4" /> Concluir e publicar</button>}
              {canCoordinate && request.status === 'new' && <button onClick={() => updateRequestStatus('in_triage', 'A equipe Concierge iniciou a organização deste caso.', 'patient')} disabled={busy} className="rounded-xl border px-4 py-3 text-xs font-bold disabled:opacity-50">Iniciar triagem</button>}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Target className="w-5 h-5 text-emerald-700" /><h2 className="font-bold text-gray-900">Plano de ação do caso</h2></div><span className="text-xs text-gray-500">{actions.length}</span></div>
            <div className="mt-4 space-y-2">
              {actions.length === 0 && <Empty text="Nenhuma ação registrada para este caso." />}
              {actions.map((item) => <div key={item.id} className="rounded-2xl border bg-gray-50 p-3"><div className="flex items-start gap-2"><CheckCircle2 className={`mt-0.5 w-4 h-4 ${item.status === 'completed' ? 'text-emerald-600' : 'text-gray-400'}`} /><div><p className="text-sm font-semibold text-gray-900">{item.title}</p><p className="mt-1 text-xs text-gray-500">{item.status}{item.due_date ? ` · prazo ${new Date(item.due_date).toLocaleDateString('pt-BR')}` : ''}</p></div></div></div>)}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-emerald-700" /><h2 className="font-bold text-gray-900">Timeline do caso</h2></div><span className="text-xs text-gray-500">{events.length}</span></div>
            <div className="mt-4 space-y-1">
              {events.length === 0 && <Empty text="Nenhum evento registrado." />}
              {events.map((item) => <div key={item.id} className="border-l-2 border-emerald-200 py-2 pl-4"><div className="flex flex-wrap gap-2 text-[11px] text-gray-500"><span>{formatDateTime(item.created_at)}</span><span>·</span><span>{roleLabels[item.actor_role] || item.actor_role}</span>{item.visibility === 'staff_only' && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">interno</span>}</div><p className="mt-1 text-sm text-gray-800">{item.message || item.event_type}</p></div>)}
            </div>
          </section>

          {request.urgency === 'urgent_redirect' && (
            <section className="rounded-3xl border border-red-200 bg-red-50 p-5">
              <div className="flex gap-3"><AlertTriangle className="mt-0.5 w-5 h-5 shrink-0 text-red-700" /><div><p className="font-bold text-red-950">Redirecionamento urgente</p><p className="mt-1 text-sm leading-relaxed text-red-900/80">O Concierge não substitui urgência ou emergência. O fluxo deve priorizar orientação de busca de atendimento apropriado e registrar a continuidade depois do evento.</p></div></div>
            </section>
          )}
        </div>
      </section>
    </main>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="text-xs font-semibold text-gray-700">{label}<textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder} className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-900" /></label>
}

function MiniMetric({ icon: Icon, label, value }: any) {
  return <div className="rounded-2xl bg-white p-3"><div className="flex items-center gap-1 text-xs text-gray-600"><Icon className="w-4 h-4" /> {label}</div><p className="mt-1 text-xl font-bold text-gray-900">{value}</p></div>
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed bg-gray-50 p-5 text-center text-sm text-gray-500">{text}</div>
}
