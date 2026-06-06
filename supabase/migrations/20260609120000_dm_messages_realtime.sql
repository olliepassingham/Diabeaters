-- Enable Realtime on dm_messages for live thread updates (new messages, read receipts).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'dm_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
  END IF;
END $$;

COMMENT ON TABLE public.dm_messages IS
  'Direct message rows. Realtime enabled for thread INSERT/UPDATE (live chat + read receipts).';
