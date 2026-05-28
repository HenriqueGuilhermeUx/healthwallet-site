-- ================================================
-- HealthWallet.pro - Tabelas para Profissionais
-- Execute este SQL no Supabase SQL Editor
-- ================================================

-- 1. Tabela de Profissionais de Saúde
DROP TABLE IF EXISTS public.professionals CASCADE;
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  cpf CHAR(11) UNIQUE NOT NULL,
  professional_register TEXT NOT NULL,
  register_state CHAR(2) NOT NULL,
  professional_type TEXT NOT NULL CHECK (professional_type IN (
    'medico', 'fisioterapeuta', 'nutricionista', 'psicologo',
    'enfermeiro', 'fonoaudiologo', 'odonto', 'outro'
  )),
  specialty TEXT,
  has_digital_certificate BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.professionals IS 'Profissionais de saúde cadastrados na plataforma';

-- 2. Tabela de Códigos de Acesso
DROP TABLE IF EXISTS public.access_codes CASCADE;
CREATE TABLE public.access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CHAR(6) NOT NULL,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.access_codes IS 'Códigos de acesso temporários gerados pelos pacientes';

-- Índice para buscar códigos rapidamente
CREATE INDEX IF NOT EXISTS idx_access_codes_code ON public.access_codes(code);
CREATE INDEX IF NOT EXISTS idx_access_codes_patient ON public.access_codes(patient_id);

-- 3. Tabela de Documentos Recebidos (pelos pacientes)
DROP TABLE IF EXISTS public.received_documents CASCADE;
CREATE TABLE public.received_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'receita', 'receituario', 'evolucao', 'orientacao', 'atestado', 'outro'
  )),
  title TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  digital_signature JSONB,
  sent_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.received_documents IS 'Documentos/envios recebidos pelos pacientes';

-- Índice para buscar documentos por paciente
CREATE INDEX IF NOT EXISTS idx_received_documents_patient ON public.received_documents(patient_id);

-- 4. Tabela de Permissões de Compartilhamento
DROP TABLE IF EXISTS public.shared_permissions CASCADE;
CREATE TABLE public.shared_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.shared_permissions IS 'PermissÃµes de compartilhamento ativas';

-- Índice para buscar permissões
CREATE INDEX IF NOT EXISTS idx_shared_permissions_patient ON public.shared_permissions(patient_id);

-- 5. Tabela de Logs de Auditoria
DROP TABLE IF EXISTS public.access_logs CASCADE;
CREATE TABLE public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.access_logs IS 'Logs de auditoria de acessos';

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.received_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para professionals
DROP POLICY IF EXISTS "Professionals can view own profile" ON public.professionals;
CREATE POLICY "Professionals can view own profile" ON public.professionals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own professional" ON public.professionals;
CREATE POLICY "Users can insert own professional" ON public.professionals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own professional" ON public.professionals;
CREATE POLICY "Users can update own professional" ON public.professionals
  FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para access_codes
DROP POLICY IF EXISTS "Anyone can insert access codes" ON public.access_codes;
CREATE POLICY "Anyone can insert access codes" ON public.access_codes
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read active access codes" ON public.access_codes;
CREATE POLICY "Anyone can read active access codes" ON public.access_codes
  FOR SELECT USING (expires_at > NOW());

DROP POLICY IF EXISTS "Professionals can update access codes" ON public.access_codes;
CREATE POLICY "Professionals can update access codes" ON public.access_codes
  FOR UPDATE USING (
    professional_id IN (
      SELECT id FROM public.professionals WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Patients can view own access codes" ON public.access_codes;
CREATE POLICY "Patients can view own access codes" ON public.access_codes
  FOR SELECT USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Patients can delete own access codes" ON public.access_codes;
CREATE POLICY "Patients can delete own access codes" ON public.access_codes
  FOR DELETE USING (auth.uid() = patient_id);

-- Políticas para received_documents
DROP POLICY IF EXISTS "Patients can view own documents" ON public.received_documents;
CREATE POLICY "Patients can view own documents" ON public.received_documents
  FOR SELECT USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Patients can insert own documents" ON public.received_documents;
CREATE POLICY "Patients can insert own documents" ON public.received_documents
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Patients can update own documents" ON public.received_documents;
CREATE POLICY "Patients can update own documents" ON public.received_documents
  FOR UPDATE USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Professionals can insert documents for patients" ON public.received_documents;
CREATE POLICY "Professionals can insert documents for patients" ON public.received_documents
  FOR INSERT WITH CHECK (
    professional_id IN (
      SELECT id FROM public.professionals WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Professionals can view documents they sent" ON public.received_documents;
CREATE POLICY "Professionals can view documents they sent" ON public.received_documents
  FOR SELECT USING (
    professional_id IN (
      SELECT id FROM public.professionals WHERE user_id = auth.uid()
    )
  );

-- Políticas para shared_permissions
DROP POLICY IF EXISTS "Patients can manage own permissions" ON public.shared_permissions;
CREATE POLICY "Patients can manage own permissions" ON public.shared_permissions
  FOR ALL USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Professionals can view permissions for themselves" ON public.shared_permissions;
CREATE POLICY "Professionals can view permissions for themselves" ON public.shared_permissions
  FOR SELECT USING (
    professional_id IN (
      SELECT id FROM public.professionals WHERE user_id = auth.uid()
    )
  );

-- ================================================
-- FUNÇÕES ÚTEIS
-- ================================================

-- Função para gerar código de 6 dígitos
DROP FUNCTION IF EXISTS generate_access_code();
CREATE OR REPLACE FUNCTION generate_access_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
BEGIN
  code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Função para criar código de acesso
DROP FUNCTION IF EXISTS create_access_code(UUID, JSONB, INTEGER);
CREATE OR REPLACE FUNCTION create_access_code(
  p_patient_id UUID,
  p_permissions JSONB,
  p_duration_hours INTEGER DEFAULT 24
)
RETURNS UUID AS $$
DECLARE
  new_code TEXT;
  new_id UUID;
BEGIN
  new_code := generate_access_code();

  INSERT INTO public.access_codes (code, patient_id, permissions, expires_at)
  VALUES (new_code, p_patient_id, p_permissions, NOW() + (p_duration_hours || ' hours')::INTERVAL)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- CONFIGURAÇÕES EXTRAS
-- ================================================

-- Habilitar realtime para notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.received_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.access_codes;
