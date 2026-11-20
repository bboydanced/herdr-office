// Office Agent (the sidebar) is the staff as a list: one row per agent, its
// status and for how long, and the space and tab it sits in; the spaces you put
// in a group are banded under the group's name, folded with it. A click goes to
// its terminal. The sidebar reads jobs.json and Herdr's layout document only and
// opens no connection; the one command it runs is `hc label`, once per boss it
// finds (see findBosses).
//
// With props { wide: true } (the side panel's Office tab) the office proper is
// drawn: one room for every agent, each space a rug in its Spaces colour and
// order, each tab a cubicle, each pane a desk placed the way the tab is split
// (side by side or one above the other, read from Herdr's layout document), else
// in pane order. Desks at 2 points an art pixel (3 with "+"), as many across as fit,
// each with its status and for how long, a live board on the wall
// and filters, "+" buttons for a new tab, desk or space (the office-add popup)
// and the tabs put away. A desk dragged onto another tab's Move here spot moves there,
// its terminal still running (moveTerminal). Only the sidebar's office sets the agent.next /
// agent.prev order. In both, right-click opens Herdr's own menu for a desk, a
// cubicle or a rug, and middle-click peeks at a desk's terminal. A rug under the
// pointer lights its room in the Spaces list and back ("office.hover"); the
// sidebar's office tells Spaces who wears which role ("office.faces").
//
// The panel is also where you work with them: a click on a desk picks that staff
// member (a double-click goes to their terminal) and opens their real terminal
// in a window (desk.js: a header with Go, Stop and quick replies over a terminal
// block Herdr draws like any pane); the inspector under the floor says who and
// where they are. With props { desk } this mod is that window's header.
//
// The boss: in a band at the top of the panel stands the team lead you give
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
import { Input, InputState, Popover, Textarea, TextareaState, h_flex, v_flex } from "gpui-base";
import { agents, appHome, closeOverlay, commands, exec, focused, hc, home, knownAgents, layout, openOverlay, panes, props, readTextFile, run, setAgentOrder, setShared, shared, spaces, terminals, theme } from "herdr";
import { WORKTREE_PROBE, acceptMessage, ago, backings, bossBrief, bossStage, bossTabOf, deskColumns, goalOf, labelOf, deskJobs, deskLabel, deskState, deskTip, filterPlan, findBosses, firstLine, fitAcross, hireCommand, hireTemplate, isBossTab, isHire, isNight, localId, mixHex, morningSummary, nightEvents, officePlan, oneLine, parseHours, parseProbe, parsePrompt, planAge, planNotes, portraitPath, screenLines, seatStep, shortPath, spaceColor, speechLine, splitTree, staffOf, standIn, tally, treeWidth, underHc, uniqueFaces, withAlpha, worktreeOf } from "./lib.js";
import { Desk } from "./desk.js";
import { LOOKS, bossFigure, deskFigure } from "./figure.js";
import { bossOffice, sidebarWall } from "./room.js";
import { BOARD, NEON, neonColor, neonFrame, neonSign } from "./neon.js";
import { lobbyTabs } from "./lobby.js";
import { groupOf, loadGroups, planGroups, saveGroups } from "./groups.js";
import { branchesOf, nestRows, roomCount } from "./worktrees.js";
import { LAMP } from "./card.js";

const JOBS_FILE = `${appHome()}/mods/office-agents/jobs.json`;
// The boss's playbook; on another machine a copy goes to REMOTE_PLAYBOOK there.
const PLAYBOOK = `${appHome()}/mods/office-agents/boss.md`;
const REMOTE_PLAYBOOK = ".config/herdr-office/boss.md";
// What hires the boss's staff at the size of their seat (see hire.sh).
const HIRE = `${appHome()}/mods/office-agents/hire.sh`;
const REMOTE_HIRE = ".config/herdr-office/hire.sh";
// The inspector's height; how often the panel reads the questions of those
// waiting for you and the boss's screen (and the sidebar seats hires).
const INSPECT_H = 56;
const READ_EVERY = 2000;
// The desk window: one, replaced in place when another desk is picked; its
// header (this mod with props { desk }) over the terminal itself.
const DESK_WINDOW = "office-desk";
const DESK_HEAD_H = 76;
// herdr-core keeps every app's shared documents here, Herdr's layout among them.
const CORE_DOCS = ".local/state/herdr-core/default/docs.json";
// The panel's floor: quiet carpet tiles, 912x800 points; past its bottom, its
// base colour (build-art.py PLANK) carries on.
const FLOOR = "mods/office-agents/room/floor-tiles.png";
const CARPET = "#242738";
const TAG = "#c8392f";
// Corner radii: tags and plates, buttons and chips, cubicles and rows, rugs and cards.
const R = { tag: 3, control: 5, card: 6, room: 8 };
// A hard pixel shadow: a dark bar just under a box, clear of its corners (no blur).
const dropShadow = (r) => div().absolute().left(r).right(r).bottom(-2).h(2).bg("#00000066");
// Desks (figure.js) on its 36x30 grid, in a slot wide enough for a name. pad:
// the floor, rug and cubicle padding around a row of desks. The sidebar's at 2
// points a unit; the panel's bigger so faces read, 84x70 (figure.js rounds
// every edge to a whole pixel), with room for a desk's two lines.
const SMALL = { deskW: 72, deskH: 60, slot: 80, label: 13, text: 10, gap: 6, pad: 40 };
const WIDE = { deskW: 84, deskH: 70, slot: 92, label: 15, text: 11, gap: 6, pad: 40 };
// Add desk (panel only): a small "+" taped out on a cubicle's name row.
const TAPE = "#c9b48a";
// The tube round a group of spaces (here and in Spaces).
const GROUP_NEON = "#7fe3f0";
// Stop, in the boss's office: a red neon tube.
const STOP_NEON = "#ff6b5a";
// The boss's neon: a step of its flow done; text on its dark boards, and off.
const DONE_NEON = "#a6da95", NIGHT_TEXT = "#c3cbe6", NIGHT_OFF = "#6f7898", NIGHT_HOVER = "#241c42";
// A face (positioned absolute in its frame) that moves with its status:
// bobbing while at work, as if typing; shaking while it waits for you.
const lively = (el, id, status) => (status === "working" ? el.id(id).loop("top", { from: 1, to: -1, period: 520 })
  : status === "blocked" ? el.id(id).loop("left", { from: -1, to: 1, period: 160, easing: "linear" }) : el);
// In the sidebar, wider than this many desks a split tree falls back to rows.
const MOST_ACROSS = 3;
const FILTERS = [["all", "All"], ["working", "Working"], ["blocked", "Needs you"], ["done", "Done"]];
// The boss: standing, 64x88 points (bossFigure). Its band: the boss on the
// left; what it says, the rooms row and the goal box beside it; folded, one line.
// The boss's office (room.js, 900x136 points): its wall down to WALL_H, then
// the floor it stands on. The band grows with the goal box; the floor's colour
// carries on below the picture.
const BAND_H = 136;
const WALL_H = 64;
const BOSS_FLOOR = CARPET;
// How a boss works, in order (bossStage): what each step means.
const FLOW_TIPS = [
  "Plan: reads your goal and splits it into pieces that can run side by side",
  "Hire: one coding agent per piece, at most 4 at work at once",
  "Review: reads each agent's changes and runs the check before calling it done",
  "Report: tells you what was done, and asks before anything destructive",
];
// The plan board's notes, by where a piece is (planNotes): the neon each is
// edged and written in (at work and waiting for you, the theme's colours).
const NOTE = {
  todo: { neon: "#8a93b8", mark: "○", text: "To do" },
  hired: { neon: "#c6a0f6", mark: "●", text: "Hired" },
  working: { neon: "#ffe27a", mark: "●", text: "At work" },
  blocked: { neon: "#ff6b5a", mark: "!", text: "Needs you" },
  done: { neon: "#7fe3f0", mark: "◐", text: "To review" },
  ok: { neon: "#a6da95", mark: "✓", text: "Passed review" },
  merged: { neon: "#8fa39a", mark: "✓", text: "Merged" },
};
// How often a piece done in a worktree has its diff read again.
const DIFF_EVERY = 15000;
// After hours: what finished or waited for you while you were away (the
// sidebar writes it, the panel's morning memo reads it), and the switch.
const NIGHT_LOG = "office.nightLog";
const AFTER_HOURS = "office.afterHours";
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const afterHoursOn = () => shared(AFTER_HOURS) ?? localStorage.getItem(AFTER_HOURS) !== "off";
const nightNow = () => afterHoursOn() && isNight(new Date(), parseHours(localStorage.getItem("office.hours")));
const hh = (h) => `${String(h).padStart(2, "0")}:00`;
const clockAt = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
// The orchestrator picked by default, when it is installed.
const DEFAULT_BOSS = "claude";
const BAND_FOLDED_H = 34;
// How many hires the boss is told it may have at a time.
const STAFF_CAP = 4;
// The goals recently given, per space, so a goal you sent is still there when
// you come back (and a long spec can be pasted again): { [space id]: [goal] }.
const GOALS = "office.goals";
const GOALS_KEPT = 5;
// Each boss's plan as the goal before the current one left it: { address: { plan, goal } }.
const BOARDS = "office.boards";

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

// To a desk's terminal: an agent through Herdr's own focus; a stand-in (a hire
// Herdr gets no status from) or a shell at its pane; with no pane, a peek.
function reach(a, space, tab, pane, terminal) {
  if (a && !a.standIn) return run("agent.focus", { terminal: a.address });
  if (space && tab && pane) return goTo(space, tab, pane);
  if (terminal) run("terminal.peek", { terminal });
}

// Moving a desk's terminal into another tab of its machine, still running.
// With pane.move (herdr-app PR #444) one command; until then the recipe the
// "Move to" mod uses: park, wait for the pane to go, relabel, keep — in that order.
const bare = (id) => String(id).slice(String(id).lastIndexOf("/") + 1);
const sleep = (ms) => exec("sleep", [String(ms / 1000)]);

function hasCommand(name) {
  try {
    const all = commands();
    if (Array.isArray(all)) return all.some((c) => (typeof c === "string" ? c : c?.name ?? c?.id ?? c?.command) === name);
    return Boolean(all && typeof all === "object" && name in all);
  } catch {
    return false;
  }
}

async function moveTerminal(from, to) {
  if (hasCommand("pane.move")) return run("pane.move", { pane: from.pane, tab: to.tab });
  const seated = () => panes().some((p) => p.terminal === from.terminal);
  run("terminal.park", { terminal: from.terminal });
  for (let i = 0; i < 40 && seated(); i++) await sleep(150);
  if (seated()) throw new Error("The desk didn't let go of its terminal");
  const failed = (r) => new Error(firstLine(r.stderr) || firstLine(r.stdout) || "Couldn't move the terminal");
  const r = await hc(["label", from.terminal, `herdr.space=${bare(to.space)}`, `herdr.tab=${bare(to.tab)}`]);
  if (r.code !== 0) {
    await hc(["keep", from.terminal]).catch(() => null); // back to its own tab
    throw failed(r);
  }
  const k = await hc(["keep", from.terminal]);
  if (k.code !== 0) throw failed(k);
}

// How a desk or a rug shows that someone there is busy or waiting for you,
// with one thin frame: busy, a glow breathing under it and the frame breathing
// with it; waiting, a red tint and the frame blinking fast. The pulses run
// natively; nothing re-renders for them.
function activity(id, status, t, r = 0) {
  const fill = () => div().absolute().top(0).left(0).right(0).bottom(0).rounded(r);
  const frame = () => div().absolute().top(0).left(0).right(0).bottom(0).rounded(r).border(1);
  if (status === "working") {
    return {
      under: [fill().id(`${id}-glow`).bg(withAlpha(t.working, "2e")).loop("opacity", { from: 0.15, to: 1, period: 1100 })],
      over: [frame().id(`${id}-edge`).border_color(withAlpha(mixHex(t.working, "#ffffff", 0.3), "b3")).loop("opacity", { from: 0.4, to: 1, period: 1100 })],
    };
  }
  if (status === "blocked") {
    return {
      under: [fill().bg(withAlpha(t.blocked, "30"))],
      over: [frame().id(`${id}-blink`).border_color(t.blocked).loop("opacity", { from: 0.2, to: 1, period: 600, easing: "linear" })],
    };
  }
  return { under: [], over: [] };
}

// The space under the pointer, here or in Spaces: set only when it changes
// (every mod redraws on a shared value, and a redraw reports hover again).
function hoverSpace(id, on) {
  const now = shared("office.hover") ?? null;
  const next = on ? id : now === id ? null : now;
  if (next !== now) setShared("office.hover", next);
}

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

// The group dialog (name and the spaces in it): a group id, or "@new".
const openGroupDialog = (group) => openOverlay({ mod: "office-space-new", kind: "popup", width: 420, height: 430, props: { group } });
// The sidebar list's rows: per space, its staff with the tab and pane each sits
// in (spaces with nobody left out), folded into the groups you made.
function listDeck(plan, groups) {
  const rows = plan
    .map((row) => ({
      space: row.space,
      staff: row.tabs.flatMap((c) => c.desks.filter((d) => d.agent).map((d) => ({ agent: d.agent, tab: c.tab, pane: d.pane }))),
    }))
    .filter((row) => row.staff.length > 0);
  return planGroups(rows, groups);
}
// The most urgent status among some agents: waiting beats working.
const urgent = (list) => (list.some((a) => a.status === "blocked") ? "blocked" : list.some((a) => a.status === "working") ? "working" : null);

export default class Office extends View {
  init(_props, cx) {
    // The desk window's header: nothing of the office below runs there.
    if (props()?.desk) { this.deskHead = new Desk(cx); return; }
    this.jobs = {};
    this.time = clock();
    this.docs = {}; // machine ("" here) -> its herdr-core documents
    this.docTexts = {}; // machine -> the text they were read from
    this.trees = null; // tab id -> split tree, worked out once per change
    this.shape = null; // every tab's panes, to notice splits and closes
    this.filter = localStorage.getItem("office.filter") ?? "all"; // wide only
    this.tried = new Map(); // a hire -> when it was last given a pane (sidebar)
    this.marked = new Set(); // bosses this copy has labelled office.role=boss
    if (props()?.wide) {
      this.selected = localStorage.getItem("office.selected") || null; // a terminal's address
      this.deskWindow = null; // the open desk window's overlay id
      this.bandFolded = localStorage.getItem("office.bossBand") === "folded";
      // What is on its way, each on its own so one never silently blocks another.
      this.bossBusy = false; // a goal to the boss, or a boss being hired
      this.answering = false; // a key pressed for "Needs you"
      this.bossRoom = localStorage.getItem("office.bossRoom") || null; // a space id
      this.bossPick = localStorage.getItem("office.bossAgent") || null; // a program key
      this.picking = null; // the boss band's open picker: "room" | "agent" | null
      this.goals = readJson(GOALS, {}); // space id -> the goals given there, newest first
      this.boards = readJson(BOARDS, {}); // boss address -> the plan its last goal left
      this.stopping = false; // a Stop on its way to the boss
      this.known = {}; // machine ("" here) -> installed agents (knownAgents)
      this.loadingKnown = new Set();
      // Multi-line, so a pasted spec keeps its lines (hc send pastes it whole).
      this.bossInput = TextareaState.new({ placeholder: "What should the team do? Type or paste a spec · Ctrl+Enter" });
      this.bossInput.set_auto_grow(1, 6);
      this.bossInput.on("submit", (e, cx) => { if (e?.secondary) this.assign(cx); });
      this.bossSay = null; // { key, seq, at, line }: the boss's latest line
      this.bossNote = null;
      this.bossReading = false;
      this.asks = new Map(); // a waiting agent -> { seq, question, options }
      this.answered = new Map(); // a waiting agent -> the seq it was answered at
      this.askReading = false;
      this.askNote = null;
      this.card = 0; // which waiting agent "Needs you" shows
      this.drag = null; // a desk held down: { terminal, pane, tab, space, machine, name, moved }
      this.hoverTab = null; // the cubicle under the pointer: its "+" shows
      this.moving = false;
      this.moveNote = null;
      this.boardNow = null; // the whiteboard in view: { boss, machine, notes }
      this.diffs = new Map(); // a hire in a worktree -> { cwd, at, branch, files, add, del, dirty } | { err }
      this.probing = false;
      this.accepting = null; // the hire whose Accept asks "Merge?"
      cx.timer.every(READ_EVERY, (cx) => this.poll(cx));
    } else {
      // The sidebar's office runs the hires' seating and keeps the night's
      // log: it is always there.
      this.seen = null; // address -> status, a tick ago
      if (!Array.isArray(shared(NIGHT_LOG))) setShared(NIGHT_LOG, readJson(NIGHT_LOG, []));
      cx.timer.every(READ_EVERY, () => { this.seat(); this.watchNight(); });
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

  // Each machine's layout document, read whole and all at once; a machine away
  // keeps none. Text unchanged since the last read keeps what came of it.
  loadDocs(cx, machines) {
    cx.spawn(async (cx) => {
      const keys = machines.map((m) => m ?? "");
      const texts = await Promise.all(machines.map((m) =>
        readTextFile(m ? CORE_DOCS : `${home()}/${CORE_DOCS}`, m ? { on: m } : undefined).catch(() => null)));
      const same = keys.length === Object.keys(this.docTexts).length && keys.every((k, i) => k in this.docTexts && this.docTexts[k] === texts[i]);
      if (same) return;
      const next = {};
      keys.forEach((k, i) => { try { next[k] = JSON.parse(texts[i]); } catch {} });
      this.docTexts = Object.fromEntries(keys.map((k, i) => [k, texts[i]]));
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
    const focused = a ? a.focused : d.pane.focused;
    const id = `desk-${a ? a.address : d.pane.pane}`;
    const shown = activity(id, a?.status, t, R.card);
    const terminal = a?.address ?? d.pane?.terminal ?? null;
    const picked = this.wide && terminal !== null && terminal === this.selected;
    // Wide, a desk with a terminal in a pane can be dragged to another tab's
    // Add desk; a boss stays in its Boss tab, where it is found.
    const movable = this.wide && Boolean(terminal && d.pane) && !this.bossAddrs.has(terminal);
    const held = this.drag?.moved && this.drag.terminal === terminal;
    // After hours, wide: a desk at work keeps its lamp on, the others dim.
    const lit = this.wide && this.night && a?.status === "working";
    const dim = this.wide && this.night && !lit && !held;
    const line = (h, size) => div().h(h).max_w(z.slot).px(4).flex().items_center().text_size(size).rounded(R.tag);
    // Wide, in a room on several branches: the one this desk's terminal is on.
    const branch = this.wide && (row.branches?.length ?? 0) > 1 ? d.pane?.branch ?? null : null;
    const tag = (text) => line(z.label, z.text - 1.5).px(5).bg(TAG).font_bold().text_color("#fff0e6").child(div().min_w(0).truncate().child(text));
    const name = line(z.label, z.text).bg(withAlpha(this.bk.shade, "b8"))
      .text_color(focused ? t.accent : a ? t.foreground : t.muted)
      .child(div().min_w(0).truncate().child(deskLabel(d) || " "));
    // The sidebar has room for one line: who, or that they wait for you. Wide,
    // both: the name, then the status and for how long (an empty desk: where).
    const lines = [];
    if (!this.wide) lines.push(a?.status === "blocked" ? tag("NEEDS YOU") : name);
    else {
      const state = deskState(a, c.tab, this.now);
      const tone = { working: mixHex(t.working, "#ffffff", 0.3), done: t.done }[state?.status] ?? t.dim;
      // Working and done say so with the mark and the desk's glow: the line keeps
      // the time, which is what a slot this narrow has room for.
      const mark = { working: "● ", done: "✓ " }[state?.status] ?? "";
      const since = mark ? state.text.split(" · ").slice(1).join(" · ") : "";
      // An empty desk's folder, unless it is the space's own (the rug says that).
      const path = shortPath(d.pane?.cwd);
      if (branch) {
        lines.push(name, line(z.label - 4, z.text - 2).gap(3).text_color(t.muted)
          .child(svg("mods/office-chrome/branch.svg").size(9).flex_none().text_color(t.dim))
          .child(div().min_w(0).truncate().child(branch.split("/").pop())));
      } else lines.push(name);
      lines.push(state?.status === "blocked" ? tag(state.text.replace("Needs you", "NEEDS YOU"))
        : line(z.label - 3, z.text - 1.5).text_color(a ? tone : t.dim)
          .child(div().min_w(0).truncate().child(a ? `${mark}${since || state.text}` : path && path !== this.roots.get(space.id) ? path : " ")));
    }
    return v_flex()
      .id(id)
      .relative()
      .w(z.slot)
      .flex_none()
      .items_center()
      .gap(1)
      .rounded(R.card)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .tooltip(`${deskTip({ agent: a, pane: d.pane, space, tab: c.tab })}${branch ? `\nBranch: ${branch}` : ""}\n${this.wide && terminal ? "Click: their terminal in a window · Double-click: go there · " : ""}${movable ? "Drag to another tab's Move here: move it there · " : ""}Right-click: menu${terminal ? " · Middle-click: peek" : ""}`)
      .when(this.wide, (el) => el
        .on_mouse_down("left", () => {
          this.drag = movable ? { terminal, pane: d.pane.pane, tab: c.tab.id, space: space.id, machine: space.machine ?? null, name: deskLabel(d) || "the desk", moved: false } : null;
        })
        .on_mouse_move((_e, cx) => this.dragOver(terminal, cx)))
      .when(held, (el) => el.opacity(0.4))
      .when(dim, (el) => el.opacity(0.5))
      .when(lit, (el) => el.bg(withAlpha(LAMP, "24")))
      .on_click((e, cx) => {
        if (held) return;
        // In the panel a click picks them (the desk window opens); a double-click, or a click in the sidebar, goes there.
        if (this.wide && terminal && e.click_count < 2) return this.pick(terminal, cx);
        if (this.wide) this.closeDesk();
        reach(a, space, c.tab, d.pane, terminal);
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
      .child(deskFigure(`fig-${a ? a.address : d.pane.pane}`, a && LOOKS[job] ? job : null, a?.status, z.deskW, z.deskH, t))
      .children(lines)
      .children(shown.over)
      .when(picked, (el) => el.child(div().absolute().top(-4).left(-4).right(-4).bottom(-4).rounded(R.card + 4).border(2).border_color(t.accent)));
  }

  // Desks the way the tab is split: a row for side by side, a column for stacked.
  arranged(node, byId, row, c, roles, t) {
    if (node.pane) return this.desk(row, c, byId.get(node.pane), roles, t);
    return (node.dir === "across" ? h_flex() : v_flex()).gap(this.z.gap).items_start()
      .children(node.children.map((child) => this.arranged(child, byId, row, c, roles, t)));
  }

  // A spot taped out on the floor, `w` x `h` (even): an L of tape at each
  // corner and a "+" in the middle, in `ink`; lit with `lit` under the pointer.
  spot(id, w, h, ink, fill, lit) {
    const arm = Math.min(8, Math.floor(Math.min(w, h) / 3));
    const plus = Math.min(12, Math.floor(Math.min(w, h) / 2.5)) & ~1;
    const bar = (left, top, bw, bh) => div().absolute().left(left).top(top).w(bw).h(bh).bg(ink);
    return div().id(id).relative().w(w).h(h).flex_none().rounded(R.tag).bg(fill).hover((s) => s.bg(lit))
      .child(bar(0, 0, arm, 2)).child(bar(0, 0, 2, arm))
      .child(bar(w - arm, 0, arm, 2)).child(bar(w - 2, 0, 2, arm))
      .child(bar(0, h - 2, arm, 2)).child(bar(0, h - arm, 2, arm))
      .child(bar(w - arm, h - 2, arm, 2)).child(bar(w - 2, h - arm, 2, arm))
      .child(bar((w - plus) / 2, (h - 2) / 2, plus, 2)).child(bar((w - 2) / 2, (h - plus) / 2, 2, plus));
  }

  // Wide, while a desk from another tab of the same machine is dragged: a spot
  // taped out on the floor at a desk's size, in the accent, to drop it on (it
  // moves into this tab). Adding a desk is the "+" on the cubicle's name row.
  // Returns { el, w } (the cubicle sizes itself by it), else null.
  ghost(row, c, t) {
    const z = this.z;
    const { space } = row;
    const takes = (drag) => Boolean(drag?.moved && !this.moving && drag.tab !== c.tab.id && drag.machine === (space.machine ?? null));
    if (!c.desks.some((d) => d.pane) || !takes(this.drag)) return null;
    const to = { tab: c.tab.id, space: space.id, where: `${space.name} › ${c.tab.name}` };
    const el = v_flex()
      .id(`ghost-${c.tab.id}`)
      .w(z.slot)
      .flex_none()
      .items_center()
      .gap(1)
      .tooltip("Drop the desk here to move it to this tab")
      .on_mouse_move((_e, cx) => this.dragOver(`ghost-${c.tab.id}`, cx))
      .on_mouse_up("left", (_e, cx) => {
        const from = this.drag;
        if (!takes(from)) return;
        cx.stop_propagation();
        this.drag = null;
        this.moveDesk(from, to, cx);
      })
      .child(div().w(z.slot).h(z.deskH).flex().flex_col().items_center().justify_end().pb(2)
        .child(this.spot(`ghost-spot-${c.tab.id}`, z.deskW, z.deskH - 4, t.accent, withAlpha(t.accent, "1f"), withAlpha(t.accent, "3d"))))
      .child(div().h(z.label).px(4).flex().items_center().text_size(z.text).text_color(t.accent).child("Move here"));
    return { el, w: z.slot };
  }

  // The cubicle under the pointer, for its "+" (Add desk): redrawn only when it changes.
  hoverCubicle(id, on, cx) {
    const next = on ? id : this.hoverTab === id ? null : this.hoverTab;
    if (next === this.hoverTab) return;
    this.hoverTab = next;
    cx.notify();
  }

  cubicle(row, c, roles, color, tree, t) {
    const z = this.z;
    const m = row.space.machine ?? null;
    const here = row.space.active && c.tab.active;
    // Dragging a desk, the place to drop it goes beside a split that has room,
    // else after the desks, counted as one of them.
    const ghost = this.wide ? this.ghost(row, c, t) : null;
    // Add desk splits beside the tab's last pane; shown on the cubicle under the pointer.
    const adding = this.wide && this.hoverTab === c.tab.id && !this.drag?.moved ? c.desks.filter((d) => d.pane).map((d) => d.pane).pop() ?? null : null;
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
    // As wide as its widest row: a slot a desk, Add desk its own width.
    const across = (items) => items.reduce((sum, d) => sum + (d.ghost ? d.ghost.w : z.slot), 0) + Math.max(0, items.length - 1) * z.gap;
    const splitW = tree ? treeWidth(tree) * z.slot + (treeWidth(tree) - 1) * z.gap + (beside ? z.gap + ghost.w : 0) : 0;
    const width = Math.max(splitW, ...lines.map(across));
    return v_flex()
      .id(`cubicle-${c.tab.id}`)
      .flex_none()
      .px(this.wide ? 5 : 4)
      .pb(this.wide ? 5 : 4)
      .gap(z.gap)
      .relative()
      .rounded(R.card)
      .bg(withAlpha(this.bk.shade, "70"))
      // A faint line of the space's neon; the tab you are in lit in it, breathing
      // (its name in amber; amber's bright frame stays the picked desk's).
      .border(1)
      .border_color(here ? "#00000000" : withAlpha(neonColor(color), "2e"))
      .when(here, (el) => el.children(neonFrame(`cubicle-neon-${c.tab.id}`, color, R.card, { alpha: "b3" })))
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        this.menu("tab", { id: c.tab.id, space: row.space.id });
      })
      .when(this.wide, (el) => el.on_hover((on, cx) => this.hoverCubicle(c.tab.id, on, cx)))
      // Its name; wide, under the pointer, a small taped "+" at the end of the
      // row: Add desk, a split beside the tab's last pane (the office-add popup).
      .child(h_flex().w(width).h(this.wide ? 16 : z.text + 4).gap(4).items_center()
        .child(div().flex_1().min_w(0).pt(1).truncate().text_size(z.text).text_color(here ? t.accent : t.muted).child(c.tab.name))
        .when(Boolean(adding), (el) => el.child(this.spot(`add-desk-${c.tab.id}`, 16, 16, withAlpha(TAPE, "cc"), withAlpha(this.bk.shade, "99"), withAlpha(TAPE, "40"))
          .cursor_pointer().tooltip("Add a desk: split this tab with a terminal or an agent")
          .on_click(() => this.add({ mode: "pane", space: row.space.id, tab: c.tab.id, pane: adding.pane, cwd: adding.cwd ?? null, machine: m, where: `${row.space.name} › ${c.tab.name}` })))))
      .when(Boolean(split), (el) => el.child(beside ? h_flex().gap(z.gap).items_start().child(split).child(ghost.el) : split))
      .children(lines.map((line) => h_flex().gap(z.gap).children(line.map((d) => (d.ghost ? d.ghost.el : this.desk(row, c, d, roles, t))))));
  }

  // A rug per space; one where someone works or waits shows it as a desk does,
  // with a count in its corner. Its worktrees' rooms (row.kids, worktrees.js)
  // right under it, on a line from it as Spaces lists them: in its colour,
  // fainter, a branch where the number goes (`parent`: the room it is under).
  // Its terminals on several branches: how many, and each desk says its own.
  rug(row, roles, colors, trees, t, parent = null) {
    const color = spaceColor(t, colors, (parent ?? row).space.id);
    const branches = this.branches?.get(row.space.id) ?? [];
    const several = branches.length > 1;
    const room = { ...row, branches };
    const staff = row.tabs.flatMap((c) => c.desks.filter((d) => d.agent).map((d) => d.agent));
    const status = urgent(staff);
    const count = staff.filter((a) => a.status === status).length;
    const shown = activity(`rug-${row.space.id}`, status, t, R.room);
    const hot = this.hot === row.space.id;
    const flow = this.wide ? this.bossFlow(row.space.id) : null;
    const rug = v_flex()
      .id(`rug-${row.space.id}`)
      .relative()
      .flex_none()
      .px(this.wide ? 8 : 6)
      .pt(this.wide ? 5 : 3)
      .pb(this.wide ? 8 : 6)
      .gap(this.wide ? 7 : 5)
      .rounded(R.room)
      .bg(withAlpha(color, parent ? (hot ? "2e" : "17") : hot ? "3a" : "24"))
      .on_hover((hov) => hoverSpace(row.space.id, hov))
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        this.menu("space", { id: row.space.id });
      })
      .child(dropShadow(R.room))
      .children(shown.under)
      .child(h_flex().h(this.wide ? 18 : 15).gap(6).items_center()
        // Wide, its room number in neon in its colour: the number on its door in
        // Spaces; a worktree's room, a branch, as its line in Spaces.
        .child(parent
          ? div().id(`rug-tree-${row.space.id}`).flex_none()
            .tooltip(`A worktree of ${parent.space.name}'s repo: a space of its own, with no room number`)
            .child(svg("mods/office-chrome/branch.svg").size(this.wide ? 13 : 11).text_color(neonColor(color)))
          : this.wide
          ? neonSign(`rug-no-${row.space.id}`, this.roomNo.get(row.space.id) ?? "", color).id(`rug-no-${row.space.id}`)
            .tooltip(`Room ${this.roomNo.get(row.space.id) ?? ""}: the same number is on its door in Spaces`)
          : div().size(7).flex_none().rounded(2).bg(color))
        .child(div().min_w(0).truncate().text_size(this.wide ? 12.5 : 11).font_semibold().text_color(t.foreground).child(row.space.name))
        .child(div().id(`rug-where-${row.space.id}`).flex_1().min_w(0).truncate().text_size(10.5).text_color(t.dim)
          .when(this.wide && several, (el) => el.tooltip(`Its terminals are on ${branches.length} branches:\n${branches.join("\n")}`))
          .child(!this.wide ? "" : several ? [row.space.machine, `${branches.length} branches`].filter(Boolean).join(" · ") : where(row.space)))
        .when(status === "blocked", (el) => el.child(div().flex_none().px(5).rounded(R.tag).bg(TAG).text_size(10).font_bold().text_color("#ffffff")
          .child(`! ${count} need${count === 1 ? "s" : ""} you`)))
        .when(status === "working", (el) => el.child(div().flex_none().text_size(10).text_color(mixHex(t.working, "#ffffff", 0.3))
          .child(`● ${count} working`)))
        .when(this.wide, (el) => el.child(this.button(`add-tab-${row.space.id}`, "+ Tab", "New tab: a terminal or an agent", t,
          () => this.add({ mode: "tab", space: row.space.id, machine: row.space.machine ?? null, where: row.space.name })))))
      .when(Boolean(flow), (el) => el.child(h_flex().gap(6).items_center()
        .child(div().flex_none().text_size(10).font_semibold().text_color(t.muted).child("BOSS"))
        .child(this.flowNotes(`rug-${row.space.id}`, flow, t))))
      .child(h_flex().flex_wrap().items_start().gap(this.wide ? 8 : 6)
        .children(row.tabs.map((c) => this.cubicle(room, c, roles, color, trees.get(c.tab.id) ?? null, t))))
      // Its edge a thin tube of its neon, breathing; glowing more under the
      // pointer. While someone works or waits there, the frames of that (activity) take over.
      .when(!status, (el) => el.children(neonFrame(`rug-neon-${row.space.id}`, color, R.room, { alpha: parent ? (hot ? "99" : "4d") : hot ? "b3" : "66" })))
      .children(shown.over);
    if (parent || !row.kids?.length) return rug;
    return v_flex().flex_none().gap(this.wide ? 6 : 4).child(rug)
      .child(v_flex().flex_none().gap(this.wide ? 6 : 4).ml(this.wide ? 12 : 8).pl(this.wide ? 10 : 8)
        .border_l(1).border_color(withAlpha(neonColor(color), "59"))
        .children(row.kids.map((kid) => this.rug(kid, roles, colors, trees, t, row))));
  }

  // The groups you made yourself (see groups.js).
  groups() {
    return loadGroups(shared("office.groups"));
  }

  // A group is a band with its name and counts, then the rugs of the spaces in
  // it, exactly as they would be on their own. It holds nothing else: making it,
  // naming it and picking its spaces is yours, not worked out from folders.
  groupBand(part, roles, colors, trees, t) {
    const g = part.band;
    const all = part.rows.flatMap((row) => [row, ...(row.kids ?? [])]);
    const staff = all.flatMap((row) => row.tabs.flatMap((c) => c.desks.filter((d) => d.agent).map((d) => d.agent)));
    const status = urgent(staff);
    const count = staff.filter((a) => a.status === status).length;
    return v_flex()
      .id(`group-${g.id}`)
      .flex_none()
      .gap(this.wide ? 8 : 6)
      // Its band edged in a cyan tube that holds still (the rugs under it breathe).
      .child(h_flex().relative().h(this.wide ? 26 : 22).gap(7).items_center().px(4)
        .bg(withAlpha(this.bk.shade, "99")).rounded(R.card)
        .children(neonFrame(`group-neon-${g.id}`, GROUP_NEON, R.card, { breathe: false, alpha: "66" }))
        .child(div().id(`group-fold-${g.id}`).size(14).flex_none().flex().items_center().justify_center()
          .cursor_pointer().hover((s) => s.opacity(0.7))
          .tooltip(g.folded ? "Show its spaces" : "Fold its spaces away")
          .on_click((_e, cx) => this.foldGroup(g.id, cx))
          .child(svg(`mods/office-chrome/chevron-${g.folded ? "right" : "down"}.svg`).size(10).flex_none().text_color(t.muted)))
        .child(div().min_w(0).truncate().text_size(this.wide ? 13 : 11.5).font_semibold().text_color(t.foreground).child(g.name))
        .child(div().flex_none().px(6).rounded(R.control).bg(withAlpha(t.muted, "33")).text_size(9.5).text_color(t.foreground)
          .child(roomCount(part.rows.length, all.length - part.rows.length)))
        .child(div().flex_1().min_w(0))
        .when(status === "blocked", (el) => el.child(div().flex_none().px(5).rounded(R.tag).bg(TAG).text_size(10).font_bold()
          .text_color("#ffffff").child(`! ${count} need${count === 1 ? "s" : ""} you`)))
        .when(status === "working", (el) => el.child(div().flex_none().text_size(10).text_color(mixHex(t.working, "#ffffff", 0.3))
          .child(`\u25cf ${count} working`)))
        .child(this.button(`group-edit-${g.id}`, "\u270e", "Rename this group, or change its spaces", t, () => openGroupDialog(g.id)))
        .child(this.button(`group-drop-${g.id}`, "\u00d7", "Delete the group (the spaces stay)", t, () => this.dropGroup(g.id))))
      .when(!g.folded, (el) => el.child(v_flex().flex_none().gap(this.wide ? 10 : 8).pl(this.wide ? 12 : 8)
        .border_l(1).border_color(withAlpha(t.muted, "2e"))
        .children(part.rows.map((row) => this.rug(row, roles, colors, trees, t)))));
  }

  foldGroup(id, cx) {
    saveGroups(this.groups().map((g) => (g.id === id ? { ...g, folded: !g.folded } : g)), setShared);
    cx.notify();
  }

  dropGroup(id) {
    saveGroups(this.groups().filter((g) => g.id !== id), setShared);
  }

  // The sidebar's list: one row per agent — its face, name and role, its status
  // and for how long, then the space and tab it sits in. Spaces in a group are
  // banded under its name (folded, its rows go too); the rest follow as they come.
  list(deck, roles, all, t) {
    const now = (this.now = Date.now());
    const n = tally(all);
    const row = ({ space }, { agent: a, tab, pane }) => {
      const job = roles.get(a.address);
      const src = portraitPath(job);
      const state = deskState(a, tab, now);
      const tone = state?.status === "working" ? mixHex(t.working, "#ffffff", 0.3) : t[state?.status] ?? t.dim;
      return h_flex().id(`agent-${a.address}`).flex_none().h(30).px(6).gap(6).items_center().rounded(R.card)
        .cursor_pointer().hover((s) => s.bg(t.hover))
        .when(this.hot === space.id, (el) => el.bg(withAlpha(t.accent, "22")))
        .on_hover((hov) => hoverSpace(space.id, hov))
        .tooltip(`${deskTip({ agent: a, pane, space, tab })}\nClick: go to its terminal · Right-click: menu · Middle-click: peek`)
        .on_click(() => reach(a, space, tab, pane, a.address))
        .on_mouse_down("right", (_e, cx) => {
          cx.stop_propagation();
          this.menu("pane", { ...(pane ? { pane: pane.pane } : {}), terminal: a.address });
        })
        .on_mouse_down("middle", (_e, cx) => {
          cx.stop_propagation();
          run("terminal.peek", { terminal: a.address });
        })
        .child(div().relative().size(22).flex_none().rounded(R.control).overflow_hidden().border(1).border_color(t[state?.status] ?? t.dim).bg(t.raised)
          .when(Boolean(src), (el) => el.child(lively(image(src).absolute().top(0).left(0).size(20), `agent-face-${a.address}`, state?.status))))
        .child(v_flex().flex_1().min_w(0).gap(0)
          .child(div().min_w(0).truncate().text_size(11.5).text_color(t.foreground).child(deskLabel({ agent: a }) || "Agent"))
          .child(div().min_w(0).truncate().text_size(10).text_color(t.dim)
            .child(`${space.name} › ${tab.name}`)))
        .child(state?.status === "blocked"
          ? div().flex_none().px(5).rounded(R.tag).bg(TAG).text_size(9.5).font_bold().text_color("#fff0e6").child("NEEDS YOU")
          : div().flex_none().text_size(10).text_color(tone).child(state ? state.text : "Terminal"));
    };
    const band = (part) => {
      const staff = part.rows.flatMap((r) => r.staff.map((d) => d.agent));
      const status = urgent(staff);
      const count = staff.filter((a) => a.status === status).length;
      return v_flex().flex_none().gap(1)
      .child(h_flex().id(`agent-group-${part.band.id}`).relative().h(22).px(6).gap(6).items_center().rounded(R.card)
        .bg(withAlpha(this.bk.shade, "99"))
        .children(neonFrame(`agent-group-neon-${part.band.id}`, GROUP_NEON, R.card, { breathe: false, alpha: "59" }))
        .child(div().size(12).flex_none().flex().items_center().justify_center().cursor_pointer()
          .hover((s) => s.opacity(0.7))
          .tooltip(part.band.folded ? "Show its agents" : "Fold its agents away")
          .on_click((_e, cx) => this.foldGroup(part.band.id, cx))
          .child(svg(`mods/office-chrome/chevron-${part.band.folded ? "right" : "down"}.svg`).size(9).flex_none().text_color(t.dim)))
        .child(div().min_w(0).truncate().text_size(10.5).font_semibold().text_color(t.foreground).child(part.band.name))
        .child(div().flex_1())
        .when(status === "blocked", (el) => el.child(div().flex_none().px(5).rounded(R.tag).bg(TAG).text_size(9.5).font_bold()
          .text_color("#ffffff").child(`! ${count}`)))
        .when(status === "working", (el) => el.child(div().flex_none().text_size(10).text_color(mixHex(t.working, "#ffffff", 0.3))
          .child(`\u25cf ${count}`)))
        .child(div().flex_none().text_size(10).text_color(t.dim).child(String(staff.length))))
      .when(!part.band.folded, (el) => el.child(v_flex().flex_none().pl(10)
        .children(part.rows.flatMap((r) => r.staff.map((d) => row(r, d))))));
    };
    return v_flex().id("office-agent-list").size_full().min_h(0).text_size(11.5)
      .child(h_flex().h(28).flex_none().pl(16).pr(12).gap(6).items_center().bg(t.chrome).text_size(11.5).text_color(t.dim)
        .child(div().flex_none().font_semibold().text_color(t.foreground).child("Office Agent"))
        .child(div().flex_1())
        .when(n.blocked > 0, (el) => el.child(div().flex_none().text_color(t.blocked).child(`${n.blocked} need${n.blocked === 1 ? "s" : ""} you ·`)))
        .child(div().flex_none().text_size(10.5).child(`${n.working}/${all.length} at work · ${this.time}`)))
      .child(this.wall())
      .child(v_flex().id("office-agent-rows").flex_1().min_h(0).px(8).pt(4).pb(14).gap(1).bg(withAlpha(t.canvas, "d9")).overflow_y_scrollbar()
        .children(deck.flatMap((part) => (part.band ? [band(part)] : part.rows.flatMap((r) => r.staff.map((d) => row(r, d))))))
        .when(!deck.length, (el) => el.child(div().p(8).text_size(11.5).text_color(t.dim).child("Nobody in yet. Open a space to start."))));
  }

  // A rail too narrow for the list: one face per agent, framed in its status colour.
  rail(plan, roles, t) {
    const seated = plan.flatMap((row) => row.tabs.flatMap((c) => c.desks.filter((d) => d.agent).map((d) => d.agent)));
    return v_flex().id("office-rail").size_full().min_h(0).items_center().gap(4).py(6).overflow_y_scrollbar()
      .children(seated.map((a) => {
        const src = portraitPath(roles.get(a.address));
        return div().id(`face-${a.address}`).size(30).flex_none().rounded(R.card).overflow_hidden().border(2).border_color(t[a.status] ?? t.dim)
          .cursor_pointer().tooltip(deskLabel({ agent: a }))
          .on_click(() => reach(a, null, null, null, a.address))
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

  // Herdr's menu for a pane, a tab or a space, on an office card (office-menu).
  menu(tab, target) {
    openOverlay({ mod: "office-menu", kind: "popup", frame: "none", width: 230, height: 260, props: { tab, target, frameless: true } });
  }

  // The office-add popup: a new tab or desk, with a shell or an agent.
  add(spec) {
    openOverlay({ mod: "office-add", kind: "popup", frame: "none", width: 250, height: 380, props: spec });
  }

  // A held desk becomes a drag once the pointer moves over another desk or an
  // Add desk (each listens itself, as Spaces' rows do), not on a twitch.
  dragOver(key, cx) {
    if (!this.drag || this.drag.moved || this.drag.terminal === key) return;
    this.drag.moved = true;
    cx.notify();
  }

  // A dragged desk dropped on another tab's Add desk. While it moves its
  // terminal is shared as office.moving, so the sidebar's seating leaves a
  // parked hire alone.
  moveDesk(from, to, cx) {
    if (!from || this.moving) return;
    this.moving = true;
    setShared("office.moving", from.terminal);
    this.flash(`Moving ${from.name} to ${to.where}…`, "muted", cx, "moveNote");
    cx.spawn(async (cx) => {
      try {
        await moveTerminal(from, to);
        this.flash(`${from.name} moved to ${to.where}`, "done", cx, "moveNote");
      } catch (e) {
        this.flash(firstLine(String(e?.message ?? e)) || "Couldn't move the desk", "blocked", cx, "moveNote");
      }
      this.moving = false;
      setShared("office.moving", null);
      cx.notify();
    });
  }

  button(id, label, tip, t, action) {
    return div().id(id).h(20).px(7).flex().flex_none().items_center().rounded(R.control).text_size(10.5).text_color(t.muted)
      .border(1).border_color(withAlpha(t.muted, "55")).bg(withAlpha(this.bk.shade, "99"))
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(tip).on_click(action).child(label);
  }

  // Tabs put away (tab.settle) stay off the floor; wide, they wait here and a
  // click brings one back. Not a room's lobby (lobby.js): that is no tab of yours.
  storage(sp, ps, t) {
    const lobbies = lobbyTabs(ps);
    const away = sp.flatMap((s) => (s.tabs ?? []).filter((tab) => tab.settled && tab.status !== "blocked" && !lobbies.has(tab.id)).map((tab) => ({ s, tab })));
    if (!away.length) return null;
    return v_flex().flex_none().gap(5).p(8).rounded(R.room).bg(withAlpha(this.bk.shade, "70")).border(1).border_color(withAlpha(t.muted, "33"))
      .child(div().text_size(10.5).text_color(t.dim).child(`Put away · ${away.length}`))
      .child(h_flex().flex_wrap().gap(5).children(away.map(({ s, tab }) => div().id(`away-${tab.id}`).h(20).px(7).flex().items_center().rounded(R.control)
        .text_size(11).text_color(t.muted).bg(t.raised).cursor_pointer().hover((st) => st.bg(t.hover).text_color(t.foreground))
        .tooltip("Bring it back")
        .on_click(() => { if (!s.active) run("space.select", { id: s.id }); run("tab.select", { id: tab.id }); })
        .child(`${s.name} › ${tab.name}`))));
  }

  // ---- the inspector (wide only) ----

  // A desk picked: the inspector shows them and their terminal opens in the
  // desk window.
  pick(terminal, cx) {
    if (this.selected !== terminal) {
      this.selected = terminal;
      localStorage.setItem("office.selected", terminal);
    }
    this.openDesk(terminal);
    cx.notify();
  }

  // Their real terminal in a window over everything: the header (this mod with
  // props { desk }) over a terminal block Herdr draws like any pane. One window:
  // picking someone else replaces it in place, where you last dropped it.
  openDesk(terminal) {
    this.deskWindow = openOverlay({
      kind: "window",
      key: DESK_WINDOW,
      width: 760,
      height: 540,
      layout: {
        id: "office-desk",
        type: "column",
        children: [
          { id: "office-desk-head", type: "block", content: { mod: "office-agents", props: { desk: terminal, job: this.roles?.get(terminal) ?? null } }, size: { px: DESK_HEAD_H } },
          { id: "office-desk-terminal", type: "block", content: { terminal }, size: { weight: 1 } },
        ],
      },
    });
  }

  closeDesk() {
    if (this.deskWindow) closeOverlay(this.deskWindow);
    this.deskWindow = null;
  }

  // The panel shows the office (the stack's "office" child, the panel open).
  shown() {
    const root = layout();
    const panel = find(root, "panel");
    return Boolean(panel && !panel.hidden && find(root, "panel-body")?.active === "office");
  }

  // The picked terminal: its agent (if it is one), pane, space and tab; null
  // when it is gone.
  target() {
    const key = this.selected;
    if (!key) return null;
    const agent = agents().find((a) => a.address === key) ?? this.standIns?.get(key) ?? null;
    const ps = panes();
    const pane = (agent ? ps.find((p) => p.pane === agent.pane) : ps.find((p) => p.terminal === key)) ?? null;
    if (!agent && !pane) return null;
    const tabId = agent?.tab ?? pane?.tab;
    const space = spaces().find((s) => (s.tabs ?? []).some((c) => c.id === tabId)) ?? null;
    const tab = space?.tabs?.find((c) => c.id === tabId) ?? null;
    return { key, agent, pane, space, tab };
  }

  // While the panel shows the office: the questions of those waiting for you and
  // what the boss says, read from their screens.
  poll(cx) {
    if (!this.wide || !this.shown()) return;
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
    // The whiteboard's pieces done in a worktree: their diff, one a tick.
    const board = this.boardNow;
    if (board && !this.probing) {
      const now = Date.now();
      const due = board.notes.find((n) => n.wt && (n.state === "done" || n.state === "ok")
        && (this.diffs.get(n.hire.address)?.cwd !== n.hire.cwd || now - this.diffs.get(n.hire.address).at > DIFF_EVERY));
      if (due) this.probe(due, board.machine, cx);
    }
  }

  // A worktree's branch and diff against the repo's own checkout (WORKTREE_PROBE).
  probe(n, machine, cx) {
    this.probing = true;
    const { address, cwd } = n.hire;
    cx.spawn(async (cx) => {
      const r = await exec("sh", ["-c", WORKTREE_PROBE, "sh", n.wt.root, n.wt.path], { timeout: 10000, ...(machine ? { on: machine } : {}) }).catch(() => null);
      const got = r?.code === 0 ? parseProbe(r.stdout) : null;
      this.diffs.set(address, { cwd, at: Date.now(), ...(got ?? { err: true }) });
      this.probing = false;
      cx.notify();
    });
  }

  // Accept on the whiteboard: the boss is told you agree to merge that branch.
  accept(n, cx) {
    this.accepting = null;
    const boss = this.boardNow?.boss;
    const d = this.diffs.get(n.hire.address);
    if (!boss || !d?.branch) return;
    if (this.listNow?.find((a) => a.address === boss)?.status === "blocked") {
      return this.flash("The boss waits for your answer first", "blocked", cx, "bossNote");
    }
    cx.spawn(async (cx) => {
      const r = await hc(["send", boss, "--", acceptMessage({ piece: n.piece, name: n.hire.name || n.hire.address, branch: d.branch, root: n.wt.root })])
        .catch((e) => ({ code: 1, stderr: String(e?.message ?? e) }));
      if (r.code === 0) this.flash(`Sent to the boss: merge ${d.branch}`, "done", cx, "bossNote");
      else this.flash(firstLine(r.stderr) || firstLine(r.stdout) || "Couldn't reach the boss", "blocked", cx, "bossNote");
      cx.notify();
    });
  }

  // Sidebar, every tick, after hours: who finished or started waiting for you.
  watchNight() {
    const list = agents();
    const before = this.seen;
    this.seen = new Map(list.map((a) => [a.address, a.status]));
    if (!before || !nightNow()) return;
    const terms = terminals() ?? [];
    const names = new Map(list.map((a) => [a.address, terms.find((x) => x?.address === a.address)?.name || deskLabel({ agent: a })]));
    const events = nightEvents(before, list, names, Date.now());
    if (!events.length) return;
    const log = [...(shared(NIGHT_LOG) ?? []), ...events].slice(-60);
    setShared(NIGHT_LOG, log);
    localStorage.setItem(NIGHT_LOG, JSON.stringify(log));
  }

  clearNight() {
    setShared(NIGHT_LOG, []);
    localStorage.setItem(NIGHT_LOG, "[]");
  }

  toggleAfterHours() {
    const on = !afterHoursOn();
    setShared(AFTER_HOURS, on);
    localStorage.setItem(AFTER_HOURS, on ? "on" : "off");
  }

  // In the day, after a night with news: what finished and who waited for you.
  morning(t) {
    const log = shared(NIGHT_LOG);
    if (this.night || !Array.isArray(log) || !log.length) return null;
    const s = morningSummary(log);
    if (!s.done.length && !s.blocked.length) return null;
    const few = (names) => `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3}` : ""}`;
    const parts = [
      s.done.length ? `✓ ${s.done.length} finished: ${few(s.done)}` : "",
      s.blocked.length ? `! ${s.blocked.length} waited for you: ${few(s.blocked)}` : "",
    ].filter(Boolean);
    const tip = [s.done.length ? `Finished: ${s.done.join(", ")}` : "", s.blocked.length ? `Waited for you: ${s.blocked.join(", ")}` : ""].filter(Boolean).join("\n");
    return h_flex().id("office-morning").flex_none().h(30).pl(10).pr(8).gap(8).items_center().bg(t.raised).border_b(1).border_color(t.border)
      .child(div().w(3).h(16).flex_none().bg(LAMP))
      .child(div().flex_none().text_size(10).font_bold().text_color(LAMP).child("MORNING"))
      .child(div().id("office-morning-text").flex_1().min_w(0).truncate().text_size(11.5).text_color(t.foreground).tooltip(tip)
        .child(`Since ${clockAt(log[0].at)}: ${parts.join(" · ")}`))
      .child(this.small("office-morning-ok", "Got it", "Clear the night's notes", t, (_e, cx) => { this.clearNight(); cx.notify(); }));
  }

  flash(text, tone, cx, slot) {
    const note = { text, tone };
    this[slot] = note;
    cx.timer.after(5000, (cx) => { if (this[slot] === note) { this[slot] = null; cx.notify(); } });
  }

  small(id, label, tip, t, action, tone) {
    return div().id(id).h(22).px(8).flex().flex_none().items_center().rounded(R.control).text_size(11).text_color(tone ?? t.muted)
      .border(1).border_color(withAlpha(t.muted, "55")).bg(this.bk.button)
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(tip).on_click(action).child(div().min_w(0).truncate().child(label));
  }

  // The picked staff member, in one bar: who and where, their status, and the
  // ways to their terminal (the desk window, their desk, a peek over the tab).
  inspector(roles, t) {
    const target = this.target();
    const frame = h_flex().id("office-inspector").h(INSPECT_H).flex_none().px(12).gap(10).items_center()
      .bg(this.bk.panel).border_t(2).border_color(t.accent);
    if (!target) {
      return frame.child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim)
        .child("Click a desk: their terminal opens in a window. Double-click goes to it."));
    }
    const { key, agent: a, pane, space, tab } = target;
    const job = a ? roles.get(a.address) : null;
    const src = portraitPath(job);
    const state = deskState(a, tab, this.now);
    const who = a ? deskLabel({ agent: a }) || "Agent" : "";
    const program = a?.program?.name ?? "Agent";
    const title = a ? (who.toLowerCase() === program.toLowerCase() ? who : `${who} · ${program}`) : deskLabel({ pane });
    const place = [`${space?.name ?? ""} › ${tab?.name ?? ""}`, shortPath(pane?.cwd), pane?.branch].filter(Boolean).join(" · ");
    const tone = { working: mixHex(t.working, "#ffffff", 0.3), blocked: t.blocked, done: t.done }[state?.status] ?? t.dim;
    const go = () => {
      this.closeDesk();
      reach(a, space, tab, pane, key);
    };
    return frame
      .child(div().size(36).flex_none().rounded(R.card).overflow_hidden().border(1).border_color(state ? t[state.status] ?? t.dim : t.dim).bg(t.raised)
        .when(Boolean(src), (el) => el.child(image(src).size(34))))
      .child(v_flex().flex_1().min_w(0).gap(1)
        .child(h_flex().gap(6).items_center()
          .child(div().min_w(0).truncate().text_size(12.5).font_semibold().text_color(t.foreground).child(title))
          .child(div().flex_none().text_size(11).text_color(tone).child(state ? state.text : "Terminal")))
        .child(div().truncate().text_size(10.5).text_color(t.dim).child(place)))
      .child(this.small("inspect-open", "Terminal ↗", "Their terminal in a window", t, () => this.openDesk(key)))
      .child(this.small("inspect-go", "Go to desk", "Their terminal, in its space and tab", t, go))
      .child(this.small("inspect-peek", "Peek", "Look over the tab without leaving it", t, () => run("terminal.peek", { terminal: key })));
  }

  setFilter(filter, cx) {
    this.filter = filter;
    localStorage.setItem("office.filter", filter);
    cx.notify();
  }

  // The sidebar's back wall, over the list: what the sidebar's width shows of it.
  wall() {
    return div().h(44).flex_none().overflow_hidden().child(sidebarWall("wall", 300, 44, this.sideW));
  }

  // The wide header: the filters with their counts, the time.
  header(n, total, t) {
    return h_flex().h(34).flex_none().pl(14).pr(10).gap(5).items_center().bg(t.chrome).overflow_hidden()
      .child(div().flex_none().pr(6).text_size(12.5).font_semibold().text_color(t.foreground).child("Office"))
      .children(FILTERS.map(([key, label]) => {
        const on = this.filter === key;
        const hue = key === "all" ? t.accent : t[key] ?? t.dim;
        return h_flex().id(`filter-${key}`).h(22).px(9).gap(5).flex_none().items_center().text_size(11).rounded(R.control)
          .border(1).border_color(on ? hue : withAlpha(t.border, "33")).text_color(on ? t.foreground : t.muted)
          .when(on, (el) => el.bg(withAlpha(hue, "26")))
          .cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => this.setFilter(key, cx))
          .when(key !== "all", (el) => el.child(div().size(6).flex_none().rounded(3).bg(t[key] ?? t.dim)))
          .child(label)
          .child(div().text_color(key === "blocked" && n.blocked ? t.blocked : t.dim).child(String(key === "all" ? total : n[key])));
      }))
      .child(div().flex_1())
      .child(this.button("office-night", this.night ? "☾" : afterHoursOn() ? "☼" : "☾ off",
        `After hours ${hh(this.hours.from)}–${hh(this.hours.to)}: ${afterHoursOn() ? "on" : "off"}. At night idle desks dim, desks at work keep a lamp on, and in the morning a memo says what happened.\nClick to turn it ${afterHoursOn() ? "off" : "on"}`,
        t, (_e, cx) => { this.toggleAfterHours(); cx.notify(); }))
      .child(this.button("office-new-group", "▤", "New group of spaces", t,
        () => openGroupDialog("@new")))
      .child(div().flex_none().pl(4).text_size(11).text_color(t.dim).child(this.time));
  }

  // ---- the boss ----

  // Every space's boss: { space id: terminal address }, as the sidebar found them.
  bosses() {
    const map = shared("office.bosses");
    return map && typeof map === "object" && !Array.isArray(map) ? map : {};
  }

  // Every copy (sidebar or panel, whichever the layout shows) works out each
  // space's boss (findBosses) and shares it when it changes. A boss found by its
  // tab is labelled office.role=boss once, so it stays found without a pane.
  shareBosses(found, terms, cx) {
    const now = this.bosses();
    if (JSON.stringify(found) !== JSON.stringify(now)) setShared("office.bosses", found);
    for (const [space, addr] of Object.entries(found)) {
      const term = terms.find((t) => t?.address === addr);
      if (this.marked.has(addr) || labelOf(term, "office.role") === "boss") continue;
      this.marked.add(addr);
      // A boss hired here gets the goal it was hired with, so the band says what
      // it is on before it has said anything itself.
      const first = this.goals[space]?.[0] ?? "";
      cx.spawn(async () => {
        await hc(["label", addr, "office.role=boss", `office.space=${space}`, ...(first ? [`office.goal=${oneLine(first)}`] : [])]).catch(() => null);
      });
    }
    // A boss that is gone takes its board's mark with it.
    for (const addr of Object.keys(this.boards ?? {})) if (!Object.values(found).includes(addr)) this.markPlan(addr, null);
  }

  // Each boss's tab and hires, and where every hire sits: in the boss's tab.
  team(sp, ps, list, terms) {
    const staff = new Map(); // hire -> { space, tab, boss }
    const bosses = new Map(); // boss -> { space, tab, staff }
    for (const [spaceId, boss] of Object.entries(this.bosses())) {
      const space = sp.find((s) => s.id === spaceId);
      if (!space) continue;
      const hires = staffOf(terms, boss);
      // A boss sent back without a pane still leads from its space's tab: the one
      // it has, or its last hire's (a renamed Boss tab keeps its team), or the
      // Boss tab.
      const tab = bossTabOf(space,
        ps.find((p) => p.terminal === boss)?.tab ?? list.find((a) => a.address === boss)?.tab,
        hires.map((h) => (ps.find((p) => p.terminal === h) ?? list.find((a) => a.address === h))?.tab));
      if (!tab) continue;
      bosses.set(boss, { space, tab, staff: hires });
      for (const hire of hires) staff.set(hire, { space, tab, boss });
    }
    const byAddress = new Map(terms.filter((t) => typeof t?.address === "string").map((t) => [t.address, t]));
    const names = new Map([...byAddress].map(([address, t]) => [address, t.name]));
    // What the bosses say and what their hires do, as they label themselves.
    const say = new Map([...bosses.keys()].map((boss) => [boss, labelOf(byAddress.get(boss), "office.say")]));
    const stages = new Map([...bosses.keys()].map((boss) => [boss, labelOf(byAddress.get(boss), "office.stage")]));
    const goals = new Map([...bosses.keys()].map((boss) => [boss, goalOf(byAddress.get(boss))]));
    const tasks = new Map([...staff.keys()].map((hire) => [hire, labelOf(byAddress.get(hire), "office.task")]));
    // The whiteboard: each boss's plan, and the piece and folder of each hire.
    const plans = new Map([...bosses.keys()].map((boss) => [boss, labelOf(byAddress.get(boss), "office.plan", 400)]));
    const pieces = new Map([...staff.keys()].map((hire) => [hire, labelOf(byAddress.get(hire), "office.piece")]));
    const cwds = new Map([...staff.keys()].map((hire) => [hire, byAddress.get(hire)?.cwd ?? ""]));
    return { staff, bosses, names, say, stages, goals, tasks, plans, pieces, cwds };
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
    const terms = terminals() ?? [];
    const seated = new Set(ps.map((p) => p.terminal).filter(Boolean));
    const moving = shared("office.moving");
    if (moving) seated.add(moving); // the panel is moving it to another tab
    const now = Date.now();
    // An agent Herdr knows, or a hire it gets no status from (pi, agy).
    const hire = staffOf(terms, boss).find((addr) => (live.has(addr) || isHire(terms.find((x) => x.address === addr)))
      && !seated.has(addr) && now - (this.tried.get(addr) ?? 0) > 10000);
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
  // Worked out afresh rather than read from what was last shared, so a goal never
  // goes to a boss that is gone and never hires a second one.
  assign(cx) {
    const goal = (this.bossInput?.value() ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
    if (!goal || this.bossBusy) return;
    const sp = spaces();
    const ps = panes();
    const list = agents();
    const room = this.room(sp);
    if (!room) return this.flash("Open a space first", "blocked", cx, "bossNote");
    const boss = findBosses({ spaces: sp, panes: ps, terminals: terminals() ?? [], agents: list, prev: this.bosses() })[room.id];
    if (boss) {
      if (list.find((a) => a.address === boss)?.status === "blocked") {
        return this.flash("The boss waits for your answer first", "blocked", cx, "bossNote");
      }
      // The plan it had is marked as the old goal's once this goal is in, so its
      // notes never read as this goal's work; a new plan replaces it (planAge).
      const term = (terminals() ?? []).find((t) => t?.address === boss);
      const was = labelOf(term, "office.plan", 400);
      this.bossBusy = true;
      cx.spawn(async (cx) => {
        try {
          const r = await hc(["send", boss, "--", goal]);
          if (r.code === 0) {
            this.bossInput.set_value("");
            this.rememberGoal(room.id, goal);
            this.markPlan(boss, was ? { plan: was, goal: goalOf(term) } : null);
            this.flash("Sent to the boss", "done", cx, "bossNote");
            // A goal from here starts the flow over: Plan, until the boss says otherwise.
            await hc(["label", boss, "office.stage=plan", `office.goal=${oneLine(goal)}`]).catch(() => null);
          }
          else this.flash(firstLine(r.stderr) || firstLine(r.stdout) || "Couldn't reach the boss", "blocked", cx, "bossNote");
        } catch (e) {
          this.flash(firstLine(String(e?.message ?? e)) || "Couldn't reach the boss", "blocked", cx, "bossNote");
        }
        this.bossBusy = false;
        cx.notify();
      });
      return;
    }
    // A Boss tab with no boss found in it is one still starting, or one whose
    // agent is gone: hiring now would make a second.
    if ((room.tabs ?? []).some(isBossTab)) {
      return this.flash("The Boss tab has no boss running yet: wait, or close it to hire again", "blocked", cx, "bossNote");
    }
    const known = this.known[room.machine ?? ""];
    if (!known) return this.flash("Looking for agents…", "muted", cx, "bossNote");
    const pick = this.bossAgent(known);
    if (!pick) return this.flash("No agent installed to be the boss", "blocked", cx, "bossNote");
    const folder = spaceFolder(room, ps);
    this.bossBusy = true;
    this.flash(`Hiring a boss (${pick.name})…`, "done", cx, "bossNote");
    cx.spawn(async (cx) => {
      const playbook = await this.playbookFor(room.machine ?? null);
      const hire = await this.fileFor(room.machine ?? null, HIRE, REMOTE_HIRE);
      const hires = known.map((k) => k.run);
      const templates = await this.templatesFor(room.machine ?? null, [pick.run, ...hires]);
      // The goal stays in the box until the tab is open.
      try {
        run("tab.new", { space: room.id, name: "Boss", argv: underHc(pick.run), task: bossBrief({ goal, playbook, argv: pick.run, hires, templates, folder, space: room.name, hire, most: STAFF_CAP }) });
        this.bossInput.set_value("");
        this.rememberGoal(room.id, goal);
      } catch (e) {
        this.flash(firstLine(String(e?.message ?? e)) || "Couldn't open the Boss tab", "blocked", cx, "bossNote");
      }
      this.bossBusy = false;
      cx.notify();
    });
    cx.notify();
  }

  // Where the boss reads its playbook: boss.md here; on another machine, a copy
  // written to REMOTE_PLAYBOOK there (the text goes as an argument, never
  // through the shell's parsing). null when there is none: the brief then
  // carries the rules that matter most on its own.
  playbookFor(machine) {
    return this.fileFor(machine, PLAYBOOK, REMOTE_PLAYBOOK);
  }

  // A file of ours the boss uses (`local`), as a path on its machine: a copy at
  // `remote` (under that machine's home) when it is another one; null when
  // there is none.
  async fileFor(machine, local, remote) {
    const text = await readTextFile(local).catch(() => null);
    if (typeof text !== "string" || !text.trim()) return null;
    if (!machine) return local;
    try {
      const r = await exec("sh", ["-c", 'f="$HOME/$1"; mkdir -p "$(dirname "$f")" && printf "%s" "$2" > "$f" && printf "%s" "$f"', "sh", remote, text], { on: machine });
      return r.code === 0 && r.stdout.trim() ? r.stdout.trim() : null;
    } catch {
      return null;
    }
  }

  // The hire templates (hireTemplate) written to herdr-core's templates folder
  // on the boss's machine, only our own office-*.md files, rewritten each hire
  // so they follow the flags. -> { [hireCommand]: template name }, {} when they
  // can't be written (the brief then names the commands).
  async templatesFor(machine, argvs) {
    const made = new Map();
    for (const argv of argvs) {
      const t = hireTemplate(argv);
      if (t && ![...made.values()].some((m) => m.name === t.name)) made.set(hireCommand(argv), t);
    }
    if (!made.size) return {};
    const files = [...made.values()].flatMap((t) => [t.name, t.text]);
    try {
      const r = await exec("sh", ["-c", 'd="$HOME/.config/herdr-core/templates"; mkdir -p "$d" || exit 1; while [ $# -ge 2 ]; do printf "%s" "$2" > "$d/$1.md" || exit 1; shift 2; done', "sh", ...files], machine ? { on: machine } : undefined);
      return r.code === 0 ? Object.fromEntries([...made].map(([cmd, t]) => [cmd, t.name])) : {};
    } catch {
      return {};
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

  foldBand(folded) {
    this.bandFolded = folded;
    localStorage.setItem("office.bossBand", folded ? "folded" : "open");
  }

  // The goals given in a space, newest first: the last one stands in the box
  // until the next, so it is still there after the text was cleared.
  rememberGoal(spaceId, goal) {
    const text = String(goal ?? "").trim();
    if (!spaceId || !text) return;
    this.goals = { ...this.goals, [spaceId]: [text, ...(this.goals[spaceId] ?? []).filter((g) => g !== text)].slice(0, GOALS_KEPT) };
    localStorage.setItem(GOALS, JSON.stringify(this.goals));
  }

  // The whiteboard a new goal left behind, per boss: { plan, goal }. The office's
  // own bookkeeping, never a label the boss has to keep; null drops it.
  markPlan(boss, mark) {
    if (!boss) return;
    const boards = { ...this.boards };
    if (mark) boards[boss] = mark;
    else delete boards[boss];
    this.boards = boards;
    localStorage.setItem(BOARDS, JSON.stringify(boards));
  }

  // Stop what is typing (hc interrupt each), so a team told the wrong thing
  // stops instead of finishing it. A boss waiting for your answer is not in the
  // list: its turn is yours to answer, not to drop.
  stop(addrs, cx) {
    const who = (addrs ?? []).filter(Boolean);
    if (!who.length || this.stopping) return;
    this.stopping = true;
    cx.spawn(async (cx) => {
      const bad = [];
      for (const one of who) {
        const r = await hc(["interrupt", one, "--json"]).catch((e) => ({ code: 1, stderr: String(e?.message ?? e) }));
        if (r.code !== 0) bad.push(one);
      }
      this.flash(bad.length ? `Couldn't stop ${bad.join(", ")}` : `Stopped ${who.length} terminal${who.length === 1 ? "" : "s"}`, bad.length ? "blocked" : "done", cx, "bossNote");
      this.stopping = false;
      cx.notify();
    });
  }

  // The orchestrator a new boss runs: the one you picked, else Claude Code, else
  // the first agent installed.
  bossAgent(known) {
    if (!Array.isArray(known)) return null;
    return known.find((k) => k.key === this.bossPick) ?? known.find((k) => k.key === DEFAULT_BOSS) ?? known[0] ?? null;
  }

  // A space's boss and where it is in its flow; null with no boss there.
  bossFlow(spaceId) {
    const addr = this.bosses()[spaceId];
    if (!addr || !this.teamNow) return null;
    const list = this.listNow ?? [];
    const hires = this.teamNow.bosses.get(addr)?.staff ?? [];
    return bossStage(list.find((a) => a.address === addr) ?? null, list.filter((a) => hires.includes(a.address)), this.teamNow.stages?.get(addr));
  }

  // The flow as four steps on a dark strip, in neon like the wall's signs:
  // steps behind ticked in green, the one it is on lit in a tube (red while
  // someone waits for you, amber while at it, pale when quiet; breathing while
  // live), the rest off.
  flowNotes(id, f, t) {
    const labels = [
      "Plan",
      f.hired ? `Hired ${f.hired} agent${f.hired === 1 ? "" : "s"}${f.busy ? ` · ${f.busy} at work` : ""}` : "Hire ≤4",
      "Review",
      "Report",
    ];
    const finished = !f.live && f.stage === "report";
    return h_flex().id(`flow-${id}`).flex_none().h(22).px(3).gap(3).items_center().rounded(R.control).bg(withAlpha(BOARD, "e6"))
      .children(labels.map((text, i) => {
        const past = i < f.step || (finished && i === f.step);
        const now = i === f.step && !finished;
        const tube = f.blocked ? t.blocked : f.live ? t.accent : NIGHT_TEXT;
        return div().id(`flow-${id}-${i}`).relative().h(16).px(6).flex().flex_none().items_center().gap(3).rounded(R.tag)
          .text_size(10).font_semibold().text_color(now ? neonColor(tube) : past ? neonColor(DONE_NEON) : NIGHT_OFF)
          .when(now, (el) => el.bg(withAlpha(neonColor(tube), "1f"))
            .children(neonFrame(`flow-${id}-${i}-neon`, tube, R.tag, { breathe: f.live, alpha: "cc" })))
          .tooltip(FLOW_TIPS[i])
          .child(past ? `✓ ${text}` : now && f.live ? `${text}…` : text);
      }));
  }

  // A dropdown in the boss's office, in neon like the wall's signs: the trigger
  // a lit sign, its tube, its words and a glow on its board in `color` (all
  // brighter and breathing while open), `h` high; open, a dark card in the same
  // tube, `title` a small neon sign on it, one line per option, the picked one
  // lit in the colour and ticked.
  picker(id, t, value, tip, options, onPick, { title, color = GROUP_NEON, maxW = 170, h = 26 }) {
    const open = this.picking === id;
    const lit = neonColor(color);
    const trigger = h_flex().id(`pick-${id}`).relative().h(h).px(9).gap(6).flex_none().max_w(maxW).items_center().rounded(R.control)
      .text_size(11.5).font_semibold().text_color(lit).bg(withAlpha(BOARD, "f2"))
      .cursor_pointer().hover((s) => s.bg(NIGHT_HOVER)).tooltip(tip)
      .child(div().absolute().top(0).left(0).right(0).bottom(0).rounded(R.control).bg(withAlpha(lit, open ? "2e" : "17")))
      .children(neonFrame(`pick-${id}-neon`, color, R.control, { breathe: open, alpha: open ? "ff" : "d9" }))
      .child(h_flex().min_w(0).gap(5).items_center().children(value))
      .child(svg(`mods/office-chrome/chevron-${open ? "right" : "down"}.svg`).size(10).flex_none().text_color(lit));
    const card = v_flex().id(`pick-${id}-card`).relative().w(240).flex_none().pt(8).pb(5).rounded(R.card).bg(BOARD)
      .child(dropShadow(R.card))
      .children(neonFrame(`pick-${id}-card-neon`, color, R.card, { breathe: false, alpha: "b3" }))
      .child(h_flex().flex_none().px(10).pb(6).child(neonSign(`pick-${id}-title`, title, color, 2)))
      .child(v_flex().id(`pick-${id}-list`).max_h(264).px(5).gap(1).overflow_y_scrollbar()
        .children(options.map((o) => h_flex().id(`pick-${id}-${o.key}`).relative().h(28).flex_none().px(10).gap(8).items_center()
          .rounded(R.control).text_size(12).text_color(o.on ? "#ffffff" : NIGHT_TEXT).cursor_pointer()
          .when(o.on, (el) => el.bg(withAlpha(lit, "24")).child(div().absolute().left(0).top(6).bottom(6).w(2).rounded(1).bg(lit)))
          .hover((s) => s.bg(o.on ? withAlpha(lit, "33") : NIGHT_HOVER))
          .on_click((_e, cx) => { this.picking = null; onPick(o.key); cx.notify(); })
          .children(o.label)
          .child(div().w(12).flex_none().text_size(11).font_bold().text_color(lit).child(o.on ? "✓" : "")))));
    return Popover.new(`picker-${id}`).anchor("top_left").open(open)
      .on_open_change((on, cx) => { this.picking = on ? id : null; cx.notify(); })
      .trigger(trigger).content(card);
  }

  // The boss's plan board (the whiteboard), in neon: a dark board under a
  // PLAN sign, its plan (office.plan) a note per piece, each edged and written
  // in the neon of where it is (breathing at work and while it waits for you);
  // a note with a hire picks its desk. A piece done in a
  // worktree shows its diff, and Accept (asked twice) tells the boss to merge it.
  board(t, bossAddr, room, list, team) {
    const hires = (team.bosses.get(bossAddr)?.staff ?? []).map((address) => ({
      address,
      name: team.names.get(address) ?? "",
      piece: team.pieces?.get(address) ?? "",
      task: team.tasks.get(address) ?? "",
      status: list.find((a) => a.address === address)?.status ?? null,
      cwd: team.cwds?.get(address) ?? "",
    }));
    const plan = team.plans?.get(bossAddr) ?? "";
    const notes = planNotes(plan, hires).map((n) => ({ ...n, wt: n.hire ? worktreeOf(n.hire.cwd) : null }));
    this.boardNow = { boss: bossAddr, machine: room.machine ?? null, notes };
    if (!notes.length) return null;
    // A goal sent after this plan was written leaves it behind: it is still on
    // the board, faint, labelled with the goal it was for (planAge).
    const age = planAge({ plan, mark: this.boards[bossAddr] });
    const goal = team.goals?.get(bossAddr) ?? "";
    const passed = notes.filter((n) => n.state === "ok" || n.state === "merged").length;
    const chip = (id, text, color, tip, action) => div().id(id).h(14).px(4).flex().flex_none().items_center().rounded(R.tag)
      .bg(withAlpha(neonColor(color), "26")).border(1).border_color(withAlpha(neonColor(color), "b3"))
      .text_size(9.5).font_bold().text_color(neonColor(color)).cursor_pointer().hover((s) => s.bg(withAlpha(neonColor(color), "40"))).tooltip(tip)
      .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); action(cx); cx.notify(); })
      .child(text);
    const note = (n, i) => {
      const look = NOTE[n.state] ?? NOTE.todo;
      const who = n.hire?.name || "";
      const ready = n.wt && (n.state === "done" || n.state === "ok") ? this.diffs.get(n.hire.address) : null;
      const diff = ready && ready.cwd === n.hire.cwd && !ready.err ? ready : null;
      const can = diff && diff.files > 0 && diff.dirty === 0;
      let foot;
      if (can && this.accepting === n.hire.address) {
        foot = [div().flex_1().min_w(0).truncate().child(`Merge ${diff.branch}?`),
          chip(`wb-${i}-yes`, "✓", DONE_NEON, `Tell the boss to merge ${diff.branch}`, (cx) => this.accept(n, cx)),
          chip(`wb-${i}-no`, "✕", NIGHT_OFF, "Not yet", () => { this.accepting = null; })];
      } else if (diff) {
        foot = [div().flex_none().text_color(neonColor(DONE_NEON)).child(`+${diff.add}`), div().flex_none().text_color(neonColor(STOP_NEON)).child(`−${diff.del}`),
          div().flex_1().min_w(0).truncate().child(diff.dirty ? `${diff.dirty} not committed` : diff.files ? "" : "no changes"),
          ...(can ? [chip(`wb-${i}-accept`, "Accept", GROUP_NEON, `Accept: the boss merges ${diff.branch} (asks once more)`, () => { this.accepting = n.hire.address; })] : [])];
      } else {
        foot = [div().flex_none().child(`${look.mark} ${look.text}`), div().flex_1().min_w(0).truncate().text_color(NIGHT_TEXT).child(who)];
      }
      const tip = [n.piece, `${look.text}${who ? ` · ${who}` : ""}`, n.hire?.task && n.hire.task !== n.piece ? n.hire.task : "",
        diff ? `${diff.branch}: ${diff.files} file${diff.files === 1 ? "" : "s"}, +${diff.add} −${diff.del}${diff.dirty ? `, ${diff.dirty} not committed` : ""}` : "",
        n.hire ? "Click: their desk" : "Nobody on it yet"].filter(Boolean).join("\n");
      const c = { working: t.working, blocked: t.blocked }[n.state] ?? look.neon;
      const lit = neonColor(c);
      return v_flex().id(`wb-${i}`).relative().w(132).h(36).flex_none().px(6).py(3).gap(1).rounded(R.tag).bg(withAlpha(lit, "14"))
        .children(neonFrame(`wb-${i}-neon`, c, R.tag, { breathe: n.state === "working" || n.state === "blocked", alpha: n.state === "todo" || n.state === "merged" ? "66" : "b3" }))
        .when(n.state === "merged", (el) => el.opacity(0.7))
        .tooltip(tip)
        .when(Boolean(n.hire), (el) => el.cursor_pointer().hover((s) => s.bg(withAlpha(lit, "26"))).on_click((_e, cx) => this.pick(n.hire.address, cx)))
        .child(div().min_w(0).truncate().text_size(10.5).font_semibold().text_color("#eef1ff").child(n.piece))
        .child(h_flex().h(14).gap(4).items_center().text_size(9.5).text_color(lit).children(foot));
    };
    const gold = neonColor(NOTE.working.neon);
    return v_flex().id("whiteboard").relative().flex_none().p(5).gap(4).rounded(R.card).bg(withAlpha(BOARD, "f2"))
      .children(neonFrame("whiteboard-neon", GROUP_NEON, R.card, { breathe: false, alpha: "66" }))
      .child(h_flex().gap(6).items_center().text_size(9).font_bold().text_color(NIGHT_TEXT)
        .child(neonSign("whiteboard-sign", "PLAN", GROUP_NEON, 2))
        .when(age.stale, (el) => el.child(div().flex_none().px(4).rounded(R.tag).border(1).border_color(withAlpha(gold, "99")).text_color(gold)
          .tooltip(`Sent after this plan: the boss has not written its new one yet.\nThat plan was for: ${age.previous || "an earlier goal"}`).child("OLD GOAL")))
        .child(div().flex_1().min_w(0).truncate().text_color(NIGHT_TEXT)
          .when(Boolean(goal), (el) => el.tooltip(`The goal the boss works on: ${goal}`).child(`for: ${goal} · `))
          .child(`${passed}/${notes.length} passed review`)))
      .child(h_flex().flex_wrap().gap(4).children(notes.map((n, i) => note(n, i))).when(age.stale, (el) => el.opacity(0.55)));
  }

  // The boss's office: its back wall with its nameplate (where the goal goes)
  // and what it does pinned on it, the boss standing on the left; on the floor
  // what it says, then who leads a new team and the goal itself. Folded: its
  // face and its line. `width`: the panel's, what shows of the room.
  bossBand(t, sp, list, team, width) {
    this.boardNow = null;
    const room = this.room(sp);
    const bosses = this.bosses();
    const bossAddr = room ? bosses[room.id] ?? null : null;
    const boss = bossAddr ? list.find((a) => a.address === bossAddr) ?? null : null;
    const hires = bossAddr ? team.bosses.get(bossAddr)?.staff ?? [] : [];
    const crew = list.filter((a) => hires.includes(a.address));
    const busy = crew.filter((a) => a.status === "working").length;
    // The cap counts hires at work; past it the count turns red.
    const crewText = hires.length ? `team ${hires.length} · ${busy}/${STAFF_CAP} working` : "";
    const over = busy > STAFF_CAP;
    const state = boss?.status ?? "idle";
    // What it says: its office.say label, else its screen's last line.
    const said = (bossAddr && team.say.get(bossAddr)) || (bossAddr && this.bossSay?.key === bossAddr ? this.bossSay.line : "");
    const line = this.bossNote?.text ?? (said || (bossAddr ? (boss ? deskLabel({ agent: boss }) : "Getting ready…") : "No boss here yet · a goal below hires one"));
    const lineColor = this.bossNote ? t[this.bossNote.tone] ?? t.foreground : bossAddr ? t.foreground : t.dim;
    // The goal it was given: the box keeps your last one for this space until you
    // send another, and the label says what it is working on now.
    const goal = bossAddr ? team.goals?.get(bossAddr) ?? "" : "";
    const remembered = this.goals[room?.id ?? ""]?.[0] ?? "";
    // What Stop may stop: a boss at work (not one waiting for your answer), and
    // its hires at work.
    const stoppable = [...(boss?.status === "working" ? [bossAddr] : []), ...crew.filter((a) => a.status === "working").map((a) => a.address)];
    const tip = bossAddr ? "The boss · click for details, double-click for its terminal" : "The boss: give it a goal and it hires the team";
    const onBoss = (e, cx) => {
      if (bossAddr) return e.click_count >= 2 ? run("agent.focus", { terminal: bossAddr }) : this.pick(bossAddr, cx);
      if (this.bandFolded) { this.foldBand(false); cx.notify(); }
      this.bossInput.focus();
    };
    const fold = div().id("boss-fold").size(20).flex().flex_none().items_center().justify_center().rounded(R.control).bg(withAlpha(this.bk.shade, "cc"))
      .text_size(11).text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground))
      .tooltip(this.bandFolded ? "Show the boss" : "Fold the boss away")
      .on_click((_e, cx) => { this.foldBand(!this.bandFolded); cx.notify(); })
      .child(this.bandFolded ? "▾" : "▴");
    // Stop, in the band and when it is folded: whoever is typing, the boss and
    // its hires. Only while there is something to stop.
    const stopButton = stoppable.length ? div().id("boss-stop").relative().h(20).px(6).flex().flex_none().items_center().gap(4).rounded(R.control)
      .text_size(10.5).font_bold().text_color("#ffd9d2").bg(withAlpha(BOARD, "e6"))
      .children(neonFrame("boss-stop-neon", STOP_NEON, R.control, { breathe: false, alpha: "cc" }))
      .cursor_pointer().hover((s) => s.bg("#3a1630"))
      .tooltip(`Stop ${stoppable.length === 1 ? "the one at work" : `${stoppable.length} at work`} (hc interrupt): the boss${stoppable.length > 1 || stoppable[0] !== bossAddr ? " and its hires" : ""}`)
      .on_click((_e, cx) => this.stop(stoppable, cx))
      .child(this.stopping ? "Stopping…" : "■ Stop") : null;
    if (this.bandFolded) {
      return h_flex().id("boss-band").h(BAND_FOLDED_H).flex_none().px(10).gap(8).items_center().bg(this.bk.panel).border_b(1).border_color(this.bk.edge)
        .child(div().id("boss").size(24).flex_none().border(1).border_color(t[state] ?? t.dim).bg(t.raised).cursor_pointer().tooltip(tip).on_click(onBoss)
          .child(image(portraitPath("manager")).size(22)))
        .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(lineColor).child(line))
        .when(Boolean(crewText), (el) => el.child(div().flex_none().text_size(10.5).text_color(over ? t.blocked : t.dim).child(crewText)))
        .when(Boolean(stopButton), (el) => el.child(stopButton))
        .child(fold);
    }
    const known = this.known[room?.machine ?? ""];
    const pick = this.bossAgent(known);
    const colors = shared("space.colors") ?? {};
    const swatch = (s) => div().size(8).flex_none().bg(spaceColor(t, colors, s.id));
    const roomName = (s) => div().min_w(0).truncate().child(s.name);
    // Where the goal goes, on the boss's nameplate: BOSS and its status when the
    // space has one, else only the space. Open, every space, the ones with a boss marked.
    const plate = bossAddr
      ? [div().flex_none().font_bold().text_color(neonColor(NEON)).child("BOSS"), div().size(6).flex_none().rounded(3).bg(t[state] ?? t.dim), roomName(room)]
      : [swatch(room), roomName(room)];
    const rooms = room ? this.picker("room", t, plate, bossAddr ? "The space the goal goes to, and its boss" : "The space the goal goes to: no boss there yet",
      sp.map((s) => ({ key: s.id, on: s.id === room.id,
        label: [swatch(s), div().flex_1().min_w(0).truncate().child(s.name),
          div().flex_none().px(4).rounded(R.tag).text_size(9.5).font_bold()
            .when(Boolean(bosses[s.id]), (el) => el.border(1).border_color(withAlpha(neonColor(NEON), "99")).text_color(neonColor(NEON)))
            .when(!bosses[s.id], (el) => el.text_color(NIGHT_OFF)).child(bosses[s.id] ? "BOSS" : "no boss")] })),
      (id) => { this.bossRoom = id; localStorage.setItem("office.bossRoom", id); }, { title: "SPACES", color: spaceColor(t, colors, room.id), maxW: 240 }) : null;
    // Who leads a new team: only while the space has no boss.
    const agentsPick = bossAddr ? null
      : known === undefined ? div().flex_none().text_size(10.5).text_color(t.dim).child("Looking for agents…")
      : !known.length ? div().flex_none().text_size(10.5).text_color(t.blocked).child("No agent installed")
      : this.picker("agent", t, [programIcon(pick, t, 13), div().min_w(0).truncate().child(pick.name)], "The agent that leads the team (the orchestrator)",
        known.map((k) => ({ key: k.key, on: k.key === pick.key,
          label: [programIcon(k, t, 14), div().flex_1().min_w(0).truncate().child(k.name),
            ...(k.key === DEFAULT_BOSS ? [div().flex_none().text_size(10).text_color(t.dim).child("default")] : [])] })),
        (key) => { this.bossPick = key; localStorage.setItem("office.bossAgent", key); }, { title: "ORCHESTRATOR", color: NEON, h: 28 });
    const flow = bossAddr ? this.bossFlow(room.id) : null;
    const board = bossAddr ? this.board(t, bossAddr, room, list, team) : null;
    const left = 88;
    return div().id("boss-band").relative().min_h(BAND_H).flex_none().overflow_hidden().bg(BOSS_FLOOR).border_b(1).border_color(this.bk.edge)
      .child(div().absolute().top(0).left(0).w(900).h(BAND_H).child(bossOffice("boss-room", 900, BAND_H, WALL_H, width)))
      .child(div().absolute().top(12).right(10).child(fold))
      .child(div().id("boss").absolute().left(12).top(BAND_H - 98).w(64).h(88).cursor_pointer().tooltip(tip).on_click(onBoss)
        .child(bossFigure("boss-fig", state, 64, 88)))
      .child(v_flex().relative().pl(left).pr(12).pt(9).pb(10).gap(6)
        // On the wall: whose office (the nameplate picks it), its team, how it works, and Stop.
        .child(h_flex().h(26).pr(28).gap(8).items_center().overflow_hidden()
          .when(Boolean(rooms), (el) => el.child(rooms))
          .when(Boolean(crewText), (el) => el.child(div().flex_none().h(20).px(6).flex().items_center().rounded(R.control).bg(withAlpha(BOARD, "cc"))
            .text_size(10.5).text_color(over ? t.blocked : NIGHT_TEXT).child(crewText)))
          .child(div().flex_1())
          .when(Boolean(stopButton), (el) => el.child(stopButton)))
        .child(h_flex().h(22).items_center().overflow_hidden()
          .when(Boolean(flow), (el) => el.child(this.flowNotes("band", flow, t))))
        .when(Boolean(board), (el) => el.child(board))
        // On the floor: what it says, then the goal.
        .child(div().h(18).mt(4).min_w(0).truncate().text_size(11.5).text_color(lineColor).child(line))
        .child(h_flex().gap(6).items_start()
          .when(Boolean(agentsPick), (el) => el.child(agentsPick))
          .child(v_flex().flex_1().min_w(120).gap(2)
            .child(div().id("boss-goal").relative().min_h(28).px(8).py(3).rounded(R.control).bg(withAlpha(BOARD, "e6"))
              .children(neonFrame("boss-goal-neon", GROUP_NEON, R.control, { breathe: false, alpha: "66" }))
              .cursor_text().on_click(() => this.bossInput.focus())
              .child(Textarea.new(this.bossInput).w_full().text_size(12)))
            // The goal it works on now (its office.goal label); the box empty,
            // your last goal for this space waits here to be sent again.
            .when(Boolean(goal) && !(this.bossInput?.value() ?? "").trim(), (el) => el
              .child(div().px(2).min_w(0).truncate().text_size(10).text_color("#a9b8c6")
                .tooltip(`The goal the boss works on: ${goal}`).child(`On: ${goal}`)))
            .when(Boolean(remembered) && !goal && !(this.bossInput?.value() ?? "").trim(), (el) => el
              .child(h_flex().px(2).gap(4).items_center()
                .child(div().flex_1().min_w(0).truncate().text_size(10).text_color(t.dim).child(`Last: ${oneLine(remembered)}`))
                .child(div().id("boss-goal-again").flex_none().text_size(10).text_color(t.accent).cursor_pointer()
                  .tooltip("Put your last goal back in the box")
                  .on_click((_e, cx) => { this.bossInput?.set_value(remembered); cx.stop_propagation(); cx.notify(); })
                  .child("Use it")))))
          // Hire / Tell: a lit sign in the accent (amber), dim while it is busy.
          .child(div().id("boss-assign").relative().h(28).px(12).flex().flex_none().items_center().rounded(R.control).bg(withAlpha(BOARD, "f2"))
            .child(dropShadow(R.control))
            .child(div().absolute().top(0).left(0).right(0).bottom(0).rounded(R.control).bg(withAlpha(neonColor(t.accent), this.bossBusy ? "0d" : "2e")))
            .children(neonFrame("boss-assign-neon", t.accent, R.control, { breathe: false, alpha: this.bossBusy ? "59" : "ff" }))
            .hover((s) => s.bg(NIGHT_HOVER))
            .text_size(12).font_bold().text_color(this.bossBusy ? NIGHT_OFF : neonColor(t.accent)).cursor_pointer()
            .tooltip(bossAddr ? "Send the goal to the boss (Ctrl+Enter)" : `Hire ${pick?.name ?? "an agent"} as the boss with this goal (Ctrl+Enter)`)
            .on_click((_e, cx) => this.assign(cx)).child(bossAddr ? "Tell ⏎" : "Hire ⏎"))));
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
    if (this.answering) return;
    this.answering = true;
    const seq = `${agent.seq}`;
    cx.spawn(async (cx) => {
      try {
        const r = await hc(["keys", agent.address, key]);
        if (r.code === 0) this.answered.set(agent.address, seq);
        else this.flash(firstLine(r.stderr) || firstLine(r.stdout) || "Couldn't answer", "blocked", cx, "askNote");
      } catch (e) {
        this.flash(firstLine(String(e?.message ?? e)) || "Couldn't answer", "blocked", cx, "askNote");
      }
      this.answering = false;
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
    return v_flex().id("needs-you").flex_none().mx(8).mt(8).p(8).gap(6).rounded(R.room).bg(this.bk.alert).border(2).border_color(t.blocked)
      .child(h_flex().gap(8).items_center()
        .child(div().size(30).flex_none().rounded(R.card).overflow_hidden().border(1).border_color(t.blocked).bg(t.raised).when(Boolean(src), (el) => el.child(image(src).size(28))))
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().text_size(12).font_bold().text_color(t.foreground)
            .child(`Needs you · ${deskLabel({ agent: a }) || "Agent"} · ${a.program?.name ?? "Agent"}`))
          .child(div().truncate().text_size(10.5).text_color(t.dim).child(`${a.space_name} › ${a.tab_name}${since ? ` · waiting ${since}` : ""}`)))
        .when(waiting.length > 1, (el) => el.child(this.small("ask-next", `${this.card + 1}/${waiting.length} ›`, "The next one waiting", t,
          (_e, cx) => { this.card = (this.card + 1) % waiting.length; cx.notify(); })))
        .child(this.small("ask-details", "Terminal", "Its terminal in a window, to answer there", t, (_e, cx) => this.pick(a.address, cx)))
        .child(this.small("ask-open", "Open ↗", "Its terminal", t, () => run("agent.focus", { terminal: a.address }))))
      .child(v_flex().px(8).py(4).rounded(R.control).bg(this.bk.panel)
        .children(question.map((q, i) => div().id(`ask-q-${i}`).truncate().font_family(mono).text_size(11.5).text_color(t.foreground).child(q))))
      .child(h_flex().gap(5).flex_wrap().items_center()
        .when(answered, (el) => el.child(div().text_size(11).text_color(t.dim).child("Answered: waiting for it to go on…")))
        .when(!answered, (el) => el.children(keys.map(([key, label]) => this.small(`ask-key-${key}`, label, `Press ${key} in its terminal`, t,
          (_e, cx) => this.answer(a, key, cx)).max_w(240))))
        .when(Boolean(this.askNote), (el) => el.child(div().text_size(11).text_color(t[this.askNote.tone] ?? t.muted).child(this.askNote.text))));
  }

  render(cx) {
    if (this.deskHead) return this.deskHead.render(cx);
    const t = theme();
    this.bk = backings(t);
    const sp = spaces();
    const ps = panes();
    const terms = terminals() ?? [];
    this.wide = Boolean(props()?.wide);
    this.hot = shared("office.hover") ?? null;
    // Only the panel lays desks out the way a tab is split (Herdr's layout document).
    if (this.wide) this.watchShape(cx, sp, ps);
    const live = agents();
    this.shareBosses(findBosses({ spaces: sp, panes: ps, terminals: terms, agents: live, prev: this.bosses() }), terms, cx);
    // A boss's hires without a pane of their own sit in the boss's tab.
    const team = this.team(sp, ps, live, terms);
    const paneIds = new Set(ps.map((p) => p.pane));
    // A hire Herdr gets no status from (an agent it doesn't know) still gets a
    // desk: its terminal stands in.
    const reporting = new Set(live.map((a) => a.address));
    this.standIns = new Map();
    for (const [addr, at] of team.staff) {
      const term = terms.find((x) => x.address === addr);
      if (reporting.has(addr) || !isHire(term)) continue;
      this.standIns.set(addr, standIn(term, ps.find((p) => p.terminal === addr), at));
    }
    const list = [...live, ...this.standIns.values()].map((a) => {
      const at = team.staff.get(a.address);
      if (!at) return a;
      // A hire's desk says its task (office.task), when it has one.
      const task = team.tasks.get(a.address);
      const hire = task ? { ...a, title: task } : a;
      return a.pane && paneIds.has(a.pane)
        ? hire
        : { ...hire, tab: at.tab.id, tab_name: at.tab.name, space: at.space.id, space_name: at.space.name };
    });
    this.teamNow = team; // the rugs read their space's boss flow from these
    this.listNow = list;
    const plan = officePlan(sp, ps, list);
    // A face each: the boss keeps the manager's, and its hires take the room's
    // free ones, so a team of developers is a team of different people (their
    // names say what they do; a name no longer picks a face).
    const seats = deskJobs(sp, ps, list, { Boss: "manager", ...this.jobs });
    const bosses = [...team.bosses.keys()];
    for (const boss of bosses) seats.set(boss, "manager");
    const roles = uniqueFaces(seats, bosses);
    this.roles = roles; // the desk window's header wears the same face
    if (!this.wide) {
      this.shareFaces(roles);
      // agent.next / agent.prev walk the agents in the order they are drawn.
      const order = (seated) => setAgentOrder(seated.filter((a) => !a.standIn).map((a) => a.address));
      this.sideW = find(layout(), "sidebar")?.size?.px ?? Infinity;
      if (this.sideW < 160) {
        order(plan.flatMap((row) => row.tabs.flatMap((c) => c.desks.filter((d) => d.agent).map((d) => d.agent))));
        return this.rail(plan, roles, t);
      }
      const deck = listDeck(plan, this.groups());
      order(deck.flatMap((part) => part.rows.flatMap((r) => r.staff.map((d) => d.agent))));
      return this.list(deck, roles, list, t);
    }
    const width = this.wide ? find(layout(), "panel")?.size?.px ?? 640 : 300;
    this.z = this.wide ? WIDE : SMALL;
    this.most = this.wide ? fitAcross(width - this.z.pad, this.z.slot, this.z.gap) : MOST_ACROSS;
    this.now = Date.now();
    this.hours = parseHours(localStorage.getItem("office.hours"));
    this.night = nightNow();
    this.bossAddrs = new Set(Object.values(this.bosses()));
    // Each space's own folder, as a desk shows one (shortPath), and its room
    // number, as Spaces numbers its doors.
    this.roots = new Map(sp.map((s) => [s.id, shortPath(s.folder || spaceFolder(s, ps))]));
    this.roomNo = new Map(sp.map((s, i) => [s.id, String(i + 1).padStart(2, "0")]));
    // The branches each room's terminals are on (worktrees.js): several, each desk says its own.
    this.branches = new Map(sp.map((s) => [s.id, branchesOf(s, ps)]));
    // All counts what the floor shows: every desk, a terminal's too.
    const desks = plan.reduce((sum, row) => sum + row.tabs.reduce((k, c) => k + c.desks.length, 0), 0);
    const filter = this.wide ? this.filter : "all";
    // Filtered, a tab shows some of its desks: the split no longer fits them.
    const trees = filter === "all" ? this.treesFor(plan) : new Map();
    const shown = filterPlan(plan, filter);
    // Groups you made yourself: each band holds the spaces you put in it.
    const groups = this.groups();
    // A worktree's room under its repo's, as Spaces lists it ("space.trees",
    // worktrees.js), when the two are in the same group.
    const nest = Object.fromEntries(Object.entries(shared("space.trees") ?? {})
      .filter(([kid, top]) => groupOf(groups, kid) === groupOf(groups, top)));
    const deck = planGroups(nestRows(shown, nest), groups);
    const colors = shared("space.colors") ?? {};
    const n = tally(list);
    // The terminals' code font, for the inspector's screen.
    let mono = "monospace";
    try { mono = cx.theme()?.typography?.mono || mono; } catch {}
    const away = this.wide && filter === "all" ? this.storage(sp, ps, t) : null;
    if (this.wide) {
      const room = this.room(sp);
      const key = room?.machine ?? "";
      if (room && !(key in this.known) && !this.loadingKnown.has(key)) this.loadKnown(room.machine ?? null, cx);
    }
    const moveLine = !this.wide ? null
      : this.drag?.moved ? { text: `Drop ${this.drag.name} on Move here in another tab to move them there`, tone: t.accent }
      : this.moveNote ? { text: this.moveNote.text, tone: t[this.moveNote.tone] ?? t.muted } : null;
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
      // Letting go anywhere but a lit Add desk (which stops this) drops a drag.
      .when(this.wide, (el) => el.on_mouse_up("left", (_e, cx) => { const was = this.drag?.moved; this.drag = null; if (was) cx.notify(); }))
      .child(div().absolute().top(0).left(0).when(this.night, (el) => el.opacity(0.4)).child(image(FLOOR).w(912).h(800)))
      .when(this.wide, (el) => {
        const ask = this.needsYou(list, roles, sp, t, mono);
        const memo = this.morning(t);
        return el.child(this.header(n, desks, t)).child(this.bossBand(t, sp, list, team, width))
          .when(Boolean(memo), (el) => el.child(memo)).when(Boolean(ask), (el) => el.child(ask));
      })
      .child(v_flex().id("office-floor").flex_1().min_h(0).p(this.wide ? 10 : 8).gap(this.wide ? 10 : 8).overflow_y_scrollbar()
        .when(Boolean(moveLine), (el) => el.child(div().flex_none().text_size(11).text_color(moveLine.tone).child(moveLine.text)))
        .children(deck.map((part) => (part.band ? this.groupBand(part, roles, colors, trees, t) : this.rug(part.rows[0], roles, colors, trees, t))))
        .when(deck.length === 0, (el) => el.child(div().p(8).text_size(12).text_color(t.dim).child(empty ?? "Nobody here.")))
        .when(Boolean(away), (el) => el.child(away))
        .when(this.wide, (el) => el.child(h_flex().flex_none().child(this.button("office-new-space", "+ New space", "A new space where you are now, or in a folder you pick", t, () => openOverlay({ mod: "office-space-new", kind: "dialog", width: 480, height: 480, props: { machine: spaces().find((s) => s.active)?.machine ?? null } }))))))
      .when(this.wide, (el) => el.child(this.inspector(roles, t)));
  }
}
