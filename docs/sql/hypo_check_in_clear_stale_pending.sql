-- Run in Supabase SQL Editor if a supporter is stuck on "Waiting for their reply"
-- or after a partial/failed expiry migration.

-- 1) Allow expired status (skip if constraint already includes expired)
ALTER TABLE public.hypo_check_ins
  DROP CONSTRAINT IF EXISTS hypo_check_ins_status_check;

ALTER TABLE public.hypo_check_ins
  ADD CONSTRAINT hypo_check_ins_status_check
  CHECK (status IN ('pending', 'ok', 'treating', 'hypo_logged', 'expired'));

-- 2) Clear stale pending rows immediately
UPDATE public.hypo_check_ins
SET
  status = 'expired',
  responded_at = coalesce(responded_at, now())
WHERE status = 'pending'
  AND created_at < now() - interval '30 minutes';

NOTIFY pgrst, 'reload schema';
