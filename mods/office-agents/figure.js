// A desk drawn in rounded blocks: the staff member as a chibi (big round head,
// shiny eyes, rosy cheeks), the monitor on the left, the chair behind, the desk
// in front. Laid out on a 36x30 grid; a desk is drawn
// at a whole number of points per grid unit and every edge is rounded to a whole
// point, so nothing lands between two pixels and blurs. The big shapes carry a
// dark outline (as pixel art does) so hair, face, chair and desk stay apart.
// Motion is native `.loop()` on top/opacity: it runs only while on screen.
import { div } from "gpui-kit";

// What each role looks like: skin, hair (colour and cut), outfit, extras.
const SKIN = "#f6d3b9";
export const LOOKS = {
  manager: { hair: "#7a4b32", cut: "side", outfit: "#5b6f9e", extra: ["tie"] },
  developer: { hair: "#4a3226", cut: "messy", outfit: "#f2b49a", extra: ["headphones"] },
  designer: { hair: "#f3a9c4", cut: "long", outfit: "#c6aee8", extra: ["clip"] },
  analyst: { hair: "#f1d27e", cut: "pony", outfit: "#9cc8ef", extra: ["glasses"] },
  writer: { hair: "#c9ccd6", cut: "side", outfit: "#efe3c6", extra: ["glasses"] },
  tester: { hair: "#5a3a28", cut: "afro", outfit: "#e8c76a", skin: "#b07a56" },
  support: { hair: "#a2512f", cut: "long", outfit: "#f29a86", extra: ["headset"] },
  intern: { hair: "#6b4630", cut: "cap", outfit: "#f6d76e", extra: ["freckles"] },
};

const WOOD = { top: "#e0b07a", front: "#c48f5f", lip: "#a8744b", drawer: "#b07c50", line: "#6e4529" };
const CHAIR = { back: "#454e6e", hi: "#55608a", line: "#1f2333", leg: "#2b3044", wheel: "#1c2030" };
const BEZEL = "#2b3044";
const INK = "#3a2a26";
const WHITE = "#fbf7ef";
const CHEEK = "#f29a9a99";
const SHOE = "#4a3a36";
const SCREEN_OFF = "#171b29";

// Grid units to whole points: `u` points a unit, the drawing moved by (ox, oy).
// r(): a block (outlined when `line` is given); rel(): a block inside another.
export function grid(u, ox = 0, oy = 0, ow = Math.max(1, Math.round(u * 0.5))) {
  const q = (v) => Math.round(v * u);
  const box = (x, y, bw, bh, c, rad) => {
    const L = q(x), T = q(y);
    return div().absolute().left(L).top(T).w(Math.max(1, q(x + bw) - L)).h(Math.max(1, q(y + bh) - T)).bg(c).rounded(q(rad));
  };
  const r = (x, y, bw, bh, c, rad = 0, line = null) => {
    const el = box(x + ox, y + oy, bw, bh, c, rad);
    return line ? el.border(ow).border_color(line) : el;
  };
  const rel = (x, y, bw, bh, c, rad = 0, line = null) => {
    const el = box(x, y, bw, bh, c, rad);
    return line ? el.border(ow).border_color(line) : el;
  };
  const pad = ow / u;
  // Pixel rows (".": nothing, "b": base, other letters: `pal` colours) to
  // blocks: runs merged down the rows, the silhouette outlined in `line`.
  const sprite = (x0, y0, rows, pal, line) => {
    const sil = [], acc = [];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        if (row[x] === ".") { x++; continue; }
        let e = x;
        while (e < row.length && row[e] !== ".") e++;
        sil.push([x, y, e - x, "b"]);
        for (let i = x; i < e;) {
          let j = i;
          while (j < e && row[j] === row[i]) j++;
          if (row[i] !== "b") acc.push([i, y, j - i, row[i]]);
          i = j;
        }
        x = e;
      }
    });
    const merge = (list) => {
      const out = [];
      for (const [x, y, w, k] of list) {
        const up = out.find((o) => o[0] === x && o[2] === w && o[4] === k && o[1] + o[3] === y);
        if (up) up[3]++;
        else out.push([x, y, w, 1, k]);
      }
      return out;
    };
    const body = merge(sil);
    return [
      ...(line ? body.map(([x, y, w, h]) => r(x0 + x - pad, y0 + y - pad, w + 2 * pad, h + 2 * pad, line)) : []),
      ...body.map(([x, y, w, h]) => r(x0 + x, y0 + y, w, h, pal.b)),
      ...merge(acc).map(([x, y, w, h, k]) => r(x0 + x, y0 + y, w, h, pal[k])),
    ];
  };
  return { u, q, r, rel, ow, ox, oy, sprite };
}

// Hair, 20 cells across from grid x 12 (the head spans cells 2.6-17.4, eyes
// start on row 8): "b" base, "s" shadow, "h" shine. FRONT goes over the face,
// leaving it a hole; BACK goes behind the head.
const FRONT = {
  side: [
    "....................",
    "......bbbbbbbb......",
    "....bbhhhbbbbbbb....",
    "...bhhbbbbbbbbbbb...",
    "..bbbbbsbbbbbbbbbb..",
    "..bbbb..sbbbbbbbbb..",
    "..bbb.....ssbbbbbb..",
    "..bb........sssbbb..",
    "..bb............bb..",
    "..sb............bs..",
  ],
  messy: [
    "....................",
    ".....b...bb...b.....",
    "....bbhhbbbbbbbb....",
    "...bhhbbbbbbbbbbb...",
    "..bbbbbbbbbbbbbbbb..",
    "..bbbbbbbbbbbbbbbb..",
    "..bbsbbbbsbbbsbbbb..",
    "..bs.sbs..sbs.sbsb..",
    "..bb............bb..",
    "..sb............bs..",
  ],
  long: [
    "....................",
    "......bbbbbbbb......",
    "....bbhhhbbbbbbb....",
    "...bhhbbbbbbbbbbb...",
    "..bbbbbbbsbbbbbbbb..",
    "..bbbbbbs.sbbbbbbb..",
    "..bbbbbs...sbbbbbb..",
    "..bsbbs.....sbbsbb..",
    "..bb............bb..",
    "..bb............bb..",
    "..bs............sb..",
    "..bb............bb..",
    "..sb............bs..",
    "...s............s...",
  ],
  pony: [
    "....................",
    "......bbbbbbbb......",
    "....bbhhhbbbbbbb....",
    "...bhhbbbbbbbbbbb...",
    "..bbbbbbbsbbbbbbbb..",
    "..bbbbbbs.sbbbbbbb..",
    "..bbbbbs...sbbbbbb..",
    "..bsbbs.....sbbsbb..",
    "..bb............bb..",
    "..sb............bs..",
  ],
  afro: [
    ".....bbbbbbbbbb.....",
    "...bbbhhbbbbbbbbb...",
    "..bbbhhbbsbbbbsbbb..",
    ".bbhbbsbbbbbsbbbbbb.",
    ".bbbbbbbbbbbbbbbbsb.",
    ".bsbbbbsbbbbbbsbbbb.",
    ".bbbsbbbbsbbsbbbsbb.",
    ".bbs.s.s.s.s.s.s.bb.",
    ".bb..............bb.",
    ".bs..............sb.",
    "..s..............s..",
  ],
};
const BACK = {
  long: [
    "....................",
    "....................",
    "....................",
    "....................",
    "...ssssssssssssss...",
    "..ssssssssssssssss..",
    "..ssssssssssssssss..",
    "..ssssssssssssssss..",
    "..ssssssssssssssss..",
    "..ssssssssssssssss..",
    "..ssssssssssssssss..",
    "..ssssssssssssssss..",
    "..ssssssssssssssss..",
    "..ssssssssssssssss..",
    "..sss..........sss..",
    "..ss............ss..",
    "...s............s...",
  ],
  pony: [
    "....................",
    "....................",
    "....................",
    "....................",
    "...............sss..",
    "...............ssss.",
    "................sss.",
    "................sss.",
    "................sss.",
    "................sss.",
    "................sss.",
    "................sss.",
    ".................ss.",
    ".................s..",
  ],
};

const outlineOf = (c) => mix(c, "#1a1420", 0.55);
// The head at a desk, scaled from the chin: smaller than the portraits' so the desk reads first.
const DESK_HEAD = 0.8;

// A desk of `job` (a role, or null for nobody) at `status`, `w` x `h` points
// (best at a whole number of points per unit: 108x90, 144x120).
export function deskFigure(id, job, status, w, h, t) {
  const g = grid(w / 36);
  const { q, r } = g;
  const look = job ? LOOKS[job] ?? LOOKS.developer : null;
  const s = look ? (["working", "blocked", "done"].includes(status) ? status : "idle") : "empty";
  const glow = { working: t.working, blocked: t.blocked, done: t.done }[s];
  const parts = [];
  const add = (...els) => parts.push(...els);
  const loop = motion(g, id);
  const fade = fader(id);

  // Floor shadow; under the desk, the chair's stem and wheels.
  add(r(1.5, 27.6, 33, 2.2, "#00000040", 1.1));
  add(r(21.3, 21, 1.4, 5, CHAIR.leg), r(16.8, 25.6, 10.4, 1.2, CHAIR.leg, 0.6));
  for (const x of [16.2, 21.2, 26.2]) add(r(x, 26.4, 1.6, 1.6, CHAIR.wheel, 0.8));
  // Whoever sits there: legs under the desk.
  if (look) {
    const pants = mix(look.outfit, "#2b3044", 0.7);
    add(r(18, 21.5, 3.4, 4.6, pants, 1.3), r(22.6, 21.5, 3.4, 4.6, pants, 1.3));
    add(r(17.4, 25.4, 4.2, 1.8, SHOE, 0.9), r(22.4, 25.4, 4.2, 1.8, SHOE, 0.9));
  }
  // The chair: its back with a cushion, its arms.
  add(r(14.5, 6, 15, 15, CHAIR.back, 5, CHAIR.line).rounded_b(q(1.5)), r(16.2, 7.8, 11.6, 11, CHAIR.hi, 3.6));
  add(r(18.5, 6.8, 7, 0.8, mix(CHAIR.hi, "#ffffff", 0.18), 0.4), r(17, 13, 10, 0.7, CHAIR.back, 0.35));
  add(r(12.6, 15.4, 2.6, 5.2, CHAIR.back, 1.2, CHAIR.line), r(28.8, 15.4, 2.6, 5.2, CHAIR.back, 1.2, CHAIR.line));

  if (look) add(...person(look, s, g, loop, fade, id, { head: DESK_HEAD }));

  // The monitor, its screen telling the state (nobody there: a shell's prompt).
  add(r(1.5, 8, 13, 10.2, BEZEL, 1.8, "#141722"), r(7, 18, 2.5, 1.6, BEZEL), r(5, 19, 6, 1, BEZEL, 0.5));
  const screen = s === "empty" ? SCREEN_OFF : s === "idle" ? "#262b45" : mix(glow, "#141826", 0.55);
  add(r(2.6, 9.1, 10.8, 7.6, screen, 1));
  if (s === "working") {
    [[0, 6], [1, 4], [2, 7], [3, 3]].forEach(([i, len]) =>
      add(fade(r(3.6 + (i % 2), 10.1 + i * 1.6, len, 0.9, glow, 0.45), `code${i}`, 0.25, 1, 500 + i * 170)));
  } else if (s === "blocked") {
    add(fade(r(2.6, 9.1, 10.8, 7.6, glow, 1), "alarm", 0.1, 0.6, 600, "linear"));
    add(r(7.4, 10.1, 1.3, 3.7, WHITE, 0.6), r(7.4, 14.4, 1.3, 1.3, WHITE, 0.6));
  } else if (s === "done") {
    const tick = mix(glow, "#ffffff", 0.25);
    [[4.6, 12.3], [5.6, 13.3], [6.6, 14.3], [7.6, 13.3], [8.6, 12.3], [9.6, 11.3], [10.6, 10.3]].forEach(([x, y]) => add(r(x, y, 1.4, 1.4, tick, 0.3)));
  } else if (s === "idle") {
    add(fade(r(5, 11.6, 2, 2, "#5d6797", 1), "saver", 0.2, 0.8, 2400));
  } else {
    add(r(3.6, 10.3, 6, 0.9, "#5b6582", 0.45), r(3.6, 12, 4, 0.9, "#5b6582", 0.45), r(3.6, 13.8, 1.4, 0.9, "#a6da95", 0.45));
    add(fade(r(5.4, 13.6, 1.1, 1.3, "#cad3f5"), "cursor", 0, 1, 530, "linear"));
  }

  // The desk: a top with a darker lip, a drawer pedestal left, a leg right, open between.
  add(r(0.5, 19.4, 35, 3, WOOD.top, 1, WOOD.line), r(1.2, 21.3, 33.6, 0.7, WOOD.lip));
  add(r(2, 22, 9.6, 6.3, WOOD.front, 0.8, WOOD.line));
  add(r(3, 23, 7.6, 2.2, WOOD.drawer, 0.6), r(3, 25.6, 7.6, 2, WOOD.drawer, 0.6));
  add(r(5.8, 23.8, 2, 0.7, WOOD.top, 0.3), r(5.8, 26.3, 2, 0.7, WOOD.top, 0.3));
  add(r(31.4, 22, 2.7, 6.3, WOOD.front, 0.6, WOOD.line));

  // On the desk: the keyboard (hands on it at work) and a mouse, a mug (steaming at work).
  add(r(16, 18.8, 12, 1.6, "#a3abc4", 0.6, "#5e6680"), r(28.8, 19, 1.8, 1.4, "#a3abc4", 0.6, "#5e6680"));
  if (look) {
    const skin = look.skin ?? SKIN;
    const line = outlineOf(skin);
    if (s === "working") {
      add(loop(r(17, 17.8, 3, 2, skin, 1, line), "hl", "top", 17.8, 17, 240));
      add(loop(r(24, 17.8, 3, 2, skin, 1, line), "hr", "top", 17, 17.8, 240));
    } else if (s === "done") {
      add(r(17, 17.8, 3, 2, skin, 1, line), r(24, 17.8, 3, 2, skin, 1, line));
    }
  }
  add(r(33, 16.9, 1.6, 1.9, "#00000000", 0.8, "#b8ad9c"));
  add(r(30, 15.8, 3.6, 3.8, WHITE, 0.8, "#b8ad9c"), r(30.4, 17.3, 2.8, 0.8, look ? look.outfit : "#8aadf4"));
  if (s === "working") add(drift(g, loop, fade, "steam", 31.2, 14, 11.5, 1400, g.rel(0, 0, 1, 2, "#c7cfe2", 0.5)));

  return div().relative().w(w).h(h).flex_none().children(parts);
}

// A loop on `top` in grid units (the drawing's offset included).
const motion = (g, id) => (el, key, prop, from, to, period, easing) =>
  el.id(`${id}-${key}`).loop(prop, { from: g.q(from + (prop === "top" ? g.oy : 0)), to: g.q(to + (prop === "top" ? g.oy : 0)), period, ...(easing ? { easing } : {}) });
const fader = (id) => (el, key, from, to, period, easing) =>
  el.id(`${id}-${key}`).loop("opacity", { from, to, period, ...(easing ? { easing } : {}) });

function person(look, s, g, loop, fade, id, opts = {}) {
  const { q, r, rel } = g;
  const skin = look.skin ?? SKIN;
  const skinLine = outlineOf(skin);
  const hair = look.hair;
  const hairLine = outlineOf(hair);
  const hairHi = mix(hair, "#ffffff", 0.25);
  const cloth = look.outfit;
  const clothLine = outlineOf(cloth);
  const out = [];
  const add = (...els) => out.push(...els);
  const body = [];
  const b = (...els) => body.push(...els);
  const has = (x) => look.extra?.includes(x);
  // Idle: head down on folded arms.
  const dy = s === "idle" ? 4 : 0;
  // The head (hair, face, extras) scaled by `opts.head` about the chin, edges still on whole points.
  const k = opts.head ?? 1;
  const hg = k === 1 ? g : grid(g.u * k, (22 * (1 - k) + g.ox) / k, ((14.8 + dy) * (1 - k) + g.oy) / k, g.ow);
  const hq = hg.q, hr = hg.r;

  // Behind the head: long hair, the afro, the ponytail.
  const pal = { b: hair, s: mix(hair, hairLine, 0.38), h: hairHi };
  if (BACK[look.cut]) b(...hg.sprite(12, dy, BACK[look.cut], { b: pal.s, s: pal.s }, hairLine));

  // The body: shoulders and a collar (the desk hides the rest).
  b(r(16, 14.2, 12, 8, cloth, 3.6, clothLine), r(20.2, 14, 3.6, 1.8, mix(cloth, "#ffffff", 0.5), 0.9));
  if (has("tie")) b(r(19.6, 13.9, 4.8, 1.6, WHITE, 0.7), r(21.4, 15.2, 1.2, 4.4, "#e6b94e", 0.5), r(21.1, 15, 1.8, 1.1, "#e6b94e", 0.5));

  // The head: round, outlined; ears where the hair leaves them.
  if (!["long", "afro"].includes(look.cut) && !has("headphones")) b(hr(13.4, 8 + dy, 2.4, 2.8, skin, 1.1, skinLine), hr(28.2, 8 + dy, 2.4, 2.8, skin, 1.1, skinLine));
  b(hr(14.8, 2.4 + dy, 14.4, 12.4, skin, 4, skinLine).rounded_b(hq(3)));

  // Eyes: big, dark, two shines; shut, a soft curve of two dashes.
  const shut = s === "idle" || s === "done";
  for (const x of [17.6, 23.6]) {
    if (shut) b(hr(x - 0.1, 9.4 + dy, 1.4, 0.8, INK, 0.4), hr(x + 1.1, 9 + dy, 1.4, 0.8, INK, 0.4));
    else b(hr(x, 8 + dy, 2.6, 3.2, INK, 1.3), hr(x + 0.4, 8.4 + dy, 1.2, 1.2, WHITE, 0.6), hr(x + 1.6, 10.2 + dy, 0.6, 0.6, WHITE, 0.3));
  }
  b(hr(15.8, 11.4 + dy, 2.6, 1.4, CHEEK, 0.7), hr(25.6, 11.4 + dy, 2.6, 1.4, CHEEK, 0.7));
  if (s === "blocked") b(hr(21.2, 11.7, 1.6, 1.8, "#7a3b3b", 0.8));
  else if (s === "done" || s === "bust") b(hr(20.8, 11.8, 2.4, 1.3, "#7a3b3b", 0.65), hr(21.3, 12.4, 1.4, 0.6, "#f29a9a", 0.3));
  else if (s !== "idle") b(hr(21.2, 12, 1.6, 0.7, "#7a3b3b", 0.35));
  if (has("freckles")) for (const [x, y] of [[16.6, 10.6], [17.4, 11], [26.2, 10.6], [27, 11]]) b(hr(x, y + dy, 0.5, 0.5, "#c98a6a"));

  // Hair on top: a cap rounded on top only, then bangs in locks, then a shine.
  if (look.cut === "cap") {
    const cap = "#8fc1ea";
    b(hr(14.8, 5.6 + dy, 1.8, 3.2, hair, 0.8, hairLine), hr(27.4, 5.6 + dy, 1.8, 3.2, hair, 0.8, hairLine));
    b(hr(14.4, 1.4 + dy, 15.2, 5.4, cap, 4, outlineOf(cap)).rounded_b(hq(1)), hr(16, 2.4 + dy, 4.4, 1.2, "#c2e0f7", 0.6));
    b(hr(19.6, 5.4 + dy, 11.2, 1.6, "#6fa6d6", 0.8, outlineOf("#6fa6d6")), hr(21.4, 2.8 + dy, 1.4, 1.4, WHITE, 0.7));
  } else {
    b(...hg.sprite(12, dy, FRONT[look.cut] ?? FRONT.side, pal, hairLine));
  }
  if (has("glasses")) {
    for (const x of [16.9, 22.9]) b(hr(x, 7.6 + dy, 4, 3.8, "#ffffff22", 1.4, "#6f95c6"));
    b(hr(20.9, 8.8 + dy, 2, 0.5, "#6f95c6"));
  }
  if (look.cut === "pony") b(hr(29.2, 5 + dy, 2.4, 1.6, "#f29ab7", 0.6, outlineOf("#f29ab7")));
  if (has("clip")) b(hr(24.6, 3.8 + dy, 3.2, 1.6, "#f6d36a", 0.8, outlineOf("#f6d36a")));
  if (has("headphones")) {
    const ph = "#8fd6c0";
    b(hr(15.4, 0.9 + dy, 13.2, 1.5, ph, 0.75, outlineOf(ph)), hr(13.8, 1.8 + dy, 2.4, 1.5, ph, 0.75), hr(27.8, 1.8 + dy, 2.4, 1.5, ph, 0.75));
    b(hr(12.2, 6.6 + dy, 3.4, 5, "#7cc6ae", 1.5, outlineOf(ph)), hr(28.4, 6.6 + dy, 3.4, 5, "#7cc6ae", 1.5, outlineOf(ph)));
  }
  if (has("headset")) b(hr(12.8, 6.6 + dy, 3.2, 4.6, "#8a90a3", 1.4, "#4c5160"), hr(15, 11.6 + dy, 4.6, 0.8, "#8a90a3", 0.4), hr(19.2, 11.2 + dy, 1.6, 1.6, "#5b6070", 0.8));

  // Arms: folded under the head, or resting at the sides while cheering.
  if (opts.standing) {
    // the boss's arms are its own (bossFigure)
  } else if (s === "idle") {
    b(r(14.4, 17.4, 15.2, 3.6, cloth, 1.7, clothLine), r(14.6, 17.6, 3, 3.2, skin, 1.4, skinLine), r(26.4, 17.6, 3, 3.2, skin, 1.4, skinLine));
  } else if (s === "done") {
    b(r(14.2, 16.2, 3.6, 4.2, cloth, 1.6, clothLine), r(26.2, 16.2, 3.6, 4.2, cloth, 1.6, clothLine));
  }

  const wrap = div().absolute().left(0).top(0).children(body);
  add(s === "done" && !opts.standing ? wrap.id(`${id}-hop`).loop("top", { from: 0, to: -q(1.4), period: 320 }) : wrap);

  if (s === "blocked") {
    add(loop(r(28.4, 7.5, 3, 7.5, cloth, 1.5, clothLine), "arm", "top", 7.5, 6.5, 300), loop(r(28.2, 4.8, 3.4, 3.2, skin, 1.6, skinLine), "hand", "top", 4.8, 3.8, 300));
    add(loop(r(29.6, -2.4, 6.4, 6.4, "#00000000").children([
      rel(0, 0, 6.4, 6.4, WHITE, 2.6, "#cfc7b8"), rel(1, 5.2, 1.6, 1.6, WHITE, 0.4),
      rel(2.7, 1, 1.1, 2.9, "#e5675c", 0.55), rel(2.7, 4.4, 1.1, 1.1, "#e5675c", 0.55),
    ]), "bub", "top", -2.4, -3.4, 600));
  }
  if (s === "idle") {
    const z = (size) => div().absolute().left(0).top(0).text_size(q(size)).font_bold().text_color("#c7cfe2").child("z");
    add(drift(g, loop, fade, "z1", 30, 6, 2, 2200, z(3)), drift(g, loop, fade, "z2", 32.5, 3, 0, 1700, z(2.4)));
  }
  if (s === "done") {
    const star = (x, y, k, i) => fade(r(x, y, 3 * k, 3 * k, "#00000000").children([
      rel(1.1 * k, 0, 0.8 * k, 3 * k, "#fbe3a0", 0.4 * k), rel(0, 1.1 * k, 3 * k, 0.8 * k, "#fbe3a0", 0.4 * k),
    ]), `sp${i}`, 0, 1, 520 + i * 170);
    add(star(2, 0.5, 1, 0), star(31.5, 3, 1.2, 1), star(10.5, 2.5, 0.8, 2));
  }
  return out;
}

// A portrait (tab bar, lists, inspector): head and shoulders, smiling, `size` points square.
export function bustFigure(id, job, size) {
  const look = LOOKS[job] ?? LOOKS.developer;
  const g = grid(size / 22, -11, 1);
  const none = (el) => el;
  return div().relative().w(size).h(size).overflow_hidden().children(person(look, "bust", g, none, none, id));
}

// The boss, standing (the boss band), `w` x `h` points on a 32x44 grid: the
// manager's head and suit; talking with a clipboard (working), a hand up and a
// "!" (blocked), a thumbs up (done), arms crossed (idle).
export function bossFigure(id, status, w, h) {
  const look = LOOKS.manager;
  const skin = look.skin ?? SKIN;
  const skinLine = outlineOf(skin);
  // Drawn in the desk's coordinates, moved so the head is centred.
  const g = grid(w / 32, -6, 3);
  const { r } = g;
  const loop = motion(g, id);
  const fade = fader(id);
  const s = ["working", "blocked", "done"].includes(status) ? status : "idle";
  const pants = mix(look.outfit, "#2b3044", 0.55);
  const suit = mix(look.outfit, "#000000", 0.08);
  const suitLine = outlineOf(suit);
  const out = [];
  const add = (...els) => out.push(...els);
  add(r(12.5, 36.6, 19, 2.4, "#00000040", 1.2));
  add(r(17.4, 26, 3.8, 10, pants, 1.4, outlineOf(pants)), r(22.8, 26, 3.8, 10, pants, 1.4, outlineOf(pants)));
  add(r(16.6, 35, 5, 2.2, SHOE, 1.1), r(22.4, 35, 5, 2.2, SHOE, 1.1));
  add(r(16, 20, 12, 7.5, suit, 2.4, suitLine), r(21.6, 20.5, 0.8, 6.5, suitLine));
  add(...person(look, s === "idle" || s === "working" ? "bust" : s, g, loop, fade, id, { standing: true }));
  const armDown = (x) => [r(x, 15, 3, 7.5, suit, 1.5, suitLine), r(x, 21.6, 3, 2.6, skin, 1.3, skinLine)];
  if (s === "working") {
    add(...armDown(14), r(11.4, 18.6, 5.2, 6.6, "#c9a26a", 0.8, "#7a5a30"), r(12.4, 19.8, 3.2, 4.4, WHITE, 0.3), r(13.2, 18.2, 1.6, 1, "#8a90a3", 0.4));
    add(r(27, 15.6, 5.6, 2.8, suit, 1.4, suitLine), loop(r(32, 15.6, 2.8, 2.8, skin, 1.4, skinLine), "point", "top", 15.6, 14.8, 700));
  } else if (s === "blocked") {
    add(...armDown(14));
  } else if (s === "done") {
    add(...armDown(14), r(27, 11, 3, 6.5, suit, 1.5, suitLine), r(26.8, 8.4, 3.4, 3, skin, 1.4, skinLine), r(28, 6.8, 1.3, 2.2, skin, 0.65, skinLine));
  } else {
    add(r(15, 17.4, 14, 3.4, mix(suit, "#000000", 0.1), 1.7, suitLine), r(15.2, 17.6, 2.6, 3, skin, 1.3, skinLine), r(26.2, 17.6, 2.6, 3, skin, 1.3, skinLine));
  }
  return div().relative().w(w).h(h).flex_none().children(out);
}

// Something rising and fading at grid `x`: the outer box moves, the inner one fades.
function drift(g, loop, fade, key, x, from, to, period, child) {
  const inner = fade(div().absolute().top(0).left(0).child(child.left(0).top(0)), `${key}-o`, 1, 0, period);
  return loop(div().absolute().left(g.q(x)).top(0), key, "top", from, to, period).child(inner);
}

function mix(a, b, k) {
  const ch = (c, i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  if (!/^#[0-9a-fA-F]{6}/.test(a ?? "") || !/^#[0-9a-fA-F]{6}/.test(b)) return a ?? b;
  return `#${[0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, "0")).join("")}`;
}
