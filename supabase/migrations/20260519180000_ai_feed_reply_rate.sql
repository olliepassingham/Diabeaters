-- Per-user rate limit for Beatie "Ask on this post" (community feed), separate from AI Coach.
-- Edge Function `ai_feed_reply` calls `ai_feed_reply_rate_increment` with service role.
-- Create the dedicated auth user `beatie_feed_bot` in Dashboard and set secret `BEATIE_FEED_BOT_USER_ID`.

CREATE TABLE IF NOT EXISTS public.ai_feed_reply_rate_limits (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_utc DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day_utc)
);

ALTER TABLE public.ai_feed_reply_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_feed_reply_rate_limits FROM authenticated, anon;

COMMENT ON TABLE public.ai_feed_reply_rate_limits IS
  'Per-user, per-UTC-day counter for Ask Beatie on feed posts (separate from ai_coach_rate_limits).';

CREATE OR REPLACE FUNCTION public.ai_feed_reply_rate_increment(
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
  INSERT INTO public.ai_feed_reply_rate_limits (user_id, day_utc, count)
  VALUES (p_user_id, (now() AT TIME ZONE 'UTC')::date, 1)
  ON CONFLICT (user_id, day_utc)
  DO UPDATE SET count = public.ai_feed_reply_rate_limits.count + 1
  RETURNING public.ai_feed_reply_rate_limits.count INTO v_count;

  RETURN QUERY SELECT (v_count <= p_max_per_day) AS allowed, v_count AS count;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_feed_reply_rate_increment(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_feed_reply_rate_increment(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION public.ai_feed_reply_rate_increment(UUID, INTEGER) IS
  'Atomically increment per-user/per-UTC-day Ask Beatie feed reply count. Returns (allowed, count).';
