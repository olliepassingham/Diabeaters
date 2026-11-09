# Diabeaters — Post-Migration Health Check

**Date:** 9 November 2026
**Scope:** Full health check after moving the project to a new Cursor account (Cursor-only migration; GitHub, Supabase, Vercel, Apple and Google accounts unchanged).
**Repo state at check:** `main` at `479b632`, in sync with `origin/main`. Fixes from this check were committed and pushed with your approval (see section 13).
**Production URL:** https://diabeaters.vercel.app (unchanged).

## Overall verdict: AMBER

The **Cursor migration itself caused no breakage.** The full project is present, the toolchain works, the app builds, all 1,736 unit tests pass (after the local fixes), production is unchanged and serving, and the mobile app configuration (app IDs, production URL, entitlements) is intact.

It is AMBER rather than GREEN because the check found **pre-existing** problems that need your action, and because authenticated flows could not be tested end-to-end safely:

1. **Edge Functions are not deploying** (GitHub secret `SUPABASE_ACCESS_TOKEN` invalid since 13 Oct 2026). The Supporter CGM Share feature is broken in production as a result.
2. **Two production bugs** were found and fixed (pushed; Vercel deploy succeeded) but the fixes have **not been live-tested** while signed in: pump users crashed when saving a bedtime check, and new users' chosen @handle was never saved (blocking them from posting/liking/commenting). Users who signed up since 20 Oct still need to set a handle.
3. **Authenticated flows are BLOCKED**, not passed — there is no non-production Supabase environment or test account, and testing against production would have meant writing to real user data.
4. **Vercel dashboard checks are BLOCKED** — the Vercel CLI is not logged in on this machine.

Status key: **PASS** = actually tested and worked. **FAIL** = tested and broken. **NOT TESTED** = not exercised. **BLOCKED** = could not be tested safely or lacked access.

---

## 1. Overall application health

| Area | Result | Notes |
|---|---|---|
| Project complete in new Cursor workspace | PASS | Full repo present at `/Users/olliepassingham/Diabeaters/Diabeaters`, git history intact, `main` == `origin/main`. |
| TypeScript typecheck (`npm run check`) | PASS (after fix) | Was FAIL with 8 errors (pre-existing; CI red on every push). 0 errors after local fixes. |
| Unit tests (`npx vitest run`) | PASS (after fix) | 269 files / 1,736 tests pass. Was 4 failing (test-setup issue, pre-existing). |
| Production web build (`npm run web:build`) | PASS | Built in ~16s; robots, AASA, assetlinks, service worker generated. Warning: some chunks > 500 kB. |
| ESLint | NOT TESTED | No ESLint config or `lint` script exists in the repo. |
| End-to-end tests (Playwright, local build + route mocks) | FAIL | 13 passed / 36 failed. Suite is stale versus current UI (selectors / copy) and not run in CI. Pre-existing, not migration related. |
| Production site reachable and rendering | PASS | See section 5. |

**Feature inventory (from the router in `app/src/App.tsx`):** onboarding and auth (welcome, signup, login, email verify, password reset, mode selection), dashboard and Help Now, insulin adviser and correction tool, ratios, CGM (settings, live view, near-future projection, patterns), scenario guides (exercise, bedtime, travel, driving, alcohol, sick day, pump failure), supplies and medications, routines, hypo help and hypo history, education, emergency card, appointments, AI coach, community (feed, posts, profiles, @handles, messages, settings), support people (family carers, carer setup, carer view, supporter profile), notifications, settings (account, appearance, CGM, emergency, notifications, pharmacy, carb sources, usage, feedback, about), privacy and support pages.

**Documented but out of date:** `docs/FEATURE_INVENTORY.md` refers to an old `client/src` layout and OAuth sign-in; the current app is `app/src` with email/password auth. No documented feature was found to be missing from the code.

## 2. Development environment status

| Check | Result | Notes |
|---|---|---|
| Node.js | PASS | v24.13.1 installed; `.nvmrc` pins 20; `engines` requires `>=20`. Works, but CI uses 20 — consider `nvm use` locally for parity. |
| npm | PASS | 11.8.0. Harmless warning about unknown `devdir` npm config. |
| Dependencies installed (root and `app/`) | PASS | Both `node_modules` present; build and tests run. Duplicate `vitest` installs (root + app) — handled in test setup (see section 13). |
| Environment files present | PASS | `.env` / `.env.local` present at repo root with all required keys (checked for presence only — **no values printed**). Vite reads env from repo root, so `app/.env.local` is ignored by design. |
| Git remote and auth | PASS | `origin` = GitHub `olliepassingham/Diabeaters`; fetch works. 2 old stashes exist (untouched). |
| Cursor extensions | PASS | Minimal set (`anysphere.remote-ssh`). No project-required extensions. |
| Cursor project rules | PASS | Account rule "No move_agent_to_root for Diabeaters" honoured. No `.cursor/rules` in repo. |
| MCP servers | PASS (n/a) | No `mcp.json` (user or project). Built-in Cursor MCPs available (browser, Origin, app control). No Supabase/Vercel/GitHub MCP configured — none required. |
| Supabase CLI | PASS (via npx) | Not installed globally; `npx supabase` works. |
| Vercel CLI | BLOCKED | `npx vercel` 65.12.1 works but **not logged in**. |
| GitHub CLI (`gh`) | NOT TESTED | Not installed. GitHub Actions status was checked via the web/API instead. |
| Docker (for local Supabase) | BLOCKED | Not available — so no local Supabase stack for safe authenticated testing. |

## 3. GitHub status

| Check | Result | Notes |
|---|---|---|
| Repo synced, nothing unpushed | PASS | `main...origin/main`, no divergence before this check. |
| Migration docs on `main` | PASS | `42207ae`, `479b632`. |
| CI workflow (`ci.yml`: typecheck + unit) | FAIL → fixed | Was red on every push (8 TypeScript errors, then one env-dependent unit test). Typecheck passes in CI after `1d43021`; the unit test fix is in the follow-up commit. |
| Edge Functions deploy workflow | FAIL (pre-existing) | Failing since **13 Oct 2026** at "Verify Supabase auth" — the `SUPABASE_ACCESS_TOKEN` repo secret is invalid/expired. No function changes have shipped since. |
| Vercel deploy workflow | PASS (indirect) | Production is serving the current `main` bundle (bundle points at the correct Supabase project). |
| Secrets in tracked files | PASS | Scan found no keys/tokens committed. |

## 4. Supabase status

Project: ref `ffgcivxvbtdlmfnttwjm`. **Note:** it is labelled "Diabeaters (staging)" in the dashboard but **is production**. A second project named "Diabeaters" is paused. No genuine non-production project exists.

| Check | Result | Notes |
|---|---|---|
| Connectivity (REST / OpenAPI) | PASS | 41 tables/views and 23 RPCs exposed. |
| Anonymous RLS isolation | PASS | Anonymous key read **0 rows** from all 41 tables — no public data leak. |
| Edge Functions reject unauthenticated calls | PASS | Return `401 Missing authorization header`. |
| Cron-secret functions fail closed | PASS | Reject calls without a valid secret. |
| `supporter_cgm_share` + cron function deployed | FAIL | **404 — not deployed** (blocked by the CI token issue). |
| Migrations applied | FAIL (partial) | `20261007193000_patient_supporter_cgm_poll.sql` (table missing) and `20260529140000_profiles_app_region.sql` (`app_region` / `emergency_number` columns missing) are **not applied**. App tolerates the missing columns (region sync silently skipped). |
| Migration history tracking | FAIL (pre-existing) | Remote migration history table not populated; duplicate timestamp `20260617120000` in `supabase/migrations/`. |
| Unknown remote function `dynamic-responder` | NOT TESTED | Exists remotely but not in the repo — likely a dashboard leftover. Review and delete if unused. |
| Edge Function secrets | FAIL (partial) | Missing: `SUPPORTER_CGM_SHARE_CRON_SECRET`, `NOTIFY_SUPPORTER_APPT_CRON_SECRET`, `FCM_PROJECT_ID`, `APNS_BUNDLE_ID` (names only checked). |
| Auth (sign-up / login / sessions) | BLOCKED | See section 6. |
| Authenticated DB reads/writes, triggers | BLOCKED | No non-production database; not tested on production per your rules. |
| Storage (avatars, feed photos) | BLOCKED | Requires an authenticated user. |
| Realtime | BLOCKED | Requires an authenticated session. |
| Schema changes / migrations applied by this check | — | **None.** Read-only probes only. |

## 5. Vercel status

| Check | Result | Notes |
|---|---|---|
| https://diabeaters.vercel.app reachable | PASS | Loads over HTTPS. |
| Public routes, desktop + iPhone emulation | PASS | `/welcome`, `/login`, `/signup`, `/reset-request`, `/privacy`, `/support`, and an unknown route (404 page) all render with **no console errors**. |
| Production bundle points at correct Supabase project | PASS | Verified in the served JS. |
| Security headers | FAIL (pre-existing) | No Content-Security-Policy, X-Frame-Options or X-Content-Type-Options headers. |
| Vercel project settings, env vars, domains, deployments | BLOCKED | CLI not logged in. Nothing was changed. |
| Production URL unchanged | PASS | Still https://diabeaters.vercel.app (code, Capacitor config, AASA). |

## 6. Authentication test results

| Test | Result | Notes |
|---|---|---|
| Login / signup / reset pages render (production) | PASS | No console errors, desktop + mobile. |
| Sign up a new account | BLOCKED | Would create a real record in production. |
| Log in / log out / session persistence | BLOCKED | No test credentials; no non-prod environment. |
| Session restore / auth helper logic | PASS (unit) | `auth.spec`, `auth-post-login.spec`, `account-session-restore.spec` pass. Weak-network behaviour not re-tested live. |
| Password reset email delivery | BLOCKED | Would send real email from production. |
| Onboarding saves profile incl. @handle | FAIL → fixed | `upsertProfile` silently dropped `public_handle` (bug since 20 Oct 2026). Fixed and deployed; typecheck and full unit suite pass, but the fix itself is **not live-tested**. |

## 7. CGM integration test results

| Test | Result | Notes |
|---|---|---|
| CGM projection / trend logic | PASS (unit) | Covered in the 1,736 passing unit tests. |
| Dexcom / Libre live connection | BLOCKED | Needs real CGM credentials. |
| Dexcom fetch fix in Edge Functions | FAIL | Code is on `main` but **not deployed** (CI token issue). |
| Supporter CGM share | FAIL | Function not deployed (404) and its table is missing in production. |
| Dexcom password storage | FAIL (security) | Stored in plain text in browser `localStorage` (see section 11). |

## 8. Community feed test results

| Test | Result | Notes |
|---|---|---|
| Feed photo/video preparation and upload helpers | PASS (unit) | `prepare-post-image`, `upload-community-image`, `upload-feed-video`, `post-media-signed-urls`, `community-feed-cache` specs pass. |
| Create post, upload photo, like, comment (live) | BLOCKED | Would write to production. |
| Posting requires display name + @handle | NOT TESTED | Confirmed by code review only (`canEngageWithCommunityFeed`) — this gate is why the @handle bug blocked new users. |
| New users since 20 Oct can post | FAIL → fixed (not live-tested) | Their onboarding @handle was never saved, so they are blocked until they set one under Account. Fix restores saving; existing affected users still need to set a handle (no backfill possible — the value was never stored). |

## 9. All other feature test results

| Feature | Result | Notes |
|---|---|---|
| Bedtime guide — save check (pump users) | FAIL → fixed | `ReferenceError: pumpIobUnits is not defined` when a pump user saves. Fixed and deployed; not live-tested. |
| Bedtime guide — non-pump users | PASS (unit) | Readiness logic unit tests pass. |
| Exercise, travel, sick day, driving, alcohol, pump failure guides | PASS (unit) | Logic unit tests pass; UI not exercised while signed in. |
| Supplies / medications | PASS (unit) | Logic tests pass. |
| Support people (carers, carer view) | BLOCKED | Requires linked authenticated accounts. |
| Notifications / push delivery | BLOCKED | Needs devices + missing FCM/APNs secrets. |
| Insulin adviser / correction / ratios | PASS (unit) | Logic tests pass. |
| Privacy page | PASS (renders) | "Last updated" shows today's date dynamically — should be a fixed date. |
| General UX: public pages on mobile | PASS | iPhone emulation, no console errors. |

## 10. Capacitor compatibility

| Check | Result | Notes |
|---|---|---|
| App ID `com.passingtime.diabeaters` | PASS | Unchanged in `capacitor.config.ts`, Android `build.gradle`. |
| Remote URL `https://diabeaters.vercel.app` | PASS | In `capacitor.config.ts` and Android assets config. |
| iOS entitlements / Info.plist | PASS | Associated domains intact. Signing untouched. |
| iOS native config sync | FAIL (minor) | `ios/App/App/capacitor.config.json` is stale and `ios/App/CapApp-SPM/Package.swift` lacks the Browser/SplashScreen plugins — run `npx cap sync ios` before the next iOS build. |
| Android `assetlinks.json` | FAIL (minor) | Generated without SHA-256 fingerprints — Android App Links will not verify. |
| Native builds (Xcode / Gradle) | NOT TESTED | Not run as part of this check. |
| Capacitor npm advisory | FAIL (security) | `npm audit` reports a critical Capacitor advisory (proxy path); see section 11. |

## 11. Security findings

| Finding | Severity | Status |
|---|---|---|
| Anonymous RLS isolation | — | PASS (0 rows on all 41 tables). |
| No secrets in tracked files | — | PASS. |
| Edge Functions require auth; cron secrets fail closed | — | PASS. |
| `npm audit` — root: 4 critical, 13 high, 5 moderate; app: 2 critical, 10 high, 4 moderate | MEDIUM | Not fixed — you asked for no automatic upgrades. Includes Capacitor, `tar`, `proxy-addr`. Many are build-time / legacy Express server only. |
| Dexcom Share password in plain-text `localStorage` | MEDIUM | Not fixed — needs a design decision (e.g. iOS Keychain / Android Keystore via a secure-storage plugin). |
| No CSP / X-Frame-Options / nosniff headers on Vercel | MEDIUM | Not fixed — production config change, needs your approval and testing. |
| Unknown remote function `dynamic-responder` | LOW | Review. |
| Test report contains no real user data | — | PASS — only synthetic/anonymous probes used. |

## 12. Problems identified

All problems below are **pre-existing** — none were caused by the Cursor migration.

| # | Problem | Severity |
|---|---|---|
| 1 | Edge Functions CI deploy broken (invalid `SUPABASE_ACCESS_TOKEN` secret since 13 Oct) | HIGH |
| 2 | Supporter CGM Share broken in production (function not deployed, table missing) | HIGH |
| 3 | Bedtime check crashes on save for pump users | HIGH |
| 4 | Onboarding @handle never saved → new users since 20 Oct blocked from feed engagement | HIGH |
| 5 | CI typecheck red on every push (8 TS errors) | MEDIUM |
| 6 | 4 unit tests failing (jest-dom matchers + missing `matchMedia` in test setup) | MEDIUM |
| 7 | Migrations not applied (`app_region`/`emergency_number`, supporter CGM poll); migration history untracked; duplicate timestamp | MEDIUM |
| 8 | npm audit criticals | MEDIUM |
| 9 | Dexcom password in plain text | MEDIUM |
| 10 | Missing security headers | MEDIUM |
| 11 | Missing optional Edge Function secrets | MEDIUM |
| 12 | E2E suite stale (13/49 pass), not in CI | MEDIUM |
| 13 | `assetlinks.json` without fingerprints; iOS native config needs `cap sync` | LOW |
| 14 | Status-strip `inert` attribute never applied under React 18 (duplicate marquee copy remains focusable/tappable) | LOW |
| 15 | Privacy "Last updated" date is dynamic | LOW |
| 16 | Docs out of date (`FEATURE_INVENTORY.md`); Supabase project naming ("staging" is production) | LOW |
| 17 | Large JS chunks (> 500 kB) | LOW |

## 13. Problems fixed

All changes are minimal, preserve existing behaviour (other than fixing the bugs), and touch no production database, settings or secrets.

| File | Change | Why |
|---|---|---|
| `app/src/pages/bedtime.tsx` | `persistBedtimeCheck` now computes `parseOptionalBolusUnits(pumpIobInput)` instead of referencing an out-of-scope variable. | Fixes problem 3 (pump-user crash). |
| `app/src/lib/profile.ts` | `upsertProfile` accepts `public_handle` and saves it first via `updateProfile` (reusing its normalisation, availability check and "handle taken" message). A taken/invalid handle now returns an error **before** onboarding is marked complete. | Fixes problem 4. |
| `app/src/pages/adviser.tsx` | `getInitialMealTime` return type narrowed to the meal-time union. | Type-only. |
| `app/src/pages/routines.tsx` | `"max" as const` for `effortShape`. | Type-only. |
| `app/src/lib/insulin-clinical-access.ts` | `InsulinAccessProfile` fields made optional (all uses already use optional access). | Type-only. |
| `app/src/lib/cgm/near-future-projection.ts` | Removed an unreachable `method === "arrow"` branch (the blend never returns `"arrow"`). | Type-only; identical runtime result. |
| `app/src/components/app-status-strip.tsx` | Removed `inert` boolean prop. React 18 never rendered it (it only produced a dev warning), so the DOM is unchanged. | Type-only; see problem 14. |
| `app/src/test/setup.ts` | Registers jest-dom matchers on the test file's own `expect` and adds a default `window.matchMedia` stub for jsdom. | Fixes problem 6. |
| `app/src/lib/community/upload-community-image.spec.ts` | Mocks `getSupabaseUrlAndAnonKey` instead of stubbing env vars (which `supabase.ts` reads at import time). | Test only passed locally because of the real `.env`; failed in CI once typecheck stopped blocking the unit step. Reproduced in a clean checkout without `.env`. |

**Verification after fixes:** `npm run check` PASS (0 errors) · `npx vitest run` PASS (269 files, 1,736 tests), also in a clean checkout with no `.env` (matches CI) · `npm run web:build` PASS.

**Committed and pushed to `main` with your approval** (`1d43021`, report `c3a1102`, CI test fix in a follow-up commit). "Deploy to Vercel" succeeded on push, so the bedtime and @handle fixes are now live.

## 14. Outstanding issues (need your approval or action)

These involve production configuration, credentials, database migrations or deployment, so they were **not** done:

1. **Live-test the two bug fixes** while signed in: save a bedtime check as a pump user, and complete onboarding with a new synthetic account and confirm the @handle is saved.
2. **Rotate `SUPABASE_ACCESS_TOKEN`** in GitHub → Settings → Secrets → Actions (new token from Supabase → Account → Access Tokens), then re-run "Deploy Supabase Edge Functions". This ships the Dexcom fix and `supporter_cgm_share`.
3. **Apply the two missing migrations** to production (`20261007193000_patient_supporter_cgm_poll`, `20260529140000_profiles_app_region`) — production DB change; review first. Also repair migration history and the duplicate `20260617120000` timestamp.
4. **Set missing Edge Function secrets** (`SUPPORTER_CGM_SHARE_CRON_SECRET`, `NOTIFY_SUPPORTER_APPT_CRON_SECRET`, `FCM_PROJECT_ID`, `APNS_BUNDLE_ID`).
5. **Log in to the Vercel CLI** (`npx vercel login`) so env vars, domains and deployments can be verified read-only.
6. **Users affected by the @handle bug** (signed up since 20 Oct) will still need to set a handle in Account; consider an in-app nudge.
7. **Security headers** (CSP etc.) in `vercel.json` — production config change, needs testing.
8. **Dexcom password secure storage** — design decision.
9. **npm audit plan** — targeted, tested upgrades (Capacitor first).

## 15. Recommended next steps

1. Live-test the bedtime (pump user) and onboarding @handle fixes on production with a synthetic account.
2. Rotate the Supabase access token secret and re-run the Edge Functions workflow — this is the single biggest integration gap.
3. Create a real **non-production Supabase project** (or rename the current one to make clear it is production) plus a synthetic test account, so authenticated flows (auth, feed posting, storage, carers, realtime) can be tested safely next time.
4. Log in to the Vercel CLI and re-run the Vercel checks.
5. Apply the missing migrations after review.
6. Before the next native release: `npx cap sync ios`, add Android signing fingerprints to `assetlinks.json`, run Xcode and Gradle builds.
7. Refresh the Playwright e2e suite and add it to CI.
8. Plan security work: headers, Dexcom secure storage, dependency upgrades.

### Final objective checklist

| Objective | Status |
|---|---|
| New Cursor account correctly configured | Yes |
| Complete project available | Yes |
| All integrations working | **No** — Edge Function deploys broken (pre-existing); Vercel not verified |
| No functionality lost in migration | Yes — no migration-related regressions found |
| Application builds successfully | Yes |
| Production unaffected | Yes — nothing deployed or changed |
| Mobile configuration intact | Yes (needs routine `cap sync` before next iOS build) |
| Safe to continue developing | Yes |
