'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  MessageCircle,
  Search,
  Send,
  Stethoscope,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

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

export default function ExternalCoordinationTaskPage() {
  const params = useParams<{ taskId: string }>()
  const taskId = String(params?.taskId || '')
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState<any>(null)
  const [task, setTask] = useState<any>(null)
  const [options, setOptions] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [optionForm, setOptionForm] = useState({
    providerName: '',
    providerType: '',
    address: '',
    city: '',
    state: 'SP',
    phone: '',
    website: '',
    priceAmount: '',
    acceptsInsurance: '',
    insuranceNotes: '',
    earliestSlot: '',
    distanceText: '',
    notes: '',
  })
  const [booking, setBooking] = useState({
    scheduledAt: '',
    bookingReference: '',
    providerAddress: '',
    preparationInstructions: '',
    resultExpectedAt: '',
  })
  const [message, setMessage] = useState('')
  const [messageVisibility, setMessageVisibility] = useState<'patient' | 'staff_only'>('staff_only')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && taskId) void load()
  }, [user?.id, taskId])

  async function load() {
    if (!user || !taskId) return
    setLoading(true)
    try {
      const [memberRes, taskRes, optionsRes, eventsRes] = await Promise.all([
        supabase.from('mydatamed_team_members').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('concierge_external_tasks').select('*').eq('id', taskId).single(),
        supabase.from('concierge_external_options').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
        supabase.from('concierge_external_events').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
      ])

      if (memberRes.error) throw memberRes.error
      if (taskRes.error) throw taskRes.error
      if (optionsRes.error) throw optionsRes.error
      if (eventsRes.error) throw eventsRes.error

      setMember(memberRes.data)
      setTask(taskRes.data)
      setOptions(optionsRes.data || [])
      setEvents(eventsRes.data || [])
      setBooking({
        scheduledAt: taskRes.data?.scheduled_at ? new Date(taskRes.data.scheduled_at).toISOString().slice(0, 16) : '',
        bookingReference: taskRes.data?.booking_reference || '',
        providerAddress: taskRes.data?.provider_address || '',
        preparationInstructions: taskRes.data?.preparation_instructions || '',
        resultExpectedAt: taskRes.data?.result_expected_at ? new Date(taskRes.data.result_expected_at).toISOString().slice(0, 16) : '',
      })
    } catch (error) {
      console.error('External task unavailable:', error)
      setTask(null)
    } finally {
      setLoading(false)
    }
  }

  async function addEvent(eventType: string, text: string, visibility: 'patient' | 'staff_only' = 'staff_only', payload: Record<string, unknown> = {}) {
    if (!user || !task) return
    const { error } = await supabase.from('concierge_external_events').insert({
      task_id: task.id,
      patient_id: task.patient_id,
      actor_user_id: user.id,
      actor_role: member?.role || 'concierge_agent',
      event_type: eventType,
      visibility,
      message: text,
      payload,
    })
    if (error) throw error
  }

  async function updateTask(patch: Record<string, unknown>, eventType: string, eventMessage: string, visibility: 'patient' | 'staff_only' = 'staff_only') {
    setBusy(true)
    try {
      const { error } = await supabase.from('concierge_external_tasks').update(patch).eq('id', task.id)
      if (error) throw error
      await addEvent(eventType, eventMessage, visibility, patch)
      toast.success('Coordenação atualizada')
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar.')
    } finally {
      setBusy(false)
    }
  }

  async function addOption() {
    if (!user || !task || !optionForm.providerName.trim()) {
      toast.error('Informe o prestador.')
      return
    }

    setBusy(true)
    try {
      const { error } = await supabase.from('concierge_external_options').insert({
        task_id: task.id,
        provider_name: optionForm.providerName.trim(),
        provider_type: optionForm.providerType.trim() || null,
        address: optionForm.address.trim() || null,
        city: optionForm.city.trim() || null,
        state: optionForm.state.trim().toUpperCase() || null,
        phone: optionForm.phone.trim() || null,
        website: optionForm.website.trim() || null,
        price_amount: optionForm.priceAmount ? Number(optionForm.priceAmount.replace(',', '.')) : null,
        accepts_insurance: optionForm.acceptsInsurance === '' ? null : optionForm.acceptsInsurance === 'yes',
        insurance_notes: optionForm.insuranceNotes.trim() || null,
        earliest_slot: optionForm.earliestSlot ? new Date(optionForm.earliestSlot).toISOString() : null,
        distance_text: optionForm.distanceText.trim() || null,
        notes: optionForm.notes.trim() || null,
        status: 'candidate',
        created_by: user.id,
      })
      if (error) throw error

      await addEvent('provider_option_added', 'Uma nova opção de prestador foi adicionada à pesquisa.', 'staff_only')
      if (task.status === 'new') {
        await supabase.from('concierge_external_tasks').update({ status: 'researching' }).eq('id', task.id)
      }

      setOptionForm({
        providerName: '',
        providerType: '',
        address: '',
        city: task.city || '',
        state: task.state || 'SP',
        phone: '',
        website: '',
        priceAmount: '',
        acceptsInsurance: '',
        insuranceNotes: '',
        earliestSlot: '',
        distanceText: '',
        notes: '',
      })
      toast.success('Opção adicionada')
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível adicionar a opção.')
    } finally {
      setBusy(false)
    }
  }

  async function sendOptionsToPatient() {
    if (!task || options.length === 0) {
      toast.error('Adicione pelo menos uma opção.')
      return
    }

    setBusy(true)
    try {
      const ids = options.filter((item) => item.status !== 'unavailable').map((item) => item.id)
      if (ids.length === 0) throw new Error('Não há opções disponíveis.')

      const { error: optionError } = await supabase
        .from('concierge_external_options')
        .update({ status: 'offered' })
        .in('id', ids)
      if (optionError) throw optionError

      const { error: taskError } = await supabase
        .from('concierge_external_tasks')
        .update({ status: 'awaiting_patient_choice' })
        .eq('id', task.id)
      if (taskError) throw taskError

      await addEvent(
        'options_shared',
        'O Concierge encontrou opções e aguarda a escolha do paciente.',
        'patient',
        { option_ids: ids },
      )
      toast.success('Opções liberadas ao paciente')
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível liberar as opções.')
    } finally {
      setBusy(false)
    }
  }

  async function selectOption(option: any) {
    setBusy(true)
    try {
      const { error: resetError } = await supabase
        .from('concierge_external_options')
        .update({ status: 'rejected' })
        .eq('task_id', task.id)
        .neq('id', option.id)
        .in('status', ['offered', 'candidate'])
      if (resetError) throw resetError

      const { error: optionError } = await supabase
        .from('concierge_external_options')
        .update({ status: 'selected' })
        .eq('id', option.id)
      if (optionError) throw optionError

      const { error: taskError } = await supabase
        .from('concierge_external_tasks')
        .update({
          selected_option_id: option.id,
          provider_name: option.provider_name,
          provider_contact: option.phone || option.website || null,
          provider_address: option.address || null,
          status: 'selected',
        })
        .eq('id', task.id)
      if (taskError) throw taskError

      await addEvent(
        'provider_selected',
        'Opção de prestador selecionada para prosseguir com o agendamento.',
        'patient',
        { option_id: option.id, provider_name: option.provider_name },
      )
      toast.success('Opção selecionada')
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível selecionar.')
    } finally {
      setBusy(false)
    }
  }

  async function saveBooking() {
    if (!booking.scheduledAt) {
      toast.error('Informe data e horário.')
      return
    }

    await updateTask({
      status: 'booked',
      scheduled_at: new Date(booking.scheduledAt).toISOString(),
      booking_reference: booking.bookingReference.trim() || null,
      provider_address: booking.providerAddress.trim() || task.provider_address || null,
      preparation_instructions: booking.preparationInstructions.trim() || null,
      result_expected_at: booking.resultExpectedAt ? new Date(booking.resultExpectedAt).toISOString() : null,
    }, 'booking_confirmed', 'Agendamento confirmado pelo Concierge.', 'patient')
  }

  async function saveMessage() {
    if (!message.trim()) return
    setBusy(true)
    try {
      await addEvent(
        messageVisibility === 'patient' ? 'concierge_message' : 'internal_note',
        message.trim(),
        messageVisibility,
      )
      setMessage('')
      toast.success(messageVisibility === 'patient' ? 'Mensagem registrada para o paciente' : 'Nota interna registrada')
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível registrar.')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading || loading) {
    return <div className="min-h-[65vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  if (!task) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <Link href="/concierge/profissional/coordenacao" className="inline-flex items-center gap-2 text-sm text-gray-600"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Demanda indisponível para seu usuário.</div>
      </main>
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <Link href="/concierge/profissional/coordenacao" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600"><ArrowLeft className="w-4 h-4" /> Fila de coordenação</Link>

      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-900 p-7 md:p-9 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1.5">{STATUS_LABELS[task.status] || task.status}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">{task.task_type}</span>
            </div>
            <p className="mt-4 text-sm text-white/60">{task.patient_name || ('Paciente ' + String(task.patient_id).slice(0, 8))}</p>
            <h1 className="mt-1 text-3xl md:text-4xl font-bold">{task.title}</h1>
            {task.description && <p className="mt-3 max-w-3xl text-white/75">{task.description}</p>}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 min-w-[230px]">
            <p className="text-xs text-white/60">Prestador selecionado</p>
            <p className="mt-1 font-bold">{task.provider_name || 'Ainda não selecionado'}</p>
            {task.scheduled_at && <p className="mt-2 text-xs text-white/70">{new Date(task.scheduled_at).toLocaleString('pt-BR')}</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Search className="w-5 h-5 text-emerald-700" /><h2 className="font-bold text-gray-900">Adicionar opção de prestador</h2></div>
            <div className="mt-4 grid gap-3">
              <Input label="Prestador" value={optionForm.providerName} onChange={(value: string) => setOptionForm({ ...optionForm, providerName: value })} />
              <Input label="Tipo / unidade" value={optionForm.providerType} onChange={(value: string) => setOptionForm({ ...optionForm, providerType: value })} placeholder="Hospital, clínica, laboratório..." />
              <Input label="Endereço" value={optionForm.address} onChange={(value: string) => setOptionForm({ ...optionForm, address: value })} />
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <Input label="Cidade" value={optionForm.city} onChange={(value: string) => setOptionForm({ ...optionForm, city: value })} />
                <Input label="UF" value={optionForm.state} onChange={(value: string) => setOptionForm({ ...optionForm, state: value.toUpperCase().slice(0, 2) })} />
              </div>
              <Input label="Telefone" value={optionForm.phone} onChange={(value: string) => setOptionForm({ ...optionForm, phone: value })} />
              <Input label="Site" value={optionForm.website} onChange={(value: string) => setOptionForm({ ...optionForm, website: value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Preço estimado" value={optionForm.priceAmount} onChange={(value: string) => setOptionForm({ ...optionForm, priceAmount: value })} placeholder="R$" />
                <Input label="Distância" value={optionForm.distanceText} onChange={(value: string) => setOptionForm({ ...optionForm, distanceText: value })} placeholder="Ex.: 3,2 km" />
              </div>
              <label className="text-sm font-medium text-gray-700">Aceita convênio<select value={optionForm.acceptsInsurance} onChange={(e) => setOptionForm({ ...optionForm, acceptsInsurance: e.target.value })} className="mt-1 w-full rounded-xl border bg-white px-3 py-3"><option value="">Não confirmado</option><option value="yes">Sim</option><option value="no">Não</option></select></label>
              <Input label="Observação sobre convênio" value={optionForm.insuranceNotes} onChange={(value: string) => setOptionForm({ ...optionForm, insuranceNotes: value })} />
              <label className="text-sm font-medium text-gray-700">Primeiro horário disponível<input type="datetime-local" value={optionForm.earliestSlot} onChange={(e) => setOptionForm({ ...optionForm, earliestSlot: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-3" /></label>
              <label className="text-sm font-medium text-gray-700">Notas<textarea value={optionForm.notes} onChange={(e) => setOptionForm({ ...optionForm, notes: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal" /></label>
              <button onClick={addOption} disabled={busy} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Adicionar opção</button>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-emerald-700" /><h2 className="font-bold text-gray-900">Comunicação / notas</h2></div>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="mt-4 w-full rounded-xl border px-3 py-3 text-sm" placeholder="Contato com clínica, retorno do paciente, orientação..." />
            <select value={messageVisibility} onChange={(e) => setMessageVisibility(e.target.value as 'patient' | 'staff_only')} className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm"><option value="staff_only">Nota interna</option><option value="patient">Visível ao paciente</option></select>
            <button onClick={saveMessage} disabled={busy || !message.trim()} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50"><Send className="w-4 h-4" /> Registrar</button>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="font-bold text-gray-900">Opções encontradas</h2><p className="mt-1 text-xs text-gray-500">Compare antes de pedir a escolha do paciente.</p></div>
              <button onClick={sendOptionsToPatient} disabled={busy || options.length === 0} className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Enviar opções</button>
            </div>
            <div className="mt-4 space-y-3">
              {options.length === 0 && <Empty text="Nenhuma opção pesquisada ainda." />}
              {options.map((option) => (
                <div key={option.id} className={'rounded-2xl border p-4 ' + (option.status === 'selected' ? 'border-emerald-300 bg-emerald-50' : 'bg-gray-50')}>
                  <div className="flex items-start gap-3">
                    <Stethoscope className="mt-0.5 w-5 h-5 text-emerald-700" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-gray-900">{option.provider_name}</p><span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold">{option.status}</span></div>
                      <div className="mt-2 space-y-1 text-xs text-gray-500">
                        {option.address && <p className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {option.address}</p>}
                        {option.earliest_slot && <p className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" /> {new Date(option.earliest_slot).toLocaleString('pt-BR')}</p>}
                        {option.price_amount != null && <p>Preço: R$ {Number(option.price_amount).toFixed(2).replace('.', ',')}</p>}
                        {option.accepts_insurance != null && <p>Convênio: {option.accepts_insurance ? 'aceita' : 'não aceita'}</p>}
                        {option.distance_text && <p>Distância: {option.distance_text}</p>}
                      </div>
                      {option.notes && <p className="mt-2 text-sm text-gray-600">{option.notes}</p>}
                    </div>
                  </div>
                  {option.status !== 'selected' && <button onClick={() => selectOption(option)} disabled={busy} className="mt-3 rounded-xl border bg-white px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50">Marcar como escolhida</button>}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
            <div className="flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-violet-700" /><h2 className="font-bold text-violet-950">Fechar agendamento</h2></div>
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-medium text-gray-700">Data e horário<input type="datetime-local" value={booking.scheduledAt} onChange={(e) => setBooking({ ...booking, scheduledAt: e.target.value })} className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-3" /></label>
              <Input label="Referência / protocolo" value={booking.bookingReference} onChange={(value: string) => setBooking({ ...booking, bookingReference: value })} />
              <Input label="Endereço final" value={booking.providerAddress} onChange={(value: string) => setBooking({ ...booking, providerAddress: value })} />
              <label className="text-sm font-medium text-gray-700">Preparo / instruções<textarea value={booking.preparationInstructions} onChange={(e) => setBooking({ ...booking, preparationInstructions: e.target.value })} rows={4} className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-3 font-normal" /></label>
              <label className="text-sm font-medium text-gray-700">Resultado esperado em<input type="datetime-local" value={booking.resultExpectedAt} onChange={(e) => setBooking({ ...booking, resultExpectedAt: e.target.value })} className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-3" /></label>
              <button onClick={saveBooking} disabled={busy} className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Confirmar agendamento</button>
            </div>
          </section>

          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-700" /><h2 className="font-bold text-emerald-950">Fechar o loop</h2></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <ActionButton label="Marcar realizado" onClick={() => updateTask({ status: 'completed' }, 'service_completed', 'O atendimento/exame foi marcado como realizado.', 'patient')} />
              <ActionButton label="Aguardar resultado" onClick={() => updateTask({ status: 'result_expected' }, 'result_expected', 'O Concierge está aguardando o resultado para continuar a jornada.', 'patient')} />
              <ActionButton label="Resultado recebido" onClick={() => updateTask({ status: 'result_received', result_received_at: new Date().toISOString() }, 'result_received', 'O resultado foi recebido e a jornada seguirá para revisão/próximo passo.', 'patient')} />
              <ActionButton label="Loop fechado" primary onClick={() => updateTask({ status: 'closed', closed_at: new Date().toISOString() }, 'external_loop_closed', 'Esta etapa de coordenação foi concluída.', 'patient')} />
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-gray-900">Linha do tempo</h2>
            <div className="mt-4 space-y-1">
              {events.length === 0 && <Empty text="Nenhum evento registrado." />}
              {events.map((event) => (
                <div key={event.id} className="border-l-2 border-emerald-200 py-2 pl-4">
                  <div className="flex flex-wrap gap-2 text-[11px] text-gray-500"><span>{new Date(event.created_at).toLocaleString('pt-BR')}</span><span>·</span><span>{event.actor_role}</span>{event.visibility === 'staff_only' && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">interno</span>}</div>
                  <p className="mt-1 text-sm text-gray-800">{event.message || event.event_type}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

function Input({ label, value, onChange, placeholder = '' }: any) {
  return <label className="text-sm font-medium text-gray-700">{label}<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal text-gray-900" /></label>
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed bg-gray-50 p-5 text-center text-sm text-gray-500">{text}</div>
}

function ActionButton({ label, onClick, primary = false }: any) {
  return <button onClick={onClick} className={'rounded-xl px-3 py-3 text-xs font-bold ' + (primary ? 'bg-emerald-700 text-white' : 'border border-emerald-300 bg-white text-emerald-800')}>{label}</button>
}
