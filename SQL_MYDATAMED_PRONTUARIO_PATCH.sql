-- =====================================================
-- MYDATAMED - PRONTUARIO ELETRONICO PATCH
-- Execute depois de SQL_COPILOTO_ATENDIMENTO_V1.sql.
-- Objetivo: empacotar o prontuario eletronico comercial: timeline por paciente,
-- assinatura/travamento de nota, anexos e auditoria.
-- NF/NFS-e fica fora deste momento.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Ajustes em clinical_visits para experiencia de prontuario
ALTER TABLE public.clinical_visits
  ADD COLUMN IF NOT EXISTS record_status TEXT DEFAULT 'draft'
    CHECK (record_status IN ('draft', 'reviewed', 'signed', 'locked', 'amended', 'cancelled')),
  ADD COLUMN IF NOT EXISTS record_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS record_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS record_summary TEXT,
  ADD COLUMN IF NOT EXISTS patient_cpf TEXT,
  ADD COLUMN IF NOT EXISTS patient_birth_date DATE;

-- 2) Anexos do prontuario
CREATE TABLE IF NOT EXISTS public.clinical_record_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.clinical_visits(id) ON DELETE CASCADE,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_user_id UUID,
  guest_patient_id UUID,
  patient_name TEXT,
  attachment_type TEXT DEFAULT 'document'
    CHECK (attachment_type IN ('document', 'exam', 'image', 'receipt', 'orientation', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_name TEXT,
  mime_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.clinical_record_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals manage own clinical record attachments" ON public.clinical_record_attachments;
CREATE POLICY "Professionals manage own clinical record attachments" ON public.clinical_record_attachments
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

CREATE INDEX IF NOT EXISTS idx_clinical_record_attachments_visit ON public.clinical_record_attachments(visit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_record_attachments_user ON public.clinical_record_attachments(professional_user_id, created_at DESC);

-- 3) Auditoria do prontuario
CREATE TABLE IF NOT EXISTS public.clinical_record_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.clinical_visits(id) ON DELETE CASCADE,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'viewed', 'updated', 'reviewed', 'signed', 'locked', 'printed', 'exported', 'amended', 'attachment_added', 'other')),
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.clinical_record_audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals read own clinical record audit" ON public.clinical_record_audit_events;
CREATE POLICY "Professionals read own clinical record audit" ON public.clinical_record_audit_events
  FOR SELECT USING (auth.uid() = professional_user_id);
DROP POLICY IF EXISTS "Professionals insert own clinical record audit" ON public.clinical_record_audit_events;
CREATE POLICY "Professionals insert own clinical record audit" ON public.clinical_record_audit_events
  FOR INSERT WITH CHECK (auth.uid() = professional_user_id);

CREATE INDEX IF NOT EXISTS idx_clinical_record_audit_visit ON public.clinical_record_audit_events(visit_id, created_at DESC);

-- 4) Funcao para assinar/travar prontuario
CREATE OR REPLACE FUNCTION public.sign_and_lock_clinical_visit(p_visit_id UUID)
RETURNS public.clinical_visits AS $$
DECLARE
  v_visit public.clinical_visits;
BEGIN
  UPDATE public.clinical_visits
  SET
    record_status = 'locked',
    record_locked = TRUE,
    locked_at = now(),
    signed_by_doctor = TRUE,
    signed_at = COALESCE(signed_at, now()),
    status = CASE WHEN status = 'draft' THEN 'completed' ELSE status END,
    updated_at = now()
  WHERE id = p_visit_id
    AND professional_user_id = auth.uid()
    AND COALESCE(record_locked, FALSE) = FALSE
  RETURNING * INTO v_visit;

  IF v_visit.id IS NULL THEN
    RAISE EXCEPTION 'Prontuario nao encontrado ou ja travado';
  END IF;

  INSERT INTO public.clinical_record_audit_events (
    visit_id,
    professional_user_id,
    actor_user_id,
    event_type,
    description,
    metadata
  ) VALUES (
    v_visit.id,
    v_visit.professional_user_id,
    auth.uid(),
    'locked',
    'Prontuario assinado e travado pelo profissional.',
    jsonb_build_object('record_version', v_visit.record_version)
  );

  RETURN v_visit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.sign_and_lock_clinical_visit(UUID) IS
'Assina e trava um prontuario/clinical_visit. Alteracoes posteriores devem ser feitas por retificacao/amendment.';
