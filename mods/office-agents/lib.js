// Office MOD pure functions: no herdr / gpui-kit imports, loadable by node for
// tests. The office plan, roles and picture paths; drawing lives in main.js.

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
// a desk per pane in the tab's pane order (an agent, or nobody). An agent with no
// pane of its own (a sub-agent) takes an extra desk at the end of its tab. Put-away
// tabs stay out unless someone in them needs you; empty cubicles and rugs go.
export function officePlan(spaces, panes, agents) {
  const paneIds = new Set((panes ?? []).map((p) => p.pane));
  const byPane = new Map();
  const extra = new Map();
  for (const a of agents ?? []) {
    if (a.pane && paneIds.has(a.pane)) byPane.set(a.pane, a);
    else extra.set(a.tab, [...(extra.get(a.tab) ?? []), a]);
  }
  const byTab = new Map();
  for (const p of panes ?? []) byTab.set(p.tab, [...(byTab.get(p.tab) ?? []), p]);
  return (spaces ?? [])
    .map((space) => ({
      space,
      tabs: (space.tabs ?? [])
        .filter((tab) => !tab.settled || tab.status === "blocked")
        .map((tab) => ({
          tab,
          desks: [
            ...(byTab.get(tab.id) ?? []).map((pane) => ({ pane, agent: byPane.get(pane.pane) ?? null })),
            ...(extra.get(tab.id) ?? []).map((agent) => ({ pane: null, agent })),
          ],
        }))
        .filter((c) => c.desks.length > 0),
    }))
    .filter((row) => row.tabs.length > 0);
}

// Every agent's role. A tab's first agent keeps the tab's role, the face on its
// tab; the others get roles of their own, so a tab's agents don't share a face
// while roles last. `names`: tabNames(), so tab roles match the tab bar's.
export function deskJobs(plan, jobs, names) {
  const seated = [];
  for (const row of plan ?? []) {
    for (const c of row.tabs) {
      c.desks.filter((d) => d.agent).forEach((d, i) => seated.push({ tab: c.tab.name, address: d.agent.address, first: i === 0 }));
    }
  }
  const own = (s) => `#${s.address}`;
  const assigned = assignJobs([...(names ?? []), ...seated.filter((s) => !s.first).map(own)], jobs);
  return new Map(seated.map((s) => [s.address, jobIn(s.first ? s.tab : own(s), assigned)]));
}

// The line under a desk: the terminal's title without the spinner or status marks
// programs put in front of it, else the fallback (the program's name).
export function deskLabel(title, fallback) {
  const clean = (v) => typeof v === "string"
    ? v.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029‪-‮⁦-⁩]/g, "")
      .replace(/^[^\p{L}\p{N}]+/u, "").replace(/\s+/g, " ").trim().slice(0, 60)
    : "";
  return clean(title) || clean(fallback);
}

const STATUS = { working: "Working", blocked: "Needs you", done: "Done", idle: "Idle" };

// Hover text for a desk: who, doing what, where.
export function deskTip({ job, agent, pane, space, tab }) {
  const where = `${space?.name ?? ""} › ${tab?.name ?? ""}`;
  if (!agent) return [deskLabel(pane?.title, pane?.program?.name) || "Terminal", "No agent here", where].join("\n");
  const who = job ? job[0].toUpperCase() + job.slice(1) : "Agent";
  return [`${who} · ${STATUS[agent.status] ?? agent.status}`, agent.program?.name, deskLabel(agent.title), where]
    .filter(Boolean).join("\n");
}

// A theme colour with a two-digit alpha; anything that isn't #rrggbb(aa) stays as is.
export function withAlpha(color, alpha) {
  return typeof color === "string" && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color) ? `${color.slice(0, 7)}${alpha}` : color;
}

// A space's colour: the one the Spaces list gave it (`space.colors`, a theme key
// such as "ansi6"), else muted like its folder there (home gets none).
export function spaceColor(theme, colors, id) {
  const key = colors && typeof colors === "object" ? colors[id] : null;
  return (typeof key === "string" && typeof theme?.[key] === "string" && theme[key]) || theme?.muted || theme?.accent;
}
