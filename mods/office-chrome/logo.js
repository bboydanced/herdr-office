// The Office Agent logo in blocks: a chibi at a laptop in a night office, a
// moon in the window and a plant, in a rounded tile. A 16-cell grid at
// `size / 16` points a cell, every edge rounded to a whole point.
import { div } from "gpui-kit";

const SKIN = "#f6d3b9", HAIR = "#7a4b32", SUIT = "#5b6f9e", INK = "#2a2230";

export function logo(size = 32) {
  const u = size / 16;
  const q = (v) => Math.round(v * u);
  const r = (x, y, w, h, c, rad = 0, line = null) => {
    const L = q(x), T = q(y);
    const el = div().absolute().left(L).top(T).w(Math.max(1, q(x + w) - L)).h(Math.max(1, q(y + h) - T)).bg(c).rounded(q(rad));
    return line ? el.border(1).border_color(line) : el;
  };
  const parts = [
    r(0, 0, 16, 16, "#1d2245", 4, "#9d8cf0"),
    // The window, its moon and a lit city; a plant on the left.
    r(9, 1.5, 5.5, 5.5, "#121633", 0.5, "#3a4170"), r(12, 2.25, 1.5, 1.5, "#f3e8c0", 0.75),
    r(9.5, 4, 2, 2.5, "#2a3262"), r(11.5, 4.75, 2.5, 1.75, "#2a3262"),
    ...[[10, 4.5], [10.5, 5.5], [12, 5.25], [13, 5.75]].map(([x, y]) => r(x, y, 0.5, 0.5, "#e9c45a")),
    r(1, 8.5, 3, 3, "#5fb565", 1.25, "#3c8a4c"), r(1.5, 11.25, 2, 2.25, "#d9844f", 0.4),
    // The chibi: hair, face, suit.
    r(4.25, 4.5, 7.5, 7, SKIN, 2.25, "#b07f66"),
    r(4, 3.75, 8, 3, HAIR, 1.5), r(4, 5, 1.5, 3, HAIR, 0.6), r(10.5, 5, 1.5, 3, HAIR, 0.6), r(6, 5.5, 3, 1.25, HAIR, 0.5),
    r(6, 8, 1, 1.5, INK, 0.5), r(9, 8, 1, 1.5, INK, 0.5), r(6, 8, 0.5, 0.5, "#ffffff"), r(9, 8, 0.5, 0.5, "#ffffff"),
    r(5, 9.75, 1.25, 0.75, "#f29a9a"), r(9.75, 9.75, 1.25, 0.75, "#f29a9a"), r(7.5, 10, 1, 0.5, "#7a3b3b"),
    r(4, 11.25, 8, 4, SUIT, 1.5), r(7, 11.25, 2, 1, "#fbf7ef", 0.4), r(7.75, 11.75, 0.5, 2, "#e6b94e"),
    // The laptop in front, its lid lit, on the desk's edge.
    r(4, 12.25, 8, 2.75, "#c9cfe0", 0.5, "#7d86a6"), r(7.5, 13.25, 1, 1, "#8aadf4", 0.5),
    r(3, 14.25, 10, 0.75, "#e0b07a", 0.3),
  ];
  return div().relative().size(size).flex_none().children(parts);
}
