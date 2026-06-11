-- In-app feedback submissions (no email client required). Review from Supabase Dashboard.
-- Apply: `supabase db push` or paste into Dashboard → SQL.

CREATE TABLE IF NOT EXISTS public.feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('suggestion', 'bug')),
  message text NOT NULL CHECK (char_length(trim(message)) >= 8),
  app_version text NOT NULL,
  platform text NOT NULL,
  region text,
  page_path text,
  email text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_submissions_user_id_idx
  ON public.feedback_submissions (user_id);

CREATE INDEX IF NOT EXISTS feedback_submissions_submitted_at_idx
  ON public.feedback_submissions (submitted_at DESC);

ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_submissions_insert_own
  ON public.feedback_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY feedback_submissions_select_own
  ON public.feedback_submissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Dashboard user deletion: explicit cleanup before auth.users row removal (RLS-safe).
CREATE OR REPLACE FUNCTION public.auth_delete_user_public_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := OLD.id;
BEGIN
  IF to_regclass('public.community_post_comments') IS NOT NULL THEN
    DELETE FROM public.community_post_comments WHERE author_id = uid;
  END IF;
  IF to_regclass('public.community_post_reactions') IS NOT NULL THEN
    DELETE FROM public.community_post_reactions WHERE user_id = uid;
  END IF;
  IF to_regclass('public.community_posts') IS NOT NULL THEN
    DELETE FROM public.community_posts WHERE author_id = uid;
  END IF;

  IF to_regclass('public.dm_messages') IS NOT NULL THEN
    DELETE FROM public.dm_messages WHERE sender_id = uid;
  END IF;
  IF to_regclass('public.dm_thread_members') IS NOT NULL THEN
    DELETE FROM public.dm_thread_members WHERE user_id = uid;
  END IF;

  IF to_regclass('public.user_follows') IS NOT NULL THEN
    DELETE FROM public.user_follows WHERE follower_id = uid OR followee_id = uid;
  END IF;
  IF to_regclass('public.user_blocks') IS NOT NULL THEN
    DELETE FROM public.user_blocks WHERE blocker_id = uid OR blocked_id = uid;
  END IF;
  IF to_regclass('public.content_reports') IS NOT NULL THEN
    DELETE FROM public.content_reports WHERE reporter_id = uid;
  END IF;

  IF to_regclass('public.carers') IS NOT NULL THEN
    DELETE FROM public.carers WHERE user_id = uid;
  END IF;
  IF to_regclass('public.hypo_logs') IS NOT NULL THEN
    DELETE FROM public.hypo_logs WHERE user_id = uid;
  END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM public.notifications WHERE user_id = uid;
  END IF;
  IF to_regclass('public.push_tokens') IS NOT NULL THEN
    DELETE FROM public.push_tokens WHERE user_id = uid;
  END IF;
  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    DELETE FROM public.notification_preferences WHERE user_id = uid;
  END IF;

  IF to_regclass('public.carer_invites') IS NOT NULL THEN
    DELETE FROM public.carer_invites WHERE patient_id = uid;
  END IF;
  IF to_regclass('public.carer_links') IS NOT NULL THEN
    DELETE FROM public.carer_links WHERE patient_id = uid OR carer_id = uid;
  END IF;
  IF to_regclass('public.account_deletion_requests') IS NOT NULL THEN
    DELETE FROM public.account_deletion_requests WHERE user_id = uid;
  END IF;
  IF to_regclass('public.feedback_submissions') IS NOT NULL THEN
    DELETE FROM public.feedback_submissions WHERE user_id = uid;
  END IF;

  IF to_regclass('public.supply_events') IS NOT NULL THEN
    DELETE FROM public.supply_events WHERE user_id = uid;
  END IF;
  IF to_regclass('public.supplies') IS NOT NULL THEN
    DELETE FROM public.supplies WHERE user_id = uid;
  END IF;
  IF to_regclass('public.appointments') IS NOT NULL THEN
    DELETE FROM public.appointments WHERE user_id = uid;
  END IF;
  IF to_regclass('public.scenarios') IS NOT NULL THEN
    DELETE FROM public.scenarios WHERE user_id = uid;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = uid;
  END IF;

  RETURN OLD;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.feedback_submissions') IS NOT NULL THEN
    EXECUTE 'GRANT DELETE ON public.feedback_submissions TO supabase_auth_admin';
    EXECUTE 'DROP POLICY IF EXISTS feedback_submissions_delete_supabase_auth_admin ON public.feedback_submissions';
    EXECUTE $p$
      CREATE POLICY feedback_submissions_delete_supabase_auth_admin
        ON public.feedback_submissions
        AS PERMISSIVE
        FOR DELETE
        TO supabase_auth_admin
        USING (true)
    $p$;
  END IF;
END $$;
