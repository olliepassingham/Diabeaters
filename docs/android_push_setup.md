# Android push (FCM) setup

Remote push on Android needs **Firebase** (client config in the app) and **Supabase** (server sends via FCM HTTP v1). Local reminders do **not** use Firebase.

**Package name (must match):** `com.passingtime.diabeaters`

---

## 1. Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) → **Add project** (or use an existing project).
2. **Project settings** → **Your apps** → **Add app** → **Android**.
3. Android package name: `com.passingtime.diabeaters`
4. App nickname: `Diabeaters` (optional).
5. **Register app** → download **`google-services.json`**.
6. Save the file here (not committed to git):

   ```
   android/app/google-services.json
   ```

7. **Recommended:** **Project settings** → **Integrations** → link **Google Play** (same app as Play Console). This keeps signing keys aligned.
8. **Recommended:** In the Android app card in Firebase → **Add fingerprint** → paste **SHA-1** from Play Console:
   - Play Console → **Test and release** → **App integrity** → **App signing key certificate** → SHA-1

FCM is enabled by default on new Firebase projects. If sends fail later, enable **Firebase Cloud Messaging API** in [Google Cloud Console](https://console.cloud.google.com/apis/library/fcm.googleapis.com) for the same project.

---

## 2. Service account for Supabase (server → FCM)

Edge Functions send push using a **service account JSON**, not the `google-services.json` file.

1. Firebase → **Project settings** → **Service accounts**.
2. **Generate new private key** → download JSON (keep private; never commit).
3. Supabase Dashboard → your **production** project → **Edge Functions** → **Secrets**:
   - Name: `FCM_SERVICE_ACCOUNT_JSON`
   - Value: paste the **entire** JSON file contents (one secret).
   - Optional: `FCM_PROJECT_ID` = `project_id` from that JSON if you prefer an explicit override.

4. Redeploy notify functions (from repo root):

   ```bash
   npm run supabase:deploy-notify-functions
   ```

---

## 3. Database migration

Apply on **production** Supabase (if not already):

- Migration: [`supabase/migrations/20260529160000_push_tokens_android.sql`](../supabase/migrations/20260529160000_push_tokens_android.sql)

Via CLI:

```bash
npx supabase db push
```

Or run the SQL in **Supabase → SQL Editor**.

This adds `register_android_push_token()` and allows `platform = 'android'` in `push_tokens`.

---

## 4. Rebuild and ship a new Android bundle

The Play build **in review (v6)** was built **without** `google-services.json`, so it cannot receive FCM until you ship an update.

1. Confirm `android/app/google-services.json` exists.
2. Bump version in `android/app/build.gradle` (e.g. `versionCode 7`, `versionName 1.0.6`).
3. Sync and build:

   ```bash
   cd ~/Diabeaters/Diabeaters
   npm run android:release:sync
   ```

4. Android Studio → **Build → Generate Signed Bundle/APK** → release **AAB**.
5. Upload to Play (Internal testing first, then Production when ready).

Gradle applies the Google Services plugin automatically when `google-services.json` is present (see `android/app/build.gradle`).

---

## 5. Test on a physical Android phone

1. Install the new build (Internal testing link or Production after approval).
2. Sign in to Diabeaters.
3. **Settings → Notifications** → enable push / notifications.
4. Allow the system notification permission when prompted.
5. **Send test push** (if hidden: **Settings → About** → tap **Version** seven times to unlock the test panel on remote `server.url` builds).
6. Put the app in the **background** and send again (foreground may not show a banner depending on OEM).

### Verify server config from your Mac

```bash
npm run verify:push
```

Requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_USER_JWT` (access token while signed in). See [`scripts/verify-push-notifications.mjs`](../scripts/verify-push-notifications.mjs).

### If push fails

| Symptom | Check |
|--------|--------|
| No token in DB | Signed in? Notifications enabled? `push_tokens` row with `platform = android` |
| `fcm_service_account_incomplete` in Edge logs | `FCM_SERVICE_ACCOUNT_JSON` secret set and valid JSON |
| HTTP 404 / PERMISSION_DENIED on FCM | Enable Firebase Cloud Messaging API; service account has access to project |
| Works on iOS, not Android | Separate: APNs vs FCM; Android needs new AAB with `google-services.json` |
| Old build | v6 without Firebase file will never register FCM correctly |

Supabase → **Edge Functions** → `notify_push_test` → **Logs** for delivery errors.

---

## Checklist

- [ ] `android/app/google-services.json` in place (gitignored)
- [ ] `FCM_SERVICE_ACCOUNT_JSON` in Supabase secrets
- [ ] `npm run supabase:deploy-notify-functions`
- [ ] Migration `20260529160000_push_tokens_android.sql` applied
- [ ] New AAB uploaded (versionCode > last Play upload)
- [ ] Test push on device (backgrounded)

Related: [android_build_checklist.md](./android_build_checklist.md), [play_store_launch_runbook.md](./play_store_launch_runbook.md) Phase 3.
