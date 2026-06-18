-- Stories visible in feed/viewer only for your own story or people you follow (public, not blocked).

DROP POLICY IF EXISTS community_stories_select_not_blocked ON public.community_stories;
CREATE POLICY community_stories_select_following_or_own
  ON public.community_stories FOR SELECT
  TO authenticated
  USING (
    expires_at > now()
    AND (
      author_id = auth.uid()
      OR (
        EXISTS (
          SELECT 1 FROM public.user_follows uf
          WHERE uf.follower_id = auth.uid()
            AND uf.followee_id = community_stories.author_id
        )
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = community_stories.author_id
            AND p.is_public = true
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = author_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS community_story_views_insert_own ON public.community_story_views;
CREATE POLICY community_story_views_insert_following_or_own
  ON public.community_story_views FOR INSERT
  TO authenticated
  WITH CHECK (
    viewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.community_stories s
      WHERE s.id = story_id
        AND s.expires_at > now()
        AND (
          s.author_id = auth.uid()
          OR (
            EXISTS (
              SELECT 1 FROM public.user_follows uf
              WHERE uf.follower_id = auth.uid()
                AND uf.followee_id = s.author_id
            )
            AND NOT EXISTS (
              SELECT 1 FROM public.user_blocks b
              WHERE (b.blocker_id = auth.uid() AND b.blocked_id = s.author_id)
                 OR (b.blocked_id = auth.uid() AND b.blocker_id = s.author_id)
            )
          )
        )
    )
  );
