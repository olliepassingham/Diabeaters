-- DM: message likes (toggle via insert/delete)

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

