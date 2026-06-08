-- =====================================================================
-- Migration: Envio de PDF por Email + Assinatura Própria
-- Substitui Clicksign como provider padrão. Email + audit trail
-- dão validade jurídica (Lei 14.063/2020, art. 4º).
-- =====================================================================

-- 1) DELIVERIES — registro de cada envio por email
--    Inclui tudo pra audit trail: hash do doc, IPs, timestamps, status
CREATE TABLE IF NOT EXISTS public.document_deliveries (
    id                   SERIAL PRIMARY KEY,
    document_type        VARCHAR(20) NOT NULL CHECK (document_type IN ('receita', 'exame')),
    document_id          INT NOT NULL,
    medico_id            UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    paciente_id          UUID NOT NULL,
    recipient_email      VARCHAR(255) NOT NULL,
    subject              VARCHAR(500),
    body_html            TEXT,
    document_hash        VARCHAR(64) NOT NULL,            -- SHA-256 do PDF (hex)
    confirm_token        VARCHAR(64) UNIQUE,              -- token pro paciente confirmar leitura
    confirmation_status  VARCHAR(20) NOT NULL DEFAULT 'pendente',  -- pendente | confirmada | expirada
    confirmed_at         TIMESTAMPTZ,
    confirmed_ip         VARCHAR(64),
    confirmed_user_agent TEXT,
    resend_message_id    VARCHAR(100),                    -- ID retornado pela Resend
    delivery_status      VARCHAR(20) NOT NULL DEFAULT 'enviado',  -- enviado | falhou | bounce | dry_run
    error_message        TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dd_document   ON public.document_deliveries(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_dd_medico     ON public.document_deliveries(medico_id);
CREATE INDEX IF NOT EXISTS idx_dd_paciente   ON public.document_deliveries(paciente_id);
CREATE INDEX IF NOT EXISTS idx_dd_token      ON public.document_deliveries(confirm_token);
CREATE INDEX IF NOT EXISTS idx_dd_created    ON public.document_deliveries(created_at DESC);

-- 2) OUTBOX — fallback se Resend não tiver API key configurada
--    Email fica salvo aqui pra reenvio manual
CREATE TABLE IF NOT EXISTS public.email_outbox (
    id          SERIAL PRIMARY KEY,
    to_email    VARCHAR(255) NOT NULL,
    subject     VARCHAR(500) NOT NULL,
    body_html   TEXT NOT NULL,
    attachment_pdf BYTEA,
    attachment_name VARCHAR(255),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | sent | failed
    sent_at     TIMESTAMPTZ,
    error       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3) RLS
ALTER TABLE public.document_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox         ENABLE ROW LEVEL SECURITY;

-- DELIVERIES: médico vê os envios que fez, paciente vê os que recebeu
DROP POLICY IF EXISTS "dd_medico_all" ON public.document_deliveries;
CREATE POLICY "dd_medico_all" ON public.document_deliveries
    FOR ALL USING (medico_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "dd_paciente_select" ON public.document_deliveries;
CREATE POLICY "dd_paciente_select" ON public.document_deliveries
    FOR SELECT USING (paciente_id = auth.uid());
-- Leitura pública por token (pra página /verify/[id]) — sem auth, via service role
-- (Tratado no backend, sem policy explícita aqui)

-- OUTBOX: só service role
DROP POLICY IF EXISTS "outbox_service" ON public.email_outbox;
CREATE POLICY "outbox_service" ON public.email_outbox
    FOR ALL USING (false);

-- 4) VIEW AUXILIAR — audit trail público
CREATE OR REPLACE VIEW public.vw_document_deliveries_public AS
SELECT
    d.id,
    d.document_type,
    d.document_id,
    d.recipient_email,
    d.document_hash,
    d.confirmation_status,
    d.confirmed_at,
    d.delivery_status,
    d.created_at,
    p.full_name AS medico_nome,
    p.professional_register AS medico_crm,
    p.register_state AS medico_uf
FROM public.document_deliveries d
JOIN public.professionals p ON p.id = d.medico_id;
