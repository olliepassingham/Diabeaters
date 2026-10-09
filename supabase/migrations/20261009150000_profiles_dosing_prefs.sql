-- Carb ratios, correction factor, target range, and body weight.
-- Owner-only clinical detail. Not selected for public profile lists.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dosing_prefs jsonb;

COMMENT ON COLUMN public.profiles.dosing_prefs IS
  'Owner insulin ratios, correction factor, target range, and body weight so a new phone can restore them.';
