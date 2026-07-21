# Beatie on the community feed — operations

This feature covers:

1. **Ask Beatie (educational)** on a community post — only the **post author** can trigger it.
2. **Scheduled educational posts** — Beatie publishes at most one conversation-starter about every **3 days** (cron may still run daily; the function skips if she posted recently).

Beatie’s replies and scheduled posts are stored as normal `community_post_comments` / `community_posts` rows attributed to a **dedicated Auth user** (the “feed bot”), because Row Level Security requires human inserts to use `author_id = auth.uid()`.

## 1. Create the bot user in Supabase Auth

1. In **Supabase Dashboard → Authentication → Users → Add user**, create a user such as `beatie_feed_bot@diabeaters.invalid` (email/password or magic link as you prefer). This account is **not** for human login in production UI.
2. Copy the user’s **UUID**.

## 2. Profile row

Ensure `public.profiles` has a row for that UUID (same as any member). Set at least:

- `full_name` — e.g. `Beatie`
- `public_handle` — optional; used if present
- `avatar_url` — optional; path in your avatars bucket if you use one

Without a profile, the feed will still work but names/avatars may fall back to a short id string until profiles load.

## 3. Edge Function secrets (Dashboard → Edge Functions)

| Secret | Purpose |
| --- | --- |
| `BEATIE_FEED_BOT_USER_ID` | UUID from step 1 — **required** for `ai_feed_reply` and `beatie_feed_post_cron` |
| `ENABLE_AI_COACH` | Must be `true` for the LLM path (shared gate with private coach) |
| `OPENAI_API_KEY` | Same as `ai_coach` |
| `AI_FEED_MAX_PER_DAY` | Optional; default **10** Ask Beatie calls per user per UTC day |
| `BEATIE_FEED_POST_CRON_SECRET` | Optional; cron auth header `x-beatie-feed-post-cron-secret` (recommended for Dashboard Cron) |
| `BEATIE_FEED_POST_MIN_INTERVAL_HOURS` | Optional; default **72** (one scheduled post every ~3 days) |
| `BEATIE_FEED_POST_CRON_MAX_PER_WINDOW` | Optional; default **1** Beatie post per min-interval window (`BEATIE_FEED_POST_CRON_MAX_PER_DAY` still accepted as an alias) |

Standard project secrets still apply: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## 4. Database migration

Apply `supabase/migrations/20260519180000_ai_feed_reply_rate.sql` (creates `ai_feed_reply_rate_limits` and `ai_feed_reply_rate_increment` for `service_role`).

```bash
supabase db push
```

## 5. Deploy the functions

```bash
supabase functions deploy ai_feed_reply
supabase functions deploy beatie_feed_post_cron --no-verify-jwt
```

`supabase/config.toml` sets `verify_jwt = true` for `ai_feed_reply` (same pattern as `ai_coach`). `beatie_feed_post_cron` uses service-role / cron-secret auth (`verify_jwt = false`).

## 6. Schedule Beatie posts

In **Supabase Dashboard → Integrations → Cron**, keep a daily (or less frequent) job (e.g. **09:00 UTC**). The function enforces the min interval, so a daily schedule is fine:

- **POST** `https://<project-ref>.supabase.co/functions/v1/beatie_feed_post_cron`
- Headers: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`, `apikey: <same>`

Or set `BEATIE_FEED_POST_CRON_SECRET` and send `x-beatie-feed-post-cron-secret: <same>` with `apikey` set to the **anon** key (gateway only).

Manual test:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/beatie_feed_post_cron" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
```

A second run within the min interval (default ~72 hours) returns `{ "skipped": true, "reason": "posted_within_min_interval" }`. No push notifications are sent for Beatie's own posts.

## 7. Deleting Beatie posts

Authors can only delete their own posts in the app, so your normal account cannot remove Beatie’s posts from the UI yet.

**Today (ops):** Supabase Dashboard → **Table Editor** → `community_posts` → filter `author_id` = `BEATIE_FEED_BOT_USER_ID` → delete the rows you want (comments/likes cascade where FKs are set).

Or in **SQL Editor**:

```sql
-- List recent Beatie posts (replace the UUID)
SELECT id, created_at, left(body, 80)
FROM community_posts
WHERE author_id = 'BEATIE_FEED_BOT_USER_ID'
ORDER BY created_at DESC
LIMIT 50;

-- Delete specific ones
DELETE FROM community_posts WHERE id IN ('post-uuid-1', 'post-uuid-2');
```

## 8. Frontend (Vite)

Optional but recommended for the **Ask Beatie** button and **Beatie** badge on comments:

```bash
VITE_BEATIE_FEED_BOT_USER_ID=<same UUID as BEATIE_FEED_BOT_USER_ID>
```

If unset, the app hides the entry point even when the backend is configured (avoids a broken UX).

## 9. QA checklist

### Ask Beatie (on user posts)

- Poster with valid Beatie consent sees the button when expanded and `VITE_BEATIE_FEED_BOT_USER_ID` is set.
- Second click returns **beatie already replied** (one Beatie comment per post).
- Non-author never sees the button on others’ posts.
- Interceptor path (e.g. severe acute wording in thread) returns a message **without** inserting a comment.
- Reporting/deleting flows behave like any other comment row.

### Scheduled Beatie posts
- Cron creates at most one post per min-interval window on the **Everyone** feed with Beatie name/avatar and **AI guide** badge.
- Extra cron runs inside the window are no-ops (`posted_within_min_interval`).
- Post uses a valid `topic` from `COMMUNITY_TOPICS`.
- No `notify_feed_push` fired for Beatie self-posts.
- Beatie's own posts do not show **Ask Beatie** on the thread.
- Users can comment and like Beatie posts normally.
