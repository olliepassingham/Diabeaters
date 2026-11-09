# Step-by-Step Migration Plan

**For the Cursor-only switch you already decided, use [`CURSOR_ONLY_MIGRATION_GUIDE.md`](./CURSOR_ONLY_MIGRATION_GUIDE.md) as the operational checklist.** This file remains the high-level phase map (including optional later Scope B).

## Order of operations (Scope A – Cursor account only)

### Phase 0 – Freeze assumptions

1. Decision locked: **Cursor-only**. Keep GitHub / Supabase / Vercel accounts.  
2. Do **not** delete the old Cursor account, GitHub access, Supabase, or Vercel yet.

### Phase 1 – Backup (before signing into the new Cursor account)

1. Confirm `git status` clean and `main` = `origin/main` (already true at audit).  
2. Encrypted backup of:
   - `.env`, `.env.local`, `app/.env.local`
   - `android/app/google-services.json`
   - Optional: copy of agent-transcripts folder if you need chat history
3. Screenshot / export Cursor **User Rules**.  
4. Inventory Vercel env var names+values (Dashboard).  
5. Inventory Supabase Edge secret names+values (Dashboard).  
6. Inventory GitHub Actions secret values from your password manager.  
7. Optional: database backup from Supabase (even for Scope A — good hygiene).

### Phase 2 – Open project on new Cursor account

1. Sign in to new Cursor account on the machine (or new machine).  
2. Connect GitHub with access to `olliepassingham/Diabeaters`.  
3. Clone the repo fresh (preferred) or open the existing folder after signing out of the old account.  
4. Restore env files + `google-services.json`.  
5. Re-create User Rules; reinstall skills/extensions; re-auth MCP.  
6. `npm ci && npm --prefix app ci`.  
7. Run `POST_MIGRATION_TESTS.md` checks.

### Phase 3 – Keep production stable

1. Do not change Vercel project linkage unless broken.  
2. Do not run destructive Supabase commands.  
3. Push a trivial docs-only commit only if you need to verify Actions still deploy (optional).

### Phase 4 – Decommission old Cursor account

1. Only after tests pass and you’ve copied any chats/rules you need.  
2. Revoke old Cursor GitHub OAuth if desired.

---

## If you later do Scope B (ownership transfer) — separate plan

**Do this only after Scope A is stable.**

1. Invite new identities into existing GitHub org / Vercel team / Supabase org (prefer share over clone).  
2. Verify deploy + auth + push still work.  
3. Only then remove old owners.  
4. If cloning Supabase to a new project: treat as a greenfield cutover with dual-run, data migration, Storage copy, Auth strategy, and native app rebuild — **not** a Cursor setting.

---

## Verification gates

| Gate | Pass criteria |
| --- | --- |
| G1 Code | Fresh clone builds; unit tests pass |
| G2 Config | App boots against Supabase with restored env |
| G3 Deploy path | Unchanged: push to `main` still deploys (or manual Vercel deploy works) |
| G4 Native remote | Opening production URL in browser matches Capacitor remote target |

## Rollback

| Failure | Rollback |
| --- | --- |
| New Cursor account misconfigured | Keep using old Cursor account; repo untouched |
| Env missing | Restore from encrypted backup |
| Accidental Vercel env wipe | Re-enter from inventory; redeploy previous deployment in Vercel UI |
| Accidental Supabase damage | Restore from Supabase backup / point-in-time (confirm plan in Dashboard) — **unverified** PITR entitlement |

**Never** “rollback” by force-pushing `main` unless you explicitly choose that and understand App Store/Web impact.
