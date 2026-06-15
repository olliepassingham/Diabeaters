# Branding assets

Place `appstore-icon-1024.png` here: a 1024×1024 PNG with **no transparency** for the App Store and Google Play.

| Command | Purpose |
|---------|---------|
| `npm run icons:android` | Regenerate Android launcher mipmaps from `appstore-icon-1024.png` |
| `npm run icons:validate` | Check iOS + Android icon requirements |
| `python3 branding/export-instagram-profiles.py` | Export sunrise IG profile + circle previews |
| `node branding/capture-instagram-profiles.mjs` | Export teal IG profile (HTML render) |

### Instagram profile pictures

| File | Use when |
|------|----------|
| `instagram-profile-teal-1080.png` | Matches app UI and teal launch post |
| `instagram-profile-sunrise-1080.png` | Matches App Store icon / warmer social gradient |
| `*-circle-preview.png` | QA — simulates Instagram’s circular crop |

Upload either 1080×1080 PNG as your Instagram profile photo.
