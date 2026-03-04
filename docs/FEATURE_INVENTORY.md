# Diabeaters – Feature Inventory

*Report generated from repo scan. No code was modified.*

---

## 1. Routes & Implemented Features (with file paths)

| Route / area | File(s) | Description |
|--------------|---------|-------------|
| `/` | `client/src/pages/dashboard.tsx` | Dashboard: widgets, greeting, status pill, Help Now, Treated a Hypo, cloud supplies, setup prompt, backup reminder, welcome/discovery prompts, customise widgets |
| `/supplies` | `client/src/pages/supplies.tsx` | Supply tracker: local supplies CRUD, expiry/days remaining, pickup history; cloud supplies (Supabase) add/adjust/delete |
| `/scenarios` | `client/src/pages/scenarios.tsx` | Scenario hub: links to Bedtime, Travel, Sick Day |
| `/adviser` | `client/src/pages/adviser.tsx` | Activity Adviser: meal/exercise/bedtime tabs, AI advice via server |
| `/ai-coach` (beta) | `client/src/pages/ai-coach.tsx` | AI Coach chat; server `/api/ai-coach/chat` |
| `/community` (beta) | `client/src/pages/community.tsx` | Community: posts, replies, reels (local storage) |
| `/appointments` | `client/src/pages/appointments.tsx` | Appointments list (local); add/edit/delete |
| `/emergency-card` | `client/src/pages/emergency-card.tsx` | Emergency card view (profile + contacts) |
| `/settings` | `client/src/pages/settings.tsx` | Settings: profile, insulin/supply defaults, data & backup (export/import), notifications |
| `/help-now` | `client/src/pages/help-now.tsx` | Help Now: emergency guidance, contacts, quick actions |
| `/shop` (beta) | `client/src/pages/shop.tsx` | Shop placeholder |
| `/family-carers` (beta) | `client/src/pages/family-carers.tsx` | Carer links, permissions, privacy, activity log (local) |
| `/carer-view` (beta) | `client/src/pages/carer-view.tsx` | Carer dashboard view |
| `/ratios` | `client/src/pages/ratios.tsx` | Insulin ratios by meal, correction factor, target range, history/snapshots |
| `/account` | `client/src/pages/account.tsx` | Account: email, verification pill, display name, avatar upload, reset password, logout, request deletion (mailto) |
| `/login` | `client/src/pages/login.tsx` | Login: email/password, OAuth (Apple, Google, Microsoft) |
| `/signup` | `client/src/pages/signup.tsx` | Signup: email/password, OAuth; redirect to `/check-email` |
| `/auth/callback` | `client/src/pages/auth-callback.tsx` | OAuth callback; redirect to `/` or `/check-email` |
| `/reset-request` | `client/src/pages/reset-request.tsx` | Request password reset email |
| `/reset-password` | `client/src/pages/reset-password.tsx` | Set new password (guarded by session) |
| `/check-email` | `client/src/pages/check-email.tsx` | Email verification prompt; resend verification |
| `/onboarding` | `client/src/pages/onboarding.tsx` | Onboarding flow; struggle choice; redirect by path |
| `/privacy` | `client/src/pages/privacy.tsx` | Privacy policy (no auth) |
| `/support` | `client/src/pages/support.tsx` | Support (no auth) |
| Bedtime (under scenarios) | `client/src/pages/bedtime.tsx` | Bedtime readiness check, logs (local) |
| Travel | `client/src/pages/travel.tsx` | Travel mode: plan, packing list, holiday prep, activate/deactivate |
| Sick Day | `client/src/pages/sick-day.tsx` | Sick day mode: severity, journal, server sick-day calculation |
| Routines | `client/src/pages/routines.tsx` | Meal & exercise routines (local): add/edit/delete, meal-type filter |
| `/_shots` | `client/src/pages/shots.tsx` | Screenshot/capture (dev) |
| 404 | `client/src/pages/not-found.tsx` | Not found + link to dashboard |

---

## 2. Feature Details: Flows, Tables, Env, TODOs

### 2.1 Core flows

| Feature | Key user flows | Tables / storage | Env / TODOs |
|--------|----------------|------------------|--------------|
| **Dashboard** | View widgets, customise (show/hide, reorder, half/full), Help Now, Treated a Hypo, cloud supplies add/adjust/delete | Local: `storage` (widgets, profile, supplies, scenario, notifications, hypo treatments). Supabase: `supplies` (cloud). | — |
| **Supplies (local)** | Add/edit/delete supply, set type/quantity/daily usage, pickup date, quantity at pickup; depletion forecast; status critical/low/ok by days remaining | Local: `diabeater_supplies`, `diabeater_pickup_history`, `diabeater_settings` (for pack defaults). | — |
| **Supplies (cloud)** | List by user, add (name + quantity), update quantity, delete | Supabase: `supplies` (id, user_id, name, quantity, updated_at). RLS by auth.uid(). | `VITE_SUPABASE_*` |
| **Expiry / days remaining** | Computed from currentQuantity, dailyUsage, lastPickupDate, quantityAtPickup; getDaysRemaining, getSupplyStatus (critical ≤3d, low ≤7d); notifications via checkSupplyAlerts | Local supplies + settings. | — |
| **Routines** | Add/edit/delete routine; filter by meal type; recent/most used (dashboard widget) | Local: `diabeater_routines`, `diabeater_exercise_routines`. | — |
| **Reminders / notifications** | Supply alerts (critical/low) from checkSupplyAlerts; threshold days in notification settings; bell UI, mark read, dismiss; no push/scheduled reminders | Local: `diabeater_notifications`, `diabeater_notification_settings`, `diabeater_last_notification_check`. | — |
| **Ratios** | View/edit ratios (breakfast, lunch, dinner, snack), correction factor, target range; ratio history/snapshots, restore | Local: `diabeater_settings`, `diabeater_ratio_history`. | — |
| **Activity Adviser** | Meal/exercise/bedtime tabs; submit activity; get advice from server | Local: profile, settings, activity logs. Server: `/api/activity/advice`. | Server: `OPENAI_API_KEY` |
| **Sick Day** | Set severity, log journal, get correction/ratio suggestion from server | Local: scenario state, sick day journal. Server: `/api/sick-day/calculate`. | Server: — |
| **Travel** | Create plan, packing list, holiday prep; activate/deactivate travel mode; travel banner with days remaining | Local: `diabeater_travel_plan`, `diabeater_travel_packing_list`, `diabeater_holiday_prep`, `diabeater_scenario_state`. | — |
| **Bedtime** | Run checklist, log bedtime check | Local: `diabeater_bedtime_logs`, scenario state. | — |
| **Appointments** | Add/edit/delete appointments (local) | Local: `diabeater_appointments`. | — |
| **Emergency / Help Now** | View emergency card; contacts; quick actions | Local: `diabeater_emergency_contacts`, profile. | — |
| **Settings** | Profile (name, DOB, diabetes type, etc.), insulin/supply defaults, notification thresholds, export/import backup | Local: all `STORAGE_KEYS`; export/import JSON. | — |
| **Backup / restore** | Export all data to JSON; import from file (replaces data, then reload) | `storage.exportAllData()`, `storage.importAllData()`; last backup date for reminder. | — |

### 2.2 Data & storage

| Feature | Key user flows | Tables / storage | Env / TODOs |
|--------|----------------|------------------|--------------|
| **Supabase Auth** | Sign up, log in, OAuth, password reset, verify email, resend verification, logout | Supabase Auth. | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **Profiles (Supabase)** | getProfile, upsertProfile (full_name, avatar_url); onboarding_complete | Supabase: `profiles` (id, onboarding_complete, full_name, avatar_url). RLS: select/insert/update own. SQL: `docs/sql/onboarding.sql`, `docs/sql/profiles_extend.sql`. | Same as auth |
| **Avatars** | Upload to bucket, save path in profile, signed URL for preview | Supabase Storage: bucket `avatars`, path `avatars/{userId}/{timestamp}-{filename}`. RLS on storage.objects (select/insert/update/delete own). | Same as auth |
| **Local storage** | Single source for profile (mirrored from Supabase where used), settings, supplies, widgets, scenarios, notifications, routines, ratios, travel, bedtime, sick day, carers, hypo treatments, etc. | All keys under `client/src/lib/storage.ts` (`STORAGE_KEYS`). | — |
| **Drizzle schema (shared)** | Used for server/DB typing; not all tables used by client Supabase (e.g. `users`/`user_profiles` vs auth + `profiles`). Client uses Supabase client for `profiles` and `supplies`. | `shared/schema.ts`: users, user_profiles, user_settings, dashboard_widgets, supplies, activity_logs, travel_plans, sick_day_logs, emergency_contacts, ai_audit_logs, ratio_reviews, community_* . | Server: `DATABASE_URL` (Drizzle/Postgres) |

### 2.3 Auth & onboarding

| Feature | Key user flows | Tables / storage | Env / TODOs |
|--------|----------------|------------------|--------------|
| **Onboarding** | Multi-step flow; struggle choice; completion stored; redirect to `/`, `/supplies`, `/adviser?tab=meal|exercise` by struggle | Supabase: `profiles.onboarding_complete`; fallback `diabeater_onboarding_completed` in localStorage. `client/src/lib/onboarding.ts`: getOrCreateProfile, setOnboardingComplete. | — |
| **Protected routes** | All app routes under `ProtectedLayout`: require auth + verified; else redirect to `/login` or `/check-email`. | Auth session. | — |
| **Account route** | `AuthOnlyLayout`: requires auth only (unverified can access /account). | — | — |
| **Verification** | requireVerified(user); check-email resend link; auth callback handles post-verify redirect. | Supabase Auth. | — |

### 2.4 UI / components

- **Widgets**: Supply summary, supply depletion, scenario status, settings completion, community, messages, activity adviser, ratio adviser, travel, sick day, help-now info, tip of day, appointments, routines, quick exercise. `client/src/components/widgets/*`.
- **Banners**: Offline, sick day, travel, active exercise. Staging/Dev banners.
- **Bottom nav, profile menu, notification bell, messages icon**: Main shell.
- **Discovery prompts / welcome widget**: Local storage for engagement and dismissed prompts.

---

## 3. Environment dependencies

| Variable | Where used | Purpose |
|----------|------------|---------|
| `VITE_SUPABASE_URL` | Client (supabase.ts, config check, auth, profile, supplies) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Client (same) | Supabase anon key |
| `VITE_APP_ENV` | Client (flags, staging banner, robots) | `development` / `staging` / `production` |
| `VITE_RELEASE_MODE` | Client (release-mode.ts) | Beta features (e.g. AI Coach, Community, Shop, Family carers) |
| `OPENAI_API_KEY` | Server (routes.ts) | Activity Adviser + AI Coach; 503 if missing |
| `NEWS_API_KEY` | Server (routes.ts) | Live news; fallback curated list if missing |
| `DATABASE_URL` | Server (db.ts), Drizzle config | Postgres (server-side; not used for client Supabase flows) |
| `PORT` | Server (index.ts) | Default 5000 |
| `BASE_URL` | Playwright | E2E base URL (default localhost:4173) |
| `STAGING_EXPECTED` | E2E (env.spec.ts) | Staging banner assertion |
| `SHOTS_BASE_URL` | Scripts | Screenshot capture |

---

## 4. Open TODOs / FIXMEs in code

- **Grep result**: No `TODO`, `FIXME`, `XXX`, or `HACK` comments found in the scanned codebase (`.ts`, `.tsx`, `.js`, `.md`).
- **Docs**: `docs/storage_avatars.md` lists rollout checklist items (e.g. “Account deletion Edge Function” as future; “Request account deletion” is mailto only).

---

## 5. Gaps (UX, error handling, tests)

### 5.1 UX / error handling

- **Cloud supplies**: Shown only on dashboard; no dedicated cloud-supplies page or sync status beyond “Loading…” / error toast. No retry UI.
- **Import backup**: Replaces all data then reloads; no confirm step or partial restore. Import errors surfaced only via toast.
- **Offline**: Offline banner exists; no systematic offline handling for Supabase calls (auth, profile, supplies); failures surface as toasts or silent fallbacks.
- **Account deletion**: Mailto only; no in-app flow or Edge Function.
- **Verification**: Unverified users see banner and can resend; no explicit “verified” success state after clicking magic link.
- **Server errors**: Activity Adviser / AI Coach return 503 or 500; client shows generic failure; no retry or fallback content.
- **Forms**: Many forms use toasts for errors; some (e.g. account name save) have aria-live; not all inputs have consistent inline validation or error state.

### 5.2 Tests

| Area | Coverage | Gaps |
|------|----------|------|
| **E2E** | `e2e/smoke.spec.ts`: app load, login form. `e2e/auth.spec.ts`: OAuth buttons, reset-request, reset-password no-session, auth callback. `e2e/account.spec.ts`: redirect when unauthenticated, headings/sections, placeholder avatar, avatar upload mock, name save, reset link, logout, account-delete link. `e2e/dashboard.spec.ts`: redirect, section headers, customise opens library, focus, layout. `e2e/env.spec.ts`: staging banner. | No E2E for: supplies (local or cloud) CRUD, scenarios/travel/sick day/bedtime flows, ratios, routines, settings backup/restore, onboarding flow, community, AI Coach, Help Now, appointments, family carers. |
| **Unit / integration** | No Jest/Vitest (or similar) test files found in the repo. | No unit tests for storage helpers, getDaysRemaining/getSupplyStatus, auth helpers, or API client usage. |
| **Server** | No server test suite found. | No tests for `/api/activity/advice`, `/api/ai-coach/chat`, `/api/sick-day/calculate`, `/api/news`. |

---

## 6. Checklist (grouped)

### Core flows

- [x] Dashboard: view, customise widgets, Help Now, Treated a Hypo, cloud supplies
- [x] Supplies: local CRUD, expiry/days remaining, status (critical/low/ok), depletion view
- [x] Supplies: cloud list, add, update quantity, delete (Supabase)
- [x] Routines: meal & exercise routines CRUD, filters
- [x] Ratios: view/edit by meal, correction factor, target range, history/snapshots
- [x] Activity Adviser: meal/exercise/bedtime, server-backed advice
- [x] Sick Day: severity, journal, server calculation
- [x] Travel: plan, packing list, holiday prep, activate/deactivate
- [x] Bedtime: checklist, logs
- [x] Appointments: local CRUD
- [x] Emergency card / Help Now: contacts, guidance
- [x] Settings: profile, defaults, notifications, export/import backup
- [ ] Cloud supplies: dedicated page or sync status UX
- [ ] Import backup: confirmation step and/or partial restore

### Data & storage

- [x] Local storage: all STORAGE_KEYS used for app state
- [x] Supabase: auth, profiles (onboarding_complete, full_name, avatar_url), supplies table
- [x] Supabase Storage: avatars bucket, RLS, signed URLs
- [x] Export/import: full backup JSON
- [ ] Account deletion: in-app or Edge Function (currently mailto)

### Auth & onboarding

- [x] Login/signup: email+password, OAuth (Apple, Google, Microsoft)
- [x] Password reset: request link, set new password (guarded)
- [x] Email verification: check-email, resend, requireVerified redirect
- [x] Onboarding: flow, struggle choice, redirect, Supabase + localStorage fallback
- [x] Protected vs auth-only layouts
- [ ] Post-verification success state in UX

### UI/UX polish

- [x] Dashboard: layout, section headers, cards, accessibility (aria, focus rings, data-testids)
- [x] Account: layout, verification pill, avatar placeholder/upload, aria-live
- [x] Banners: offline, sick day, travel, active exercise
- [ ] Consistent form validation and inline error display
- [ ] Offline handling for Supabase calls
- [ ] Retry/fallback for server errors (Adviser, AI Coach)

### Testing & reliability

- [x] E2E: smoke, auth, account, dashboard, env
- [ ] E2E: supplies (local + cloud), scenarios, ratios, routines, settings backup
- [ ] E2E: onboarding, community, AI Coach, Help Now
- [ ] Unit/integration tests for storage, auth, API usage
- [ ] Server API tests
