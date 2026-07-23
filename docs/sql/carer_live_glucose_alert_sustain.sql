-- Sustain / recovery fields for supporter live-glucose check-in alerts.
-- Pairs with decideLiveGlucoseAlert in live-glucose-alert-policy.ts:
--   pending_status + extreme_since  → wait until extreme has lasted ~15 min before alerting
--   ok_since                        → require ~10 min back in range before a new excursion can alert
-- last_alerted_status remains the one-shot-per-excursion guard (with atomic claim in the edge function).

ALTER TABLE public.carer_live_glucose_alert_state
  ADD COLUMN IF NOT EXISTS pending_status text
    CHECK (pending_status IS NULL OR pending_status IN ('extreme_low', 'extreme_high')),
  ADD COLUMN IF NOT EXISTS extreme_since timestamptz,
  ADD COLUMN IF NOT EXISTS ok_since timestamptz;

COMMENT ON COLUMN public.carer_live_glucose_alert_state.pending_status IS
  'Extreme currently being timed for sustain before notifying; null when in range or already alerted.';
COMMENT ON COLUMN public.carer_live_glucose_alert_state.extreme_since IS
  'When pending_status streak started. Cleared on return to range or after notify.';
COMMENT ON COLUMN public.carer_live_glucose_alert_state.ok_since IS
  'When in-range recovery started after an alert. Cleared once recovery elapses or extreme returns.';

COMMENT ON TABLE public.carer_live_glucose_alert_state IS
  'Dedupes supporter extreme glucose check-in alerts per carer–patient pair, with sustain + recovery. Written by notify_carers_on_live_glucose (service role).';
