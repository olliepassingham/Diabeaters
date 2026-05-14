-- One round-trip for the messages inbox: latest row per thread (replaces N parallel client queries).

CREATE OR REPLACE FUNCTION public.latest_dm_messages_for_threads(p_thread_ids uuid[])
RETURNS SETOF public.dm_messages
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.thread_id) m.*
  FROM public.dm_messages m
  WHERE m.thread_id = ANY(p_thread_ids)
    AND public.dm_thread_has_member(m.thread_id, auth.uid())
  ORDER BY m.thread_id, m.created_at DESC, m.id DESC;
$$;

REVOKE ALL ON FUNCTION public.latest_dm_messages_for_threads(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.latest_dm_messages_for_threads(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.latest_dm_messages_for_threads(uuid[]) IS
  'Returns the latest dm_messages row per thread for threads the caller belongs to.';
