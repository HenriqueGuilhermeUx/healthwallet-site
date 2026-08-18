-- =====================================================
-- MYDATAMED - PATCH ENTRADA DO PACIENTE
-- Libera o escopo precheck_only para entradas criadas a partir do Pré-atendimento.
-- Execute no Supabase SQL Editor se você já rodou SQL_ENTRADA_PACIENTE_V1.sql.
-- =====================================================

DO $$
BEGIN
  -- Remove a constraint antiga do data_scope, caso exista.
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'patient_intakes'
      AND constraint_name = 'patient_intakes_data_scope_check'
  ) THEN
    ALTER TABLE public.patient_intakes
    DROP CONSTRAINT patient_intakes_data_scope_check;
  END IF;

  -- Recria com o novo escopo precheck_only.
  ALTER TABLE public.patient_intakes
  ADD CONSTRAINT patient_intakes_data_scope_check
  CHECK (data_scope IN ('intake_only', 'healthwallet_authorized', 'appointment_data', 'mixed', 'precheck_only'));
END $$;

COMMENT ON CONSTRAINT patient_intakes_data_scope_check ON public.patient_intakes IS
'Escopo da entrada do paciente: manual, HealthWallet, agenda, misto ou pré-atendimento público.';
