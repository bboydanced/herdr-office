// Office spaces: the lobby's room directory. Each space is a room: a door in the
// space's colour (the same colour as its rug in the office below) with its room
// number, a lamp over it (off, breathing while someone works, blinking while
// someone waits for you) and its window lit while anyone is in. Worktrees under
// their checkout, grouped by machine when more than one is known. After a space's
// name, the repo its first terminal is in now, only where unusual: branch,
// ahead/behind; under it git as sticky notes and the faces of the staff inside
// (as the office draws them: it shares who wears which role as "office.faces").
// Hovering a room lights its rug in the office and back ("office.hover"); a click
// on the faces opens the Office panel. Click to switch, right-click for its menu,
// drag to reorder; hovering shows + (a tab), rename and close. A space Herdr
// closes (its last tab went) stays as a closed room, its door shut and its lamp
// off: a click opens it again in the same folder, × forgets it. Every "+" opens
// the office-space-new dialog, which starts where you are, not in home.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, machines, panes, agents, run, openOverlay, exec, hc, home, theme, shared, setShared, watchFolder, window, layout } from "herdr";

// A theme colour with a two-digit alpha (theme colours are #rrggbb).
const alpha = (c, a) => (typeof c === "string" && /^#[0-9a-fA-F]{6}/.test(c) ? `${c.slice(0, 7)}${a}` : c);
// A #rrggbb colour darkened by `k` (0..1); anything else stays.
const darken = (c, k) => (typeof c === "string" && /^#[0-9a-fA-F]{6}/.test(c)
  ? `#${[1, 3, 5].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * (1 - k)).toString(16).padStart(2, "0")).join("")}`
  : c);

const INK = "#1d2733";
// The office's roles: only these name a portrait, whatever "office.faces" holds.
const ROLES = new Set(["analyst", "designer", "developer", "intern", "manager", "support", "tester", "writer"]);
const portrait = (job) => (ROLES.has(job) ? `mods/office-agents/art/${job}.png` : null);

// The most urgent status among some agents: waiting beats working.
const urgent = (list) => (list.some((a) => a.status === "blocked") ? "blocked" : list.some((a) => a.status === "working") ? "working" : null);

// The space under the pointer, here or in the office: set only when it changes
// (every mod redraws on a shared value, and a redraw reports hover again).
function hoverSpace(id, on) {
  const now = shared("office.hover") ?? null;
  const next = on ? id : now === id ? null : now;
  if (next !== now) setShared("office.hover", next);
}

// A room's door in the space's colour: its number on the plate, a lamp above
// (off; breathing while someone works; blinking while someone waits) and a
// window lit while anyone is in.
function door(id, number, color, status, occupied, t) {
  const box = (top, left, w, h, bg) => div().absolute().top(top).left(left).w(w).h(h).bg(bg);
  const lamp = { working: t.working, blocked: t.blocked }[status] ?? "#3a4250";
  return div().relative().w(26).h(32).flex_none()
    .when(status === "working", (el) => el.child(box(0, 5, 16, 6, alpha(t.working, "50")).id(`${id}-halo`)
      .loop("opacity", { from: 0, to: 1, period: 1100 })))
    .child(box(0, 8, 10, 3, lamp).id(`${id}-lamp`)
      .when(status === "working", (el) => el.loop("opacity", { from: 0.45, to: 1, period: 1100 }))
      .when(status === "blocked", (el) => el.loop("opacity", { from: 0.2, to: 1, period: 600, easing: "linear" })))
    .child(box(4, 0, 26, 28, darken(color, 0.45)))
    .child(box(5, 2, 22, 27, color))
    .child(box(8, 5, 16, 6, occupied ? "#f0c06ecc" : "#16202b"))
    .child(box(8, 12, 2, 6, darken(color, 0.3)))
    .child(box(17, 5, 15, 10, "#efe6d2").flex().items_center().justify_center()
      .text_size(8).font_bold().text_color(INK).child(number))
    .child(box(23, 21, 2, 2, "#e8ba62"));
}

// A sticky note for the git summary.
const note = (color, text) => div().relative().flex_none().h(13).px(4).flex().items_center().bg(color)
  .text_size(9.5).font_semibold().text_color(INK).child(text)
  .child(div().absolute().right(0).bottom(0).size(3).bg("#00000030"));

// A row where someone works breathes in the working colour under a steady frame;
// one where someone waits blinks a thick frame over a red tint (as in the office).
function activity(id, status, t) {
  const fill = () => div().absolute().top(0).left(0).right(0).bottom(0);
  if (status === "working") {
    return {
      under: [fill().id(`${id}-glow`).bg(alpha(t.working, "2e")).loop("opacity", { from: 0.15, to: 1, period: 1100 })],
      over: [fill().border(1).border_color(t.working)],
    };
  }
  if (status === "blocked") {
    return {
      under: [fill().bg(alpha(t.blocked, "30"))],
      over: [fill().id(`${id}-blink`).border(2).border_color(t.blocked).loop("opacity", { from: 0.2, to: 1, period: 600, easing: "linear" })],
    };
  }
  return { under: [], over: [] };
}

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// Where a space is now: its first terminal's live folder, else where it was made.
// `ps`: panes(), read once by the caller (each read copies every pane).
function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}
// Every folder a space has a terminal in: its tabs are often different projects.
function keysOf(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  const dirs = new Set(ps.filter((p) => tabs.has(p.tab) && p.cwd).map((p) => p.cwd));
  if (!dirs.size && s.folder) dirs.add(s.folder);
  return [...dirs].map((d) => JSON.stringify([s.machine ?? null, d]));
}
const rowHeight = ({ tree }) => (tree ? 28 : 44);
const where = (s, ps) => JSON.stringify([s.machine ?? null, place(s, ps)]);
const base = (path) => path.replace(/\/+$/, "").split("/").pop();
// Changes made outside Herdr (an editor's save, a commit in another app): looked
// for this often, in repos the list shows, while the window is in front.
const FALLBACK = 60000;
// Closed rooms remembered, newest first; shared as "office.rooms" for the dialog.
const ROOMS = 12;
const roomKey = (r) => JSON.stringify([r.machine ?? null, r.folder]);

// The new-space dialog, on that machine (null: this computer).
function newSpace(machine) {
  const rooms = (shared("office.rooms") ?? []).filter((r) => (r.machine ?? null) === (machine ?? null)).length;
  openOverlay({ mod: "office-space-new", kind: "dialog", width: 480, height: 300 + Math.min(rooms + 3, 6) * 30, props: { machine: machine ?? null } });
}

// What a stored color name looks like on an avatar (the same in every mod
// that draws space avatars): one strong color per hue, light and dark alike.

// A space speaks up only when something in it needs you.
export function glyph(status) {
  return status === "blocked" || status === "done" ? "●" : "·";
}

export function tone(t, status) {
  return t[status] ?? t.unknown;
}

export default class Spaces extends View {
  init(_props, cx) {
    this.colors = {};
    this.staff = [];
    this.git = {}; // where() -> { name, branch, ahead, behind, repo, linked }, null: not a repo
    this.checked = {}; // where() -> when it was last looked at
    this.unsure = new Set(); // where()s git couldn't answer for (a machine away)
    this.pending = new Set(); // where()s to look at next
    this.busy = {}; // pane -> an agent working or a program in front of its shell
    this.ready = {}; // machine -> its layout was readable at the last look
    this.at = {}; // space -> its where() at the last look
    this.watching = new Set(); // local repos' git folders
    // Spaces made while this runs wait (at most a moment) for their git, so a
    // worktree appears under its repo instead of jumping there.
    this.shown = new Set(spaces().map((s) => s.id));
    this.born = {};
    this.pressed = null;
    this.over = null;
    this.machines = [];
    this.folded = new Set(JSON.parse(localStorage.getItem("machines.folded") ?? "[]"));
    // Rooms: the open ones as last seen (id -> { name, named, folder, machine, color }),
    // and the closed ones, newest first.
    this.known = JSON.parse(localStorage.getItem("rooms.known") ?? "{}");
    this.closed = JSON.parse(localStorage.getItem("rooms.closed") ?? "[]");
    this.closedOpen = localStorage.getItem("rooms.folded") !== "1";
    this.reopening = null; // { machine, folder, color, before, until }: its colour comes back
    this.hovering = null;
    setShared("office.rooms", this.closed);
    cx.timer.every(1000, (cx) => this.remember(cx));
    this.refreshMachines(cx);
    cx.timer.every(15000, cx => this.refreshMachines(cx));
    // `git status` walks the whole tree, on another machine a process there:
    // only when its answer could have changed (see `due`).
    cx.timer.every(250, (cx) => this.checkNew(cx));
  }

  // Notes where each open room is; one gone from a machine that answers was closed.
  remember(cx) {
    const sp = spaces(), ps = panes();
    const ready = new Set(machines().filter((m) => m.layout === "ready").map((m) => m.name ?? null));
    const colors = shared("space.colors") ?? {};
    const known = {};
    for (const s of sp) {
      const folder = place(s, ps);
      known[s.id] = { name: s.name, named: s.named, folder, machine: s.machine ?? null, color: colors[s.id] ?? this.known[s.id]?.color ?? null };
    }
    let closed = this.closed;
    for (const [id, r] of Object.entries(this.known)) {
      if (known[id]) continue;
      // A machine away or still loading hides its spaces: they aren't closed.
      if (!ready.has(r.machine ?? null)) { known[id] = r; continue; }
      if (!r.folder || (!r.machine && r.folder === this.homeDir())) continue;
      closed = [{ ...r, at: Date.now() }, ...closed.filter((c) => roomKey(c) !== roomKey(r))];
    }
    // A room open again isn't closed any more.
    const open = new Set(Object.values(known).map(roomKey));
    closed = closed.filter((c) => !open.has(roomKey(c))).slice(0, ROOMS);
    const k = JSON.stringify(known), c = JSON.stringify(closed);
    if (k !== JSON.stringify(this.known)) localStorage.setItem("rooms.known", k);
    this.known = known;
    if (c !== JSON.stringify(this.closed)) {
      this.closed = closed;
      localStorage.setItem("rooms.closed", c);
      setShared("office.rooms", closed);
      cx.notify();
    }
  }

  homeDir() {
    try { return home(); } catch { return null; }
  }

  // A closed room opened again: same folder, its name if it had one, its colour.
  reopen(r) {
    this.reopening = { machine: r.machine ?? null, folder: r.folder, color: r.color, before: new Set(spaces().map((s) => s.id)), until: Date.now() + 15000 };
    run("space.new", { machine: r.machine ?? "", folder: r.folder, ...(r.named && r.name ? { name: r.name } : {}) });
  }

  forget(r, cx) {
    this.closed = this.closed.filter((c) => roomKey(c) !== roomKey(r));
    localStorage.setItem("rooms.closed", JSON.stringify(this.closed));
    setShared("office.rooms", this.closed);
    cx.notify();
  }

  checkNew(cx) {
    const now = Date.now();
    const sp = spaces();
    for (const s of sp) if (!this.shown.has(s.id)) this.born[s.id] ??= now;
    const due = this.due(now, sp, panes());
    if (due.size) this.refreshGit(due, cx);
    if (sp.some((s) => !this.shown.has(s.id))) cx.notify();
  }

  // Places whose git could have changed: new ones (a new space, a cd), where a
  // command or an agent's turn just ended (a checkout, a commit, edits), those on
  // a machine that is back, and repos in view whose fallback is due.
  due(now, sp, ps) {
    // Moved there: what it knew of that place may be old.
    const at = {};
    for (const s of sp) at[s.id] = where(s, ps);
    const keys = new Set(Object.values(at).filter((k) => JSON.parse(k)[1]));
    for (const s of sp) for (const k of keysOf(s, ps)) keys.add(k);
    const due = new Set([...keys].filter((k) => !(k in this.git)));
    for (const [id, k] of Object.entries(at)) if (this.at[id] && this.at[id] !== k && keys.has(k)) due.add(k);
    this.at = at;
    const spaceOf = {};
    for (const s of sp) for (const t of s.tabs ?? []) spaceOf[t.id] = s;
    const busy = {};
    for (const p of ps) {
      if (!p.terminal || !spaceOf[p.tab]) continue;
      busy[p.pane] = p.status === "working" || !(p.program?.shell || p.program?.agent);
      if (this.busy[p.pane] && !busy[p.pane]) {
        this.sameRepo(at[spaceOf[p.tab].id], keys).forEach((k) => due.add(k));
        if (p.cwd) this.sameRepo(JSON.stringify([spaceOf[p.tab].machine ?? null, p.cwd]), keys).forEach((k) => due.add(k));
      }
    }
    this.busy = busy;
    for (const m of machines()) {
      const ready = m.layout === "ready";
      if (ready && this.ready[m.name] === false) for (const k of keys) if (JSON.parse(k)[0] === m.name) due.add(k);
      this.ready[m.name] = ready;
    }
    if (window().active) {
      for (const k of keys) {
        const asks = this.git[k] || this.unsure.has(k);
        if (asks && !this.folded.has(JSON.parse(k)[0]) && now - (this.checked[k] ?? 0) > FALLBACK) due.add(k);
      }
    }
    return due;
  }

  // `key` and the other places in its repo (a commit there moves their ahead/behind).
  sameRepo(key, keys) {
    const repo = this.git[key]?.repo;
    return [key, ...(repo ? [...keys].filter((k) => this.git[k]?.repo === repo) : [])];
  }

  refreshMachines(cx) {
    cx.spawn(async cx => {
      try { const r = await hc(["machine", "ls", "--json"]); if (r.code === 0) this.machines = (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary); } catch {}
      cx.notify();
    });
  }

  // One look at a time, each place once however often it was asked for meanwhile.
  refreshGit(keys, cx) {
    for (const k of keys) this.pending.add(k);
    if (this.refreshing) return;
    this.refreshing = true;
    cx.spawn(async (cx) => {
      while (this.pending.size) {
        const keys = [...this.pending];
        this.pending.clear();
        for (const key of keys) await this.check(key, cx);
      }
      const used = new Set(Object.values(this.git).filter(Boolean).map((g) => JSON.parse(g.repo)).filter(([on]) => !on).map(([, repo]) => repo));
      for (const repo of this.watching) if (!used.has(repo)) this.watching.delete(repo);
      this.refreshing = false;
      cx.notify();
    });
  }

  // One place's git: branch, ahead/behind, its repo.
  async check(key, cx) {
    const [on, cwd] = JSON.parse(key);
    this.checked[key] = Date.now();
    this.unsure.delete(key);
    try {
      // No optional locks: a status that touched the index would wake the watch again.
      // Writes nothing under .git (index lock, fsmonitor cookie): watch() would wake on it.
      const r = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "safe.bareRepository=explicit", "status", "--porcelain=v2", "--branch"], { cwd, on });
      if (r.code !== 0) {
        // Only git's own "no" is remembered as no repo; anything else is asked again.
        if (!/not a git repository/i.test(r.stderr)) this.unsure.add(key);
        this.git[key] = null;
        return;
      }
      // The repo's own .git folder names it; a worktree's top differs from it.
      const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
      const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, on });
      const repo = common.stdout.trim();
      const name = repo.endsWith("/.git") ? base(repo.slice(0, -5)) : base(repo).replace(/\.git$/, "");
      const info = { name, branch: null, ahead: 0, behind: 0, dirty: 0, upstream: false, top: top.stdout.trim(), repo: JSON.stringify([on, repo]), linked: repo !== `${top.stdout.trim()}/.git` };
      for (const line of r.stdout.split("\n")) {
        if (line && !line.startsWith("# ")) info.dirty++;
        else if (line.startsWith("# branch.upstream ")) info.upstream = true;
        else if (line.startsWith("# branch.head ")) info.branch = line.slice(14);
        else if (line.startsWith("# branch.ab ")) {
          const [a, b] = line.slice(12).split(" ");
          info.ahead = Math.abs(parseInt(a, 10)) || 0;
          info.behind = Math.abs(parseInt(b, 10)) || 0;
        }
      }
      this.git[key] = info;
      if (!on) this.watch(repo, cx);
    } catch {
      // Couldn't ask (the machine is away): keep what it showed, look again later.
      this.git[key] ??= null;
      this.unsure.add(key);
    }
  }

  watch(repo, cx) {
    if (this.watching.has(repo)) return;
    this.watching.add(repo);
    cx.spawn(async (cx) => {
      try {
        while (this.watching.has(repo)) {
          await watchFolder(repo);
          const mine = JSON.stringify([null, repo]);
          if (this.watching.has(repo)) this.refreshGit(Object.keys(this.git).filter((k) => this.git[k]?.repo === mine), cx);
        }
      } catch { this.watching.delete(repo); }
    });
  }

  menu(w) {
    // A popup is as tall as its items; height is only the most.
    openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: w.id } } });
  }

  // Spaces in order, each worktree space moved under its main checkout's.
  ordered() {
    const sp = spaces(), ps = panes();
    const ready = (w) => this.shown.has(w.id) || where(w, ps) in this.git || Date.now() - (this.born[w.id] ??= Date.now()) > 1500;
    for (const w of sp) if (!this.shown.has(w.id) && ready(w)) this.shown.add(w.id);
    const list = sp.map((w, i) => ({ w, i, g: this.git[where(w, ps)] ?? null, sum: this.sum(w, ps) })).filter((r) => this.shown.has(r.w.id));
    const mains = new Set(list.filter((r) => r.g && !r.g.linked).map((r) => r.g.repo));
    const nested = (r) => r.g?.linked && mains.has(r.g.repo);
    const out = [];
    const placed = new Set(); // repos whose worktrees are listed (under the first of its spaces)
    for (const r of list) {
      if (nested(r)) continue;
      out.push({ ...r, tree: null });
      if (!r.g || r.g.linked || placed.has(r.g.repo)) continue;
      placed.add(r.g.repo);
      const kids = list.filter((k) => nested(k) && k.g.repo === r.g.repo);
      kids.forEach((k, n) => out.push({ ...k, tree: n === kids.length - 1 ? "└─" : "├─" }));
    }
    return out;
  }

  // The rows, under a header per machine once one isn't this computer.
  grouped(t, collapsed) {
    const rows = this.ordered();
    const draw = (r) => (collapsed ? this.compact(r, t) : this.row(r, t));
    const remote = [...new Set([...rows.map(r => r.w.machine).filter(Boolean), ...this.machines.map(m => m.name)])].sort();
    const loading = m => {
      const layout = machines().find(k => k.name === m)?.layout;
      return layout === "loading" || (!layout && this.machines.some(k => k.name === m && k.state === "connected"))
        || spaces().some(s => (s.machine ?? null) === m && !this.shown.has(s.id));
    };
    const shut = (m) => (collapsed ? [] : this.closedRooms(m, t));
    const loadingRow = m => div().id(`machine-loading-${m ?? "local"}`).h(28).flex_none().px(8).text_size(12).text_color(t.dim).child(collapsed ? "…" : "Loading…");
    if (!remote.length) return loading(null) && !rows.length ? [loadingRow(null)] : [...rows.map(draw), ...shut(null)];
    const machineNames = [null, ...remote];
    return machineNames.flatMap((m) => {
      const mine = rows.filter((r) => (r.w.machine ?? null) === m);
      const machine = this.machines.find(k => k.name === m);
      const connected = !m || machine?.state === "connected";
      const folded = this.folded.has(m);
      const head = h_flex().id(`machine-${m ?? "local"}`).h(26).flex_none().px(collapsed ? 2 : 8).gap(7).items_center().text_size(11).text_color(t.dim)
        .cursor_pointer().hover(s => s.bg(t.hover))
        .on_click((_e, cx) => {
          folded ? this.folded.delete(m) : this.folded.add(m);
          localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
          cx.notify();
        })
        .child(svg(`mods/office-chrome/${m ? "server" : "monitor"}.svg`).size(13).flex_none())
        .when(!collapsed, el => el.child(div().flex_1().truncate().child(m ?? "This computer"))
          .when(!connected, el => el.child(div().flex_none().child((machine?.state ?? "asleep").replace(/_/g, " "))))
          .when(connected, el => el.child(div().id(`machine-add-${m ?? "local"}`).flex_none().px(4).rounded(4).hover(s => s.bg(t.hover).text_color(t.foreground))
            .on_click((_e, cx) => { cx.stop_propagation(); newSpace(m); }).child("+")))
          .child(div().size(6).rounded(3).flex_none().bg(connected ? t.ansi2 : t.dim))
          .child(svg(`mods/office-chrome/chevron-${folded ? "right" : "down"}.svg`).size(11).flex_none()));
      const empty = h_flex().id(`machine-new-${m ?? "local"}`).h(28).flex_none().px(8).gap(7).items_center().rounded(7)
        .text_size(12).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
        .on_click(() => newSpace(m))
        .child(svg("mods/office-chrome/plus.svg").size(12)).when(!collapsed, el => el.child("New space there"));
      return [head, ...(folded ? [] : [...(mine.length ? mine.map(draw) : [loading(m) ? loadingRow(m) : empty]), ...shut(m)])];
    });
  }

  // Only what's unusual, after the name: "herdr \u00b7 spike \u21912 \u21931". The repo or
  // branch goes when the name already says it (a worktree is named after its branch),
  // and master/main go: nearly every space is on one.
  gitTail(g, tree, name, t) {
    const raw = g.branch ?? "detached";
    const same = (a) => a.toLowerCase() === name.toLowerCase();
    const branch = same(raw) || raw === "master" || raw === "main" ? "" : raw;
    const repo = tree || same(g.name) ? "" : g.name;
    const where = [repo, branch].filter(Boolean).join(" \u00b7 ");
    return h_flex()
      .flex_1()
      .min_w(0)
      .gap(5)
      .justify_end()
      .items_center()
      .text_size(11.5)
      .text_color(t.dim)
      .when(Boolean(where), (el) => el.child(div().min_w(0).truncate().child(where)))
      .when(g.ahead > 0, (el) => el.child(div().flex_none().text_color(t.ansi2).child(`\u2191${g.ahead}`)))
      .when(g.behind > 0, (el) => el.child(div().flex_none().text_color(t.ansi1).child(`\u2193${g.behind}`)));
  }

  // A space's git added up over its folders; a repo seen from two folders counts once.
  sum(w, ps) {
    const repos = new Map();
    for (const k of keysOf(w, ps)) if (this.git[k]) repos.set(JSON.stringify([w.machine ?? null, this.git[k].top]), this.git[k]);
    const all = [...repos.values()];
    return {
      dirty: all.reduce((n, g) => n + g.dirty, 0),
      ahead: all.reduce((n, g) => n + g.ahead, 0),
      local: all.filter((g) => !g.upstream && g.branch !== "(detached)").length,
    };
  }

  // One line: git as sticky notes, then the faces of the staff in the room
  // (a dot each until the office has said who is who). A click on the faces
  // opens the Office panel.
  summary(w, sum, mine, t) {
    const notes = [
      sum.dirty > 0 && [t.ansi11, `${sum.dirty} changed`],
      sum.ahead > 0 && [t.ansi10, `\u2191${sum.ahead} unpushed`],
      sum.local > 0 && [t.ansi9, sum.local === 1 ? "no remote" : `${sum.local} without remote`],
    ].filter(Boolean);
    const face = (a) => {
      const src = portrait(this.faces[a.address]);
      return src
        ? div().size(14).flex_none().border(1).border_color(t[a.status] ?? t.dim).bg(t.raised).child(image(src).size(12))
        : div().size(6).flex_none().rounded(3).bg(t[a.status] ?? t.dim);
    };
    return h_flex().h(15).gap(4).items_center().text_size(11)
      .child(h_flex().flex_1().min_w(0).gap(4).overflow_hidden().children(notes.map(([color, text]) => note(color, text))))
      .when(mine.length > 0, (el) => el.child(h_flex().id(`faces-${w.id}`).flex_none().gap(2).items_center().cursor_pointer()
        .tooltip(`${mine.length} in · open the office`)
        .on_click(() => {
          run("layout.select", { stack: "panel-body", child: "office" });
          run("layout.show", { id: "panel" });
        })
        .children(mine.slice(0, 5).map(face))
        .when(mine.length > 5, (el) => el.child(div().flex_none().text_size(10).text_color(t.dim).child(`+${mine.length - 5}`)))));
  }

  row({ w, i, g, sum, tree }, t) {
    const on = w.active;
    const mine = this.staff.filter((a) => a.space === w.id);
    const status = tree ? null : urgent(mine);
    const shown = activity(`space-${w.id}`, status, t);
    const color = t[this.colors[w.id]] ?? t.muted;
    // Lit from the office: its rug is under the pointer there.
    const hot = this.hot === w.id;
    return v_flex()
      .relative()
      .id(`space-${w.id}`)
      .px(8)
      .h(rowHeight({ tree }))
      .flex_none()
      .justify_center()
      .children(shown.under)
      // The room you are in has its lights on.
      .when(on, (el) => el.bg(`${t.surface}c8`)
        .child(div().absolute().top(0).left(0).right(0).bottom(0).bg(alpha(t.accent, "12")))
        .child(div().absolute().left(0).top(0).bottom(0).w(2).bg(t.accent)))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .when(hot && !on, (el) => el.bg(t.hover))
      .when(hot, (el) => el.child(div().absolute().top(0).left(0).right(0).bottom(0).border(1).border_color(alpha(color, "aa"))))
      .on_hover((hov) => {
        this.hovering = hov ? w.id : this.hovering === w.id ? null : this.hovering;
        hoverSpace(w.id, hov);
      })
      .when(this.pressed === i && this.over !== i, (el) => el.opacity(0.5))
      .when(this.pressed !== null && this.over === i && this.pressed !== i, (el) => el.child(
        div().absolute().left(0).right(0).h(2).bg(t.accent)
          .when(this.pressed < i, line => line.bottom(0))
          .when(this.pressed > i, line => line.top(0)),
      ))
      .on_mouse_down("left", () => {
        this.pressed = i;
        this.over = i;
      })
      .on_mouse_move((_e, cx) => {
        const source = spaces()[this.pressed];
        const over = source && (source.machine ?? null) === (w.machine ?? null) ? i : null;
        if (this.pressed !== null && this.over !== over) {
          this.over = over;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed;
        const over = this.over;
        this.pressed = null;
        this.over = null;
        if (from !== null && over === i && from !== i) run("space.move", { id: spaces()[from].id, index: i + 1 });
        else if (from === i) run("space.select", { id: w.id });
        cx.notify();
      })
      .on_mouse_down("right", () => this.menu(w))
      .child(
        h_flex()
          .gap(10)
          .items_center()
          .when(Boolean(tree), el => el.pl(22).child(svg("mods/office-chrome/branch.svg").size(13).text_color(t.dim)))
          .when(!tree, el => el.pl(2).child(door(`door-${w.id}`, String(i + 1).padStart(2, "0"), color, status, mine.length > 0, t)))
          .child(v_flex().flex_1().min_w(0).gap(3)
            .child(h_flex().gap(9).items_center()
              .child(div().id(`name-${w.id}`).flex_shrink(1).min_w(0).max_w(150).truncate().text_color(t.foreground)
                .tooltip(this.short(place(w, panes()), w.machine) || "~").child(w.name))
              .when(status === "blocked", el => el.child(div().flex_none().px(4).bg("#c8392f").text_size(10).font_bold().text_color("#ffffff").child("!")))
              .child(g ? this.gitTail(g, tree, w.name, t) : div().flex_1())
              .when(this.hovering === w.id && this.pressed === null, (el) => el.child(this.actions(w, t))))
            .when(!tree, el => el.child(this.summary(w, sum, mine, t)))),
      )
      .children(shown.over);
  }

  // On a hovered room: a new tab (the office-add popup), rename, close.
  actions(w, t) {
    const act = (id, label, tip, fn) => div().id(`${id}-${w.id}`).size(20).flex_none().flex().items_center().justify_center()
      .text_size(12).text_color(t.muted).bg(t.raised).border(1).border_color(t.border)
      .hover((s) => s.text_color(t.foreground).border_color(t.accent)).tooltip(tip)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_mouse_up("left", (_e, cx) => { cx.stop_propagation(); fn(); });
    const folder = place(w, panes());
    return h_flex().flex_none().gap(3)
      .child(act("space-tab", "+", "New tab here", () => openOverlay({ mod: "office-add", kind: "popup", width: 250, height: 380,
        props: { mode: "tab", space: w.id, machine: w.machine ?? null, where: `${w.name} · ${this.short(folder, w.machine) || "~"}` } })).child("+"))
      .child(act("space-rename", "✎", "Rename", () => run("space.rename", { id: w.id })).child("✎"))
      .child(act("space-close", "×", "Close space (it stays under Closed rooms)", () => run("space.close", { id: w.id })).child("×"));
  }

  // A path with this computer's home as "~".
  short(path, machine) {
    const h = machine ? null : this.homeDir();
    return path && h && (path === h || path.startsWith(`${h}/`)) ? `~${path.slice(h.length)}` : path || "";
  }

  // The closed rooms of a machine: a fold, then each with its door shut.
  closedRooms(m, t) {
    const mine = this.closed.filter((r) => (r.machine ?? null) === (m ?? null));
    if (!mine.length) return [];
    const head = h_flex().id(`rooms-closed-${m ?? "local"}`).h(24).mt(4).flex_none().px(8).gap(7).items_center()
      .text_size(11).text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.muted))
      .on_click((_e, cx) => {
        this.closedOpen = !this.closedOpen;
        localStorage.setItem("rooms.folded", this.closedOpen ? "0" : "1");
        cx.notify();
      })
      .child(svg(`mods/office-chrome/chevron-${this.closedOpen ? "down" : "right"}.svg`).size(10).flex_none())
      .child(div().flex_1().child(`Closed rooms · ${mine.length}`));
    if (!this.closedOpen) return [head];
    return [head, ...mine.map((r, n) => {
      const id = `closed-${m ?? "local"}-${n}`;
      const color = darken(t[r.color] ?? t.muted, 0.35);
      return h_flex().id(id).h(32).flex_none().pl(12).pr(8).gap(10).items_center().cursor_pointer().opacity(0.8)
        .hover((s) => s.bg(t.hover).opacity(1))
        .tooltip(`Open again in ${this.short(r.folder, r.machine)}`)
        .on_click(() => this.reopen(r))
        .child(div().relative().w(18).h(22).flex_none().bg(darken(color, 0.4))
          .child(div().absolute().top(1).left(1).w(16).h(21).bg(color))
          .child(div().absolute().top(4).left(4).w(10).h(4).bg("#16202b"))
          .child(div().absolute().top(12).left(13).size(2).bg("#8a7a5a")))
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().text_size(12.5).text_color(t.muted).child(r.name || base(r.folder)))
          .child(div().truncate().text_size(10.5).text_color(t.dim).child(this.short(r.folder, r.machine))))
        .child(div().id(`${id}-forget`).size(20).flex_none().flex().items_center().justify_center().text_size(12).text_color(t.dim)
          .hover((s) => s.text_color(t.foreground).bg(t.raised)).tooltip("Forget this room")
          .on_click((_e, cx) => { cx.stop_propagation(); this.forget(r, cx); }).child("×"));
    })];
  }

  compact({ w, i }, t) {
    return h_flex()
      .id(`space-${w.id}`)
      .h(26)
      .flex_none()
      .justify_center()
      .gap(4)
      .when(w.active, (el) => el.bg(t.raised))
      .hover((s) => s.bg(t.hover))
      .on_click(() => run("space.select", { id: w.id }))
      .child(div().text_color(w.active ? t.foreground : t.muted).child(String(i + 1)))
      .child(div().text_color(tone(t, w.status)).child(glyph(w.status)));
  }

  render() {
    const t = theme();
    const collapsed = narrow();
    const palette = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
    const sp = spaces();
    const ids = new Set(sp.map(p => p.id));
    const kept = Object.fromEntries(Object.entries(shared("space.colors") ?? {}).filter(([id]) => ids.has(id)));
    let changed = Object.keys(kept).length !== Object.keys(shared("space.colors") ?? {}).length;
    const back = this.reopening;
    if (back && Date.now() > back.until) this.reopening = null;
    for (const p of sp) {
      if (kept[p.id]) continue;
      if (back && back.color && !back.before.has(p.id) && (p.machine ?? null) === back.machine) {
        kept[p.id] = back.color;
        this.reopening = null;
        changed = true;
        continue;
      }
      if (p.name === "~") continue;
      const uses = c => Object.values(kept).filter(v => v === c).length;
      kept[p.id] = palette.reduce((best, c) => uses(c) < uses(best) ? c : best);
      changed = true;
    }
    if (changed) setShared("space.colors", kept);
    this.colors = kept;
    this.staff = agents();
    const faces = shared("office.faces");
    this.faces = faces && typeof faces === "object" && !Array.isArray(faces) ? faces : {};
    this.hot = shared("office.hover") ?? null;
    return v_flex().size_full().min_h(0).text_size(13)
      .child(h_flex().h(31).pl(16).pr(10).items_center().justify_between().text_size(11.5).text_color(t.dim)
        .when(!collapsed, el => el.child("Spaces"))
        .child(div().id("space-new").size(26).flex_none().flex().items_center().justify_center().rounded(6).hover(s => s.bg(t.hover).text_color(t.foreground))
          .tooltip("New space").on_click(() => newSpace(spaces().find((s) => s.active)?.machine ?? null))
          .child(svg("mods/office-chrome/plus.svg").size(14))))
      .child(v_flex().flex_1().min_h(0).px(8).pb(14).overflow_y_scrollbar().mode("always")
        .on_mouse_up("left", (_e, cx) => { this.pressed = null; cx.notify(); })
        .children(this.grouped(t, collapsed)));
  }
}
