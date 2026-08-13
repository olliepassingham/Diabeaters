-- Link a story back to a feed post when it was shared from the feed.
ALTER TABLE public.community_stories
  ADD COLUMN IF NOT EXISTS source_post_id uuid REFERENCES public.community_posts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS community_stories_source_post_id_idx
  ON public.community_stories (source_post_id)
  WHERE source_post_id IS NOT NULL;

COMMENT ON COLUMN public.community_stories.source_post_id IS
  'Feed post this story was shared from, if any. Cleared if the post is deleted.';
