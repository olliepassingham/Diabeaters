# Native shipping mode

## Decision (2026-08)

**Store / production iOS+Android archives ship with bundled `webDir`** (no Capacitor `server.url`).

| Mode | Command | Cold start | Live web deploys |
|------|---------|------------|------------------|
| **Bundled (default)** | `npm run ios:release:sync` (= `:bundled`) | Fast, works offline for UI | Needs new binary or Capgo OTA |
| **Remote WebView** | `npm run ios:release:sync:remote` | Needs network | Instant via Vercel |

Do **not** point store archives at staging URLs.

## Capgo / OTA (optional next)

To regain patch-without-resubmit while staying bundled:

1. Create a Capgo app and channel.
2. Add `@capgo/capacitor-updater` and configure `appId` / auto-update.
3. Keep `CAPACITOR_BUNDLE_WEB=1` for release sync; publish OTA bundles from CI.

Until Capgo is wired, use `:remote` only for internal TestFlight builds that need instant Vercel iteration.

## Related

- Widgets / Live Activities: [ios-widgets-live-activities.md](./ios-widgets-live-activities.md)
- Apple Watch (deferred): [apple-watch-deferred.md](./apple-watch-deferred.md)
