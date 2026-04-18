-- Notifications v1 (push + in-app inbox)
-- Apply in Supabase SQL editor (or `supabase db push` if you convert to a migration).
--
-- iOS push delivery (Edge Functions `notify_*`): configure APNs Auth Key in Supabase → Edge Functions → Secrets:
--   APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY (full .p8 PEM; use \n for newlines in the secret value)
--   optional: APNS_BUNDLE_ID (default com.passingtime.diabeaters), APNS_USE_SANDBOX=true for Xcode debug tokens
-- Alternatively set PUSH_NOTIFICATION_API_URL (+ optional PUSH_NOTIFICATION_API_KEY) for a custom HTTP relay.
--
-- Tables:
-- - public.notifications: in-app inbox rows per recipient user_id
-- - public.push_tokens: device push tokens per user (iOS Capacitor)
-- - public.notification_preferences: cloud-backed toggle state for Edge Functions

-- ---------------------------------------------------------------------------
-- In-app inbox: notifications
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
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx ON public.notifications (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Push tokens (iOS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('ios')),
  token text NOT NULL,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_user_platform_token_uniq
  ON public.push_tokens (user_id, platform, token);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens (user_id);

-- updated_at trigger helper (shared pattern)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_push_tokens_updated_at'
  ) THEN
    CREATE TRIGGER set_push_tokens_updated_at
    BEFORE UPDATE ON public.push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cloud-backed notification preferences (Edge Functions need these)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_notification_preferences_updated_at'
  ) THEN
    CREATE TRIGGER set_notification_preferences_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- notifications: inbox is per-recipient
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_select_own') THEN
    CREATE POLICY notifications_select_own
      ON public.notifications FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_update_own') THEN
    CREATE POLICY notifications_update_own
      ON public.notifications FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END;
$$;

-- push_tokens: user manages their own devices
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='push_tokens_select_own') THEN
    CREATE POLICY push_tokens_select_own
      ON public.push_tokens FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='push_tokens_insert_own') THEN
    CREATE POLICY push_tokens_insert_own
      ON public.push_tokens FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='push_tokens_update_own') THEN
    CREATE POLICY push_tokens_update_own
      ON public.push_tokens FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='push_tokens_delete_own') THEN
    CREATE POLICY push_tokens_delete_own
      ON public.push_tokens FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END;
$$;

-- notification_preferences: user manages their own record
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_preferences' AND policyname='notification_preferences_select_own') THEN
    CREATE POLICY notification_preferences_select_own
      ON public.notification_preferences FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_preferences' AND policyname='notification_preferences_upsert_own') THEN
    CREATE POLICY notification_preferences_upsert_own
      ON public.notification_preferences FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_preferences' AND policyname='notification_preferences_update_own') THEN
    CREATE POLICY notification_preferences_update_own
      ON public.notification_preferences FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END;
$$;

