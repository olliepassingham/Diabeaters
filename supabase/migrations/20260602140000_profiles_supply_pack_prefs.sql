-- Pack sizes for supporter supply display (units per pen, needles per box).
-- Synced from app Settings when the patient saves; readable by linked carers via profiles SELECT.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS units_per_insulin_pen integer,
  ADD COLUMN IF NOT EXISTS needles_per_box integer;

COMMENT ON COLUMN public.profiles.units_per_insulin_pen IS
  'Insulin units per disposable pen (e.g. 100). Synced from app settings for supporter supply display.';
COMMENT ON COLUMN public.profiles.needles_per_box IS
  'Pen needles per box (e.g. 100). Synced from app settings for supporter supply display.';
