# CI Secrets (Staging Deploy)

Staging deployments run on pushes to `develop`. Production runs on `main`.

---

## Where to add secrets

**GitHub** → your repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add each secret by name. Values are never displayed after saving.

---

## Vercel secrets (can be shared with production)

| Secret             | Where to obtain                                                                 |
|--------------------|----------------------------------------------------------------------------------|
| `VERCEL_TOKEN`     | Vercel Dashboard → **Account** (or Team) → **Settings** → **Tokens** → Create Token |
| `VERCEL_ORG_ID`    | Vercel Dashboard → **Account** (or **Team**) → **Settings** → **General** → Team ID / Account ID |
| `VERCEL_PROJECT_ID`| Vercel Dashboard → your **Project** → **Settings** → **General** → Project ID   |

The same Vercel project can host both production and staging. Staging deploys as **Preview**; production deploys as **Production**.

---

## Supabase secrets (staging project only)

| Secret                        | Where to obtain                                                                 |
|------------------------------|----------------------------------------------------------------------------------|
| `VITE_SUPABASE_URL_STAGING`  | Supabase staging project → **Project Settings** → **API** → Project URL          |
| `VITE_SUPABASE_ANON_KEY_STAGING` | Supabase staging project → **Project Settings** → **API** → anon public key |

These must point to your **staging** Supabase project, not production. See [staging_supabase_setup.md](staging_supabase_setup.md).

**`VITE_APP_ENV=staging`** is set by the workflow at build time (not a secret). Do not add it as a GitHub secret.

---

## Quick checklist

1. Create a Supabase staging project (see [staging_supabase_setup.md](staging_supabase_setup.md)).
2. Add the five secrets to GitHub Actions (or reuse Vercel secrets if already set for production).
3. Push to `develop` to trigger the staging workflow.
4. The staging URL will appear in the workflow summary (Preview deployment).

---

## Branch summary

| Branch   | Workflow           | Environment |
|----------|--------------------|-------------|
| `main`   | deploy-vercel.yml  | Production  |
| `develop`| deploy-staging.yml | Staging     |
