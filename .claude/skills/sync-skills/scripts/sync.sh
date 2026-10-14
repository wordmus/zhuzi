#!/bin/bash
# ~/.skills/sync-skills/scripts/sync.sh
# Central skill synchronization manager
# Usage: ./sync.sh <command> [args]

set -euo pipefail

CENTRAL="$HOME/.skills"
ARCHIVE="$HOME/.skills-archive"
CLAUDE_SKILLS="$HOME/.claude/skills"
GEMINI_SKILLS="$HOME/.gemini/skills"
CODEX_SKILLS="$HOME/.codex/skills"
GROK_SKILLS="$HOME/.grok/skills"
PI_SKILLS="$HOME/.pi/agent/skills"
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Every consumer location that receives central-repo symlinks. Each is
# refreshed independently; real directories are never overwritten.
CONSUMER_DIRS=(
  "$CLAUDE_SKILLS"
  "$GEMINI_SKILLS"
  "$CODEX_SKILLS"
  "$GROK_SKILLS"
  "$PI_SKILLS"
)

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[sync-skills]${NC} $*"; }
ok()  { echo -e "${GREEN}[ok]${NC} $*"; }
warn(){ echo -e "${YELLOW}[warn]${NC} $*"; }

normalized_link_target() {
  local link="$1"
  local target
  target=$(readlink "$link")
  printf '%s\n' "${target%/}"
}

refresh_symlinks() {
  local target_dir="$1"
  local label="$2"
  local linked=0
  local skipped=0
  local removed=0
  local link raw name skill_dir target

  mkdir -p "$target_dir"

  # Remove stale links previously managed by this central repository. Leave all
  # unrelated links and real directories untouched.
  for link in "$target_dir"/*; do
    [ -L "$link" ] || continue
    raw=$(normalized_link_target "$link")
    case "$raw" in
      "$CENTRAL"/*)
        name=$(basename "$link")
        if [ ! -f "$CENTRAL/$name/SKILL.md" ]; then
          unlink "$link"
          removed=$((removed + 1))
        fi
        ;;
    esac
  done

  for skill_dir in "$CENTRAL"/*/; do
    skill_dir=${skill_dir%/}
    [ -f "$skill_dir/SKILL.md" ] || continue
    name=$(basename "$skill_dir")
    target="$target_dir/$name"

    if [ -L "$target" ]; then
      raw=$(normalized_link_target "$target")
      if [ "$raw" = "$skill_dir" ]; then
        linked=$((linked + 1))
      else
        warn "$label: kept non-central link for '$name' -> $raw"
        skipped=$((skipped + 1))
      fi
      continue
    fi

    if [ -e "$target" ]; then
      warn "$label: kept existing real entry for '$name'"
      skipped=$((skipped + 1))
      continue
    fi

    ln -s "$skill_dir/" "$target"
    linked=$((linked + 1))
  done

  ok "$label: $linked central links ready; $removed stale links removed"
  if [ "$skipped" -gt 0 ]; then
    warn "$label: $skipped conflicts skipped (no entries overwritten)"
  fi
}

cmd_status() {
  local central_count=0
  local central_real=0
  local central_links=0
  local skill_dir name loc target raw
  local linked collisions missing wrong broken entry

  for skill_dir in "$CENTRAL"/*/; do
    skill_dir=${skill_dir%/}
    [ -f "$skill_dir/SKILL.md" ] || continue
    central_count=$((central_count + 1))
    if [ -L "$skill_dir" ]; then
      central_links=$((central_links + 1))
    else
      central_real=$((central_real + 1))
    fi
  done

  echo "=== Skill Central Sync Status ==="
  echo
  echo "Central (source of truth): $CENTRAL"
  echo "  Valid skills: $central_count ($central_real real directories, $central_links linked sources)"
  echo
  echo "Grok paths configured in ~/.grok/config.toml:"
  grep -A 10 '\[skills\]' "$HOME/.grok/config.toml" 2>/dev/null || echo "  (not found)"
  echo
  echo "Consumer locations:"

  for loc in "${CONSUMER_DIRS[@]}"; do
    linked=0
    collisions=0
    missing=0
    wrong=0
    broken=0

    for skill_dir in "$CENTRAL"/*/; do
      skill_dir=${skill_dir%/}
      [ -f "$skill_dir/SKILL.md" ] || continue
      name=$(basename "$skill_dir")
      target="$loc/$name"
      if [ -L "$target" ]; then
        raw=$(normalized_link_target "$target")
        if [ "$raw" = "$skill_dir" ]; then
          linked=$((linked + 1))
        else
          wrong=$((wrong + 1))
        fi
      elif [ -e "$target" ]; then
        collisions=$((collisions + 1))
      else
        missing=$((missing + 1))
      fi
    done

    if [ -d "$loc" ]; then
      for entry in "$loc"/*; do
        if [ -L "$entry" ] && [ ! -e "$entry" ]; then
          broken=$((broken + 1))
        fi
      done
    fi

    echo "  $loc"
    echo "    central links=$linked, real conflicts=$collisions, wrong links=$wrong, missing=$missing, broken top-level links=$broken"
  done
}

cmd_sync_all() {
  log "Refreshing symlinks in all known locations..."
  local loc
  for loc in "${CONSUMER_DIRS[@]}"; do
    refresh_symlinks "$loc" "$(basename "$(dirname "$loc")")/$(basename "$loc")"
  done
  ok "All non-conflicting locations synchronized with ~/.skills"
}

# Write the one-line pointer that keeps an archived skill discoverable: the
# stub stays in the central repo so agents still match on its name, and its
# description routes them to the archived copy.
write_archive_stub() {
  local name="$1" desc="$2"
  mkdir -p "$CENTRAL/$name"
  cat > "$CENTRAL/$name/SKILL.md" <<STUB
---
name: $name
description: "【已归档】$desc 本技能不在活跃技能库中。需要时读取 $ARCHIVE/$name/SKILL.md，或运行 ~/.skills/sync-skills/scripts/sync.sh restore $name 取回。"
---

# $name（已归档）

活跃技能库中只保留这个指针，完整内容在：

\`$ARCHIVE/$name/\`

取回（会让它在所有 agent 中重新可用）：

\`\`\`bash
~/.skills/sync-skills/scripts/sync.sh restore $name
\`\`\`
STUB
}

cmd_archive() {
  local skill_name="" with_stub=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --with-stub) with_stub=1 ;;
      *) skill_name="$1" ;;
    esac
    shift
  done
  case "$skill_name" in
    ""|*[!a-z0-9-]*)
      echo "Usage: $0 archive [--with-stub] <skill-name>"
      exit 1
      ;;
  esac

  local src="$CENTRAL/$skill_name" dst="$ARCHIVE/$skill_name"
  if [ ! -f "$src/SKILL.md" ]; then
    warn "'$skill_name' is not an active central skill."
    exit 1
  fi
  if [ -L "$src" ]; then
    warn "Refusing to archive a symlinked skill: $src"
    exit 1
  fi
  if [ -e "$dst" ]; then
    warn "'$skill_name' already exists in the archive. Aborting."
    exit 1
  fi

  local desc=""
  if [ "$with_stub" -eq 1 ]; then
    desc=$(grep -m1 '^description:' "$src/SKILL.md" 2>/dev/null | cut -d: -f2- | sed 's/^ *//; s/^"//; s/"$//' | cut -c1-100)
    [ -n "$desc" ] || desc="（原描述缺失）"
  fi

  mkdir -p "$ARCHIVE"
  mv "$src" "$dst" || exit 1
  if [ "$with_stub" -eq 1 ]; then
    write_archive_stub "$skill_name" "$desc"
    ok "Archived '$skill_name' -> $dst (stub left in central, links stay live)"
  else
    ok "Archived '$skill_name' -> $dst (no stub; find it via the archived-skills skill)"
  fi
  cmd_sync_all
}

cmd_restore() {
  local skill_name="${1:-}"
  case "$skill_name" in
    ""|*[!a-z0-9-]*)
      echo "Usage: $0 restore <skill-name>"
      exit 1
      ;;
  esac

  local src="$ARCHIVE/$skill_name" dst="$CENTRAL/$skill_name"
  if [ ! -d "$src" ]; then
    warn "'$skill_name' is not in the archive."
    exit 1
  fi
  if [ -e "$dst" ] && [ ! -f "$dst/SKILL.md" ]; then
    warn "Refusing to restore: '$dst' already exists and is not a stub. Resolve manually."
    exit 1
  fi

  # A leftover stub is the only thing we are willing to replace here.
  [ -f "$dst/SKILL.md" ] && rm -rf "$dst"
  mv "$src" "$dst" || exit 1
  ok "Restored '$skill_name' -> $dst (available in all agents)"
  cmd_sync_all
}

cmd_promote() {
  local skill_name="${1:-}"
  local found=""
  local candidate
  local dst

  case "$skill_name" in
    ""|*[!a-z0-9-]*)
      echo "Usage: $0 promote <lowercase-hyphenated-skill-name>"
      exit 1
      ;;
  esac

  for candidate in \
    "$CODEX_SKILLS/$skill_name" \
    "$GROK_SKILLS/$skill_name" \
    "$HOME/.agents/skills/$skill_name"
  do
    if [ -d "$candidate" ] && [ -f "$candidate/SKILL.md" ]; then
      found="$candidate"
      break
    fi
  done

  if [ -z "$found" ]; then
    warn "Could not find '$skill_name' in Codex, Grok copy, or .agents"
    exit 1
  fi

  if [ -L "$found" ]; then
    warn "Refusing to promote symlink source: $found"
    warn "Promote the real source directory instead."
    exit 1
  fi

  dst="$CENTRAL/$skill_name"
  if [ -e "$dst" ] || [ -L "$dst" ]; then
    warn "$skill_name already exists in central. Aborting."
    exit 1
  fi

  if [ "$found" = "$CODEX_SKILLS/$skill_name" ]; then
    mv "$found" "$dst"
    ok "Promoted '$skill_name' from Codex -> $dst (moved to preserve one source of truth)"
  else
    cp -a "$found" "$dst"
    ok "Promoted '$skill_name' from $found -> $dst (source retained)"
  fi

  cmd_sync_all
}

cmd_materialize_linked() {
  python3 "$SCRIPT_DIR/materialize_linked_skills.py" apply "$@"
  cmd_sync_all
}

cmd_source_status() {
  python3 "$SCRIPT_DIR/materialize_linked_skills.py" status "$@"
}

cmd_list_central() {
  local d name desc
  echo "=== Skills in Central Repository (~/.skills) ==="
  for d in "$CENTRAL"/*/; do
    d=${d%/}
    [ -f "$d/SKILL.md" ] || continue
    name=$(basename "$d")
    desc=$(grep -m1 '^description:' "$d/SKILL.md" 2>/dev/null | cut -d: -f2- | xargs || echo "")
    printf "  %-30s %s\n" "$name" "${desc:0:80}"
  done
}

case "${1:-}" in
  status)        cmd_status ;;
  sync-all|sync) cmd_sync_all ;;
  promote)       cmd_promote "${2:-}" ;;
  archive)       cmd_archive "${2:-}" ;;
  restore)       cmd_restore "${2:-}" ;;
  materialize-linked)
    shift
    cmd_materialize_linked "$@"
    ;;
  source-status)
    shift
    cmd_source_status "$@"
    ;;
  list)          cmd_list_central ;;
  *)
    echo "sync-skills manager"
    echo
    echo "Commands:"
    echo "  status                 Show current state across tools"
    echo "  sync-all               Safely refresh central symlinks"
    echo "  promote <name>         Promote a skill to central + refresh"
    echo "  archive [--with-stub] <name>"
    echo "                         Move a skill to ~/.skills-archive and drop it from all agents"
    echo "  restore <name>         Bring an archived skill back into all agents"
    echo "  materialize-linked     Copy linked central skills into independent snapshots"
    echo "  source-status          Compare snapshots with central and original sources"
    echo "  list                   List skills currently in ~/.skills"
    echo
    echo "Examples:"
    echo "  ~/.skills/sync-skills/scripts/sync.sh promote tdd"
    echo "  ~/.skills/sync-skills/scripts/sync.sh archive img2threejs"
    echo "  ~/.skills/sync-skills/scripts/sync.sh restore img2threejs"
    echo "  ~/.skills/sync-skills/scripts/sync.sh sync-all"
    echo "  ~/.skills/sync-skills/scripts/sync.sh materialize-linked"
    echo "  ~/.skills/sync-skills/scripts/sync.sh source-status"
    ;;
esac
