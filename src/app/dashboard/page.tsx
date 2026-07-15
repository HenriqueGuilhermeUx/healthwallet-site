'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  Shield,
  KeyRound,
  Clock,
  FileText,
  Send,
  History,
  Loader2,
  ArrowRight,
  Video,
  CalendarDays,
  MessageCircle,
  ReceiptText,
  Wallet,
  Search,
  CreditCard,
  Brain,
} from 'lucide-react'

interface AccessCode {
  id: string
  code: string
  patient_id: string
  permissions: any
  expires_at: string
  used_at: string | null
  created_at: string
  patient_name?: string
}

export default function DashboardPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [submitting, setSubmitting] = useState(false)
  const [recentAccess, setRecentAccess] = useState<AccessCode[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && professional) loadRecentAccess()
  }, [user, professional])

  const loadRecentAccess = async () => {
    if (!professional) return
    setLoadingRecent(true)
    const { data } = await supabase
      .from('access_codes')
      .select('*')
      .eq('professional_id', professional.id)
      .order('created_at', { ascending: false })
      .limit(5)
    if (data) setRecentAccess(data)
    setLoadingRecent(false)
  }

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('')
      const newCode = [...code]
      digits.forEach((digit, i) => { if (index + i < 6) newCode[index + i] = digit })
      setCode(newCode)
      const lastFilledIndex = Math.min(index + digits.length, 5)
      document.getElementById(`code-${lastFilledIndex}`)?.focus()
    } else {
      const newCode = [...code]
      newCode[index] = value.replace(/\D/g, '')
      setCode(newCode)
      if (value && index < 5) document.getElementById(`code-${index + 1}`)?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) document.getElementById(`code-${index - 1}`)?.focus()
  }

  const handleSubmit = async () => {
    const fullCode = code.join('')
    if (fullCode.length !== 6) {
      toast.error('Digite o código completo de 6 dígitos')
      return
    }
    setSubmitting(true)
    try {
      const { data: accessCode, error: findError } = await supabase
        .from('access_codes')
        .select('*')
        .eq('code', fullCode)
        .gte('expires_at', new Date().toISOString())
        .is('used_at', null)
        .single()

      if (findError || !accessCode) {
        toast.error('Código inválido ou expirado')
        setSubmitting(false)
        return
      }

      const { error: updateError } = await supabase
        .from('access_codes')
        .update({ used_at: new Date().toISOString(), professional_id: professional?.id })
        .eq('id', accessCode.id)

      if (updateError) {
        toast.error('Erro ao validar código')
        setSubmitting(false)
        return
      }

      toast.success('Acesso liberado!')
      router.push(`/patient/${accessCode.id}`)
    } catch {
      toast.error('Erro ao validar código')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || !professional) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Olá, {professional.full_name}</h1>
        <p className="text-gray-600 mt-1">Acesse pacientes, teleconsultas, documentos, IA assistiva, cobranças e dados autorizados</p>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Link href="/copiloto" className="bg-gradient-to-br from-violet-700 to-slate-950 text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow">
          <Brain className="w-8 h-8 mb-3" />
          <h2 className="font-bold text-lg">Copiloto IA</h2>
          <p className="text-sm text-white/80 mt-1">Resumo, timeline, exames, medicamentos, anamnese e pontos de atenção.</p>
          <span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold">Abrir <ArrowRight className="w-4 h-4" /></span>
        </Link>

        <Link href="/financeiro" className="bg-gradient-to-br from-emerald-700 to-teal-900 text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow">
          <ReceiptText className="w-8 h-8 mb-3" />
          <h2 className="font-bold text-lg">Financeiro</h2>
          <p className="text-sm text-white/80 mt-1">Powered by NextGen: Pix, teleconsulta, recorrência e planos mensais.</p>
          <span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold">Cobrar <ArrowRight className="w-4 h-4" /></span>
        </Link>

        <Link href="/teleconsultas" className="bg-gradient-to-br from-cyan-600 to-blue-700 text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow">
          <Video className="w-8 h-8 mb-3" />
          <h2 className="font-bold text-lg">Teleconsultas</h2>
          <p className="text-sm text-white/80 mt-1">Agenda, chamada, lembretes e orientações.</p>
          <span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold">Abrir <ArrowRight className="w-4 h-4" /></span>
        </Link>

        <Link href="/buscar" className="bg-gradient-to-br from-blue-700 to-indigo-800 text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow">
          <Search className="w-8 h-8 mb-3" />
          <h2 className="font-bold text-lg">Buscar CPF/CNS</h2>
          <p className="text-sm text-white/80 mt-1">Localize pacientes já autorizados por CPF ou Cartão SUS.</p>
          <span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold">Buscar <ArrowRight className="w-4 h-4" /></span>
        </Link>

        <Link href="/pro" className="bg-gradient-to-br from-slate-900 to-emerald-900 text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow">
          <Wallet className="w-8 h-8 mb-3" />
          <h2 className="font-bold text-lg">Modo Pro</h2>
          <p className="text-sm text-white/80 mt-1">15 dias grátis, Pix Woovi, CRM/Bots e área comercial.</p>
          <span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold">Ativar <ArrowRight className="w-4 h-4" /></span>
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <MessageCircle className="w-8 h-8 text-purple-600 mb-3" />
          <h2 className="font-bold text-lg">CRM SmartBots</h2>
          <p className="text-sm text-gray-600 mt-1">Lembretes, retornos e relacionamento pós-consulta.</p>
        </div>
      </div>

      <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-8 flex items-start gap-3">
        <Brain className="w-5 h-5 text-violet-700 mt-0.5" />
        <p className="text-sm text-violet-950">
          O MyDataMed permite acompanhamento contínuo, autorizado e inteligente — com dados, IA, agenda, documentos, CRM, teleatendimento, cobranças e automações em um só lugar.
        </p>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-8 flex items-start gap-3">
        <ReceiptText className="w-5 h-5 text-emerald-700 mt-0.5" />
        <p className="text-sm text-emerald-900">
          Camadas internas: Powered by SmartBots para CRM, Staff para agenda/admin, DocWallet para documentos e NextGen para cobranças, Pix, recorrência e planos.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-8 flex items-start gap-3">
        <CreditCard className="w-5 h-5 text-blue-700 mt-0.5" />
        <p className="text-sm text-blue-900">
          CNS/Cartão SUS é uma ponte operacional: ajuda profissionais, clínicas e prefeituras a organizar o cuidado, mantendo os usos de HealthWallet e MyDataMed para todos os públicos.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-8">
        <div className="flex items-center justify-center gap-3 mb-6">
          <KeyRound className="w-8 h-8 text-emerald-600" />
          <span className="text-lg font-semibold text-gray-900">Código de Acesso</span>
        </div>
        <div className="flex justify-center gap-3 mb-6">
          {code.map((digit, index) => (
            <input key={index} id={`code-${index}`} type="text" inputMode="numeric" value={digit} onChange={(e) => handleCodeChange(index, e.target.value)} onKeyDown={(e) => handleKeyDown(index, e)} className="w-12 h-14 text-center text-2xl font-bold rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" maxLength={6} />
          ))}
        </div>
        <button onClick={handleSubmit} disabled={submitting || code.join('').length !== 6} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {submitting ? <><Loader2 className="w-5 h-5 animate-spin" />Validando...</> : <>Acessar Paciente<ArrowRight className="w-5 h-5" /></>}
        </button>
        <p className="text-center text-sm text-gray-500 mt-4">O código é fornecido pelo paciente via app HealthWallet</p>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4"><Shield className="w-5 h-5 text-emerald-600" /><span className="font-semibold text-gray-900">Segurança</span></div>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2"><Clock className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /><span>O código expira automaticamente após o tempo definido pelo paciente</span></li>
          <li className="flex items-start gap-2"><FileText className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /><span>Você só verá os dados que o paciente autorizou</span></li>
          <li className="flex items-start gap-2"><Send className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /><span>Após acessar, você pode enviar documentos, orientações, cobranças e prescrições quando aplicável</span></li>
        </ul>
      </div>

      {recentAccess.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><History className="w-5 h-5 text-gray-600" /><span className="font-semibold text-gray-900">Acessos Recentes</span></div></div>
          <div className="space-y-3">
            {loadingRecent ? <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" /></div> : recentAccess.map((access) => (
              <div key={access.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div><p className="font-medium text-gray-900">Acesso {access.code}</p><p className="text-xs text-gray-500">{new Date(access.created_at).toLocaleDateString('pt-BR')}</p></div>
                <div className="flex gap-3">
                  <Link href={`/copiloto?patient=${access.patient_id}`} className="text-violet-700 text-sm font-medium hover:underline">Copiloto IA</Link>
                  <Link href={`/patient/${access.id}`} className="text-emerald-600 text-sm font-medium hover:underline">Ver →</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
