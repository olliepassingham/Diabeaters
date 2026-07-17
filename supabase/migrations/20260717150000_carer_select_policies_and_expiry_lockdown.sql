-- 1) Carer SELECT policies, previously only documented in docs/sql/family_carers.sql and
--    applied manually. Versioned here so fresh environments match production.
-- 2) Lock down expire_stale_hypo_check_ins: it was granted to authenticated, letting any
--    signed-in user expire ALL pending check-ins globally. It is only ever called from
--    SECURITY DEFINER functions (which run as owner), so no client grant is needed.

-- Supplies: linked carers with supplies scope may read.
DO $migration$
BEGIN
  IF to_regclass('public.supplies') IS NULL THEN
    RAISE NOTICE 'public.supplies missing; skip supplies_linked_carer_select';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS supplies_linked_carer_select ON public.supplies';
  EXECUTE $pol$
    CREATE POLICY supplies_linked_carer_select
      ON public.supplies FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.carer_links cl
          WHERE cl.patient_id = public.supplies.user_id
            AND cl.carer_id = auth.uid()
            AND coalesce((cl.scopes->>'supplies')::boolean, false) = true
        )
      );
  $pol$;
END
$migration$;

-- Appointments: linked carers with appointments scope may read.
DO $migration$
BEGIN
  IF to_regclass('public.appointments') IS NULL THEN
    RAISE NOTICE 'public.appointments missing; skip appointments_linked_carer_select';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS appointments_linked_carer_select ON public.appointments';
  EXECUTE $pol$
    CREATE POLICY appointments_linked_carer_select
      ON public.appointments FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.carer_links cl
          WHERE cl.patient_id = public.appointments.user_id
            AND cl.carer_id = auth.uid()
            AND coalesce((cl.scopes->>'appointments')::boolean, false) = true
        )
      );
  $pol$;
END
$migration$;

-- Scenarios: linked carers with scenarios scope may read (update policy exists since 20260423183000).
DO $migration$
BEGIN
  IF to_regclass('public.scenarios') IS NULL THEN
    RAISE NOTICE 'public.scenarios missing; skip scenarios_linked_carer_select';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS scenarios_linked_carer_select ON public.scenarios';
  EXECUTE $pol$
    CREATE POLICY scenarios_linked_carer_select
      ON public.scenarios FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.carer_links cl
          WHERE cl.patient_id = public.scenarios.user_id
            AND cl.carer_id = auth.uid()
            AND coalesce((cl.scopes->>'scenarios')::boolean, false) = true
        )
      );
  $pol$;
END
$migration$;

-- Hypo logs: linked carers with hypo_alerts scope may read.
DO $migration$
BEGIN
  IF to_regclass('public.hypo_logs') IS NULL THEN
    RAISE NOTICE 'public.hypo_logs missing; skip hypo_logs_linked_carer_select';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS hypo_logs_linked_carer_select ON public.hypo_logs';
  EXECUTE $pol$
    CREATE POLICY hypo_logs_linked_carer_select
      ON public.hypo_logs FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.carer_links cl
          WHERE cl.patient_id = public.hypo_logs.user_id
            AND cl.carer_id = auth.uid()
            AND coalesce((cl.scopes->>'hypo_alerts')::boolean, false) = true
        )
      );
  $pol$;
END
$migration$;

-- Profiles: any linked carer may read the row (name/avatar shown across supporter mode).
-- NOTE: RLS is row-level, so emergency_* columns are network-visible to linked carers even
-- when emergency_info scope is off; the client hides them. A column-scoped view/RPC would
-- close that gap and is tracked separately.
DO $migration$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE 'public.profiles missing; skip profiles_linked_carer_select';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS profiles_linked_carer_select ON public.profiles';
  EXECUTE $pol$
    CREATE POLICY profiles_linked_carer_select
      ON public.profiles FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.carer_links cl
          WHERE cl.patient_id = public.profiles.id
            AND cl.carer_id = auth.uid()
        )
      );
  $pol$;
END
$migration$;

-- Lock down the global expiry sweep. Called via PERFORM inside SECURITY DEFINER RPCs
-- (create_hypo_check_in, fetch/respond helpers), which run as the function owner —
-- no direct client execution is required.
REVOKE EXECUTE ON FUNCTION public.expire_stale_hypo_check_ins() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_hypo_check_ins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_hypo_check_ins() TO service_role;

-- Push dedupe for supporter hypo check-ins: notify_patient_hypo_check_in claims this
-- atomically so re-invoking with the same check_in_id cannot re-push the patient.
ALTER TABLE public.hypo_check_ins
  ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;

COMMENT ON COLUMN public.hypo_check_ins.push_sent_at IS
  'Set once by notify_patient_hypo_check_in; dedupes repeat push delivery per check-in.';

-- Same pattern for carer hypo notifications: notify_carers_on_hypo claims each hypo once,
-- so re-invoking with the same hypo_id cannot spam linked supporters.
ALTER TABLE public.hypo_logs
  ADD COLUMN IF NOT EXISTS carers_notified_at timestamptz;

COMMENT ON COLUMN public.hypo_logs.carers_notified_at IS
  'Set once by notify_carers_on_hypo; dedupes repeat supporter notifications per hypo.';
