'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { CalendarDays, ExternalLink, Loader2, Sparkles, User, Video } from 'lucide-react'

export default function CallCenterPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (professional) load()
  }, [professional])

  async function load() {
    if (!professional) return
    setLoading(true)

    const { data } = await supabase
      .from('telemedicine_appointments')
      .select('*')
      .or(`professional_id.eq.${professional.id},professional_id.is.null`)
      .in('status', ['requested', 'scheduled', 'confirmed', 'reminder_sent', 'in_progress'])
      .order('preferred_date', { ascending: true, nullsFirst: false })
      .order('preferred_time', { ascending: true, nullsFirst: false })
      .limit(30)

    setAppointments(data || [])
    setLoading(false)
  }

  const stats = useMemo(() => ({
    total: appointments.length,
    daily: appointments.filter((item) => item.provider === 'daily' || String(item.room_url || item.meet_url || '').includes('daily.co')).length,
  }), [appointments])

  if (authLoading || !professional || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="rounded-3xl bg-slate-950 text-white p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <Video className="w-8 h-8" />
          </div>
          <div>
            <p className="text-emerald-200 text-sm font-medium">MyDataMed Pro</p>
            <h1 className="text-2xl md:text-3xl font-bold">Central de chamadas embutidas</h1>
            <p className="text-white/70 mt-2 max-w-3xl">
              Abra teleconsultas Daily dentro do MyDataMed. Consultas com Google Meet/Zoom continuam como link externo ou podem ser convertidas para Daily pela tela da chamada.
            </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Ativas" value={stats.total} />
        <Stat label="Daily" value={stats.daily} />
        <Stat label="Fallback" value={stats.total - stats.daily} />
      </section>

      <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-bold text-lg text-gray-900">Próximas chamadas</h2>
          <Link href="/teleconsultas" className="text-sm text-emerald-700 font-semibold hover:underline">Ver agenda</Link>
        </div>

        {appointments.length > 0 ? (
          <div className="space-y-3">
            {appointments.map((item) => {
              const roomUrl = item.room_url || item.meet_url || ''
              const isDaily = item.provider === 'daily' || String(roomUrl).includes('daily.co')

              return (
                <div key={item.id} className="rounded-2xl border bg-gray-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">{item.specialty || 'Teleconsulta'}</h3>
                      <span className={`text-xs rounded-full px-2 py-0.5 ${isDaily ? 'bg-emerald-100 text-emerald-700' : 'bg-cyan-100 text-cyan-700'}`}>
                        {isDaily ? 'Daily embutido' : roomUrl ? 'Link externo' : 'Sem sala'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" />
                      {formatDate(item.preferred_date)} {item.preferred_time ? `às ${String(item.preferred_time).slice(0, 5)}` : ''}
                    </p>
                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {item.patient_name || `Paciente ${String(item.patient_id || item.user_id || '').slice(0, 8)}`}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Link href={`/call/${item.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold">
                      <Sparkles className="w-4 h-4" />
                      Abrir embutido
                    </Link>
                    {roomUrl && (
                      <a href={roomUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border px-4 py-2 text-sm font-semibold text-gray-700">
                        <ExternalLink className="w-4 h-4" />
                        Abrir fora
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            Nenhuma teleconsulta ativa. Crie uma consulta pela agenda.
          </div>
        )}
      </section>
    </main>
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

function formatDate(date: string) {
  if (!date) return 'Data não informada'
  return new Date(date).toLocaleDateString('pt-BR')
}
