-- Carers to notify (patient-owned), hypo event log, in-app notifications for carers.
-- Apply with: supabase db push   OR paste into Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- carers: single source of truth for hypo alert targets (push / in-app)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.carers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  carer_name text NOT NULL,
  relationship text,
  contact_method text NOT NULL CHECK (contact_method IN ('push', 'inapp')),
  contact_value text NOT NULL DEFAULT '',
  receive_hypo_alerts boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS carers_user_id_idx ON public.carers (user_id);

-- ---------------------------------------------------------------------------
-- hypo_logs: cloud log used by Edge Function after insert from app
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hypo_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  blood_glucose numeric,
  treatment text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hypo_logs_user_id_idx ON public.hypo_logs (user_id);

-- ---------------------------------------------------------------------------
-- notifications: in-app inbox (recipient = carer's auth user id for inapp)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.carers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hypo_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY carers_select_own ON public.carers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY carers_insert_own ON public.carers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY carers_update_own ON public.carers FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY carers_delete_own ON public.carers FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY hypo_logs_select_own ON public.hypo_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY hypo_logs_insert_own ON public.hypo_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
