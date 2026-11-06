#!/usr/bin/env python3
"""Compose a mock office window from the real mod art, so the layout can be
reviewed without Herdr. Not part of the mods - nothing reads this file.

    python3 tools/build-preview.py     # writes preview.png and layouts/office.png

The mock follows layouts/office.json and the sizes the mods ask for: a 300 px
sidebar (46 header, Spaces, the office, 69 footer), 58 px tab bar, 8 px padding.
In the office each space is a rug, each tab a cubicle on it, each pane a desk;
the sidebar, the work column, the side panel and the terminals sit on one
night-windows wallpaper. A tab with a `tree` shows its split; others, rows.
"""

from __future__ import annotations

import json
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1280, 800
SIDEBAR = 300
TABS = 58
PAD = 8
SPACES_H = 200

THEME = json.load(open(os.path.join(ROOT, "themes/office-night.json")))
C = THEME["colors"]


def hexa(key: str, alpha: int = 255) -> tuple[int, int, int, int]:
    if key.startswith("#"):
        v = key
    elif key.startswith("ansi") and key[4:].isdigit():
        v = THEME["ansi"][int(key[4:])]
    else:
        v = C[key]
    v = v.lstrip("#")
    return (int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16), alpha)


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


# Sample window: three spaces (projects), their tabs and panes.
SPACES = [
    {"name": "web-app", "color": "ansi6", "active": True, "tail": "feat/login ↑1",
     "git": [("ansi3", "2 changed"), ("ansi2", "1 unpushed")],
     "tabs": [
         {"name": "main", "active": True, "tree": ("across", [0, ("stacked", [1, 2])]), "panes": [
             ("manager", "working", "Plan sprint"), ("designer", "working", "Navbar"),
             ("developer", "blocked", "Fix login")]},
         {"name": "review", "panes": [("analyst", "done", "PR #42")]},
     ]},
    {"name": "api", "color": "ansi3", "tail": "",
     "git": [("ansi3", "4 changed")],
     "tabs": [
         {"name": "tests", "panes": [("tester", "working", "e2e suite"), (None, None, "Terminal")]},
         {"name": "deploy", "panes": [("support", "idle", "Rollout")]},
     ]},
    {"name": "notes", "color": "ansi5", "tail": "",
     "git": [],
     "tabs": [{"name": "docs", "panes": [("writer", "working", "README"), ("intern", "idle", "Typos")]}]},
]

DESK_W, DESK_H, SLOT_W, LABEL_H, GAP = 72, 60, 80, 13, 2
SLOT_H = DESK_H + 1 + LABEL_H


def grid(n: int) -> int:
    return n if n <= 3 else 2 if n == 4 else 3


def wallpaper(size: tuple[int, int]) -> Image.Image:
    paper = load("mods/office-chrome/wallpaper.png").convert("RGB")
    scale = max(size[0] / paper.width, size[1] / paper.height)  # "cover", as the layout asks
    return paper.resize((int(paper.width * scale) + 1, int(paper.height * scale) + 1)).crop((0, 0, *size))


def draw_spaces(sb: Image.Image, d: ImageDraw.ImageDraw, top: int) -> None:
    d.text((16, top + 9), "Spaces", font=font(11.5), fill=hexa("dim"))
    d.text((SIDEBAR - 28, top + 5), "+", font=font(15), fill=hexa("dim"))
    y = top + 31
    for s in SPACES:
        box = [8, y, SIDEBAR - 8, y + 44]
        if s.get("active"):
            d.rectangle(box, fill=hexa("surface", 0xC8))
            d.rectangle([box[0], box[1], box[0] + 1, box[3]], fill=hexa("accent"))
        col = hexa(s["color"])
        bx, by = box[0] + 10, y + 9
        d.rectangle([bx, by, bx + 11, by + 3], fill=col)
        d.rectangle([bx, by + 3, bx + 27, by + 25], fill=col)
        d.rectangle([bx, by + 4, bx + 27, by + 4], fill=(255, 255, 255, 70))
        letter = s["name"][0].upper()
        f = font(13, bold=True)
        d.text((bx + 14 - d.textlength(letter, font=f) / 2, by + 7), letter, font=f, fill=hexa("canvas"))
        tx = bx + 38
        d.text((tx, y + 7), s["name"], font=font(13), fill=hexa("foreground"))
        if s["tail"]:
            tf = font(11.5)
            d.text((box[2] - 10 - d.textlength(s["tail"], font=tf), y + 9), s["tail"], font=tf, fill=hexa("dim"))
        x = tx
        for i, (color, text) in enumerate(s["git"]):
            if i:
                d.text((x, y + 25), "·", font=font(11), fill=hexa("dim"))
                x += 10
            d.text((x, y + 25), text, font=font(11), fill=hexa(color))
            x += d.textlength(text, font=font(11)) + 4
        dots = [st for t in s["tabs"] for _, st, _ in t["panes"] if st]
        dx = box[2] - 10 - len(dots) * 9
        for st in dots:
            d.ellipse([dx, y + 29, dx + 5, y + 34], fill=hexa(st))
            dx += 9
        y += 46


def tree_of(t):
    """The tab's split tree as (dir, children) / pane index, else rows of desks."""
    if "tree" in t:
        return t["tree"]
    n, cols = len(t["panes"]), grid(len(t["panes"]))
    rows = [("across", list(range(i, min(i + cols, n)))) for i in range(0, n, cols)]
    return rows[0] if len(rows) == 1 else ("stacked", rows)


def tree_size(node) -> tuple[int, int]:
    if isinstance(node, int):
        return SLOT_W, SLOT_H
    kind, children = node
    sizes = [tree_size(c) for c in children]
    gaps = GAP * (len(children) - 1)
    if kind == "across":
        return sum(w for w, _ in sizes) + gaps, max(h for _, h in sizes)
    return max(w for w, _ in sizes), sum(h for _, h in sizes) + gaps


def draw_desk(sb, d, t, i, cx, cy, shadow, frame):
    role, st, title = t["panes"][i]
    dx = cx + (SLOT_W - DESK_W) // 2
    sb.alpha_composite(shadow, (dx, cy))
    art = f"mods/office-agents/desks/{role}-{st}.gif" if role else "mods/office-agents/desks/empty.png"
    sb.alpha_composite(load(art, (DESK_W, DESK_H), frame), (dx, cy))
    ly = cy + DESK_H + 1
    if st == "blocked":
        tf = font(8.5, bold=True)
        tw = d.textlength("NEEDS YOU", font=tf) + 10
        tx = cx + SLOT_W / 2 - tw / 2
        d.rectangle([tx, ly, tx + tw, ly + LABEL_H], fill=hexa("#c8392f"))
        d.text((tx + 5, ly + 1), "NEEDS YOU", font=tf, fill=(255, 240, 230, 255))
    else:
        lf = font(10)
        label = fit(d, title, lf, SLOT_W - 8)
        tw = d.textlength(label, font=lf) + 8
        tx = cx + SLOT_W / 2 - tw / 2
        tint(sb, [round(tx), ly, round(tx + tw), ly + LABEL_H], (13, 19, 27, 0xB8))
        d.text((tx + 4, ly), label, font=lf, fill=hexa("foreground" if role else "muted"))


def draw_tree(sb, d, t, node, x, y, shadow, frame):
    if isinstance(node, int):
        draw_desk(sb, d, t, node, x, y, shadow, frame)
        return
    kind, children = node
    for c in children:
        draw_tree(sb, d, t, c, x, y, shadow, frame)
        w, h = tree_size(c)
        if kind == "across":
            x += w + GAP
        else:
            y += h + GAP


def draw_office(sb: Image.Image, top: int, bottom: int, frame: int) -> None:
    d = ImageDraw.Draw(sb, "RGBA")
    floor = load("mods/office-agents/room/floor.png")
    floor = floor.resize((floor.width // 2, floor.height // 2), Image.NEAREST)
    sb.paste(floor.crop((0, 0, SIDEBAR, bottom - top)), (0, top))
    d.rectangle([0, top, SIDEBAR, top + 28], fill=hexa("chrome"))
    d.text((16, top + 8), "Office", font=font(11.5), fill=hexa("dim"))
    agents = [st for s in SPACES for t in s["tabs"] for _, st, _ in t["panes"] if st]
    busy = sum(1 for st in agents if st == "working")
    info = f"{busy}/{len(agents)} at work · 21:40"
    d.text((SIDEBAR - 12 - d.textlength(info, font=font(11)), top + 8), info, font=font(11), fill=hexa("dim"))
    need = "1 needs you ·"
    d.text((SIDEBAR - 16 - d.textlength(info, font=font(11)) - d.textlength(need, font=font(11.5)), top + 8),
           need, font=font(11.5), fill=hexa("blocked"))
    wall = load("mods/office-agents/room/wall.png")
    sb.alpha_composite(wall.resize((wall.width // 2, wall.height // 2), Image.NEAREST), (0, top + 28))
    y = top + 28 + 44 + 8
    shadow = load("mods/office-agents/desks/shadow.png", (DESK_W, DESK_H))
    for s in SPACES:
        color = hexa(s["color"])
        inner = SIDEBAR - 16 - 14
        rows, row, used = [], [], 0
        for t in s["tabs"]:
            tw, th = tree_size(tree_of(t))
            w, h = tw + 10, 14 + GAP + th + 4 + 1
            if row and used + 6 + w > inner:
                rows.append(row)
                row, used = [], 0
            row.append((t, w, h))
            used += (6 if used else 0) + w
        rows.append(row)
        rug_h = 3 + 15 + 5 + sum(max(h for *_, h in r) for r in rows) + 6 * (len(rows) - 1) + 6 + 1
        rug = [8, y, SIDEBAR - 9, y + rug_h - 1]
        tint(sb, rug, color[:3] + (0x24,))
        d.rectangle(rug, outline=color[:3] + (0x66,))
        d.rectangle([rug[0] + 7, y + 7, rug[0] + 13, y + 13], fill=color)
        d.text((rug[0] + 19, y + 3), s["name"], font=font(11, bold=True), fill=hexa("foreground"))
        py = y + 3 + 15 + 5
        for r in rows:
            px = rug[0] + 7
            for t, w, h in r:
                here = s.get("active") and t.get("active")
                tint(sb, [px, py, px + w - 1, py + h - 1], (8, 12, 18, 0x70))
                d.rectangle([px, py, px + w - 1, py + h - 1], outline=hexa("accent") if here else color[:3] + (0x88,))
                d.text((px + 5, py + 2), fit(d, t["name"], font(10), w - 10), font=font(10),
                       fill=hexa("accent" if here else "muted"))
                draw_tree(sb, d, t, tree_of(t), px + 5, py + 1 + 14 + GAP, shadow, frame)
                px += w + 6
            py += max(h for *_, h in r) + 6
        y += rug_h + 8


def tint(im: Image.Image, box, color) -> None:
    """A translucent fill blended over what is there (ImageDraw on RGBA replaces)."""
    im.alpha_composite(Image.new("RGBA", (box[2] - box[0] + 1, box[3] - box[1] + 1), color), (box[0], box[1]))


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
    pane = (SIDEBAR + PAD, TABS + PAD, W - PAD, H - 28 - PAD)
    pw, ph = pane[2] - pane[0], pane[3] - pane[1]
    scale = max(pw / floor.width, ph / floor.height)  # the pane background is "cover"
    im.paste(floor.resize((int(floor.width * scale) + 1, int(floor.height * scale) + 1)).crop((0, 0, pw, ph)), pane[:2])
    tint(im, pane, hexa("background", 0x9E))  # terminal_opacity 0.62 over the floor
    tint(im, [pane[0], pane[1], pane[2], pane[1] + 30], hexa("chrome", 0xC8))
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle(pane, outline=hexa("accent", 0x99))
    d.text((pane[0] + 12, pane[1] + 8), "web-app / main — Fix login", font=font(13), fill=hexa("muted"))
    lines = [
        ("accent", "$ herdr-app do layout.switch '{\"name\":\"office\"}'"),
        ("foreground", "switched to office (office-night)"),
        ("dim", ""),
        ("working", "● 3 spaces · 7 agents at their desks"),
        ("foreground", "web-app  main    manager · designer · developer"),
        ("foreground", "web-app  review  analyst"),
        ("blocked", "needs you  developer: allow `git push`?"),
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
    tabs = [([("manager", "working"), ("designer", "working"), ("developer", "blocked")], "main", True, 0),
            ([("analyst", "done")], "review", False, 0)]
    for people, name, active, others in tabs:
        tw = 210 if len(people) > 1 else 150
        td.rectangle([x, 5, x + tw, TABS - 5], fill=hexa("raised" if active else "chrome"),
                     outline=hexa("accent" if active else "chrome"))
        fw = faces(im, x + 6, people)
        td.text((x + 14 + fw, 21), name, font=font(13), fill=hexa("foreground" if active else "muted"))
        x += tw + 3
    td.text((x + 8, 20), "+", font=font(16), fill=hexa("dim"))
    bx = W - 300
    for i, (kind, label) in enumerate((("files", "Files"), ("changes", "Changes"), ("inbox", "Inbox"))):
        icon = load(f"mods/office-tabs/art/{kind}.png", (20, 20))
        im.alpha_composite(icon, (bx + i * 98, 19))
        td.text((bx + i * 98 + 26, 22), label, font=font(12), fill=hexa("muted"))
    td.rectangle([SIDEBAR, H - 28, W, H], fill=hexa("chrome"))
    td.text((SIDEBAR + 14, H - 22), "office · 3 spaces · 7 agents", font=font(11), fill=hexa("dim"))

    out = im.convert("RGB")
    out.save(os.path.join(ROOT, "preview.png"))
    # Layout picker thumbnail: the left of the window, where the office is.
    thumb = out.resize((round(W * 468 / H), 468), Image.LANCZOS).crop((0, 0, 640, 468))
    thumb.quantize(colors=128, method=Image.Quantize.MEDIANCUT).save(os.path.join(ROOT, "layouts/office.png"), optimize=True)
    print("wrote preview.png and layouts/office.png")


if __name__ == "__main__":
    main()
