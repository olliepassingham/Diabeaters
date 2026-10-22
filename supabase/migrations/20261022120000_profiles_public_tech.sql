-- Optional community-only: diabetes tech shown on the public profile when the member opts in.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tech_sensor text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tech_delivery text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tech_closed_loop boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_tech_on_profile boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.tech_sensor IS 'Optional structured sensor choice (e.g. dexcom_g7, libre_3, fingersticks); shown publicly only when show_tech_on_profile is on.';
COMMENT ON COLUMN public.profiles.tech_delivery IS 'Optional structured insulin/treatment choice (e.g. pens, omnipod, tablets); shown publicly only when show_tech_on_profile is on.';
COMMENT ON COLUMN public.profiles.tech_closed_loop IS 'True when the member uses a closed-loop (automated insulin delivery) setup.';
COMMENT ON COLUMN public.profiles.show_tech_on_profile IS 'Opt-in: show tech_sensor / tech_delivery chips on the public community profile and in Find people.';
