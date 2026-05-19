# CI Secrets (Vercel Deploy)

This guide explains where to obtain and where to store the secrets required for Vercel CI deployment.

---

## Where to add secrets

**GitHub** → your repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add each secret by name. Values are never displayed after saving.

---

## Vercel secrets

| Secret             | Where to obtain                                                                 |
|--------------------|----------------------------------------------------------------------------------|
| `VERCEL_TOKEN`     | Vercel Dashboard → **Account** (or Team) → **Settings** → **Tokens** → Create Token. Name it e.g. `github-actions`. No expiry or 1 year. |
| `VERCEL_ORG_ID`    | Vercel Dashboard → **Account** (or **Team**) → **Settings** → **General** → Team ID / Account ID. For personal accounts, use Account → General. |
| `VERCEL_PROJECT_ID`| Vercel Dashboard → your **Project** → **Settings** → **General** → Project ID.   |

---

## Supabase secrets (build-time env)

| Secret                   | Where to obtain                                                          |
|--------------------------|---------------------------------------------------------------------------|
| `VITE_SUPABASE_URL`      | Supabase Dashboard → **Project Settings** → **API** → Project URL.        |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → **Project Settings** → **API** → anon public key.    |
| `VITE_BEATIE_FEED_BOT_USER_ID` (optional but recommended) | Same UUID you set as `BEATIE_FEED_BOT_USER_ID` on the Supabase `ai_feed_reply` Edge Function — the **Auth user id** of the Beatie bot account. |

---

## Where each secret is used

| Secret                   | Used in                                | Purpose                                           |
|--------------------------|----------------------------------------|---------------------------------------------------|
| `VERCEL_TOKEN`           | Deploy step (`vercel deploy --token`)  | Authenticate Vercel CLI                           |
| `VERCEL_ORG_ID`          | Deploy step (`env`)                    | Target Vercel org/team                            |
| `VERCEL_PROJECT_ID`      | Deploy step (`env`)                    | Target Vercel project                             |
| `VITE_SUPABASE_URL`      | Build step (`env`)                     | Injected into client bundle at build time         |
| `VITE_SUPABASE_ANON_KEY` | Build step (`env`)                     | Injected into client bundle at build time         |
| `VITE_BEATIE_FEED_BOT_USER_ID` | Build step (`env`, optional) | Injected at build time so **Ask Beatie**, Beatie comment badges, and the bundled Beatie avatar on the feed match the bot user. If unset, those UI pieces are omitted even though localhost with `.env.local` shows them. |

**Vercel Dashboard (required for live site):** Add the same `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_APP_ENV` to **Vercel → Project → Settings → Environment Variables** (Production / Preview). Also add **`VITE_BEATIE_FEED_BOT_USER_ID`** there (Production) if you use Beatie on the community feed — value must be the bot’s Supabase Auth UUID (same as Edge Function `BEATIE_FEED_BOT_USER_ID`).

The GitHub Action runs `npm run build` locally for verification, then `vercel deploy --prod` triggers a **remote** build on Vercel; that build reads env vars from **Vercel**, not from GitHub. Without matching variables on Vercel, the deployed bundle can miss Supabase config or Beatie feed wiring.

**Supabase after deploy:** Add your production URL to **Authentication → URL Configuration** (Site URL and redirect URLs for `/auth/callback` and `/reset-password`). See the main README “Supabase URL Configuration” section.

---

## Quick checklist

1. Create a Vercel project (or link an existing one).
2. Add the required secrets to GitHub Actions (see table above).
3. Add matching **Production** variables on **Vercel** (including `VITE_BEATIE_FEED_BOT_USER_ID` if you use Beatie on the feed).
4. Push to `main` to trigger the workflow.
5. The production URL will appear in the Vercel deploy summary.

**Note:** Staging uses separate secrets. See [ci_secrets_staging.md](ci_secrets_staging.md) for `develop` deployments.
