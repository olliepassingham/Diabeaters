# Supabase projects: production vs staging

This doc explains how to name and wire Supabase projects so they match **Vercel** and **Auth** (including verification email). It fixes the common confusion: a project named “staging” in Supabase can still be the **only** database your **production** app talks to.

---

## What you have today (typical confusion)

| Supabase project        | Your screenshot | What it usually means |
|-------------------------|-----------------|------------------------|
| **Diabeaters**          | Paused          | Was intended as production, but **paused projects do not serve API/Auth reliably** — do not point a live app here until unpaused. |
| **Diabeaters (staging)**| Active (NANO)   | Often the **real** database behind `VITE_SUPABASE_URL` on Vercel — even though the name says “staging”. |

In the Supabase UI, **“main” + PRODUCTION** on a branch selector refers to Supabase’s **database branching** product, not “this is your company’s production environment.” Ignore that label unless you use paid branching; it does not replace a clear **project** strategy.

---

## Do you need two Supabase projects?

| Situation | Recommendation |
|-----------|----------------|
| Solo / small team, one live app | **One project** is enough: less cost, no drift, simpler Auth URLs. |
| You want risky SQL / migrations tested without touching real users | **Two projects**: production + staging (preview only). |

You do **not** need two projects just because Vercel has Production vs Preview — you need two only if you **want separate databases** for preview deploys.

---

## Pick a model and stick to it

### Model A — Single project (simplest)

1. Choose **one** Supabase project as the source of truth (e.g. your currently active one).
2. In Supabase **Settings → General**, consider renaming it to **`Diabeaters`** (or `Diabeaters production`) so it matches reality.
3. **Pause or ignore** the second project until you truly need it — or delete it after exporting anything important.
4. In **Authentication → URL Configuration** for **that** project:
   - **Site URL** = public app origin, e.g. `https://diabeaters.vercel.app`
   - **Redirect URLs** include `https://diabeaters.vercel.app/auth/callback` and `/reset-password`, plus `localhost:5173` entries for dev.
5. In **Vercel → Production** (and Preview if they share the same DB):
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` = **this** project’s API values.
   - `VITE_PUBLIC_SITE_URL` = **same origin** as Site URL (no trailing slash).
6. **Redeploy** after changing Vercel env vars.

Verification email only works if **every** signup hits the **same** project whose Auth settings you configured, and redirects match `VITE_PUBLIC_SITE_URL`.

### Model B — Production + staging (two databases)

| Layer | Supabase project | Vercel env |
|-------|------------------|------------|
| **Production** | `Diabeaters` (unpaused, dedicated) | Production: prod URL + anon key |
| **Preview / local** | `Diabeaters (staging)` | Preview + optional Development: staging URL + anon key |

Rules:

- **Never** leave production paused if `main` deploys still point at it.
- **Authentication → URL Configuration** must be set **per project**:
  - Production project: Site URL + redirects for **production** domain.
  - Staging project: Site URL + redirects for **preview** domain(s) and localhost.
- Set **`VITE_PUBLIC_SITE_URL`** per Vercel environment to the **hostname users open** for that build (prod domain on Production, preview URL on Preview if you test auth there).

See also [vercel_envs.md](vercel_envs.md) and [staging_supabase_setup.md](staging_supabase_setup.md).

---

## Verification email checklist (same for one or two projects)

Use the project whose URL is in **`VITE_SUPABASE_URL`** for that deploy:

1. **Authentication → Providers → Email** → **Confirm email** enabled.
2. **Authentication → URL Configuration** → **Site URL** and **Redirect URLs** match the live app (and `VITE_PUBLIC_SITE_URL`).
3. **Vercel** env vars set and a **new deployment** after changes.
4. Optional: **custom SMTP** in Supabase for best deliverability.

If mail still never arrives, use **[troubleshooting_auth_email.md](troubleshooting_auth_email.md)** (CAPTCHA, logs, SMTP, wrong project).

---

## Quick decision tree

- **“I only use Diabeaters (staging) and Diabeaters is paused”**  
  → Treat **staging** as your only DB **or** unpause production and migrate Vercel to prod keys. Until then, configure Auth on the **active** project and stop pointing anything at the paused one.

- **“I want production and staging data separate”**  
  → Unpause/configure **production** Supabase, point Vercel **Production** to it; point **Preview** to staging Supabase; duplicate Auth URL config on both with the right domains.

---

## Naming convention (recommended)

| Supabase project name (dashboard) | Purpose |
|-----------------------------------|---------|
| `Diabeaters` | Production database (matches Vercel Production) |
| `Diabeaters preview` | Optional; Vercel Preview / manual QA only |

Avoid naming the **only** live database “staging” if real users use it — it causes exactly the confusion you hit.
