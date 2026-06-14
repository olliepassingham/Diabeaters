-- Supporters can acknowledge a patient's treated-hypo log; patient sees who responded.

CREATE TABLE IF NOT EXISTS public.hypo_log_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hypo_log_id uuid NOT NULL REFERENCES public.hypo_logs (id) ON DELETE CASCADE,
  carer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reaction text NOT NULL DEFAULT 'seen' CHECK (reaction IN ('seen', 'thumbs_up')),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hypo_log_acknowledgements_hypo_carer_uidx UNIQUE (hypo_log_id, carer_id)
);

CREATE INDEX IF NOT EXISTS hypo_log_acknowledgements_hypo_log_id_idx
  ON public.hypo_log_acknowledgements (hypo_log_id);

CREATE INDEX IF NOT EXISTS hypo_log_acknowledgements_patient_id_idx
  ON public.hypo_log_acknowledgements (patient_id, acknowledged_at DESC);

COMMENT ON TABLE public.hypo_log_acknowledgements IS
  'Linked supporters acknowledge they have seen a patient hypo_logs row (via SECURITY DEFINER RPC).';

ALTER TABLE public.hypo_log_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Carer acknowledges a shared hypo log; notifies patient in-app once per carer/hypo pair.
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

-- Patient or linked supporter: list acknowledgements for hypo log ids the caller may access.
CREATE OR REPLACE FUNCTION public.list_hypo_log_acknowledgements(p_hypo_log_ids uuid[])
RETURNS TABLE (
  hypo_log_id uuid,
  carer_id uuid,
  carer_name text,
  acknowledged_at timestamptz
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

  IF p_hypo_log_ids IS NULL OR cardinality(p_hypo_log_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.hypo_log_id,
    a.carer_id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.public_handle), ''), 'Supporter')::text AS carer_name,
    a.acknowledged_at
  FROM public.hypo_log_acknowledgements a
  JOIN public.hypo_logs h ON h.id = a.hypo_log_id
  LEFT JOIN public.profiles p ON p.id = a.carer_id
  WHERE a.hypo_log_id = ANY (p_hypo_log_ids)
    AND (
      h.user_id = uid
      OR EXISTS (
        SELECT 1
        FROM public.carer_links cl
        WHERE cl.patient_id = h.user_id
          AND cl.carer_id = uid
          AND coalesce((cl.scopes->>'hypo_alerts')::boolean, false) = true
      )
    )
  ORDER BY a.acknowledged_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_hypo_log_acknowledgements(uuid[]) TO authenticated;

-- Dashboard user deletion: include acknowledgements (feedback migration pattern + new table).
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
