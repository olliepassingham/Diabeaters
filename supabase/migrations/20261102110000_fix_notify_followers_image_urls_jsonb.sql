-- Fix: image_urls is jsonb, so array_length(jsonb, int) fails on every post insert
-- with "function array_length(jsonb, integer) does not exist".

CREATE OR REPLACE FUNCTION public.notify_followers_on_new_community_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_label text;
  dl text;
  preview text;
  body_trim text;
  has_media boolean;
  r record;
  notif_body text;
BEGIN
  IF NEW.author_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(trim(full_name), ''), 'Someone') INTO actor_label
  FROM public.profiles
  WHERE id = NEW.author_id;
  IF actor_label IS NULL THEN
    actor_label := 'Someone';
  END IF;

  dl := '/community/post/' || NEW.id::text;
  body_trim := trim(COALESCE(NEW.body, ''));
  preview := left(body_trim, 120);
  IF length(body_trim) > 120 THEN
    preview := preview || '…';
  END IF;
  has_media :=
    jsonb_array_length(coalesce(NEW.image_urls, '[]'::jsonb)) > 0
    OR (NEW.video_url IS NOT NULL AND length(trim(NEW.video_url)) > 0);

  IF preview <> '' THEN
    notif_body := actor_label || ': ' || preview;
  ELSIF has_media THEN
    notif_body := actor_label || ' shared a new post.';
  ELSE
    notif_body := actor_label || ' posted.';
  END IF;

  FOR r IN
    SELECT uf.follower_id
    FROM public.user_follows uf
    WHERE uf.followee_id = NEW.author_id
      AND uf.notify_posts IS TRUE
      AND uf.follower_id IS DISTINCT FROM NEW.author_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_blocks b
        WHERE (b.blocker_id = uf.follower_id AND b.blocked_id = NEW.author_id)
           OR (b.blocked_id = uf.follower_id AND b.blocker_id = NEW.author_id)
      )
      AND (
        NEW.mentioned_user_ids IS NULL
        OR NOT (uf.follower_id = ANY (NEW.mentioned_user_ids))
      )
  LOOP
    IF NOT public.should_deliver_feed_inapp(r.follower_id) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.notifications (user_id, title, body, data, read)
    VALUES (
      r.follower_id,
      'New post',
      notif_body,
      jsonb_build_object(
        'kind', 'feed_followed_post',
        'post_id', NEW.id::text,
        'actor_user_id', NEW.author_id::text,
        'deep_link', dl
      ),
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;
