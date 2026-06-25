-- Pending hypo check-ins expire after 30 minutes without a patient reply.

ALTER TABLE public.hypo_check_ins
  DROP CONSTRAINT IF EXISTS hypo_check_ins_status_check;

ALTER TABLE public.hypo_check_ins
  ADD CONSTRAINT hypo_check_ins_status_check
  CHECK (status IN ('pending', 'ok', 'treating', 'hypo_logged', 'expired'));

COMMENT ON TABLE public.hypo_check_ins IS
  'Proactive supporter hypo awareness check-ins; pending rows expire after 30 minutes.';

CREATE OR REPLACE FUNCTION public.expire_stale_hypo_check_ins()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE public.hypo_check_ins
  SET
    status = 'expired',
    responded_at = coalesce(responded_at, now())
  WHERE status = 'pending'
    AND created_at < now() - interval '30 minutes';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_hypo_check_ins() TO authenticated;

-- Re-create create_hypo_check_in with expiry sweep before pending/rate checks.
CREATE OR REPLACE FUNCTION public.create_hypo_check_in(p_patient_id uuid)
RETURNS public.hypo_check_ins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  link public.carer_links%ROWTYPE;
  row public.hypo_check_ins%ROWTYPE;
  carer_label text;
  patient_inapp boolean := true;
  recent_count int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM public.expire_stale_hypo_check_ins();

  IF p_patient_id IS NULL OR p_patient_id = uid THEN
    RAISE EXCEPTION 'invalid_patient';
  END IF;

  SELECT * INTO link
  FROM public.carer_links
  WHERE patient_id = p_patient_id AND carer_id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_linked';
  END IF;

  IF coalesce((link.scopes->>'hypo_alerts')::boolean, false) = false THEN
    RAISE EXCEPTION 'scope_denied';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.hypo_check_ins h
    WHERE h.carer_id = uid
      AND h.patient_id = p_patient_id
      AND h.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'pending_exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.hypo_check_ins h
    WHERE h.carer_id = uid
      AND h.patient_id = p_patient_id
      AND h.created_at > now() - interval '15 minutes'
      AND h.status <> 'expired'
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
        'deep_link', '/?hypo_log=1'
      ),
      false,
      'hypo_check_in:' || row.id::text
    );
  END IF;

  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_hypo_check_in(
  p_check_in_id uuid,
  p_response text,
  p_hypo_log_id uuid DEFAULT NULL
)
RETURNS public.hypo_check_ins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row public.hypo_check_ins%ROWTYPE;
  next_status text;
  carer_inapp boolean := true;
  patient_label text;
  response_label text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM public.expire_stale_hypo_check_ins();

  IF p_response NOT IN ('ok', 'treating', 'hypo_logged') THEN
    RAISE EXCEPTION 'invalid_response';
  END IF;

  SELECT * INTO row
  FROM public.hypo_check_ins
  WHERE id = p_check_in_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'check_in_not_found';
  END IF;

  IF row.patient_id <> uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF row.status = 'expired' THEN
    RAISE EXCEPTION 'check_in_expired';
  END IF;

  IF row.status <> 'pending' THEN
    RETURN row;
  END IF;

  next_status := p_response;

  IF p_response = 'hypo_logged' THEN
    IF p_hypo_log_id IS NULL THEN
      RAISE EXCEPTION 'hypo_log_required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.hypo_logs h WHERE h.id = p_hypo_log_id AND h.user_id = uid
    ) THEN
      RAISE EXCEPTION 'hypo_log_not_found';
    END IF;
  END IF;

  UPDATE public.hypo_check_ins
  SET
    status = next_status,
    hypo_log_id = CASE WHEN p_response = 'hypo_logged' THEN p_hypo_log_id ELSE hypo_log_id END,
    responded_at = now()
  WHERE id = p_check_in_id
  RETURNING * INTO row;

  SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.public_handle), ''), 'Your supporter')
  INTO patient_label
  FROM public.profiles p
  WHERE p.id = uid;

  response_label := CASE p_response
    WHEN 'ok' THEN patient_label || ' replied they''re OK'
    WHEN 'treating' THEN patient_label || ' is treating a possible hypo'
    ELSE patient_label || ' logged a hypo'
  END;

  SELECT coalesce((np.prefs->>'inapp')::boolean, true)
  INTO carer_inapp
  FROM public.notification_preferences np
  WHERE np.user_id = row.carer_id;

  IF carer_inapp IS NULL THEN
    carer_inapp := true;
  END IF;

  IF carer_inapp AND to_regclass('public.notifications') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = row.carer_id
        AND n.dedupe_key = 'hypo_check_in_resp:' || p_check_in_id::text
    ) THEN
      INSERT INTO public.notifications (user_id, title, body, data, read, dedupe_key)
      VALUES (
        row.carer_id,
        'Hypo check-in update',
        response_label,
        jsonb_build_object(
          'kind', 'hypo_check_in_response',
          'check_in_id', row.id,
          'response', p_response,
          'patient_user_id', uid,
          'patient_name', patient_label,
          'hypo_id', p_hypo_log_id,
          'deep_link', '/carer-view'
        ),
        false,
        'hypo_check_in_resp:' || p_check_in_id::text
      );
    END IF;
  END IF;

  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_pending_hypo_check_ins()
RETURNS TABLE (
  id uuid,
  carer_id uuid,
  carer_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.expire_stale_hypo_check_ins();

  RETURN QUERY
  SELECT
    h.id,
    h.carer_id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.public_handle), ''), 'Your supporter')::text AS carer_name,
    h.created_at
  FROM public.hypo_check_ins h
  LEFT JOIN public.profiles p ON p.id = h.carer_id
  WHERE h.patient_id = uid
    AND h.status = 'pending'
  ORDER BY h.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_hypo_check_ins_for_carer(
  p_patient_id uuid,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  status text,
  hypo_log_id uuid,
  created_at timestamptz,
  responded_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  lim int := greatest(1, least(coalesce(p_limit, 5), 20));
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.expire_stale_hypo_check_ins();

  IF NOT EXISTS (
    SELECT 1
    FROM public.carer_links cl
    WHERE cl.patient_id = p_patient_id
      AND cl.carer_id = uid
      AND coalesce((cl.scopes->>'hypo_alerts')::boolean, false) = true
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT h.id, h.status, h.hypo_log_id, h.created_at, h.responded_at
  FROM public.hypo_check_ins h
  WHERE h.carer_id = uid
    AND h.patient_id = p_patient_id
  ORDER BY h.created_at DESC
  LIMIT lim;
END;
$$;
