-- Session-scoped Dexcom Share polling for exercise-time low-BG push alerts (background).
-- Credentials are AES-GCM encrypted at rest; rows expire when the exercise window ends.

CREATE TABLE IF NOT EXISTS public.patient_exercise_cgm_monitor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  session_id text NOT NULL,
  exercise_name text NOT NULL DEFAULT '',
  dexcom_server text NOT NULL CHECK (dexcom_server IN ('eu', 'us', 'jp')),
  dexcom_username text NOT NULL,
  dexcom_password_ciphertext text NOT NULL,
  dexcom_password_iv text NOT NULL,
  bg_units text NOT NULL CHECK (bg_units IN ('mmol/L', 'mg/dL')),
  alert_threshold numeric NOT NULL,
  trend_aware boolean NOT NULL DEFAULT true,
  clinical_hypo_threshold numeric,
  carbs_if_low numeric,
  carb_line text,
  exercise_started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  last_polled_at timestamptz,
  last_bg numeric,
  last_bg_trend text CHECK (last_bg_trend IN ('rising', 'falling', 'flat', 'not_sure')),
  last_bg_recorded_at timestamptz,
  last_alert_at timestamptz,
  last_alert_bg numeric,
  last_alert_reason text CHECK (last_alert_reason IN ('below_threshold', 'falling_toward', 'clinical_hypo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS patient_exercise_cgm_monitor_expires_at_idx
  ON public.patient_exercise_cgm_monitor (expires_at);

CREATE INDEX IF NOT EXISTS patient_exercise_cgm_monitor_user_id_idx
  ON public.patient_exercise_cgm_monitor (user_id);

ALTER TABLE public.patient_exercise_cgm_monitor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_exercise_cgm_monitor_owner_all ON public.patient_exercise_cgm_monitor;
CREATE POLICY patient_exercise_cgm_monitor_owner_all
  ON public.patient_exercise_cgm_monitor
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.patient_exercise_cgm_monitor IS
  'Active exercise sessions monitored server-side via Dexcom Share for low-BG push alerts while the app is backgrounded.';
