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
  Video,
  CalendarDays,
  MessageCircle,
  CreditCard,
  PenLine,
  BadgeCheck,
  QrCode,
  CheckCircle,
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
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full text-emerald-700 text-sm font-medium mb-6">
          <Shield className="w-4 h-4" />
          MyDataMed para profissionais de saúde
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Agenda, teleconsulta e dados do paciente
          <span className="text-emerald-600"> com consentimento</span>
        </h1>

        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
          Portal profissional conectado ao HealthWallet para médicos, dentistas, nutricionistas, psicólogos, fisioterapeutas, enfermeiros, terapeutas e clínicas que querem atender com dados organizados, documentos e acompanhamento.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Começar como profissional
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
          O paciente decide o que compartilhar, com quem e por quanto tempo.
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
              O paciente chega com histórico, exames, medicamentos e resumo organizados.
            </h2>

            <p className="text-white/85">
              O HealthWallet é o cofre de saúde do paciente. O MyDataMed é a área profissional para acessar dados autorizados, realizar teleconsultas, registrar orientações e emitir documentos conforme a habilitação de cada profissional.
            </p>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Lock className="w-5 h-5" />
              <span className="font-semibold">Consentimento por evento</span>
            </div>

            <ul className="space-y-2 text-sm text-white/85">
              <li>✓ Código ou autorização do paciente</li>
              <li>✓ Dados limitados ao atendimento</li>
              <li>✓ Acesso temporário e rastreável</li>
              <li>✓ Histórico, documentos e Passport organizados</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <FeatureCard icon={Video} color="bg-cyan-100 text-cyan-700" title="Teleconsulta integrada" text="Agenda, confirmação, lembrete, link da chamada, dados autorizados, registro de atendimento e orientações ao paciente." />
        <FeatureCard icon={FileText} color="bg-blue-100 text-blue-700" title="Exames e histórico" text="Visualize exames, documentos, medicamentos, timeline, MedScore e resumo compartilhado pelo paciente." />
        <FeatureCard icon={Users} color="bg-orange-100 text-orange-700" title="Cuidado multiprofissional" text="Feito para diferentes áreas da saúde, com escopo de documento e permissões por tipo de profissional." />
      </div>

      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 md:p-12 mb-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Como funciona
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <Step number="1" title="Paciente compartilha" text="No HealthWallet, o paciente escolhe os dados e autoriza o acesso para uma consulta, código ou período." />
          <Step number="2" title="Profissional atende" text="No MyDataMed, o profissional agenda, inicia a teleconsulta e acessa somente os dados autorizados." />
          <Step number="3" title="Documento volta ao paciente" text="Orientações, planos, pedidos, relatórios ou receitas quando aplicável ficam disponíveis no HealthWallet." />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 md:p-12 border border-gray-100 shadow-sm mb-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full text-emerald-700 text-sm font-medium mb-4">
            <PenLine className="w-4 h-4" />
            Documentos profissionais com assinatura e validação
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Emita orientações, pedidos, relatórios e receitas quando sua habilitação permitir.
          </h2>

          <p className="text-gray-600 max-w-3xl mx-auto">
            O módulo de documentos foi pensado para todos os profissionais de saúde. Cada tipo de documento deve respeitar o conselho, a habilitação profissional e as regras aplicáveis. Receita medicamentosa não é tratada como recurso genérico: ela fica condicionada à permissão do profissional e à assinatura/validação adequada.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <MiniCard icon={MessageCircle} title="Orientações e planos" text="Para psicólogos, nutricionistas, fisioterapeutas, enfermeiros, terapeutas e demais profissionais registrarem recomendações e acompanhamento." />
          <MiniCard icon={FileText} title="Pedidos, relatórios e declarações" text="Documentos profissionais enviados ao HealthWallet do paciente, com histórico, autoria e trilha de auditoria." />
          <MiniCard icon={BadgeCheck} title="Receitas quando aplicável" text="Prescrição/receita apenas para profissionais habilitados, com validação, assinatura digital e identificação do conselho profissional." />
        </div>

        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <ValidationItem icon={QrCode} title="QR ou link de validação" text="Documento preparado para exibir forma de conferência da assinatura e integridade." />
          <ValidationItem icon={Shield} title="Assinatura digital" text="Preparado para provedor de assinatura, certificado ICP-Brasil, GOV.BR avançada ou fluxo equivalente quando aplicável." />
          <ValidationItem icon={Clock} title="Registro e auditoria" text="Data, profissional, conselho, hash, status de assinatura e envio ao paciente." />
        </div>
      </div>

      <div className="bg-slate-950 rounded-3xl p-8 md:p-12 text-white mb-16">
        <div className="grid md:grid-cols-[1fr_0.85fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-emerald-100 text-sm font-medium mb-4">
              <CreditCard className="w-4 h-4" />
              Plano profissional
            </div>
            <h2 className="text-3xl font-bold mb-3">Para pequenas clínicas e profissionais liberais.</h2>
            <p className="text-white/75">
              Agenda, teleconsulta, CRM, lembretes, documentos e pagamentos em uma plataforma simples para operar atendimentos digitais.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 text-gray-900">
            <p className="text-sm text-gray-500">MyDataMed Pro</p>
            <p className="text-4xl font-bold mt-1">R$ 79,90<span className="text-base font-medium text-gray-500">/mês</span></p>
            <ul className="space-y-2 text-sm text-gray-600 mt-5">
              <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-emerald-600" /> Teleconsultas e agenda</li>
              <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-emerald-600" /> CRM e lembretes SmartBots</li>
              <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-emerald-600" /> Documentos e orientações</li>
              <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-emerald-600" /> Pix/repasse NextGen em evolução</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="text-center">
        <div className="inline-flex items-center gap-2 text-gray-600 mb-4">
          <Stethoscope className="w-5 h-5" />
          <span>Para profissionais e equipes de saúde</span>
        </div>

        <p className="text-gray-500 text-sm mb-6 max-w-2xl mx-auto">
          Médicos, dentistas, nutricionistas, psicólogos, fisioterapeutas, terapeutas ocupacionais, fonoaudiólogos, enfermeiros, farmacêuticos, clínicas e outros profissionais de saúde.
        </p>

        <Link
          href="/register"
          className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
        >
          Começar no MyDataMed
          <ArrowRight className="w-5 h-5" />
        </Link>

        <p className="text-xs text-gray-400 mt-6">
          MyDataMed — portal profissional conectado ao HealthWallet.
        </p>
      </div>
    </div>
  )
}

function FeatureCard({ icon: Icon, color, title, text }: any) {
  return (
    <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{text}</p>
    </div>
  )
}

function Step({ number, title, text }: any) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
        {number}
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{text}</p>
    </div>
  )
}

function MiniCard({ icon: Icon, title, text }: any) {
  return (
    <div className="rounded-2xl bg-gray-50 p-6 border border-gray-100">
      <Icon className="w-6 h-6 text-emerald-600 mb-3" />
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{text}</p>
    </div>
  )
}

function ValidationItem({ icon: Icon, title, text }: any) {
  return (
    <div className="rounded-2xl bg-emerald-50 p-5 border border-emerald-100">
      <Icon className="w-5 h-5 text-emerald-700 mb-2" />
      <h3 className="font-semibold text-gray-900 text-sm mb-1">{title}</h3>
      <p className="text-xs text-gray-600">{text}</p>
    </div>
  )
}
