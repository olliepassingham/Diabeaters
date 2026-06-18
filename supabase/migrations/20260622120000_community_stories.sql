-- Ephemeral community stories (24h), rewatchable from profile until expiry.

CREATE TABLE IF NOT EXISTS public.community_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  media_path text NOT NULL,
  media_kind text NOT NULL DEFAULT 'video' CHECK (media_kind IN ('video', 'image')),
  is_reported boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS community_stories_author_expires_idx
  ON public.community_stories (author_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS community_stories_expires_at_idx
  ON public.community_stories (expires_at);

COMMENT ON TABLE public.community_stories IS
  'One active story per author (app replaces on new upload). Media in bucket community_post_images under {author_id}/stories/.';

CREATE TABLE IF NOT EXISTS public.community_story_views (
  story_id uuid NOT NULL REFERENCES public.community_stories (id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS community_story_views_viewer_idx
  ON public.community_story_views (viewer_id, viewed_at DESC);

ALTER TABLE public.community_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_stories_select_not_blocked ON public.community_stories;
CREATE POLICY community_stories_select_not_blocked
  ON public.community_stories FOR SELECT
  TO authenticated
  USING (
    expires_at > now()
    AND (
      author_id = auth.uid()
      OR (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = community_stories.author_id
            AND p.is_public = true
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = author_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS community_stories_insert_own ON public.community_stories;
CREATE POLICY community_stories_insert_own
  ON public.community_stories FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS community_stories_delete_own ON public.community_stories;
CREATE POLICY community_stories_delete_own
  ON public.community_stories FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS community_story_views_select_own ON public.community_story_views;
CREATE POLICY community_story_views_select_own
  ON public.community_story_views FOR SELECT
  TO authenticated
  USING (viewer_id = auth.uid());

DROP POLICY IF EXISTS community_story_views_insert_own ON public.community_story_views;
CREATE POLICY community_story_views_insert_own
  ON public.community_story_views FOR INSERT
  TO authenticated
  WITH CHECK (
    viewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.community_stories s
      WHERE s.id = story_id
        AND s.expires_at > now()
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = s.author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = s.author_id)
        )
    )
  );

-- Extend content reports for story moderation.
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_target_type_check
  CHECK (target_type IN ('post', 'comment', 'profile', 'story'));

CREATE OR REPLACE FUNCTION public.flag_reported_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.target_type = 'post' THEN
    UPDATE public.community_posts SET is_reported = true WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'comment' THEN
    UPDATE public.community_post_comments SET is_reported = true WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'story' THEN
    UPDATE public.community_stories SET is_reported = true WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;
