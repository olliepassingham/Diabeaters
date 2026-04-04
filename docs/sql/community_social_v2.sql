-- Community social layer v2: follows, blocks, public handle, feed visibility, DM block guard.
-- Apply in Supabase SQL editor AFTER docs/sql/community.sql (and profiles tables).
--
-- Deferred (not in this script): push/in-app notifications for new follower or DM — use notifications table + Edge when ready.

-- ---------------------------------------------------------------------------
-- Public handle (shareable @slug, stored lowercase)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_handle text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_handle_unique_lower
  ON public.profiles (lower(trim(public_handle)))
  WHERE public_handle IS NOT NULL AND trim(public_handle) <> '';

COMMENT ON COLUMN public.profiles.public_handle IS 'Unique public username for community links; lowercase a-z 0-9 underscore, 3–30 chars (enforced in app).';

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS user_follows_followee_idx ON public.user_follows (followee_id);
CREATE INDEX IF NOT EXISTS user_follows_follower_idx ON public.user_follows (follower_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_follows_select_own ON public.user_follows;
CREATE POLICY user_follows_select_own
  ON public.user_follows FOR SELECT
  TO authenticated
  USING (follower_id = auth.uid() OR followee_id = auth.uid());

DROP POLICY IF EXISTS user_follows_insert_self ON public.user_follows;
CREATE POLICY user_follows_insert_self
  ON public.user_follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS user_follows_delete_self ON public.user_follows;
CREATE POLICY user_follows_delete_self
  ON public.user_follows FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Blocks (either direction hides posts + prevents new DMs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks (blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_blocks_select_own ON public.user_blocks;
CREATE POLICY user_blocks_select_own
  ON public.user_blocks FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

DROP POLICY IF EXISTS user_blocks_insert_self ON public.user_blocks;
CREATE POLICY user_blocks_insert_self
  ON public.user_blocks FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS user_blocks_delete_self ON public.user_blocks;
CREATE POLICY user_blocks_delete_self
  ON public.user_blocks FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Minimal content reports (admin export / future moderation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment', 'profile')),
  target_id uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_reports_created_at_idx ON public.content_reports (created_at DESC);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_reports_insert_own ON public.content_reports;
CREATE POLICY content_reports_insert_own
  ON public.content_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS content_reports_select_own ON public.content_reports;
CREATE POLICY content_reports_select_own
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Replace post/comment SELECT policies: hide when either party blocked
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS community_posts_select_authenticated ON public.community_posts;
CREATE POLICY community_posts_select_not_blocked
  ON public.community_posts FOR SELECT
  TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = community_posts.author_id)
         OR (b.blocked_id = auth.uid() AND b.blocker_id = community_posts.author_id)
    )
  );

DROP POLICY IF EXISTS community_post_comments_select_authenticated ON public.community_post_comments;
CREATE POLICY community_post_comments_select_not_blocked
  ON public.community_post_comments FOR SELECT
  TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = community_post_comments.author_id)
         OR (b.blocked_id = auth.uid() AND b.blocker_id = community_post_comments.author_id)
    )
  );

-- ---------------------------------------------------------------------------
-- DM: refuse new thread if users have blocked each other
-- ---------------------------------------------------------------------------
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
