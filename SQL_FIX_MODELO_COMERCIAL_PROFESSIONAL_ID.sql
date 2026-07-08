-- =====================================================
-- FIX - MODELO COMERCIAL MYDATAMED PRO
-- Execute se o SQL_MODELO_COMERCIAL_MYDATAMED_PRO_V1.sql já tiver sido rodado
-- antes do SQL_WOOVI_MYDATAMED_PRO_PAYMENTS_V2.sql.
-- =====================================================

ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS professional_id UUID;
CREATE INDEX IF NOT EXISTS idx_professional_subscriptions_professional_id ON public.professional_subscriptions(professional_id);

-- Também garantimos os campos essenciais do modo comercial.
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS free_patient_data_access BOOLEAN DEFAULT true;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS commercial_area_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 15;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS monthly_price_cents INTEGER DEFAULT 7990;
ALTER TABLE public.professional_subscriptions ADD COLUMN IF NOT EXISTS billing_provider TEXT DEFAULT 'woovi';
