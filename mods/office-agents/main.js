// Office: one room for every agent. Each space is a rug in its Spaces colour and
// order, each tab a cubicle on it, each pane a desk placed the way the tab is
// split (side by side or one above the other, read from Herdr's layout document),
// else in pane order: an agent at work facing you, or an empty desk for a pane
// with no agent. Click a desk to go to its terminal. The sidebar's office reads
// jobs.json and that document only - runs no command, opens no connection.
//
// With props { wide: true } (the side panel's Office tab) the same office is drawn
// with more: desks at 2 points an art pixel (3 with "+"), as many across as fit,
// each with its status and for how long, a live board on the wall
// and filters, "+" buttons for a new tab, desk or space (the office-add popup)
// and the tabs put away. Only the sidebar's office sets the agent.next /
// agent.prev order. In both, right-click opens Herdr's own menu for a desk, a
// cubicle or a rug, and middle-click peeks at a desk's terminal. A rug under the
// pointer lights its room in the Spaces list and back ("office.hover"); the
// sidebar's office tells Spaces who wears which role ("office.faces").
//
// The panel is also where you work with them: a click on a desk picks that staff
// member (a double-click goes to their terminal) and the inspector under the
// floor shows who and where they are, their screen as `hc read` prints it (read
// again every 2 s while they work and the panel shows the office, never stored)
// and a message box (`hc send`), with quick replies from replies.json, Go, Peek
// and Stop (`hc interrupt`). Nothing is sent without a click or Enter.
//
// The boss: in front of the panel's back wall stands the team lead you give
// goals to, one per space (a tab named "Boss"). The first goal for a space hires
// one (tab.new with the agent you pick and bossBrief as its first message, which
// points it at its playbook, boss.md); later goals go to it (`hc send`). It
// reports in labels: its own office.say is its speech bubble, each hire's
// office.task the line under its desk. It hires its staff with `hc run`: they are its
// children, get a desk in its cubicle (and roles from their names), and the
// sidebar's office seats them in panes beside it while you look at its tab.
// Above the floor, "Needs you": a waiting agent's question read from its screen,
// its numbered choices (or Enter / Esc) pressed with `hc keys` when you click.
import { View, div, image, svg } from "gpui-kit";
import { Input, InputState, h_flex, v_flex } from "gpui-base";
import { agents, appHome, exec, focused, hc, home, knownAgents, layout, openOverlay, panes, props, readTextFile, run, setAgentOrder, setShared, shared, spaces, terminals, theme } from "herdr";
import { DEFAULT_REPLIES, DESK_SHADOW, EMPTY_DESK, ago, bossBrief, deskColumns, labelOf, deskJobs, deskLabel, deskPath, deskState, deskTip, filterPlan, firstLine, fitAcross, localId, mixHex, officePlan, parsePrompt, parseReplies, portraitPath, roleFromName, screenLines, seatStep, shortPath, spaceColor, speechLine, splitTree, staffOf, tally, treeWidth, withAlpha } from "./lib.js";

const JOBS_FILE = `${appHome()}/mods/office-agents/jobs.json`;
const REPLIES_FILE = `${appHome()}/mods/office-agents/replies.json`;
// The boss's playbook; on another machine a copy goes to REMOTE_PLAYBOOK there.
const PLAYBOOK = `${appHome()}/mods/office-agents/boss.md`;
const REMOTE_PLAYBOOK = ".config/herdr-office/boss.md";
// The inspector: its height, how many screen lines it shows, how often the
// picked terminal's screen is read again while it works.
const INSPECT_H = 300;
const SCREEN_LINES = 14;
const READ_EVERY = 2000;
// herdr-core keeps every app's shared documents here, Herdr's layout among them.
const CORE_DOCS = ".local/state/herdr-core/default/docs.json";
const WALL = "mods/office-agents/room/wall.png";
const WALL_WIDE = "mods/office-agents/room/wall-wide.png";
// 456 art pixels wide at 2 points each: the sidebar shows its left part.
const FLOOR = "mods/office-agents/room/floor.png";
const CARPET = "#1e2634";
const TAG = "#c8392f";
// Desks are 36x30 art pixels, in a slot wide enough for a name: 2 points a pixel
// in the sidebar, 3 in a wide panel. pad: the floor, rug and cubicle padding
// around a row of desks.
const SMALL = { deskW: 72, deskH: 60, slot: 80, label: 13, text: 10, gap: 6, pad: 40 };
const LARGE = { deskW: 108, deskH: 90, slot: 120, label: 16, text: 11.5, gap: 8, pad: 52 };
// "+" draws the panel's desks this big once it is at least this wide.
const LARGE_FROM = 480;
// In the sidebar, wider than this many desks a split tree falls back to rows.
const MOST_ACROSS = 3;
const FILTERS = [["all", "All"], ["working", "Working"], ["blocked", "Needs you"], ["done", "Done"]];
// The boss: standing, 32x44 art pixels at 2 points each, one picture per status.
const BOSS_DIR = "mods/office-agents/boss";
const BAND_H = 100;
// How many hires the boss is told it may have at a time.
const STAFF_CAP = 4;
// A tab with this name holds a space's boss.
const BOSS_TAB = "boss";

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

// After a space's name in the wide office: its machine and an unusual branch.
const where = (space) => [space.machine, ["main", "master"].includes(space.branch) ? null : space.branch].filter(Boolean).join(" · ");

// An empty desk: its space, its tab, then its pane.
function goTo(space, tab, pane) {
  if (!space.active) run("space.select", { id: space.id });
  if (!tab.active) run("tab.select", { id: tab.id });
  run("pane.focus", { pane: pane.pane });
}

// How a desk or a rug shows that someone there is busy or waiting for you.
// Busy: a steady bright frame, a glow breathing under it and (ring) a wider
// frame breathing around it. Waiting: a thick frame blinking fast over a red
// tint. The pulses run natively; nothing re-renders for them.
function activity(id, status, t, ring) {
  const fill = () => div().absolute().top(0).left(0).right(0).bottom(0);
  const frame = (n) => div().absolute().top(-n).left(-n).right(-n).bottom(-n);
  if (status === "working") {
    return {
      under: [fill().id(`${id}-glow`).bg(withAlpha(t.working, "2e")).loop("opacity", { from: 0.15, to: 1, period: 1100 })],
      over: [
        frame(1).border(1).border_color(mixHex(t.working, "#ffffff", 0.3)),
        ...(ring ? [frame(3).id(`${id}-ring`).border(2).border_color(t.working).loop("opacity", { from: 0, to: 0.85, period: 1100 })] : []),
      ],
    };
  }
  if (status === "blocked") {
    return {
      under: [fill().bg(withAlpha(t.blocked, "30"))],
      over: [frame(2).id(`${id}-blink`).border(2).border_color(t.blocked).loop("opacity", { from: 0.2, to: 1, period: 600, easing: "linear" })],
    };
  }
  return { under: [], over: [] };
}

// A "!" bobbing on the corner of a desk whose agent waits for you.
const alert = (id) => div().id(`${id}-alert`).absolute().top(-7).right(-5).size(15).flex().items_center().justify_center()
  .bg(TAG).border(1).border_color("#fff0e6").text_size(10).font_bold().text_color("#ffffff").child("!")
  .loop("top", { from: -9, to: -5, period: 700 });

// The space under the pointer, here or in Spaces: set only when it changes
// (every mod redraws on a shared value, and a redraw reports hover again).
function hoverSpace(id, on) {
  const now = shared("office.hover") ?? null;
  const next = on ? id : now === id ? null : now;
  if (next !== now) setShared("office.hover", next);
}

const cap = (word) => (word ? word[0].toUpperCase() + word.slice(1) : "");

// Where a space works: its first terminal's folder, else where it was made.
const spaceFolder = (space, ps) => {
  const tabs = new Set((space?.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || space?.folder || "";
};

// A program's icon, as the app's program table gives it.
const programIcon = (program, t, size = 14) => {
  if (!program?.icon) return div().size(size).flex_none();
  return (program.tint ? svg(program.icon).text_color(program.color ?? t.muted) : image(program.icon)).size(size).flex_none();
};

// The most urgent status among some agents: waiting beats working.
const urgent = (list) => (list.some((a) => a.status === "blocked") ? "blocked" : list.some((a) => a.status === "working") ? "working" : null);

export default class Office extends View {
  init(_props, cx) {
    this.jobs = {};
    this.time = clock();
    this.docs = {}; // machine ("" here) -> its herdr-core documents
    this.trees = null; // tab id -> split tree, worked out once per change
    this.shape = null; // every tab's panes, to notice splits and closes
    this.filter = localStorage.getItem("office.filter") ?? "all"; // wide only
    this.tried = new Map(); // a hire -> when it was last given a pane (sidebar)
    this.zoom = localStorage.getItem("office.zoom") === "large" ? "large" : "small"; // wide only
    if (props()?.wide) {
      this.selected = localStorage.getItem("office.selected") || null; // a terminal's address
      this.folded = localStorage.getItem("office.inspector") === "folded";
      this.screen = null; // { key, seq, at, lines } or { key, seq, at, error }
      this.reading = false;
      this.busy = false; // a send or a stop on its way
      this.note = null; // { text, tone }: what the last send or stop did
      this.replies = DEFAULT_REPLIES;
      this.input = InputState.new({ placeholder: "Message…" });
      this.input.on("submit", (_e, cx) => this.send(cx));
      cx.spawn(async (cx) => {
        this.replies = parseReplies(await readTextFile(REPLIES_FILE).catch(() => null));
        cx.notify();
      });
      this.bossRoom = localStorage.getItem("office.bossRoom") || null; // a space id
      this.bossPick = localStorage.getItem("office.bossAgent") || null; // a program key
      this.known = {}; // machine ("" here) -> installed agents (knownAgents)
      this.loadingKnown = new Set();
      this.bossInput = InputState.new({ placeholder: "Tell the boss what you need…" });
      this.bossInput.on("submit", (_e, cx) => this.assign(cx));
      this.bossSay = null; // { key, seq, at, line }: the boss's latest line
      this.bossNote = null;
      this.bossReading = false;
      this.asks = new Map(); // a waiting agent -> { seq, question, options }
      this.answered = new Map(); // a waiting agent -> the seq it was answered at
      this.askReading = false;
      this.askNote = null;
      this.card = 0; // which waiting agent "Needs you" shows
      cx.timer.every(READ_EVERY, (cx) => this.poll(cx));
    } else {
      // The sidebar's office runs the hires' seating: it is always there.
      cx.timer.every(READ_EVERY, () => this.seat());
    }
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
    if (this.trees && this.treesMost === this.most) return this.trees;
    this.trees = new Map();
    this.treesMost = this.most;
    for (const row of plan) {
      const m = row.space.machine ?? null;
      for (const c of row.tabs) {
        const ids = c.desks.filter((d) => d.pane).map((d) => localId(d.pane.pane, m));
        const tree = ids.length > 1 ? splitTree(this.docs[m ?? ""], ids) : null;
        if (tree && treeWidth(tree) <= this.most) this.trees.set(c.tab.id, tree);
      }
    }
    return this.trees;
  }

  desk(row, c, d, roles, t) {
    const z = this.z;
    const { space } = row;
    const a = d.agent;
    const job = a ? roles.get(a.address) : null;
    const src = (a && deskPath(job, a.status)) || EMPTY_DESK;
    const focused = a ? a.focused : d.pane.focused;
    const id = `desk-${a ? a.address : d.pane.pane}`;
    const shown = activity(id, a?.status, t, true);
    const terminal = a?.address ?? d.pane?.terminal ?? null;
    const picked = this.wide && terminal !== null && terminal === this.selected;
    const picture = (path) => div().absolute().top(0).left(0).child(image(path).w(z.deskW).h(z.deskH));
    const line = (h, size) => div().h(h).max_w(z.slot).px(4).flex().items_center().text_size(size);
    const tag = (text) => line(z.label, z.text - 1.5).px(5).bg(TAG).font_bold().text_color("#fff0e6").child(div().min_w(0).truncate().child(text));
    const name = line(z.label, z.text).bg("#0d131bb8")
      .text_color(focused ? t.accent : a ? t.foreground : t.muted)
      .child(div().min_w(0).truncate().child(deskLabel(d) || " "));
    // The sidebar has room for one line: who, or that they wait for you. Wide,
    // both: the name, then the status and for how long (an empty desk: where).
    const lines = [];
    if (!this.wide) lines.push(a?.status === "blocked" ? tag("NEEDS YOU") : name);
    else {
      const state = deskState(a, c.tab, this.now);
      const tone = { working: mixHex(t.working, "#ffffff", 0.3), done: t.done }[state?.status] ?? t.dim;
      const mark = { working: "● ", done: "✓ " }[state?.status] ?? "";
      lines.push(name, state?.status === "blocked" ? tag(state.text.replace("Needs you", "NEEDS YOU"))
        : line(z.label - 3, z.text - 1.5).text_color(a ? tone : t.dim)
          .child(div().min_w(0).truncate().child(a ? `${mark}${state.text}` : shortPath(d.pane?.cwd) || " ")));
    }
    return v_flex()
      .id(id)
      .relative()
      .w(z.slot)
      .flex_none()
      .items_center()
      .gap(1)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .tooltip(`${deskTip({ job, agent: a, pane: d.pane, space, tab: c.tab })}\n${this.wide && terminal ? "Click: details · Double-click: go there · " : ""}Right-click: menu${terminal ? " · Middle-click: peek" : ""}`)
      .on_click((e, cx) => {
        // In the panel a click picks them (the inspector shows them); a double-click, or a click in the sidebar, goes there.
        if (this.wide && terminal && e.click_count < 2) return this.pick(terminal, cx);
        if (a) run("agent.focus", { terminal: a.address });
        else goTo(space, c.tab, d.pane);
      })
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        this.menu("pane", { ...(d.pane ? { pane: d.pane.pane } : {}), ...(terminal ? { terminal } : {}) });
      })
      .on_mouse_down("middle", (_e, cx) => {
        cx.stop_propagation();
        if (terminal) run("terminal.peek", { terminal });
      })
      .children(shown.under)
      .child(div().relative().w(z.deskW).h(z.deskH).child(picture(DESK_SHADOW)).child(picture(src)))
      .children(lines)
      .children(shown.over)
      .when(picked, (el) => el.child(div().absolute().top(-4).left(-4).right(-4).bottom(-4).border(2).border_color(t.accent)))
      .when(a?.status === "blocked", (el) => el.child(alert(id)));
  }

  // Desks the way the tab is split: a row for side by side, a column for stacked.
  arranged(node, byId, row, c, roles, t) {
    if (node.pane) return this.desk(row, c, byId.get(node.pane), roles, t);
    return (node.dir === "across" ? h_flex() : v_flex()).gap(this.z.gap).items_start()
      .children(node.children.map((child) => this.arranged(child, byId, row, c, roles, t)));
  }

  // Wide, an empty place for one more desk: a split beside the tab's last pane,
  // with a shell or an agent (the office-add popup).
  ghost(row, c, t) {
    const z = this.z;
    const last = c.desks.filter((d) => d.pane).map((d) => d.pane).pop();
    if (!last) return null;
    const { space } = row;
    return v_flex()
      .id(`ghost-${c.tab.id}`)
      .w(z.slot)
      .flex_none()
      .items_center()
      .gap(1)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .tooltip("Add a desk: split this tab with a terminal or an agent")
      .on_click(() => this.add({ mode: "pane", space: space.id, tab: c.tab.id, pane: last.pane, cwd: last.cwd ?? null, machine: space.machine ?? null, where: `${space.name} › ${c.tab.name}` }))
      .child(div().relative().w(z.deskW).h(z.deskH).border(1).border_color(withAlpha(t.muted, "40"))
        .child(div().absolute().top(0).left(0).opacity(0.25).child(image(EMPTY_DESK).w(z.deskW).h(z.deskH)))
        .child(div().absolute().top(0).left(0).w(z.deskW).h(z.deskH).flex().items_center().justify_center()
          .text_size(Math.round(z.deskH * 0.4)).text_color(t.muted).child("+")))
      .child(div().h(z.label).px(4).flex().items_center().text_size(z.text).text_color(t.dim).child("Add desk"));
  }

  cubicle(row, c, roles, color, tree, t) {
    const z = this.z;
    const m = row.space.machine ?? null;
    const here = row.space.active && c.tab.active;
    // The empty place goes beside a split that has room, else after the desks,
    // counted as one of them.
    const ghost = this.wide ? this.ghost(row, c, t) : null;
    const beside = Boolean(tree && ghost) && treeWidth(tree) < this.most;
    const loose = [...(tree ? c.desks.filter((d) => !d.pane) : c.desks), ...(ghost && !beside ? [{ ghost }] : [])];
    const cols = tree
      ? Math.max(treeWidth(tree) + (beside ? 1 : 0), Math.min(loose.length, this.most))
      : Math.min(this.most, deskColumns(loose.length));
    const lines = [];
    const step = tree ? this.most : cols;
    for (let i = 0; i < loose.length; i += step) lines.push(loose.slice(i, i + step));
    const byId = new Map(c.desks.filter((d) => d.pane).map((d) => [localId(d.pane.pane, m), d]));
    const split = tree ? this.arranged(tree, byId, row, c, roles, t) : null;
    return v_flex()
      .id(`cubicle-${c.tab.id}`)
      .flex_none()
      .px(this.wide ? 5 : 4)
      .pb(this.wide ? 5 : 4)
      .gap(z.gap)
      .bg("#080c1270")
      .border(1)
      .border_color(here ? t.accent : withAlpha(color, "88"))
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        this.menu("tab", { id: c.tab.id, space: row.space.id });
      })
      .child(div().w(cols * z.slot + (cols - 1) * z.gap).h(z.text + 4).pt(1).truncate().text_size(z.text).text_color(here ? t.accent : t.muted).child(c.tab.name))
      .when(Boolean(split), (el) => el.child(beside ? h_flex().gap(z.gap).items_start().child(split).child(ghost) : split))
      .children(lines.map((line) => h_flex().gap(z.gap).children(line.map((d) => d.ghost ?? this.desk(row, c, d, roles, t)))));
  }

  // A rug per space; one where someone works or waits shows it as a desk does,
  // with a count in its corner.
  rug(row, roles, colors, trees, t) {
    const color = spaceColor(t, colors, row.space.id);
    const staff = row.tabs.flatMap((c) => c.desks.filter((d) => d.agent).map((d) => d.agent));
    const status = urgent(staff);
    const count = staff.filter((a) => a.status === status).length;
    const shown = activity(`rug-${row.space.id}`, status, t, false);
    const hot = this.hot === row.space.id;
    return v_flex()
      .id(`rug-${row.space.id}`)
      .relative()
      .flex_none()
      .px(this.wide ? 8 : 6)
      .pt(this.wide ? 5 : 3)
      .pb(this.wide ? 8 : 6)
      .gap(this.wide ? 7 : 5)
      .bg(withAlpha(color, hot ? "3a" : "24"))
      .border(1)
      .border_color(hot ? color : withAlpha(color, "66"))
      .on_hover((hov) => hoverSpace(row.space.id, hov))
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        this.menu("space", { id: row.space.id });
      })
      .children(shown.under)
      .child(h_flex().h(this.wide ? 18 : 15).gap(6).items_center()
        .child(div().size(this.wide ? 9 : 7).flex_none().bg(color))
        .child(div().min_w(0).truncate().text_size(this.wide ? 12.5 : 11).font_semibold().text_color(t.foreground).child(row.space.name))
        .child(div().flex_1().min_w(0).truncate().text_size(10.5).text_color(t.dim).child(this.wide ? where(row.space) : ""))
        .when(status === "blocked", (el) => el.child(div().flex_none().px(4).bg(TAG).text_size(10).font_bold().text_color("#ffffff")
          .child(`! ${count} need${count === 1 ? "s" : ""} you`)))
        .when(status === "working", (el) => el.child(div().flex_none().text_size(10).text_color(mixHex(t.working, "#ffffff", 0.3))
          .child(`● ${count} working`)))
        .when(this.wide, (el) => el.child(this.button(`add-tab-${row.space.id}`, "+ Tab", "New tab: a terminal or an agent", t,
          () => this.add({ mode: "tab", space: row.space.id, machine: row.space.machine ?? null, where: row.space.name })))))
      .child(h_flex().flex_wrap().items_start().gap(this.wide ? 8 : 6)
        .children(row.tabs.map((c) => this.cubicle(row, c, roles, color, trees.get(c.tab.id) ?? null, t))))
      .children(shown.over);
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

  // Who wears which role, for the faces in Spaces: shared only when it changes.
  shareFaces(roles) {
    const faces = Object.fromEntries([...roles].filter(([, job]) => job));
    const key = JSON.stringify(faces);
    if (key === this.faces) return;
    this.faces = key;
    if (JSON.stringify(shared("office.faces") ?? null) !== key) setShared("office.faces", faces);
  }

  // Herdr's own menu for a pane, a tab or a space.
  menu(tab, target) {
    openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab, target } });
  }

  // The office-add popup: a new tab or desk, with a shell or an agent.
  add(spec) {
    openOverlay({ mod: "office-add", kind: "popup", width: 250, height: 380, props: spec });
  }

  button(id, label, tip, t, action) {
    return div().id(id).h(20).px(7).flex().flex_none().items_center().text_size(10.5).text_color(t.muted)
      .border(1).border_color(withAlpha(t.muted, "55")).bg("#0d131b99")
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(tip).on_click(action).child(label);
  }

  // Tabs put away (tab.settle) stay off the floor; wide, they wait here and a
  // click brings one back.
  storage(sp, t) {
    const away = sp.flatMap((s) => (s.tabs ?? []).filter((tab) => tab.settled && tab.status !== "blocked").map((tab) => ({ s, tab })));
    if (!away.length) return null;
    return v_flex().flex_none().gap(5).p(8).bg("#080c1270").border(1).border_color(withAlpha(t.muted, "33"))
      .child(div().text_size(10.5).text_color(t.dim).child(`Put away · ${away.length}`))
      .child(h_flex().flex_wrap().gap(5).children(away.map(({ s, tab }) => div().id(`away-${tab.id}`).h(20).px(7).flex().items_center()
        .text_size(11).text_color(t.muted).bg(t.raised).cursor_pointer().hover((st) => st.bg(t.hover).text_color(t.foreground))
        .tooltip("Bring it back")
        .on_click(() => { if (!s.active) run("space.select", { id: s.id }); run("tab.select", { id: tab.id }); })
        .child(`${s.name} › ${tab.name}`))));
  }

  // ---- the inspector (wide only) ----

  pick(terminal, cx) {
    if (this.selected !== terminal) {
      this.selected = terminal;
      this.screen = null;
      this.note = null;
      localStorage.setItem("office.selected", terminal);
    }
    if (this.folded) this.fold(false);
    this.poll(cx);
    cx.notify();
  }

  fold(folded) {
    this.folded = folded;
    localStorage.setItem("office.inspector", folded ? "folded" : "open");
  }

  // The panel shows the office (the stack's "office" child, the panel open).
  shown() {
    const root = layout();
    const panel = find(root, "panel");
    return Boolean(panel && !panel.hidden && find(root, "panel-body")?.active === "office");
  }

  // The picked terminal: its agent (if it is one), pane, space and tab; null
  // when it is gone. `seq` changes whenever what it shows could have.
  target() {
    const key = this.selected;
    if (!key) return null;
    const agent = agents().find((a) => a.address === key) ?? null;
    const ps = panes();
    const pane = (agent ? ps.find((p) => p.pane === agent.pane) : ps.find((p) => p.terminal === key)) ?? null;
    if (!agent && !pane) return null;
    const tabId = agent?.tab ?? pane?.tab;
    const space = spaces().find((s) => (s.tabs ?? []).some((c) => c.id === tabId)) ?? null;
    const tab = space?.tabs?.find((c) => c.id === tabId) ?? null;
    return { key, agent, pane, space, tab, seq: agent ? `${agent.seq}:${agent.status}` : `${pane?.title}:${pane?.status}` };
  }

  // Read the picked screen again: when it may have changed, and every tick while
  // it works (a plain terminal: every tick). Only while the panel shows it.
  poll(cx) {
    if (!this.wide || !this.shown()) return;
    const target = !this.folded && !this.reading ? this.target() : null;
    if (target) {
      const stale = !this.screen || this.screen.key !== target.key || this.screen.seq !== target.seq;
      const live = target.agent ? target.agent.status === "working" : true;
      if (stale || live || Date.now() - this.screen.at > 15000) this.read(target, cx);
    }
    const list = agents();
    // The questions of those waiting for you, one read a tick.
    if (!this.askReading) {
      const next = list.find((a) => a.status === "blocked" && this.asks.get(a.address)?.seq !== `${a.seq}`);
      if (next) this.readAsk(next, cx);
    }
    // What the boss of the room in view says.
    const room = this.room(spaces());
    const boss = room ? this.bosses()[room.id] : null;
    const labelled = boss ? labelOf((terminals() ?? []).find((t) => t?.address === boss), "office.say") : "";
    if (boss && !labelled && !this.bossReading) {
      const agent = list.find((a) => a.address === boss);
      const seq = agent ? `${agent.seq}:${agent.status}` : "";
      const said = this.bossSay;
      if (!said || said.key !== boss || said.seq !== seq || (agent?.status === "working" && Date.now() - said.at > 4000)) this.readBoss(boss, seq, cx);
    }
  }

  read(target, cx) {
    this.reading = true;
    cx.spawn(async (cx) => {
      let got;
      try {
        const r = await hc(["read", target.key, "--lines", "60", "--json"]);
        if (r.code !== 0) got = { error: firstLine(r.stderr) || firstLine(r.stdout) || "hc read failed" };
        else {
          let text = r.stdout;
          try { text = JSON.parse(r.stdout)?.text ?? ""; } catch {}
          got = { lines: screenLines(text, SCREEN_LINES) };
        }
      } catch (e) {
        got = { error: firstLine(String(e?.message ?? e)) || "hc read failed" };
      }
      this.reading = false;
      if (this.selected !== target.key) return;
      const same = this.screen && this.screen.key === target.key && JSON.stringify(this.screen.lines ?? this.screen.error) === JSON.stringify(got.lines ?? got.error);
      this.screen = { key: target.key, seq: target.seq, at: Date.now(), ...got };
      if (!same) cx.notify();
    });
  }

  flash(text, tone, cx, slot = "note") {
    const note = { text, tone };
    this[slot] = note;
    cx.timer.after(5000, (cx) => { if (this[slot] === note) { this[slot] = null; cx.notify(); } });
  }

  // `hc send`: pasted, then Enter. Refused while it waits for an answer.
  send(cx, text = this.input?.value()) {
    const target = this.target();
    const message = typeof text === "string" ? text.trim() : "";
    if (!target || !message || this.busy) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const r = await hc(["send", target.key, "--", message]);
        if (r.code === 0) { this.input.set_value(""); this.flash("Sent", "done", cx); }
        else this.flash(firstLine(r.stderr) || firstLine(r.stdout) || "Couldn't send", "blocked", cx);
      } catch (e) {
        this.flash(firstLine(String(e?.message ?? e)) || "Couldn't send", "blocked", cx);
      }
      this.busy = false;
      if (this.screen) this.screen.seq = null;
      cx.notify();
      cx.timer.after(800, (cx) => this.poll(cx));
    });
  }

  // `hc interrupt`: the stop key (esc for agents, else ctrl+c), and what it did.
  stop(cx) {
    const target = this.target();
    if (!target || this.busy) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const r = await hc(["interrupt", target.key, "--json"]);
        let outcome = firstLine(r.stdout);
        try { outcome = JSON.parse(r.stdout)?.outcome ?? outcome; } catch {}
        this.flash(r.code === 0 ? `Stop: ${String(outcome).replace(/_/g, " ")}` : firstLine(r.stderr) || "Couldn't stop", r.code === 0 ? "done" : "blocked", cx);
      } catch (e) {
        this.flash(firstLine(String(e?.message ?? e)) || "Couldn't stop", "blocked", cx);
      }
      this.busy = false;
      cx.notify();
    });
  }

  small(id, label, tip, t, action, tone) {
    return div().id(id).h(22).px(8).flex().flex_none().items_center().text_size(11).text_color(tone ?? t.muted)
      .border(1).border_color(withAlpha(t.muted, "55")).bg("#0d131b")
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(tip).on_click(action).child(div().min_w(0).truncate().child(label));
  }

  // The picked staff member: who and where, their screen, a message box.
  inspector(roles, t, mono) {
    const target = this.target();
    const head = (el) => el.child(div().id("inspector-fold").absolute().top(4).right(8).size(20).flex().items_center().justify_center()
      .text_size(11).text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground))
      .tooltip(this.folded ? "Show the inspector" : "Hide the inspector")
      .on_click((_e, cx) => { this.fold(!this.folded); cx.notify(); cx.timer.after(50, (cx) => this.poll(cx)); })
      .child(this.folded ? "▴" : "▾"));
    const frame = v_flex().id("office-inspector").relative().flex_none().bg("#121a23").border_t(2).border_color(t.accent);
    if (this.folded) {
      const who = target ? (target.agent ? deskLabel({ agent: target.agent }) : deskLabel({ pane: target.pane })) : "Nobody picked";
      return head(frame.h(28).px(14).justify_center().child(div().text_size(11.5).text_color(t.muted).truncate().child(`Inspector · ${who}`)));
    }
    if (!target) {
      return head(frame.h(INSPECT_H).items_center().justify_center().gap(6)
        .child(div().text_size(12.5).text_color(t.muted).child("Click a desk to see what they are doing"))
        .child(div().text_size(11).text_color(t.dim).child("and talk to them from here. Double-click goes to their terminal.")));
    }
    const { key, agent: a, pane, space, tab } = target;
    const job = a ? roles.get(a.address) : null;
    const src = portraitPath(job);
    const state = deskState(a, tab, this.now);
    const title = a ? `${job ? cap(job) : "Agent"} · ${a.program?.name ?? "Agent"}` : deskLabel({ pane });
    const place = [`${space?.name ?? ""} › ${tab?.name ?? ""}`, shortPath(pane?.cwd), pane?.branch].filter(Boolean).join(" · ");
    const tone = { working: mixHex(t.working, "#ffffff", 0.3), blocked: t.blocked, done: t.done }[state?.status] ?? t.dim;
    const screen = this.screen?.key === key ? this.screen : null;
    const lines = screen?.lines ?? [];
    const go = () => (a ? run("agent.focus", { terminal: a.address }) : space && tab && pane && goTo(space, tab, pane));
    return head(frame.h(INSPECT_H).px(12).pt(10).pb(10).gap(8)
      .child(h_flex().gap(10).items_start().pr(24)
        .child(div().size(46).flex_none().border(1).border_color(state ? t[state.status] ?? t.dim : t.dim).bg(t.raised)
          .when(Boolean(src), (el) => el.child(image(src).size(44))))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(div().truncate().text_size(13).font_semibold().text_color(t.foreground).child(title))
          .child(div().truncate().text_size(10.5).text_color(t.dim).child(place))
          .child(h_flex().gap(6).items_center()
            .child(div().text_size(11).text_color(tone).child(state ? state.text : "Terminal"))
            .when(Boolean(a?.title), (el) => el.child(div().min_w(0).truncate().text_size(11).text_color(t.muted).child(`· ${deskLabel({ agent: a })}`)))))
        .child(h_flex().flex_none().gap(5)
          .child(this.small("inspect-go", "Go to desk", "Their terminal, in its space and tab", t, go))
          .child(this.small("inspect-peek", "Peek", "Look over the tab without leaving it", t, () => run("terminal.peek", { terminal: key })))
          .child(this.small("inspect-stop", "Stop", "The stop key: Esc for an agent, else Ctrl+C", t, (_e, cx) => this.stop(cx), t.blocked))))
      // The newest lines are at the bottom: when they don't all fit, the top ones go.
      .child(v_flex().id("inspect-screen").flex_1().min_h(0).justify_end().px(10).py(6).bg("#0b1016").border(1).border_color(withAlpha(t.muted, "30")).overflow_hidden()
        .when(lines.length === 0, (el) => el.child(div().text_size(11).text_color(screen?.error ? t.blocked : t.dim)
          .child(screen?.error ? `Can't read the screen: ${screen.error}` : screen ? "(empty screen)" : "Reading…")))
        .children(lines.map((line, i) => div().id(`screen-${i}`).h(16).flex_none().truncate().font_family(mono).text_size(11.5)
          .text_color(/^\s/.test(line) ? t.muted : t.foreground).child(line || " "))))
      .child(h_flex().gap(5).items_center()
        .children(this.replies.map((r, i) => this.small(`reply-${i}`, r, "Put it in the message box", t, () => { this.input.set_value(r); this.input.focus(); })))
        .child(div().flex_1())
        .when(Boolean(this.note), (el) => el.child(div().flex_none().text_size(11).text_color(t[this.note.tone] ?? t.muted).child(this.note.text))))
      .child(h_flex().gap(6).items_center()
        .child(div().flex_1().min_w(0).child(Input.new(this.input)))
        .child(div().id("inspect-send").h(28).px(14).flex().flex_none().items_center().bg(this.busy ? t.raised : t.accent)
          .text_size(12).font_bold().text_color(t.accent_foreground ?? "#101820").cursor_pointer()
          .tooltip(a?.status === "blocked" ? "It waits for an answer to its question: answer it in its terminal" : "Paste it into their terminal and press Enter")
          .on_click((_e, cx) => this.send(cx)).child("Send ⏎"))));
  }

  setFilter(filter, cx) {
    this.filter = filter;
    localStorage.setItem("office.filter", filter);
    cx.notify();
  }

  // The sidebar's back wall.
  wall() {
    return div().h(44).flex_none().overflow_hidden().child(image(WALL).w(300).h(44));
  }

  // The wide header: the filters with their counts, desk size, the time.
  header(n, total, t) {
    return h_flex().h(34).flex_none().pl(14).pr(10).gap(5).items_center().bg(t.chrome).overflow_hidden()
      .child(div().flex_none().pr(6).text_size(12.5).font_semibold().text_color(t.foreground).child("Office"))
      .children(FILTERS.map(([key, label]) => {
        const on = this.filter === key;
        return h_flex().id(`filter-${key}`).h(22).px(8).gap(5).flex_none().items_center().text_size(11)
          .border(1).border_color(on ? t.accent : withAlpha(t.border, "33")).text_color(on ? t.foreground : t.muted)
          .when(on, (el) => el.bg(t.selected))
          .cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => this.setFilter(key, cx))
          .when(key !== "all", (el) => el.child(div().size(6).flex_none().bg(t[key] ?? t.dim)))
          .child(label)
          .child(div().text_color(key === "blocked" && n.blocked ? t.blocked : t.dim).child(String(key === "all" ? total : n[key])));
      }))
      .child(div().flex_1())
      .children([["small", "−", "Smaller desks"], ["large", "+", "Bigger desks"]].map(([zoom, label, tip]) => {
        const on = this.zoom === zoom;
        return div().id(`zoom-${zoom}`).size(22).flex().flex_none().items_center().justify_center().text_size(13)
          .border(1).border_color(on ? t.accent : withAlpha(t.border, "33")).text_color(on ? t.foreground : t.muted)
          .cursor_pointer().hover((s) => s.bg(t.hover)).tooltip(tip)
          .on_click((_e, cx) => { this.zoom = zoom; localStorage.setItem("office.zoom", zoom); cx.notify(); })
          .child(label);
      }))
      .child(div().flex_none().pl(4).text_size(11).text_color(t.dim).child(this.time));
  }

  // ---- the boss ----

  // Every space's boss: { space id: terminal address }, as the sidebar found them.
  bosses() {
    const map = shared("office.bosses");
    return map && typeof map === "object" && !Array.isArray(map) ? map : {};
  }

  // Sidebar: each space's boss is the terminal in its "Boss" tab that nobody
  // started (the hires there have the boss as parent). Shared when it changes.
  findBosses(sp, ps, terms) {
    const now = this.bosses();
    const parent = new Map(terms.map((t) => [t?.address, t?.parent ?? null]));
    const next = {};
    for (const s of sp) {
      const tab = (s.tabs ?? []).find((c) => typeof c.name === "string" && c.name.trim().toLowerCase() === BOSS_TAB);
      if (!tab) continue;
      const mine = ps.filter((p) => p.tab === tab.id && p.terminal);
      const boss = mine.find((p) => p.terminal === now[s.id]) ?? mine.find((p) => !parent.get(p.terminal)) ?? null;
      if (boss) next[s.id] = boss.terminal;
    }
    if (JSON.stringify(next) !== JSON.stringify(now)) setShared("office.bosses", next);
  }

  // Each boss's tab and hires, and where every hire sits: in the boss's tab.
  team(sp, ps, list, terms) {
    const staff = new Map(); // hire -> { space, tab, boss }
    const bosses = new Map(); // boss -> { space, tab, staff }
    for (const [spaceId, boss] of Object.entries(this.bosses())) {
      const space = sp.find((s) => s.id === spaceId);
      const tabId = ps.find((p) => p.terminal === boss)?.tab ?? list.find((a) => a.address === boss)?.tab;
      const tab = space?.tabs?.find((c) => c.id === tabId);
      if (!tab) continue;
      const hires = staffOf(terms, boss);
      bosses.set(boss, { space, tab, staff: hires });
      for (const hire of hires) staff.set(hire, { space, tab, boss });
    }
    const byAddress = new Map(terms.filter((t) => typeof t?.address === "string").map((t) => [t.address, t]));
    const names = new Map([...byAddress].map(([address, t]) => [address, t.name]));
    // What the bosses say and what their hires do, as they label themselves.
    const say = new Map([...bosses.keys()].map((boss) => [boss, labelOf(byAddress.get(boss), "office.say")]));
    const tasks = new Map([...staff.keys()].map((hire) => [hire, labelOf(byAddress.get(hire), "office.task")]));
    return { staff, bosses, names, say, tasks };
  }

  // Sidebar, every tick: while you look at a boss's tab, its next hire without a
  // pane gets one beside it (seatStep), and your focus goes back where it was.
  seat() {
    const f = focused();
    if (!f?.tab) return;
    const ps = panes();
    const boss = Object.values(this.bosses()).find((addr) => ps.some((p) => p.terminal === addr && p.tab === f.tab));
    if (!boss) return;
    const mine = ps.filter((p) => p.tab === f.tab);
    const step = seatStep(mine.length);
    if (!step) return;
    const live = new Set(agents().map((a) => a.address));
    const seated = new Set(ps.map((p) => p.terminal).filter(Boolean));
    const now = Date.now();
    const hire = staffOf(terminals() ?? [], boss).find((addr) => live.has(addr) && !seated.has(addr) && now - (this.tried.get(addr) ?? 0) > 10000);
    const from = step.from === "boss" ? mine.find((p) => p.terminal === boss) : mine[mine.length - 1];
    if (!hire || !from) return;
    this.tried.set(hire, now);
    run("pane.focus", { pane: from.pane });
    run("terminal.keep", { terminal: hire, place: step.place });
    if (f.pane) run("pane.focus", { pane: f.pane });
  }

  // Panel: the space goals go to (picked, else the one you are in).
  room(sp) {
    return sp.find((s) => s.id === this.bossRoom) ?? sp.find((s) => s.active) ?? sp[0] ?? null;
  }

  loadKnown(machine, cx) {
    const key = machine ?? "";
    this.loadingKnown.add(key);
    cx.spawn(async (cx) => {
      let list = [];
      try {
        list = ((await knownAgents(machine ? { on: machine } : undefined)) ?? []).filter((a) => a.installed && Array.isArray(a.run) && a.run.length > 0);
      } catch {}
      this.known[key] = list;
      this.loadingKnown.delete(key);
      cx.notify();
    });
  }

  // A goal for the room's boss: sent to it, or, with no boss yet, a boss hired
  // in a new "Boss" tab with the brief and the goal as its first message.
  assign(cx) {
    const goal = (this.bossInput?.value() ?? "").replace(/\s+/g, " ").trim();
    if (!goal || this.busy) return;
    const ps = panes();
    const room = this.room(spaces());
    if (!room) return this.flash("Open a space first", "blocked", cx, "bossNote");
    const boss = this.bosses()[room.id];
    if (boss && ps.some((p) => p.terminal === boss)) {
      if (agents().find((a) => a.address === boss)?.status === "blocked") {
        return this.flash("The boss waits for your answer first", "blocked", cx, "bossNote");
      }
      this.busy = true;
      cx.spawn(async (cx) => {
        try {
          const r = await hc(["send", boss, "--", goal]);
          if (r.code === 0) { this.bossInput.set_value(""); this.flash("Sent to the boss", "done", cx, "bossNote"); }
          else this.flash(firstLine(r.stderr) || firstLine(r.stdout) || "Couldn't reach the boss", "blocked", cx, "bossNote");
        } catch (e) {
          this.flash(firstLine(String(e?.message ?? e)) || "Couldn't reach the boss", "blocked", cx, "bossNote");
        }
        this.busy = false;
        cx.notify();
      });
      return;
    }
    const known = this.known[room.machine ?? ""];
    if (!known) return this.flash("Looking for agents…", "muted", cx, "bossNote");
    const pick = known.find((k) => k.key === this.bossPick) ?? known[0];
    if (!pick) return this.flash("No agent installed to be the boss", "blocked", cx, "bossNote");
    const folder = spaceFolder(room, ps);
    this.busy = true;
    this.bossInput.set_value("");
    this.flash(`Hiring a boss (${pick.name})…`, "done", cx, "bossNote");
    cx.spawn(async (cx) => {
      const playbook = await this.playbookFor(room.machine ?? null);
      run("tab.new", { space: room.id, name: "Boss", argv: pick.run, task: bossBrief({ goal, playbook, argv: pick.run, folder, space: room.name, most: STAFF_CAP }) });
      this.busy = false;
      cx.notify();
    });
    cx.notify();
  }

  // Where the boss reads its playbook: boss.md here; on another machine, a copy
  // written to REMOTE_PLAYBOOK there (the text goes as an argument, never
  // through the shell's parsing). null when there is none: the brief then
  // carries the rules that matter most on its own.
  async playbookFor(machine) {
    const text = await readTextFile(PLAYBOOK).catch(() => null);
    if (typeof text !== "string" || !text.trim()) return null;
    if (!machine) return PLAYBOOK;
    try {
      const r = await exec("sh", ["-c", 'f="$HOME/$1"; mkdir -p "$(dirname "$f")" && printf "%s" "$2" > "$f" && printf "%s" "$f"', "sh", REMOTE_PLAYBOOK, text], { on: machine });
      return r.code === 0 && r.stdout.trim() ? r.stdout.trim() : null;
    } catch {
      return null;
    }
  }

  readBoss(boss, seq, cx) {
    this.bossReading = true;
    cx.spawn(async (cx) => {
      let line = "";
      try {
        const r = await hc(["read", boss, "--lines", "20", "--json"]);
        if (r.code === 0) {
          let text = r.stdout;
          try { text = JSON.parse(r.stdout)?.text ?? ""; } catch {}
          line = speechLine(screenLines(text, 30));
        }
      } catch {}
      this.bossReading = false;
      const changed = this.bossSay?.line !== line || this.bossSay?.key !== boss;
      this.bossSay = { key: boss, seq, at: Date.now(), line };
      if (changed) cx.notify();
    });
  }

  // The band in front of the back wall: the boss, what it says, where goals go,
  // and the box to give it one.
  bossBand(t, sp, list, team) {
    const room = this.room(sp);
    const bossAddr = room ? this.bosses()[room.id] ?? null : null;
    const boss = bossAddr ? list.find((a) => a.address === bossAddr) ?? null : null;
    const hires = bossAddr ? team.bosses.get(bossAddr)?.staff ?? [] : [];
    const crew = list.filter((a) => hires.includes(a.address));
    const busy = crew.filter((a) => a.status === "working").length;
    const state = boss?.status ?? "idle";
    // What it says: its office.say label, else its screen's last line.
    const said = (bossAddr && team.say.get(bossAddr)) || (bossAddr && this.bossSay?.key === bossAddr ? this.bossSay.line : "");
    const line = this.bossNote?.text
      ?? (said || (bossAddr ? (boss ? deskLabel({ agent: boss }) : "Getting ready…") : `Tell me what ${room?.name ?? "this space"} needs: I'll hire the team.`));
    const known = this.known[room?.machine ?? ""];
    const pick = known?.find((k) => k.key === this.bossPick) ?? known?.[0] ?? null;
    const chip = (id, label, on, tip, action, color) => h_flex().id(id).h(22).px(7).gap(5).flex_none().items_center().max_w(130)
      .text_size(11).border(1).border_color(on ? t.accent : withAlpha(color ?? t.muted, "66")).bg(on ? t.selected : "#0d131bcc")
      .text_color(on ? t.foreground : t.muted).cursor_pointer().hover((s) => s.bg(t.hover)).tooltip(tip).on_click(action)
      .child(div().min_w(0).truncate().child(label));
    const colors = shared("space.colors") ?? {};
    return div().id("boss-band").relative().h(BAND_H).flex_none().overflow_hidden().bg("#1a2230")
      .child(div().absolute().top(0).left(0).child(image(WALL_WIDE).w(900).h(44)))
      .child(div().absolute().top(44).left(0).right(0).h(1).bg("#11161f"))
      .child(div().id("boss").absolute().left(10).bottom(4).w(64).h(88).cursor_pointer()
        .tooltip(bossAddr ? "The boss · click for details, double-click for its terminal" : "The boss: give it a goal and it hires the team")
        .on_click((e, cx) => {
          if (!bossAddr) return this.bossInput.focus();
          if (e.click_count >= 2) run("agent.focus", { terminal: bossAddr });
          else this.pick(bossAddr, cx);
        })
        .child(image(`${BOSS_DIR}/${["working", "blocked", "done"].includes(state) ? state : "idle"}.gif`).w(64).h(88)))
      // What it says, and its team.
      .child(h_flex().absolute().left(84).right(10).top(6).h(26).px(8).gap(8).items_center().bg("#f4efe4").border(1).border_color("#cfc5b2")
        .child(div().flex_1().min_w(0).truncate().text_size(11.5)
          .text_color(this.bossNote ? (this.bossNote.tone === "blocked" ? "#a3352b" : "#2f6b3a") : "#1d2733").child(line))
        .when(hires.length > 0, (el) => el.child(div().flex_none().text_size(10.5).text_color("#55606e")
          .child(`team ${hires.length}${busy ? ` · ${busy} working` : ""}`))))
      .child(div().absolute().left(80).top(14).size(6).bg("#f4efe4"))
      // Where the goal goes, and (with no boss there yet) who to hire as the boss.
      .child(h_flex().absolute().left(84).right(10).top(38).h(22).gap(4).items_center().overflow_hidden()
        .children(sp.slice(0, 6).map((s) => chip(`room-${s.id}`, `${this.bosses()[s.id] ? "● " : ""}${s.name}`, s.id === room?.id,
          this.bosses()[s.id] ? `${s.name}: has a boss` : `${s.name}: no boss yet`,
          (_e, cx) => { this.bossRoom = s.id; localStorage.setItem("office.bossRoom", s.id); cx.notify(); }, spaceColor(t, colors, s.id))))
        .child(div().flex_1())
        .when(!bossAddr && known === undefined, (el) => el.child(div().flex_none().text_size(10.5).text_color(t.dim).child("Looking for agents…")))
        .when(!bossAddr && Array.isArray(known), (el) => el.children(known.slice(0, 3).map((k) => chip(`hire-${k.key}`, k.name, k.key === pick?.key,
          `Hire ${k.name} as the boss`, (_e, cx) => { this.bossPick = k.key; localStorage.setItem("office.bossAgent", k.key); cx.notify(); })
          .child(programIcon(k, t, 12))))))
      .child(h_flex().absolute().left(84).right(10).bottom(6).h(30).gap(6).items_center()
        .child(div().flex_1().min_w(0).child(Input.new(this.bossInput)))
        .child(div().id("boss-assign").h(28).px(12).flex().flex_none().items_center().bg(this.busy ? t.raised : t.accent)
          .text_size(12).font_bold().text_color(t.accent_foreground ?? "#101820").cursor_pointer()
          .tooltip(bossAddr ? "Send the goal to the boss" : `Hire ${pick?.name ?? "an agent"} as the boss with this goal`)
          .on_click((_e, cx) => this.assign(cx)).child(bossAddr ? "Tell ⏎" : "Hire ⏎")));
  }

  // ---- needs you ----

  readAsk(agent, cx) {
    this.askReading = true;
    const seq = `${agent.seq}`;
    cx.spawn(async (cx) => {
      let ask = { question: [], options: [] };
      try {
        const r = await hc(["read", agent.address, "--lines", "30", "--json"]);
        if (r.code === 0) {
          let text = r.stdout;
          try { text = JSON.parse(r.stdout)?.text ?? ""; } catch {}
          ask = parsePrompt(screenLines(text, 40));
        }
      } catch {}
      this.askReading = false;
      this.asks.set(agent.address, { seq, ...ask });
      cx.notify();
    });
  }

  // `hc keys`: the choice you clicked, pressed in its terminal.
  answer(agent, key, cx) {
    if (this.busy) return;
    this.busy = true;
    const seq = `${agent.seq}`;
    cx.spawn(async (cx) => {
      try {
        const r = await hc(["keys", agent.address, key]);
        if (r.code === 0) this.answered.set(agent.address, seq);
        else this.flash(firstLine(r.stderr) || firstLine(r.stdout) || "Couldn't answer", "blocked", cx, "askNote");
      } catch (e) {
        this.flash(firstLine(String(e?.message ?? e)) || "Couldn't answer", "blocked", cx, "askNote");
      }
      this.busy = false;
      cx.notify();
    });
  }

  // One waiting agent at a time (› for the next): who, its question as its
  // screen shows it, and its choices. Nothing is answered for you.
  needsYou(list, roles, sp, t, mono) {
    const waiting = list.filter((a) => a.status === "blocked");
    if (!waiting.length) return null;
    this.card = Math.min(this.card, waiting.length - 1);
    const a = waiting[this.card];
    const ask = this.asks.get(a.address);
    const fresh = ask && ask.seq === `${a.seq}`;
    const answered = this.answered.get(a.address) === `${a.seq}`;
    const job = roles.get(a.address);
    const src = portraitPath(job);
    const tab = sp.flatMap((s) => s.tabs ?? []).find((c) => c.id === a.tab);
    const since = ago(tab?.changed_at, this.now);
    const keys = fresh && ask.options.length ? ask.options.map((o) => [o.key, `${o.key}  ${o.label}`]) : [["enter", "Enter"], ["esc", "Esc"]];
    const question = fresh ? (ask.question.length ? ask.question : ["(no question on its screen: look at it with Details)"]) : ["Reading its question…"];
    return v_flex().id("needs-you").flex_none().mx(8).mt(8).p(8).gap(6).bg("#2a1f1c").border(2).border_color(t.blocked)
      .child(h_flex().gap(8).items_center()
        .child(div().size(30).flex_none().border(1).border_color(t.blocked).bg(t.raised).when(Boolean(src), (el) => el.child(image(src).size(28))))
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().text_size(12).font_bold().text_color(t.foreground)
            .child(`Needs you · ${job ? cap(job) : "Agent"} · ${a.program?.name ?? "Agent"}`))
          .child(div().truncate().text_size(10.5).text_color(t.dim).child(`${a.space_name} › ${a.tab_name}${since ? ` · waiting ${since}` : ""}`)))
        .when(waiting.length > 1, (el) => el.child(this.small("ask-next", `${this.card + 1}/${waiting.length} ›`, "The next one waiting", t,
          (_e, cx) => { this.card = (this.card + 1) % waiting.length; cx.notify(); })))
        .child(this.small("ask-details", "Details", "Show it in the inspector", t, (_e, cx) => this.pick(a.address, cx)))
        .child(this.small("ask-open", "Open ↗", "Its terminal", t, () => run("agent.focus", { terminal: a.address }))))
      .child(v_flex().px(8).py(4).bg("#11161d")
        .children(question.map((q, i) => div().id(`ask-q-${i}`).truncate().font_family(mono).text_size(11.5).text_color(t.foreground).child(q))))
      .child(h_flex().gap(5).flex_wrap().items_center()
        .when(answered, (el) => el.child(div().text_size(11).text_color(t.dim).child("Answered: waiting for it to go on…")))
        .when(!answered, (el) => el.children(keys.map(([key, label]) => this.small(`ask-key-${key}`, label, `Press ${key} in its terminal`, t,
          (_e, cx) => this.answer(a, key, cx)).max_w(240))))
        .when(Boolean(this.askNote), (el) => el.child(div().text_size(11).text_color(t[this.askNote.tone] ?? t.muted).child(this.askNote.text))));
  }

  render(cx) {
    const t = theme();
    const sp = spaces();
    const ps = panes();
    const terms = terminals() ?? [];
    this.wide = Boolean(props()?.wide);
    this.hot = shared("office.hover") ?? null;
    this.watchShape(cx, sp, ps);
    if (!this.wide) this.findBosses(sp, ps, terms);
    // A boss's hires without a pane of their own sit in the boss's tab.
    const team = this.team(sp, ps, agents(), terms);
    const paneIds = new Set(ps.map((p) => p.pane));
    const list = agents().map((a) => {
      const at = team.staff.get(a.address);
      if (!at) return a;
      // A hire's desk says its task (office.task), when it has one.
      const task = team.tasks.get(a.address);
      const hire = task ? { ...a, title: task } : a;
      return a.pane && paneIds.has(a.pane)
        ? hire
        : { ...hire, tab: at.tab.id, tab_name: at.tab.name, space: at.space.id, space_name: at.space.name };
    });
    const plan = officePlan(sp, ps, list);
    const roles = deskJobs(sp, ps, list, { Boss: "manager", ...this.jobs });
    for (const boss of team.bosses.keys()) roles.set(boss, "manager");
    for (const hire of team.staff.keys()) {
      const role = roleFromName(team.names.get(hire));
      if (role && roles.has(hire)) roles.set(hire, role);
    }
    if (!this.wide) {
      // agent.next / agent.prev walk the desks in the order they are drawn.
      setAgentOrder(plan.flatMap((row) => row.tabs.flatMap((c) => c.desks.filter((d) => d.agent).map((d) => d.agent.address))));
      this.shareFaces(roles);
      if ((find(layout(), "sidebar")?.size?.px ?? Infinity) < 160) return this.rail(plan, roles, t);
    }
    const width = this.wide ? find(layout(), "panel")?.size?.px ?? 640 : 300;
    this.z = this.wide && this.zoom === "large" && width >= LARGE_FROM ? LARGE : SMALL;
    this.most = this.wide ? fitAcross(width - this.z.pad, this.z.slot, this.z.gap) : MOST_ACROSS;
    this.now = Date.now();
    const filter = this.wide ? this.filter : "all";
    // Filtered, a tab shows some of its desks: the split no longer fits them.
    const trees = filter === "all" ? this.treesFor(plan) : new Map();
    const shown = filterPlan(plan, filter);
    const colors = shared("space.colors") ?? {};
    const n = tally(list);
    // The terminals' code font, for the inspector's screen.
    let mono = "monospace";
    try { mono = cx.theme()?.typography?.mono || mono; } catch {}
    const away = this.wide && filter === "all" ? this.storage(sp, t) : null;
    if (this.wide) {
      const room = this.room(sp);
      const key = room?.machine ?? "";
      if (room && !(key in this.known) && !this.loadingKnown.has(key)) this.loadKnown(room.machine ?? null, cx);
    }
    const empty = plan.length === 0 ? "Nobody in yet. Open a space to start."
      : { working: "Nobody at work right now.", blocked: "Nobody needs you.", done: "Nothing finished yet." }[filter];
    return v_flex()
      .id("office")
      .size_full()
      .min_h(0)
      .relative()
      .overflow_hidden()
      .bg(CARPET)
      .text_color(t.foreground)
      .child(div().absolute().top(0).left(0).child(image(FLOOR).w(912).h(800)))
      .when(!this.wide, (el) => el
        .child(h_flex().h(28).flex_none().pl(16).pr(12).gap(6).items_center().bg(t.chrome).text_size(11.5).text_color(t.dim)
          .child(div().flex_1().child("Office"))
          .when(n.blocked > 0, (el) => el.child(div().text_color(t.blocked).child(`${n.blocked} need${n.blocked === 1 ? "s" : ""} you ·`)))
          .child(div().text_size(11).child(`${n.working}/${list.length} at work · ${this.time}`)))
        .child(this.wall()))
      .when(this.wide, (el) => {
        const ask = this.needsYou(list, roles, sp, t, mono);
        return el.child(this.header(n, list.length, t)).child(this.bossBand(t, sp, list, team)).when(Boolean(ask), (el) => el.child(ask));
      })
      .child(v_flex().id("office-floor").flex_1().min_h(0).p(this.wide ? 10 : 8).gap(this.wide ? 10 : 8).overflow_y_scrollbar()
        .children(shown.map((row) => this.rug(row, roles, colors, trees, t)))
        .when(shown.length === 0, (el) => el.child(div().p(8).text_size(12).text_color(t.dim).child(empty ?? "Nobody here.")))
        .when(Boolean(away), (el) => el.child(away))
        .when(this.wide, (el) => el.child(h_flex().flex_none().child(this.button("office-new-space", "+ New space", "A new space on this computer", t, () => run("space.new"))))))
      .when(this.wide, (el) => el.child(this.inspector(roles, t, mono)));
  }
}
