-- =====================================================
-- MYDATAMED - PROFISSIONAIS DE SAÚDE + ASSINATURA/VALIDADE V3
-- Execute depois dos SQLs de teleconsulta.
-- Objetivo: deixar claro que o sistema atende múltiplos profissionais de saúde
-- e preparar documentos/receitas/orientações com assinatura e validação.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Evolução do cadastro profissional
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS professional_type TEXT DEFAULT 'health_professional';
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS council_name TEXT;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS council_number TEXT;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS council_state TEXT;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS can_prescribe BOOLEAN DEFAULT false;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS can_request_exams BOOLEAN DEFAULT false;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS can_issue_documents BOOLEAN DEFAULT true;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS signature_provider TEXT DEFAULT 'pending';
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS signature_mode TEXT DEFAULT 'pending';
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS signature_certificate_type TEXT;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS signature_validation_url TEXT;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS signature_metadata JSONB DEFAULT '{}'::jsonb;

-- professional_type sugeridos:
-- physician, dentist, nutritionist, psychologist, physiotherapist, occupational_therapist,
-- speech_therapist, nurse, pharmacist, clinic, health_professional, other
-- can_prescribe deve ser ativado somente para profissionais habilitados conforme conselho/legislação.

-- 2) Evolução da teleconsulta para documento clínico/profissional assinado
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS clinical_document_type TEXT DEFAULT 'orientation';
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS clinical_document_status TEXT DEFAULT 'draft';
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS clinical_document_signed_at TIMESTAMPTZ;
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS clinical_document_signature_provider TEXT;
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS clinical_document_signature_level TEXT;
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS clinical_document_validation_url TEXT;
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS clinical_document_hash TEXT;
ALTER TABLE public.telemedicine_appointments ADD COLUMN IF NOT EXISTS clinical_document_disclaimer TEXT DEFAULT 'Documento emitido por profissional de saúde conforme sua habilitação profissional. Receitas medicamentosas devem ser usadas apenas quando o profissional estiver legalmente habilitado e com assinatura/validação aplicável.';

-- clinical_document_type sugeridos:
-- orientation, prescription, exam_request, report, referral, certificate, declaration, care_plan, other
-- clinical_document_status sugeridos:
-- draft, pending_signature, signed, sent_to_patient, cancelled
-- clinical_document_signature_level sugeridos:
-- internal_record, advanced, qualified_icp_brasil, govbr_advanced, provider_validated

-- 3) Tabela específica de documentos profissionais
CREATE TABLE IF NOT EXISTS public.professional_clinical_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.telemedicine_appointments(id) ON DELETE SET NULL,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  professional_id UUID,
  patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL DEFAULT 'orientation'
    CHECK (document_type IN ('orientation', 'prescription', 'exam_request', 'report', 'referral', 'certificate', 'declaration', 'care_plan', 'other')),
  title TEXT,
  body TEXT,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_signature', 'signed', 'sent_to_patient', 'cancelled')),
  requires_prescription_permission BOOLEAN DEFAULT false,
  signature_provider TEXT,
  signature_level TEXT,
  signature_validation_url TEXT,
  document_hash TEXT,
  signed_at TIMESTAMPTZ,
  sent_to_patient_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prof_clinical_documents_appointment ON public.professional_clinical_documents(appointment_id);
CREATE INDEX IF NOT EXISTS idx_prof_clinical_documents_professional ON public.professional_clinical_documents(professional_user_id);
CREATE INDEX IF NOT EXISTS idx_prof_clinical_documents_patient ON public.professional_clinical_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_prof_clinical_documents_type ON public.professional_clinical_documents(document_type);

-- 4) updated_at
CREATE OR REPLACE FUNCTION public.set_professional_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_professional_clinical_documents_updated_at ON public.professional_clinical_documents;
CREATE TRIGGER trg_professional_clinical_documents_updated_at
BEFORE UPDATE ON public.professional_clinical_documents
FOR EACH ROW EXECUTE FUNCTION public.set_professional_documents_updated_at();

-- 5) RLS MVP
ALTER TABLE public.professional_clinical_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "professional_documents_professional_manage" ON public.professional_clinical_documents;
CREATE POLICY "professional_documents_professional_manage" ON public.professional_clinical_documents
  FOR ALL TO authenticated
  USING (professional_user_id = auth.uid())
  WITH CHECK (professional_user_id = auth.uid());

DROP POLICY IF EXISTS "professional_documents_patient_read" ON public.professional_clinical_documents;
CREATE POLICY "professional_documents_patient_read" ON public.professional_clinical_documents
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

-- 6) Templates padrão por profissão/documento
CREATE TABLE IF NOT EXISTS public.system_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  professional_type TEXT DEFAULT 'health_professional',
  document_type TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  requires_prescription_permission BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.system_document_templates (name, professional_type, document_type, title, body, requires_prescription_permission)
SELECT 'Orientação pós-consulta', 'health_professional', 'orientation', 'Orientações pós-consulta',
'Orientações gerais, cuidados, sinais de alerta, retorno recomendado e próximos passos definidos pelo profissional.', false
WHERE NOT EXISTS (SELECT 1 FROM public.system_document_templates WHERE name = 'Orientação pós-consulta');

INSERT INTO public.system_document_templates (name, professional_type, document_type, title, body, requires_prescription_permission)
SELECT 'Receita / prescrição quando aplicável', 'health_professional', 'prescription', 'Receita / prescrição',
'Documento de prescrição a ser usado somente por profissional habilitado, com assinatura digital e validação aplicável.', true
WHERE NOT EXISTS (SELECT 1 FROM public.system_document_templates WHERE name = 'Receita / prescrição quando aplicável');

INSERT INTO public.system_document_templates (name, professional_type, document_type, title, body, requires_prescription_permission)
SELECT 'Pedido de exame quando aplicável', 'health_professional', 'exam_request', 'Pedido de exame',
'Solicitação de exames conforme habilitação profissional e regras aplicáveis ao conselho.', true
WHERE NOT EXISTS (SELECT 1 FROM public.system_document_templates WHERE name = 'Pedido de exame quando aplicável');

-- FIM
