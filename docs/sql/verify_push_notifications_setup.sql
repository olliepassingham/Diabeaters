-- Run in Supabase Dashboard → SQL Editor (read-only checks).
-- Confirms tables exist and shows how many rows are present (SQL Editor runs as postgres; bypasses RLS).
--
-- Note: The first two queries each return exactly ONE result row — that row is a summary (counts),
-- not “only one device in the whole database”. The third query lists up to 10 recent device tokens.

-- push_tokens: summary counts (one result row).
SELECT
  COUNT(*) AS push_token_rows,
  COUNT(DISTINCT user_id) AS distinct_users_with_tokens
FROM public.push_tokens;

-- notification_preferences: summary counts (one result row). prefs.push must be true for remote pushes.
SELECT
  COUNT(*) AS pref_rows,
  COUNT(*) FILTER (WHERE prefs @> '{"push": true}'::jsonb) AS rows_with_push_true
FROM public.notification_preferences;

-- Recent tokens: up to 10 rows (one row per device token). Prefix only — not the full secret token.
SELECT user_id, platform, LEFT(token, 12) AS token_prefix, updated_at
FROM public.push_tokens
ORDER BY updated_at DESC NULLS LAST
LIMIT 10;
