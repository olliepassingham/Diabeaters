-- Optional cloud sync for app region + custom emergency number (US/UK/international).
alter table public.profiles
  add column if not exists app_region text check (app_region in ('UK', 'US', 'OTHER'));

alter table public.profiles
  add column if not exists emergency_number text;

comment on column public.profiles.app_region is 'User-selected region for units, emergency copy, and locale defaults.';
comment on column public.profiles.emergency_number is 'Optional override for local emergency dial number (OTHER region or travel).';
