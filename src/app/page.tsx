'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import {
  CTA,
  FeatureCard,
  Hero,
  ProductCard,
  PublicFooter,
  PublicHeader,
  SectionIntro,
  icons,
} from '@/components/PublicLaunchPages'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.push('/dashboard')
  }, [user, loading, router])

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" /></div>
  }

  return (
    <main className="min-h-screen bg-white">
      <PublicHeader />
      <Hero
        eyebrow="MyDataMed + HealthWallet"
        title="Consultório digital para profissionais. Carteira de saúde para pacientes."
        subtitle="Um ecossistema brasileiro para organizar atendimento, dados autorizados, agenda, recepção por QR Code, prontuário eletrônico, IA assistiva, cobranças, recibos, backoffice e continuidade do cuidado."
        primaryHref="/mydatamed"
        primaryLabel="Conhecer MyDataMed"
        secondaryHref="/healthwallet"
        secondaryLabel="Conhecer HealthWallet"
      >
        <ProductCard />
      </Hero>

      <SectionIntro
        eyebrow="Lançamento"
        title="Duas portas de entrada. Uma jornada conectada."
        text="O MyDataMed organiza a operação do profissional e da clínica. O HealthWallet ajuda o paciente e a família a organizarem dados de saúde e compartilharem informações com consentimento."
      />

      <section className="max-w-7xl mx-auto px-4 pb-16 grid lg:grid-cols-2 gap-5">
        <div className="rounded-[2rem] bg-slate-950 text-white p-8 md:p-10">
          <icons.Stethoscope className="w-10 h-10 text-emerald-300 mb-5" />
          <h2 className="text-3xl font-bold">MyDataMed</h2>
          <p className="text-white/70 mt-4 text-lg">Consultório digital e backoffice para médicos, profissionais de saúde e clínicas atenderem, documentarem, cobrarem e acompanharem pacientes.</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            {['Agenda', 'Recepção por QR Code', 'Prontuário eletrônico', 'Cobranças e recibos'].map((item) => <div key={item} className="rounded-2xl bg-white/10 border border-white/10 p-3 text-sm">{item}</div>)}
          </div>
          <Link href="/mydatamed" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white hover:bg-emerald-600">Ver MyDataMed <icons.ArrowRight className="w-4 h-4" /></Link>
        </div>

        <div className="rounded-[2rem] bg-emerald-50 border border-emerald-100 p-8 md:p-10">
          <icons.WalletCards className="w-10 h-10 text-emerald-700 mb-5" />
          <h2 className="text-3xl font-bold text-gray-900">HealthWallet</h2>
          <p className="text-gray-600 mt-4 text-lg">Carteira digital para pacientes e famílias organizarem dados, documentos, exames, medicamentos e compartilharem informações com consentimento.</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            {['Dados de saúde', 'Documentos e exames', 'Família', 'Compartilhamento autorizado'].map((item) => <div key={item} className="rounded-2xl bg-white border border-emerald-100 p-3 text-sm text-gray-700">{item}</div>)}
          </div>
          <Link href="/healthwallet" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800">Ver HealthWallet <icons.ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-8 md:p-10">
          <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-800">
                <icons.HeartPulse className="w-4 h-4" /> MyDataMed Concierge
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight mt-5">Sua saúde organizada. E, quando precisar, acompanhada.</h2>
              <p className="text-gray-600 mt-5 text-lg max-w-3xl">O HealthWallet continua sendo onde a saúde do paciente mora. O Concierge acrescenta acompanhamento humano para ajudar a organizar solicitações, retornos e próximos passos — com enfermagem de referência e escalonamento médico quando necessário.</p>
              <div className="flex flex-col sm:flex-row gap-3 mt-7">
                <Link href="/concierge" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">
                  Conhecer Concierge <icons.ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/healthwallet" className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-5 py-3 font-semibold text-emerald-800 hover:bg-emerald-50">
                  Ver HealthWallet
                </Link>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: icons.Users, title: 'Enfermeiro de referência', text: 'Um ponto humano para acompanhar solicitações, retornos e continuidade.' },
                { icon: icons.Stethoscope, title: 'Médico de referência', text: 'É acionado quando houver necessidade de avaliação médica.' },
                { icon: icons.ShieldCheck, title: 'Com consentimento', text: 'O HealthWallet permanece no centro e o contexto é acessado de forma autorizada.' },
                { icon: icons.MessageCircle, title: 'Próximos passos', text: 'Mais organização para transformar pendências em uma jornada coordenada.' },
              ].map((item) => <div key={item.title} className="rounded-3xl bg-white border border-emerald-100 p-5 shadow-sm"><item.icon className="w-7 h-7 text-emerald-700 mb-4" /><h3 className="font-bold text-gray-900">{item.title}</h3><p className="text-sm text-gray-600 mt-2">{item.text}</p></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <p className="text-emerald-700 font-bold text-sm uppercase tracking-wide mb-3">Escolha seu caminho</p>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900">Páginas claras para cada público.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <FeatureCard icon={icons.Stethoscope} title="Para médicos" text="Consultório digital para começar ou migrar operação com agenda, atendimento, prontuário, cobrança e MODO." />
            <FeatureCard icon={icons.Users} title="Para clínicas" text="Recepção digital, fila, equipe, agenda, backoffice, financeiro e prontuário para operação clínica." />
            <FeatureCard icon={icons.HeartPulse} title="Para pacientes" text="HealthWallet para organizar informações de saúde e compartilhar dados com consentimento." />
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
            <Link href="/para-medicos" className="rounded-xl bg-slate-950 text-white px-5 py-3 font-semibold text-center">Médicos</Link>
            <Link href="/para-clinicas" className="rounded-xl bg-slate-950 text-white px-5 py-3 font-semibold text-center">Clínicas</Link>
            <Link href="/para-pacientes" className="rounded-xl bg-slate-950 text-white px-5 py-3 font-semibold text-center">Pacientes</Link>
          </div>
        </div>
      </section>

      <CTA
        title="Pronto para publicar, divulgar e testar com pilotos."
        text="Use as páginas públicas para explicar o ecossistema, captar médicos, clínicas e pacientes, e transformar a narrativa em campanha de mídia."
        href="/register"
        label="Criar conta profissional"
      />
      <PublicFooter />
    </main>
  )
}
