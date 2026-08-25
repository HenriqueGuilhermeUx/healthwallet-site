-- =====================================================
-- MYDATAMED - OPS / BILLING / USAGE / STORAGE - V1
-- Execute no Supabase SQL Editor depois de SQL_MYDATAMED_COMMERCE_BACKOFFICE_V1.sql.
-- Escopo: upload de imagens, agenda operacional, cobrança Pix, controle de uso IA/MODO.
-- NF/NFS-e fica fora deste momento.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Bucket público para imagens de marca da página/bio link
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mydatamed-brand-assets',
  'mydatamed-brand-assets',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Professionals upload own brand assets" ON storage.objects;
CREATE POLICY "Professionals upload own brand assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mydatamed-brand-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Professionals update own brand assets" ON storage.objects;
CREATE POLICY "Professionals update own brand assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mydatamed-brand-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'mydatamed-brand-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Professionals delete own brand assets" ON storage.objects;
CREATE POLICY "Professionals delete own brand assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'mydatamed-brand-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Public can read brand assets" ON storage.objects;
CREATE POLICY "Public can read brand assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'mydatamed-brand-assets');

-- 2) Agenda operacional
CREATE TABLE IF NOT EXISTS public.professional_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  service_id UUID,
  patient_user_id UUID,
  guest_patient_id UUID,
  patient_name TEXT NOT NULL,
  patient_email TEXT,
  patient_phone TEXT,
  title TEXT,
  reason TEXT,
  appointment_type TEXT DEFAULT 'consultation' CHECK (appointment_type IN ('consultation', 'return', 'procedure', 'triage', 'teleconsultation', 'other')),
  service_mode TEXT DEFAULT 'hybrid' CHECK (service_mode IN ('online', 'presencial', 'hybrid')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 50,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('requested', 'scheduled', 'confirmed', 'checked_in', 'in_care', 'completed', 'cancelled', 'no_show')),
  amount_cents INTEGER DEFAULT 0,
  payment_status TEXT DEFAULT 'not_charged' CHECK (payment_status IN ('not_charged', 'pending', 'paid', 'cancelled', 'refunded')),
  financial_entry_id UUID,
  precheck_link_id UUID,
  precheck_submission_id UUID,
  intake_id UUID,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.professional_appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals manage own appointments" ON public.professional_appointments;
CREATE POLICY "Professionals manage own appointments" ON public.professional_appointments
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

CREATE INDEX IF NOT EXISTS idx_professional_appointments_user_starts ON public.professional_appointments(professional_user_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_professional_appointments_status ON public.professional_appointments(professional_user_id, status);

-- 3) Cobranças Pix criadas pela plataforma
CREATE TABLE IF NOT EXISTS public.professional_payment_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  financial_entry_id UUID,
  appointment_id UUID,
  provider TEXT DEFAULT 'internal_pix_provider',
  provider_charge_id TEXT,
  correlation_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'pending', 'paid', 'expired', 'cancelled', 'failed', 'refunded')),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  description TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_tax_id TEXT,
  pix_copy_paste TEXT,
  pix_qr_code_url TEXT,
  payment_url TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  raw_response JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.professional_payment_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals read own payment charges" ON public.professional_payment_charges;
CREATE POLICY "Professionals read own payment charges" ON public.professional_payment_charges
  FOR SELECT USING (auth.uid() = professional_user_id);

CREATE INDEX IF NOT EXISTS idx_professional_payment_charges_user ON public.professional_payment_charges(professional_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_professional_payment_charges_entry ON public.professional_payment_charges(financial_entry_id);

-- 4) Eventos de uso: atendimento assistido, IA, MODO, transcrição, mensagens
CREATE TABLE IF NOT EXISTS public.mydatamed_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('assisted_visit', 'modo_credit', 'ai_action', 'transcription_minute', 'crm_message', 'storage_upload', 'other')),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'unit',
  source TEXT,
  reference_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mydatamed_usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals read own usage events" ON public.mydatamed_usage_events;
CREATE POLICY "Professionals read own usage events" ON public.mydatamed_usage_events
  FOR SELECT USING (auth.uid() = professional_user_id);

CREATE INDEX IF NOT EXISTS idx_mydatamed_usage_events_user_type ON public.mydatamed_usage_events(professional_user_id, event_type, created_at DESC);

-- 5) Helper para registrar uso e atualizar assinatura
CREATE OR REPLACE FUNCTION public.record_mydatamed_usage(
  p_professional_user_id UUID,
  p_event_type TEXT,
  p_quantity INTEGER DEFAULT 1,
  p_source TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_subscription_id UUID;
  v_professional_id UUID;
  v_event_id UUID;
BEGIN
  SELECT id, professional_id
  INTO v_subscription_id, v_professional_id
  FROM public.professional_commercial_subscriptions
  WHERE professional_user_id = p_professional_user_id
  LIMIT 1;

  INSERT INTO public.mydatamed_usage_events (
    professional_id,
    professional_user_id,
    subscription_id,
    event_type,
    quantity,
    unit,
    source,
    reference_id,
    description,
    metadata
  ) VALUES (
    v_professional_id,
    p_professional_user_id,
    v_subscription_id,
    p_event_type,
    GREATEST(COALESCE(p_quantity, 1), 1),
    CASE WHEN p_event_type = 'transcription_minute' THEN 'minute' WHEN p_event_type = 'modo_credit' THEN 'credit' ELSE 'unit' END,
    p_source,
    p_reference_id,
    p_description,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_event_id;

  IF v_subscription_id IS NOT NULL THEN
    IF p_event_type = 'assisted_visit' THEN
      UPDATE public.professional_commercial_subscriptions
      SET used_assisted_visits = COALESCE(used_assisted_visits, 0) + GREATEST(COALESCE(p_quantity, 1), 1),
          updated_at = now()
      WHERE id = v_subscription_id;
    ELSIF p_event_type = 'modo_credit' THEN
      UPDATE public.professional_commercial_subscriptions
      SET used_modo_credits = COALESCE(used_modo_credits, 0) + GREATEST(COALESCE(p_quantity, 1), 1),
          updated_at = now()
      WHERE id = v_subscription_id;
    END IF;
  END IF;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) Atualiza financial_entries para conter dados suficientes de cobrança/recibo sem NF
ALTER TABLE public.professional_financial_entries
  ADD COLUMN IF NOT EXISTS charge_id UUID,
  ADD COLUMN IF NOT EXISTS payment_url TEXT,
  ADD COLUMN IF NOT EXISTS pix_copy_paste TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code_url TEXT,
  ADD COLUMN IF NOT EXISTS customer_tax_id TEXT;

-- 7) updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_professional_appointments_updated_at ON public.professional_appointments;
CREATE TRIGGER trg_professional_appointments_updated_at
BEFORE UPDATE ON public.professional_appointments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_professional_payment_charges_updated_at ON public.professional_payment_charges;
CREATE TRIGGER trg_professional_payment_charges_updated_at
BEFORE UPDATE ON public.professional_payment_charges
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.professional_appointments IS 'Agenda operacional do consultório digital MyDataMed.';
COMMENT ON TABLE public.professional_payment_charges IS 'Cobranças Pix geradas por provedor de pagamento em bastidor.';
COMMENT ON TABLE public.mydatamed_usage_events IS 'Eventos de consumo para controlar atendimentos assistidos, IA, MODO e automações.';
