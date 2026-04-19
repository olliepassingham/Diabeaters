-- Fix "Could not find the 'image_storage_path' column of 'dm_messages' in the schema cache"
-- when production never applied 20260417120000, or PostgREST cache is stale.
--
-- Intentionally minimal: no CREATE FUNCTION here (avoids parser edge-cases around
-- SELECT … INTO in some SQL runners). Image sends only need the column + CHECK + INSERT policy.
-- Optional: run `select pg_notify('pgrst', 'reload schema');` in a separate query to refresh PostgREST.

ALTER TABLE public.dm_messages ADD COLUMN IF NOT EXISTS image_storage_path text;

COMMENT ON COLUMN public.dm_messages.image_storage_path IS
  'Optional path in bucket community_post_images: {sender_id}/dm/{thread_id}/{file}';

ALTER TABLE public.dm_messages DROP CONSTRAINT IF EXISTS dm_messages_body_check;
ALTER TABLE public.dm_messages DROP CONSTRAINT IF EXISTS dm_messages_body_image_check;

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
