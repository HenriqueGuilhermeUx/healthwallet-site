'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  CreditCard,
  FileText,
  HeartPulse,
  Landmark,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  Users,
  Video,
} from 'lucide-react'

const pilotScope = [
  'Cidadãos e famílias usando HealthWallet para organizar dados de saúde, Passport, exames, medicamentos, CNS/Cartão SUS e contatos de emergência.',
  'Profissionais, UBS, equipes ou parceiros acessando somente dados autorizados pelo cidadão.',
  'Teleorientação, teletriagem ou teleconsulta quando o município definir que faz sentido no programa.',
  'Campanhas de cuidado e lembretes para retorno, exames, medicamentos, prevenção, idosos, crônicos, gestantes ou grupos prioritários.',
  'Painel operacional para acompanhamento do piloto, uso por profissionais, adesão cidadã e oportunidades de expansão.',
]

const phases = [
  {
    title: 'Preparação',
    time: '0–15 dias',
    items: ['Definir UBS, bairro, grupo prioritário ou programa', 'Ajustar campos locais: município, UBS, equipe, CNS e prontuário local', 'Treinar equipe piloto e preparar materiais de convite'],
  },
  {
    title: 'Piloto controlado',
    time: '30–60 dias',
    items: ['Cadastrar cidadãos/famílias', 'Validar compartilhamento autorizado', 'Usar Passport, CNS, teleatendimento e lembretes', 'Acompanhar retorno, adesão e uso'],
  },
  {
    title: 'Expansão',
    time: '60–90 dias',
    items: ['Medir resultados operacionais', 'Expandir para outros grupos ou UBS', 'Ajustar integração com clínicas e profissionais parceiros', 'Avaliar novas automações e governança'],
  },
]

const modules = [
  { icon: HeartPulse, title: 'HealthWallet cidadão', text: 'Carteira de saúde pessoal e familiar, com Passport, exames, medicamentos, CNS, UBS e contatos importantes.' },
  { icon: ShieldCheck, title: 'Dados autorizados', text: 'Compartilhamento por código, consulta ou autorização contextual. O profissional só vê o que foi permitido.' },
  { icon: CreditCard, title: 'CNS / Cartão SUS', text: 'Vínculo operacional complementar informado pelo cidadão, familiar, responsável ou município.' },
  { icon: Users, title: 'Família e cuidadores', text: 'Perfis livres para idosos, filhos, dependentes, cuidadores e pessoas acompanhadas.' },
  { icon: Video, title: 'Teleatendimento', text: 'Daily embutido no Pro, link externo como fallback e fluxo preparado para programas remotos.' },
  { icon: MessageCircle, title: 'CRM SmartBots', text: 'Lembretes, retorno, prevenção, campanhas, pós-atendimento e reativação de cuidado.' },
  { icon: FileText, title: 'Documentação', text: 'Orientações, relatórios, timeline, histórico de eventos e documentos profissionais quando aplicável.' },
  { icon: Building2, title: 'Clínicas e parceiros', text: 'Base para operar rede parceira, profissionais externos e pequenos grupos de atendimento.' },
]

const indicators = [
  'Número de cidadãos/famílias cadastrados',
  'Quantidade de perfis com CNS/UBS preenchidos',
  'Códigos de acesso gerados e utilizados',
  'Atendimentos/teleatendimentos realizados',
  'Retornos, lembretes e follow-ups registrados',
  'Grupos prioritários acompanhados',
  'Adesão da equipe e oportunidades de expansão',
]

export default function PropostaMunicipalPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-10 space-y-14">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Proposta de Piloto Municipal</p>
            <p className="text-xs text-gray-500">HealthWallet + MyDataMed</p>
          </div>
        </Link>

        <div className="flex gap-2">
          <Link href="/prefeituras" className="hidden sm:inline-flex px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50">Prefeituras</Link>
          <Link href="/sus-cns" className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700">CNS/SUS</Link>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-8 md:p-14">
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -left-20 bottom-0 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl" />

        <div className="relative grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-6">
              <ClipboardCheck className="w-4 h-4" />
              Proposta institucional pronta para apresentação
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Piloto municipal de carteira de saúde digital e cuidado contínuo.
            </h1>
            <p className="text-lg text-white/75 mt-5 max-w-3xl">
              Um projeto modular para melhorar a jornada do cidadão, apoiar famílias, dar contexto às equipes de saúde e criar uma camada digital complementar para programas municipais, sempre com autorização e respeito à privacidade.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <a href="#escopo" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 font-semibold text-white hover:bg-emerald-600">
                Ver escopo do piloto
                <ArrowRight className="w-5 h-5" />
              </a>
              <a href="#fases" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-6 py-4 font-semibold text-white hover:bg-white/15">
                Ver fases
              </a>
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 border border-white/10 p-5 backdrop-blur">
            <div className="rounded-2xl bg-white text-gray-900 p-5 shadow-2xl space-y-3">
              <p className="text-sm text-gray-500">Resumo executivo</p>
              <SummaryItem icon={HeartPulse} title="Cidadão" text="Organiza dados, exames, medicamentos, CNS, Passport e família." />
              <SummaryItem icon={Stethoscope} title="Equipe" text="Acessa somente dados autorizados, com contexto para atendimento." />
              <SummaryItem icon={Landmark} title="Secretaria" text="Cria piloto por UBS, bairro, programa ou grupo prioritário." />
              <SummaryItem icon={MessageCircle} title="Cuidado contínuo" text="Lembretes, retornos, campanhas e acompanhamento." />
            </div>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <Stat value="90 dias" label="ciclo sugerido para piloto completo" />
        <Stat value="1 UBS" label="começo simples por unidade ou grupo" />
        <Stat value="modular" label="cidadão, família, equipe e secretaria" />
      </section>

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6 items-start">
        <div className="rounded-[2rem] bg-white border border-gray-100 shadow-sm p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 mb-4">
            <CalendarDays className="w-4 h-4" />
            Problema público
          </div>
          <h2 className="text-3xl font-bold text-gray-900">A jornada de saúde do cidadão é fragmentada.</h2>
          <p className="text-gray-600 mt-4">
            Dados ficam espalhados entre papéis, celulares, exames, famílias, profissionais e sistemas diferentes. O cidadão nem sempre chega ao atendimento com histórico, medicamentos, alergias, exames e contatos importantes organizados.
          </p>
        </div>

        <div className="rounded-[2rem] bg-emerald-950 text-white shadow-sm p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-emerald-100 mb-4">
            <CheckCircle className="w-4 h-4" />
            Solução proposta
          </div>
          <h2 className="text-3xl font-bold">Carteira digital cidadã + portal profissional + gestão por programa.</h2>
          <p className="text-white/70 mt-4">
            O HealthWallet organiza a vida de saúde do cidadão e da família. O MyDataMed permite que profissionais e equipes acessem dados autorizados, façam atendimento com contexto e mantenham acompanhamento por campanhas, lembretes e programas municipais.
          </p>
        </div>
      </section>

      <section id="escopo" className="rounded-[2rem] bg-gradient-to-br from-blue-50 to-emerald-50 p-8 md:p-12">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-8 items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700 mb-4 border border-emerald-100">
              <Building2 className="w-4 h-4" />
              Escopo sugerido
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Um piloto controlado, mensurável e expansível.</h2>
            <p className="text-gray-600 mt-4">
              A entrada ideal é começar com escopo claro: uma UBS, bairro, grupo prioritário ou programa municipal. O objetivo é provar valor operacional antes de expandir.
            </p>
          </div>

          <div className="space-y-3">
            {pilotScope.map((item) => <CheckRow key={item} text={item} />)}
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 mb-4">
            <ShieldCheck className="w-4 h-4" />
            Módulos do piloto
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">O mesmo ecossistema, com uso público, profissional e familiar.</h2>
          <p className="text-gray-600 mt-3">
            O piloto preserva todos os usos: cidadão/família, profissionais de saúde em geral, médicos, clínicas parceiras e prefeituras/secretarias.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          {modules.map((item) => <ModuleCard key={item.title} item={item} />)}
        </div>
      </section>

      <section id="fases" className="space-y-6">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 mb-4">
            <CalendarDays className="w-4 h-4" />
            Fases de implantação
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Do piloto à expansão.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {phases.map((phase, index) => <PhaseCard key={phase.title} phase={phase} index={index + 1} />)}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-[2rem] bg-white border border-gray-100 shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900">Benefícios ao cidadão</h2>
          <div className="space-y-3 mt-5">
            <CheckRow text="Dados de saúde mais organizados no dia a dia" />
            <CheckRow text="Passport com emergência, alergias, medicamentos, CNS, UBS e contato familiar" />
            <CheckRow text="Compartilhamento consciente com profissionais e programas" />
            <CheckRow text="Acompanhamento de retornos, exames, prevenção e cuidado familiar" />
          </div>
        </div>

        <div className="rounded-[2rem] bg-slate-950 text-white shadow-sm p-8">
          <h2 className="text-2xl font-bold">Benefícios à secretaria</h2>
          <div className="space-y-3 mt-5">
            <CheckDark text="Canal digital complementar para programas municipais" />
            <CheckDark text="Melhor contexto para equipes e profissionais parceiros" />
            <CheckDark text="Campanhas, lembretes e follow-ups por público prioritário" />
            <CheckDark text="Base para expansão modular sem trocar todo o sistema existente" />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white border border-gray-100 shadow-sm p-8 md:p-12">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 mb-4">
              <CreditCard className="w-4 h-4" />
              CNS / Cartão SUS
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Ponte operacional complementar, sem promessa indevida.</h2>
            <p className="text-gray-600 mt-4">
              Nesta fase, CPF e CNS/Cartão SUS são dados informados pelo cidadão, familiar, responsável ou município. Eles ajudam a organizar o cuidado local, mas não significam consulta automática a bases oficiais.
            </p>
          </div>
          <div className="space-y-3">
            <CheckRow text="CPF/CNS como chave de organização e busca operacional" />
            <CheckRow text="UBS, município, equipe e prontuário local no Passport" />
            <CheckRow text="Acesso profissional somente com autorização" />
            <CheckRow text="Preparado para avaliar interoperabilidade futura quando houver viabilidade institucional" />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-gradient-to-br from-gray-50 to-emerald-50 p-8 md:p-12">
        <div className="grid lg:grid-cols-[1fr_0.9fr] gap-8 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Indicadores do piloto</h2>
            <p className="text-gray-600 mt-4">
              A proposta deve ser medida por uso real, adesão, organização da jornada e capacidade de acompanhamento. Os indicadores finais podem ser definidos junto com a secretaria.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {indicators.map((item) => <CheckRow key={item} text={item} />)}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-slate-950 text-white p-8 md:p-12 text-center">
        <Landmark className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
        <h2 className="text-3xl md:text-4xl font-bold">Próximo passo institucional</h2>
        <p className="text-white/70 max-w-3xl mx-auto mt-4">
          Apresentar o piloto para a secretaria, escolher o primeiro recorte e definir uma implantação simples, com governança, treinamento e acompanhamento dos indicadores.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Link href="/prefeituras" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 font-semibold text-white hover:bg-emerald-600">
            Ver página para prefeituras
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/tour" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-6 py-4 font-semibold text-white hover:bg-white/15">
            Ver tour completo
          </Link>
        </div>
      </section>
    </main>
  )
}

function SummaryItem({ icon: Icon, title, text }: any) {
  return (
    <div className="flex gap-3 rounded-2xl border bg-gray-50 p-3">
      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-500 mt-1">{text}</p>
      </div>
    </div>
  )
}

function Stat({ value, label }: any) {
  return (
    <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm text-center">
      <p className="text-2xl font-bold text-emerald-700">{value}</p>
      <p className="text-sm text-gray-500 mt-2">{label}</p>
    </div>
  )
}

function CheckRow({ text }: any) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4 text-sm text-gray-700 flex gap-2 shadow-sm">
      <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </div>
  )
}

function CheckDark({ text }: any) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/10 p-4 text-sm text-white/80 flex gap-2">
      <CheckCircle className="w-4 h-4 text-emerald-300 mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </div>
  )
}

function ModuleCard({ item }: any) {
  const Icon = item.icon
  return (
    <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm">
      <Icon className="w-8 h-8 text-emerald-600 mb-4" />
      <h3 className="font-bold text-gray-900">{item.title}</h3>
      <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.text}</p>
    </div>
  )
}

function PhaseCard({ phase, index }: any) {
  return (
    <div className="rounded-[2rem] bg-white border border-gray-100 shadow-sm p-6">
      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold mb-4">{index}</div>
      <p className="text-sm font-semibold text-emerald-700">{phase.time}</p>
      <h3 className="text-xl font-bold text-gray-900 mt-1">{phase.title}</h3>
      <div className="space-y-2 mt-4">
        {phase.items.map((item: string) => <CheckRow key={item} text={item} />)}
      </div>
    </div>
  )
}
