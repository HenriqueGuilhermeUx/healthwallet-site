'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Loader2,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
  Video,
} from 'lucide-react'

type PageProps = {
  params: Promise<{ appointmentId: string }>
}

export default function EmbeddedCallPage({ params }: PageProps) {
  const { appointmentId } = use(params)
  const { user, session, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [appointment, setAppointment] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && professional && appointmentId) load()
  }, [user, professional, appointmentId])

  const roomUrl = useMemo(() => appointment?.room_url || appointment?.meet_url || '', [appointment])
  const isDaily = useMemo(() => appointment?.provider === 'daily' || String(roomUrl).includes('daily.co'), [appointment, roomUrl])

  async function load() {
    if (!professional) return
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('telemedicine_appointments')
      .select('*')
      .eq('id', appointmentId)
      .maybeSingle()

    if (error || !data) {
      setError('Teleconsulta não encontrada.')
      setLoading(false)
      return
    }

    if (data.professional_id && data.professional_id !== professional.id) {
      setError('Esta teleconsulta pertence a outro profissional.')
      setLoading(false)
      return
    }

    setAppointment(data)
    setLoading(false)
  }

  async function createDailyRoom() {
    if (!session?.access_token) {
      toast.error('Sessão expirada. Entre novamente.')
      return
    }

    setCreating(true)

    const response = await fetch('/api/video/daily/create-room', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ appointment_id: appointmentId }),
    })

    const payload = await response.json()

    if (!response.ok) {
      toast.error(payload.error || 'Erro ao criar sala Daily')
      setCreating(false)
      return
    }

    toast.success('Sala Daily criada')
    setCreating(false)
    await load()
  }

  async function markStarted() {
    if (!appointment) return

    await supabase
      .from('telemedicine_appointments')
      .update({
        status: 'in_progress',
        started_at: appointment.started_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointment.id)

    await supabase.from('telemedicine_events').insert({
      appointment_id: appointment.id,
      actor_user_id: user?.id || null,
      professional_id: professional?.id || null,
      patient_id: appointment.patient_id || appointment.user_id || null,
      type: 'embedded_call_started',
      description: 'Profissional abriu a chamada embutida no MyDataMed.',
      metadata: { room_url: roomUrl },
    })

    toast.success('Chamada marcada como iniciada')
    await load()
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full rounded-3xl bg-white border p-8 text-center shadow-sm">
          <Video className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Não foi possível abrir a chamada</h1>
          <p className="text-gray-600 mt-2">{error}</p>
          <Link href="/teleconsultas" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold">
            <ArrowLeft className="w-4 h-4" />
            Voltar para teleconsultas
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="border-b border-white/10 bg-slate-950/95 backdrop-blur px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/teleconsultas" className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/15">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-bold text-lg">{appointment?.specialty || 'Teleconsulta'}</h1>
                <span className="text-xs rounded-full bg-emerald-500/15 text-emerald-200 px-2 py-0.5">
                  {isDaily ? 'Daily embutido' : 'Link externo'}
                </span>
              </div>
              <p className="text-xs text-white/60 flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {formatDate(appointment?.preferred_date)} {appointment?.preferred_time ? `às ${String(appointment.preferred_time).slice(0, 5)}` : ''}</span>
                <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {appointment?.patient_name || `Paciente ${String(appointment?.patient_id || appointment?.user_id || '').slice(0, 8)}`}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={load} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15">
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
            {roomUrl && (
              <a href={roomUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15">
                <ExternalLink className="w-4 h-4" />
                Abrir fora
              </a>
            )}
            {roomUrl && (
              <button onClick={markStarted} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
                <PlayCircle className="w-4 h-4" />
                Marcar início
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="flex-1 p-3 md:p-5">
        {!roomUrl ? (
          <div className="h-full min-h-[70vh] max-w-3xl mx-auto flex items-center justify-center">
            <div className="rounded-[2rem] bg-white text-gray-900 border p-8 text-center shadow-2xl">
              <Sparkles className="w-14 h-14 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Sala ainda não criada</h2>
              <p className="text-gray-600 mt-2 max-w-xl">
                Gere uma sala Daily premium para embutir a teleconsulta no MyDataMed. O link manual Google Meet/Zoom continua disponível como fallback pela agenda.
              </p>
              <button
                onClick={createDailyRoom}
                disabled={creating}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-6 py-3 font-semibold disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Gerar sala Daily e abrir aqui
              </button>
            </div>
          </div>
        ) : isDaily ? (
          <div className="h-[calc(100vh-96px)] rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl">
            <iframe
              title="Teleconsulta MyDataMed"
              src={roomUrl}
              className="w-full h-full border-0"
              allow="camera; microphone; fullscreen; speaker; display-capture; autoplay; clipboard-read; clipboard-write"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        ) : (
          <div className="h-full min-h-[70vh] max-w-3xl mx-auto flex items-center justify-center">
            <div className="rounded-[2rem] bg-white text-gray-900 border p-8 text-center shadow-2xl">
              <Video className="w-14 h-14 text-cyan-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Esta consulta usa link externo</h2>
              <p className="text-gray-600 mt-2 max-w-xl">
                O link salvo não é Daily. Abra em nova aba ou volte à agenda para gerar uma sala Daily embutida.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                <a href={roomUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 text-white px-6 py-3 font-semibold">
                  <ExternalLink className="w-5 h-5" />
                  Abrir link externo
                </a>
                <button onClick={createDailyRoom} disabled={creating} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-6 py-3 font-semibold disabled:opacity-50">
                  {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  Trocar para Daily
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-white/10 px-4 py-2 text-xs text-white/50 flex items-center justify-center gap-2">
        <ShieldCheck className="w-3 h-3" />
        MyDataMed Pro — chamada embutida com fallback externo.
      </footer>
    </main>
  )
}

function formatDate(date: string) {
  if (!date) return 'Data não informada'
  return new Date(date).toLocaleDateString('pt-BR')
}
