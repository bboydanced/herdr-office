// Office files: the office's Files panel. Its root stays put: the repo of the
// space you are in (where the space was made, else its first terminal's
// folder), not whichever pane has the focus; the pin follows the focused pane
// instead. On top, what the agents changed: your checkout's uncommitted files,
// then each boss worktree's (.worktrees/<name>: its branch's commits and what
// is not committed yet), last written first. Below, the folder as a tree with
// git marks. Typing finds a file anywhere in the repo. A file opens in the
// office's file window (viewer.js: read, edit, save, send to an agent).
//
// With props { viewer: true } this mod is that window.
//
// The folder listing is Herdr's `files` mod's (Apache-2.0).
import { View, div, svg } from "gpui-kit";
import { Input, InputState, h_flex, v_flex } from "gpui-base";
import { exec, focused, openOverlay, panes, props, setShared, shared, spaces, terminals, theme, watchFolder } from "herdr";
import { LAMP, ink } from "./card.js";
import { ALL_FILES, CLOSED, LISTING, OPEN, STAMPS, ago, changedDirs, changedList, mergeChanges, parseAll, parseListing, parseNameStatus, parseStamps, parseStatus, parseWorktrees, rankFiles, splitPath } from "./lib.js";
import { Viewer } from "./viewer.js";

const ICON = (name) => `mods/office-files/${name}.svg`;
const FOLLOW = "office-files.follow";
const STATUS = ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"];
const MOST_STAMPED = 150;
const MOST_SHOWN = 8;
const MOST_WORKTREES = 8;
const ALL_EVERY = 30000;
const firstLine = (s) => String(s ?? "").split("\n").find((l) => l.trim()) ?? "";

// The space shown and the folder the panel starts from.
function place(follow) {
  const space = spaces().find((s) => s.active) ?? null;
  const on = space?.machine ?? null;
  if (follow === "pane") {
    const f = focused();
    const p = f?.pane ? panes().find((x) => x.pane === f.pane) : null;
    return { on, folder: p?.cwd || f?.cwd || space?.folder || "" };
  }
  const tabs = new Set((space?.tabs ?? []).map((c) => c.id));
  return { on, folder: space?.folder || panes().find((p) => tabs.has(p.tab) && p.cwd)?.cwd || "" };
}

export default class OfficeFiles extends View {
  init(_props, cx) {
    if (props()?.viewer) { this.viewer = new Viewer(cx); return; }
    this.follow = localStorage.getItem(FOLLOW) === "pane" ? "pane" : "space";
    this.tops = new Map(); // [machine, folder] -> { root, on, git }
    this.saved = new Map(); // a root -> the folders open in it
    this.ctx = null; // { key, root, on, git, loading, again }
    this.reset();
    this.more = new Set(); // change groups shown whole
    this.query = "";
    this.filter = InputState.new({ placeholder: "Find a file…" });
    this.filter.on("change", (_e, cx) => {
      this.query = this.filter.value();
      if (this.query.trim() && (!this.all || Date.now() - this.allAt > ALL_EVERY)) this.loadAll(cx);
      cx.notify();
    });
    this.win = null; // the file window this panel opened
    this.now = Date.now();
    cx.timer.every(10000, (cx) => { this.now = Date.now(); this.refresh(cx); });
  }

  // The file window going (its ✕, a layout switch): the panel opens a new one next time.
  async close() {
    this.viewer?.closed();
  }

  reset() {
    this.entries = new Map(); // folder ("" the root) -> [{ name, dir }]
    this.folders = new Set(); // folders open
    this.marks = {}; // path -> A | D | U | M
    this.dirs = new Set(); // folders holding a change
    this.groups = []; // [{ id, label, who, dir, files, total }]
    this.all = null; // every file, for the filter
    this.allAt = 0;
    this.loadingAll = false;
    this.error = null;
    this.watched = null;
  }

  // The folder in view, then its repo's top (worked out once per folder): the root.
  resolve(cx) {
    const p = place(this.follow);
    if (!p.folder) return this.setRoot(null, cx);
    const key = JSON.stringify([p.on, p.folder]);
    const top = this.tops.get(key);
    if (top) return this.setRoot(top, cx);
    if (this.resolving === key) return;
    this.resolving = key;
    cx.spawn(async (cx) => {
      const r = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: p.folder, on: p.on }).catch(() => null);
      const root = r?.code === 0 && r.stdout.trim() ? r.stdout.trim() : p.folder;
      this.tops.set(key, { root, on: p.on, git: r?.code === 0 });
      if (this.resolving === key) this.resolving = null;
      cx.notify();
    });
  }

  setRoot(top, cx) {
    const key = top ? JSON.stringify([top.on, top.root]) : null;
    if (key === (this.ctx?.key ?? null)) return;
    if (this.ctx) this.saved.set(this.ctx.key, this.folders);
    this.ctx = top ? { key, root: top.root, on: top.on, git: top.git, loading: false, again: false } : null;
    this.reset();
    this.folders = new Set(this.saved.get(key) ?? []);
    if (this.ctx) this.refresh(cx);
  }

  refresh(cx) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.loading) { ctx.again = true; return; }
    ctx.loading = true;
    ctx.again = false;
    cx.spawn(async (cx) => {
      try {
        for (const path of ["", ...this.folders]) {
          if (this.ctx !== ctx) return;
          await this.loadFolder(path, ctx);
        }
        if (ctx.git) await this.loadChanges(ctx);
        if (this.ctx === ctx) { this.error = null; this.watch(ctx, cx); }
      } catch (e) {
        if (this.ctx === ctx) this.error = firstLine(e?.message ?? e) || "Cannot list this folder";
      } finally {
        ctx.loading = false;
        // Changes made while it read: once more, a moment later.
        if (ctx.again && this.ctx === ctx) cx.timer.after(1000, (cx) => this.refresh(cx));
        cx.notify();
      }
    });
  }

  async loadFolder(path, ctx) {
    const r = await exec("sh", ["-c", LISTING, "office-files", path ? `${ctx.root}/${path}` : ctx.root], { on: ctx.on });
    if (this.ctx !== ctx || (path && !this.folders.has(path))) return;
    if (r.code !== 0) {
      if (!path) throw new Error(firstLine(r.stderr) || "Cannot list this folder");
      this.folders.delete(path); // gone meanwhile
      this.entries.delete(path);
      return;
    }
    this.entries.set(path, parseListing(r.stdout));
  }

  // Your checkout's changes, then each boss worktree's, last written first.
  async loadChanges(ctx) {
    const on = ctx.on;
    const status = async (dir) => {
      const r = await exec("git", STATUS, { cwd: dir, on }).catch(() => null);
      return r?.code === 0 ? parseStatus(r.stdout) : [];
    };
    const stamped = async (dir, list) => {
      const some = list.slice(0, MOST_STAMPED);
      if (!some.length) return [];
      const r = await exec("sh", ["-c", STAMPS, "office-files", dir, ...some.map((s) => s.path)], { on }).catch(() => null);
      return changedList(some, parseStamps(r?.stdout));
    };
    const mine = await status(ctx.root);
    const groups = [{ id: "root", label: "Your checkout", who: "", dir: ctx.root, files: await stamped(ctx.root, mine), total: mine.length }];
    const wl = await exec("git", ["worktree", "list", "--porcelain"], { cwd: ctx.root, on }).catch(() => null);
    const who = new Map((terminals() ?? []).filter((x) => typeof x?.cwd === "string").map((x) => [x.cwd.replace(/\/+$/, ""), x.name]));
    for (const w of parseWorktrees(wl?.stdout, ctx.root).slice(0, MOST_WORKTREES)) {
      const committed = w.branch
        ? await exec("git", ["diff", "--name-status", "-z", "--no-renames", `HEAD...${w.branch}`], { cwd: ctx.root, on }).catch(() => null)
        : null;
      const list = mergeChanges(committed?.code === 0 ? parseNameStatus(committed.stdout) : [], await status(w.path));
      groups.push({ id: w.path, label: w.branch || splitPath(w.path).name, who: who.get(w.path) ?? "", dir: w.path, files: await stamped(w.path, list), total: list.length });
    }
    if (this.ctx !== ctx) return;
    this.marks = Object.fromEntries(mine.map((s) => [s.path, s.mark]));
    this.dirs = changedDirs(mine.map((s) => s.path));
    this.groups = groups;
  }

  // A folder on this machine: read again when something in it changes.
  watch(ctx, cx) {
    if (ctx.on || this.watched === ctx.key) return;
    this.watched = ctx.key;
    cx.spawn(async (cx) => {
      try {
        while (this.ctx === ctx) {
          await watchFolder(ctx.root);
          if (this.ctx === ctx) this.refresh(cx);
        }
      } catch { if (this.ctx === ctx) this.watched = null; }
    });
  }

  loadAll(cx) {
    const ctx = this.ctx;
    if (!ctx || this.loadingAll) return;
    this.loadingAll = true;
    cx.spawn(async (cx) => {
      const r = await exec("sh", ["-c", ALL_FILES, "office-files", ctx.root], { on: ctx.on }).catch(() => null);
      if (this.ctx === ctx) { this.all = parseAll(r?.stdout); this.allAt = Date.now(); }
      this.loadingAll = false;
      cx.notify();
    });
  }

  toggle(path, cx) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.folders.has(path)) {
      for (const f of [...this.folders]) if (f === path || f.startsWith(`${path}/`)) { this.folders.delete(f); this.entries.delete(f); }
    } else {
      this.folders.add(path);
      cx.spawn(async (cx) => {
        try { await this.loadFolder(path, ctx); } catch (e) { if (this.ctx === ctx) this.error = firstLine(e?.message ?? e); }
        cx.notify();
      });
    }
    cx.notify();
  }

  // The file window: one, over everything. While it is open it takes the next
  // file as a new tab (through OPEN), so what you are editing there stays.
  open(dir, path) {
    setShared(OPEN, { root: dir, path, on: this.ctx?.on ?? null, seq: Date.now() });
    if (this.win && shared(CLOSED) !== this.win) return;
    this.win = openOverlay({ kind: "window", key: "office-file", frame: "none", mod: "office-files", props: { viewer: true }, width: 0.62, height: 0.8 });
  }

  setFollow(follow, cx) {
    this.follow = follow;
    localStorage.setItem(FOLLOW, follow);
    cx.notify();
  }

  markText(mark, c) {
    return div().w(12).flex_none().text_size(10.5).font_bold()
      .text_color(mark === "A" ? c.tick : mark === "D" || mark === "U" ? c.red : LAMP).child(mark ?? "");
  }

  // One tree line: indent, chevron or not, icon, name, its mark.
  treeRows(prefix, depth, out, c) {
    for (const e of this.entries.get(prefix) ?? []) {
      if (out.length >= 3000) break;
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      const open = this.folders.has(path);
      const mark = e.dir ? null : this.marks[path];
      out.push(h_flex().id(`of-${path}`).h(24).flex_none().pl(6 + depth * 14).pr(8).gap(6).items_center()
        .cursor_pointer().hover((s) => s.bg(c.hover)).text_size(12)
        .text_color(mark ? c.text : e.dir ? c.text : c.muted)
        .on_click((_e, cx) => (e.dir ? this.toggle(path, cx) : this.open(this.ctx.root, path)))
        .child(e.dir ? svg(ICON(open ? "chevron-down" : "chevron-right")).size(11).flex_none().text_color(c.dim) : div().w(11).flex_none())
        .child(svg(ICON(e.dir ? "folder" : "file")).size(13).flex_none().text_color(e.dir ? LAMP : c.dim))
        .child(div().flex_1().min_w(0).truncate().child(e.name))
        .when(e.dir && this.dirs.has(path), (el) => el.child(div().size(5).flex_none().bg(LAMP)))
        .when(Boolean(mark), (el) => el.child(this.markText(mark, c))));
      if (e.dir && open) this.treeRows(path, depth + 1, out, c);
    }
    return out;
  }

  // A changed file: its mark, name, folder and how long ago it was written.
  fileRow(id, dir, f, c) {
    const { name, dir: folder } = splitPath(f.path);
    return h_flex().id(id).h(24).flex_none().pl(10).pr(8).gap(6).items_center().cursor_pointer().hover((s) => s.bg(c.hover)).text_size(12)
      .tooltip(`${f.path}\nClick: open it`)
      .on_click(() => this.open(dir, f.path))
      .child(this.markText(f.mark, c))
      .child(div().flex_none().max_w(170).truncate().text_color(f.mark === "D" ? c.dim : c.text).child(name))
      .child(div().flex_1().min_w(0).truncate().text_size(10.5).text_color(c.dim).child(folder))
      .child(div().flex_none().text_size(10.5).text_color(c.dim).child(ago(f.at, this.now)));
  }

  changes(c) {
    const groups = this.groups.filter((g) => g.total > 0);
    if (!groups.length) return [];
    const rows = [this.heading("CHANGED BY AGENTS", c, `${groups.reduce((n, g) => n + g.total, 0)}`)];
    for (const g of groups) {
      const whole = this.more.has(g.id);
      rows.push(h_flex().h(22).flex_none().px(8).gap(6).items_center().text_size(11).text_color(c.muted)
        .child(svg(ICON("git-branch")).size(11).flex_none().text_color(g.id === "root" ? c.dim : LAMP))
        .child(div().min_w(0).truncate().font_semibold().child(g.label))
        .when(Boolean(g.who), (el) => el.child(div().flex_none().text_color(c.dim).child(`· ${g.who}`)))
        .child(div().flex_1())
        .child(div().flex_none().text_color(c.dim).child(String(g.total))));
      for (const f of g.files.slice(0, whole ? g.files.length : MOST_SHOWN)) rows.push(this.fileRow(`ch-${g.id}-${f.path}`, g.dir, f, c));
      if (g.files.length > MOST_SHOWN || g.total > g.files.length) {
        rows.push(div().id(`ch-${g.id}-more`).h(20).flex_none().pl(28).flex().items_center().text_size(10.5).text_color(c.dim)
          .cursor_pointer().hover((s) => s.text_color(c.text))
          .on_click((_e, cx) => { if (whole) this.more.delete(g.id); else this.more.add(g.id); cx.notify(); })
          .child(whole ? "Show fewer" : `+${g.total - MOST_SHOWN} more`));
      }
    }
    return rows;
  }

  heading(text, c, count = "") {
    return h_flex().h(24).flex_none().px(8).mt(4).gap(6).items_center().border_b(1).border_color(c.rule)
      .child(div().w(7).h(4).flex_none().bg(LAMP))
      .child(div().flex_1().text_size(9.5).font_bold().text_color(c.dim).child(text))
      .when(Boolean(count), (el) => el.child(div().text_size(10).text_color(c.dim).child(count)));
  }

  results(c) {
    const q = this.query.trim();
    if (!this.all) return [div().p(10).text_size(11.5).text_color(c.dim).child(this.loadingAll ? "Listing files…" : "")];
    const hits = rankFiles(this.all, q, 200);
    if (!hits.length) return [div().p(10).text_size(11.5).text_color(c.dim).child(`No file matches “${q}”`)];
    return [this.heading("FOUND", c, hits.length >= 200 ? "200+" : String(hits.length)),
      ...hits.map((p) => this.fileRow(`fd-${p}`, this.ctx.root, { path: p, mark: this.marks[p], at: 0 }, c))];
  }

  render(cx) {
    if (this.viewer) return this.viewer.render(cx);
    this.resolve(cx);
    const t = theme();
    const c = ink();
    const ctx = this.ctx;
    const pinned = this.follow === "space";
    const name = ctx ? splitPath(ctx.root).name || ctx.root : "";
    const body = !ctx ? [div().p(10).text_size(12).text_color(c.dim).child(this.resolving ? "Finding the folder…" : "No folder")]
      : this.query.trim() ? this.results(c)
      : [...this.changes(c), this.heading("ALL FILES", c), ...this.treeRows("", 0, [], c)];
    return v_flex().id("office-files").size_full().min_h(0).overflow_hidden().bg(c.sheet).text_color(c.text).border_1().border_color(c.edge)
      .child(h_flex().h(36).flex_none().px(10).gap(8).items_center().bg(c.tab).border_b(1).border_color(c.edge)
        .child(div().w(7).h(4).flex_none().bg(LAMP))
        .child(div().flex_none().text_size(10).font_bold().text_color(c.muted).child("FILES"))
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(c.text).tooltip(ctx?.root ?? "").child(name))
        .child(div().id("of-pin").size(22).flex().flex_none().items_center().justify_center().cursor_pointer()
          .hover((s) => s.bg(c.hover)).bg(pinned ? "#00000000" : c.pick)
          .tooltip(pinned ? "Pinned to the space's folder · click to follow the focused pane" : "Following the focused pane · click to pin to the space's folder")
          .on_click((_e, cx) => this.setFollow(pinned ? "pane" : "space", cx))
          .child(svg(ICON(pinned ? "pin" : "pin-off")).size(13).text_color(pinned ? LAMP : c.dim))))
      .child(h_flex().h(32).flex_none().px(8).gap(6).items_center().border_b(1).border_color(c.edge)
        .child(svg(ICON("search")).size(12).flex_none().text_color(c.dim))
        .child(div().flex_1().min_w(0).child(Input.new(this.filter).w_full().text_size(12).text_color(t.foreground))))
      .child(v_flex().id("of-body").flex_1().min_h(0).py(2).overflow_y_scrollbar()
        .children(body)
        .when(Boolean(this.error), (el) => el.child(div().p(10).text_size(11.5).text_color(c.red).child(this.error)))
        .when(Boolean(ctx) && !this.query.trim() && !this.error && !this.entries.get("")?.length, (el) => el.child(div().p(10).text_size(11.5).text_color(c.dim)
          .child(ctx?.loading ? "Loading files…" : "No files"))));
  }
}
