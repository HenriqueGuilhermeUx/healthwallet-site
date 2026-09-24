import Link from 'next/link'
import {
  CTA,
  FeatureGrid,
  Hero,
  PublicFooter,
  PublicHeader,
  SectionIntro,
  Steps,
  hwFeatures,
  icons,
} from '@/components/PublicLaunchPages'

function WalletMockup() {
  return (
    <div className="rounded-[2rem] bg-white text-gray-900 p-5 shadow-2xl">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 mb-4">
        <p className="text-white/70 text-sm">HealthWallet</p>
        <h3 className="text-2xl font-bold mt-1">Minha carteira de saúde</h3>
        <p className="text-white/80 mt-3 text-sm">Dados, documentos e compartilhamentos organizados com consentimento.</p>
      </div>
      <div className="space-y-3">
        {[
          ['Exames e documentos', 'Organizados para consulta e retorno'],
          ['Medicamentos e lembretes', 'Acompanhamento da rotina de cuidado'],
          ['Compartilhamento autorizado', 'Você decide o que enviar'],
          ['Check-in na clínica', 'Menos formulário e papelada'],
        ].map(([title, text]) => <div key={title} className="rounded-2xl border bg-gray-50 p-4"><p className="font-bold">{title}</p><p className="text-sm text-gray-500">{text}</p></div>)}
      </div>
    </div>
  )
}

export default function HealthWalletPage() {
  return (
    <main className="min-h-screen bg-white">
      <PublicHeader />
      <Hero
        eyebrow="HealthWallet"
        title="Sua carteira digital de saúde."
        subtitle="Um lugar para organizar dados, documentos, exames, medicamentos e informações importantes — e compartilhar com profissionais e clínicas quando você autorizar."
        primaryHref="/para-pacientes"
        primaryLabel="Ver para pacientes"
        secondaryHref="/mydatamed"
        secondaryLabel="Conhecer MyDataMed"
      >
        <WalletMockup />
      </Hero>

      <SectionIntro
        eyebrow="Paciente e família"
        title="Dados de saúde precisam estar com quem vive a jornada: o paciente."
        text="O HealthWallet ajuda o paciente e sua família a organizarem informações relevantes para consultas, retornos, documentos, medicações e compartilhamentos autorizados."
      />
      <FeatureGrid features={hwFeatures} />

      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-7 md:p-10">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-800">
                <icons.HeartPulse className="w-4 h-4" /> MyDataMed Concierge
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight mt-5">Sua saúde organizada. E, quando precisar, acompanhada.</h2>
              <p className="text-gray-600 mt-5 text-lg max-w-3xl">O Concierge é a camada de acompanhamento humano do ecossistema MyDataMed. Ele conecta o HealthWallet a uma equipe de referência para ajudar a coordenar solicitações, retornos e próximos passos do cuidado, sempre com consentimento.</p>
              <div className="flex flex-wrap gap-3 mt-7">
                <Link href="/concierge" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">
                  Conhecer Concierge <icons.ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/healthwallet" className="inline-flex items-center rounded-xl border border-emerald-200 bg-white px-5 py-3 font-semibold text-emerald-800 hover:bg-emerald-50">
                  HealthWallet continua no centro
                </Link>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: icons.Users, title: 'Equipe de referência', text: 'Um ponto humano de acompanhamento para a jornada de cuidado.' },
                { icon: icons.MessageCircle, title: 'Continuidade', text: 'Solicitações, retornos e próximos passos mais organizados.' },
                { icon: icons.ShieldCheck, title: 'Com consentimento', text: 'O acesso ao contexto acontece de forma autorizada e controlada.' },
                { icon: icons.Stethoscope, title: 'Escalonamento humano', text: 'A enfermagem acompanha e o médico de referência é acionado quando necessário.' },
              ].map((item) => <div key={item.title} className="rounded-3xl bg-white border border-emerald-100 p-5 shadow-sm"><item.icon className="w-7 h-7 text-emerald-700 mb-4" /><h3 className="font-bold text-gray-900">{item.title}</h3><p className="text-sm text-gray-600 mt-2">{item.text}</p></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-emerald-700 font-bold text-sm uppercase tracking-wide mb-3">Conexão com o cuidado</p>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight">Quando o paciente compartilha melhor, o atendimento começa melhor.</h2>
            <p className="text-gray-600 mt-5 text-lg">Com o MyDataMed, profissionais e clínicas podem receber dados autorizados do HealthWallet para reduzir retrabalho cadastral, organizar o pré-atendimento e iniciar a consulta com mais contexto.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: icons.ShieldCheck, title: 'Consentimento', text: 'Compartilhe apenas quando quiser.' },
              { icon: icons.ClipboardList, title: 'Organização', text: 'Menos dados espalhados.' },
              { icon: icons.MonitorSmartphone, title: 'Entrada rápida', text: 'Check-in pelo celular.' },
              { icon: icons.HeartPulse, title: 'Família', text: 'Cuidado mais acompanhado.' },
            ].map((item) => <div key={item.title} className="rounded-3xl bg-white border p-5"><item.icon className="w-7 h-7 text-emerald-700 mb-4" /><h3 className="font-bold text-gray-900">{item.title}</h3><p className="text-sm text-gray-600 mt-2">{item.text}</p></div>)}
          </div>
        </div>
      </section>

      <SectionIntro
        eyebrow="Como funciona"
        title="Organizar, autorizar e usar quando precisar."
        text="O HealthWallet foi pensado para simplificar a vida do paciente e criar uma ponte segura com profissionais de saúde."
      />
      <Steps items={[
        { title: 'Guarde seus dados', text: 'Organize documentos, exames, medicamentos e informações importantes em uma carteira digital.' },
        { title: 'Compartilhe com consentimento', text: 'Autorize o acesso quando for se consultar, fazer check-in ou enviar dados para uma clínica.' },
        { title: 'Acompanhe a jornada', text: 'Mantenha histórico, retornos, orientações e documentos mais acessíveis para você e sua família.' },
      ]} />

      <CTA
        title="HealthWallet conecta o paciente à jornada de cuidado."
        text="Use a carteira digital para organizar informações de saúde e facilitar atendimentos quando houver compartilhamento autorizado."
        href="/para-pacientes"
        label="Conhecer experiência do paciente"
      />
      <PublicFooter />
    </main>
  )
}
