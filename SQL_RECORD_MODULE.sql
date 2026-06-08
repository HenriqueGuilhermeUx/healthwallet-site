-- =====================================================================
-- Migration: Prontuário Eletrônico (Electronic Medical Record)
-- Idempotente, baseado no schema existente (não conflita com nada)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Trigger genérica (caso ainda não exista)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 1) CONSULTATIONS — registro de cada consulta/atendimento
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.consultations (
    id                     SERIAL PRIMARY KEY,
    medico_id              UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    paciente_id            UUID NOT NULL,
    data_consulta          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Anamnese estruturada em JSONB (flexível p/ diferentes tipos de consulta)
    -- Sugerido: {"queixa_principal": "...", "hda": "...", "antecedentes_pessoais": "...", "antecedentes_familiares": "...", "habitos": "...", "alergias_relevantes": "..."}
    anamnese               JSONB NOT NULL DEFAULT '{}'::jsonb,

    exame_fisico           TEXT,
    hipotese_diagnostica   TEXT,

    cid_principal_id       INT REFERENCES public.cids(id),
    cid_secundario_id      INT REFERENCES public.cids(id),

    conduta                TEXT,                   -- plano terapêutico
    notas                  TEXT,                   -- observações livres

    status                 VARCHAR(20) NOT NULL DEFAULT 'realizada',
        -- 'em_andamento' (rascunho) | 'realizada' (finalizada)

    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_consultations_updated ON public.consultations;
CREATE TRIGGER trg_consultations_updated
    BEFORE UPDATE ON public.consultations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_consultations_paciente ON public.consultations(paciente_id, data_consulta DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_medico   ON public.consultations(medico_id, data_consulta DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_status    ON public.consultations(status);

-- =====================================================================
-- 2) PATIENT_CONDITIONS — condições crônicas / comorbidades do paciente
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.patient_conditions (
    id                SERIAL PRIMARY KEY,
    paciente_id       UUID NOT NULL,
    cid_id            INT REFERENCES public.cids(id),
    descricao_livre   TEXT,                          -- quando não usar CID
    data_inicio       DATE,
    notas             TEXT,
    ativa             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pc_paciente_ativa ON public.patient_conditions(paciente_id) WHERE ativa = TRUE;

-- =====================================================================
-- 3) MEDICATION_USES — medicações que o paciente está usando atualmente
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.medication_uses (
    id                  SERIAL PRIMARY KEY,
    paciente_id         UUID NOT NULL,
    medicamento_id      INT REFERENCES public.medicamentos(id),
    medicamento_label   TEXT,                         -- texto livre se medicamento_id for null
    dose                VARCHAR(100),                  -- "1 cp", "5ml"
    frequencia          VARCHAR(100),                  -- "8/8h", "2x/dia", "uso contínuo"
    via                 VARCHAR(50),                   -- oral, tópica, IM...
    posologia_completa  TEXT,                          -- opcional, posologia escrita pelo médico
    data_inicio         DATE,
    data_fim            DATE,                          -- null = em uso
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    prescrito_por       UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mu_paciente_ativo ON public.medication_uses(paciente_id) WHERE ativo = TRUE;

-- =====================================================================
-- 4) RLS
-- =====================================================================

ALTER TABLE public.consultations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_conditions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_uses     ENABLE ROW LEVEL SECURITY;

-- CONSULTATIONS: médico que criou vê/edita, paciente vê
DROP POLICY IF EXISTS "consultations_medico_all" ON public.consultations;
CREATE POLICY "consultations_medico_all" ON public.consultations
    FOR ALL USING (medico_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "consultations_paciente_select" ON public.consultations;
CREATE POLICY "consultations_paciente_select" ON public.consultations
    FOR SELECT USING (paciente_id = auth.uid());

-- PATIENT_CONDITIONS: paciente gerencia as próprias; médico vê se tiver acesso
DROP POLICY IF EXISTS "pc_paciente_all" ON public.patient_conditions;
CREATE POLICY "pc_paciente_all" ON public.patient_conditions
    FOR ALL USING (paciente_id = auth.uid());
DROP POLICY IF EXISTS "pc_professional_select" ON public.patient_conditions;
CREATE POLICY "pc_professional_select" ON public.patient_conditions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.access_codes ac
            WHERE ac.patient_id = patient_conditions.paciente_id
              AND ac.professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())
              AND ac.used_at IS NOT NULL
        )
    );

-- MEDICATION_USES: mesma lógica das condições
DROP POLICY IF EXISTS "mu_paciente_all" ON public.medication_uses;
CREATE POLICY "mu_paciente_all" ON public.medication_uses
    FOR ALL USING (paciente_id = auth.uid());
DROP POLICY IF EXISTS "mu_professional_select" ON public.medication_uses;
CREATE POLICY "mu_professional_select" ON public.medication_uses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.access_codes ac
            WHERE ac.patient_id = medication_uses.paciente_id
              AND ac.professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())
              AND ac.used_at IS NOT NULL
        )
    );

-- =====================================================================
-- 5) VIEW AUXILIAR — prontuário agregado (sidebar)
-- =====================================================================

DROP VIEW IF EXISTS public.vw_patient_clinical_context;
CREATE OR REPLACE VIEW public.vw_patient_clinical_context AS
SELECT
    p.id AS paciente_id,
    -- Não referencia colunas que não existem no profiles (full_name, email).
    -- Mantém só o que existe: id, birth_date, gender, blood_type, allergies,
    -- phone, created_at, updated_at. Nome/email vêm do auth.users via API.
    p.birth_date,
    p.gender,
    p.blood_type,
    p.phone,
    -- contadores úteis para a sidebar
    (SELECT COUNT(*) FROM public.alergias_paciente a
        WHERE a.paciente_id = p.id AND a.tipo = 'medicamento') AS n_alergias,
    (SELECT COUNT(*) FROM public.patient_conditions c
        WHERE c.paciente_id = p.id AND c.ativa) AS n_condicoes,
    (SELECT COUNT(*) FROM public.medication_uses m
        WHERE m.paciente_id = p.id AND m.ativo) AS n_medicacoes,
    (SELECT MAX(data_consulta) FROM public.consultations c
        WHERE c.paciente_id = p.id) AS ultima_consulta
FROM public.profiles p;

-- =====================================================================
-- 6) FUNÇÃO DE SEGURANÇA — alertas de alergia + interação ao prescrever
-- =====================================================================

-- (Esta já existia em SQL_PRESCRIPTION_MODULE.sql, mas re-criamos aqui idempotentemente)
CREATE OR REPLACE FUNCTION public.check_clinical_alerts(
    p_paciente_id UUID,
    p_receita_id INT
) RETURNS TABLE(tipo VARCHAR(20), nivel VARCHAR(20), mensagem TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 'alergia'::VARCHAR(20), a.gravidade::VARCHAR(20),
           format('Alergia a %s', pa.nome)
    FROM public.alergias_paciente a
    JOIN public.principios_ativos pa ON pa.id = a.principio_ativo_id
    JOIN public.receita_itens ri ON ri.receita_id = p_receita_id
    JOIN public.medicamentos m ON m.id = ri.medicamento_id
    WHERE a.paciente_id = p_paciente_id
      AND a.tipo = 'medicamento'
      AND a.principio_ativo_id = m.principio_ativo_id

    UNION ALL

    SELECT 'medicamento_ativo'::VARCHAR(20), 'info'::VARCHAR(20),
           format('Paciente já usa %s', mu.medicamento_label)
    FROM public.medication_uses mu
    JOIN public.medicamentos m ON m.id = mu.medicamento_id
    JOIN public.receita_itens ri ON ri.receita_id = p_receita_id
    WHERE mu.paciente_id = p_paciente_id
      AND mu.ativo
      AND ri.medicamento_id = m.id;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 6b) ALERTAS CLÍNICOS PARA RECEITA EM RASCUNHO
--     Mesma lógica do check_clinical_alerts, mas recebe a lista de
--     medicamento_ids em vez de receita_id — para alertar o médico
--     ENQUANTO ele está montando a prescrição.
--     Retorna também o medicamento_id para o frontend poder destacar
--     qual item gerou o alerta.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.check_clinical_alerts_for_items(
    p_paciente_id UUID,
    p_medicamento_ids INT[]
) RETURNS TABLE(
    tipo VARCHAR(20),
    nivel VARCHAR(20),
    mensagem TEXT,
    medicamento_id INT
) AS $$
BEGIN
    IF p_medicamento_ids IS NULL OR array_length(p_medicamento_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    -- ALERGIA: principio ativo do medicamento está nas alergias do paciente
    SELECT 'alergia'::VARCHAR(20),
           a.gravidade::VARCHAR(20),
           format('Alergia a %s (gravidade: %s)', pa.nome, COALESCE(a.gravidade, 'nao especificada')),
           m.id
    FROM public.medicamentos m
    JOIN public.alergias_paciente a ON a.principio_ativo_id = m.principio_ativo_id
    JOIN public.principios_ativos pa ON pa.id = a.principio_ativo_id
    WHERE a.paciente_id = p_paciente_id
      AND a.tipo = 'medicamento'
      AND m.id = ANY(p_medicamento_ids)

    UNION ALL

    -- MEDICAMENTO JA EM USO: o paciente ja usa esse remedio (possivel duplicata)
    SELECT 'medicamento_ativo'::VARCHAR(20),
           'info'::VARCHAR(20),
           format('Paciente ja usa %s (desde %s). Confirme se e continuacao ou duplicata.',
                  COALESCE(mu.medicamento_label, med.nome_comercial),
                  COALESCE(mu.data_inicio::text, 'data desconhecida')),
           med.id
    FROM public.medication_uses mu
    JOIN public.medicamentos med ON med.id = mu.medicamento_id
    WHERE mu.paciente_id = p_paciente_id
      AND mu.ativo
      AND med.id = ANY(p_medicamento_ids)

    UNION ALL

    -- INTERACAO: principio ativo duplicado dentro da propria receita
    -- (ex: receitar Novalgina + Dipirona, que sao o mesmo principio ativo)
    SELECT 'principio_ativo_duplicado'::VARCHAR(20),
           'warning'::VARCHAR(20),
           format('Principio ativo %s aparece em mais de um item desta receita', pa.nome),
           m2.id
    FROM public.medicamentos m1
    JOIN public.medicamentos m2 ON m2.principio_ativo_id = m1.principio_ativo_id
                                 AND m2.id > m1.id
    JOIN public.principios_ativos pa ON pa.id = m1.principio_ativo_id
    WHERE m1.id = ANY(p_medicamento_ids)
      AND m2.id = ANY(p_medicamento_ids);
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 7) REALTIME (para prontuário notificar médicos)
-- =====================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.consultations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_conditions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medication_uses;

-- =====================================================================
-- FIM
-- =====================================================================
