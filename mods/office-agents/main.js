// Office: one room for every agent, on a wooden floor under the night windows.
// Each space is a rug in its Spaces colour and order, each tab a cubicle on it
// (partition walls, the tab's name on the back one), each pane a desk in the
// tab's pane order: an agent at work facing you, or an empty desk for a pane with
// no agent. Click a desk to go to its terminal. Reads jobs.json only - runs no
// command, opens no connection.
import { View, div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, appHome, layout, panes, readTextFile, run, setAgentOrder, shared, spaces, theme } from "herdr";
import { DESK_SHADOW, EMPTY_DESK, deskColumns, deskJobs, deskLabel, deskPath, deskTip, mixHex, officePlan, portraitPath, spaceColor, withAlpha } from "./lib.js";

const JOBS_FILE = `${appHome()}/mods/office-agents/jobs.json`;
const WALL = "mods/office-agents/room/wall.png";
const FLOOR = "mods/office-agents/room/floor.png";
const WOOD = "#8a6444";
const TAG = "#c8392f";
// Cubicle partitions: light fabric panels with a darker frame.
const PANEL = "#aab3c2";
const PANEL_TOP = "#c8cfda";
const PANEL_EDGE = "#5c6576";
// Desks are 36x30 art pixels at 2 points each, in a slot wide enough for a name.
const DESK_W = 72;
const DESK_H = 60;
const SLOT_W = 80;
const LABEL_H = 13;
const GAP = 2;

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

const clock = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// An empty desk: its space, its tab, then its pane.
function goTo(space, tab, pane) {
  if (!space.active) run("space.select", { id: space.id });
  if (!tab.active) run("tab.select", { id: tab.id });
  run("pane.focus", { pane: pane.pane });
}

const picture = (src) => div().absolute().top(0).left(0).child(image(src).w(DESK_W).h(DESK_H));

export default class Office extends View {
  init(_props, cx) {
    this.jobs = {};
    this.time = clock();
    cx.spawn(async (cx) => {
      const text = await readTextFile(JOBS_FILE).catch(() => null);
      try {
        const parsed = JSON.parse(text);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) this.jobs = parsed;
      } catch {}
      cx.notify();
    });
    // The wall clock: redraw only when the minute turns.
    cx.timer.every(10000, (cx) => {
      const now = clock();
      if (now !== this.time) { this.time = now; cx.notify(); }
    });
  }

  desk(row, c, d, roles, t) {
    const { space } = row;
    const a = d.agent;
    const job = a ? roles.get(a.address) : null;
    const src = (a && deskPath(job, a.status)) || EMPTY_DESK;
    const focused = a ? a.focused : d.pane.focused;
    const label = a?.status === "blocked"
      ? div().h(LABEL_H).px(5).flex().items_center().bg(TAG).text_size(8.5).font_bold().text_color("#fff0e6").child("NEEDS YOU")
      : div().h(LABEL_H).max_w(SLOT_W).px(4).flex().items_center().bg("#0d131bb8").text_size(10)
        .text_color(focused ? t.accent : a ? t.foreground : t.muted)
        .child(div().min_w(0).truncate().child(deskLabel(d) || " "));
    return v_flex()
      .id(`desk-${a ? a.address : d.pane.pane}`)
      .w(SLOT_W)
      .flex_none()
      .items_center()
      .gap(1)
      .cursor_pointer()
      .hover((s) => s.bg("#ffffff1a"))
      .tooltip(deskTip({ job, agent: a, pane: d.pane, space, tab: c.tab }))
      .on_click(() => (a ? run("agent.focus", { terminal: a.address }) : goTo(space, c.tab, d.pane)))
      .child(div().relative().w(DESK_W).h(DESK_H).child(picture(DESK_SHADOW)).child(picture(src)))
      .child(label);
  }

  // A cubicle: the tab's name on the back partition, side partitions, open front.
  cubicle(row, c, roles, t) {
    const cols = deskColumns(c.desks.length);
    const here = row.space.active && c.tab.active;
    const lines = [];
    for (let i = 0; i < c.desks.length; i += cols) lines.push(c.desks.slice(i, i + cols));
    return v_flex()
      .id(`cubicle-${c.tab.id}`)
      .flex_none()
      .child(h_flex().h(15).px(6).items_center().bg(here ? t.accent : PANEL).border(1).border_color(PANEL_EDGE)
        .child(div().w(cols * SLOT_W + (cols - 1) * GAP - 6).truncate().text_size(10).font_semibold().text_color("#1b252f").child(c.tab.name)))
      .child(div().h(2).bg(here ? mixHex(t.accent, "#ffffff", 0.4) : PANEL_TOP))
      .child(v_flex().px(3).pt(3).pb(4).gap(GAP).border_l(3).border_r(3).border_color(PANEL)
        .children(lines.map((line) => h_flex().gap(GAP).children(line.map((d) => this.desk(row, c, d, roles, t))))));
  }

  // A rug in the space's colour: a dark woven border, a thin bright line inside.
  rug(row, roles, colors, t) {
    const color = spaceColor(t, colors, row.space.id);
    return div()
      .id(`rug-${row.space.id}`)
      .flex_none()
      .border(3)
      .border_color(mixHex(color, "#0d1116", 0.62))
      .bg(mixHex(color, "#1a2129", 0.6))
      .child(v_flex().m(2).px(4).pt(3).pb(6).gap(5).border(1).border_color(withAlpha(color, "aa"))
        .child(h_flex().h(16).gap(6).items_center()
          .child(div().size(8).flex_none().bg(color).border(1).border_color("#0d1116"))
          .child(div().flex_1().min_w(0).truncate().text_size(11.5).font_semibold().text_color("#f5efe4").child(row.space.name)))
        .child(h_flex().flex_wrap().items_start().gap(6).children(row.tabs.map((c) => this.cubicle(row, c, roles, t)))));
  }

  // A rail too narrow for desks: one face per agent, framed in its status colour.
  rail(plan, roles, t) {
    const seated = plan.flatMap((row) => row.tabs.flatMap((c) => c.desks.filter((d) => d.agent).map((d) => d.agent)));
    return v_flex().id("office-rail").size_full().min_h(0).items_center().gap(4).py(6).overflow_y_scrollbar()
      .children(seated.map((a) => {
        const src = portraitPath(roles.get(a.address));
        return div().id(`face-${a.address}`).size(30).flex_none().border(2).border_color(t[a.status] ?? t.dim)
          .cursor_pointer().tooltip(deskLabel({ agent: a }))
          .on_click(() => run("agent.focus", { terminal: a.address }))
          .when(Boolean(src), (el) => el.child(image(src).size(26)));
      }));
  }

  render() {
    const t = theme();
    const list = agents();
    const sp = spaces();
    const ps = panes();
    const plan = officePlan(sp, ps, list);
    const roles = deskJobs(sp, ps, list, this.jobs);
    // agent.next / agent.prev walk the desks in the order they are drawn.
    setAgentOrder(plan.flatMap((row) => row.tabs.flatMap((c) => c.desks.filter((d) => d.agent).map((d) => d.agent.address))));
    if ((find(layout(), "sidebar")?.size?.px ?? Infinity) < 160) return this.rail(plan, roles, t);

    const colors = shared("space.colors") ?? {};
    const busy = list.filter((a) => a.status === "working").length;
    const waiting = list.filter((a) => a.status === "blocked").length;
    return v_flex()
      .id("office")
      .size_full()
      .min_h(0)
      .relative()
      .overflow_hidden()
      .bg(WOOD)
      .text_color(t.foreground)
      .child(div().absolute().top(0).left(0).child(image(FLOOR).w(300).h(800)))
      .child(h_flex().h(28).flex_none().pl(16).pr(12).gap(6).items_center().bg(t.chrome).text_size(11.5).text_color(t.dim)
        .child(div().flex_1().child("Office"))
        .when(waiting > 0, (el) => el.child(div().text_color(t.blocked).child(`${waiting} need${waiting === 1 ? "s" : ""} you ·`)))
        .child(div().text_size(11).child(`${busy}/${list.length} at work · ${this.time}`)))
      .child(div().h(44).flex_none().overflow_hidden().child(image(WALL).w(300).h(44)))
      .child(v_flex().id("office-floor").flex_1().min_h(0).p(8).gap(10).overflow_y_scrollbar()
        .children(plan.map((row) => this.rug(row, roles, colors, t)))
        .when(plan.length === 0, (el) => el.child(div().p(8).bg("#0d131bb8").text_size(12).text_color(t.muted).child("Nobody in yet. Open a space to start."))));
  }
}
