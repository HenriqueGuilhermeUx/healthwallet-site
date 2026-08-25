'use client'

import Link from 'next/link'
import { ArrowRight, BadgeCheck, Building2, CheckCircle, HeartPulse, Sparkles, Stethoscope, Users, Zap } from 'lucide-react'

const plans = [
  {
    code: 'free',
    name: 'Free Dados',
    price: 'R$ 0',
    visits: 'Acesso a dados autorizados',
    description: 'Para entrar na rede MyDataMed e acessar dados que o paciente decide compartilhar.',
    icon: HeartPulse,
    cta: 'Cadastrar grátis',
    href: '/register',
    features: ['Cadastro profissional', 'Acesso a dados autorizados pelo paciente', 'Visualização de documentos compartilhados', 'Perfil básico'],
  },
  {
    code: 'start',
    name: 'Start',
    price: 'R$ 129/mês',
    visits: '100 atendimentos assistidos/mês',
    description: 'Para começar com consultório digital, página profissional, agenda, IA, cobrança e financeiro básico.',
    icon: Stethoscope,
    cta: 'Começar no Start',
    href: '/register?plan=start',
    features: ['Landing page e bio link', 'Agenda e pré-atendimento', 'Anamnese e IA assistiva', 'Serviços e pacotes', 'Cobranças diretas ou pela plataforma', 'Contas a pagar e receber', 'CRM básico'],
  },
  {
    code: 'pro',
    name: 'Pro',
    price: 'R$ 199/mês',
    visits: '200 atendimentos assistidos/mês',
    description: 'Para operar melhor, automatizar relacionamento e usar MODO como assistente de produtividade.',
    icon: Zap,
    cta: 'Ir para o Pro',
    href: '/register?plan=pro',
    featured: true,
    features: ['Tudo do Start', 'MODO incluída com franquia', 'CRM completo', 'Automações de retorno', 'Transcrição/resumo avançado', 'Fluxo de caixa e relatórios', '1 assistente/secretária'],
  },
  {
    code: 'clinic',
    name: 'Clinic',
    price: 'R$ 399/mês',
    visits: '400 atendimentos assistidos/mês',
    description: 'Para clínicas e equipes com recepção digital, fila, múltiplos profissionais e operação gerencial.',
    icon: Building2,
    cta: 'Conhecer Clinic',
    href: '/register?plan=clinic',
    features: ['Recepção digital por QR Code', 'Múltiplos profissionais', 'Permissões por função', 'Financeiro por equipe/unidade', 'Repasses', 'Dashboards gerenciais', 'MODO para equipe'],
  },
]

export default function PlanosPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-10 space-y-12">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-8 md:p-14">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-6">
            <Sparkles className="w-4 h-4" /> MyDataMed Consultório Digital
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">Planos por volume de atendimentos, com backoffice desde o começo.</h1>
          <p className="text-white/75 text-lg md:text-xl mt-5">
            Todos os planos pagos nascem com agenda, página profissional, bio link, IA assistiva, CRM, pacotes, cobrança, contas a pagar/receber e backoffice. A diferença está no volume, automação, MODO e operação de equipe.
          </p>
        </div>
      </section>

      <section className="grid lg:grid-cols-4 gap-5">
        {plans.map((plan) => <PlanCard key={plan.code} plan={plan} />)}
      </section>

      <section className="grid lg:grid-cols-3 gap-5">
        <InfoCard title="Start" text="Começar a atender com aparência profissional, página própria, agenda, IA e financeiro essencial." />
        <InfoCard title="Pro" text="Operar e crescer: mais atendimentos, MODO, CRM completo, automações, relatórios e assistente." />
        <InfoCard title="Clinic" text="Gerir equipe, recepção digital, fila, múltiplos profissionais, permissões, repasses e controle gerencial." />
      </section>

      <section className="rounded-[2rem] bg-emerald-50 border border-emerald-100 p-8 md:p-10 grid md:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-emerald-950">Acesso a dados continua grátis.</h2>
          <p className="text-emerald-900/75 mt-2">
            Monetização acontece quando o profissional quer operar consultório digital: atender, cobrar, documentar, automatizar e crescer.
          </p>
        </div>
        <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-4 text-white font-semibold hover:bg-emerald-800">
          Criar conta <ArrowRight className="w-5 h-5" />
        </Link>
      </section>
    </main>
  )
}

function PlanCard({ plan }: any) {
  const Icon = plan.icon
  return (
    <article className={`rounded-[2rem] border p-6 shadow-sm ${plan.featured ? 'bg-slate-950 text-white border-slate-900 scale-[1.02]' : 'bg-white border-gray-100'}`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${plan.featured ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-50 text-emerald-700'}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold">{plan.name}</h2>
        {plan.featured && <BadgeCheck className="w-5 h-5 text-emerald-300" />}
      </div>
      <p className="text-3xl font-bold mt-3">{plan.price}</p>
      <p className={`font-semibold mt-2 ${plan.featured ? 'text-emerald-200' : 'text-emerald-700'}`}>{plan.visits}</p>
      <p className={`text-sm mt-3 min-h-[72px] ${plan.featured ? 'text-white/65' : 'text-gray-600'}`}>{plan.description}</p>
      <div className="space-y-2 mt-5 mb-6">
        {plan.features.map((feature: string) => (
          <div key={feature} className="flex items-start gap-2 text-sm">
            <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.featured ? 'text-emerald-300' : 'text-emerald-600'}`} />
            <span className={plan.featured ? 'text-white/80' : 'text-gray-700'}>{feature}</span>
          </div>
        ))}
      </div>
      <Link href={plan.href} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold ${plan.featured ? 'bg-white text-slate-950 hover:bg-emerald-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
        {plan.cta} <ArrowRight className="w-4 h-4" />
      </Link>
    </article>
  )
}

function InfoCard({ title, text }: any) {
  return <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm"><Users className="w-7 h-7 text-emerald-700 mb-4" /><h3 className="font-bold text-gray-900 text-xl">{title}</h3><p className="text-gray-600 mt-2 text-sm leading-relaxed">{text}</p></div>
}
