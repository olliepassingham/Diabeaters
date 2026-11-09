# Cursor Configuration (Account-Tied vs Repo)

**Scope:** Cursor account-only migration (GitHub / Supabase / Vercel unchanged).

## In the repository (transfers with clone)

| Item | Status |
| --- | --- |
| `.cursor/rules` | **Absent** — nothing project-scoped is versioned today |
| `AGENTS.md` / `.cursorrules` | **Absent** |
| Project MCP config in-repo | **Absent** |
| `migration-readiness/` | Present after docs commit — includes this pack + `CURSOR_ONLY_MIGRATION_GUIDE.md` |
| Application code | Present on `main` |

Most agent behaviour today comes from **account User Rules** + chat context, not from GitHub.

## Transfer vs archive (practical)

| Item | Can restore into new account? | Safest preservation |
| --- | --- | --- |
| **User Rules** | Yes — by **manual paste** into new account Rules UI | Copy full text to private markdown **before** sign-out |
| **Project rules** | Yes — if you add `.cursor/rules` and commit | Currently none; optional improvement after migration |
| **Skills** (`~/.cursor/skills-cursor`, ~0.3MB) | Mostly yes — copy folder or reinstall | `backup-cursor-local.sh` or reinstall |
| **Extensions** (~3 packages / 2.4MB here) | Yes — reinstall from marketplace | Note names before switch |
| **MCP config + auth** | Config: re-enter; Auth: **must re-login** | Screenshot server list; no `~/.cursor/mcp.json` found |
| **Custom agents / Automations** | Recreate on new account | Note which you use |
| **Chat / agent UI history** | **No supported account transfer** | Archive for reference only |
| **Agent transcripts** (~60MB, 164 files) | Archive only (searchable files) | Zip via backup script |
| **Personal agent store** (~8.5MB) | Archive / unverified restore | Backup script |
| **Project agent store** (~4MB) | Archive / unverified restore | Backup script |
| **workspaceStorage** (~550MB) | Advanced same-path only | Skip unless expert migration |
| **globalStorage** (~7.5GB) | Do not wholesale copy | Skip |
| **settings.json** | Yes (small) | Backup script copies it |

### Important account behaviour

- **User Rules** sync with the **signed-in Cursor account**. Signing into a different account loads that account’s rules (often empty).
- **Chat history** is primarily **local**. It is **not** a documented cloud migrate-between-accounts feature. Always archive transcripts if you care about them.
- On the **same machine**, local files remain on disk after sign-out; still copy User Rules and archives explicitly so nothing depends on hope.

## Backup command

```bash
bash migration-readiness/scripts/backup-cursor-local.sh
```

Writes under `~/Documents/Diabeaters-private/cursor-backup-<timestamp>/` (outside git). Then manually save User Rules into `notes/cursor-user-rules-backup.md`.

## After new account sign-in

1. Connect the **same** GitHub account that owns Diabeaters.  
2. Open/clone the repo.  
3. Restore `.env*` from private backup.  
4. Paste User Rules.  
5. Reinstall extensions / skills / MCP.  
6. Follow `CURSOR_ONLY_MIGRATION_GUIDE.md` and `POST_MIGRATION_TESTS.md`.

## What this switch does **not** change

GitHub repository, Supabase project/data, Vercel project/domains, App Store / Play Console.
