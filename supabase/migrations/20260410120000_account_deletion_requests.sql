-- In-app account deletion requests (no email client required). Process from Supabase Dashboard or admin tooling.
-- Apply to your project: `supabase db push` or paste this file into Dashboard → SQL.

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_deletion_requests_user_id_idx
  ON public.account_deletion_requests (user_id);

CREATE INDEX IF NOT EXISTS account_deletion_requests_requested_at_idx
  ON public.account_deletion_requests (requested_at DESC);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_deletion_requests_insert_own
  ON public.account_deletion_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY account_deletion_requests_select_own
  ON public.account_deletion_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
