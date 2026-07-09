-- Latest near-live glucose snapshot for linked supporters (scope: live_glucose).
-- Patient device publishes after Dexcom/Health prefill; not a full CGM stream.

CREATE TABLE IF NOT EXISTS public.patient_live_glucose (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  value numeric NOT NULL,
  units text NOT NULL CHECK (units IN ('mmol/L', 'mg/dL')),
  trend text CHECK (trend IN ('rising', 'falling', 'flat')),
  source_label text NOT NULL DEFAULT 'Dexcom Share',
  recorded_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_live_glucose_updated_at_idx ON public.patient_live_glucose (updated_at DESC);

ALTER TABLE public.patient_live_glucose ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_live_glucose_owner_all ON public.patient_live_glucose;
CREATE POLICY patient_live_glucose_owner_all
  ON public.patient_live_glucose
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS patient_live_glucose_linked_carer_select ON public.patient_live_glucose;
CREATE POLICY patient_live_glucose_linked_carer_select
  ON public.patient_live_glucose
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.carer_links cl
      WHERE cl.patient_id = public.patient_live_glucose.user_id
        AND cl.carer_id = auth.uid()
        AND coalesce((cl.scopes->>'live_glucose')::boolean, true) = true
    )
  );

COMMENT ON TABLE public.patient_live_glucose IS
  'Latest CGM reading shared with opted-in linked supporters. Patient upserts from device; carers read via live_glucose scope.';

-- Include live_glucose in default scopes for new supporter links.
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
  v_dob date;
  v_age int;
  v_clinical boolean;
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
  WHERE patient_id = inv.patient_id AND carer_id = uid
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.carer_invites SET used_at = now() WHERE code = invite_code;
    RETURN link;
  END IF;

  SELECT pr.date_of_birth INTO v_dob
  FROM public.profiles pr
  WHERE pr.id = inv.patient_id;

  IF v_dob IS NULL THEN
    v_clinical := false;
  ELSE
    v_age := EXTRACT(
      YEAR FROM age(
        (timezone('UTC', now()))::date,
        v_dob
      )
    )::int;
    IF v_age IS NULL THEN
      v_clinical := false;
    ELSIF v_age < 13 THEN
      v_clinical := true;
    ELSE
      v_clinical := false;
    END IF;
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
      'live_glucose', true,
      'clinical_settings', v_clinical
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
