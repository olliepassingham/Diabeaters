# Cursor Account-Only Migration Guide

**Decision locked:** change **only** the Cursor login.  
**Keep unchanged:** GitHub (`olliepassingham/Diabeaters`), Supabase project `ffgcivxvbtdlmfnttwjm`, Vercel project `diabeaters` / `https://diabeaters.vercel.app`.

**Do not** recreate Supabase or Vercel. **Do not** deploy as part of this migration.

---

## What transfers vs what does not

| Item | Transfers with new Cursor account? | What to do |
| --- | --- | --- |
| GitHub code (`main`) | Yes (clone / same folder) | Already synced |
| Project rules in `.cursor/rules` | Yes if committed | Currently **none** in repo |
| User Rules (Settings → Rules) | **No** — tied to Cursor account cloud sync | **Copy text before sign-out** |
| Chat / agent UI history | **No guarantee** across accounts | **Archive** for reference |
| Agent transcript files (~60MB) | Local files only | **Zip archive** (reference) |
| Skills (`~/.cursor/skills-cursor`) | Local; not account cloud | Copy folder or reinstall |
| Extensions | Local | Reinstall / copy |
| MCP servers + auth | Account / local | Reconfigure + re-auth |
| Custom agents / automations | Account | Recreate if you use them |
| Local `.env*` | Disk (gitignored) | Private backup → restore |
| Supabase / Vercel / production | Unchanged | Smoke-test only |

Official Cursor behaviour (account rules sync with the signed-in account; chat history is local and is **not** a cloud transfer between accounts). Treat history as **archive**, not as something you can rely on appearing under the new login.

---

## BEFORE you sign out of the old Cursor account

Complete every item. Do not sign out until this section is done.

### A. Code & GitHub

- [ ] `cd` to the Diabeaters repo
- [ ] `git status -sb` shows `main...origin/main` and **clean** (no uncommitted work you care about)
- [ ] `git log -1 --oneline` matches GitHub `main`
- [ ] Confirm this guide exists on `main` after you pull/push the migration-readiness commit
- [ ] Optional: note any local branches you still need (`git branch -vv`). Stale `backup/origin-main-*` can be ignored

### B. Preserve User Rules (critical)

Cursor User Rules sync to the **account**, not the repo. The new account will not have them.

1. Open **Cursor Settings → Rules** (Customize → Rules).
2. Select all User Rules text.
3. Paste into a **private** file **outside** the git repo, e.g.  
   `~/Documents/Diabeaters-private/cursor-user-rules-backup.md`
4. Keep that file out of GitHub.
5. Optional later: turn durable project preferences into committed `.cursor/rules/` so they travel with the repo.

### C. Archive chat / agent history (~60MB)

These are for **reference**, not a supported “restore into new account UI” path.

Recommended archive (same machine is fine):

```bash
mkdir -p ~/Documents/Diabeaters-private/cursor-archive-$(date +%Y%m%d)
# Agent transcripts (readable .jsonl / text history)
cp -R ~/.cursor/projects/Users-olliepassingham-Diabeaters-Diabeaters/agent-transcripts \
  ~/Documents/Diabeaters-private/cursor-archive-$(date +%Y%m%d)/agent-transcripts
# Optional: personal + project agent stores
cp -R ~/Library/Application\ Support/Cursor/AgentStores/cursor_agent_stores/u327362407 \
  ~/Documents/Diabeaters-private/cursor-archive-$(date +%Y%m%d)/personal-agent-store
cp -R ~/Library/Application\ Support/Cursor/AgentStores/cursor_agent_stores/68b48e45-d489-432d-897f-5f202df20600 \
  ~/Documents/Diabeaters-private/cursor-archive-$(date +%Y%m%d)/project-agent-store
```

Or run: `bash migration-readiness/scripts/backup-cursor-local.sh` (writes under `~/Documents/Diabeaters-private/`).

- [ ] Confirm the archive folder exists and is non-empty
- [ ] Do **not** commit this archive to GitHub

`workspaceStorage` / `globalStorage` are large (hundreds of MB–GB). Only copy them if you are doing an advanced same-path machine migration; they are **not** required for a normal new-account setup.

### D. Skills, extensions, MCP notes

- [ ] List installed extensions you rely on (Cursor Extensions view)
- [ ] Note MCP servers you use (GitHub, browser, etc.) — there is no `~/.cursor/mcp.json` in this audit; config is likely in-app → screenshot or write names down
- [ ] Optional: copy `~/.cursor/skills-cursor` into the private archive (or plan to reinstall built-in skills)
- [ ] Optional: copy `~/Library/Application Support/Cursor/User/settings.json` if you customized the editor

### E. Local development secrets (never commit)

- [ ] Copy these to the **same private folder** (or a password manager):
  - `.env`
  - `.env.local`
  - `app/.env.local`
  - `android/app/google-services.json` (if you build Android)
- [ ] Confirm copies open and are not empty
- [ ] You do **not** need to re-create Vercel or Supabase secrets for Cursor-only — only restore local Vite env so `npm run dev` works

Minimum local keys to run the app:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Useful if present locally: `VITE_APP_ENV`, `VITE_SUPPORT_EMAIL`, `VITE_BEATIE_FEED_BOT_USER_ID`, `VITE_E2E`

---

## Sign out / sign in

1. Cursor Settings → Account → **Sign Out** (or Command Palette → Sign Out).
2. Sign in with the **new** Cursor account.
3. Keep the old account recoverable (password / SSO) until post-checks pass — do not delete it yet.

On the **same Mac**, local chat files may still exist on disk after sign-out; the new account still will **not** automatically own cloud User Rules or cloud Automations from the old account.

---

## AFTER signing into the new Cursor account

### 1. GitHub + project

- [ ] Connect GitHub inside Cursor using the **same** GitHub user that owns `olliepassingham/Diabeaters`
- [ ] Open the existing project folder **or** clone fresh:  
  `git clone https://github.com/olliepassingham/Diabeaters.git`
- [ ] `git checkout main && git pull`
- [ ] Confirm `migration-readiness/CURSOR_ONLY_MIGRATION_GUIDE.md` is present

### 2. Restore local env

- [ ] Copy `.env`, `.env.local`, `app/.env.local` back into the project paths from your private backup
- [ ] Confirm they remain gitignored (`git status` must not stage them)

### 3. Restore Cursor productivity setup

- [ ] Paste User Rules from `cursor-user-rules-backup.md` into Settings → Rules
- [ ] Reinstall extensions you need
- [ ] Restore or reinstall skills (`~/.cursor/skills-cursor` copy, or Cursor’s skill installer)
- [ ] Re-add MCP servers and complete authentication (GitHub, etc.)
- [ ] Recreate Automations / Cloud Agents only if you used them

### 4. Install & run locally

```bash
npm ci
npm --prefix app ci
npm run check
npm run test:unit
# then your usual app dev command, e.g. from repo docs / package scripts
```

- [ ] App starts without “Supabase not configured”
- [ ] Login works against the **existing** Supabase project
- [ ] Read a feed/home screen (DB read)
- [ ] Perform a safe write (e.g. draft/save profile field or a test post you can delete)
- [ ] Optional: upload/view an avatar or feed image (Storage)

### 5. Production unchanged checks (read-only)

- [ ] `https://diabeaters.vercel.app` still loads
- [ ] Login on production still works
- [ ] `capacitor.config.ts` still defaults remote URL to `https://diabeaters.vercel.app` (no change expected)
- [ ] Do **not** trigger a production deploy unless you intentionally push code later

### 6. Only then retire the old Cursor account

- [ ] You can find archived chats if needed
- [ ] New account has User Rules
- [ ] Local app + production smoke passed  
Then you may stop using the old Cursor login (optional: revoke its GitHub OAuth).

---

## Rollback

If anything fails: sign back into the **old** Cursor account. GitHub / Supabase / Vercel were not moved, so production is unaffected.

---

## Related docs in this folder

| File | Use |
| --- | --- |
| `CURSOR_CONFIGURATION.md` | Detailed Cursor path inventory |
| `ENVIRONMENT_VARIABLES.md` | Full env name inventory |
| `GITHUB_CHECKLIST.md` | Branch / ignore / Actions notes |
| `POST_MIGRATION_TESTS.md` | Expanded test checklist |
| `MIGRATION_RISKS.md` | Risk register |
| `scripts/backup-cursor-local.sh` | One-shot private archive |

---

## Readiness assessment (final prep)

| Area | Status |
| --- | --- |
| GitHub `main` clean & synced | Ready (commit this pack first if still untracked) |
| Local branches noted | Ready — trust `origin/main`; stale `backup/*` ignorable |
| Uncommitted app work | None on `main` at last verify |
| Migration docs | Ready in `migration-readiness/` |
| Fresh clone possible | Yes once pack is on `origin/main` |
| Env inventory | Ready (names documented; values stay private) |
| Private backup script | Ready — ran to `~/Documents/Diabeaters-private/cursor-backup-*` |
| History archive (~60MB+) | Ready as **reference** archive (not UI restore) |
| User Rules export | **You must still paste** into `notes/cursor-user-rules-backup.md` |
| MCP / extensions notes | Light — Remote SSH listed; no `~/.cursor/mcp.json`; note any in-app MCP |
| Production untouched | Correct posture for this migration |

### Verdict: **AMBER**

Safe to proceed with the Cursor account switch **after** you manually copy User Rules into the private backup folder and push this `migration-readiness/` pack to `origin/main`. Production risk is low; residual risk is losing User Rules / chat convenience if you skip the before-sign-out steps.

**Not GREEN** until: (1) User Rules file exists in the private backup, (2) migration docs are on GitHub `main`, (3) you confirm the private backup folder is non-empty.

**Not RED** — code, env copies, history archive, and guide are in place; nothing blocks preparation.
