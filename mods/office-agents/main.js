// Office: one room for every agent. Each space is a rug in its Spaces colour and
// order, each tab a cubicle on it, each pane a desk placed the way the tab is
// split (side by side or one above the other, read from Herdr's layout document),
// else in pane order: an agent at work facing you, or an empty desk for a pane
// with no agent. Click a desk to go to its terminal. Reads jobs.json and that
// document only - runs no command, opens no connection.
import { View, div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, appHome, home, layout, panes, readTextFile, run, setAgentOrder, shared, spaces, theme } from "herdr";
import { DESK_SHADOW, EMPTY_DESK, deskColumns, deskJobs, deskLabel, deskPath, deskTip, localId, officePlan, portraitPath, spaceColor, splitTree, treeWidth, withAlpha } from "./lib.js";

const JOBS_FILE = `${appHome()}/mods/office-agents/jobs.json`;
// herdr-core keeps every app's shared documents here, Herdr's layout among them.
const CORE_DOCS = ".local/state/herdr-core/default/docs.json";
const WALL = "mods/office-agents/room/wall.png";
const FLOOR = "mods/office-agents/room/floor.png";
const CARPET = "#1e2634";
const TAG = "#c8392f";
// Desks are 36x30 art pixels at 2 points each, in a slot wide enough for a name.
const DESK_W = 72;
const DESK_H = 60;
const SLOT_W = 80;
const LABEL_H = 13;
const GAP = 2;
// Wider than this many desks, a split tree falls back to rows of desks.
const MOST_ACROSS = 3;

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
    this.docs = {}; // machine ("" here) -> its herdr-core documents
    this.trees = null; // tab id -> split tree, worked out once per change
    this.shape = null; // every tab's panes, to notice splits and closes
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

  // Each machine's layout document, read whole; a machine away keeps none.
  loadDocs(cx, machines) {
    cx.spawn(async (cx) => {
      const next = {};
      for (const m of machines) {
        const text = await readTextFile(m ? CORE_DOCS : `${home()}/${CORE_DOCS}`, m ? { on: m } : undefined).catch(() => null);
        try { next[m ?? ""] = JSON.parse(text); } catch {}
      }
      this.docs = next;
      this.trees = null;
      cx.notify();
    });
  }

  // A pane set that changed (a split, a close, a move) is read again at once and
  // a moment later, in case Herdr saves its document after the panes change.
  watchShape(cx, sp, ps) {
    const shape = ps.map((p) => `${p.tab}:${p.pane}`).join("|");
    if (shape === this.shape) return;
    this.shape = shape;
    this.trees = null;
    const machines = [...new Set(sp.map((s) => s.machine ?? null))];
    this.loadDocs(cx, machines);
    cx.timer.after(1200, (cx) => this.loadDocs(cx, machines));
  }

  treesFor(plan) {
    if (this.trees) return this.trees;
    this.trees = new Map();
    for (const row of plan) {
      const m = row.space.machine ?? null;
      for (const c of row.tabs) {
        const ids = c.desks.filter((d) => d.pane).map((d) => localId(d.pane.pane, m));
        const tree = ids.length > 1 ? splitTree(this.docs[m ?? ""], ids) : null;
        if (tree && treeWidth(tree) <= MOST_ACROSS) this.trees.set(c.tab.id, tree);
      }
    }
    return this.trees;
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
      .hover((s) => s.bg(t.hover))
      .tooltip(deskTip({ job, agent: a, pane: d.pane, space, tab: c.tab }))
      .on_click(() => (a ? run("agent.focus", { terminal: a.address }) : goTo(space, c.tab, d.pane)))
      .child(div().relative().w(DESK_W).h(DESK_H).child(picture(DESK_SHADOW)).child(picture(src)))
      .child(label);
  }

  // Desks the way the tab is split: a row for side by side, a column for stacked.
  arranged(node, byId, row, c, roles, t) {
    if (node.pane) return this.desk(row, c, byId.get(node.pane), roles, t);
    return (node.dir === "across" ? h_flex() : v_flex()).gap(GAP).items_start()
      .children(node.children.map((child) => this.arranged(child, byId, row, c, roles, t)));
  }

  cubicle(row, c, roles, color, tree, t) {
    const m = row.space.machine ?? null;
    const here = row.space.active && c.tab.active;
    const loose = tree ? c.desks.filter((d) => !d.pane) : c.desks;
    const cols = tree ? Math.max(treeWidth(tree), Math.min(loose.length, MOST_ACROSS)) : deskColumns(c.desks.length);
    const lines = [];
    const step = tree ? MOST_ACROSS : cols;
    for (let i = 0; i < loose.length; i += step) lines.push(loose.slice(i, i + step));
    const byId = new Map(c.desks.filter((d) => d.pane).map((d) => [localId(d.pane.pane, m), d]));
    return v_flex()
      .id(`cubicle-${c.tab.id}`)
      .flex_none()
      .px(4)
      .pb(4)
      .gap(GAP)
      .bg("#080c1270")
      .border(1)
      .border_color(here ? t.accent : withAlpha(color, "88"))
      .child(div().w(cols * SLOT_W + (cols - 1) * GAP).h(14).pt(1).truncate().text_size(10).text_color(here ? t.accent : t.muted).child(c.tab.name))
      .when(Boolean(tree), (el) => el.child(this.arranged(tree, byId, row, c, roles, t)))
      .children(lines.map((line) => h_flex().gap(GAP).children(line.map((d) => this.desk(row, c, d, roles, t)))));
  }

  rug(row, roles, colors, trees, t) {
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
      .child(h_flex().flex_wrap().items_start().gap(6)
        .children(row.tabs.map((c) => this.cubicle(row, c, roles, color, trees.get(c.tab.id) ?? null, t))));
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

  render(cx) {
    const t = theme();
    const list = agents();
    const sp = spaces();
    const ps = panes();
    this.watchShape(cx, sp, ps);
    const plan = officePlan(sp, ps, list);
    const roles = deskJobs(sp, ps, list, this.jobs);
    // agent.next / agent.prev walk the desks in the order they are drawn.
    setAgentOrder(plan.flatMap((row) => row.tabs.flatMap((c) => c.desks.filter((d) => d.agent).map((d) => d.agent.address))));
    if ((find(layout(), "sidebar")?.size?.px ?? Infinity) < 160) return this.rail(plan, roles, t);

    const trees = this.treesFor(plan);
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
        .children(plan.map((row) => this.rug(row, roles, colors, trees, t)))
        .when(plan.length === 0, (el) => el.child(div().p(8).text_size(12).text_color(t.dim).child("Nobody in yet. Open a space to start."))));
  }
}
