// Office add menu: the popup behind the office's "+" buttons. A new tab in a
// space, or a new desk (a split) beside a pane, with a shell or one of the
// agents installed where the space lives (knownAgents, most picked first).
// Runs Herdr commands only. Drawn as an office card (card.js).
//
// props: { mode: "tab", space, machine, where }
//     or { mode: "pane", space, tab, pane, cwd, machine, where }
import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { closeOverlay, knownAgents, props, run } from "herdr";
import { LAMP, caption, card, ink, keyTag, line, rule } from "./card.js";

const icon = (program) => {
  if (!program?.icon) return div().size(14).flex_none();
  return (program.tint ? svg(program.icon).text_color(ink().text) : image(program.icon)).size(14).flex_none();
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
    const p = props() ?? {};
    const desk = p.mode === "pane";
    const c = ink();
    const item = (id, mark, label, argv, hint) => line(h_flex().id(id))
      .on_click(() => this.start(argv))
      .child(mark)
      .child(div().flex_1().min_w(0).truncate().child(label))
      .when(Boolean(hint), (el) => el.child(keyTag(hint)));
    // Which way the new desk goes: two buttons, the chosen one highlighted and lamp-edged.
    const way = (dir, label) => {
      const on = this.dir === dir;
      return div().id(`dir-${dir}`).flex_1().h(24).flex().items_center().justify_center().text_size(11.5)
        .border(1).border_color(on ? LAMP : c.edge).text_color(on ? c.text : c.dim)
        .bg(on ? c.pick : c.tag).when(on, (el) => el.font_semibold())
        .cursor_pointer().hover((s) => s.bg(on ? c.pick : c.hover))
        .on_click((_e, cx) => { this.dir = dir; cx.notify(); })
        .child(label);
    };
    const rows = [
      ...(p.where ? [div().px(10).pt(2).pb(4).flex_none().truncate().text_size(11).text_color(c.dim).child(p.where)] : []),
      ...(desk ? [h_flex().px(10).pb(6).gap(5).flex_none().child(way("right", "→ Split right")).child(way("down", "↓ Split down"))] : []),
      rule(),
      item("add-terminal", svg("mods/office-chrome/terminal.svg").size(14).flex_none().text_color(c.dim), "Terminal", null, "shell"),
      caption("OR AN AGENT"),
      ...(this.agents === null ? [div().h(28).px(10).flex().items_center().text_size(11.5).text_color(c.dim).child("Looking for agents…")] : []),
      ...(this.agents ?? []).map((a, i) => item(`add-agent-${i}`, icon(a), a.name, a.run, a.run[0])),
    ];
    return v_flex().w_full().min_h(0).child(card("office-add-card", desk ? "ADD A DESK" : "NEW TAB", rows));
  }
}
