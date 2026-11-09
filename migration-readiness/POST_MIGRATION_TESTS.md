# Post-Migration Tests

Run after the new Cursor account can open the project. For **Cursor-only**, these prove the **dev environment**; production smoke is read-only (do not redeploy).

Also see the shorter after-sign-in section in `CURSOR_ONLY_MIGRATION_GUIDE.md`.

## A. Repository & tooling

- [ ] `git remote -v` shows `https://github.com/olliepassingham/Diabeaters.git`
- [ ] `git status -sb` → `main...origin/main` clean
- [ ] `git log -1 --oneline` matches expected tip on GitHub
- [ ] `migration-readiness/CURSOR_ONLY_MIGRATION_GUIDE.md` is present
- [ ] `npm ci` and `npm --prefix app ci` succeed
- [ ] `npm run check` (typecheck) succeeds
- [ ] `npm run test:unit` (or app vitest suite you normally use) succeeds

## B. Local app against existing Supabase

- [ ] Dev server starts without missing-env errors
- [ ] Login / session restore works with a test account (**Authentication**)
- [ ] Home / feed loads (**Database read**)
- [ ] Safe write: create a simple feed post or editable profile field (**Database write**)
- [ ] Optional: attach/view a photo (**Storage**)
- [ ] Optional: Coach / Beatie if enabled in this env

## C. Production smoke (unchanged services — no deploy)

- [ ] `https://diabeaters.vercel.app` loads (**Vercel deployment still works**)
- [ ] Login on production web
- [ ] Production URL unchanged (same hostname as before)
- [ ] `capacitor.config.ts` still targets `https://diabeaters.vercel.app`
- [ ] Native app (if installed) still loads remote shell
- [ ] Push path: only test in a safe QA build if needed

## D. Cursor-specific

- [ ] User Rules pasted and applied
- [ ] Extensions / skills restored as needed
- [ ] MCP servers re-added and authenticated
- [ ] Agent can read the repo and run commands
- [ ] Automations / Cloud Agents recreated only if you used them
- [ ] Archived chat/agent files still findable under `~/Documents/Diabeaters-private/` (reference)

## E. Secrets sanity (without printing values)

- [ ] Local env has `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- [ ] Env files remain untracked by git
- [ ] `android/app/google-services.json` present if you build Android
- [ ] Vercel / Supabase dashboards untouched for this migration

## Sign-off

| Role | Name | Date | Result |
| --- | --- | --- |
| Developer | | | Pass / Fail |
| Optional second check | | | Pass / Fail |

Only after **Pass** on A+B+C (smoke) + D (rules/MCP) should you retire the old Cursor account.
