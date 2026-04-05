-- Optional community profile: when the member started living with diabetes (public when is_public).
-- Apply in Supabase SQL editor if not using migrations.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS diabetes_onset_date date;

COMMENT ON COLUMN public.profiles.diabetes_onset_date IS 'Optional; shown on public community profile when set.';
