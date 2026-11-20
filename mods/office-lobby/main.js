// A room's lobby (office-agents/lobby.js): the page a room shows once you have
// closed its last tab, so the room stays open with nothing running in it. An
// OPEN sign in neon, the room and its folder, and what to do next: a terminal,
// an agent (the office-add popup), or close the room. Office Spaces makes it,
// one per room; the tab bar and the floor never show it.
//
// props: { space } (the room it was made for; its pane's tab says it too).
import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { home, openOverlay, panes, props, run, spaces, theme } from "herdr";
import { BOARD, NEON, neonColor, neonFrame, neonSign } from "./neon.js";

const TERMINAL = "#7fe3f0", OFF = "#8a93b8", HOVER = "#241c42";
// Drawn as the terminals beside it are: their background at the layout's
// terminal_opacity (0.86), so the wallpaper shows through as faintly.
const PAGE_ALPHA = "db";
const solid = (c) => (typeof c === "string" && /^#[0-9a-fA-F]{6}/.test(c) ? c.slice(0, 7) : "#101820");

export default class Lobby extends View {
  // Its room: the one its pane's tab is in, else the one it was made for.
  room() {
    const p = props() ?? {};
    const sp = spaces();
    const pane = p.pane ? panes().find((x) => x.pane === p.pane) : null;
    return (pane && sp.find((s) => (s.tabs ?? []).some((c) => c.id === pane.tab))) || sp.find((s) => s.id === p.space) || null;
  }

  short(path, machine) {
    let h = null;
    try { h = machine ? null : home(); } catch {}
    return path && h && (path === h || path.startsWith(`${h}/`)) ? `~${path.slice(h.length)}` : path || "";
  }

  // A button as a lit neon sign: a dark board, its tube and its words in `color`.
  button(id, label, color, tip, action) {
    const c = neonColor(color);
    return h_flex().id(id).relative().h(30).px(14).flex_none().items_center().rounded(6).bg(`${BOARD}f2`)
      .cursor_pointer().hover((s) => s.bg(HOVER)).tooltip(tip)
      .child(div().absolute().top(0).left(0).right(0).bottom(0).rounded(6).bg(`${c}1f`))
      .children(neonFrame(`${id}-neon`, color, 6, { breathe: false, alpha: "d9" }))
      .text_size(12.5).font_bold().text_color(c)
      .on_click(action)
      .child(label);
  }

  render() {
    const t = theme();
    const s = this.room();
    const page = `${solid(t.background)}${PAGE_ALPHA}`;
    if (!s) return div().size_full().bg(page);
    const where = this.short(s.folder, s.machine) || "~";
    return v_flex().size_full().items_center().justify_center().gap(16).p(24).bg(page)
      .child(neonSign("lobby-open", "OPEN", NEON, 4, { flicker: 2 }))
      .child(v_flex().items_center().gap(4)
        .child(div().text_size(17).font_semibold().text_color(t.foreground).child(s.name))
        .child(div().text_size(12).text_color(t.dim).child(s.machine ? `${s.machine} · ${where}` : where)))
      .child(div().text_size(12).text_color(t.muted).child("Nobody here yet · the room stays open until you close it"))
      .child(h_flex().gap(10).items_center()
        .child(this.button("lobby-terminal", "+ Terminal", TERMINAL, "A new tab here with a shell", () => run("tab.new", { space: s.id })))
        .child(this.button("lobby-agent", "+ Agent", NEON, "A new tab here with an agent (or a shell)", () => openOverlay({
          mod: "office-add", kind: "popup", frame: "none", width: 250, height: 380,
          props: { mode: "tab", space: s.id, machine: s.machine ?? null, where: `${s.name} · ${where}` },
        })))
        .child(this.button("lobby-close", "Close room", OFF, "Close this room (it stays under Closed rooms)", () => run("space.close", { id: s.id }))));
  }
}
