#!/usr/bin/env python3
"""Compose a mock office window from the real mod art, so the layout can be
reviewed without Herdr. Not part of the mods - nothing reads this file.

    python3 tools/build-preview.py     # writes preview.png and layouts/office.png

The mock follows layouts/office.json and the sizes the mods ask for: a 300 px
sidebar (46 header, Spaces, the office, 69 footer), 58 px tab bar, 8 px padding,
and the side panel open on the Office tab at its first width, 640 px. Spaces
are rooms (a door with its number, lamp, sticky notes, faces); in the office
each space is a rug, each tab a cubicle on it, each pane a desk. The panel shows
the header with the filters, the boss in front of the back wall, a Needs you
card, the floor (two lines under each desk, an "Add desk" place in each
cubicle) and the inspector bar on the picked staff member. A tab with a `tree`
shows its split; others, rows.
"""

from __future__ import annotations

import json
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1600, 900
SIDEBAR = 300
TABS = 58
PAD = 8
SPACES_H = 200
PANEL = 640

THEME = json.load(open(os.path.join(ROOT, "themes/office-night.json")))
C = THEME["colors"]
INK = "#1d2733"
TAG = "#c8392f"


def hexa(key: str, alpha: int = 255) -> tuple[int, int, int, int]:
    if key.startswith("#"):
        v = key
    elif key.startswith("ansi") and key[4:].isdigit():
        v = THEME["ansi"][int(key[4:])]
    else:
        v = C[key]
    v = v.lstrip("#")
    return (int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16), alpha)


def mono(size: float):
    path = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
    return ImageFont.truetype(path, round(size)) if os.path.exists(path) else font(size)


def font(size: float, bold: bool = False):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else ""),
                 "/usr/share/fonts/truetype/liberation/LiberationSans%s.ttf" % ("-Bold" if bold else "")):
        if os.path.exists(path):
            return ImageFont.truetype(path, round(size))
    return ImageFont.load_default()


def load(rel: str, size: tuple[int, int] | None = None, frame: int = 0) -> Image.Image:
    im = Image.open(os.path.join(ROOT, rel))
    if getattr(im, "n_frames", 1) > 1:
        im.seek(frame % im.n_frames)
    im = im.convert("RGBA")
    return im.resize(size, Image.NEAREST) if size else im


def fit(d: ImageDraw.ImageDraw, text: str, f, width: int) -> str:
    if d.textlength(text, font=f) <= width:
        return text
    while text and d.textlength(text + "…", font=f) > width:
        text = text[:-1]
    return text + "…"


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

# Desk sizes as office-agents draws them: the sidebar at 2 points an art pixel,
# the wide panel at 3 with a second line under each desk.
SMALL = {"dw": 72, "dh": 60, "slot": 80, "label": 13, "text": 10, "gap": 6, "cp": 4, "wide": False}
LARGE = {"dw": 108, "dh": 90, "slot": 120, "label": 16, "text": 11.5, "gap": 8, "cp": 5, "wide": True}


def slot_h(z) -> int:
    return z["dh"] + 1 + z["label"] + (1 + z["label"] - 3 if z["wide"] else 0)


def grid(n: int) -> int:
    return n if n <= 3 else 2 if n == 4 else 3


def staff(s) -> list[tuple[str, str]]:
    return [(role, st) for t in s["tabs"] for role, st, _ in t["panes"] if st]


def urgent(sts) -> str | None:
    return "blocked" if "blocked" in sts else "working" if "working" in sts else None


def wallpaper(size: tuple[int, int]) -> Image.Image:
    paper = load("mods/office-chrome/wallpaper.png").convert("RGB")
    scale = max(size[0] / paper.width, size[1] / paper.height)  # "cover", as the layout asks
    return paper.resize((int(paper.width * scale) + 1, int(paper.height * scale) + 1)).crop((0, 0, *size))


def darken(key: str, k: float) -> tuple[int, int, int, int]:
    c = hexa(key)
    return tuple(round(v * (1 - k)) for v in c[:3]) + (255,)


def door(sb, d, x, y, number, color, status, occupied) -> None:
    """A room's door, as office-spaces draws it: 26x32, lamp on top."""
    def box(top, left, w, h, fill):
        if len(fill) == 4 and fill[3] < 255:
            tint(sb, [x + left, y + top, x + left + w - 1, y + top + h - 1], fill)
        else:
            d.rectangle([x + left, y + top, x + left + w - 1, y + top + h - 1], fill=fill)
    if status == "working":
        box(0, 5, 16, 6, hexa("working", 0x50))
    box(0, 8, 10, 3, hexa(status) if status else hexa("#3a4250"))
    box(4, 0, 26, 28, darken(color, 0.45))
    box(5, 2, 22, 27, hexa(color))
    box(8, 5, 16, 6, hexa("#f0c06e") if occupied else hexa("#16202b"))
    box(8, 12, 2, 6, darken(color, 0.3))
    box(17, 5, 15, 10, hexa("#efe6d2"))
    f = font(8, bold=True)
    d.text((x + 5 + 7.5 - d.textlength(number, font=f) / 2, y + 17), number, font=f, fill=hexa(INK))
    box(23, 21, 2, 2, hexa("#e8ba62"))


def draw_spaces(sb: Image.Image, d: ImageDraw.ImageDraw, top: int) -> None:
    d.text((16, top + 9), "Spaces", font=font(11.5), fill=hexa("dim"))
    d.text((SIDEBAR - 28, top + 5), "+", font=font(15), fill=hexa("dim"))
    y = top + 31
    for n, s in enumerate(SPACES):
        box = [8, y, SIDEBAR - 8, y + 44]
        if s.get("active"):
            tint(sb, box, hexa("surface", 0xC8))
            tint(sb, box, hexa("accent", 0x12))
            d.rectangle([box[0], box[1], box[0] + 1, box[3]], fill=hexa("accent"))
        people = staff(s)
        status = urgent([st for _, st in people])
        if status == "working":
            tint(sb, box, hexa("working", 0x2E))
            d.rectangle(box, outline=hexa("working"))
        elif status == "blocked":
            tint(sb, box, hexa("blocked", 0x30))
            d.rectangle(box, outline=hexa("blocked"), width=2)
        door(sb, d, box[0] + 10, y + 6, f"{n + 1:02d}", s["color"], status, bool(people))
        tx = box[0] + 10 + 26 + 10
        d.text((tx, y + 6), s["name"], font=font(13), fill=hexa("foreground"))
        if status == "blocked":
            nx = tx + d.textlength(s["name"], font=font(13)) + 9
            d.rectangle([nx, y + 8, nx + 10, y + 21], fill=hexa(TAG))
            d.text((nx + 3, y + 7), "!", font=font(11, bold=True), fill=(255, 255, 255, 255))
        if s["tail"]:
            tf = font(11.5)
            d.text((box[2] - 10 - d.textlength(s["tail"], font=tf), y + 8), s["tail"], font=tf, fill=hexa("dim"))
        x = tx
        nf = font(9.5, bold=True)
        for color, text in s["git"]:
            w = round(d.textlength(text, font=nf)) + 8
            d.rectangle([x, y + 26, x + w - 1, y + 38], fill=hexa(color))
            d.rectangle([x + w - 3, y + 36, x + w - 1, y + 38], fill=darken(color, 0.19))
            d.text((x + 4, y + 26), text, font=nf, fill=hexa(INK))
            x += w + 4
        fx = box[2] - 8 - min(5, len(people)) * 16 + 2
        for role, st in people[:5]:
            d.rectangle([fx, y + 25, fx + 13, y + 38], fill=hexa("raised"), outline=hexa(st))
            sb.alpha_composite(load(f"mods/office-agents/art/{role}.png", (12, 12)), (fx + 1, y + 26))
            fx += 16
        y += 46


def width_of(node) -> int:
    if not isinstance(node, tuple):
        return 1
    kind, children = node
    ws = [width_of(c) for c in children]
    return sum(ws) if kind == "across" else max(ws)


def tab_node(t, z, most):
    """The tab's desks as office-agents places them: its split (wide: with the
    Add desk place beside it when there is room, else under it), else rows."""
    if "tree" in t:
        tree = t["tree"]
        if not z["wide"]:
            return tree
        return ("across", [tree, "g"]) if width_of(tree) < most else ("stacked", [tree, ("across", ["g"])])
    items = list(range(len(t["panes"]))) + (["g"] if z["wide"] else [])
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


def mix(a: str, b: str, t: float) -> tuple[int, int, int, int]:
    x, y = hexa(a), hexa(b)
    return tuple(round(x[i] + (y[i] - x[i]) * t) for i in range(3)) + (255,)


def bright(key: str, t: float = 0.3) -> tuple[int, int, int, int]:
    return mix(C[key], "#ffffff", t)


def busy_marks(sb, d, box, status, ring):
    """What the mods draw for someone working or waiting, at the pulse's peak."""
    x0, y0, x1, y1 = box
    if status == "working":
        tint(sb, box, hexa("working", 0x2E))
        d.rectangle([x0 - 1, y0 - 1, x1 + 1, y1 + 1], outline=bright("working"))
        if ring:
            d.rectangle([x0 - 3, y0 - 3, x1 + 3, y1 + 3], outline=hexa("working", 0xD8), width=2)
    elif status == "blocked":
        tint(sb, box, hexa("blocked", 0x30))
        d.rectangle([x0 - 2, y0 - 2, x1 + 2, y1 + 2], outline=hexa("blocked"), width=2)


def label(sb, d, cx, ly, z, text, color, back=True, tag=False):
    """A line under a desk, centred in its slot."""
    f = font(z["text"] - (1.5 if tag else 0), bold=tag)
    h = z["label"] if back or tag else z["label"] - 3
    text = fit(d, text, f, z["slot"] - 10)
    tw = d.textlength(text, font=f) + (10 if tag else 8)
    tx = cx + z["slot"] / 2 - tw / 2
    if tag:
        d.rectangle([tx, ly, tx + tw, ly + h - 1], fill=hexa(TAG))
    elif back:
        tint(sb, [round(tx), ly, round(tx + tw), ly + h - 1], (13, 19, 27, 0xB8))
    d.text((tx + (5 if tag else 4), ly + (h - f.size) / 2 - 1), text, font=f, fill=color)


def draw_desk(sb, d, t, i, cx, cy, z, shadow, frame):
    role, st, title = t["panes"][i]
    busy_marks(sb, d, [cx, cy, cx + z["slot"] - 1, cy + slot_h(z) - 1], st, True)
    dx = cx + (z["slot"] - z["dw"]) // 2
    sb.alpha_composite(shadow, (dx, cy))
    art = f"mods/office-agents/desks/{role}-{st}.gif" if role else "mods/office-agents/desks/empty.png"
    sb.alpha_composite(load(art, (z["dw"], z["dh"]), frame), (dx, cy))
    ly = cy + z["dh"] + 1
    paper = (255, 240, 230, 255)
    if not z["wide"]:
        if st == "blocked":
            label(sb, d, cx, ly, z, "NEEDS YOU", paper, tag=True)
        else:
            label(sb, d, cx, ly, z, title, hexa("foreground" if role else "muted"))
    else:
        label(sb, d, cx, ly, z, title, hexa("foreground" if role else "muted"))
        ly += z["label"] + 1
        since = t.get("since", "")
        if role is None:
            label(sb, d, cx, ly, z, f"…/{t['name']}", hexa("dim"), back=False)
        elif st == "blocked":
            label(sb, d, cx, ly, z, f"NEEDS YOU · {since}", paper, tag=True)
        else:
            text = {"working": f"● Working · {since}", "done": f"✓ Done · {since}"}.get(st, f"Idle · {since}")
            color = {"working": bright("working"), "done": hexa("done")}.get(st, hexa("dim"))
            label(sb, d, cx, ly, z, text, color, back=False)
    if st == "blocked":
        bx, by = cx + z["slot"] - 10, cy - 7
        d.rectangle([bx, by, bx + 14, by + 14], fill=hexa(TAG), outline=paper)
        d.text((bx + 5, by), "!", font=font(11, bold=True), fill=(255, 255, 255, 255))


def draw_ghost(sb, d, cx, cy, z):
    """The faded Add desk place of a wide cubicle."""
    dx = cx + (z["slot"] - z["dw"]) // 2
    d.rectangle([dx, cy, dx + z["dw"] - 1, cy + z["dh"] - 1], outline=mix("muted", "#1e2634", 0.72))
    empty = load("mods/office-agents/desks/empty.png", (z["dw"], z["dh"]))
    empty.putalpha(empty.getchannel("A").point(lambda a: round(a * 0.25)))
    sb.alpha_composite(empty, (dx, cy))
    f = font(round(z["dh"] * 0.4))
    d.text((dx + z["dw"] / 2 - d.textlength("+", font=f) / 2, cy + z["dh"] / 2 - f.size * 0.62), "+", font=f, fill=hexa("muted"))
    label(sb, d, cx, cy + z["dh"] + 1, z, "Add desk", hexa("dim"), back=False)


def draw_node(sb, d, t, node, x, y, z, shadow, frame):
    if node == "g":
        draw_ghost(sb, d, x, y, z)
        return
    if isinstance(node, int):
        draw_desk(sb, d, t, node, x, y, z, shadow, frame)
        return
    kind, children = node
    for c in children:
        draw_node(sb, d, t, c, x, y, z, shadow, frame)
        w, h = tree_size(c, z)
        if kind == "across":
            x += w + z["gap"]
        else:
            y += h + z["gap"]


def button(d, x, y, text, color="muted") -> int:
    """A small framed button (+ Tab, + New space); returns its width."""
    f = font(10.5)
    w = round(d.textlength(text, font=f)) + 14
    d.rectangle([x, y, x + w - 1, y + 19], fill=hexa("#0d131b"), outline=mix("muted", "#1e2634", 0.6))
    d.text((x + 7, y + 3), text, font=f, fill=hexa(color))
    return w


def draw_floor(sb, d, x0, y, width, z, most, frame) -> int:
    """The rugs, from `y`, within `width` points from `x0`; returns where they end."""
    shadow = load("mods/office-agents/desks/shadow.png", (z["dw"], z["dh"]))
    wide = z["wide"]
    rp, hdr, cgap = (8, 18, 8) if wide else (6, 15, 6)
    th_h = round(z["text"] + 4)
    for s in SPACES:
        color = hexa(s["color"])
        inner = width - 2 * rp - 2
        rows, row, used = [], [], 0
        for t in s["tabs"]:
            node = tab_node(t, z, most)
            tw, th = tree_size(node, z)
            w, h = tw + 2 * z["cp"] + 2, th_h + z["gap"] + th + z["cp"] + 2
            if row and used + cgap + w > inner:
                rows.append(row)
                row, used = [], 0
            row.append((t, node, w, h))
            used += (cgap if used else 0) + w
        rows.append(row)
        top_pad, gap5 = (5, 7) if wide else (3, 5)
        rug_h = top_pad + hdr + gap5 + sum(max(h for *_, h in r) for r in rows) + cgap * (len(rows) - 1) + (8 if wide else 6) + 1
        rug = [x0, y, x0 + width - 1, y + rug_h - 1]
        tint(sb, rug, color[:3] + (0x24,))
        d.rectangle(rug, outline=color[:3] + (0x66,))
        sts = [st for _, st in staff(s)]
        status = urgent(sts)
        busy_marks(sb, d, rug, status, False)
        sq = 9 if wide else 7
        hy = y + top_pad
        d.rectangle([rug[0] + rp + 1, hy + (hdr - sq) // 2, rug[0] + rp + sq, hy + (hdr - sq) // 2 + sq - 1], fill=color)
        nf = font(12.5 if wide else 11, bold=True)
        d.text((rug[0] + rp + sq + 7, hy), s["name"], font=nf, fill=hexa("foreground"))
        if wide and s.get("branch"):
            d.text((rug[0] + rp + sq + 14 + d.textlength(s["name"], font=nf), hy + 2), s["branch"], font=font(10.5), fill=hexa("dim"))
        right = rug[2] - rp
        if wide:
            button(d, right - 52, hy - 1, "+ Tab")
            right -= 52 + 6
        if status:
            n = sts.count(status)
            text = f"! {n} need{'s' if n == 1 else ''} you" if status == "blocked" else f"● {n} working"
            tf = font(10, bold=status == "blocked")
            tx = right - d.textlength(text, font=tf)
            if status == "blocked":
                d.rectangle([tx - 4, hy + 1, right + 3, hy + 14], fill=hexa(TAG))
            d.text((tx, hy + 1), text, font=tf, fill=(255, 255, 255, 255) if status == "blocked" else bright("working"))
        py = hy + hdr + gap5
        for r in rows:
            px = rug[0] + rp + 1
            for t, node, w, h in r:
                here = s.get("active") and t.get("active")
                tint(sb, [px, py, px + w - 1, py + h - 1], (8, 12, 18, 0x70))
                d.rectangle([px, py, px + w - 1, py + h - 1], outline=hexa("accent") if here else color[:3] + (0x88,))
                d.text((px + z["cp"] + 1, py + 2), fit(d, t["name"], font(z["text"]), w - 12), font=font(z["text"]),
                       fill=hexa("accent" if here else "muted"))
                draw_node(sb, d, t, node, px + z["cp"] + 1, py + 1 + th_h + z["gap"], z, shadow, frame)
                px += w + cgap
            py += max(h for *_, h in r) + cgap
        y += rug_h + (10 if wide else 8)
    return y


def office_header(sb, d, x0, y, width, wide) -> None:
    people = [st for s in SPACES for _, st in staff(s)]
    busy, waiting = people.count("working"), people.count("blocked")
    h = 32 if wide else 28
    d.rectangle([x0, y, x0 + width - 1, y + h - 1], fill=hexa("chrome"))
    if wide:
        d.text((x0 + 16, y + 8), "Office", font=font(12.5, bold=True), fill=hexa("foreground"))
    else:
        d.text((x0 + 16, y + 8), "Office", font=font(11.5), fill=hexa("dim"))
    right = x0 + width - 12
    if wide and waiting:
        bf = font(10.5, bold=True)
        bw = round(d.textlength("Next waiting →", font=bf)) + 14
        d.rectangle([right - bw, y + 6, right, y + 25], fill=hexa(TAG))
        d.text((right - bw + 7, y + 9), "Next waiting →", font=bf, fill=(255, 255, 255, 255))
        right -= bw + 6
    info = f"{busy}/{len(people)} at work · 21:40"
    d.text((right - d.textlength(info, font=font(11)), y + (10 if wide else 8)), info, font=font(11), fill=hexa("dim"))
    if waiting:
        need = f"{waiting} need{'s' if waiting == 1 else ''} you ·"
        d.text((right - 4 - d.textlength(info, font=font(11)) - d.textlength(need, font=font(11.5)), y + (10 if wide else 8)),
               need, font=font(11.5), fill=hexa("blocked"))


def draw_office(sb: Image.Image, top: int, bottom: int, frame: int) -> None:
    d = ImageDraw.Draw(sb, "RGBA")
    floor = load("mods/office-agents/room/floor.png")
    floor = floor.resize((floor.width // 2, floor.height // 2), Image.NEAREST)
    sb.paste(floor.crop((0, 0, SIDEBAR, bottom - top)), (0, top))
    office_header(sb, d, 0, top, SIDEBAR, False)
    wall = load("mods/office-agents/room/wall.png")
    sb.alpha_composite(wall.resize((wall.width // 2, wall.height // 2), Image.NEAREST), (0, top + 28))
    draw_floor(sb, d, 8, top + 28 + 44 + 8, SIDEBAR - 16, SMALL, 3, frame)


def chip(d, x, y, text, on=False, size=11, color=None, w=None) -> int:
    """A framed chip or button as the panel draws them; returns its width."""
    f = font(size)
    w = w or round(d.textlength(text, font=f)) + 16
    d.rectangle([x, y, x + w - 1, y + 21], fill=hexa("#3a3527") if on else hexa("#0d131b"),
                outline=hexa("accent") if on else mix(color or "muted", "#161f28", 0.55))
    d.text((x + 8, y + 3), fit(d, text, f, w - 14), font=f, fill=hexa("foreground" if on else "muted"))
    return w


def draw_panel(im: Image.Image, box, frame: int) -> None:
    """The side panel on its Office tab: header, the boss, Needs you, the floor
    (desks at sidebar size, two lines under each) and the inspector."""
    x0, y0, x1, y1 = box
    pw, ph = x1 - x0, y1 - y0
    p = Image.new("RGBA", (pw, ph), hexa("#1e2634"))
    floor = load("mods/office-agents/room/floor.png")
    floor = floor.resize((floor.width // 2, floor.height // 2), Image.NEAREST)
    p.paste(floor.crop((0, 0, pw, min(ph, floor.height))), (0, 0))
    d = ImageDraw.Draw(p, "RGBA")
    people = [st for s in SPACES for _, st in staff(s)]

    # Header: the filters, desk size, the time.
    d.rectangle([0, 0, pw, 33], fill=hexa("chrome"))
    d.text((14, 9), "Office", font=font(12.5, bold=True), fill=hexa("foreground"))
    x = 72
    for key, name in (("all", "All"), ("working", "Working"), ("blocked", "Needs you"), ("done", "Done")):
        count = len(people) if key == "all" else people.count(key)
        f = font(11)
        w = round(d.textlength(f"{name}  {count}", font=f)) + 16 + (11 if key != "all" else 0)
        on = key == "all"
        d.rectangle([x, 6, x + w - 1, 27], fill=hexa("#3a3527") if on else hexa("chrome"),
                    outline=hexa("accent") if on else mix("muted", "#161f28", 0.75))
        tx = x + 8
        if key != "all":
            d.rectangle([tx, 14, tx + 5, 19], fill=hexa(key))
            tx += 11
        d.text((tx, 9), name, font=f, fill=hexa("foreground" if on else "muted"))
        d.text((tx + d.textlength(name + "  ", font=f), 9), str(count), font=f,
               fill=hexa("blocked") if key == "blocked" else hexa("dim"))
        x += w + 5
    for i, (t, on) in enumerate((("−", True), ("+", False))):
        bx = pw - 98 + i * 26
        d.rectangle([bx, 6, bx + 21, 27], outline=hexa("accent") if on else mix("muted", "#161f28", 0.75))
        d.text((bx + 6, 7), t, font=font(13), fill=hexa("foreground" if on else "muted"))
    d.text((pw - 44, 10), "21:40", font=font(11), fill=hexa("dim"))

    # The boss's band (BAND_H 100), plain so its line reads: the boss on the left;
    # what it says, the rooms row and the goal box beside it.
    by, band, left = 34, 100, 88
    d.rectangle([0, by, pw, by + band - 1], fill=hexa("#1a2230"))
    d.line([0, by + band - 1, pw, by + band - 1], fill=hexa("#11161f"))
    p.alpha_composite(load("mods/office-agents/boss/working.gif", (64, 88), frame), (12, by + 6))
    team = "team 2 · 2/4 working"
    say = "Hired frontend-nav and design-login"
    tf, sf = font(10.5), font(11.5)
    tw = round(d.textlength(team, font=tf))
    shown = fit(d, say, sf, pw - left - 40 - 8 - tw)
    d.text((left, by + 11), shown, font=sf, fill=hexa("foreground"))
    d.text((left + round(d.textlength(shown, font=sf)) + 8, by + 12), team, font=tf, fill=hexa("muted"))
    d.rectangle([pw - 30, by + 8, pw - 11, by + 27], fill=hexa("#0d131b", 204))
    d.text((pw - 25, by + 10), "▴", font=font(11), fill=hexa("dim"))
    x = left
    for name, on, color in (("● web-app", True, "ansi6"), ("api", False, "ansi3"), ("notes", False, "ansi5")):
        x += chip(d, x, by + 34, name, on, color=color) + 4
    iy0 = by + 62
    d.rectangle([left, iy0, pw - 82, iy0 + 29], fill=hexa("input"), outline=mix("muted", "#161f28", 0.5))
    d.text((left + 10, iy0 + 7), "Tell the boss what you need…", font=font(12), fill=hexa("dim"))
    d.rectangle([pw - 76, iy0 + 1, pw - 13, iy0 + 28], fill=hexa("accent"))
    d.text((pw - 66, iy0 + 7), "Tell ⏎", font=font(12, bold=True), fill=hexa("#101820"))

    # Needs you: a waiting agent's question and its choices.
    cy = by + band + 8
    ch = 136
    d.rectangle([8, cy, pw - 9, cy + ch], fill=hexa("#2a1f1c"), outline=hexa("blocked"), width=2)
    d.rectangle([16, cy + 8, 46, cy + 38], fill=hexa("raised"), outline=hexa("blocked"))
    p.alpha_composite(load("mods/office-agents/art/tester.png", (28, 28)), (17, cy + 9))
    d.text((54, cy + 8), "Needs you · Tester · Claude Code", font=font(12, bold=True), fill=hexa("foreground"))
    d.text((54, cy + 25), "api › tests · waiting 3m", font=font(10.5), fill=hexa("dim"))
    bx = pw - 17
    for label in ("Open ↗", "Terminal"):
        w = round(d.textlength(label, font=font(11))) + 16
        bx -= w
        chip(d, bx, cy + 11, label, w=w)
        bx -= 5
    qy = cy + 46
    d.rectangle([16, qy, pw - 17, qy + 52], fill=hexa("#11161d"))
    for i, q in enumerate(("git push origin feat/tests", "Push the branch", "Do you want to proceed?")):
        d.text((24, qy + 3 + i * 16), q, font=mono(11.5), fill=hexa("foreground"))
    x = 16
    for label in ("1  Yes", "2  Yes, and don't ask again for git push", "3  No, and tell Claude what…"):
        x += chip(d, x, qy + 60, label) + 5

    # The floor, at sidebar size with two lines under each desk.
    fy = cy + ch + 1 + 10
    z = {**SMALL, "wide": True}
    most = max(1, min(6, (pw - 40 + z["gap"]) // (z["slot"] + z["gap"])))
    inspect = 56
    floor_img = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    fd = ImageDraw.Draw(floor_img, "RGBA")
    draw_floor(floor_img, fd, 10, fy, pw - 20, z, most, frame)
    p.alpha_composite(floor_img.crop((0, fy, pw, ph - inspect)), (0, fy))

    # The inspector, one bar, on the designer the boss hired (a click on a desk
    # opens their real terminal in a window, not drawn here).
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
    for label in ("Peek", "Go to desk", "Terminal ↗"):
        w = round(d.textlength(label, font=font(11))) + 16
        bx -= w
        chip(d, bx, iy + 17, label, w=w)
        bx -= 5
    im.alpha_composite(p, (x0, y0))


def tint(im: Image.Image, box, color) -> None:
    """A translucent fill blended over what is there (ImageDraw on RGBA replaces)."""
    im.alpha_composite(Image.new("RGBA", (round(box[2] - box[0]) + 1, round(box[3] - box[1]) + 1), color), (round(box[0]), round(box[1])))


def faces(im: Image.Image, x: int, roles: list[tuple[str, str]]) -> int:
    if len(roles) == 1:
        p = load(f"mods/office-agents/art/{roles[0][0]}.png", (44, 44))
        im.alpha_composite(p, (x, 7))
        return 44
    d = ImageDraw.Draw(im, "RGBA")
    for n, (role, st) in enumerate(roles[:4]):
        fx = x + n * 22
        d.rectangle([fx, 12, fx + 33, 45], fill=hexa("raised"), outline=hexa(st))
        im.alpha_composite(load(f"mods/office-agents/art/{role}.png", (32, 32)), (fx + 1, 13))
    return 34 + 22 * (min(4, len(roles)) - 1)


def main() -> None:
    im = Image.new("RGBA", (W, H), hexa("canvas"))
    im.paste(wallpaper((W, H)), (0, 0))
    floor = load("mods/office-chrome/wallpaper.png").convert("RGB")
    panel = (W - PAD - PANEL, TABS + PAD, W - PAD, H - 28 - PAD)
    pane = (SIDEBAR + PAD, TABS + PAD, panel[0] - PAD, H - 28 - PAD)
    pw, ph = pane[2] - pane[0], pane[3] - pane[1]
    scale = max(pw / floor.width, ph / floor.height)  # the pane background is "cover"
    im.paste(floor.resize((int(floor.width * scale) + 1, int(floor.height * scale) + 1)).crop((0, 0, pw, ph)), pane[:2])
    tint(im, pane, hexa("background", 0x9E))  # terminal_opacity 0.62 over the floor
    tint(im, [pane[0], pane[1], pane[2], pane[1] + 30], hexa("chrome", 0xC8))
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle(pane, outline=hexa("accent", 0x99))
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
    sd.text((16, 15), "Herdr", font=font(14, bold=True), fill=hexa("foreground"))
    draw_spaces(sb, sd, 46)
    draw_office(sb, 46 + SPACES_H, H - 69, frame=0)
    sd = ImageDraw.Draw(sb, "RGBA")
    sd.rectangle([0, H - 69, SIDEBAR, H], fill=hexa("chrome"))
    sd.line([0, H - 69, SIDEBAR, H - 69], fill=hexa("border", 0x66))
    sd.text((16, H - 60), "Settings", font=font(13), fill=hexa("muted"))
    sd.text((16, H - 34), "Add machine", font=font(13), fill=hexa("dim"))
    im.alpha_composite(sb, (0, 0))

    tint(im, [SIDEBAR, 0, W, TABS], hexa("chrome", 0x99))
    td = ImageDraw.Draw(im, "RGBA")
    td.line([SIDEBAR, TABS, W, TABS], fill=hexa("border", 0x66))
    x = SIDEBAR + 10
    tabs = [([("manager", "working"), ("developer", "working"), ("designer", "working")], "Boss", True, 0),
            ([("analyst", "done")], "review", False, 0)]
    for people, name, active, others in tabs:
        tw = 210 if len(people) > 1 else 150
        td.rectangle([x, 5, x + tw, TABS - 5], fill=hexa("raised" if active else "chrome"),
                     outline=hexa("accent" if active else "chrome"))
        fw = faces(im, x + 6, people)
        td.text((x + 14 + fw, 21), name, font=font(13), fill=hexa("foreground" if active else "muted"))
        x += tw + 3
    td.text((x + 8, 20), "+", font=font(16), fill=hexa("dim"))
    bx = W - 10 - 3 * 96
    for i, (kind, name) in enumerate((("files", "Files"), ("changes", "Changes"), ("office", "Office"))):
        on = kind == "office"
        if on:
            td.rectangle([bx + i * 96 - 8, 16, bx + i * 96 + 82, 41], fill=hexa("#3a3527"))
        im.alpha_composite(load(f"mods/office-tabs/art/{kind}.png", (20, 20)), (bx + i * 96, 19))
        td.text((bx + i * 96 + 26, 22), name, font=font(12), fill=hexa("foreground" if on else "muted"))
    draw_panel(im, panel, frame=0)
    td.rectangle([SIDEBAR, H - 28, W, H], fill=hexa("chrome"))
    td.text((SIDEBAR + 14, H - 22), "office · 3 spaces · 8 agents", font=font(11), fill=hexa("dim"))

    out = im.convert("RGB")
    out.save(os.path.join(ROOT, "preview.png"))
    # Layout picker thumbnail: the left of the window, where the office is.
    thumb = out.resize((round(W * 468 / H), 468), Image.LANCZOS).crop((0, 0, 640, 468))
    thumb.quantize(colors=128, method=Image.Quantize.MEDIANCUT).save(os.path.join(ROOT, "layouts/office.png"), optimize=True)
    print("wrote preview.png and layouts/office.png")


if __name__ == "__main__":
    main()
