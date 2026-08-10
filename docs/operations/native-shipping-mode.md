# Native shipping mode

## Decision (live iteration — current default)

**Day-to-day iOS + Android sync loads the live production web app from Vercel** (`https://diabeaters.vercel.app`).

Push to `main` → Vercel deploys → open/refresh the native app → you see the new UI **without** rebuilding (same behaviour on Apple and Android).

| Mode | Command | Cold start | Live web deploys |
|------|---------|------------|------------------|
| **Remote (default sync)** | `npm run ios:release:sync` / `npm run android:release:sync` | Needs network | Instant via Vercel |
| **Bundled (store archive)** | `npm run ios:release:sync:bundled` / `npm run android:release:sync:bundled` | Fast, offline UI | Needs new binary or Capgo OTA |

Do **not** point store archives at staging URLs.

## One-time: install a remote-mode binary

Remote config lives in the native project after sync. If your phone still has an old **bundled** install, rebuild and reinstall once:

```bash
# Android
npm run android:release:sync
npm run cap:android
# then Run on device in Android Studio

# iOS (already remote in this repo’s last sync)
npm run ios:release:sync
# then Archive / Run from Xcode
```

After that install, git pushes that deploy to Vercel update both apps automatically.

## Capgo / OTA (optional later)

To keep **bundled** store binaries but still patch JS without resubmitting:

1. Create a Capgo app and channel.
2. Add `@capgo/capacitor-updater` and configure `appId` / auto-update.
3. Use `:bundled` for store archives; publish OTA bundles from CI.

## Related

- Widgets / Live Activities: [ios-widgets-live-activities.md](./ios-widgets-live-activities.md)
- Apple Watch (deferred): [apple-watch-deferred.md](./apple-watch-deferred.md)
