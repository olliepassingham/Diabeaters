# Google Play launch runbook

Phased checklist to ship **Diabeaters** on Google Play. The Android app is a Capacitor shell (`com.passingtime.diabeaters`) that loads production web from [`capacitor.config.ts`](../capacitor.config.ts) (`server.url`). Store submission needs **Console + legal + production backend + signed AAB + QA** — not only a native build.

**Related docs**

| Topic | Doc |
|--------|-----|
| Technical Android steps | [android_build_checklist.md](./android_build_checklist.md) |
| iOS (parallel work) | [app_store_release.md](./app_store_release.md) |
| Data for Privacy / Data safety | [data_collection.md](./data_collection.md) |
| Regulatory positioning (counsel) | [regulatory/UK_EU_SaMD_wellness_checklist.md](./regulatory/UK_EU_SaMD_wellness_checklist.md) |
| Supabase auth URLs | [supabase_auth_self_serve.md](./supabase_auth_self_serve.md) |

**Quick commands**

```bash
npm run android:release:sync    # production web + cap sync android
npm run cap:android             # open Android Studio
npm run supabase:deploy-notify-functions
npm run icons:validate
```

---

## Phase 0 — Decide scope for v1.0

- [ ] **Launch with or without Android push?** Push needs Firebase + `google-services.json` + Supabase `FCM_SERVICE_ACCOUNT_JSON` (Phase 3). You can ship v1 without push and add it in a fast follow.
- [ ] **Production URL frozen** — currently `https://diabeaters.vercel.app` in `capacitor.config.ts`; confirm domain, SSL, and disclaimers on that host.
- [ ] **Legal review** (recommended): confirm “lifestyle / education, not a medical device” for UK/EU store copy — [UK_EU_SaMD_wellness_checklist.md](./regulatory/UK_EU_SaMD_wellness_checklist.md).

---

## Phase 1 — Accounts, URLs, and legal (Week 1)

### Google Play Console

- [ ] Create [**Google Play Developer**](https://play.google.com/console) account ($25 one-time).
- [ ] Create app → package name **`com.passingtime.diabeaters`** (must match Capacitor `appId`).

### Public URLs (required)

- [ ] **Privacy policy** live, e.g. `https://diabeaters.vercel.app/privacy` — content aligned with [data_collection.md](./data_collection.md).
- [ ] **Support URL** or support email visible in listing and in-app (Settings / About).
- [ ] **Account deletion** path documented (in-app Settings + support email); process tested once.

### Positioning (listing + in-app)

- [ ] Store description avoids diagnosis / cure / “replaces your doctor” language.
- [ ] In-app disclaimers visible on onboarding and Settings → About (production WebView).
- [ ] Prepare **reviewer notes**: demo account (email + password, email confirmed), how to log in, statement that app is educational lifestyle support.

---

## Phase 2 — Production backend (Week 1–2)

Shared with iOS; do this on your **production** Supabase project.

- [ ] All [migrations](../supabase/migrations/) applied (including `20260529160000_push_tokens_android.sql` if using Android push).
- [ ] Vercel production: `VITE_APP_ENV=production`, correct `VITE_SUPABASE_URL` / anon key.
- [ ] **Auth → URL configuration**: Site URL + redirect URLs for production web (`/auth/callback`, `/reset-password`) and native `diabeaters://` as needed — [supabase_auth_self_serve.md](./supabase_auth_self_serve.md).
- [ ] Email confirm / OAuth (Google, etc.) tested on production.
- [ ] Edge Functions deployed: `npm run supabase:deploy-notify-functions`.
- [ ] If **Sentry** enabled in production (`VITE_SENTRY_DSN`), declare crash/diagnostic data in Play **Data safety** (see Phase 4).

---

## Phase 3 — Firebase / FCM (optional for v1; required for Android push)

Skip entire phase if v1 ships without remote push on Android.

- [ ] Firebase project with Android app **`com.passingtime.diabeaters`**.
- [ ] Download `google-services.json` → `android/app/google-services.json` ([example](../android/app/google-services.json.example)).
- [ ] Enable Firebase Cloud Messaging.
- [ ] Supabase secrets: `FCM_SERVICE_ACCOUNT_JSON` (full service account JSON); optional `FCM_PROJECT_ID`.
- [ ] Redeploy notify Edge Functions after secrets change.
- [ ] Physical device: **Settings → Notifications → Send test push** succeeds.

---

## Phase 4 — Play Console forms (Week 2)

### Store listing

- [ ] App name, short description (80 chars), full description.
- [ ] **Feature graphic** 1024×500 PNG.
- [ ] **Phone screenshots** (min 2; capture on device or emulator at Play-required sizes).
- [ ] App icon: branded **adaptive icon** in `android/app/src/main/res/mipmap-*` (replace Capacitor placeholders) — source [`branding/appstore-icon-1024.png`](../branding/appstore-icon-1024.png), run `npm run icons:validate`.

### Policy forms

- [ ] **Data safety** — declare at minimum:
  - Account info (email, name) via Supabase Auth
  - Health-related **user-entered** data (e.g. glucose, treatments, supplies) stored with RLS
  - Push notification tokens if FCM enabled
  - Optional: Sentry crash data if DSN set in production
  - **No** ads / no cross-app tracking (per [data_collection.md](./data_collection.md))
- [ ] **Content rating** (IARC) — lifestyle / health support; not a regulated medical device in your positioning.
- [ ] **Target audience** age band + “Contains ads” = No (unless you add ads later).
- [ ] **News app / COVID / etc.** — answer honestly (typically No).

### App content declarations (Play policies)

- [ ] Declare sensitive permissions you use (camera, notifications) — must match [`AndroidManifest.xml`](../android/app/src/main/AndroidManifest.xml).
- [ ] If app offers health features, complete any extra health-related declarations Google prompts for (answer consistently with non-device positioning).

---

## Phase 5 — Build, sign, and upload (Week 2–3)

### Versioning

- [ ] Bump `versionCode` (integer, must increase every upload) and `versionName` in [`android/app/build.gradle`](../android/app/build.gradle).

### Sync and build

- [ ] Confirm [`capacitor.config.ts`](../capacitor.config.ts) `server.url` is production (not staging).
- [ ] Run:

  ```bash
  npm run android:release:sync
  npm run cap:android
  ```

- [ ] Android Studio → **Build → Generate Signed Bundle / APK** → **Android App Bundle (AAB)**.
- [ ] Create **upload keystore**; store backup and passwords securely.
- [ ] Enable **Play App Signing** in Console (recommended).

### Tracks

- [ ] Upload AAB to **Internal testing** first.
- [ ] Add testers (email list or Google Group).
- [ ] After QA, promote to **Closed testing** → **Production** (or staged rollout %).

---

## Phase 6 — Device QA (before production)

**Structured script:** [pre_launch_qa_script.md](./pre_launch_qa_script.md) (~30 min, scenarios + backup + auth).

Test on a **physical Android** device (Android 13+ recommended for notification permission).

### Install and auth

- [ ] Fresh install from Internal testing link.
- [ ] Sign up, email verification, login, password reset.
- [ ] Google OAuth completes and returns to app.
- [ ] `diabeaters://auth/email-verify` opens app from email link.

### Core product

- [ ] Dashboard, supplies, settings save.
- [ ] Hypo help, exercise tools, ratios — disclaimers visible; no broken flows offline/flaky network you care about.
- [ ] Community / camera / photo picker if you promote those features.

### Notifications

- [ ] Local reminders (exercise, appointments, scenarios) on Android 13+ with permission granted.
- [ ] Remote push (if Phase 3 done): DM, feed, carer, supply alerts with app backgrounded.

### Store build sanity

- [ ] App loads production web (not blank WebView / wrong host).
- [ ] No staging banners or debug-only UI on production URL.

---

## Phase 7 — Submit for review (Week 3)

- [ ] All Console sections show green checks (listing, content rating, data safety, app bundles).
- [ ] **Release notes** for first production version.
- [ ] **Countries/regions** selected.
- [ ] Reviewer contact email + demo credentials in “App access” if login required.
- [ ] Submit **Production** release (or start staged rollout e.g. 10% → 100%).

---

## After launch

- [ ] Monitor Play Console **Android vitals** (crashes, ANRs).
- [ ] Monitor Supabase / Sentry for auth and API errors.
- [ ] For each store update: bump `versionCode`, `npm run android:release:sync`, new AAB, release notes.
- [ ] Keep [data_collection.md](./data_collection.md) and Data safety answers in sync when you add features or SDKs.

---

## Common blockers

| Issue | Fix |
|--------|-----|
| Upload rejected: wrong package | Package must be `com.passingtime.diabeaters` everywhere |
| WebView blank | Check `server.url`, Vercel deploy, ATS/cleartext (cleartext is false) |
| OAuth fails on device | Production redirect URLs in Supabase + Google Cloud console |
| Push never arrives | `google-services.json`, FCM secret, migration, redeploy functions |
| Data safety mismatch | Update form when enabling Sentry, push, or new data types |
| Icons look generic | Replace adaptive icons; see [android_build_checklist.md](./android_build_checklist.md) |

---

## Owner checklist (one page)

| # | Done | Item |
|---|------|------|
| 1 | [ ] | Play Developer account + app created |
| 2 | [ ] | Privacy + support URLs live |
| 3 | [ ] | Production Supabase + Vercel verified |
| 4 | [ ] | FCM (if push) OR explicitly deferred |
| 5 | [ ] | Branded icons + store assets uploaded |
| 6 | [ ] | Data safety + content rating complete |
| 7 | [ ] | Signed AAB on Internal testing |
| 8 | [ ] | Physical device QA passed |
| 9 | [ ] | Production release submitted |
