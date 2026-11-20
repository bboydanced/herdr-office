#!/bin/sh
# Hire an agent the way `hc run --bg --no-notify` does, but at the size of the
# pane it will sit in (half the boss's width): a hire started at hc's headless
# 200 columns draws its first message that wide, and it comes apart (split
# lines, grey blank rows) once the office seats it in a narrower pane.
#
#   sh hire.sh --name <role>-<topic> [--task "<few words>"] [--piece "<piece>"]
#     [--cwd <folder>] <agent or office-* template> [args...] <<'EOF'
#   <the task>
#   EOF
#
# Prints hc's answer (JSON, with first_message for a template). Needs hc, awk,
# sed and tr only.
set -eu

die() { printf 'hire.sh: %s\n' "$1" >&2; exit 2; }

name='' task='' piece='' cwd=$PWD
while [ $# -gt 0 ]; do
  case $1 in
    --name|--task|--piece|--cwd) [ $# -ge 2 ] || die "$1 needs a value" ;;
  esac
  case $1 in
    --name) name=$2; shift 2 ;;
    --task) task=$2; shift 2 ;;
    --piece) piece=$2; shift 2 ;;
    --cwd) cwd=$2; shift 2 ;;
    --) shift; break ;;
    -*) die "unknown option $1" ;;
    *) break ;;
  esac
done
[ -n "$name" ] || die "--name is required"
[ $# -gt 0 ] || die "no agent given"
[ -n "${HC_TERMINAL_ID:-}" ] || die "run it from the boss's terminal (no HC_TERMINAL_ID)"

# A JSON string of what comes in on stdin (newlines kept as \n).
json() {
  awk 'BEGIN { ORS = ""; printf "\"" }
    NR > 1 { printf "\\n" }
    { gsub(/\\/, "&&"); gsub(/"/, "\\\""); gsub(/\t/, "\\t"); gsub(/\r/, ""); gsub(/[\001-\037]/, ""); printf "%s", $0 }
    END { printf "\"" }'
}
str() { printf '%s' "$1" | json; }

argv=''
for a in "$@"; do argv="$argv${argv:+,}$(str "$a")"; done
if [ ! -t 0 ]; then
  body=$(json)
  [ "$body" = '""' ] || argv="$argv,$body"
fi

labels=''
[ -z "$task" ] || labels="\"office.task\":$(str "$task")"
[ -z "$piece" ] || labels="$labels${labels:+,}\"office.piece\":$(str "$piece")"

# Half the boss's width: every seat beside it (right of it, or down from that)
# is about that wide. Narrower than the pane is harmless; wider is what breaks.
me=$(hc get "$HC_TERMINAL_ID" --json 2>/dev/null | tr ',{}' '\n\n\n' || true)
cols=$(printf '%s\n' "$me" | sed -n 's/^ *"cols": *\([0-9][0-9]*\) *$/\1/p' | head -n 1)
rows=$(printf '%s\n' "$me" | sed -n 's/^ *"rows": *\([0-9][0-9]*\) *$/\1/p' | head -n 1)
size=''
if [ -n "$cols" ] && [ -n "$rows" ]; then
  cols=$((cols / 2 - 1)); [ "$cols" -ge 60 ] || cols=60
  [ "$rows" -ge 10 ] || rows=10
  size=",\"size\":{\"cols\":$cols,\"rows\":$rows}"
fi

# PATH from here: the core's own may lack the agent (nvm, ~/.local/bin).
req="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"terminal.run\",\"params\":{\"argv\":[$argv],\"name\":$(str "$name"),\"cwd\":$(str "$cwd"),\"caller\":$(str "$HC_TERMINAL_ID"),\"no_notify\":true,\"labels\":{$labels},\"env\":{\"PATH\":$(str "$PATH")}$size}}"

out=$(printf '%s\n' "$req" | hc connect)
printf '%s\n' "$out"
# Only before "argv": past it, hc echoes the task, which may say anything.
case ${out%%\"argv\"*} in
  *'"error":'*) exit 1 ;;
esac
