# iOS widgets and Live Activities

## What shipped

- **App Group** `group.com.passingtime.diabeaters` on the main app + widget extension.
- **`OsSurfaces` Capacitor plugin** writes scenario/exercise status **and last glucose** (value, units, optional trend, recorded-at) into the App Group, starts/updates/ends an **Exercise Live Activity**, and pushes the same status to Apple Watch over WatchConnectivity.
- **`DiabeatersWidgetExtension`**: Home/Lock Screen status widget (glucose when known) + Dynamic Island / Live Activity UI.
- **Apple Watch companion**: glance + complications + “I’ve sorted it”. See [apple-watch-deferred.md](./apple-watch-deferred.md).
- JS sync via [`NativeOsSurfacesSync`](../../app/src/components/native-os-surfaces-sync.tsx).

## One-time Apple Developer setup

1. In [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list):
   - Enable **App Groups** on `com.passingtime.diabeaters`.
   - Create App Group `group.com.passingtime.diabeaters`.
   - Register App ID `com.passingtime.diabeaters.widget` (App Extension) with the same App Group.
2. In Xcode: open `ios/App/App.xcworkspace` (or `.xcodeproj`), select the App + Widget targets, confirm Signing & Capabilities show the App Group.
3. Run `npm run ios:release:sync` (bundled default) then build/run on a device (Live Activities need a real device for full UX).

## Verify

- Start travel or sick day → Lock Screen / Home widget should show status after adding the widget.
- Start guided exercise → Live Activity / Dynamic Island appears; ending the session dismisses it.

## Cap sync

`scripts/ensure-ios-widget-target.mjs` and `scripts/ensure-ios-watch-target.mjs` are run from release sync scripts so the Widget and Watch targets stay wired after Capacitor rewrites the project.
