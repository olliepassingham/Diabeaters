-- Family & Carers — schema and RLS outline (DO NOT RUN automatically; apply in Supabase SQL editor per environment).
-- UK app: carers see only what the linked person allows. Hypo notify targets live in `public.carers` (see supabase/migrations/).

-- Requires: pgcrypto or use gen_random_uuid() (Supabase default).
-- If you use uuid_generate_v4(), enable: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.carer_invites (
  code text PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.carer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  carer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer',
  scopes jsonb NOT NULL DEFAULT jsonb_build_object(
    'supplies', true,
    'appointments', true,
    'scenarios', true,
    'hypo_alerts', true,
    'emergency_info', true
  ),
  linked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, carer_id)
);

CREATE INDEX IF NOT EXISTS carer_invites_patient_idx ON public.carer_invites (patient_id);
CREATE INDEX IF NOT EXISTS carer_links_patient_idx ON public.carer_links (patient_id);
CREATE INDEX IF NOT EXISTS carer_links_carer_idx ON public.carer_links (carer_id);

-- ---------------------------------------------------------------------------
-- Optional: emergency & carer-visible fields on profiles (run after profiles exists)
-- ---------------------------------------------------------------------------
-- Optional profile columns for emergency sharing (patient edits in app Account; carers read when scope allows):
--
-- ALTER TABLE public.profiles
--   ADD COLUMN IF NOT EXISTS emergency_contact_name text,
--   ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
--   ADD COLUMN IF NOT EXISTS emergency_notes text;

-- ---------------------------------------------------------------------------
-- Row Level Security — ENABLE (policies are illustrative; tune to your app)
-- ---------------------------------------------------------------------------

ALTER TABLE public.carer_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carer_links ENABLE ROW LEVEL SECURITY;

-- carer_invites
-- Patient: insert/select own rows (active invites).
CREATE POLICY carer_invites_patient_select
  ON public.carer_invites FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY carer_invites_patient_insert
  ON public.carer_invites FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY carer_invites_patient_delete
  ON public.carer_invites FOR DELETE
  USING (patient_id = auth.uid());

-- Redeem: authenticated user (carer) updates exactly one row: set used_at when code matches and invite unused and not expired.
CREATE POLICY carer_invites_redeem_update
  ON public.carer_invites FOR UPDATE
  USING (
    used_at IS NULL
    AND expires_at > now()
  )
  WITH CHECK (used_at IS NOT NULL);

-- Note: tighten WITH CHECK to ensure only used_at changes, or use a SECURITY DEFINER RPC for redeem.

-- carer_links
CREATE POLICY carer_links_patient_select
  ON public.carer_links FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY carer_links_patient_update
  ON public.carer_links FOR UPDATE
  USING (patient_id = auth.uid());

CREATE POLICY carer_links_patient_delete
  ON public.carer_links FOR DELETE
  USING (patient_id = auth.uid());

CREATE POLICY carer_links_patient_insert
  ON public.carer_links FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY carer_links_carer_select
  ON public.carer_links FOR SELECT
  USING (carer_id = auth.uid());

-- Carers do not insert/update/delete links directly (patient-driven); omit those policies.

-- ---------------------------------------------------------------------------
-- Reading patient-owned rows (supplies, appointments, scenarios, emergency on profiles)
-- Pattern for SELECT on table T where rows belong to patient user_id = patient_uid:
--
-- USING (
--   (user_id = auth.uid())
--   OR EXISTS (
--     SELECT 1 FROM public.carer_links cl
--     WHERE cl.patient_id = T.user_id
--       AND cl.carer_id = auth.uid()
--       AND coalesce((cl.scopes->>'supplies')::boolean, false) = true
--   )
-- )
--
-- Replace:
--   T.user_id with the column that identifies the patient owner (e.g. profiles.id = auth.uid() for profile row).
--   scopes->>'supplies' with 'appointments', 'scenarios', 'hypo_alerts', or 'emergency_info' as appropriate.
--
-- For profiles emergency fields only, you may prefer a dedicated policy that allows SELECT of a subset when
-- (id = auth.uid()) OR EXISTS (... emergency_info scope ...).

-- ---------------------------------------------------------------------------
-- RPC: redeem invite (recommended — carer cannot INSERT carer_links otherwise)
-- ---------------------------------------------------------------------------
-- Idempotent: safe to re-run after dropping old version

create or replace function public.redeem_carer_invite(invite_code text)
returns public.carer_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.carer_invites%ROWTYPE;
  uid uuid := auth.uid();
  link public.carer_links%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO inv
  FROM public.carer_invites
  WHERE code = invite_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid code';
  END IF;

  IF inv.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'already used';
  END IF;

  IF inv.expires_at <= now() THEN
    RAISE EXCEPTION 'expired';
  END IF;

  -- Already linked (e.g. patient issued a new invite after an earlier redeem): consume invite and return existing row.
  SELECT * INTO link
  FROM public.carer_links
  WHERE patient_id = inv.patient_id AND carer_id = uid;

  IF FOUND THEN
    UPDATE public.carer_invites
    SET used_at = now()
    WHERE code = invite_code;
    RETURN link;
  END IF;

  INSERT INTO public.carer_links (patient_id, carer_id, role, scopes)
  VALUES (
    inv.patient_id,
    uid,
    'viewer',
    jsonb_build_object(
      'supplies', true,
      'appointments', true,
      'scenarios', true,
      'hypo_alerts', true,
      'emergency_info', true
    )
  )
  RETURNING * INTO link;

  UPDATE public.carer_invites
  SET used_at = now()
  WHERE code = invite_code;

  RETURN link;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_carer_invite(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS examples for shared reads (APPLY PER TABLE you want carers to view)
-- ---------------------------------------------------------------------------
-- These policies assume each table has a `user_id uuid` owner column, except `profiles` which uses `id`.
-- Carers are granted SELECT only, scoped via `carer_links.scopes`.
--
-- Supplies (public.supplies, owner column user_id, scope key supplies)
-- ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS supplies_owner_or_linked_carer_select ON public.supplies;
-- CREATE POLICY supplies_owner_or_linked_carer_select
--   ON public.supplies FOR SELECT
--   USING (
--     user_id = auth.uid()
--     OR EXISTS (
--       SELECT 1 FROM public.carer_links cl
--       WHERE cl.patient_id = public.supplies.user_id
--         AND cl.carer_id = auth.uid()
--         AND coalesce((cl.scopes->>'supplies')::boolean, false) = true
--     )
--   );
--
-- Appointments (public.appointments, owner column user_id, scope key appointments)
-- ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS appointments_owner_or_linked_carer_select ON public.appointments;
-- CREATE POLICY appointments_owner_or_linked_carer_select
--   ON public.appointments FOR SELECT
--   USING (
--     user_id = auth.uid()
--     OR EXISTS (
--       SELECT 1 FROM public.carer_links cl
--       WHERE cl.patient_id = public.appointments.user_id
--         AND cl.carer_id = auth.uid()
--         AND coalesce((cl.scopes->>'appointments')::boolean, false) = true
--     )
--   );
--
-- Scenarios (public.scenarios, owner column user_id, scope key scenarios)
-- ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS scenarios_owner_or_linked_carer_select ON public.scenarios;
-- CREATE POLICY scenarios_owner_or_linked_carer_select
--   ON public.scenarios FOR SELECT
--   USING (
--     user_id = auth.uid()
--     OR EXISTS (
--       SELECT 1 FROM public.carer_links cl
--       WHERE cl.patient_id = public.scenarios.user_id
--         AND cl.carer_id = auth.uid()
--         AND coalesce((cl.scopes->>'scenarios')::boolean, false) = true
--     )
--   );
--
-- Hypo logs (public.hypo_logs, owner column user_id, scope key hypo_alerts)
-- ALTER TABLE public.hypo_logs ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS hypo_logs_owner_or_linked_carer_select ON public.hypo_logs;
-- CREATE POLICY hypo_logs_owner_or_linked_carer_select
--   ON public.hypo_logs FOR SELECT
--   USING (
--     user_id = auth.uid()
--     OR EXISTS (
--       SELECT 1 FROM public.carer_links cl
--       WHERE cl.patient_id = public.hypo_logs.user_id
--         AND cl.carer_id = auth.uid()
--         AND coalesce((cl.scopes->>'hypo_alerts')::boolean, false) = true
--     )
--   );
--
-- Profiles (public.profiles, owner column id, scope key emergency_info)
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS profiles_owner_or_linked_carer_emergency_select ON public.profiles;
-- CREATE POLICY profiles_owner_or_linked_carer_emergency_select
--   ON public.profiles FOR SELECT
--   USING (
--     id = auth.uid()
--     OR EXISTS (
--       SELECT 1 FROM public.carer_links cl
--       WHERE cl.patient_id = public.profiles.id
--         AND cl.carer_id = auth.uid()
--         AND coalesce((cl.scopes->>'emergency_info')::boolean, false) = true
--     )
--   );
