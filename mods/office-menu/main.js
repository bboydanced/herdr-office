// Office right-click menu: Herdr's own menu items on an office card. The
// office's mods open it for a pane, a tab or a space, and the office layout
// names it its terminal_menu. Opened as a popup with
// props { tab: "pane" | "tab" | "space" | "global", target }.
// ↑/↓ move, Enter runs, Esc closes. An item is [label, command, args];
// a command "worktree" opens the worktree dialog instead.
//
// Modified from Herdr's `menu` mod for the office (the items are Herdr's).
// Upstream: https://github.com/herdrdev/herdr-app (Apache-2.0).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, openOverlay, keys, terminals, spaces, panes, exec } from "herdr";
import { card, ink, keyTag, line, rule } from "./card.js";

const WIDTH = 230;

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return panes().find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

// A space's checkout: "main" (a repo's own), "linked" (a worktree), or null.
async function checkout(folder, on) {
  const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: folder, on });
  const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: folder, on });
  if (top.code !== 0 || common.code !== 0) return null;
  return common.stdout.trim() === `${top.stdout.trim()}/.git` ? "main" : "linked";
}

function items(p, git) {
  p = p ?? {};
  const tg = p.target ?? {};
  switch (p.tab) {
    case "pane": {
      // A kept sub-agent can go back under its parent, still running.
      const all = terminals();
      const term = all.find((t) => t.address === tg.terminal);
      const parent = term?.parent && all.find((t) => t.address === term.parent);
      // Once they go to the program, Shift+right-click still opens this menu.
      const toProgram = term?.labels?.["herdr.right-click"] === "program";
      // A terminal shown outside a tab (a layout terminal block, a window) has
      // no pane to split, zoom or close: its pane is the block's id.
      const inTab = panes().some((pane) => pane.pane === tg.pane);
      return [
        ...(inTab
          ? [
              ["Split right", "pane.split", { direction: "right", pane: tg.pane }],
              ["Split down", "pane.split", { direction: "down", pane: tg.pane }],
              ["Zoom", "pane.zoom", { pane: tg.pane }],
            ]
          : []),
        ...(term
          ? [
              toProgram
                ? ["Use Herdr right-click menu", "terminal.right_click", { terminal: term.address, to: "menu" }]
                : ["Send right-clicks to pane", "terminal.right_click", { terminal: term.address, to: "program" }],
            ]
          : []),
        ...(parent ? [[`Send back to ${parent.name || parent.address}`, "terminal.park", { terminal: term.address }]] : []),
        ...(inTab ? [["Close pane", "pane.close", { pane: tg.pane }]] : []),
      ];
    }
    case "tab":
      return [
        ["Rename", "tab.rename", { id: tg.id }],
        ["New tab", "tab.new", { space: tg.space }],
        ["Close", "tab.close", { id: tg.id }],
      ];
    case "space":
      return [
        ["Rename", "space.rename", { id: tg.id }],
        ...(git ? [["New worktree", "worktree", { space: tg.id, action: "new" }], ["Open worktree", "worktree", { space: tg.id, action: "open" }]] : []),
        ...(git === "linked" ? [["Remove worktree", "worktree", { space: tg.id, action: "remove" }]] : []),
        ["Close", "space.close", { id: tg.id }],
      ];
    default:
      return [
        ["New space", "space.new", {}],
        ["Keybinds", "app.help", {}],
        ["Theme: graphite", "app.theme", { name: "graphite" }],
        ["Theme: ink", "app.theme", { name: "ink" }],
        ["Theme: moss", "app.theme", { name: "moss" }],
        ["Theme: atom one dark", "app.theme", { name: "atom-one-dark" }],
      ];
  }
}

// What the card's tab says: what was clicked, and its name when it has one.
function title(p) {
  const tg = p?.target ?? {};
  const named = (kind, name) => (name ? `${kind} · ${name}` : kind);
  switch (p?.tab) {
    case "pane": {
      const term = terminals().find((t) => t.address === tg.terminal);
      return named("DESK", term?.name || term?.program?.name || "");
    }
    case "tab": {
      const tab = spaces().flatMap((s) => s.tabs ?? []).find((c) => c.id === tg.id);
      return named("TAB", tab?.name ?? "");
    }
    case "space":
      return named("SPACE", spaces().find((s) => s.id === tg.id)?.name ?? "");
    default:
      return "OFFICE";
  }
}

function menuIcon(command) {
  const name = command.endsWith(".close") ? "x" : command.endsWith(".rename") ? "square-pen" : command.endsWith(".new") ? "plus" : command === "worktree" ? "git-branch" : command === "app.help" ? "terminal" : command === "app.theme" ? "settings" : command === "pane.split" ? "panel-right" : command === "pane.zoom" ? "square" : "terminal";
  return `mods/workspace-chrome/${name}.svg`;
}

// The key bound to a command, for the tag on the right.
function shortcut(name, args) {
  // `pane.split:right` binds pane.split with { direction: "right" }.
  const value = args && Object.values(args)[0];
  const k = keys().find((b) => b.section === "global" && (b.action === name || b.action === `${name}:${value}`));
  return k ? k.keys : "";
}

const closes = (it) => it[1].endsWith(".close");

export default class OfficeMenu extends View {
  init(_props, cx) {
    this.at = 0;
    this.git = null;
    this.reframed = false;
    this.handle = cx.focus_handle();
    this.handle.focus();
    const p = props();
    const space = p?.tab === "space" && spaces().find((s) => s.id === p.target?.id);
    const folder = space && place(space);
    if (folder)
      cx.spawn(async (cx) => {
        this.git = await checkout(folder, space.machine).catch(() => null);
        cx.notify();
      });
  }

  choose(i) {
    const it = items(props(), this.git)[i];
    if (!it) return;
    closeOverlay(props()?.overlay);
    if (it[1] === "worktree") openOverlay({ mod: "worktree", kind: "dialog", ...(it[2].action === "open" ? { width: 560, height: 480 } : { width: 440, height: 260 }), props: it[2] });
    else run(it[1], it[2]);
  }

  render() {
    const p = props();
    // Herdr opens a terminal_menu with its frame: open again without it, so
    // the card is all there is. The office's own mods open it frameless.
    if (p?.tab === "pane" && !p.frameless) {
      if (!this.reframed) {
        this.reframed = true;
        openOverlay({ mod: "office-menu", kind: "popup", frame: "none", at: "pointer", width: WIDTH, height: 260, props: { tab: p.tab, target: p.target, frameless: true } });
        closeOverlay(p.overlay);
      }
      return div();
    }
    const list = items(p, this.git);
    const c = ink();
    const rows = list.flatMap((it, i) => [
      ...(i > 0 && (closes(it) || it[1] === "app.help" || (it[1] === "app.theme" && list[i - 1][1] !== "app.theme")) ? [rule()] : []),
      line(h_flex().id(`mi-${i}`), { on: i === this.at, danger: closes(it) })
        .on_click(() => this.choose(i))
        .child(svg(menuIcon(it[1])).size(13).flex_none().text_color(closes(it) ? c.red : c.dim))
        .child(div().flex_1().min_w(0).truncate().child(it[0]))
        .when(Boolean(shortcut(it[1], it[2])), (el) => el.child(keyTag(shortcut(it[1], it[2])))),
    ]);
    return v_flex()
      .id("office-menu")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") this.choose(this.at);
        else if (e.key === "escape") closeOverlay(p.overlay);
        else return;
        cx.notify();
      })
      .child(card("office-menu-card", title(p), rows));
  }
}
