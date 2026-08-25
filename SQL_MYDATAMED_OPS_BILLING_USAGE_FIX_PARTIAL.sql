-- =====================================================
-- MYDATAMED - FIX SQL 7 OPS/BILLING/USAGE PARTIAL RUN
-- Execute se o SQL_MYDATAMED_OPS_BILLING_USAGE_V1.sql falhar com:
-- ERROR 42703: column "financial_entry_id" does not exist
--
-- Causa: o Supabase executou parte do SQL e a tabela professional_payment_charges
-- já existia sem todas as colunas. CREATE TABLE IF NOT EXISTS não adiciona colunas.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Garante colunas da agenda caso a tabela tenha sido criada parcialmente
CREATE TABLE IF NOT EXISTS public.professional_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.professional_appointments
  ADD COLUMN IF NOT EXISTS professional_id UUID,
  ADD COLUMN IF NOT EXISTS service_id UUID,
  ADD COLUMN IF NOT EXISTS patient_user_id UUID,
  ADD COLUMN IF NOT EXISTS guest_patient_id UUID,
  ADD COLUMN IF NOT EXISTS patient_email TEXT,
  ADD COLUMN IF NOT EXISTS patient_phone TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS appointment_type TEXT DEFAULT 'consultation',
  ADD COLUMN IF NOT EXISTS service_mode TEXT DEFAULT 'hybrid',
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'not_charged',
  ADD COLUMN IF NOT EXISTS financial_entry_id UUID,
  ADD COLUMN IF NOT EXISTS precheck_link_id UUID,
  ADD COLUMN IF NOT EXISTS precheck_submission_id UUID,
  ADD COLUMN IF NOT EXISTS intake_id UUID,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.professional_appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals manage own appointments" ON public.professional_appointments;
CREATE POLICY "Professionals manage own appointments" ON public.professional_appointments
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

-- 2) Garante colunas da tabela de cobranças Pix
CREATE TABLE IF NOT EXISTS public.professional_payment_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  correlation_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.professional_payment_charges
  ADD COLUMN IF NOT EXISTS professional_id UUID,
  ADD COLUMN IF NOT EXISTS financial_entry_id UUID,
  ADD COLUMN IF NOT EXISTS appointment_id UUID,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'internal_pix_provider',
  ADD COLUMN IF NOT EXISTS provider_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_tax_id TEXT,
  ADD COLUMN IF NOT EXISTS pix_copy_paste TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_url TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS raw_response JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.professional_payment_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals read own payment charges" ON public.professional_payment_charges;
CREATE POLICY "Professionals read own payment charges" ON public.professional_payment_charges
  FOR SELECT USING (auth.uid() = professional_user_id);

-- 3) Garante tabela e colunas de eventos de uso
CREATE TABLE IF NOT EXISTS public.mydatamed_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mydatamed_usage_events
  ADD COLUMN IF NOT EXISTS professional_id UUID,
  ADD COLUMN IF NOT EXISTS subscription_id UUID,
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'unit',
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS reference_id UUID,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.mydatamed_usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals read own usage events" ON public.mydatamed_usage_events;
CREATE POLICY "Professionals read own usage events" ON public.mydatamed_usage_events
  FOR SELECT USING (auth.uid() = professional_user_id);

-- 4) Garante colunas de cobrança na tabela financeira
ALTER TABLE public.professional_financial_entries
  ADD COLUMN IF NOT EXISTS charge_id UUID,
  ADD COLUMN IF NOT EXISTS payment_url TEXT,
  ADD COLUMN IF NOT EXISTS pix_copy_paste TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code_url TEXT,
  ADD COLUMN IF NOT EXISTS customer_tax_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_preference TEXT DEFAULT 'not_defined',
  ADD COLUMN IF NOT EXISTS own_pix_key TEXT,
  ADD COLUMN IF NOT EXISTS external_payment_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

-- 5) Recria helper de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6) Índices seguros depois das colunas existirem
CREATE INDEX IF NOT EXISTS idx_professional_appointments_user_starts
ON public.professional_appointments(professional_user_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_professional_appointments_status
ON public.professional_appointments(professional_user_id, status);

CREATE INDEX IF NOT EXISTS idx_professional_payment_charges_user
ON public.professional_payment_charges(professional_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_professional_payment_charges_entry
ON public.professional_payment_charges(financial_entry_id);

CREATE INDEX IF NOT EXISTS idx_mydatamed_usage_events_user_type
ON public.mydatamed_usage_events(professional_user_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_professional_financial_entries_payment_preference
ON public.professional_financial_entries(professional_user_id, payment_preference, status);

DROP TRIGGER IF EXISTS trg_professional_appointments_updated_at ON public.professional_appointments;
CREATE TRIGGER trg_professional_appointments_updated_at
BEFORE UPDATE ON public.professional_appointments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_professional_payment_charges_updated_at ON public.professional_payment_charges;
CREATE TRIGGER trg_professional_payment_charges_updated_at
BEFORE UPDATE ON public.professional_payment_charges
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.professional_payment_charges IS 'Cobranças Pix geradas por provedor de pagamento em bastidor. Patch idempotente aplicado.';
