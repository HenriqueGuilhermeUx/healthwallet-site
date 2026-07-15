-- =====================================================
-- MYDATAMED - NEXTGEN FINANCEIRO V1
-- Execute no Supabase SQL Editor.
-- Objetivo: habilitar cobranças de teleconsulta, cobranças avulsas,
-- planos mensais/recorrentes e vínculo operacional com NextGen/Woovi.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabela base de cobranças profissionais, caso ainda não exista no projeto.
CREATE TABLE IF NOT EXISTS public.professional_payment_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID,
  professional_user_id UUID,
  professional_id UUID,
  patient_id UUID,
  patient_email TEXT,
  charge_type TEXT DEFAULT 'custom',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents INTEGER DEFAULT 0,
  professional_net_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  status TEXT DEFAULT 'draft',
  provider TEXT DEFAULT 'nextgen_woovi',
  provider_charge_id TEXT,
  correlation_id TEXT,
  pix_qr_code TEXT,
  pix_copy_paste TEXT,
  qr_code_image TEXT,
  payment_url TEXT,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  provider_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS plan_id UUID;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS appointment_id UUID;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS recurrence_interval TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS product_key TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS billing_context TEXT DEFAULT 'professional';
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS external_reference TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS nextgen_charge_id TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS woovi_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_professional_payment_charges_professional_id ON public.professional_payment_charges(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_payment_charges_patient_id ON public.professional_payment_charges(patient_id);
CREATE INDEX IF NOT EXISTS idx_professional_payment_charges_status ON public.professional_payment_charges(status);
CREATE INDEX IF NOT EXISTS idx_professional_payment_charges_type ON public.professional_payment_charges(charge_type);
CREATE INDEX IF NOT EXISTS idx_professional_payment_charges_correlation_id ON public.professional_payment_charges(correlation_id);

CREATE TABLE IF NOT EXISTS public.professional_billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_user_id UUID NOT NULL,
  professional_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  interval TEXT DEFAULT 'monthly' CHECK (interval IN ('one_time','weekly','monthly','quarterly','yearly')),
  status TEXT DEFAULT 'active' CHECK (status IN ('draft','active','paused','archived')),
  product_key TEXT DEFAULT 'mydatamed-professional-plan',
  features JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_professional_billing_plans_professional_id ON public.professional_billing_plans(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_billing_plans_user_id ON public.professional_billing_plans(professional_user_id);
CREATE INDEX IF NOT EXISTS idx_professional_billing_plans_status ON public.professional_billing_plans(status);

ALTER TABLE public.professional_payment_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_billing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Professionals manage own payment charges" ON public.professional_payment_charges;
CREATE POLICY "Professionals manage own payment charges"
ON public.professional_payment_charges
FOR ALL
USING (auth.uid() = professional_user_id)
WITH CHECK (auth.uid() = professional_user_id);

DROP POLICY IF EXISTS "Professionals manage own billing plans" ON public.professional_billing_plans;
CREATE POLICY "Professionals manage own billing plans"
ON public.professional_billing_plans
FOR ALL
USING (auth.uid() = professional_user_id)
WITH CHECK (auth.uid() = professional_user_id);

-- Regras de produto:
-- - NextGen é a camada financeira do MyDataMed.
-- - Woovi/Pix pode ser usado como trilho de cobrança.
-- - Tipos recomendados: teleconsultation, consultation, subscription, recurring_plan, monthly_plan, custom.
-- - Planos recorrentes começam como cadastro operacional e podem evoluir para cobrança automática conforme provedor disponível.
