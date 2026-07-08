'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  CalendarDays,
  Video,
  Loader2,
  Plus,
  CheckCircle,
  XCircle,
  ExternalLink,
  Clock,
  Bell,
  PlayCircle,
  StopCircle,
  FileText,
  Send,
  ShieldCheck,
  User,
  Mail,
} from 'lucide-react'

const DEFAULT_PERMISSIONS = {
  summary: true,
  exams: true,
  medications: true,
  timeline: true,
  passport: true,
  medscore: true,
}

export default function TeleconsultasPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [appointments, setAppointments] = useState<any[]>([])
  const [recentPatients, setRecentPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [roomLinks, setRoomLinks] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, { orientation: string; prescription: string; professional: string }>>({})

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
      .eq('professional_id', professional.id)
      .order('preferred_date', { ascending: false })
      .order('preferred_time', { ascending: false })

    if (error) {
      toast.error('Erro ao carregar teleconsultas. Rode o SQL_TELECONSULTA_MOTOR_V1.sql no Supabase.')
    }

    setAppointments(data || [])
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

  async function createAppointment() {
    if (!professional || !user) return

    if (!form.patient_id || !form.preferred_date || !form.preferred_time) {
      toast.error('Informe paciente, data e horário')
      return
    }

    const now = new Date().toISOString()
    const payload = {
      user_id: form.patient_id,
      patient_id: form.patient_id,
      patient_name: form.patient_name || null,
      patient_email: form.patient_email || null,
      professional_id: professional.id,
      professional_name: professional.full_name,
      specialty: form.specialty || professional.specialty || 'Clínica geral',
      reason: form.reason || null,
      preferred_date: form.preferred_date,
      preferred_time: form.preferred_time,
      duration_minutes: Number(form.duration_minutes || 30),
      status: 'scheduled',
      provider: 'manual_link',
      room_url: form.room_url || null,
      meet_url: form.room_url || null,
      shared_data_permissions: DEFAULT_PERMISSIONS,
      payment_status: 'not_required',
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

    await logEvent(data.id, 'appointment_scheduled', 'Profissional agendou teleconsulta.', data.patient_id)

    toast.success('Teleconsulta agendada')
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
    })
    load()
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

  async function updateAppointment(item: any, updates: any, type: string, description: string) {
    if (!professional) return
    setSavingId(item.id)

    const { error } = await supabase
      .from('telemedicine_appointments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', item.id)

    if (error) {
      toast.error(error.message || 'Erro ao atualizar teleconsulta')
      setSavingId(null)
      return
    }

    await logEvent(item.id, type, description, item.patient_id || item.user_id, updates)
    toast.success('Teleconsulta atualizada')
    setSavingId(null)
    load()
  }

  async function confirmAppointment(item: any) {
    const link = roomLinks[item.id] || item.room_url || item.meet_url

    await updateAppointment(
      item,
      {
        status: 'confirmed',
        room_url: link || null,
        meet_url: link || null,
      },
      'appointment_confirmed',
      'Profissional confirmou a teleconsulta.'
    )
  }

  async function sendReminder(item: any) {
    await updateAppointment(
      item,
      { reminder_sent_at: new Date().toISOString() },
      'reminder_sent',
      'Lembrete de teleconsulta registrado para envio ao paciente.'
    )
  }

  async function startAppointment(item: any) {
    await updateAppointment(
      item,
      { status: 'in_progress', started_at: new Date().toISOString() },
      'appointment_started',
      'Profissional iniciou a teleconsulta.'
    )
  }

  async function completeAppointment(item: any) {
    const note = notes[item.id] || { orientation: '', prescription: '', professional: '' }

    await updateAppointment(
      item,
      {
        status: 'completed',
        completed_at: new Date().toISOString(),
        orientation_text: note.orientation || item.orientation_text || null,
        prescription_text: note.prescription || item.prescription_text || null,
        professional_notes: note.professional || item.professional_notes || null,
      },
      'appointment_completed',
      'Profissional concluiu a teleconsulta e registrou orientações.',
    )
  }

  async function cancelAppointment(item: any) {
    if (!confirm('Cancelar esta teleconsulta?')) return

    await updateAppointment(
      item,
      { status: 'cancelled', cancelled_at: new Date().toISOString() },
      'appointment_cancelled',
      'Profissional cancelou a teleconsulta.'
    )
  }

  const stats = useMemo(() => {
    return {
      total: appointments.length,
      scheduled: appointments.filter((a) => ['scheduled', 'confirmed'].includes(a.status)).length,
      today: appointments.filter((a) => a.preferred_date === new Date().toISOString().slice(0, 10)).length,
      completed: appointments.filter((a) => a.status === 'completed').length,
    }
  }, [appointments])

  if (authLoading || !professional) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teleconsultas</h1>
          <p className="text-gray-600 mt-1">Agende, confirme, envie lembretes, inicie consultas e registre orientações.</p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold hover:bg-emerald-700"
        >
          <Plus className="w-5 h-5" />
          Nova teleconsulta
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total" value={stats.total} />
        <Stat label="Agendadas" value={stats.scheduled} />
        <Stat label="Hoje" value={stats.today} />
        <Stat label="Concluídas" value={stats.completed} />
      </div>

      <section className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 text-sm text-cyan-900">
        <strong>Motor v1:</strong> no primeiro momento, use um link manual do Google Meet, Daily, Zoom ou WhatsApp. A criação automática do Meet entra depois via Google Calendar/Meet API.
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
              {recentPatients.map((item) => (
                <option key={item.patient_id} value={item.patient_id}>
                  Paciente {item.patient_id.slice(0, 8)} • código {item.code}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Também é possível colar o ID do paciente manualmente abaixo.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Input label="Patient ID" value={form.patient_id} onChange={(value: string) => setForm({ ...form, patient_id: value })} placeholder="UUID do paciente" />
            <Input label="Nome do paciente" value={form.patient_name} onChange={(value: string) => setForm({ ...form, patient_name: value })} />
            <Input label="E-mail do paciente" value={form.patient_email} onChange={(value: string) => setForm({ ...form, patient_email: value })} />
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <Input label="Especialidade" value={form.specialty} onChange={(value: string) => setForm({ ...form, specialty: value })} />
            <DateInput label="Data" value={form.preferred_date} onChange={(value: string) => setForm({ ...form, preferred_date: value })} />
            <TimeInput label="Horário" value={form.preferred_time} onChange={(value: string) => setForm({ ...form, preferred_time: value })} />
            <Input label="Duração min." value={form.duration_minutes} onChange={(value: string) => setForm({ ...form, duration_minutes: value })} />
          </div>

          <Input label="Link da chamada" value={form.room_url} onChange={(value: string) => setForm({ ...form, room_url: value })} placeholder="Cole link Google Meet / Daily / Zoom" />

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Motivo / observações iniciais</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 min-h-[90px] outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Ex: retorno para revisar exames, ajuste de medicação..."
            />
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
          <div className="py-10 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
          </div>
        ) : appointments.length > 0 ? (
          <div className="space-y-4">
            {appointments.map((item) => (
              <AppointmentCard
                key={item.id}
                item={item}
                saving={savingId === item.id}
                roomLink={roomLinks[item.id] || item.room_url || item.meet_url || ''}
                setRoomLink={(value: string) => setRoomLinks({ ...roomLinks, [item.id]: value })}
                note={notes[item.id] || { orientation: item.orientation_text || '', prescription: item.prescription_text || '', professional: item.professional_notes || '' }}
                setNote={(value: any) => setNotes({ ...notes, [item.id]: value })}
                onConfirm={() => confirmAppointment(item)}
                onReminder={() => sendReminder(item)}
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

function AppointmentCard({ item, saving, roomLink, setRoomLink, note, setNote, onConfirm, onReminder, onStart, onComplete, onCancel }: any) {
  const status = translateStatus(item.status)
  const joinUrl = item.room_url || item.meet_url

  return (
    <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/60">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
              <Video className="w-5 h-5 text-cyan-700" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-gray-900">{item.specialty || 'Teleconsulta'}</h3>
                <span className="text-xs rounded-full px-2 py-0.5 bg-white border text-gray-600">{status}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                <CalendarDays className="w-4 h-4" />
                {formatDate(item.preferred_date)} {item.preferred_time ? `às ${String(item.preferred_time).slice(0, 5)}` : ''} • {item.duration_minutes || 30} min
              </p>
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                <User className="w-4 h-4" />
                {item.patient_name || `Paciente ${String(item.patient_id || item.user_id || '').slice(0, 8)}`}
              </p>
              {item.patient_email && (
                <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {item.patient_email}
                </p>
              )}
              {item.reason && <p className="text-sm text-gray-700 mt-2">Motivo: {item.reason}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            <MiniStatus icon={CheckCircle} label="Paciente" active={item.patient_confirmed} />
            <MiniStatus icon={ShieldCheck} label="Dados" active={item.data_sharing_authorized} />
            <MiniStatus icon={Bell} label="Lembrete" active={!!item.reminder_sent_at} />
            <MiniStatus icon={PlayCircle} label="Início" active={!!item.started_at} />
          </div>

          {item.data_sharing_authorized && (
            <Link
              href={`/patient/by-patient/${item.patient_id || item.user_id}?appointment=${item.id}`}
              className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-700 font-medium hover:underline"
            >
              <ShieldCheck className="w-4 h-4" />
              Ver dados autorizados desta consulta
            </Link>
          )}
        </div>

        <div className="lg:w-80 space-y-2">
          <input
            value={roomLink}
            onChange={(e) => setRoomLink(e.target.value)}
            placeholder="Link Google Meet / Daily / Zoom"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
          />

          <div className="grid grid-cols-2 gap-2">
            <button disabled={saving} onClick={onConfirm} className="ActionButton bg-emerald-600 text-white">
              <CheckCircle className="w-4 h-4" /> Confirmar
            </button>
            <button disabled={saving} onClick={onReminder} className="ActionButton bg-amber-100 text-amber-800">
              <Bell className="w-4 h-4" /> Lembrete
            </button>
            <button disabled={saving} onClick={onStart} className="ActionButton bg-cyan-600 text-white">
              <PlayCircle className="w-4 h-4" /> Iniciar
            </button>
            <button disabled={saving} onClick={onComplete} className="ActionButton bg-blue-600 text-white">
              <StopCircle className="w-4 h-4" /> Concluir
            </button>
          </div>

          {joinUrl && (
            <a href={joinUrl} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white py-2 text-sm font-medium">
              <ExternalLink className="w-4 h-4" />
              Abrir chamada
            </a>
          )}

          <button disabled={saving} onClick={onCancel} className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 text-red-600 py-2 text-sm font-medium">
            <XCircle className="w-4 h-4" />
            Cancelar
          </button>
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
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
      <p className="text-2xl font-bold text-emerald-700">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function Input({ label, value, onChange, placeholder = '' }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20" />
    </div>
  )
}

function DateInput({ label, value, onChange }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20" />
    </div>
  )
}

function TimeInput({ label, value, onChange }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20" />
    </div>
  )
}

function TextArea({ label, value, onChange }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 min-h-[90px] text-sm" />
    </div>
  )
}

function MiniStatus({ icon: Icon, label, active }: any) {
  return (
    <div className={`rounded-xl border p-2 text-xs flex items-center gap-1 ${active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-500'}`}>
      <Icon className="w-3 h-3" />
      {label}: {active ? 'OK' : 'pendente'}
    </div>
  )
}

function translateStatus(status: string) {
  const map: Record<string, string> = {
    requested: 'Solicitada',
    scheduled: 'Agendada',
    confirmed: 'Confirmada',
    in_progress: 'Em andamento',
    completed: 'Concluída',
    cancelled: 'Cancelada',
    no_show: 'Não compareceu',
  }
  return map[status] || status
}

function formatDate(date: string) {
  if (!date) return 'Data não informada'
  return new Date(date).toLocaleDateString('pt-BR')
}
