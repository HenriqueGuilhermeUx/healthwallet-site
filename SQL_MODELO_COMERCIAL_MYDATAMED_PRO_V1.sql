-- =====================================================
-- MYDATAMED - MODELO COMERCIAL FREE + PRO V1
-- Execute no Supabase SQL Editor.
-- Objetivo: separar acesso gratuito a dados autorizados de pacientes
-- da área comercial paga para teleconsulta, CRM, bots, pagamentos e documentos.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Evolução da assinatura profissional existente
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS free_patient_data_access BOOLEAN DEFAULT true;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS commercial_area_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 15;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS pro_started_at TIMESTAMPTZ;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS pro_cancelled_at TIMESTAMPTZ;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS monthly_price_cents INTEGER DEFAULT 7990;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL';
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS billing_provider TEXT DEFAULT 'woovi';
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS nextgen_customer_id TEXT;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS woovi_customer_id TEXT;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{"free_patient_data_access":true,"teleconsultation":false,"crm_bots":false,"payments_nextgen":false,"documents_signature":false,"google_calendar_meet":false}'::jsonb;

-- 2) Tabela de permissões comerciais por profissional
CREATE TABLE IF NOT EXISTS public.professional_feature_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id UUID,
  feature_key TEXT NOT NULL,
  access_level TEXT DEFAULT 'free' CHECK (access_level IN ('free', 'trial', 'pro', 'blocked')),
  enabled BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'system',
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (professional_user_id, feature_key)
);

-- feature_key sugeridos:
-- patient_data_access_free, teleconsultation, google_calendar_meet,
-- crm_smartbots, payments_nextgen_woovi, split_repasses, professional_documents,
-- professional_signature, patient_follow_up, commercial_dashboard

-- 3) Tabela de planos públicos
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  trial_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  features JSONB DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.subscription_plans (slug, name, price_cents, trial_days, features, description)
SELECT 'mydatamed-free', 'MyDataMed Free', 0, 0,
'{"patient_data_access_free":true,"teleconsultation":false,"crm_smartbots":false,"payments_nextgen_woovi":false,"professional_documents":false}'::jsonb,
'Acesso gratuito para profissionais cadastrados visualizarem dados autorizados por pacientes.'
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE slug = 'mydatamed-free');

INSERT INTO public.subscription_plans (slug, name, price_cents, trial_days, features, description)
SELECT 'mydatamed-pro', 'MyDataMed Pro', 7990, 15,
'{"patient_data_access_free":true,"teleconsultation":true,"google_calendar_meet":true,"crm_smartbots":true,"payments_nextgen_woovi":true,"split_repasses":true,"professional_documents":true,"professional_signature":true,"patient_follow_up":true,"commercial_dashboard":true}'::jsonb,
'Área comercial para teleconsulta, agenda, CRM, bots, pagamentos Pix, repasses e documentos profissionais.'
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE slug = 'mydatamed-pro');

-- 4) Função para iniciar trial Pro por 15 dias
CREATE OR REPLACE FUNCTION public.start_mydatamed_pro_trial(p_professional_user_id UUID, p_professional_id UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  INSERT INTO public.professional_subscriptions (
    professional_user_id,
    professional_id,
    plan_name,
    plan_price_cents,
    monthly_price_cents,
    billing_cycle,
    status,
    free_patient_data_access,
    commercial_area_enabled,
    trial_days,
    trial_started_at,
    trial_ends_at,
    current_period_starts_at,
    current_period_ends_at,
    features
  ) VALUES (
    p_professional_user_id,
    p_professional_id,
    'MyDataMed Pro',
    7990,
    7990,
    'monthly',
    'trial',
    true,
    true,
    15,
    NOW(),
    NOW() + INTERVAL '15 days',
    NOW(),
    NOW() + INTERVAL '15 days',
    '{"free_patient_data_access":true,"teleconsultation":true,"google_calendar_meet":true,"crm_bots":true,"payments_nextgen":true,"documents_signature":true}'::jsonb
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_subscription_id;

  INSERT INTO public.professional_feature_access (professional_user_id, professional_id, feature_key, access_level, enabled, starts_at, ends_at, source)
  VALUES
    (p_professional_user_id, p_professional_id, 'patient_data_access_free', 'free', true, NOW(), NULL, 'system'),
    (p_professional_user_id, p_professional_id, 'teleconsultation', 'trial', true, NOW(), NOW() + INTERVAL '15 days', 'trial'),
    (p_professional_user_id, p_professional_id, 'google_calendar_meet', 'trial', true, NOW(), NOW() + INTERVAL '15 days', 'trial'),
    (p_professional_user_id, p_professional_id, 'crm_smartbots', 'trial', true, NOW(), NOW() + INTERVAL '15 days', 'trial'),
    (p_professional_user_id, p_professional_id, 'payments_nextgen_woovi', 'trial', true, NOW(), NOW() + INTERVAL '15 days', 'trial'),
    (p_professional_user_id, p_professional_id, 'professional_documents', 'trial', true, NOW(), NOW() + INTERVAL '15 days', 'trial'),
    (p_professional_user_id, p_professional_id, 'commercial_dashboard', 'trial', true, NOW(), NOW() + INTERVAL '15 days', 'trial')
  ON CONFLICT (professional_user_id, feature_key)
  DO UPDATE SET access_level = EXCLUDED.access_level,
                enabled = EXCLUDED.enabled,
                starts_at = EXCLUDED.starts_at,
                ends_at = EXCLUDED.ends_at,
                source = EXCLUDED.source,
                updated_at = NOW();

  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) RLS
ALTER TABLE public.professional_feature_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_public_read" ON public.subscription_plans;
CREATE POLICY "plans_public_read" ON public.subscription_plans
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "professional_feature_access_read_own" ON public.professional_feature_access;
CREATE POLICY "professional_feature_access_read_own" ON public.professional_feature_access
  FOR SELECT TO authenticated
  USING (professional_user_id = auth.uid());

DROP POLICY IF EXISTS "professional_feature_access_manage_own" ON public.professional_feature_access;
CREATE POLICY "professional_feature_access_manage_own" ON public.professional_feature_access
  FOR ALL TO authenticated
  USING (professional_user_id = auth.uid())
  WITH CHECK (professional_user_id = auth.uid());

-- Regra de produto:
-- - Free: profissional cadastrado acessa dados autorizados dos pacientes sem cobrança.
-- - Trial Pro: 15 dias livres para área comercial.
-- - Pro: R$ 79,90/mês para teleconsulta, CRM/Bots, pagamentos NextGen/Woovi,
--   documentos profissionais, assinatura e dashboard comercial.
