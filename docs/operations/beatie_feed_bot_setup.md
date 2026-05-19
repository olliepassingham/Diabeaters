# Beatie on the community feed — operations

This feature adds **Ask Beatie (educational)** on a community post. Only the **post author** can trigger it. Beatie’s reply is stored as a normal `community_post_comments` row attributed to a **dedicated Auth user** (the “feed bot”), because Row Level Security requires human inserts to use `author_id = auth.uid()`.

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
| `BEATIE_FEED_BOT_USER_ID` | UUID from step 1 — **required** for `ai_feed_reply` |
| `ENABLE_AI_COACH` | Must be `true` for the LLM path (shared gate with private coach) |
| `OPENAI_API_KEY` | Same as `ai_coach` |
| `AI_FEED_MAX_PER_DAY` | Optional; default **10** Ask Beatie calls per user per UTC day |

Standard project secrets still apply: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## 4. Database migration

Apply `supabase/migrations/20260519180000_ai_feed_reply_rate.sql` (creates `ai_feed_reply_rate_limits` and `ai_feed_reply_rate_increment` for `service_role`).

```bash
supabase db push
```

## 5. Deploy the function

```bash
supabase functions deploy ai_feed_reply
```

`supabase/config.toml` sets `verify_jwt = true` for this function (same pattern as `ai_coach`).

## 6. Frontend (Vite)

Optional but recommended for the **Ask Beatie** button and **Beatie** badge on comments:

```bash
VITE_BEATIE_FEED_BOT_USER_ID=<same UUID as BEATIE_FEED_BOT_USER_ID>
```

If unset, the app hides the entry point even when the backend is configured (avoids a broken UX).

## 7. QA checklist

- Poster with valid Beatie consent sees the button when expanded and `VITE_BEATIE_FEED_BOT_USER_ID` is set.
- Second click returns **beatie already replied** (one Beatie comment per post).
- Non-author never sees the button on others’ posts.
- Interceptor path (e.g. severe acute wording in thread) returns a message **without** inserting a comment.
- Reporting/deleting flows behave like any other comment row.
