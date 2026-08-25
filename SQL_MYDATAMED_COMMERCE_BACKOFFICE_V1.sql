-- =====================================================
-- MYDATAMED - COMMERCE / BACKOFFICE / PUBLIC PROFILE - V1
-- Execute no Supabase SQL Editor do projeto HealthWallet/MyDataMed.
-- Objetivo: criar base para planos por volume de atendimentos, página pública/bio link,
-- serviços, pacotes, cobrança/financeiro e uso mensal de IA/backoffice.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Catálogo de planos comerciais
CREATE TABLE IF NOT EXISTS public.mydatamed_plan_catalog (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  included_assisted_visits INTEGER NOT NULL DEFAULT 0,
  included_modo_credits INTEGER NOT NULL DEFAULT 0,
  max_professionals INTEGER,
  max_assistants INTEGER,
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.mydatamed_plan_catalog
(code, name, price_cents, included_assisted_visits, included_modo_credits, max_professionals, max_assistants, description, features, limits, sort_order)
VALUES
('free', 'Free Dados', 0, 0, 0, 1, 0,
 'Acesso gratuito a dados autorizados pelo paciente. Não inclui operação completa de consultório digital.',
 '["Cadastro profissional", "Acesso a dados autorizados", "Visualização de documentos compartilhados", "Perfil básico"]'::jsonb,
 '{"commercial_workspace": false}'::jsonb,
 0),
('start', 'Start', 12900, 100, 0, 1, 0,
 'Consultório digital essencial para começar a atender com estrutura profissional.',
 '["100 atendimentos assistidos/mês", "Landing page e bio link", "Agenda", "Pré-atendimento", "Anamnese", "IA assistiva", "Serviços e pacotes", "Cobranças diretas ou pela plataforma", "Recibos", "Contas a pagar e receber", "CRM básico"]'::jsonb,
 '{"team": false, "modo": false, "clinic_queue": "basic"}'::jsonb,
 1),
('pro', 'Pro', 19900, 200, 500, 1, 1,
 'Consultório digital completo para operar, automatizar e crescer com MODO e CRM avançado.',
 '["200 atendimentos assistidos/mês", "Tudo do Start", "MODO incluída", "CRM completo", "Automações de retorno", "Transcrição/resumo avançado", "Pacotes e programas", "Fluxo de caixa", "Relatórios", "1 assistente/secretária"]'::jsonb,
 '{"team": "assistant", "modo": true, "advanced_crm": true}'::jsonb,
 2),
('clinic', 'Clinic', 39900, 400, 1200, NULL, NULL,
 'Operação para clínicas e equipes com recepção digital, múltiplos profissionais e controle gerencial.',
 '["400 atendimentos assistidos/mês", "Recepção digital por QR Code", "Múltiplos profissionais", "Permissões por função", "Fila e triagem", "Gestão de equipe", "Financeiro por profissional/unidade", "Repasses", "Dashboard gerencial", "MODO para equipe"]'::jsonb,
 '{"team": true, "multi_professional": true, "reception": true, "financial_management": true}'::jsonb,
 3)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  included_assisted_visits = EXCLUDED.included_assisted_visits,
  included_modo_credits = EXCLUDED.included_modo_credits,
  max_professionals = EXCLUDED.max_professionals,
  max_assistants = EXCLUDED.max_assistants,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

ALTER TABLE public.mydatamed_plan_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read MyDataMed plans" ON public.mydatamed_plan_catalog;
CREATE POLICY "Public can read MyDataMed plans" ON public.mydatamed_plan_catalog
  FOR SELECT USING (is_public = TRUE);

-- 2) Assinatura/uso mensal por profissional ou clínica
CREATE TABLE IF NOT EXISTS public.professional_commercial_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_code TEXT REFERENCES public.mydatamed_plan_catalog(code) DEFAULT 'free',
  status TEXT DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'paused')),
  billing_cycle_start DATE DEFAULT CURRENT_DATE,
  billing_cycle_end DATE,
  included_assisted_visits INTEGER DEFAULT 0,
  used_assisted_visits INTEGER DEFAULT 0,
  included_modo_credits INTEGER DEFAULT 0,
  used_modo_credits INTEGER DEFAULT 0,
  extra_usage JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(professional_user_id)
);

ALTER TABLE public.professional_commercial_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals manage own commercial subscription" ON public.professional_commercial_subscriptions;
CREATE POLICY "Professionals manage own commercial subscription" ON public.professional_commercial_subscriptions
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

-- 3) Página pública/bio link do profissional ou clínica
CREATE TABLE IF NOT EXISTS public.professional_public_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  public_slug TEXT UNIQUE NOT NULL,
  profile_type TEXT DEFAULT 'professional' CHECK (profile_type IN ('professional', 'clinic', 'team')),
  is_published BOOLEAN DEFAULT FALSE,

  display_name TEXT NOT NULL,
  professional_title TEXT,
  specialty TEXT,
  clinic_name TEXT,
  document_type TEXT DEFAULT 'not_informed' CHECK (document_type IN ('cpf', 'cnpj', 'not_informed')),
  document_number TEXT,
  commercial_name TEXT,

  headline TEXT,
  bio TEXT,
  patient_audience TEXT,
  service_mode TEXT DEFAULT 'hybrid' CHECK (service_mode IN ('online', 'presencial', 'hybrid')),
  city TEXT,
  state TEXT,
  address_summary TEXT,

  avatar_url TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  brand_color TEXT DEFAULT '#059669',

  whatsapp TEXT,
  phone TEXT,
  email TEXT,
  instagram_url TEXT,
  website_url TEXT,
  booking_url TEXT,
  primary_cta_label TEXT DEFAULT 'Agendar atendimento',
  primary_cta_url TEXT,

  services JSONB DEFAULT '[]'::jsonb,
  bio_links JSONB DEFAULT '[]'::jsonb,
  seo_title TEXT,
  seo_description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(professional_user_id)
);

ALTER TABLE public.professional_public_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals manage own public profile" ON public.professional_public_profiles;
CREATE POLICY "Professionals manage own public profile" ON public.professional_public_profiles
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

DROP POLICY IF EXISTS "Public can read published public profiles" ON public.professional_public_profiles;
CREATE POLICY "Public can read published public profiles" ON public.professional_public_profiles
  FOR SELECT USING (is_published = TRUE);

CREATE INDEX IF NOT EXISTS idx_professional_public_profiles_slug ON public.professional_public_profiles(public_slug);
CREATE INDEX IF NOT EXISTS idx_professional_public_profiles_user ON public.professional_public_profiles(professional_user_id);

-- 4) Serviços e pacotes vendáveis
CREATE TABLE IF NOT EXISTS public.professional_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT DEFAULT 'consultation' CHECK (service_type IN ('consultation', 'return', 'procedure', 'package', 'program', 'other')),
  duration_minutes INTEGER,
  price_cents INTEGER DEFAULT 0,
  sessions_included INTEGER DEFAULT 1,
  is_public BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals manage own services" ON public.professional_services;
CREATE POLICY "Professionals manage own services" ON public.professional_services
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

DROP POLICY IF EXISTS "Public can read active public services" ON public.professional_services;
CREATE POLICY "Public can read active public services" ON public.professional_services
  FOR SELECT USING (is_public = TRUE AND is_active = TRUE);

CREATE INDEX IF NOT EXISTS idx_professional_services_user ON public.professional_services(professional_user_id, created_at DESC);

-- 5) Financeiro: contas a receber/pagar, recibos e cobranças
CREATE TABLE IF NOT EXISTS public.professional_financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID,
  professional_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('receivable', 'payable')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'paid', 'overdue', 'cancelled')),
  category TEXT,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  patient_name TEXT,
  patient_email TEXT,
  patient_phone TEXT,
  service_id UUID,
  payment_method TEXT DEFAULT 'not_defined' CHECK (payment_method IN ('platform_pix', 'direct_pix', 'cash', 'card', 'bank_transfer', 'not_defined', 'other')),
  receipt_url TEXT,
  invoice_url TEXT,
  external_reference TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.professional_financial_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals manage own financial entries" ON public.professional_financial_entries;
CREATE POLICY "Professionals manage own financial entries" ON public.professional_financial_entries
  FOR ALL USING (auth.uid() = professional_user_id)
  WITH CHECK (auth.uid() = professional_user_id);

CREATE INDEX IF NOT EXISTS idx_professional_financial_entries_user ON public.professional_financial_entries(professional_user_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_professional_financial_entries_status ON public.professional_financial_entries(professional_user_id, entry_type, status);

-- 6) Helper updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mydatamed_plan_catalog_updated_at ON public.mydatamed_plan_catalog;
CREATE TRIGGER trg_mydatamed_plan_catalog_updated_at
BEFORE UPDATE ON public.mydatamed_plan_catalog
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_professional_commercial_subscriptions_updated_at ON public.professional_commercial_subscriptions;
CREATE TRIGGER trg_professional_commercial_subscriptions_updated_at
BEFORE UPDATE ON public.professional_commercial_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_professional_public_profiles_updated_at ON public.professional_public_profiles;
CREATE TRIGGER trg_professional_public_profiles_updated_at
BEFORE UPDATE ON public.professional_public_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_professional_services_updated_at ON public.professional_services;
CREATE TRIGGER trg_professional_services_updated_at
BEFORE UPDATE ON public.professional_services
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_professional_financial_entries_updated_at ON public.professional_financial_entries;
CREATE TRIGGER trg_professional_financial_entries_updated_at
BEFORE UPDATE ON public.professional_financial_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.professional_public_profiles IS 'Landing page e bio link público do profissional/clínica em mydatamed.com/{slug}.';
COMMENT ON TABLE public.professional_services IS 'Serviços, consultas, pacotes e programas vendáveis pelo profissional/clínica.';
COMMENT ON TABLE public.professional_financial_entries IS 'Contas a receber/pagar, recibos, cobranças e base de fluxo de caixa do MyDataMed.';
COMMENT ON TABLE public.professional_commercial_subscriptions IS 'Plano comercial, limites de atendimentos assistidos e créditos MODO/IA por ciclo.';
