-- In-app inbox row for DM recipients when a message is inserted (respects notification_preferences.dm_alerts).

CREATE OR REPLACE FUNCTION public.should_deliver_dm_inapp(p_recipient uuid)
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
  IF COALESCE((pr->>'dm_alerts')::boolean, true) IS FALSE THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_dm_thread_members_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  actor_label text;
  preview text;
  body_line text;
  dl text;
  raw_body text;
BEGIN
  IF NEW.sender_id IS NULL OR NEW.thread_id IS NULL THEN
    RETURN NEW;
  END IF;

  raw_body := COALESCE(trim(NEW.body), '');
  preview := left(raw_body, 120);
  IF length(raw_body) > 120 THEN
    preview := preview || '…';
  END IF;

  dl := '/community/messages/' || NEW.thread_id::text;

  SELECT COALESCE(NULLIF(trim(full_name), ''), 'Someone') INTO actor_label
  FROM public.profiles
  WHERE id = NEW.sender_id;
  IF actor_label IS NULL THEN
    actor_label := 'Someone';
  END IF;

  IF preview = '' OR preview IS NULL THEN
    body_line := actor_label || ' sent a message';
  ELSE
    body_line := actor_label || ': ' || preview;
  END IF;

  FOR recipient_id IN
    SELECT m.user_id
    FROM public.dm_thread_members m
    WHERE m.thread_id = NEW.thread_id
      AND m.user_id IS DISTINCT FROM NEW.sender_id
  LOOP
    IF NOT public.should_deliver_dm_inapp(recipient_id) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.notifications (user_id, title, body, data, read)
    VALUES (
      recipient_id,
      'New message',
      body_line,
      jsonb_build_object(
        'kind', 'dm_message',
        'thread_id', NEW.thread_id::text,
        'message_id', NEW.id::text,
        'sender_user_id', NEW.sender_id::text,
        'deep_link', dl
      ),
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.dm_messages') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS dm_messages_notify_recipients ON public.dm_messages';
    EXECUTE 'CREATE TRIGGER dm_messages_notify_recipients AFTER INSERT ON public.dm_messages FOR EACH ROW EXECUTE FUNCTION public.notify_dm_thread_members_on_message()';
  END IF;
END $$;

COMMENT ON FUNCTION public.should_deliver_dm_inapp IS 'Whether to insert an in-app notification for DM alerts (prefs.dm_alerts, default true).';
COMMENT ON FUNCTION public.notify_dm_thread_members_on_message IS 'Notifies other thread members when a dm_messages row is inserted.';
