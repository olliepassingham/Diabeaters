# iOS push notification paths (Diabeaters)

This document traces **how** remote notifications reach an iPhone, **what must be configured**, and **known limitations** in the current architecture.

## Prerequisites (all paths)

| Layer | Requirement |
|--------|-------------|
| **Apple** | App ID with Push Notifications; distribution signing; `aps-environment` production for App Store / TestFlight (`ios/App/App/AppRelease.entitlements`). |
| **Supabase Edge Functions** | Secrets `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY` (see `supabase/functions/_shared/deliver-ios-push.ts`). For **App Store / TestFlight** builds, **`APNS_USE_SANDBOX` must be unset or `false`**. Sandbox is only for debug tokens from Xcode. |
| **Optional** | `APNS_BUNDLE_ID` if not `com.passingtime.diabeaters`. Legacy relay: `PUSH_NOTIFICATION_API_URL` (+ optional key). |
| **Client (native iOS)** | User grants iOS permission; in-app **Notifications** on + **Push** on. `ensureIosPushRegistered()` (`app/src/lib/push-tokens.ts`) upserts the device token into `public.push_tokens`. |
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

## Quick triage checklist

1. Supabase Dashboard → Edge Functions → Secrets: **`APNS_*`** set; **`APNS_USE_SANDBOX`** not `true` for production users.
2. Edge Function logs: `[apns] send failed` / `BadDeviceToken` → env or stale token.
3. Table **`push_tokens`**: row for `user_id` + `platform = ios` after opening the app signed in.
4. Table **`notification_preferences`**: `prefs` JSON includes **`"push": true`** for users who want remote alerts.
5. For supply: confirm user actually **foregrounded** the app after crossing low/critical, or accept current client-only scanning.
