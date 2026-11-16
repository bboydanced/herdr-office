// Office new menu: the tab bar's "+" on an office card. A terminal or an
// agent in a new tab of the space you are in, a new space or a worktree. 1-9
// start the agents in order; Esc closes.
//
// Modified from Herdr's `new-menu` mod for the office (the items are Herdr's).
// Upstream: https://github.com/herdrdev/herdr-app (Apache-2.0).
import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, panes, knownAgents, run, openOverlay, closeOverlay, props, window, keys, shared, setShared } from "herdr";
import { caption, card, ink, keyTag, line, rule } from "./card.js";

// The last agents each machine reported, shown at once while knownAgents() checks again
// (the same key as Herdr's new-menu, so both start from what either saw).
const KNOWN = "new-menu.agents";

function shortcut(name) {
  const k = keys().find((b) => b.section === "global" && b.action === name);
  if (!k?.keys.trim()) return "";
  const mac = window()?.platform === "macos";
  const names = mac ? { ctrl: "⌃", alt: "⌥", shift: "⇧", cmd: "⌘", fn: "fn" } : { ctrl: "Ctrl", alt: "Alt", shift: "Shift", cmd: "Super", fn: "Fn" };
  const alias = { secondary: mac ? "cmd" : "ctrl", super: "cmd", win: "cmd" };
  return k.keys.trim().split(/\s+/).map((stroke) => {
    const parts = stroke.split("-");
    let key = parts.pop();
    if (key === "") { key = "-"; parts.pop(); }
    const held = new Set(parts.map((m) => alias[m.toLowerCase()] ?? m.toLowerCase()));
    if (/^[A-Z]$/.test(key)) held.add("shift");
    const label = key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1).toLowerCase();
    return [...Object.keys(names).filter((m) => held.has(m)).map((m) => names[m]), label].join(mac ? "" : "+");
  }).join(" ");
}

export default class OfficeNewMenu extends View {
  init(_props, cx) {
    const machine = spaces().find((s) => s.active)?.machine;
    const where = machine ?? "";
    this.agents = shared(KNOWN)?.[where] ?? [];
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.spawn(async (cx) => {
      try {
        this.agents = await knownAgents({ on: machine });
        setShared(KNOWN, { ...shared(KNOWN), [where]: this.agents });
      } catch { this.failed = true; }
      cx.notify();
    });
  }

  row(id, icon, name, action, hint = "", enabled = true) {
    return line(h_flex().id(id), { enabled })
      .on_click(() => { if (enabled) { closeOverlay(props().overlay); action(); } })
      .child(icon)
      .child(div().flex_1().min_w(0).truncate().child(name))
      .when(Boolean(hint), (el) => el.child(keyTag(hint)));
  }

  render() {
    const space = spaces().find((s) => s.active);
    const installed = this.agents.filter((a) => a.installed);
    const choices = this.failed ? installed : [...installed, ...this.agents.filter((a) => !a.installed).slice(0, 2)];
    const c = ink();
    const folder = () => panes().find((p) => p.focused)?.cwd;
    const branch = svg("mods/office-chrome/branch.svg").size(13).flex_none().text_color(c.dim);
    const rows = [
      this.row("terminal", svg("mods/office-chrome/terminal.svg").size(13).flex_none().text_color(c.dim), "Terminal",
        () => run("tab.new", { space: space?.id }), shortcut("tab.new")),
      caption("START AN AGENT"),
      v_flex().id("office-new-agents").flex_none().h(Math.min(308, Math.max(1, choices.length + (this.failed ? 1 : 0)) * 28)).overflow_y_scrollbar()
        .children(choices.map((a, i) => this.row(`agent-${a.key}`,
          (a.tint ? svg(a.icon).text_color(c.text) : image(a.icon)).size(13).flex_none(), a.name,
          () => run("tab.new", { name: a.name, space: space?.id, argv: a.run }),
          a.installed ? (i < 9 ? String(i + 1) : "") : "not installed", a.installed)))
        .when(this.failed || this.agents.length === 0, (el) => el.child(div().h(28).px(10).flex().items_center().text_size(11.5)
          .text_color(c.dim).child(this.failed ? "Could not check installed agents" : "Checking installed agents…"))),
      rule(),
      this.row("space", svg("mods/office-chrome/plus.svg").size(13).flex_none().text_color(c.dim), "New space", () => run("space.new"), shortcut("space.new")),
      this.row("worktree", branch, "New worktree…", () => openOverlay({ mod: "worktree", kind: "dialog", width: 460, height: 280, props: { space: space?.id, folder: folder(), action: "new" } }), "", Boolean(space)),
      this.row("worktree-open", svg("mods/office-chrome/branch.svg").size(13).flex_none().text_color(c.dim), "Open worktree…", () => openOverlay({ mod: "worktree", kind: "dialog", width: 560, height: 480, props: { space: space?.id, folder: folder(), action: "open" } }), "", Boolean(space)),
    ];
    return v_flex().id("office-new-menu").w_full().min_h(0).track_focus(this.handle)
      .on_key_down((e) => {
        if (e.key === "escape") return closeOverlay(props().overlay);
        if (e.modifiers.control || e.modifiers.platform || e.modifiers.alt) return;
        const agent = /^[1-9]$/.test(e.key) ? installed[Number(e.key) - 1] : null;
        if (!agent) return;
        closeOverlay(props().overlay);
        run("tab.new", { name: agent.name, space: space?.id, argv: agent.run });
      })
      .child(card("office-new-card", space?.name ? `NEW TAB · ${space.name}` : "NEW TAB", rows));
  }
}
