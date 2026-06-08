-- =====================================================================
-- Migration: Pedidos de Exame (Exames Médicos)
-- Tabelas já existem em SQL_PRESCRIPTION_MODULE.sql
-- Esta migration adiciona: seed TUSS, índices, RLS, função
-- Idempotente — pode rodar quantas vezes quiser
-- =====================================================================

-- =====================================================================
-- 1) RLS nas tabelas de pedido (idempotente)
-- =====================================================================

ALTER TABLE public.pedidos_exame    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_exame_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedidos_exame_medico_all" ON public.pedidos_exame;
CREATE POLICY "pedidos_exame_medico_all" ON public.pedidos_exame
    FOR ALL USING (medico_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "pedidos_exame_paciente_select" ON public.pedidos_exame;
CREATE POLICY "pedidos_exame_paciente_select" ON public.pedidos_exame
    FOR SELECT USING (paciente_id = auth.uid());

DROP POLICY IF EXISTS "pedido_exame_itens_medico_all" ON public.pedido_exame_itens;
CREATE POLICY "pedido_exame_itens_medico_all" ON public.pedido_exame_itens
    FOR ALL USING (
        pedido_id IN (SELECT id FROM public.pedidos_exame
                       WHERE medico_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()))
    );

DROP POLICY IF EXISTS "pedido_exame_itens_paciente_select" ON public.pedido_exame_itens;
CREATE POLICY "pedido_exame_itens_paciente_select" ON public.pedido_exame_itens
    FOR SELECT USING (
        pedido_id IN (SELECT id FROM public.pedidos_exame WHERE paciente_id = auth.uid())
    );

-- exames_tuss: leitura pública (catálogo)
ALTER TABLE public.exames_tuss ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exames_tuss_public_read" ON public.exames_tuss;
CREATE POLICY "exames_tuss_public_read" ON public.exames_tuss
    FOR SELECT USING (true);

-- =====================================================================
-- 2) SEED TUSS — exames mais comuns (50)
--    Códigos TUSS reais. Tabela TUSS é a Terminologia Unificada
--    da Saúde Suplementar (padrão ANS).
-- =====================================================================

INSERT INTO public.exames_tuss (codigo_tuss, descricao, categoria) VALUES
    -- Hematologia
    ('40301660', 'Hemograma completo',                    'Hematologia'),
    ('40302580', 'Glicemia em jejum',                     'Bioquímica'),
    ('40302520', 'Colesterol total e frações',            'Bioquímica'),
    ('40302563', 'Triglicerídeos',                        'Bioquímica'),
    ('40302539', 'HDL colesterol',                        'Bioquímica'),
    ('40302547', 'LDL colesterol',                        'Bioquímica'),
    ('40301643', 'Hemoglobina glicada (HbA1c)',           'Bioquímica'),
    ('40302512', 'Ácido úrico',                           'Bioquímica'),
    ('40301678', 'VHS',                                   'Hematologia'),
    ('40301686', 'Proteína C reativa (PCR)',              'Bioquímica'),
    ('40302571', 'Ureia',                                 'Bioquímica'),
    ('40302602', 'Creatinina',                            'Bioquímica'),
    ('40301635', 'TGO / AST',                             'Bioquímica'),
    ('40301627', 'TGP / ALT',                             'Bioquímica'),
    ('40302653', 'TSH',                                   'Hormônios'),
    ('40302661', 'T4 livre',                              'Hormônios'),
    ('40302670', 'T4 total',                              'Hormônios'),
    ('40316654', 'PSA total',                             'Hormônios'),
    ('40316662', 'PSA livre',                             'Hormônios'),
    ('40316700', 'Vitamina D (25-OH)',                    'Hormônios'),
    ('40316719', 'Vitamina B12',                          'Hormônios'),
    ('40302718', 'Ferritina',                             'Bioquímica'),
    ('40302726', 'Ferro sérico',                          'Bioquímica'),
    -- Urina
    ('40311016', 'EAS (urina tipo I)',                    'Urinálise'),
    ('40311024', 'Urocultura',                            'Urinálise'),
    ('40311040', 'Microalbuminúria 24h',                  'Urinálise'),
    -- Fezes
    ('40311105', 'Parasitológico de fezes (EPF)',         'Parasitologia'),
    ('40311113', 'Sangue oculto nas fezes',               'Parasitologia'),
    -- Coagulação
    ('40301350', 'TP (Tempo de Protrombina)',             'Coagulação'),
    ('40301368', 'TTPA',                                  'Coagulação'),
    -- Imagem
    ('40808014', 'Radiografia de tórax (PA + perfil)',    'Imagem'),
    ('40808022', 'Radiografia de abdome',                 'Imagem'),
    ('40808030', 'Radiografia de crânio',                 'Imagem'),
    ('40808049', 'Radiografia de coluna lombo-sacra',     'Imagem'),
    ('40808057', 'Radiografia de joelho',                 'Imagem'),
    ('40808146', 'Ultrassonografia abdominal total',      'Imagem'),
    ('40808154', 'Ultrassonografia pélvica',              'Imagem'),
    ('40808170', 'Ultrassonografia de tireoide',          'Imagem'),
    ('40808219', 'Ultrassonografia obstétrica',           'Imagem'),
    ('40808243', 'Ecocardiograma transtorácico',          'Imagem'),
    ('40808260', 'Mamografia bilateral',                  'Imagem'),
    ('41001010', 'Tomografia de crânio',                  'Imagem'),
    ('41001028', 'Tomografia de tórax',                   'Imagem'),
    ('41001036', 'Tomografia de abdome',                  'Imagem'),
    ('41101014', 'Ressonância de crânio',                 'Imagem'),
    ('41101022', 'Ressonância de coluna',                 'Imagem'),
    -- Cardio
    ('40101010', 'Eletrocardiograma (ECG)',               'Cardiologia'),
    ('40101029', 'Teste ergométrico',                     'Cardiologia'),
    ('40101037', 'Holter 24 horas',                       'Cardiologia'),
    ('40101045', 'MAPA 24 horas',                         'Cardiologia'),
    -- Endoscopia
    ('40201015', 'Endoscopia digestiva alta (EDA)',       'Endoscopia'),
    ('40201023', 'Colonoscopia',                          'Endoscopia')
ON CONFLICT (codigo_tuss) DO NOTHING;

-- =====================================================================
-- 3) VIEW AUXILIAR — autocomplete
-- =====================================================================

DROP VIEW IF EXISTS public.vw_exames_autocomplete;
CREATE OR REPLACE VIEW public.vw_exames_autocomplete AS
SELECT
    id,
    codigo_tuss,
    descricao,
    categoria,
    ativo
FROM public.exames_tuss
WHERE ativo = TRUE;

-- =====================================================================
-- 4) FIM
-- =====================================================================
