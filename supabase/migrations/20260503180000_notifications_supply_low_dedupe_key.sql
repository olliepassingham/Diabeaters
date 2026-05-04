-- De-duplicate supply low/critical in-app alerts: at most one row per recipient per
-- patient + supply + level + UTC calendar day (handles multi-tab races and poller retries).

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text;

COMMENT ON COLUMN public.notifications.dedupe_key IS
  'When set, unique per (user_id, dedupe_key) so repeated notify attempts are ignored (e.g. supplies_low).';

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_key_uidx
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
