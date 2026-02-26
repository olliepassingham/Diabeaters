# iOS Build & App Store Submission Checklist

Use this checklist before archiving and submitting the Diabeaters iOS app to App Store Connect.

---

## 1. Preconditions

- [ ] **Xcode**: Use Xcode 15 or later (recommended: latest stable)
- [ ] **Apple Developer account**: Active membership at [developer.apple.com](https://developer.apple.com)
- [ ] **iOS Deployment Target**: Set to **15.0** or later in Xcode → Target → General → Minimum Deployments
- [ ] **macOS**: Run Xcode on a Mac; archiving requires a physical Mac

---

## 2. Versioning

- [ ] **CFBundleShortVersionString** (Marketing Version): Semantic version, e.g. `1.0.0`
  - Increment for public releases (major.minor.patch)
  - Set in Xcode → Target → General → Version
- [ ] **CFBundleVersion** (Build number): Integer that increases each build
  - Must be unique per build uploaded to App Store Connect
  - Set in Xcode → Target → General → Build
  - Example: `1`, `2`, `3`, or use date format `2026012601`

### Versioning scripts

Use `npm run version:patch`, `version:minor`, or `version:major` to bump `package.json` and sync to iOS (`MARKETING_VERSION` + increment `CFBundleVersion`).

---

## 3. Bundle Identifier

- [ ] Confirm **Bundle Identifier** is `com.passingtime.diabeaters`
- [ ] Ensure this App ID exists in [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers) (or create it)
- [ ] In Xcode: Target → Signing & Capabilities → Bundle Identifier

---

## 4. Signing & Capabilities

- [ ] **Signing**: Enable **Automatically manage signing**
- [ ] **Team**: Select your Apple Developer Team
- [ ] **Provisioning Profile**: Let Xcode generate or select a valid profile for `com.passingtime.diabeaters`
- [ ] Resolve any signing errors before archiving

---

## 5. Info.plist Keys

- [ ] **NSAppTransportSecurity** (ATS): Enforces HTTPS only
  - `NSAllowsArbitraryLoads` = `false`
  - `NSAllowsLocalNetworking` = `false`
  - Configured in `ios/App/App/Info.plist`:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
    <key>NSAllowsLocalNetworking</key>
    <false/>
</dict>
```

- [ ] **External links**: Capacitor loads the app from a remote URL. By default, links open in the WebView. To open external links in `SFSafariViewController`, add `@capacitor/browser` and call `Browser.open()` from the web app for outbound URLs.

---

## 6. Icons & Launch Screen

- [ ] **App icons**: See [/docs/icons_required.md](./icons_required.md) for exact sizes and placement in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- [ ] **1024×1024** icon required for App Store Connect (upload separately or ensure it's in the asset catalog)
- [ ] **Launch screen**: Capacitor uses `ios/App/App/Base.lproj/LaunchScreen.storyboard`
  - References `Splash` image from `Assets.xcassets/Splash.imageset/`
  - Background colour: `systemBackgroundColor` (edit in storyboard or replace `Splash` assets)
  - To change brand mark: Replace splash images in `Splash.imageset/` (2732×2732 px)

---

## 7. Build Steps

### Preflight before archive

Run once before opening Xcode:

```bash
npm run preflight
```

This runs: build, e2e tests (skips on failure), and icons validation.

### Sync and open

Run these in order:

```bash
npm run build
```

```bash
npx cap sync
```

```bash
npx cap open ios
```

Then in Xcode:

1. Select **Any iOS Device (arm64)** or **Generic iOS Device** as run destination
2. **Product** → **Archive**
3. Wait for archive to complete; Organizer will open

---

## 8. Distribution

- [ ] **TestFlight** (optional): Distribute → App Store Connect → Upload for internal/external testing
- [ ] **App Store submission**: Distribute → App Store Connect → Upload, then complete metadata in App Store Connect and submit for review

---

## 9. Post-Archive Validation

- [ ] **Validate app**: In Organizer, select archive → **Validate App** (fix any errors)
- [ ] **UIWebView**: Ensure no `UIWebView` usage (Capacitor uses `WKWebView`; if validation flags it, check dependencies)
- [ ] **Privacy manifest**: `PrivacyInfo.xcprivacy` is present in `ios/App/` (no tracking, minimal APIs declared)
- [ ] **Missing icons**: Verify all required icon sizes in `AppIcon.appiconset` (see icons_required.md)

---

## 10. App Store Connect Metadata

- [ ] Use [/docs/appstore_metadata.json](./appstore_metadata.json) as a template
- [ ] Fill in: `privacyPolicyUrl`, `marketingUrl`, `supportUrl`, `tradeRepresentativeContactInfo`
- [ ] Upload screenshots for required device sizes
- [ ] Add description, promotional text, keywords, copyright
- [ ] Set primary category (e.g. `HEALTH_AND_FITNESS`)
- [ ] Age rating: `4+`

---

## 11. Review Notes (Guideline 1.4.1 / Non-Medical App)

Use bullets from [/docs/app_review_notes.txt](./app_review_notes.txt). Add to **App Review Information** → **Notes**:

- Diabeaters is a **lifestyle companion** for people living with Type 1 diabetes. It provides organisation, supply tracking, and preparedness tools. It is **not a medical device** and does **not provide medical advice or dosing guidance**.
- Medical disclaimers are shown during onboarding and in **Settings → About**. The app avoids diagnosis, treatment, or cure language.
- Test account: Reviewers can sign up with any email/password via the in-app flow (no demo credentials needed).
- All content is served over HTTPS. External links open in `SFSafariViewController`.

---

## 12. Final Smoke Checks

- [ ] **Deep links**: If you support Universal Links, verify they resolve correctly
- [ ] **External links**: Confirm outbound links open in Safari / `SFSafariViewController` (add `@capacitor/browser` if not already wired)
- [ ] **HTTPS**: No non-HTTPS requests; ATS blocks cleartext
- [ ] **Live site**: Ensure `https://diabeaters.vercel.app` is live and includes disclaimers (onboarding + Settings → About)
