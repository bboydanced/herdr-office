// Neon signs in blocks: letters and digits as tubes on a dark board. The glow
// and the tubes breathe together, and a sign can have one glyph that goes off
// now and then and buzzes as it comes back; all of it native `.loop()` on
// opacity (nested loops multiply), so nothing re-renders for it. Used by the
// boss's office and the sidebar's wall (room.js), each rug's room number
// (main.js), each door in Spaces and the side panels' buttons in the tab bar.
//
// A mod can't import outside its folder, so this file is the source and
// office-spaces/neon.js and office-tabs/neon.js are verbatim copies
// (test/lib.test.mjs fails when they drift): edit here, then copy.
import { div } from "gpui-kit";

export const NEON = "#ff7ab6";
export const BOARD = "#17122b";
const EDGE = "#0c0e1d", SHINE = "#2a2147", UNDER = "#7fe3f0", WIRE = "#3a4170";

// Six tube cells high: "#" a cell of tube. Capitals (text is set in capitals),
// digits, a space, "-" and ".".
const GLYPHS = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#"],
  B: ["###.", "#..#", "###.", "#..#", "#..#", "###."],
  C: [".###", "#...", "#...", "#...", "#...", ".###"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["####", "#...", "###.", "#...", "#...", "####"],
  F: ["####", "#...", "###.", "#...", "#...", "#..."],
  G: [".####", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["###", ".#.", ".#.", ".#.", ".#.", "###"],
  J: ["..##", "...#", "...#", "...#", "#..#", ".##."],
  K: ["#..#", "#.#.", "##..", "#.#.", "#..#", "#..#"],
  L: ["#...", "#...", "#...", "#...", "#...", "####"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["###.", "#..#", "#..#", "###.", "#...", "#..."],
  Q: [".###.", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["###.", "#..#", "#..#", "###.", "#.#.", "#..#"],
  S: [".###", "#...", ".##.", "...#", "...#", "###."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", ".#.#.", "..#..", "..#..", ".#.#.", "#...#"],
  Y: ["#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "...#.", "..#..", ".#...", "#....", "#####"],
  " ": ["..", "..", "..", "..", "..", ".."],
  "-": ["...", "...", "###", "...", "...", "..."],
  ".": [".", ".", ".", ".", ".", "#"],
  0: [".##.", "#..#", "#..#", "#..#", "#..#", ".##."],
  1: [".#.", "##.", ".#.", ".#.", ".#.", "###"],
  2: [".##.", "#..#", "...#", "..#.", ".#..", "####"],
  3: ["###.", "...#", ".##.", "...#", "...#", "###."],
  4: ["#..#", "#..#", "#..#", "####", "...#", "...#"],
  5: ["####", "#...", "###.", "...#", "...#", "###."],
  6: [".##.", "#...", "###.", "#..#", "#..#", ".##."],
  7: ["####", "...#", "..#.", ".#..", ".#..", ".#.."],
  8: [".##.", "#..#", ".##.", "#..#", "#..#", ".##."],
  9: [".##.", "#..#", "#..#", ".###", "...#", ".##."],
};
const glyphW = (ch) => GLYPHS[ch]?.[0].length ?? 2;
const caps = (text) => [...String(text).toUpperCase()];
// How wide `text` is in tube cells, a cell between glyphs.
const textW = (text) => caps(text).reduce((s, ch) => s + glyphW(ch) + 1, 0) - 1;
// A glyph's tubes: runs along its rows, merged down them where they line up.
function runsOf(rows) {
  const runs = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      if (row[x] !== "#") { x++; continue; }
      let e = x;
      while (e < row.length && row[e] === "#") e++;
      const up = runs.find((o) => o[0] === x && o[2] === e - x && o[1] + o[3] === y);
      if (up) up[3]++;
      else runs.push([x, y, e - x, 1]);
      x = e;
    }
  });
  return runs;
}
// Blocks on a grid of `u` points a cell, every edge on a whole point (as figure.js's grid).
function blocks(u) {
  const q = (v) => Math.round(v * u);
  return (x, y, w, h, c, rad = 0, line = null) => {
    const L = q(x), T = q(y);
    const el = div().absolute().left(L).top(T).w(Math.max(1, q(x + w) - L)).h(Math.max(1, q(y + h) - T)).bg(c).rounded(q(rad));
    return line ? el.border(Math.max(1, Math.round(u * 0.5))).border_color(line) : el;
  };
}
// The same sign breathes at the same pace on every render; signs side by side don't.
const pace = (s) => 2000 + ([...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7) % 6) * 170;
const tone = (c) => (typeof c === "string" && /^#[0-9a-fA-F]{6}/.test(c) ? c.slice(0, 7) : NEON);
const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const hex = (v) => `#${v.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("")}`;
const whiter = (c, k) => hex(rgb(c).map((x) => x + (255 - x) * k));
// A colour bright enough for a tube: a dark one is lifted toward white until it reads as lit.
export function neonColor(color) {
  const c = tone(color);
  const [r, g, b] = rgb(c).map((x) => x / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum >= 0.62 ? c : whiter(c, (0.62 - lum) / (1 - lum));
}

// A neon tube round its parent (made relative), `radius` its corners: the
// tube `width` points thick in `color` lifted bright, at `alpha` (two hex
// digits). With `glow` (an alpha), a ring of glow just outside it that
// breathes; without, the tube itself breathes, softly. Neither moves when not
// `breathe`. Absolute children to add after the parent's own; nothing is drawn
// inside the tube.
export function neonFrame(id, color, radius, { width = 1, breathe = true, glow = null, alpha = "ff" } = {}) {
  const c = neonColor(color);
  const breathing = (el, key, to) => (breathe ? el.id(`${id}-${key}`).loop("opacity", { from: 1, to, period: pace(id) }) : el);
  const tube = div().absolute().top(0).left(0).right(0).bottom(0).rounded(radius).border(width)
    .border_color(`${whiter(c, 0.15)}${alpha === "ff" ? "" : alpha}`);
  if (!glow) return [breathing(tube, "tube", 0.45)];
  const ring = div().absolute().top(-2).left(-2).right(-2).bottom(-2).rounded(radius + 2).border(2).border_color(`${c}${glow}`);
  return [breathing(ring, "glow", 0.3), tube];
}

// A sign at (x, y) on a grid of `u` points a cell: `text` in tubes `unit`
// cells thick on a dark board padded `pad` x `padY` tube cells; hung on two
// wires from row `hang` when given, a cyan line under the text when
// `underline`, glyph `flicker` (an index) going off now and then. Not `lit`,
// the sign is off: dim tubes, no glow, nothing moving. `id` keys its loops.
// { w, h, parts }: the board's size in cells and its blocks.
export function neonBoard(u, id, x, y, text, { unit = 1, color = NEON, pad = 1, padY = 1, hang = null, underline = false, flicker = null, lit = true } = {}) {
  const r = blocks(u);
  const c = neonColor(color);
  // Lit, a white-hot core; off, the bare tube.
  const ink = lit ? whiter(c, 0.22) : `${c}b3`;
  const tw = textW(text) * unit;
  const w = tw + 2 * pad * unit, h = (6 + 2 * padY) * unit;
  const tx = x + pad * unit, ty = y + padY * unit;
  const ms = pace(`${id}${text}`);
  const loop = (el, key, from, to, period, easing = "ease-in-out") => (lit ? el.id(`${id}-${key}`).loop("opacity", { from, to, period, easing }) : el);
  const box = (bx, by, bw, bh) => r(bx, by, bw, bh, "#00000000");
  const glyphs = [];
  let at = 0;
  caps(text).forEach((ch, i) => {
    const gw = glyphW(ch) * unit;
    const tubes = (ox) => runsOf(GLYPHS[ch] ?? []).map(([rx, ry, rw, rh]) => r(ox + rx * unit, ry * unit, rw * unit, rh * unit, ink, unit * 0.3));
    if (lit && i === flicker) {
      // Off for a moment now and then (a slow dip that drops fast), humming as it comes back.
      const hum = loop(box(0, 0, gw, 6 * unit).children(tubes(0)), "hum", 1, 0.75, 180, "linear");
      glyphs.push(loop(box(at, 0, gw, 6 * unit).child(hum), "flick", 1, 0.04, 3100, "ease-in"));
    } else glyphs.push(...tubes(at));
    at += gw + unit;
  });
  const parts = [
    ...(hang === null ? [] : [r(x + Math.min(6, w / 5), hang, 0.5, y - hang, WIRE), r(x + w - Math.min(6, w / 5) - 0.5, hang, 0.5, y - hang, WIRE)]),
    ...(lit ? [loop(r(x - 2 * unit, y - 1.5 * unit, w + 4 * unit, h + 3 * unit, `${c}55`, 4 * unit), "glow", 1, 0.35, ms)] : []),
    r(x, y, w, h, BOARD, unit, EDGE), r(x + unit, y + 0.5, w - 2 * unit, 0.5, SHINE),
    loop(box(tx, ty, tw, 6 * unit).children(glyphs), "tubes", 1, 0.82, ms),
    ...(underline ? [loop(r(tx, ty + 6.75 * unit, tw, 0.5, UNDER, 0.25), "under", 1, 0.6, ms)] : []),
  ];
  return { w, h, parts };
}

// A neon sign on its own, `u` points a tube cell: { w, h } in points, then the
// element (`opts` as neonBoard's: `lit`, `flicker`…).
export const signSize = (text, u = 2) => ({ w: (textW(text) + 2) * u, h: 8 * u });
export function neonSign(id, text, color = NEON, u = 2, opts = {}) {
  const sign = neonBoard(u, id, 0, 0, text, { ...opts, color });
  return div().relative().w(sign.w * u).h(sign.h * u).flex_none().children(sign.parts);
}
