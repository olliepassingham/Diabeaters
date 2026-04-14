-- DM: optional image (storage path in community_post_images bucket) + message likes (double-tap in app).

-- ---------------------------------------------------------------------------
-- dm_messages: image column + relaxed body when image present
-- ---------------------------------------------------------------------------
ALTER TABLE public.dm_messages ADD COLUMN IF NOT EXISTS image_storage_path text;

ALTER TABLE public.dm_messages DROP CONSTRAINT IF EXISTS dm_messages_body_check;

ALTER TABLE public.dm_messages
  ADD CONSTRAINT dm_messages_body_image_check CHECK (
    char_length(body) <= 8000
    AND (
      (length(trim(body)) >= 1)
      OR (
        image_storage_path IS NOT NULL
        AND length(trim(image_storage_path)) > 0
      )
    )
  );

COMMENT ON COLUMN public.dm_messages.image_storage_path IS
  'Optional path in bucket community_post_images: {sender_id}/dm/{thread_id}/{file}';

-- Tighten insert: path must live under the sender''s folder (matches storage RLS).
DROP POLICY IF EXISTS dm_messages_insert_member ON public.dm_messages;
CREATE POLICY dm_messages_insert_member
  ON public.dm_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.dm_thread_has_member(thread_id, auth.uid())
    AND (
      image_storage_path IS NULL
      OR image_storage_path LIKE (auth.uid()::text || '/dm/%')
    )
  );

-- ---------------------------------------------------------------------------
-- Likes (toggle: insert/delete row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dm_message_likes (
  message_id uuid NOT NULL REFERENCES public.dm_messages (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS dm_message_likes_message_id_idx ON public.dm_message_likes (message_id);

ALTER TABLE public.dm_message_likes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.dm_message_likes TO authenticated;

DROP POLICY IF EXISTS dm_message_likes_select ON public.dm_message_likes;
CREATE POLICY dm_message_likes_select
  ON public.dm_message_likes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_messages m
      WHERE m.id = message_id
        AND public.dm_thread_has_member(m.thread_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS dm_message_likes_insert ON public.dm_message_likes;
CREATE POLICY dm_message_likes_insert
  ON public.dm_message_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.dm_messages m
      WHERE m.id = message_id
        AND m.sender_id IS DISTINCT FROM auth.uid()
        AND public.dm_thread_has_member(m.thread_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS dm_message_likes_delete_own ON public.dm_message_likes;
CREATE POLICY dm_message_likes_delete_own
  ON public.dm_message_likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- In-app notification preview: photo vs text
-- ---------------------------------------------------------------------------
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
  has_image boolean;
BEGIN
  IF NEW.sender_id IS NULL OR NEW.thread_id IS NULL THEN
    RETURN NEW;
  END IF;

  has_image := NEW.image_storage_path IS NOT NULL AND length(trim(COALESCE(NEW.image_storage_path, ''))) > 0;

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
    IF has_image THEN
      body_line := actor_label || ' sent a photo';
    ELSE
      body_line := actor_label || ' sent a message';
    END IF;
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
