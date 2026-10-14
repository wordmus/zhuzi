#!/bin/bash
query="$1"
ARCHIVE="$HOME/.skills-archive"
if [ -z "$query" ]; then
  echo "Usage: archived-skills search <keyword>"
  exit 1
fi
echo "=== Search results for: $query ==="
# Scan the archive root and one level of namespace subdirectories (e.g.
# from-agents/), so batch-archived skills stay searchable.
for d in "$ARCHIVE"/*/ "$ARCHIVE"/*/*/; do
  [ -d "$d" ] || continue
  [ -f "$d/SKILL.md" ] || continue
  name=$(basename "$d")
  if grep -qi "$query" "$d/SKILL.md" 2>/dev/null || echo "$name" | grep -qi "$query"; then
    desc=$(grep -m1 '^description:' "$d/SKILL.md" 2>/dev/null | cut -d: -f2- | sed 's/^[ "]*//;s/[ "]*$//' | head -c 140)
    printf "• %-30s %s\n" "$name" "$desc"
  fi
done
