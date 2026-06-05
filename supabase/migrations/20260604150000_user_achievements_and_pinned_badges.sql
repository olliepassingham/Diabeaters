-- User achievements (earned milestones) and opt-in public profile badges.

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS user_achievements_user_id_earned_at_idx
  ON public.user_achievements (user_id, earned_at DESC);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pinned_achievement_ids text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_achievements_select_own ON public.user_achievements;
CREATE POLICY user_achievements_select_own
  ON public.user_achievements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_achievements_insert_own ON public.user_achievements;
CREATE POLICY user_achievements_insert_own
  ON public.user_achievements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_achievements_update_own ON public.user_achievements;
CREATE POLICY user_achievements_update_own
  ON public.user_achievements
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow reading another user's achievements when pinned on a public profile.
DROP POLICY IF EXISTS user_achievements_select_public_pinned ON public.user_achievements;
CREATE POLICY user_achievements_select_public_pinned
  ON public.user_achievements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = user_achievements.user_id
        AND p.is_public = true
        AND user_achievements.achievement_id = ANY (p.pinned_achievement_ids)
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.user_achievements TO authenticated;
