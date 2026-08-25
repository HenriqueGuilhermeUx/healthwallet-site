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

function PatientCard() {
  return (
    <div className="rounded-[2rem] bg-white text-gray-900 p-5 shadow-2xl">
      <div className="rounded-3xl bg-emerald-50 border border-emerald-100 p-5 mb-4">
        <p className="text-emerald-700 font-bold text-sm">Paciente e família</p>
        <h3 className="text-2xl font-bold mt-2">Menos informação perdida na hora de cuidar.</h3>
        <p className="text-gray-600 mt-3">Organize dados de saúde e compartilhe com consentimento quando precisar.</p>
      </div>
      <div className="space-y-3">
        {[
          ['Antes da consulta', 'Dados e documentos organizados'],
          ['Na chegada', 'Check-in e pré-atendimento pelo celular'],
          ['Durante o cuidado', 'Profissional recebe contexto autorizado'],
          ['Depois', 'Histórico, orientações e retornos mais acessíveis'],
        ].map(([title, text]) => <div key={title} className="flex items-start gap-3 rounded-2xl border bg-gray-50 p-4"><icons.CheckCircle className="w-5 h-5 text-emerald-700 mt-0.5" /><div><p className="font-bold">{title}</p><p className="text-sm text-gray-500">{text}</p></div></div>)}
      </div>
    </div>
  )
}

export default function ParaPacientesPage() {
  return (
    <main className="min-h-screen bg-white">
      <PublicHeader />
      <Hero
        eyebrow="Para pacientes"
        title="Organize sua saúde e compartilhe informações quando autorizar."
        subtitle="O HealthWallet é a carteira digital para pacientes e famílias guardarem dados, documentos, exames e informações importantes, facilitando check-in, consultas e continuidade do cuidado."
        primaryHref="/healthwallet"
        primaryLabel="Conhecer HealthWallet"
        secondaryHref="/mydatamed"
        secondaryLabel="Ver MyDataMed"
      >
        <PatientCard />
      </Hero>

      <SectionIntro
        eyebrow="Controle do paciente"
        title="A informação de saúde deve acompanhar a pessoa."
        text="O paciente não deveria depender de papéis, prints soltos, mensagens antigas e lembrança de cabeça. O HealthWallet ajuda a organizar a jornada e compartilhar dados com profissionais quando houver autorização."
      />
      <FeatureGrid features={hwFeatures} />

      <section className="bg-slate-950 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-[1fr_0.9fr] gap-8 items-center">
          <div>
            <p className="text-emerald-300 font-bold text-sm uppercase tracking-wide mb-3">Consentimento</p>
            <h2 className="text-3xl md:text-5xl font-bold leading-tight">Você decide o que compartilhar.</h2>
            <p className="text-white/65 mt-5 text-lg">O HealthWallet foi pensado para apoiar a organização e o compartilhamento autorizado. Profissionais e clínicas acessam dados quando o paciente permite, e o MyDataMed usa isso para melhorar a entrada e o atendimento.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: icons.LockKeyhole, title: 'Privacidade', text: 'Dados sensíveis exigem cuidado e autorização.' },
              { icon: icons.ShieldCheck, title: 'Consentimento', text: 'Compartilhamento controlado pelo paciente.' },
              { icon: icons.ClipboardList, title: 'Organização', text: 'Informações importantes menos espalhadas.' },
              { icon: icons.MonitorSmartphone, title: 'Praticidade', text: 'Check-in e pré-atendimento pelo celular.' },
            ].map((item) => <div key={item.title} className="rounded-3xl bg-white/10 border border-white/10 p-5"><item.icon className="w-7 h-7 text-emerald-300 mb-4" /><h3 className="font-bold">{item.title}</h3><p className="text-sm text-white/65 mt-2">{item.text}</p></div>)}
          </div>
        </div>
      </section>

      <SectionIntro
        eyebrow="Como usar"
        title="Uma jornada simples para consultas e acompanhamento."
        text="A carteira digital ajuda antes, durante e depois do atendimento."
      />
      <Steps items={[
        { title: 'Organize seus dados', text: 'Cadastre informações relevantes, documentos, exames, medicamentos e dados da família.' },
        { title: 'Compartilhe quando precisar', text: 'Autorize dados para uma clínica ou profissional no momento de check-in, pré-atendimento ou consulta.' },
        { title: 'Acompanhe melhor', text: 'Tenha histórico, documentos e orientações mais acessíveis para retornos e continuidade do cuidado.' },
      ]} />

      <CTA
        title="Saúde mais organizada começa com o paciente."
        text="Com HealthWallet, seus dados ficam mais fáceis de encontrar e compartilhar com consentimento quando você precisar de cuidado."
        href="/healthwallet"
        label="Conhecer HealthWallet"
      />
      <PublicFooter />
    </main>
  )
}
