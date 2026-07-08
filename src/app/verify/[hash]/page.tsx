'use client'

import { use, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BadgeCheck,
  CalendarDays,
  FileText,
  Fingerprint,
  Globe,
  Hash,
  Loader2,
  ShieldCheck,
  User,
} from 'lucide-react'

type PageProps = {
  params: Promise<{ hash: string }>
}

export default function VerifySignaturePage({ params }: PageProps) {
  const { hash } = use(params)
  const [loading, setLoading] = useState(true)
  const [signature, setSignature] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [hash])

  async function load() {
    setLoading(true)

    const { data, error } = await supabase
      .from('signatures')
      .select('*')
      .or(`document_hash.eq.${hash},verification_slug.eq.${hash}`)
      .eq('status', 'valid')
      .maybeSingle()

    if (error || !data) {
      setError('Assinatura não encontrada ou inválida.')
      setLoading(false)
      return
    }

    setSignature(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-3xl border p-8 text-center shadow-sm">
          <ShieldCheck className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Validação indisponível</h1>
          <p className="text-gray-600 mt-2">{error}</p>
        </div>
      </main>
    )
  }

  const snapshot = signature.document_snapshot || {}
  const audit = signature.audit_trail || {}

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-5">
        <header className="bg-white rounded-3xl border p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <BadgeCheck className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm text-emerald-700 font-semibold">Validação pública MyDataMed</p>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">Documento assinado eletronicamente</h1>
              <p className="text-gray-600 mt-2">
                Esta página confirma a existência da assinatura eletrônica, o hash do documento e a trilha de auditoria registrada.
              </p>
            </div>
          </div>
        </header>

        <section className="grid md:grid-cols-3 gap-3">
          <InfoCard icon={ShieldCheck} label="Status" value="Válida" />
          <InfoCard icon={CalendarDays} label="Assinado em" value={formatDateTime(signature.signed_at)} />
          <InfoCard icon={User} label="Assinante" value={signature.signer_name || 'Assinante registrado'} />
        </section>

        <section className="bg-white rounded-3xl border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-gray-700">
            <FileText className="w-5 h-5" />
            <span className="font-semibold">Documento</span>
          </div>

          <div className="rounded-2xl bg-gray-50 border p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Tipo: {translateDocumentType(snapshot.document_type)}</p>
            <h2 className="font-bold text-gray-900 mb-3">{snapshot.title || 'Documento profissional'}</h2>
            <p className="whitespace-pre-line text-gray-700 leading-relaxed">{snapshot.body || 'Conteúdo preservado no hash/auditoria.'}</p>
          </div>
        </section>

        <section className="bg-white rounded-3xl border p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-gray-700">
            <Hash className="w-5 h-5" />
            <span className="font-semibold">Hash e trilha de auditoria</span>
          </div>

          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
            <p className="text-sm font-semibold text-emerald-900">SHA-256</p>
            <p className="break-all text-sm text-emerald-800 mt-1">{signature.document_hash}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <AuditLine icon={Fingerprint} label="CPF registrado" value={`***.***.***-${String(signature.signer_cpf || '').slice(-2) || '**'}`} />
            <AuditLine icon={Globe} label="IP registrado" value={signature.ip_address || audit.ip_address || 'Registrado'} />
            <AuditLine icon={Globe} label="Navegador" value={shorten(signature.user_agent || audit.user_agent || 'Registrado')} />
            <AuditLine icon={CalendarDays} label="Data/hora" value={formatDateTime(signature.signed_at)} />
          </div>

          <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-900">
            <strong>Aviso:</strong> Esta validação confirma a assinatura eletrônica própria e a trilha de auditoria registrada no MyDataMed. Para prescrições medicamentosas ou documentos regulados, a validade externa depende da habilitação profissional e do tipo de assinatura/validação exigido pela legislação aplicável.
          </div>
        </section>
      </div>
    </main>
  )
}

function InfoCard({ icon: Icon, label, value }: any) {
  return (
    <div className="bg-white rounded-2xl border p-4 shadow-sm">
      <Icon className="w-5 h-5 text-emerald-600 mb-2" />
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  )
}

function AuditLine({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-2xl border bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-gray-600 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="font-semibold text-gray-900 break-all">{value}</p>
    </div>
  )
}

function formatDateTime(value: string) {
  if (!value) return 'Data registrada'
  return new Date(value).toLocaleString('pt-BR')
}

function shorten(value: string) {
  if (!value) return 'Registrado'
  return value.length > 90 ? `${value.slice(0, 90)}...` : value
}

function translateDocumentType(type: string) {
  const map: Record<string, string> = {
    orientation: 'Orientação',
    prescription: 'Receita / prescrição',
    exam_request: 'Pedido de exame',
    report: 'Relatório',
    referral: 'Encaminhamento',
    certificate: 'Atestado / certificado',
    declaration: 'Declaração',
    care_plan: 'Plano de cuidado',
    other: 'Outro',
  }
  return map[type] || type || 'Documento'
}
