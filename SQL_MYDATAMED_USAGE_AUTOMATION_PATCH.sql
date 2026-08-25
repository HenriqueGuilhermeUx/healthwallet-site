-- =====================================================
-- MYDATAMED - USAGE AUTOMATION PATCH
-- Execute depois de SQL_MYDATAMED_OPS_BILLING_USAGE_V1.sql.
-- Objetivo: contabilizar automaticamente 1 atendimento assistido quando uma clinical_visit for criada.
-- =====================================================

CREATE OR REPLACE FUNCTION public.on_clinical_visit_record_mydatamed_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.professional_user_id IS NOT NULL THEN
    PERFORM public.record_mydatamed_usage(
      NEW.professional_user_id,
      'assisted_visit',
      1,
      'clinical_visits_insert',
      NEW.id,
      'Atendimento assistido iniciado/criado no MyDataMed.',
      jsonb_build_object(
        'clinical_visit_id', NEW.id,
        'patient_name', NEW.patient_name,
        'status', NEW.status,
        'specialty', NEW.specialty,
        'source', COALESCE(NEW.metadata->>'patient_intake_id', 'direct_visit')
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'clinical_visits'
  ) THEN
    DROP TRIGGER IF EXISTS trg_clinical_visit_record_mydatamed_usage ON public.clinical_visits;
    CREATE TRIGGER trg_clinical_visit_record_mydatamed_usage
    AFTER INSERT ON public.clinical_visits
    FOR EACH ROW EXECUTE FUNCTION public.on_clinical_visit_record_mydatamed_usage();
  END IF;
END $$;

COMMENT ON FUNCTION public.on_clinical_visit_record_mydatamed_usage() IS
'Conta automaticamente um atendimento assistido quando uma consulta/clinical_visit é criada. NF/NFS-e fora do escopo.';
