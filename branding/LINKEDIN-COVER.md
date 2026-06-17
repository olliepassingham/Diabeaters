# LinkedIn company page cover — Diabeaters

## Upload file

| File | Size | Use |
|------|------|-----|
| `linkedin-cover-1584x396.png` | 1584 × 396 px | Company page **Header** (recommended) |

**Where:** LinkedIn → Diabeaters App page → **View as admin** → **Edit cover image**.

---

## Copy on the banner

| Element | Text |
|---------|------|
| Eyebrow pill | `Type 1 diabetes companion` |
| Headline | `Stay one step ahead with Type 1` |
| Subline | `Supplies · planning · guides · community` |
| Platform | `iOS & Android` |

Matches your LinkedIn tagline and About section. No dosing or medical claims.

---

## Layout spec

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [keep clear — logo overlaps]              TYPE 1 DIABETES COMPANION       │
│                                            Stay one step ahead with Type 1 │
│  ○ profile                                 Supplies · planning · guides ·  │
│    photo                                   community                       │
│                                            iOS & ANDROID                   │
└────────────────────────────────────────────────────────────────────────────┘
     ↑ ~320×180 px safe zone (bottom-left)          ↑ main copy, right-aligned
```

- **Safe zone:** No text or logos in the bottom-left ~320 × 180 px (company logo sits there).
- **Mobile crop:** LinkedIn trims the sides on phones — important copy stays in the centre-right band.
- **Alignment:** Copy is right-aligned so it clears the logo on desktop and survives mobile crop.

---

## Colours (match app / IG teal)

| Token | Hex | Use |
|-------|-----|-----|
| Teal | `#148276` | Gradient accent |
| Mint | `#54c4ba` | Glow / pill border |
| Mint bright | `#6ee7d9` | Headline accent, eyebrow |
| Background | `#051614` → `#0a2824` | Dark teal gradient |

**Font:** System UI stack (SF Pro / Segoe UI) — same as Instagram launch assets.

---

## Regenerate PNG

```bash
node branding/capture-linkedin-cover.mjs
```

Preview HTML in a browser at 1584×396. Add class `show-guides` on `<body>` to see logo overlap and mobile crop guides.

---

## Optional variants

**Shorter subline (if text feels busy on mobile):**

`Everyday Type 1 — supplies, guides & community`

**Warmer / App Store aligned:** Use the navy + gold palette from `master-story-horizontal.png` instead of teal if you want LinkedIn to match the website hero rather than the app icon.

**Without platform line:** Drop `iOS & Android` for a cleaner look once store links live in the About section.
