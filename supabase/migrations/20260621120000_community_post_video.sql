-- Optional one video per standard feed post (storage path in community_post_images bucket).

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS video_url text;

COMMENT ON COLUMN public.community_posts.video_url IS
  'Optional storage object path in bucket community_post_images: {user_id}/{post_id}/video.{ext}';

ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_body_images_kind_check;

ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_body_images_kind_check CHECK (
  char_length(body) <= 8000
  AND (
    post_kind <> 'standard'
    OR (
      char_length(trim(body)) >= 1
      OR jsonb_array_length(coalesce(image_urls, '[]'::jsonb)) >= 1
      OR (video_url IS NOT NULL AND char_length(trim(video_url)) >= 1)
    )
  )
);

CREATE OR REPLACE FUNCTION public.community_posts_validate_post_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  n_opt int;
  i int;
  opt text;
BEGIN
  IF NEW.post_kind = 'standard' THEN
    IF NEW.post_extra IS NOT NULL THEN
      RAISE EXCEPTION 'standard posts must have null post_extra';
    END IF;
    IF NEW.video_url IS NOT NULL AND char_length(trim(NEW.video_url)) > 0
       AND jsonb_array_length(coalesce(NEW.image_urls, '[]'::jsonb)) > 0 THEN
      RAISE EXCEPTION 'post cannot have both video and images';
    END IF;
  ELSIF NEW.post_kind = 'poll' THEN
    IF NEW.post_extra IS NULL OR jsonb_typeof(NEW.post_extra) <> 'object' THEN
      RAISE EXCEPTION 'poll requires post_extra object';
    END IF;
    IF length(trim(coalesce(NEW.post_extra->>'question', ''))) < 1 THEN
      RAISE EXCEPTION 'poll requires a question';
    END IF;
    IF jsonb_typeof(NEW.post_extra->'options') <> 'array' THEN
      RAISE EXCEPTION 'poll requires options array';
    END IF;
    n_opt := jsonb_array_length(NEW.post_extra->'options');
    IF n_opt < 2 OR n_opt > 6 THEN
      RAISE EXCEPTION 'poll must have between 2 and 6 options';
    END IF;
    FOR i IN 0..n_opt - 1 LOOP
      opt := trim(NEW.post_extra->'options'->>i);
      IF opt IS NULL OR length(opt) < 1 OR length(opt) > 500 THEN
        RAISE EXCEPTION 'poll option % invalid', i;
      END IF;
    END LOOP;
    IF NEW.video_url IS NOT NULL AND char_length(trim(NEW.video_url)) > 0 THEN
      RAISE EXCEPTION 'poll posts cannot include video';
    END IF;
  ELSIF NEW.post_kind = 'event' THEN
    IF NEW.post_extra IS NULL OR jsonb_typeof(NEW.post_extra) <> 'object' THEN
      RAISE EXCEPTION 'event requires post_extra object';
    END IF;
    IF length(trim(coalesce(NEW.post_extra->>'title', ''))) < 1 THEN
      RAISE EXCEPTION 'event requires a title';
    END IF;
    IF length(trim(coalesce(NEW.post_extra->>'starts_at', ''))) < 10 THEN
      RAISE EXCEPTION 'event requires starts_at (ISO date)';
    END IF;
    IF NEW.video_url IS NOT NULL AND char_length(trim(NEW.video_url)) > 0 THEN
      RAISE EXCEPTION 'event posts cannot include video';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
