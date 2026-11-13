# Diabeaters — product brief

Standing brief for Cursor Agent builds. Keep this short; put ordered work in [build-roadmap.md](./build-roadmap.md).

## What it is

Diabeaters is a **phone-first Type 1 companion**: plan, prepare, and feel ready for everyday diabetes life (supplies, guides, community, supporters). Lifestyle organisation — **not** medical advice and **not** a medical device.

**Primary tagline:** A calmer daily flow for Type 1 — plan, prepare, and feel ready.

## Who it’s for

- People living with Type 1 (and Type 2 where the product already supports it)
- Supporters / carers who need a quieter view
- Primary surface: native iOS/Android Capacitor shell loading the web app, plus mobile web

## Product principles

- **Phone-first:** layouts must fit real phones; avoid desktop-web chrome stacking above fold
- **Short copy:** chips and action lines over paragraphs; guides should feel quick to use
- **Calmer, not busier:** thin chrome; posts and actions first; no dense marketing strips mid-flow
- **Honest empty states:** never claim “nothing here” while more data may still load
- **Safety framing:** wellness / lifestyle support; never invent clinical dosing advice

## Stack (where to work)

- App UI: `app/` (Vite + React SPA)
- Capacitor shells: `ios/`, `android/` (remote URL → production Vercel)
- Auth / data: Supabase
- Deploy: Vercel (`diabeaters.vercel.app`)

## Guardrails for agents

- Do **not** commit, push, change production env, or submit store builds unless the user explicitly asks
- Do **not** touch secrets (`.env*`, keystores, certificates)
- Prefer small, reviewable changes; match existing patterns in `app/src/`
- After a successful build item: update [build-roadmap.md](./build-roadmap.md), propose next 1–3 items, and **wait** for go

## Session starters (paste into Agent chat)

- `Continue from the roadmap`
- `Do the next P0 only`
- `Skip X; do Y next`
- `Propose next after [what we just shipped]`
