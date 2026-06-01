-- @mentions in community_post_comments (parity with community_posts).

ALTER TABLE public.community_post_comments
  ADD COLUMN IF NOT EXISTS mention_map jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.community_post_comments
  ADD COLUMN IF NOT EXISTS mentioned_user_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

COMMENT ON COLUMN public.community_post_comments.mention_map IS 'Lowercase @handle -> author uuid for rendering mentions in comment body.';
COMMENT ON COLUMN public.community_post_comments.mentioned_user_ids IS 'Tagged users (excluding comment author); drives mention notifications.';

CREATE OR REPLACE FUNCTION public.notify_community_comment_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_uid uuid;
  actor_label text;
  dl text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF NEW.mentioned_user_ids IS NULL OR array_length(NEW.mentioned_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  dl := '/community/post/' || NEW.post_id::text;
  SELECT COALESCE(NULLIF(trim(full_name), ''), 'Someone') INTO actor_label
  FROM public.profiles
  WHERE id = NEW.author_id;
  IF actor_label IS NULL THEN
    actor_label := 'Someone';
  END IF;
  FOREACH mention_uid IN ARRAY NEW.mentioned_user_ids
  LOOP
    IF mention_uid IS NULL OR mention_uid = NEW.author_id THEN
      CONTINUE;
    END IF;
    IF NOT public.should_deliver_feed_inapp(mention_uid) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.notifications (user_id, title, body, data, read)
    VALUES (
      mention_uid,
      'You were mentioned in a comment',
      actor_label || ' tagged you in a comment.',
      jsonb_build_object(
        'kind', 'feed_comment_mention',
        'post_id', NEW.post_id::text,
        'comment_id', NEW.id::text,
        'actor_user_id', NEW.author_id::text,
        'deep_link', dl
      ),
      false
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_post_comments_notify_mentions ON public.community_post_comments;
CREATE TRIGGER community_post_comments_notify_mentions
  AFTER INSERT ON public.community_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_community_comment_mentions();
