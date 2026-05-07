-- Server-side feed search (trigram), bookmarks (community_post_saves), realtime for new-posts pill.

-- ---------------------------------------------------------------------------
-- Trigram search
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS community_posts_body_trgm_idx
  ON public.community_posts USING gin (body gin_trgm_ops);

-- Search posts visible under existing SELECT RLS (SECURITY INVOKER).
CREATE OR REPLACE FUNCTION public.search_community_posts(
  p_query text,
  p_limit int,
  p_cursor_created_at timestamptz,
  p_cursor_id uuid,
  p_topic text DEFAULT NULL,
  p_author_ids uuid[] DEFAULT NULL
)
RETURNS SETOF public.community_posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.community_posts p
  WHERE trim(coalesce(p_query, '')) <> ''
    AND p.body ILIKE ('%' || trim(p_query) || '%')
    AND (p_topic IS NULL OR p.topic = p_topic)
    AND (p_author_ids IS NULL OR p.author_id = ANY (p_author_ids))
    AND (
      p_cursor_created_at IS NULL
      OR (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 20), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.search_community_posts(text, int, timestamptz, uuid, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_community_posts(text, int, timestamptz, uuid, text, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Saved / bookmarked posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_post_saves (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.community_posts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS community_post_saves_post_id_idx
  ON public.community_post_saves (post_id);

ALTER TABLE public.community_post_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_post_saves_select_own ON public.community_post_saves;
CREATE POLICY community_post_saves_select_own
  ON public.community_post_saves
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS community_post_saves_insert_own ON public.community_post_saves;
CREATE POLICY community_post_saves_insert_own
  ON public.community_post_saves
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS community_post_saves_delete_own ON public.community_post_saves;
CREATE POLICY community_post_saves_delete_own
  ON public.community_post_saves
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.community_post_saves TO authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: new posts pill (client subscribes to INSERT)
-- ---------------------------------------------------------------------------
DO $body$
BEGIN
  IF to_regclass('public.community_posts') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'community_posts'
  ) THEN
    RETURN;
  END IF;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
END;
$body$;
