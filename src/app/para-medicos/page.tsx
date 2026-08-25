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

const doctorFeatures = [
  { icon: icons.Globe2, title: 'Página profissional pronta', text: 'Divulgue especialidade, serviços, agenda, WhatsApp, bio links e pacotes em uma página clara.' },
  { icon: icons.CalendarDays, title: 'Agenda e recebimento', text: 'Crie consultas, retornos, valores, contas a receber e recibos sem depender de planilhas.' },
  { icon: icons.MonitorSmartphone, title: 'Recepção digital', text: 'Paciente faz check-in por QR Code e a entrada chega organizada para conferência.' },
  { icon: icons.Stethoscope, title: 'Consulta assistida', text: 'Use IA assistiva para organizar transcrição, resumo, SOAP e pontos de atenção supervisionados.' },
  { icon: icons.FileText, title: 'Prontuário eletrônico', text: 'Registre, revise, imprima e acompanhe atendimentos com status e histórico do paciente.' },
  { icon: icons.Sparkles, title: 'MODO para crescer', text: 'Crie mensagens, orientações, posts, conteúdos educativos e materiais operacionais com créditos do plano.' },
]

export default function ParaMedicosPage() {
  return (
    <main className="min-h-screen bg-white">
      <PublicHeader />
      <Hero
        eyebrow="Para médicos"
        title="Seu consultório digital pronto para atender, cobrar e documentar."
        subtitle="O MyDataMed ajuda médicos em início de carreira, consultórios autônomos e profissionais em migração digital a operarem com página, agenda, pré-atendimento, prontuário, IA assistiva, cobranças, recibos e backoffice."
        primaryHref="/register"
        primaryLabel="Criar meu consultório"
        secondaryHref="/planos"
        secondaryLabel="Ver planos"
      />

      <SectionIntro
        eyebrow="Dor real"
        title="Formar-se é uma etapa. Começar a atender com estrutura é outra."
        text="Muitos médicos precisam montar presença digital, organizar agenda, receber pacientes, cobrar, emitir recibos, documentar consulta e acompanhar retornos — tudo ao mesmo tempo. O MyDataMed entrega essa base em um só lugar."
      />
      <FeatureGrid features={doctorFeatures} />

      <section className="bg-slate-950 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-3 gap-4">
          {[
            { title: 'Start', price: 'R$ 129/mês', text: '100 atendimentos assistidos para começar com consultório digital, agenda, página, IA e backoffice.' },
            { title: 'Pro', price: 'R$ 199/mês', text: '200 atendimentos assistidos, MODO, CRM mais completo, automações e apoio para crescer.' },
            { title: 'Clinic', price: 'R$ 399/mês', text: '400 atendimentos assistidos, equipe, recepção digital e operação para clínica ou grupo.' },
          ].map((plan) => (
            <div key={plan.title} className="rounded-3xl bg-white/10 border border-white/10 p-6">
              <p className="text-emerald-300 font-bold text-xl">{plan.title}</p>
              <h3 className="text-3xl font-bold mt-2">{plan.price}</h3>
              <p className="text-white/70 mt-4">{plan.text}</p>
            </div>
          ))}
        </div>
      </section>

      <SectionIntro
        eyebrow="Jornada"
        title="Do cadastro ao prontuário em poucos passos."
        text="A experiência foi desenhada para médicos que querem começar rápido, sem perder controle sobre documentação, responsabilidade profissional e operação financeira."
      />
      <Steps items={[
        { title: 'Crie sua estrutura', text: 'Escolha plano, complete cadastro, monte página pública, biolink, serviços e dados comerciais.' },
        { title: 'Receba pacientes', text: 'Agende, cobre, envie pré-atendimento e receba o paciente por QR Code quando fizer sentido.' },
        { title: 'Atenda e documente', text: 'Use consulta assistida, revise o prontuário, gere recibo e acompanhe retorno.' },
      ]} />

      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="rounded-[2rem] bg-amber-50 border border-amber-100 p-6 md:p-8 flex gap-4">
          <icons.ShieldCheck className="w-8 h-8 text-amber-700 flex-shrink-0" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">IA assistiva, não substitutiva.</h2>
            <p className="text-gray-700 mt-2">A IA do MyDataMed é apoio operacional e documental. O médico revisa, edita, valida, assina e assume a decisão final dentro do seu escopo profissional.</p>
          </div>
        </div>
      </section>

      <CTA
        title="Comece com estrutura profissional."
        text="Monte sua presença, organize agenda, atenda, cobre, documente e acompanhe pacientes com o MyDataMed."
        href="/register"
        label="Criar conta agora"
      />
      <PublicFooter />
    </main>
  )
}
