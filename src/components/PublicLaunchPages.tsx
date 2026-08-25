import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Globe2,
  HeartPulse,
  LockKeyhole,
  MessageCircle,
  MonitorSmartphone,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  WalletCards,
} from 'lucide-react'

export const mdFeatures = [
  { icon: Globe2, title: 'Página profissional e bio link', text: 'Crie uma presença digital clara para divulgar serviços, agenda, WhatsApp, links e pacotes.' },
  { icon: CalendarDays, title: 'Agenda e pré-atendimento', text: 'Organize horários, colete dados antes da consulta e reduza improviso operacional.' },
  { icon: QrCode, title: 'Recepção digital', text: 'Paciente faz check-in por QR Code; a equipe confere pendências e acompanha a fila.' },
  { icon: Stethoscope, title: 'Atendimento e prontuário', text: 'Registre consulta, histórico, evolução, SOAP, documentos e notas revisadas pelo profissional.' },
  { icon: Bot, title: 'IA assistiva supervisionada', text: 'Apoio para resumo, organização, mensagens e documentos. O profissional revisa, valida e decide.' },
  { icon: Banknote, title: 'Backoffice financeiro', text: 'Contas a pagar/receber, pacotes, recibos e cobrança pela plataforma ou recebimento externo.' },
]

export const hwFeatures = [
  { icon: WalletCards, title: 'Carteira digital de saúde', text: 'Documentos, exames, dados, medicamentos e informações importantes em um só lugar.' },
  { icon: ShieldCheck, title: 'Compartilhamento com consentimento', text: 'O paciente decide o que compartilhar com profissionais, clínicas ou familiares.' },
  { icon: ClipboardList, title: 'Histórico organizado', text: 'Acompanhe dados relevantes da jornada de cuidado e facilite retornos.' },
  { icon: MonitorSmartphone, title: 'Check-in pelo celular', text: 'Use o HealthWallet para acelerar entrada, cadastro e pré-atendimento quando autorizado.' },
]

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-slate-950">
          <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-white" />
          </span>
          HealthWallet<span className="text-emerald-600 -ml-1">.pro</span>
        </Link>
        <nav className="hidden lg:flex items-center gap-1 text-sm text-gray-700">
          <Link href="/mydatamed" className="px-3 py-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-700">MyDataMed</Link>
          <Link href="/healthwallet" className="px-3 py-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-700">HealthWallet</Link>
          <Link href="/para-medicos" className="px-3 py-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-700">Médicos</Link>
          <Link href="/para-clinicas" className="px-3 py-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-700">Clínicas</Link>
          <Link href="/para-pacientes" className="px-3 py-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-700">Pacientes</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden sm:inline-flex px-4 py-2 rounded-xl border font-semibold text-gray-700 hover:bg-gray-50">Entrar</Link>
          <Link href="/register" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700">
            Começar <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="bg-slate-950 text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 font-bold text-xl mb-3">
            <span className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center"><HeartPulse className="w-5 h-5" /></span>
            HealthWallet.pro
          </div>
          <p className="text-white/65 max-w-xl">MyDataMed para profissionais e clínicas. HealthWallet para pacientes e famílias. Um ecossistema brasileiro para organizar atendimento, dados e continuidade do cuidado.</p>
        </div>
        <div>
          <p className="font-bold mb-3">Produto</p>
          <div className="space-y-2 text-white/65 text-sm">
            <Link href="/mydatamed" className="block hover:text-white">MyDataMed</Link>
            <Link href="/healthwallet" className="block hover:text-white">HealthWallet</Link>
            <Link href="/recepcao-digital" className="block hover:text-white">Recepção digital</Link>
            <Link href="/planos" className="block hover:text-white">Planos</Link>
          </div>
        </div>
        <div>
          <p className="font-bold mb-3">Públicos</p>
          <div className="space-y-2 text-white/65 text-sm">
            <Link href="/para-medicos" className="block hover:text-white">Para médicos</Link>
            <Link href="/para-clinicas" className="block hover:text-white">Para clínicas</Link>
            <Link href="/para-pacientes" className="block hover:text-white">Para pacientes</Link>
            <Link href="/prefeituras" className="block hover:text-white">Municípios</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

export function Hero({ eyebrow, title, subtitle, primaryHref = '/register', primaryLabel = 'Começar agora', secondaryHref, secondaryLabel, children }: any) {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.28),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(20,184,166,0.18),transparent_28%)]" />
      <div className="relative max-w-7xl mx-auto px-4 py-20 md:py-28 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-4 py-2 text-sm text-emerald-100 mb-6">
            <Sparkles className="w-4 h-4" /> {eyebrow}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight">{title}</h1>
          <p className="text-lg md:text-xl text-white/70 mt-6 max-w-3xl">{subtitle}</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Link href={primaryHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 font-bold text-white hover:bg-emerald-600">
              {primaryLabel} <ArrowRight className="w-5 h-5" />
            </Link>
            {secondaryHref && <Link href={secondaryHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/10 px-6 py-4 font-semibold text-white hover:bg-white/15">{secondaryLabel}</Link>}
          </div>
        </div>
        <div>{children || <ProductCard />}</div>
      </div>
    </section>
  )
}

export function ProductCard() {
  return (
    <div className="rounded-[2rem] bg-white text-gray-900 p-5 shadow-2xl border border-white/20">
      <div className="rounded-3xl bg-gray-50 border p-4 mb-4">
        <p className="text-sm text-gray-500">Hoje no consultório</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <MiniMetric label="Agendados" value="12" />
          <MiniMetric label="Check-ins" value="8" />
          <MiniMetric label="A receber" value="R$ 2.840" />
          <MiniMetric label="Prontuários" value="5" />
        </div>
      </div>
      <div className="space-y-3">
        {[
          ['Paciente fez check-in por QR Code', 'Recepção conferiu pendências'],
          ['Consulta assistida criada', 'Prontuário em revisão'],
          ['Cobrança registrada', 'Recibo disponível'],
        ].map(([title, text]) => <div key={title} className="flex items-start gap-3 rounded-2xl border p-3"><CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" /><div><p className="font-semibold">{title}</p><p className="text-sm text-gray-500">{text}</p></div></div>)}
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white border p-3"><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-bold text-gray-900">{value}</p></div>
}

export function FeatureGrid({ features }: { features: Array<{ icon: any; title: string; text: string }> }) {
  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((item) => <FeatureCard key={item.title} {...item} />)}
      </div>
    </section>
  )
}

export function FeatureCard({ icon: Icon, title, text }: any) {
  return (
    <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6">
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-5"><Icon className="w-6 h-6" /></div>
      <h3 className="text-xl font-bold text-gray-900">{title}</h3>
      <p className="text-gray-600 mt-3 leading-relaxed">{text}</p>
    </div>
  )
}

export function SectionIntro({ eyebrow, title, text }: { eyebrow?: string; title: string; text: string }) {
  return (
    <div className="max-w-3xl mx-auto text-center px-4 py-14">
      {eyebrow && <p className="text-emerald-700 font-bold text-sm uppercase tracking-wide mb-3">{eyebrow}</p>}
      <h2 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight">{title}</h2>
      <p className="text-lg text-gray-600 mt-5">{text}</p>
    </div>
  )
}

export function Steps({ items }: { items: Array<{ title: string; text: string }> }) {
  return (
    <section className="bg-gray-50 border-y border-gray-100 py-16">
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-4">
        {items.map((item, index) => (
          <div key={item.title} className="rounded-3xl bg-white border border-gray-100 p-6">
            <div className="w-10 h-10 rounded-full bg-slate-950 text-white flex items-center justify-center font-bold mb-5">{index + 1}</div>
            <h3 className="text-xl font-bold text-gray-900">{item.title}</h3>
            <p className="text-gray-600 mt-3">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function CTA({ title, text, href = '/register', label = 'Começar agora' }: { title: string; text: string; href?: string; label?: string }) {
  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <div className="rounded-[2rem] bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-8 md:p-12 flex flex-col lg:flex-row gap-8 lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl md:text-5xl font-bold leading-tight">{title}</h2>
          <p className="text-white/80 mt-4 text-lg max-w-3xl">{text}</p>
        </div>
        <Link href={href} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-slate-950 font-bold hover:bg-emerald-50 flex-shrink-0">
          {label} <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </section>
  )
}

export const icons = {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Globe2,
  HeartPulse,
  LockKeyhole,
  MessageCircle,
  MonitorSmartphone,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  WalletCards,
}
