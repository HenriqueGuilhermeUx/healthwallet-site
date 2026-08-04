'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Brain,
  CheckCircle,
  ClipboardList,
  FileText,
  Loader2,
  Mic,
  MicOff,
  PauseCircle,
  PlayCircle,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Square,
  Stethoscope,
  UserPlus,
  Users,
  Wand2,
} from 'lucide-react'

const emptyVisitForm = {
  patient_mode: 'guest',
  appointment_id: '',
  patient_user_id: '',
  patient_name: '',
  patient_email: '',
  patient_phone: '',
  specialty: 'Clínica geral',
  reason: '',
  consent_audio_recording: false,
  consent_ai_transcription: false,
  consent_ai_support: false,
  ai_disclaimer_ack: false,
}

const emptySoap = {
  soap_subjective: '',
  soap_objective: '',
  soap_assessment: '',
  soap_plan: '',
  summary_text: '',
}

type AiCard = {
  id?: string
  type: string
  title: string
  content: string
  severity: 'info' | 'warning' | 'critical'
}

export default function ConsultaAssistidaPage() {
  const { user, session, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const recognitionRef = useRef<any>(null)
  const shouldListenRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [visits, setVisits] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [activeVisit, setActiveVisit] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [recording, setRecording] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(emptyVisitForm)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [cards, setCards] = useState<AiCard[]>([])
  const [soap, setSoap] = useState<any>(emptySoap)
  const [doctorObservations, setDoctorObservations] = useState('')
  const [finalNote, setFinalNote] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (professional) loadData()
  }, [professional])

  const stats = useMemo(() => ({
    total: visits.length,
    inProgress: visits.filter((visit) => ['in_progress', 'paused'].includes(visit.status)).length,
    completed: visits.filter((visit) => ['completed', 'signed'].includes(visit.status)).length,
  }), [visits])

  async function loadData() {
    if (!professional || !user) return
    setLoading(true)

    const [visitsRes, appointmentsRes] = await Promise.all([
      supabase
        .from('clinical_visits')
        .select('*')
        .eq('professional_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('telemedicine_appointments')
        .select('id, patient_id, user_id, patient_name, patient_email, specialty, reason, preferred_date, preferred_time, status')
        .eq('professional_id', professional.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (visitsRes.error) {
      toast.error('Rode SQL_COPILOTO_ATENDIMENTO_V1.sql no Supabase para ativar a Consulta Assistida.')
    }

    setVisits(visitsRes.data || [])
    setAppointments(appointmentsRes.data || [])

    if (!activeVisit && visitsRes.data?.[0]) selectVisit(visitsRes.data[0])
    setLoading(false)
  }

  async function selectVisit(visit: any) {
    setActiveVisit(visit)
    setTranscript(visit.transcript_text || '')
    setDoctorObservations(visit.doctor_observations || '')
    setFinalNote(visit.final_note || '')
    setSoap({
      soap_subjective: visit.soap_subjective || '',
      soap_objective: visit.soap_objective || '',
      soap_assessment: visit.soap_assessment || '',
      soap_plan: visit.soap_plan || '',
      summary_text: visit.summary_text || '',
    })

    const { data } = await supabase
      .from('clinical_ai_cards')
      .select('*')
      .eq('visit_id', visit.id)
      .order('created_at', { ascending: false })
      .limit(8)

    setCards(data || [])
  }

  function applyAppointment(id: string) {
    const selected = appointments.find((item) => item.id === id)
    if (!selected) {
      setForm({ ...form, appointment_id: id })
      return
    }

    setForm({
      ...form,
      appointment_id: id,
      patient_mode: 'healthwallet',
      patient_user_id: selected.patient_id || selected.user_id || '',
      patient_name: selected.patient_name || '',
      patient_email: selected.patient_email || '',
      specialty: selected.specialty || form.specialty,
      reason: selected.reason || form.reason,
    })
  }

  async function createVisit() {
    if (!user || !professional) return
    if (!form.patient_name && !form.patient_user_id) {
      toast.error('Informe o paciente ou vincule uma teleconsulta')
      return
    }
    if (!form.consent_audio_recording || !form.consent_ai_transcription || !form.consent_ai_support || !form.ai_disclaimer_ack) {
      toast.error('Confirme os consentimentos para gravação/transcrição e uso da IA como apoio')
      return
    }

    setCreating(true)

    try {
      let guestPatientId = null
      const patientMode = form.patient_mode

      if (patientMode === 'guest') {
        const { data: guest, error: guestError } = await supabase
          .from('guest_patients')
          .insert({
            professional_id: professional.id,
            professional_user_id: user.id,
            name: form.patient_name,
            email: form.patient_email || null,
            phone: form.patient_phone || null,
            metadata: { created_from: 'consulta_assistida' },
          })
          .select('*')
          .single()

        if (guestError) throw guestError
        guestPatientId = guest.id
      }

      const { data: visit, error } = await supabase
        .from('clinical_visits')
        .insert({
          professional_id: professional.id,
          professional_user_id: user.id,
          appointment_id: form.appointment_id || null,
          patient_user_id: patientMode === 'healthwallet' ? form.patient_user_id || null : null,
          guest_patient_id: guestPatientId,
          patient_name: form.patient_name || null,
          patient_email: form.patient_email || null,
          patient_phone: form.patient_phone || null,
          specialty: form.specialty || professional.specialty || 'Clínica geral',
          reason: form.reason || null,
          status: 'draft',
          data_scope: patientMode === 'healthwallet' ? 'healthwallet_authorized' : 'visit_only',
          consent_audio_recording: form.consent_audio_recording,
          consent_ai_transcription: form.consent_ai_transcription,
          consent_ai_support: form.consent_ai_support,
          ai_disclaimer_ack: form.ai_disclaimer_ack,
          metadata: {
            patient_mode: patientMode,
            ai_policy: 'support_only_physician_final_decision',
            audio_storage: 'not_stored_in_mvp_browser_transcript_only',
          },
        })
        .select('*')
        .single()

      if (error) throw error

      toast.success('Atendimento assistido criado')
      setShowForm(false)
      setForm(emptyVisitForm)
      setActiveVisit(visit)
      setTranscript('')
      setCards([])
      setSoap(emptySoap)
      setDoctorObservations('')
      setFinalNote('')
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar atendimento. Rode o SQL do Copiloto no Supabase.')
    } finally {
      setCreating(false)
    }
  }

  async function updateVisitStatus(status: string, extra: any = {}) {
    if (!activeVisit || !user) return
    const payload = { status, updated_at: new Date().toISOString(), ...extra }
    await supabase.from('clinical_visits').update(payload).eq('id', activeVisit.id).eq('professional_user_id', user.id)
    setActiveVisit({ ...activeVisit, ...payload })
  }

  async function startDictation() {
    if (!activeVisit) {
      toast.error('Crie ou selecione um atendimento')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechSupported(false)
      toast.error('Reconhecimento de voz não suportado neste navegador. Use digitação manual ou Chrome/Edge.')
      return
    }

    shouldListenRef.current = true
    const recognition = new SpeechRecognition()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = async (event: any) => {
      let interim = ''
      let finalText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += `${result[0].transcript} `
        else interim += result[0].transcript
      }

      setInterimTranscript(interim)

      if (finalText.trim()) {
        const clean = finalText.trim()
        setTranscript((current) => [current, clean].filter(Boolean).join('\n'))
        await saveTranscriptSegment(clean)
      }
    }

    recognition.onerror = () => {
      setRecording(false)
    }

    recognition.onend = () => {
      if (shouldListenRef.current) {
        try { recognition.start() } catch {}
      } else {
        setRecording(false)
      }
    }

    recognitionRef.current = recognition
    await updateVisitStatus('in_progress', { started_at: activeVisit.started_at || new Date().toISOString() })
    recognition.start()
    setRecording(true)
    toast.success('Transcrição por voz iniciada')
  }

  function pauseDictation() {
    shouldListenRef.current = false
    recognitionRef.current?.stop?.()
    setRecording(false)
    updateVisitStatus('paused')
  }

  async function saveTranscriptSegment(text: string) {
    if (!activeVisit || !session?.access_token || !text.trim()) return

    const response = await fetch('/api/clinical/copilot/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ visit_id: activeVisit.id, text, speaker: 'unknown', language: 'pt-BR' }),
    })

    const payload = await response.json().catch(() => ({}))
    if (response.ok && payload.transcript_text) {
      setActiveVisit((current: any) => ({ ...current, transcript_text: payload.transcript_text, status: 'in_progress' }))
    }
  }

  async function saveManualTranscript() {
    if (!activeVisit || !user) return
    await supabase
      .from('clinical_visits')
      .update({ transcript_text: transcript, updated_at: new Date().toISOString() })
      .eq('id', activeVisit.id)
      .eq('professional_user_id', user.id)
    setActiveVisit({ ...activeVisit, transcript_text: transcript })
    toast.success('Transcrição salva')
  }

  async function analyze(mode: 'partial' | 'final' = 'partial') {
    if (!activeVisit || !session?.access_token) return
    if (!transcript.trim()) {
      toast.error('Inclua transcrição antes de analisar')
      return
    }

    setAnalyzing(true)
    await saveManualTranscript()

    const response = await fetch('/api/clinical/copilot/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ visit_id: activeVisit.id, transcript_text: transcript, mode }),
    })

    const payload = await response.json().catch(() => ({}))
    setAnalyzing(false)

    if (!response.ok) {
      toast.error(payload.error || 'Erro ao analisar consulta')
      return
    }

    setCards(payload.cards || [])
    if (payload.soap) setSoap(payload.soap)
    if (mode === 'final') toast.success('Resumo SOAP preparado para revisão médica')
    else toast.success('Cards atualizados')
  }

  async function finalizeVisit(signed: boolean) {
    if (!activeVisit || !session?.access_token) return
    setSaving(true)

    const response = await fetch('/api/clinical/copilot/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        visit_id: activeVisit.id,
        ...soap,
        doctor_observations: doctorObservations,
        final_note: finalNote,
        signed_by_doctor: signed,
      }),
    })

    const payload = await response.json().catch(() => ({}))
    setSaving(false)

    if (!response.ok) {
      toast.error(payload.error || 'Erro ao finalizar atendimento')
      return
    }

    setActiveVisit(payload.visit)
    toast.success(signed ? 'Atendimento revisado e assinado' : 'Atendimento salvo')
    loadData()
  }

  if (authLoading || !professional) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800 mb-3">
            <Brain className="w-4 h-4" /> Copiloto de Atendimento — Fases 1 e 2
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Consulta Assistida por Voz</h1>
          <p className="text-gray-600 mt-1">Transcreva a consulta, receba cards de apoio, gere SOAP e salve a nota revisada pelo médico.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/teleconsultas" className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200 px-5 py-3 text-cyan-700 font-semibold hover:bg-cyan-50">
            Teleconsultas
          </Link>
          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 text-white px-5 py-3 font-semibold hover:bg-violet-800">
            <Plus className="w-5 h-5" /> Novo atendimento
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 flex gap-3">
        <ShieldCheck className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <p><strong>Uso supervisionado:</strong> a IA organiza a conversa, sugere perguntas e prepara rascunhos. Ela não diagnostica, não prescreve e não substitui o julgamento do médico. A nota final deve ser revisada e validada pelo profissional.</p>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Atendimentos" value={stats.total} />
        <Stat label="Em andamento" value={stats.inProgress} />
        <Stat label="Finalizados" value={stats.completed} />
      </div>

      {showForm && (
        <section className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-4">
          <h2 className="font-bold text-lg">Criar atendimento assistido</h2>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="rounded-2xl border p-4 flex gap-3 items-start cursor-pointer">
              <input type="radio" checked={form.patient_mode === 'guest'} onChange={() => setForm({ ...form, patient_mode: 'guest', patient_user_id: '', appointment_id: '' })} className="mt-1" />
              <span><strong>Paciente avulso</strong><br /><span className="text-sm text-gray-600">Não usa HealthWallet ou não compartilhou dados. A IA usa só este atendimento.</span></span>
            </label>
            <label className="rounded-2xl border p-4 flex gap-3 items-start cursor-pointer">
              <input type="radio" checked={form.patient_mode === 'healthwallet'} onChange={() => setForm({ ...form, patient_mode: 'healthwallet' })} className="mt-1" />
              <span><strong>Paciente HealthWallet</strong><br /><span className="text-sm text-gray-600">Use uma teleconsulta ou ID autorizado para conectar dados compartilhados.</span></span>
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Vincular teleconsulta existente opcional</label>
            <select value={form.appointment_id} onChange={(e) => applyAppointment(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-violet-500/20">
              <option value="">Sem vínculo de teleconsulta</option>
              {appointments.map((item) => <option key={item.id} value={item.id}>{formatDate(item.preferred_date)} {String(item.preferred_time || '').slice(0, 5)} • {item.patient_name || item.patient_id || item.user_id} • {item.specialty}</option>)}
            </select>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Input label="Nome do paciente" value={form.patient_name} onChange={(value: string) => setForm({ ...form, patient_name: value })} />
            <Input label="E-mail" value={form.patient_email} onChange={(value: string) => setForm({ ...form, patient_email: value })} />
            <Input label="Telefone" value={form.patient_phone} onChange={(value: string) => setForm({ ...form, patient_phone: value })} />
          </div>

          {form.patient_mode === 'healthwallet' && <Input label="Patient User ID HealthWallet" value={form.patient_user_id} onChange={(value: string) => setForm({ ...form, patient_user_id: value })} placeholder="UUID do paciente autorizado" />}

          <div className="grid md:grid-cols-2 gap-3">
            <Input label="Especialidade" value={form.specialty} onChange={(value: string) => setForm({ ...form, specialty: value })} />
            <Input label="Motivo/queixa inicial" value={form.reason} onChange={(value: string) => setForm({ ...form, reason: value })} />
          </div>

          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 space-y-2 text-sm text-violet-950">
            <Check label="Paciente autorizou gravação/transcrição do atendimento" checked={form.consent_audio_recording} onChange={(value: boolean) => setForm({ ...form, consent_audio_recording: value })} />
            <Check label="Paciente autorizou transcrição automática por IA/ferramenta digital" checked={form.consent_ai_transcription} onChange={(value: boolean) => setForm({ ...form, consent_ai_transcription: value })} />
            <Check label="Profissional autoriza uso da IA como apoio durante o atendimento" checked={form.consent_ai_support} onChange={(value: boolean) => setForm({ ...form, consent_ai_support: value })} />
            <Check label="Entendo que a IA é apoio; revisão, conduta e assinatura são do médico" checked={form.ai_disclaimer_ack} onChange={(value: boolean) => setForm({ ...form, ai_disclaimer_ack: value })} />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border font-medium">Cancelar</button>
            <button onClick={createVisit} disabled={creating} className="flex-1 py-3 rounded-xl bg-violet-700 text-white font-semibold disabled:opacity-60">
              {creating ? 'Criando...' : 'Criar atendimento'}
            </button>
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <aside className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 h-fit">
          <h2 className="font-bold mb-3">Atendimentos recentes</h2>
          {loading ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-violet-700" /></div> : visits.length > 0 ? (
            <div className="space-y-2">
              {visits.map((visit) => (
                <button key={visit.id} onClick={() => selectVisit(visit)} className={`w-full text-left rounded-xl border p-3 hover:bg-violet-50 ${activeVisit?.id === visit.id ? 'border-violet-500 bg-violet-50' : 'border-gray-100'}`}>
                  <p className="font-semibold text-sm">{visit.patient_name || 'Paciente sem nome'}</p>
                  <p className="text-xs text-gray-500 mt-1">{visit.specialty || 'Consulta'} • {translateStatus(visit.status)}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(visit.created_at)}</p>
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">Nenhum atendimento assistido ainda.</p>}
        </aside>

        <main className="space-y-6">
          {!activeVisit ? (
            <section className="bg-white rounded-2xl shadow-lg border border-gray-100 p-10 text-center">
              <Stethoscope className="w-12 h-12 text-violet-700 mx-auto mb-4" />
              <h2 className="font-bold text-lg">Selecione ou crie um atendimento</h2>
              <p className="text-sm text-gray-600 mt-2">Depois, inicie a transcrição por voz ou cole texto manualmente.</p>
            </section>
          ) : (
            <>
              <section className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{activeVisit.patient_name || 'Paciente'}</h2>
                    <p className="text-sm text-gray-600">{activeVisit.specialty || 'Consulta'} • {activeVisit.reason || 'sem motivo inicial'} • {translateStatus(activeVisit.status)}</p>
                    <p className="text-xs text-gray-500 mt-1">Escopo: {activeVisit.data_scope === 'healthwallet_authorized' ? 'dados HealthWallet autorizados + consulta' : 'somente dados deste atendimento'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!recording ? (
                      <button onClick={startDictation} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-white font-semibold hover:bg-red-700"><Mic className="w-4 h-4" /> Iniciar voz</button>
                    ) : (
                      <button onClick={pauseDictation} className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-white font-semibold"><PauseCircle className="w-4 h-4" /> Pausar</button>
                    )}
                    <button onClick={() => analyze('partial')} disabled={analyzing} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 px-4 py-2 text-violet-700 font-semibold hover:bg-violet-50 disabled:opacity-60"><Wand2 className="w-4 h-4" /> Cards IA</button>
                    <button onClick={() => analyze('final')} disabled={analyzing} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-white font-semibold hover:bg-violet-800 disabled:opacity-60"><Sparkles className="w-4 h-4" /> Gerar SOAP</button>
                  </div>
                </div>

                {!speechSupported && <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">Seu navegador não suporta Web Speech API. Use o campo de transcrição manual ou Chrome/Edge.</p>}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-700">Transcrição da consulta</label>
                    <button onClick={saveManualTranscript} className="text-sm text-violet-700 font-semibold hover:underline">Salvar transcrição</button>
                  </div>
                  <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} className="w-full min-h-[260px] rounded-2xl border border-gray-200 p-4 text-sm outline-none focus:ring-2 focus:ring-violet-500/20" placeholder="A transcrição por voz aparecerá aqui. Você também pode digitar ou colar manualmente." />
                  {interimTranscript && <p className="mt-2 text-xs text-gray-500"><Mic className="w-3 h-3 inline mr-1" />Ouvindo: {interimTranscript}</p>}
                </div>
              </section>

              <section className="grid xl:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-4"><Brain className="w-5 h-5 text-violet-700" /><h2 className="font-bold">Cards de apoio durante a consulta</h2></div>
                  {analyzing ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-violet-700" /></div> : cards.length > 0 ? (
                    <div className="space-y-3">
                      {cards.map((card, index) => <AiCardView key={card.id || index} card={card} />)}
                    </div>
                  ) : <p className="text-sm text-gray-500">Clique em “Cards IA” para gerar perguntas sugeridas, dados ausentes e pontos de atenção.</p>}
                </div>

                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 space-y-4">
                  <div className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-emerald-700" /><h2 className="font-bold">Resumo SOAP para revisão</h2></div>
                  <SoapField label="S — Subjetivo" value={soap.soap_subjective} onChange={(value: string) => setSoap({ ...soap, soap_subjective: value })} />
                  <SoapField label="O — Objetivo" value={soap.soap_objective} onChange={(value: string) => setSoap({ ...soap, soap_objective: value })} />
                  <SoapField label="A — Avaliação" value={soap.soap_assessment} onChange={(value: string) => setSoap({ ...soap, soap_assessment: value })} />
                  <SoapField label="P — Plano" value={soap.soap_plan} onChange={(value: string) => setSoap({ ...soap, soap_plan: value })} />
                </div>
              </section>

              <section className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 space-y-4">
                <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-slate-700" /><h2 className="font-bold">Observações e finalização médica</h2></div>
                <textarea value={doctorObservations} onChange={(e) => setDoctorObservations(e.target.value)} className="w-full min-h-[120px] rounded-2xl border border-gray-200 p-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Observações próprias do médico, justificativas, conduta validada, recomendações e retorno." />
                <textarea value={finalNote} onChange={(e) => setFinalNote(e.target.value)} className="w-full min-h-[120px] rounded-2xl border border-gray-200 p-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Nota final opcional. Se vazio, o sistema monta a nota a partir do SOAP + observações." />
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
                  Ao salvar/assinar, o uso da IA é registrado em auditoria como ferramenta de apoio. A decisão final permanece com o médico.
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => finalizeVisit(false)} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 px-4 py-3 text-emerald-700 font-semibold hover:bg-emerald-50 disabled:opacity-60"><Save className="w-4 h-4" /> Salvar revisado</button>
                  <button onClick={() => finalizeVisit(true)} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-white font-semibold hover:bg-emerald-800 disabled:opacity-60"><CheckCircle className="w-4 h-4" /> Revisar e assinar</button>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm"><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold text-gray-900 mt-1">{value}</p></div>
}

function Input({ label, value, onChange, placeholder }: any) {
  return <div><label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-violet-500/20" /></div>
}

function Check({ label, checked, onChange }: any) {
  return <label className="flex items-start gap-3"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" /><span>{label}</span></label>
}

function SoapField({ label, value, onChange }: any) {
  return <div><label className="text-sm font-semibold text-gray-700 mb-1 block">{label}</label><textarea value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-h-[90px] rounded-xl border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" /></div>
}

function AiCardView({ card }: { card: AiCard }) {
  const styles: Record<string, string> = {
    info: 'border-blue-200 bg-blue-50 text-blue-950',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    critical: 'border-red-200 bg-red-50 text-red-950',
  }
  const Icon = card.severity === 'critical' ? AlertTriangle : card.type === 'suggested_question' ? Users : card.type === 'missing_data' ? UserPlus : Brain
  return <div className={`rounded-2xl border p-4 ${styles[card.severity] || styles.info}`}><div className="flex gap-3"><Icon className="w-5 h-5 mt-0.5 flex-shrink-0" /><div><p className="font-bold">{card.title}</p><p className="text-sm mt-1 opacity-90">{card.content}</p><p className="text-[11px] mt-2 uppercase tracking-wide opacity-60">{translateCardType(card.type)}</p></div></div></div>
}

function translateStatus(status: string) {
  const map: Record<string, string> = { draft: 'rascunho', in_progress: 'em andamento', paused: 'pausado', completed: 'concluído', signed: 'assinado', cancelled: 'cancelado' }
  return map[status] || status
}

function translateCardType(type: string) {
  const map: Record<string, string> = { missing_data: 'dado ausente', suggested_question: 'pergunta sugerida', attention_point: 'ponto de atenção', summary: 'resumo parcial', medication_safety: 'segurança medicamentosa', next_action: 'próxima ação' }
  return map[type] || type
}

function formatDate(date: string) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('pt-BR')
}
