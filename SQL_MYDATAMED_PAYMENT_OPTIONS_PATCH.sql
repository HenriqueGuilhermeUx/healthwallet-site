-- =====================================================
-- MYDATAMED - PAYMENT OPTIONS PATCH
-- Execute depois de SQL_MYDATAMED_OPS_BILLING_USAGE_V1.sql.
-- Objetivo: permitir cobrança opcional pela plataforma, Pix próprio, cartão/link externo e recebimento fora da plataforma.
-- NF/NFS-e fica fora deste momento.
-- =====================================================

ALTER TABLE public.professional_financial_entries
  ADD COLUMN IF NOT EXISTS payment_preference TEXT DEFAULT 'not_defined'
    CHECK (payment_preference IN ('platform_pix', 'own_pix', 'external_card_link', 'external_payment_link', 'offline', 'not_defined', 'other')),
  ADD COLUMN IF NOT EXISTS own_pix_key TEXT,
  ADD COLUMN IF NOT EXISTS external_payment_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT,
  ADD COLUMN IF NOT EXISTS charge_id UUID,
  ADD COLUMN IF NOT EXISTS payment_url TEXT,
  ADD COLUMN IF NOT EXISTS pix_copy_paste TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code_url TEXT,
  ADD COLUMN IF NOT EXISTS customer_tax_id TEXT;

CREATE INDEX IF NOT EXISTS idx_professional_financial_entries_payment_preference
ON public.professional_financial_entries(professional_user_id, payment_preference, status);

COMMENT ON COLUMN public.professional_financial_entries.payment_preference IS
'Forma escolhida pelo profissional: cobrança MyDataMed, Pix próprio, link/cartão externo, offline ou outro.';
COMMENT ON COLUMN public.professional_financial_entries.own_pix_key IS
'Chave Pix própria do profissional/clínica quando não usar cobrança pela plataforma.';
COMMENT ON COLUMN public.professional_financial_entries.external_payment_url IS
'Link externo de cartão, banco, maquininha, Mercado Pago, InfinitePay, Stripe etc.';
COMMENT ON COLUMN public.professional_financial_entries.payment_instructions IS
'Instruções livres enviáveis ao paciente sobre como pagar fora da plataforma.';
