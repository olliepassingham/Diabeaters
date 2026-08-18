# Apple Watch companion — Wear OS deferred

Apple Watch v1 is a **glance companion** in this repo (SwiftUI watchOS target). It is not a port of the Capacitor React app.

**Wear OS, Garmin, and Fitbit stay deferred** until Apple Watch v1 is on TestFlight. Each of those is a separate native project with no shared UI.

## What shipped (Apple Watch v1)

- Shared App Group status includes last glucose, units, optional trend, and freshness (`DiabeatersSharedStatus`).
- iPhone Lock Screen widget shows that glance (educational — not a CGM alarm).
- `OsSurfaces` pushes the same payload to a paired Watch over **WatchConnectivity**.
- Watch app: big last-known glucose, age of reading, **I’ve sorted it** (queues if the phone is unreachable).
- Complications (circular / rectangular / inline / corner) read the Watch-local cache.
- Phone stays the hub. Meal planner, bedtime, pump IOB, and Guides are **not** on the Watch.

Copy on Watch and widget: “last reading from the phone — not a CGM alarm.” Treat first, then tap I’ve sorted it. Independent Watch-only hypo alarms are out of scope until phone CGM v2 is solid.

## One-time Apple Developer setup

Register these in [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) (the ensure scripts do **not** create App IDs):

1. App ID `com.passingtime.diabeaters.watchkitapp` (watchOS app) with **App Groups** `group.com.passingtime.diabeaters` and the Watch App capability.
2. App ID `com.passingtime.diabeaters.watchkitapp.widget` (watchOS WidgetKit extension) with the same App Group.
3. In Xcode: `ios/App/App.xcworkspace`, confirm signing on **App**, **DiabeatersWatch**, and **DiabeatersWatchWidgets**.
4. Install the **watchOS** platform (Xcode → Settings → Components). Embedding the Watch app means the iPhone scheme will not build until that SDK is present.

TestFlight needs a real Watch. Simulator is weak for Health + WatchConnectivity.

## Cap sync

`scripts/ensure-ios-widget-target.mjs` then `scripts/ensure-ios-watch-target.mjs` run from `ios:release:sync*` so Capacitor rewrites do not drop the Watch targets.

## Other watches

Do not start Wear OS / Garmin / Fitbit until this Apple Watch companion is in TestFlight.
