-- Event interest (separate from post likes). One row per user per event post.

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS interested_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.community_posts.interested_count IS 'Maintained by trigger on community_post_event_interest (event posts only).';

CREATE TABLE IF NOT EXISTS public.community_post_event_interest (
  post_id uuid NOT NULL REFERENCES public.community_posts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_post_event_interest_post_id_idx
  ON public.community_post_event_interest (post_id);

CREATE INDEX IF NOT EXISTS community_post_event_interest_user_id_idx
  ON public.community_post_event_interest (user_id);

ALTER TABLE public.community_post_event_interest ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bump_community_post_interested_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET interested_count = interested_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET interested_count = GREATEST(0, interested_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS community_post_event_interest_bump_count ON public.community_post_event_interest;
CREATE TRIGGER community_post_event_interest_bump_count
  AFTER INSERT OR DELETE ON public.community_post_event_interest
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_community_post_interested_count();

-- Historical event "likes" were shown as interested — move them to the interest table.
INSERT INTO public.community_post_event_interest (post_id, user_id, created_at)
SELECT r.post_id, r.user_id, r.created_at
FROM public.community_post_reactions r
INNER JOIN public.community_posts p ON p.id = r.post_id AND p.post_kind = 'event'
ON CONFLICT (post_id, user_id) DO NOTHING;

DELETE FROM public.community_post_reactions r
USING public.community_posts p
WHERE r.post_id = p.id AND p.post_kind = 'event';

UPDATE public.community_posts p
SET interested_count = COALESCE(
  (SELECT count(*)::int FROM public.community_post_event_interest i WHERE i.post_id = p.id),
  0
);

UPDATE public.community_posts p
SET like_count = COALESCE(
  (SELECT count(*)::int FROM public.community_post_reactions r WHERE r.post_id = p.id),
  0
);

DROP POLICY IF EXISTS community_post_event_interest_select_not_blocked ON public.community_post_event_interest;
CREATE POLICY community_post_event_interest_select_not_blocked
  ON public.community_post_event_interest FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = community_post_event_interest.post_id
        AND p.post_kind = 'event'
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = p.author_id)
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = community_post_event_interest.user_id)
         OR (b.blocked_id = auth.uid() AND b.blocker_id = community_post_event_interest.user_id)
    )
  );

DROP POLICY IF EXISTS community_post_event_interest_insert_own ON public.community_post_event_interest;
CREATE POLICY community_post_event_interest_insert_own
  ON public.community_post_event_interest FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = post_id
        AND p.post_kind = 'event'
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = p.author_id)
        )
    )
  );

DROP POLICY IF EXISTS community_post_event_interest_delete_own ON public.community_post_event_interest;
CREATE POLICY community_post_event_interest_delete_own
  ON public.community_post_event_interest FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT DELETE ON public.community_post_event_interest TO supabase_auth_admin;

DROP POLICY IF EXISTS community_post_event_interest_delete_supabase_auth_admin ON public.community_post_event_interest;
CREATE POLICY community_post_event_interest_delete_supabase_auth_admin
  ON public.community_post_event_interest
  FOR DELETE
  TO supabase_auth_admin
  USING (true);
