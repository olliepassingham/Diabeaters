-- Ensure acknowledge_hypo_log can insert patient notifications under RLS.

CREATE OR REPLACE FUNCTION public.acknowledge_hypo_log(p_hypo_log_id uuid)
RETURNS public.hypo_log_acknowledgements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  hypo public.hypo_logs%ROWTYPE;
  link public.carer_links%ROWTYPE;
  ack public.hypo_log_acknowledgements%ROWTYPE;
  carer_label text;
  patient_inapp boolean := true;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO hypo FROM public.hypo_logs WHERE id = p_hypo_log_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'hypo_not_found';
  END IF;

  SELECT * INTO link
  FROM public.carer_links
  WHERE patient_id = hypo.user_id AND carer_id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_linked';
  END IF;

  IF coalesce((link.scopes->>'hypo_alerts')::boolean, false) = false THEN
    RAISE EXCEPTION 'scope_denied';
  END IF;

  INSERT INTO public.hypo_log_acknowledgements (hypo_log_id, carer_id, patient_id)
  VALUES (p_hypo_log_id, uid, hypo.user_id)
  ON CONFLICT (hypo_log_id, carer_id) DO NOTHING
  RETURNING * INTO ack;

  IF NOT FOUND THEN
    SELECT * INTO ack
    FROM public.hypo_log_acknowledgements
    WHERE hypo_log_id = p_hypo_log_id AND carer_id = uid;
    RETURN ack;
  END IF;

  SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.public_handle), ''), 'Your supporter')
  INTO carer_label
  FROM public.profiles p
  WHERE p.id = uid;

  SELECT coalesce((np.prefs->>'inapp')::boolean, true)
  INTO patient_inapp
  FROM public.notification_preferences np
  WHERE np.user_id = hypo.user_id;

  IF patient_inapp IS NULL THEN
    patient_inapp := true;
  END IF;

  IF patient_inapp AND to_regclass('public.notifications') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = hypo.user_id
        AND n.dedupe_key = 'hypo_ack:' || p_hypo_log_id::text || ':' || uid::text
    ) THEN
      INSERT INTO public.notifications (user_id, title, body, data, read, dedupe_key)
      VALUES (
        hypo.user_id,
        'Supporter acknowledged',
        carer_label || ' saw your hypo log',
        jsonb_build_object(
          'kind', 'hypo_acknowledged',
          'hypo_id', p_hypo_log_id,
          'carer_id', uid,
          'carer_name', carer_label,
          'deep_link', '/tools/hypo-history'
        ),
        false,
        'hypo_ack:' || p_hypo_log_id::text || ':' || uid::text
      );
    END IF;
  END IF;

  RETURN ack;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acknowledge_hypo_log(uuid) TO authenticated;
