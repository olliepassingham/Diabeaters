-- Scale guardrails for ~200 DAU:
-- - Add hot-path indexes (idempotent; only created if tables exist).
-- - Add a lightweight retention function for notifications and (optionally) schedule it via pg_cron.

-- ---------------------------------------------------------------------------
-- Notifications inbox: fast fetch by user + recency
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    -- Existing index: notifications_user_id_idx (user_id)
    -- Add composite index for "inbox" queries: WHERE user_id = ? ORDER BY created_at DESC, id DESC
    EXECUTE 'CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_id_idx ON public.notifications (user_id, created_at DESC, id DESC)';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- DMs: fast thread timeline loads (if table exists)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.dm_messages') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS dm_messages_thread_created_at_id_idx ON public.dm_messages (thread_id, created_at DESC, id DESC)';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Community comments: fast comment timeline loads (if table exists)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.community_post_comments') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS community_post_comments_post_id_created_at_id_idx ON public.community_post_comments (post_id, created_at DESC, id DESC)';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Notifications retention
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_notifications(p_keep_days int DEFAULT 120)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count bigint := 0;
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.notifications
  WHERE created_at < (now() - make_interval(days => GREATEST(p_keep_days, 7)));

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.prune_notifications(int) IS
  'Deletes notifications older than p_keep_days (min 7). Intended for scheduled cleanup.';

-- ---------------------------------------------------------------------------
-- Optional: schedule retention via pg_cron if available
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  cron_schema_exists boolean;
  job_exists boolean;
BEGIN
  cron_schema_exists := to_regclass('cron.job') IS NOT NULL;
  IF NOT cron_schema_exists THEN
    RETURN;
  END IF;

  -- Avoid duplicates if migration is re-run.
  SELECT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'prune_notifications_daily'
  ) INTO job_exists;

  IF NOT job_exists THEN
    PERFORM cron.schedule(
      'prune_notifications_daily',
      '0 4 * * *', -- 04:00 daily
      $cron$SELECT public.prune_notifications(120);$cron$
    );
  END IF;
END;
$$;

