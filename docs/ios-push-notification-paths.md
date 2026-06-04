# iOS push notification paths (Diabeaters)

This document traces **how** remote notifications reach an iPhone, **what must be configured**, and **known limitations** in the current architecture.

## Prerequisites (all paths)

| Layer | Requirement |
|--------|-------------|
| **Apple** | App ID with Push Notifications; distribution signing; `aps-environment` production for App Store / TestFlight (`ios/App/App/AppRelease.entitlements`). |
| **Supabase Edge Functions** | Secrets `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY` (see `supabase/functions/_shared/deliver-ios-push.ts`). For **App Store / TestFlight** builds, **`APNS_USE_SANDBOX` must be unset or `false`**. Sandbox is only for debug tokens from Xcode. |
| **Optional** | `APNS_BUNDLE_ID` if not `com.passingtime.diabeaters`. Legacy relay: `PUSH_NOTIFICATION_API_URL` (+ optional key). |
| **Client (native iOS)** | User grants iOS permission; in-app **Notifications** on + **Push** on. `ensureIosPushRegistered()` (`app/src/lib/push-tokens.ts`) upserts the device token into `public.push_tokens`. On each return to the foreground, `IosPushForegroundSync` (`app/src/components/ios-push-foreground-sync.tsx`) calls `refreshIosPushRegistration()` so iOS can re-issue a token and the server prefs stay aligned (Apple expects periodic `registerForRemoteNotifications`). **Home-screen icon badge:** `NativeAppBadgeSync` sets the badge from unread bell + DM counts via the in-app **`AppIconBadge`** plugin (`ios/App/App/AppIconBadgePlugin.swift`) — do **not** call `@capawesome/capacitor-badge` on iOS (its `Badge.set()` re-requests badge-only permission and broke remote delivery). Android still uses `@capawesome/capacitor-badge`. **Visible alerts:** APNs includes `aps.badge` (at least `1`) plus `sound: "default"` (`deliver-ios-push.ts`). Capacitor `PushNotifications.presentationOptions` is `["badge","sound","alert"]` (`capacitor.config.ts`). Users must enable **Sounds** for Diabeaters in iOS Settings and avoid **Deliver Quietly** / the hardware mute switch. |
| **Cloud prefs** | Row in `notification_preferences` for the user. `prefs.push === true` is required for most pushes. On sign-in, `syncNotificationPreferences()` runs (`app/src/lib/auth-context.tsx`) so local settings are upserted to the cloud (not only when visiting Settings). |

Invoke failures from the app are logged with **`logEdgeInvokeFailure`** (`app/src/lib/dev-log.ts`) — check Safari Web Inspector / device logs for `[edge-invoke …]` if pushes are missing.

---

## Path A — Low / critical supply (`notify_supply_low` + `notify_supply_low_cron`)

Delivery is shared (`supabase/functions/_shared/supply-low-delivery.ts`): in-app `notifications` row (dedupe per supply/level/day) plus optional APNs when push is enabled and APNs is configured.

### A.1 — While the app runs (patient JWT → `notify_supply_low`)

| Step | Where |
|------|--------|
| 1 | `SupplyLowNotifyPoller` (`app/src/components/supply-low-notify-poller.tsx`) runs `runSupplyLowInAppNotifyScan` on mount, every **15 minutes** while the document is visible, on **visibility** return to foreground, and on **iOS app resume** (`App.addListener("appStateChange")`). |
| 2 | `runSupplyLowInAppNotifyScan` (`app/src/lib/supply-inapp-notify-scan.ts`) checks local `storage` notification settings (`enabled`, `supplyAlerts`), session, thresholds, and **edge crossing** vs persisted state in `localStorage`. |
| 3 | `invokeNotifySupplyLow` (`app/src/lib/invoke-notify-supply-low.ts`) POSTs to Edge Function **`notify_supply_low`** with the user JWT. |
| 4 | Handler (`supabase/functions/notify_supply_low/index.ts`) validates JWT, loads profile + carers + `notification_preferences`, then **`deliverSupplyLowAlerts`**. |

### A.2 — Scheduled / ops (service role → `notify_supply_low_cron`)

| Step | Where |
|------|--------|
| 1 | The app writes **`public.supplies.days_remaining_cached`** and **`supply_forecast_at`** from local usage (`writeSupplyForecastToCloud` in `app/src/lib/supplies.ts`) after cloud sync and from the supply scan loop so Postgres stays roughly in sync with device-computed days-left. |
| 2 | A **Supabase schedule** (or manual invoke) calls **`notify_supply_low_cron`** with **`Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`** (see function header in `supabase/functions/notify_supply_low_cron/index.ts`). |
| 3 | Cron selects supplies with `quantity > 0`, non-null cached days, and **`supply_forecast_at` not older than 84 hours**; loads each patient’s `notification_preferences`; maps days to low/critical using the same threshold fields as the client; calls **`deliverSupplyLowAlerts`**. |

**Limitation:** The cron path only considers rows with a **fresh** client-written forecast. If the patient never opens the app long enough that forecasts go stale, alerts for new crossings wait until the app runs again and refreshes `supply_forecast_at`. The in-app poller still handles immediate crossings while the app is active.

**Pharmacy hours (v1):** The cron and `notify_supply_low` text are intentionally **timezone-agnostic and pharmacy-agnostic**. The client's primary pharmacy + opening hours (`profiles.pharmacy`, see `app/src/lib/storage.ts` and `app/src/lib/pharmacy.ts`) only affect **in-app advice** — `getSmartPrescriptionAdvice` shifts the "collect by" wording when the natural deadline lands on a closed day, and `PharmacyCard` (`app/src/components/pharmacy-card.tsx`) renders Open / Closed status on Supplies and Travel. Server-sent push copy is unchanged. If we later want push notifications to mention pharmacy hours, that work plugs into `_shared/supply-low-delivery.ts` and would need a server-side timezone for the patient (currently not stored).

---

## Path B — Direct messages (`notify_dm_push`)

| Step | Where |
|------|--------|
| 1 | DB trigger `notify_dm_thread_members_on_message` inserts **in-app** rows for recipients (see `supabase/migrations/20260416120000_dm_message_inapp_notifications.sql`). |
| 2 | After `dm_messages` insert, client calls `supabase.functions.invoke("notify_dm_push", …)` (`app/src/lib/community/dm-supabase.ts`). |
| 3 | Edge handler (`supabase/functions/notify_dm_push/index.ts`) checks JWT, loads message + thread members, respects thread mute/hide and **`shouldDeliverDmPush`** (`enabled`, `dm_alerts`, `push`), then APNs to recipients’ tokens. |

**Note:** If the **invoke** fails, in-app may still exist from the trigger; push is the part that failed. Check logs for `[edge-invoke notify_dm_push]`.

---

## Path C — Feed / follows (`notify_feed_push`)

| Step | Where |
|------|--------|
| 1 | DB triggers insert in-app notifications where applicable. |
| 2 | Client invokes **`notify_feed_push`** after successful writes — e.g. `posts-supabase.ts` (likes, comments, mentions), `follows-supabase.ts` (new follower). |

Same prefs pattern: master + category + `push` in `notification_preferences`.

---

## Path D — Hypo carers (`notify_carers_on_hypo`)

Client/server invoke via `invokeNotifyCarersOnHypo` after logging a hypo (see `app/src/lib/invoke-notify-carers-hypo.ts`).

---

## Path E — Scenario started (`notify_scenario_started`)

Invoked when sick day / travel mode starts (`invoke-notify-scenario-started.ts`).

---

## Supabase CLI (`verify_jwt`)

`supabase/config.toml` sets `verify_jwt = false` for several notify functions; each handler validates `Authorization` with `auth.getUser(jwt)` instead. Deploy with:

`supabase functions deploy notify_supply_low --no-verify-jwt` and `supabase functions deploy notify_supply_low_cron --no-verify-jwt` (same pattern for other notify functions in `supabase/config.toml`). After deploy, add a **Cron** job (**Dashboard → Integrations → Cron**, or SQL with `pg_cron` + `pg_net`; see [Supabase: Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)) that POSTs `…/functions/v1/notify_supply_low_cron` with the **service role** bearer as documented in the function file.

---

## Automated checks (repo)

| Check | How |
|--------|-----|
| **REST tables** | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → `npm run verify:push -- --db-only` (or env vars without `--db-only` args — see script header). |
| **Edge + APNs + token** | `SUPABASE_URL` + `SUPABASE_ANON_KEY` + **`SUPABASE_USER_JWT`** (signed-in user `access_token`) → `npm run verify:push` — calls **`notify_push_test`**. |
| **SQL counts** | Run `docs/sql/verify_push_notifications_setup.sql` in **SQL Editor**. |
| **On device** | **Send test push** appears when: (1) the loaded bundle has **`VITE_SHOW_PUSH_TEST`** / staging / dev, or (2) on **native iOS** you unlock it under **Settings → About**: use **“Enable push test tools on this device…”** (confirm in the dialog), or tap the **version number 7 times** with less than ~2.5s between each tap. Then open **Settings → Notifications**. Because Capacitor **`server.url`** points at Vercel, deploy this UI to Vercel (or set `VITE_SHOW_PUSH_TEST` there) before the new controls appear on the phone. |

---

## Verifying in the Supabase Dashboard (no Mac terminal)

You can do almost everything from the Supabase project UI:

| What to check | Where in Supabase |
|-----------------|-------------------|
| **Tables & row counts** | **SQL** → **SQL Editor** → paste and run `docs/sql/verify_push_notifications_setup.sql`. Same aggregates as the CLI `--db-only` check (tokens, prefs, `push: true` count). |
| **Browse raw rows** | **Table Editor** → `push_tokens` (filter by `user_id`) and `notification_preferences` (confirm `prefs` includes `"push": true`). |
| **APNs / relay configured** | **Edge Functions** → **Manage secrets** — confirm `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY` exist (values are hidden). For TestFlight/App Store users, do **not** set `APNS_USE_SANDBOX` to `true`. |
| **End-to-end push (Edge → APNs)** | Trigger **`notify_push_test`** with a **real user JWT** in `Authorization: Bearer …` (same as the app would send). Options: **Edge Functions** → `notify_push_test` → use the dashboard’s **Invoke** / test request UI and add that header, or use an app build that shows **Send test push** (see table above), then open **Edge Functions** → `notify_push_test` → **Logs** to see success or `[apns] send failed`. |
| **`success: true` but `delivered_push: 0` and `tokens ≥ 1`** | The Edge Function found a DB token but **Apple rejected** the notification. Check the response **`detail`** (Apple JSON, e.g. `BadDeviceToken`) and **`http_status`**. Almost always **`APNS_USE_SANDBOX`** does not match the build (sandbox for Xcode debug; production for TestFlight/App Store), wrong **`APNS_BUNDLE_ID`**, or a **stale token** — delete the user’s `push_tokens` row and reopen the app after fixing secrets. |
| **Delivery errors** | **Edge Functions** → pick `notify_dm_push`, `notify_supply_low`, etc. → **Logs** after reproducing an action in the app. |

SQL alone cannot prove APNs accepts your Apple key (that needs an HTTP call to Apple), but it **does** prove the database side is wired. APNs is confirmed by **Edge logs** after a test invoke or a real app-triggered notification.

---

## Quick triage checklist

1. Supabase Dashboard → Edge Functions → Secrets: **`APNS_*`** set; **`APNS_USE_SANDBOX`** not `true` for production users.
2. Edge Function logs: `[apns] send failed` / `BadDeviceToken` → env or stale token.
3. Table **`push_tokens`**: row for `user_id` + `platform = ios` after opening the app signed in.
4. Table **`notification_preferences`**: `prefs` JSON includes **`"push": true`** for users who want remote alerts.
5. For supply: confirm user actually **foregrounded** the app after crossing low/critical, or accept current client-only scanning.
