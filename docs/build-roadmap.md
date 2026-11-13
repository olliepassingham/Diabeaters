# Diabeaters — build roadmap

Living checklist. Agents: pick the top unchecked item in the highest open priority band, ship it, check it off, then propose the next 1–3 and wait.

Last seeded: 2026-11-13 (phone audit + recent exercise / stay-signed-in work).

## Done recently

- [x] Exercise fuel “before you start” — short Meal / Snack / Not eating chips; ≤2 action lines
- [x] Keep users signed in — Preferences native session mirror + single-flight refresh + Sentry session-loss reporting (iOS 1.0.40 / Android 1.0.42 prep)
- [x] Phone audit report (viewport, shell, Feed, native-fit)
- [x] Product brief + living roadmap + AGENTS.md propose-and-wait loop
- [x] **Web viewport lock** — `app/index.html`: `maximum-scale=1, user-scalable=no` (matches native zoom lock)
- [x] **Feed: saved-posts false empty** — `fetchCommunitySavedPostsPage` loads bookmarks from `community_post_saves` (not client-filter of the normal feed)
- [x] **Thinner Feed first viewport** — compact profile reminder; suggestions strip removed from above posts (still in Find people)

## P0

- *(none open)*

## P1 — Feed polish

- [ ] **Composer as a real control** — strengthen the “Write a post…” row in `feed-stories-composer-header.tsx` (clear field chrome / CTA, not bare muted text).
- [ ] **Drop soft-in on recycled feed cards** — stop re-animating every page of infinite scroll in `feed-post-card.tsx`; gate like/heart bursts for reduced motion.
- [ ] **Watch placement** — Watch should not feel like a third feed tab that leaves the list mounted underneath; clearer entry (header or filter) without modal-as-tab confusion.
- [x] **Suggestions strip** — deferred off the main Feed chrome; discovery remains in Find people
- [ ] **Following empty state** — use the quieter parent copy; don’t override with dense onboarding chips when Following is empty.

## P1 — Product polish

- [ ] **Manual device smoke** (human + agent checklist help): stay signed in after kill; Feed scroll/post/like/comment; Exercise plan; bottom nav; keyboard over sheets — one iPhone + one Android after Preferences builds are installed.
- [ ] **Unify search metaphors** — “Find people” vs “Search posts” should not both look like the same Search icon job.

## P2

- [ ] Stories loading layout jump (skeletons → rings)
- [ ] Pull-to-refresh as overlay instead of inserting a spacer row
- [ ] Deduplicate followee id fetches on Feed mount
- [ ] Welcome / small-phone: Log in below fold on SE-class — acceptable if scrollable; only revisit if one-screen welcome is a launch requirement

## Parking lot (don’t start unless asked)

- Cursor scheduled Automation that opens PRs without a “go”
- Auto-push to `main` / unattended store submit
- Type 2 mode expansion beyond existing paths
- Apple Watch companion (deferred — see `docs/operations/apple-watch-deferred.md`)
