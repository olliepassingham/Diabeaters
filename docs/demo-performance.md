# Demo performance guide

Diabeaters can feel slow during live demos for **two reasons**: weak WiFi and how the app loads data. This guide helps you tell them apart and run smoother demos.

## Pre-warm before you show the app (2–3 minutes)

Do this on a **good network** before your audience arrives:

1. Force-quit the app, then open it fresh and sign in.
2. Wait until Home fully loads (not skeleton).
3. Tap through the pages you plan to show (Feed, Supporter mode, one tool).
4. Leave the app in the **foreground** — backgrounding triggers sync work.

The app also **prefetches demo routes** in the background after login (home, community, supporter view, tools) so first taps feel faster.

## WiFi vs app: 2-minute diagnosis

| What you see | Likely cause |
|--------------|--------------|
| Long blank screen before anything | Weak WiFi + iOS loads UI from Vercel |
| Stuck on “Checking session…” / “Loading…” | WiFi + startup API calls |
| Shell fast, feed/images slow | WiFi for images; app does many API round trips |
| Same slowness on mobile data **and** strong WiFi | App architecture (waterfalls, heavy pages) |
| Only slow on guest WiFi | Mostly WiFi |

**Quick test:** Open the same page on **mobile data**, then on **guest WiFi**.

- Only WiFi bad → network is the main issue; use hotspot or pre-warm on mobile data.
- Both bad → app-side; start demos on **Home** or a **tool**, not cold Community/Supporter.

## DEV: network + timing overlay

In local dev builds, a slim bar under the Supabase dev banner shows **effective network type** (when the browser exposes it). Route changes log a one-line **`[DEV perf]`** summary to the console with navigation and paint timings.

## Best pages to demo (fastest → slowest)

1. **Home / dashboard** — mostly local data
2. **Tools / guides** — fast after first visit (chunk cached)
3. **Community feed** — many Supabase calls + images
4. **Supporter mode** — two loading phases + patient data
5. **Cold start on weak WiFi** — worst case (remote UI + auth + APIs)

## iOS note

The App Store build loads JavaScript from `https://diabeaters.vercel.app`. That is normal for this project but means **cold starts depend on network** more than fully bundled native apps.

## During the demo

- Do not switch accounts mid-demo (logout repeats full startup).
- Do not cold-start on conference WiFi if you can avoid it.
- Pre-load Community or Supporter if you need them early.
