-- =====================================================
-- MYDATAMED - PRE-ATENDIMENTO INTELIGENTE - V1
-- Execute no Supabase SQL Editor do projeto HealthWallet/MyDataMed.
-- Objetivo: permitir que o paciente preencha dados antes da chegada,
-- reduzindo fila, papelada, retrabalho de recepção e erros administrativos.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Links públicos de pré-atendimento gerados pelo profissional/clínica
CREATE TABLE IF NOT EXISTS public.patient_precheck_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  public_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  title TEXT NOT NULL DEFAULT 'Pré-atendimento',
  clinic_name TEXT,
  specialty TEXT,
  default_reason TEXT,
  landing_message TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'paused', 'closed', 'expired')),
  expires_at TIMESTAMPTZ,
  max_submissions INTEGER,
  submission_count INTEGER DEFAULT 0,
  require_cpf BOOLEAN DEFAULT FALSE,
  require_health_plan BOOLEAN DEFAULT FALSE,
  allow_plan_data BOOLEAN DEFAULT TRUE,
  allow_companion_data BOOLEAN DEFAULT TRUE,
  custom_questions JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Submissões preenchidas pelo paciente antes da chegada
CREATE TABLE IF NOT EXISTS public.patient_precheck_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID REFERENCES public.patient_precheck_links(id) ON DELETE CASCADE NOT NULL,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'converted', 'archived')),

  patient_name TEXT NOT NULL,
  patient_cpf TEXT,
  patient_birth_date DATE,
  patient_phone TEXT,
  patient_email TEXT,
  companion_name TEXT,
  companion_phone TEXT,

  specialty TEXT,
  reason TEXT,
  symptoms TEXT,
  current_medications TEXT,
  allergies TEXT,
  relevant_history TEXT,
  administrative_notes TEXT,

  health_plan_provider TEXT,
  health_plan_card_number TEXT,
  health_plan_type TEXT,
  plan_holder_name TEXT,
  plan_valid_until DATE,
  plan_payload JSONB DEFAULT '{}'::jsonb,

  consent_lgpd BOOLEAN DEFAULT FALSE,
  consent_contact BOOLEAN DEFAULT FALSE,
  consent_plan_data BOOLEAN DEFAULT FALSE,
  consent_text TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  converted_intake_id UUID,

  missing_fields JSONB DEFAULT '[]'::jsonb,
  checklist JSONB DEFAULT '{}'::jsonb,
  source_ip TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3) Auditoria do pré-atendimento
CREATE TABLE IF NOT EXISTS public.patient_precheck_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID,
  submission_id UUID,
  professional_user_id UUID,
  actor_user_id UUID,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_precheck_links_professional_user ON public.patient_precheck_links(professional_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_precheck_links_public_token ON public.patient_precheck_links(public_token);
CREATE INDEX IF NOT EXISTS idx_patient_precheck_submissions_professional_user ON public.patient_precheck_submissions(professional_user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_precheck_submissions_link ON public.patient_precheck_submissions(link_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_precheck_events_submission ON public.patient_precheck_events(submission_id, created_at DESC);

-- updated_at simples
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patient_precheck_links_updated_at ON public.patient_precheck_links;
CREATE TRIGGER trg_patient_precheck_links_updated_at
BEFORE UPDATE ON public.patient_precheck_links
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_patient_precheck_submissions_updated_at ON public.patient_precheck_submissions;
CREATE TRIGGER trg_patient_precheck_submissions_updated_at
BEFORE UPDATE ON public.patient_precheck_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Incrementa contador do link quando uma submissão é criada
CREATE OR REPLACE FUNCTION public.increment_precheck_submission_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.patient_precheck_links
  SET submission_count = COALESCE(submission_count, 0) + 1,
      updated_at = now()
  WHERE id = NEW.link_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_precheck_submission_count ON public.patient_precheck_submissions;
CREATE TRIGGER trg_increment_precheck_submission_count
AFTER INSERT ON public.patient_precheck_submissions
FOR EACH ROW EXECUTE FUNCTION public.increment_precheck_submission_count();

-- RLS
ALTER TABLE public.patient_precheck_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_precheck_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_precheck_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Professionals can manage own precheck links" ON public.patient_precheck_links;
CREATE POLICY "Professionals can manage own precheck links"
ON public.patient_precheck_links
FOR ALL
USING (auth.uid() = professional_user_id)
WITH CHECK (auth.uid() = professional_user_id);

DROP POLICY IF EXISTS "Public can read open precheck links" ON public.patient_precheck_links;
CREATE POLICY "Public can read open precheck links"
ON public.patient_precheck_links
FOR SELECT
USING (
  status = 'open'
  AND (expires_at IS NULL OR expires_at > now())
  AND (max_submissions IS NULL OR COALESCE(submission_count, 0) < max_submissions)
);

DROP POLICY IF EXISTS "Professionals can manage own precheck submissions" ON public.patient_precheck_submissions;
CREATE POLICY "Professionals can manage own precheck submissions"
ON public.patient_precheck_submissions
FOR ALL
USING (auth.uid() = professional_user_id)
WITH CHECK (auth.uid() = professional_user_id);

DROP POLICY IF EXISTS "Public can submit valid precheck forms" ON public.patient_precheck_submissions;
CREATE POLICY "Public can submit valid precheck forms"
ON public.patient_precheck_submissions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.patient_precheck_links l
    WHERE l.id = link_id
      AND l.professional_user_id = patient_precheck_submissions.professional_user_id
      AND l.status = 'open'
      AND (l.expires_at IS NULL OR l.expires_at > now())
      AND (l.max_submissions IS NULL OR COALESCE(l.submission_count, 0) < l.max_submissions)
  )
  AND consent_lgpd = true
);

DROP POLICY IF EXISTS "Professionals can manage own precheck events" ON public.patient_precheck_events;
CREATE POLICY "Professionals can manage own precheck events"
ON public.patient_precheck_events
FOR ALL
USING (auth.uid() = professional_user_id OR professional_user_id IS NULL)
WITH CHECK (auth.uid() = professional_user_id OR professional_user_id IS NULL);

DROP POLICY IF EXISTS "Public can insert public precheck events" ON public.patient_precheck_events;
CREATE POLICY "Public can insert public precheck events"
ON public.patient_precheck_events
FOR INSERT
WITH CHECK (
  event_type IN ('public_form_opened', 'public_form_submitted')
);

COMMENT ON TABLE public.patient_precheck_links IS 'Links públicos de pré-atendimento criados por profissionais/clínicas.';
COMMENT ON TABLE public.patient_precheck_submissions IS 'Formulários preenchidos pelo paciente antes da chegada/atendimento.';
COMMENT ON TABLE public.patient_precheck_events IS 'Auditoria do fluxo de pré-atendimento.';
