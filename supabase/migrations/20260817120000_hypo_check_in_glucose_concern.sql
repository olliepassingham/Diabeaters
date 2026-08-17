-- Direction-aware supporter check-ins: snapshot latest shared live glucose
-- so replies say "low" / "high" / "sorting it" instead of always "hypo".

ALTER TABLE public.hypo_check_ins
  ADD COLUMN IF NOT EXISTS glucose_concern text NOT NULL DEFAULT 'unknown'
    CHECK (glucose_concern IN ('low', 'high', 'unknown')),
  ADD COLUMN IF NOT EXISTS glucose_value numeric,
  ADD COLUMN IF NOT EXISTS glucose_units text
    CHECK (glucose_units IS NULL OR glucose_units IN ('mmol/L', 'mg/dL'));

COMMENT ON COLUMN public.hypo_check_ins.glucose_concern IS
  'Live-glucose context at send time: low, high, or unknown (no recent shared reading, in-range, or live glucose not shared).';

CREATE OR REPLACE FUNCTION public.check_in_patient_prompt(carer_label text, concern text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN concern = 'low' THEN carer_label || ' is checking you''re OK — are you aware of a possible low?'
    WHEN concern = 'high' THEN carer_label || ' is checking you''re OK — are you aware of a possible high?'
    ELSE carer_label || ' is checking you''re OK.'
  END;
$$;

CREATE OR REPLACE FUNCTION public.check_in_response_body(patient_label text, p_response text, concern text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_response
    WHEN 'ok' THEN patient_label || ' replied they''re OK'
    WHEN 'treating' THEN
      CASE
        WHEN concern = 'low' THEN patient_label || ' is sorting a low'
        WHEN concern = 'high' THEN patient_label || ' is sorting a high'
        ELSE patient_label || ' is sorting it'
      END
    ELSE patient_label || ' logged a hypo'
  END;
$$;

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
  g_concern text := 'unknown';
  g_value numeric;
  g_units text;
  live_shared boolean := false;
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

  SELECT coalesce((cl.scopes->>'live_glucose')::boolean, true)
  INTO live_shared
  FROM public.carer_links cl
  WHERE cl.carer_id = uid
    AND cl.patient_id = p_patient_id;

  IF live_shared AND to_regclass('public.patient_live_glucose') IS NOT NULL THEN
    SELECT
      CASE
        WHEN lg.recorded_at > now() - interval '15 minutes'
         AND lg.range_status IN ('low', 'high')
        THEN lg.range_status
        ELSE 'unknown'
      END,
      CASE
        WHEN lg.recorded_at > now() - interval '15 minutes'
         AND lg.range_status IN ('low', 'high')
        THEN lg.value
      END,
      CASE
        WHEN lg.recorded_at > now() - interval '15 minutes'
         AND lg.range_status IN ('low', 'high')
        THEN lg.units
      END
    INTO g_concern, g_value, g_units
    FROM public.patient_live_glucose lg
    WHERE lg.user_id = p_patient_id;
  END IF;

  g_concern := coalesce(g_concern, 'unknown');

  INSERT INTO public.hypo_check_ins (
    carer_id, patient_id, status, glucose_concern, glucose_value, glucose_units
  )
  VALUES (uid, p_patient_id, 'pending', g_concern, g_value, g_units)
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
      'Check-in',
      public.check_in_patient_prompt(carer_label, g_concern),
      jsonb_build_object(
        'kind', 'hypo_check_in',
        'check_in_id', row.id,
        'carer_id', uid,
        'carer_name', carer_label,
        'patient_user_id', p_patient_id,
        'glucose_concern', g_concern,
        'deep_link', '/'
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
  concern text := 'unknown';
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

  concern := coalesce(row.glucose_concern, 'unknown');

  SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.public_handle), ''), 'Your supporter')
  INTO patient_label
  FROM public.profiles p
  WHERE p.id = uid;

  response_label := public.check_in_response_body(patient_label, p_response, concern);

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
        'Check-in update',
        response_label,
        jsonb_build_object(
          'kind', 'hypo_check_in_response',
          'check_in_id', row.id,
          'response', p_response,
          'patient_user_id', uid,
          'patient_name', patient_label,
          'hypo_id', p_hypo_log_id,
          'glucose_concern', concern,
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

DROP FUNCTION IF EXISTS public.list_pending_hypo_check_ins();

CREATE FUNCTION public.list_pending_hypo_check_ins()
RETURNS TABLE (
  id uuid,
  carer_id uuid,
  carer_name text,
  created_at timestamptz,
  glucose_concern text
)
LANGUAGE plpgsql
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
    h.created_at,
    coalesce(h.glucose_concern, 'unknown')::text AS glucose_concern
  FROM public.hypo_check_ins h
  LEFT JOIN public.profiles p ON p.id = h.carer_id
  WHERE h.patient_id = uid
    AND h.status = 'pending'
  ORDER BY h.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.list_hypo_check_ins_for_carer(uuid, int);

CREATE FUNCTION public.list_hypo_check_ins_for_carer(
  p_patient_id uuid,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  status text,
  hypo_log_id uuid,
  created_at timestamptz,
  responded_at timestamptz,
  glucose_concern text
)
LANGUAGE plpgsql
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
  SELECT
    h.id,
    h.status,
    h.hypo_log_id,
    h.created_at,
    h.responded_at,
    coalesce(h.glucose_concern, 'unknown')::text AS glucose_concern
  FROM public.hypo_check_ins h
  WHERE h.carer_id = uid
    AND h.patient_id = p_patient_id
  ORDER BY h.created_at DESC
  LIMIT lim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_hypo_check_in(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_hypo_check_in(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pending_hypo_check_ins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_hypo_check_ins_for_carer(uuid, int) TO authenticated;
