'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle,
  ClipboardCheck,
  CreditCard,
  FileText,
  HeartPulse,
  Landmark,
  MessageCircle,
  MonitorSmartphone,
  QrCode,
  Shield,
  Sparkles,
  Stethoscope,
  Users,
  Video,
  Wallet,
} from 'lucide-react'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.push('/dashboard')
  }, [user, loading, router])

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" /></div>
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-10 space-y-16">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center"><HeartPulse className="w-6 h-6" /></div>
          <div>
            <p className="font-bold text-gray-900 text-lg">MyDataMed</p>
            <p className="text-xs text-gray-500">HealthWallet para pacientes + operação de saúde</p>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-6 text-sm text-gray-600">
          <a href="#healthwallet" className="hover:text-emerald-700">HealthWallet</a>
          <a href="#mydatamed" className="hover:text-emerald-700">MyDataMed</a>
          <Link href="/recepcao-digital" className="hover:text-emerald-700">Recepção digital</Link>
          <Link href="/tour" className="hover:text-emerald-700">Tour</Link>
          <Link href="/prefeituras" className="hover:text-emerald-700">Prefeituras</Link>
        </nav>

        <div className="flex gap-2">
          <Link href="/login" className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50">Entrar</Link>
          <Link href="/register" className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700">Cadastrar</Link>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-8 md:p-14">
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -left-20 bottom-0 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-emerald-100 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" /> Ecossistema de saúde digital para pacientes, famílias, profissionais, clínicas, prefeituras e parceiros
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-5">
              HealthWallet organiza os dados. MyDataMed organiza a chegada, o atendimento e o pós-atendimento.
            </h1>
            <p className="text-lg md:text-xl text-white/75 max-w-3xl mb-8">
              Uma infraestrutura para conectar paciente, família, profissional, clínica e parceiros: carteira digital de saúde, dados autorizados, recepção por QR Code, consulta assistida, documentos, CRM e continuidade do cuidado.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/recepcao-digital" className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600">
                Ver recepção digital
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/register" className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/10 border border-white/15 text-white font-semibold hover:bg-white/15">
                Começar como profissional
              </Link>
              <Link href="/tour" className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/10 border border-white/15 text-white font-semibold hover:bg-white/15">
                Ver tour por público
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 border border-white/10 p-5 backdrop-blur">
            <div className="rounded-2xl bg-white text-gray-900 p-5 shadow-2xl">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><QrCode className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-gray-500">Novo fluxo de recepção</p>
                  <h3 className="text-xl font-bold">O paciente faz o check-in sozinho</h3>
                </div>
              </div>
              <div className="space-y-2">
                <CockpitRow icon={MonitorSmartphone} title="QR Code no balcão" text="A clínica deixa a tela de autoatendimento aberta." />
                <CockpitRow icon={ClipboardCheck} title="Pré-atendimento digital" text="Paciente preenche dados, motivo, plano e consentimentos." />
                <CockpitRow icon={Users} title="Fila automática" text="Recepção confere pendências e o profissional atende com contexto." />
                <CockpitRow icon={MessageCircle} title="Pós-atendimento" text="Follow-up, lembretes, retornos e relacionamento via ecossistema." />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-4">
        <AudienceCard icon={HeartPulse} title="Pacientes e famílias" text="Organizam exames, receitas, medicamentos, genética, dependentes e compartilhamentos autorizados." href="#healthwallet" />
        <AudienceCard icon={Stethoscope} title="Profissionais" text="Atendem com dados autorizados, IA assistiva, documentos, agenda, teleconsulta e CRM." href="#mydatamed" />
        <AudienceCard icon={Building2} title="Clínicas" text="Reduzem papelada, fila e digitação na entrada com QR Code, pré-atendimento e fila digital." href="/recepcao-digital" />
        <AudienceCard icon={Landmark} title="Prefeituras" text="Podem usar a camada de cuidado cidadão, família, UBS, programas de saúde e acompanhamento." href="/prefeituras" />
      </section>

      <section id="recepcao" className="rounded-[2rem] bg-gradient-to-br from-emerald-50 to-blue-50 p-8 md:p-12">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-emerald-700 text-sm font-medium mb-4">
              <MonitorSmartphone className="w-4 h-4" /> Recepção digital por QR Code
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Menos fila, menos papel, menos digitação.</h2>
            <p className="text-gray-600 text-lg mb-6">
              O paciente escaneia o QR Code da clínica, preenche sozinho e entra automaticamente na fila. A equipe deixa de coletar tudo do zero e passa a conferir pendências, documentos e exceções.
            </p>
            <div className="space-y-3">
              <Check text="Entrada automática na fila da clínica" />
              <Check text="Dados pessoais, motivo, sintomas, plano/carteirinha e consentimentos" />
              <Check text="Base administrativa melhor para reduzir retrabalho e erros que podem gerar glosas" />
            </div>
            <Link href="/recepcao-digital" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold hover:bg-emerald-700">
              Entender recepção digital <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          <div className="rounded-3xl bg-slate-950 text-white p-6">
            <p className="text-sm text-emerald-200 mb-4">Fluxo operacional</p>
            <div className="space-y-3">
              <FlowItem number="1" text="Clínica abre tela de recepção com QR Code" />
              <FlowItem number="2" text="Paciente escaneia e preenche pelo celular" />
              <FlowItem number="3" text="Sistema cria Entrada do Paciente automaticamente" />
              <FlowItem number="4" text="Atendente confere pendências e exceções" />
              <FlowItem number="5" text="Profissional inicia Consulta Assistida com contexto" />
            </div>
          </div>
        </div>
      </section>

      <section id="healthwallet" className="space-y-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full text-emerald-700 text-sm font-medium mb-4"><HeartPulse className="w-4 h-4" /> HealthWallet</div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">A carteira digital de saúde do paciente.</h2>
          <p className="text-gray-600 text-lg">O paciente guarda exames, receitas, medicamentos, dados familiares, documentos, genética e permissões de compartilhamento. Ele decide o que compartilhar e quando compartilhar.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          <AreaCard icon={Users} title="Família e dependentes" text="Perfis familiares, cuidado de idosos, crianças, acompanhantes e responsáveis." />
          <AreaCard icon={FileText} title="Exames e documentos" text="Cofre de saúde com timeline, receitas, laudos, histórico e resumos." />
          <AreaCard icon={Shield} title="Dados autorizados" text="Compartilhamento controlado com profissionais, clínicas e programas de saúde." />
        </div>
      </section>

      <section id="mydatamed" className="space-y-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-700 text-sm font-medium mb-4"><Stethoscope className="w-4 h-4" /> MyDataMed</div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">A operação digital do atendimento.</h2>
          <p className="text-gray-600 text-lg">Profissionais e clínicas recebem dados autorizados, organizam a entrada, atendem com IA assistiva, fazem teleconsulta, geram documentos e mantêm relacionamento pós-atendimento.</p>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          <TechStep icon={ClipboardCheck} title="Entrada do Paciente" text="Fila, status, pendências, checklist e consentimentos." />
          <TechStep icon={Video} title="Teleconsulta" text="Agenda, sala online, links e acompanhamento." />
          <TechStep icon={Bot} title="SmartBots CRM" text="Confirmação, retorno, pós-atendimento e reativação." />
          <TechStep icon={Wallet} title="Pagamentos" text="Base para Pix, cobrança, planos e recorrência." />
        </div>
      </section>

      <section className="rounded-[2rem] bg-white border border-gray-100 shadow-sm p-8 md:p-12">
        <div className="grid md:grid-cols-[1fr_0.9fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-700 text-sm font-medium mb-4"><Landmark className="w-4 h-4" /> Saúde pública e parceiros</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Também faz sentido para prefeituras, clínicas, redes e parceiros de tecnologia.</h2>
            <p className="text-gray-600 mb-5">A camada de dados autorizados, recepção digital, acompanhamento e pós-atendimento pode complementar sistemas existentes sem substituir o ERP principal do parceiro.</p>
            <div className="space-y-3">
              <Check text="Jornada do paciente antes, durante e depois do atendimento" />
              <Check text="Pós-venda, adesão, lembretes e relacionamento com consentimento" />
              <Check text="Base para integrações futuras com parceiros, planos, TISS/TUSS e operações administrativas" />
            </div>
          </div>
          <div className="rounded-3xl bg-slate-950 text-white p-6">
            <p className="text-sm text-emerald-200 mb-4">Oportunidade de ecossistema</p>
            <FlowItem number="1" text="Paciente organiza dados no HealthWallet" />
            <FlowItem number="2" text="Clínica recebe entrada digital no MyDataMed" />
            <FlowItem number="3" text="Profissional atende com contexto e IA assistiva" />
            <FlowItem number="4" text="Pós-atendimento mantém adesão e relacionamento" />
          </div>
        </div>
      </section>

      <section id="planos" className="rounded-[2rem] bg-slate-950 p-8 md:p-12 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-emerald-100 text-sm font-medium mb-4"><CreditCard className="w-4 h-4" /> Modelo modular</div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Comece com dados autorizados. Evolua para operação, recepção, atendimento e relacionamento.</h2>
          <p className="text-white/70 mb-6">O ecossistema pode ser adotado por profissionais, clínicas, redes, programas públicos e parceiros comerciais de forma gradual.</p>
          <Link href="/register" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700">
            Criar conta profissional <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </main>
  )
}

function CockpitRow({ icon: Icon, title, text }: any) {
  return <div className="flex items-center gap-3 rounded-2xl border bg-gray-50 p-3"><div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><Icon className="w-5 h-5" /></div><div><p className="font-semibold text-sm">{title}</p><p className="text-xs text-gray-500">{text}</p></div></div>
}

function AudienceCard({ icon: Icon, title, text, href }: any) {
  return <Link href={href} className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"><div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4"><Icon className="w-5 h-5" /></div><h3 className="font-bold text-gray-900 mb-1">{title}</h3><p className="text-sm text-gray-600 leading-relaxed">{text}</p><span className="inline-flex items-center gap-1 text-sm text-emerald-700 font-semibold mt-4">Ver mais <ArrowRight className="w-4 h-4" /></span></Link>
}

function AreaCard({ icon: Icon, title, text }: any) {
  return <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6"><div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4"><Icon className="w-6 h-6" /></div><h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3><p className="text-gray-600 text-sm leading-relaxed">{text}</p></div>
}

function TechStep({ icon: Icon, title, text }: any) {
  return <div className="rounded-3xl bg-white border border-gray-100 p-5 shadow-sm"><div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4"><Icon className="w-5 h-5" /></div><h3 className="font-bold text-gray-900 mb-2">{title}</h3><p className="text-sm text-gray-600 leading-relaxed">{text}</p></div>
}

function Check({ text }: any) {
  return <div className="flex items-start gap-2 text-sm text-gray-700"><CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /><span>{text}</span></div>
}

function FlowItem({ number, text }: any) {
  return <div className="flex items-center gap-3 rounded-2xl bg-white/10 border border-white/10 p-3 mb-3"><div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{number}</div><p className="text-sm text-white/85">{text}</p></div>
}
