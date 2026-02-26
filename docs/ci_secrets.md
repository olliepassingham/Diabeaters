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

---

## Where each secret is used

| Secret                   | Used in                                | Purpose                                           |
|--------------------------|----------------------------------------|---------------------------------------------------|
| `VERCEL_TOKEN`           | Deploy step (`vercel deploy --token`)  | Authenticate Vercel CLI                           |
| `VERCEL_ORG_ID`          | Deploy step (`env`)                    | Target Vercel org/team                            |
| `VERCEL_PROJECT_ID`      | Deploy step (`env`)                    | Target Vercel project                             |
| `VITE_SUPABASE_URL`      | Build step (`env`)                     | Injected into client bundle at build time         |
| `VITE_SUPABASE_ANON_KEY` | Build step (`env`)                     | Injected into client bundle at build time         |

---

## Quick checklist

1. Create a Vercel project (or link an existing one).
2. Add the five secrets to GitHub Actions.
3. Push to `main` to trigger the workflow.
4. The production URL will appear in the Vercel deploy summary.
