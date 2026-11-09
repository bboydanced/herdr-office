// Office add menu: the popup behind the office's "+" buttons. A new tab in a
// space, or a new desk (a split) beside a pane, with a shell or one of the
// agents installed where the space lives (knownAgents, most picked first).
// Runs Herdr commands only.
//
// props: { mode: "tab", space, machine, where }
//     or { mode: "pane", space, tab, pane, cwd, machine, where }
import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { closeOverlay, knownAgents, props, run, theme } from "herdr";

const icon = (program, t) => {
  if (!program?.icon) return div().size(16).flex_none();
  return (program.tint ? svg(program.icon).text_color(program.color ?? t.muted) : image(program.icon)).size(16).flex_none();
};

export default class OfficeAdd extends View {
  init(_props, cx) {
    const p = props() ?? {};
    this.dir = "right";
    this.agents = null; // null: still asking
    cx.spawn(async (cx) => {
      try {
        const known = await knownAgents(p.machine ? { on: p.machine } : undefined);
        this.agents = (known ?? []).filter((a) => a.installed && Array.isArray(a.run) && a.run.length > 0);
      } catch {
        this.agents = [];
      }
      cx.notify();
    });
  }

  // There first, so what opens is in view: its space, its tab (a desk: its pane,
  // since terminal.open opens beside the focused one), then the new terminal.
  start(argv) {
    const p = props() ?? {};
    if (p.space) run("space.select", { id: p.space });
    if (p.mode === "pane") {
      if (p.tab) run("tab.select", { id: p.tab });
      if (argv) {
        run("pane.focus", { pane: p.pane });
        run("terminal.open", { argv, place: this.dir, ...(p.cwd ? { folder: p.cwd } : {}) });
      } else {
        run("pane.split", { direction: this.dir, pane: p.pane });
      }
    } else {
      run("tab.new", { ...(p.space ? { space: p.space } : {}), ...(argv ? { argv } : {}) });
    }
    if (p.overlay) closeOverlay(p.overlay);
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    const desk = p.mode === "pane";
    const item = (id, mark, label, argv, hint) => h_flex().id(id).h(30).px(10).gap(9).items_center().flex_none()
      .text_size(12.5).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click(() => this.start(argv))
      .child(mark)
      .child(div().flex_1().min_w(0).truncate().child(label))
      .when(Boolean(hint), (el) => el.child(div().flex_none().max_w(90).truncate().text_size(11).text_color(t.dim).child(hint)));
    const way = (dir, label) => {
      const on = this.dir === dir;
      return div().id(`dir-${dir}`).flex_1().h(24).flex().items_center().justify_center().text_size(11.5)
        .border(1).border_color(on ? t.accent : t.border).text_color(on ? t.foreground : t.muted)
        .when(on, (el) => el.bg(t.selected))
        .cursor_pointer().hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { this.dir = dir; cx.notify(); })
        .child(label);
    };
    return v_flex().w_full().py(6).text_color(t.foreground)
      .child(v_flex().px(10).pb(6).gap(1)
        .child(div().text_size(12.5).font_semibold().child(desk ? "Add a desk" : "New tab"))
        .when(Boolean(p.where), (el) => el.child(div().truncate().text_size(11).text_color(t.dim).child(p.where))))
      .when(desk, (el) => el.child(h_flex().px(10).pb(6).gap(5).child(way("right", "→ Split right")).child(way("down", "↓ Split down"))))
      .child(div().h(1).mx(10).mb(4).bg(t.border))
      .child(item("add-terminal", svg("mods/office-chrome/terminal.svg").size(16).flex_none().text_color(t.muted), "Terminal", null, "shell"))
      .when(this.agents === null, (el) => el.child(div().h(28).px(10).flex().items_center().text_size(11.5).text_color(t.dim).child("Looking for agents…")))
      .children((this.agents ?? []).map((a, i) => item(`add-agent-${i}`, icon(a, t), a.name, a.run, a.run[0])));
  }
}
