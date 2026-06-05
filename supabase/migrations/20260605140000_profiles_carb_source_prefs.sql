-- Named carb source favourites + per-scenario defaults (hypo, exercise, driving).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS carb_source_prefs jsonb;

COMMENT ON COLUMN public.profiles.carb_source_prefs IS
  'Owner-managed carb favourites and scenario defaults for hypo/exercise/driving display hints.';
