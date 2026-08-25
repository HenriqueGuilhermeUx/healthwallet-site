'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowLeft, FileText, Loader2, Lock, Printer, ShieldCheck } from 'lucide-react'

export default function ProntuarioDetalhePage() {
  const params = useParams()
  const visitId = String(params?.visitId || '')
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [visit, setVisit] = useState<any>(null)
  const [audit, setAudit] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && professional && visitId) loadRecord()
  }, [user, professional, visitId])

  async function loadRecord() {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('clinical_visits')
      .select('*')
      .eq('id', visitId)
      .eq('professional_user_id', user.id)
      .maybeSingle()
    if (error || !data) toast.error('Prontuário não encontrado')
    setVisit(data || null)

    try {
      const { data: events } = await supabase
        .from('clinical_record_audit_events')
        .select('*')
        .eq('visit_id', visitId)
        .order('created_at', { ascending: false })
      setAudit(events || [])
    } catch {}

    setLoading(false)
  }

  async function signAndLock() {
    if (!visit) return
    if (!confirm('Assinar e travar este prontuário? Depois disso, alterações devem ser feitas por retificação.')) return
    const { error } = await supabase.rpc('sign_and_lock_clinical_visit', { p_visit_id: visit.id })
    if (error) toast.error(error.message || 'Erro ao assinar prontuário')
    else { toast.success('Prontuário assinado e travado'); loadRecord() }
  }

  if (authLoading || !professional || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  if (!visit) {
    return <main className="max-w-4xl mx-auto px-4 py-10"><Link href="/prontuario" className="text-emerald-700 font-semibold">Voltar</Link><p className="mt-5 text-gray-600">Prontuário não encontrado.</p></main>
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <Link href="/prontuario" className="inline-flex items-center gap-2 text-gray-600 font-semibold"><ArrowLeft className="w-4 h-4" /> Voltar ao prontuário</Link>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 font-semibold"><Printer className="w-4 h-4" /> Imprimir/PDF</button>
          {!visit.record_locked && <button onClick={signAndLock} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 text-white px-4 py-3 font-semibold"><ShieldCheck className="w-4 h-4" /> Assinar/travar</button>}
        </div>
      </div>

      <section className="rounded-[2rem] bg-slate-950 text-white p-6 md:p-9">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{visit.record_status || 'draft'}</span>
          {visit.record_locked && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs"><Lock className="w-3 h-3" /> Travado</span>}
        </div>
        <h1 className="text-3xl md:text-5xl font-bold">{visit.patient_name || 'Paciente sem nome'}</h1>
        <p className="text-white/65 mt-3">{visit.reason || 'Sem motivo informado'}</p>
        <p className="text-white/45 text-sm mt-2">Criado em {formatDate(visit.created_at)}</p>
      </section>

      <section className="grid lg:grid-cols-[1fr_0.5fr] gap-6">
        <div className="space-y-6">
          <Card title="Resumo / Nota final">
            <TextBlock text={visit.final_note || visit.record_summary || visit.summary_text || 'Nenhuma nota final registrada ainda.'} />
          </Card>
          <Card title="SOAP">
            <Soap label="Subjetivo" text={visit.soap_subjective} />
            <Soap label="Objetivo" text={visit.soap_objective} />
            <Soap label="Avaliação" text={visit.soap_assessment} />
            <Soap label="Plano" text={visit.soap_plan} />
          </Card>
          {visit.transcript_text && <Card title="Transcrição"><TextBlock text={visit.transcript_text} /></Card>}
        </div>

        <aside className="space-y-6">
          <Card title="Dados do registro">
            <Info label="Especialidade" value={visit.specialty} />
            <Info label="Status" value={visit.status} />
            <Info label="Escopo de dados" value={visit.data_scope} />
            <Info label="Assinado" value={visit.signed_by_doctor ? 'Sim' : 'Não'} />
            <Info label="Assinado em" value={visit.signed_at ? formatDate(visit.signed_at) : '-'} />
          </Card>
          <Card title="Auditoria">
            {audit.length ? audit.map((event) => <div key={event.id} className="border-b last:border-b-0 py-2"><p className="font-semibold text-sm">{event.event_type}</p><p className="text-xs text-gray-500">{formatDate(event.created_at)}</p><p className="text-xs text-gray-600">{event.description}</p></div>) : <p className="text-sm text-gray-500">Sem eventos ainda.</p>}
          </Card>
        </aside>
      </section>
    </main>
  )
}

function Card({ title, children }: any) { return <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5"><h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><FileText className="w-5 h-5 text-emerald-700" /> {title}</h2>{children}</section> }
function TextBlock({ text }: any) { return <p className="text-gray-700 leading-relaxed whitespace-pre-line">{text}</p> }
function Soap({ label, text }: any) { return <div className="mb-4"><p className="font-bold text-gray-900">{label}</p><p className="text-sm text-gray-700 whitespace-pre-line mt-1">{text || '-'}</p></div> }
function Info({ label, value }: any) { return <div className="py-2 border-b last:border-b-0"><p className="text-xs text-gray-500">{label}</p><p className="font-semibold text-gray-900">{value || '-'}</p></div> }
function formatDate(value: string) { return value ? new Date(value).toLocaleString('pt-BR') : '-' }
