'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Loader2, Printer, Receipt, ShieldCheck } from 'lucide-react'

export default function ReciboPage() {
  const params = useParams()
  const router = useRouter()
  const { user, professional, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [entry, setEntry] = useState<any>(null)
  const id = String(params?.id || '')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && id) loadReceipt()
  }, [user, id])

  async function loadReceipt() {
    setLoading(true)
    const { data } = await supabase
      .from('professional_financial_entries')
      .select('*')
      .eq('id', id)
      .eq('professional_user_id', user?.id)
      .maybeSingle()
    setEntry(data || null)
    setLoading(false)
  }

  if (authLoading || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  if (!entry || !professional) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/backoffice" className="inline-flex items-center gap-2 text-sm text-emerald-700 font-semibold mb-6"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
        <section className="rounded-3xl bg-white border border-gray-100 p-8 text-center">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Recibo não encontrado</h1>
          <p className="text-gray-600 mt-2">Este lançamento não existe ou não pertence à sua conta.</p>
        </section>
      </main>
    )
  }

  const amount = formatMoney(entry.amount_cents)
  const paidAt = entry.paid_at ? new Date(entry.paid_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')
  const professionalDoc = formatDoc(professional.cpf)
  const protocol = String(entry.id).slice(0, 8).toUpperCase()

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 print:p-0 print:max-w-none">
      <div className="flex items-center justify-between gap-3 mb-6 print:hidden">
        <Link href="/backoffice" className="inline-flex items-center gap-2 text-sm text-emerald-700 font-semibold"><ArrowLeft className="w-4 h-4" /> Voltar ao Backoffice</Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 text-white px-4 py-3 font-semibold"><Printer className="w-5 h-5" /> Imprimir / PDF</button>
      </div>

      <section className="bg-white border border-gray-200 rounded-[2rem] p-8 md:p-12 print:border-0 print:rounded-none print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b pb-6 mb-8">
          <div>
            <p className="text-sm text-emerald-700 font-semibold">MyDataMed</p>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">Recibo de pagamento</h1>
            <p className="text-sm text-gray-500 mt-2">Protocolo {protocol}</p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><Receipt className="w-8 h-8" /></div>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <InfoBlock title="Recebedor">
            <p className="font-bold text-gray-900">{professional.full_name}</p>
            <p>{labelForProfessional(professional.professional_type)}{professional.specialty ? ` • ${professional.specialty}` : ''}</p>
            {professional.professional_register && <p>Registro: {professional.professional_register}{professional.register_state ? `/${professional.register_state}` : ''}</p>}
            <p>CPF: {professionalDoc}</p>
          </InfoBlock>

          <InfoBlock title="Pagador / paciente">
            <p className="font-bold text-gray-900">{entry.patient_name || 'Não informado'}</p>
            {entry.patient_email && <p>{entry.patient_email}</p>}
            {entry.patient_phone && <p>{entry.patient_phone}</p>}
          </InfoBlock>
        </div>

        <div className="rounded-3xl bg-gray-50 border border-gray-100 p-6 mb-8">
          <p className="text-sm text-gray-500">Descrição</p>
          <h2 className="text-xl font-bold text-gray-900 mt-1">{entry.description}</h2>
          {entry.category && <p className="text-sm text-gray-600 mt-1">Categoria: {entry.category}</p>}
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <Metric label="Valor" value={amount} />
            <Metric label="Data de pagamento" value={paidAt} />
            <Metric label="Método" value={methodLabel(entry.payment_method)} />
          </div>
        </div>

        <p className="text-gray-700 leading-relaxed">
          Declaro, para os devidos fins, que recebi de <strong>{entry.patient_name || 'paciente/cliente identificado no atendimento'}</strong> a importância de <strong>{amount}</strong>, referente a <strong>{entry.description}</strong>.
        </p>

        <div className="mt-12 grid md:grid-cols-2 gap-8 items-end">
          <div className="border-t pt-3 text-center text-sm text-gray-600">
            {professional.full_name}<br />
            {professional.professional_register ? `${professional.professional_register}${professional.register_state ? `/${professional.register_state}` : ''}` : labelForProfessional(professional.professional_type)}
          </div>
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-900 flex gap-2">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            <span>Este recibo é um comprovante operacional emitido pelo profissional no MyDataMed. Nota fiscal eletrônica poderá ser emitida em módulo próprio quando configurada.</span>
          </div>
        </div>
      </section>
    </main>
  )
}

function InfoBlock({ title, children }: any) {
  return <div><p className="text-sm font-semibold text-gray-500 mb-2">{title}</p><div className="text-sm text-gray-700 space-y-1">{children}</div></div>
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-gray-500">{label}</p><p className="text-lg font-bold text-gray-900">{value}</p></div>
}
function formatMoney(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100) }
function formatDoc(value: string) { const d = String(value || '').replace(/\D/g, ''); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d || 'Não informado' }
function methodLabel(value: string) { const map: Record<string, string> = { platform_pix: 'Pix pela plataforma', direct_pix: 'Pix direto', cash: 'Dinheiro', card: 'Cartão', bank_transfer: 'Transferência', not_defined: 'Não informado', other: 'Outro' }; return map[value] || value || 'Não informado' }
function labelForProfessional(value: string) { const map: Record<string, string> = { medico: 'Médico(a)', nutricionista: 'Nutricionista', fisioterapeuta: 'Fisioterapeuta', psicologo: 'Psicólogo(a)', terapeuta: 'Terapeuta', enfermeiro: 'Enfermeiro(a)', fonoaudiologo: 'Fonoaudiólogo(a)', odonto: 'Odontólogo(a)', farmaceutico: 'Farmacêutico(a)', educador_fisico: 'Educador(a) físico(a)' }; return map[value] || 'Profissional de saúde' }
