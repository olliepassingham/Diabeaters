-- Allow image attachments on poll and event posts (was forbidden by CHECK constraint).
-- App uploads to community_post_images and stores paths in image_urls for all post_kind values.

ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_body_images_kind_check;

ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_body_images_kind_check CHECK (
  char_length(body) <= 8000
  AND (
    post_kind <> 'standard'
    OR (
      char_length(trim(body)) >= 1
      OR jsonb_array_length(coalesce(image_urls, '[]'::jsonb)) >= 1
    )
  )
);

COMMENT ON CONSTRAINT community_posts_body_images_kind_check ON public.community_posts IS
  'Standard posts need non-empty body or at least one image. Poll/event may attach images; body rules are enforced in community_posts_validate_post_row.';
