-- Age-aware default supporter scopes when redeeming an invite.
-- Child (under 13, whole years vs UTC calendar date): clinical_settings defaults to true.
-- Teen (13–17), adult (18+), or missing DOB: clinical_settings defaults to false (unchanged).

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
  WHERE patient_id = inv.patient_id AND carer_id = uid;

  IF FOUND THEN
    UPDATE public.carer_invites
    SET used_at = now()
    WHERE code = invite_code;
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

COMMENT ON FUNCTION public.redeem_carer_invite(text) IS
  'Redeem supporter invite; default scopes include clinical_settings true only when patient DOB shows under 13 (UTC date).';
