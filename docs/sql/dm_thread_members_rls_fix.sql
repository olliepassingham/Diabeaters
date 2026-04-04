-- Fix: infinite recursion detected in policy for relation "dm_thread_members"
-- The original SELECT policy used EXISTS (SELECT ... FROM dm_thread_members ...), which
-- re-evaluated RLS on the same table. This helper uses SECURITY DEFINER to read membership
-- without recursive policy checks.
--
-- Apply in Supabase SQL editor after docs/sql/community.sql (safe to re-run).

CREATE OR REPLACE FUNCTION public.dm_thread_has_member(p_thread_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_thread_members m
    WHERE m.thread_id = p_thread_id AND m.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.dm_thread_has_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dm_thread_has_member(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.dm_thread_has_member(uuid, uuid) IS 'RLS helper: thread membership without recursive policy checks.';

-- DM threads: visible if member
DROP POLICY IF EXISTS dm_threads_select_member ON public.dm_threads;
CREATE POLICY dm_threads_select_member
  ON public.dm_threads FOR SELECT
  TO authenticated
  USING (public.dm_thread_has_member(id, auth.uid()));

-- Thread members: visible if you are in the thread (see all rows for that thread)
DROP POLICY IF EXISTS dm_thread_members_select_member ON public.dm_thread_members;
CREATE POLICY dm_thread_members_select_member
  ON public.dm_thread_members FOR SELECT
  TO authenticated
  USING (public.dm_thread_has_member(thread_id, auth.uid()));

-- Messages: select / insert / update if member
DROP POLICY IF EXISTS dm_messages_select_member ON public.dm_messages;
CREATE POLICY dm_messages_select_member
  ON public.dm_messages FOR SELECT
  TO authenticated
  USING (public.dm_thread_has_member(thread_id, auth.uid()));

DROP POLICY IF EXISTS dm_messages_insert_member ON public.dm_messages;
CREATE POLICY dm_messages_insert_member
  ON public.dm_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.dm_thread_has_member(thread_id, auth.uid())
  );

DROP POLICY IF EXISTS dm_messages_update_read_own ON public.dm_messages;
CREATE POLICY dm_messages_update_read_own
  ON public.dm_messages FOR UPDATE
  TO authenticated
  USING (public.dm_thread_has_member(thread_id, auth.uid()))
  WITH CHECK (public.dm_thread_has_member(thread_id, auth.uid()));
