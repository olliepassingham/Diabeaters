# Universal Links / App Links (open shared https URLs in the app)

Shared community links stay **https** (`https://diabeaters.vercel.app/…`) so WhatsApp previews and people without the app still work. With Universal Links (iOS) and App Links (Android), devices that have Diabeaters installed can open those same URLs in the app.

## What’s in the repo

| Piece | Location |
|-------|----------|
| Apple association file | [`app/public/.well-known/apple-app-site-association`](../app/public/.well-known/apple-app-site-association) |
| Android Digital Asset Links | [`app/public/.well-known/assetlinks.json`](../app/public/.well-known/assetlinks.json) |
| iOS Associated Domains | `applinks:diabeaters.vercel.app` in `AppDebug.entitlements` / `AppRelease.entitlements` |
| Android intent filter | `https` + `diabeaters.vercel.app` with `android:autoVerify="true"` in `AndroidManifest.xml` |
| In-app routing | `pathFromOpenedAppUrl` + `appUrlOpen` in `App.tsx` |
| Share URLs | `buildPublicAppUrl()` so native shells never share `capacitor://` / localhost |

After deploy, files must be reachable at:

- https://diabeaters.vercel.app/.well-known/apple-app-site-association
- https://diabeaters.vercel.app/.well-known/assetlinks.json

## iOS (manual once + new build)

1. **Apple Developer** → Identifiers → `com.passingtime.diabeaters` → enable **Associated Domains**.
2. Xcode → Signing & Capabilities → confirm **Associated Domains** includes `applinks:diabeaters.vercel.app` (entitlements already list it; Team ID in AASA is `Q9528Z889A`).
3. Ship a new TestFlight / App Store build (association is part of the binary + on-device CDN cache).
4. Validate AASA: [Apple CDN](https://app-site-association.cdn-apple.com/a/v1/diabeaters.vercel.app) after the site is live, or paste a link in Notes and long-press → Open in Diabeaters.

## Android (fingerprints required for auto-open)

`assetlinks.json` currently has an empty `sha256_cert_fingerprints` array. Until you add fingerprints, Android may show an app/browser chooser instead of opening Diabeaters automatically.

1. Play Console → **Test and release** → **App integrity** → **App signing key certificate** → copy **SHA-256**.
2. Also add your **upload** key SHA-256 if you test sideloaded release builds, and optionally the debug keystore for local installs:
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```
3. Put colon-separated SHA-256 values into `app/public/.well-known/assetlinks.json`, redeploy the site, then reinstall / wait for verification:
   ```bash
   adb shell pm get-app-links com.passingtime.diabeaters
   ```

## Caveats

- **WhatsApp** often opens links in its in-app browser even when Universal Links are correct. Messages, Mail, Safari, and Chrome are more reliable.
- Recipients without the app still land on the website (expected).
- Changing AASA / assetlinks can take time to propagate (Apple CDN + Android verification cache).

## QA checklist

- [ ] AASA and assetlinks return JSON (not `index.html`) over https
- [ ] Share a post → link host is `diabeaters.vercel.app`
- [ ] On a device with the **new** iOS build installed: open the link from Notes / Messages → Diabeaters opens on that post
- [ ] On Android with fingerprints filled: same link opens the app without a chooser
