'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle,
  Copy,
  FileText,
  Loader2,
  PenLine,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  User,
} from 'lucide-react'

const DOCUMENT_TYPES = [
  { value: 'orientation', label: 'Orientação / plano de cuidado' },
  { value: 'report', label: 'Relatório profissional' },
  { value: 'declaration', label: 'Declaração' },
  { value: 'care_plan', label: 'Plano de cuidado' },
  { value: 'exam_request', label: 'Pedido de exame quando aplicável' },
  { value: 'prescription', label: 'Receita / prescrição quando aplicável' },
  { value: 'other', label: 'Outro documento' },
]

export default function AssinaturasPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [documents, setDocuments] = useState<any[]>([])
  const [generatedLink, setGeneratedLink] = useState('')
  const [form, setForm] = useState({
    patient_id: '',
    patient_name: '',
    patient_email: '',
    appointment_id: '',
    document_type: 'orientation',
    title: 'Orientações pós-consulta',
    body: '',
    expires_days: '7',
  })

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && professional) loadDocuments()
  }, [user, professional])

  const canPrescribe = Boolean((professional as any)?.can_prescribe)
  const selectedType = useMemo(() => DOCUMENT_TYPES.find((item) => item.value === form.document_type), [form.document_type])

  async function loadDocuments() {
    if (!user) return

    const { data } = await supabase
      .from('professional_clinical_documents')
      .select('*')
      .eq('professional_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    setDocuments(data || [])
  }

  async function createSignatureRequest() {
    if (!user || !professional) return

    if (!form.patient_id || !form.title || !form.body) {
      toast.error('Informe paciente, título e conteúdo do documento')
      return
    }

    if (form.document_type === 'prescription' && !canPrescribe) {
      toast.error('Este profissional ainda não está habilitado no sistema para emitir prescrição/receita.')
      return
    }

    setLoading(true)
    setGeneratedLink('')

    const documentPayload = {
      appointment_id: form.appointment_id || null,
      professional_user_id: user.id,
      professional_id: professional.id,
      patient_id: form.patient_id,
      document_type: form.document_type,
      title: form.title,
      body: form.body,
      status: 'pending_signature',
      requires_prescription_permission: form.document_type === 'prescription' || form.document_type === 'exam_request',
      signature_provider: 'mydatamed_simple',
      signature_level: 'simple_audit_trail',
      metadata: {
        patient_name: form.patient_name || null,
        patient_email: form.patient_email || null,
        professional_name: professional.full_name,
        professional_type: professional.professional_type,
        professional_register: professional.professional_register,
        register_state: professional.register_state,
      },
    }

    const { data: document, error: documentError } = await supabase
      .from('professional_clinical_documents')
      .insert(documentPayload)
      .select('*')
      .single()

    if (documentError || !document) {
      toast.error(documentError?.message || 'Erro ao criar documento')
      setLoading(false)
      return
    }

    const expiresAt = new Date(Date.now() + Number(form.expires_days || 7) * 24 * 60 * 60 * 1000).toISOString()

    const { data: tokenData, error: tokenError } = await supabase
      .from('sign_tokens')
      .insert({
        document_id: document.id,
        appointment_id: form.appointment_id || null,
        professional_user_id: user.id,
        professional_id: professional.id,
        patient_id: form.patient_id,
        patient_name: form.patient_name || null,
        patient_email: form.patient_email || null,
        signer_role: 'patient',
        status: 'pending',
        expires_at: expiresAt,
        metadata: {
          document_type: form.document_type,
          document_title: form.title,
          generated_from: 'assinaturas_page',
        },
      })
      .select('*')
      .single()

    if (tokenError || !tokenData) {
      toast.error(tokenError?.message || 'Documento criado, mas erro ao gerar link de assinatura')
      setLoading(false)
      return
    }

    const link = `${window.location.origin}/sign/${tokenData.token}`
    setGeneratedLink(link)

    await supabase
      .from('professional_clinical_documents')
      .update({ simple_signature_token_id: tokenData.id })
      .eq('id', document.id)

    toast.success('Link de assinatura criado')
    await loadDocuments()
    setLoading(false)
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Copiado')
    } catch {
      toast.error('Não consegui copiar automaticamente')
    }
  }

  if (authLoading || !professional) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
            <PenLine className="w-8 h-8" />
          </div>
          <div>
            <p className="text-white/75 text-sm font-medium">Produção ON</p>
            <h1 className="text-2xl md:text-3xl font-bold">Assinatura própria MyDataMed</h1>
            <p className="text-white/80 mt-2 max-w-3xl">
              Gere documentos profissionais com token, aceite por CPF, IP, user agent, timestamp, hash SHA-256 e link público de validação.
            </p>
          </div>
        </div>
      </header>

      <section className="grid md:grid-cols-3 gap-3">
        <InfoCard icon={FileText} title="Documentos" text="Orientações, planos, relatórios, declarações e documentos profissionais." />
        <InfoCard icon={QrCode} title="QR / Validação" text="Cada assinatura gera hash e link público /verify/[hash]." />
        <InfoCard icon={ShieldCheck} title="Auditoria" text="CPF, IP, navegador, data/hora, token e snapshot do documento." />
      </section>

      <section className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-900 flex gap-3">
        <ShieldAlert className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <p>
          <strong>Regra de segurança:</strong> esta assinatura própria é ideal para consentimentos, orientações, relatórios, planos e documentos profissionais. Para receitas medicamentosas ou documentos regulados, a validade externa pode exigir habilitação específica, certificado/assinatura qualificada ou validação externa.
        </p>
      </section>

      <div className="grid lg:grid-cols-[1fr_0.85fr] gap-6">
        <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Novo documento para assinatura</h2>

          <div className="grid md:grid-cols-3 gap-3">
            <Input label="Patient ID" value={form.patient_id} onChange={(value: string) => setForm({ ...form, patient_id: value })} placeholder="UUID do paciente" />
            <Input label="Nome do paciente" value={form.patient_name} onChange={(value: string) => setForm({ ...form, patient_name: value })} />
            <Input label="E-mail do paciente" value={form.patient_email} onChange={(value: string) => setForm({ ...form, patient_email: value })} />
          </div>

          <Input label="Appointment ID opcional" value={form.appointment_id} onChange={(value: string) => setForm({ ...form, appointment_id: value })} placeholder="UUID da teleconsulta, se houver" />

          <div className="grid md:grid-cols-[1fr_120px] gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Tipo de documento</label>
              <select
                value={form.document_type}
                onChange={(event) => setForm({ ...form, document_type: event.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              {form.document_type === 'prescription' && !canPrescribe && (
                <p className="text-xs text-red-600 mt-1">Prescrição bloqueada: habilite can_prescribe no cadastro profissional.</p>
              )}
            </div>

            <Input label="Expira em dias" value={form.expires_days} onChange={(value: string) => setForm({ ...form, expires_days: value })} />
          </div>

          <Input label="Título" value={form.title} onChange={(value: string) => setForm({ ...form, title: value })} />

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Conteúdo</label>
            <textarea
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 min-h-[180px] outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Digite as orientações, plano, relatório ou documento profissional..."
            />
          </div>

          <button
            onClick={createSignatureRequest}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BadgeCheck className="w-5 h-5" />}
            Gerar link de assinatura
          </button>
        </section>

        <aside className="space-y-4">
          <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-3">Profissional</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>Nome:</strong> {professional.full_name}</p>
              <p><strong>Tipo:</strong> {professional.professional_type || 'Profissional de saúde'}</p>
              <p><strong>Registro:</strong> {professional.professional_register || '-'} / {professional.register_state || '-'}</p>
              <p><strong>Pode prescrever:</strong> {canPrescribe ? 'Sim' : 'Não / pendente'}</p>
            </div>
          </section>

          {generatedLink && (
            <section className="bg-emerald-50 rounded-3xl border border-emerald-200 p-6 shadow-sm">
              <h2 className="font-bold text-emerald-900 mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Link gerado
              </h2>
              <p className="text-sm text-emerald-800 mb-3">Envie este link ao paciente/assinante.</p>
              <div className="rounded-xl bg-white border p-3 text-sm break-all text-emerald-900">{generatedLink}</div>
              <button onClick={() => copy(generatedLink)} className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2 font-semibold">
                <Copy className="w-4 h-4" />
                Copiar link
              </button>
            </section>
          )}

          <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-3">Últimos documentos</h2>
            {documents.length > 0 ? (
              <div className="space-y-2">
                {documents.slice(0, 8).map((doc) => (
                  <div key={doc.id} className="rounded-xl border bg-gray-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 truncate">{doc.title || selectedType?.label}</p>
                      <span className="text-xs rounded-full bg-white border px-2 py-0.5 text-gray-600">{doc.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{new Date(doc.created_at).toLocaleDateString('pt-BR')}</p>
                    {doc.verification_url && (
                      <button onClick={() => copy(doc.verification_url)} className="text-xs text-emerald-700 mt-2 inline-flex items-center gap-1">
                        <Copy className="w-3 h-3" /> Copiar validação
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Nenhum documento ainda.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}

function InfoCard({ icon: Icon, title, text }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-500 mt-1">{text}</p>
      </div>
    </div>
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
