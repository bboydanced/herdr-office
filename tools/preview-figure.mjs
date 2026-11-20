// Preview figure.js without Herdr: a stand-in gpui-kit records every block the
// desks draw, then tools/preview-figure.py paints them into one sheet.
//
//   node tools/preview-figure.mjs > /tmp/fig.json && python3 tools/preview-figure.py /tmp/fig.json out.png
//   node tools/preview-figure.mjs --busts > /tmp/busts.json && python3 tools/preview-figure.py /tmp/busts.json
//     (the second writes the portraits, mods/office-agents/art/<role>.png, 88x88)
//   node tools/preview-figure.mjs --room | python3 tools/preview-figure.py /dev/stdin room.png
//     (room.js: the sidebar's wall and the boss's office)
//   node tools/preview-figure.mjs --parts   (every piece by name, for tools/build-preview.py)
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../mods/office-agents/figure.js", import.meta.url), "utf8");

// The stand-in: a chainable element keeping what painting needs.
const mock = `
const el = () => {
  const n = { s: {}, kids: [], text: null, loops: [] };
  const api = new Proxy({}, { get: (_t, k) => {
    if (k === "__node") return n;
    if (k === "child") return (c) => { if (c && c.__node) n.kids.push(c.__node); else if (c != null) n.text = String(c); return api; };
    if (k === "children") return (cs) => { for (const c of cs ?? []) if (c?.__node) n.kids.push(c.__node); return api; };
    if (k === "loop") return (prop, p) => { n.loops.push({ prop, ...p }); return api; };
    if (k === "when") return (c, f) => (c ? f(api) : api);
    return (...a) => { n.s[k] = a.length <= 1 ? a[0] : a; return api; };
  } });
  return api;
};
const div = el;
`;
// room.js imports figure.js's grid; one module holds both here.
const room = readFileSync(new URL("../mods/office-agents/room.js", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "");
const code = src.replace(/^import \{ div \} from "gpui-kit";$/m, mock) + room;
const mod = await import(`data:text/javascript,${encodeURIComponent(code)}`);
// Written out in full before exiting (a pipe takes it in 64 KB pieces).
const emit = (data) => new Promise(() => process.stdout.write(JSON.stringify(data), () => process.exit(0)));

if (process.argv.includes("--room")) {
  const rooms = [
    { name: "sidebar wall", node: mod.sidebarWall("wall", 300, 44).__node, w: 300, h: 44 },
    { name: "boss office", node: mod.bossOffice("boss-room", 900, 136).__node, w: 900, h: 136 },
  ];
  await emit({ rooms });
}

if (process.argv.includes("--busts")) {
  const busts = Object.keys(mod.LOOKS).map((job) => ({ job, node: mod.bustFigure(`b-${job}`, job, 88).__node }));
  await emit({ busts, size: 88 });
}

const theme = { working: "#8aadf4", blocked: "#f28b7d", done: "#a6da95" };
const roles = [...Object.keys(mod.LOOKS), null];
const states = ["working", "blocked", "done", "idle"];

if (process.argv.includes("--parts")) {
  const logoSrc = readFileSync(new URL("../mods/office-chrome/logo.js", import.meta.url), "utf8").replace(/^import .*$/gm, "");
  const { logo } = await import(`data:text/javascript,${encodeURIComponent(mock + logoSrc)}`);
  const parts = {};
  const put = (key, el, w, h) => { parts[key] = { node: el.__node, w, h }; };
  // Desks at the sidebar's size and the panel's: desk-<role>-<state>-<width>, desk-empty-<width>.
  for (const [w, h] of [[72, 60], [96, 80]]) {
    for (const job of roles) {
      for (const st of job ? states : ["empty"]) put(`desk-${job ?? "empty"}${job ? `-${st}` : ""}-${w}`, mod.deskFigure("p", job, st, w, h, theme), w, h);
    }
  }
  for (const st of states) put(`boss-${st}`, mod.bossFigure("b", st, 64, 88), 64, 88);
  put("wall", mod.sidebarWall("wall", 300, 44), 300, 44);
  put("boss-office", mod.bossOffice("boss-room", 900, 136, 64), 900, 136);
  put("logo", logo(32), 32, 32);
  await emit(parts);
}
// The sizes the Office draws: a desk 96x80 points (Blocks), the boss 64x88.
const W = 96, H = 80;
const sheet = [];
roles.forEach((job, row) => states.forEach((st, col) => {
  if (!job && col) return;
  const root = mod.deskFigure(`p${row}${col}`, job, st, W, H, theme).__node;
  sheet.push({ job: job ?? "empty", state: st, x: col * (W + 24) + 12, y: row * (H + 30) + 24, node: root });
}));
states.forEach((st, col) => {
  const root = mod.bossFigure(`b${col}`, st, 64, 88).__node;
  sheet.push({ job: "boss", state: st, x: col * (W + 24) + 12 + 28, y: roles.length * (H + 30) + 24, node: root });
});
process.stdout.write(JSON.stringify({ W, H, cols: states.length, rows: roles.length + 1, sheet }));
