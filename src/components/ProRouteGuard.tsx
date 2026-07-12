'use client'

import Link from 'next/link'
import { ReactNode } from 'react'
import { useProfessionalAccess } from '@/hooks/useProfessionalAccess'
import { ArrowRight, Gift, Loader2, Lock, ShieldCheck, Sparkles, Wallet } from 'lucide-react'

type ProRouteGuardProps = {
  children: ReactNode
  featureKey: string
  featureName: string
  description?: string
}

export default function ProRouteGuard({ children, featureKey, featureName, description }: ProRouteGuardProps) {
  const access = useProfessionalAccess()

  if (access.loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (access.hasAccess(featureKey)) {
    return <>{children}</>
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <section className="rounded-[2rem] bg-slate-950 text-white p-6 md:p-10 overflow-hidden relative">
        <div className="absolute -right-16 -top-16 w-60 h-60 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative grid md:grid-cols-[1fr_0.8fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5">
              <Lock className="w-4 h-4" />
              Recurso do MyDataMed Pro
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-3">{featureName}</h1>
            <p className="text-white/75 text-lg max-w-2xl">
              {description || 'Este recurso faz parte da área comercial do MyDataMed Pro.'}
            </p>

            <div className="grid sm:grid-cols-3 gap-3 mt-6">
              <MiniInfo icon={ShieldCheck} title="Free sempre" text="Acesso aos dados autorizados dos pacientes continua grátis." />
              <MiniInfo icon={Gift} title="15 dias livres" text="Teste a área comercial sem cobrança inicial." />
              <MiniInfo icon={Wallet} title="R$ 79,90/mês" text="Ative por Pix Woovi/NextGen quando quiser." />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link href="/pro" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white px-6 py-3 font-semibold hover:bg-emerald-600">
                Ativar 15 dias grátis
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 text-white px-6 py-3 font-semibold hover:bg-white/15">
                Voltar ao acesso gratuito
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-white text-gray-900 p-6 shadow-2xl">
            <Sparkles className="w-8 h-8 text-emerald-600 mb-4" />
            <h2 className="text-xl font-bold mb-2">Área comercial bloqueada</h2>
            <p className="text-sm text-gray-600 mb-5">
              Profissionais gratuitos podem acessar dados autorizados. Para operar teleconsulta, CRM/Bots, pagamentos e documentos comerciais, ative o Pro.
            </p>
            <div className="space-y-2 text-sm text-gray-700">
              <Check text="Teleconsulta e agenda" />
              <Check text="SmartBots CRM e follow-up" />
              <Check text="Pix Woovi/NextGen" />
              <Check text="Documentos e assinatura profissional" />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function MiniInfo({ icon: Icon, title, text }: any) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
      <Icon className="w-5 h-5 text-emerald-200 mb-2" />
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-white/60 mt-1">{text}</p>
    </div>
  )
}

function Check({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <ShieldCheck className="w-4 h-4 text-emerald-600" />
      <span>{text}</span>
    </div>
  )
}
