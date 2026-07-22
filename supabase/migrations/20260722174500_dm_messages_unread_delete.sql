-- Allow senders to unsend their own DM while the recipient has not read it yet.
-- Soft-delete via deleted_at so realtime UPDATE can remove the bubble for both sides,
-- and inbox/latest-message RPCs can skip deleted rows.

ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS dm_messages_thread_id_created_at_active_idx
  ON public.dm_messages (thread_id, created_at ASC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.dm_messages.deleted_at IS
  'When set, message is unsent/hidden. Only allowed for the sender while read_at is still null.';

-- Atomically unsend: sender-only, unread-only, clears related in-app notification rows.
CREATE OR REPLACE FUNCTION public.delete_unread_dm_message(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_updated int := 0;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.dm_messages
  SET deleted_at = now()
  WHERE id = p_message_id
    AND sender_id = v_me
    AND read_at IS NULL
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN false;
  END IF;

  -- Drop the recipient's unread inbox notification for this exact message, if any.
  DELETE FROM public.notifications
  WHERE coalesce(data->>'kind', '') = 'dm_message'
    AND coalesce(data->>'message_id', '') = p_message_id::text
    AND read = false;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_unread_dm_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_unread_dm_message(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_unread_dm_message(uuid) IS
  'Soft-deletes a DM the caller sent, only while the recipient has not read it yet.';

-- Latest message per thread should ignore unsent messages.
CREATE OR REPLACE FUNCTION public.latest_dm_messages_for_threads(p_thread_ids uuid[])
RETURNS SETOF public.dm_messages
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.thread_id) m.*
  FROM public.dm_messages m
  WHERE m.thread_id = ANY(p_thread_ids)
    AND m.deleted_at IS NULL
    AND public.dm_thread_has_member(m.thread_id, auth.uid())
  ORDER BY m.thread_id, m.created_at DESC, m.id DESC;
$$;

-- Unread badge count should also ignore deleted latest rows.
CREATE OR REPLACE FUNCTION public.count_unread_dm_threads_for_user(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN 0;
  END IF;

  RETURN (
    WITH visible_threads AS (
      SELECT tm.thread_id
      FROM public.dm_thread_members tm
      LEFT JOIN public.dm_thread_user_settings s
        ON s.thread_id = tm.thread_id AND s.user_id = tm.user_id
      WHERE tm.user_id = p_user_id
        AND COALESCE(s.hidden, false) = false
    ),
    latest AS (
      SELECT DISTINCT ON (m.thread_id)
        m.thread_id,
        m.sender_id,
        m.read_at
      FROM public.dm_messages m
      INNER JOIN visible_threads vt ON vt.thread_id = m.thread_id
      WHERE m.deleted_at IS NULL
      ORDER BY m.thread_id, m.created_at DESC, m.id DESC
    )
    SELECT COUNT(*)::integer
    FROM latest
    WHERE sender_id <> p_user_id
      AND read_at IS NULL
  );
END;
$$;
