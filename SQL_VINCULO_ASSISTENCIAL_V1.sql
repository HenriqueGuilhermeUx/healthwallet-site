-- =====================================================
-- MYDATAMED / HEALTHWALLET - VINCULO ASSISTENCIAL V1
-- Execute no Supabase SQL Editor.
-- Objetivo: permitir acompanhamento continuo autorizado entre paciente e profissional.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.professional_care_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_user_id UUID NOT NULL,
  professional_id UUID,
  professional_name TEXT,
  professional_email TEXT,
  patient_id UUID,
  patient_name TEXT,
  patient_email TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','revoked','expired','cancelled')),
  scope JSONB DEFAULT '{"summary":true,"exams":true,"medications":true,"timeline":true,"passport":true,"medscore":true,"documents":true,"family":false}'::jsonb,
  requested_scope JSONB DEFAULT '{}'::jsonb,
  duration_days INTEGER DEFAULT 365,
  continuous BOOLEAN DEFAULT false,
  request_note TEXT,
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_professional_care_links_professional_id ON public.professional_care_links(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_care_links_professional_user_id ON public.professional_care_links(professional_user_id);
CREATE INDEX IF NOT EXISTS idx_professional_care_links_patient_id ON public.professional_care_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_professional_care_links_patient_email ON public.professional_care_links(patient_email);
CREATE INDEX IF NOT EXISTS idx_professional_care_links_status ON public.professional_care_links(status);
CREATE INDEX IF NOT EXISTS idx_professional_care_links_token ON public.professional_care_links(token);

CREATE TABLE IF NOT EXISTS public.professional_care_link_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_link_id UUID,
  actor_user_id UUID,
  actor_role TEXT,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_professional_care_link_events_link ON public.professional_care_link_events(care_link_id);
CREATE INDEX IF NOT EXISTS idx_professional_care_link_events_actor ON public.professional_care_link_events(actor_user_id);

ALTER TABLE public.professional_care_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_care_link_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Professionals manage own care links" ON public.professional_care_links;
CREATE POLICY "Professionals manage own care links"
ON public.professional_care_links
FOR ALL
USING (auth.uid() = professional_user_id)
WITH CHECK (auth.uid() = professional_user_id);

DROP POLICY IF EXISTS "Patients read own care links" ON public.professional_care_links;
CREATE POLICY "Patients read own care links"
ON public.professional_care_links
FOR SELECT
USING (
  auth.uid() = patient_id
  OR lower(coalesce(patient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

DROP POLICY IF EXISTS "Patients update own care links" ON public.professional_care_links;
CREATE POLICY "Patients update own care links"
ON public.professional_care_links
FOR UPDATE
USING (
  auth.uid() = patient_id
  OR lower(coalesce(patient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
WITH CHECK (
  auth.uid() = patient_id
  OR lower(coalesce(patient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

DROP POLICY IF EXISTS "Care link events visible to involved users" ON public.professional_care_link_events;
CREATE POLICY "Care link events visible to involved users"
ON public.professional_care_link_events
FOR SELECT
USING (
  actor_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.professional_care_links pcl
    WHERE pcl.id = care_link_id
      AND (
        pcl.professional_user_id = auth.uid()
        OR pcl.patient_id = auth.uid()
        OR lower(coalesce(pcl.patient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

-- Regras de produto:
-- - Vínculo assistencial é autorização contínua, não posse definitiva dos dados.
-- - Paciente aprova escopo e prazo e pode revogar a qualquer momento.
-- - Profissional vê dados autorizados conforme escopo e status active.
-- - Status recomendado: pending, active, rejected, revoked, expired, cancelled.
-- - Acesso por código temporário continua existindo para uso pontual/free.
