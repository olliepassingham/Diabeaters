-- Unique community @handle per user (case-insensitive). Required for shareable /community/u/:handle links.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_handle text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_handle_unique_lower
  ON public.profiles (lower(trim(public_handle)))
  WHERE public_handle IS NOT NULL AND trim(public_handle) <> '';

COMMENT ON COLUMN public.profiles.public_handle IS
  'Unique public username for community; lowercase a-z 0-9 underscore, 3–30 chars (validated in app).';
