'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  BadgeCheck,
  CheckCircle,
  Copy,
  FileText,
  Loader2,
  PenLine,
  QrCode,
  ShieldAlert,
  ShieldCheck,
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
  const [generatedValidation, setGeneratedValidation] = useState('')
  const [patientAckLink, setPatientAckLink] = useState('')
  const [form, setForm] = useState({
    patient_id: '',
    patient_name: '',
    patient_email: '',
    appointment_id: '',
    document_type: 'orientation',
    title: 'Orientações pós-consulta',
    body: '',
    professional_cpf: '',
  })

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && professional) {
      setForm((current) => ({ ...current, professional_cpf: professional.cpf || '' }))
      loadDocuments()
    }
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

  function onlyDigits(value: string) {
    return String(value || '').replace(/\D/g, '')
  }

  function formatCpf(value: string) {
    const digits = onlyDigits(value).slice(0, 11)
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  async function createProfessionalSignedDocument() {
    if (!user || !professional) return

    if (!form.patient_id || !form.title || !form.body) {
      toast.error('Informe paciente, título e conteúdo do documento')
      return
    }

    const professionalCpf = onlyDigits(form.professional_cpf || professional.cpf || '')
    if (professionalCpf.length < 11) {
      toast.error('Informe o CPF do profissional para registrar a assinatura')
      return
    }

    if (form.document_type === 'prescription' && !canPrescribe) {
      toast.error('Prescrição bloqueada: habilite can_prescribe no cadastro profissional.')
      return
    }

    setLoading(true)
    setGeneratedValidation('')
    setPatientAckLink('')

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
      signature_level: 'professional_simple_audit_trail',
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

    const { data: tokenData, error: tokenError } = await supabase
      .from('sign_tokens')
      .insert({
        document_id: document.id,
        appointment_id: form.appointment_id || null,
        professional_user_id: user.id,
        professional_id: professional.id,
        patient_id: form.patient_id,
        patient_name: professional.full_name,
        patient_email: user.email,
        signer_role: 'professional',
        status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          document_type: form.document_type,
          document_title: form.title,
          generated_from: 'assinaturas_professional_signature',
          patient_name: form.patient_name || null,
          patient_email: form.patient_email || null,
        },
      })
      .select('*')
      .single()

    if (tokenError || !tokenData) {
      toast.error(tokenError?.message || 'Documento criado, mas erro ao preparar assinatura')
      setLoading(false)
      return
    }

    const response = await fetch('/api/signatures/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenData.token,
        signer_name: professional.full_name,
        signer_email: user.email,
        signer_cpf: professionalCpf,
        accepted_terms: true,
      }),
    })

    const payload = await response.json()

    if (!response.ok) {
      toast.error(payload.error || 'Documento criado, mas erro ao assinar')
      setLoading(false)
      return
    }

    await supabase
      .from('professional_clinical_documents')
      .update({
        verification_url: payload.verification_url,
        qr_payload: payload.verification_url,
        document_hash: payload.document_hash,
        sent_to_patient_at: new Date().toISOString(),
      })
      .eq('id', document.id)

    setGeneratedValidation(payload.verification_url)
    toast.success('Documento assinado pelo profissional')
    await loadDocuments()
    setLoading(false)
  }

  async function createPatientAcknowledgementLink(doc: any) {
    if (!user || !professional) return

    const { data: tokenData, error } = await supabase
      .from('sign_tokens')
      .insert({
        document_id: doc.id,
        appointment_id: doc.appointment_id || null,
        professional_user_id: user.id,
        professional_id: professional.id,
        patient_id: doc.patient_id,
        patient_name: doc.metadata?.patient_name || null,
        patient_email: doc.metadata?.patient_email || null,
        signer_role: 'patient',
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          generated_from: 'patient_acknowledgement_after_professional_signature',
          document_title: doc.title,
          document_type: doc.document_type,
        },
      })
      .select('*')
      .single()

    if (error || !tokenData) {
      toast.error(error?.message || 'Erro ao gerar aceite do paciente')
      return
    }

    const link = `${window.location.origin}/sign/${tokenData.token}`
    setPatientAckLink(link)
    toast.success('Link de ciência/aceite do paciente gerado')
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
            <h1 className="text-2xl md:text-3xl font-bold">Assinatura profissional MyDataMed</h1>
            <p className="text-white/80 mt-2 max-w-3xl">
              O profissional assina o documento. O paciente recebe e pode conferir a validade. Aceite do paciente é opcional, apenas para ciência/consentimento.
            </p>
          </div>
        </div>
      </header>

      <section className="grid md:grid-cols-3 gap-3">
        <InfoCard icon={FileText} title="Emissão profissional" text="Orientações, planos, relatórios, declarações e documentos profissionais assinados pelo emissor." />
        <InfoCard icon={QrCode} title="QR / validação" text="Cada assinatura gera hash e link público /verify/[hash]." />
        <InfoCard icon={ShieldCheck} title="Auditoria" text="CPF do profissional, IP, navegador, data/hora, token e snapshot do documento." />
      </section>

      <section className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-900 flex gap-3">
        <ShieldAlert className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <p>
          <strong>Regra correta:</strong> documentos profissionais são assinados pelo profissional. O paciente só assina quando for termo de aceite, ciência, autorização ou consentimento. Para receitas medicamentosas ou documentos regulados, a validade externa pode exigir habilitação específica, certificado/assinatura qualificada ou validação externa.
        </p>
      </section>

      <div className="grid lg:grid-cols-[1fr_0.85fr] gap-6">
        <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Novo documento profissional</h2>

          <div className="grid md:grid-cols-3 gap-3">
            <Input label="Patient ID" value={form.patient_id} onChange={(value: string) => setForm({ ...form, patient_id: value })} placeholder="UUID do paciente" />
            <Input label="Nome do paciente" value={form.patient_name} onChange={(value: string) => setForm({ ...form, patient_name: value })} />
            <Input label="E-mail do paciente" value={form.patient_email} onChange={(value: string) => setForm({ ...form, patient_email: value })} />
          </div>

          <Input label="Appointment ID opcional" value={form.appointment_id} onChange={(value: string) => setForm({ ...form, appointment_id: value })} placeholder="UUID da teleconsulta, se houver" />

          <div className="grid md:grid-cols-[1fr_180px] gap-3">
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

            <Input label="CPF do profissional" value={form.professional_cpf} onChange={(value: string) => setForm({ ...form, professional_cpf: formatCpf(value) })} placeholder="000.000.000-00" />
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
            onClick={createProfessionalSignedDocument}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BadgeCheck className="w-5 h-5" />}
            Assinar como profissional e enviar ao paciente
          </button>
        </section>

        <aside className="space-y-4">
          <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-3">Profissional emissor</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>Nome:</strong> {professional.full_name}</p>
              <p><strong>Tipo:</strong> {professional.professional_type || 'Profissional de saúde'}</p>
              <p><strong>Registro:</strong> {professional.professional_register || '-'} / {professional.register_state || '-'}</p>
              <p><strong>Pode prescrever:</strong> {canPrescribe ? 'Sim' : 'Não / pendente'}</p>
            </div>
          </section>

          {generatedValidation && (
            <section className="bg-emerald-50 rounded-3xl border border-emerald-200 p-6 shadow-sm">
              <h2 className="font-bold text-emerald-900 mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Documento assinado
              </h2>
              <p className="text-sm text-emerald-800 mb-3">Este é o link público de validação do documento.</p>
              <div className="rounded-xl bg-white border p-3 text-sm break-all text-emerald-900">{generatedValidation}</div>
              <button onClick={() => copy(generatedValidation)} className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2 font-semibold">
                <Copy className="w-4 h-4" />
                Copiar validação
              </button>
            </section>
          )}

          {patientAckLink && (
            <section className="bg-blue-50 rounded-3xl border border-blue-200 p-6 shadow-sm">
              <h2 className="font-bold text-blue-900 mb-2">Aceite/ciência do paciente</h2>
              <p className="text-sm text-blue-800 mb-3">Use apenas quando quiser registrar ciência, consentimento ou autorização do paciente.</p>
              <div className="rounded-xl bg-white border p-3 text-sm break-all text-blue-900">{patientAckLink}</div>
              <button onClick={() => copy(patientAckLink)} className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold">
                <Copy className="w-4 h-4" />
                Copiar aceite
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
                    <div className="flex flex-wrap gap-3 mt-2">
                      {doc.verification_url && (
                        <button onClick={() => copy(doc.verification_url)} className="text-xs text-emerald-700 inline-flex items-center gap-1">
                          <Copy className="w-3 h-3" /> Copiar validação
                        </button>
                      )}
                      {doc.status === 'signed' && (
                        <button onClick={() => createPatientAcknowledgementLink(doc)} className="text-xs text-blue-700 inline-flex items-center gap-1">
                          <Copy className="w-3 h-3" /> Gerar aceite opcional
                        </button>
                      )}
                    </div>
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
