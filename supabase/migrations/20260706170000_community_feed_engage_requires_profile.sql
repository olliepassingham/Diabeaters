-- Feed engagement (post, like, comment, poll vote, event interest) requires a complete public profile with @handle.

CREATE OR REPLACE FUNCTION public.profile_can_engage_community_feed(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.is_public = true
      AND nullif(trim(p.full_name), '') IS NOT NULL
      AND nullif(trim(p.public_handle), '') IS NOT NULL
      AND char_length(trim(p.public_handle)) BETWEEN 3 AND 30
      AND lower(trim(p.public_handle)) ~ '^[_a-z0-9]+$'
  );
$$;

REVOKE ALL ON FUNCTION public.profile_can_engage_community_feed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_can_engage_community_feed(uuid) TO authenticated;

DROP POLICY IF EXISTS community_posts_insert_own ON public.community_posts;
CREATE POLICY community_posts_insert_own
  ON public.community_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.profile_can_engage_community_feed(auth.uid())
  );

DROP POLICY IF EXISTS community_post_comments_insert_own ON public.community_post_comments;
CREATE POLICY community_post_comments_insert_own
  ON public.community_post_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.profile_can_engage_community_feed(auth.uid())
  );

DROP POLICY IF EXISTS community_post_reactions_insert_own ON public.community_post_reactions;
CREATE POLICY community_post_reactions_insert_own
  ON public.community_post_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.profile_can_engage_community_feed(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = post_id
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = p.author_id)
        )
    )
  );

DROP POLICY IF EXISTS community_poll_votes_insert_own ON public.community_poll_votes;
CREATE POLICY community_poll_votes_insert_own
  ON public.community_poll_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.profile_can_engage_community_feed(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = post_id
        AND p.post_kind = 'poll'
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = p.author_id)
        )
    )
  );

DROP POLICY IF EXISTS community_poll_votes_update_own ON public.community_poll_votes;
CREATE POLICY community_poll_votes_update_own
  ON public.community_poll_votes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.profile_can_engage_community_feed(auth.uid())
  );

DROP POLICY IF EXISTS community_post_event_interest_insert_own ON public.community_post_event_interest;
CREATE POLICY community_post_event_interest_insert_own
  ON public.community_post_event_interest FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.profile_can_engage_community_feed(auth.uid())
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

COMMENT ON FUNCTION public.profile_can_engage_community_feed(uuid) IS
  'True when user has public profile, display name, and valid @handle — required for feed engagement.';
