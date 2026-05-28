'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { Shield, Clock, FileText, Users, ArrowRight, Stethoscope } from 'lucide-react'

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
      {/* Hero Section */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full text-emerald-700 text-sm font-medium mb-6">
          <Shield className="w-4 h-4" />
          Plataforma Segura para Profissionais
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Acesse dados de saúde dos seus pacientes
          <span className="text-emerald-600"> de forma segura</span>
        </h1>

        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Receba códigos de acesso dos pacientes e visualize exames, análises de IA e muito mais.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Cadastrar como Profissional
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Já tenho conta
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Exames e Análises</h3>
          <p className="text-gray-600">
            Visualize exames laboratoriais, análises de IA e o MedScore dos pacientes de forma clara.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Acesso Temporário</h3>
          <p className="text-gray-600">
            Pacientes controlam a duração do acesso. Você só vê os dados enquanto autorizado.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-orange-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Envio de Documentos</h3>
          <p className="text-gray-600">
            Envie evoluções, prescrições e orientações diretamente para o paciente.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 md:p-12">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Como funciona</h2>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Paciente gera código</h3>
            <p className="text-gray-600 text-sm">
              No app HealthWallet, o paciente seleciona os dados e gera um código de acesso.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Você digita o código</h3>
            <p className="text-gray-600 text-sm">
              Acesse este site, faça login e digite o código de 6 dígitos fornecido pelo paciente.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Visualize e envie</h3>
            <p className="text-gray-600 text-sm">
              Veja os dados autorizados e envie documentos de volta para o paciente.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center mt-16">
        <div className="inline-flex items-center gap-2 text-gray-600 mb-4">
          <Stethoscope className="w-5 h-5" />
          <span>Para profissionais de saúde</span>
        </div>
        <p className="text-gray-500 text-sm">
          Fisioterapeutas, nutricionistas, psicólogos, enfermeiros e médicos
        </p>
      </div>
    </div>
  )
}
