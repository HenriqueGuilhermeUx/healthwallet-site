'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  CalendarCheck,
  ClipboardList,
  Clock3,
  Loader2,
  MapPin,
  Search,
  Stethoscope,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const TYPES = [
  ['exam', 'Exame'],
  ['laboratory', 'Laboratório'],
  ['imaging', 'Imagem'],
  ['specialist', 'Especialista'],
  ['consultation', 'Consulta'],
  ['therapy', 'Terapia'],
  ['procedure', 'Procedimento'],
  ['document', 'Documento'],
  ['other', 'Outro'],
] as const

const STATUS_LABELS: Record<string, string> = {
  new: 'Novo',
  researching: 'Pesquisando',
  options_ready: 'Opções prontas',
  awaiting_patient_choice: 'Aguardando escolha',
  selected: 'Opção escolhida',
  scheduling: 'Agendando',
  booked: 'Agendado',
  instructions_sent: 'Instruções enviadas',
  completed: 'Realizado',
  result_expected: 'Aguardando resultado',
  result_received: 'Resultado recebido',
  closed: 'Loop fechado',
  cancelled: 'Cancelado',
}

function statusTone(status: string) {
  if (['new', 'researching'].includes(status)) return 'bg-amber-100 text-amber-800'
  if (['options_ready', 'awaiting_patient_choice', 'selected', 'scheduling'].includes(status)) return 'bg-blue-100 text-blue-800'
  if (['booked', 'instructions_sent'].includes(status)) return 'bg-violet-100 text-violet-800'
  if (['completed', 'result_expected', 'result_received'].includes(status)) return 'bg-emerald-100 text-emerald-800'
  if (status === 'closed') return 'bg-slate-200 text-slate-700'
  return 'bg-gray-100 text-gray-600'
}

export default function ExternalCoordinationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState({
    patientId: searchParams.get('patient') || '',
    patientName: searchParams.get('name') || '',
    taskType: 'exam',
    title: '',
    description: '',
    targetSpecialty: '',
    city: '',
    state: 'SP',
    insuranceName: '',
  })

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
      const [{ data: teamMember, error: teamError }, { data: taskRows, error: taskError }] = await Promise.all([
        supabase.from('mydatamed_team_members').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('concierge_external_tasks').select('*').order('created_at', { ascending: false }).limit(200),
      ])
      if (teamError) throw teamError
      if (taskError) throw taskError
      setMember(teamMember)
      setTasks(taskRows || [])
    } catch (error) {
      console.error('External coordination unavailable:', error)
      setMember(null)
    } finally {
      setLoading(false)
    }
  }

  async function createTask() {
    if (!user) return
    if (!form.patientId.trim() || !form.title.trim()) {
      toast.error('Informe o Patient ID e o que precisa ser coordenado.')
      return
    }

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('concierge_external_tasks')
        .insert({
          patient_id: form.patientId.trim(),
          patient_name: form.patientName.trim() || null,
          requested_by: user.id,
          task_type: form.taskType,
          title: form.title.trim(),
          description: form.description.trim() || null,
          target_specialty: form.targetSpecialty.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim().toUpperCase() || null,
          insurance_name: form.insuranceName.trim() || null,
          status: 'new',
          metadata: { source: 'mydatamed_external_coordination' },
        })
        .select('*')
        .single()

      if (error) throw error

      await supabase.from('concierge_external_events').insert({
        task_id: data.id,
        patient_id: data.patient_id,
        actor_user_id: user.id,
        actor_role: member?.role || 'professional',
        event_type: 'external_task_created',
        visibility: 'patient',
        message: 'Uma nova etapa de coordenação foi aberta pelo Concierge.',
        payload: { task_type: data.task_type, title: data.title },
      })

      toast.success('Coordenação aberta')
      setForm({
        ...form,
        title: '',
        description: '',
        targetSpecialty: '',
        insuranceName: '',
      })
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível abrir a coordenação.')
    } finally {
      setSaving(false)
    }
  }

  async function takeTask(task: any) {
    if (!user) return
    setBusyId(task.id)
    try {
      const { error } = await supabase
        .from('concierge_external_tasks')
        .update({
          assigned_to: user.id,
          status: task.status === 'new' ? 'researching' : task.status,
        })
        .eq('id', task.id)
      if (error) throw error

      await supabase.from('concierge_external_events').insert({
        task_id: task.id,
        patient_id: task.patient_id,
        actor_user_id: user.id,
        actor_role: member?.role || 'concierge_agent',
        event_type: 'external_task_assigned',
        visibility: 'staff_only',
        message: 'Demanda assumida para coordenação externa.',
      })

      toast.success('Demanda assumida')
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível assumir.')
    } finally {
      setBusyId(null)
    }
  }

  const stats = useMemo(() => ({
    open: tasks.filter((item) => !['closed', 'cancelled'].includes(item.status)).length,
    searching: tasks.filter((item) => ['new', 'researching'].includes(item.status)).length,
    patient: tasks.filter((item) => ['options_ready', 'awaiting_patient_choice'].includes(item.status)).length,
    booked: tasks.filter((item) => ['booked', 'instructions_sent', 'completed', 'result_expected'].includes(item.status)).length,
  }), [tasks])

  const allowed = member?.active && ['master', 'admin', 'care_coordinator', 'concierge_agent', 'nurse', 'doctor'].includes(member.role)

  if (authLoading || loading) {
    return <div className="min-h-[65vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  if (!allowed) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-bold text-amber-950">Coordenação externa não habilitada</p>
          <p className="mt-2 text-sm text-amber-900/80">Seu papel atual não possui acesso a esta fila operacional.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-900 p-7 md:p-9 text-white shadow-xl">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100">
            <CalendarCheck className="w-4 h-4" /> Concierge · Coordenação Externa
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold">Do pedido ao resultado, sem perder o próximo passo.</h1>
          <p className="mt-3 text-white/75">Pesquisa de prestadores, opções, escolha do paciente, agendamento, preparo, realização, resultado e fechamento do loop.</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="Em aberto" value={stats.open} icon={ClipboardList} />
        <Metric label="Pesquisar" value={stats.searching} icon={Search} />
        <Metric label="Com paciente" value={stats.patient} icon={UserCheck} />
        <Metric label="Agendados / execução" value={stats.booked} icon={CalendarCheck} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Abrir nova coordenação</h2>
          <p className="mt-1 text-sm text-gray-500">Pode nascer de um caso clínico, plano de ação ou pedido direto do paciente.</p>

          <div className="mt-5 grid gap-3">
            <Input label="Patient ID HealthWallet" value={form.patientId} onChange={(value: string) => setForm({ ...form, patientId: value })} />
            <Input label="Nome do paciente" value={form.patientName} onChange={(value: string) => setForm({ ...form, patientName: value })} />

            <label className="text-sm font-medium text-gray-700">
              Tipo
              <select value={form.taskType} onChange={(e) => setForm({ ...form, taskType: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-3">
                {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <Input label="O que precisa acontecer" value={form.title} onChange={(value: string) => setForm({ ...form, title: value })} placeholder="Ex.: Agendar ultrassonografia abdominal" />
            <label className="text-sm font-medium text-gray-700">Detalhes<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 font-normal" placeholder="Pedido, preparo, preferência, restrições, prazo..." /></label>
            <Input label="Especialidade / exame alvo" value={form.targetSpecialty} onChange={(value: string) => setForm({ ...form, targetSpecialty: value })} placeholder="Ex.: Cardiologia, RM joelho..." />

            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Input label="Cidade" value={form.city} onChange={(value: string) => setForm({ ...form, city: value })} />
              <Input label="UF" value={form.state} onChange={(value: string) => setForm({ ...form, state: value.toUpperCase().slice(0, 2) })} />
            </div>
            <Input label="Plano / convênio" value={form.insuranceName} onChange={(value: string) => setForm({ ...form, insuranceName: value })} placeholder="Opcional" />

            <button onClick={createTask} disabled={saving} className="rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50">
              {saving ? 'Abrindo...' : 'Abrir coordenação'}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Fila operacional</h2>
              <p className="mt-1 text-sm text-gray-500">Priorize o que ainda não chegou ao próximo marco.</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{tasks.length}</span>
          </div>

          <div className="mt-5 space-y-3">
            {tasks.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-gray-500">Nenhuma coordenação disponível.</div>}
            {tasks.map((task) => (
              <div key={task.id} className="rounded-2xl border bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 border"><Stethoscope className="w-5 h-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={'rounded-full px-2 py-0.5 text-[11px] font-semibold ' + statusTone(task.status)}>{STATUS_LABELS[task.status] || task.status}</span>
                      {task.assigned_to === user?.id && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Com você</span>}
                    </div>
                    <p className="mt-2 font-bold text-gray-900">{task.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{task.patient_name || ('Paciente ' + String(task.patient_id).slice(0, 8))}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {task.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {task.city}{task.state ? '/' + task.state : ''}</span>}
                      {task.scheduled_at && <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" /> {new Date(task.scheduled_at).toLocaleString('pt-BR')}</span>}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!task.assigned_to && <button onClick={() => takeTask(task)} disabled={busyId === task.id} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busyId === task.id ? '...' : 'Assumir'}</button>}
                  <Link href={'/concierge/profissional/coordenacao/' + task.id} className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 text-xs font-bold text-gray-800">Abrir operação <ArrowRight className="w-3.5 h-3.5" /></Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function Metric({ label, value, icon: Icon }: any) {
  return <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><Icon className="w-5 h-5 text-emerald-700" /><p className="mt-3 text-2xl font-bold text-gray-900">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
}

function Input({ label, value, onChange, placeholder = '' }: any) {
  return <label className="text-sm font-medium text-gray-700">{label}<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 font-normal text-gray-900" /></label>
}
