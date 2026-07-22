-- Manual apply (Supabase SQL editor) if migrations are run by hand.
-- Same as supabase/migrations/20260722180000_dm_messages_unread_edit.sql

ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

COMMENT ON COLUMN public.dm_messages.edited_at IS
  'When set, the sender edited the body while the message was still unread.';

CREATE OR REPLACE FUNCTION public.edit_unread_dm_message(p_message_id uuid, p_body text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_updated int := 0;
  v_body text := trim(COALESCE(p_body, ''));
  v_preview text;
  v_has_image boolean;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF char_length(v_body) > 8000 THEN
    RAISE EXCEPTION 'body_too_long';
  END IF;

  SELECT
    image_storage_path IS NOT NULL AND length(trim(image_storage_path)) > 0
  INTO v_has_image
  FROM public.dm_messages
  WHERE id = p_message_id
    AND sender_id = v_me
    AND read_at IS NULL
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF length(v_body) < 1 AND NOT COALESCE(v_has_image, false) THEN
    RAISE EXCEPTION 'body_empty';
  END IF;

  UPDATE public.dm_messages
  SET
    body = v_body,
    edited_at = now()
  WHERE id = p_message_id
    AND sender_id = v_me
    AND read_at IS NULL
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN false;
  END IF;

  v_preview := left(v_body, 120);
  IF length(v_body) > 120 THEN
    v_preview := v_preview || '…';
  END IF;

  UPDATE public.notifications n
  SET
    body = CASE
      WHEN v_preview = '' OR v_preview IS NULL THEN
        COALESCE(
          (
            SELECT COALESCE(NULLIF(trim(p.full_name), ''), 'Someone')
            FROM public.profiles p
            WHERE p.id = v_me
          ),
          'Someone'
        ) || ' sent a message'
      ELSE
        COALESCE(
          (
            SELECT COALESCE(NULLIF(trim(p.full_name), ''), 'Someone')
            FROM public.profiles p
            WHERE p.id = v_me
          ),
          'Someone'
        ) || ': ' || v_preview
    END
  WHERE coalesce(n.data->>'kind', '') = 'dm_message'
    AND coalesce(n.data->>'message_id', '') = p_message_id::text
    AND n.read = false;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.edit_unread_dm_message(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_unread_dm_message(uuid, text) TO authenticated;
