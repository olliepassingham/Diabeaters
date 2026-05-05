-- Client-maintained forecast for server-side supply alerts when the app is not running.
-- `notify_supply_low_cron` reads rows with a fresh `supply_forecast_at` (see Edge Function).

alter table public.supplies
  add column if not exists days_remaining_cached double precision,
  add column if not exists supply_forecast_at timestamptz;

comment on column public.supplies.days_remaining_cached is
  'Last days-until-empty estimate from the patient app; used by scheduled notify_supply_low_cron.';
comment on column public.supplies.supply_forecast_at is
  'When days_remaining_cached was last written; cron ignores stale rows.';

create index if not exists supplies_forecast_scan_idx
  on public.supplies (user_id)
  where days_remaining_cached is not null and quantity > 0;
