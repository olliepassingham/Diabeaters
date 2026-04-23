-- Clinical prefs for cross-device restore (owner-only; not selected in batch community profile fetches).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS insulin_delivery_method text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tdd double precision;

COMMENT ON COLUMN public.profiles.insulin_delivery_method IS 'pen or pump; synced from app local profile when signed in.';
COMMENT ON COLUMN public.profiles.tdd IS 'Total daily insulin units; optional sync from app settings for new-device restore.';
