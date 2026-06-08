-- =====================================================================
-- Migration: Módulo de Prescrição Digital + Pedidos de Exame
-- Compatível com Supabase (Postgres 15+)
-- Idempotente — pode rodar mais de uma vez
-- AJUSTADO: profissionais usam UUID (não INT) — bate com SQL_PROFESSIONAL.sql
-- =====================================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Trigger genérica para updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 0) ESTENDER TABELAS EXISTENTES
-- =====================================================================

ALTER TABLE public.professionals
    ADD COLUMN IF NOT EXISTS crm_verified_at         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS crm_verified_data       JSONB,
    ADD COLUMN IF NOT EXISTS crm_verification_source VARCHAR(50),
    ADD COLUMN IF NOT EXISTS crm_check_due_at        TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_professionals_register_state'
    ) THEN
        ALTER TABLE public.professionals
            ADD CONSTRAINT uq_professionals_register_state
            UNIQUE (professional_register, register_state);
    END IF;
END $$;

-- =====================================================================
-- 1) CATÁLOGO DE MEDICAMENTOS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.laboratorios (
    id          SERIAL PRIMARY KEY,
    cnpj        VARCHAR(14) UNIQUE,
    nome        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lab_nome_trgm ON public.laboratorios USING GIN (nome gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.classes_terapeuticas (
    id         SERIAL PRIMARY KEY,
    codigo     VARCHAR(20) UNIQUE,
    descricao  VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.principios_ativos (
    id         SERIAL PRIMARY KEY,
    nome       VARCHAR(255) NOT NULL UNIQUE,
    dcb        VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pa_nome_trgm ON public.principios_ativos USING GIN (nome gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.formas_farmaceuticas (
    id         SERIAL PRIMARY KEY,
    descricao  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.medicamentos (
    id                     SERIAL PRIMARY KEY,
    registro_ms            VARCHAR(13) UNIQUE NOT NULL,
    nome_comercial         VARCHAR(255) NOT NULL,
    principio_ativo_id     INT REFERENCES public.principios_ativos(id),
    concentracao           VARCHAR(100),
    forma_farmaceutica_id  INT REFERENCES public.formas_farmaceuticas(id),
    laboratorio_id         INT REFERENCES public.laboratorios(id),
    classe_terapeutica_id  INT REFERENCES public.classes_terapeuticas(id),
    tarja                  VARCHAR(50),
    tipo_receita           VARCHAR(50),
    regime_controlado      BOOLEAN DEFAULT FALSE,
    ativo                  BOOLEAN DEFAULT TRUE,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_medicamentos_updated ON public.medicamentos;
CREATE TRIGGER trg_medicamentos_updated
    BEFORE UPDATE ON public.medicamentos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_med_nome_trgm ON public.medicamentos USING GIN (nome_comercial gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_med_ativo     ON public.medicamentos(ativo) WHERE ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_med_pa        ON public.medicamentos(principio_ativo_id);

ALTER TABLE public.medicamentos DROP COLUMN IF EXISTS search_doc;
ALTER TABLE public.medicamentos
    ADD COLUMN search_doc tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('portuguese', unaccent(coalesce(nome_comercial, ''))), 'A') ||
        setweight(to_tsvector('portuguese', unaccent(coalesce(principio_ativo, ''))), 'B')
    ) STORED;
CREATE INDEX IF NOT EXISTS idx_med_search_doc ON public.medicamentos USING GIN (search_doc);

-- =====================================================================
-- 2) INTERAÇÕES MEDICAMENTOSAS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.niveis_interacao (
    id         SERIAL PRIMARY KEY,
    nivel      VARCHAR(20) NOT NULL,
    descricao  TEXT
);

CREATE TABLE IF NOT EXISTS public.interacoes_medicamentosas (
    id                     SERIAL PRIMARY KEY,
    principio_ativo_a_id   INT REFERENCES public.principios_ativos(id),
    principio_ativo_b_id   INT REFERENCES public.principios_ativos(id),
    nivel_id               INT REFERENCES public.niveis_interacao(id),
    descricao              TEXT NOT NULL,
    orientacao             TEXT,
    fonte                  VARCHAR(255),
    CHECK (principio_ativo_a_id < principio_ativo_b_id),
    UNIQUE (principio_ativo_a_id, principio_ativo_b_id)
);
CREATE INDEX IF NOT EXISTS idx_int_pa_a ON public.interacoes_medicamentosas(principio_ativo_a_id);
CREATE INDEX IF NOT EXISTS idx_int_pa_b ON public.interacoes_medicamentosas(principio_ativo_b_id);

-- =====================================================================
-- 3) CATÁLOGO DE DOENÇAS (CID-10 / CID-11)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.cids (
    id          SERIAL PRIMARY KEY,
    codigo      VARCHAR(10) UNIQUE NOT NULL,
    descricao   TEXT NOT NULL,
    versao      VARCHAR(10) NOT NULL,
    capitulo    VARCHAR(100),
    grupo       VARCHAR(100),
    categoria   VARCHAR(255),
    exclui1     TEXT,
    exclui2     TEXT,
    inclui      TEXT,
    ativo       BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_cid_codigo    ON public.cids(codigo);
CREATE INDEX IF NOT EXISTS idx_cid_desc_trgm ON public.cids USING GIN (descricao gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cid_versao    ON public.cids(versao);

-- =====================================================================
-- 4) ALERGIAS DO PACIENTE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.alergias_paciente (
    id                   SERIAL PRIMARY KEY,
    paciente_id          UUID NOT NULL,
    tipo                 VARCHAR(50) NOT NULL,
    principio_ativo_id   INT REFERENCES public.principios_ativos(id),
    descricao_livre      TEXT,
    gravidade            VARCHAR(50),
    observacoes          TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alergias_paciente ON public.alergias_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_alergias_pa       ON public.alergias_paciente(principio_ativo_id)
    WHERE tipo = 'medicamento';

-- =====================================================================
-- 5) RECEITAS  (UUID em medico_id e paciente_id)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.receitas (
    id                     SERIAL PRIMARY KEY,
    medico_id              UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    paciente_id            UUID NOT NULL,
    tipo                   VARCHAR(50) NOT NULL,
    cid_principal_id       INT REFERENCES public.cids(id),
    cid_secundario_id      INT REFERENCES public.cids(id),
    data_emissao           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    texto_cabecalho        TEXT,
    texto_rodape           TEXT,
    status                 VARCHAR(50) NOT NULL DEFAULT 'rascunho',
    clicksign_document_key VARCHAR(100),
    clicksign_signer_key   VARCHAR(100),
    clicksign_sign_url     TEXT,
    pdf_assinado_url       TEXT,
    pdf_final_path         TEXT,
    assinado_em            TIMESTAMPTZ,
    enviado_paciente_em    TIMESTAMPTZ,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_receitas_updated ON public.receitas;
CREATE TRIGGER trg_receitas_updated
    BEFORE UPDATE ON public.receitas
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_receitas_medico    ON public.receitas(medico_id, data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_receitas_paciente  ON public.receitas(paciente_id, data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_receitas_status    ON public.receitas(status);

CREATE TABLE IF NOT EXISTS public.receita_itens (
    id                 SERIAL PRIMARY KEY,
    receita_id         INT REFERENCES public.receitas(id) ON DELETE CASCADE,
    medicamento_id     INT REFERENCES public.medicamentos(id),
    posologia          TEXT NOT NULL,
    quantidade         INT,
    duracao_dias       INT,
    via_administracao  VARCHAR(50),
    observacoes        TEXT,
    ordem              INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_receita_itens_receita ON public.receita_itens(receita_id);

-- =====================================================================
-- 6) PEDIDOS DE EXAME
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.exames_tuss (
    id            SERIAL PRIMARY KEY,
    codigo_tuss   VARCHAR(20) UNIQUE NOT NULL,
    descricao     VARCHAR(500) NOT NULL,
    categoria     VARCHAR(100),
    origem        VARCHAR(20) DEFAULT 'TUSS',
    ativo         BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_exames_tuss_desc_trgm ON public.exames_tuss USING GIN (descricao gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.pedidos_exame (
    id                     SERIAL PRIMARY KEY,
    medico_id              UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    paciente_id            UUID NOT NULL,
    cid_principal_id       INT REFERENCES public.cids(id),
    cid_secundario_id      INT REFERENCES public.cids(id),
    texto_clinico          TEXT,
    data_emissao           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status                 VARCHAR(50) NOT NULL DEFAULT 'rascunho',
    clicksign_document_key VARCHAR(100),
    clicksign_signer_key   VARCHAR(100),
    clicksign_sign_url     TEXT,
    pdf_assinado_url       TEXT,
    pdf_final_path         TEXT,
    assinado_em            TIMESTAMPTZ,
    enviado_paciente_em    TIMESTAMPTZ,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_pedidos_exame_updated ON public.pedidos_exame;
CREATE TRIGGER trg_pedidos_exame_updated
    BEFORE UPDATE ON public.pedidos_exame
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.pedido_exame_itens (
    id            SERIAL PRIMARY KEY,
    pedido_id     INT REFERENCES public.pedidos_exame(id) ON DELETE CASCADE,
    exame_id      INT REFERENCES public.exames_tuss(id),
    observacoes   TEXT,
    ordem         INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pedido_exame_itens_pedido ON public.pedido_exame_itens(pedido_id);

-- =====================================================================
-- 7) MODELOS + FAVORITOS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.modelos_receita (
    id               SERIAL PRIMARY KEY,
    medico_id        UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    nome             VARCHAR(255) NOT NULL,
    descricao        TEXT,
    tipo_receita     VARCHAR(50),
    cid_principal_id INT REFERENCES public.cids(id),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_modelos_medico ON public.modelos_receita(medico_id);

CREATE TABLE IF NOT EXISTS public.modelo_receita_itens (
    id              SERIAL PRIMARY KEY,
    modelo_id       INT REFERENCES public.modelos_receita(id) ON DELETE CASCADE,
    medicamento_id  INT REFERENCES public.medicamentos(id),
    posologia       TEXT NOT NULL,
    quantidade      INT,
    duracao_dias    INT,
    ordem           INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.medicamentos_favoritos (
    id                SERIAL PRIMARY KEY,
    medico_id         UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    medicamento_id    INT REFERENCES public.medicamentos(id),
    posologia_padrao  TEXT,
    ordem             INT DEFAULT 0,
    UNIQUE (medico_id, medicamento_id)
);
CREATE INDEX IF NOT EXISTS idx_fav_medico ON public.medicamentos_favoritos(medico_id);

-- =====================================================================
-- 8) VIEW AUXILIAR
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_medicamentos_autocomplete AS
SELECT
    m.id,
    m.registro_ms,
    m.nome_comercial,
    m.concentracao,
    m.tarja,
    m.tipo_receita,
    m.regime_controlado,
    m.principio_ativo_id,
    pa.nome   AS principio_ativo,
    pa.dcb,
    l.nome    AS laboratorio,
    ff.descricao AS forma_farmaceutica,
    m.ativo
FROM public.medicamentos m
LEFT JOIN public.principios_ativos pa ON pa.id = m.principio_ativo_id
LEFT JOIN public.laboratorios l       ON l.id  = m.laboratorio_id
LEFT JOIN public.formas_farmaceuticas ff ON ff.id = m.forma_farmaceutica_id;

-- =====================================================================
-- 9) ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.receitas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receita_itens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_exame         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_exame_itens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos_receita       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelo_receita_itens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicamentos_favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alergias_paciente     ENABLE ROW LEVEL SECURITY;

-- Receitas: médico dono + paciente destinatário
DROP POLICY IF EXISTS "receitas_medico_select" ON public.receitas;
DROP POLICY IF EXISTS "receitas_medico_insert" ON public.receitas;
DROP POLICY IF EXISTS "receitas_medico_update" ON public.receitas;
DROP POLICY IF EXISTS "receitas_paciente_select" ON public.receitas;

CREATE POLICY "receitas_medico_select" ON public.receitas
    FOR SELECT USING (medico_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));
CREATE POLICY "receitas_medico_insert" ON public.receitas
    FOR INSERT WITH CHECK (medico_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));
CREATE POLICY "receitas_medico_update" ON public.receitas
    FOR UPDATE USING (medico_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));
CREATE POLICY "receitas_paciente_select" ON public.receitas
    FOR SELECT USING (paciente_id = auth.uid());

DROP POLICY IF EXISTS "receita_itens_select" ON public.receita_itens;
CREATE POLICY "receita_itens_select" ON public.receita_itens
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.receitas r
            WHERE r.id = receita_itens.receita_id
              AND (r.paciente_id = auth.uid()
                   OR r.medico_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()))
        )
    );

-- Modelos e favoritos
DROP POLICY IF EXISTS "modelos_medico_all" ON public.modelos_receita;
CREATE POLICY "modelos_medico_all" ON public.modelos_receita
    FOR ALL USING (medico_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "modelo_itens_medico_all" ON public.modelo_receita_itens;
CREATE POLICY "modelo_itens_medico_all" ON public.modelo_receita_itens
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.modelos_receita m
            WHERE m.id = modelo_receita_itens.modelo_id
              AND m.medico_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "favoritos_medico_all" ON public.medicamentos_favoritos;
CREATE POLICY "favoritos_medico_all" ON public.medicamentos_favoritos
    FOR ALL USING (medico_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));

-- Pedidos de exame
DROP POLICY IF EXISTS "pedidos_medico_all" ON public.pedidos_exame;
CREATE POLICY "pedidos_medico_all" ON public.pedidos_exame
    FOR ALL USING (medico_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "pedidos_paciente_select" ON public.pedidos_exame;
CREATE POLICY "pedidos_paciente_select" ON public.pedidos_exame
    FOR SELECT USING (paciente_id = auth.uid());

DROP POLICY IF EXISTS "pedido_itens_select" ON public.pedido_exame_itens;
CREATE POLICY "pedido_itens_select" ON public.pedido_exame_itens
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.pedidos_exame pe
            WHERE pe.id = pedido_exame_itens.pedido_id
              AND (pe.paciente_id = auth.uid()
                   OR pe.medico_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()))
        )
    );

-- Alergias
DROP POLICY IF EXISTS "alergias_paciente_all" ON public.alergias_paciente;
CREATE POLICY "alergias_paciente_all" ON public.alergias_paciente
    FOR ALL USING (paciente_id = auth.uid());

-- Catálogo: leitura pública
DROP POLICY IF EXISTS "medicamentos_read" ON public.medicamentos;
CREATE POLICY "medicamentos_read" ON public.medicamentos FOR SELECT USING (true);
DROP POLICY IF EXISTS "principios_ativos_read" ON public.principios_ativos;
CREATE POLICY "principios_ativos_read" ON public.principios_ativos FOR SELECT USING (true);
DROP POLICY IF EXISTS "laboratorios_read" ON public.laboratorios;
CREATE POLICY "laboratorios_read" ON public.laboratorios FOR SELECT USING (true);
DROP POLICY IF EXISTS "cids_read" ON public.cids;
CREATE POLICY "cids_read" ON public.cids FOR SELECT USING (true);
DROP POLICY IF EXISTS "exames_tuss_read" ON public.exames_tuss;
CREATE POLICY "exames_tuss_read" ON public.exames_tuss FOR SELECT USING (true);

-- =====================================================================
-- 10) REALTIME
-- =====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.receitas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_exame;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alergias_paciente;

-- =====================================================================
-- 11) HELPER: checagem de segurança
-- =====================================================================

CREATE OR REPLACE FUNCTION public.check_receita_safety(p_receita_id INT)
RETURNS TABLE(tipo VARCHAR(20), nivel VARCHAR(20), mensagem TEXT) AS $$
DECLARE v_paciente UUID;
BEGIN
    SELECT paciente_id INTO v_paciente FROM public.receitas WHERE id = p_receita_id;

    RETURN QUERY
    SELECT 'alergia'::VARCHAR(20), a.gravidade::VARCHAR(20),
           format('Alergia cadastrada a %s (%s)', pa.nome, COALESCE(a.observacoes, ''))
    FROM public.alergias_paciente a
    JOIN public.principios_ativos pa ON pa.id = a.principio_ativo_id
    JOIN public.receita_itens ri ON ri.receita_id = p_receita_id
    JOIN public.medicamentos m ON m.id = ri.medicamento_id
    WHERE a.paciente_id = v_paciente
      AND a.tipo = 'medicamento'
      AND a.principio_ativo_id = m.principio_ativo_id;

    RETURN QUERY
    SELECT 'interacao'::VARCHAR(20), n.nivel::VARCHAR(20),
           format('%s × %s: %s', pa1.nome, pa2.nome, im.descricao)
    FROM public.receita_itens ri1
    JOIN public.receita_itens ri2 ON ri1.receita_id = ri2.receita_id AND ri1.id < ri2.id
    JOIN public.medicamentos m1 ON m1.id = ri1.medicamento_id
    JOIN public.medicamentos m2 ON m2.id = ri2.medicamento_id
    JOIN public.principios_ativos pa1 ON pa1.id = m1.principio_ativo_id
    JOIN public.principios_ativos pa2 ON pa2.id = m2.principio_ativo_id
    JOIN public.interacoes_medicamentosas im
      ON im.principio_ativo_a_id = LEAST(pa1.id, pa2.id)
     AND im.principio_ativo_b_id = GREATEST(pa1.id, pa2.id)
    JOIN public.niveis_interacao n ON n.id = im.nivel_id
    WHERE ri1.receita_id = p_receita_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 12) BUCKETS: criar via Supabase Dashboard > Storage:
--   - prescriptions (privado) — PDFs de receitas
--   - exam-requests (privado) — PDFs de pedidos
-- =====================================================================

-- =====================================================================
-- FIM
-- =====================================================================
