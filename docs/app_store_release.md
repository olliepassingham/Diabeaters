# App Store release checklist

Operational steps to finish before submitting the iOS app. The native shell loads the web app from [`capacitor.config.ts`](../capacitor.config.ts) (`server.url`); production web + Supabase must match that URL.

Links: [Supabase auth (self-serve)](./supabase_auth_self_serve.md), [README environments / URLs](../README.md).

---

## 1. App Store Connect (`apple-connect`)

- [ ] Apple Developer Program membership active
- [ ] App record: bundle ID **`com.passingtime.diabeaters`** (see Capacitor config)
- [ ] Pricing, availability, regions
- [ ] Age rating questionnaire completed
- [ ] Export compliance (encryption) answered
- [ ] **App information**: subtitle, description, keywords
- [ ] **Support URL** (required)
- [ ] **Privacy policy URL** (required; must match declarations)
- [ ] Marketing URL (optional)
- [ ] Screenshots (required sizes) and optional preview video
- [ ] App icon complete in Xcode asset catalog
- [ ] **App Privacy** questionnaire (align with [`PrivacyInfo.xcprivacy`](../ios/App/App/PrivacyInfo.xcprivacy) and actual data use)
- [ ] **Review**: contact phone, **demo account** (email + password, email confirmed) if login required
- [ ] **Review notes**: how to test; state app is lifestyle support / not a medical device (see README Data & Safety)

---

## 2. Capacitor + production URL (`cap-prod-url`)

- [ ] [`capacitor.config.ts`](../capacitor.config.ts) `server.url` is your **final production** origin (not staging)
- [ ] Vercel (or host) production deploy uses **`VITE_APP_ENV=production`** and correct `VITE_SUPABASE_*` (see README)
- [ ] After each web release intended for a store build, run:

  ```bash
  npm run ios:release:sync
  ```

  (production web build + `npx cap sync ios`). Then open Xcode and archive.

- [ ] OAuth / email links: production domain in [Supabase URL configuration](../README.md#supabase-url-configuration-copypaste)

---

## 3. Production Supabase (`supabase-prod-auth`)

- [ ] All [migrations](../supabase/migrations/) applied to the **production** project (order documented if manual)
- [ ] **Authentication → URL Configuration**: Site URL + redirect URLs include production `https://YOUR_DOMAIN/auth/callback` and `/reset-password`
- [ ] Email provider + **Confirm email** as intended for launch
- [ ] **Sign in with Apple** enabled (Guideline 4.8 when Google/Microsoft OAuth exist): Supabase + Apple Developer Services ID / key / return URLs
- [ ] Google / Microsoft OAuth production client IDs and redirect URIs
- [ ] Custom **SMTP** if needed for deliverability
- [ ] [Edge Functions](../supabase/functions/) deployed if the app relies on them ([`supabase/README.md`](../supabase/README.md))

---

## 4. Privacy manifest and App Privacy (`privacy-align`)

- [ ] [`PrivacyInfo.xcprivacy`](../ios/App/App/PrivacyInfo.xcprivacy) matches data you collect (update in Xcode if needed using **Editor → Raw Keys and Values**; see [TN3184](https://developer.apple.com/documentation/technotes/tn3184-adding-data-collection-details-to-your-privacy-manifest))
- [ ] App Store Connect **App Privacy** answers match the manifest and third-party SDKs (e.g. Sentry, if used)
- [ ] **Health & Fitness** (or other categories): declare if users enter glucose, treatments, or similar tied to an account (local + cloud). Add missing types via Xcode’s allowed list rather than inventing strings
- [ ] [`Info.plist`](../ios/App/App/Info.plist): add usage descriptions before shipping features that need camera, photos, notifications, etc.

---

## 5. TestFlight and submission (`testflight-qa`)

- [ ] Xcode: version + build number bumped; signing / distribution certificate OK
- [ ] **Archive** → upload to App Store Connect
- [ ] **TestFlight** internal testing on a physical device
- [ ] Cold install: sign up, log in, password reset, OAuth (especially **Sign in with Apple**), core journeys (dashboard, supplies, account)
- [ ] Offline / flaky network if you advertise offline behavior (README)
- [ ] Push notifications path if enabled ([`ensureIosPushRegistered`](../app/src/lib/auth-context.tsx))
- [ ] External TestFlight (optional) then **Submit for Review**

---

## Quick commands

| Step | Command |
|------|--------|
| Web production build + sync iOS | `npm run ios:release:sync` (from repo root) |
| Open iOS project | `npm run cap:ios` |

---

## Out of scope here

- Trademark / display name conflicts
- In-app purchases / subscriptions (separate Connect setup)
