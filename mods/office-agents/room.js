// The Office's walls in blocks, as figure.js draws the desks: the sidebar's back
// wall (300x44 points) and the boss's office (900x136, its wall down to 64).
// A night office in the pixel-HQ manner: a dark wall, big windows onto a lit
// city, few things but big ones, each flat in two tones with a thin dark edge.
// Cells of 2 points, so every edge lands on a whole pixel; lit windows, LEDs
// and an antenna's light blink with native `.loop()` on opacity.
import { div } from "gpui-kit";
import { grid } from "./figure.js";
import { neonBoard } from "./neon.js";

const NIGHT = {
  wall: "#181b33", wallTop: "#121428", floor: "#2b3050", floorTop: "#353b62", skirt: "#0f1124",
  tile: "#242738", joint: "#1f2231", tileLit: "#2c2f42",
  frame: "#0e1124", glass: "#121633", haze: "#171c40", far: "#1d2350", near: "#262d5c",
  lit: ["#e9c45a", "#f3dc93", "#e0a944"], farLit: "#8f7c4c", moon: "#f3e8c0", star: "#aab3d6", sill: "#5a6290", sillDark: "#3a4170",
  edge: "#0c0e1d",
  ink: "#2a2230", red: "#f0645a", paper: "#eef0f7",
  panel: "#1b1f3b", panelIn: "#1e2342", panelEdge: "#13162b", rail: "#262b4d", railHi: "#30365e",
};
const BOOKS = ["#f0645a", "#f6d36a", "#8fc6ea", "#a6da95", "#c6aee8", "#f29a86"];

// The same picture on every render: a small deterministic random.
const seeded = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const twinkler = (id) => (el, key, from, to, period) => el.id(`${id}-${key}`).loop("opacity", { from, to, period });

// Things whose left edge (in cells) is past `shown` points are left out: what
// holds the picture clips them anyway, and every block is a node to lay out.
const upTo = (shown) => (x, draw) => (x * 2 < shown ? draw() : []);

// The sidebar's back wall, `w` x `h` points: the wall, then a strip of floor
// the things stand on (cells of 2 points, 150x22 at 300x44). In neon as the
// boss's office is: a plant swaying, between its windows the OA sign, small,
// a cooler's bottle bubbling, a rack's lights blinking and scanning, a cup
// steaming on the coffee table and a cactus with its flower blinking.
export function sidebarWall(id, w = 300, h = 44, shown = w) {
  const g = grid(2);
  const { r } = g;
  const tw = twinkler(id);
  const fits = upTo(shown);
  const W = w / 2, B = h / 2, F = B - 5;
  const p = [
    r(0, 0, W, F, NIGHT.wall), r(0, 0, W, 1, NIGHT.wallTop),
    r(0, F, W, B - F, NIGHT.floor), r(0, F, W, 0.5, NIGHT.floorTop), r(0, F - 0.5, W, 0.5, NIGHT.skirt),
    ...neonPlant(g, `${id}-fern`, 1, B - 1, "mini"),
    ...fits(13, () => cityWindow(g, tw, "w1", 14, 2, 27, 13, 7, false)),
    ...fits(42.5, () => neonBoard(2, `${id}-oa`, 42.5, 3, "OA", { hang: 1, flicker: 1 }).parts),
    ...fits(56, () => cityWindow(g, tw, "w2", 57, 2, 27, 13, 19, true)),
    ...fits(88, () => cooler(g, `${id}-cooler`, 88, B - 1)),
    ...fits(101, () => rack(g, tw, `${id}-rack`, 101, 1, B - 1)),
    ...fits(116, () => coffeeTable(g, `${id}-coffee`, 116, B - 1)),
    ...fits(136, () => neonCactus(g, `${id}-cactus`, 137, B - 1)),
  ];
  return div().relative().w(w).h(h).flex_none().overflow_hidden().children(p);
}

// The boss's office, `w` x `h` points: the dark wall down to `wallH`, then a
// tiled floor like the room's. Behind the boss (left), a wide window and a rug;
// the wall stays clear for the band's words up to x 470, its things past it.
export function bossOffice(id, w = 900, h = 136, wallH = 64, shown = w) {
  const g = grid(2);
  const { r } = g;
  const tw = twinkler(id);
  const fits = upTo(shown);
  const W = w / 2, F = wallH / 2, B = h / 2;
  const p = [];
  const add = (...els) => p.push(...els);
  // The floor: 24-point tiles, a dark joint and a faint lit edge.
  add(r(0, F, W, B - F, NIGHT.tile));
  for (let y = F + 12; y < B; y += 12) add(r(0, y, W, 1, NIGHT.joint), r(0, y + 1, W, 0.5, NIGHT.tileLit));
  for (let x = 12; x < W; x += 12) add(...fits(x, () => [r(x, F, 1, B - F, NIGHT.joint)]));
  // The wall, its skirting and the shadow it casts; panelling along its foot
  // and strip lights under the ceiling, which read the same behind the words.
  add(r(0, 0, W, F, NIGHT.wall), r(0, 0, W, 1, NIGHT.wallTop), r(0, F - 1, W, 1, NIGHT.floor), r(0, F, W, 1, NIGHT.skirt));
  add(...wainscot(g, fits, W, F - 12, F - 1));
  for (const x of [58, 122, 282, 392]) add(...fits(x - 1, () => tubeLight(g, x, 26)));
  // Behind the boss: a wide window, a rug under its feet.
  add(...cityWindow(g, tw, "bw1", 3, 3, 44, 22, 3, true));
  add(r(2, B - 12, 44, 9, "#33407a", 4, NIGHT.edge), r(4, B - 10.5, 40, 6, "#00000000", 3, "#e9c45a"), r(6, B - 9, 36, 3, "#3d4c8f", 1.5));
  // Where the words end: a neon plant at the wall's foot and the OA (Office
  // Agent) sign in neon, its A flickering now and then.
  add(...fits(171, () => neonPlant(g, `${id}-fern`, 172, F + 3)));
  add(...fits(185, () => neonBoard(2, `${id}-oa`, 188, 3.5, "OA", { unit: 1.5, pad: 6.5, padY: 2, hang: 1, underline: true, flicker: 1 }).parts));
  // Past the words, neon among the furniture (the sidebar wall's too): a cactus
  // with its flower blinking, a clock ticking over a printer on a cabinet, a
  // chart with its bars rising over a cooler bubbling and a rack blinking and
  // scanning, shelves with a trophy, a tall plant swaying, a second window over
  // a sideboard, a cup steaming on a side table, a sofa and a lamp.
  add(...fits(224, () => neonCactus(g, `${id}-cactus`, 225, F + 3)));
  add(...fits(236, () => cabinet(g, tw, 236, F + 3)));
  add(...fits(236, () => neonClock(g, `${id}-clock`, 238, 6, 12)));
  add(...fits(252, () => cooler(g, `${id}-cooler`, 252, F + 3)));
  add(...fits(255, () => neonChart(g, `${id}-chart`, 256, 3, 18, 12)));
  add(...fits(264, () => rack(g, tw, `${id}-rack`, 264, 17, F + 3)));
  add(...fits(281, () => shelf(g, 281, F + 3, 26, 5)));
  add(...fits(310, () => neonPlant(g, `${id}-fig`, 311, F + 3, "tall")));
  add(...fits(327, () => cityWindow(g, tw, "bw2", 328, 3, 50, 22, 11, false)));
  add(...fits(330, () => sideboard(g, 330, F + 3, 46)));
  add(...fits(377, () => coffeeTable(g, `${id}-coffee`, 377, F + 3)));
  add(...fits(398, () => sofa(g, 399, F + 4)));
  add(...fits(441, () => lamp(g, 441, F + 3)));
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

// Panelling from `top` down to `bottom`: a rail, then a row of sunk panels.
function wainscot(g, fits, W, top, bottom) {
  const { r } = g;
  const out = [r(0, top, W, bottom - top, NIGHT.panel), r(0, top, W, 1, NIGHT.rail), r(0, top, W, 0.5, NIGHT.railHi)];
  for (let x = 2; x < W - 4; x += 20) {
    out.push(...fits(x, () => [r(x, top + 2.5, Math.min(17, W - 2 - x), bottom - top - 4, NIGHT.panelIn, 0.5, NIGHT.panelEdge)]));
  }
  return out;
}

// A strip light `w` cells long under the ceiling at `x`: its housing, the lit
// tube and a faint glow just below, all above the band's first row of words.
function tubeLight(g, x, w) {
  const { r } = g;
  return [
    r(x - 1, 3, w + 2, 2.5, "#eef0f712", 1.25),
    r(x, 1, w, 1.5, "#3a4170", 0.5, NIGHT.edge), r(x + 1, 2.5, w - 2, 0.5, "#f4f1e4"),
  ];
}

// Neon pieces for the boss's wall, in cells: tubes 2 points thick with a ring
// of glow round them, bars of light, boxes to hold things, and loops keyed by `id`.
const GLOW = { cyan: "#7fe3f0", pink: "#ff7ab6", green: "#7dffa0", gold: "#ffe27a", orange: "#ff9a5a", violet: "#c6a0f6" };
function neonKit(g, id) {
  const { q } = g;
  const box = (x, y, w, h) => div().absolute().left(q(x)).top(q(y)).w(Math.max(1, q(x + w) - q(x))).h(Math.max(1, q(y + h) - q(y)));
  const tube = (x, y, w, h, c, rad = 0) => [
    box(x - 1, y - 1, w + 2, h + 2).rounded(q(rad + 1)).border(2).border_color(`${c}40`),
    box(x, y, w, h).rounded(q(rad)).border(2).border_color(c),
  ];
  const bar = (x, y, w, h, c, rad = 0) => box(x, y, w, h).rounded(q(rad)).bg(c);
  const loop = (el, key, prop, from, to, period, easing) => el.id(`${id}-${key}`).loop(prop, { from, to, period, ...(easing ? { easing } : {}) });
  return { q, box, tube, bar, loop };
}

// A neon clock `s` cells across: a cyan ring with its four marks, pink hands,
// a second hand ticking between two places and a halo breathing round it.
function neonClock(g, id, x, y, s) {
  const k = neonKit(g, id);
  const c = s / 2;
  return [
    k.loop(k.box(x - 2, y - 2, s + 4, s + 4).rounded(k.q(c + 2)).bg(`${GLOW.cyan}1f`), "halo", "opacity", 1, 0.3, 2400),
    ...k.tube(x, y, s, s, GLOW.cyan, c),
    k.bar(x + c - 0.5, y + 1.5, 1, 1.5, GLOW.cyan), k.bar(x + c - 0.5, y + s - 3, 1, 1.5, GLOW.cyan),
    k.bar(x + 1.5, y + c - 0.5, 1.5, 1, GLOW.cyan), k.bar(x + s - 3, y + c - 0.5, 1.5, 1, GLOW.cyan),
    k.bar(x + c - 0.5, y + 3, 1, c - 2.5, GLOW.pink, 0.5), k.bar(x + c - 3, y + c - 0.5, 3, 1, GLOW.pink, 0.5),
    k.loop(k.bar(x + c, y + c - 0.25, c - 2, 0.5, GLOW.gold), "tick", "opacity", 1, 0, 2000, "ease-in"),
    k.loop(k.bar(x + c - 0.25, y + c, 0.5, c - 2, GLOW.gold), "tock", "opacity", 0, 1, 2000, "ease-in"),
    k.loop(k.bar(x + c - 1, y + c - 1, 2, 2, "#ffffff", 1), "pin", "opacity", 1, 0.5, 1000),
  ];
}

// A neon plant standing on `f` at `x`: a pot outlined in orange, a stem and
// green leaves, the leaves swaying a little. `tall`: a bigger one, more leaves.
// A leaf: an oval of tube with its midrib along it, in a plant's box.
const PLANTS = {
  mini: { pot: [1.5, 4.5, 6], stem: [4.25, 9.5, 5], box: [12, 8, 16], leaves: [[0, 3.5, 5.5, 3.5], [6.5, 3, 5.5, 3.5], [3.25, 0, 5.5, 3.5]] },
  small: { pot: [2, 6, 8], stem: [5.5, 13, 7], box: [16, 12, 20], leaves: [[0, 6, 7, 4.5], [9, 5, 7, 4.5], [4.5, 0, 7, 4.5]] },
  tall: { pot: [2.5, 6, 10], stem: [6.9, 16, 10], box: [17, 20, 30], leaves: [[0, 9, 8, 4.5], [9, 8, 8, 4.5], [0.5, 2, 8, 4.5], [8.5, 0, 8, 4.5], [4.5, 14, 8, 4]] },
};

// A neon plant standing on `f` at `x`: a pot outlined in orange, a stem and
// green leaves, the leaves swaying a little. `size`: mini, small or tall.
function neonPlant(g, id, x, f, size = "small") {
  const k = neonKit(g, id);
  const P = PLANTS[size];
  const pot = [x + P.pot[0], f - P.pot[1], P.pot[2], P.pot[1]];
  const stem = k.bar(x + P.stem[0], f - P.stem[1], 1, P.stem[2], GLOW.green);
  // The leaves in a box of their own (positions inside it), which sways.
  const [lw, lh, rise] = P.box;
  const leaf = (lx, ly, w, h) => [...k.tube(lx, ly, w, h, GLOW.green, Math.min(w, h) / 2), k.bar(lx + 2, ly + h / 2 - 0.25, w - 4, 0.5, `${GLOW.green}b3`)];
  return [
    k.loop(k.box(x - 1, f - rise, lw, lh).children(P.leaves.flatMap((l) => leaf(...l))), "sway", "left", k.q(x - 1), k.q(x - 1) + 2, size === "tall" ? 3000 : 2400),
    stem,
    ...k.tube(...pot, GLOW.orange, 1),
    k.bar(pot[0] + 1, pot[1] + 1.5, pot[2] - 2, 0.5, `${GLOW.orange}80`),
  ];
}

// A neon chart in a violet frame: five bars of light rising and falling, each
// at its own pace (anchored at the bottom, so they grow up).
function neonChart(g, id, x, y, w, h) {
  const k = neonKit(g, id);
  const inner = h - 3;
  const bars = [[0.55, GLOW.cyan], [0.4, GLOW.green], [0.7, GLOW.gold], [0.5, GLOW.orange], [0.85, GLOW.pink]];
  const step = (w - 3) / bars.length;
  return [
    ...k.tube(x, y, w, h, GLOW.violet, 1),
    k.box(x + 1.5, y + 1.5, w - 3, inner).children(bars.map(([v, c], i) => {
      const lo = k.q(inner * v * 0.55), hi = k.q(inner * v);
      return div().id(`${id}-bar${i}`).absolute().left(k.q(i * step + 0.5)).bottom(0).w(k.q(step - 1)).h(hi).rounded(1).bg(c)
        .loop("height", { from: hi, to: lo, period: 1300 + i * 370 });
    })),
  ];
}

// A low filing cabinet standing on `f`, a printer on it with its light on.
function cabinet(g, tw, x, f) {
  const { r } = g;
  const top = f - 9;
  return [
    r(x, top, 14, 9, "#3a4170", 1, NIGHT.edge),
    r(x + 1.5, top + 1.5, 11, 2.5, "#454e7e", 0.5), r(x + 1.5, top + 5, 11, 2.5, "#454e7e", 0.5),
    r(x + 6, top + 2.5, 2, 0.5, "#9aa3c0"), r(x + 6, top + 6, 2, 0.5, "#9aa3c0"),
    r(x + 2.5, top - 6, 9, 1.5, "#c9cee0", 0.25), r(x + 0.5, top - 5, 13, 5, NIGHT.paper, 1, NIGHT.edge),
    r(x + 2, top - 2.5, 7, 0.5, NIGHT.ink), tw(r(x + 10.5, top - 3.5, 1, 1, "#a6da95", 0.5), "printer", 1, 0.3, 2000),
  ];
}

// A low sideboard `w` cells long standing on `f`: three doors, books and a cup on it.
function sideboard(g, x, f, w) {
  const { r } = g;
  const top = f - 6;
  const dw = (w - 3) / 3;
  const out = [r(x, top, w, 6, "#3a4170", 1, NIGHT.edge), r(x + 1, top + 0.5, w - 2, 0.5, "#4a5284")];
  for (let i = 0; i < 3; i++) {
    const dx = x + 1.5 + i * dw;
    out.push(r(dx, top + 1.5, dw - 1, 3.5, "#454e7e", 0.5), r(dx + dw / 2 - 1, top + 3, 1, 0.5, "#9aa3c0"));
  }
  out.push(
    r(x + 4, top - 3, 1.5, 3, BOOKS[0]), r(x + 5.5, top - 2.5, 1.5, 2.5, BOOKS[2]), r(x + 7, top - 3, 1.5, 3, BOOKS[3]),
    r(x + w - 7, top - 2, 2.5, 2, "#f29a86", 0.75, NIGHT.edge),
  );
  return out;
}

// A water cooler: its bottle a cyan neon outline with bubbles rising and
// falling in it, on the white dispenser.
function cooler(g, id, x, f) {
  const { r } = g;
  const k = neonKit(g, id);
  const bubble = (bx, from, to, period, key) => k.loop(k.bar(bx, from, 1, 1, "#e6fbff", 0.5), key, "top", k.q(from), k.q(to), period);
  return [
    ...k.tube(x + 1, f - 18, 7, 6.5, GLOW.cyan, 2), k.bar(x + 3.5, f - 11.5, 2, 0.5, GLOW.cyan),
    bubble(x + 3, f - 13.5, f - 16.5, 1500, "b1"), bubble(x + 5, f - 13, f - 17, 2100, "b2"),
    r(x, f - 11, 9, 11, NIGHT.paper, 1, NIGHT.edge), r(x + 7, f - 10, 1, 9, "#c9cee0"),
    r(x + 2, f - 8, 1.5, 1.5, NIGHT.red, 0.5), r(x + 5, f - 8, 1.5, 1.5, "#7fbde8", 0.5), r(x + 2, f - 5, 5, 1, "#a3abc4", 0.5),
  ];
}

// A server rack from `y` down to `f`: as many units as fit (up to five), their
// lights in neon colours each blinking at its own pace, and a line of cyan
// light scanning down its front.
function rack(g, tw, id, x, y, f) {
  const { r } = g;
  const k = neonKit(g, id);
  const leds = [GLOW.green, GLOW.pink, GLOW.cyan, GLOW.green, GLOW.gold].slice(0, Math.max(1, Math.floor((f - y - 2.5) / 3.5)));
  const out = [r(x, y, 11, f - y, "#20254a", 1, NIGHT.edge), r(x + 1, y + 1, 9, 0.5, "#2f3768")];
  leds.forEach((c, i) => {
    const uy = y + 2 + i * 3.5;
    out.push(r(x + 1, uy, 9, 2.5, "#2a3160", 0.5), r(x + 4, uy + 1, 5, 0.5, "#3c4680"), tw(r(x + 2, uy + 0.75, 1, 1, c, 0.5), `led${i}`, 1, 0.2, 400 + i * 230));
  });
  out.push(k.loop(k.bar(x + 1, y + 1.5, 9, 0.5, `${GLOW.cyan}99`), "scan", "top", k.q(y + 1.5), k.q(f - 2), 2600, "linear"));
  return out;
}

// A small table with a neon cup on it, steam rising off it and fading, and a
// cup of its own beside it.
function coffeeTable(g, id, x, f) {
  const { r } = g;
  const k = neonKit(g, id);
  // A wisp of steam: rising (the outer box) and fading (the inner one).
  const wisp = (sx, period, key) => k.loop(k.box(sx, f - 16, 0.5, 2.5),
    key, "top", k.q(f - 16), k.q(f - 19), period).child(k.loop(div().absolute().top(0).left(0).w(1).h(k.q(2.5)).bg("#f4f1e4"), `${key}-o`, "opacity", 0.9, 0, period));
  return [
    r(x + 1, f - 7, 1, 7, "#3a4170"), r(x + 16, f - 7, 1, 7, "#3a4170"),
    r(x, f - 8, 18, 1.5, "#c9cfe0", 0.5, NIGHT.edge),
    ...k.tube(x + 3, f - 13.5, 6, 5, GLOW.orange, 1.5), ...k.tube(x + 9, f - 12.5, 2.5, 3, GLOW.orange, 1),
    wisp(x + 4.5, 1700, "w1"), wisp(x + 6, 2200, "w2"), wisp(x + 7.5, 1900, "w3"),
    r(x + 14, f - 10.5, 2.5, 2.5, "#8fc6ea", 0.75, NIGHT.edge),
  ];
}

// A neon cactus in an orange pot: its arms off the trunk, a pink flower on
// top blinking, a green halo breathing round it.
function neonCactus(g, id, x, f) {
  const k = neonKit(g, id);
  return [
    k.loop(k.box(x - 1, f - 17, 12, 13).rounded(k.q(4)).bg(`${GLOW.green}17`), "halo", "opacity", 1, 0.3, 2600),
    ...k.tube(x + 3.5, f - 14, 3.5, 9.5, GLOW.green, 1.75),
    ...k.tube(x + 0.5, f - 11.5, 2.5, 4, GLOW.green, 1.25), k.bar(x + 2.5, f - 9, 1.5, 1, GLOW.green),
    ...k.tube(x + 7.5, f - 12.5, 2.5, 4.5, GLOW.green, 1.25), k.bar(x + 6.5, f - 10, 1.5, 1, GLOW.green),
    k.loop(k.bar(x + 4.5, f - 15.5, 1.5, 1.5, GLOW.pink, 0.75), "flower", "opacity", 1, 0.25, 1300),
    ...k.tube(x + 1.5, f - 4.5, 8, 4.5, GLOW.orange, 1),
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
