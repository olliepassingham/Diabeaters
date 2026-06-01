# Google Play / Android release checklist

Operational steps to ship the Capacitor Android shell. Like iOS, the native app loads the web UI from [`capacitor.config.ts`](../capacitor.config.ts) (`server.url`); production web + Supabase must match that URL.

Links: [Supabase auth (self-serve)](./supabase_auth_self_serve.md), [iOS release checklist](./app_store_release.md), [README](../README.md).

---

## 1. Google Play Console

- [ ] Google Play Developer account active
- [ ] App record: package **`com.passingtime.diabeaters`** (matches Capacitor `appId`)
- [ ] Store listing: title, short/full description, feature graphic, phone screenshots
- [ ] **Privacy policy URL** (required; reuse the same URL as App Store)
- [ ] **Data safety** form — align with Supabase auth, push tokens, health-related user-entered data (glucose, treatments)
- [ ] **Content rating** (IARC) — lifestyle / diabetes support; not a medical device
- [ ] **Target audience** and ads declaration
- [ ] Internal testing track created before production rollout

---

## 2. Firebase + FCM (push notifications)

- [ ] Create Firebase project (or link existing) with Android app **`com.passingtime.diabeaters`**
- [ ] Download **`google-services.json`** → `android/app/google-services.json` (see [`google-services.json.example`](../android/app/google-services.json.example))
- [ ] Enable **Firebase Cloud Messaging** for the project
- [ ] Create a **service account** with Firebase Cloud Messaging Admin (or use default Firebase Admin SDK service account)
- [ ] Supabase Edge Function secrets:
  - `FCM_SERVICE_ACCOUNT_JSON` — full service account JSON (single secret value)
  - optional `FCM_PROJECT_ID` — override if not inferring from JSON
- [ ] Run migration [`20260529160000_push_tokens_android.sql`](../supabase/migrations/20260529160000_push_tokens_android.sql) on your Supabase project
- [ ] Redeploy notify Edge Functions after secret changes
- [ ] Test with **Settings → Notifications → Send test push** on a physical Android device

APNs secrets (`APNS_*`) remain required for iOS; Android uses FCM only.

---

## 3. Capacitor + production URL

- [ ] [`capacitor.config.ts`](../capacitor.config.ts) `server.url` is your **final production** origin
- [ ] After each web release intended for a store build:

  ```bash
  npm run android:release:sync
  ```

- [ ] Open Android Studio: **File → Open** → `android/`
- [ ] Build **debug APK** for device smoke test, then **signed release AAB** for Play upload

---

## 4. Signing

- [ ] Create upload keystore (keep backup and passwords secure)
- [ ] Configure signing in Android Studio (**Build → Generate Signed Bundle / APK**)
- [ ] Enable **Play App Signing** in Play Console (recommended)
- [ ] Bump `versionCode` / `versionName` in `android/app/build.gradle` before each upload

---

## 5. Permissions & deep links

Verified in repo:

- `INTERNET`, `POST_NOTIFICATIONS`, `CAMERA`, `VIBRATE`, exact-alarm permissions in [`AndroidManifest.xml`](../android/app/src/main/AndroidManifest.xml)
- Deep link intent filter for **`diabeaters://`** (auth email verify + in-app navigation)

Manual QA:

- [ ] OAuth sign-in (Google) completes and returns to app
- [ ] Email verification link opens app via `diabeaters://auth/email-verify`
- [ ] Camera / photo picker works on community posts and profile
- [ ] Local reminders (exercise, appointments, scenarios) fire on Android 13+
- [ ] Remote push (DM, feed, carers, supply) with app backgrounded

---

## 6. Supabase (shared with iOS)

- [ ] Migrations applied including Android push token support
- [ ] Auth redirect URLs include production web + native scheme as needed
- [ ] Edge Functions deployed (`npm run supabase:deploy-notify-functions`)

---

## Quick commands

| Step | Command |
|------|---------|
| Sync web + Android native project | `npm run android:release:sync` |
| Open Android Studio | `npm run cap:android` |
| Deploy notify functions | `npm run supabase:deploy-notify-functions` |
| Validate iOS icons (also source for Play assets) | `npm run icons:validate` |

---

## Play Store assets

Reuse branding from [`branding/appstore-icon-1024.png`](../branding/appstore-icon-1024.png):

- **Adaptive icon** — foreground + background layers in `android/app/src/main/res/mipmap-*`
- **Feature graphic** — 1024×500 PNG for Play listing
- **Phone screenshots** — capture from physical device or emulator at required sizes

The default Capacitor launcher icons are placeholders until you replace them with branded adaptive icons.
