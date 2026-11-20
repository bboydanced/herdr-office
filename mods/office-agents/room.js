// The Office's walls in blocks, as figure.js draws the desks: the sidebar's back
// wall (300x44 points) and the boss's office (900x136, its wall down to 64).
// A night office in the pixel-HQ manner: a dark wall, big windows onto a lit
// city, few things but big ones, each flat in two tones with a thin dark edge.
// Cells of 2 points, so every edge lands on a whole pixel; lit windows, LEDs
// and an antenna's light blink with native `.loop()` on opacity.
import { div } from "gpui-kit";
import { grid } from "./figure.js";

const NIGHT = {
  wall: "#181b33", wallTop: "#121428", floor: "#2b3050", floorTop: "#353b62", skirt: "#0f1124",
  tile: "#242738", joint: "#1f2231", tileLit: "#2c2f42",
  frame: "#0e1124", glass: "#121633", haze: "#171c40", far: "#1d2350", near: "#262d5c",
  lit: ["#e9c45a", "#f3dc93", "#e0a944"], farLit: "#8f7c4c", moon: "#f3e8c0", star: "#aab3d6", sill: "#5a6290", sillDark: "#3a4170",
  edge: "#0c0e1d", leaf: "#5fb565", leafDark: "#3c8a4c", leafHi: "#8fd68a",
  pot: "#e8e4dc", potDark: "#bdb7ab", terra: "#d9844f", terraDark: "#ae6236",
  ink: "#2a2230", red: "#f0645a", paper: "#eef0f7",
};
const BOOKS = ["#f0645a", "#f6d36a", "#8fc6ea", "#a6da95", "#c6aee8", "#f29a86"];

// The same picture on every render: a small deterministic random.
const seeded = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const twinkler = (id) => (el, key, from, to, period) => el.id(`${id}-${key}`).loop("opacity", { from, to, period });

// The sidebar's back wall, `w` x `h` points: the wall, then a strip of floor
// the things stand on (cells of 2 points, 150x22 at 300x44).
export function sidebarWall(id, w = 300, h = 44) {
  const g = grid(2);
  const { r } = g;
  const tw = twinkler(id);
  const W = w / 2, B = h / 2, F = B - 5;
  const p = [
    r(0, 0, W, F, NIGHT.wall), r(0, 0, W, 1, NIGHT.wallTop),
    r(0, F, W, B - F, NIGHT.floor), r(0, F, W, 0.5, NIGHT.floorTop), r(0, F - 0.5, W, 0.5, NIGHT.skirt),
    ...plant(g, 2, B - 1, "monstera"),
    ...cityWindow(g, tw, "w1", 14, 2, 27, 13, 7, false),
    ...clock(g, 44, 3, 10),
    ...cityWindow(g, tw, "w2", 57, 2, 27, 13, 19, true),
    ...cooler(g, 88, B - 1),
    ...rack(g, tw, 101, 1, B - 1),
    ...coffeeTable(g, tw, 116, B - 1),
    ...plant(g, 137, B - 1, "cactus"),
  ];
  return div().relative().w(w).h(h).flex_none().overflow_hidden().children(p);
}

// The boss's office, `w` x `h` points: the dark wall down to `wallH`, then a
// tiled floor like the room's. Behind the boss (left), a wide window and a rug;
// the wall stays clear for the band's words up to x 470, its things past it.
export function bossOffice(id, w = 900, h = 136, wallH = 64) {
  const g = grid(2);
  const { r } = g;
  const tw = twinkler(id);
  const W = w / 2, F = wallH / 2, B = h / 2;
  const p = [];
  const add = (...els) => p.push(...els);
  // The floor: 24-point tiles, a dark joint and a faint lit edge.
  add(r(0, F, W, B - F, NIGHT.tile));
  for (let y = F + 12; y < B; y += 12) add(r(0, y, W, 1, NIGHT.joint), r(0, y + 1, W, 0.5, NIGHT.tileLit));
  for (let x = 12; x < W; x += 12) add(r(x, F, 1, B - F, NIGHT.joint));
  // The wall, its skirting and the shadow it casts.
  add(r(0, 0, W, F, NIGHT.wall), r(0, 0, W, 1, NIGHT.wallTop), r(0, F - 1, W, 1, NIGHT.floor), r(0, F, W, 1, NIGHT.skirt));
  // Behind the boss: a wide window, a rug under its feet.
  add(...cityWindow(g, tw, "bw1", 3, 3, 44, 22, 3, true));
  add(r(2, B - 12, 44, 9, "#33407a", 4, NIGHT.edge), r(4, B - 10.5, 40, 6, "#00000000", 3, "#e9c45a"), r(6, B - 9, 36, 3, "#3d4c8f", 1.5));
  // Past the words: a clock, a poster, shelves with a trophy, plants, a second
  // window, a lamp and a sofa.
  add(...clock(g, 238, 6, 12));
  add(...poster(g, 256, 5, 18, 15));
  add(...shelf(g, 281, F + 3, 26, 5));
  add(...plant(g, 311, F + 3, "tall"));
  add(...cityWindow(g, tw, "bw2", 328, 3, 50, 22, 11, false));
  add(...lamp(g, 383, F + 3));
  add(...sofa(g, 396, F + 4));
  return div().relative().w(w).h(h).flex_none().overflow_hidden().children(p);
}

// A night window: a far, hazy skyline and a near one lit window by window
// (two of them and an antenna's light blinking), a moon or not, its bars and a sill.
function cityWindow(g, tw, key, x, y, w, h, seed, moon) {
  const { r } = g;
  const rand = seeded(seed * 7919);
  const ix = x + 1, iy = y + 1, iw = w - 2, ih = h - 2, bottom = iy + ih;
  const out = [r(x, y, w, h, NIGHT.frame, 1), r(ix, iy, iw, ih, NIGHT.glass), r(ix, bottom - Math.ceil(ih * 0.4), iw, Math.ceil(ih * 0.4), NIGHT.haze)];
  for (let i = 0; i < Math.max(2, Math.floor(iw / 8)); i++) out.push(r(ix + 1 + Math.floor(rand() * (iw - 3)), iy + 1 + Math.floor(rand() * 3), 0.5, 0.5, NIGHT.star));
  if (moon) out.push(r(ix + iw - 5, iy + 1, 3, 3, NIGHT.moon, 1.5), r(ix + iw - 4, iy + 0.5, 2.5, 2.5, NIGHT.glass, 1.25));
  // Far: low hazy blocks, a dim light here and there.
  for (let bx = ix; bx < ix + iw;) {
    const bw = Math.min(3 + Math.floor(rand() * 4), ix + iw - bx);
    const bh = Math.ceil(ih * 0.3) + Math.floor(rand() * ih * 0.3);
    out.push(r(bx, bottom - bh, bw, bh, NIGHT.far));
    if (rand() < 0.5 && bw > 2) out.push(r(bx + 1, bottom - bh + 1 + Math.floor(rand() * (bh - 2)), 0.5, 0.5, NIGHT.farLit));
    bx += bw;
  }
  // Near: taller blocks with a gap of sky between some, windows on a lattice.
  let twinkles = 0, antenna = false;
  for (let bx = ix + Math.floor(rand() * 2); bx < ix + iw - 1;) {
    const bw = Math.min(3 + Math.floor(rand() * 3) * 2, ix + iw - bx);
    const bh = Math.ceil(ih * 0.35) + Math.floor(rand() * ih * 0.4);
    const top = bottom - bh;
    out.push(r(bx, top, bw, bh, NIGHT.near));
    if (!antenna && bh > ih * 0.6 && bw >= 3) {
      antenna = true;
      const ax = bx + Math.floor(bw / 2);
      out.push(r(ax, top - 2, 0.5, 2, NIGHT.near), tw(r(ax - 0.25, top - 2.5, 1, 1, NIGHT.red, 0.5), `${key}-ant`, 1, 0.1, 1200));
    }
    for (let wy = top + 1; wy + 1 <= bottom - 1; wy += 2) {
      for (let wx = bx + 1; wx + 1 <= bx + bw - 1; wx += 2) {
        if (rand() > 0.45) continue;
        const lit = r(wx, wy, 1, 1, NIGHT.lit[Math.floor(rand() * 3)]);
        out.push(twinkles < 2 && rand() < 0.25 ? tw(lit, `${key}-t${twinkles++}`, 1, 0.2, 1500 + twinkles * 1100) : lit);
      }
    }
    bx += bw + (rand() < 0.3 ? 1 : 0);
  }
  // Bars: a transom, a mullion every 14 cells or so; the sill.
  const panes = Math.max(2, Math.round(iw / 14));
  for (let i = 1; i < panes; i++) out.push(r(ix + Math.round((iw * i) / panes) - 0.5, iy, 1, ih, NIGHT.frame));
  out.push(r(ix, iy + Math.round(ih * 0.38), iw, 1, NIGHT.frame));
  out.push(r(x - 1, y + h, w + 2, 1, NIGHT.sill, 0.5), r(x, y + h + 1, w, 0.5, NIGHT.sillDark));
  return out;
}

function clock(g, x, y, s) {
  const { r } = g;
  const c = s / 2;
  return [
    r(x, y, s, s, "#3a4170", s * 0.32, NIGHT.edge), r(x + 1, y + 1, s - 2, s - 2, NIGHT.paper, s * 0.28),
    ...[[c - 0.5, 1.5], [c - 0.5, s - 2.5], [1.5, c - 0.5], [s - 2.5, c - 0.5]].map(([tx, ty]) => r(x + tx, y + ty, 1, 1, "#9aa3c0")),
    r(x + c - 0.5, y + 2.5, 1, c - 2, NIGHT.ink), r(x + c, y + c - 0.5, c - 2, 1, NIGHT.ink), r(x + c - 0.5, y + c - 0.5, 1, 1, NIGHT.red, 0.5),
  ];
}

// A potted plant standing on `f`: a monstera in a white pot, a cactus in clay, or a tall fig.
function plant(g, x, f, kind) {
  const { r } = g;
  const { leaf, leafDark, leafHi, edge } = NIGHT;
  if (kind === "cactus") {
    return [
      r(x + 3.5, f - 15, 3.5, 11, leaf, 1.75, edge), r(x + 4.5, f - 14, 1, 8, leafHi, 0.5),
      r(x + 0.5, f - 12, 2.5, 4, leaf, 1.25, edge), r(x + 1.5, f - 9, 2.5, 1.5, leaf), r(x + 7.5, f - 13, 2.5, 4.5, leaf, 1.25, edge), r(x + 6.5, f - 10, 2, 1.5, leaf),
      r(x + 1.5, f - 5, 8, 5, NIGHT.terra, 1, edge), r(x + 7, f - 4.5, 1.5, 4, NIGHT.terraDark), r(x + 1, f - 5.5, 9, 1.5, NIGHT.terra, 0.5, edge),
    ];
  }
  if (kind === "tall") {
    return [
      r(x + 6.5, f - 14, 1, 8, "#6b4a33"),
      r(x + 1, f - 25, 12, 9, leafDark, 4, edge), r(x - 1, f - 20, 8, 7, leaf, 3, edge), r(x + 7, f - 21, 8, 7, leaf, 3, edge), r(x + 3, f - 27, 8, 7, leaf, 3, edge),
      r(x + 5, f - 26, 2, 2, leafHi, 1), r(x + 1, f - 18, 2, 2, leafHi, 1), r(x + 10, f - 19, 2, 2, leafHi, 1),
      r(x + 2, f - 7, 10, 7, NIGHT.pot, 1, edge), r(x + 9, f - 6, 2, 5, NIGHT.potDark),
    ];
  }
  return [
    r(x + 1, f - 15, 8, 8, leafDark, 3, edge), r(x - 1, f - 12, 5, 4.5, leaf, 2, edge), r(x + 6, f - 13, 5, 5, leaf, 2.5, edge), r(x + 2.5, f - 16, 4.5, 4.5, leaf, 2, edge),
    r(x + 3, f - 15, 1.5, 1.5, leafHi, 0.75), r(x + 7, f - 12, 1.5, 1.5, leafHi, 0.75), r(x + 4.5, f - 9, 1, 3, leafDark),
    r(x + 1.5, f - 6, 7, 6, NIGHT.pot, 1, edge), r(x + 6.5, f - 5, 1.5, 4, NIGHT.potDark),
  ];
}

function cooler(g, x, f) {
  const { r } = g;
  return [
    r(x + 1, f - 18, 7, 7, "#7fbde8", 2, NIGHT.edge), r(x + 2, f - 17, 1.5, 4, "#c4e4f8", 0.75), r(x + 3.5, f - 11.5, 2, 1, "#4f7fa8"),
    r(x, f - 11, 9, 11, NIGHT.paper, 1, NIGHT.edge), r(x + 7, f - 10, 1, 9, "#c9cee0"),
    r(x + 2, f - 8, 1.5, 1.5, NIGHT.red, 0.5), r(x + 5, f - 8, 1.5, 1.5, "#7fbde8", 0.5), r(x + 2, f - 5, 5, 1, "#a3abc4", 0.5),
  ];
}

function rack(g, tw, x, y, f) {
  const { r } = g;
  const leds = ["#a6da95", "#f0645a", "#8fd6c0", "#a6da95", "#f6d36a"];
  const out = [r(x, y, 11, f - y, "#20254a", 1, NIGHT.edge), r(x + 1, y + 1, 9, 0.5, "#2f3768")];
  leds.forEach((c, i) => {
    const uy = y + 2 + i * 3.5;
    const led = r(x + 2, uy + 0.75, 1, 1, c, 0.5);
    out.push(r(x + 1, uy, 9, 2.5, "#2a3160", 0.5), r(x + 4, uy + 1, 5, 0.5, "#3c4680"), i % 2 ? tw(led, `led${i}`, 1, 0.2, 500 + i * 230) : led);
  });
  return out;
}

// A small table with a coffee machine (its light on) and two cups.
function coffeeTable(g, tw, x, f) {
  const { r } = g;
  return [
    r(x + 1, f - 7, 1, 7, "#3a4170"), r(x + 16, f - 7, 1, 7, "#3a4170"),
    r(x, f - 8, 18, 1.5, "#c9cfe0", 0.5, NIGHT.edge),
    r(x + 2, f - 17, 7, 9, "#3a3f55", 1, NIGHT.edge), r(x + 3, f - 16, 5, 2, "#545a74", 0.5), tw(r(x + 3.5, f - 15.5, 1, 1, "#a6da95", 0.5), "coffee", 1, 0.3, 1800),
    r(x + 4, f - 11, 3, 2.5, NIGHT.paper, 0.5),
    r(x + 11, f - 10.5, 2.5, 2.5, "#f29a86", 0.75, NIGHT.edge), r(x + 14.5, f - 10.5, 2.5, 2.5, "#8fc6ea", 0.75, NIGHT.edge),
  ];
}

// A framed poster: bars going up.
function poster(g, x, y, w, h) {
  const { r } = g;
  const bars = [[2.5, 9, "#8aadf4"], [5.5, 7.5, "#a6da95"], [8.5, 8, "#f6d36a"], [11.5, 5, "#f29a86"], [14.5, 3, "#e9c45a"]];
  return [
    r(x, y, w, h, NIGHT.paper, 0.5, NIGHT.edge), r(x + 1.5, y + 1.5, w - 3, h - 3, "#2a3160"),
    ...bars.map(([px, py, c]) => r(x + px, y + py, 1.5, h - 3 - py, c, 0.25)),
  ];
}

// Low shelves standing on `f`: books on two shelves, a trophy on top.
function shelf(g, x, f, w, seed) {
  const { r } = g;
  const rand = seeded(seed * 104729);
  const top = f - 16;
  const out = [
    r(x + w / 2 - 2, top - 6, 4, 3, "#e9c45a", 1, NIGHT.edge), r(x + w / 2 - 0.5, top - 3, 1, 1.5, "#c9a040"), r(x + w / 2 - 2, top - 1.5, 4, 1.5, "#3a4170", 0.5),
    r(x, top, w, 16, "#3a4170", 1, NIGHT.edge), r(x + 1, top + 1, w - 2, 14, "#252b52", 0.5),
  ];
  for (const board of [top + 7.5, top + 15]) {
    out.push(r(x + 1, board - 0.5, w - 2, 1, "#3a4170"));
    for (let bx = x + 1.5; bx < x + w - 2.5;) {
      const bw = Math.min([1, 1.5, 2][Math.floor(rand() * 3)], x + w - 1.5 - bx);
      const bh = 3.5 + Math.floor(rand() * 5) * 0.5;
      if (rand() > 0.15) out.push(r(bx, board - 0.5 - bh, bw, bh, BOOKS[Math.floor(rand() * BOOKS.length)]));
      bx += bw + (rand() < 0.2 ? 1 : 0);
    }
  }
  return out;
}

function lamp(g, x, f) {
  const { r } = g;
  return [
    r(x + 3.5, f - 20, 1, 19, "#5b6488"), r(x + 1, f - 1.5, 6, 1.5, "#5b6488", 0.75),
    r(x, f - 25, 8, 5.5, "#f6d36a", 2, NIGHT.edge), r(x + 1, f - 24, 2, 3, "#fbe9a8", 1),
  ];
}

function sofa(g, x, f) {
  const { r } = g;
  const body = "#3fa39a", dark = "#2f7f78", hi = "#5cc0b5";
  return [
    r(x + 2, f - 13, 36, 8, dark, 2, NIGHT.edge), r(x + 3, f - 12, 34, 1, hi, 0.5),
    r(x, f - 8, 40, 6, body, 2, NIGHT.edge), r(x + 6, f - 7.5, 13.5, 3, hi, 1), r(x + 20.5, f - 7.5, 13.5, 3, hi, 1),
    r(x - 1, f - 10, 5, 8, body, 2, NIGHT.edge), r(x + 36, f - 10, 5, 8, body, 2, NIGHT.edge),
    r(x + 8, f - 12, 6, 4, "#f6d36a", 1.5, NIGHT.edge), r(x + 3, f - 2, 2, 2, NIGHT.edge), r(x + 35, f - 2, 2, 2, NIGHT.edge),
  ];
}
