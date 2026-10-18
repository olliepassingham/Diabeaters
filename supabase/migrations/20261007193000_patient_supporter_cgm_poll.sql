-- Encrypted Dexcom Share login so supporters can see a fresh glucose reading
-- after the user account has closed the app. Service role only.

CREATE TABLE IF NOT EXISTS public.patient_supporter_cgm_poll (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  dexcom_server text NOT NULL CHECK (dexcom_server IN ('eu', 'us', 'jp')),
  dexcom_username text NOT NULL,
  dexcom_password_ciphertext text NOT NULL,
  dexcom_password_iv text NOT NULL,
  bg_units text NOT NULL CHECK (bg_units IN ('mmol/L', 'mg/dL')),
  target_low numeric,
  target_high numeric,
  last_polled_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_supporter_cgm_poll_last_polled_idx
  ON public.patient_supporter_cgm_poll (last_polled_at NULLS FIRST);

ALTER TABLE public.patient_supporter_cgm_poll ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.patient_supporter_cgm_poll IS
  'Encrypted Dexcom Share credentials for background supporter glucose. No client policies; written by supporter_cgm_share and read by the cron.';
