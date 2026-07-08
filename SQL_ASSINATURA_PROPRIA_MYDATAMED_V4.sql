-- =====================================================
-- MYDATAMED - ASSINATURA PRÓPRIA V4 - PRODUÇÃO ON
-- Execute depois dos SQLs anteriores.
-- Objetivo: assinatura eletrônica própria para consentimentos, orientações,
-- relatórios e documentos profissionais, com token, CPF, IP, user agent,
-- timestamp, hash e verificação pública por QR/link.
--
-- IMPORTANTE:
-- Este motor NÃO substitui assinatura qualificada/ICP-Brasil quando ela for
-- obrigatória para prescrição medicamentosa, antimicrobianos, controlados ou
-- documentos regulados. Use can_prescribe + signature_level para travar isso.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Tokens públicos de assinatura
CREATE TABLE IF NOT EXISTS public.sign_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  document_id UUID REFERENCES public.professional_clinical_documents(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.telemedicine_appointments(id) ON DELETE SET NULL,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  professional_id UUID,
  patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_email TEXT,
  patient_name TEXT,
  signer_role TEXT DEFAULT 'patient' CHECK (signer_role IN ('patient', 'professional', 'guardian', 'caregiver')),
  signer_cpf TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'signed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signature_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex');
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.professional_clinical_documents(id) ON DELETE CASCADE;
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.telemedicine_appointments(id) ON DELETE SET NULL;
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS professional_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS professional_id UUID;
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS patient_email TEXT;
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS signer_role TEXT DEFAULT 'patient';
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS signer_cpf TEXT;
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS signature_id UUID;
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.sign_tokens ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2) Trilha de auditoria da assinatura
CREATE TABLE IF NOT EXISTS public.signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES public.sign_tokens(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.professional_clinical_documents(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.telemedicine_appointments(id) ON DELETE SET NULL,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  professional_id UUID,
  patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  signer_role TEXT DEFAULT 'patient',
  signer_name TEXT,
  signer_email TEXT,
  signer_cpf TEXT,
  accepted_terms BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  document_hash TEXT UNIQUE NOT NULL,
  document_snapshot JSONB DEFAULT '{}'::jsonb,
  verification_slug TEXT UNIQUE NOT NULL,
  verification_url TEXT,
  audit_trail JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'valid' CHECK (status IN ('valid', 'revoked', 'superseded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.signatures ADD COLUMN IF NOT EXISTS verification_slug TEXT UNIQUE;
ALTER TABLE public.signatures ADD COLUMN IF NOT EXISTS verification_url TEXT;
ALTER TABLE public.signatures ADD COLUMN IF NOT EXISTS audit_trail JSONB DEFAULT '{}'::jsonb;

-- 3) Campos complementares no documento clínico
ALTER TABLE public.professional_clinical_documents ADD COLUMN IF NOT EXISTS simple_signature_allowed BOOLEAN DEFAULT true;
ALTER TABLE public.professional_clinical_documents ADD COLUMN IF NOT EXISTS simple_signature_token_id UUID;
ALTER TABLE public.professional_clinical_documents ADD COLUMN IF NOT EXISTS simple_signature_id UUID;
ALTER TABLE public.professional_clinical_documents ADD COLUMN IF NOT EXISTS verification_url TEXT;
ALTER TABLE public.professional_clinical_documents ADD COLUMN IF NOT EXISTS qr_payload TEXT;
ALTER TABLE public.professional_clinical_documents ADD COLUMN IF NOT EXISTS legal_notice TEXT DEFAULT 'Assinatura eletrônica própria com trilha de auditoria. Para prescrições medicamentosas ou documentos regulados, a validade externa depende da habilitação profissional e da assinatura/validação exigida pela legislação aplicável.';

-- 4) Índices
CREATE INDEX IF NOT EXISTS idx_sign_tokens_token ON public.sign_tokens(token);
CREATE INDEX IF NOT EXISTS idx_sign_tokens_document ON public.sign_tokens(document_id);
CREATE INDEX IF NOT EXISTS idx_sign_tokens_patient ON public.sign_tokens(patient_id);
CREATE INDEX IF NOT EXISTS idx_sign_tokens_professional_user ON public.sign_tokens(professional_user_id);
CREATE INDEX IF NOT EXISTS idx_signatures_hash ON public.signatures(document_hash);
CREATE INDEX IF NOT EXISTS idx_signatures_verification_slug ON public.signatures(verification_slug);
CREATE INDEX IF NOT EXISTS idx_signatures_document ON public.signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_signatures_patient ON public.signatures(patient_id);

-- 5) updated_at automático
CREATE OR REPLACE FUNCTION public.set_sign_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sign_tokens_updated_at ON public.sign_tokens;
CREATE TRIGGER trg_sign_tokens_updated_at
BEFORE UPDATE ON public.sign_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_sign_tokens_updated_at();

-- 6) RLS
ALTER TABLE public.sign_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

-- Profissional logado cria e lê tokens dos seus documentos.
DROP POLICY IF EXISTS "sign_tokens_professional_manage" ON public.sign_tokens;
CREATE POLICY "sign_tokens_professional_manage" ON public.sign_tokens
  FOR ALL TO authenticated
  USING (professional_user_id = auth.uid() OR patient_id = auth.uid())
  WITH CHECK (professional_user_id = auth.uid() OR patient_id = auth.uid());

-- Público consegue ler token válido apenas para assinar pelo link.
DROP POLICY IF EXISTS "sign_tokens_public_read_pending" ON public.sign_tokens;
CREATE POLICY "sign_tokens_public_read_pending" ON public.sign_tokens
  FOR SELECT TO anon
  USING (status IN ('pending', 'viewed') AND expires_at > NOW());

-- Público consegue marcar token como visto/assinado pelo link.
DROP POLICY IF EXISTS "sign_tokens_public_update_pending" ON public.sign_tokens;
CREATE POLICY "sign_tokens_public_update_pending" ON public.sign_tokens
  FOR UPDATE TO anon
  USING (status IN ('pending', 'viewed') AND expires_at > NOW())
  WITH CHECK (status IN ('viewed', 'signed') AND expires_at > NOW());

-- Assinatura pode ser criada via link público com token aleatório.
DROP POLICY IF EXISTS "signatures_public_insert" ON public.signatures;
CREATE POLICY "signatures_public_insert" ON public.signatures
  FOR INSERT TO anon
  WITH CHECK (accepted_terms = true);

-- Verificação pública por hash/slug.
DROP POLICY IF EXISTS "signatures_public_read_valid" ON public.signatures;
CREATE POLICY "signatures_public_read_valid" ON public.signatures
  FOR SELECT TO anon
  USING (status = 'valid');

-- Profissional e paciente podem ler suas assinaturas.
DROP POLICY IF EXISTS "signatures_authenticated_read_own" ON public.signatures;
CREATE POLICY "signatures_authenticated_read_own" ON public.signatures
  FOR SELECT TO authenticated
  USING (professional_user_id = auth.uid() OR patient_id = auth.uid());

-- Documentos precisam ser legíveis no link público quando houver token pendente/válido.
DROP POLICY IF EXISTS "professional_documents_public_read_for_signature" ON public.professional_clinical_documents;
CREATE POLICY "professional_documents_public_read_for_signature" ON public.professional_clinical_documents
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.sign_tokens st
      WHERE st.document_id = professional_clinical_documents.id
      AND st.status IN ('pending', 'viewed', 'signed')
      AND st.expires_at > NOW()
    )
    OR EXISTS (
      SELECT 1 FROM public.signatures s
      WHERE s.document_id = professional_clinical_documents.id
      AND s.status = 'valid'
    )
  );

-- 7) Função utilitária para expirar tokens antigos
CREATE OR REPLACE FUNCTION public.expire_old_sign_tokens()
RETURNS void AS $$
BEGIN
  UPDATE public.sign_tokens
  SET status = 'expired', updated_at = NOW()
  WHERE status IN ('pending', 'viewed')
  AND expires_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- FIM
