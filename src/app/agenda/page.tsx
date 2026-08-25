'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowRight, CalendarDays, CheckCircle, Clock, CreditCard, Loader2, Plus, RefreshCw, Save, UserPlus, Video } from 'lucide-react'

const emptyForm = {
  patient_name: '',
  patient_email: '',
  patient_phone: '',
  title: '',
  reason: '',
  appointment_type: 'consultation',
  service_mode: 'hybrid',
  starts_date: '',
  starts_time: '',
  duration_minutes: 50,
  amount_cents: 0,
  notes: '',
}

const statusLabel: Record<string, any> = {
  requested: { label: 'Solicitado', cls: 'bg-blue-100 text-blue-700' },
  scheduled: { label: 'Agendado', cls: 'bg-slate-100 text-slate-700' },
  confirmed: { label: 'Confirmado', cls: 'bg-emerald-100 text-emerald-700' },
  checked_in: { label: 'Check-in', cls: 'bg-amber-100 text-amber-700' },
  in_care: { label: 'Em atendimento', cls: 'bg-violet-100 text-violet-700' },
  completed: { label: 'Concluído', cls: 'bg-gray-900 text-white' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
  no_show: { label: 'Faltou', cls: 'bg-orange-100 text-orange-700' },
}

export default function AgendaPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [appointments, setAppointments] = useState<any[]>([])
  const [form, setForm] = useState<any>(emptyForm)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && professional) loadAppointments()
  }, [user, professional])

  const stats = useMemo(() => ({
    total: appointments.length,
    today: appointments.filter((item) => isToday(item.starts_at)).length,
    confirmed: appointments.filter((item) => item.status === 'confirmed').length,
    pendingPayment: appointments.filter((item) => item.payment_status === 'pending').length,
  }), [appointments])

  async function loadAppointments() {
    if (!user) return
    setLoading(true)
    const start = new Date()
    start.setDate(start.getDate() - 7)
    const { data, error } = await supabase
      .from('professional_appointments')
      .select('*')
      .eq('professional_user_id', user.id)
      .gte('starts_at', start.toISOString())
      .order('starts_at', { ascending: true })
      .limit(120)
    if (error) toast.error('Rode SQL_MYDATAMED_OPS_BILLING_USAGE_V1.sql no Supabase para ativar a agenda.')
    setAppointments(data || [])
    setLoading(false)
  }

  async function createAppointment() {
    if (!user || !professional) return
    if (!form.patient_name.trim()) return toast.error('Informe o paciente')
    if (!form.starts_date || !form.starts_time) return toast.error('Informe data e hora')
    setCreating(true)
    try {
      const startsAt = new Date(`${form.starts_date}T${form.starts_time}:00`)
      const endsAt = new Date(startsAt.getTime() + Number(form.duration_minutes || 50) * 60000)
      const { data: appointment, error } = await supabase
        .from('professional_appointments')
        .insert({
          professional_id: professional.id,
          professional_user_id: user.id,
          patient_name: form.patient_name,
          patient_email: form.patient_email || null,
          patient_phone: form.patient_phone || null,
          title: form.title || `Atendimento - ${form.patient_name}`,
          reason: form.reason || null,
          appointment_type: form.appointment_type,
          service_mode: form.service_mode,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          duration_minutes: Number(form.duration_minutes || 50),
          amount_cents: Number(form.amount_cents || 0),
          payment_status: Number(form.amount_cents || 0) > 0 ? 'pending' : 'not_charged',
          notes: form.notes || null,
          metadata: { created_from: 'agenda_page' },
        })
        .select('*')
        .single()
      if (error) throw error

      if (Number(form.amount_cents || 0) > 0) {
        const { data: entry } = await supabase
          .from('professional_financial_entries')
          .insert({
            professional_id: professional.id,
            professional_user_id: user.id,
            entry_type: 'receivable',
            description: form.title || `Atendimento - ${form.patient_name}`,
            amount_cents: Number(form.amount_cents || 0),
            due_date: form.starts_date,
            patient_name: form.patient_name,
            patient_email: form.patient_email || null,
            patient_phone: form.patient_phone || null,
            payment_method: 'not_defined',
            metadata: { created_from: 'agenda_page', appointment_id: appointment.id },
          })
          .select('id')
          .single()

        if (entry?.id) {
          await supabase
            .from('professional_appointments')
            .update({ financial_entry_id: entry.id })
            .eq('id', appointment.id)
            .eq('professional_user_id', user.id)
        }
      }

      toast.success('Agendamento criado')
      setForm(emptyForm)
      loadAppointments()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar agendamento')
    } finally {
      setCreating(false)
    }
  }

  async function updateStatus(item: any, status: string) {
    const { error } = await supabase
      .from('professional_appointments')
      .update({ status })
      .eq('id', item.id)
      .eq('professional_user_id', user?.id)
    if (error) toast.error('Erro ao atualizar agenda')
    else loadAppointments()
  }

  if (authLoading || !professional || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <section className="rounded-[2rem] bg-slate-950 text-white p-6 md:p-9 grid lg:grid-cols-[1fr_0.8fr] gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5"><CalendarDays className="w-4 h-4" /> Agenda operacional</div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">Agenda, cobrança e preparação do atendimento.</h1>
          <p className="text-white/70 mt-4 text-lg">Crie consultas, retornos, teleconsultas e procedimentos. Quando houver valor, o Backoffice já recebe a conta a receber.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <HeroStat label="Total" value={stats.total} />
          <HeroStat label="Hoje" value={stats.today} />
          <HeroStat label="Confirmados" value={stats.confirmed} />
          <HeroStat label="A cobrar" value={stats.pendingPayment} />
        </div>
      </section>

      <section className="grid lg:grid-cols-[0.85fr_1.15fr] gap-6">
        <Card title="Novo agendamento" icon={Plus}>
          <div className="grid gap-3">
            <Field label="Paciente" value={form.patient_name} onChange={(v: string) => setForm({ ...form, patient_name: v })} />
            <div className="grid md:grid-cols-2 gap-3"><Field label="E-mail" value={form.patient_email} onChange={(v: string) => setForm({ ...form, patient_email: v })} /><Field label="Telefone" value={form.patient_phone} onChange={(v: string) => setForm({ ...form, patient_phone: v })} /></div>
            <Field label="Título" value={form.title} onChange={(v: string) => setForm({ ...form, title: v })} placeholder="Consulta inicial, retorno..." />
            <Area label="Motivo / observações" value={form.reason} onChange={(v: string) => setForm({ ...form, reason: v })} />
            <div className="grid md:grid-cols-2 gap-3"><Field label="Data" type="date" value={form.starts_date} onChange={(v: string) => setForm({ ...form, starts_date: v })} /><Field label="Hora" type="time" value={form.starts_time} onChange={(v: string) => setForm({ ...form, starts_time: v })} /></div>
            <div className="grid md:grid-cols-2 gap-3"><Field label="Duração min." type="number" value={form.duration_minutes} onChange={(v: string) => setForm({ ...form, duration_minutes: v })} /><Field label="Valor em centavos" type="number" value={form.amount_cents} onChange={(v: string) => setForm({ ...form, amount_cents: v })} /></div>
            <div className="grid md:grid-cols-2 gap-3">
              <Select label="Tipo" value={form.appointment_type} onChange={(v: string) => setForm({ ...form, appointment_type: v })} options={[['consultation','Consulta'],['return','Retorno'],['procedure','Procedimento'],['teleconsultation','Teleconsulta'],['triage','Triagem'],['other','Outro']]} />
              <Select label="Modo" value={form.service_mode} onChange={(v: string) => setForm({ ...form, service_mode: v })} options={[['hybrid','Híbrido'],['online','Online'],['presencial','Presencial']]} />
            </div>
            <button onClick={createAppointment} disabled={creating} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white px-4 py-3 font-semibold disabled:opacity-60"><Save className="w-4 h-4" /> Criar agendamento</button>
          </div>
        </Card>

        <Card title="Próximos atendimentos" icon={RefreshCw}>
          {appointments.length ? <div className="space-y-3">{appointments.map((item) => <AppointmentRow key={item.id} item={item} onStatus={updateStatus} />)}</div> : <Empty text="Nenhum agendamento encontrado." />}
        </Card>
      </section>
    </main>
  )
}

function isToday(date: string) { return new Date(date).toDateString() === new Date().toDateString() }
function formatDate(date: string) { return new Date(date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }
function formatMoney(cents: number) { return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function HeroStat({ label, value }: any) { return <div className="rounded-3xl bg-white/10 border border-white/10 p-5"><p className="text-3xl font-bold">{value}</p><p className="text-sm text-white/65">{label}</p></div> }
function Card({ title, icon: Icon, children }: any) { return <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5"><h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><Icon className="w-5 h-5 text-emerald-700" /> {title}</h2>{children}</section> }
function Field({ label, value, onChange, type = 'text', placeholder = '' }: any) { return <label className="block"><span className="text-sm font-semibold text-gray-700 mb-1 block">{label}</span><input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" /></label> }
function Area({ label, value, onChange }: any) { return <label className="block"><span className="text-sm font-semibold text-gray-700 mb-1 block">{label}</span><textarea value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full min-h-[80px] rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" /></label> }
function Select({ label, value, onChange, options }: any) { return <label className="block"><span className="text-sm font-semibold text-gray-700 mb-1 block">{label}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none">{options.map(([v, l]: any) => <option key={v} value={v}>{l}</option>)}</select></label> }
function Empty({ text }: any) { return <div className="rounded-2xl border border-dashed p-8 text-center text-gray-500">{text}</div> }
function AppointmentRow({ item, onStatus }: any) {
  const status = statusLabel[item.status] || statusLabel.scheduled
  return <div className="rounded-2xl border bg-gray-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-gray-900">{item.title || item.patient_name}</p><p className="text-sm text-gray-600">{item.patient_name} • {formatDate(item.starts_at)}</p><p className="text-sm text-emerald-700 font-semibold mt-1">{formatMoney(item.amount_cents)} • {item.service_mode}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span></div><div className="flex flex-wrap gap-2 mt-3"><button onClick={() => onStatus(item, 'confirmed')} className="rounded-xl border px-3 py-2 text-sm">Confirmar</button><button onClick={() => onStatus(item, 'checked_in')} className="rounded-xl border px-3 py-2 text-sm">Check-in</button><button onClick={() => onStatus(item, 'completed')} className="rounded-xl border px-3 py-2 text-sm">Concluir</button>{item.financial_entry_id && <Link href="/backoffice" className="inline-flex items-center gap-1 rounded-xl bg-slate-950 text-white px-3 py-2 text-sm"><CreditCard className="w-4 h-4" /> Cobrança</Link>}</div></div>
}
