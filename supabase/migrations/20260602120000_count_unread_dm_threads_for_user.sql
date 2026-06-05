-- Service-role helper for accurate iOS/Android push badge counts (unread DM threads).
-- Depends on public.dm_thread_user_settings (migration 20260602115000_dm_thread_user_settings.sql).

CREATE OR REPLACE FUNCTION public.count_unread_dm_threads_for_user(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    ORDER BY m.thread_id, m.created_at DESC, m.id DESC
  )
  SELECT COUNT(*)::integer
  FROM latest
  WHERE sender_id <> p_user_id
    AND read_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.count_unread_dm_threads_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_unread_dm_threads_for_user(uuid) TO service_role;

COMMENT ON FUNCTION public.count_unread_dm_threads_for_user(uuid) IS
  'Unread DM conversation count for push badge (excludes hidden threads; latest message from other party, unread).';
