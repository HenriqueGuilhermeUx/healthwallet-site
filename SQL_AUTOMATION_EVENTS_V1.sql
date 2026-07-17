-- =====================================================
-- MYDATAMED / HEALTHWALLET - AUTOMATION EVENTS V1
-- Execute no Supabase SQL Editor.
-- Objetivo: criar fila operacional para n8n / MyDataMed Autopilot.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  source_app TEXT DEFAULT 'mydatamed',
  source_table TEXT,
  source_id TEXT,
  actor_user_id UUID,
  actor_role TEXT,
  patient_id UUID,
  professional_id UUID,
  care_link_id UUID,
  task_id UUID,
  appointment_id UUID,
  charge_id UUID,
  payload JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','processed','failed','skipped','cancelled')),
  priority INTEGER DEFAULT 5,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_events_status_schedule ON public.automation_events(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_automation_events_type ON public.automation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_automation_events_patient_id ON public.automation_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_automation_events_professional_id ON public.automation_events(professional_id);
CREATE INDEX IF NOT EXISTS idx_automation_events_care_link_id ON public.automation_events(care_link_id);
CREATE INDEX IF NOT EXISTS idx_automation_events_created_at ON public.automation_events(created_at DESC);

CREATE OR REPLACE VIEW public.pending_automation_events AS
SELECT *
FROM public.automation_events
WHERE status = 'pending'
  AND scheduled_for <= NOW()
  AND attempts < max_attempts
ORDER BY priority ASC, scheduled_for ASC, created_at ASC;

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own automation events" ON public.automation_events;
CREATE POLICY "Users insert own automation events"
ON public.automation_events
FOR INSERT
WITH CHECK (
  auth.uid() = actor_user_id
  OR auth.uid() = patient_id
);

DROP POLICY IF EXISTS "Users read own automation events" ON public.automation_events;
CREATE POLICY "Users read own automation events"
ON public.automation_events
FOR SELECT
USING (
  auth.uid() = actor_user_id
  OR auth.uid() = patient_id
);

DROP POLICY IF EXISTS "Users update own automation events" ON public.automation_events;
CREATE POLICY "Users update own automation events"
ON public.automation_events
FOR UPDATE
USING (
  auth.uid() = actor_user_id
  OR auth.uid() = patient_id
)
WITH CHECK (
  auth.uid() = actor_user_id
  OR auth.uid() = patient_id
);

-- Eventos recomendados para o n8n:
-- care_link_requested, care_link_approved, care_link_rejected, care_link_revoked
-- smartbots_task_created, crm_task_due, teleconsultation_created, teleconsultation_completed
-- patient_plan_created, payment_paid, payment_overdue, exam_uploaded, document_signed
--
-- Modelo operacional recomendado:
-- 1. Apps gravam eventos em automation_events.
-- 2. n8n consulta pending_automation_events com service role ou API interna.
-- 3. n8n processa SmartBots, Staff, DocWallet, NextGen, IA e notificações.
-- 4. n8n marca status como processed ou failed e registra last_error.
--
-- Regras de produto:
-- - MyDataMed Autopilot coordena cuidado, não substitui decisão profissional.
-- - Eventos com dados sensíveis devem ser processados apenas por fluxos autorizados.
-- - O paciente mantém controle de consentimento e revogação.
