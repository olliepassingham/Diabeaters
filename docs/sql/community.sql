-- Community mode v1: timeline posts, comments, and 1:1 direct messages.
-- Apply in Supabase SQL editor. No Edge Functions required for CRUD (Postgres + RLS only).
--
-- After apply: optionally enable Realtime for public.dm_messages and public.community_posts
-- (Database → Replication) if you want live updates.

-- ---------------------------------------------------------------------------
-- Timeline: posts + comments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_posts_created_at_idx ON public.community_posts (created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_post_comments_post_id_created_at_idx
  ON public.community_post_comments (post_id, created_at ASC);

-- ---------------------------------------------------------------------------
-- Direct messages: threads, members, messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dm_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dm_thread_members (
  thread_id uuid NOT NULL REFERENCES public.dm_threads (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS dm_thread_members_user_id_idx ON public.dm_thread_members (user_id);

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.dm_threads (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS dm_messages_thread_id_created_at_idx
  ON public.dm_messages (thread_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.dm_threads_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.dm_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dm_messages_touch_thread ON public.dm_messages;
CREATE TRIGGER dm_messages_touch_thread
  AFTER INSERT ON public.dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.dm_threads_set_updated_at();

-- Create or return existing 1:1 thread between auth.uid() and p_other_user.
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

-- Used by DM RLS policies to avoid infinite recursion (do not self-query dm_thread_members in policies).
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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

-- Posts: any authenticated user can read; only author can insert own row
DROP POLICY IF EXISTS community_posts_select_authenticated ON public.community_posts;
CREATE POLICY community_posts_select_authenticated
  ON public.community_posts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS community_posts_insert_own ON public.community_posts;
CREATE POLICY community_posts_insert_own
  ON public.community_posts FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS community_posts_update_own ON public.community_posts;
CREATE POLICY community_posts_update_own
  ON public.community_posts FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS community_posts_delete_own ON public.community_posts;
CREATE POLICY community_posts_delete_own
  ON public.community_posts FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- Comments
DROP POLICY IF EXISTS community_post_comments_select_authenticated ON public.community_post_comments;
CREATE POLICY community_post_comments_select_authenticated
  ON public.community_post_comments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS community_post_comments_insert_own ON public.community_post_comments;
CREATE POLICY community_post_comments_insert_own
  ON public.community_post_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS community_post_comments_update_own ON public.community_post_comments;
CREATE POLICY community_post_comments_update_own
  ON public.community_post_comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS community_post_comments_delete_own ON public.community_post_comments;
CREATE POLICY community_post_comments_delete_own
  ON public.community_post_comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- DM threads: visible if member (use helper to avoid RLS recursion on dm_thread_members)
DROP POLICY IF EXISTS dm_threads_select_member ON public.dm_threads;
CREATE POLICY dm_threads_select_member
  ON public.dm_threads FOR SELECT
  TO authenticated
  USING (public.dm_thread_has_member(id, auth.uid()));

-- Thread members: visible if you are in the thread
DROP POLICY IF EXISTS dm_thread_members_select_member ON public.dm_thread_members;
CREATE POLICY dm_thread_members_select_member
  ON public.dm_thread_members FOR SELECT
  TO authenticated
  USING (public.dm_thread_has_member(thread_id, auth.uid()));

-- No direct INSERT on dm_thread_members from clients (use get_or_create_dm_thread)

-- Messages: select if member
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
