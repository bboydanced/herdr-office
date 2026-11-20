#!/usr/bin/env python3
"""Compose a mock office window from the real mod art, so the layout can be
reviewed without Herdr. Not part of the mods - nothing reads this file.

    python3 tools/build-preview.py     # writes preview.png and layouts/office.png

(It needs Pillow: on a machine whose `python3` isn't the one the system's
python3-pil was built for, run it with that one, e.g. /usr/bin/python3.10.)

The mock follows layouts/office.json and the sizes the mods ask for: a 300 px
sidebar (46 header, Spaces, the Office Agent list, 69 footer), 58 px tab bar,
8 px padding, and the side panel open on the Office tab at its first width,
640 px. The office's night neon is the mods' own: the walls, the desks, the
people and every neon sign (door and rug numbers, the panel buttons, PLAN)
are drawn by the mods' code (tools/preview-figure.mjs --parts); what is
around them follows main.js. Spaces are rooms (a door with its number in
neon, its lamp, sticky notes, faces), a group a band in a cyan tube; Office
Agent is one row per agent under the sidebar's wall. In the panel's office:
the header with the filters; the boss's office with its neon pickers, its
flow and its PLAN board, the goal box and Tell; a Needs you card; the floor,
the group band and each space a rug (its number in neon), each tab a cubicle,
each pane a desk; and the inspector bar on the picked staff member. A tab
with a `tree` shows its split; others, rows.
"""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1600, 900
SIDEBAR = 300
TABS = 58
PAD = 8
# The sidebar's Spaces part: its share (0.62 of 2) of what the logo and the footer leave.
SPACES_H = round((H - 46 - 69) * 0.62 / 2)
PANEL = 640

THEME = json.load(open(os.path.join(ROOT, "themes/office-night.json")))
C = THEME["colors"]
INK = "#1d2733"
TAG = "#c8392f"
# The mods' neon (neon.js, main.js): the OA pink, the groups' cyan, a done
# step's green, Stop's red; the dark board signs and pickers sit on, and the
# words on it.
NEON, GROUP_NEON, DONE_NEON, STOP_NEON = "#ff7ab6", "#7fe3f0", "#a6da95", "#ff6b5a"
BOARD, NIGHT_TEXT, NIGHT_OFF = "#17122b", "#c3cbe6", "#6f7898"
SHADE = (8, 12, 18)
# Radii (main.js R): tags, buttons and chips, cubicles and cards, rooms.
R_TAG, R_CONTROL, R_CARD, R_ROOM = 3, 5, 6, 8


def hexa(key: str, alpha: int = 255) -> tuple[int, int, int, int]:
    if key.startswith("#"):
        v = key
    elif key.startswith("ansi") and key[4:].isdigit():
        v = THEME["ansi"][int(key[4:])]
    else:
        v = C[key]
    v = v.lstrip("#")
    return (int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16), alpha)


def hex6(key: str) -> str:
    return "#%02x%02x%02x" % hexa(key)[:3]


def whiter(rgb, k: float) -> tuple[int, int, int]:
    return tuple(round(v + (255 - v) * k) for v in rgb[:3])


def lift(key: str) -> tuple[int, int, int]:
    """neon.js's neonColor: a colour lifted toward white until it reads as lit."""
    r, g, b = hexa(key)[:3]
    lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    return (r, g, b) if lum >= 0.62 else whiter((r, g, b), (0.62 - lum) / (1 - lum))


def mono(size: float):
    path = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
    return ImageFont.truetype(path, round(size)) if os.path.exists(path) else font(size)


def font(size: float, bold: bool = False):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else ""),
                 "/usr/share/fonts/truetype/liberation/LiberationSans%s.ttf" % ("-Bold" if bold else "")):
        if os.path.exists(path):
            return ImageFont.truetype(path, round(size))
    return ImageFont.load_default()


def load(rel: str, size: tuple[int, int] | None = None) -> Image.Image:
    im = Image.open(os.path.join(ROOT, rel)).convert("RGBA")
    return im.resize(size, Image.NEAREST) if size else im


def fit(d: ImageDraw.ImageDraw, text: str, f, width: int) -> str:
    if d.textlength(text, font=f) <= width:
        return text
    while text and d.textlength(text + "…", font=f) > width:
        text = text[:-1]
    return text + "…"


# Blended drawing (ImageDraw on an RGBA image replaces what is there).
def tint(im: Image.Image, box, color) -> None:
    """A translucent fill blended over what is there."""
    im.alpha_composite(Image.new("RGBA", (round(box[2] - box[0]) + 1, round(box[3] - box[1]) + 1), color), (round(box[0]), round(box[1])))


def rfill(im: Image.Image, box, color, radius: int = 0) -> None:
    x0, y0, x1, y1 = (round(v) for v in box)
    layer = Image.new("RGBA", (x1 - x0 + 1, y1 - y0 + 1), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle([0, 0, x1 - x0, y1 - y0], radius=radius, fill=color)
    im.alpha_composite(layer, (x0, y0))


def rline(im: Image.Image, box, color, radius: int = 0, width: int = 1) -> None:
    x0, y0, x1, y1 = (round(v) for v in box)
    layer = Image.new("RGBA", (x1 - x0 + 1, y1 - y0 + 1), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle([0, 0, x1 - x0, y1 - y0], radius=radius, outline=color, width=width)
    im.alpha_composite(layer, (x0, y0))


def tube(im: Image.Image, box, key: str, radius: int, alpha: int = 0xFF, width: int = 1) -> None:
    """neonFrame: one tube round the box in `key`, lifted bright, at `alpha`."""
    rline(im, box, whiter(lift(key), 0.15) + (alpha,), radius, width)


def board(im: Image.Image, box, key: str, radius: int, alpha: int = 0xD9, glow: int = 0x17) -> None:
    """A lit neon control (the pickers, Tell, the lobby's buttons): a dark board,
    a glow of its colour on it and its tube."""
    rfill(im, box, hexa(BOARD, 0xF2), radius)
    rfill(im, box, lift(key) + (glow,), radius)
    tube(im, box, key, radius, alpha)


# Sample window: three spaces (projects), their tabs and panes. `since`: how
# long the tab has been in its state; `away`: tabs put away.
SPACES = [
    {"name": "web-app", "color": "ansi6", "active": True, "tail": "feat/login ↑1", "branch": "feat/login",
     "git": [("ansi11", "2 changed"), ("ansi10", "↑1 unpushed")],
     "tabs": [
         {"name": "Boss", "active": True, "since": "12m", "tree": ("across", [0, ("stacked", [1, 2])]), "panes": [
             ("manager", "working", "Hiring the team"), ("developer", "working", "frontend-nav"),
             ("designer", "working", "design-login")]},
         {"name": "review", "since": "5m", "panes": [("analyst", "done", "PR #42")]},
     ]},
    {"name": "api", "color": "ansi3", "tail": "", "branch": "",
     "git": [("ansi11", "4 changed")], "away": ["old"],
     "tabs": [
         {"name": "tests", "since": "3m", "panes": [("tester", "blocked", "Push branch"), (None, None, "Terminal")]},
         {"name": "deploy", "since": "1h 5m", "panes": [("support", "idle", "Rollout")]},
     ]},
    {"name": "notes", "color": "ansi5", "tail": "", "branch": "",
     "git": [("ansi9", "no remote")],
     "tabs": [{"name": "docs", "since": "40m", "panes": [("writer", "working", "README"), ("intern", "idle", "Typos")]}]},
]
# A group you made: the same band in Spaces, the Office Agent list and the floor.
GROUPS = [("Product", ("web-app", "api"))]
# The boss's plan on its PLAN board: piece, where it is, who.
PLAN = [("frontend-nav", "working", "developer-nav"), ("design-login", "working", "designer-login"), ("login tests", "todo", "")]
NOTE = {"todo": ("#8a93b8", "○", "To do"), "working": (C["working"], "●", "At work")}
# The panel buttons in the tab bar: their neon sign, lit while open.
PANELS = [("files", "Files", "#7fe3f0", False), ("changes", "Changes", DONE_NEON, False), ("office", "Office", NEON, True)]


def occupied(s) -> bool:
    return any(st for t in s["tabs"] for _, st, _ in t["panes"])


def number(n: int) -> str:
    return f"{n + 1:02d}"


# Every neon sign the mock shows, painted by the mods' own neon.js: [text, colour, lit, points a cell].
SIGNS = ([[number(n), hex6(s["color"]), occupied(s), 2] for n, s in enumerate(SPACES)]
         + [[number(n), hex6(s["color"]), True, 2] for n, s in enumerate(SPACES)]
         + [[name.upper(), color, on, 2] for _, name, color, on in PANELS]
         + [["PLAN", GROUP_NEON, True, 2]])

_PARTS: dict = {}


def part(key: str, size: tuple[int, int] | None = None) -> Image.Image:
    """A piece the mods draw in blocks (figure.js, room.js, logo.js, neon.js),
    painted by tools/preview-figure.py from what tools/preview-figure.mjs --parts records."""
    if not _PARTS:
        out = subprocess.run(["node", os.path.join(ROOT, "tools/preview-figure.mjs"), "--parts", "--signs", json.dumps(SIGNS)],
                             check=True, capture_output=True, text=True).stdout
        _PARTS.update(json.loads(out))
        spec = importlib.util.spec_from_file_location("preview_figure", os.path.join(ROOT, "tools/preview-figure.py"))
        _PARTS["__painter"] = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_PARTS["__painter"])
    it = _PARTS[key]
    im = Image.new("RGBA", (round(it["w"]), round(it["h"])), (0, 0, 0, 0))
    _PARTS["__painter"].paint(im, it["node"], 0, 0, it["w"], it["h"])
    return im.resize(size, Image.NEAREST) if size and size != im.size else im


def sign(text: str, key: str, lit: bool = True) -> Image.Image:
    return part(f"sign-{text}-{hex6(key)}-{'lit' if lit else 'off'}")


# Desk sizes as office-agents draws them (WIDE): the panel's, two lines under each desk.
WIDE = {"dw": 84, "dh": 70, "slot": 92, "label": 15, "text": 11, "gap": 6, "cp": 5, "wide": True}


def slot_h(z) -> int:
    return z["dh"] + 1 + z["label"] + 1 + z["label"] - 3


def grid(n: int) -> int:
    return n if n <= 3 else 2 if n == 4 else 3


def staff(s) -> list[tuple[str, str]]:
    return [(role, st) for t in s["tabs"] for role, st, _ in t["panes"] if st]


def urgent(sts) -> str | None:
    return "blocked" if "blocked" in sts else "working" if "working" in sts else None


def wallpaper(size: tuple[int, int]) -> Image.Image:
    paper = load("mods/office-chrome/wallpaper.png").convert("RGB")
    scale = max(size[0] / paper.width, size[1] / paper.height)  # "cover", as the layout asks
    return paper.resize((int(paper.width * scale) + 1, int(paper.height * scale) + 1)).crop((0, 0, *size)).convert("RGBA")


def darken(key: str, k: float) -> tuple[int, int, int, int]:
    c = hexa(key)
    return tuple(round(v * (1 - k)) for v in c[:3]) + (255,)


def mix(a: str, b: str, t: float) -> tuple[int, int, int, int]:
    x, y = hexa(a), hexa(b)
    return tuple(round(x[i] + (y[i] - x[i]) * t) for i in range(3)) + (255,)


def bright(key: str, t: float = 0.3) -> tuple[int, int, int, int]:
    return mix(C[key], "#ffffff", t)


def door(im, x, y, n, s, status) -> None:
    """A room's door, as office-spaces draws it: 30x34, the lamp on top, its
    number in neon across it (lit while anyone is in), a knob."""
    if status == "working":
        rfill(im, [x + 7, y, x + 22, y + 5], hexa("working", 0x50), 3)
    rfill(im, [x + 10, y, x + 19, y + 2], hexa(status) if status else hexa("#3a4250"), 1)
    rfill(im, [x, y + 4, x + 29, y + 33], darken(s["color"], 0.45), 2)
    rfill(im, [x + 2, y + 5, x + 27, y + 33], hexa(s["color"]), 2)
    sg = sign(number(n), s["color"], occupied(s))
    im.alpha_composite(sg, (x + round(15 - sg.width / 2), y + 8))
    rfill(im, [x + 24, y + 26, x + 26, y + 28], hexa("#e8ba62"), 1)


def face(im, x, y, role, st, size=14) -> None:
    d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle([x, y, x + size - 1, y + size - 1], radius=4, fill=hexa("raised"), outline=hexa(st))
    im.alpha_composite(load(f"mods/office-agents/art/{role}.png", (size - 2, size - 2)), (x + 1, y + 1))


def group_count(d, im, x, y, members, size=9.5, back="raised", ink="muted") -> int:
    text = f"{len(members)} space{'s' if len(members) != 1 else ''}"
    f = font(size)
    w = round(d.textlength(text, font=f)) + 12
    rfill(im, [x, y, x + w, y + 14], back if isinstance(back, tuple) else hexa(back), 5)
    d.text((x + 6, y + 1), text, font=f, fill=hexa(ink))
    return w


def draw_spaces(sb: Image.Image, top: int) -> None:
    """Spaces: a band per group (a cyan tube), then a 44 px row per space: its
    door, name and git; the room you are in lit with the amber bar; one where
    someone works breathes in the working colour, one where someone waits red."""
    d = ImageDraw.Draw(sb, "RGBA")
    d.text((16, top + 9), "Spaces", font=font(11.5), fill=hexa("dim"))
    d.text((SIDEBAR - 58, top + 5), "▤", font=font(14), fill=hexa("dim"))
    d.text((SIDEBAR - 30, top + 4), "+", font=font(16), fill=hexa("dim"))
    owner = {name: band for band, names in GROUPS for name in names}
    y, banded = top + 31, set()
    for n, s in enumerate(SPACES):
        band = owner.get(s["name"])
        if band and band not in banded:
            banded.add(band)
            members = [x for x in SPACES if owner.get(x["name"]) == band]
            y += 6
            box = [14, y, SIDEBAR - 14, y + 29]
            rfill(sb, box, hexa("surface"), R_CARD)
            tube(sb, box, GROUP_NEON, R_CARD, 0x59)
            d.text((25, y + 7), "▾", font=font(10), fill=hexa("muted"))
            d.text((44, y + 7), band, font=font(12, bold=True), fill=hexa("foreground"))
            group_count(d, sb, 52 + round(d.textlength(band, font=font(12, bold=True))), y + 8, members)
            people = [p for x in members for p in staff(x)]
            fx = SIDEBAR - 22 - 14 - min(4, len(people)) * 16
            for role, st in people[:4]:
                face(sb, fx, y + 8, role, st)
                fx += 16
            d.text((SIDEBAR - 33, y + 6), "⋯", font=font(11), fill=hexa("dim"))
            sts = [st for _, st in people]
            if urgent(sts) == "blocked":
                tag = f"! {sts.count('blocked')}"
                tw = round(d.textlength(tag, font=font(10, bold=True))) + 8
                tx = SIDEBAR - 22 - 14 - min(4, len(people)) * 16 - 6 - tw
                rfill(sb, [tx, y + 8, tx + tw, y + 21], hexa("#c8392f"), 3)
                d.text((tx + 4, y + 8), tag, font=font(10, bold=True), fill=(255, 255, 255, 255))
            y += 30
        box = [14, y, SIDEBAR - 14, y + 43]
        people = staff(s)
        status = urgent([st for _, st in people])
        if status == "working":
            rfill(sb, box, hexa("working", 0x2E), R_CARD)
        elif status == "blocked":
            rfill(sb, box, hexa("blocked", 0x40), R_CARD)
        if s.get("active"):
            rfill(sb, box, hexa("surface", 0xC8), R_CARD)
            rfill(sb, box, hexa("accent", 0x12), R_CARD)
            rfill(sb, [box[0], y + 8, box[0] + 2, y + 35], hexa("accent"), 2)
        door(sb, box[0] + 10, y + 5, n, s, status)
        tx = box[0] + 10 + 30 + 10
        d.text((tx, y + 6), s["name"], font=font(13), fill=hexa("foreground"))
        if status == "blocked":
            nx = tx + d.textlength(s["name"], font=font(13)) + 9
            rfill(sb, [nx, y + 8, nx + 10, y + 21], hexa("#c8392f"), 3)
            d.text((nx + 3, y + 7), "!", font=font(11, bold=True), fill=(255, 255, 255, 255))
        if s["tail"]:
            tf = font(11.5)
            d.text((box[2] - 10 - d.textlength(s["tail"], font=tf), y + 8), s["tail"], font=tf, fill=hexa("dim"))
        x = tx
        nf = font(9.5, bold=True)
        for color, text in s["git"]:
            w = round(d.textlength(text, font=nf)) + 8
            rfill(sb, [x, y + 26, x + w - 1, y + 38], hexa(color), 3)
            d.text((x + 4, y + 26), text, font=nf, fill=hexa(INK))
            x += w + 4
        fx = box[2] - 8 - min(5, len(people)) * 16 + 2
        for role, st in people[:5]:
            face(sb, fx, y + 25, role, st)
            fx += 16
        y += 44


def width_of(node) -> int:
    if not isinstance(node, tuple):
        return 1
    kind, children = node
    ws = [width_of(c) for c in children]
    return sum(ws) if kind == "across" else max(ws)


def tab_node(t, z, most):
    """The tab's desks as office-agents places them: its split, else rows."""
    if "tree" in t:
        return t["tree"]
    items = list(range(len(t["panes"])))
    cols = min(most, grid(len(items)))
    rows = [("across", items[i:i + cols]) for i in range(0, len(items), cols)]
    return rows[0] if len(rows) == 1 else ("stacked", rows)


def tree_size(node, z) -> tuple[int, int]:
    if not isinstance(node, tuple):
        return z["slot"], slot_h(z)
    kind, children = node
    sizes = [tree_size(c, z) for c in children]
    gaps = z["gap"] * (len(children) - 1)
    if kind == "across":
        return sum(w for w, _ in sizes) + gaps, max(h for _, h in sizes)
    return max(w for w, _ in sizes), sum(h for _, h in sizes) + gaps


def busy_marks(im, box, status, radius) -> None:
    """What the mods draw for someone working or waiting, at the pulse's peak:
    a glow or a red tint under one thin frame."""
    if status == "working":
        rfill(im, box, hexa("working", 0x2E), radius)
        rline(im, box, bright("working")[:3] + (0xB3,), radius)
    elif status == "blocked":
        rfill(im, box, hexa("blocked", 0x30), radius)
        rline(im, box, hexa("blocked"), radius)


def label(im, d, cx, ly, z, text, color, back=True, tag=False):
    """A line under a desk, centred in its slot."""
    f = font(z["text"] - (1.5 if tag else 0), bold=tag)
    h = z["label"] if back or tag else z["label"] - 3
    text = fit(d, text, f, z["slot"] - 10)
    tw = d.textlength(text, font=f) + (10 if tag else 8)
    tx = cx + z["slot"] / 2 - tw / 2
    if tag:
        rfill(im, [tx, ly, tx + tw, ly + h - 1], hexa(TAG), R_TAG)
    elif back:
        rfill(im, [round(tx), ly, round(tx + tw), ly + h - 1], SHADE + (0xB8,), R_TAG)
    d.text((tx + (5 if tag else 4), ly + (h - f.size) / 2 - 1), text, font=f, fill=color)


def draw_desk(im, d, t, i, cx, cy, z):
    role, st, title = t["panes"][i]
    busy_marks(im, [cx, cy, cx + z["slot"] - 1, cy + slot_h(z) - 1], st, R_CARD)
    dx = cx + (z["slot"] - z["dw"]) // 2
    im.alpha_composite(part(f"desk-{role}-{st}-{z['dw']}" if role else f"desk-empty-{z['dw']}", (z["dw"], z["dh"])), (dx, cy))
    ly = cy + z["dh"] + 1
    paper = (255, 240, 230, 255)
    label(im, d, cx, ly, z, title, hexa("foreground" if role else "muted"))
    ly += z["label"] + 1
    since = t.get("since", "")
    if role is None:
        label(im, d, cx, ly, z, f"…/{t['name']}", hexa("dim"), back=False)
    elif st == "blocked":
        label(im, d, cx, ly, z, f"NEEDS YOU · {since}", paper, tag=True)
    else:
        text = {"working": f"● {since}", "done": f"✓ {since}"}.get(st, f"Idle · {since}")
        color = {"working": bright("working"), "done": hexa("done")}.get(st, hexa("dim"))
        label(im, d, cx, ly, z, text, color, back=False)


def draw_node(im, d, t, node, x, y, z):
    if isinstance(node, int):
        draw_desk(im, d, t, node, x, y, z)
        return
    kind, children = node
    for c in children:
        draw_node(im, d, t, c, x, y, z)
        w, h = tree_size(c, z)
        if kind == "across":
            x += w + z["gap"]
        else:
            y += h + z["gap"]


def button(im, d, x, y, text) -> int:
    """A small office button (+ Tab, ✎, ×): returns its width."""
    f = font(10.5)
    w = round(d.textlength(text, font=f)) + 14
    rfill(im, [x, y, x + w - 1, y + 19], SHADE + (0x99,), R_CONTROL)
    rline(im, [x, y, x + w - 1, y + 19], hexa("muted", 0x55), R_CONTROL)
    d.text((x + 7, y + 3), text, font=f, fill=hexa("muted"))
    return w


def flow(im, d, x, y, step, hired) -> int:
    """The boss's flow in neon on a dark strip: steps behind ticked in green, the
    one it is on lit in an amber tube, the rest off. Returns its width."""
    f = font(10, bold=True)
    notes = ["Plan", hired, "Review", "Report"]
    texts = [f"✓ {n}" if i < step else f"{n}…" if i == step else n for i, n in enumerate(notes)]
    w = sum(round(d.textlength(tx, font=f)) + 12 for tx in texts) + 3 * len(texts) + 3
    rfill(im, [x, y, x + w, y + 21], hexa(BOARD, 0xE6), R_CONTROL)
    nx = x + 3
    for i, tx in enumerate(texts):
        nw = round(d.textlength(tx, font=f)) + 12
        if i == step:
            rfill(im, [nx, y + 3, nx + nw, y + 18], lift("accent") + (0x1F,), R_TAG)
            tube(im, [nx, y + 3, nx + nw, y + 18], C["accent"], R_TAG, 0xCC)
        ink = lift("accent") if i == step else lift(DONE_NEON) if i < step else hexa(NIGHT_OFF)[:3]
        d.text((nx + 6, y + 4), tx, font=f, fill=ink + (255,))
        nx += nw + 3
    return w


def plan_board(im, d, x, y, w) -> int:
    """The boss's PLAN board in neon: a note per piece, edged and written in
    the neon of where it is. Returns its height."""
    h = 5 + 16 + 4 + 36 + 5
    rfill(im, [x, y, x + w, y + h], hexa(BOARD, 0xF2), R_CARD)
    tube(im, [x, y, x + w, y + h], GROUP_NEON, R_CARD, 0x66)
    sg = sign("PLAN", GROUP_NEON)
    im.alpha_composite(sg, (x + 5, y + 5))
    d.text((x + 11 + sg.width, y + 8), fit(d, "for: add Google login and a test · 0/3 passed review", font(9, bold=True), w - sg.width - 20),
           font=font(9, bold=True), fill=hexa(NIGHT_TEXT))
    nx, ny = x + 5, y + 25
    for piece, state, who in PLAN:
        neon, mark, text = NOTE[state]
        lit = lift(neon)
        rfill(im, [nx, ny, nx + 131, ny + 35], lit + (0x14,), R_TAG)
        tube(im, [nx, ny, nx + 131, ny + 35], neon, R_TAG, 0x66 if state == "todo" else 0xB3)
        d.text((nx + 6, ny + 3), fit(d, piece, font(10.5, bold=True), 120), font=font(10.5, bold=True), fill=hexa("#eef1ff"))
        foot = f"{mark} {text}"
        d.text((nx + 6, ny + 20), foot, font=font(9.5), fill=lit + (255,))
        if who:
            d.text((nx + 12 + d.textlength(foot, font=font(9.5)), ny + 20), fit(d, who, font(9.5), 60), font=font(9.5), fill=hexa(NIGHT_TEXT))
        nx += 136
    return h


def rug(im, d, x0, y, width, n, s, z, most) -> int:
    """A space's rug: its number in neon and its name, the boss's flow on the
    boss's, then a cubicle per tab; its edge a thin tube of its colour, or the
    frame of who works or waits there. Returns its height."""
    rp, hdr, cgap = 8, 18, 8
    color = s["color"]
    boss = s["name"] == "web-app"
    inner = width - 2 * rp
    rows, row, used = [], [], 0
    for t in s["tabs"]:
        node = tab_node(t, z, most)
        tw, th = tree_size(node, z)
        w, h = tw + 2 * z["cp"] + 2, 4 + 16 + z["gap"] + th + z["cp"] + 2
        if row and used + cgap + w > inner:
            rows.append(row)
            row, used = [], 0
        row.append((t, node, w, h))
        used += (cgap if used else 0) + w
    rows.append(row)
    rug_h = 5 + hdr + 7 + (22 + 7 if boss else 0) + sum(max(h for *_, h in r) for r in rows) + cgap * (len(rows) - 1) + 8
    box = [x0, y, x0 + width - 1, y + rug_h - 1]
    rfill(im, box, hexa(color, 0x24), R_ROOM)
    sts = [st for _, st in staff(s)]
    status = urgent(sts)
    if status:
        busy_marks(im, box, status, R_ROOM)
    else:
        tube(im, box, color, R_ROOM, 0x66)
    hy = y + 5
    sg = sign(number(n), color)
    im.alpha_composite(sg, (x0 + rp, hy + 1))
    nf = font(12.5, bold=True)
    nx = x0 + rp + sg.width + 6
    d.text((nx, hy + 1), s["name"], font=nf, fill=hexa("foreground"))
    if s.get("branch"):
        d.text((nx + 8 + d.textlength(s["name"], font=nf), hy + 3), s["branch"], font=font(10.5), fill=hexa("dim"))
    right = box[2] - rp
    bw = round(d.textlength("+ Tab", font=font(10.5))) + 14
    button(im, d, right - bw, hy - 1, "+ Tab")
    right -= bw + 6
    if status:
        k = sts.count(status)
        text = f"! {k} need{'s' if k == 1 else ''} you" if status == "blocked" else f"● {k} working"
        tf = font(10, bold=status == "blocked")
        tx = right - d.textlength(text, font=tf)
        if status == "blocked":
            rfill(im, [tx - 5, hy + 1, right + 3, hy + 15], hexa(TAG), R_TAG)
        d.text((tx, hy + 2), text, font=tf, fill=(255, 255, 255, 255) if status == "blocked" else bright("working"))
    py = hy + hdr + 7
    if boss:
        d.text((x0 + rp, py + 5), "BOSS", font=font(10, bold=True), fill=hexa("muted"))
        flow(im, d, x0 + rp + 38, py, 1, "Hired 2 agents · 2 at work")
        py += 22 + 7
    for r in rows:
        px = x0 + rp
        for t, node, w, h in r:
            here = s.get("active") and t.get("active")
            cb = [px, py, px + w - 1, py + h - 1]
            rfill(im, cb, SHADE + (0x70,), R_CARD)
            if here:
                tube(im, cb, color, R_CARD, 0xB3)
            else:
                rline(im, cb, lift(color) + (0x2E,), R_CARD)
            d.text((px + z["cp"] + 1, py + 4), fit(d, t["name"], font(z["text"]), w - 12), font=font(z["text"]),
                   fill=hexa("accent" if here else "muted"))
            draw_node(im, d, t, node, px + z["cp"] + 1, py + 4 + 16 + z["gap"], z)
            px += w + cgap
        py += max(h for *_, h in r) + cgap
    return rug_h


def draw_floor(im, d, x0, y, width, z, most) -> int:
    """The floor: a band per group (a cyan tube, its count and status), its
    spaces' rugs under it on a line, then the rest. Returns where it ends."""
    owner = {name: band for band, names in GROUPS for name in names}
    banded = set()
    for n, s in enumerate(SPACES):
        band = owner.get(s["name"])
        if band and band in banded:
            continue
        if band:
            banded.add(band)
            members = [(k, x) for k, x in enumerate(SPACES) if owner.get(x["name"]) == band]
            box = [x0, y, x0 + width - 1, y + 25]
            rfill(im, box, SHADE + (0x99,), R_CARD)
            tube(im, box, GROUP_NEON, R_CARD, 0x66)
            d.text((x0 + 8, y + 6), "▾", font=font(10), fill=hexa("muted"))
            d.text((x0 + 24, y + 5), band, font=font(13, bold=True), fill=hexa("foreground"))
            group_count(d, im, x0 + 32 + round(d.textlength(band, font=font(13, bold=True))), y + 6, members,
                        back=hexa("muted", 0x33), ink="foreground")
            right = box[2] - 6
            for text in ("×", "✎"):
                bw = round(d.textlength(text, font=font(10.5))) + 14
                button(im, d, right - bw, y + 3, text)
                right -= bw + 4
            sts = [st for _, x in members for _, st in staff(x)]
            if urgent(sts) == "blocked":
                k = sts.count("blocked")
                text = f"! {k} need{'s' if k == 1 else ''} you"
                tx = right - 4 - d.textlength(text, font=font(10, bold=True))
                rfill(im, [tx - 5, y + 6, right - 1, y + 19], hexa(TAG), R_TAG)
                d.text((tx, y + 6), text, font=font(10, bold=True), fill=(255, 255, 255, 255))
            y += 26 + 8
            gy = y
            for k, x in members:
                y += rug(im, d, x0 + 13, y, width - 13, k, x, z, most) + 10
            rfill(im, [x0, gy, x0, y - 10], hexa("muted", 0x2E))
            continue
        y += rug(im, d, x0, y, width, n, s, z, most) + 10
    return y


STATUS = {"working": "Working", "blocked": "Needs you", "done": "Done", "idle": "Idle"}
# What each pane's program is called, as the row prints it beside the role.
PROGRAMS = {"manager": "Claude Code", "developer": "Codex", "designer": "Frontend", "analyst": "Review",
            "tester": "Tests", "support": "Deploy", "writer": "Docs", "intern": "Claude Code"}


def agent_row(sb, d, x, y, space, tab, role, st, since) -> None:
    """One 30 px row of the Office Agent list: the face framed in its status
    colour, the name and role, the space and tab, then its state."""
    d.rectangle([x, y, x + 21, y + 21], fill=hexa("raised"), outline=hexa(st))
    sb.alpha_composite(load(f"mods/office-agents/art/{role}.png", (20, 20)), (x + 1, y + 1))
    right = SIDEBAR - 14
    if st == "blocked":
        tf, text, w = font(9.5, bold=True), "NEEDS YOU", round(d.textlength("NEEDS YOU", font=font(9.5, bold=True))) + 8
        rfill(sb, [right - w, y + 9, right, y + 21], hexa(TAG), R_TAG)
        d.text((right - w + 4, y + 9), text, font=tf, fill=(255, 240, 230, 255))
    else:
        text = f"{STATUS[st]} · {since}" if since else STATUS[st]
        tf = font(10)
        w = round(d.textlength(text, font=tf))
        d.text((right - w, y + 10), text, font=tf, fill=bright("working") if st == "working" else hexa(st))
    tx = x + 27
    f = font(11.5)
    rf = font(9.5)
    name = fit(d, PROGRAMS.get(role, role), f, right - w - 12 - tx - d.textlength(role, font=rf) - 5)
    d.text((tx, y + 3), name, font=f, fill=hexa("foreground"))
    d.text((tx + d.textlength(name, font=f) + 5, y + 6), role, font=rf, fill=hexa("dim"))
    d.text((tx, y + 17), fit(d, f"{space} › {tab}", font(10), right - w - 12 - tx), font=font(10), fill=hexa("dim"))


def draw_agents(sb: Image.Image, top: int, bottom: int) -> None:
    """The sidebar's Office Agent list: a header (the counts, the time), the back
    wall, then one row per agent; spaces in a group sit in a band (a cyan tube) under its name."""
    d = ImageDraw.Draw(sb, "RGBA")
    rows = [(s["name"], t["name"], role, st, t.get("since", ""))
            for s in SPACES for t in s["tabs"] for role, st, _ in t["panes"] if st]
    busy, waiting = [r[3] for r in rows].count("working"), [r[3] for r in rows].count("blocked")

    d.rectangle([0, top, SIDEBAR - 1, top + 27], fill=hexa("chrome"))
    d.text((16, top + 6), "Office Agent", font=font(11.5, bold=True), fill=hexa("foreground"))
    info = f"{busy}/{len(rows)} at work · 21:40"
    right = SIDEBAR - 12
    d.text((right - d.textlength(info, font=font(10.5)), top + 8), info, font=font(10.5), fill=hexa("dim"))
    if waiting:
        need = f"{waiting} need{'s' if waiting == 1 else ''} you ·"
        d.text((right - 8 - d.textlength(info, font=font(10.5)) - d.textlength(need, font=font(11.5)), top + 7),
               need, font=font(11.5), fill=hexa("blocked"))

    sb.alpha_composite(part("wall"), (0, top + 28))
    tint(sb, [0, top + 72, SIDEBAR, bottom], hexa("canvas", 0xD9))

    owner = {name: band for band, names in GROUPS for name in names}
    y, banded = top + 80, set()
    for space, tab, role, st, since in rows:
        band = owner.get(space)
        if band and band not in banded:
            banded.add(band)
            states = [r[3] for r in rows if owner.get(r[0]) == band]
            n = len(states)
            rfill(sb, [8, y, SIDEBAR - 9, y + 21], SHADE + (0x99,), R_CARD)
            tube(sb, [8, y, SIDEBAR - 9, y + 21], GROUP_NEON, R_CARD, 0x59)
            d.text((14, y + 4), "▾", font=font(9), fill=hexa("dim"))
            d.text((30, y + 3), band, font=font(10.5, bold=True), fill=hexa("foreground"))
            bx = SIDEBAR - 14 - d.textlength(str(n), font=font(10))
            d.text((bx, y + 5), str(n), font=font(10), fill=hexa("dim"))
            # Its most urgent status and how many are in it, seen even folded.
            most = "blocked" if "blocked" in states else "working" if "working" in states else None
            if most == "blocked":
                tag = f"! {states.count('blocked')}"
                w = round(d.textlength(tag, font=font(9.5, bold=True))) + 8
                rfill(sb, [bx - 6 - w, y + 5, bx - 6, y + 17], hexa(TAG), R_TAG)
                d.text((bx - 6 - w + 4, y + 5), tag, font=font(9.5, bold=True), fill=(255, 255, 255, 255))
            elif most == "working":
                tag = f"● {states.count('working')}"
                d.text((bx - 6 - d.textlength(tag, font=font(10)), y + 5), tag, font=font(10), fill=bright("working"))
            y += 25
        agent_row(sb, d, 18 if band else 14, y, space, tab, role, st, since)
        y += 31


def chip(im, d, x, y, text, on=False, size=11, w=None) -> int:
    """A framed chip or button as the panel draws them; returns its width."""
    f = font(size)
    w = w or round(d.textlength(text, font=f)) + 16
    rfill(im, [x, y, x + w - 1, y + 21], hexa("#3a3527") if on else SHADE + (0x99,), R_CONTROL)
    rline(im, [x, y, x + w - 1, y + 21], hexa("accent") if on else hexa("muted", 0x55), R_CONTROL)
    d.text((x + 8, y + 3), fit(d, text, f, w - 14), font=f, fill=hexa("foreground" if on else "muted"))
    return w


def draw_boss(p, d, by, pw) -> int:
    """The boss's office (room.js, 136 high, the band growing under it): on the
    wall the space picker (BOSS · its space) in the space's neon, the team,
    Stop in red neon, the flow, the PLAN board; on the floor what it says, the
    goal box and Tell. Returns the band's height."""
    left = 88
    room, color = "web-app", "ansi6"
    y = by + 9
    # The wall row: the picker, the team, Stop.
    pf, rf = font(11.5, bold=True), font(11.5, bold=True)
    pwid = 9 + round(d.textlength("BOSS", font=pf)) + 5 + 6 + 5 + round(d.textlength(room, font=rf)) + 6 + 10 + 9
    board(p, [left, y, left + pwid, y + 25], color, R_CONTROL)
    x = left + 9
    d.text((x, y + 5), "BOSS", font=pf, fill=lift(NEON) + (255,))
    x += round(d.textlength("BOSS", font=pf)) + 5
    rfill(p, [x, y + 10, x + 5, y + 15], hexa("working"), 3)
    x += 11
    d.text((x, y + 5), room, font=rf, fill=lift(color) + (255,))
    d.text((left + pwid - 18, y + 5), "▾", font=font(11), fill=lift(color) + (255,))
    team = "team 2 · 2/4 working"
    tx = left + pwid + 8
    tw = round(d.textlength(team, font=font(10.5))) + 12
    rfill(p, [tx, y + 3, tx + tw, y + 22], hexa(BOARD, 0xCC), R_CONTROL)
    d.text((tx + 6, y + 6), team, font=font(10.5), fill=hexa(NIGHT_TEXT))
    stop = "■ Stop"
    sw = round(d.textlength(stop, font=font(10.5, bold=True))) + 12
    sx = pw - 40 - sw
    rfill(p, [sx, y + 3, pw - 40, y + 22], hexa(BOARD, 0xE6), R_CONTROL)
    tube(p, [sx, y + 3, pw - 40, y + 22], STOP_NEON, R_CONTROL, 0xCC)
    d.text((sx + 6, y + 6), stop, font=font(10.5, bold=True), fill=hexa("#ffd9d2"))
    rfill(p, [pw - 30, by + 12, pw - 11, by + 31], hexa("#0d131b", 204), R_CONTROL)
    d.text((pw - 25, by + 14), "▴", font=font(11), fill=hexa("dim"))
    # The flow, then the plan.
    y += 26 + 6
    flow(p, d, left, y, 1, "Hired 2 agents · 2 at work")
    y += 22 + 6
    y += plan_board(p, d, left, y, pw - 12 - left) + 6
    # On the floor: what it says, the goal box and Tell.
    y += 4
    d.text((left, y + 1), fit(d, "Hired frontend-nav and design-login", font(11.5), pw - left - 12), font=font(11.5), fill=hexa("foreground"))
    y += 18 + 6
    tell = "Tell ⏎"
    aw = round(d.textlength(tell, font=font(12, bold=True))) + 24
    gx1 = pw - 12 - aw - 6
    rfill(p, [left, y, gx1, y + 27], hexa(BOARD, 0xE6), R_CONTROL)
    tube(p, [left, y, gx1, y + 27], GROUP_NEON, R_CONTROL, 0x66)
    d.text((left + 9, y + 6), fit(d, "What should the team do? Type or paste a spec · Ctrl+Enter", font(12), gx1 - left - 16),
           font=font(12), fill=hexa("dim"))
    d.text((left + 2, y + 31), fit(d, "On: add Google login and a test", font(10), gx1 - left), font=font(10), fill=hexa("#a9b8c6"))
    board(p, [pw - 12 - aw, y, pw - 12, y + 27], C["accent"], R_CONTROL, alpha=0xFF, glow=0x2E)
    d.text((pw - 12 - aw + 12, y + 6), tell, font=font(12, bold=True), fill=lift("accent") + (255,))
    return y + 27 + 2 + 13 + 10 - by


def draw_panel(im: Image.Image, box) -> None:
    """The side panel on its Office tab: header, the boss, Needs you, the floor
    (desks two lines under each) and the inspector."""
    x0, y0, x1, y1 = box
    pw, ph = x1 - x0, y1 - y0
    p = Image.new("RGBA", (pw, ph), hexa("#242738"))
    floor = load("mods/office-agents/room/floor-tiles.png")
    floor = floor.resize((floor.width // 2, floor.height // 2), Image.NEAREST)
    p.alpha_composite(floor.crop((0, 0, pw, min(ph, floor.height))), (0, 0))
    d = ImageDraw.Draw(p, "RGBA")
    people = [st for s in SPACES for _, st in staff(s)]

    # Header: the filters, the time.
    d.rectangle([0, 0, pw, 33], fill=hexa("chrome"))
    d.text((14, 9), "Office", font=font(12.5, bold=True), fill=hexa("foreground"))
    x = 72
    for key, name in (("all", "All"), ("working", "Working"), ("blocked", "Needs you"), ("done", "Done")):
        count = len(people) if key == "all" else people.count(key)
        f = font(11)
        w = round(d.textlength(f"{name}  {count}", font=f)) + 16 + (11 if key != "all" else 0)
        on = key == "all"
        rfill(p, [x, 6, x + w - 1, 27], hexa("#3a3527") if on else hexa("chrome"), R_CONTROL)
        rline(p, [x, 6, x + w - 1, 27], hexa("accent") if on else mix("muted", "#161f28", 0.75), R_CONTROL)
        tx = x + 8
        if key != "all":
            rfill(p, [tx, 14, tx + 5, 19], hexa(key), 3)
            tx += 11
        d.text((tx, 9), name, font=f, fill=hexa("foreground" if on else "muted"))
        d.text((tx + d.textlength(name + "  ", font=f), 9), str(count), font=f,
               fill=hexa("blocked") if key == "blocked" else hexa("dim"))
        x += w + 5
    d.text((pw - 44, 10), "21:40", font=font(11), fill=hexa("dim"))

    # The boss's office: the picture, the carpet under it as the band grows.
    by = 34
    band = draw_boss(Image.new("RGBA", (pw, ph)), ImageDraw.Draw(Image.new("RGBA", (pw, ph))), by, pw)
    rfill(p, [0, by, pw - 1, by + band - 1], hexa("#242738"))
    p.alpha_composite(part("boss-office").crop((0, 0, pw, 136)), (0, by))
    d.line([0, by + band - 1, pw, by + band - 1], fill=hexa("#11161f"))
    p.alpha_composite(part("boss-working"), (12, by + 136 - 98))
    draw_boss(p, d, by, pw)

    # Needs you: a waiting agent's question and its choices.
    cy = by + band + 8
    ch = 136
    rfill(p, [8, cy, pw - 9, cy + ch], hexa("#2a1f1c"), R_ROOM)
    rline(p, [8, cy, pw - 9, cy + ch], hexa("blocked"), R_ROOM, 2)
    d.rectangle([16, cy + 8, 46, cy + 38], fill=hexa("raised"), outline=hexa("blocked"))
    p.alpha_composite(load("mods/office-agents/art/tester.png", (28, 28)), (17, cy + 9))
    d.text((54, cy + 8), "Needs you · Tester · Claude Code", font=font(12, bold=True), fill=hexa("foreground"))
    d.text((54, cy + 25), "api › tests · waiting 3m", font=font(10.5), fill=hexa("dim"))
    bx = pw - 17
    for text in ("Open ↗", "Terminal"):
        w = round(d.textlength(text, font=font(11))) + 16
        bx -= w
        chip(p, d, bx, cy + 11, text, w=w)
        bx -= 5
    qy = cy + 46
    rfill(p, [16, qy, pw - 17, qy + 52], hexa("#11161d"), R_TAG)
    for i, q in enumerate(("git push origin feat/tests", "Push the branch", "Do you want to proceed?")):
        d.text((24, qy + 3 + i * 16), q, font=mono(11.5), fill=hexa("foreground"))
    x = 16
    for text in ("1  Yes", "2  Yes, and don't ask again for git push", "3  No, and tell Claude what…"):
        x += chip(p, d, x, qy + 60, text) + 5

    # The floor: the group band, the rugs, the desks with two lines under each.
    fy = cy + ch + 1 + 10
    z = WIDE
    inspect = 56
    most = max(1, min(6, (pw - 40 + z["gap"]) // (z["slot"] + z["gap"])))
    floor_img = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    draw_floor(floor_img, ImageDraw.Draw(floor_img, "RGBA"), 10, fy, pw - 20, z, most)
    p.alpha_composite(floor_img.crop((0, fy, pw, ph - inspect)), (0, fy))

    # The inspector, one bar, on the designer the boss hired.
    iy = ph - inspect
    d.rectangle([0, iy, pw, ph], fill=hexa("#121a23"))
    d.rectangle([0, iy, pw, iy + 1], fill=hexa("accent"))
    d.rectangle([12, iy + 10, 47, iy + 45], fill=hexa("raised"), outline=hexa("working"))
    p.alpha_composite(load("mods/office-agents/art/designer.png", (34, 34)), (13, iy + 11))
    title = "Designer · Claude Code"
    d.text((58, iy + 11), title, font=font(12.5, bold=True), fill=hexa("foreground"))
    d.text((58 + d.textlength(title + "  ", font=font(12.5, bold=True)), iy + 12), "● Working · 12m", font=font(11), fill=bright("working"))
    d.text((58, iy + 30), "web-app › Boss · …/code/web-app · feat/login", font=font(10.5), fill=hexa("dim"))
    bx = pw - 12
    for text in ("Peek", "Go to desk", "Terminal ↗"):
        w = round(d.textlength(text, font=font(11))) + 16
        bx -= w
        chip(p, d, bx, iy + 17, text, w=w)
        bx -= 5
    im.alpha_composite(p, (x0, y0))


def faces(im: Image.Image, x: int, roles: list[tuple[str, str]]) -> int:
    if len(roles) == 1:
        im.alpha_composite(load(f"mods/office-agents/art/{roles[0][0]}.png", (44, 44)), (x, 7))
        return 44
    for n, (role, st) in enumerate(roles[:4]):
        fx = x + n * 22
        rfill(im, [fx, 12, fx + 33, 45], hexa(st), 5)
        rfill(im, [fx + 1, 13, fx + 32, 44], hexa("raised"), 4)
        im.alpha_composite(load(f"mods/office-agents/art/{role}.png", (32, 32)), (fx + 1, 13))
    return 34 + 22 * (min(4, len(roles)) - 1)


def draw_tabs(im: Image.Image) -> None:
    """The tab bar: the tab you are in lit like a neon sign (a tube in the
    accent, its glow round it), then the side panels' buttons, each its picture
    and its neon sign, lit while its panel is open."""
    tint(im, [SIDEBAR, 0, W, TABS], hexa("chrome", 0x99))
    td = ImageDraw.Draw(im, "RGBA")
    td.line([SIDEBAR, TABS, W, TABS], fill=hexa("border", 0x66))
    x = SIDEBAR + 10
    tabs = [([("manager", "working"), ("developer", "working"), ("designer", "working")], "Boss", True),
            ([("analyst", "done")], "review", False)]
    for people, name, active in tabs:
        tw = 210 if len(people) > 1 else 150
        box = [x, 5, x + tw, TABS - 5]
        rfill(im, box, hexa("raised" if active else "chrome"), 8)
        if active:
            rline(im, [x - 2, 3, x + tw + 2, TABS - 3], hexa("accent", 0x40), 10, 2)
            tube(im, box, C["accent"], 8, 0xFF, 2)
        fw = faces(im, x + 8, people)
        td.text((x + 15 + fw, 21), name, font=font(13), fill=hexa("foreground" if active else "muted"))
        x += tw + 3
    signs = [(kind, sign(name.upper(), color, on), on) for kind, name, color, on in PANELS]
    widths = [6 + 20 + 6 + sg.width + 6 for _, sg, _ in signs]
    bx = W - 12 - sum(widths) - 3 * (len(widths) - 1)
    td.text((bx - 30, 18), "+", font=font(16), fill=hexa("dim"))
    for (kind, sg, on), w in zip(signs, widths):
        icon = load(f"mods/office-tabs/art/{kind}.png", (20, 20))
        if not on:
            icon.putalpha(icon.getchannel("A").point(lambda a: round(a * 0.75)))
        im.alpha_composite(icon, (bx + 6, 19))
        im.alpha_composite(sg, (bx + 32, 21))
        bx += w + 3


def main() -> None:
    im = Image.new("RGBA", (W, H), hexa("canvas"))
    im.paste(wallpaper((W, H)), (0, 0))
    panel = (W - PAD - PANEL, TABS + PAD, W - PAD, H - 28 - PAD)
    pane = (SIDEBAR + PAD, TABS + PAD, panel[0] - PAD, H - 28 - PAD)
    pw, ph = pane[2] - pane[0], pane[3] - pane[1]
    im.paste(wallpaper((pw, ph)), pane[:2])
    tint(im, pane, hexa("background", 0xDB))  # terminal_opacity 0.86 over the wallpaper
    tint(im, [pane[0], pane[1], pane[2], pane[1] + 30], hexa("chrome", 0xC8))
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle(pane, outline=hexa("border", 0x4D))
    d.text((pane[0] + 12, pane[1] + 8), "web-app / Boss — Hiring the team", font=font(13), fill=hexa("muted"))
    lines = [
        ("accent", "$ herdr-app do layout.switch '{\"name\":\"office\"}'"),
        ("foreground", "switched to office (office-night)"),
        ("dim", ""),
        ("working", "● 3 spaces · 8 agents at their desks"),
        ("foreground", "web-app  Boss    manager · developer · designer"),
        ("foreground", "web-app  review  analyst"),
        ("blocked", "needs you  tester: allow `git push`?"),
    ]
    y = pane[1] + 46
    for key, text in lines:
        if text:
            d.text((pane[0] + 14, y), text, font=font(14, bold=text.startswith("●")), fill=hexa(key))
        y += 22

    sb = Image.new("RGBA", (SIDEBAR, H), hexa("canvas"))
    sb.paste(wallpaper((SIDEBAR, H)), (0, 0))
    sd = ImageDraw.Draw(sb, "RGBA")
    sd.rectangle([0, 0, SIDEBAR, 46], fill=hexa("chrome", 0xC8))
    sb.alpha_composite(part("logo"), (14, 7))
    sd.text((56, 6), "Office Agent", font=font(14, bold=True), fill=hexa("foreground"))
    sd.text((56, 25), "on Herdr", font=font(11), fill=hexa("dim"))
    draw_spaces(sb, 46)
    draw_agents(sb, 46 + SPACES_H, H - 69)
    sd = ImageDraw.Draw(sb, "RGBA")
    sd.rectangle([0, H - 69, SIDEBAR, H], fill=hexa("chrome"))
    sd.line([0, H - 69, SIDEBAR, H - 69], fill=hexa("border", 0x66))
    sd.text((16, H - 60), "Settings", font=font(13), fill=hexa("muted"))
    sd.text((16, H - 34), "Add machine", font=font(13), fill=hexa("dim"))
    im.alpha_composite(sb, (0, 0))

    draw_tabs(im)
    draw_panel(im, panel)
    td = ImageDraw.Draw(im, "RGBA")
    td.rectangle([SIDEBAR, H - 28, W, H], fill=hexa("chrome"))
    td.text((SIDEBAR + 14, H - 22), "office · 3 spaces · 8 agents", font=font(11), fill=hexa("dim"))

    out = im.convert("RGB")
    out.save(os.path.join(ROOT, "preview.png"))
    # Layout picker thumbnail: the left of the window, where the office is.
    thumb = out.resize((round(W * 468 / H), 468), Image.LANCZOS).crop((0, 0, 640, 468))
    thumb.quantize(colors=128).save(os.path.join(ROOT, "layouts/office.png"), optimize=True)
    print("wrote preview.png and layouts/office.png")


if __name__ == "__main__":
    main()
