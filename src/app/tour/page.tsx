'use client'

import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Landmark,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  Video,
  Wallet,
} from 'lucide-react'

const audiences = [
  {
    id: 'profissionais',
    icon: Stethoscope,
    eyebrow: 'Tour 1',
    title: 'Profissionais de saúde em geral',
    subtitle: 'Para dentistas, nutricionistas, psicólogos, fisioterapeutas, terapeutas, enfermeiros, farmacêuticos e demais profissionais habilitados.',
    promise: 'Atenda melhor com dados autorizados, histórico organizado, teleconsulta, documentos, lembretes e relacionamento pós-atendimento.',
    bullets: [
      'Acesso gratuito aos dados autorizados pelo paciente',
      'Resumo, exames, medicamentos, timeline, Passport e MedScore quando compartilhados',
      'Teleconsulta Pro com Daily embutido e fallback para Meet/Zoom',
      'Documentos profissionais assinados pelo emissor, respeitando habilitação e regras aplicáveis',
      'CRM SmartBots para lembretes, follow-up, retorno e reativação',
    ],
    flow: ['Paciente compartilha', 'Profissional entende rápido', 'Atende com contexto', 'Registra orientação', 'Mantém acompanhamento'],
    cta: 'Começar como profissional',
  },
  {
    id: 'medicos',
    icon: HeartPulse,
    eyebrow: 'Tour 2',
    title: 'Médicos',
    subtitle: 'Para médicos que precisam reduzir tempo perdido, enxergar histórico clínico e conduzir consultas presenciais ou online com mais contexto.',
    promise: 'O MyDataMed ajuda o médico a chegar na consulta com histórico, exames, medicamentos, timeline e dados relevantes já organizados.',
    bullets: [
      'Visualização rápida do quadro do paciente antes da consulta',
      'Exames, medicamentos, alergias, eventos e histórico em uma timeline clara',
      'Teleconsulta embutida com registro de início, conclusão e orientação',
      'Documentos, relatórios e prescrições quando aplicável e com validação/habilitação correta',
      'Follow-up automático para retorno, revisão de exames e continuidade do cuidado',
    ],
    flow: ['Recebe código', 'Analisa snapshot', 'Atende', 'Assina documento', 'Agenda retorno'],
    cta: 'Ver fluxo médico',
  },
  {
    id: 'clinicas',
    icon: Building2,
    eyebrow: 'Tour 3',
    title: 'Clínicas e pequenos grupos de saúde',
    subtitle: 'Para clínicas que querem centralizar atendimento, teleconsulta, relacionamento, pagamentos e organização operacional sem montar um sistema próprio.',
    promise: 'Uma camada simples para a clínica organizar pacientes, profissionais, agenda, chamadas, documentos, pagamentos Pix e CRM de retorno.',
    bullets: [
      'Painel para agenda, teleconsultas e atendimento online',
      'CRM por paciente com tarefas, lembretes, retornos e pós-consulta',
      'Cobrança Pix via Woovi/NextGen para plano profissional e futura cobrança de consultas',
      'Documentos profissionais, assinatura e validação pública',
      'Base pronta para equipe multiprofissional e pequenos consultórios',
    ],
    flow: ['Agenda', 'Confirma', 'Atende', 'Recebe', 'Faz follow-up'],
    cta: 'Conhecer para clínicas',
  },
  {
    id: 'prefeituras',
    icon: Landmark,
    eyebrow: 'Tour 4',
    title: 'Prefeituras e Secretarias de Saúde',
    subtitle: 'Para municípios que querem melhorar a jornada do cidadão, organizar dados de saúde, apoiar equipes e ampliar acompanhamento digital com segurança.',
    promise: 'O HealthWallet + MyDataMed pode servir como camada digital cidadã: cidadão com dados organizados, família acompanhando e profissionais acessando informações autorizadas.',
    bullets: [
      'Carteira de saúde digital para cidadãos, famílias, idosos e dependentes',
      'Compartilhamento autorizado com UBS, equipe multiprofissional ou atendimento parceiro',
      'Teleatendimento e acompanhamento remoto quando fizer sentido para o município',
      'Campanhas de cuidado: medicamentos, exames, retornos, idosos, crônicos e prevenção',
      'Modelo modular para pilotos, convênios, programas municipais e parcerias público-privadas',
    ],
    flow: ['Cidadão organiza dados', 'Família acompanha', 'Equipe acessa autorização', 'Município monitora jornada', 'Cuidado fica contínuo'],
    cta: 'Ver uso público',
  },
]

const modules = [
  { icon: ShieldCheck, title: 'Dados autorizados', text: 'O profissional acessa apenas o que o paciente compartilha.' },
  { icon: Video, title: 'Teleconsulta', text: 'Daily embutido no Pro, com fallback por link manual.' },
  { icon: MessageCircle, title: 'CRM SmartBots', text: 'Lembretes, confirmação, retorno, follow-up e reativação.' },
  { icon: FileText, title: 'Documentos', text: 'Orientações, relatórios, pedidos e documentos assinados pelo emissor.' },
  { icon: Wallet, title: 'Pagamentos', text: 'Woovi/NextGen como base para Pix, plano Pro e cobrança futura.' },
  { icon: Users, title: 'Família e cidadão', text: 'Perfis familiares livres para cuidado contínuo e acompanhamento.' },
]

export default function TourPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-10 space-y-16">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-8 md:p-14">
        <div className="absolute -right-20 -top-24 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -left-20 bottom-0 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl" />

        <div className="relative grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-6">
              <Sparkles className="w-4 h-4" />
              Tour MyDataMed + HealthWallet
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Um sistema para profissionais, clínicas e saúde pública cuidarem melhor das pessoas.
            </h1>
            <p className="text-lg text-white/75 mt-5 max-w-3xl">
              O HealthWallet organiza a saúde do cidadão e da família. O MyDataMed permite que profissionais e instituições acessem dados autorizados, atendam, acompanhem, documentem e mantenham relacionamento com o paciente.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 font-semibold text-white hover:bg-emerald-600">
                Criar conta profissional
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#prefeituras" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-6 py-4 font-semibold text-white hover:bg-white/15">
                Ver uso para municípios
              </a>
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 border border-white/10 p-5 backdrop-blur">
            <div className="rounded-2xl bg-white text-gray-900 p-5 shadow-2xl space-y-3">
              <p className="text-sm text-gray-500">Jornada integrada</p>
              <JourneyLine number="1" title="Paciente/Família" text="Organiza exames, medicamentos, Passport e histórico no HealthWallet." />
              <JourneyLine number="2" title="Profissional" text="Acessa dados autorizados gratuitamente mediante cadastro." />
              <JourneyLine number="3" title="Modo Pro" text="Usa teleconsulta, CRM, documentos, pagamentos e acompanhamento." />
              <JourneyLine number="4" title="Instituição" text="Clínicas e municípios podem operar programas de cuidado digital." />
            </div>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-3">
        <TopAnchor href="#profissionais" title="Profissionais" />
        <TopAnchor href="#medicos" title="Médicos" />
        <TopAnchor href="#clinicas" title="Clínicas" />
        <TopAnchor href="#prefeituras" title="Prefeituras" />
      </section>

      <section className="space-y-8">
        {audiences.map((audience, index) => (
          <AudienceSection key={audience.id} audience={audience} index={index} />
        ))}
      </section>

      <section className="rounded-[2rem] bg-gradient-to-br from-gray-50 to-emerald-50 p-8 md:p-12">
        <div className="text-center max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 mb-4">
            <ClipboardCheck className="w-4 h-4" />
            Módulos do ecossistema
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">O mesmo núcleo, quatro formas de vender.</h2>
          <p className="text-gray-600 mt-3">
            O produto não muda de essência. O que muda é o benefício principal para cada público: produtividade profissional, consulta médica, operação clínica ou cuidado cidadão.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {modules.map((item) => (
            <ModuleCard key={item.title} item={item} />
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] bg-slate-950 text-white p-8 md:p-12">
        <div className="grid md:grid-cols-[1fr_0.8fr] gap-8 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold">Mensagem comercial central</h2>
            <p className="text-white/70 mt-4 text-lg">
              Para o cidadão, é uma carteira de saúde familiar. Para o profissional, é acesso a dados autorizados e atendimento com contexto. Para clínicas, é operação comercial. Para prefeituras, é uma camada digital de cuidado e acompanhamento da população.
            </p>
          </div>
          <div className="rounded-3xl bg-white text-gray-900 p-6">
            <p className="text-sm font-semibold text-emerald-700 mb-3">Próximos CTAs</p>
            <div className="space-y-3">
              <CtaRow text="Agendar demonstração para clínica" />
              <CtaRow text="Solicitar apresentação institucional" />
              <CtaRow text="Criar conta profissional gratuita" />
              <CtaRow text="Iniciar piloto municipal" />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function AudienceSection({ audience, index }: any) {
  const Icon = audience.icon
  const reverse = index % 2 === 1

  return (
    <section id={audience.id} className="scroll-mt-8 rounded-[2rem] bg-white border border-gray-100 shadow-sm p-6 md:p-8">
      <div className={`grid lg:grid-cols-2 gap-8 items-center ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 mb-4">
            <Icon className="w-4 h-4" />
            {audience.eyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">{audience.title}</h2>
          <p className="text-gray-600 text-lg mt-3">{audience.subtitle}</p>
          <p className="text-gray-900 font-semibold mt-5 text-lg">{audience.promise}</p>

          <div className="space-y-3 mt-6">
            {audience.bullets.map((bullet: string) => (
              <div key={bullet} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>

          <Link href="/register" className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold hover:bg-emerald-700">
            {audience.cta}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="rounded-3xl bg-gray-50 border border-gray-100 p-5">
          <div className="rounded-2xl bg-white border p-5 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Fluxo recomendado</p>
                <p className="font-bold text-gray-900">{audience.title}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {audience.flow.map((step: string, i: number) => (
              <JourneyLine key={step} number={String(i + 1)} title={step} text={flowDescription(audience.id, i)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function flowDescription(id: string, index: number) {
  const map: Record<string, string[]> = {
    profissionais: [
      'Paciente libera acesso ao que importa.',
      'Dados chegam organizados para decisão mais rápida.',
      'Atendimento presencial ou online com contexto.',
      'Orientação/documento volta para o paciente.',
      'CRM mantém continuidade do cuidado.',
    ],
    medicos: [
      'Código ou autorização abre o snapshot.',
      'Médico vê exames, medicamentos e histórico.',
      'Consulta acontece com menos perda de tempo.',
      'Documento é emitido conforme habilitação.',
      'Retorno e revisão ficam agendados no CRM.',
    ],
    clinicas: [
      'Equipe organiza horários e pacientes.',
      'Paciente recebe confirmação e lembretes.',
      'Atendimento online ou presencial é registrado.',
      'Pix e status financeiro entram na rotina.',
      'Follow-up reduz abandono e aumenta retorno.',
    ],
    prefeituras: [
      'Cidadão/família mantém dados atualizados.',
      'Idosos, dependentes e crônicos podem ser acompanhados.',
      'Equipe só acessa dados autorizados.',
      'Gestão acompanha jornada e programas.',
      'Cuidado deixa de ser pontual e vira contínuo.',
    ],
  }
  return map[id]?.[index] || 'Etapa do fluxo.'
}

function JourneyLine({ number, title, text }: any) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-white p-3">
      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">{number}</div>
      <div>
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{text}</p>
      </div>
    </div>
  )
}

function TopAnchor({ href, title }: any) {
  return (
    <a href={href} className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between gap-3">
      <span className="font-semibold text-gray-900">{title}</span>
      <ArrowRight className="w-4 h-4 text-emerald-600" />
    </a>
  )
}

function ModuleCard({ item }: any) {
  const Icon = item.icon
  return (
    <div className="rounded-3xl bg-white border border-gray-100 p-5 shadow-sm">
      <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-bold text-gray-900">{item.title}</h3>
      <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.text}</p>
    </div>
  )
}

function CtaRow({ text }: any) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-gray-50 border p-3 text-sm text-gray-700">
      <BadgeCheck className="w-4 h-4 text-emerald-600" />
      <span>{text}</span>
    </div>
  )
}
