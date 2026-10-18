-- Public-safe diabetes type for community profiles (Type 1 / Type 2).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS diabetes_type text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_diabetes_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_diabetes_type_check
  CHECK (diabetes_type IS NULL OR diabetes_type IN ('type1', 'type2'));

COMMENT ON COLUMN public.profiles.diabetes_type IS
  'Optional; shown on public community profile when set (type1 / type2). Null for community explorers and supporters without diabetes.';
