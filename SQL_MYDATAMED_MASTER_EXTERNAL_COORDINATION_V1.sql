-- =====================================================
-- MYDATAMED MASTER + EXTERNAL CARE COORDINATION V1
-- Apply to the shared HealthWallet / MyDataMed Supabase project.
--
-- Bootstrap master requested by product owner:
--   henriquecampos66@gmail.com
--
-- Security model:
-- - authorization lives in database tables/RLS, never in browser email checks;
-- - private helper functions are not exposed through the Data API;
-- - Concierge external operators do NOT receive automatic access to clinical context;
-- - clinical context remains governed by the existing Concierge request/context policies.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS private;

-- -----------------------------------------------------
-- 1) Unified MyDataMed operational team registry
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mydatamed_team_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN (
    'master',
    'admin',
    'care_coordinator',
    'concierge_agent',
    'nurse',
    'doctor',
    'professional'
  )),
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mydatamed_team_email_lower
  ON public.mydatamed_team_members (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_mydatamed_team_role_active
  ON public.mydatamed_team_members (role, active);

ALTER TABLE public.mydatamed_team_members ENABLE ROW LEVEL SECURITY;

-- Bootstrap allowlist is private and never exposed via Data API.
CREATE TABLE IF NOT EXISTS private.mydatamed_master_bootstrap (
  email TEXT PRIMARY KEY,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO private.mydatamed_master_bootstrap (email, display_name)
VALUES ('henriquecampos66@gmail.com', 'Henrique Campos')
ON CONFLICT (email) DO UPDATE
SET display_name = EXCLUDED.display_name;

-- Current owner is promoted immediately when that Auth user already exists.
INSERT INTO public.mydatamed_team_members (
  user_id,
  email,
  display_name,
  role,
  active,
  metadata
)
SELECT
  u.id,
  LOWER(u.email),
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), b.display_name, 'Master MyDataMed'),
  'master',
  true,
  jsonb_build_object(
    'bootstrap', true,
    'bootstrap_reason', 'initial_product_owner',
    'bootstrap_at', NOW()
  )
FROM auth.users u
JOIN private.mydatamed_master_bootstrap b ON LOWER(b.email) = LOWER(u.email)
WHERE u.email IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET
  email = EXCLUDED.email,
  display_name = COALESCE(public.mydatamed_team_members.display_name, EXCLUDED.display_name),
  role = 'master',
  active = true,
  deactivated_at = NULL,
  updated_at = NOW(),
  metadata = public.mydatamed_team_members.metadata || EXCLUDED.metadata;

-- Future-safe bootstrap: if the approved email is invited/created after this migration,
-- the Auth trigger promotes it automatically.
CREATE OR REPLACE FUNCTION private.mydatamed_apply_master_bootstrap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  bootstrap_name TEXT;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.display_name
  INTO bootstrap_name
  FROM private.mydatamed_master_bootstrap b
  WHERE LOWER(b.email) = LOWER(NEW.email)
  LIMIT 1;

  IF bootstrap_name IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.mydatamed_team_members (
    user_id,
    email,
    display_name,
    role,
    active,
    metadata
  )
  VALUES (
    NEW.id,
    LOWER(NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), bootstrap_name, 'Master MyDataMed'),
    'master',
    true,
    jsonb_build_object(
      'bootstrap', true,
      'bootstrap_reason', 'master_allowlist_auth_trigger',
      'bootstrap_at', NOW()
    )
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    role = 'master',
    active = true,
    deactivated_at = NULL,
    updated_at = NOW(),
    metadata = public.mydatamed_team_members.metadata || EXCLUDED.metadata;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mydatamed_apply_master_bootstrap ON auth.users;
CREATE TRIGGER trg_mydatamed_apply_master_bootstrap
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION private.mydatamed_apply_master_bootstrap();

CREATE OR REPLACE FUNCTION private.mydatamed_is_master(target_user UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mydatamed_team_members tm
    WHERE tm.user_id = target_user
      AND tm.role = 'master'
      AND tm.active = true
  );
$$;

REVOKE ALL ON FUNCTION private.mydatamed_is_master(UUID) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.mydatamed_is_master(UUID) TO authenticated;

DROP POLICY IF EXISTS mydatamed_team_read_self_or_master ON public.mydatamed_team_members;
CREATE POLICY mydatamed_team_read_self_or_master
ON public.mydatamed_team_members
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR private.mydatamed_is_master((SELECT auth.uid()))
);

DROP POLICY IF EXISTS mydatamed_team_master_insert ON public.mydatamed_team_members;
CREATE POLICY mydatamed_team_master_insert
ON public.mydatamed_team_members
FOR INSERT
TO authenticated
WITH CHECK (private.mydatamed_is_master((SELECT auth.uid())));

DROP POLICY IF EXISTS mydatamed_team_master_update ON public.mydatamed_team_members;
CREATE POLICY mydatamed_team_master_update
ON public.mydatamed_team_members
FOR UPDATE
TO authenticated
USING (private.mydatamed_is_master((SELECT auth.uid())))
WITH CHECK (private.mydatamed_is_master((SELECT auth.uid())));

DROP POLICY IF EXISTS mydatamed_team_master_delete ON public.mydatamed_team_members;
CREATE POLICY mydatamed_team_master_delete
ON public.mydatamed_team_members
FOR DELETE
TO authenticated
USING (private.mydatamed_is_master((SELECT auth.uid())));

REVOKE ALL ON TABLE public.mydatamed_team_members FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mydatamed_team_members TO authenticated;

-- -----------------------------------------------------
-- 2) External coordination / booking loop
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.concierge_external_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_name TEXT,
  request_id UUID,
  action_id UUID,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL CHECK (task_type IN (
    'exam',
    'laboratory',
    'imaging',
    'specialist',
    'consultation',
    'therapy',
    'procedure',
    'document',
    'other'
  )),
  title TEXT NOT NULL,
  description TEXT,
  target_specialty TEXT,
  city TEXT,
  state TEXT,
  insurance_name TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new',
    'researching',
    'options_ready',
    'awaiting_patient_choice',
    'selected',
    'scheduling',
    'booked',
    'instructions_sent',
    'completed',
    'result_expected',
    'result_received',
    'closed',
    'cancelled'
  )),
  selected_option_id UUID,
  provider_name TEXT,
  provider_contact TEXT,
  provider_address TEXT,
  scheduled_at TIMESTAMPTZ,
  booking_reference TEXT,
  preparation_instructions TEXT,
  result_expected_at TIMESTAMPTZ,
  result_received_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_tasks_patient
  ON public.concierge_external_tasks(patient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_tasks_assigned
  ON public.concierge_external_tasks(assigned_to, status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_external_tasks_status
  ON public.concierge_external_tasks(status, created_at ASC);

CREATE TABLE IF NOT EXISTS public.concierge_external_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.concierge_external_tasks(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  provider_type TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  website TEXT,
  price_amount NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'BRL',
  accepts_insurance BOOLEAN,
  insurance_notes TEXT,
  earliest_slot TIMESTAMPTZ,
  distance_text TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN (
    'candidate',
    'offered',
    'selected',
    'rejected',
    'unavailable'
  )),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_options_task
  ON public.concierge_external_options(task_id, status, earliest_slot);

CREATE TABLE IF NOT EXISTS public.concierge_external_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.concierge_external_tasks(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'system',
  event_type TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'staff_only' CHECK (visibility IN ('patient', 'staff_only')),
  message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_events_task
  ON public.concierge_external_events(task_id, created_at ASC);

ALTER TABLE public.concierge_external_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_external_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_external_events ENABLE ROW LEVEL SECURITY;

-- Optional FKs to existing Concierge tables are added only when those tables exist.
DO $$
BEGIN
  IF to_regclass('public.concierge_requests') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'concierge_external_tasks_request_fk'
     ) THEN
    ALTER TABLE public.concierge_external_tasks
      ADD CONSTRAINT concierge_external_tasks_request_fk
      FOREIGN KEY (request_id)
      REFERENCES public.concierge_requests(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.concierge_actions') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'concierge_external_tasks_action_fk'
     ) THEN
    ALTER TABLE public.concierge_external_tasks
      ADD CONSTRAINT concierge_external_tasks_action_fk
      FOREIGN KEY (action_id)
      REFERENCES public.concierge_actions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.mydatamed_external_role(target_user UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tm.role
  FROM public.mydatamed_team_members tm
  WHERE tm.user_id = target_user
    AND tm.active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.mydatamed_external_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.mydatamed_external_role(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION private.mydatamed_can_access_external_task(
  target_task UUID,
  target_user UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  member_role TEXT;
BEGIN
  SELECT tm.role
  INTO member_role
  FROM public.mydatamed_team_members tm
  WHERE tm.user_id = target_user
    AND tm.active = true
  LIMIT 1;

  IF member_role IS NULL THEN
    RETURN false;
  END IF;

  IF member_role IN ('master', 'admin', 'care_coordinator') THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.concierge_external_tasks t
    WHERE t.id = target_task
      AND (
        t.assigned_to = target_user
        OR t.requested_by = target_user
        OR (member_role = 'concierge_agent' AND t.assigned_to IS NULL)
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION private.mydatamed_can_access_external_task(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.mydatamed_can_access_external_task(UUID, UUID) TO authenticated;

-- Task policies
DROP POLICY IF EXISTS external_tasks_team_read ON public.concierge_external_tasks;
CREATE POLICY external_tasks_team_read
ON public.concierge_external_tasks
FOR SELECT
TO authenticated
USING (
  private.mydatamed_is_master((SELECT auth.uid()))
  OR private.mydatamed_external_role((SELECT auth.uid())) IN ('admin', 'care_coordinator')
  OR assigned_to = (SELECT auth.uid())
  OR requested_by = (SELECT auth.uid())
  OR (
    private.mydatamed_external_role((SELECT auth.uid())) = 'concierge_agent'
    AND assigned_to IS NULL
  )
);

DROP POLICY IF EXISTS external_tasks_team_insert ON public.concierge_external_tasks;
CREATE POLICY external_tasks_team_insert
ON public.concierge_external_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  private.mydatamed_external_role((SELECT auth.uid())) IN (
    'master', 'admin', 'care_coordinator', 'concierge_agent', 'nurse', 'doctor'
  )
  AND requested_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS external_tasks_team_update ON public.concierge_external_tasks;
CREATE POLICY external_tasks_team_update
ON public.concierge_external_tasks
FOR UPDATE
TO authenticated
USING (
  private.mydatamed_is_master((SELECT auth.uid()))
  OR private.mydatamed_external_role((SELECT auth.uid())) IN ('admin', 'care_coordinator')
  OR assigned_to = (SELECT auth.uid())
  OR requested_by = (SELECT auth.uid())
  OR (
    private.mydatamed_external_role((SELECT auth.uid())) = 'concierge_agent'
    AND assigned_to IS NULL
  )
)
WITH CHECK (
  private.mydatamed_is_master((SELECT auth.uid()))
  OR private.mydatamed_external_role((SELECT auth.uid())) IN ('admin', 'care_coordinator')
  OR assigned_to = (SELECT auth.uid())
  OR requested_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS external_tasks_team_delete ON public.concierge_external_tasks;
CREATE POLICY external_tasks_team_delete
ON public.concierge_external_tasks
FOR DELETE
TO authenticated
USING (
  private.mydatamed_is_master((SELECT auth.uid()))
  OR private.mydatamed_external_role((SELECT auth.uid())) IN ('admin', 'care_coordinator')
);

-- Option policies inherit task authorization.
DROP POLICY IF EXISTS external_options_team_read ON public.concierge_external_options;
CREATE POLICY external_options_team_read
ON public.concierge_external_options
FOR SELECT
TO authenticated
USING (
  private.mydatamed_can_access_external_task(task_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS external_options_team_insert ON public.concierge_external_options;
CREATE POLICY external_options_team_insert
ON public.concierge_external_options
FOR INSERT
TO authenticated
WITH CHECK (
  private.mydatamed_can_access_external_task(task_id, (SELECT auth.uid()))
  AND created_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS external_options_team_update ON public.concierge_external_options;
CREATE POLICY external_options_team_update
ON public.concierge_external_options
FOR UPDATE
TO authenticated
USING (
  private.mydatamed_can_access_external_task(task_id, (SELECT auth.uid()))
)
WITH CHECK (
  private.mydatamed_can_access_external_task(task_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS external_options_team_delete ON public.concierge_external_options;
CREATE POLICY external_options_team_delete
ON public.concierge_external_options
FOR DELETE
TO authenticated
USING (
  private.mydatamed_is_master((SELECT auth.uid()))
  OR private.mydatamed_external_role((SELECT auth.uid())) IN ('admin', 'care_coordinator')
);

-- Event policies inherit task authorization.
DROP POLICY IF EXISTS external_events_team_read ON public.concierge_external_events;
CREATE POLICY external_events_team_read
ON public.concierge_external_events
FOR SELECT
TO authenticated
USING (
  private.mydatamed_can_access_external_task(task_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS external_events_team_insert ON public.concierge_external_events;
CREATE POLICY external_events_team_insert
ON public.concierge_external_events
FOR INSERT
TO authenticated
WITH CHECK (
  actor_user_id = (SELECT auth.uid())
  AND private.mydatamed_can_access_external_task(task_id, (SELECT auth.uid()))
);

-- Minimal patient visibility for events explicitly marked patient.
DROP POLICY IF EXISTS external_events_patient_read ON public.concierge_external_events;
CREATE POLICY external_events_patient_read
ON public.concierge_external_events
FOR SELECT
TO authenticated
USING (
  patient_id = (SELECT auth.uid())
  AND visibility = 'patient'
);

REVOKE ALL ON TABLE
  public.concierge_external_tasks,
  public.concierge_external_options,
  public.concierge_external_events
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.concierge_external_tasks,
  public.concierge_external_options
TO authenticated;

GRANT SELECT, INSERT ON TABLE
  public.concierge_external_events
TO authenticated;

-- -----------------------------------------------------
-- 3) Synchronize existing clinical Concierge staff into the team registry
-- -----------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.concierge_staff') IS NOT NULL THEN
    EXECUTE $sync$
      INSERT INTO public.mydatamed_team_members (
        user_id,
        email,
        display_name,
        role,
        active,
        metadata
      )
      SELECT
        s.user_id,
        LOWER(u.email),
        COALESCE(s.display_name, u.raw_user_meta_data->>'full_name', u.email),
        CASE
          WHEN s.role IN ('admin', 'care_coordinator', 'nurse', 'doctor') THEN s.role
          ELSE 'professional'
        END,
        s.active,
        jsonb_build_object('synced_from', 'concierge_staff')
      FROM public.concierge_staff s
      JOIN auth.users u ON u.id = s.user_id
      WHERE u.email IS NOT NULL
      ON CONFLICT (user_id) DO UPDATE
      SET
        email = EXCLUDED.email,
        display_name = COALESCE(public.mydatamed_team_members.display_name, EXCLUDED.display_name),
        active = EXCLUDED.active,
        updated_at = NOW(),
        metadata = public.mydatamed_team_members.metadata || EXCLUDED.metadata
      WHERE public.mydatamed_team_members.role <> 'master'
    $sync$;
  END IF;
END $$;

-- -----------------------------------------------------
-- 4) updated_at protection
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION private.mydatamed_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mydatamed_team_updated_at ON public.mydatamed_team_members;
CREATE TRIGGER trg_mydatamed_team_updated_at
BEFORE UPDATE ON public.mydatamed_team_members
FOR EACH ROW EXECUTE FUNCTION private.mydatamed_set_updated_at();

DROP TRIGGER IF EXISTS trg_external_tasks_updated_at ON public.concierge_external_tasks;
CREATE TRIGGER trg_external_tasks_updated_at
BEFORE UPDATE ON public.concierge_external_tasks
FOR EACH ROW EXECUTE FUNCTION private.mydatamed_set_updated_at();

DROP TRIGGER IF EXISTS trg_external_options_updated_at ON public.concierge_external_options;
CREATE TRIGGER trg_external_options_updated_at
BEFORE UPDATE ON public.concierge_external_options
FOR EACH ROW EXECUTE FUNCTION private.mydatamed_set_updated_at();

-- -----------------------------------------------------
-- 5) Verification query (run after migration)
-- -----------------------------------------------------
-- SELECT
--   tm.user_id,
--   tm.email,
--   tm.display_name,
--   tm.role,
--   tm.active
-- FROM public.mydatamed_team_members tm
-- WHERE LOWER(tm.email) = 'henriquecampos66@gmail.com';
