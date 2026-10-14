#!/usr/bin/env bash
# notes.sh — docs/notes 渐进式阅读工具（L2：只取需要的小节；只读不写）
#
# 用法（在 docs/notes/ 下执行）：
#   tools/notes.sh help
#   tools/notes.sh map                        小节总表（Markdown，可重定向到 index/anchors.md）
#   tools/notes.sh headings <文件|别名>        列出某文件的小节
#   tools/notes.sh read <文件|别名> ["小节词"]  读一节；省略小节词 = 整篇
#   tools/notes.sh lines <文件|别名> [起] [止]  读行范围（默认 1–60）
#   tools/notes.sh search <关键词>             在原始笔记里全文搜索
#   tools/notes.sh check                      校验索引锚点 / 收录 / 新鲜度
set -u

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
NOTES_DIR="$(cd "$SELF_DIR/.." && pwd)"
INDEX_DIR="$NOTES_DIR/index"
ALIAS_FILE="$INDEX_DIR/aliases.txt"

die() { printf '%s\n' "$*" >&2; exit 1; }

aliases() {
  [ -f "$ALIAS_FILE" ] || return 0
  sed -e 's/[[:space:]]*$//' "$ALIAS_FILE" |
    awk -F'=' 'NF==2 && $1 !~ /^#/ && $1 != "" { print $1 "\t" $2 }'
}

resolve() { # $1 = 文件名或别名；输出绝对路径
  local name="$1" alias target
  while IFS=$'\t' read -r alias target; do
    [ -n "$alias" ] || continue
    if [ "$alias" = "$name" ]; then name="$target"; break; fi
  done <<EOF
$(aliases)
EOF
  case "$name" in
    /*) [ -f "$name" ] || die "找不到文件: $1"; printf '%s' "$name" ;;
    *)  [ -f "$NOTES_DIR/$name" ] || die "找不到文件: $1（相对 docs/notes/）"; printf '%s' "$NOTES_DIR/$name" ;;
  esac
}

list_headings() { awk '/^#+ / { printf "L%d  %s\n", NR, $0 }' "$1"; }

read_section() {
  local file="$1" pat="$2" out hs total
  if [ -z "$pat" ]; then
    total="$(wc -l < "$file" | tr -d ' ')"
    cat "$file"
    printf '\n[整篇 · 共 %s 行]\n' "$total" >&2
    return 0
  fi
  out="$(awk -v pat="$pat" '
    lvl==0 {
      if ($0 ~ /^#+ / && index($0, pat)>0) { h=$0; sub(/ .*/,"",h); lvl=length(h); print; next }
      next
    }
    { if ($0 ~ /^#+ /) { h=$0; sub(/ .*/,"",h); if (length(h)<=lvl) exit } print }
  ' "$file")"
  if [ -z "$out" ]; then
    printf '没找到含「%s」的小节。\n' "$pat" >&2
    hs="$(list_headings "$file")"
    if [ -z "$hs" ]; then
      printf '该文件没有小节标题（可整篇读，共 %s 行）：\n  tools/notes.sh read %s\n' \
        "$(wc -l < "$file" | tr -d ' ')" "${file##*/}" >&2
    else
      printf '该文件的小节有：\n%s\n' "$hs" >&2
    fi
    exit 1
  fi
  printf '%s\n' "$out"
  printf '[以上为含「%s」的小节]\n' "$pat" >&2
}

read_lines() {
  local file="$1" from="${2:-1}" to="${3:-}" total next
  total="$(wc -l < "$file" | tr -d ' ')"
  [ -n "$to" ] || to=$((from + 59))
  [ "$to" -gt "$total" ] && to="$total"
  sed -n "${from},${to}p" "$file"
  if [ "$to" -lt "$total" ]; then
    next=$((to + 1))
    printf '\n[已截断 %s–%s / 共 %s 行；继续：tools/notes.sh lines <文件> %s]\n' \
      "$from" "$to" "$total" "$next"
  fi
}

search_notes() {
  local pat="$1" out n
  out="$(grep -rn --include='*.md' -- "$pat" "$NOTES_DIR" 2>/dev/null | grep -v "/index/" || true)"
  if [ -z "$out" ]; then
    echo "无匹配（已搜原始笔记与 INDEX.md）"
    exit 1
  fi
  n="$(printf '%s\n' "$out" | wc -l | tr -d ' ')"
  printf '%s\n' "$out" | head -40
  if [ "$n" -gt 40 ]; then
    printf '\n[共 %s 处，只显示前 40 处；请缩小关键词，或用 read 取小节]\n' "$n"
  fi
}

map_notes() {
  local preferred f base n hs
  preferred='东周实验室 3f543bf66e8880baac9dc2cb65bb34ec.md
note6.md
note.md
零散.md
note2.md
note3.md
note4.md
note5.md
note7.md
note8.md
note9.md'

  printf '# 笔记小节总表（自动生成）\n\n'
  printf '> 重生成：`tools/notes.sh map` 输出重定向到 `index/anchors.md`。取正文：`tools/notes.sh read <文件或别名> "<小节词>"`。\n'

  printf '%s\n' "$preferred" | while IFS= read -r base; do
    f="$NOTES_DIR/$base"
    [ -f "$f" ] || continue
    n="$(wc -l < "$f" | tr -d ' ')"
    hs="$(list_headings "$f")"
    printf '\n## %s — %s 行\n' "$base" "$n"
    if [ -z "$hs" ]; then
      printf -- '- （无小节标题，整篇读）\n'
    else
      printf '%s\n' "$hs" | sed 's/^/- /'
    fi
  done

  for f in "$NOTES_DIR"/*.md; do
    base="${f##*/}"
    [ "$base" = "INDEX.md" ] && continue
    printf '%s\n' "$preferred" | grep -qxF -- "$base" && continue
    n="$(wc -l < "$f" | tr -d ' ')"
    hs="$(list_headings "$f")"
    printf '\n## %s — %s 行（未列入常用清单）\n' "$base" "$n"
    if [ -z "$hs" ]; then
      printf -- '- （无小节标题，整篇读）\n'
    else
      printf '%s\n' "$hs" | sed 's/^/- /'
    fi
  done
}

check_index() {
  local problems=0 f d base b2 link token target anchor alias target2 tpath hit
  local refs r found

  # 1) 校验 INDEX.md 与 index/ 里反引号引用的 `文件.md#小节` / `别名#小节` / `文件.md`
  for f in "$NOTES_DIR/INDEX.md" "$INDEX_DIR"/*.md; do
    [ -f "$f" ] || continue
    while IFS= read -r token; do
      link="$token"
      case "$link" in *"://"*) continue ;; esac
      anchor=""
      target="$link"
      case "$link" in *"#"*) anchor="${link#*#}"; target="${link%%#*}" ;; esac
      while IFS=$'\t' read -r alias target2; do
        [ -n "$alias" ] || continue
        if [ "$alias" = "$target" ]; then target="$target2"; break; fi
      done <<EOF
$(aliases)
EOF
      case "$target" in
        *.md) ;;
        *) continue ;;
      esac
      case "$target" in
        /*) tpath="$target" ;;
        *)  tpath="$NOTES_DIR/$target" ;;
      esac
      if [ ! -f "$tpath" ]; then
        case "$target" in *" "*) continue ;; esac   # 含空格又不是真实文件：多半是命令，跳过
        printf '✗ 文件不存在：`%s`（来自 %s）\n' "$link" "${f##*/}"
        problems=$((problems + 1))
        continue
      fi
      if [ -n "$anchor" ]; then
        if ! awk -v a="$anchor" '/^#+ / { if (index($0, a) > 0) found=1 } END { exit(found ? 0 : 1) }' "$tpath"; then
          printf '✗ 小节不存在：`%s` → %s 里没有含「%s」的标题（来自 %s）\n' \
            "$link" "$(basename "$tpath")" "$anchor" "${f##*/}"
          problems=$((problems + 1))
        fi
      fi
    done <<EOF
$(grep -oE '`[^`]+`' "$f" | tr -d '`')
EOF
  done

  # 2) 原始笔记是否都进了 INDEX.md 的文件清单
  for f in "$NOTES_DIR"/*.md; do
    base="${f##*/}"
    [ "$base" = "INDEX.md" ] && continue
    if ! grep -qF -- "$base" "$NOTES_DIR/INDEX.md"; then
      printf '✗ INDEX.md 未收录：%s\n' "$base"
      problems=$((problems + 1))
    fi
  done

  # 3) 速览新鲜度：原文比速览新 → 可能过期
  for d in "$INDEX_DIR"/*.md; do
    [ -f "$d" ] || continue
    base="${d##*/}"
    [ "$base" = "anchors.md" ] && continue
    for f in "$NOTES_DIR"/*.md; do
      b2="${f##*/}"
      [ "$b2" = "INDEX.md" ] && continue
      hit=0
      refs=("$b2")
      while IFS=$'\t' read -r alias target2; do
        [ -n "$alias" ] || continue
        if [ "$target2" = "$b2" ]; then refs+=("$alias"); fi
      done <<EOF
$(aliases)
EOF
      for r in "${refs[@]}"; do
        if grep -qF -- "$r" "$d"; then hit=1; break; fi
      done
      if [ "$hit" = 1 ] && [ "$f" -nt "$d" ]; then
        printf '⚠ 速览可能过期：%s 比 %s 新（改完后请更新速览）\n' "$b2" "$base"
        problems=$((problems + 1))
      fi
    done
  done

  # 4) anchors.md 是否比原文旧
  for f in "$NOTES_DIR"/*.md; do
    b2="${f##*/}"
    [ "$b2" = "INDEX.md" ] && continue
    if [ -f "$INDEX_DIR/anchors.md" ] && [ "$f" -nt "$INDEX_DIR/anchors.md" ]; then
      printf '⚠ %s 比 anchors.md 新，建议重生成：tools/notes.sh map > index/anchors.md\n' "$b2"
      problems=$((problems + 1))
    fi
  done

  if [ "$problems" -eq 0 ]; then
    echo "✓ 索引自检通过：锚点可用、文件已收录、速览未过期"
  else
    printf '\n共 %s 个问题（✗ = 必须修，⚠ = 该更新）\n' "$problems"
    exit 1
  fi
}

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
}

cmd="${1:-help}"; shift || true
case "$cmd" in
  help|-h|--help) usage ;;
  map)      map_notes ;;
  headings) [ $# -ge 1 ] || die "用法: tools/notes.sh headings <文件|别名>"; list_headings "$(resolve "$1")" ;;
  read)     [ $# -ge 1 ] || die "用法: tools/notes.sh read <文件|别名> [\"小节词\"]"; read_section "$(resolve "$1")" "${2:-}" ;;
  lines)    [ $# -ge 1 ] || die "用法: tools/notes.sh lines <文件|别名> [起] [止]"; read_lines "$(resolve "$1")" "${2:-1}" "${3:-}" ;;
  search)   [ $# -ge 1 ] || die "用法: tools/notes.sh search <关键词>"; search_notes "$1" ;;
  check)    check_index ;;
  *)        die "未知命令: $cmd（用 tools/notes.sh help）" ;;
esac
