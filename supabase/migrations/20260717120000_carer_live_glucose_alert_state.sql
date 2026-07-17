-- Per-supporter dedupe for extreme live-glucose check-in alerts.
-- Thresholds live in notification_preferences.prefs (live_glucose_alert_low/high, mmol/L).

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

COMMENT ON TABLE public.carer_live_glucose_alert_state IS
  'Dedupes supporter extreme glucose check-in alerts per carer–patient pair. Written by notify_carers_on_live_glucose (service role).';
