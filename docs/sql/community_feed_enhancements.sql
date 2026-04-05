-- Feed: post images, pagination RPC, storage bucket, report trigger.
-- Apply after docs/sql/community.sql and docs/sql/community_social_v2.sql (content_reports required).

-- ---------------------------------------------------------------------------
-- community_posts: images + optional empty body when images present
-- ---------------------------------------------------------------------------
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS is_reported boolean NOT NULL DEFAULT false;

ALTER TABLE public.community_post_comments
  ADD COLUMN IF NOT EXISTS is_reported boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.community_posts.image_urls IS 'Storage object paths in bucket community_post_images: {user_id}/{post_id}/{file}';

ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_body_check;

ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_body_and_images_check
  CHECK (
    char_length(body) <= 8000
    AND (
      (char_length(trim(body)) >= 1 AND char_length(trim(body)) <= 8000)
      OR jsonb_array_length(coalesce(image_urls, '[]'::jsonb)) >= 1
    )
  );

-- ---------------------------------------------------------------------------
-- Flag target row when a content report is filed (SECURITY DEFINER; bypasses RLS on update)
-- ---------------------------------------------------------------------------
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_reports_flag_target ON public.content_reports;
CREATE TRIGGER content_reports_flag_target
  AFTER INSERT ON public.content_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.flag_reported_content();

-- ---------------------------------------------------------------------------
-- Keyset pagination (Everyone + optional author filter for Following)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_community_posts_page(
  p_limit int,
  p_cursor_created_at timestamptz,
  p_cursor_id uuid,
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
  WHERE (p_author_ids IS NULL OR p.author_id = ANY (p_author_ids))
    AND (
      p_cursor_created_at IS NULL
      OR (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

REVOKE ALL ON FUNCTION public.fetch_community_posts_page(int, timestamptz, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_community_posts_page(int, timestamptz, uuid, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for post images (paths: {user_id}/{post_id}/{filename})
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('community_post_images', 'community_post_images', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "community_post_images: select authenticated" ON storage.objects;
CREATE POLICY "community_post_images: select authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'community_post_images');

DROP POLICY IF EXISTS "community_post_images: insert own folder" ON storage.objects;
CREATE POLICY "community_post_images: insert own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'community_post_images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "community_post_images: update own folder" ON storage.objects;
CREATE POLICY "community_post_images: update own folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'community_post_images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'community_post_images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "community_post_images: delete own folder" ON storage.objects;
CREATE POLICY "community_post_images: delete own folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'community_post_images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
