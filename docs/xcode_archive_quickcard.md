# Xcode Archive Quick Card

Fifteen steps for Archive → Upload:

- Run `npm run preflight` before starting.
- Run `npm run build` then `npx cap sync` and `npx cap open ios`.
- Select **Any iOS Device (arm64)** as run destination.
- **Product** → **Archive**.
- In Organizer: **Validate App** – fix errors (no UIWebView, ATS OK, privacy manifest present).
- **Distribute** → **App Store Connect** → **Upload**.
- Bitcode is deprecated; do not enable it.
- Icons: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`.
- Launch screen: `ios/App/App/Base.lproj/LaunchScreen.storyboard`.
- Info.plist ATS: `ios/App/App/Info.plist` → `NSAppTransportSecurity` (HTTPS only).
- External links: use `@capacitor/browser` and `Browser.open()` to open in `SFSafariViewController`.
- Ensure `capacitor.config.ts` `server.url` points to the live Vercel deploy.
- Version: use `npm run version:patch` (or minor/major) to bump and sync to iOS.
