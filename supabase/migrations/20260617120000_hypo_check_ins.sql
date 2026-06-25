-- Supporters can ask a linked user if they are aware of a possible hypo; user responds in-app.

CREATE TABLE IF NOT EXISTS public.hypo_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ok', 'treating', 'hypo_logged')),
  hypo_log_id uuid REFERENCES public.hypo_logs (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE INDEX IF NOT EXISTS hypo_check_ins_patient_pending_idx
  ON public.hypo_check_ins (patient_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS hypo_check_ins_carer_patient_idx
  ON public.hypo_check_ins (carer_id, patient_id, created_at DESC);

COMMENT ON TABLE public.hypo_check_ins IS
  'Proactive supporter hypo awareness check-ins; patient responds via SECURITY DEFINER RPC.';

ALTER TABLE public.hypo_check_ins ENABLE ROW LEVEL SECURITY;

-- Supporter sends a hypo awareness check-in (rate limited).
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
  ) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT count(*)::int INTO recent_count
  FROM public.hypo_check_ins h
  WHERE h.carer_id = uid
    AND h.patient_id = p_patient_id
    AND h.created_at > now() - interval '24 hours';

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

GRANT EXECUTE ON FUNCTION public.create_hypo_check_in(uuid) TO authenticated;

-- Patient responds to a check-in.
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

  SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.public_handle), ''), 'Your contact')
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

GRANT EXECUTE ON FUNCTION public.respond_hypo_check_in(uuid, text, uuid) TO authenticated;

-- Patient: pending check-ins.
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

GRANT EXECUTE ON FUNCTION public.list_pending_hypo_check_ins() TO authenticated;

-- Supporter: recent check-ins for a linked patient.
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

GRANT EXECUTE ON FUNCTION public.list_hypo_check_ins_for_carer(uuid, int) TO authenticated;

-- User deletion cleanup.
CREATE OR REPLACE FUNCTION public.auth_delete_user_public_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := OLD.id;
BEGIN
  IF to_regclass('public.community_post_comments') IS NOT NULL THEN
    DELETE FROM public.community_post_comments WHERE author_id = uid;
  END IF;
  IF to_regclass('public.community_post_reactions') IS NOT NULL THEN
    DELETE FROM public.community_post_reactions WHERE user_id = uid;
  END IF;
  IF to_regclass('public.community_posts') IS NOT NULL THEN
    DELETE FROM public.community_posts WHERE author_id = uid;
  END IF;

  IF to_regclass('public.dm_messages') IS NOT NULL THEN
    DELETE FROM public.dm_messages WHERE sender_id = uid;
  END IF;
  IF to_regclass('public.dm_thread_members') IS NOT NULL THEN
    DELETE FROM public.dm_thread_members WHERE user_id = uid;
  END IF;

  IF to_regclass('public.user_follows') IS NOT NULL THEN
    DELETE FROM public.user_follows WHERE follower_id = uid OR followee_id = uid;
  END IF;
  IF to_regclass('public.user_blocks') IS NOT NULL THEN
    DELETE FROM public.user_blocks WHERE blocker_id = uid OR blocked_id = uid;
  END IF;
  IF to_regclass('public.content_reports') IS NOT NULL THEN
    DELETE FROM public.content_reports WHERE reporter_id = uid;
  END IF;

  IF to_regclass('public.carers') IS NOT NULL THEN
    DELETE FROM public.carers WHERE user_id = uid;
  END IF;
  IF to_regclass('public.hypo_log_acknowledgements') IS NOT NULL THEN
    DELETE FROM public.hypo_log_acknowledgements WHERE carer_id = uid OR patient_id = uid;
  END IF;
  IF to_regclass('public.hypo_check_ins') IS NOT NULL THEN
    DELETE FROM public.hypo_check_ins WHERE carer_id = uid OR patient_id = uid;
  END IF;
  IF to_regclass('public.hypo_logs') IS NOT NULL THEN
    DELETE FROM public.hypo_logs WHERE user_id = uid;
  END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM public.notifications WHERE user_id = uid;
  END IF;
  IF to_regclass('public.push_tokens') IS NOT NULL THEN
    DELETE FROM public.push_tokens WHERE user_id = uid;
  END IF;
  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    DELETE FROM public.notification_preferences WHERE user_id = uid;
  END IF;

  IF to_regclass('public.carer_invites') IS NOT NULL THEN
    DELETE FROM public.carer_invites WHERE patient_id = uid;
  END IF;
  IF to_regclass('public.carer_links') IS NOT NULL THEN
    DELETE FROM public.carer_links WHERE patient_id = uid OR carer_id = uid;
  END IF;
  IF to_regclass('public.account_deletion_requests') IS NOT NULL THEN
    DELETE FROM public.account_deletion_requests WHERE user_id = uid;
  END IF;
  IF to_regclass('public.feedback_submissions') IS NOT NULL THEN
    DELETE FROM public.feedback_submissions WHERE user_id = uid;
  END IF;

  IF to_regclass('public.supply_events') IS NOT NULL THEN
    DELETE FROM public.supply_events WHERE user_id = uid;
  END IF;
  IF to_regclass('public.supplies') IS NOT NULL THEN
    DELETE FROM public.supplies WHERE user_id = uid;
  END IF;
  IF to_regclass('public.appointments') IS NOT NULL THEN
    DELETE FROM public.appointments WHERE user_id = uid;
  END IF;
  IF to_regclass('public.scenarios') IS NOT NULL THEN
    DELETE FROM public.scenarios WHERE user_id = uid;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = uid;
  END IF;

  RETURN OLD;
END;
$$;
