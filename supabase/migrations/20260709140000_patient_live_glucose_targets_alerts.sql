-- Target range + alert dedup for supporter live glucose.

ALTER TABLE public.patient_live_glucose
  ADD COLUMN IF NOT EXISTS target_low numeric,
  ADD COLUMN IF NOT EXISTS target_high numeric,
  ADD COLUMN IF NOT EXISTS range_status text CHECK (range_status IN ('low', 'in_range', 'high')),
  ADD COLUMN IF NOT EXISTS last_alerted_range_status text CHECK (
    last_alerted_range_status IN ('low', 'in_range', 'high')
  );

COMMENT ON COLUMN public.patient_live_glucose.range_status IS
  'Patient reading vs their saved target range at publish time.';
COMMENT ON COLUMN public.patient_live_glucose.last_alerted_range_status IS
  'Dedupes supporter out-of-range notifications until status returns to in_range.';
