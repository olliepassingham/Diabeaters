-- Extend search_community_posts to also match author_id when caller supplies ids.
-- This enables feed search for people's names/handles (client looks up matching profiles and passes ids).

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
    AND (
      p.body ILIKE ('%' || trim(p_query) || '%')
      OR (p_author_ids IS NOT NULL AND p.author_id = ANY (p_author_ids))
    )
    AND (p_topic IS NULL OR p.topic = p_topic)
    AND (
      p_cursor_created_at IS NULL
      OR (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 20), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.search_community_posts(text, int, timestamptz, uuid, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_community_posts(text, int, timestamptz, uuid, text, uuid[]) TO authenticated;

