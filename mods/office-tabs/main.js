// Office tab bar: the built-in tabs with the faces of every agent in the tab
// (the same people as at its desks in the office) and a terminal mark for its
// other panes, square corners and image buttons for the side panels.
import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, spaces, panes, run, openOverlay, theme, window, shared, layout, settings, appHome, readTextFile } from "herdr";
import { deskJobs, portraitPath, tabDesks } from "./lib.js";

const JOBS_FILE = `${appHome()}/mods/office-agents/jobs.json`;

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

export default class OfficeTabs extends View {
  init(_props, cx) {
    this.pressed = null;
    this.jobs = {};
    cx.spawn(async (cx) => {
      const text = await readTextFile(JOBS_FILE).catch(() => null);
      try { const parsed = JSON.parse(text); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) this.jobs = parsed; } catch {}
      cx.notify();
    });
    this.panels = JSON.parse(localStorage.getItem("panels") ?? "{}");
  }

  // The side panel is remembered per space: switching shows that space's choice
  // (closed if it never had one), and opening or closing it records it.
  syncPanel(space, panel, body, enabled) {
    if (!space || !panel) return;
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      const first = this.space === undefined;
      this.space = space.id; this.pending = null;
      if (!(first && !(space.id in this.panels))) {
        const stored = this.panels[space.id] ?? null, want = enabled.includes(stored) ? stored : null;
        if (want !== now) {
          this.pending = { want, until: Date.now() + 1000 };
          if (want) { run("layout.select", { stack: "panel-body", child: want }); run("layout.show", { id: "panel" }); }
          else run("layout.hide", { id: "panel" });
          return;
        }
      }
    }
    // Until the restore lands (or something else won), the old state isn't a choice.
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    if (this.panels[space.id] === now) return;
    this.panels[space.id] = now;
    localStorage.setItem("panels", JSON.stringify(this.panels));
  }

  render() {
    const t = theme();
    const space = spaces().find(p => p.active);
    const shown = space?.tabs ?? [];
    const sp = spaces(), ps = panes(), list = agents();
    const desks = tabDesks(sp, ps, list);
    const roles = deskJobs(sp, ps, list, this.jobs);
    const stop = (_e, cx) => cx.stop_propagation();
    const button = (id, label, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(label);
    // One face per agent: a lone one full size, several overlapping, each framed
    // in its status colour; past four, a count.
    const faces = (c, staff) => {
      if (staff.length === 1) {
        const src = portraitPath(roles.get(staff[0].address));
        return src ? image(src).size(44).flex_none() : null;
      }
      const shown = staff.slice(0, 4), step = 22, size = 34;
      return div().relative().flex_none().w(size + step * (shown.length - 1)).h(size)
        .children(shown.map((a, n) => {
          const src = portraitPath(roles.get(a.address));
          return div().absolute().top(0).left(n * step).size(size).bg(t.raised).border(1).border_color(t[a.status] ?? t.dim)
            .when(Boolean(src), el => el.child(image(src).size(size - 2)));
        }))
        .when(staff.length > 4, el => el.child(div().absolute().right(0).bottom(0).px(3).bg(t.chrome).text_size(10).text_color(t.foreground).child(`+${staff.length - 4}`)));
    };
    const item = (c, i) => {
      const seats = desks.get(c.id) ?? [];
      const staff = seats.filter(d => d.agent).map(d => d.agent);
      const others = seats.length - staff.length;
      const program = ps.find(p => p.tab === c.id && p.program?.agent)?.program ?? ps.find(p => p.tab === c.id)?.program;
      const name = /^tb\d+$/.test(c.name) ? program?.name ?? "Terminal" : c.name;
      const people = staff.length ? faces(c, staff) : null;
      return h_flex().id(`tab-${c.id}`).h(48).px(8).gap(7).items_center().flex_none().text_size(12.8)
        .border(1).border_color(c.active ? t.border : t.chrome).bg(c.active ? t.raised : t.chrome).text_color(c.active ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_up("left", () => {
          const from = this.pressed; this.pressed = null;
          if (from !== null && from !== i) run("tab.move", { id: shown[from].id, index: space.tabs.findIndex(x => x.id === c.id) + 1 });
          else run("tab.select", { id: c.id });
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        .when(Boolean(people), el => el.child(people))
        .when(!people && Boolean(program?.icon), el => el.child(program.tint ? svg(program.icon).size(14).text_color(t.muted) : image(program.icon).size(14)))
        .when(staff.length > 0 && others > 0, el => el.child(h_flex().flex_none().gap(2).items_center().text_size(10.5).text_color(t.dim)
          .child(svg("mods/office-chrome/terminal.svg").size(12).text_color(t.dim))
          .when(others > 1, el => el.child(String(others)))))
        .child(div().max_w(170).truncate().child(c.zoomed ? `${name} Z` : name))
        .when(c.status === "working", el => el.child(svg("mods/office-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
        .when(c.status === "blocked" || c.status === "done", el => el.child(div().size(6).rounded(3).bg(t[c.status])))
        .when(c.active, el => el.child(div().id(`close-${c.id}`).text_color(t.dim).on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); }).child(svg("mods/pane/close.svg").size(12))));
    };
    const root = layout(), sidebar = find(root, "sidebar"), w = window();
    // Old saved rails and a dragged-narrow sidebar can be smaller than the window buttons.
    const lightsPadding = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 10;
    const panel = find(root, "panel"), body = find(root, "panel-body");
    const enabled = [...(shared("workspace.panels") ?? ["files", "changes"]), "inbox", "graph"];
    this.syncPanel(space, panel, body, enabled);
    const panelButton = (id, label, icon) => {
      const on = panel && !panel.hidden && body?.active === id;
      return h_flex().id(`panel-${id}`).h(26).px(8).gap(5).flex_none().items_center()
        .text_size(12).bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover)).on_mouse_down("left", stop)
        .on_click(() => {
          if (on) run("layout.hide", { id: "panel" });
          else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
        }).child((icon.endsWith(".svg") ? svg(icon).size(20).text_color(on ? t.foreground : t.muted) : image(icon).size(20)).flex_none()).child(label);
    };
    return h_flex().size_full().min_w(0).px(10).pl(lightsPadding).gap(3).items_center().bg(`${t.chrome}99`).border_b(1).border_color(t.border)
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel(e => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(3).overflow_x_scrollbar().children(shown.map(item)))
      .child(button("tab-new", "+", () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })))
      .when(enabled.includes("files"), el => el.child(panelButton("files", "Files", "mods/office-tabs/art/files.png")))
      .when(enabled.includes("changes"), el => el.child(panelButton("changes", "Changes", "mods/office-tabs/art/changes.png")))
      .child(panelButton("inbox", "Inbox", "mods/office-tabs/art/inbox.png"))
      .child(panelButton("graph", "Git", "mods/git-graph/icons/graph.svg"))
      .when(w?.buttons, el => el.child(button("minimize", w.platform === "windows" ? svg("mods/office-tabs/win-min.svg").size(16) : "−", () => run("window.minimize")))
        .child(button("maximize", w.platform === "windows" ? svg(`mods/office-tabs/${w.maximized ? "win-restore" : "win-max"}.svg`).size(16) : "□", () => run("window.maximize")))
        .child(button("close-window", w.platform === "windows" ? svg("mods/office-tabs/win-close.svg").size(16) : svg("mods/pane/close.svg").size(13), () => run("window.close"))));
  }
}
