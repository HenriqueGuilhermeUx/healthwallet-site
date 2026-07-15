-- =====================================================
-- MYDATAMED - TELECONSULTA + NEXTGEN COBRANCAS V1
-- Execute no Supabase SQL Editor depois de SQL_NEXTGEN_FINANCEIRO_V1.sql.
-- Objetivo: vincular teleconsultas a cobranças NextGen/Woovi.
-- =====================================================

ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS payment_required BOOLEAN DEFAULT false;
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'not_required';
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS payment_charge_id UUID;
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS nextgen_charge_id TEXT;
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS payment_amount_cents INTEGER;
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS payment_currency TEXT DEFAULT 'BRL';
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS payment_url TEXT;
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS pix_copy_paste TEXT;
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS payment_requested_at TIMESTAMPTZ;
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ;
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS billing_metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_telemedicine_appointments_payment_status ON public.telemedicine_appointments(payment_status);
CREATE INDEX IF NOT EXISTS idx_telemedicine_appointments_payment_charge_id ON public.telemedicine_appointments(payment_charge_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_appointments_nextgen_charge_id ON public.telemedicine_appointments(nextgen_charge_id);

-- Garante campos de vínculo na tabela financeira, caso o SQL financeiro tenha sido executado antes.
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS appointment_id UUID;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS recurrence_interval TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS product_key TEXT;
ALTER TABLE public.professional_payment_charges ADD COLUMN IF NOT EXISTS billing_context TEXT DEFAULT 'professional';

CREATE INDEX IF NOT EXISTS idx_professional_payment_charges_appointment_id ON public.professional_payment_charges(appointment_id);

-- Regras de produto:
-- - Teleconsulta pode ser gratuita, cobrada avulsa ou incluída em plano.
-- - Cobrança é criada pelo MyDataMed e processada pela camada NextGen/Woovi.
-- - payment_status recomendado: not_required, pending_charge, draft, pix_generated, waiting_payment, paid, expired, cancelled.
-- - Quando webhook confirmar pagamento, a teleconsulta pode ser marcada como paid.
