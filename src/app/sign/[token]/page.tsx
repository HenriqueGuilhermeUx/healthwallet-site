'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  BadgeCheck,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Lock,
  PenLine,
  ShieldCheck,
  User,
} from 'lucide-react'

type PageProps = {
  params: Promise<{ token: string }>
}

export default function SignDocumentPage({ params }: PageProps) {
  const { token } = use(params)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [signToken, setSignToken] = useState<any>(null)
  const [document, setDocument] = useState<any>(null)
  const [cpf, setCpf] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [token])

  async function load() {
    setLoading(true)
    setError('')

    const now = new Date().toISOString()
    const { data: tokenData, error: tokenError } = await supabase
      .from('sign_tokens')
      .select('*')
      .eq('token', token)
      .in('status', ['pending', 'viewed'])
      .gt('expires_at', now)
      .maybeSingle()

    if (tokenError || !tokenData) {
      setError('Link inválido, expirado ou já assinado.')
      setLoading(false)
      return
    }

    setSignToken(tokenData)
    setName(tokenData.patient_name || '')
    setEmail(tokenData.patient_email || '')

    await supabase
      .from('sign_tokens')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('id', tokenData.id)

    const { data: docData, error: docError } = await supabase
      .from('professional_clinical_documents')
      .select('*')
      .eq('id', tokenData.document_id)
      .maybeSingle()

    if (docError || !docData) {
      setError('Documento não encontrado.')
      setLoading(false)
      return
    }

    setDocument(docData)
    setLoading(false)
  }

  function onlyDigits(value: string) {
    return value.replace(/\D/g, '')
  }

  function formatCpf(value: string) {
    const digits = onlyDigits(value).slice(0, 11)
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  async function sign() {
    setSigning(true)
    setError('')

    const response = await fetch('/api/signatures/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        signer_name: name,
        signer_email: email,
        signer_cpf: onlyDigits(cpf),
        accepted_terms: accepted,
      }),
    })

    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Erro ao assinar documento.')
      setSigning(false)
      return
    }

    setResult(payload)
    setSigning(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </main>
    )
  }

  if (error && !document) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-3xl border p-8 text-center shadow-sm">
          <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Não foi possível abrir</h1>
          <p className="text-gray-600 mt-2">{error}</p>
        </div>
      </main>
    )
  }

  if (result) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-3xl border p-8 text-center shadow-sm">
          <BadgeCheck className="w-14 h-14 text-emerald-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Documento assinado</h1>
          <p className="text-gray-600 mt-2">
            Sua assinatura foi registrada com trilha de auditoria, hash, IP, data/hora e user agent.
          </p>

          <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-left text-sm">
            <p className="font-semibold text-emerald-900">Hash do documento</p>
            <p className="break-all text-emerald-800 mt-1">{result.document_hash}</p>
          </div>

          <Link
            href={result.verification_url.replace(/^https?:\/\/[^/]+/, '')}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold"
          >
            <ShieldCheck className="w-5 h-5" />
            Ver validação pública
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        <header className="bg-white rounded-3xl border p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <PenLine className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-emerald-700 font-semibold">Assinatura eletrônica MyDataMed</p>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">{document?.title || 'Documento profissional'}</h1>
              <p className="text-gray-600 mt-2">
                Leia o documento abaixo. Para assinar, informe seu CPF e confirme que leu e concorda com o conteúdo.
              </p>
            </div>
          </div>
        </header>

        <section className="bg-white rounded-3xl border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-gray-700">
            <FileText className="w-5 h-5" />
            <span className="font-semibold">Documento</span>
          </div>

          <div className="rounded-2xl bg-gray-50 border p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Tipo: {translateDocumentType(document?.document_type)}</p>
            <h2 className="font-bold text-gray-900 mb-3">{document?.title}</h2>
            <p className="whitespace-pre-line text-gray-700 leading-relaxed">{document?.body}</p>
          </div>

          <div className="mt-4 rounded-2xl bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-900">
            <strong>Aviso:</strong> {document?.legal_notice || 'Documento com assinatura eletrônica própria e trilha de auditoria.'}
          </div>
        </section>

        <section className="bg-white rounded-3xl border p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-gray-700">
            <User className="w-5 h-5" />
            <span className="font-semibold">Dados do assinante</span>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Input label="Nome" value={name} onChange={setName} />
            <Input label="E-mail" value={email} onChange={setEmail} />
          </div>

          <Input label="CPF" value={cpf} onChange={(value: string) => setCpf(formatCpf(value))} placeholder="000.000.000-00" />

          <label className="flex items-start gap-3 rounded-2xl bg-gray-50 border p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-gray-700">
              Eu li o documento acima, confirmo meus dados e concordo em assiná-lo eletronicamente. Estou ciente de que serão registrados data/hora, IP, navegador, CPF informado, hash do documento e trilha de auditoria.
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={sign}
            disabled={signing || !accepted || onlyDigits(cpf).length < 11}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold disabled:opacity-50"
          >
            {signing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Assinar eletronicamente
          </button>
        </section>

        <footer className="text-center text-xs text-gray-500 flex items-center justify-center gap-2">
          <Clock className="w-4 h-4" />
          Link válido até {signToken?.expires_at ? new Date(signToken.expires_at).toLocaleString('pt-BR') : 'a data de expiração'}.
        </footer>
      </div>
    </main>
  )
}

function Input({ label, value, onChange, placeholder = '' }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
      />
    </div>
  )
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
