// Office agents sidebar: agents() as staff cards, HP/SP read from the status
// line cache. Reads cache files only - runs no command, opens no connection,
// reads no conversation or credentials. No numbers means no numbers drawn.
import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, appHome, readTextFile, run, setAgentOrder, spaces, theme, watchFolder } from "herdr";
import { appLabel, assignJobs, cachePath, gauge, jobIn, modelText, parseCache, portraitPath, remoteCachePath, spritePath, tabNames } from "./lib.js";

const HOME = appHome();
const SESSIONS_DIR = `${HOME}/data/office/sessions`;
const JOBS_FILE = `${HOME}/mods/office-agents/jobs.json`;
const PIC = 72;
// Full-body sprites are 36x48 pixels at 4x: 72x96 points, two pixels per point on Retina.
const SPRITE_W = 72;
const SPRITE_H = 96;
const STATUS = { working: "Working", blocked: "Needs you", done: "Done", idle: "Idle" };

// Portrait: the role's sprite when there is one, else its bust portrait, else
// the program icon (tinted svg or plain image), else nothing.
function portrait(a, assigned, t) {
  const job = jobIn(a.tab_name, assigned);
  const sprite = spritePath(job, a.status);
  if (sprite) return image(sprite).w(SPRITE_W).h(SPRITE_H).flex_none();
  const src = portraitPath(job);
  if (src) return image(src).w(PIC).h(PIC).flex_none();
  const p = a.program;
  if (!p?.icon) return div().w(PIC).h(PIC).flex_none();
  return p.tint
    ? svg(p.icon).size(PIC).flex_none().text_color(t.foreground)
    : image(p.icon).w(PIC).h(PIC).flex_none();
}

// One HP/SP bar: a null pct draws no fill and shows "—"; stale numbers keep
// their value and only gain a dim "old" marker.
function bar(label, g, color, t) {
  return h_flex()
    .w_full()
    .min_w(0)
    .h(14)
    .gap(6)
    .items_center()
    .child(div().w(20).flex_none().text_size(10).text_color(t.dim).child(label))
    .child(
      h_flex()
        .flex_1()
        .min_w(0)
        .h(6)
        .bg(t.raised)
        .when(g.pct !== null, (el) => el.child(div().h_full().w(`${g.pct}%`).bg(color))),
    )
    .child(
      div()
        .flex_none()
        .text_size(11)
        .text_color(g.stale ? t.dim : t.foreground)
        .child(g.stale ? `${g.text} old` : g.text),
    );
}

// Tag row: a small framed label, then "model · effort" when known.
function tag(label, model, t) {
  const color = label.builder ? t.unknown : t.accent;
  return h_flex()
    .w_full()
    .min_w(0)
    .h(16)
    .gap(6)
    .items_center()
    .child(
      div()
        .flex_none()
        .px(5)
        .border(1)
        .border_color(color)
        .text_size(10)
        .text_color(color)
        .child(label.text),
    )
    .when(model !== null, (el) => el.child(modelLine(model, t)));
}

function modelLine(model, t) {
  return div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(model);
}

export default class OfficeAgents extends View {
  init(_props, cx) {
    this.jobs = {};
    this.cache = {};
    this.remote = {};
    this.tick = 0;
    this.seen = new Set();
    this.watching = false;
    this.loadJobs(cx);
    this.load(cx);
    this.loadRemote(cx);
    this.watch(cx);
    // The data is numbers; once every 30 s is plenty, lets the "old" marker
    // appear on its own, and retries the watch.
    cx.timer.every(30000, (cx) => {
      this.load(cx);
      this.watch(cx);
      // Remote reads every 60 s, matching the status line's refresh; a remote
      // folder cannot be watched.
      if (++this.tick % 2 === 0) this.loadRemote(cx);
    });
  }

  // Watch the cache folder and re-read on change. An unavailable folder ends
  // the loop; the timer above retries, so this never becomes a busy loop.
  watch(cx) {
    if (this.watching) return;
    this.watching = true;
    cx.spawn(async (cx) => {
      let quick = 0;
      for (;;) {
        let changed;
        const started = Date.now();
        try {
          changed = await watchFolder(SESSIONS_DIR);
        } catch {
          break;
        }
        // Returning at once with no change means the watch did not take.
        quick = Date.now() - started < 500 && (changed ?? []).length === 0 ? quick + 1 : 0;
        if (quick >= 3) break;
        this.load(cx);
      }
      this.watching = false;
    });
  }

  loadJobs(cx) {
    cx.spawn(async (cx) => {
      const text = await readTextFile(JOBS_FILE).catch(() => null);
      let jobs = {};
      try {
        const parsed = JSON.parse(text);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) jobs = parsed;
      } catch {
        jobs = {};
      }
      this.jobs = jobs;
      cx.notify();
    });
  }

  // Each local agent reads its own cache file; remote ones come from loadRemote.
  load(cx) {
    const wanted = [];
    for (const a of agents()) {
      const path = cachePath(HOME, a.address);
      if (path === null) continue;
      this.seen.add(a.address);
      wanted.push({ address: a.address, path });
    }
    cx.spawn(async (cx) => {
      const next = {};
      for (const w of wanted) {
        const text = await readTextFile(w.path).catch(() => null);
        next[w.address] = parseCache(text);
      }
      this.cache = next;
      cx.notify();
    });
  }

  // A remote agent reads its own machine's cache over Herdr's existing
  // connection and runs nothing there; unreachable means "—".
  loadRemote(cx) {
    const wanted = [];
    for (const a of agents()) {
      const r = remoteCachePath(a.address);
      if (r === null) continue;
      this.seen.add(a.address);
      wanted.push({ address: a.address, ...r });
    }
    if (wanted.length === 0) return;
    cx.spawn(async (cx) => {
      const next = {};
      for (const w of wanted) {
        const text = await readTextFile(w.path, { on: w.on }).catch(() => null);
        next[w.address] = parseCache(text);
      }
      this.remote = next;
      cx.notify();
    });
  }

  card(a, now, t) {
    const cache = this.cache[a.address] ?? this.remote[a.address] ?? null;
    const hp = gauge(cache ? cache.hp : null, cache ? cache.updatedAt : null, now);
    const sp = gauge(cache ? cache.sp : null, cache ? cache.updatedAt : null, now);
    // blocked is unmistakable: frame and status word both use t.blocked,
    // overriding the focused accent.
    const frame = a.status === "blocked" ? t.blocked : a.focused ? t.accent : t.border;
    const statusColor = a.status === "blocked" ? t.blocked : t[a.status] ?? t.dim;
    const label = appLabel(a.app);
    const model = modelText(cache?.model, cache?.effort);
    return h_flex()
      .id(`office-${a.address}`)
      .w_full()
      .flex_none()
      .p(8)
      .gap(10)
      .items_center()
      .bg(`${t.surface}c8`)
      .border(1)
      .border_color(frame)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => run("agent.focus", { terminal: a.address }))
      .child(portrait(a, this.assigned, t))
      .child(
        v_flex()
          .flex_1()
          .min_w(0)
          .gap(4)
          .child(
            h_flex()
              .w_full()
              .min_w(0)
              .gap(8)
              .items_center()
              .child(div().flex_1().min_w(0).truncate().font_semibold().child(a.tab_name || a.address))
              .child(div().flex_none().text_size(11).text_color(statusColor).child(STATUS[a.status] ?? a.status)),
          )
          // Session name (set with /rename) under the tab name; takes no row when unset.
          .when(Boolean(cache?.name), (el) =>
            el.child(div().w_full().min_w(0).truncate().text_size(11).text_color(t.dim).child(cache.name)),
          )
          // Program tag: gold for Claude, purple for builders (orange means blocked).
          // Claude: model on the tag row. Builders: model on its own row, so long names fit.
          .when(Boolean(label), (el) => el.child(tag(label, label.builder ? null : model, t)))
          .when(Boolean(label?.builder) && model !== null, (el) => el.child(h_flex().w_full().min_w(0).child(modelLine(model, t))))
          // Builders have no HP/SP source, so no empty bars.
          .when(!label?.builder, (el) => el.child(bar("HP", hp, t.accent, t)).child(bar("SP", sp, t.solid, t))),
      );
  }

  render(cx) {
    const t = theme();
    const list = agents();
    this.assigned = assignJobs(tabNames(spaces(), list), this.jobs);
    setAgentOrder(list.map((a) => a.address));
    // A fresh agent gets its cache read at once rather than at the next tick.
    const fresh = list.filter((a) => !this.seen.has(a.address));
    if (fresh.some((a) => cachePath(HOME, a.address) !== null)) this.load(cx);
    if (fresh.some((a) => remoteCachePath(a.address) !== null)) this.loadRemote(cx);
    const now = Math.floor(Date.now() / 1000);
    return v_flex()
      .id("office-agents")
      .size_full()
      .min_h(0)
      .text_color(t.foreground)
      .text_size(13)
      .child(
        v_flex()
          .flex_1()
          .min_h(0)
          .gap(6)
          .p(6)
          .overflow_y_scrollbar()
          .children(list.map((a) => this.card(a, now, t)))
          .when(list.length === 0, (el) =>
            el.child(div().p(8).text_size(12).text_color(t.dim).child("No agents")),
          ),
      );
  }
}
