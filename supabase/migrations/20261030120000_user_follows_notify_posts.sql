-- Opt-in “notify me when they post” per follow edge.
-- Defaults off so follows stay quiet unless the follower turns notifications on.

ALTER TABLE public.user_follows
  ADD COLUMN IF NOT EXISTS notify_posts boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_follows.notify_posts IS
  'When true, follower receives in-app (and push when enabled) alerts when followee creates a community post.';

CREATE INDEX IF NOT EXISTS user_follows_notify_posts_followee_idx
  ON public.user_follows (followee_id)
  WHERE notify_posts IS TRUE;

GRANT UPDATE ON public.user_follows TO authenticated;

DROP POLICY IF EXISTS user_follows_update_self ON public.user_follows;
CREATE POLICY user_follows_update_self
  ON public.user_follows
  FOR UPDATE
  TO authenticated
  USING (follower_id = auth.uid())
  WITH CHECK (follower_id = auth.uid());

-- Only notify_posts may change on UPDATE (keep follow endpoints immutable).
CREATE OR REPLACE FUNCTION public.user_follows_guard_notify_posts_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.follower_id IS DISTINCT FROM OLD.follower_id
     OR NEW.followee_id IS DISTINCT FROM OLD.followee_id THEN
    RAISE EXCEPTION 'user_follows: cannot change follower_id or followee_id';
  END IF;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_follows_guard_notify_posts_update ON public.user_follows;
CREATE TRIGGER user_follows_guard_notify_posts_update
  BEFORE UPDATE ON public.user_follows
  FOR EACH ROW
  EXECUTE FUNCTION public.user_follows_guard_notify_posts_update();

-- Fan-out in-app notifications to opted-in followers on new posts.
-- Skips blocked pairs and anyone already mentioned on the same post (they get a mention alert).
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
    (NEW.image_urls IS NOT NULL AND coalesce(array_length(NEW.image_urls, 1), 0) > 0)
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

DROP TRIGGER IF EXISTS community_posts_notify_followers ON public.community_posts;
CREATE TRIGGER community_posts_notify_followers
  AFTER INSERT ON public.community_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followers_on_new_community_post();

COMMENT ON FUNCTION public.notify_followers_on_new_community_post IS
  'Inserts in-app notifications for followers with user_follows.notify_posts when a community post is created.';
