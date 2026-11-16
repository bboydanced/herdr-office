// Groups of spaces you make yourself, shared by Office Agent, the Office panel,
// the Spaces list and the group dialog. Pure, so node can test it; the store
// helpers take Herdr's setShared rather than importing it.
//
// A mod can't import outside its folder, so this file is the source and
// office-spaces/groups.js and office-space-new/groups.js are verbatim copies
// (test/lib.test.mjs fails when they drift): edit here, then copy.
//
// shared("office.groups") (and localStorage "office.groups", its kept copy):
// [{ id, name, spaces, folded }]. A space sits in one group at most.

const KEY = "office.groups";

// Anything that isn't a group is dropped, so a hand-edited value can't break the office.
export function readGroups(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const g of value) {
    if (!g || typeof g !== "object") continue;
    const id = typeof g.id === "string" && g.id ? g.id : null;
    const name = typeof g.name === "string" ? g.name.replace(/\s+/g, " ").trim() : "";
    if (!id || !name || out.some((k) => k.id === id)) continue;
    const spaces = Array.isArray(g.spaces) ? [...new Set(g.spaces.filter((s) => typeof s === "string"))] : [];
    out.push({ id, name: name.slice(0, 40), spaces, folded: g.folded === true });
  }
  return out;
}

// The groups now: the shared value, else the kept copy (before anything shared it).
export function loadGroups(stored) {
  if (Array.isArray(stored)) return readGroups(stored);
  try { return readGroups(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "[]")); } catch { return []; }
}

export function saveGroups(list, setShared) {
  const clean = readGroups(list);
  globalThis.localStorage?.setItem(KEY, JSON.stringify(clean));
  setShared(KEY, clean);
  return clean;
}

export const newGroupId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Rows folded into groups: a group appears where its first space is, holding its
// spaces in the rows' order; a space in no group stands alone. A group with no
// row here doesn't appear, so a filtered list never shows an empty band.
// -> [{ band, rows }] (band: the group) and [{ band: null, rows: [row] }].
export function planGroups(rows, groups, idOf = (r) => r?.space?.id) {
  const list = Array.isArray(rows) ? rows : [];
  const owner = new Map();
  for (const g of groups ?? []) for (const id of g.spaces) if (!owner.has(id)) owner.set(id, g.id);
  const held = new Map((groups ?? []).map((g) => [g.id, { band: g, rows: [] }]));
  const out = [];
  for (const row of list) {
    const entry = held.get(owner.get(idOf(row)));
    if (!entry) { out.push({ band: null, rows: [row] }); continue; }
    if (!entry.rows.length) out.push(entry);
    entry.rows.push(row);
  }
  return out;
}

// The group a space is in, or null.
export function groupOf(groups, space) {
  return (groups ?? []).find((g) => g.spaces.includes(space))?.id ?? null;
}

// Writes a group from the dialog: its spaces leave any other group; a new id
// goes last, an existing one keeps its place and fold.
export function putGroup(groups, { id, name, spaces }) {
  const picked = new Set(spaces);
  const mine = { id, name, spaces: [...picked], folded: false };
  const next = (groups ?? []).map((g) => (g.id === id
    ? { ...mine, folded: g.folded }
    : { ...g, spaces: g.spaces.filter((s) => !picked.has(s)) }));
  if (!next.some((g) => g.id === id)) next.push(mine);
  return next;
}

// A space's id changes when it is closed and opened again. `gone` ids leave
// their groups; each [space, group] in `back` joins that group if it still
// exists and the space is in none. -> the groups, or null when nothing changed.
export function regroup(groups, gone, back) {
  const drop = new Set(gone);
  let changed = false;
  const next = (groups ?? []).map((g) => {
    const spaces = g.spaces.filter((s) => !drop.has(s));
    if (spaces.length !== g.spaces.length) changed = true;
    return { ...g, spaces };
  });
  for (const [space, gid] of back) {
    const g = next.find((k) => k.id === gid);
    if (!g || groupOf(next, space)) continue;
    g.spaces.push(space);
    changed = true;
  }
  return changed ? next : null;
}
