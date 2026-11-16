// The office's file window (office-files with props { viewer: true }): the
// files the Files panel opened, one tab each. Code with syntax colours and
// line numbers; Markdown rendered, with its source a click away. Read-only
// until Edit; Ctrl+S saves, and only over the text it read: when an agent
// wrote the file meanwhile, it says so and you keep yours or theirs. A file
// you aren't editing follows the disk. "Send to" names the file (and the
// lines picked) to an agent; Copy path puts it on the clipboard. Files on
// another machine are read-only here.
//
// The window is dragged by its tab bar; everything else stops the press.
import { div, svg } from "gpui-kit";
import { Editor, EditorState, Input, InputState, Popover, TextView, h_flex, v_flex } from "gpui-base";
import { agents, closeOverlay, hc, props, readTextFile, settings, setShared, shared, terminals, theme, writeTextFile } from "herdr";
import { LAMP, ink } from "./card.js";
import { CLOSED, OPEN, fileRef, isMarkdown, langOf, lineRange, refFor, splitPath } from "./lib.js";

const ICON = (name) => `mods/office-files/${name}.svg`;
const MOST_TABS = 12;
const firstLine = (s) => String(s ?? "").split("\n").find((l) => l.trim()) ?? "";
const abs = (tab) => `${tab.root.replace(/\/+$/, "")}/${tab.path}`;
const stop = (_e, cx) => cx.stop_propagation();

export class Viewer {
  constructor(cx) {
    this.overlay = props()?.overlay ?? null;
    this.tabs = []; // [{ id, root, path, on, text, editor, editing, source, dirty, stale, gone, error, loading, closing }]
    this.at = 0;
    this.seen = null; // the OPEN taken last
    this.note = null; // { text, tone }
    this.saving = false;
    this.sending = false;
    this.sendOpen = false;
    this.closingAll = false;
    this.sendNote = InputState.new({ placeholder: "What should they do with it? (optional)" });
    this.handle = cx.focus_handle();
    this.take(cx);
    cx.timer.every(2000, (cx) => this.follow(cx));
  }

  // The file the panel asked for: its tab again, or a new one.
  take(cx) {
    const req = shared(OPEN);
    if (!req || req.seq === this.seen || typeof req.root !== "string" || typeof req.path !== "string") return;
    this.seen = req.seq;
    const i = this.tabs.findIndex((x) => x.root === req.root && x.path === req.path && x.on === (req.on ?? null));
    if (i >= 0) { this.at = i; return; }
    // Past MOST_TABS, the oldest tab with nothing unsaved goes.
    if (this.tabs.length >= MOST_TABS) {
      const old = this.tabs.findIndex((x) => !x.dirty);
      if (old >= 0) this.drop(old);
    }
    const tab = { id: `${req.seq}`, root: req.root, path: req.path, on: req.on ?? null, text: null, editor: null,
      editing: false, source: !isMarkdown(req.path), dirty: false, stale: null, gone: false, error: null, loading: true, closing: false };
    this.tabs.push(tab);
    this.at = this.tabs.length - 1;
    this.load(tab, cx);
  }

  load(tab, cx) {
    cx.spawn(async (cx) => {
      try {
        const text = await readTextFile(abs(tab), { on: tab.on });
        if (text === null) tab.error = "This file is not there (any more)";
        else if (text.includes("\0")) tab.error = "A binary file: no text to show";
        else { tab.text = text; tab.error = null; this.makeEditor(tab, text); }
      } catch {
        tab.error = "Cannot read this file (binary, over 1 MB, or unreadable)";
      }
      tab.loading = false;
      cx.notify();
    });
  }

  makeEditor(tab, value) {
    tab.editor?.release();
    const t = theme();
    tab.editor = EditorState.new({
      language: langOf(tab.path), readonly: !tab.editing, value, soft_wrap: isMarkdown(tab.path),
      font_family: settings().font_family, font_size: 12.5,
      syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 },
    });
    tab.editor.on("change", (_e, cx) => {
      const dirty = tab.editing && tab.editor.value() !== tab.text;
      if (dirty !== tab.dirty) { tab.dirty = dirty; cx.notify(); }
    });
  }

  flash(text, tone, cx) {
    const note = { text, tone };
    this.note = note;
    cx.timer.after(4000, (cx) => { if (this.note === note) { this.note = null; cx.notify(); } });
  }

  // The tab in front follows the disk: read again every two seconds (six on
  // another machine). Unedited, it takes the new text; with your edits, it
  // keeps them and says the file changed.
  follow(cx) {
    const tab = this.tabs[this.at];
    if (!tab || tab.loading || tab.reading || tab.error) return;
    if (tab.on && Date.now() - (tab.readAt ?? 0) < 6000) return;
    tab.reading = true;
    cx.spawn(async (cx) => {
      const text = await readTextFile(abs(tab), { on: tab.on }).catch(() => undefined);
      tab.reading = false;
      tab.readAt = Date.now();
      if (text === undefined) return;
      const gone = text === null;
      if (gone !== tab.gone) { tab.gone = gone; cx.notify(); }
      if (gone || text === tab.text || text === tab.stale) return;
      if (tab.dirty) tab.stale = text;
      else { tab.text = text; tab.editor ? tab.editor.set_value(text) : this.makeEditor(tab, text); }
      cx.notify();
    });
  }

  edit(tab, on, cx) {
    if (!tab?.editor || tab.on) return;
    if (!on && tab.dirty) return this.flash("Save or keep theirs first", "blocked", cx);
    tab.editing = on;
    if (on) tab.source = true;
    this.makeEditor(tab, tab.editor.value());
    if (on) tab.editor.focus();
    cx.notify();
  }

  // Over the text it read, or (yours) over what is there now.
  save(tab, cx, overwrite = false) {
    if (!tab?.editor || tab.on || this.saving || (!tab.dirty && !overwrite)) return;
    const mine = tab.editor.value();
    this.saving = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const expected = overwrite ? await readTextFile(abs(tab)) : tab.gone ? null : tab.text;
        await writeTextFile(abs(tab), mine, expected);
        tab.text = mine;
        tab.dirty = false;
        tab.stale = null;
        tab.gone = false;
        this.flash(`Saved ${splitPath(tab.path).name}`, "done", cx);
      } catch {
        const now = await readTextFile(abs(tab)).catch(() => null);
        tab.stale = now ?? "";
        this.flash("Not saved: the file changed meanwhile", "blocked", cx);
      }
      this.saving = false;
      cx.notify();
    });
  }

  // Theirs: what is on disk now, your edits dropped.
  theirs(tab, cx) {
    if (tab.stale === null) return;
    tab.text = tab.stale;
    tab.stale = null;
    tab.dirty = false;
    tab.editor.set_value(tab.text);
    cx.notify();
  }

  drop(i) {
    this.tabs[i]?.editor?.release();
    this.tabs.splice(i, 1);
    if (this.at >= this.tabs.length) this.at = Math.max(0, this.tabs.length - 1);
  }

  closeTab(i, cx) {
    const tab = this.tabs[i];
    if (!tab) return;
    if (tab.dirty && !tab.closing) { tab.closing = true; cx.notify(); return; }
    this.drop(i);
    if (!this.tabs.length) return this.closeWindow(cx, true);
    cx.notify();
  }

  closeWindow(cx, sure = false) {
    if (!sure && this.tabs.some((x) => x.dirty) && !this.closingAll) { this.closingAll = true; cx.notify(); return; }
    for (const x of this.tabs) x.editor?.release();
    this.tabs = [];
    this.closed();
    if (this.overlay) closeOverlay(this.overlay);
  }

  // The panel opens a new window once this one is gone.
  closed() {
    if (this.overlay && shared(CLOSED) !== this.overlay) setShared(CLOSED, this.overlay);
  }

  // The file (and the lines picked in it) as the agent will find it.
  ref(tab, agentCwd) {
    const range = tab.source && tab.editor ? lineRange(tab.editor.value(), tab.editor.selected_range()) : null;
    return fileRef(refFor(tab.root, tab.path, agentCwd), range);
  }

  send(tab, a, cx) {
    if (this.sending) return;
    if (a.status === "blocked") return this.flash("It waits for an answer first", "blocked", cx);
    const term = (terminals() ?? []).find((x) => x?.address === a.address);
    const note = this.sendNote.value().trim();
    const text = `${this.ref(tab, term?.cwd)}${note ? `: ${note}` : ""}`;
    const name = term?.name || a.program?.name || a.address;
    this.sending = true;
    this.sendOpen = false;
    cx.notify();
    cx.spawn(async (cx) => {
      const r = await hc(["send", a.address, "--", text]).catch((e) => ({ code: 1, stderr: String(e?.message ?? e) }));
      if (r.code === 0) { this.sendNote.set_value(""); this.flash(`Sent to ${name}`, "done", cx); }
      else this.flash(firstLine(r.stderr) || firstLine(r.stdout) || `Couldn't reach ${name}`, "blocked", cx);
      this.sending = false;
      cx.notify();
    });
  }

  // Who can be sent a file: the bosses first, then the rest by name.
  targets(tab) {
    const bosses = new Set(Object.values(shared("office.bosses") ?? {}));
    const terms = terminals() ?? [];
    const name = (a) => terms.find((x) => x?.address === a.address)?.name || a.program?.name || a.address;
    const sameMachine = (a) => (tab.on ? a.address.startsWith(`${tab.on}/`) : !a.address.includes("/"));
    return agents().filter(sameMachine).map((a) => ({ a, name: name(a), boss: bosses.has(a.address) }))
      .sort((x, y) => Number(y.boss) - Number(x.boss) || x.name.localeCompare(y.name));
  }

  button(id, label, tip, action, { on = false, tone, enabled = true, icon, press = true } = {}) {
    const c = ink();
    return h_flex().id(id).h(22).px(7).gap(5).flex_none().items_center().text_size(11)
      .text_color(!enabled ? c.dim : tone ?? (on ? c.text : c.muted)).border(1).border_color(on ? LAMP : c.edge).bg(on ? c.pick : c.tag)
      .when(enabled, (el) => el.cursor_pointer().hover((s) => s.bg(c.hover).text_color(c.text)))
      .tooltip(tip).when(press, (el) => el.on_mouse_down("left", stop))
      .on_click((_e, cx) => { if (enabled) action(cx); })
      .when(Boolean(icon), (el) => el.child(svg(ICON(icon)).size(12).flex_none().text_color(tone ?? c.dim)))
      .child(label);
  }

  sendMenu(tab, c) {
    const list = this.targets(tab);
    const trigger = this.button("ofv-send", this.sending ? "Sending…" : "Send to ▾", "Name this file (and the lines you picked) to an agent", () => {}, { on: this.sendOpen, press: false });
    const card = v_flex().id("ofv-send-card").w(300).flex_none().bg(c.sheet).border(1).border_color(c.edge).on_mouse_down("left", stop)
      .child(h_flex().h(20).px(9).gap(6).items_center().bg(c.tab).border_b(1).border_color(c.edge)
        .child(div().w(7).h(4).flex_none().bg(LAMP))
        .child(div().min_w(0).truncate().text_size(9.5).font_bold().text_color(c.muted).child(`SEND ${this.ref(tab, null).split("/").pop()}`)))
      .child(div().px(8).py(6).border_b(1).border_color(c.rule).child(Input.new(this.sendNote).w_full().text_size(12)))
      .child(v_flex().id("ofv-send-list").max_h(260).overflow_y_scrollbar()
        .children(list.map(({ a, name, boss }) => h_flex().id(`ofv-to-${a.address}`).h(28).px(10).gap(8).items_center().flex_none()
          .border_b(1).border_color(c.rule).text_size(12).text_color(a.status === "blocked" ? c.dim : c.text)
          .cursor_pointer().hover((s) => s.bg(c.hover))
          .on_click((_e, cx) => this.send(tab, a, cx))
          .child(div().size(6).flex_none().bg(theme()[a.status] ?? c.dim))
          .child(div().flex_1().min_w(0).truncate().child(name))
          .when(boss, (el) => el.child(div().flex_none().px(4).text_size(9.5).font_bold().bg(LAMP).text_color("#2a1d10").child("BOSS")))
          .child(div().flex_none().text_size(10.5).text_color(c.dim).child(a.status === "blocked" ? "needs you" : a.program?.name ?? ""))))
        .when(list.length === 0, (el) => el.child(div().p(10).text_size(11.5).text_color(c.dim).child("No agent running here"))));
    return Popover.new("ofv-send-pop").anchor("top_right").open(this.sendOpen)
      .on_open_change((on, cx) => { this.sendOpen = on; cx.notify(); })
      .trigger(trigger).content(card);
  }

  render(cx) {
    this.take(cx);
    const t = theme();
    const c = ink();
    const tab = this.tabs[this.at] ?? null;
    const md = tab && isMarkdown(tab.path);
    const remote = Boolean(tab?.on);
    const tabsBar = h_flex().id("ofv-tabs").h(30).flex_none().pl(4).gap(2).items_end().bg(c.tab).border_b(1).border_color(c.edge)
      .children(this.tabs.map((x, i) => {
        const on = i === this.at;
        const { name } = splitPath(x.path);
        return h_flex().id(`ofv-tab-${x.id}`).relative().h(26).max_w(200).pl(9).pr(4).gap(5).flex_none().items_center()
          .bg(on ? c.sheet : "#00000000").border_t(1).border_l(1).border_r(1).border_color(on ? c.edge : "#00000000")
          .text_size(11.5).text_color(on ? c.text : c.muted).cursor_pointer().hover((s) => s.text_color(c.text))
          .tooltip(abs(x)).on_mouse_down("left", stop)
          .on_click((_e, cx) => { this.at = i; this.sendOpen = false; cx.notify(); })
          .when(on, (el) => el.child(div().absolute().top(0).left(0).right(0).h(2).bg(LAMP)))
          .child(div().min_w(0).truncate().child(x.closing ? "Unsaved: close?" : name))
          .when(x.dirty && !x.closing, (el) => el.child(div().size(6).flex_none().bg(LAMP)))
          .child(div().id(`ofv-x-${x.id}`).size(16).flex().flex_none().items_center().justify_center().hover((s) => s.bg(c.hover))
            .tooltip(x.closing ? "Close it, dropping your edits" : "Close").on_mouse_down("left", stop)
            .on_click((_e, cx) => { cx.stop_propagation(); this.closeTab(i, cx); })
            .child(svg(ICON("x")).size(11).text_color(x.closing ? c.red : c.dim)));
      }))
      .child(div().flex_1().h_full())
      .when(this.closingAll, (el) => el.child(div().flex_none().pr(6).pb(6).text_size(11).text_color(c.red).child("Unsaved edits:")))
      .child(div().id("ofv-close").size(26).flex().flex_none().items_center().justify_center().mb(2).mr(2).hover((s) => s.bg(c.hover))
        .tooltip(this.closingAll ? "Close anyway, dropping unsaved edits" : "Close the window").on_mouse_down("left", stop)
        .on_click((_e, cx) => this.closeWindow(cx, this.closingAll))
        .child(svg(ICON("x")).size(13).text_color(this.closingAll ? c.red : c.muted)));
    if (!tab) return v_flex().id("ofv").size_full().bg(c.sheet).border(1).border_color(c.edge).child(tabsBar)
      .child(div().p(14).text_size(12).text_color(c.dim).child("Open a file from the Files panel"));
    const { name, dir } = splitPath(tab.path);
    const tools = h_flex().id("ofv-tools").h(34).flex_none().px(10).gap(6).items_center().border_b(1).border_color(c.edge).on_mouse_down("left", stop)
      .child(svg(ICON("file-text")).size(13).flex_none().text_color(c.dim))
      .child(div().flex_none().max_w(220).truncate().text_size(12).font_semibold().text_color(c.text).child(name))
      .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(c.dim).child(dir))
      .when(Boolean(this.note), (el) => el.child(div().flex_none().max_w(260).truncate().text_size(11).text_color(t[this.note.tone] ?? c.muted).child(this.note.text)))
      .when(md && !tab.editing && Boolean(tab.editor), (el) => el.child(this.button("ofv-md", tab.source ? "Preview" : "Source",
        tab.source ? "Show it formatted" : "Show its Markdown source", (cx) => { tab.source = !tab.source; cx.notify(); })))
      .when(Boolean(tab.editor) && !tab.editing, (el) => el.child(this.button("ofv-edit", "Edit",
        remote ? "Files on another machine are read-only here" : "Edit this file (Ctrl+S saves)", (cx) => this.edit(tab, true, cx), { icon: "square-pen", enabled: !remote })))
      .when(tab.editing, (el) => el
        .child(this.button("ofv-save", this.saving ? "Saving…" : "Save", "Save (Ctrl+S)", (cx) => this.save(tab, cx), { on: tab.dirty, enabled: tab.dirty && !this.saving }))
        .child(this.button("ofv-done", "Done", tab.dirty ? "Save or drop your edits first" : "Back to reading", (cx) => this.edit(tab, false, cx), { enabled: !tab.dirty })))
      .when(Boolean(tab.editor), (el) => el.child(this.sendMenu(tab, c)))
      .child(this.button("ofv-copy", "Copy path", "Copy its full path (with the lines you picked)", (cx) => {
        cx.write_to_clipboard(this.ref(tab, null));
        this.flash("Path copied", "done", cx);
      }));
    const banner = tab.stale !== null
      ? h_flex().id("ofv-stale").h(32).flex_none().px(10).gap(8).items_center().bg(withTone(t.blocked)).border_b(1).border_color(c.edge).on_mouse_down("left", stop)
        .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(c.text).child("The file changed on disk while you edited it (an agent?)"))
        .child(this.button("ofv-theirs", "Keep theirs", "Drop your edits and show the file as it is now", (cx) => this.theirs(tab, cx)))
        .child(this.button("ofv-mine", "Keep mine", "Save your text over theirs", (cx) => this.save(tab, cx, true), { tone: c.red }))
      : tab.gone ? h_flex().h(28).flex_none().px(10).items_center().border_b(1).border_color(c.edge).text_size(11.5).text_color(c.dim)
        .child(tab.dirty ? "The file was removed: Save puts it back" : "The file was removed")
      : null;
    const body = tab.error ? div().p(14).text_size(12).text_color(c.dim).child(tab.error)
      : tab.loading || !tab.editor ? div().p(14).text_size(12).text_color(c.dim).child("Loading…")
      : md && !tab.source ? div().id("ofv-md-view").size_full().px(18).py(10).child(TextView.markdown(`ofv-md-${tab.id}`, tab.text ?? "").scrollable(true).selectable(true).size_full())
      : Editor.new(tab.editor).size_full();
    return v_flex().id("ofv").size_full().min_h(0).bg(c.sheet).text_color(c.text).border(1).border_color(c.edge)
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        const mod = e.modifiers.control || e.modifiers.platform;
        if (mod && e.key === "s") { this.save(tab, cx); cx.stop_propagation(); }
        else if (mod && e.key === "w") { this.closeTab(this.at, cx); cx.stop_propagation(); }
        else if (e.key === "escape" && this.sendOpen) { this.sendOpen = false; cx.notify(); }
      })
      .child(tabsBar)
      .child(tools)
      .when(Boolean(banner), (el) => el.child(banner))
      .child(div().id("ofv-body").flex_1().min_h(0).overflow_hidden().on_mouse_down("left", stop).child(body));
  }
}

// A theme colour, faint, for a banner.
function withTone(color) {
  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? `${color}33` : color;
}
