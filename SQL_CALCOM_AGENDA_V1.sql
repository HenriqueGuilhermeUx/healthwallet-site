-- SQL_CALCOM_AGENDA_V1.sql
-- Integração Cal.com / Cal.diy + MyDataMed Autopilot
-- Rode depois de:
-- 1) SQL_AUTOMATION_EVENTS_V1.sql
-- 2) SQL_TELECONSULTA_CRM_NEXTGEN_V2.sql
-- 3) SQL_TELECONSULTA_NEXTGEN_COBRANCAS_V1.sql

-- 1. Integrações de agenda por profissional
CREATE TABLE IF NOT EXISTS public.professional_calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_user_id UUID NOT NULL,
  professional_id UUID,
  provider TEXT NOT NULL DEFAULT 'calcom',
  status TEXT NOT NULL DEFAULT 'active',
  external_user_id TEXT,
  external_user_email TEXT,
  external_username TEXT,
  external_calendar_id TEXT,
  booking_url TEXT,
  webhook_secret_hint TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (professional_user_id, provider, COALESCE(external_user_email, ''), COALESCE(external_username, ''))
);

ALTER TABLE public.professional_calendar_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Professionals manage own calendar integrations" ON public.professional_calendar_integrations;
CREATE POLICY "Professionals manage own calendar integrations"
ON public.professional_calendar_integrations
FOR ALL
USING (auth.uid() = professional_user_id)
WITH CHECK (auth.uid() = professional_user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_professional_user
ON public.professional_calendar_integrations (professional_user_id, provider, status);

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_external_email
ON public.professional_calendar_integrations (provider, external_user_email, status);

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_external_username
ON public.professional_calendar_integrations (provider, external_username, status);

-- 2. Log bruto de webhooks recebidos do Cal.com / Cal.diy
CREATE TABLE IF NOT EXISTS public.calcom_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'calcom',
  event_type TEXT NOT NULL,
  external_booking_id TEXT,
  professional_id UUID,
  patient_id UUID,
  patient_email TEXT,
  professional_email TEXT,
  normalized_payload JSONB DEFAULT '{}'::jsonb,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  automation_event_id UUID,
  status TEXT DEFAULT 'received',
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error TEXT
);

ALTER TABLE public.calcom_webhook_events ENABLE ROW LEVEL SECURITY;

-- Log técnico. Leitura/mutação direta pelo usuário não é necessária.
DROP POLICY IF EXISTS "No direct user access to calcom webhook events" ON public.calcom_webhook_events;
CREATE POLICY "No direct user access to calcom webhook events"
ON public.calcom_webhook_events
FOR ALL
USING (false)
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_calcom_webhook_events_booking
ON public.calcom_webhook_events (provider, external_booking_id);

CREATE INDEX IF NOT EXISTS idx_calcom_webhook_events_type
ON public.calcom_webhook_events (event_type, received_at DESC);

-- 3. Enriquecimento da tabela de teleconsultas com referência externa
ALTER TABLE public.telemedicine_appointments
  ADD COLUMN IF NOT EXISTS calendar_provider TEXT,
  ADD COLUMN IF NOT EXISTS calcom_booking_id TEXT,
  ADD COLUMN IF NOT EXISTS external_calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS external_booking_url TEXT,
  ADD COLUMN IF NOT EXISTS external_reschedule_url TEXT,
  ADD COLUMN IF NOT EXISTS external_cancel_url TEXT,
  ADD COLUMN IF NOT EXISTS calendar_metadata JSONB DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_telemedicine_calcom_booking_id
ON public.telemedicine_appointments (calcom_booking_id)
WHERE calcom_booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_telemedicine_calendar_provider
ON public.telemedicine_appointments (calendar_provider, preferred_date, preferred_time);

-- 4. Eventos suportados no Autopilot
-- calendar_booking_created: Cal.com criou agendamento; Autopilot cria teleconsulta e tarefas.
-- calendar_booking_rescheduled: Cal.com reagendou; Autopilot atualiza teleconsulta e tarefas.
-- calendar_booking_cancelled: Cal.com cancelou; Autopilot cancela teleconsulta/tarefas pendentes.

-- Regra de produto:
-- Cal.com/Cal.diy guarda disponibilidade e agenda.
-- Dados clínicos continuam no MyDataMed/HealthWallet, mediante autorização do paciente.
-- Não incluir laudos, diagnósticos ou documentos sensíveis no payload público do calendário.
