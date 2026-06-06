-- Enforce user_blocks on DM sends (existing threads were still writable after a block).

CREATE OR REPLACE FUNCTION public.dm_thread_has_block_with_member(p_thread_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dm_thread_members other
    JOIN public.user_blocks b ON (
      (b.blocker_id = p_user_id AND b.blocked_id = other.user_id)
      OR (b.blocker_id = other.user_id AND b.blocked_id = p_user_id)
    )
    WHERE other.thread_id = p_thread_id
      AND other.user_id IS DISTINCT FROM p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.dm_thread_has_block_with_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dm_thread_has_block_with_member(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.dm_thread_has_block_with_member(uuid, uuid) IS
  'True when p_user_id has a block relationship (either direction) with another member of the DM thread.';

DROP POLICY IF EXISTS dm_messages_insert_member ON public.dm_messages;
CREATE POLICY dm_messages_insert_member
  ON public.dm_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.dm_thread_has_member(thread_id, auth.uid())
    AND NOT public.dm_thread_has_block_with_member(thread_id, auth.uid())
    AND (
      image_storage_path IS NULL
      OR image_storage_path LIKE (auth.uid()::text || '/dm/%')
    )
  );

-- Refuse opening/creating threads when either user has blocked the other (including existing threads).
CREATE OR REPLACE FUNCTION public.get_or_create_dm_thread(p_other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_tid uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_other_user IS NULL OR p_other_user = v_me THEN
    RAISE EXCEPTION 'invalid other user';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = v_me AND b.blocked_id = p_other_user)
       OR (b.blocker_id = p_other_user AND b.blocked_id = v_me)
  ) THEN
    RAISE EXCEPTION 'dm_not_allowed_blocked';
  END IF;

  SELECT t.id INTO v_tid
  FROM public.dm_threads t
  WHERE EXISTS (
    SELECT 1 FROM public.dm_thread_members m
    WHERE m.thread_id = t.id AND m.user_id = v_me
  )
  AND EXISTS (
    SELECT 1 FROM public.dm_thread_members m
    WHERE m.thread_id = t.id AND m.user_id = p_other_user
  )
  AND (
    SELECT COUNT(*)::int FROM public.dm_thread_members m WHERE m.thread_id = t.id
  ) = 2
  LIMIT 1;

  IF v_tid IS NOT NULL THEN
    RETURN v_tid;
  END IF;

  INSERT INTO public.dm_threads (id) VALUES (gen_random_uuid())
  RETURNING id INTO v_tid;

  INSERT INTO public.dm_thread_members (thread_id, user_id) VALUES
    (v_tid, v_me),
    (v_tid, p_other_user);

  RETURN v_tid;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_dm_thread(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_thread(uuid) TO authenticated;
