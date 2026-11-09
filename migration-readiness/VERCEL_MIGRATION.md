# Vercel Audit

## Verified from local / repo

| Item | Evidence |
| --- | --- |
| Project name | `diabeaters` (`.vercel/project.json`) |
| Project ID | `prj_tXQDqU0xVeLdrekPQ9D0D8t3Aeve` |
| Team / org ID | `team_myIeKuQjJlMLWanPObnTdvkP` |
| Build config in repo | `vercel.json`: `npm ci`, `npm run build`, output `dist`, SPA rewrite, cache headers, apple-app-site-association / assetlinks headers |
| Production web URL used by Capacitor | `https://diabeaters.vercel.app` (`capacitor.config.ts`) |
| Deploy workflows | `.github/workflows/deploy-vercel.yml` (prod), `deploy-staging.yml` (staging) |

## Unverified from this audit (Dashboard required)

- [ ] Exact Production / Preview / Development environment variable **values** (CLI `vercel env ls` not successfully retrieved)
- [ ] Custom domains beyond `*.vercel.app` and DNS ownership
- [ ] Deployment protection / password / SSO
- [ ] Cron jobs on Vercel (most crons appear to be Supabase Edge / external HTTP, not Vercel Cron — confirm)
- [ ] Team membership: whether project is under a personal vs team account
- [ ] Git integration: which GitHub account/app installation connects the project
- [ ] Preview deployment settings and ignored build steps

## Env vars Vercel almost certainly holds (from workflows + `.env.example`)

At minimum (names only):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_FEATURE_COMMUNITY` (required `true` for community in prod builds)
- `VITE_PUBLIC_SITE_URL` (recommended)
- `VITE_BEATIE_FEED_BOT_USER_ID` (optional but used)
- `VITE_SENTRY_DSN` (optional)
- `VITE_SUPPORT_EMAIL` (optional)
- `VITE_TURNSTILE_SITE_KEY` (optional)
- `VITE_APP_ENV` / `VITE_SHOW_PUSH_TEST` (as needed)

Staging may use separate Supabase URL/anon key secrets in GitHub Actions.

## Cursor-only move

**No Vercel transfer needed.** Keep the same Vercel team/project. On a new machine:

1. [ ] `npx vercel link` to the same project (after Vercel login).  
2. [ ] Or rely on GitHub → Vercel auto-deploy from `main` (already the shipping path for Capacitor remote WebView).

## If transferring Vercel project ownership (Scope B)

1. Prefer inviting the new user into the **same Vercel team**.  
2. Reconnect GitHub if the GitHub user changes.  
3. Re-enter all env vars (Production + Preview + Development).  
4. Verify domain DNS still points correctly.  
5. Redeploy production and confirm `https://diabeaters.vercel.app` loads (native apps depend on it when not bundling web assets).

## Risk note

Native iOS/Android day-to-day builds load **remote** JS from Vercel production URL. Breaking Vercel production breaks the in-app experience even if App Store binaries are unchanged.
