-- =====================================================
-- MYDATAMED - ENTRADA DO PACIENTE / RECEPCAO - V1
-- Execute no Supabase SQL Editor do projeto HealthWallet/MyDataMed.
-- Objetivo: facilitar a chegada do paciente, reduzir papelada, organizar dados
-- antes do atendimento e criar base auditavel para diminuir retrabalho e glosas administrativas.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Sessao de entrada/check-in operacional
CREATE TABLE IF NOT EXISTS public.patient_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  clinic_name TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'healthwallet_code', 'appointment', 'import', 'other')),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'triage', 'ready', 'in_care', 'completed', 'cancelled')),

  -- Vinculos possíveis
  patient_user_id UUID,
  guest_patient_id UUID,
  appointment_id UUID,
  started_visit_id UUID,

  -- Dados minimos de entrada
  patient_name TEXT NOT NULL,
  patient_cpf TEXT,
  patient_birth_date DATE,
  patient_phone TEXT,
  patient_email TEXT,
  specialty TEXT,
  reason TEXT,

  -- Plano/carteirinha quando informado/autorizado
  health_plan_provider TEXT,
  health_plan_card_number TEXT,
  health_plan_type TEXT,
  plan_holder_name TEXT,
  plan_valid_until DATE,
  plan_payload JSONB DEFAULT '{}'::jsonb,

  -- Escopo, consentimentos e qualidade cadastral
  data_scope TEXT DEFAULT 'intake_only' CHECK (data_scope IN ('intake_only', 'healthwallet_authorized', 'appointment_data', 'mixed')),
  healthwallet_access_code TEXT,
  patient_data_consent BOOLEAN DEFAULT false,
  plan_data_consent BOOLEAN DEFAULT false,
  lgpd_consent BOOLEAN DEFAULT false,
  consent_text TEXT,
  consented_at TIMESTAMPTZ,
  consent_method TEXT DEFAULT 'desk_confirmation',

  -- Checklist pre-atendimento
  checklist JSONB DEFAULT '{}'::jsonb,
  missing_fields TEXT[] DEFAULT ARRAY[]::TEXT[],
  intake_notes TEXT,
  reception_notes TEXT,

  -- Controle operacional
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  triage_started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  care_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Auditoria e integracao futura
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.patient_intakes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_intakes_manage_own_professional" ON public.patient_intakes;
CREATE POLICY "patient_intakes_manage_own_professional" ON public.patient_intakes
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

CREATE INDEX IF NOT EXISTS idx_patient_intakes_professional_user ON public.patient_intakes(professional_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_intakes_status ON public.patient_intakes(professional_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_intakes_patient_user ON public.patient_intakes(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_patient_intakes_guest_patient ON public.patient_intakes(guest_patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_intakes_started_visit ON public.patient_intakes(started_visit_id);

-- 2) Eventos/auditoria do fluxo de entrada
CREATE TABLE IF NOT EXISTS public.patient_intake_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id UUID REFERENCES public.patient_intakes(id) ON DELETE CASCADE NOT NULL,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  from_status TEXT,
  to_status TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.patient_intake_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_intake_events_manage_own_professional" ON public.patient_intake_events;
CREATE POLICY "patient_intake_events_manage_own_professional" ON public.patient_intake_events
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

CREATE INDEX IF NOT EXISTS idx_patient_intake_events_intake ON public.patient_intake_events(intake_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_intake_events_professional ON public.patient_intake_events(professional_user_id, created_at DESC);

-- 3) Comentarios de documentacao
COMMENT ON TABLE public.patient_intakes IS 'Fila/entrada do paciente no MyDataMed. Facilita recepcao, check-in, dados autorizados, checklist pre-atendimento e inicio da Consulta Assistida.';
COMMENT ON TABLE public.patient_intake_events IS 'Auditoria do fluxo de entrada do paciente: criacao, validacao, mudanca de status, inicio de atendimento e conclusao.';
COMMENT ON COLUMN public.patient_intakes.data_scope IS 'Define se a entrada usa apenas dados informados na recepcao, dados autorizados HealthWallet, dados de agenda ou escopo misto.';
COMMENT ON COLUMN public.patient_intakes.missing_fields IS 'Campos pendentes identificados antes do atendimento. Ajuda a reduzir retrabalho, papelada e falhas administrativas.';

-- 4) Helper simples para atualizar updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patient_intakes_updated_at ON public.patient_intakes;
CREATE TRIGGER trg_patient_intakes_updated_at
BEFORE UPDATE ON public.patient_intakes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
