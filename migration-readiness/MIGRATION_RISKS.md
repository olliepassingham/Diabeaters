# Migration Risk Assessment

| ID | Risk | Rating | Why | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | Loss of Cursor chat / agent history | **HIGH** (for knowledge) / LOW (for prod) | ~60MB transcripts live under current Cursor project paths; not in GitHub | Archive transcripts before switching; keep old account open |
| R2 | Loss of User Rules / skills / MCP auth | **MEDIUM** | Not in repo; no project `.cursor/rules` | Export/copy rules; reinstall skills; re-auth MCP |
| R3 | Missing local `.env*` on new machine | **HIGH** | Gitignored; app won’t talk to Supabase | Encrypted backup of env files before switch |
| R4 | Assuming GitHub backup includes secrets/data | **HIGH** if believed | Auth users, storage files, Edge secrets, Vercel env values are elsewhere | Follow `ENVIRONMENT_VARIABLES.md` + Supabase/Vercel dashboards |
| R5 | Accidental Supabase project recreation | **HIGH** | Would orphan users/data or split environments | Prefer invite-to-org; never `db reset` on prod |
| R6 | Accidental Vercel project recreation | **HIGH** | Capacitor remote URL depends on production deploy | Keep same project; verify `diabeaters.vercel.app` |
| R7 | GitHub Actions secrets not portable via UI | **MEDIUM** | GitHub never shows secret values again | You must already have values stored elsewhere |
| R8 | Supabase migration history drift | **MEDIUM** | Earlier `db push` hit “policy already exists” on old migration | Prefer targeted SQL / Dashboard; don’t force-reset |
| R9 | `google-services.json` only local | **MEDIUM** | Ignored by git; Android push/build needs it | Private backup |
| R10 | Stale local branches mistaken for truth | **LOW** | `backup/…` behind by hundreds of commits | Trust `origin/main` only |
| R11 | Production interrupt during Cursor-only switch | **LOW** | Cursor is not in the runtime path | Don’t touch Vercel/Supabase while switching Cursor |
| R12 | OAuth / redirect mismatch after URL changes | **MEDIUM** (only if Scope B) | Auth Site URL must match public site | Update Supabase Auth URLs + `VITE_PUBLIC_SITE_URL` together |
| R13 | Push (APNS/FCM) breaks after secret loss | **HIGH** if secrets lost | Edge secrets + Apple/Google credentials | Inventory before any account ownership change |
| R14 | Cloud agent / Cursor Automations stop | **LOW–MEDIUM** | Tied to Cursor account | Recreate on new account |
| R15 | Personal agent store / unfinished goals lost | **LOW–MEDIUM** | Account stores under AgentStores | Export notes you care about |

## Production user impact

| Scenario | User impact |
| --- | --- |
| Cursor account switch only | None |
| Lose Vercel production env / deploy | Web + remote WebView apps degrade |
| Lose Supabase or rotate keys incorrectly | Login, feed, push, CGM share fail |
| Lose Apple/Google push credentials | Notifications fail; data intact |

## Ownership restrictions

- Cursor cannot transfer GitHub/Supabase/Vercel by itself.
- Apple Developer and Google Play transfers are separate legal/account processes.
- Supabase Auth users cannot be “moved” by copying migrations alone.
