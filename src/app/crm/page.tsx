'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  Bell,
  Bot,
  CalendarDays,
  CheckCircle,
  Clock,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react'

const TASK_TYPES = [
  { value: 'reminder', label: 'Lembrete' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'post_consultation', label: 'Pós-consulta' },
  { value: 'payment', label: 'Pagamento' },
  { value: 'document', label: 'Documento' },
  { value: 'manual', label: 'Manual' },
]

export default function CrmPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [contacts, setContacts] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    patient_id: '',
    patient_name: '',
    patient_email: '',
    task_type: 'follow_up',
    title: 'Follow-up do paciente',
    description: '',
    due_at: '',
    channel: 'manual',
  })

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && professional) load()
  }, [user, professional])

  async function load() {
    if (!user) return
    setLoading(true)

    const [{ data: contactRows, error: contactError }, { data: taskRows, error: taskError }] = await Promise.all([
      supabase
        .from('professional_crm_contacts')
        .select('*')
        .eq('professional_user_id', user.id)
        .order('last_contact_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('professional_crm_tasks')
        .select('*')
        .eq('professional_user_id', user.id)
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (contactError || taskError) {
      toast.error('Erro ao carregar CRM. Rode o SQL_TELECONSULTA_CRM_NEXTGEN_V2.sql no Supabase.')
    }

    setContacts(contactRows || [])
    setTasks(taskRows || [])
    setLoading(false)
  }

  async function createTask() {
    if (!user || !professional) return
    if (!form.title) {
      toast.error('Informe o título da tarefa')
      return
    }

    let patientId = form.patient_id || null

    if (!patientId && (form.patient_name || form.patient_email)) {
      const { data: contact } = await supabase
        .from('professional_crm_contacts')
        .insert({
          professional_user_id: user.id,
          patient_name: form.patient_name || null,
          patient_email: form.patient_email || null,
          source: 'manual',
          lifecycle_stage: 'lead',
          last_contact_at: new Date().toISOString(),
        })
        .select('*')
        .single()

      patientId = contact?.patient_id || null
    }

    const { error } = await supabase.from('professional_crm_tasks').insert({
      professional_user_id: user.id,
      patient_id: patientId,
      task_type: form.task_type,
      title: form.title,
      description: form.description || null,
      due_at: form.due_at || null,
      channel: form.channel,
      status: 'pending',
      metadata: {
        professional_id: professional.id,
        patient_name: form.patient_name || null,
        patient_email: form.patient_email || null,
      },
    })

    if (error) {
      toast.error(error.message || 'Erro ao criar tarefa')
      return
    }

    toast.success('Tarefa CRM criada')
    setShowForm(false)
    setForm({
      patient_id: '',
      patient_name: '',
      patient_email: '',
      task_type: 'follow_up',
      title: 'Follow-up do paciente',
      description: '',
      due_at: '',
      channel: 'manual',
    })
    load()
  }

  async function markDone(taskId: string) {
    const { error } = await supabase
      .from('professional_crm_tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', taskId)

    if (error) {
      toast.error(error.message || 'Erro ao concluir tarefa')
      return
    }

    toast.success('Tarefa concluída')
    load()
  }

  const stats = useMemo(() => {
    return {
      contacts: contacts.length,
      pending: tasks.filter((task) => task.status === 'pending').length,
      done: tasks.filter((task) => task.status === 'done').length,
      today: tasks.filter((task) => task.due_at && new Date(task.due_at).toDateString() === new Date().toDateString()).length,
    }
  }, [contacts, tasks])

  if (authLoading || !professional || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-purple-700 to-slate-950 text-white p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <p className="text-white/70 text-sm font-medium">MyDataMed Pro</p>
              <h1 className="text-2xl md:text-3xl font-bold">CRM SmartBots</h1>
              <p className="text-white/75 mt-2 max-w-2xl">
                Lembretes, follow-up, pós-consulta, pagamento, documentos e reativação de pacientes em um cockpit simples.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={load} className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-4 py-2 font-semibold">
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
            <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 font-semibold">
              <Plus className="w-4 h-4" />
              Nova tarefa
            </button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Users} label="Contatos" value={stats.contacts} />
        <Stat icon={Bell} label="Pendentes" value={stats.pending} />
        <Stat icon={CalendarDays} label="Hoje" value={stats.today} />
        <Stat icon={CheckCircle} label="Concluídas" value={stats.done} />
      </section>

      {showForm && (
        <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-xl text-gray-900">Criar tarefa CRM</h2>

          <div className="grid md:grid-cols-3 gap-3">
            <Input label="Patient ID opcional" value={form.patient_id} onChange={(value: string) => setForm({ ...form, patient_id: value })} />
            <Input label="Nome" value={form.patient_name} onChange={(value: string) => setForm({ ...form, patient_name: value })} />
            <Input label="E-mail" value={form.patient_email} onChange={(value: string) => setForm({ ...form, patient_email: value })} />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Tipo</label>
              <select value={form.task_type} onChange={(event) => setForm({ ...form, task_type: event.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200">
                {TASK_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <Input label="Título" value={form.title} onChange={(value: string) => setForm({ ...form, title: value })} />
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Prazo</label>
              <input type="datetime-local" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Mensagem / observação</label>
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200 min-h-[100px]" />
          </div>

          <button onClick={createTask} className="w-full rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold">Salvar tarefa</button>
        </section>
      )}

      <section className="grid lg:grid-cols-[1fr_0.85fr] gap-6">
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-xl text-gray-900 mb-4">Tarefas e automações</h2>
          {tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-2xl border bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs rounded-full bg-white border px-2 py-0.5 text-gray-600">{translateTaskType(task.task_type)}</span>
                        <span className={`text-xs rounded-full px-2 py-0.5 ${task.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{task.status}</span>
                      </div>
                      <p className="font-semibold text-gray-900 mt-2">{task.title}</p>
                      {task.description && <p className="text-sm text-gray-600 mt-1">{task.description}</p>}
                      {task.due_at && <p className="text-xs text-gray-500 mt-2 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(task.due_at).toLocaleString('pt-BR')}</p>}
                    </div>
                    {task.status !== 'done' && (
                      <button onClick={() => markDone(task.id)} className="rounded-xl bg-emerald-600 text-white px-3 py-2 text-sm font-semibold">Concluir</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nenhuma tarefa ainda. Crie follow-ups ou gere tarefas automaticamente pelas teleconsultas.</p>
          )}
        </div>

        <aside className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-xl text-gray-900 mb-4">Contatos</h2>
          {contacts.length > 0 ? (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div key={contact.id} className="rounded-2xl border bg-gray-50 p-4">
                  <p className="font-semibold text-gray-900">{contact.patient_name || `Paciente ${String(contact.patient_id || '').slice(0, 8)}`}</p>
                  {contact.patient_email && <p className="text-sm text-gray-600">{contact.patient_email}</p>}
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <MessageCircle className="w-3 h-3" />
                    {contact.lifecycle_stage || 'lead'} • {contact.source || 'manual'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Os contatos vão aparecer quando você atender, agendar ou criar tarefas.</p>
          )}
        </aside>
      </section>
    </main>
  )
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <Icon className="w-5 h-5 text-purple-700 mb-2" />
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function Input({ label, value, onChange }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-purple-500/20" />
    </div>
  )
}

function translateTaskType(type: string) {
  const map: Record<string, string> = {
    reminder: 'Lembrete',
    follow_up: 'Follow-up',
    post_consultation: 'Pós-consulta',
    payment: 'Pagamento',
    document: 'Documento',
    manual: 'Manual',
  }
  return map[type] || type
}
