import {
  CTA,
  FeatureGrid,
  Hero,
  ProductCard,
  PublicFooter,
  PublicHeader,
  SectionIntro,
  Steps,
  mdFeatures,
} from '@/components/PublicLaunchPages'
import { CheckCircle } from 'lucide-react'

export default function MyDataMedPage() {
  return (
    <main className="min-h-screen bg-white">
      <PublicHeader />
      <Hero
        eyebrow="MyDataMed"
        title="O consultório digital completo para profissionais de saúde."
        subtitle="Agenda, página profissional, recepção por QR Code, pré-atendimento, prontuário eletrônico, IA assistiva, cobranças, recibos, CRM e backoffice em um só lugar."
        primaryHref="/register"
        primaryLabel="Criar consultório digital"
        secondaryHref="/para-medicos"
        secondaryLabel="Ver para médicos"
      >
        <ProductCard />
      </Hero>

      <SectionIntro
        eyebrow="Produto"
        title="Do primeiro paciente ao fluxo de caixa."
        text="O MyDataMed foi pensado para tirar o profissional do improviso. Em vez de usar uma ferramenta para agenda, outra para cobrança, outra para documentos e outra para atendimento, o consultório passa a operar em uma plataforma integrada."
      />
      <FeatureGrid features={mdFeatures} />

      <section className="bg-slate-950 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
          <div>
            <p className="text-emerald-300 font-bold text-sm uppercase tracking-wide mb-3">Operação real</p>
            <h2 className="text-3xl md:text-5xl font-bold leading-tight">O paciente entra melhor. O profissional atende com mais contexto. O financeiro fica organizado.</h2>
            <p className="text-white/65 mt-5 text-lg">A proposta não é substituir o profissional. É reduzir retrabalho, organizar dados, padronizar rotinas e dar estrutura para atendimento, documentação e gestão.</p>
          </div>
          <div className="rounded-[2rem] bg-white/10 border border-white/10 p-5 space-y-3">
            {[
              'Página pública e bio link para divulgação',
              'Agenda e pré-atendimento para reduzir improviso',
              'Check-in por QR Code para recepção digital',
              'Prontuário eletrônico com nota revisada pelo profissional',
              'Cobrança opcional pela plataforma, Pix próprio ou link externo',
              'Recibos e contas a pagar/receber no backoffice',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl bg-white/10 p-3">
                <CheckCircle className="w-5 h-5 text-emerald-300 mt-0.5" />
                <span className="text-white/85">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionIntro
        eyebrow="Como funciona"
        title="Uma jornada simples para profissional, clínica e paciente."
        text="O MyDataMed organiza a frente digital, a operação do atendimento e o backoffice para que o profissional consiga atender, cobrar, registrar e acompanhar melhor."
      />
      <Steps items={[
        { title: 'Monte sua presença', text: 'Crie sua página profissional, biolink, serviços, pacotes, WhatsApp, agenda e dados comerciais.' },
        { title: 'Receba e atenda', text: 'Use agenda, pré-atendimento, recepção digital, entrada do paciente e consulta assistida.' },
        { title: 'Documente e acompanhe', text: 'Finalize prontuário, emita recibo, controle cobranças e acompanhe retornos com CRM.' },
      ]} />

      <CTA
        title="Seu consultório digital pronto para operar."
        text="Comece com uma estrutura simples, profissional e escalável para atender, documentar, cobrar e crescer."
        href="/register"
        label="Criar conta no MyDataMed"
      />
      <PublicFooter />
    </main>
  )
}
