-- Feed topic categories + fetch_community_posts_page(p_topic).
-- Mirror of supabase/migrations/20260409120000_community_post_topics.sql — run in Supabase SQL Editor if you apply SQL manually (or use `supabase db push` from the repo).

-- ---------------------------------------------------------------------------
-- community_posts.topic
-- ---------------------------------------------------------------------------
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT 'general-questions';

ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_topic_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_topic_check CHECK (
  topic IN (
    'holidays-travel',
    'sick-days',
    'exercise-activity',
    'food-eating-out',
    'mental-health',
    'tips-what-worked',
    'general-questions',
    'school-college-life',
    'family-supporters'
  )
);

CREATE INDEX IF NOT EXISTS community_posts_topic_created_at_id_idx
  ON public.community_posts (topic, created_at DESC, id DESC);

COMMENT ON COLUMN public.community_posts.topic IS 'Fixed feed category (see app COMMUNITY_TOPICS).';

-- ---------------------------------------------------------------------------
-- Pagination RPC: optional topic filter
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fetch_community_posts_page(int, timestamptz, uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.fetch_community_posts_page(
  p_limit int,
  p_cursor_created_at timestamptz,
  p_cursor_id uuid,
  p_author_ids uuid[] DEFAULT NULL,
  p_topic text DEFAULT NULL
)
RETURNS SETOF public.community_posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.community_posts p
  WHERE (p_author_ids IS NULL OR p.author_id = ANY (p_author_ids))
    AND (p_topic IS NULL OR p.topic = p_topic)
    AND (
      p_cursor_created_at IS NULL
      OR (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

REVOKE ALL ON FUNCTION public.fetch_community_posts_page(int, timestamptz, uuid, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_community_posts_page(int, timestamptz, uuid, uuid[], text) TO authenticated;
