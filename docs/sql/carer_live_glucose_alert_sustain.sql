-- Create + sustain fields for supporter live-glucose check-in alerts.
-- Safe to re-run. Use this when carer_live_glucose_alert_state may not exist yet
-- (e.g. staging/production that never got 20260717120000).

CREATE TABLE IF NOT EXISTS public.carer_live_glucose_alert_state (
  carer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  last_alerted_status text NOT NULL CHECK (
    last_alerted_status IN ('ok', 'extreme_low', 'extreme_high')
  ),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (carer_id, patient_id)
);

CREATE INDEX IF NOT EXISTS carer_live_glucose_alert_state_patient_idx
  ON public.carer_live_glucose_alert_state (patient_id);

ALTER TABLE public.carer_live_glucose_alert_state ENABLE ROW LEVEL SECURITY;

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
