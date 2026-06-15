# Pre-launch QA script (~30 minutes)

Run on a **production-like build** (signed Android AAB / TestFlight / production Vercel URL in Capacitor shell — not `localhost`).

**Pass criteria:** no crashes, no blank screens, disclaimers visible on clinical tools, auth completes, no staging banner.

Related: [play_store_launch_runbook.md](./play_store_launch_runbook.md) Phase 6.

---

## Before you start (2 min)

- [ ] Production Supabase unpaused; Vercel `VITE_APP_ENV=production`
- [ ] `capacitor.config.ts` `server.url` points at production host
- [ ] Fresh test account email ready (or use demo account for store review)
- [ ] Note app version / build number

---

## Auth & account (5 min)

| Step | Expected |
|------|----------|
| Sign up with email + password | Confirmation email received |
| Open verify link | Lands in app / web; can log in |
| Log out → log in | Session works |
| Forgot password | Reset email → set new password → login |
| Google (or OAuth) sign-in | Returns to app logged in |
| Settings → About | Disclaimer + privacy link load |
| Account → Request deletion | Mailto or flow opens (documented support path) |

---

## Core daily use (5 min)

| Step | Expected |
|------|----------|
| Dashboard loads | Widgets render; no staging ribbon |
| Add / edit a supply | Saves; days remaining updates |
| Ratios: view + save one ratio | Persists after refresh |
| Settings → export backup | JSON downloads |
| Settings → import backup (merge) | Dialog shows file details; merge restores; page refreshes |
| Import with **Replace** mode | Amber warning + acknowledgement required before confirm |

---

## Stress tools — scenarios (12 min)

Use realistic numbers; confirm **“not medical advice”** or numeric disclaimers appear.

### Hypo & correction

| Tool | Quick test | Check |
|------|------------|-------|
| Hypo help | BG below target → Calculate | Centered **g** hero; 15‑min reminder |
| Correction helper | BG above target + ISF set | Centered **u** hero; formula in dialog |

### Meal & bedtime

| Tool | Quick test | Check |
|------|------------|-------|
| Meal adviser | Carbs + meal type → dose | Hero dose; details collapsible |
| Split dose calculator | High-fat meal → split | Total **u** hero; first/second cards |
| Bedtime | BG + trend → check | Verdict hero; correction panel if high |

### Scenarios

| Tool | Quick test | Check |
|------|------------|-------|
| Sick day | Enter readings → activate | Results hero; log tab flat |
| Travel | Start trip wizard → packing | Step progress; packing count hero |
| Alcohol | Situation → dose range | Range hero; overnight note if applicable |
| Driving | BG + trend → readiness | Flat wizard result |
| Exercise | Pre-session calc | Narrow layout; dose/carbs hero |
| Pump failure | Start active mode (pump users) | Flat cards; timers |

### Help

| Tool | Check |
|------|-------|
| Help now | Red urgent styling (intentional); contacts usable |

---

## Optional features (3 min — only if enabled in prod)

Set `VITE_FEATURE_COMMUNITY=true` / AI coach flags as intended before testing.

| Feature | Check |
|---------|-------|
| Community feed | Loads; post composer opens |
| AI Coach | Consent gate; message sends or graceful error |
| Push (Android) | Test push from Settings if FCM configured |

---

## Native / store build sanity (3 min)

- [ ] Cold start: no white WebView / wrong host
- [ ] Back navigation doesn’t trap user
- [ ] Offline: app shows offline notice; doesn’t hard-crash on dashboard
- [ ] `npm run icons:validate` passes before Play upload

---

## Sign-off

| Role | Name | Date | Build |
|------|------|------|-------|
| QA | | | |
| Product | | | |

**Blockers found:**

_(list any P0/P1 issues)_
