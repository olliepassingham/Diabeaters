-- Optional one image per community comment (same bucket as posts/DMs).

ALTER TABLE public.community_post_comments
  ADD COLUMN IF NOT EXISTS image_storage_path text;

COMMENT ON COLUMN public.community_post_comments.image_storage_path IS
  'Optional path in bucket community_post_images: {author_id}/comment/{post_id}/{file}';

ALTER TABLE public.community_post_comments DROP CONSTRAINT IF EXISTS community_post_comments_body_check;

ALTER TABLE public.community_post_comments DROP CONSTRAINT IF EXISTS community_post_comments_body_image_check;

ALTER TABLE public.community_post_comments
  ADD CONSTRAINT community_post_comments_body_image_check CHECK (
    char_length(body) <= 4000
    AND (
      (length(trim(body)) >= 1)
      OR (
        image_storage_path IS NOT NULL
        AND length(trim(image_storage_path)) > 0
      )
    )
  );

DROP POLICY IF EXISTS community_post_comments_insert_own ON public.community_post_comments;
CREATE POLICY community_post_comments_insert_own
  ON public.community_post_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.profile_can_engage_community_feed(auth.uid())
    AND (
      image_storage_path IS NULL
      OR image_storage_path LIKE (auth.uid()::text || '/comment/%')
    )
  );

CREATE OR REPLACE FUNCTION public.notify_feed_post_author_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author uuid;
  actor_label text;
  preview text;
  dl text;
BEGIN
  SELECT author_id INTO post_author FROM public.community_posts WHERE id = NEW.post_id;
  IF post_author IS NULL OR post_author = NEW.author_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.should_deliver_feed_inapp(post_author) THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(NULLIF(trim(full_name), ''), 'Someone') INTO actor_label
  FROM public.profiles
  WHERE id = NEW.author_id;
  IF actor_label IS NULL THEN
    actor_label := 'Someone';
  END IF;
  preview := left(trim(NEW.body), 120);
  IF length(trim(NEW.body)) > 120 THEN
    preview := preview || '…';
  END IF;
  IF preview IS NULL OR preview = '' THEN
    IF NEW.image_storage_path IS NOT NULL AND length(trim(NEW.image_storage_path)) > 0 THEN
      preview := 'sent a photo';
    ELSE
      preview := 'commented on your post';
    END IF;
  END IF;
  dl := '/community/post/' || NEW.post_id::text;
  INSERT INTO public.notifications (user_id, title, body, data, read)
  VALUES (
    post_author,
    'New comment on your post',
    actor_label || ': ' || preview,
    jsonb_build_object(
      'kind', 'feed_post_comment',
      'post_id', NEW.post_id::text,
      'actor_user_id', NEW.author_id::text,
      'comment_id', NEW.id::text,
      'deep_link', dl
    ),
    false
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_comment_author_on_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_author uuid;
  post_id uuid;
  actor_label text;
  preview text;
  has_image boolean;
  dl text;
BEGIN
  SELECT c.author_id, c.post_id, left(trim(c.body), 80),
    (c.image_storage_path IS NOT NULL AND length(trim(c.image_storage_path)) > 0)
  INTO comment_author, post_id, preview, has_image
  FROM public.community_post_comments c
  WHERE c.id = NEW.comment_id;

  IF comment_author IS NULL OR comment_author = NEW.user_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.should_deliver_feed_inapp(comment_author) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(trim(full_name), ''), 'Someone') INTO actor_label
  FROM public.profiles
  WHERE id = NEW.user_id;
  IF actor_label IS NULL THEN
    actor_label := 'Someone';
  END IF;

  IF preview IS NULL OR preview = '' THEN
    preview := CASE WHEN has_image THEN 'photo' ELSE '' END;
  ELSIF length(trim((SELECT body FROM public.community_post_comments WHERE id = NEW.comment_id))) > 80 THEN
    preview := preview || '…';
  END IF;

  dl := '/community/post/' || post_id::text;

  INSERT INTO public.notifications (user_id, title, body, data, read)
  VALUES (
    comment_author,
    'New like on your comment',
    actor_label || ' liked your comment' || CASE WHEN preview IS NOT NULL AND preview <> '' THEN ': ' || preview ELSE '' END,
    jsonb_build_object(
      'kind', 'feed_comment_like',
      'post_id', post_id::text,
      'comment_id', NEW.comment_id::text,
      'actor_user_id', NEW.user_id::text,
      'deep_link', dl
    ),
    false
  );
  RETURN NEW;
END;
$$;
