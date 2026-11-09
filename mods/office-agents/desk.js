// The desk window's header. A click on a desk in the Office panel opens one
// window (openOverlay, kind "window") holding this header over that staff
// member's real terminal, a terminal block Herdr draws like any pane: type into
// it as you would in the main area. The header says who and where, has Go to
// desk, Stop (`hc interrupt`) and close, and the quick replies from
// replies.json: a click sends one (`hc send`, then Enter), refused while it
// waits for an answer. Buttons stop the press, so only the header's background
// drags the window.
//
// props: { desk: terminal address, job: role or null, overlay: the window }
import { div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, appHome, closeOverlay, hc, panes, props, readTextFile, run, spaces, terminals, theme } from "herdr";
import { DEFAULT_REPLIES, deskLabel, deskState, firstLine, mixHex, parseReplies, portraitPath, shortPath, withAlpha } from "./lib.js";

const REPLIES_FILE = `${appHome()}/mods/office-agents/replies.json`;

const cap = (word) => (word ? word[0].toUpperCase() + word.slice(1) : "");

export class Desk {
  constructor(cx) {
    this.replies = DEFAULT_REPLIES;
    this.busy = false; // a reply or a stop on its way
    this.note = null; // { text, tone }: what the last one did
    cx.spawn(async (cx) => {
      this.replies = parseReplies(await readTextFile(REPLIES_FILE).catch(() => null));
      cx.notify();
    });
  }

  flash(text, tone, cx) {
    const note = { text, tone };
    this.note = note;
    cx.timer.after(4000, (cx) => { if (this.note === note) { this.note = null; cx.notify(); } });
  }

  // One hc call, and what it did in the note.
  act(args, said, cx) {
    if (this.busy) return;
    this.busy = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const r = await hc(args);
        if (r.code === 0) this.flash(said(r), "done", cx);
        else this.flash(firstLine(r.stderr) || firstLine(r.stdout) || "Couldn't do it", "blocked", cx);
      } catch (e) {
        this.flash(firstLine(String(e?.message ?? e)) || "Couldn't do it", "blocked", cx);
      }
      this.busy = false;
      cx.notify();
    });
  }

  render(_cx) {
    const t = theme();
    const { desk: key, job, overlay } = props() ?? {};
    const a = agents().find((x) => x.address === key) ?? null;
    const pane = panes().find((p) => (a ? p.pane === a.pane : p.terminal === key)) ?? null;
    const tabId = a?.tab ?? pane?.tab;
    const space = spaces().find((s) => (s.tabs ?? []).some((c) => c.id === tabId)) ?? null;
    const tab = space?.tabs?.find((c) => c.id === tabId) ?? null;
    const state = deskState(a, tab, Date.now());
    const waiting = a?.status === "blocked";
    const src = portraitPath(job);
    // A hire Herdr gets no status from has no agent: its terminal names it.
    const term = a ? null : (terminals() ?? []).find((x) => x.address === key) ?? null;
    const what = a?.program?.name ?? term?.program?.name ?? (job ? term?.name : null) ?? (deskLabel({ pane }) || "Terminal");
    const title = job || a ? `${job ? cap(job) : "Agent"} · ${what || "Agent"}` : what;
    const place = [space && tab ? `${space.name} › ${tab.name}` : "", shortPath(pane?.cwd), pane?.branch].filter(Boolean).join(" · ");
    const tone = { working: mixHex(t.working, "#ffffff", 0.3), blocked: t.blocked, done: t.done }[state?.status] ?? t.dim;
    const close = () => overlay && closeOverlay(overlay);
    // Its own space and tab, never this window's copy of the terminal; a
    // terminal with no pane (a background hire), in a peek.
    const go = () => {
      close();
      if (a) run("agent.focus", { terminal: a.address });
      else if (space && tab && pane) {
        if (!space.active) run("space.select", { id: space.id });
        if (!tab.active) run("tab.select", { id: tab.id });
        run("pane.focus", { pane: pane.pane });
      } else run("terminal.peek", { terminal: key });
    };
    const button = (id, label, tip, action, color) => div().id(id).h(22).px(8).flex().flex_none().items_center().max_w(220)
      .text_size(11).text_color(color ?? t.muted).border(1).border_color(withAlpha(t.muted, "55")).bg("#0d131b")
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click(action)
      .child(div().min_w(0).truncate().child(label));
    const reply = (r) => (_e, cx) => {
      if (waiting) return this.flash("It waits for an answer: answer it in the terminal below", "blocked", cx);
      this.act(["send", key, "--", r], () => `Sent: ${r}`, cx);
    };
    const stop = (_e, cx) => this.act(["interrupt", key, "--json"], (r) => {
      let outcome = firstLine(r.stdout);
      try { outcome = JSON.parse(r.stdout)?.outcome ?? outcome; } catch {}
      return `Stop: ${String(outcome).replace(/_/g, " ")}`;
    }, cx);
    if (!key) return div().size_full().bg("#121a23");
    return v_flex().id("desk-head").size_full().px(10).py(7).gap(6).bg("#121a23").border_b(1).border_color(t.accent)
      .child(h_flex().gap(8).items_center()
        .child(div().size(30).flex_none().border(1).border_color(state ? t[state.status] ?? t.dim : t.dim).bg(t.raised)
          .when(Boolean(src), (el) => el.child(image(src).size(28))))
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().text_size(12.5).font_semibold().text_color(t.foreground).child(title))
          .child(div().truncate().text_size(10.5).text_color(t.dim).child(place || " ")))
        .child(div().flex_none().text_size(11).text_color(tone).child(state ? state.text : "Terminal"))
        .child(button("desk-go", "Go to desk", "Their terminal in its space and tab (closes this window)", go))
        .child(button("desk-stop", "Stop", "The stop key: Esc for an agent, else Ctrl+C", stop, t.blocked))
        .child(button("desk-close", "✕", "Close this window (Esc goes to the terminal)", close)))
      .child(h_flex().gap(5).items_center().overflow_hidden()
        .children(this.replies.map((r, i) => button(`desk-reply-${i}`, r,
          waiting ? "It waits for an answer: answer it in the terminal below" : `Send “${r}” and press Enter`, reply(r),
          waiting || this.busy ? t.dim : t.muted)))
        .child(div().flex_1())
        .when(Boolean(this.note), (el) => el.child(div().flex_none().text_size(11).text_color(t[this.note.tone] ?? t.muted).child(this.note.text))));
  }
}
