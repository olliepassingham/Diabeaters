-- Per-post audience. Everyone stays the default. Followers-only posts are
-- visible to the author and people who follow them. Profiles stay public.

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'everyone';

ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_audience_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_audience_check
  CHECK (audience IN ('everyone', 'followers'));

COMMENT ON COLUMN public.community_posts.audience IS
  'everyone: any signed-in member. followers: author and people who follow the author.';

DROP POLICY IF EXISTS community_posts_select_authenticated ON public.community_posts;
DROP POLICY IF EXISTS community_posts_select_not_blocked ON public.community_posts;
CREATE POLICY community_posts_select_not_blocked
  ON public.community_posts FOR SELECT
  TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = community_posts.author_id)
         OR (b.blocked_id = auth.uid() AND b.blocker_id = community_posts.author_id)
    )
    AND (
      audience = 'everyone'
      OR author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_follows uf
        WHERE uf.follower_id = auth.uid()
          AND uf.followee_id = community_posts.author_id
      )
    )
  );

-- Comments follow the post. A hidden post does not leave its comments readable.
DROP POLICY IF EXISTS community_post_comments_select_authenticated ON public.community_post_comments;
DROP POLICY IF EXISTS community_post_comments_select_not_blocked ON public.community_post_comments;
CREATE POLICY community_post_comments_select_not_blocked
  ON public.community_post_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = community_post_comments.post_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = community_post_comments.author_id)
         OR (b.blocked_id = auth.uid() AND b.blocker_id = community_post_comments.author_id)
    )
  );

DROP POLICY IF EXISTS community_post_comments_insert_own ON public.community_post_comments;
CREATE POLICY community_post_comments_insert_own
  ON public.community_post_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.profile_can_engage_community_feed(auth.uid())
    AND (
      image_storage_path IS NULL
      OR image_storage_path LIKE (auth.uid()::text || '/comment/%')
    )
    AND EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = post_id
    )
  );
