// Office files: the pure parts (no Herdr), so test/lib.test.mjs can check them.
// Listing, git status and worktrees as the shell prints them, ranking a filter,
// line ranges of a selection and how a file is named to an agent.
//
// LISTING and LANG come from Herdr's `files` mod (Apache-2.0).
// Upstream: https://github.com/herdrdev/herdr-app

// One folder: kind and name of each entry, NUL-separated, at most 501 (.git left out).
export const LISTING = 'n=0; for p in "$1"/* "$1"/.[!.]* "$1"/..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; name=${p##*/}; [ "$name" = .git ] && continue; if [ -d "$p" ]; then kind=d; else kind=f; fi; printf "%s\\0%s\\0" "$kind" "$name"; n=$((n+1)); [ "$n" -gt 500 ] && break; done; test -d "$1"';
export const PER_FOLDER = 500;

// -> [{ name, dir }], folders first, then by name.
export function parseListing(text) {
  if (typeof text !== "string") return [];
  const fields = text.split("\0");
  const out = [];
  for (let i = 0; i + 1 < fields.length; i += 2) if (fields[i + 1]) out.push({ name: fields[i + 1], dir: fields[i] === "d" });
  return out.slice(0, PER_FOLDER).sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
}

// `git status --porcelain=v1 -z --no-renames`: -> [{ path, mark }], mark A (new
// or untracked), D, U (conflict) or M.
export function parseStatus(text) {
  if (typeof text !== "string") return [];
  return text.split("\0").filter((e) => e.length > 3).map((e) => {
    const xy = e.slice(0, 2);
    const mark = xy === "??" || xy.includes("A") ? "A" : xy.includes("U") ? "U" : xy.includes("D") ? "D" : "M";
    return { path: e.slice(3), mark };
  });
}

// When each changed file was last written: `stat` per path, "<seconds>\0<path>\0".
export const STAMPS = 'cd "$1" || exit 1; shift; for f; do m=$(stat -c %Y -- "$f" 2>/dev/null || stat -f %m -- "$f" 2>/dev/null || echo 0); printf "%s\\0%s\\0" "$m" "$f"; done';
// -> Map path -> ms.
export function parseStamps(text) {
  const out = new Map();
  if (typeof text !== "string") return out;
  const f = text.split("\0");
  for (let i = 0; i + 1 < f.length; i += 2) if (f[i + 1]) out.set(f[i + 1], (Number(f[i]) || 0) * 1000);
  return out;
}

// `git worktree list --porcelain`: the ones the boss made, under <root>/.worktrees/.
// -> [{ path, branch }] (branch without refs/heads/; "" when detached).
export function parseWorktrees(text, root) {
  if (typeof text !== "string" || !root) return [];
  const out = [];
  let cur = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("worktree ")) { cur = { path: line.slice(9).trim(), branch: "" }; out.push(cur); }
    else if (cur && line.startsWith("branch ")) cur.branch = line.slice(7).trim().replace(/^refs\/heads\//, "");
  }
  const under = `${root.replace(/\/+$/, "")}/.worktrees/`;
  return out.filter((w) => w.path.startsWith(under) && !w.path.slice(under.length).includes("/"));
}

// The changed files of a checkout, last written first. -> [{ path, mark, at }].
export function changedList(status, stamps) {
  return status.map((s) => ({ ...s, at: stamps?.get(s.path) ?? 0 })).sort((a, b) => b.at - a.at || a.path.localeCompare(b.path));
}

// A filter over every file's path: the name holding the query wins, then the
// path holding it, then the letters in order. Case-insensitive. -> best `max`.
export function rankFiles(paths, query, max = 200) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q || !Array.isArray(paths)) return [];
  const scored = [];
  for (const p of paths) {
    const low = p.toLowerCase();
    const base = low.slice(low.lastIndexOf("/") + 1);
    let score;
    if (base === q) score = 0;
    else if (base.startsWith(q)) score = 1;
    else if (base.includes(q)) score = 2;
    else if (low.includes(q)) score = 3;
    else {
      let i = 0;
      for (const ch of low) if (ch === q[i]) i++;
      if (i < q.length) continue;
      score = 4;
    }
    scored.push([score, p.length, p]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2])).slice(0, max).map((s) => s[2]);
}

// The lines a selection covers (UTF-16 offsets, as JS strings count), 1-based;
// a selection ending at the start of a line leaves that line out. null with
// nothing selected.
export function lineRange(text, range) {
  if (typeof text !== "string" || !range || range.end <= range.start) return null;
  const end = Math.min(range.end, text.length);
  const lineAt = (i) => { let n = 1; for (let k = 0; k < i && k < text.length; k++) if (text.charCodeAt(k) === 10) n++; return n; };
  const from = lineAt(range.start);
  let to = lineAt(end);
  if (to > from && text.charCodeAt(end - 1) === 10) to--;
  return { from, to };
}

// How a file (and lines) is named to an agent: path, path:12 or path:12-30.
export function fileRef(path, lines) {
  if (!lines) return path;
  return lines.from === lines.to ? `${path}:${lines.from}` : `${path}:${lines.from}-${lines.to}`;
}

// A file as the agent will find it: relative when the agent works in that root.
export function refFor(root, path, agentCwd) {
  const clean = (p) => String(p ?? "").replace(/\/+$/, "");
  return agentCwd && clean(agentCwd) === clean(root) ? path : `${clean(root)}/${path}`;
}

const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", cjs: "js", toml: "yaml", yml: "yaml", jsonc: "json", svelte: "html", vue: "html", htm: "html", md: "markdown", markdown: "markdown" };
// The editor's language for a path.
export function langOf(path) {
  const name = String(path ?? "").slice(String(path ?? "").lastIndexOf("/") + 1);
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "txt";
  return LANG[ext] ?? ext;
}

export const isMarkdown = (path) => /\.(md|markdown|mdx)$/i.test(String(path ?? ""));

// "now", "5m", "3h", "2d".
export function ago(at, now) {
  if (!at) return "";
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// A path split for a row: its name, and the folder it is in.
export function splitPath(path) {
  const p = String(path ?? "");
  const cut = p.lastIndexOf("/");
  return cut < 0 ? { name: p, dir: "" } : { name: p.slice(cut + 1), dir: p.slice(0, cut) };
}

// What the window says when a save meets a file changed meanwhile.
export const STALE = /stale|changed|mismatch|expected/i;

// Every file under a folder, for the filter: git's (tracked and untracked, not
// ignored), else find's, NUL-separated.
export const ALL_FILES = 'cd "$1" || exit 1; if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then git ls-files -co --exclude-standard -z; else find . -type f ! -path "*/.git/*" ! -path "*/node_modules/*" -print0 2>/dev/null | head -c 4000000; fi';
export function parseAll(text, max = 50000) {
  if (typeof text !== "string") return [];
  return text.split("\0").filter(Boolean).map((p) => (p.startsWith("./") ? p.slice(2) : p)).slice(0, max);
}

// The panel and its window talk through shared values: the file to open
// ({ root, path, on, seq }), and the window that closed last.
export const OPEN = "office-files.open";
export const CLOSED = "office-files.closed";

// `git diff --name-status -z --no-renames A...B`: what a worktree's branch
// changed, committed. -> [{ path, mark }] (A, D or M).
export function parseNameStatus(text) {
  if (typeof text !== "string") return [];
  const f = text.split("\0");
  const out = [];
  for (let i = 0; i + 1 < f.length; i += 2) {
    if (!f[i] || !f[i + 1]) continue;
    out.push({ path: f[i + 1], mark: f[i][0] === "A" ? "A" : f[i][0] === "D" ? "D" : "M" });
  }
  return out;
}

// Committed and not: the uncommitted mark wins for a path in both.
export function mergeChanges(committed, uncommitted) {
  const by = new Map(committed.map((s) => [s.path, s]));
  for (const s of uncommitted) by.set(s.path, s);
  return [...by.values()];
}

// The folders holding a changed file (each ancestor), for a dot in the tree.
export function changedDirs(paths) {
  const out = new Set();
  for (const p of paths) for (let i = p.indexOf("/"); i > 0; i = p.indexOf("/", i + 1)) out.add(p.slice(0, i));
  return out;
}
