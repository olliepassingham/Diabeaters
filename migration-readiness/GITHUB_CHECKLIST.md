# GitHub Backup Checklist

## Verified at audit / final-prep time

| Check | Result |
| --- | --- |
| App working tree | Clean relative to `8fee532` except `migration-readiness/` until that pack is committed |
| `main` synced with `origin/main` | Yes at `8fee532` before the docs commit; re-verify after push |
| Remote | `origin` → `https://github.com/olliepassingham/Diabeaters.git` |
| Tags | **None** found |
| Submodules | None |
| Git LFS | None |
| GitHub Actions workflows in repo | `ci.yml`, `deploy-vercel.yml`, `deploy-staging.yml`, `deploy-supabase-edge-functions.yml` |
| Migration docs | Must be committed + pushed so a fresh Cursor clone includes `CURSOR_ONLY_MIGRATION_GUIDE.md` |

## Local branches (not all equal production)

| Branch | Upstream | Notes |
| --- | --- | --- |
| `main` | `origin/main` | Production source of truth — synced |
| `develop` | *(no upstream tracked locally)* | Staging branch historically; verify remote exists before discarding |
| `feature/*` several | Mostly tracking remotes | Confirm still needed |
| `cursor/cloud-agent-…` | Tracking remote | Cloud agent branch |
| `backup/origin-main-20260330-1409` | Points at `origin/main` but **ahead 2 / behind 864** | Stale backup — do not treat as current |
| `main-clean` | Tracking remote | Historical |

## Gitignored / local-only items that matter

Back these up **outside** GitHub (encrypted archive / password manager), never commit:

- [ ] `.env`
- [ ] `.env.local`
- [ ] `app/.env.local`
- [ ] `.vercel/project.json` (link IDs; optional if you can re-link)
- [ ] `android/app/google-services.json`
- [ ] Any local release keystores / provisioning profiles (if present outside repo — **unverified** exact paths)
- [ ] `supabase/.temp/` is disposable CLI state (can re-`supabase link`)

## Ignored build/cache (safe to lose)

`node_modules/`, `app/node_modules/`, `dist/`, `android/build/`, `ios/**/public/`, Playwright reports, `.DS_Store`.

## GitHub Actions secrets referenced by workflows (names only)

Values **unverified** here (`gh` not available). Confirm in GitHub → Settings → Secrets → Actions:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BEATIE_FEED_BOT_USER_ID`
- `VITE_SUPABASE_URL_STAGING`
- `VITE_SUPABASE_ANON_KEY_STAGING`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF` (optional override)

## Pre-switch GitHub backup actions

1. [ ] Confirm GitHub account ownership / org access for `olliepassingham/Diabeaters` will remain available after the Cursor move.
2. [ ] In GitHub UI: note visibility, branch protection, required checks, Environments, deploy keys, webhooks (**unverified** from CLI).
3. [ ] Optionally create a private mirror or download zip of `main` as belt-and-braces (GitHub is durable but not the only copy you should rely on for secrets).
4. [ ] Export Actions secret **names** and store values from your password manager / Vercel / Supabase dashboards into a private inventory (see `ENVIRONMENT_VARIABLES.md`).
5. [ ] Decide fate of stale local branches; push any unique commits you still need.
6. [ ] Do **not** assume PR review comments, Actions cache, or package registries transfer with Cursor — they live on GitHub.

## After opening the project on the new Cursor account

1. [ ] `git clone` (or add remote) and `git status -sb` shows clean `main...origin/main`.
2. [ ] `git log -1` matches expected tip.
3. [ ] Restore local env files from your private backup.
4. [ ] `npm ci && npm --prefix app ci` succeeds.
