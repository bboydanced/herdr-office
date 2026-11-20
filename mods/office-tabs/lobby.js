// A room's lobby: a tab whose only pane is the office-lobby mod (no terminal,
// no process). Herdr closes a space with its last tab, so with a lobby in it a
// room stays open when you close the last tab of your own: the lobby shows
// (an empty room) until you open another or close the room yourself. The tab
// bar and the floor never show it; it is put away (tab.settle) while the room
// has other tabs. Office Spaces keeps one in every room (lobbyPlan).
//
// A mod can't import outside its folder, so this file is the source and
// office-spaces/lobby.js and office-tabs/lobby.js are verbatim copies
// (test/lib.test.mjs fails when they drift): edit here, then copy.

export const LOBBY_MOD = "office-lobby";

// The ids of the tabs that are lobbies, from panes(): every pane in them is the lobby.
export function lobbyTabs(panes) {
  const lobby = new Set(), other = new Set();
  for (const p of panes ?? []) (p.mod === LOBBY_MOD ? lobby : other).add(p.tab);
  return new Set([...lobby].filter((tab) => !other.has(tab)));
}

// What keeps every room's lobby right, from spaces() and lobbyTabs():
// `add` the rooms without one; `close` a second one (two windows each made
// one), keeping the first; `settle` the lobby while the room has other tabs;
// `leave` a lobby the shown room shows beside other tabs: { space, to }, the
// tab nearest it (after it on a tie) to show instead.
export function lobbyPlan(spaces, lobbies) {
  const add = [], close = [], settle = [], leave = [];
  for (const s of spaces ?? []) {
    const tabs = s.tabs ?? [];
    const mine = tabs.filter((c) => lobbies.has(c.id));
    const others = tabs.filter((c) => !lobbies.has(c.id));
    if (!mine.length) {
      if (others.length) add.push(s.id);
      continue;
    }
    const [keep, ...extra] = mine;
    for (const c of extra) close.push(c.id);
    if (!others.length) continue;
    if (keep.active) {
      if (s.active) {
        const far = (c) => Math.abs(c.index - keep.index) * 2 - (c.index > keep.index ? 1 : 0);
        leave.push({ space: s.id, to: others.reduce((best, c) => (far(c) < far(best) ? c : best)).id });
      }
    } else if (!keep.settled) settle.push(keep.id);
  }
  return { add, close, settle, leave };
}
