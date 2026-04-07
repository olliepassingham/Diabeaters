-- Reliable fix when Dashboard "Delete user" still fails after FK CASCADE + RLS policies:
-- CASCADE deletes run as supabase_auth_admin and hit RLS; policies are easy to miss per table.
--
-- This runs BEFORE DELETE ON auth.users as SECURITY DEFINER (postgres), which bypasses RLS
-- and deletes dependent public rows in a safe order. After this, deleting the auth user
-- no longer needs to CASCADE into RLS-protected tables (rows are already gone).
--
-- Safe to re-run: replaces function + trigger.

CREATE OR REPLACE FUNCTION public.auth_delete_user_public_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := OLD.id;
BEGIN
  -- Community: comments/reactions by user on any post; then reactions to others' posts; then own posts (cascades to children)
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

ALTER FUNCTION public.auth_delete_user_public_data() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.auth_delete_user_public_data() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_delete_public_data ON auth.users;
CREATE TRIGGER on_auth_user_delete_public_data
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auth_delete_user_public_data();

COMMENT ON FUNCTION public.auth_delete_user_public_data() IS
  'Deletes public.* rows for a user before auth.users row removal so RLS does not block Dashboard user deletion.';
