-- Feed comment likes: reactions table, denormalized like_count, in-app notifications.

ALTER TABLE public.community_post_comments
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.community_post_comments.like_count IS
  'Maintained by trigger on community_comment_reactions.';

CREATE TABLE IF NOT EXISTS public.community_comment_reactions (
  comment_id uuid NOT NULL REFERENCES public.community_post_comments (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_comment_reactions_comment_id_idx
  ON public.community_comment_reactions (comment_id);

CREATE INDEX IF NOT EXISTS community_comment_reactions_user_id_idx
  ON public.community_comment_reactions (user_id);

ALTER TABLE public.community_comment_reactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.community_comment_reactions TO authenticated;

CREATE OR REPLACE FUNCTION public.bump_community_comment_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_post_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_post_comments SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS community_comment_reactions_bump_count ON public.community_comment_reactions;
CREATE TRIGGER community_comment_reactions_bump_count
  AFTER INSERT OR DELETE ON public.community_comment_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_community_comment_like_count();

UPDATE public.community_post_comments c
SET like_count = COALESCE(
  (SELECT count(*)::int FROM public.community_comment_reactions r WHERE r.comment_id = c.id),
  0
);

DROP POLICY IF EXISTS community_comment_reactions_select_not_blocked ON public.community_comment_reactions;
CREATE POLICY community_comment_reactions_select_not_blocked
  ON public.community_comment_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.community_post_comments c
      JOIN public.community_posts p ON p.id = c.post_id
      WHERE c.id = community_comment_reactions.comment_id
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = p.author_id)
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = c.author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = c.author_id)
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = community_comment_reactions.user_id)
         OR (b.blocked_id = auth.uid() AND b.blocker_id = community_comment_reactions.user_id)
    )
  );

DROP POLICY IF EXISTS community_comment_reactions_insert_own ON public.community_comment_reactions;
CREATE POLICY community_comment_reactions_insert_own
  ON public.community_comment_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.profile_can_engage_community_feed(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.community_post_comments c
      JOIN public.community_posts p ON p.id = c.post_id
      WHERE c.id = comment_id
        AND c.author_id IS DISTINCT FROM auth.uid()
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = p.author_id)
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = c.author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = c.author_id)
        )
    )
  );

DROP POLICY IF EXISTS community_comment_reactions_delete_own ON public.community_comment_reactions;
CREATE POLICY community_comment_reactions_delete_own
  ON public.community_comment_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_comment_author_on_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_author uuid;
  post_id uuid;
  actor_label text;
  preview text;
  dl text;
BEGIN
  SELECT c.author_id, c.post_id, left(trim(c.body), 80)
  INTO comment_author, post_id, preview
  FROM public.community_post_comments c
  WHERE c.id = NEW.comment_id;

  IF comment_author IS NULL OR comment_author = NEW.user_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.should_deliver_feed_inapp(comment_author) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(trim(full_name), ''), 'Someone') INTO actor_label
  FROM public.profiles
  WHERE id = NEW.user_id;
  IF actor_label IS NULL THEN
    actor_label := 'Someone';
  END IF;

  IF length(preview) > 0 AND length(trim((SELECT body FROM public.community_post_comments WHERE id = NEW.comment_id))) > 80 THEN
    preview := preview || '…';
  END IF;

  dl := '/community/post/' || post_id::text;

  INSERT INTO public.notifications (user_id, title, body, data, read)
  VALUES (
    comment_author,
    'New like on your comment',
    actor_label || ' liked your comment' || CASE WHEN preview IS NOT NULL AND preview <> '' THEN ': ' || preview ELSE '' END,
    jsonb_build_object(
      'kind', 'feed_comment_like',
      'post_id', post_id::text,
      'comment_id', NEW.comment_id::text,
      'actor_user_id', NEW.user_id::text,
      'deep_link', dl
    ),
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_comment_reactions_notify_author ON public.community_comment_reactions;
CREATE TRIGGER community_comment_reactions_notify_author
  AFTER INSERT ON public.community_comment_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment_author_on_reaction();

-- User delete: remove comment reactions by user (before auth user row is deleted).
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
  IF to_regclass('public.community_comment_reactions') IS NOT NULL THEN
    DELETE FROM public.community_comment_reactions WHERE user_id = uid;
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
  IF to_regclass('public.hypo_log_acknowledgements') IS NOT NULL THEN
    DELETE FROM public.hypo_log_acknowledgements WHERE carer_id = uid OR patient_id = uid;
  END IF;
  IF to_regclass('public.hypo_check_ins') IS NOT NULL THEN
    DELETE FROM public.hypo_check_ins WHERE carer_id = uid OR patient_id = uid;
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

GRANT DELETE ON public.community_comment_reactions TO supabase_auth_admin;

DROP POLICY IF EXISTS community_comment_reactions_delete_supabase_auth_admin ON public.community_comment_reactions;
CREATE POLICY community_comment_reactions_delete_supabase_auth_admin
  ON public.community_comment_reactions
  FOR DELETE
  TO supabase_auth_admin
  USING (true);
