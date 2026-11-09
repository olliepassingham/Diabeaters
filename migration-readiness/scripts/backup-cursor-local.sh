#!/usr/bin/env bash
# Cursor-account-only local backup. Writes OUTSIDE the git repo.
# Does not print secret values. Does not modify production services.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${DIABEATERS_CURSOR_BACKUP_DIR:-$HOME/Documents/Diabeaters-private/cursor-backup-$STAMP}"

mkdir -p "$DEST"/{cursor,env,notes}

echo "Backup destination: $DEST"

# --- Cursor history / stores (archive for reference) ---
TRANSCRIPTS="$HOME/.cursor/projects/Users-olliepassingham-Diabeaters-Diabeaters/agent-transcripts"
if [[ -d "$TRANSCRIPTS" ]]; then
  echo "Copying agent-transcripts…"
  cp -R "$TRANSCRIPTS" "$DEST/cursor/agent-transcripts"
fi

PERSONAL_STORE="$HOME/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/u327362407"
if [[ -d "$PERSONAL_STORE" ]]; then
  echo "Copying personal agent store…"
  cp -R "$PERSONAL_STORE" "$DEST/cursor/personal-agent-store"
fi

PROJECT_STORE="$HOME/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/68b48e45-d489-432d-897f-5f202df20600"
if [[ -d "$PROJECT_STORE" ]]; then
  echo "Copying project agent store…"
  cp -R "$PROJECT_STORE" "$DEST/cursor/project-agent-store"
fi

if [[ -d "$HOME/.cursor/skills-cursor" ]]; then
  echo "Copying skills-cursor…"
  cp -R "$HOME/.cursor/skills-cursor" "$DEST/cursor/skills-cursor"
fi

if [[ -f "$HOME/Library/Application Support/Cursor/User/settings.json" ]]; then
  cp "$HOME/Library/Application Support/Cursor/User/settings.json" "$DEST/cursor/settings.json"
fi

# --- Local env / native config (gitignored) ---
for f in .env .env.local app/.env.local android/app/google-services.json; do
  if [[ -f "$REPO_ROOT/$f" ]]; then
    mkdir -p "$DEST/env/$(dirname "$f")"
    cp "$REPO_ROOT/$f" "$DEST/env/$f"
    echo "Copied $f (contents not printed)"
  else
    echo "Skip missing $f"
  fi
done

cat > "$DEST/notes/README.txt" <<EOF
Diabeaters Cursor-only backup ($STAMP)

1. Before signing into the new Cursor account, also copy User Rules manually:
   Cursor Settings → Rules → paste into notes/cursor-user-rules-backup.md
2. After new account sign-in, restore env files to the same relative paths under the repo.
3. Paste User Rules into the new account Settings → Rules.
4. Do NOT commit this folder to GitHub.
5. Chat/agent archives are for reference; they may not reappear as native UI history.
EOF

echo "Done. Next: save User Rules into $DEST/notes/cursor-user-rules-backup.md"
echo "Manifest:"
find "$DEST" -type f | sed "s|^$HOME|~|" | head -80
