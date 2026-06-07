-- Live streak counts shown on public profiles (synced from client activity).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_streak_counts jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.public_streak_counts IS
  'Map of streak track kind -> current day count for pinned public profile badges.';

COMMENT ON COLUMN public.profiles.pinned_achievement_ids IS
  'Streak track kinds pinned to public profile (max 5), e.g. bedtime_check, app_check_in. Legacy achievement ids are migrated client-side.';
