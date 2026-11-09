# Migration Overview – Cursor Account Transfer

**Audit date:** 2026-11-09 (updated for Cursor-only final prep)  
**Repository:** `https://github.com/olliepassingham/Diabeaters.git`  
**Local path audited:** `/Users/olliepassingham/Diabeaters/Diabeaters`  
**`main` tip at last git verify:** `8fee532` (matches `origin/main`)

## Decision (locked)

**Scope A only:** change the **Cursor account**. Keep GitHub, Supabase project `ffgcivxvbtdlmfnttwjm`, and Vercel project `diabeaters` / `https://diabeaters.vercel.app` unchanged.

**Primary how-to:** [`CURSOR_ONLY_MIGRATION_GUIDE.md`](./CURSOR_ONLY_MIGRATION_GUIDE.md)

## Critical distinction

| Scope | What moves | Production impact |
| --- | --- | --- |
| **A. Cursor IDE account only** | Editor settings, rules, chat/agent history archives, MCP auth, skills, extensions | **None** to live users if GitHub / Supabase / Vercel stay the same |
| **B. Full stack ownership** | Also GitHub / Supabase / Vercel / Apple / Google | **High** if done carelessly |

Do **not** follow Scope B procedures during this switch.

## What is already safe in GitHub (verified)

- App source, Capacitor config, `vercel.json`, Supabase migrations, Edge Function source, GitHub Actions workflows.
- No Git submodules and no Git LFS objects detected.
- After the migration-readiness commit lands on `main`, this entire pack (including the Cursor-only guide) is cloneable.

## What is *not* in GitHub

- Local env: `.env`, `.env.local`, `app/.env.local` (gitignored) — must private-backup.
- `android/app/google-services.json` (gitignored).
- Cursor User Rules (account-synced), chat UI, MCP auth, Automations.
- Agent transcripts (~60MB) — archive for reference only; **no supported transfer into a new account’s chat UI**.
- Live Supabase data/users/storage objects and Edge/Vercel/Actions **secret values**.

## Pack index (10 audit files + guide)

| File | Role for Cursor-only |
| --- | --- |
| `CURSOR_ONLY_MIGRATION_GUIDE.md` | **Follow this** — before/after checklists |
| `CURSOR_CONFIGURATION.md` | What transfers vs archive; backup script |
| `GITHUB_CHECKLIST.md` | Branches, ignore list, Actions secret **names** |
| `ENVIRONMENT_VARIABLES.md` | Env inventory (names only) + secure backup |
| `POST_MIGRATION_TESTS.md` | Dev + production smoke after switch |
| `STEP_BY_STEP_MIGRATION_PLAN.md` | High-level phases (points at Scope A) |
| `MIGRATION_RISKS.md` | Risk register |
| `SUPABASE_MIGRATION.md` | Keep same project — inventory only |
| `VERCEL_MIGRATION.md` | Keep same project — inventory only |
| `THIRD_PARTY_INTEGRATIONS.md` | What is / isn’t Cursor-tied |
| `scripts/backup-cursor-local.sh` | Local archive to `~/Documents/Diabeaters-private/` |

## Credentials scan (this pack)

No secret **values** are stored in these markdown files. Present identifiers only: GitHub URL, Supabase project ref, Vercel project/team IDs, public production URL. Env docs list **names**, not values.

## Final status

See the end of `CURSOR_ONLY_MIGRATION_GUIDE.md` for the live GREEN / AMBER / RED verdict after final prep.

**Blocking only for the user (manual, before sign-out):** copy User Rules; run private env + history backup; then restore after sign-in.
