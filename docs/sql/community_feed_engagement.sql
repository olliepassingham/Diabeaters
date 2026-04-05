-- Feed engagement: comment_count, like_count, community_post_reactions.
-- Mirror of supabase/migrations/20260407120000_community_feed_engagement.sql
-- Apply after docs/sql/community.sql, community_social_v2.sql, and community_feed_enhancements.

-- ---------------------------------------------------------------------------
-- Denormalized counts on posts
-- ---------------------------------------------------------------------------
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.community_posts.comment_count IS 'Maintained by trigger on community_post_comments.';
COMMENT ON COLUMN public.community_posts.like_count IS 'Maintained by trigger on community_post_reactions.';

-- ---------------------------------------------------------------------------
-- Likes (one row per user per post)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_post_reactions (
  post_id uuid NOT NULL REFERENCES public.community_posts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_post_reactions_post_id_idx
  ON public.community_post_reactions (post_id);

CREATE INDEX IF NOT EXISTS community_post_reactions_user_id_idx
  ON public.community_post_reactions (user_id);

ALTER TABLE public.community_post_reactions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Triggers: bump comment_count
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_community_post_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS community_post_comments_bump_count ON public.community_post_comments;
CREATE TRIGGER community_post_comments_bump_count
  AFTER INSERT OR DELETE ON public.community_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_community_post_comment_count();

-- ---------------------------------------------------------------------------
-- Triggers: bump like_count
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_community_post_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS community_post_reactions_bump_count ON public.community_post_reactions;
CREATE TRIGGER community_post_reactions_bump_count
  AFTER INSERT OR DELETE ON public.community_post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_community_post_like_count();

-- ---------------------------------------------------------------------------
-- Backfill counts (idempotent)
-- ---------------------------------------------------------------------------
UPDATE public.community_posts p
SET comment_count = COALESCE((SELECT count(*)::int FROM public.community_post_comments c WHERE c.post_id = p.id), 0);

UPDATE public.community_posts p
SET like_count = COALESCE((SELECT count(*)::int FROM public.community_post_reactions r WHERE r.post_id = p.id), 0);

-- ---------------------------------------------------------------------------
-- RLS: reactions — align visibility with posts (block-aware)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS community_post_reactions_select_not_blocked ON public.community_post_reactions;
CREATE POLICY community_post_reactions_select_not_blocked
  ON public.community_post_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = community_post_reactions.post_id
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = p.author_id)
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = community_post_reactions.user_id)
         OR (b.blocked_id = auth.uid() AND b.blocker_id = community_post_reactions.user_id)
    )
  );

DROP POLICY IF EXISTS community_post_reactions_insert_own ON public.community_post_reactions;
CREATE POLICY community_post_reactions_insert_own
  ON public.community_post_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = post_id
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = p.author_id)
        )
    )
  );

DROP POLICY IF EXISTS community_post_reactions_delete_own ON public.community_post_reactions;
CREATE POLICY community_post_reactions_delete_own
  ON public.community_post_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
