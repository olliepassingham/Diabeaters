-- Optional community-only: when the member started living with diabetes (shown on public profile).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS diabetes_onset_date date;

COMMENT ON COLUMN public.profiles.diabetes_onset_date IS 'Optional; shown on public community profile when set.';
