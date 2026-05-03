-- Supporter scope: clinical_settings (delivery, TDD, date of birth on patient profile).
-- Idempotent redeem default scopes include clinical_settings: false.
-- SECURITY DEFINER RPCs gate updates on carer_links.scopes->clinical_settings.

-- 1. Patient profile DOB (used by coach / age gating; optional for users)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date NULL;

COMMENT ON COLUMN public.profiles.date_of_birth IS
  'Optional YYYY-MM-DD for age-aware app behaviour; carers may update when clinical_settings scope is granted.';

-- 2. Backfill missing scope key on existing links (privacy default: off)
UPDATE public.carer_links cl
SET scopes = cl.scopes || jsonb_build_object('clinical_settings', false)
WHERE NOT (cl.scopes ? 'clinical_settings');

-- 3. Redeem: default scopes include clinical_settings: false
CREATE OR REPLACE FUNCTION public.redeem_carer_invite(invite_code text)
RETURNS public.carer_links
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
      'emergency_info', true,
      'clinical_settings', false
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

-- 4. Carer read (metadata only)
CREATE OR REPLACE FUNCTION public.get_patient_clinical_prefs_for_carer(p_patient_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r record;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.carer_links cl
    WHERE cl.patient_id = p_patient_id
      AND cl.carer_id = uid
      AND coalesce((cl.scopes->>'clinical_settings')::boolean, false)
  ) THEN
    RETURN NULL;
  END IF;

  SELECT pr.date_of_birth, pr.insulin_delivery_method, pr.tdd
  INTO r
  FROM public.profiles pr
  WHERE pr.id = p_patient_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'date_of_birth',
    CASE WHEN r.date_of_birth IS NULL THEN NULL ELSE to_char(r.date_of_birth, 'YYYY-MM-DD') END,
    'insulin_delivery_method', r.insulin_delivery_method,
    'tdd', r.tdd
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_patient_clinical_prefs_for_carer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_patient_clinical_prefs_for_carer(uuid) TO authenticated;

-- 5. Carer write (patch keys only; omitted keys unchanged)
CREATE OR REPLACE FUNCTION public.update_patient_clinical_prefs_for_carer(
  p_patient_id uuid,
  p_fields jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_dob date;
  v_dob_raw text;
  v_idm text;
  v_tdd numeric;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.carer_links cl
    WHERE cl.patient_id = p_patient_id
      AND cl.carer_id = uid
      AND coalesce((cl.scopes->>'clinical_settings')::boolean, false)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_fields ? 'date_of_birth' THEN
    v_dob_raw := p_fields->>'date_of_birth';
    IF v_dob_raw IS NULL OR trim(v_dob_raw) = '' THEN
      v_dob := NULL;
    ELSIF trim(v_dob_raw) ~ '^\d{4}-\d{2}-\d{2}$' THEN
      v_dob := trim(v_dob_raw)::date;
    ELSE
      RAISE EXCEPTION 'invalid date_of_birth';
    END IF;
  END IF;

  IF p_fields ? 'insulin_delivery_method' THEN
    v_idm := nullif(trim(lower(p_fields->>'insulin_delivery_method')), '');
    IF v_idm IS NOT NULL AND v_idm NOT IN ('pen', 'pump') THEN
      RAISE EXCEPTION 'invalid insulin_delivery_method';
    END IF;
  END IF;

  IF p_fields ? 'tdd' THEN
    IF jsonb_typeof(p_fields->'tdd') = 'null' THEN
      v_tdd := NULL;
    ELSIF jsonb_typeof(p_fields->'tdd') = 'number' THEN
      v_tdd := (p_fields->'tdd')::text::numeric;
      IF v_tdd IS NOT NULL AND v_tdd <= 0 THEN
        v_tdd := NULL;
      END IF;
    ELSIF jsonb_typeof(p_fields->'tdd') = 'string' AND trim(p_fields->>'tdd') <> '' THEN
      v_tdd := trim(p_fields->>'tdd')::numeric;
      IF v_tdd IS NOT NULL AND v_tdd <= 0 THEN
        v_tdd := NULL;
      END IF;
    ELSE
      v_tdd := NULL;
    END IF;
  END IF;

  UPDATE public.profiles pr
  SET
    date_of_birth = CASE WHEN p_fields ? 'date_of_birth' THEN v_dob ELSE pr.date_of_birth END,
    insulin_delivery_method = CASE
      WHEN p_fields ? 'insulin_delivery_method' THEN v_idm
      ELSE pr.insulin_delivery_method
    END,
    tdd = CASE WHEN p_fields ? 'tdd' THEN v_tdd ELSE pr.tdd END
  WHERE pr.id = p_patient_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_patient_clinical_prefs_for_carer(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_patient_clinical_prefs_for_carer(uuid, jsonb) TO authenticated;
