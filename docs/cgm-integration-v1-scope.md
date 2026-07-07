# CGM integration — v1 scope (Diabeaters)

## Decision

**v1 is prefill-only via Apple HealthKit and Google Health Connect.**

Near-live exercise reads (LibreLinkUp, Dexcom Share, Nightscout) are **deferred to v2** because they need unofficial APIs, credential storage, and higher maintenance.

## v1 delivers

- `CgmAdapter` abstraction and `GlucoseReading` model
- Health platform adapter (`@capgo/capacitor-health`, `bloodGlucose`)
- Settings UI: connect Health, enable prefill, disclaimers
- Prefill hooks in driving and exercise BG prompts
- **On-device only** — no CGM upload to Supabase in v1

## v1 does not deliver

- LibreLinkUp / Dexcom Share follower credentials
- Nightscout polling (adapter stub only)
- Official Dexcom OAuth API
- Carer cloud CGM stream
- Automatic treatment decisions from CGM data

## Staleness policy (prefill)

| Age | Behaviour |
|-----|-----------|
| ≤ 60 min | Normal prefill |
| 61–180 min | Prefill with “reading is X old” warning |
| > 180 min | Treated as stale — hidden unless user explicitly requests |

Dexcom may write to Apple Health ~3 hours late; the UI always shows reading age and source.

## Platform

- iOS: HealthKit read (`NSHealthShareUsageDescription`)
- Android: Health Connect read (`bloodGlucose`)
- Web: settings explain that CGM prefill requires the mobile app
