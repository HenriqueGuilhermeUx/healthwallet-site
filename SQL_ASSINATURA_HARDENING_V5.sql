-- MyDataMed — assinatura própria: remove acesso anônimo direto (25/11/2026)
--
-- As policies anon da V4 deixavam qualquer pessoa com a anon key (pública no site)
-- listar TODOS os tokens pendentes (nome, e-mail e CPF do paciente), marcar
-- qualquer token como assinado, ler todas as assinaturas válidas (CPF, IP,
-- snapshot) e ler os documentos clínicos ligados a elas.
--
-- A partir deste PR o link público (/sign/[token]) e a validação (/validar/[hash])
-- passam por rotas de servidor (/api/signatures/token, /verify, /complete) que usam
-- a service role e buscam só pelo token/hash exato. Rode este SQL DEPOIS do deploy.

DROP POLICY IF EXISTS "sign_tokens_public_read_pending" ON public.sign_tokens;
DROP POLICY IF EXISTS "sign_tokens_public_update_pending" ON public.sign_tokens;
DROP POLICY IF EXISTS "signatures_public_insert" ON public.signatures;
DROP POLICY IF EXISTS "signatures_public_read_valid" ON public.signatures;
DROP POLICY IF EXISTS "professional_documents_public_read_for_signature" ON public.professional_clinical_documents;

REVOKE ALL ON public.sign_tokens FROM anon;
REVOKE ALL ON public.signatures FROM anon;

-- Conferência: não deve sobrar nenhuma policy para anon nessas tabelas.
SELECT tablename, policyname, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('sign_tokens', 'signatures', 'professional_clinical_documents')
  AND 'anon' = ANY (roles);
