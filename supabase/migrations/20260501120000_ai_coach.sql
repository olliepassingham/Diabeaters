-- AI Coach (educational LLM) — consent flag, audit log, rate-limit state.
--
-- See docs/regulatory/ai_coach_system_prompt.md for the canonical behavioural spec
-- and docs/regulatory/dpia_openai_checklist.md for the DPIA position.
--
-- Privacy posture (v1):
--   • Chat history is held client-side only (localStorage). Nothing in this schema
--     stores message content.
--   • Audit rows record metadata only (category, deferred flag, post-filter status,
--     latency, token counts, model). Never the user's prompt or the model's reply.
--   • Consent is per-user on profiles; clearing it disables the feature for that user.

-- 1. Consent on profiles ------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_coach_consent_at TIMESTAMPTZ NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_coach_consent_version TEXT NULL;

COMMENT ON COLUMN public.profiles.ai_coach_consent_at IS
  'Timestamp at which the user accepted the AI Coach consent screen. NULL = not consented; feature is disabled for the user.';
COMMENT ON COLUMN public.profiles.ai_coach_consent_version IS
  'Version string of the consent copy the user accepted (e.g. "2026-05-01"). Used to re-prompt when the consent text changes.';

-- 2. Audit table (service-role only) -----------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_coach_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- One of: 'acute_glycaemic', 'disordered_eating_with_insulin',
  -- 'emergency_services', 'safeguarding', 'llm', 'rate_limited',
  -- 'consent_required', 'llm_disabled', 'llm_error', 'post_filter_refused'.
  category TEXT NOT NULL,
  -- Whether the response set deferToTeam=true.
  deferred BOOLEAN NOT NULL DEFAULT FALSE,
  -- Post-filter outcome: 'pass' | 'rewritten' | 'refused' | 'n/a' (interceptor path).
  post_filter_status TEXT NOT NULL DEFAULT 'n/a',
  latency_ms INTEGER NULL,
  tokens_in INTEGER NULL,
  tokens_out INTEGER NULL,
  model TEXT NULL,
  -- Length of the user's prompt in characters. Useful for cost/abuse monitoring
  -- without storing content.
  prompt_chars INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_coach_audit_user_id_created_at
  ON public.ai_coach_audit (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_coach_audit_created_at
  ON public.ai_coach_audit (created_at DESC);

-- RLS: only service-role writes; no client reads. The Edge Function uses the
-- service-role key for inserts. We enable RLS with no policies so no role can
-- read or write from a JWT context.
ALTER TABLE public.ai_coach_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_coach_audit FROM authenticated, anon;

COMMENT ON TABLE public.ai_coach_audit IS
  'AI Coach per-call audit trail (metadata only — no prompt or reply content).';

-- 3. Rate-limit table + atomic increment -------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_coach_rate_limits (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_utc DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day_utc)
);

ALTER TABLE public.ai_coach_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_coach_rate_limits FROM authenticated, anon;

COMMENT ON TABLE public.ai_coach_rate_limits IS
  'Per-user, per-UTC-day call counter for AI Coach. Service-role writes only.';

-- Atomic increment: bumps the counter, returns whether the call is allowed and
-- the post-increment count. Calling it consumes one token of budget regardless
-- of allowed/denied — that way we cannot under-charge under contention.
CREATE OR REPLACE FUNCTION public.ai_coach_rate_increment(
  p_user_id UUID,
  p_max_per_day INTEGER
) RETURNS TABLE (allowed BOOLEAN, count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.ai_coach_rate_limits (user_id, day_utc, count)
  VALUES (p_user_id, (now() AT TIME ZONE 'UTC')::date, 1)
  ON CONFLICT (user_id, day_utc)
  DO UPDATE SET count = public.ai_coach_rate_limits.count + 1
  RETURNING public.ai_coach_rate_limits.count INTO v_count;

  RETURN QUERY SELECT (v_count <= p_max_per_day) AS allowed, v_count AS count;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_coach_rate_increment(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_coach_rate_increment(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION public.ai_coach_rate_increment(UUID, INTEGER) IS
  'Atomically increment per-user/per-UTC-day AI Coach call count. Returns (allowed, count).';
