-- Idempotent redeem: if carer is already linked to this patient, mark invite used and return existing row
-- (avoids duplicate key on carer_links_patient_id_carer_id_key when patient issues a new invite).

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
