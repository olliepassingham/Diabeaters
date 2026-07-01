-- Hypo check-in notifications should open home (response card), not the hypo log dialog.

CREATE OR REPLACE FUNCTION public.create_hypo_check_in(p_patient_id uuid)
RETURNS public.hypo_check_ins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row public.hypo_check_ins%ROWTYPE;
  carer_label text;
  patient_inapp boolean;
  pending_count int;
  recent_count int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM public.expire_stale_hypo_check_ins();

  IF NOT EXISTS (
    SELECT 1
    FROM public.carer_links cl
    WHERE cl.carer_id = uid
      AND cl.patient_id = p_patient_id
      AND (cl.scopes->>'hypo_alerts')::boolean IS NOT FALSE
  ) THEN
    RAISE EXCEPTION 'scope_denied';
  END IF;

  SELECT count(*)::int INTO pending_count
  FROM public.hypo_check_ins h
  WHERE h.carer_id = uid
    AND h.patient_id = p_patient_id
    AND h.status = 'pending'
    AND h.created_at > now() - interval '30 minutes';

  IF pending_count > 0 THEN
    RAISE EXCEPTION 'pending_exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.hypo_check_ins h
    WHERE h.carer_id = uid
      AND h.patient_id = p_patient_id
      AND h.created_at > now() - interval '15 minutes'
  ) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT count(*)::int INTO recent_count
  FROM public.hypo_check_ins h
  WHERE h.carer_id = uid
    AND h.patient_id = p_patient_id
    AND h.created_at > now() - interval '24 hours'
    AND h.status <> 'expired';

  IF recent_count >= 8 THEN
    RAISE EXCEPTION 'daily_limit';
  END IF;

  INSERT INTO public.hypo_check_ins (carer_id, patient_id, status)
  VALUES (uid, p_patient_id, 'pending')
  RETURNING * INTO row;

  SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.public_handle), ''), 'Your supporter')
  INTO carer_label
  FROM public.profiles p
  WHERE p.id = uid;

  SELECT coalesce((np.prefs->>'inapp')::boolean, true)
  INTO patient_inapp
  FROM public.notification_preferences np
  WHERE np.user_id = p_patient_id;

  IF patient_inapp IS NULL THEN
    patient_inapp := true;
  END IF;

  IF patient_inapp AND to_regclass('public.notifications') IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, data, read, dedupe_key)
    VALUES (
      p_patient_id,
      'Hypo check-in',
      carer_label || ' is checking you''re OK — are you aware of a possible hypo?',
      jsonb_build_object(
        'kind', 'hypo_check_in',
        'check_in_id', row.id,
        'carer_id', uid,
        'carer_name', carer_label,
        'patient_user_id', p_patient_id,
        'deep_link', '/'
      ),
      false,
      'hypo_check_in:' || row.id::text
    );
  END IF;

  RETURN row;
END;
$$;
