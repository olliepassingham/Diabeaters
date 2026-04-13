-- In-app inbox: allow users to insert their own rows (appointment reminders from the app).
-- Also notify followees when someone new follows them (same preference gate as feed social alerts).

GRANT INSERT ON public.notifications TO authenticated;

DROP POLICY IF EXISTS notifications_insert_own ON public.notifications;
CREATE POLICY notifications_insert_own
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Requires public.should_deliver_feed_inapp (community_feed_notifications migration).
CREATE OR REPLACE FUNCTION public.notify_followee_on_new_follower()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_label text;
  dl text;
BEGIN
  IF NEW.followee_id IS NULL OR NEW.follower_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.followee_id = NEW.follower_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.should_deliver_feed_inapp(NEW.followee_id) THEN
    RETURN NEW;
  END IF;
  dl := '/community/profile/' || NEW.follower_id::text;
  SELECT COALESCE(NULLIF(trim(full_name), ''), 'Someone') INTO actor_label
  FROM public.profiles
  WHERE id = NEW.follower_id;
  IF actor_label IS NULL THEN
    actor_label := 'Someone';
  END IF;
  INSERT INTO public.notifications (user_id, title, body, data, read)
  VALUES (
    NEW.followee_id,
    'New follower',
    actor_label || ' started following you.',
    jsonb_build_object(
      'kind', 'new_follower',
      'follower_user_id', NEW.follower_id::text,
      'deep_link', dl
    ),
    false
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.user_follows') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS user_follows_notify_followee ON public.user_follows';
    EXECUTE 'CREATE TRIGGER user_follows_notify_followee AFTER INSERT ON public.user_follows FOR EACH ROW EXECUTE FUNCTION public.notify_followee_on_new_follower()';
  END IF;
END $$;

COMMENT ON FUNCTION public.notify_followee_on_new_follower IS 'Inserts an in-app notification for the followee when a new user_follows row is created.';
