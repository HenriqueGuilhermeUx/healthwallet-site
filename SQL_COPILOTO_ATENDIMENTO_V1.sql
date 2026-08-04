-- =====================================================
-- MYDATAMED COPILOTO DE ATENDIMENTO - FASES 1 E 2 - V1
-- Execute no Supabase SQL Editor do projeto HealthWallet/MyDataMed.
-- Objetivo: reconhecimento de voz/transcricao, resumo SOAP, cards de apoio e registro de uso de IA.
-- Importante: IA como apoio supervisionado. Medico revisa, valida, assina e assume decisao final.
-- =====================================================

-- 1) Paciente avulso para atendimento sem HealthWallet
CREATE TABLE IF NOT EXISTS public.guest_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  birth_date DATE,
  cpf TEXT,
  source TEXT DEFAULT 'mydatamed_guest_visit',
  converted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.guest_patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guest_patients_manage_own" ON public.guest_patients;
CREATE POLICY "guest_patients_manage_own" ON public.guest_patients
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

-- 2) Atendimento assistido por voz/IA
CREATE TABLE IF NOT EXISTS public.clinical_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  appointment_id UUID REFERENCES public.telemedicine_appointments(id) ON DELETE SET NULL,
  patient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_patient_id UUID REFERENCES public.guest_patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  patient_email TEXT,
  patient_phone TEXT,
  specialty TEXT,
  reason TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'paused', 'completed', 'signed', 'cancelled')),
  data_scope TEXT DEFAULT 'visit_only' CHECK (data_scope IN ('visit_only', 'healthwallet_authorized', 'mixed')),
  consent_audio_recording BOOLEAN DEFAULT false,
  consent_ai_transcription BOOLEAN DEFAULT false,
  consent_ai_support BOOLEAN DEFAULT false,
  ai_disclaimer_ack BOOLEAN DEFAULT false,
  transcript_text TEXT,
  summary_text TEXT,
  soap_subjective TEXT,
  soap_objective TEXT,
  soap_assessment TEXT,
  soap_plan TEXT,
  doctor_observations TEXT,
  final_note TEXT,
  signed_by_doctor BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clinical_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinical_visits_manage_own" ON public.clinical_visits;
CREATE POLICY "clinical_visits_manage_own" ON public.clinical_visits
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

-- 3) Segmentos de transcricao. Audio bruto nao precisa ser salvo no MVP; o campo audio_url fica para evolucao futura.
CREATE TABLE IF NOT EXISTS public.clinical_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.clinical_visits(id) ON DELETE CASCADE NOT NULL,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  speaker TEXT DEFAULT 'unknown' CHECK (speaker IN ('doctor', 'patient', 'unknown')),
  text TEXT NOT NULL,
  segment_index INTEGER DEFAULT 0,
  timestamp_start NUMERIC,
  timestamp_end NUMERIC,
  confidence NUMERIC,
  source TEXT DEFAULT 'browser_speech_recognition',
  audio_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clinical_transcripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinical_transcripts_manage_own" ON public.clinical_transcripts;
CREATE POLICY "clinical_transcripts_manage_own" ON public.clinical_transcripts
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

-- 4) Cards inteligentes exibidos durante a consulta
CREATE TABLE IF NOT EXISTS public.clinical_ai_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.clinical_visits(id) ON DELETE CASCADE NOT NULL,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('missing_data', 'suggested_question', 'attention_point', 'summary', 'medication_safety', 'next_action')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clinical_ai_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinical_ai_cards_manage_own" ON public.clinical_ai_cards;
CREATE POLICY "clinical_ai_cards_manage_own" ON public.clinical_ai_cards
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

-- 5) Nota clinica final revisada pelo medico
CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.clinical_visits(id) ON DELETE CASCADE NOT NULL,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  soap_subjective TEXT,
  soap_objective TEXT,
  soap_assessment TEXT,
  soap_plan TEXT,
  doctor_observations TEXT,
  final_text TEXT,
  reviewed_by_doctor BOOLEAN DEFAULT false,
  signed_by_doctor BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinical_notes_manage_own" ON public.clinical_notes;
CREATE POLICY "clinical_notes_manage_own" ON public.clinical_notes
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

-- 6) Auditoria do uso da IA no atendimento
CREATE TABLE IF NOT EXISTS public.clinical_ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.clinical_visits(id) ON DELETE CASCADE,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tool_type TEXT NOT NULL,
  model_provider TEXT DEFAULT 'mydatamed_copilot_mvp',
  input_scope TEXT DEFAULT 'visit_transcript_only',
  output_summary TEXT,
  reviewed_by_doctor BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clinical_ai_usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinical_ai_usage_logs_manage_own" ON public.clinical_ai_usage_logs;
CREATE POLICY "clinical_ai_usage_logs_manage_own" ON public.clinical_ai_usage_logs
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

-- 7) Convite para converter paciente avulso em HealthWallet
CREATE TABLE IF NOT EXISTS public.guest_to_healthwallet_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_patient_id UUID REFERENCES public.guest_patients(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.clinical_visits(id) ON DELETE SET NULL,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_name TEXT,
  patient_email TEXT,
  patient_phone TEXT,
  invite_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'sent', 'accepted', 'expired', 'cancelled')),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.guest_to_healthwallet_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guest_to_healthwallet_invites_manage_own" ON public.guest_to_healthwallet_invites;
CREATE POLICY "guest_to_healthwallet_invites_manage_own" ON public.guest_to_healthwallet_invites
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

-- 8) Indices
CREATE INDEX IF NOT EXISTS idx_guest_patients_professional_user ON public.guest_patients(professional_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_visits_professional_user ON public.clinical_visits(professional_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_visits_appointment ON public.clinical_visits(appointment_id);
CREATE INDEX IF NOT EXISTS idx_clinical_visits_guest_patient ON public.clinical_visits(guest_patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_transcripts_visit ON public.clinical_transcripts(visit_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_clinical_ai_cards_visit ON public.clinical_ai_cards(visit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_visit ON public.clinical_notes(visit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_ai_usage_logs_visit ON public.clinical_ai_usage_logs(visit_id, created_at DESC);

-- 9) Comentarios
COMMENT ON TABLE public.clinical_visits IS 'Atendimentos com transcricao/IA de apoio. A decisao final e do profissional.';
COMMENT ON TABLE public.clinical_ai_cards IS 'Cards de apoio exibidos durante a consulta: perguntas, dados ausentes, pontos de atencao e resumo parcial.';
COMMENT ON TABLE public.clinical_ai_usage_logs IS 'Auditoria do uso de IA como apoio na consulta, para registro em prontuario.';
COMMENT ON COLUMN public.clinical_visits.data_scope IS 'visit_only para paciente avulso; healthwallet_authorized quando houver dados compartilhados pelo paciente.';

-- PRONTO.
-- Fluxo: criar atendimento -> consentir microfone/transcricao/IA -> transcrever -> cards -> SOAP -> medico revisa/salva/assina.
