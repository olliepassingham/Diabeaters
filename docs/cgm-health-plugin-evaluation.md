# Health plugin evaluation (`@capgo/capacitor-health`)

## Selected package

**`@capgo/capacitor-health`** (Capacitor 8 compatible)

## Why this plugin

| Criterion | Assessment |
|-----------|------------|
| Capacitor 8 | Supported (v8.x) |
| Blood glucose | `bloodGlucose` data type (default unit mg/dL) |
| iOS | HealthKit via `NSHealthShareUsageDescription` |
| Android | Health Connect (API 26+) |
| Unified API | Same `readSamples` / `requestAuthorization` on both platforms |
| Maintenance | Active Capgo plugin with documented setup |

## Alternatives considered

- **`@flomentumsolutions/capacitor-health-extended`** — richer metrics but heavier Android requirements (Health Connect 1.2 alpha); more than v1 needs.
- **`ubie-oss/capacitor-health-connect`** — Android-only; would require a separate HealthKit plugin for iOS.
- **Official Dexcom / Libre APIs** — not live enough for exercise prefill; deferred to v2+ (see `docs/cgm-integration-v1-scope.md`).

## Integration in Diabeaters

- Adapter: [`app/src/lib/cgm/adapters/health-platform.ts`](../app/src/lib/cgm/adapters/health-platform.ts)
- Constants: `HEALTH_PLUGIN_EVALUATION`
- Native setup:
  - iOS: **HealthKit** entitlement in `AppDebug.entitlements` / `AppRelease.entitlements`; `Info.plist` usage strings
  - Android: Health Connect privacy policy URL in `strings.xml`; plugin ships Health Connect permissions

## Known limitations

- **Trend arrows** — HealthKit BG samples typically do not include CGM direction; trend stays manual in v1.
- **Dexcom delay** — Dexcom may write to Apple Health ~3 hours after the reading; UI shows reading age.
- **Web** — plugin only runs in native shell; web shows setup instructions.
- **No server upload** — v1 reads on demand; nothing persisted to Supabase.

## Install (maintainers)

```bash
cd app && npm install @capgo/capacitor-health
npx cap sync ios
npx cap sync android
```

Enable HealthKit capability in Xcode for the iOS target.
