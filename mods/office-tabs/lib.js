// Office tabs MOD pure functions: no herdr / gpui-kit imports, loadable by node
// for tests. Data handling only; reading caches and drawing live in main.js.

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

// A cache older than this is marked stale: the status line rewrites it on every
// response, so five minutes of silence means the number is no longer live.
export const STALE_SECONDS = 300;

const JOB_SET = new Set(JOBS);
const SESSIONS_DIR = "data/office/sessions";
const PORTRAITS_DIR = "mods/office-agents/art";
const SPRITES_DIR = "mods/office-agents/sprites";
// Roles with full-body animation (drawn by tools/build-art.py); any other
// role falls back to its portrait.
const SPRITE_JOBS = new Set(JOBS);

// Local terminal id: same rule as scripts/office-statusline.mjs writes.
const LOCAL_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

// Only a finite 0-100 number is a percentage; anything else means no data.
function pct(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

// Text fields: drop control and bidi characters, collapse whitespace, trim, cap.
// Same rule as scripts/office-statusline.mjs; enforced again on read.
function cleanText(value, max) {
  if (typeof value !== "string") return null;
  const s = value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim();
  return s === "" ? null : [...s].slice(0, max).join("");
}

// Session name (Claude Code /rename) caps at 80 characters.
const NAME_MAX = 80;
export function cleanName(value) {
  return cleanText(value, NAME_MAX);
}

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

// Full-body sprite: working and blocked have their own loop; done, idle and no
// status share the resting pose.
export function spritePath(job, status) {
  if (typeof job !== "string" || !SPRITE_JOBS.has(job)) return null;
  const state = status === "working" || status === "blocked" ? status : "rest";
  return `${SPRITES_DIR}/${job}-${state}.gif`;
}

// Cache files exist only for local terminals; a remote id (vps/t7) has none.
export function cachePath(appHomeDir, address) {
  if (typeof appHomeDir !== "string") return null;
  const base = appHomeDir.replace(/\/+$/, "");
  if (base === "") return null;
  if (typeof address !== "string" || !LOCAL_ID.test(address)) return null;
  return `${base}/${SESSIONS_DIR}/${address}.json`;
}

// A remote agent reads the cache in that machine's default Herdr folder; with
// `on`, readTextFile resolves the relative path from that machine's home.
const MACHINE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export function remoteCachePath(address) {
  if (typeof address !== "string") return null;
  const parts = address.split("/");
  if (parts.length !== 2 || !MACHINE.test(parts[0]) || !LOCAL_ID.test(parts[1])) return null;
  return { on: parts[0], path: `.config/herdr-app/${SESSIONS_DIR}/${parts[1]}.json` };
}

// Cache content: { updatedAt, contextRemainingPct, fiveHourRemainingPct,
// sessionName }. A bad field only nulls that field; a bad updatedAt discards
// the whole file.
export function parseCache(text) {
  if (typeof text !== "string" || text.trim() === "") return null;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  const updatedAt = data.updatedAt;
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || updatedAt < 0) return null;
  return {
    updatedAt,
    hp: pct(data.contextRemainingPct),
    sp: pct(data.fiveHourRemainingPct),
    name: cleanName(data.sessionName),
  };
}
