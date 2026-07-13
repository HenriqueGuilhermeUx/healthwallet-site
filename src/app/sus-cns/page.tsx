'use client'

import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle,
  CreditCard,
  HeartPulse,
  Landmark,
  Stethoscope,
  Users,
} from 'lucide-react'

const fases = [
  'Fase 1: cidadão/família informa CPF, CNS/Cartão SUS, UBS e município no HealthWallet.',
  'Fase 2: profissional ou equipe local usa CPF/CNS como chave operacional, sempre com autorização.',
  'Fase 3: prefeitura estrutura piloto por UBS, bairro, grupo prioritário ou programa municipal.',
  'Fase 4: quando viável institucionalmente, avaliar interoperabilidade futura com padrões oficiais.',
]

export default function SusCnsPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-10 space-y-12">
      <header className="rounded-[2rem] bg-slate-950 text-white p-8 md:p-14">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-6">
            <CreditCard className="w-4 h-4" />
            CNS / Cartão SUS complementar
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Uma ponte simples entre cidadão, família, UBS, profissional e programa municipal.
          </h1>
          <p className="text-lg text-white/75 mt-5 max-w-3xl">
            O HealthWallet permite cadastrar CPF, CNS/Cartão SUS, UBS de referência e município. O MyDataMed usa esse vínculo como camada operacional complementar, sempre com acesso autorizado e respeito à privacidade.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Link href="/proposta-municipal" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 font-semibold text-white hover:bg-emerald-600">
              Abrir proposta municipal
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/prefeituras" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-6 py-4 font-semibold text-white hover:bg-white/15">
              Ver uso para prefeituras
            </Link>
            <Link href="/tour" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-6 py-4 font-semibold text-white hover:bg-white/15">
              Ver todos os públicos
            </Link>
          </div>
        </div>
      </header>

      <section className="grid md:grid-cols-4 gap-4">
        <Card icon={HeartPulse} title="Cidadão" text="Organiza dados, exames, medicamentos, CNS e Passport no HealthWallet." />
        <Card icon={Users} title="Família" text="Acompanha idosos, dependentes e pessoas cuidadas com perfil livre." />
        <Card icon={Stethoscope} title="Profissional" text="Acessa somente dados autorizados e localiza pacientes já vinculados." />
        <Card icon={Landmark} title="Município" text="Cria programas, campanhas e pilotos por UBS, bairro ou grupo prioritário." />
      </section>

      <section className="rounded-[2rem] bg-white border border-gray-100 shadow-sm p-8 md:p-12">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">O que é e o que não é nesta fase</h2>
            <p className="text-gray-600 mt-4">
              A proposta atual é uma carteira digital complementar, útil para organização, cuidado familiar, programas locais e atendimento com contexto. Não estamos prometendo consulta automática a bases oficiais do SUS nesta fase.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Good text="CNS informado pelo cidadão, familiar, responsável ou município" />
            <Good text="CPF/CNS como chave de busca operacional com privacidade" />
            <Good text="UBS, município, equipe e prontuário local no Passport" />
            <Good text="Preparado para interoperabilidade futura quando institucionalmente viável" />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-gradient-to-br from-blue-50 to-emerald-50 p-8 md:p-12">
        <div className="text-center max-w-3xl mx-auto mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Fases de implantação</h2>
          <p className="text-gray-600 mt-3">Começamos simples, respeitando autorização, LGPD, escopo do piloto e responsabilidades institucionais.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {fases.map((fase) => <Good key={fase} text={fase} />)}
        </div>
      </section>

      <section className="rounded-[2rem] bg-slate-950 text-white p-8 md:p-12">
        <div className="grid md:grid-cols-[1fr_0.85fr] gap-8 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold">Mensagem comercial correta</h2>
            <p className="text-white/70 mt-4 text-lg">
              O HealthWallet é uma carteira de saúde digital complementar ao SUS, com CNS/Cartão SUS informado pelo cidadão. Para prefeituras, cria uma ponte entre cidadão, família, UBS, profissionais e programas municipais, sem substituir sistemas oficiais.
            </p>
          </div>
          <div className="rounded-3xl bg-white text-gray-900 p-6 space-y-3">
            <Good text="Não compete com o SUS" />
            <Good text="Complementa a jornada local" />
            <Good text="Fortalece prevenção e acompanhamento" />
            <Good text="Mantém os outros usos: profissionais, médicos e clínicas" />
          </div>
        </div>
      </section>
    </main>
  )
}

function Card({ icon: Icon, title, text }: any) {
  return (
    <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm">
      <Icon className="w-8 h-8 text-emerald-600 mb-4" />
      <h3 className="font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-2">{text}</p>
    </div>
  )
}

function Good({ text }: any) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4 text-sm text-gray-700 flex gap-2 shadow-sm">
      <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </div>
  )
}
