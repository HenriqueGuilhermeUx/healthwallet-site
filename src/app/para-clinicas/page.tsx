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

const clinicFeatures = [
  { icon: icons.QrCode, title: 'Recepção por QR Code', text: 'Paciente preenche dados no próprio celular e entra na fila digital para conferência.' },
  { icon: icons.ClipboardCheck, title: 'Entrada do paciente', text: 'Dados cadastrais, contato, motivo, plano/carteirinha e pendências organizadas na recepção.' },
  { icon: icons.Users, title: 'Operação de equipe', text: 'Estrutura para múltiplos profissionais, assistentes, recepção e controles por função.' },
  { icon: icons.CalendarDays, title: 'Agenda por profissional', text: 'Consultas, retornos, teleatendimento, status e pagamentos conectados ao financeiro.' },
  { icon: icons.Banknote, title: 'Financeiro e backoffice', text: 'Contas a receber, contas a pagar, recibos, repasses e visão do fluxo operacional.' },
  { icon: icons.MessageCircle, title: 'CRM e continuidade', text: 'Confirmações, retornos, pacientes inativos, orientações e relacionamento pós-atendimento.' },
]

function ClinicFlow() {
  return (
    <div className="rounded-[2rem] bg-white text-gray-900 p-5 shadow-2xl border border-white/20">
      <div className="rounded-3xl bg-slate-950 text-white p-5 mb-4">
        <p className="text-white/60 text-sm">Fluxo de recepção</p>
        <h3 className="text-2xl font-bold mt-1">Paciente faz o check-in. A equipe confere.</h3>
      </div>
      <div className="space-y-3">
        {[
          ['QR Code na recepção', 'Paciente abre o pré-atendimento no celular'],
          ['Dados entram na fila', 'Recepção vê pendências e status'],
          ['Profissional inicia consulta', 'Atendimento começa com contexto organizado'],
          ['Financeiro acompanha', 'Cobrança, recibo e status em um só lugar'],
        ].map(([title, text]) => <div key={title} className="rounded-2xl border bg-gray-50 p-4"><p className="font-bold">{title}</p><p className="text-sm text-gray-500">{text}</p></div>)}
      </div>
    </div>
  )
}

export default function ParaClinicasPage() {
  return (
    <main className="min-h-screen bg-white">
      <PublicHeader />
      <Hero
        eyebrow="Para clínicas"
        title="Digitalize a entrada, o atendimento e o backoffice da sua clínica."
        subtitle="O MyDataMed ajuda clínicas a reduzir papelada, retrabalho e digitação na recepção, conectando agenda, QR Code, pré-atendimento, prontuário, cobranças, recibos, equipe e financeiro."
        primaryHref="/register"
        primaryLabel="Começar como clínica"
        secondaryHref="/recepcao-digital"
        secondaryLabel="Ver recepção digital"
      >
        <ClinicFlow />
      </Hero>

      <SectionIntro
        eyebrow="Operação"
        title="A clínica precisa de menos improviso e mais fluxo."
        text="Recepção, profissionais, financeiro e pacientes não podem depender de formulários soltos, mensagens perdidas e retrabalho manual. O MyDataMed cria uma jornada digital simples para a clínica operar melhor."
      />
      <FeatureGrid features={clinicFeatures} />

      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-emerald-700 font-bold text-sm uppercase tracking-wide mb-3">Recepção inteligente</p>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight">O primeiro gargalo da clínica é a entrada do paciente.</h2>
            <p className="text-gray-600 mt-5 text-lg">Quando o paciente chega sem dados organizados, a recepção digita, confere, pergunta, procura documento e atrasa o início do atendimento. Com QR Code e pré-atendimento, a equipe passa a atuar mais como conferência e menos como digitação.</p>
          </div>
          <div className="rounded-[2rem] bg-white border shadow-sm p-6 space-y-3">
            {[
              'Check-in por QR Code na recepção',
              'Pré-atendimento antes da consulta',
              'Fila digital com status e pendências',
              'Dados administrativos e clínicos iniciais separados',
              'Atendimento assistido e prontuário eletrônico',
              'Financeiro e recibo conectados ao fluxo',
            ].map((item) => <div key={item} className="flex gap-3 rounded-2xl bg-gray-50 border p-3"><icons.CheckCircle className="w-5 h-5 text-emerald-700 mt-0.5" /><span>{item}</span></div>)}
          </div>
        </div>
      </section>

      <SectionIntro
        eyebrow="Como funciona"
        title="Da recepção ao financeiro."
        text="A clínica ganha uma operação digital modular: começa pela recepção, avança para atendimento e consolida backoffice."
      />
      <Steps items={[
        { title: 'Configure a clínica', text: 'Cadastre página, equipe, serviços, agenda, dados comerciais e formas de recebimento.' },
        { title: 'Receba pacientes', text: 'Use QR Code, pré-atendimento e entrada do paciente para organizar a fila e as pendências.' },
        { title: 'Gerencie operação', text: 'Acompanhe atendimentos, prontuários, cobranças, recibos e contas da clínica.' },
      ]} />

      <CTA
        title="Coloque sua clínica em fluxo digital."
        text="Recepção digital, agenda, prontuário, cobranças e backoffice para reduzir retrabalho e organizar a operação."
        href="/register"
        label="Começar agora"
      />
      <PublicFooter />
    </main>
  )
}
