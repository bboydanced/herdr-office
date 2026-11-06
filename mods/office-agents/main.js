// Office: one room for every agent. Each space is a rug in its Spaces colour and
// order, each tab a cubicle on it, each pane a desk in the tab's pane order: an
// agent at work, or an empty desk for a pane with no agent. Click a desk to go to
// its terminal. Reads jobs.json only - runs no command, opens no connection.
import { View, div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, appHome, layout, panes, readTextFile, run, setAgentOrder, shared, spaces, theme } from "herdr";
import { DESK_SHADOW, EMPTY_DESK, deskColumns, deskJobs, deskLabel, deskPath, deskTip, officePlan, portraitPath, spaceColor, tabNames, withAlpha } from "./lib.js";

const JOBS_FILE = `${appHome()}/mods/office-agents/jobs.json`;
const WALL = "mods/office-agents/room/wall.png";
const FLOOR = "mods/office-agents/room/floor.png";
const CARPET = "#1e2634";
const TAG = "#c8392f";
// Desks are 30x28 art pixels at 2 points each; the label row sits under them.
const DESK_W = 60;
const DESK_H = 56;
const LABEL_H = 12;
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
    const label = a ? deskLabel(a.title, a.program?.name) : deskLabel(d.pane.title, d.pane.program?.name);
    const focused = a ? a.focused : d.pane.focused;
    const tag = a?.status === "blocked"
      ? div().h(LABEL_H).px(4).flex().items_center().bg(TAG).text_size(8).font_bold().text_color("#fff0e6").child("NEEDS YOU")
      : div().max_w(DESK_W).truncate().text_size(9.5)
        .text_color(focused ? t.accent : a ? t.foreground : t.dim).child(label || " ");
    return v_flex()
      .id(`desk-${a ? a.address : d.pane.pane}`)
      .w(DESK_W)
      .flex_none()
      .items_center()
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .tooltip(deskTip({ job, agent: a, pane: d.pane, space, tab: c.tab }))
      .on_click(() => (a ? run("agent.focus", { terminal: a.address }) : goTo(space, c.tab, d.pane)))
      .child(div().relative().w(DESK_W).h(DESK_H).child(picture(DESK_SHADOW)).child(picture(src)))
      .child(h_flex().w(DESK_W).h(LABEL_H).justify_center().items_center().child(tag));
  }

  cubicle(row, c, roles, color, t) {
    const cols = deskColumns(c.desks.length);
    const width = cols * DESK_W + (cols - 1) * GAP;
    const here = row.space.active && c.tab.active;
    const lines = [];
    for (let i = 0; i < c.desks.length; i += cols) lines.push(c.desks.slice(i, i + cols));
    return v_flex()
      .id(`cubicle-${c.tab.id}`)
      .flex_none()
      .px(4)
      .pb(4)
      .gap(GAP)
      .bg("#080c1270")
      .border(1)
      .border_color(here ? t.accent : withAlpha(color, "88"))
      .child(div().w(width).h(14).pt(1).truncate().text_size(10).text_color(here ? t.accent : t.muted).child(c.tab.name))
      .children(lines.map((line) => h_flex().gap(GAP).children(line.map((d) => this.desk(row, c, d, roles, t)))));
  }

  rug(row, roles, colors, t) {
    const color = spaceColor(t, colors, row.space.id);
    return v_flex()
      .id(`rug-${row.space.id}`)
      .flex_none()
      .px(6)
      .pt(3)
      .pb(6)
      .gap(5)
      .bg(withAlpha(color, "24"))
      .border(1)
      .border_color(withAlpha(color, "66"))
      .child(h_flex().h(15).gap(6).items_center()
        .child(div().size(7).flex_none().bg(color))
        .child(div().flex_1().min_w(0).truncate().text_size(11).font_semibold().text_color(t.foreground).child(row.space.name)))
      .child(h_flex().flex_wrap().items_start().gap(6).children(row.tabs.map((c) => this.cubicle(row, c, roles, color, t))));
  }

  // A rail too narrow for desks: one face per agent, framed in its status colour.
  rail(plan, roles, t) {
    const seated = plan.flatMap((row) => row.tabs.flatMap((c) => c.desks.filter((d) => d.agent).map((d) => d.agent)));
    return v_flex().id("office-rail").size_full().min_h(0).items_center().gap(4).py(6).overflow_y_scrollbar()
      .children(seated.map((a) => {
        const src = portraitPath(roles.get(a.address));
        return div().id(`face-${a.address}`).size(30).flex_none().border(2).border_color(t[a.status] ?? t.dim)
          .cursor_pointer().tooltip(deskLabel(a.title, a.program?.name) || a.address)
          .on_click(() => run("agent.focus", { terminal: a.address }))
          .when(Boolean(src), (el) => el.child(image(src).size(26)));
      }));
  }

  render() {
    const t = theme();
    const list = agents();
    const sp = spaces();
    const plan = officePlan(sp, panes(), list);
    const roles = deskJobs(plan, this.jobs, tabNames(sp, list));
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
      .bg(CARPET)
      .text_color(t.foreground)
      .child(div().absolute().top(0).left(0).child(image(FLOOR).w(300).h(800)))
      .child(h_flex().h(28).flex_none().pl(16).pr(12).gap(6).items_center().bg(t.chrome).text_size(11.5).text_color(t.dim)
        .child(div().flex_1().child("Office"))
        .when(waiting > 0, (el) => el.child(div().text_color(t.blocked).child(`${waiting} need${waiting === 1 ? "s" : ""} you ·`)))
        .child(div().text_size(11).child(`${busy}/${list.length} at work · ${this.time}`)))
      .child(div().h(44).flex_none().overflow_hidden().child(image(WALL).w(300).h(44)))
      .child(v_flex().id("office-floor").flex_1().min_h(0).p(8).gap(8).overflow_y_scrollbar()
        .children(plan.map((row) => this.rug(row, roles, colors, t)))
        .when(plan.length === 0, (el) => el.child(div().p(8).text_size(12).text_color(t.dim).child("Nobody in yet. Open a space to start."))));
  }
}
