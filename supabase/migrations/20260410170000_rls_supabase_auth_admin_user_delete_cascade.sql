-- Fix Postgres logs: "permission denied for table community_posts" when deleting a user from
-- Dashboard → Authentication. The delete runs as role supabase_auth_admin; RLS policies that
-- only target "authenticated" (auth.uid() = …) do not apply, so CASCADE deletes are blocked.
--
-- This adds permissive DELETE (+ UPDATE on community_posts where count triggers need it) for
-- supabase_auth_admin only. Does not change client-facing policies for authenticated users.
--
-- Ref: https://supabase.com/docs/guides/auth/managing-user-data

-- ---------------------------------------------------------------------------
-- Grants (RLS still applies; policies below allow the operation)
-- ---------------------------------------------------------------------------
GRANT DELETE, UPDATE ON public.community_posts TO supabase_auth_admin;
GRANT DELETE ON public.community_post_comments TO supabase_auth_admin;
GRANT DELETE ON public.community_post_reactions TO supabase_auth_admin;
GRANT DELETE, UPDATE ON public.dm_messages TO supabase_auth_admin;
GRANT DELETE ON public.dm_thread_members TO supabase_auth_admin;
GRANT DELETE ON public.dm_threads TO supabase_auth_admin;

DROP POLICY IF EXISTS community_posts_delete_supabase_auth_admin ON public.community_posts;
CREATE POLICY community_posts_delete_supabase_auth_admin
  ON public.community_posts
  AS PERMISSIVE
  FOR DELETE
  TO supabase_auth_admin
  USING (true);

DROP POLICY IF EXISTS community_posts_update_supabase_auth_admin ON public.community_posts;
CREATE POLICY community_posts_update_supabase_auth_admin
  ON public.community_posts
  AS PERMISSIVE
  FOR UPDATE
  TO supabase_auth_admin
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS community_post_comments_delete_supabase_auth_admin ON public.community_post_comments;
CREATE POLICY community_post_comments_delete_supabase_auth_admin
  ON public.community_post_comments
  AS PERMISSIVE
  FOR DELETE
  TO supabase_auth_admin
  USING (true);

DROP POLICY IF EXISTS community_post_reactions_delete_supabase_auth_admin ON public.community_post_reactions;
CREATE POLICY community_post_reactions_delete_supabase_auth_admin
  ON public.community_post_reactions
  AS PERMISSIVE
  FOR DELETE
  TO supabase_auth_admin
  USING (true);

DROP POLICY IF EXISTS dm_messages_delete_supabase_auth_admin ON public.dm_messages;
CREATE POLICY dm_messages_delete_supabase_auth_admin
  ON public.dm_messages
  AS PERMISSIVE
  FOR DELETE
  TO supabase_auth_admin
  USING (true);

DROP POLICY IF EXISTS dm_thread_members_delete_supabase_auth_admin ON public.dm_thread_members;
CREATE POLICY dm_thread_members_delete_supabase_auth_admin
  ON public.dm_thread_members
  AS PERMISSIVE
  FOR DELETE
  TO supabase_auth_admin
  USING (true);

DROP POLICY IF EXISTS dm_threads_delete_supabase_auth_admin ON public.dm_threads;
CREATE POLICY dm_threads_delete_supabase_auth_admin
  ON public.dm_threads
  AS PERMISSIVE
  FOR DELETE
  TO supabase_auth_admin
  USING (true);

-- Optional social / notifications (only if these tables exist — migration may be applied on smaller DBs)
DO $$
BEGIN
  IF to_regclass('public.user_follows') IS NOT NULL THEN
    EXECUTE 'GRANT DELETE ON public.user_follows TO supabase_auth_admin';
    EXECUTE 'DROP POLICY IF EXISTS user_follows_delete_supabase_auth_admin ON public.user_follows';
    EXECUTE $p$
      CREATE POLICY user_follows_delete_supabase_auth_admin
        ON public.user_follows
        AS PERMISSIVE
        FOR DELETE
        TO supabase_auth_admin
        USING (true)
    $p$;
  END IF;

  IF to_regclass('public.user_blocks') IS NOT NULL THEN
    EXECUTE 'GRANT DELETE ON public.user_blocks TO supabase_auth_admin';
    EXECUTE 'DROP POLICY IF EXISTS user_blocks_delete_supabase_auth_admin ON public.user_blocks';
    EXECUTE $p$
      CREATE POLICY user_blocks_delete_supabase_auth_admin
        ON public.user_blocks
        AS PERMISSIVE
        FOR DELETE
        TO supabase_auth_admin
        USING (true)
    $p$;
  END IF;

  IF to_regclass('public.content_reports') IS NOT NULL THEN
    EXECUTE 'GRANT DELETE ON public.content_reports TO supabase_auth_admin';
    EXECUTE 'DROP POLICY IF EXISTS content_reports_delete_supabase_auth_admin ON public.content_reports';
    EXECUTE $p$
      CREATE POLICY content_reports_delete_supabase_auth_admin
        ON public.content_reports
        AS PERMISSIVE
        FOR DELETE
        TO supabase_auth_admin
        USING (true)
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND c.relrowsecurity
  ) THEN
    EXECUTE 'GRANT DELETE ON public.profiles TO supabase_auth_admin';
    EXECUTE 'DROP POLICY IF EXISTS profiles_delete_supabase_auth_admin ON public.profiles';
    EXECUTE $p$
      CREATE POLICY profiles_delete_supabase_auth_admin
        ON public.profiles
        AS PERMISSIVE
        FOR DELETE
        TO supabase_auth_admin
        USING (true)
    $p$;
  ELSIF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'GRANT DELETE ON public.profiles TO supabase_auth_admin';
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'GRANT DELETE ON public.notifications TO supabase_auth_admin';
    EXECUTE 'DROP POLICY IF EXISTS notifications_delete_supabase_auth_admin ON public.notifications';
    EXECUTE $p$
      CREATE POLICY notifications_delete_supabase_auth_admin
        ON public.notifications
        AS PERMISSIVE
        FOR DELETE
        TO supabase_auth_admin
        USING (true)
    $p$;
  END IF;

  IF to_regclass('public.push_tokens') IS NOT NULL THEN
    EXECUTE 'GRANT DELETE ON public.push_tokens TO supabase_auth_admin';
    EXECUTE 'DROP POLICY IF EXISTS push_tokens_delete_supabase_auth_admin ON public.push_tokens';
    EXECUTE $p$
      CREATE POLICY push_tokens_delete_supabase_auth_admin
        ON public.push_tokens
        AS PERMISSIVE
        FOR DELETE
        TO supabase_auth_admin
        USING (true)
    $p$;
  END IF;

  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    EXECUTE 'GRANT DELETE ON public.notification_preferences TO supabase_auth_admin';
    EXECUTE 'DROP POLICY IF EXISTS notification_preferences_delete_supabase_auth_admin ON public.notification_preferences';
    EXECUTE $p$
      CREATE POLICY notification_preferences_delete_supabase_auth_admin
        ON public.notification_preferences
        AS PERMISSIVE
        FOR DELETE
        TO supabase_auth_admin
        USING (true)
    $p$;
  END IF;

  IF to_regclass('public.carer_links') IS NOT NULL THEN
    EXECUTE 'GRANT DELETE ON public.carer_links TO supabase_auth_admin';
    EXECUTE 'DROP POLICY IF EXISTS carer_links_delete_supabase_auth_admin ON public.carer_links';
    EXECUTE $p$
      CREATE POLICY carer_links_delete_supabase_auth_admin
        ON public.carer_links
        AS PERMISSIVE
        FOR DELETE
        TO supabase_auth_admin
        USING (true)
    $p$;
  END IF;

  IF to_regclass('public.carer_invites') IS NOT NULL THEN
    EXECUTE 'GRANT DELETE ON public.carer_invites TO supabase_auth_admin';
    EXECUTE 'DROP POLICY IF EXISTS carer_invites_delete_supabase_auth_admin ON public.carer_invites';
    EXECUTE $p$
      CREATE POLICY carer_invites_delete_supabase_auth_admin
        ON public.carer_invites
        AS PERMISSIVE
        FOR DELETE
        TO supabase_auth_admin
        USING (true)
    $p$;
  END IF;

  IF to_regclass('public.hypo_logs') IS NOT NULL THEN
    EXECUTE 'GRANT DELETE ON public.hypo_logs TO supabase_auth_admin';
    EXECUTE 'DROP POLICY IF EXISTS hypo_logs_delete_supabase_auth_admin ON public.hypo_logs';
    EXECUTE $p$
      CREATE POLICY hypo_logs_delete_supabase_auth_admin
        ON public.hypo_logs
        AS PERMISSIVE
        FOR DELETE
        TO supabase_auth_admin
        USING (true)
    $p$;
  END IF;

  IF to_regclass('public.account_deletion_requests') IS NOT NULL THEN
    EXECUTE 'GRANT DELETE ON public.account_deletion_requests TO supabase_auth_admin';
    EXECUTE 'DROP POLICY IF EXISTS account_deletion_requests_delete_supabase_auth_admin ON public.account_deletion_requests';
    EXECUTE $p$
      CREATE POLICY account_deletion_requests_delete_supabase_auth_admin
        ON public.account_deletion_requests
        AS PERMISSIVE
        FOR DELETE
        TO supabase_auth_admin
        USING (true)
    $p$;
  END IF;
END $$;
