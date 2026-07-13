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
  Sparkles,
  Stethoscope,
  Users,
  Video,
} from 'lucide-react'

const pillars = [
  { icon: HeartPulse, title: 'Carteira de saúde cidadã', text: 'O cidadão organiza exames, medicamentos, histórico, Passport, dados familiares, CPF e CNS/Cartão SUS em uma experiência simples.' },
  { icon: CreditCard, title: 'CNS / Cartão SUS complementar', text: 'CPF, CNS, UBS, município e prontuário local ajudam a criar uma ponte operacional com a rede municipal, sem prometer consulta automática ao SUS.' },
  { icon: Users, title: 'Família, idosos e dependentes', text: 'Perfis familiares livres para filhos, pais, idosos, cuidadores e pessoas acompanhadas, sem aceite ou assinatura obrigatória para o cuidado familiar.' },
  { icon: ShieldCheck, title: 'Dados autorizados', text: 'Profissionais e equipes acessam somente dados compartilhados pelo cidadão, por código, consulta ou autorização contextual.' },
  { icon: Video, title: 'Teleatendimento e triagem', text: 'Base para teleconsulta, orientação remota, acompanhamento de casos e extensão digital de equipes municipais quando fizer sentido.' },
  { icon: MessageCircle, title: 'Campanhas e lembretes', text: 'CRM SmartBots para lembrar retornos, exames, consultas, medicamentos, grupos prioritários, crônicos, gestantes, idosos e prevenção.' },
  { icon: FileText, title: 'Documentação e acompanhamento', text: 'Relatórios, orientações, timeline e histórico de interações ajudam a manter continuidade do cuidado entre cidadão, família e equipe.' },
]

const programs = [
  'Programa municipal de carteira de saúde digital para cidadãos',
  'Cadastro complementar de CPF/CNS, UBS, bairro, agente/equipe e prontuário local',
  'Acompanhamento de idosos, crônicos, gestantes e pacientes com retorno pendente',
  'Teleorientação e teletriagem com equipes autorizadas',
  'Campanhas de prevenção, vacinação, exames e check-ups',
  'Integração operacional com clínicas, profissionais parceiros e rede local',
  'Piloto por UBS, bairro, grupo prioritário ou secretaria',
]

const journey = [
  { step: '1', title: 'Cidadão organiza dados', text: 'HealthWallet reúne documentos, exames, medicamentos, Passport, dados familiares, CPF e CNS/Cartão SUS.' },
  { step: '2', title: 'Família acompanha', text: 'Cuidadores e responsáveis mantêm informações úteis para rotina, UBS e emergência.' },
  { step: '3', title: 'Equipe acessa com autorização', text: 'Profissionais veem apenas o que foi compartilhado, com foco em atendimento e continuidade.' },
  { step: '4', title: 'Município cria programas', text: 'Secretaria estrutura pilotos, campanhas e acompanhamento remoto por UBS, bairro ou grupo prioritário.' },
  { step: '5', title: 'Cuidado vira jornada', text: 'Lembretes, retorno, teleatendimento e CRM reduzem abandono e melhoram acompanhamento.' },
]

export default function PrefeiturasPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-10 space-y-14">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-gray-900">MyDataMed Institucional</p>
            <p className="text-xs text-gray-500">Prefeituras e Secretarias de Saúde</p>
          </div>
        </Link>
        <div className="flex gap-2">
          <Link href="/sus-cns" className="hidden sm:inline-flex px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50">CNS/SUS</Link>
          <Link href="/tour" className="hidden sm:inline-flex px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50">Ver tour completo</Link>
          <Link href="/register" className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700">Criar conta</Link>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-8 md:p-14">
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -left-20 bottom-0 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1.08fr_0.92fr] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-6">
              <Sparkles className="w-4 h-4" />
              Saúde digital cidadã + CNS/Cartão SUS complementar
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">Uma camada digital simples para melhorar a jornada de saúde do cidadão.</h1>
            <p className="text-lg text-white/75 mt-5 max-w-3xl">
              O HealthWallet organiza dados pessoais, familiares, CPF, CNS/Cartão SUS e Passport. O MyDataMed permite que profissionais, equipes, clínicas parceiras e programas públicos acessem informações autorizadas, façam teleatendimento, acompanhem retornos e mantenham cuidado contínuo.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <a href="#piloto" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 font-semibold text-white hover:bg-emerald-600">
                Desenhar piloto municipal <ArrowRight className="w-5 h-5" />
              </a>
              <Link href="/sus-cns" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-6 py-4 font-semibold text-white hover:bg-white/15">Ver CNS / SUS</Link>
              <Link href="/tour#prefeituras" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-6 py-4 font-semibold text-white hover:bg-white/15">Ver tour para secretarias</Link>
            </div>
          </div>
          <div className="rounded-3xl bg-white/10 border border-white/10 p-5 backdrop-blur">
            <div className="rounded-2xl bg-white text-gray-900 p-5 shadow-2xl space-y-3">
              <p className="text-sm text-gray-500">Jornada cidadã</p>
              {journey.map((item) => (
                <div key={item.step} className="flex gap-3 rounded-2xl border bg-gray-50 p-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{item.step}</div>
                  <div><p className="font-semibold text-gray-900 text-sm">{item.title}</p><p className="text-xs text-gray-500 mt-1">{item.text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-4">
        <Stat value="Cidadão" label="dados organizados e compartilhamento consciente" />
        <Stat value="CNS" label="vínculo operacional complementar ao Cartão SUS" />
        <Stat value="Equipe" label="acesso autorizado e atendimento com contexto" />
        <Stat value="Município" label="programas digitais, campanhas e acompanhamento" />
      </section>

      <section className="rounded-[2rem] bg-blue-50 border border-blue-200 p-6 md:p-8">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-8 items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 mb-4 border border-blue-100">
              <CreditCard className="w-4 h-4" /> CNS / Cartão SUS
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-blue-950">Vínculo complementar, sem apagar os outros usos.</h2>
            <p className="text-blue-900 mt-4">
              Profissionais, médicos, clínicas e prefeituras continuam tendo suas jornadas próprias. O CNS entra como uma chave adicional para programas públicos e organização local, sempre sem abrir dados clínicos sem autorização.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Check text="CPF e CNS/Cartão SUS no perfil do cidadão" />
            <Check text="CNS também para familiares, idosos e dependentes" />
            <Check text="UBS, município, equipe/agente e prontuário local no Passport" />
            <Check text="Busca profissional por CPF/CNS só abre dados com autorização" />
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 mb-4">
            <ClipboardCheck className="w-4 h-4" /> Como o sistema pode ajudar
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Um núcleo digital para cuidado contínuo, não apenas consulta isolada.</h2>
          <p className="text-gray-600 mt-3">A proposta é começar modular: cidadão, família, profissionais cadastrados, dados autorizados, teleatendimento, lembretes e acompanhamento por programa.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">{pillars.map((item) => <PillarCard key={item.title} item={item} />)}</div>
      </section>

      <section id="piloto" className="rounded-[2rem] bg-gradient-to-br from-gray-50 to-emerald-50 p-8 md:p-12">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700 mb-4 border border-emerald-100">
              <Building2 className="w-4 h-4" /> Modelo de implantação
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Começar pequeno, provar valor e expandir.</h2>
            <p className="text-gray-600 mt-4">A entrada ideal para prefeitura ou secretaria é um piloto com escopo claro: uma UBS, um grupo prioritário, um programa municipal ou um conjunto de profissionais parceiros.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">{programs.map((item) => <Check key={item} text={item} />)}</div>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-[2rem] bg-white border border-gray-100 shadow-sm p-6 md:p-8">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-700 flex items-center justify-center mb-4"><Stethoscope className="w-6 h-6" /></div>
          <h2 className="text-2xl font-bold text-gray-900">Para a rede assistencial</h2>
          <p className="text-gray-600 mt-3">Profissionais cadastrados acessam dados autorizados gratuitamente. O modo Pro libera teleconsulta, CRM, documentos, assinatura profissional e pagamentos quando aplicável ao modelo operacional.</p>
          <div className="space-y-2 mt-5"><Check text="Acesso por código ou autorização do cidadão" /><Check text="Snapshot com exames, medicamentos, timeline, Passport e CNS" /><Check text="Teleconsulta Daily embutida e fallback externo" /><Check text="CRM para retornos e acompanhamento" /></div>
        </div>
        <div className="rounded-[2rem] bg-slate-950 text-white shadow-sm p-6 md:p-8">
          <div className="w-12 h-12 rounded-2xl bg-white/10 text-emerald-200 flex items-center justify-center mb-4"><Landmark className="w-6 h-6" /></div>
          <h2 className="text-2xl font-bold">Para gestão pública</h2>
          <p className="text-white/70 mt-3">A secretaria pode usar o ecossistema como camada de relacionamento, organização de jornada e apoio digital ao cidadão, respeitando escopo, governança, segurança e responsabilidades de cada programa.</p>
          <div className="space-y-2 mt-5"><CheckDark text="Piloto por programa, UBS, grupo prioritário ou região" /><CheckDark text="Cidadão com dados organizados, CNS informado e família acompanhando" /><CheckDark text="Campanhas, lembretes e retornos com SmartBots" /><CheckDark text="Modelo modular para convênios e parcerias" /></div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white border border-gray-100 shadow-sm p-8 md:p-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4"><CalendarDays className="w-7 h-7" /></div>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Próximo passo: piloto institucional.</h2>
        <p className="text-gray-600 max-w-3xl mx-auto mt-3">A apresentação ideal para prefeitura é objetiva: problema, solução, CNS complementar, piloto, módulos, segurança, benefícios ao cidadão e expansão por fases.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Link href="/tour" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-6 py-4 font-semibold hover:bg-emerald-700">Ver tour completo <ArrowRight className="w-5 h-5" /></Link>
          <Link href="/sus-cns" className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-gray-700 px-6 py-4 font-semibold hover:bg-gray-50">Ver CNS / SUS</Link>
        </div>
      </section>
    </main>
  )
}

function Stat({ value, label }: any) { return <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm text-center"><p className="text-2xl font-bold text-emerald-700">{value}</p><p className="text-sm text-gray-500 mt-2">{label}</p></div> }
function PillarCard({ item }: any) { const Icon = item.icon; return <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6"><div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4"><Icon className="w-6 h-6" /></div><h3 className="font-bold text-gray-900 text-lg">{item.title}</h3><p className="text-gray-600 text-sm leading-relaxed mt-2">{item.text}</p></div> }
function Check({ text }: any) { return <div className="rounded-2xl bg-white border border-gray-100 p-4 text-sm text-gray-700 flex gap-2 shadow-sm"><CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /><span>{text}</span></div> }
function CheckDark({ text }: any) { return <div className="flex items-start gap-2 text-sm text-white/80"><CheckCircle className="w-4 h-4 text-emerald-300 mt-0.5 flex-shrink-0" /><span>{text}</span></div> }
