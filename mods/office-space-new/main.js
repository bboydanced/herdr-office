// Office new space: the dialog behind every "New space" in the office. A new
// room opens where you are now (the folder of the space you're in, on that
// machine), not in home: type a folder, pick one with the system's picker (this
// computer only), or take one of the recent rooms, the closed ones Spaces still
// remembers ("office.rooms") and the open ones. The name is optional: left
// empty, Herdr names the space after its repo or folder and follows it.
//
// With props { group } it is the group dialog instead: name a group of spaces
// you make yourself, tick the spaces in it, save or delete it. A group only
// holds spaces together in the Spaces list and the Office panel.
//
// props: { machine?: string | null } (null or omitted: this computer)
//      or { group: string } (a group id to edit, "@new" to make one)
import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { closeOverlay, exec, home, panes, pickFolder, props, run, setShared, shared, spaces, theme } from "herdr";
import { loadGroups, newGroupId, putGroup, saveGroups } from "./groups.js";

const INK = "#1d2733";
// The group dialog's mark, a manila folder (as the new-space dialog has a door),
// and the lamp light of the office's menus (office-agents/card.js LAMP).
const MANILA = "#c6a457";
const LAMP = "#f0c06e";
const STAMP = "#2f7a4a";
const MOST = 6;

const trim = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
const lastPart = (p) => {
  const part = trim(p.trim()).split("/").pop() ?? "";
  return part === "~" ? "" : part;
};

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder || "";
}

export default class OfficeSpaceNew extends View {
  init(_props, cx) {
    const p = props() ?? {};
    if (typeof p.group === "string") return this.initGroup(p.group, cx);
    this.machine = p.machine ?? null;
    this.error = null;
    this.busy = false;
    this.home = this.machine ? null : home();
    const front = spaces().find((s) => s.active && (s.machine ?? null) === this.machine);
    this.folder = InputState.new({ value: this.short(front ? place(front, panes()) : ""), placeholder: "~ (home)" });
    this.name = InputState.new({ value: "", placeholder: "Optional: named after its repo or folder" });
    this.folder.on("change", (_e, cx) => { this.error = null; cx.notify(); });
    for (const input of [this.folder, this.name]) input.on("submit", (_e, cx) => this.create(cx));
    const end = this.folder.value().length;
    this.folder.set_selected_range({ start: end, end });
    this.folder.focus();
    cx.timer.after(300, () => this.folder.focus());
    if (this.machine) {
      cx.spawn(async (cx) => {
        try { this.home = (await exec("sh", ["-c", 'printf %s "$HOME"'], { on: this.machine })).stdout.trim() || null; } catch {}
        cx.notify();
      });
    }
  }

  // A path as shown: home written as "~" (once the machine's home is known).
  short(path) {
    if (!path) return "";
    const h = this.home;
    return h && (path === h || path.startsWith(`${h}/`)) ? `~${path.slice(h.length)}` : path;
  }

  full(path) {
    const p = trim(path.trim());
    if (!p || p === "~") return "";
    if (!p.startsWith("~")) return p;
    return this.home ? this.home + p.slice(1) : null;
  }

  // The recent rooms on this machine: closed ones first, then open ones, each folder once.
  recent() {
    const closed = (shared("office.rooms") ?? []).filter((r) => (r.machine ?? null) === this.machine && r.folder);
    const ps = panes();
    const open = spaces().filter((s) => (s.machine ?? null) === this.machine)
      .map((s) => ({ folder: place(s, ps), name: s.named ? s.name : null, color: shared("space.colors")?.[s.id], open: true }))
      .filter((r) => r.folder);
    const seen = new Set();
    return [...closed, ...open].filter((r) => {
      const k = trim(r.folder);
      if (seen.has(k) || k === this.home) return false;
      seen.add(k);
      return true;
    }).slice(0, MOST);
  }

  take(r, cx) {
    this.folder.set_value(this.short(r.folder));
    if (r.name) this.name.set_value(r.name);
    this.error = null;
    this.folder.focus();
    cx.notify();
  }

  choose(cx) {
    cx.spawn(async (cx) => {
      const picked = await pickFolder({ prompt: "Open a new space in" }).catch(() => null);
      if (!picked) return;
      this.folder.set_value(this.short(picked));
      this.error = null;
      cx.notify();
    });
  }

  // An explicit folder that isn't there fails in Herdr: say so here instead.
  create(cx) {
    if (this.busy) return;
    const folder = this.full(this.folder.value());
    if (folder === null) { this.error = "Still asking that machine for its home: try again in a moment."; cx.notify(); return; }
    const name = this.name.value().trim();
    this.busy = true;
    cx.notify();
    cx.spawn(async (cx) => {
      if (folder) {
        let ok = true;
        try { ok = (await exec("test", ["-d", folder], { on: this.machine ?? undefined, timeout: 8000 })).code === 0; } catch {}
        if (!ok) {
          this.busy = false;
          this.error = `No such folder: ${this.short(folder)}`;
          cx.notify();
          return;
        }
      }
      run("space.new", { machine: this.machine ?? "", ...(folder ? { folder } : {}), ...(name ? { name } : {}) });
      closeOverlay(props()?.overlay);
    });
  }

  // The groups you made yourself (see office-agents/groups.js).
  groups() {
    return loadGroups(shared("office.groups"));
  }

  // The group dialog: its name and the spaces in it, one tick each.
  initGroup(id, cx) {
    this.group = id === "@new" ? null : id;
    const found = this.groups().find((g) => g.id === this.group) ?? null;
    this.groupName = InputState.new({ value: found?.name ?? "", placeholder: "e.g. Checkout" });
    this.picked = new Set(found?.spaces ?? []);
    this.error = null;
    this.groupBusy = false;
    this.groupName.on("submit", (_e, cx) => this.saveGroup(cx));
    this.groupName.focus();
  }

  // The spaces a group can hold, in the Spaces list's order.
  candidates() {
    const ps = panes();
    return spaces().map((s) => ({ s, where: place(s, ps) })).filter((r) => Boolean(r.where));
  }

  toggleSpace(id, cx) {
    if (this.picked.has(id)) this.picked.delete(id);
    else this.picked.add(id);
    cx.notify();
  }

  saveGroup(cx) {
    if (this.groupBusy) return;
    const name = this.groupName.value().replace(/\s+/g, " ").trim().slice(0, 40);
    if (!name) { this.error = "Give the group a name."; cx.notify(); return; }
    saveGroups(putGroup(this.groups(), { id: this.group ?? newGroupId(), name, spaces: [...this.picked] }), setShared);
    closeOverlay(props()?.overlay);
  }

  deleteGroup(cx) {
    if (!this.group) { closeOverlay(props()?.overlay); return; }
    saveGroups(this.groups().filter((g) => g.id !== this.group), setShared);
    closeOverlay(props()?.overlay);
  }

  renderGroup() {
    const t = theme();
    const overlay = props()?.overlay;
    const label = (text) => div().text_size(11.5).font_semibold().text_color(t.muted).child(text);
    const button = (id, text, primary, action) => h_flex().id(id).h(32).px(14).flex_none().items_center().border_1()
      .border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12.5).font_medium().cursor_pointer()
      .hover((s) => s.opacity(0.88)).on_click(action).child(text);
    const list = this.candidates();
    const elsewhere = new Map();
    for (const g of this.groups()) if (g.id !== this.group) for (const s of g.spaces) if (!elsewhere.has(s)) elsewhere.set(s, g.name);
    // The spaces as ruled lines, in the theme's colours like the new-space
    // dialog's rooms: a tick box stamped when picked, the line highlighted with
    // a lamp-amber edge, and where it is; a space in another group says so.
    const colors = shared("space.colors") ?? {};
    const row = (r, i) => {
      const on = this.picked.has(r.s.id);
      const other = elsewhere.get(r.s.id);
      return h_flex().id(`group-space-${i}`).relative().h(30).px(10).gap(9).items_center().flex_none().cursor_pointer()
        .border_b_1().border_color(t.border)
        .when(on, (el) => el.bg(t.selected ?? t.hover).child(div().absolute().left(0).top(0).bottom(0).w(2).bg(LAMP)))
        .hover((s) => s.bg(on ? t.selected ?? t.hover : t.hover))
        .on_click((_e, cx) => this.toggleSpace(r.s.id, cx))
        .child(div().size(14).flex_none().flex().items_center().justify_center().border_1().border_color(on ? STAMP : t.input ?? t.border)
          .bg(on ? STAMP : t.background).text_size(10).font_bold().text_color("#fbf6e6").child(on ? "✓" : ""))
        .child(div().size(8).flex_none().bg(t[colors[r.s.id]] ?? t.muted))
        .child(div().flex_none().max_w(150).truncate().text_size(12.5).font_medium().text_color(t.foreground).child(r.s.name))
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(r.s.machine ? `${r.s.machine} · ${r.where}` : r.where))
        .when(Boolean(other), (el) => el.child(div().flex_none().max_w(110).px(4).truncate().text_size(10).font_semibold()
          .bg(on ? "#c8392f" : t.raised).text_color(on ? "#ffffff" : t.muted)
          .child(on ? `moves from ${other}` : `in ${other}`)));
    };
    // A manila folder: the dialog's mark, as the new-space dialog has a door.
    const folder = div().relative().w(22).h(18).flex_none()
      .child(div().absolute().top(0).left(0).w(9).h(4).bg("#c9a24e"))
      .child(div().absolute().top(3).left(0).w(22).h(15).bg(MANILA).border_1().border_color("#a8863f"))
      .child(div().absolute().top(8).left(4).w(14).h(1).bg("#a8863f"));
    return v_flex().id("office-group").w_full().h_full().min_h(0).p(18).gap(14).bg(t.popover).text_color(t.foreground)
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(overlay); cx.stop_propagation(); } })
      .child(h_flex().gap(10).items_center().flex_none()
        .child(folder)
        .child(v_flex().flex_1().min_w(0)
          .child(div().text_size(15).font_semibold().child(this.group ? "Edit group" : "New group"))
          .child(div().text_size(11.5).text_color(t.dim).child("A group only holds spaces together; nothing moves.")))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(v_flex().gap(6).flex_none()
        .child(label("Name"))
        .child(div().h(34).px(10).flex().items_center().border_1().border_color(t.input).bg(t.background)
          .child(Input.new(this.groupName).w_full().text_size(13).text_color(t.foreground)))
        .when(Boolean(this.error), (el) => el.child(div().text_size(11.5).text_color(t.blocked).child(this.error))))
      .child(v_flex().gap(4).flex_1().min_h(0)
        .child(h_flex().flex_none()
          .child(h_flex().h(20).px(9).gap(6).items_center().bg(t.raised).border_t_1().border_l_1().border_r_1().border_color(t.border)
            .child(div().w(7).h(4).flex_none().bg(LAMP))
            .child(div().text_size(10).font_bold().text_color(t.muted).child(`SPACES · ${this.picked.size} PICKED`))))
        .child(v_flex().flex_1().min_h(150).border_1().border_color(t.border).overflow_y_scrollbar().mode("always")
          .when(list.length === 0, (el) => el.child(div().p(8).text_size(11.5).text_color(t.dim).child("No spaces yet.")))
          .children(list.map(row))))
      .child(h_flex().flex_none().pt(2).gap(8).items_center()
        .when(Boolean(this.group), (el) => el.child(button("group-delete", "Delete", false, (_e, cx) => this.deleteGroup(cx))))
        .child(div().flex_1())
        .child(button("group-cancel", "Cancel", false, () => closeOverlay(overlay)))
        .child(button("group-save", "Save", true, (_e, cx) => this.saveGroup(cx))));
  }

  render() {
    if (typeof props()?.group === "string") return this.renderGroup();
    const t = theme();
    const overlay = props()?.overlay;
    const label = (text) => div().text_size(11.5).font_semibold().text_color(t.muted).child(text);
    const box = (input) => div().flex_1().min_w(0).h(34).px(10).flex().items_center().border_1().border_color(t.input).bg(t.background)
      .child(Input.new(input).w_full().text_size(13).text_color(t.foreground));
    const button = (id, text, primary, action) => h_flex().id(id).h(32).px(14).flex_none().items_center().border_1()
      .border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12.5).font_medium().cursor_pointer()
      .when(this.busy && primary, (el) => el.opacity(0.6))
      .hover((s) => s.opacity(0.88)).on_click(action).child(text);
    const rooms = this.recent();
    const room = (r, i) => h_flex().id(`recent-${i}`).h(30).px(8).gap(9).items_center().flex_none().cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.take(r, cx))
      .child(div().relative().w(10).h(14).flex_none().bg(t[r.color] ?? t.muted).opacity(r.open ? 1 : 0.45)
        .child(div().absolute().top(3).left(2).w(6).h(3).bg(r.open ? "#f0c06ecc" : "#16202b")))
      .child(div().flex_none().max_w(150).truncate().text_size(12.5).text_color(r.open ? t.foreground : t.muted).child(r.name ?? (lastPart(r.folder) || "~")))
      .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(this.short(r.folder)))
      .child(div().flex_none().text_size(10.5).text_color(t.dim).child(r.open ? "open" : "closed"));
    return v_flex().id("office-space-new").w_full().h_full().min_h(0).p(18).gap(14).bg(t.popover).text_color(t.foreground)
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(overlay); cx.stop_propagation(); } })
      .child(h_flex().gap(10).items_center().flex_none()
        .child(div().relative().w(18).h(22).flex_none().bg(t.accent)
          .child(div().absolute().top(4).left(3).w(12).h(5).bg("#f0c06ecc"))
          .child(div().absolute().top(12).left(13).size(2).bg(INK)))
        .child(v_flex().flex_1().min_w(0)
          .child(div().text_size(15).font_semibold().child("New space"))
          .child(div().text_size(11.5).text_color(t.dim).child(`A new room on ${this.machine ?? "this computer"}`)))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      // The form scrolls; the buttons stay at the bottom however many rooms are
      // remembered, so the dialog never hides them whatever height it opens at.
      .child(v_flex().flex_1().min_h(0).gap(14).overflow_y_scrollbar().mode("always")
        .child(v_flex().gap(6).flex_none()
          .child(label("Folder"))
          .child(h_flex().gap(8).child(box(this.folder))
            .when(!this.machine, (el) => el.child(button("space-new-choose", "Choose…", false, (_e, cx) => this.choose(cx)))))
          .child(div().text_size(11.5).text_color(this.error ? t.blocked : t.dim)
            .child(this.error ?? "Its terminals start here. Empty: the machine's home.")))
        .child(v_flex().gap(6).flex_none()
          .child(label("Name"))
          .child(h_flex().child(box(this.name))))
        .when(rooms.length > 0, (el) => el.child(v_flex().gap(4).flex_none()
          .child(label("Recent rooms"))
          .child(v_flex().border_1().border_color(t.border).children(rooms.map(room))))))
      .child(h_flex().flex_none().pt(2).gap(8).justify_end()
        .child(button("space-new-cancel", "Cancel", false, () => closeOverlay(overlay)))
        .child(button("space-new-create", this.busy ? "Opening…" : "Open space", true, (_e, cx) => this.create(cx))));
  }
}
