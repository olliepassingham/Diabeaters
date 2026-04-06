-- In-app notifications when someone likes or comments on your community post.
-- Inserts into public.notifications (recipient = post author). Respects notification_preferences:
-- enabled, inapp, feed_alerts (defaults true when missing).

CREATE OR REPLACE FUNCTION public.should_deliver_feed_inapp(p_recipient uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pr jsonb;
BEGIN
  SELECT prefs INTO pr FROM public.notification_preferences WHERE user_id = p_recipient;
  IF pr IS NULL THEN
    RETURN true;
  END IF;
  IF COALESCE((pr->>'enabled')::boolean, true) IS FALSE THEN
    RETURN false;
  END IF;
  IF COALESCE((pr->>'inapp')::boolean, true) IS FALSE THEN
    RETURN false;
  END IF;
  IF COALESCE((pr->>'feed_alerts')::boolean, true) IS FALSE THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_feed_post_author_on_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author uuid;
  actor_label text;
  dl text;
BEGIN
  SELECT author_id INTO post_author FROM public.community_posts WHERE id = NEW.post_id;
  IF post_author IS NULL OR post_author = NEW.user_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.should_deliver_feed_inapp(post_author) THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(NULLIF(trim(full_name), ''), 'Someone') INTO actor_label
  FROM public.profiles
  WHERE id = NEW.user_id;
  IF actor_label IS NULL THEN
    actor_label := 'Someone';
  END IF;
  dl := '/community/post/' || NEW.post_id::text;
  INSERT INTO public.notifications (user_id, title, body, data, read)
  VALUES (
    post_author,
    'New like on your post',
    actor_label || ' liked your post.',
    jsonb_build_object(
      'kind', 'feed_post_like',
      'post_id', NEW.post_id::text,
      'actor_user_id', NEW.user_id::text,
      'deep_link', dl
    ),
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_post_reactions_notify_author ON public.community_post_reactions;
CREATE TRIGGER community_post_reactions_notify_author
  AFTER INSERT ON public.community_post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_feed_post_author_on_reaction();

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

DROP TRIGGER IF EXISTS community_post_comments_notify_author ON public.community_post_comments;
CREATE TRIGGER community_post_comments_notify_author
  AFTER INSERT ON public.community_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_feed_post_author_on_comment();
