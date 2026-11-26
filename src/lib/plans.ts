// Tabela única de planos do MyDataMed. Toda tela e toda cobrança leem daqui.
export type PlanCode = 'free' | 'start' | 'pro' | 'clinic'
export type PaidPlanCode = Exclude<PlanCode, 'free'>

export type Plan = {
  code: PlanCode
  name: string
  priceCents: number
  visits: number
  modoCredits: number
  description: string
}

export const TRIAL_DAYS = 15

export const PLANS: Record<PlanCode, Plan> = {
  free: {
    code: 'free',
    name: 'Free Dados',
    priceCents: 0,
    visits: 0,
    modoCredits: 0,
    description: 'Para entrar na rede MyDataMed e acessar dados que o paciente decide compartilhar.',
  },
  start: {
    code: 'start',
    name: 'Start',
    priceCents: 12900,
    visits: 100,
    modoCredits: 0,
    description: 'Para começar com consultório digital, agenda, página, IA, CRM e backoffice.',
  },
  pro: {
    code: 'pro',
    name: 'Pro',
    priceCents: 19900,
    visits: 200,
    modoCredits: 500,
    description: 'Para operar e crescer com MODO, CRM avançado, automações e assistente.',
  },
  clinic: {
    code: 'clinic',
    name: 'Clinic',
    priceCents: 39900,
    visits: 400,
    modoCredits: 1200,
    description: 'Para clínicas/equipes com recepção digital, múltiplos profissionais e gestão.',
  },
}

export const PAID_PLAN_CODES: PaidPlanCode[] = ['start', 'pro', 'clinic']

export function isPaidPlanCode(value: unknown): value is PaidPlanCode {
  return typeof value === 'string' && (PAID_PLAN_CODES as string[]).includes(value)
}

export function formatPlanPrice(plan: Plan, withPeriod = true) {
  if (plan.priceCents === 0) return 'R$ 0'
  const reais = plan.priceCents / 100
  const value = Number.isInteger(reais)
    ? `R$ ${reais}`
    : `R$ ${reais.toFixed(2).replace('.', ',')}`
  return withPeriod ? `${value}/mês` : value
}

export const LOWEST_PAID_PRICE_LABEL = formatPlanPrice(PLANS.start)
