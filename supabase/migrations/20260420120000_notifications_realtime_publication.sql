-- Expose INSERT events on public.notifications for client postgres_changes (in-app toast + bell refresh).
DO $body$
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    RETURN;
  END IF;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
END;
$body$;
