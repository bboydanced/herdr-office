// Office MOD pure functions: no herdr / gpui-kit imports, loadable by node for
// tests. Who sits where, roles, labels and picture paths; drawing lives in
// main.js. tabDesks, deskJobs and the role helpers are copied verbatim into
// mods/office-tabs/lib.js, so the faces on a tab match the desks here.

// The eight office roles. Order is the fallback rotation for unlisted tabs.
export const JOBS = [
  "analyst",
  "designer",
  "developer",
  "intern",
  "manager",
  "support",
  "tester",
  "writer",
];

const JOB_SET = new Set(JOBS);
const PORTRAITS_DIR = "mods/office-agents/art";
const DESKS_DIR = "mods/office-agents/desks";
const STATES = new Set(["working", "blocked", "done", "idle"]);

export const EMPTY_DESK = `${DESKS_DIR}/empty.png`;
export const DESK_SHADOW = `${DESKS_DIR}/shadow.png`;

// Tab name to role: exact match only, case-insensitive, whitespace-trimmed.
// Only own keys are scanned, so constructor/__proto__ cannot match by accident.
export function jobFor(name, jobs) {
  if (typeof name !== "string") return null;
  const wanted = name.trim().toLowerCase();
  if (wanted === "") return null;
  if (jobs === null || typeof jobs !== "object" || Array.isArray(jobs)) return null;
  for (const key of Object.keys(jobs)) {
    if (key.trim().toLowerCase() !== wanted) continue;
    const job = jobs[key];
    return typeof job === "string" && JOB_SET.has(job.trim()) ? job.trim() : null;
  }
  return null;
}

// Every tab name in screen order, then any that only exist as agents, so a new
// tab lands at the end and existing tabs keep their face.
export function tabNames(spaces, agents) {
  return [
    ...(spaces ?? []).flatMap((s) => (s.tabs ?? []).map((t) => t.name)),
    ...(agents ?? []).map((a) => a.tab_name),
  ];
}

const nameKey = (name) => name.trim().toLowerCase();

// Assign roles: jobs.json wins, the rest rotate from a hash of the name and skip
// roles already taken; only past eight names does anything repeat.
export function assignJobs(names, jobs) {
  const list = [...new Set((names ?? []).filter((n) => typeof n === "string" && n.trim() !== "").map(nameKey))];
  const out = new Map();
  const used = new Set();
  for (const key of list) {
    const job = jobFor(key, jobs);
    if (job) { out.set(key, job); used.add(job); }
  }
  for (const key of list) {
    if (out.has(key)) continue;
    if (used.size >= JOBS.length) used.clear();
    const start = [...key].reduce((n, c) => n + c.codePointAt(0), 0);
    const job = Array.from({ length: JOBS.length }, (_, i) => JOBS[(start + i) % JOBS.length]).find((j) => !used.has(j));
    out.set(key, job);
    used.add(job);
  }
  return out;
}

export function jobIn(name, assigned) {
  return typeof name === "string" ? assigned.get(nameKey(name)) ?? null : null;
}

// image() only reads paths relative to the Herdr home; only the known roles can
// be composed, so no traversal path is ever built.
export function portraitPath(job) {
  return typeof job === "string" && JOB_SET.has(job) ? `${PORTRAITS_DIR}/${job}.png` : null;
}

// Every tab's desks: a desk per pane in the tab's pane order (an agent, or
// nobody), then one per agent with no pane of its own (a sub-agent).
export function tabDesks(spaces, panes, agents) {
  const paneIds = new Set((panes ?? []).map((p) => p.pane));
  const byPane = new Map();
  const extra = new Map();
  for (const a of agents ?? []) {
    if (a.pane && paneIds.has(a.pane)) byPane.set(a.pane, a);
    else extra.set(a.tab, [...(extra.get(a.tab) ?? []), a]);
  }
  const out = new Map();
  for (const p of panes ?? []) out.set(p.tab, [...(out.get(p.tab) ?? []), { pane: p, agent: byPane.get(p.pane) ?? null }]);
  for (const [tab, list] of extra) out.set(tab, [...(out.get(tab) ?? []), ...list.map((agent) => ({ pane: null, agent }))]);
  return out;
}

// Every agent's role, by address. A tab's first agent keeps the tab's role (the
// role jobs.json gives its name); the others get roles of their own, so a tab's
// agents don't share a face while roles last.
export function deskJobs(spaces, panes, agents, jobs) {
  const desks = tabDesks(spaces, panes, agents);
  const seated = [];
  for (const s of spaces ?? []) {
    for (const tab of s.tabs ?? []) {
      (desks.get(tab.id) ?? []).filter((d) => d.agent)
        .forEach((d, i) => seated.push({ tab: tab.name, address: d.agent.address, first: i === 0 }));
    }
  }
  const own = (s) => `#${s.address}`;
  const assigned = assignJobs([...tabNames(spaces, agents), ...seated.filter((s) => !s.first).map(own)], jobs);
  return new Map(seated.map((s) => [s.address, jobIn(s.first ? s.tab : own(s), assigned)]));
}

// An agent's desk: its role's animation for its status (anything unknown dozes).
export function deskPath(job, status) {
  if (typeof job !== "string" || !JOB_SET.has(job)) return null;
  return `${DESKS_DIR}/${job}-${STATES.has(status) ? status : "idle"}.gif`;
}

// A cubicle's columns: up to three desks in a row, four as two by two.
export function deskColumns(n) {
  return n <= 3 ? Math.max(1, n) : n === 4 ? 2 : 3;
}

// The office plan: a rug per space in the Spaces list's order, a cubicle per tab,
// its desks from tabDesks. Put-away tabs stay out unless someone in them needs
// you; empty cubicles and rugs go.
export function officePlan(spaces, panes, agents) {
  const desks = tabDesks(spaces, panes, agents);
  return (spaces ?? [])
    .map((space) => ({
      space,
      tabs: (space.tabs ?? [])
        .filter((tab) => !tab.settled || tab.status === "blocked")
        .map((tab) => ({ tab, desks: desks.get(tab.id) ?? [] }))
        .filter((c) => c.desks.length > 0),
    }))
    .filter((row) => row.tabs.length > 0);
}

const FILTERS = new Set(["working", "blocked", "done"]);

// The plan narrowed to desks whose agent is in `status` (working, blocked or
// done); anything else keeps it whole. Cubicles and rugs left empty go.
export function filterPlan(plan, status) {
  if (!FILTERS.has(status)) return plan ?? [];
  return (plan ?? [])
    .map((row) => ({
      ...row,
      tabs: row.tabs
        .map((c) => ({ ...c, desks: c.desks.filter((d) => d.agent?.status === status) }))
        .filter((c) => c.desks.length > 0),
    }))
    .filter((row) => row.tabs.length > 0);
}

// How many agents are in each status.
export function tally(agents) {
  const out = { working: 0, blocked: 0, done: 0, idle: 0 };
  for (const a of agents ?? []) out[a.status in out ? a.status : "idle"]++;
  return out;
}

// How many desks of `slot` points fit side by side in `width`, `gap` apart.
export function fitAcross(width, slot, gap) {
  if (!(width > 0) || !(slot > 0)) return 1;
  return Math.max(1, Math.min(6, Math.floor((width + gap) / (slot + gap))));
}

// How long ago `since` (ms since the epoch; seconds are taken too) was, short:
// "now", "4m", "2h 5m", "3d". Nothing for nothing.
export function ago(since, now) {
  if (typeof since !== "number" || !Number.isFinite(since) || since <= 0 || typeof now !== "number") return "";
  const at = since < 1e12 ? since * 1000 : since;
  const m = Math.floor(Math.max(0, now - at) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// The second line under a wide desk: the agent's status and for how long (the
// tab's: working since, else last changed). null for a desk with nobody.
export function deskState(agent, tab, now) {
  if (!agent) return null;
  const status = agent.status in STATUS ? agent.status : "idle";
  const when = ago(status === "working" ? tab?.working_since : tab?.changed_at, now);
  return { status, text: when ? `${STATUS[status]} · ${when}` : STATUS[status] };
}

// A terminal's screen as `hc read` prints it, made safe to draw: escape
// sequences, control and bidi characters out, tabs as spaces, trailing blanks
// and empty lines at the end dropped; the last `n` lines, each at most `width`.
export function screenLines(text, n = 14, width = 240) {
  if (typeof text !== "string" || n <= 0) return [];
  const lines = text
    .replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007\u001b]*(\u0007|\u001b\\)/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+$/, "").slice(0, width));
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.slice(-n);
}

// The first non-empty line of a command's output, cleaned, for a short note.
export function firstLine(text) {
  return screenLines(typeof text === "string" ? text.split("\n").find((l) => l.trim()) ?? "" : "", 1, 120)[0]?.trim() ?? "";
}

export const DEFAULT_REPLIES = ["continue", "run the tests", "commit it", "explain what you changed"];

// replies.json: the quick replies under the message box, a list of strings
// (at most eight, each at most 80 characters); anything else keeps the defaults.
export function parseReplies(text) {
  let list;
  try { list = JSON.parse(text); } catch { return DEFAULT_REPLIES; }
  if (!Array.isArray(list)) return DEFAULT_REPLIES;
  const out = list.filter((r) => typeof r === "string").map((r) => r.replace(/\s+/g, " ").trim()).filter((r) => r && r.length <= 80);
  return out.length ? out.slice(0, 8) : DEFAULT_REPLIES;
}

// Split directions as layout documents write them: side by side, or stacked.
const ACROSS = new Set(["row", "right", "left", "horizontal", "h", "x"]);
const STACKED = new Set(["column", "col", "down", "up", "vertical", "v", "y"]);

// Which of `want` a value names anywhere inside it.
function named(value, want, out = new Set()) {
  if (typeof value === "string") {
    if (want.has(value)) out.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) named(v, want, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) named(v, want, out);
  }
  return out;
}

// The objects right under a node, arrays flattened, in order.
function kids(node) {
  const out = [];
  for (const v of Object.values(node)) {
    for (const x of Array.isArray(v) ? v : [v]) if (x && typeof x === "object" && !Array.isArray(x)) out.push(x);
  }
  return out;
}

function direction(node) {
  for (const v of Object.values(node)) {
    const word = typeof v === "string" ? v.toLowerCase() : "";
    if (ACROSS.has(word)) return "across";
    if (STACKED.has(word)) return "stacked";
  }
  return null;
}

// A tab's pane tree, read from Herdr's layout document without relying on its
// exact shape: the smallest object naming every one of the tab's panes, then
// down through splits (child objects sharing the panes out between them, with
// a direction word) to single panes. { pane } or { dir: "across" | "stacked",
// children }; null when the document doesn't say, and desks keep pane order.
export function splitTree(doc, paneIds) {
  const want = new Set((paneIds ?? []).filter((p) => typeof p === "string" && p !== ""));
  if (want.size === 0 || !doc || typeof doc !== "object") return null;
  if (named(doc, want).size < want.size) return null;
  let node = doc;
  for (let next; (next = kids(node).find((k) => named(k, want).size === want.size)); ) node = next;
  const build = (n, ids) => {
    if (ids.size === 1) return { pane: [...ids][0] };
    const parts = kids(n).map((k) => [k, named(k, ids)]).filter(([, found]) => found.size > 0);
    if (parts.length === 1 && parts[0][1].size === ids.size) return build(parts[0][0], ids);
    const dir = direction(n);
    if (!dir || parts.length < 2 || parts.reduce((sum, [, found]) => sum + found.size, 0) !== ids.size) return null;
    const children = parts.map(([k, found]) => build(k, found));
    return children.every(Boolean) ? { dir, children } : null;
  };
  return build(node, want);
}

// How many desks wide a pane tree is.
export function treeWidth(tree) {
  if (!tree) return 0;
  if (tree.pane) return 1;
  const widths = tree.children.map(treeWidth);
  return tree.dir === "across" ? widths.reduce((a, b) => a + b, 0) : Math.max(...widths);
}

// A pane id as its own machine's document writes it: without the "machine/".
export function localId(id, machine) {
  return machine && typeof id === "string" && id.startsWith(`${machine}/`) ? id.slice(machine.length + 1) : id;
}

const clean = (v) => typeof v === "string"
  ? v.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, "").replace(/^[^\p{L}\p{N}]+/u, "").replace(/\s+/g, " ").trim().slice(0, 60)
  : "";
// A shell's own title: "user@host:~/some/folder".
const PROMPT = /^[^\s@]+@[^\s:]+:/;

// The line under a desk. An agent: its terminal's title without the spinner or
// status marks in front, else its program. A shell: "Terminal". Anything else:
// its program's name.
export function deskLabel({ agent, pane } = {}) {
  if (agent) {
    const title = clean(agent.title);
    return (title && !PROMPT.test(title) ? title : clean(agent.program?.name)) || "Agent";
  }
  if (!pane) return "";
  if (pane.mod) return clean(pane.title) || clean(pane.mod) || "Panel";
  if (!pane.program || pane.program.shell) return "Terminal";
  return clean(pane.program.name) || "Terminal";
}

// The last two folders of a path, enough to tell terminals apart.
export function shortPath(path) {
  if (typeof path !== "string" || path === "") return "";
  const parts = path.replace(/\/+$/, "").split("/").filter(Boolean);
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : path;
}

const STATUS = { working: "Working", blocked: "Needs you", done: "Done", idle: "Idle" };

// Hover text for a desk: who, doing what, where.
export function deskTip({ job, agent, pane, space, tab }) {
  const where = `${space?.name ?? ""} › ${tab?.name ?? ""}`;
  if (!agent) return [deskLabel({ pane }) || "Terminal", shortPath(pane?.cwd) || "No agent here", where].join("\n");
  const who = job ? job[0].toUpperCase() + job.slice(1) : "Agent";
  return [`${who} · ${STATUS[agent.status] ?? agent.status}`, agent.program?.name, deskLabel({ agent }), where]
    .filter(Boolean).join("\n");
}

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

// A theme colour with a two-digit alpha; anything that isn't #rrggbb(aa) stays as is.
export function withAlpha(color, alpha) {
  return typeof color === "string" && HEX.test(color) ? `${color.slice(0, 7)}${alpha}` : color;
}

// Two #rrggbb colours mixed, `t` of the way from `a` to `b`; a non-hex `a` stays.
export function mixHex(a, b, t) {
  if (typeof a !== "string" || !HEX.test(a) || typeof b !== "string" || !HEX.test(b)) return a;
  const ch = (c, i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, "0")).join("")}`;
}

// A space's colour: the one the Spaces list gave it (`space.colors`, a theme key
// such as "ansi6"), else muted like its folder there (home gets none).
export function spaceColor(theme, colors, id) {
  const key = colors && typeof colors === "object" ? colors[id] : null;
  return (typeof key === "string" && typeof theme?.[key] === "string" && theme[key]) || theme?.muted || theme?.accent;
}

// ---- the boss ---------------------------------------------------------------

// A shell word for the brief: quoted when it has anything but plain characters.
const word = (w) => (/^[\w./:@%+=,-]+$/.test(w) ? w : `'${String(w).replace(/'/g, "'\\''")}'`);

// What the boss is told when hired: where its playbook is (boss.md, the job in
// full), the rules that matter most in case it can't read it, then the goal.
// One line, so every agent takes it as one message.
export function bossBrief({ goal, playbook, argv, folder, space, most = 4 } = {}) {
  const task = typeof goal === "string" ? goal.replace(/\s+/g, " ").trim() : "";
  const run = (Array.isArray(argv) ? argv : []).filter((a) => typeof a === "string" && a).map(word).join(" ") || "claude";
  const cwd = typeof folder === "string" && folder ? ` --cwd ${word(folder)}` : "";
  return [
    `You are the boss: the team lead of the space "${space ?? "this space"}" in Herdr${folder ? ` (folder: ${folder})` : ""}.`,
    typeof playbook === "string" && playbook
      ? `Read your playbook now and follow it: ${playbook} (read it again whenever your context is compacted). Also run \`hc --skill\` once.`
      : "Run `hc --skill` once to learn hc.",
    `In short: do not write code yourself; at most ${most} hires working at a time, each hired with`,
    `hc run --bg --name <role>-<topic> --label office.task="<the task in a few words>"${cwd} ${run} "<task>"`,
    "(role: developer, designer, tester, analyst, writer, support or intern);",
    "keep what you are doing in hc label $HC_TERMINAL_ID office.say=\"<one short line>\";",
    "never approve a hire's permission prompt for the person;",
    "ask the person before anything destructive (deleting files, git push, merging, force, resets, installs); never print secrets.",
    `Goal: ${task}`,
  ].join(" ");
}

// A terminal's label (`hc label`), as one clean line; "" when it has none.
// Labels come as { key: value }, as ["key=value"] or as [{ key, value }].
export function labelOf(term, key) {
  const labels = term?.labels;
  let value = null;
  if (Array.isArray(labels)) {
    for (const l of labels) {
      if (typeof l === "string" && l.startsWith(`${key}=`)) value = l.slice(key.length + 1);
      else if (l && typeof l === "object" && l.key === key) value = l.value;
    }
  } else if (labels && typeof labels === "object" && Object.prototype.hasOwnProperty.call(labels, key)) {
    value = labels[key];
  }
  return typeof value === "string" ? firstLine(value).slice(0, 140) : "";
}

const ROLE_WORDS = [
  ["developer", ["developer", "dev", "frontend", "backend", "fe", "be", "api", "code", "coder", "engineer", "fix", "impl", "build"]],
  ["designer", ["designer", "design", "ui", "ux", "css", "style", "layout"]],
  ["tester", ["tester", "test", "tests", "qa", "e2e", "spec"]],
  ["analyst", ["analyst", "review", "reviewer", "research", "data", "audit", "plan"]],
  ["writer", ["writer", "docs", "doc", "readme", "write", "copy"]],
  ["support", ["support", "ops", "deploy", "devops", "infra", "ci", "release"]],
  ["intern", ["intern", "helper", "misc"]],
];

// A hired agent's role from its name ("tester-e2e", "frontend_nav"): the first
// word that names one; null when none does.
export function roleFromName(name) {
  if (typeof name !== "string") return null;
  for (const token of name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
    const hit = ROLE_WORDS.find(([, words]) => words.includes(token));
    if (hit) return hit[0];
  }
  return null;
}

// A tab with this name holds a space's boss.
export const isBossTab = (tab) => typeof tab?.name === "string" && tab.name.trim().toLowerCase() === "boss";

// Every space's boss: { space id: terminal address }. First a live agent labelled
// office.role=boss with that space in office.space (labelled once found, so a boss
// sent back without a pane or a renamed tab keeps it); else the agent nobody
// started in the space's "Boss" tab. Never a shell: a goal sent to one would run
// as a command. `prev` (the last answer) wins ties.
export function findBosses({ spaces, panes, terminals, agents, prev } = {}) {
  const live = (terminals ?? []).filter((t) => t && typeof t.address === "string" && t.state !== "finished");
  const byAddress = new Map(live.map((t) => [t.address, t]));
  const reporting = new Set((agents ?? []).map((a) => a?.address));
  const isAgent = (address, pane) => reporting.has(address) || byAddress.get(address)?.program?.agent === true
    || Boolean(pane && (pane.status || pane.program?.agent));
  const ids = new Set((spaces ?? []).map((s) => s.id));
  const marked = new Map();
  for (const t of live) {
    const space = labelOf(t, "office.space");
    if (labelOf(t, "office.role") !== "boss" || !ids.has(space) || !isAgent(t.address)) continue;
    marked.set(space, [...(marked.get(space) ?? []), t.address]);
  }
  const out = {};
  for (const s of spaces ?? []) {
    const was = prev?.[s.id];
    const labelled = marked.get(s.id) ?? [];
    let boss = labelled.find((a) => a === was) ?? labelled[0];
    if (!boss) {
      const tab = (s.tabs ?? []).find(isBossTab);
      const mine = tab ? (panes ?? []).filter((p) => p.tab === tab.id && p.terminal
        && !byAddress.get(p.terminal)?.parent && isAgent(p.terminal, p)) : [];
      boss = (mine.find((p) => p.terminal === was) ?? mine[0])?.terminal;
    }
    if (boss) out[s.id] = boss;
  }
  return out;
}

// Who the boss hired and still has: the live terminals whose parent is the boss
// (a remote boss's children name their parent without the machine).
export function staffOf(terminals, boss) {
  if (typeof boss !== "string" || !boss) return [];
  const cut = boss.lastIndexOf("/");
  const machine = cut > 0 ? boss.slice(0, cut) : null;
  const local = cut > 0 ? boss.slice(cut + 1) : boss;
  return (terminals ?? [])
    .filter((t) => t && typeof t.address === "string" && t.address !== boss && t.state !== "finished"
      && (t.parent === boss || (machine !== null && t.parent === local && t.address.startsWith(`${machine}/`))))
    .map((t) => t.address);
}

// Where the next hire sits in the boss's tab, by how many panes it has: beside
// the boss, under that, under the boss; past four panes, at a desk only.
export function seatStep(panes) {
  return { 1: { from: "boss", place: "right" }, 2: { from: "last", place: "down" }, 3: { from: "boss", place: "down" } }[panes] ?? null;
}

// A screen line without a box around it.
const bare = (line) => (typeof line === "string" ? line.replace(/^[\s│┃|╭╰╮╯─━┌└┐┘]+/, "").replace(/[\s│┃|╭╰╮╯─━┌└┐┘]+$/, "") : "");
const OPTION = /^(?:[❯›>▶➜→]\s*)?(\d)[.)]\s+(.+)$/;

// A waiting agent's question, from the end of its screen: the numbered choices
// it offers (1. Yes / 2. ... / 3. No) and the last three lines above them. Without
// numbered choices, its last two lines and no options.
export function parsePrompt(lines) {
  const shown = (lines ?? []).map(bare);
  let end = -1;
  for (let i = shown.length - 1; i >= 0 && i >= shown.length - 20; i--) if (OPTION.test(shown[i])) { end = i; break; }
  if (end < 0) {
    return { question: shown.filter((l) => /\p{L}.*\p{L}/u.test(l)).slice(-2), options: [] };
  }
  let start = end;
  while (start > 0 && OPTION.test(shown[start - 1])) start--;
  const options = shown.slice(start, end + 1).map((l) => {
    const [, key, label] = l.match(OPTION);
    return { key, label: label.trim().slice(0, 80) };
  });
  const question = shown.slice(Math.max(0, start - 8), start)
    .filter((l) => /\p{L}|\p{N}/u.test(l)).slice(-3).map((l) => l.trim().slice(0, 160));
  return { question, options };
}

// The boss's speech bubble: the last line on its screen that says something
// (not the input box, its hints and mode line, or the spinner's "esc to interrupt").
export function speechLine(lines) {
  const list = lines ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const line = bare(list[i]).replace(/\s*\([^)]*esc to interrupt[^)]*\)\s*$/i, "").trim();
    if ((line.match(/\p{L}/gu) ?? []).length < 3) continue;
    if (/^[>?]|for shortcuts|auto-accept|auto mode|plan mode|bypass permissions|accept edits|shift\+tab|^esc to|ctrl\+/i.test(line)) continue;
    return line.slice(0, 140);
  }
  return "";
}
