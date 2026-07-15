'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  Bell,
  CalendarDays,
  CheckCircle,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  PlayCircle,
  Plus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  StopCircle,
  User,
  Video,
  Wallet,
  XCircle,
} from 'lucide-react'

const DEFAULT_PERMISSIONS = {
  summary: true,
  exams: true,
  medications: true,
  timeline: true,
  passport: true,
  medscore: true,
}

const emptyNotes = { orientation: '', prescription: '', professional: '' }

export default function TeleconsultasPage() {
  const { user, session, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [appointments, setAppointments] = useState<any[]>([])
  const [recentPatients, setRecentPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [roomLinks, setRoomLinks] = useState<Record<string, string>>({})
  const [chargeAmounts, setChargeAmounts] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, typeof emptyNotes>>({})

  const [form, setForm] = useState({
    patient_id: '',
    patient_name: '',
    patient_email: '',
    specialty: professional?.specialty || 'Clínica geral',
    reason: '',
    preferred_date: '',
    preferred_time: '',
    duration_minutes: '30',
    room_url: '',
    charge_amount: '150',
    auto_charge: true,
  })

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (professional) {
      load()
      loadRecentPatients()
    }
  }, [professional])

  async function load() {
    if (!professional) return
    setLoading(true)

    const { data, error } = await supabase
      .from('telemedicine_appointments')
      .select('*')
      .or(`professional_id.eq.${professional.id},professional_id.is.null`)
      .order('preferred_date', { ascending: false })
      .order('preferred_time', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) toast.error('Erro ao carregar teleconsultas. Rode os SQLs de teleconsulta no Supabase.')

    const rows = data || []
    const nextRoomLinks: Record<string, string> = {}
    const nextNotes: Record<string, typeof emptyNotes> = {}
    const nextChargeAmounts: Record<string, string> = {}

    rows.forEach((item) => {
      nextRoomLinks[item.id] = item.room_url || item.meet_url || ''
      nextChargeAmounts[item.id] = item.payment_amount_cents ? String(item.payment_amount_cents / 100) : '150'
      nextNotes[item.id] = {
        orientation: item.orientation_text || '',
        prescription: item.prescription_text || '',
        professional: item.professional_notes || '',
      }
    })

    setAppointments(rows)
    setRoomLinks(nextRoomLinks)
    setNotes(nextNotes)
    setChargeAmounts(nextChargeAmounts)
    setLoading(false)
  }

  async function loadRecentPatients() {
    if (!professional) return

    const { data } = await supabase
      .from('access_codes')
      .select('id, code, patient_id, created_at, permissions')
      .eq('professional_id', professional.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const unique = new Map<string, any>()
    ;(data || []).forEach((item) => {
      if (item.patient_id && !unique.has(item.patient_id)) unique.set(item.patient_id, item)
    })

    setRecentPatients(Array.from(unique.values()))
  }

  async function logEvent(appointmentId: string, type: string, description: string, patientId?: string, metadata: any = {}) {
    if (!professional || !user) return

    await supabase.from('telemedicine_events').insert({
      appointment_id: appointmentId,
      actor_user_id: user.id,
      professional_id: professional.id,
      patient_id: patientId || null,
      type,
      description,
      metadata,
    })
  }

  async function upsertCrmContact({ patient_id, patient_name, patient_email, appointment_id }: any) {
    if (!professional || !user || !patient_id) return

    try {
      const { data: existing } = await supabase
        .from('professional_crm_contacts')
        .select('id')
        .eq('professional_user_id', user.id)
        .eq('patient_id', patient_id)
        .maybeSingle()

      if (existing?.id) {
        await supabase
          .from('professional_crm_contacts')
          .update({
            patient_name: patient_name || null,
            patient_email: patient_email || null,
            lifecycle_stage: 'patient',
            last_contact_at: new Date().toISOString(),
            metadata: { last_appointment_id: appointment_id },
          })
          .eq('id', existing.id)
        return
      }

      await supabase.from('professional_crm_contacts').insert({
        professional_user_id: user.id,
        patient_id,
        patient_name: patient_name || null,
        patient_email: patient_email || null,
        source: 'telemedicine',
        lifecycle_stage: 'patient',
        last_contact_at: new Date().toISOString(),
        metadata: { last_appointment_id: appointment_id },
      })
    } catch {
      // CRM pode ainda não estar ativado no Supabase.
    }
  }

  async function createAppointment() {
    if (!professional || !user) return

    if (!form.patient_id || !form.preferred_date || !form.preferred_time) {
      toast.error('Informe paciente, data e horário')
      return
    }

    const scheduledAt = `${form.preferred_date}T${form.preferred_time}:00-03:00`
    const now = new Date().toISOString()
    const payload = {
      user_id: form.patient_id,
      patient_id: form.patient_id,
      patient_name: form.patient_name || null,
      patient_email: form.patient_email || null,
      professional_id: professional.id,
      professional_name: professional.full_name,
      professional_email: user.email,
      specialty: form.specialty || professional.specialty || 'Clínica geral',
      reason: form.reason || null,
      preferred_date: form.preferred_date,
      preferred_time: form.preferred_time,
      scheduled_at: scheduledAt,
      duration_minutes: Number(form.duration_minutes || 30),
      status: 'scheduled',
      provider: form.room_url ? 'manual_link' : 'pending_daily',
      room_url: form.room_url || null,
      meet_url: form.room_url || null,
      professional_confirmed: true,
      professional_confirmed_at: now,
      shared_data_permissions: DEFAULT_PERMISSIONS,
      payment_status: 'not_required',
      payment_required: false,
      payment_amount_cents: form.auto_charge ? Math.round(Number(form.charge_amount || 0) * 100) : null,
      billing_metadata: form.auto_charge ? { auto_charge_on_schedule: true, powered_by: 'NextGen' } : {},
      created_at: now,
      updated_at: now,
    }

    const { data, error } = await supabase
      .from('telemedicine_appointments')
      .insert(payload)
      .select()
      .single()

    if (error) {
      toast.error(error.message || 'Erro ao agendar teleconsulta')
      return
    }

    await logEvent(data.id, 'appointment_scheduled', 'Profissional agendou teleconsulta.', data.patient_id, { scheduled_at: scheduledAt })
    await upsertCrmContact({ patient_id: form.patient_id, patient_name: form.patient_name, patient_email: form.patient_email, appointment_id: data.id })

    if (form.auto_charge) {
      await createNextGenCharge({ ...data, patient_name: form.patient_name, patient_email: form.patient_email }, form.charge_amount, true)
    } else {
      toast.success('Teleconsulta agendada')
    }

    setShowForm(false)
    setForm({
      patient_id: '',
      patient_name: '',
      patient_email: '',
      specialty: professional?.specialty || 'Clínica geral',
      reason: '',
      preferred_date: '',
      preferred_time: '',
      duration_minutes: '30',
      room_url: '',
      charge_amount: '150',
      auto_charge: true,
    })
    load()
  }

  async function createCrmTask(item: any, taskType: string, title: string, messageTemplate: string) {
    if (!user || !professional) return

    try {
      await supabase.from('professional_crm_tasks').insert({
        professional_user_id: user.id,
        appointment_id: item.id,
        task_type: taskType,
        title,
        description: messageTemplate,
        channel: 'manual',
        message_template: messageTemplate,
        status: 'pending',
        due_at: item.preferred_date && item.preferred_time ? `${item.preferred_date}T${String(item.preferred_time).slice(0, 5)}:00-03:00` : null,
        metadata: {
          patient_id: item.patient_id || item.user_id,
          patient_name: item.patient_name || null,
          professional_id: professional.id,
        },
      })
    } catch {
      // CRM ainda pode não ter sido ativado no Supabase. Não trava o fluxo principal.
    }
  }

  async function updateAppointment(item: any, updates: any, type: string, description: string) {
    if (!professional || !user) return
    setSavingId(item.id)

    const payload = {
      ...updates,
      professional_id: item.professional_id || professional.id,
      professional_name: item.professional_name || professional.full_name,
      professional_email: item.professional_email || user.email,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('telemedicine_appointments').update(payload).eq('id', item.id)

    if (error) {
      toast.error(error.message || 'Erro ao atualizar teleconsulta')
      setSavingId(null)
      return
    }

    await logEvent(item.id, type, description, item.patient_id || item.user_id, payload)
    await upsertCrmContact({ patient_id: item.patient_id || item.user_id, patient_name: item.patient_name, patient_email: item.patient_email, appointment_id: item.id })

    toast.success('Teleconsulta atualizada')
    setSavingId(null)
    load()
  }

  async function confirmAppointment(item: any) {
    const link = roomLinks[item.id] || item.room_url || item.meet_url
    await updateAppointment(item, {
      status: 'scheduled',
      provider: link ? 'manual_link' : item.provider || 'manual_link',
      room_url: link || null,
      meet_url: link || null,
      professional_confirmed: true,
      professional_confirmed_at: new Date().toISOString(),
    }, 'appointment_scheduled', 'Profissional agendou/confirmou a teleconsulta.')
  }

  async function createDailyRoom(item: any) {
    if (!session?.access_token) {
      toast.error('Sessão expirada. Entre novamente.')
      return
    }

    setSavingId(item.id)
    const response = await fetch('/api/video/daily/create-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ appointment_id: item.id }),
    })

    const payload = await response.json()

    if (!response.ok) {
      toast.error(payload.error || 'Erro ao criar sala Daily')
      setSavingId(null)
      return
    }

    setRoomLinks({ ...roomLinks, [item.id]: payload.room_url })
    toast.success('Sala Daily criada')
    setSavingId(null)
    load()
  }

  async function createNextGenCharge(item: any, forcedAmount?: string, silent = false) {
    if (!session?.access_token) {
      toast.error('Sessão expirada. Entre novamente.')
      return
    }

    const amount = forcedAmount || chargeAmounts[item.id] || '150'
    if (!amount || Number(amount) <= 0) {
      toast.error('Informe um valor válido')
      return
    }

    setSavingId(item.id)

    const response = await fetch('/api/billing/nextgen/create-charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        appointment_id: item.id,
        patient_id: item.patient_id || item.user_id,
        patient_name: item.patient_name || null,
        patient_email: item.patient_email || null,
        charge_type: 'teleconsultation',
        title: `Teleconsulta ${item.specialty || 'MyDataMed'}`,
        amount,
        description: item.reason || 'Cobrança de teleconsulta MyDataMed',
        billing_context: 'teleconsultation',
        metadata: {
          appointment_id: item.id,
          preferred_date: item.preferred_date,
          preferred_time: item.preferred_time,
          powered_by: 'NextGen',
          auto_charge_on_schedule: silent,
        },
      }),
    })

    const payload = await response.json()

    if (!response.ok) {
      toast.error(payload.error || 'Erro ao criar cobrança')
      setSavingId(null)
      return
    }

    toast.success(payload.payment_url || payload.pix_copy_paste ? 'Cobrança Pix criada' : 'Cobrança criada como rascunho')

    if (payload.payment_url || payload.pix_copy_paste) {
      const message = buildPaymentMessage(item, payload.payment_url, payload.pix_copy_paste, amount)
      try {
        await navigator.clipboard.writeText(message)
        toast.success('Mensagem de cobrança copiada')
      } catch {
        // não trava
      }
    }

    setSavingId(null)
    if (!silent) load()
  }

  async function sendReminder(item: any) {
    const message = buildReminderMessage(item)
    await updateAppointment(item, { status: item.status === 'scheduled' ? 'reminder_sent' : item.status, reminder_sent_at: new Date().toISOString() }, 'reminder_sent', 'Lembrete de teleconsulta registrado para envio ao paciente.')
    await createCrmTask(item, 'reminder', 'Enviar lembrete de teleconsulta', message)
  }

  async function copyReminder(item: any) {
    const message = buildReminderMessage(item)
    try {
      await navigator.clipboard.writeText(message)
      toast.success('Mensagem copiada')
    } catch {
      toast.error('Não consegui copiar automaticamente')
    }
  }

  async function startAppointment(item: any) {
    await updateAppointment(item, { status: 'in_progress', started_at: new Date().toISOString() }, 'appointment_started', 'Profissional iniciou a teleconsulta.')
  }

  async function completeAppointment(item: any) {
    const note = notes[item.id] || emptyNotes

    await updateAppointment(item, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      orientation_text: note.orientation || item.orientation_text || null,
      prescription_text: note.prescription || item.prescription_text || null,
      professional_notes: note.professional || item.professional_notes || null,
      prescription_sent_at: note.prescription ? new Date().toISOString() : item.prescription_sent_at || null,
    }, 'appointment_completed', 'Profissional concluiu a teleconsulta e registrou orientações.')

    await createCrmTask(item, 'post_consultation', 'Follow-up pós-consulta', `Olá, ${item.patient_name || 'paciente'}. Suas orientações da teleconsulta já estão disponíveis no HealthWallet.`)
  }

  async function cancelAppointment(item: any) {
    if (!confirm('Cancelar esta teleconsulta?')) return
    await updateAppointment(item, { status: 'cancelled', cancelled_at: new Date().toISOString() }, 'appointment_cancelled', 'Profissional cancelou a teleconsulta.')
  }

  const stats = useMemo(() => ({
    total: appointments.length,
    scheduled: appointments.filter((a) => ['scheduled', 'confirmed', 'reminder_sent'].includes(a.status)).length,
    charged: appointments.filter((a) => a.payment_required || a.payment_charge_id).length,
    paid: appointments.filter((a) => a.payment_status === 'paid').length,
    completed: appointments.filter((a) => a.status === 'completed').length,
  }), [appointments])

  if (authLoading || !professional) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teleconsultas</h1>
          <p className="text-gray-600 mt-1">Daily premium, cobrança NextGen, dados autorizados, lembretes, documentos e CRM em um só lugar.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/planos" className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 text-indigo-700 px-5 py-3 font-semibold hover:bg-indigo-50">
            <CreditCard className="w-5 h-5" /> Planos
          </Link>
          <Link href="/financeiro" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 text-emerald-700 px-5 py-3 font-semibold hover:bg-emerald-50">
            <ReceiptText className="w-5 h-5" /> Financeiro
          </Link>
          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold hover:bg-emerald-700">
            <Plus className="w-5 h-5" /> Nova teleconsulta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Total" value={stats.total} />
        <Stat label="Agendadas" value={stats.scheduled} />
        <Stat label="Cobradas" value={stats.charged} />
        <Stat label="Pagas" value={stats.paid} />
        <Stat label="Concluídas" value={stats.completed} />
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <FeatureStrip icon={Sparkles} title="Daily premium" description="Gere sala privada direto no MyDataMed Pro." />
        <FeatureStrip icon={Wallet} title="Powered by NextGen" description="Cobre ao agendar ou em 1 clique." />
        <FeatureStrip icon={MessageCircle} title="SmartBots CRM" description="Lembretes e follow-up preparados como tarefas." />
        <FeatureStrip icon={FileText} title="DocWallet" description="Orientações, documentos e validações no fluxo." />
      </div>

      <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-900">
        <strong>Fluxo conectado:</strong> agenda cria a teleconsulta, NextGen gera a cobrança, Woovi/Pix recebe o pagamento, SmartBots ajuda no lembrete e DocWallet organiza documentos e orientações.
      </section>

      {showForm && (
        <section className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-4">
          <h2 className="font-bold text-lg">Agendar teleconsulta</h2>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Paciente</label>
            <select
              value={form.patient_id}
              onChange={(e) => {
                const selected = recentPatients.find((p) => p.patient_id === e.target.value)
                setForm({ ...form, patient_id: e.target.value, patient_name: selected ? `Paciente do código ${selected.code}` : form.patient_name })
              }}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">Selecionar paciente de acesso recente</option>
              {recentPatients.map((item) => <option key={item.patient_id} value={item.patient_id}>Paciente {item.patient_id.slice(0, 8)} • código {item.code}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">Também é possível colar o ID do paciente manualmente abaixo.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Input label="Patient ID" value={form.patient_id} onChange={(value: string) => setForm({ ...form, patient_id: value })} placeholder="UUID do paciente" />
            <Input label="Nome do paciente" value={form.patient_name} onChange={(value: string) => setForm({ ...form, patient_name: value })} />
            <Input label="E-mail do paciente" value={form.patient_email} onChange={(value: string) => setForm({ ...form, patient_email: value })} />
          </div>

          <div className="grid md:grid-cols-5 gap-3">
            <Input label="Especialidade" value={form.specialty} onChange={(value: string) => setForm({ ...form, specialty: value })} />
            <DateInput label="Data" value={form.preferred_date} onChange={(value: string) => setForm({ ...form, preferred_date: value })} />
            <TimeInput label="Horário" value={form.preferred_time} onChange={(value: string) => setForm({ ...form, preferred_time: value })} />
            <Input label="Duração min." value={form.duration_minutes} onChange={(value: string) => setForm({ ...form, duration_minutes: value })} />
            <Input label="Valor R$" value={form.charge_amount} onChange={(value: string) => setForm({ ...form, charge_amount: value })} />
          </div>

          <label className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900">
            <input type="checkbox" checked={form.auto_charge} onChange={(e) => setForm({ ...form, auto_charge: e.target.checked })} className="mt-1" />
            <span><strong>Cobrar ao agendar.</strong> O MyDataMed cria a teleconsulta e já gera cobrança NextGen/Pix vinculada ao atendimento.</span>
          </label>

          <Input label="Link manual opcional" value={form.room_url} onChange={(value: string) => setForm({ ...form, room_url: value })} placeholder="Cole Google Meet / Zoom / Daily ou deixe vazio para gerar Daily depois" />

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Motivo / observações</label>
            <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200 min-h-[90px] outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Ex: retorno para revisar exames, ajuste de medicação..." />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border font-medium">Cancelar</button>
            <button onClick={createAppointment} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-semibold">Agendar</button>
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h2 className="font-bold text-lg mb-4">Agenda de teleconsultas</h2>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>
        ) : appointments.length > 0 ? (
          <div className="space-y-4">
            {appointments.map((item) => (
              <AppointmentCard
                key={item.id}
                item={item}
                saving={savingId === item.id}
                roomLink={roomLinks[item.id] || item.room_url || item.meet_url || ''}
                setRoomLink={(value: string) => setRoomLinks({ ...roomLinks, [item.id]: value })}
                chargeAmount={chargeAmounts[item.id] || '150'}
                setChargeAmount={(value: string) => setChargeAmounts({ ...chargeAmounts, [item.id]: value })}
                note={notes[item.id] || emptyNotes}
                setNote={(value: any) => setNotes({ ...notes, [item.id]: value })}
                onConfirm={() => confirmAppointment(item)}
                onCreateDaily={() => createDailyRoom(item)}
                onCreateCharge={() => createNextGenCharge(item)}
                onReminder={() => sendReminder(item)}
                onCopyReminder={() => copyReminder(item)}
                onStart={() => startAppointment(item)}
                onComplete={() => completeAppointment(item)}
                onCancel={() => cancelAppointment(item)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Nenhuma teleconsulta agendada ainda.</p>
        )}
      </section>
    </div>
  )
}

function AppointmentCard({ item, saving, roomLink, setRoomLink, chargeAmount, setChargeAmount, note, setNote, onConfirm, onCreateDaily, onCreateCharge, onReminder, onCopyReminder, onStart, onComplete, onCancel }: any) {
  const status = translateStatus(item.status)
  const joinUrl = item.room_url || item.meet_url || roomLink
  const isUnassigned = !item.professional_id
  const isDaily = item.provider === 'daily' || String(joinUrl || '').includes('daily.co')
  const hasCharge = Boolean(item.payment_charge_id || item.payment_required)
  const paid = item.payment_status === 'paid'

  return (
    <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/60">
      <div className="flex flex-col xl:flex-row xl:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isDaily ? 'bg-emerald-100' : 'bg-cyan-100'}`}>
              <Video className={`w-5 h-5 ${isDaily ? 'text-emerald-700' : 'text-cyan-700'}`} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-gray-900">{item.specialty || 'Teleconsulta'}</h3>
                <span className="text-xs rounded-full px-2 py-0.5 bg-white border text-gray-600">{status}</span>
                {isDaily && <span className="text-xs rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-700">Daily premium</span>}
                {isUnassigned && <span className="text-xs rounded-full px-2 py-0.5 bg-yellow-100 text-yellow-700">Nova solicitação</span>}
                {hasCharge && <span className={`text-xs rounded-full px-2 py-0.5 ${paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>Pgto: {item.payment_status || 'pendente'}</span>}
              </div>
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-1"><CalendarDays className="w-4 h-4" />{formatDate(item.preferred_date)} {item.preferred_time ? `às ${String(item.preferred_time).slice(0, 5)}` : ''} • {item.duration_minutes || 30} min</p>
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-1"><User className="w-4 h-4" />{item.patient_name || `Paciente ${String(item.patient_id || item.user_id || '').slice(0, 8)}`}</p>
              {item.patient_email && <p className="text-sm text-gray-600 mt-1 flex items-center gap-1"><Mail className="w-4 h-4" />{item.patient_email}</p>}
              {item.reason && <p className="text-sm text-gray-700 mt-2">Motivo: {item.reason}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            <MiniStatus icon={CheckCircle} label="Paciente" active={item.patient_confirmed} />
            <MiniStatus icon={ShieldCheck} label="Dados" active={item.data_sharing_authorized} />
            <MiniStatus icon={Bell} label="Lembrete" active={!!item.reminder_sent_at} />
            <MiniStatus icon={PlayCircle} label="Início" active={!!item.started_at} />
            <MiniStatus icon={CreditCard} label="Pagamento" active={paid || !hasCharge} />
          </div>

          {item.data_sharing_authorized && (
            <Link href={`/patient/by-patient/${item.patient_id || item.user_id}?appointment=${item.id}`} className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-700 font-medium hover:underline">
              <ShieldCheck className="w-4 h-4" /> Ver dados autorizados desta consulta
            </Link>
          )}
        </div>

        <div className="xl:w-96 space-y-3">
          <div className="rounded-2xl bg-white border p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500">Chamada</p>
            <input value={roomLink} onChange={(e) => setRoomLink(e.target.value)} placeholder="Link Google Meet / Daily / Zoom" className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <button disabled={saving} onClick={onCreateDaily} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white py-2 text-sm font-medium col-span-2 disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Gerar sala Daily</button>
              <button disabled={saving} onClick={onConfirm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white py-2 text-sm font-medium disabled:opacity-60"><CheckCircle className="w-4 h-4" /> {isUnassigned ? 'Assumir' : 'Salvar'}</button>
              {joinUrl && <a href={joinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 text-white py-2 text-sm font-medium"><ExternalLink className="w-4 h-4" /> Abrir</a>}
            </div>
          </div>

          <div className="rounded-2xl bg-white border p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500">Cobrança NextGen</p>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="Valor R$" className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm" />
              <button disabled={saving} onClick={onCreateCharge} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white px-3 py-2 text-sm font-medium disabled:opacity-60"><Wallet className="w-4 h-4" /> Cobrar</button>
            </div>
            {item.payment_url && <a href={item.payment_url} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 py-2 text-sm font-medium"><ExternalLink className="w-4 h-4" /> Abrir Pix</a>}
            {item.pix_copy_paste && <button onClick={() => navigator.clipboard.writeText(item.pix_copy_paste)} className="w-full inline-flex items-center justify-center gap-2 rounded-xl border py-2 text-sm font-medium"><Copy className="w-4 h-4" /> Copiar Pix</button>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button disabled={saving} onClick={onReminder} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-100 text-amber-800 py-2 text-sm font-medium"><Bell className="w-4 h-4" /> Lembrete</button>
            <button disabled={saving} onClick={onCopyReminder} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-gray-200 text-gray-700 py-2 text-sm font-medium"><Copy className="w-4 h-4" /> Copiar</button>
            <button disabled={saving} onClick={onStart} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 text-white py-2 text-sm font-medium"><PlayCircle className="w-4 h-4" /> Iniciar</button>
            <button disabled={saving} onClick={onCancel} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 text-red-600 py-2 text-sm font-medium"><XCircle className="w-4 h-4" /> Cancelar</button>
            <button disabled={saving} onClick={onComplete} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white py-2 text-sm font-medium col-span-2"><StopCircle className="w-4 h-4" /> Concluir e enviar orientações</button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mt-4">
        <TextArea label="Orientações ao paciente" value={note.orientation} onChange={(value: string) => setNote({ ...note, orientation: value })} />
        <TextArea label="Receita / prescrição" value={note.prescription} onChange={(value: string) => setNote({ ...note, prescription: value })} />
        <TextArea label="Notas internas" value={note.professional} onChange={(value: string) => setNote({ ...note, professional: value })} />
      </div>
    </div>
  )
}

function Stat({ label, value }: any) {
  return <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm"><p className="text-2xl font-bold text-emerald-700">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
}

function FeatureStrip({ icon: Icon, title, description }: any) {
  return <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div><div><p className="font-semibold text-gray-900 text-sm">{title}</p><p className="text-xs text-gray-500 mt-1">{description}</p></div></div>
}

function Input({ label, value, onChange, placeholder = '' }: any) {
  return <div><label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20" /></div>
}

function DateInput({ label, value, onChange }: any) {
  return <div><label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label><input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20" /></div>
}

function TimeInput({ label, value, onChange }: any) {
  return <div><label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label><input type="time" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20" /></div>
}

function TextArea({ label, value, onChange }: any) {
  return <div><label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label><textarea value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 min-h-[90px] text-sm" /></div>
}

function MiniStatus({ icon: Icon, label, active }: any) {
  return <div className={`rounded-xl border p-2 text-xs flex items-center gap-1 ${active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-500'}`}><Icon className="w-3 h-3" />{label}: {active ? 'OK' : 'pendente'}</div>
}

function buildReminderMessage(item: any) {
  const date = formatDate(item.preferred_date)
  const time = item.preferred_time ? String(item.preferred_time).slice(0, 5) : ''
  const patientName = item.patient_name || 'paciente'
  const professionalName = item.professional_name || 'profissional'
  const link = item.room_url || item.meet_url || 'link será enviado em breve'
  const paymentLine = item.payment_status && item.payment_status !== 'paid' && item.payment_url ? `\nPagamento: ${item.payment_url}` : ''
  return `Olá, ${patientName}. Sua teleconsulta com ${professionalName} está agendada para ${date} ${time}. Link: ${link}.${paymentLine}`
}

function buildPaymentMessage(item: any, paymentUrl: string, pixCopyPaste: string, amount: string) {
  const patientName = item.patient_name || 'paciente'
  const date = formatDate(item.preferred_date)
  const time = item.preferred_time ? String(item.preferred_time).slice(0, 5) : ''
  return `Olá, ${patientName}. Segue a cobrança da sua teleconsulta MyDataMed de R$ ${amount}. Consulta: ${date} ${time}.\n${paymentUrl ? `Link de pagamento: ${paymentUrl}` : ''}\n${pixCopyPaste ? `Pix copia e cola: ${pixCopyPaste}` : ''}`
}

function translateStatus(status: string) {
  const map: Record<string, string> = { requested: 'Solicitada', scheduled: 'Agendada', confirmed: 'Confirmada', reminder_sent: 'Lembrete enviado', in_progress: 'Em atendimento', completed: 'Concluída', cancelled: 'Cancelada' }
  return map[status] || status || 'Pendente'
}

function formatDate(value: string) {
  if (!value) return 'Data não informada'
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}
