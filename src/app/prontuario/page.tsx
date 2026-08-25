'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowRight, FileText, Loader2, Lock, Search, ShieldCheck, Stethoscope, UserRound } from 'lucide-react'

const statusMeta: Record<string, any> = {
  draft: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-700' },
  reviewed: { label: 'Revisado', cls: 'bg-blue-100 text-blue-700' },
  signed: { label: 'Assinado', cls: 'bg-emerald-100 text-emerald-700' },
  locked: { label: 'Travado', cls: 'bg-gray-900 text-white' },
  amended: { label: 'Retificado', cls: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
}

export default function ProntuarioPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [visits, setVisits] = useState<any[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && professional) loadVisits()
  }, [user, professional])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return visits
    return visits.filter((visit) => [visit.patient_name, visit.patient_email, visit.patient_phone, visit.reason, visit.specialty].filter(Boolean).join(' ').toLowerCase().includes(term))
  }, [visits, search])

  async function loadVisits() {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('clinical_visits')
      .select('*')
      .eq('professional_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(120)
    if (error) toast.error('Rode SQL_COPILOTO_ATENDIMENTO_V1.sql e SQL_MYDATAMED_PRONTUARIO_PATCH.sql para ativar o prontuário.')
    setVisits(data || [])
    setLoading(false)
  }

  async function signAndLock(visit: any) {
    if (!confirm('Assinar e travar este prontuário? Depois disso, alterações devem ser feitas por retificação.')) return
    const { error } = await supabase.rpc('sign_and_lock_clinical_visit', { p_visit_id: visit.id })
    if (error) toast.error(error.message || 'Erro ao assinar prontuário')
    else { toast.success('Prontuário assinado e travado'); loadVisits() }
  }

  if (authLoading || !professional || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <section className="rounded-[2rem] bg-slate-950 text-white p-6 md:p-9 grid lg:grid-cols-[1fr_0.7fr] gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5"><FileText className="w-4 h-4" /> Prontuário eletrônico</div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">Histórico clínico, notas, SOAP, anexos e assinatura.</h1>
          <p className="text-white/70 mt-4 text-lg max-w-3xl">A Consulta Assistida cria o registro. O Prontuário organiza histórico por paciente, revisão, assinatura/travamento e rastreabilidade.</p>
        </div>
        <div className="rounded-3xl bg-white text-gray-900 p-5">
          <p className="text-sm text-gray-500">Registros encontrados</p>
          <h2 className="text-4xl font-bold">{visits.length}</h2>
          <p className="text-sm text-gray-600 mt-2">IA como apoio. O profissional revisa, valida, assina e assume responsabilidade.</p>
        </div>
      </section>

      <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-5">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por paciente, motivo, telefone..." className="w-full rounded-2xl border border-gray-200 pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20" />
          </div>
          <Link href="/consulta-assistida" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white px-4 py-3 font-semibold">Novo atendimento <ArrowRight className="w-4 h-4" /></Link>
        </div>

        {filtered.length ? (
          <div className="space-y-3">
            {filtered.map((visit) => {
              const recordStatus = visit.record_status || (visit.signed_by_doctor ? 'signed' : 'draft')
              const meta = statusMeta[recordStatus] || statusMeta.draft
              return (
                <div key={visit.id} className="rounded-3xl border bg-gray-50 p-5 grid lg:grid-cols-[1fr_0.42fr] gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
                      {visit.record_locked && <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-slate-900 text-white"><Lock className="w-3 h-3" /> Bloqueado</span>}
                      {visit.specialty && <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700"><Stethoscope className="w-3 h-3" /> {visit.specialty}</span>}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><UserRound className="w-5 h-5 text-emerald-700" /> {visit.patient_name || 'Paciente sem nome'}</h2>
                    <p className="text-sm text-gray-600 mt-1">{visit.reason || 'Sem motivo informado'}</p>
                    <p className="text-xs text-gray-500 mt-2">Criado em {formatDate(visit.created_at)}</p>
                    {(visit.final_note || visit.summary_text || visit.record_summary) && <p className="text-sm text-gray-700 mt-3 line-clamp-2">{visit.record_summary || visit.final_note || visit.summary_text}</p>}
                  </div>
                  <div className="flex flex-wrap lg:flex-col gap-2 lg:items-stretch">
                    <Link href={`/prontuario/${visit.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 font-semibold">Abrir <ArrowRight className="w-4 h-4" /></Link>
                    {!visit.record_locked && <button onClick={() => signAndLock(visit)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 text-white px-4 py-3 font-semibold"><ShieldCheck className="w-4 h-4" /> Assinar/travar</button>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed p-10 text-center text-gray-500">Nenhum prontuário encontrado ainda.</div>
        )}
      </section>
    </main>
  )
}

function formatDate(value: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR')
}
