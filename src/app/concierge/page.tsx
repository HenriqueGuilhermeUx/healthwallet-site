import type { Metadata } from 'next'
import {
  CTA,
  FeatureGrid,
  Hero,
  PublicFooter,
  PublicHeader,
  SectionIntro,
  Steps,
  icons,
} from '@/components/PublicLaunchPages'

export const metadata: Metadata = {
  title: 'Concierge | MyDataMed',
  description: 'Acompanhamento humano para organizar solicitações, retornos e próximos passos do cuidado, com consentimento e profissionais de referência.',
}

const conciergeFeatures = [
  {
    icon: icons.Users,
    title: 'Enfermeiro de referência',
    text: 'Um ponto humano de acompanhamento para ajudar a organizar solicitações, retornos e a continuidade da jornada.',
  },
  {
    icon: icons.Stethoscope,
    title: 'Médico de referência',
    text: 'Quando a situação exigir avaliação médica, o caso pode ser escalonado para um profissional habilitado.',
  },
  {
    icon: icons.ShieldCheck,
    title: 'Consentimento e controle',
    text: 'O contexto de saúde continua no HealthWallet e só é utilizado dentro das autorizações e regras de acesso aplicáveis.',
  },
  {
    icon: icons.MessageCircle,
    title: 'Continuidade do cuidado',
    text: 'Ajuda a reduzir perda de contexto entre solicitações, orientações, retornos e próximos passos.',
  },
  {
    icon: icons.ClipboardList,
    title: 'Coordenação organizada',
    text: 'Solicitações e pendências podem seguir um fluxo mais claro, com acompanhamento humano e registro operacional.',
  },
  {
    icon: icons.HeartPulse,
    title: 'HealthWallet no centro',
    text: 'O Concierge não cria um prontuário paralelo: ele se conecta à jornada mantendo o HealthWallet como base do paciente.',
  },
]

function ConciergeJourney() {
  return (
    <div className="rounded-[2rem] bg-white p-5 text-gray-900 shadow-2xl border border-white/20">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white">
        <p className="text-sm text-white/70">MyDataMed Concierge</p>
        <h3 className="mt-1 text-2xl font-bold">Uma equipe conectada à jornada</h3>
        <p className="mt-3 text-sm text-white/80">Acompanhamento humano quando organizar sozinho já não é suficiente.</p>
      </div>

      <div className="mt-4 space-y-3">
        {[
          ['1', 'HealthWallet', 'Seus dados e sua história de saúde continuam no centro.'],
          ['2', 'Enfermeiro de referência', 'Acompanha solicitações, retornos e próximos passos.'],
          ['3', 'Médico de referência', 'É acionado quando houver necessidade de avaliação médica.'],
          ['4', 'Especialista ou parceiro', 'Pode entrar no fluxo quando o cuidado exigir outro nível de atenção.'],
        ].map(([step, title, text]) => (
          <div key={step} className="flex gap-3 rounded-2xl border bg-gray-50 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 font-bold text-white">{step}</div>
            <div>
              <p className="font-bold text-gray-900">{title}</p>
              <p className="mt-1 text-sm text-gray-600">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ConciergePage() {
  return (
    <main className="min-h-screen bg-white">
      <PublicHeader />

      <Hero
        eyebrow="MyDataMed Concierge"
        title="Cuidado acompanhado, sem tirar o HealthWallet do centro."
        subtitle="O Concierge conecta sua carteira de saúde a uma equipe de referência para ajudar a organizar solicitações, retornos e próximos passos. A enfermagem acompanha a jornada e o médico de referência é acionado quando necessário."
        primaryHref="/healthwallet"
        primaryLabel="Conhecer HealthWallet"
        secondaryHref="https://concierge.mydatamed.com/concierge"
        secondaryLabel="Acessar Concierge"
      >
        <ConciergeJourney />
      </Hero>

      <SectionIntro
        eyebrow="Acompanhamento humano"
        title="Entre ter informação e conseguir coordenar o cuidado existe uma distância."
        text="O HealthWallet organiza a história do paciente. O Concierge acrescenta acompanhamento humano para ajudar a transformar solicitações, retornos e pendências em uma jornada mais coordenada."
      />
      <FeatureGrid features={conciergeFeatures} />

      <SectionIntro
        eyebrow="Como funciona"
        title="Uma jornada simples, com escalonamento quando necessário."
        text="O Concierge foi desenhado para apoiar a continuidade do cuidado sem substituir a autonomia do paciente nem a responsabilidade clínica dos profissionais."
      />
      <Steps items={[
        {
          title: 'Organize e autorize',
          text: 'O paciente mantém suas informações no HealthWallet e autoriza o uso do contexto necessário para o acompanhamento.',
        },
        {
          title: 'A enfermagem acompanha',
          text: 'O enfermeiro de referência ajuda a organizar solicitações, retornos, pendências e próximos passos da jornada.',
        },
        {
          title: 'Escalone quando necessário',
          text: 'Quando houver necessidade de avaliação clínica, o médico de referência é acionado e pode orientar o próximo nível de cuidado.',
        },
      ]} />

      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-7 md:p-9">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 border border-amber-200">
              <icons.ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Limites claros fazem parte do cuidado seguro.</h2>
              <p className="mt-3 leading-relaxed text-gray-700">O Concierge não substitui serviços de urgência ou emergência. Decisões clínicas são tomadas por profissionais habilitados. Tecnologia e inteligência artificial podem apoiar organização e contexto, mas não atuam como autoridade clínica autônoma.</p>
            </div>
          </div>
        </div>
      </section>

      <CTA
        title="HealthWallet guarda sua história. Concierge ajuda a conectar os próximos passos."
        text="Conheça a carteira digital de saúde que permanece no centro da experiência do paciente e da família."
        href="/healthwallet"
        label="Conhecer HealthWallet"
      />

      <PublicFooter />
    </main>
  )
}
