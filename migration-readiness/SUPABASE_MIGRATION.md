# Supabase Audit

## Project identity (from repo / local link — no secrets)

| Field | Value | Source |
| --- | --- | --- |
| Project ref | `ffgcivxvbtdlmfnttwjm` | `supabase/config.toml`, `supabase/.temp/project-ref` |
| Expected URL shape | `https://ffgcivxvbtdlmfnttwjm.supabase.co` | Inferred from ref (confirm in Dashboard) |
| Linked locally | Yes (`supabase/.temp/linked-project.json` present) | CLI temp state |

**Do not** treat “linked” as a data backup. Link only means the CLI knows which cloud project to talk to.

## Represented in GitHub (schema / code)

| Area | In repo? | Notes |
| --- | --- | --- |
| SQL migrations | Yes — **106** files under `supabase/migrations/` | Includes feed, carers, CGM share, stories, notify followers fix, etc. |
| Edge Function source | Yes — 20+ functions under `supabase/functions/` | See list below |
| Function `verify_jwt` flags | Yes — `supabase/config.toml` | |
| Client usage | Yes — `app/src/lib/**` | Auth, storage, RPCs |
| Extra SQL docs | Yes — `docs/sql/*` (e.g. `profile_pictures_storage.sql`) | Some bucket RLS lives in docs SQL, not only migrations |

### Edge functions present in repo

`ai_coach`, `ai_feed_reply`, `beatie_feed_post_cron`, `exercise_cgm_monitor`, `exercise_cgm_monitor_cron`, `notify_alcohol_night_mode`, `notify_carer_hypo_check_in_response`, `notify_carers_on_hypo`, `notify_carers_on_live_glucose`, `notify_dm_push`, `notify_feed_push`, `notify_patient_hypo_acknowledged`, `notify_patient_hypo_check_in`, `notify_push_test`, `notify_scenario_started`, `notify_supply_low`, `notify_supply_low_cron`, `notify_supporter_appointment_reminders`, `supporter_cgm_share`, `supporter_cgm_share_cron`, plus `_shared/`.

### Storage buckets referenced

| Bucket | In migrations / docs | Objects (files) in GitHub? |
| --- | --- | --- |
| `community_post_images` | Created/updated in migrations | **No** — live media only in Supabase Storage |
| `profile_pictures` | Policies documented in `docs/sql/profile_pictures_storage.sql` | **No** |
| Legacy `avatars` | Documented in `docs/storage_avatars.md` / account docs | **No** |

## Exists primarily in Supabase Dashboard (must inventory manually)

Flagged **UNVERIFIED** from repo alone — export/screenshot before any ownership change:

- [ ] Auth providers enabled (email; OAuth Apple / Google / Azure as used in `app/src/lib/auth.ts`)
- [ ] Auth URL config (Site URL, Redirect URLs) — must match `VITE_PUBLIC_SITE_URL` / `https://diabeaters.vercel.app`
- [ ] Captcha / Turnstile secret pairing with `VITE_TURNSTILE_SITE_KEY`
- [ ] All Auth **users** and MFA factors
- [ ] Full table **data** (profiles, posts, DMs, hypo logs, etc.)
- [ ] Storage **objects** in all buckets
- [ ] Edge Function **secrets** (OpenAI, APNS, FCM, cron secrets, service role injection)
- [ ] Scheduled triggers (Supabase Cron / external schedulers hitting `*_cron` functions)
- [ ] Database extensions actually enabled (`pg_cron` optional per migration comments)
- [ ] Realtime publication settings
- [ ] Custom SMTP / email templates
- [ ] Migration history vs git (`supabase db push` previously failed on an already-applied older migration — history may be **drifted**)

## Cursor-only move (recommended)

**No Supabase change required.** Keep the same project. New Cursor machine only needs:

- Same `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in local env  
- Optional: `supabase link` with a personal access token  

## If you ever transfer Supabase ownership (Scope B — high risk)

1. Prefer **invite new account into the same org** over cloning a new project.  
2. If you must clone: dump schema + data, migrate Storage objects, re-create Auth carefully (users don’t “copy” easily), redeploy all Edge Functions + secrets, update Vercel + GitHub secrets + native apps.  
3. Production downtime and user re-login are likely.

## Backup actions before changing anything

1. [ ] Dashboard → Settings → General: screenshot project ref, region, org.  
2. [ ] Export or dump database (Dashboard backup / `pg_dump`) to encrypted storage.  
3. [ ] Inventory Edge Function secret **names** (see `ENVIRONMENT_VARIABLES.md`).  
4. [ ] Note cron job URLs/schedules.  
5. [ ] Confirm Storage bucket list + approximate object counts.  
6. [ ] Confirm Auth provider + redirect URL list.
