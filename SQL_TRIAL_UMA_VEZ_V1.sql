-- MyDataMed — teste grátis só uma vez por conta (26/11/2026)
-- Antes: chamar start_mydatamed_pro_trial de novo renovava os 15 dias de
-- acesso (professional_feature_access) indefinidamente, então ninguém
-- precisava pagar. Agora, fora da service role, a função recusa se a conta
-- já tem qualquer registro em professional_subscriptions.

CREATE OR REPLACE FUNCTION public.start_mydatamed_pro_trial(p_professional_user_id uuid, p_professional_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_subscription_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() <> p_professional_user_id THEN RAISE EXCEPTION 'not_allowed'; END IF;
    IF p_professional_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.professionals p WHERE p.id=p_professional_id AND p.user_id=auth.uid()
    ) THEN RAISE EXCEPTION 'professional_not_owned_by_caller'; END IF;
    IF EXISTS (SELECT 1 FROM public.professional_subscriptions s WHERE s.professional_user_id = p_professional_user_id) THEN
      RAISE EXCEPTION 'O teste grátis já foi usado nesta conta. Escolha um plano para continuar.';
    END IF;
  END IF;
  INSERT INTO public.professional_subscriptions (
    professional_user_id, professional_id, plan_name, plan_price_cents, monthly_price_cents,
    billing_cycle, status, free_patient_data_access, commercial_area_enabled, trial_days,
    trial_started_at, trial_ends_at, current_period_starts_at, current_period_ends_at, features
  ) VALUES (
    p_professional_user_id,p_professional_id,'MyDataMed Pro',7990,7990,'monthly','trial',true,true,15,
    NOW(),NOW()+INTERVAL '15 days',NOW(),NOW()+INTERVAL '15 days',
    '{"free_patient_data_access":true,"teleconsultation":true,"google_calendar_meet":true,"crm_bots":true,"payments_nextgen":true,"documents_signature":true}'::jsonb
  ) ON CONFLICT DO NOTHING RETURNING id INTO v_subscription_id;
  INSERT INTO public.professional_feature_access (
    professional_user_id, professional_id, feature_key, access_level, enabled, starts_at, ends_at, source
  ) VALUES
    (p_professional_user_id,p_professional_id,'patient_data_access_free','free',true,NOW(),NULL,'system'),
    (p_professional_user_id,p_professional_id,'teleconsultation','trial',true,NOW(),NOW()+INTERVAL '15 days','trial'),
    (p_professional_user_id,p_professional_id,'google_calendar_meet','trial',true,NOW(),NOW()+INTERVAL '15 days','trial'),
    (p_professional_user_id,p_professional_id,'crm_smartbots','trial',true,NOW(),NOW()+INTERVAL '15 days','trial'),
    (p_professional_user_id,p_professional_id,'payments_nextgen_woovi','trial',true,NOW(),NOW()+INTERVAL '15 days','trial'),
    (p_professional_user_id,p_professional_id,'professional_documents','trial',true,NOW(),NOW()+INTERVAL '15 days','trial'),
    (p_professional_user_id,p_professional_id,'commercial_dashboard','trial',true,NOW(),NOW()+INTERVAL '15 days','trial')
  ON CONFLICT (professional_user_id, feature_key)
  DO UPDATE SET access_level=EXCLUDED.access_level, enabled=EXCLUDED.enabled, starts_at=EXCLUDED.starts_at,
    ends_at=EXCLUDED.ends_at, source=EXCLUDED.source, updated_at=NOW();
  RETURN v_subscription_id;
END;
$function$;
