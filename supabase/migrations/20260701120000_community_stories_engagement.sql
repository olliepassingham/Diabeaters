-- Story captions, text overlays, reactions, and author viewer list.

ALTER TABLE public.community_stories
  ADD COLUMN IF NOT EXISTS caption text CHECK (caption IS NULL OR char_length(caption) <= 200);

ALTER TABLE public.community_stories
  ADD COLUMN IF NOT EXISTS overlays jsonb;

COMMENT ON COLUMN public.community_stories.caption IS 'Optional short caption shown below the story media.';
COMMENT ON COLUMN public.community_stories.overlays IS 'JSON array of text overlays: [{ id, text, x, y, style }].';

-- ---------------------------------------------------------------------------
-- Story reactions (one per viewer per story)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_story_reactions (
  story_id uuid NOT NULL REFERENCES public.community_stories (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reaction_kind text NOT NULL CHECK (reaction_kind IN ('heart', 'support', 'celebrate')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_story_reactions_story_id_idx
  ON public.community_story_reactions (story_id);

ALTER TABLE public.community_story_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_story_reactions_select ON public.community_story_reactions;
CREATE POLICY community_story_reactions_select
  ON public.community_story_reactions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
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

DROP POLICY IF EXISTS community_story_reactions_insert_own ON public.community_story_reactions;
CREATE POLICY community_story_reactions_insert_own
  ON public.community_story_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.community_stories s
      WHERE s.id = story_id
        AND s.expires_at > now()
        AND s.author_id <> auth.uid()
        AND EXISTS (
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
  );

DROP POLICY IF EXISTS community_story_reactions_update_own ON public.community_story_reactions;
CREATE POLICY community_story_reactions_update_own
  ON public.community_story_reactions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS community_story_reactions_delete_own ON public.community_story_reactions;
CREATE POLICY community_story_reactions_delete_own
  ON public.community_story_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Authors can see who viewed their stories.
DROP POLICY IF EXISTS community_story_views_select_story_author ON public.community_story_views;
CREATE POLICY community_story_views_select_story_author
  ON public.community_story_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_stories s
      WHERE s.id = story_id
        AND s.author_id = auth.uid()
        AND s.expires_at > now()
    )
  );
