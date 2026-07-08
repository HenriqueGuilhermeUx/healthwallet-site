'use client'

import { useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  User,
  Activity,
  FileText,
  Pill,
  CalendarDays,
  QrCode,
  Brain,
  Video,
} from 'lucide-react'

export default function PatientByPatientPage({ params }: { params: Promise<{ patientId: string }> }) {
  const resolvedParams = use(params)
  const searchParams = useSearchParams()
  const appointmentId = searchParams.get('appointment')
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [appointment, setAppointment] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [score, setScore] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const [medications, setMedications] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && professional && resolvedParams.patientId) load()
  }, [user, professional, resolvedParams.patientId, appointmentId])

  async function safeSingle(table: string, field: string, value: string, orderField?: string) {
    try {
      let query = supabase.from(table).select('*').eq(field, value)
      if (orderField) query = query.order(orderField, { ascending: false })
      const { data } = await query.limit(1).maybeSingle()
      return data || null
    } catch {
      return null
    }
  }

  async function safeList(table: string, field: string, value: string, orderField = 'created_at') {
    try {
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq(field, value)
        .order(orderField, { ascending: false })
        .limit(20)
      return data || []
    } catch {
      return []
    }
  }

  async function load() {
    if (!professional) return
    setLoading(true)

    try {
      let appointmentRow = null

      if (appointmentId) {
        const { data, error } = await supabase
          .from('telemedicine_appointments')
          .select('*')
          .eq('id', appointmentId)
          .eq('professional_id', professional.id)
          .maybeSingle()

        if (error || !data) {
          toast.error('Consulta não encontrada')
          router.push('/teleconsultas')
          return
        }

        if (!data.data_sharing_authorized) {
          toast.error('Paciente ainda não autorizou os dados desta consulta')
          router.push('/teleconsultas')
          return
        }

        appointmentRow = data
      }

      const patientId = resolvedParams.patientId
      setAppointment(appointmentRow)
      setProfile(await safeSingle('profiles', 'id', patientId))
      setSummary(await safeSingle('health_summaries', 'user_id', patientId, 'created_at'))
      setScore(await safeSingle('health_scores', 'user_id', patientId, 'calculated_at'))
      setRecords(await safeList('medical_records', 'user_id', patientId, 'created_at'))
      setMedications(await safeList('medications', 'user_id', patientId, 'created_at'))
      setTimeline(await safeList('medical_events', 'user_id', patientId, 'event_date'))
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar dados do paciente')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/teleconsultas" className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:underline mb-3">
            <ArrowLeft className="w-4 h-4" />
            Voltar para teleconsultas
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Dados autorizados do paciente</h1>
          <p className="text-gray-600 mt-1">Visualização vinculada à teleconsulta e ao consentimento do paciente.</p>
        </div>
        <div className="hidden md:flex w-12 h-12 rounded-2xl bg-emerald-100 items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-emerald-700" />
        </div>
      </div>

      {appointment && (
        <section className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 text-sm text-cyan-900 flex items-start gap-3">
          <Video className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-semibold">Consulta: {appointment.specialty}</p>
            <p>
              {formatDate(appointment.preferred_date)} {appointment.preferred_time ? `às ${String(appointment.preferred_time).slice(0, 5)}` : ''} • dados autorizados para este evento.
            </p>
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-4 gap-3">
        <InfoCard icon={User} title="Paciente" value={profile?.full_name || profile?.name || profile?.email || 'Paciente'} />
        <InfoCard icon={Activity} title="MedScore" value={score?.score ? `${score.score}/100` : 'Não calculado'} />
        <InfoCard icon={FileText} title="Exames" value={records.length} />
        <InfoCard icon={Pill} title="Medicamentos" value={medications.length} />
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-5 h-5 text-purple-600" />
          <h2 className="font-bold text-lg">Resumo IA / Profissional</h2>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">
          {summary?.professional_summary || summary?.summary || summary?.patient_summary || 'Nenhum resumo salvo ainda.'}
        </p>
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        <DataSection title="Exames e documentos" icon={FileText} items={records} empty="Nenhum exame encontrado." render={(item) => (
          <div>
            <p className="font-medium text-gray-900">{item.exam_type || item.title || item.file_name || 'Exame'}</p>
            <p className="text-xs text-gray-500">{formatDate(item.created_at || item.event_date)}</p>
            {item.ai_analysis && <p className="text-sm text-gray-700 mt-2 line-clamp-3">{typeof item.ai_analysis === 'string' ? item.ai_analysis : JSON.stringify(item.ai_analysis)}</p>}
          </div>
        )} />

        <DataSection title="Medicamentos" icon={Pill} items={medications} empty="Nenhum medicamento encontrado." render={(item) => (
          <div>
            <p className="font-medium text-gray-900">{item.name || item.medication_name || 'Medicamento'}</p>
            <p className="text-sm text-gray-600">{[item.dosage, item.frequency, item.reminder_time ? `às ${String(item.reminder_time).slice(0, 5)}` : ''].filter(Boolean).join(' · ')}</p>
          </div>
        )} />
      </div>

      <DataSection title="Timeline de saúde" icon={CalendarDays} items={timeline} empty="Nenhum evento encontrado." render={(item) => (
        <div>
          <p className="font-medium text-gray-900">{item.title || item.type || 'Evento'}</p>
          <p className="text-xs text-gray-500">{formatDate(item.event_date || item.created_at)}</p>
          {item.description && <p className="text-sm text-gray-700 mt-1">{item.description}</p>}
        </div>
      )} />

      <section className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-sm text-orange-900 flex items-start gap-3">
        <QrCode className="w-5 h-5 mt-0.5" />
        <p>
          Passport, alergias, tipo sanguíneo e contatos de emergência devem ser consultados conforme os dados que o paciente preencheu no HealthWallet.
        </p>
      </section>
    </div>
  )
}

function InfoCard({ icon: Icon, title, value }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <Icon className="w-5 h-5 text-emerald-600 mb-2" />
      <p className="text-xs text-gray-500">{title}</p>
      <p className="font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}

function DataSection({ title, icon: Icon, items, empty, render }: any) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-emerald-600" />
        <h2 className="font-bold text-lg">{title}</h2>
      </div>
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item: any) => (
            <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              {render(item)}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">{empty}</p>
      )}
    </section>
  )
}

function formatDate(date: string) {
  if (!date) return 'Data não informada'
  return new Date(date).toLocaleDateString('pt-BR')
}
