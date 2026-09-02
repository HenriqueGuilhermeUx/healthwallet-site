'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Activity, AlertTriangle, HeartPulse, Loader2, Mail, Moon, RefreshCw, Search, ShieldCheck, Stethoscope, Watch } from 'lucide-react'
import { toast } from 'sonner'

type AuthorizedPatient = {
  consent_id: string
  patient_id: string
  care_link_id?: string | null
  patient_name?: string | null
  patient_email?: string | null
  allowed_categories?: string[]
  authorized_at?: string
  expires_at?: string | null
}

export default function DadosDispositivosPage() {
  const router = useRouter()
  const { user, session, professional, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [patients, setPatients] = useState<AuthorizedPatient[]>([])
  const [emailSearch, setEmailSearch] = useState('')
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && session?.access_token) loadPatients()
  }, [user, session?.access_token])

  async function apiGet(path: string) {
    const response = await fetch(path, {
      headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error || 'Erro ao consultar dados autorizados.')
    return payload
  }

  async function loadPatients() {
    setLoading(true)
    try {
      const payload = await apiGet('/api/health-devices/professional-summary')
      setPatients(payload.patients || [])
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível carregar pacientes autorizados.')
    } finally {
      setLoading(false)
    }
  }

  async function loadSummary(params: { patientId?: string; careLinkId?: string; patientEmail?: string }) {
    setLoadingSummary(true)
    setSummary(null)

    try {
      const query = new URLSearchParams()
      if (params.patientId) query.set('patient_id', params.patientId)
      if (params.careLinkId) query.set('care_link_id', params.careLinkId)
      if (params.patientEmail) query.set('patient_email', params.patientEmail)
      query.set('reason', 'care_context_dashboard')

      const payload = await apiGet(`/api/health-devices/professional-summary?${query.toString()}`)
      setSummary(payload)
    } catch (error: any) {
      toast.error(error?.message || 'Paciente sem autorização ativa para dados de dispositivos.')
    } finally {
      setLoadingSummary(false)
    }
  }

  async function searchByEmail() {
    const value = emailSearch.trim()
    if (!value) return toast.error('Informe o e-mail do paciente.')
    await loadSummary({ patientEmail: value })
  }

  const selectedPatientName = summary?.patient?.name || 'Paciente HealthWallet'
  const latest = summary?.latest || null
  const window30 = summary?.window_30d || {}
  const medscore = summary?.medscore || null
  const attention = useMemo(() => latest?.score_factors?.attention || [], [latest])
  const factors = useMemo(() => latest?.score_factors?.factors || [], [latest])

  if (authLoading || !professional || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-900 text-white p-6 md:p-10 overflow-hidden relative">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-white/80 mb-4">
            <Watch className="w-4 h-4" /> HealthWallet Device Data Hub
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Dados autorizados de dispositivos</h1>
          <p className="text-white/75 mt-4 text-lg">
            Veja sono, passos, batimentos, pressão, peso, SpO2 e contexto de MedScore somente quando o paciente autorizar o compartilhamento.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-blue-900 flex gap-3">
        <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p className="text-sm">
          Dados de smartwatches, pulseiras e dispositivos pessoais são complementares. Eles ajudam no contexto longitudinal, mas não substituem avaliação, exame físico, diagnóstico ou conduta profissional.
        </p>
      </section>

      <section className="grid lg:grid-cols-[0.85fr_1.15fr] gap-6">
        <aside className="space-y-6">
          <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-emerald-700" /> Buscar paciente autorizado
            </h2>
            <div className="flex gap-2">
              <input
                value={emailSearch}
                onChange={(event) => setEmailSearch(event.target.value)}
                placeholder="email@paciente.com"
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-emerald-500"
              />
              <button onClick={searchByEmail} className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">
                Buscar
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">A busca só retorna dados quando existir vínculo e consentimento ativo.</p>
          </section>

          <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-emerald-700" /> Pacientes com consentimento
              </h2>
              <button onClick={loadPatients} className="text-sm text-emerald-700 font-semibold flex items-center gap-1">
                <RefreshCw className="w-4 h-4" /> Atualizar
              </button>
            </div>

            <div className="space-y-3">
              {patients.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">
                  Nenhum paciente autorizou dados de dispositivos ainda.
                </div>
              )}

              {patients.map((patient) => (
                <button
                  type="button"
                  key={patient.consent_id}
                  onClick={() => loadSummary({ patientId: patient.patient_id, careLinkId: patient.care_link_id || undefined })}
                  className="w-full text-left rounded-2xl border border-gray-100 p-4 hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors"
                >
                  <p className="font-bold text-gray-900">{patient.patient_name || 'Paciente HealthWallet'}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-1"><Mail className="w-3 h-3" /> {patient.patient_email || 'E-mail não informado'}</p>
                  <p className="text-xs text-gray-400 mt-2">Autorizado em {formatDate(patient.authorized_at)}</p>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="space-y-6">
          {loadingSummary && (
            <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          )}

          {!loadingSummary && !summary && (
            <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-10 text-center">
              <Watch className="w-12 h-12 mx-auto text-emerald-700 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Selecione um paciente</h2>
              <p className="text-gray-500 mt-2">O resumo autorizado aparecerá aqui para apoiar o atendimento e o acompanhamento.</p>
            </div>
          )}

          {!loadingSummary && summary && (
            <>
              <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm text-emerald-700 font-semibold">Resumo autorizado</p>
                    <h2 className="text-3xl font-bold text-gray-900">{selectedPatientName}</h2>
                    <p className="text-gray-500 mt-1">{summary.patient?.email || 'E-mail não informado'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950 text-white px-5 py-4 text-center">
                    <p className="text-xs text-white/60">Score device</p>
                    <p className="text-3xl font-bold">{window30.avg_device_context_score || latest?.device_context_score || '—'}</p>
                  </div>
                </div>
              </section>

              <section className="grid md:grid-cols-4 gap-4">
                <Metric icon={Activity} label="Passos médios 30d" value={formatNumber(window30.avg_steps)} />
                <Metric icon={Moon} label="Sono médio 30d" value={formatSleep(window30.avg_sleep_minutes)} />
                <Metric icon={HeartPulse} label="FC repouso" value={window30.avg_resting_heart_rate ? `${window30.avg_resting_heart_rate} bpm` : '—'} />
                <Metric icon={Watch} label="Dias com dados" value={String(window30.days || 0)} />
              </section>

              <section className="grid lg:grid-cols-2 gap-6">
                <Card title="Última sincronização">
                  {latest ? (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <Info label="Data" value={formatDate(latest.summary_date)} />
                      <Info label="Fontes" value={(latest.sources || []).join(', ') || '—'} />
                      <Info label="SpO2" value={latest.spo2_avg ? `${latest.spo2_avg}%` : '—'} />
                      <Info label="Pressão" value={latest.systolic_bp && latest.diastolic_bp ? `${latest.systolic_bp}/${latest.diastolic_bp}` : '—'} />
                      <Info label="Peso" value={latest.weight_kg ? `${latest.weight_kg} kg` : '—'} />
                      <Info label="Confiança" value={latest.device_confidence ? `${latest.device_confidence}%` : '—'} />
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Paciente autorizou, mas ainda não há resumo de dispositivo sincronizado.</p>
                  )}
                </Card>

                <Card title="MedScore contextual">
                  {medscore ? (
                    <div className="space-y-3">
                      <div className="flex items-end gap-3">
                        <p className="text-5xl font-bold text-emerald-700">{medscore.score}</p>
                        <div className="pb-1">
                          <p className="font-semibold text-gray-900">{medscore.status || 'Sem status'}</p>
                          <p className="text-xs text-gray-500">Versão: {medscore.score_version || 'medscore'}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">O score do paciente já pode receber ajuste de contexto pelos dados de dispositivos quando eles existem e estão atualizados.</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Sem MedScore calculado ainda para este paciente.</p>
                  )}
                </Card>
              </section>

              <section className="grid lg:grid-cols-2 gap-6">
                <Card title="Fatores positivos">
                  <List items={factors} empty="Nenhum fator positivo de dispositivo registrado ainda." />
                </Card>
                <Card title="Pontos para atenção">
                  <List items={attention} empty="Nenhum ponto de atenção principal registrado." warning />
                </Card>
              </section>

              <section className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 flex gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p>{summary.disclaimer}</p>
              </section>
            </>
          )}
        </section>
      </section>
    </main>
  )
}

function Metric({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
      <Icon className="w-5 h-5 text-emerald-700 mb-3" />
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value || '—'}</p>
    </div>
  )
}

function Card({ title, children }: any) {
  return <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5"><h3 className="font-bold text-gray-900 mb-4">{title}</h3>{children}</section>
}

function Info({ label, value }: any) {
  return <div className="rounded-2xl bg-gray-50 p-3"><p className="text-xs text-gray-500">{label}</p><p className="font-semibold text-gray-900 mt-1 break-words">{value || '—'}</p></div>
}

function List({ items, empty, warning = false }: { items: string[]; empty: string; warning?: boolean }) {
  if (!items?.length) return <p className="text-sm text-gray-500">{empty}</p>
  return <div className="space-y-2">{items.map((item, index) => <p key={index} className={`text-sm ${warning ? 'text-amber-800' : 'text-emerald-800'}`}>• {item}</p>)}</div>
}

function formatNumber(value?: number | null) {
  return value ? value.toLocaleString('pt-BR') : '—'
}

function formatSleep(minutes?: number | null) {
  if (!minutes) return '—'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h${String(mins).padStart(2, '0')}`
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value.includes('T') ? value : `${value}T12:00:00`).toLocaleDateString('pt-BR')
}
