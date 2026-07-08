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
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && professional) {
      loadRecentAccess()
    }
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

    if (data) {
      setRecentAccess(data)
    }
    setLoadingRecent(false)
  }

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('')
      const newCode = [...code]
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit
        }
      })
      setCode(newCode)
      const lastFilledIndex = Math.min(index + digits.length, 5)
      document.getElementById(`code-${lastFilledIndex}`)?.focus()
    } else {
      const newCode = [...code]
      newCode[index] = value.replace(/\D/g, '')
      setCode(newCode)

      if (value && index < 5) {
        document.getElementById(`code-${index + 1}`)?.focus()
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      document.getElementById(`code-${index - 1}`)?.focus()
    }
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
        .update({
          used_at: new Date().toISOString(),
          professional_id: professional?.id
        })
        .eq('id', accessCode.id)

      if (updateError) {
        toast.error('Erro ao validar código')
        setSubmitting(false)
        return
      }

      toast.success('Acesso liberado!')
      router.push(`/patient/${accessCode.id}`)
    } catch (err) {
      toast.error('Erro ao validar código')
    } finally {
      setSubmitting(false)
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
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Olá, {professional.full_name}</h1>
        <p className="text-gray-600 mt-1">Acesse pacientes, teleconsultas, documentos profissionais e dados autorizados</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <Link href="/teleconsultas" className="bg-gradient-to-br from-cyan-600 to-blue-700 text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow">
          <Video className="w-8 h-8 mb-3" />
          <h2 className="font-bold text-lg">Teleconsultas</h2>
          <p className="text-sm text-white/80 mt-1">Agendar, assumir solicitações, iniciar, lembrar, concluir e registrar orientações.</p>
          <span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold">Abrir agenda <ArrowRight className="w-4 h-4" /></span>
        </Link>

        <Link href="/pro" className="bg-gradient-to-br from-slate-900 to-emerald-900 text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow">
          <Wallet className="w-8 h-8 mb-3" />
          <h2 className="font-bold text-lg">Modo Pro</h2>
          <p className="text-sm text-white/80 mt-1">15 dias grátis, Pix Woovi, CRM/Bots, agenda e área comercial.</p>
          <span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold">Ativar Pro <ArrowRight className="w-4 h-4" /></span>
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <CalendarDays className="w-8 h-8 text-emerald-600 mb-3" />
          <h2 className="font-bold text-lg">Agenda integrada</h2>
          <p className="text-sm text-gray-600 mt-1">Organize consultas online e dados autorizados por evento.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <MessageCircle className="w-8 h-8 text-purple-600 mb-3" />
          <h2 className="font-bold text-lg">CRM multiprofissional</h2>
          <p className="text-sm text-gray-600 mt-1">Lembretes, orientações e relacionamento pós-consulta para equipes de saúde.</p>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-8 flex items-start gap-3">
        <ReceiptText className="w-5 h-5 text-emerald-700 mt-0.5" />
        <p className="text-sm text-emerald-900">
          O acesso a dados autorizados dos pacientes é gratuito. O Modo Pro libera a área comercial: teleconsulta, agenda, CRM/Bots, pagamentos Pix Woovi/NextGen e documentos profissionais.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-8">
        <div className="flex items-center justify-center gap-3 mb-6">
          <KeyRound className="w-8 h-8 text-emerald-600" />
          <span className="text-lg font-semibold text-gray-900">Código de Acesso</span>
        </div>

        <div className="flex justify-center gap-3 mb-6">
          {code.map((digit, index) => (
            <input
              key={index}
              id={`code-${index}`}
              type="text"
              inputMode="numeric"
              value={digit}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-2xl font-bold rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              maxLength={6}
            />
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || code.join('').length !== 6}
          className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Validando...
            </>
          ) : (
            <>
              Acessar Paciente
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          O código é fornecido pelo paciente via app HealthWallet
        </p>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600" />
          <span className="font-semibold text-gray-900">Segurança</span>
        </div>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <span>O código expira automaticamente após o tempo definido pelo paciente</span>
          </li>
          <li className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <span>Você só verá os dados que o paciente autorizou</span>
          </li>
          <li className="flex items-start gap-2">
            <Send className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <span>Após acessar, você pode enviar documentos, orientações e prescrições quando aplicável</span>
          </li>
        </ul>
      </div>

      {recentAccess.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-gray-600" />
              <span className="font-semibold text-gray-900">Acessos Recentes</span>
            </div>
          </div>

          <div className="space-y-3">
            {loadingRecent ? (
              <div className="text-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
              </div>
            ) : (
              recentAccess.map((access) => (
                <div key={access.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">Acesso {access.code}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(access.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Link href={`/patient/${access.id}`} className="text-emerald-600 text-sm font-medium hover:underline">
                    Ver →
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
