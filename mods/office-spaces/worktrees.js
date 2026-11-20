// Worktree rooms and the branches in a room, the same in Spaces and the office.
// Spaces knows from git which rooms are worktrees of another room's repo and
// lists them under it; it shares that as "space.trees" (room id -> the room of
// its main checkout) so the office puts their rugs under that room's too.
//
// A mod can't import outside its folder, so this file is the source and
// office-spaces/worktrees.js is a verbatim copy (test/lib.test.mjs fails when
// they drift): edit here, then copy.

// The branches a room's terminals are on, each once, in the order of its panes
// (from panes(); a mod's pane has none).
export function branchesOf(space, panes) {
  const tabs = new Set((space?.tabs ?? []).map((c) => c.id));
  return [...new Set((panes ?? []).filter((p) => tabs.has(p.tab) && p.terminal && p.branch).map((p) => p.branch))];
}

// A group's count: its rooms (the ones with a number), then its worktrees'
// rooms, which have none, when it has any: "1 space · 2 worktrees".
export const roomCount = (rooms, trees = 0) =>
  `${rooms} space${rooms === 1 ? "" : "s"}${trees > 0 ? ` · ${trees} worktree${trees === 1 ? "" : "s"}` : ""}`;

// Rows ({ space, ... }) with each worktree room moved into its main room's
// `kids` (from "space.trees"), when that room is among them and under no other;
// every row left gets `kids` ([] for most).
export function nestRows(rows, trees) {
  const ids = new Set((rows ?? []).map((r) => r.space.id));
  const want = (r) => {
    const p = trees?.[r.space.id];
    return typeof p === "string" && p !== r.space.id && ids.has(p) ? p : null;
  };
  const tops = new Set((rows ?? []).filter((r) => !want(r)).map((r) => r.space.id));
  const parentOf = (r) => (tops.has(want(r)) ? want(r) : null);
  const kids = new Map();
  for (const r of rows ?? []) {
    const p = parentOf(r);
    if (p) kids.set(p, [...(kids.get(p) ?? []), r]);
  }
  return (rows ?? []).filter((r) => !parentOf(r)).map((r) => ({ ...r, kids: kids.get(r.space.id) ?? [] }));
}
