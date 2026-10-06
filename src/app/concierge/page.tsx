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
  title: 'HealthWallet Concierge | MyDataMed',
  description: 'Coordenação pessoal de saúde com enfermagem de referência, escalonamento médico e acompanhamento dos próximos passos até o loop do cuidado ser fechado.',
}

const conciergeFeatures = [
  {
    icon: icons.ClipboardList,
    title: 'Organiza o que precisa acontecer',
    text: 'Exames, retornos, documentos, encaminhamentos, consultas e pendências entram em uma jornada clara com próximo passo.',
  },
  {
    icon: icons.Users,
    title: 'Enfermagem de referência',
    text: 'Um profissional acompanha a jornada, ajuda a superar barreiras e mantém o caso andando dentro do seu escopo.',
  },
  {
    icon: icons.Stethoscope,
    title: 'Médico quando necessário',
    text: 'Quando existe uma decisão clínica a ser tomada, o caso pode ser estruturado e escalonado para revisão médica.',
  },
  {
    icon: icons.MessageCircle,
    title: 'Acompanhamento, não chat solto',
    text: 'Cada necessidade vira um caso com objetivo, timeline, mensagens, tarefas, documentos, responsável e próximo passo.',
  },
  {
    icon: icons.ShieldCheck,
    title: 'Consentimento e controle',
    text: 'O contexto de saúde é acessado conforme as autorizações aplicáveis, com separação entre informação do paciente e operação interna.',
  },
  {
    icon: icons.HeartPulse,
    title: 'Tudo volta para a HealthWallet',
    text: 'O que for relevante para a continuidade do cuidado permanece disponível ao paciente sem criar uma história paralela.',
  },
]

const requestExamples = [
  ['Fiz exames e não sei o que falta agora', 'O Concierge organiza os documentos, identifica pendências de jornada e coordena o próximo passo.'],
  ['Saí da consulta com três pedidos e um retorno', 'A equipe transforma isso em tarefas acompanháveis e ajuda a chegar ao retorno com tudo pronto.'],
  ['Preciso encontrar e marcar um especialista', 'O Concierge pode apoiar a navegação, busca de prestadores, organização do agendamento e acompanhamento do resultado.'],
  ['Voltei do pronto-socorro', 'Documentos, orientações e próximos passos podem ser organizados para reduzir perda de contexto depois da alta.'],
  ['Cuido da saúde dos meus pais', 'Com as autorizações adequadas, o mesmo modelo de coordenação pode apoiar familiares sem transformar o produto em um plano exclusivo para famílias.'],
  ['Tenho vários médicos e informações espalhadas', 'A HealthWallet concentra a história e o Concierge ajuda a conectar o que cada etapa exige depois.'],
]

function ConciergeJourney() {
  return (
    <div className="rounded-[2rem] bg-white p-5 text-gray-900 shadow-2xl border border-white/20">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white">
        <p className="text-sm text-white/70">HealthWallet Concierge</p>
        <h3 className="mt-1 text-2xl font-bold">Seu cuidado em andamento</h3>
        <p className="mt-3 text-sm text-white/80">Não é uma lista de documentos. É uma lista do que ainda precisa acontecer.</p>
      </div>

      <div className="mt-4 space-y-3">
        {[
          ['🟠', 'Retorno com cardiologista', 'Próximo passo: concluir exames antes do retorno'],
          ['🟡', 'Ultrassom solicitado', 'Agendamento em andamento'],
          ['🔵', 'Saúde da mãe', 'Consulta confirmada para 14/10'],
          ['✅', 'Investigação de dor lombar', 'Ciclo concluído'],
        ].map(([status, title, text]) => (
          <div key={title} className="flex gap-3 rounded-2xl border bg-gray-50 p-4">
            <div className="text-xl">{status}</div>
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
        eyebrow="HealthWallet Concierge · powered by MyDataMed"
        title="Sua saúde organizada. E alguém cuidando para os próximos passos acontecerem."
        subtitle="Você já tem médicos, exames, receitas e consultas. O que geralmente falta é alguém conectando tudo. O Concierge acompanha a jornada, coordena pendências e envolve o profissional certo quando necessário."
        primaryHref="https://concierge.mydatamed.com/concierge"
        primaryLabel="Acessar Concierge"
        secondaryHref="/healthwallet"
        secondaryLabel="Conhecer HealthWallet"
      >
        <ConciergeJourney />
      </Hero>

      <SectionIntro
        eyebrow="Coordenação pessoal de saúde"
        title="O valor não está só em responder. Está em fechar o loop."
        text="Um pedido de exame não termina quando é emitido. Pode exigir agendamento, preparo, realização, resultado, revisão profissional, nova orientação e retorno. O Concierge existe para ajudar essa sequência a não se perder."
      />
      <FeatureGrid features={conciergeFeatures} />

      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">O que você pode pedir</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-gray-950">Comece pela sua necessidade real.</h2>
          <p className="mt-4 text-gray-600 text-lg">Não precisa saber qual tela, especialidade ou documento procurar. Conte o que precisa organizar e a jornada começa daí.</p>
        </div>

        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {requestExamples.map(([title, text]) => (
            <div key={title} className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
              <p className="font-bold text-gray-950">“{title}”</p>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-4 py-16 grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">Um exemplo simples</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold">Você saiu do cardiologista com 3 exames, uma mudança de medicamento e retorno em 60 dias.</h2>
            <p className="mt-5 text-white/70 leading-relaxed">No modelo tradicional, o restante fica com você: lembrar, marcar, guardar pedidos, realizar, buscar resultados e chegar ao retorno com tudo. No Concierge, isso vira uma jornada acompanhada.</p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
            <div className="space-y-3">
              {[
                ['1', 'Pedidos organizados', 'Os exames e documentos ficam ligados ao caso.'],
                ['2', 'Próximos passos definidos', 'O que precisa ser marcado, realizado ou confirmado ganha responsável e prazo.'],
                ['3', 'Pendências acompanhadas', 'O Concierge acompanha o que ainda não aconteceu e ajuda a remover barreiras.'],
                ['4', 'Resultados voltam para a jornada', 'Quando chegam, podem gerar uma revisão profissional conforme necessário.'],
                ['5', 'Retorno preparado', 'O paciente chega à próxima consulta com contexto e pendências organizados.'],
              ].map(([step, title, text]) => (
                <div key={step} className="flex gap-3 rounded-2xl bg-white p-4 text-gray-900">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white">{step}</div>
                  <div><p className="font-bold">{title}</p><p className="mt-1 text-sm text-gray-600">{text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionIntro
        eyebrow="Quem acompanha você"
        title="Enfermagem coordena. Médico decide quando necessário. Concierge faz o próximo passo andar."
        text="O papel muda conforme a necessidade. Nem toda pendência precisa de uma consulta médica, e nenhuma decisão clínica deve ser confundida com uma tarefa operacional."
      />
      <Steps items={[
        {
          title: 'A enfermagem organiza a jornada',
          text: 'Acompanha casos, coleta informações, identifica pendências de cuidado, faz follow-up e prepara o contexto dentro do seu escopo.',
        },
        {
          title: 'O médico entra quando existe decisão clínica',
          text: 'Recebe um caso estruturado, revisa o contexto autorizado e registra a avaliação, orientação ou próximo passo profissional.',
        },
        {
          title: 'O Concierge coordena a execução',
          text: 'Ajuda a transformar o plano em ações: retorno, exame, especialista, documento, lembrete, resultado e nova pendência quando houver.',
        },
      ]} />

      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-7 md:p-9">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">O que o Concierge coordena</p>
            <ul className="mt-5 space-y-3 text-gray-800">
              {[
                'Casos, pendências, retornos e próximos passos.',
                'Organização de exames, documentos e informações da jornada.',
                'Apoio à busca e ao agendamento de consultas, exames e especialistas.',
                'Follow-up para saber se o que foi combinado realmente aconteceu.',
                'Escalonamento para médico ou outro profissional quando necessário.',
                'Acompanhamento da própria saúde ou, mediante autorização, de familiares.',
              ].map((item) => <li key={item} className="flex gap-2"><span className="text-emerald-700">✓</span><span>{item}</span></li>)}
            </ul>
          </div>

          <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-7 md:p-9">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-800">Limites claros</p>
            <ul className="mt-5 space-y-3 text-gray-800">
              {[
                'Não substitui pronto atendimento, urgência ou emergência.',
                'Não promete consulta médica ilimitada dentro da coordenação.',
                'Decisões clínicas pertencem a profissionais habilitados.',
                'Tecnologia e IA apoiam organização e contexto; não atuam como autoridade clínica autônoma.',
                'Acesso a dados de saúde depende das autorizações e regras aplicáveis.',
              ].map((item) => <li key={item} className="flex gap-2"><span className="text-amber-800">•</span><span>{item}</span></li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="rounded-[2rem] bg-gradient-to-br from-emerald-600 to-teal-700 p-8 md:p-10 text-white">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-100">Um ecossistema fechado</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold">HealthWallet guarda a história → Concierge coordena → MyDataMed conecta os profissionais → tudo volta para a HealthWallet.</h2>
          <p className="mt-5 max-w-4xl text-white/80 text-lg">Família continua dentro dessa experiência quando fizer sentido. Não como limite do produto, mas como uma capacidade para quem também coordena a saúde de pais, filhos ou outros familiares autorizados.</p>
        </div>
      </section>

      <CTA
        title="Sua saúde não deveria depender da sua memória para continuar andando."
        text="Organize sua história na HealthWallet e use o Concierge para acompanhar o que ainda precisa acontecer."
        href="https://concierge.mydatamed.com/concierge"
        label="Acessar Concierge"
      />

      <PublicFooter />
    </main>
  )
}
