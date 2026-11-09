# Environment Variables & Secrets Inventory

**No secret values are included in this document.**

Legend for “Recreate on new Cursor account?” assumes **Scope A (Cursor-only)** unless noted.

## Client (Vite) – local + Vercel + often GitHub Actions

| Name | Used for | Local files (keys present) | Also stored in | Needed on new Cursor machine | Rotate? |
| --- | --- | --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase client | `.env`, `.env.local`, `app/.env.local` | Vercel, GH Actions | Yes (copy) | Only if project URL changes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | same | Vercel, GH Actions | Yes | Prefer rotate if leaked; not required for Cursor switch |
| `VITE_PUBLIC_SITE_URL` | Auth redirects / emails | In `.env.example` only locally | Vercel (expected) | Recommended | If domain changes |
| `VITE_APP_ENV` | Env flavour | `.env.local` | Vercel optional | Optional | No |
| `VITE_SUPPORT_EMAIL` | Support / deletion mailto | `.env.local` | Vercel optional | Optional | No |
| `VITE_BEATIE_FEED_BOT_USER_ID` | Ask Beatie UI | `.env.local` | Vercel / GH | If using Beatie | No |
| `VITE_SENTRY_DSN` | Error reporting | example only | Vercel optional | If used | If DSN leaked |
| `VITE_TURNSTILE_SITE_KEY` | Auth captcha | example only | Vercel optional | If captcha enabled | With Turnstile secret |
| `VITE_FEATURE_COMMUNITY` | Gate community in prod builds | example / build scripts | Vercel prod | Via Vercel (not Cursor) | No |
| `VITE_FEATURE_AI_COACH` | Hide coach if `false` | example | Vercel optional | Via Vercel | No |
| `VITE_SHOW_PUSH_TEST` | Internal push test UI | docs / scripts | Vercel optional | Via Vercel | No |
| `VITE_E2E` | E2E harness | `app/.env.local` | local only | Only for e2e | No |
| `VITE_SUPABASE_URL_STAGING` | Staging deploys | — | GH Actions | No for Cursor | If staging project changes |
| `VITE_SUPABASE_ANON_KEY_STAGING` | Staging deploys | — | GH Actions | No for Cursor | Same |

## GitHub Actions deploy secrets

| Name | Purpose | Recreate for Cursor switch? |
| --- | --- | --- |
| `VERCEL_TOKEN` | Deploy from Actions | No (stays on GitHub) |
| `VERCEL_ORG_ID` | Vercel team | No |
| `VERCEL_PROJECT_ID` | Vercel project | No |
| `SUPABASE_ACCESS_TOKEN` | Deploy Edge Functions | No |
| `SUPABASE_PROJECT_REF` | Optional override | No |

## Supabase Edge Function secrets (Dashboard — names from code)

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Usually auto-injected |
| `OPENAI_API_KEY` | AI Coach / feed reply / Beatie cron |
| `ENABLE_AI_COACH` | Feature flag |
| `AI_COACH_MAX_PER_DAY` / `AI_FEED_MAX_PER_DAY` | Rate limits |
| `BEATIE_FEED_BOT_USER_ID` | Bot identity |
| `BEATIE_FEED_POST_CRON_SECRET` (+ max/window vars) | Cron auth |
| `EXERCISE_CGM_MONITOR_SECRET` / `EXERCISE_CGM_MONITOR_CRON_SECRET` | Exercise CGM |
| `SUPPORTER_CGM_SHARE_CRON_SECRET` | Supporter glucose cron |
| `NOTIFY_SUPPLY_LOW_CRON_SECRET` | Supply forecast cron |
| `NOTIFY_SUPPORTER_APPT_CRON_SECRET` | Appointment reminders |
| `APNS_KEY_ID` / `APNS_TEAM_ID` / `APNS_BUNDLE_ID` / `APNS_PRIVATE_KEY` / `APNS_USE_SANDBOX` | iOS push |
| `FCM_PROJECT_ID` / `FCM_SERVICE_ACCOUNT_JSON` | Android push |
| `PUSH_NOTIFICATION_API_KEY` / `PUSH_NOTIFICATION_API_URL` | Push provider helpers |

## Other process.env references (scripts / optional Node)

`DATABASE_URL`, `NEWS_API_KEY`, `ENABLE_ACTIVITY_ADVICE`, `CAPACITOR_BUNDLE_WEB`, `CAPACITOR_SERVER_URL`, `CAPACITOR_FORCE_REMOTE`, `CI`, `PORT`, etc. — mostly build/ops scripts. Inventory if you use those scripts.

## Local presence check (2026-11-09)

| File | Status |
| --- | --- |
| `.env` | Present (URL + anon only) |
| `.env.local` | Present (URL, anon, app env, Beatie id, support email) |
| `app/.env.local` | Present (URL, anon, E2E) |
| `.env.example` / `.env.staging.example` | In GitHub |

**Gap:** Local files do not list every optional Vite var that may be set only on Vercel. Complete the inventory from Vercel Dashboard → Environment Variables.

## Inconsistencies / gaps

1. **Split env files** — root `.env.local` vs `app/.env.local` may diverge; Vite typically reads from `app/` when building the app. Confirm which file the app actually loads when you develop.  
2. **Staging vs production** Supabase keys exist as separate GH secrets — keep both.  
3. **Service role** must never be put in Vite/`VITE_*` files.  
4. **Migration readiness pack itself** should not be used to store real values.

## Must recreate in the new Cursor environment (Scope A)

Only local files — dashboards stay put:

| Item | Action |
| --- | --- |
| `.env` | Restore from private backup |
| `.env.local` | Restore from private backup |
| `app/.env.local` | Restore from private backup |
| `android/app/google-services.json` | Restore if you build Android |
| Vercel / Supabase / GH Actions secrets | **Do not recreate** for Cursor-only |

Minimum keys the local app needs: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Secure backup procedure (do this before switching Cursor)

1. [ ] Run `bash migration-readiness/scripts/backup-cursor-local.sh` (copies env + history outside the repo).  
2. [ ] Optionally also store the same values in 1Password / an encrypted note.  
3. [ ] For belt-and-braces (not required to switch Cursor): inventory Vercel + Supabase Edge + Actions secret **values** from dashboards / your password manager.  
4. [ ] Never commit the private backup folder or real values into GitHub.  
5. [ ] After new Cursor sign-in, copy env files back to the same relative paths; confirm `git status` does not stage them.
