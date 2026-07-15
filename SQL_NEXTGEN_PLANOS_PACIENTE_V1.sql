-- =====================================================
-- MYDATAMED - NEXTGEN PLANOS POR PACIENTE V1
-- Execute no Supabase SQL Editor depois de SQL_NEXTGEN_FINANCEIRO_V1.sql.
-- Objetivo: habilitar planos mensais/recorrentes de acompanhamento por paciente.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.professional_patient_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_user_id UUID NOT NULL,
  professional_id UUID,
  patient_id UUID,
  patient_name TEXT,
  patient_email TEXT,
  plan_id UUID,
  plan_name TEXT NOT NULL,
  description TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  interval TEXT DEFAULT 'monthly' CHECK (interval IN ('weekly','monthly','quarterly','yearly')),
  status TEXT DEFAULT 'active' CHECK (status IN ('draft','active','paused','cancelled','archived')),
  start_date DATE DEFAULT CURRENT_DATE,
  next_charge_at TIMESTAMPTZ,
  last_charge_id UUID,
  last_charge_status TEXT,
  last_charged_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_professional_patient_plans_professional_id ON public.professional_patient_plans(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_patient_plans_professional_user_id ON public.professional_patient_plans(professional_user_id);
CREATE INDEX IF NOT EXISTS idx_professional_patient_plans_patient_id ON public.professional_patient_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_professional_patient_plans_status ON public.professional_patient_plans(status);
CREATE INDEX IF NOT EXISTS idx_professional_patient_plans_next_charge_at ON public.professional_patient_plans(next_charge_at);

-- Garante vínculo de plano de paciente em cobranças.
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS patient_plan_id UUID;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS plan_id UUID;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS recurrence_interval TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS product_key TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS billing_context TEXT DEFAULT 'professional';
CREATE INDEX IF NOT EXISTS idx_professional_payment_charges_patient_plan_id ON public.professional_payment_charges(patient_plan_id);

ALTER TABLE public.professional_patient_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Professionals manage own patient plans" ON public.professional_patient_plans;
CREATE POLICY "Professionals manage own patient plans"
ON public.professional_patient_plans
FOR ALL
USING (auth.uid() = professional_user_id)
WITH CHECK (auth.uid() = professional_user_id);

-- Regras de produto:
-- - Plano por paciente é acompanhamento contínuo profissional, não plano de saúde.
-- - Pode incluir retornos, teleorientações, revisão de exames, CRM/SmartBots e acompanhamento.
-- - NextGen cria a cobrança inicial e organiza recorrência operacional.
-- - Cobrança automática recorrente pode evoluir conforme trilho financeiro disponível.
