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
  Bot,
  Wallet,
  Sparkles,
  Building2,
  Gift,
  ClipboardCheck,
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
    <div className="max-w-7xl mx-auto px-4 py-10">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-12">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">MyDataMed</p>
            <p className="text-xs text-gray-500">HealthWallet para pacientes + portal profissional</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
          <a href="#healthwallet" className="hover:text-emerald-700">HealthWallet</a>
          <a href="#mydatamed" className="hover:text-emerald-700">MyDataMed</a>
          <a href="#planos" className="hover:text-emerald-700">Planos</a>
          <a href="#tecnologia" className="hover:text-emerald-700">Tecnologia</a>
        </nav>

        <div className="flex gap-2">
          <Link href="/login" className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50">Entrar</Link>
          <Link href="/register" className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700">Cadastrar</Link>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-8 md:p-14 mb-16">
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -left-20 bottom-0 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl" />

        <div className="relative grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-emerald-100 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Plataforma de saúde digital para pacientes, famílias e profissionais
            </div>

            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-5">
              HealthWallet cuida dos dados. MyDataMed transforma isso em atendimento.
            </h1>

            <p className="text-lg md:text-xl text-white/75 max-w-3xl mb-8">
              Um ecossistema simples: pessoas e famílias organizam saúde no HealthWallet; profissionais acessam dados autorizados gratuitamente e, quando quiserem vender melhor, usam o MyDataMed Pro com teleconsulta, CRM, bots, documentos e pagamentos.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600">
                Começar grátis como profissional
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#planos" className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/10 border border-white/15 text-white font-semibold hover:bg-white/15">
                Ver modelo comercial
              </a>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-8 max-w-2xl">
              <HeroStat value="Grátis" label="acesso a dados autorizados" />
              <HeroStat value="15 dias" label="teste da área comercial" />
              <HeroStat value="R$ 79,90" label="Pro mensal" />
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 border border-white/10 p-5 backdrop-blur">
            <div className="rounded-2xl bg-white text-gray-900 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs text-gray-500">Cockpit profissional</p>
                  <h3 className="text-xl font-bold">Hoje</h3>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Pro trial</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <MiniMetric label="Consultas" value="8" />
                <MiniMetric label="Pacientes" value="34" />
                <MiniMetric label="Lembretes" value="12" />
                <MiniMetric label="Pix pagos" value="R$ 920" />
              </div>

              <div className="space-y-2">
                <CockpitRow icon={Video} title="Teleconsulta 15:30" text="Paciente confirmou e autorizou dados" />
                <CockpitRow icon={Bot} title="SmartBots CRM" text="3 follow-ups prontos para enviar" />
                <CockpitRow icon={Wallet} title="NextGen Pix" text="Pagamento confirmado e repasse pendente" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="healthwallet" className="mb-16">
        <div className="text-center max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full text-emerald-700 text-sm font-medium mb-4">
            <HeartPulse className="w-4 h-4" />
            Área 1 — HealthWallet
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Para pessoas, famílias e pacientes.</h2>
          <p className="text-gray-600 text-lg">
            O HealthWallet é o app gratuito para organizar saúde pessoal e familiar: exames, medicamentos, Passport, MedScore, teleconsulta, família e compartilhamento seguro.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <AreaCard icon={Users} title="Família e dependentes" text="Perfis familiares livres: cadastrou nome, dados e exames, o cuidado já roda sem aceite, assinatura ou convite obrigatório." />
          <AreaCard icon={FileText} title="Exames e documentos" text="Cofre de saúde com documentos, timeline, resumo inteligente e dados prontos para compartilhar quando necessário." />
          <AreaCard icon={Shield} title="Controle do paciente" text="O paciente decide quando compartilhar dados com profissionais externos por código, consulta ou evento." />
        </div>
      </section>

      <section id="mydatamed" className="mb-16">
        <div className="text-center max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-50 rounded-full text-cyan-700 text-sm font-medium mb-4">
            <Stethoscope className="w-4 h-4" />
            Área 2 — MyDataMed
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Para profissionais de saúde e pequenas clínicas.</h2>
          <p className="text-gray-600 text-lg">
            Uma área gratuita para acessar dados autorizados dos pacientes e uma área Pro para operar atendimento, relacionamento e recebimento.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <PlanBlock
            badge="Acesso gratuito"
            title="MyDataMed Free"
            price="R$ 0"
            description="Para todo profissional cadastrado acessar dados autorizados pelo paciente."
            items={[
              'Cadastro profissional',
              'Validação por código do paciente',
              'Acesso a resumo, exames, medicamentos, timeline e Passport quando autorizado',
              'Visualização de documentos recebidos',
              'Sem cobrança para acessar dados compartilhados',
            ]}
            cta="Cadastrar grátis"
            href="/register"
          />

          <PlanBlock
            featured
            badge="15 dias livres"
            title="MyDataMed Pro"
            price="R$ 79,90/mês"
            description="Para profissionais que querem usar a área comercial e atender com agenda, CRM, bots e pagamentos."
            items={[
              'Agenda e teleconsulta',
              'Google Meet/Calendar em implantação',
              'CRM SmartBots para lembretes, retornos e follow-up',
              'Pagamentos Pix NextGen/Woovi com confirmação',
              'Split/repasse e comissão da plataforma em evolução',
              'Documentos profissionais assinados pelo emissor',
              'Receitas/prescrições quando habilitado e com validação aplicável',
            ]}
            cta="Testar 15 dias"
            href="/register"
          />
        </div>
      </section>

      <section id="tecnologia" className="mb-16 bg-gradient-to-br from-gray-50 to-emerald-50 rounded-[2rem] p-8 md:p-12">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Como a máquina comercial vai funcionar</h2>
          <p className="text-gray-600">
            O MVP já roda com link manual de chamada. A próxima camada conecta Google Calendar/Meet, CRM SmartBots e pagamentos NextGen/Woovi sem mudar a experiência do usuário.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <TechStep icon={CalendarDays} title="Agenda + Meet" text="Cria evento, link da chamada, convidados, lembretes e sincronização com a agenda do profissional." />
          <TechStep icon={Bot} title="SmartBots CRM" text="Lembretes de consulta, confirmação, pós-consulta, retorno, mensagens e reativação de pacientes." />
          <TechStep icon={Wallet} title="NextGen Pix" text="Cobrança Pix, confirmação de pagamento, status da consulta, comissão e repasse." />
          <TechStep icon={PenLine} title="Documentos" text="Orientações, relatórios e documentos assinados pelo profissional com hash e validação pública." />
        </div>
      </section>

      <section className="mb-16 bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 md:p-12">
        <div className="grid md:grid-cols-[1fr_0.9fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-700 text-sm font-medium mb-4">
              <Video className="w-4 h-4" />
              Teleconsulta
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Link manual agora. Google Meet/Calendar como evolução principal.</h2>
            <p className="text-gray-600 mb-5">
              Hoje o profissional cola o link da chamada e o fluxo já funciona. A versão seguinte conecta a conta Google do profissional para criar evento, convidados, lembretes e link de Meet automaticamente.
            </p>
            <div className="space-y-3">
              <Check text="MVP atual: Google Meet/Zoom/Daily por link manual" />
              <Check text="Fase Google: OAuth + Calendar API + evento com convidados e lembretes" />
              <Check text="Fase pagamento: consulta só confirma após Pix pago, se o profissional ativar cobrança" />
            </div>
          </div>

          <div className="rounded-3xl bg-slate-950 text-white p-6">
            <p className="text-sm text-emerald-200 mb-3">Fluxo Pro</p>
            <div className="space-y-3">
              <FlowItem number="1" text="Profissional agenda consulta" />
              <FlowItem number="2" text="Sistema gera link ou evento Google" />
              <FlowItem number="3" text="Paciente confirma e autoriza dados" />
              <FlowItem number="4" text="Pix opcional confirma pagamento" />
              <FlowItem number="5" text="SmartBots envia lembrete e follow-up" />
            </div>
          </div>
        </div>
      </section>

      <section id="planos" className="mb-16 bg-slate-950 rounded-[2rem] p-8 md:p-12 text-white">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-emerald-100 text-sm font-medium mb-4">
            <CreditCard className="w-4 h-4" />
            Modelo comercial
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Grátis para acessar dados. Pago para operar atendimento comercial.</h2>
          <p className="text-white/70">
            Isso remove atrito para profissionais entrarem e cria receita quando eles usam teleconsulta, CRM, pagamentos e documentos como ferramenta de trabalho.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <PricingPillar icon={Shield} title="Free" price="R$ 0" text="Acessar dados autorizados por pacientes mediante cadastro profissional." />
          <PricingPillar icon={Gift} title="Trial Pro" price="15 dias" text="Usar área comercial completa sem cobrança inicial." />
          <PricingPillar icon={Building2} title="Pro" price="R$ 79,90/mês" text="Teleconsulta, agenda, SmartBots CRM, pagamentos NextGen e documentos." />
        </div>
      </section>

      <section className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Pronto para conectar pacientes e profissionais?</h2>
        <p className="text-gray-600 max-w-2xl mx-auto mb-6">
          Comece grátis. Acesse dados autorizados sem cobrança. Ative o Pro quando quiser usar a área comercial.
        </p>
        <Link href="/register" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700">
          Criar conta profissional
          <ArrowRight className="w-5 h-5" />
        </Link>
      </section>
    </div>
  )
}

function HeroStat({ value, label }: any) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
      <p className="font-bold text-white">{value}</p>
      <p className="text-xs text-white/60">{label}</p>
    </div>
  )
}

function MiniMetric({ label, value }: any) {
  return (
    <div className="rounded-2xl bg-gray-50 border p-3">
      <p className="text-2xl font-bold text-emerald-700">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function CockpitRow({ icon: Icon, title, text }: any) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-gray-50 p-3">
      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-gray-500">{text}</p>
      </div>
    </div>
  )
}

function AreaCard({ icon: Icon, title, text }: any) {
  return (
    <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6">
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{text}</p>
    </div>
  )
}

function PlanBlock({ badge, title, price, description, items, cta, href, featured }: any) {
  return (
    <div className={`rounded-[2rem] border p-6 md:p-8 shadow-sm ${featured ? 'bg-emerald-950 text-white border-emerald-800' : 'bg-white border-gray-100'}`}>
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold mb-4 ${featured ? 'bg-white/10 text-emerald-100' : 'bg-emerald-50 text-emerald-700'}`}>{badge}</span>
      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <p className={`text-4xl font-bold mb-3 ${featured ? 'text-white' : 'text-gray-900'}`}>{price}</p>
      <p className={`mb-6 ${featured ? 'text-emerald-50/75' : 'text-gray-600'}`}>{description}</p>
      <div className="space-y-3 mb-6">
        {items.map((item: string) => (
          <div key={item} className="flex items-start gap-2 text-sm">
            <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${featured ? 'text-emerald-200' : 'text-emerald-600'}`} />
            <span className={featured ? 'text-emerald-50/90' : 'text-gray-600'}>{item}</span>
          </div>
        ))}
      </div>
      <Link href={href} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold ${featured ? 'bg-white text-emerald-900 hover:bg-emerald-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
        {cta}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

function TechStep({ icon: Icon, title, text }: any) {
  return (
    <div className="rounded-3xl bg-white border border-gray-100 p-5 shadow-sm">
      <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
    </div>
  )
}

function Check({ text }: any) {
  return (
    <div className="flex items-start gap-2 text-sm text-gray-700">
      <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </div>
  )
}

function FlowItem({ number, text }: any) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/10 border border-white/10 p-3">
      <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">{number}</div>
      <p className="text-sm text-white/85">{text}</p>
    </div>
  )
}

function PricingPillar({ icon: Icon, title, price, text }: any) {
  return (
    <div className="rounded-3xl bg-white/10 border border-white/10 p-6">
      <Icon className="w-7 h-7 text-emerald-200 mb-4" />
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-3xl font-bold mt-2">{price}</p>
      <p className="text-sm text-white/65 mt-3">{text}</p>
    </div>
  )
}
