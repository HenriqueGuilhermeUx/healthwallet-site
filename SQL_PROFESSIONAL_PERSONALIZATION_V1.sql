-- =====================================================
-- MYDATAMED PERSONALIZACAO PROFISSIONAL - V1
-- Execute no Supabase SQL Editor do projeto HealthWallet/MyDataMed.
-- Objetivo: permitir primeiro acesso autodeclarado, personalizar IA por profissao/especialidade
-- e bloquear recursos regulados por capacidade/verificacao.
-- =====================================================

-- 1) Campos de contexto, onboarding, verificacao e capacidades no cadastro profissional
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'self_declared'
    CHECK (verification_status IN ('self_declared', 'pending', 'verified', 'rejected', 'suspended')),
  ADD COLUMN IF NOT EXISTS verification_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_capabilities JSONB DEFAULT '["basic_workspace", "ai_copilot", "patient_records", "care_plan", "follow_up", "crm"]'::jsonb,
  ADD COLUMN IF NOT EXISTS blocked_capabilities JSONB DEFAULT '["prescription", "official_signature", "controlled_prescription", "official_medical_document"]'::jsonb,
  ADD COLUMN IF NOT EXISTS professional_context JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS practice_preferences JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_objectives TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS consultation_template TEXT DEFAULT 'general_health_visit',
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.professionals
SET verification_status = COALESCE(verification_status, 'self_declared'),
    allowed_capabilities = COALESCE(allowed_capabilities, '["basic_workspace", "ai_copilot", "patient_records", "care_plan", "follow_up", "crm"]'::jsonb),
    blocked_capabilities = COALESCE(blocked_capabilities, '["prescription", "official_signature", "controlled_prescription", "official_medical_document"]'::jsonb),
    professional_context = COALESCE(professional_context, '{}'::jsonb),
    practice_preferences = COALESCE(practice_preferences, '{}'::jsonb),
    consultation_template = COALESCE(consultation_template, 'general_health_visit')
WHERE true;

-- 2) Preferencias detalhadas do jeito de atender
CREATE TABLE IF NOT EXISTS public.professional_ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  professional_type TEXT NOT NULL,
  specialty TEXT,
  note_template TEXT DEFAULT 'general_health_visit',
  preferred_summary_style TEXT DEFAULT 'structured',
  preferred_tone TEXT DEFAULT 'professional_clear',
  patient_audience TEXT,
  service_style TEXT,
  required_questions TEXT[] DEFAULT ARRAY[]::TEXT[],
  default_follow_up_message TEXT,
  custom_instructions TEXT,
  care_plan_preferences JSONB DEFAULT '{}'::jsonb,
  ai_card_preferences JSONB DEFAULT '{}'::jsonb,
  capabilities_snapshot JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.professional_ai_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "professional_ai_preferences_manage_own" ON public.professional_ai_preferences;
CREATE POLICY "professional_ai_preferences_manage_own" ON public.professional_ai_preferences
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

CREATE INDEX IF NOT EXISTS idx_professional_ai_preferences_user ON public.professional_ai_preferences(professional_user_id);
CREATE INDEX IF NOT EXISTS idx_professional_ai_preferences_type ON public.professional_ai_preferences(professional_type, note_template);

-- 3) Preferencias default por categoria profissional, sem sobrescrever quem ja personalizou
INSERT INTO public.professional_ai_preferences (
  professional_id,
  professional_user_id,
  professional_type,
  specialty,
  note_template,
  required_questions,
  custom_instructions,
  capabilities_snapshot
)
SELECT
  p.id,
  p.user_id,
  p.professional_type,
  p.specialty,
  CASE
    WHEN p.professional_type = 'medico' THEN 'clinical_soap'
    WHEN p.professional_type = 'nutricionista' THEN 'nutritional_evolution'
    WHEN p.professional_type = 'fisioterapeuta' THEN 'functional_rehab_evolution'
    WHEN p.professional_type IN ('psicologo', 'terapeuta') THEN 'therapeutic_session_note'
    WHEN p.professional_type = 'enfermeiro' THEN 'nursing_triage_followup'
    ELSE 'general_health_visit'
  END,
  CASE
    WHEN p.professional_type = 'medico' THEN ARRAY['Queixa principal', 'Alergias', 'Medicamentos em uso', 'Antecedentes', 'Sinais de alarme']::TEXT[]
    WHEN p.professional_type = 'nutricionista' THEN ARRAY['Recordatorio alimentar', 'Hidratacao', 'Sono', 'Treino/atividade', 'Restricoes e preferencias', 'Objetivo nutricional']::TEXT[]
    WHEN p.professional_type = 'fisioterapeuta' THEN ARRAY['Local da dor', 'Escala de dor', 'Movimento que piora', 'Movimento que melhora', 'Limitacao funcional', 'Exercicios orientados']::TEXT[]
    WHEN p.professional_type IN ('psicologo', 'terapeuta') THEN ARRAY['Queixa principal', 'Contexto emocional', 'Sono', 'Rede de apoio', 'Objetivos terapeuticos', 'Pontos para proxima sessao']::TEXT[]
    WHEN p.professional_type = 'enfermeiro' THEN ARRAY['Sinais vitais', 'Queixa atual', 'Procedimentos realizados', 'Orientacoes dadas', 'Encaminhamentos']::TEXT[]
    ELSE ARRAY['Queixa/objetivo principal', 'Historico relevante', 'Orientacoes dadas', 'Plano de acompanhamento']::TEXT[]
  END,
  'IA deve atuar apenas como apoio. O profissional revisa, edita, valida e assume responsabilidade dentro do seu escopo profissional.',
  jsonb_build_object(
    'verification_status', COALESCE(p.verification_status, 'self_declared'),
    'allowed_capabilities', COALESCE(p.allowed_capabilities, '[]'::jsonb),
    'blocked_capabilities', COALESCE(p.blocked_capabilities, '[]'::jsonb)
  )
FROM public.professionals p
ON CONFLICT (professional_user_id) DO NOTHING;

-- 4) Comentarios de produto
COMMENT ON COLUMN public.professionals.verification_status IS 'self_declared libera workspace e IA; verified libera recursos regulados conforme capacidade.';
COMMENT ON COLUMN public.professionals.allowed_capabilities IS 'Capacidades liberadas para o profissional: basic_workspace, ai_copilot, patient_records, care_plan, follow_up, crm etc.';
COMMENT ON COLUMN public.professionals.blocked_capabilities IS 'Capacidades bloqueadas ate verificacao/escopo: prescription, official_signature, controlled_prescription, official_medical_document.';
COMMENT ON TABLE public.professional_ai_preferences IS 'Preferencias do jeito de atender usadas para personalizar cards, resumo, nota e plano de cuidado por profissao/especialidade.';
