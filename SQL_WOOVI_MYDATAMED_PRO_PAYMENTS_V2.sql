-- =====================================================
-- MYDATAMED PRO - PAGAMENTOS WOOVI / NEXTGEN V2
-- Execute depois de SQL_MODELO_COMERCIAL_MYDATAMED_PRO_V1.sql.
-- Objetivo: permitir cobrança Pix do plano profissional Pro, confirmação por webhook
-- e liberação de recursos comerciais.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Correções/evolução da assinatura profissional
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS professional_id UUID;
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
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS last_charge_id UUID;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS last_paid_at TIMESTAMPTZ;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{"free_patient_data_access":true,"teleconsultation":false,"crm_bots":false,"payments_nextgen":false,"documents_signature":false,"google_calendar_meet":false}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_professional_subscriptions_user ON public.professional_subscriptions(professional_user_id);
CREATE INDEX IF NOT EXISTS idx_professional_subscriptions_professional ON public.professional_subscriptions(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_subscriptions_status ON public.professional_subscriptions(status);

-- 2) Evolução da tabela de cobranças
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS professional_id UUID;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS subscription_id UUID;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS payment_url TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS qr_code_image TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS webhook_confirmed_at TIMESTAMPTZ;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS provider_payload JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_prof_payment_charges_correlation ON public.professional_payment_charges(correlation_id);
CREATE INDEX IF NOT EXISTS idx_prof_payment_charges_provider_charge ON public.professional_payment_charges(provider_charge_id);
CREATE INDEX IF NOT EXISTS idx_prof_payment_charges_subscription ON public.professional_payment_charges(subscription_id);
CREATE INDEX IF NOT EXISTS idx_prof_payment_charges_status ON public.professional_payment_charges(status);

-- 3) Webhooks recebidos da Woovi
CREATE TABLE IF NOT EXISTS public.woovi_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  correlation_id TEXT,
  provider_charge_id TEXT,
  status TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_woovi_webhook_events_correlation ON public.woovi_webhook_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_woovi_webhook_events_charge ON public.woovi_webhook_events(provider_charge_id);
CREATE INDEX IF NOT EXISTS idx_woovi_webhook_events_processed ON public.woovi_webhook_events(processed);

-- 4) Função para marcar Pro como ativo após Pix pago
CREATE OR REPLACE FUNCTION public.activate_mydatamed_pro_after_payment(
  p_professional_user_id UUID,
  p_professional_id UUID DEFAULT NULL,
  p_charge_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
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
    pro_started_at,
    current_period_starts_at,
    current_period_ends_at,
    billing_provider,
    last_charge_id,
    last_paid_at,
    features
  ) VALUES (
    p_professional_user_id,
    p_professional_id,
    'MyDataMed Pro',
    7990,
    7990,
    'monthly',
    'active',
    true,
    true,
    NOW(),
    NOW(),
    NOW() + INTERVAL '30 days',
    'woovi',
    p_charge_id,
    NOW(),
    '{"free_patient_data_access":true,"teleconsultation":true,"google_calendar_meet":true,"crm_bots":true,"payments_nextgen":true,"documents_signature":true}'::jsonb
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.professional_subscriptions
  SET status = 'active',
      commercial_area_enabled = true,
      free_patient_data_access = true,
      pro_started_at = COALESCE(pro_started_at, NOW()),
      current_period_starts_at = NOW(),
      current_period_ends_at = NOW() + INTERVAL '30 days',
      billing_provider = 'woovi',
      last_charge_id = COALESCE(p_charge_id, last_charge_id),
      last_paid_at = NOW(),
      features = '{"free_patient_data_access":true,"teleconsultation":true,"google_calendar_meet":true,"crm_bots":true,"payments_nextgen":true,"documents_signature":true}'::jsonb,
      updated_at = NOW()
  WHERE professional_user_id = p_professional_user_id;

  INSERT INTO public.professional_feature_access (professional_user_id, professional_id, feature_key, access_level, enabled, starts_at, ends_at, source)
  VALUES
    (p_professional_user_id, p_professional_id, 'patient_data_access_free', 'free', true, NOW(), NULL, 'system'),
    (p_professional_user_id, p_professional_id, 'teleconsultation', 'pro', true, NOW(), NOW() + INTERVAL '30 days', 'woovi'),
    (p_professional_user_id, p_professional_id, 'google_calendar_meet', 'pro', true, NOW(), NOW() + INTERVAL '30 days', 'woovi'),
    (p_professional_user_id, p_professional_id, 'crm_smartbots', 'pro', true, NOW(), NOW() + INTERVAL '30 days', 'woovi'),
    (p_professional_user_id, p_professional_id, 'payments_nextgen_woovi', 'pro', true, NOW(), NOW() + INTERVAL '30 days', 'woovi'),
    (p_professional_user_id, p_professional_id, 'professional_documents', 'pro', true, NOW(), NOW() + INTERVAL '30 days', 'woovi'),
    (p_professional_user_id, p_professional_id, 'commercial_dashboard', 'pro', true, NOW(), NOW() + INTERVAL '30 days', 'woovi')
  ON CONFLICT (professional_user_id, feature_key)
  DO UPDATE SET access_level = EXCLUDED.access_level,
                enabled = EXCLUDED.enabled,
                starts_at = EXCLUDED.starts_at,
                ends_at = EXCLUDED.ends_at,
                source = EXCLUDED.source,
                updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Regra de produto:
-- - Profissional cadastrado sempre pode acessar dados autorizados gratuitamente.
-- - Trial Pro: 15 dias para recursos comerciais.
-- - Pro pago por Woovi: R$ 79,90/mês, Pix confirmado por webhook, ativa 30 dias.
