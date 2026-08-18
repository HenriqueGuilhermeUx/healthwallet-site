'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  CheckCircle,
  ClipboardCheck,
  Clock,
  FileText,
  HeartPulse,
  MonitorSmartphone,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react'

export default function RecepcaoDigitalLandingPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-10 space-y-16">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-8 md:p-14">
        <div className="absolute -right-16 -top-20 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -left-16 bottom-0 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-emerald-100 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" /> Novo módulo MyDataMed
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-5">
              Recepção digital: o paciente faz o check-in sozinho.
            </h1>
            <p className="text-lg md:text-xl text-white/75 max-w-3xl mb-8">
              A clínica exibe um QR Code na recepção. O paciente escaneia, preenche os dados no próprio celular e entra automaticamente na fila. A equipe confere pendências, reduz digitação e começa o atendimento com informações organizadas.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600">
                Conhecer o MyDataMed
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/tour#clinicas" className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/10 border border-white/15 text-white font-semibold hover:bg-white/15">
                Ver uso para clínicas
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 border border-white/10 p-5 backdrop-blur">
            <div className="rounded-2xl bg-white text-gray-900 p-5 shadow-2xl">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <QrCode className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Tela da recepção</p>
                  <h3 className="text-xl font-bold">Faça seu check-in</h3>
                </div>
              </div>
              <div className="rounded-3xl border-8 border-slate-950 bg-white p-8 flex items-center justify-center mb-5">
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 25 }).map((_, index) => (
                    <div key={index} className={`w-7 h-7 rounded ${[0,1,2,5,10,11,12,14,16,18,20,21,22,23,24].includes(index) ? 'bg-slate-950' : 'bg-gray-100'}`} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <DemoRow icon={Smartphone} title="Paciente escaneia" text="Usa o próprio celular, sem app obrigatório." />
                <DemoRow icon={ClipboardCheck} title="Preenche sozinho" text="Dados, motivo, plano/carteirinha e consentimentos." />
                <DemoRow icon={Users} title="Entra na fila" text="A recepção acompanha e resolve exceções." />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-4">
        <PainCard icon={Clock} title="Fila e espera" text="A chegada do paciente deixa de começar com uma entrevista manual no balcão." />
        <PainCard icon={FileText} title="Papelada" text="Dados e consentimentos são coletados digitalmente antes da conferência." />
        <PainCard icon={Users} title="Recepção sobrecarregada" text="A equipe deixa de digitar tudo e passa a acompanhar pendências e exceções." />
        <PainCard icon={ShieldCheck} title="Dados administrativos" text="Plano, carteirinha e motivo chegam estruturados para conferência." />
      </section>

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full text-emerald-700 text-sm font-medium mb-4">
            <MonitorSmartphone className="w-4 h-4" /> Como funciona
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Um fluxo simples para reduzir atrito na chegada.</h2>
          <p className="text-gray-600 text-lg">
            A proposta não é substituir o atendimento humano. É tirar da recepção o trabalho repetitivo de coletar, perguntar e digitar tudo do zero. O paciente informa o básico, a equipe confere e o profissional recebe o contexto pronto.
          </p>
        </div>

        <div className="rounded-[2rem] bg-white border border-gray-100 shadow-sm p-6 space-y-3">
          <Step number="1" title="Clínica abre a tela de recepção" text="O MyDataMed gera um QR Code para deixar em monitor, tablet, totem ou balcão." />
          <Step number="2" title="Paciente faz autoatendimento" text="Pelo celular, ele preenche dados pessoais, motivo, sintomas, plano/carteirinha e consentimentos." />
          <Step number="3" title="Entrada nasce automaticamente" text="O envio cria a Entrada do Paciente e entra na fila da clínica sem conversão manual." />
          <Step number="4" title="Equipe confere pendências" text="Um atendente acompanha a fila, corrige exceções e libera o paciente para o atendimento." />
          <Step number="5" title="Profissional atende com contexto" text="A Consulta Assistida começa com dados organizados, menos papel e menos retrabalho." />
        </div>
      </section>

      <section className="rounded-[2rem] bg-gradient-to-br from-gray-50 to-emerald-50 p-8 md:p-12">
        <div className="text-center max-w-3xl mx-auto mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Onde isso gera valor</h2>
          <p className="text-gray-600">A mesma camada pode ser usada por clínicas, redes, profissionais, programas públicos e parceiros que precisam de dados autorizados, entrada organizada e pós-atendimento melhor.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          <ValueCard icon={Building2} title="Clínicas e redes" text="Menos balcão operacional, menos papel, mais padronização e fila digital." />
          <ValueCard icon={Stethoscope} title="Profissionais" text="Chegada mais organizada e atendimento iniciado com histórico, motivo e observações." />
          <ValueCard icon={HeartPulse} title="Pacientes e famílias" text="Experiência mais simples: preencher uma vez, compartilhar com consentimento e acompanhar depois." />
        </div>
      </section>

      <section className="rounded-[2rem] bg-slate-950 text-white p-8 md:p-12 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">HealthWallet organiza os dados. MyDataMed organiza a chegada e o atendimento.</h2>
        <p className="text-white/70 max-w-3xl mx-auto mb-6">
          A recepção digital é o próximo passo do ecossistema: paciente, clínica, profissional e parceiro trabalhando sobre uma jornada mais simples, autorizada e contínua.
        </p>
        <Link href="/register" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600">
          Começar pelo MyDataMed
          <ArrowRight className="w-5 h-5" />
        </Link>
      </section>
    </main>
  )
}

function DemoRow({ icon: Icon, title, text }: any) {
  return <div className="flex items-center gap-3 rounded-2xl bg-gray-50 border p-3"><Icon className="w-5 h-5 text-emerald-700" /><div><p className="font-semibold text-sm">{title}</p><p className="text-xs text-gray-500">{text}</p></div></div>
}

function PainCard({ icon: Icon, title, text }: any) {
  return <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6"><Icon className="w-7 h-7 text-emerald-700 mb-4" /><h3 className="font-bold text-gray-900 mb-2">{title}</h3><p className="text-sm text-gray-600 leading-relaxed">{text}</p></div>
}

function Step({ number, title, text }: any) {
  return <div className="flex gap-3 rounded-2xl bg-gray-50 border border-gray-100 p-4"><div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0">{number}</div><div><p className="font-bold text-gray-900">{title}</p><p className="text-sm text-gray-600 mt-1">{text}</p></div></div>
}

function ValueCard({ icon: Icon, title, text }: any) {
  return <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm"><Icon className="w-7 h-7 text-emerald-700 mb-4" /><h3 className="font-bold text-gray-900 mb-2">{title}</h3><p className="text-sm text-gray-600 leading-relaxed">{text}</p></div>
}
