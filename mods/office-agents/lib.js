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
