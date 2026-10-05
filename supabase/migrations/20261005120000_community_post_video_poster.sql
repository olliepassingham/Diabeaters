-- Optional poster still for feed videos (storage path in community_post_images bucket).

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS video_poster_url text;

COMMENT ON COLUMN public.community_posts.video_poster_url IS
  'Optional JPEG poster path in bucket community_post_images: {user_id}/{post_id}/poster.jpg';
