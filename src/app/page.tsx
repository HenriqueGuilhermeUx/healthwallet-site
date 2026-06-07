'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import {
  Shield,
  Clock,
  FileText,
  Users,
  ArrowRight,
  Stethoscope,
  HeartPulse,
  Lock,
} from 'lucide-react'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full text-emerald-700 text-sm font-medium mb-6">
          <Shield className="w-4 h-4" />
          MyDataMed by Nexa
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Acesse dados compartilhados pelos pacientes
          <span className="text-emerald-600"> com segurança</span>
        </h1>

        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Portal profissional conectado ao HealthWallet. Visualize exames,
          histórico, documentos e orientações somente quando o paciente autorizar.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Acessar como Profissional
            <ArrowRight className="w-5 h-5" />
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Já tenho conta
          </Link>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          O paciente decide o que compartilhar e por quanto tempo.
        </p>
      </div>

      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 md:p-10 text-white mb-16">
        <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 rounded-full text-sm font-medium mb-4">
              <HeartPulse className="w-4 h-4" />
              HealthWallet + MyDataMed
            </div>

            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Dados de saúde com consentimento do paciente.
            </h2>

            <p className="text-white/85">
              O HealthWallet é o cofre de saúde do paciente. O MyDataMed é o
              portal onde profissionais acessam apenas as informações
              compartilhadas por código, com controle de tempo e finalidade.
            </p>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Lock className="w-5 h-5" />
              <span className="font-semibold">Acesso controlado</span>
            </div>

            <ul className="space-y-2 text-sm text-white/85">
              <li>✓ Código gerado pelo paciente</li>
              <li>✓ Dados limitados ao autorizado</li>
              <li>✓ Acesso temporário</li>
              <li>✓ Histórico e documentos organizados</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Exames e histórico
          </h3>

          <p className="text-gray-600">
            Visualize exames, documentos de saúde, histórico e informações
            compartilhadas pelo paciente.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-purple-600" />
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Acesso temporário
          </h3>

          <p className="text-gray-600">
            O paciente controla a duração do acesso. Você vê os dados apenas
            enquanto estiver autorizado.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-orange-600" />
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Retorno ao paciente
          </h3>

          <p className="text-gray-600">
            Envie evoluções, prescrições, orientações e documentos diretamente
            para a carteira do paciente.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 md:p-12">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Como funciona
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
              1
            </div>

            <h3 className="font-semibold text-gray-900 mb-2">
              Paciente gera código
            </h3>

            <p className="text-gray-600 text-sm">
              No HealthWallet, o paciente escolhe o que deseja compartilhar e
              gera um código de acesso.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
              2
            </div>

            <h3 className="font-semibold text-gray-900 mb-2">
              Profissional acessa
            </h3>

            <p className="text-gray-600 text-sm">
              Faça login no MyDataMed e digite o código fornecido pelo paciente.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
              3
            </div>

            <h3 className="font-semibold text-gray-900 mb-2">
              Visualize e envie
            </h3>

            <p className="text-gray-600 text-sm">
              Veja apenas os dados autorizados e envie orientações ou documentos
              de volta ao paciente.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center mt-16">
        <div className="inline-flex items-center gap-2 text-gray-600 mb-4">
          <Stethoscope className="w-5 h-5" />
          <span>Para profissionais de saúde</span>
        </div>

        <p className="text-gray-500 text-sm mb-6">
          Médicos, fisioterapeutas, nutricionistas, psicólogos, enfermeiros e
          clínicas.
        </p>

        <Link
          href="/register"
          className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
        >
          Começar no MyDataMed
          <ArrowRight className="w-5 h-5" />
        </Link>

        <p className="text-xs text-gray-400 mt-6">
          MyDataMed by Nexa — parte do ecossistema de soberania de dados da
          Nexa.
        </p>
      </div>
    </div>
  )
}
