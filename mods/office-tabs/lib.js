// Office tabs MOD pure functions: no herdr / gpui-kit imports, loadable by node
// for tests. Who sits at which tab: copied verbatim from mods/office-agents/lib.js
// (roles, tabDesks, deskJobs), so the faces on a tab match its desks in the office.

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
