#!/usr/bin/env python3
"""Draw the office art pixel by pixel from the palette below: no image model, no
third-party assets, so the layout runs out of the box and the art carries the
code's license.

    python3 tools/build-art.py

Every picture is drawn on a small art grid, outlined (a darker edge around each
shape, "sel-out" style), then scaled 4x with nearest-neighbour: one art pixel is
2 points on screen and 4 device pixels on Retina.

Output (relative to the repo root):
    mods/office-agents/desks/<role>-<working|blocked|done|idle>.gif  120x112
    mods/office-agents/desks/empty.png    a pane with no agent        120x112
    mods/office-agents/desks/shadow.png   soft shadow under a desk    120x112
    mods/office-agents/art/<role>.png     bust portraits (tab bar)     88x88
    mods/office-agents/room/wall.png      the office's back wall      600x88
    mods/office-agents/room/floor.png     office carpet              600x1600
    mods/office-tabs/art/<files|changes|inbox>.png                    256x256
    mods/office-chrome/sidebar.png        sidebar backdrop           460x1844
    mods/office-chrome/floor.png          terminal backdrop         1660x1224
"""

from __future__ import annotations

import os
import random

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UP = 4  # device pixels per art pixel

# ---- palette ---------------------------------------------------------------

INK = (16, 24, 32)
OUT = (12, 14, 24)
WHITE = (244, 240, 230)

WOOD_HI = (214, 166, 112)
WOOD = (178, 126, 82)
WOOD_GRAIN = (160, 110, 70)
WOOD_SH = (124, 84, 56)
WOOD_DK = (92, 60, 42)
WARM = (255, 218, 150)
BRASS = (232, 186, 98)

METAL = (138, 146, 162)
METAL_D = (86, 94, 112)
BEZEL = (42, 48, 62)
BEZEL_HI = (74, 82, 102)
CHAIR = (54, 62, 86)
CHAIR_HI = (84, 96, 126)
CHAIR_SH = (38, 44, 62)

LAMP = (226, 166, 76)
LAMP_D = (168, 110, 44)
BULB = (255, 240, 180)
BULB_OFF = (96, 90, 78)
PAPER = (238, 234, 222)
PAPER_D = (196, 190, 176)
TERRA = (186, 98, 64)
TERRA_L = (220, 134, 92)
LEAF = (88, 164, 94)
LEAF_D = (54, 118, 72)
LEAF_L = (146, 210, 124)
STEAM = (176, 188, 208)

SCREEN = {
    "working": (14, 50, 42),
    "blocked": (204, 62, 52),
    "done": (28, 62, 114),
    "idle": (16, 20, 32),
    "empty": (22, 26, 36),
}
GLOW = {
    "working": (96, 224, 156),
    "blocked": (244, 96, 76),
    "done": (112, 164, 244),
    "idle": (70, 88, 140),
}
LED = {
    "working": (126, 242, 156),
    "blocked": (255, 124, 84),
    "done": (126, 176, 255),
    "idle": (84, 92, 108),
    "empty": (60, 66, 80),
}

KEY, FUN, STR, DIM = (240, 196, 110), (116, 222, 152), (128, 186, 244), (70, 120, 100)
# Code on a working screen: (indent, length, colour); scrolls one line a frame.
CODE = [
    (0, 5, KEY), (1, 6, FUN), (2, 4, STR), (2, 6, FUN), (1, 3, KEY), (0, 2, DIM),
    (0, 7, KEY), (1, 5, STR), (2, 5, FUN), (1, 4, KEY), (2, 6, STR), (0, 3, DIM),
]


def mix(a, b, t: float):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def dark(c, t: float = 0.3):
    return mix(c, (0, 0, 0), t)


def light(c, t: float = 0.3):
    return mix(c, (255, 255, 255), t)


# ---- canvas ----------------------------------------------------------------


class Art:
    """An RGBA art-pixel canvas with the few primitives the sprites need."""

    def __init__(self, w: int, h: int):
        self.w, self.h = w, h
        self.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.im.load()

    def dot(self, x: int, y: int, c) -> None:
        if c is not None and 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = (*c[:3], 255)

    def rect(self, x: int, y: int, w: int, h: int, c) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.dot(xx, yy, c)

    def rows(self, x: int, y: int, rows: list[str], pal: dict) -> None:
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != ".":
                    self.dot(x + i, y + j, pal[ch])

    def get(self, x: int, y: int):
        if 0 <= x < self.w and 0 <= y < self.h and self.px[x, y][3]:
            return self.px[x, y][:3]
        return None

    def tint(self, x: int, y: int, c, t: float) -> None:
        old = self.get(x, y)
        if old is not None:
            self.dot(x, y, mix(old, c, t))

    def outline(self) -> "Art":
        """Each empty pixel touching the shape takes a dark shade of its neighbour."""
        src = self.im.copy().load()
        for y in range(self.h):
            for x in range(self.w):
                if src[x, y][3]:
                    continue
                for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h and src[nx, ny][3]:
                        self.px[x, y] = (*mix(src[nx, ny][:3], OUT, 0.8), 255)
                        break
        return self

    def over(self, other: "Art", dx: int = 0, dy: int = 0) -> "Art":
        self.im.alpha_composite(other.im, (dx, dy))
        return self

    def big(self, k: int = UP) -> Image.Image:
        return self.im.resize((self.w * k, self.h * k), Image.NEAREST)


def write_gif(path: str, frames: list[Image.Image], duration: int) -> None:
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=duration,
                   loop=0, disposal=2, optimize=True)


# ---- people ----------------------------------------------------------------
# Eight staff, each with their own look and their own things on the desk.
# Keys in the hair rows: H hair, h hair shade, L hair light, S skin, A/a/B extras.

ROLES = {
    "manager": dict(shirt=(66, 74, 100), skin=(236, 194, 160), hair=(74, 46, 34), style="short",
                    acc=(232, 186, 98), props=("lamp", "mug", "papers")),
    "developer": dict(shirt=(46, 142, 140), skin=(200, 142, 102), hair=(58, 46, 52), style="messy",
                      acc=(214, 84, 92), props=("monitor2", "mug_dark")),
    "designer": dict(shirt=(150, 98, 184), skin=(242, 204, 174), hair=(234, 128, 168), style="long",
                     acc=(255, 214, 90), props=("lamp", "plant")),
    "analyst": dict(shirt=(84, 128, 192), skin=(226, 182, 142), hair=(234, 198, 112), style="ponytail",
                    acc=(206, 76, 96), props=("lamp", "chart")),
    "intern": dict(shirt=(98, 172, 96), skin=(246, 208, 178), hair=(214, 118, 56), style="cap",
                   acc=(212, 72, 64), props=("lamp", "cactus", "can")),
    "support": dict(shirt=(216, 102, 92), skin=(160, 108, 74), hair=(92, 48, 56), style="headset",
                    acc=(60, 64, 80), props=("lamp", "phone")),
    "tester": dict(shirt=(214, 168, 66), skin=(120, 80, 56), hair=(96, 62, 44), style="afro",
                   acc=(255, 214, 64), props=("lamp", "duck")),
    "writer": dict(shirt=(226, 214, 188), skin=(232, 188, 152), hair=(182, 184, 192), style="grey",
                   acc=(90, 70, 60), props=("lamp", "books")),
}

# Seen from behind, at the desk: 8 (afro: 10) columns from the top of the head.
BACK = {
    "short": (11, [
        ".LLHHHH.",
        "LHHHHHHh",
        "HHHHHHHh",
        "HHHHHHhh",
        "SHHHHHhS",
        ".hhhhhh.",
    ]),
    "grey": (11, [
        ".LLLLHH.",
        "LLHHHHHh",
        "LHHHHHHh",
        "HHHHHHhh",
        "SHHHHHhS",
        ".hhhhhh.",
    ]),
    "messy": (11, [
        "H.HL.HH.",
        "AAAAAAAA",
        "HHLHHHHh",
        "HHHHHHhh",
        "HHHHHHhh",
        ".hHhhHh.",
    ]),
    "long": (11, [
        ".LLHHHH.",
        "LHHLHHHh",
        "HHHHHHHh",
        "HHHHHHhh",
        "HHHHHHhh",
        "HHHHHhhh",
        "HHHHhhhh",
        ".HHhhhh.",
        "..h..h..",
    ]),
    "ponytail": (11, [
        ".LLHHHH.",
        "LHHLHHHh",
        "HHHHHHHh",
        "HHHAAHhh",
        "SHHHHHhS",
        ".hhHHhh.",
        "...HH...",
        "...Hh...",
        "...h....",
    ]),
    "headset": (11, [
        ".LLHHHH.",
        "AAAAAAAA",
        "HHHHHHHh",
        "HHHHHHhh",
        "HHHHHHhh",
        "HHHHHhhh",
        "HHHHhhhh",
        ".HHhhhh.",
    ]),
    "cap": (11, [
        ".AAAAAA.",
        "AAABAAAa",
        "AAAAAAaa",
        "SHHHHHHS",
        "SHHHHHhS",
        ".hhhhhh.",
    ]),
    "afro": (10, [
        ".HH.HLH.H.",
        "HHLHHHHHHh",
        "HHHHHLHHhh",
        "HLHHHHHHhh",
        "HHHHHHHhhh",
        ".hHhhHhhh.",
    ]),
}


def person(role: str, state: str, f: int) -> Art:
    r = ROLES[role]
    a = Art(30, 28)
    shirt, skin = r["shirt"], r["skin"]
    shirt_d, shirt_l, skin_d = dark(shirt, 0.28), light(shirt, 0.2), dark(skin, 0.18)
    head_y = 8 + (2 if state == "idle" else 0)

    # Shoulders over the chair back (the chair, drawn later, hides the rest).
    a.rect(10, 15, 10, 1, shirt_l)
    a.rect(9, 16, 12, 4, shirt)
    a.rect(9, 16, 1, 4, shirt_l)
    a.rect(20, 16, 1, 4, shirt_d)
    a.rect(13, 14, 4, 1, skin_d)

    if state == "working":
        lift_l, lift_r = (1, 0) if f % 2 == 0 else (0, 1)
        if f % 3 == 2:
            lift_l = lift_r = 0
        a.rect(8, 14, 2, 3, shirt)
        a.rect(20, 14, 2, 3, shirt_d)
        a.rect(9, 13 - lift_l, 2, 1, skin)
        a.rect(19, 13 - lift_r, 2, 1, skin)
    elif state == "blocked":
        a.rect(8, 14, 2, 3, shirt)
        a.rect(9, 13, 2, 1, skin)
        wave = f % 2
        a.rect(20, 13, 2, 3, shirt_d)
        a.rect(20 + wave, 9, 2, 4, shirt)
        a.rect(20 + wave, 7, 2, 2, skin)
        a.dot(21 + wave, 6, skin)
    elif state == "done":
        a.rect(8, 13, 2, 3, shirt)
        a.rect(9, 11, 2, 2, shirt)
        a.rect(20, 13, 2, 3, shirt_d)
        a.rect(19, 11, 2, 2, shirt_d)
    else:  # idle: arms folded on the desk, head down on them
        a.rect(9, 13, 12, 2, shirt)
        a.rect(9, 13, 12, 1, shirt_l)

    x0, rows = BACK[r["style"]]
    pal = {"H": r["hair"], "h": dark(r["hair"], 0.28), "L": light(r["hair"], 0.25),
           "S": skin, "A": r["acc"], "a": dark(r["acc"], 0.3), "B": light(r["acc"], 0.4)}
    if r["style"] in ("messy", "headset"):
        pal["A"] = r["acc"]
    if r["style"] == "ponytail":
        pal["A"] = r["acc"]
    a.rows(x0, head_y, rows, pal)

    if r["style"] == "messy":  # headphone cups
        a.rect(10, head_y + 3, 1, 2, r["acc"])
        a.rect(19, head_y + 3, 1, 2, r["acc"])
        a.dot(10, head_y + 3, light(r["acc"], 0.3))
    if r["style"] == "headset":  # one ear piece and the mic boom
        a.rect(19, head_y + 3, 1, 2, r["acc"])
        a.dot(20, head_y + 5, r["acc"])
        a.dot(20, head_y + 6, (220, 80, 70))
    if role == "manager":  # white collar
        a.rect(12, 14, 6, 1, WHITE)
    if role == "developer":  # hoodie hood bunched at the neck
        a.rect(12, 14, 6, 2, shirt_d)
        a.rect(13, 14, 4, 1, shirt)

    # The screen lights the top of the head.
    if state in GLOW:
        for x in range(a.w):
            for y in range(head_y, head_y + 3):
                if a.get(x, y) is not None:
                    a.tint(x, y, GLOW[state], 0.22)
                    break
    return a.outline()


def chair(dx: int = 0, dy: int = 0) -> Art:
    a = Art(30, 28)
    x, y = 10 + dx, 17 + dy
    a.rect(x + 1, y, 8, 1, CHAIR_HI)
    a.rect(x, y + 1, 10, 5, CHAIR)
    a.rect(x, y + 1, 1, 5, CHAIR_HI)
    a.rect(x + 9, y + 1, 1, 5, CHAIR_SH)
    a.rect(x + 1, y + 5, 8, 1, CHAIR_SH)
    a.rect(x + 2, y + 2, 6, 1, mix(CHAIR, CHAIR_HI, 0.5))
    a.rect(x + 4, y + 6, 2, 2, METAL_D)
    a.rect(x + 1, y + 8, 8, 1, METAL_D)
    for wx in (x + 1, x + 4, x + 8):
        a.dot(wx, y + 9, (28, 30, 40))
    return a.outline()


# ---- the desk and what is on it -------------------------------------------


def desk(lit: bool) -> Art:
    a = Art(30, 28)
    a.rect(2, 12, 26, 2, WOOD)
    a.rect(2, 14, 26, 1, WOOD_HI)
    for x, y, n in ((4, 12, 5), (14, 13, 6), (22, 12, 4)):
        a.rect(x, y, n, 1, WOOD_GRAIN)
    a.rect(2, 15, 26, 2, WOOD_SH)
    a.rect(2, 16, 26, 1, WOOD_DK)
    a.rect(22, 15, 3, 1, BRASS)
    a.rect(3, 17, 2, 4, WOOD_DK)
    a.rect(25, 17, 2, 4, WOOD_DK)
    a.rect(3, 17, 1, 4, WOOD_SH)
    a.rect(25, 17, 1, 4, WOOD_SH)
    if lit:  # the desk lamp's pool of light
        for y in range(12, 15):
            for x in range(2, 11):
                t = max(0.0, 1 - abs(x - 5) / 5.5) * (0.5 if y < 14 else 0.32)
                a.tint(x, y, WARM, t)
    return a.outline()


def screen(a: Art, state: str, f: int) -> None:
    x0, y0, w, h = 10, 2, 10, 5
    bg = SCREEN[state]
    if state == "blocked" and f % 2:
        bg = (128, 36, 34)
    a.rect(x0, y0, w, h, bg)
    if state == "working":
        for i in range(h):
            indent, length, col = CODE[(f + i) % len(CODE)]
            a.rect(x0 + 1 + indent, y0 + i, length, 1, col)
        if f % 2 == 0:
            a.dot(x0 + 9, y0 + h - 1, WHITE)
    elif state == "blocked":
        fg = (255, 244, 236) if f % 2 == 0 else (236, 150, 140)
        a.rect(14, y0, 2, 3, fg)
        a.rect(14, y0 + 4, 2, 1, fg)
    elif state == "done":
        check = ["..........", ".......#..", "..#...#...", "...#.#....", "....#....."]
        a.rows(x0, y0, [r.replace("#", "C") for r in check], {"C": (156, 240, 166)})
        sparkle = [(1, 0), (8, 3), (2, 4)][f % 3]
        a.dot(x0 + sparkle[0], y0 + sparkle[1], (200, 220, 255))
    elif state == "idle":
        xs, ys = [0, 2, 4, 6, 8, 6, 4, 2], [0, 1, 2, 3, 2, 1, 0, 1]
        col = [(232, 120, 160), (120, 200, 240), (240, 200, 100)][(f // 3) % 3]
        a.rect(x0 + xs[f % 8], y0 + ys[f % 8], 2, 2, dark(col, 0.25))
        a.dot(x0 + 3, y0 + 4 - ys[(f + 3) % 8], (44, 52, 76))
    else:  # switched off: only a reflection
        for i in range(3):
            a.dot(x0 + 6 + i, y0 + i, (46, 54, 72))
        a.dot(x0 + 8, y0, (46, 54, 72))


def monitor(state: str, f: int) -> Art:
    a = Art(30, 28)
    a.rect(9, 1, 12, 7, BEZEL)
    a.rect(9, 1, 12, 1, BEZEL_HI)
    a.rect(14, 8, 2, 3, METAL_D)
    a.rect(12, 11, 6, 1, METAL)
    a.outline()
    screen(a, state, f)
    a.dot(19, 7, LED[state])
    return a


def lamp(a: Art, lit: bool) -> None:
    a.rect(2, 12, 4, 1, METAL_D)
    a.rect(3, 8, 1, 4, METAL)
    a.dot(4, 7, METAL)
    a.rect(4, 5, 4, 2, LAMP)
    a.rect(5, 4, 2, 1, LAMP_D)
    a.rect(4, 6, 4, 1, LAMP_D)
    a.rect(5, 7, 2, 1, BULB if lit else BULB_OFF)


def second_monitor(a: Art, state: str, f: int) -> None:
    a.rect(2, 4, 6, 7, BEZEL)
    a.rect(2, 4, 6, 1, BEZEL_HI)
    a.rect(4, 11, 2, 1, METAL)
    bg = (14, 40, 56) if state == "working" else (20, 26, 38)
    a.rect(3, 5, 4, 5, bg)
    for i in range(5):
        indent, length, col = CODE[(f * 2 + i + 5) % len(CODE)]
        if state != "working":
            col = (40, 52, 70)
        a.rect(3 + min(indent, 1), 5 + i, min(length, 4 - min(indent, 1)), 1, col)


def mug(a: Art, x: int, y: int, body, band) -> None:
    a.rect(x, y, 3, 3, body)
    a.rect(x, y + 1, 3, 1, band)
    a.dot(x + 3, y + 1, body)
    a.dot(x + 1, y, dark(body, 0.5))


def steam(a: Art, x: int, y: int, f: int) -> None:
    if f % 2 == 0:
        a.dot(x + 1, y - 1, STEAM)
        a.dot(x, y - 2, STEAM)
    else:
        a.dot(x + 1, y - 2, STEAM)
        a.dot(x + 2, y - 3, STEAM)


def props(role: str | None, state: str, f: int, lit: bool) -> Art:
    a = Art(30, 28)
    kit = ROLES[role]["props"] if role else ("lamp",)
    after = []
    for p in kit:
        if p == "lamp":
            lamp(a, lit)
        elif p == "monitor2":
            second_monitor(a, state, f)
        elif p == "mug":
            mug(a, 22, 11, PAPER, (224, 120, 74))
            after.append(("steam", 22, 10))
        elif p == "mug_dark":
            mug(a, 23, 11, (56, 60, 74), (240, 180, 80))
            after.append(("steam", 23, 10))
        elif p == "papers":
            a.rect(25, 13, 4, 1, PAPER)
            a.rect(26, 12, 3, 1, PAPER_D)
            a.rect(25, 11, 3, 1, PAPER)
        elif p == "plant":
            a.rect(23, 11, 4, 3, TERRA)
            a.rect(22, 11, 6, 1, TERRA_L)
            a.rows(21, 3, [
                "...l....",
                ".lGG.G..",
                "GGgGlGG.",
                ".GgGGgGG",
                "GGGlGGg.",
                ".gGGGgG.",
                "..gGGg..",
                "...gG...",
            ], {"G": LEAF, "g": LEAF_D, "l": LEAF_L})
        elif p == "chart":
            a.rect(22, 5, 6, 6, PAPER)
            a.rect(23, 9, 1, 1, (120, 180, 240))
            a.rect(24, 8, 1, 2, (120, 210, 140))
            a.rect(25, 7, 1, 3, (240, 190, 90))
            a.rect(26, 6, 1, 4, (232, 110, 110))
            a.rect(24, 11, 2, 1, METAL_D)
            a.rect(23, 12, 4, 1, (246, 220, 120))
        elif p == "cactus":
            a.rect(22, 11, 3, 2, TERRA)
            a.rect(23, 7, 1, 4, LEAF)
            a.dot(22, 8, LEAF)
            a.dot(22, 9, LEAF_D)
            a.dot(24, 9, LEAF_D)
            a.dot(23, 6, (240, 120, 160))
        elif p == "can":
            a.rect(26, 10, 2, 3, (70, 200, 120))
            a.rect(26, 11, 2, 1, (30, 40, 40))
            a.dot(26, 10, (200, 255, 210))
        elif p == "phone":
            a.rect(22, 11, 5, 2, (200, 70, 60))
            a.rect(22, 10, 5, 1, (150, 44, 40))
            a.dot(22, 9, (150, 44, 40))
            a.dot(26, 9, (150, 44, 40))
            a.dot(24, 12, (250, 220, 200))
            if state == "blocked" and f % 2 == 0:
                a.dot(27, 8, (255, 230, 120))
        elif p == "duck":
            a.rect(22, 11, 4, 2, (250, 214, 64))
            a.rect(24, 9, 2, 2, (250, 214, 64))
            a.dot(26, 10, (240, 130, 50))
            a.dot(24, 9, (40, 40, 40))
            a.dot(22, 11, (255, 236, 140))
        elif p == "books":
            a.rect(22, 12, 6, 1, (170, 60, 60))
            a.rect(23, 11, 5, 1, (60, 110, 170))
            a.rect(22, 10, 6, 1, (90, 150, 90))
            a.rect(23, 9, 4, 1, (220, 180, 90))
            for y in (9, 10, 11, 12):
                a.dot(27 if y != 9 else 26, y, PAPER)
    a.outline()
    for kind, x, y in after:
        if kind == "steam" and state == "working":
            steam(a, x, y, f)
    return a


def zzz(f: int) -> Art:
    a = Art(30, 28)
    z = ["###", ".#.", "###"]
    big = ["####", "..#.", ".#..", "####"]
    col = {"#": (206, 218, 255)}
    step = (f // 2) % 4
    if step >= 1:
        a.rows(20, 7, z, col)
    if step >= 2:
        a.rows(23, 2, big, col)
    return a.outline() if step else a


def scene(role: str | None, state: str, f: int) -> Art:
    lit = state != "empty"
    base = desk(lit and (role is None or "lamp" in ROLES[role]["props"]))
    if state in GLOW:  # the screen's light on the desk in front of it
        for x in range(10, 20):
            base.tint(x, 12, GLOW[state], 0.2)
            base.tint(x, 13, GLOW[state], 0.1)
    base.over(monitor(state, f))
    base.over(props(role, state, f, lit))
    if state == "empty":
        base.over(chair(dx=3, dy=1))
    else:
        base.over(person(role, state, f))
        base.over(chair())
        if state == "idle":
            base.over(zzz(f))
    return base


DESK_STATES = {"working": (6, 170), "blocked": (4, 320), "done": (6, 520), "idle": (8, 420)}


def build_desks() -> None:
    out = os.path.join(ROOT, "mods/office-agents/desks")
    os.makedirs(out, exist_ok=True)
    for role in ROLES:
        for state, (count, ms) in DESK_STATES.items():
            frames = [scene(role, state, i).big() for i in range(count)]
            write_gif(os.path.join(out, f"{role}-{state}.gif"), frames, ms)
    scene(None, "empty", 0).big().save(os.path.join(out, "empty.png"))
    shadow = Art(30, 28)
    for y in range(28):
        for x in range(30):
            d = ((x - 14.5) / 14.5) ** 2 + ((y - 22.5) / 5.5) ** 2
            if d <= 1:
                shadow.px[x, y] = (6, 8, 14, round(110 * (1 - d) ** 0.6))
    shadow.big().save(os.path.join(out, "shadow.png"))


# ---- portraits (tab bar) ---------------------------------------------------
# Front view, 22x22. Hair rows start at FRONT_X; "." leaves the face showing.

FRONT = {
    "short": (4, 2, [
        ".....hHHHh....",
        "...hHHLLHHHh..",
        "..hHHLLHHHHHh.",
        "..HHHHHHHHHHH.",
        "..HHH.....HHH.",
        "..H........HH.",
        "..h.........h.",
    ]),
    "grey": (4, 2, [
        ".....LLLLL....",
        "...LLHHHHHLL..",
        "..LHHHHHHHHHL.",
        "..HHH.HHHHHHH.",
        "..H........HH.",
        "..h.........h.",
    ]),
    "messy": (4, 1, [
        ".....H..H.....",
        "...HHHHHHHH...",
        "..HHLHHHLHHH..",
        "..HHHHHHHHHH..",
        "..HHHHHHHHHHH.",
        "..H.HH..HH.HH.",
        "..H.........H.",
    ]),
    "long": (4, 1, [
        "..............",
        ".....hHHHh....",
        "...hHHHLLHHh..",
        "..hHHLLHHHHHh.",
        ".hHHHHHHHHHHHh",
        ".HHHHHH.HHHHHh",
        ".HHH......HHHh",
        ".HH........HHh",
        ".HH........HHh",
        ".HH........HHh",
        ".HH........Hhh",
        ".hH........Hh.",
        ".hH........hh.",
        "..h.........h.",
    ]),
    "ponytail": (4, 2, [
        ".....hHHHh....",
        "...hHHLLLHHh..",
        "..hHHLHHHHHHh.",
        "..HHHHHHHHHHHH",
        "..HH.HHHH..HHH",
        "..H.........HH",
        "............Hh",
        "............hh",
        "............h.",
    ]),
    "headset": (4, 1, [
        "..............",
        ".....AAAAA....",
        "...hHHHLLHHh..",
        "..hHHLLHHHHHh.",
        ".hHHHHHHHHHHHh",
        ".HHHHHHHHHHHHh",
        ".HHH......HHHh",
        ".HH........HHh",
        ".HH........HHh",
        ".HH........HHh",
        ".HH........Hhh",
        ".hH........Hh.",
        ".hH........hh.",
        "..h.........h.",
    ]),
    "cap": (4, 1, [
        "..............",
        "....aAAAAAa...",
        "...aAABAAAAa..",
        "..aAAAAAAAAAa.",
        "..aaaaaaaaaaa.",
        "..HH.H.HH.HHH.",
        "..H.........H.",
    ]),
    "afro": (3, 0, [
        "....HHLHHHLH....",
        "..HHHHHHHHHHHH..",
        ".HHLHHHHHHHLHHH.",
        "HHHHHHHHHHHHHHHh",
        "HHHHHHHHHHHHHHhh",
        "HHHHHHHHHHHHHhhh",
        "HHHH........Hhhh",
        "HHH..........hhh",
        ".Hh..........hh.",
        ".h............h.",
    ]),
}


def bust(role: str) -> Art:
    r = ROLES[role]
    a = Art(22, 22)
    shirt, skin = r["shirt"], r["skin"]
    shirt_d, shirt_l, skin_d = dark(shirt, 0.28), light(shirt, 0.2), dark(skin, 0.16)

    # Shoulders.
    for y, (x0, x1) in zip(range(16, 22), ((5, 16), (3, 18), (2, 19), (2, 19), (2, 19), (2, 19))):
        a.rect(x0, y, x1 - x0 + 1, 1, shirt)
        a.dot(x0, y, shirt_l)
        a.dot(x1, y, shirt_d)
    a.rect(4, 17, 2, 1, shirt_l)

    # Neck, face, ears.
    a.rect(9, 13, 4, 3, skin)
    a.rect(9, 13, 4, 1, skin_d)
    a.rect(6, 4, 10, 8, skin)
    a.rect(7, 12, 8, 1, skin)
    a.rect(15, 5, 1, 7, skin_d)
    a.rect(5, 8, 1, 2, skin)
    a.rect(16, 8, 1, 2, skin_d)

    # Face: eyes, brows, nose, mouth, cheeks.
    for ex in (8, 13):
        a.rect(ex, 8, 1, 2, OUT)
    a.dot(11, 10, skin_d)
    a.rect(10, 11, 2, 1, mix(skin_d, (190, 80, 80), 0.35))
    a.dot(7, 10, mix(skin, (240, 120, 120), 0.4))
    a.dot(14, 10, mix(skin, (240, 120, 120), 0.4))
    a.rect(7, 7, 2, 1, dark(r["hair"], 0.3))
    a.rect(13, 7, 2, 1, dark(r["hair"], 0.3))

    # Outfit details.
    if role == "manager":
        a.rect(9, 15, 4, 2, WHITE)
        a.rect(10, 16, 2, 5, r["acc"])
        a.rect(10, 16, 2, 1, dark(r["acc"], 0.3))
        for i in range(4):
            a.dot(8 - i // 2, 17 + i, shirt_d)
            a.dot(13 + i // 2, 17 + i, shirt_d)
    elif role == "developer":
        a.rect(7, 15, 8, 2, shirt_d)
        a.rect(9, 15, 4, 1, skin_d)
        a.rect(9, 17, 1, 2, WHITE)
        a.rect(12, 17, 1, 2, WHITE)
        a.rect(6, 20, 10, 1, shirt_d)
    elif role == "designer":
        a.rect(8, 15, 6, 1, shirt_l)
        a.dot(10, 17, r["acc"])
        a.dot(11, 17, r["acc"])
    elif role == "analyst":
        a.dot(9, 15, WHITE)
        a.dot(12, 15, WHITE)
        for y in range(17, 22, 2):
            a.dot(11, y, shirt_l)
    elif role == "intern":
        a.rect(9, 15, 4, 1, shirt_d)
        a.dot(9, 16, (60, 60, 70))
        a.dot(10, 17, (60, 60, 70))
        a.rect(10, 18, 2, 3, WHITE)
        a.dot(10, 19, (80, 140, 220))
        a.dot(8, 10, mix(skin, (150, 90, 50), 0.4))
        a.dot(13, 10, mix(skin, (150, 90, 50), 0.4))
    elif role == "support":
        a.dot(9, 15, shirt_l)
        a.dot(12, 15, shirt_l)
        a.dot(15, 18, WHITE)
    elif role == "tester":
        a.rect(9, 15, 4, 1, shirt_d)
        a.rect(6, 18, 2, 2, (60, 50, 40))
        a.dot(5, 18, (60, 50, 40))
        a.dot(8, 18, (60, 50, 40))
    elif role == "writer":
        a.rect(10, 16, 2, 6, (96, 74, 64))
        a.rect(9, 15, 4, 1, (96, 74, 64))
        a.dot(9, 18, dark(shirt, 0.4))
        a.dot(9, 20, dark(shirt, 0.4))

    # Hair and headwear.
    style = r["style"]
    x0, y0, rows = FRONT["long" if style == "long" else style]
    pal = {"H": r["hair"], "h": dark(r["hair"], 0.28), "L": light(r["hair"], 0.25),
           "A": r["acc"], "a": dark(r["acc"], 0.3), "B": light(r["acc"], 0.45)}
    a.rows(x0, y0, rows, pal)

    if style == "messy":  # headphones over the hair
        acc = r["acc"]
        a.rect(6, 1, 10, 1, acc)
        a.dot(5, 2, acc)
        a.dot(16, 2, acc)
        a.rect(4, 3, 1, 5, acc)
        a.rect(17, 3, 1, 5, acc)
        a.rect(3, 7, 2, 4, acc)
        a.rect(17, 7, 2, 4, acc)
        a.rect(3, 7, 1, 4, light(acc, 0.25))
        a.rect(18, 8, 1, 2, dark(acc, 0.35))
    if style == "headset":
        acc = r["acc"]
        a.rect(16, 7, 2, 3, acc)
        a.dot(15, 11, acc)
        a.dot(14, 12, acc)
        a.dot(13, 12, (220, 80, 70))
    if style == "long":  # a hair clip
        a.dot(15, 4, r["acc"])
        a.dot(16, 5, r["acc"])
    if role in ("analyst", "writer"):  # glasses
        frame = (44, 44, 56)
        for gx in (7, 12):
            a.rect(gx, 7, 3, 1, frame)
            a.rect(gx, 10, 3, 1, frame)
            a.rect(gx, 8, 1, 2, frame)
            a.rect(gx + 2, 8, 1, 2, frame)
            a.rect(gx + 1, 8, 1, 2, OUT)
        a.rect(10, 8, 2, 1, frame)
        for ex in (8, 13):
            a.dot(ex, 8, light(skin, 0.5))
    return a.outline()


def build_portraits() -> None:
    out = os.path.join(ROOT, "mods/office-agents/art")
    os.makedirs(out, exist_ok=True)
    for role in ROLES:
        bust(role).big().save(os.path.join(out, f"{role}.png"))


# ---- the room --------------------------------------------------------------


def window(a: Art, x: int, y: int, w: int, h: int, seed: int, moon: bool) -> None:
    R = random.Random(seed)
    a.rect(x - 1, y - 1, w + 2, h + 2, (74, 84, 106))
    for j in range(h):
        a.rect(x, y + j, w, 1, mix((12, 18, 42), (34, 42, 82), j / max(1, h - 1)))
    for _ in range(5):
        a.dot(x + R.randrange(w), y + R.randrange(max(1, h // 2)), (200, 210, 240))
    if moon:
        a.rect(x + w - 6, y + 1, 2, 2, (244, 238, 204))
        a.dot(x + w - 7, y + 1, (120, 120, 140))
    bx = x
    while bx < x + w:
        bw = R.randint(3, 6)
        bh = R.randint(3, h - 2)
        col = R.choice([(14, 18, 34), (20, 24, 44), (26, 30, 52)])
        for xx in range(bx, min(bx + bw, x + w)):
            for yy in range(y + h - bh, y + h):
                a.dot(xx, yy, col)
        for yy in range(y + h - bh + 1, y + h, 2):
            for xx in range(bx + 1, min(bx + bw, x + w) - 1, 2):
                if R.random() < 0.38:
                    a.dot(xx, yy, R.choice([(240, 186, 96), (220, 160, 80), (190, 200, 230)]))
        bx += bw
    a.rect(x + w // 2, y, 1, h, (74, 84, 106))
    a.rect(x, y + h // 2, w, 1, (74, 84, 106))
    a.rect(x - 2, y + h + 1, w + 4, 1, (96, 106, 130))


def build_room() -> None:
    out = os.path.join(ROOT, "mods/office-agents/room")
    os.makedirs(out, exist_ok=True)
    W, H = 150, 22
    a = Art(W, H)
    wall, wall_d = (38, 48, 70), (34, 43, 63)
    a.rect(0, 0, W, 14, wall)
    for x in range(3, W, 6):
        a.rect(x, 2, 1, 12, wall_d)
    a.rect(0, 0, W, 1, (24, 30, 44))
    a.rect(0, 1, W, 1, (52, 62, 88))
    a.rect(0, 14, W, 6, (30, 38, 56))
    a.rect(0, 14, W, 1, (62, 72, 98))
    for x in range(2, W, 12):
        a.rect(x, 16, 9, 3, (27, 34, 50))
    a.rect(0, 20, W, 2, (20, 24, 36))

    window(a, 5, 2, 30, 10, 7, True)
    window(a, 106, 2, 26, 10, 11, False)

    # Clock at ten past ten.
    a.rect(40, 3, 8, 8, (230, 228, 220))
    for x, y in ((40, 3), (47, 3), (40, 10), (47, 10)):
        a.dot(x, y, wall)
    a.rect(43, 4, 1, 3, (40, 40, 48))
    a.rect(44, 6, 2, 1, (40, 40, 48))
    a.dot(44, 7, (200, 60, 60))

    # Kanban board with sticky notes.
    a.rect(52, 2, 22, 10, (222, 226, 232))
    for x in (59, 66):
        a.rect(x, 3, 1, 8, (190, 196, 206))
    notes = [(53, 3, (250, 214, 90)), (56, 4, (240, 130, 160)), (54, 7, (130, 200, 240)),
             (60, 3, (130, 220, 150)), (63, 6, (250, 214, 90)), (61, 8, (240, 130, 160)),
             (67, 3, (130, 200, 240)), (70, 5, (130, 220, 150))]
    for x, y, c in notes:
        a.rect(x, y, 2, 2, c)
    a.rect(52, 12, 22, 1, (120, 128, 142))

    # Door with a lit exit sign.
    a.rect(78, 0, 8, 2, (60, 170, 110))
    a.rect(79, 0, 6, 1, (140, 240, 180))
    a.rect(76, 3, 12, 17, (66, 44, 32))
    a.rect(77, 4, 10, 16, (128, 86, 58))
    a.rect(78, 5, 8, 4, (30, 40, 60))
    a.dot(79, 5, (70, 90, 120))
    a.rect(78, 11, 8, 7, (116, 78, 52))
    a.dot(85, 13, BRASS)

    # Water cooler.
    a.rect(93, 6, 5, 5, (110, 176, 230))
    a.rect(94, 6, 1, 4, (190, 226, 250))
    a.rect(92, 11, 7, 9, (200, 206, 216))
    a.rect(92, 11, 1, 9, (226, 230, 238))
    a.dot(94, 14, (220, 80, 70))
    a.dot(96, 14, (80, 140, 230))
    a.rect(93, 16, 5, 1, (150, 156, 168))

    # A tall plant in the corner.
    a.rect(138, 16, 7, 4, TERRA)
    a.rect(137, 16, 9, 1, TERRA_L)
    a.rows(135, 4, [
        "....G.......",
        "..GlG..G....",
        ".GgGG.GlG...",
        "GGgGlGGgGG..",
        ".gGGGgGGGlG.",
        "..GgGGGgGG..",
        ".GGlGgGGgG..",
        "..gGGGGg....",
        "....gGg.....",
        ".....g......",
        ".....g......",
        ".....g......",
    ], {"G": LEAF, "g": LEAF_D, "l": LEAF_L})
    a.outline()
    a.rect(0, 20, W, 2, (20, 24, 36))
    a.big().save(os.path.join(out, "wall.png"))

    carpet(150, 400, (30, 38, 52), seed=3).save(os.path.join(out, "floor.png"))


def carpet(w: int, h: int, base, seed: int) -> Image.Image:
    """Office carpet tiles with alternating pile, quiet enough to sit under text."""
    R = random.Random(seed)
    a = Art(w, h)
    up, down = light(base, 0.025), dark(base, 0.05)
    for y in range(h):
        for x in range(w):
            tile = ((x // 8) + (y // 8)) % 2
            stripe = (y % 2 == 0) if tile else (x % 2 == 0)
            c = up if stripe else base
            if x % 8 == 0 or y % 8 == 0:
                c = down
            if R.random() < 0.02:
                c = mix(c, (60, 70, 90), 0.15)
            a.dot(x, y, c)
    return a.big()


# ---- chrome ----------------------------------------------------------------


def icon(kind: str, scale: int = 256) -> Image.Image:
    u = scale // 16
    im = Image.new("RGBA", (scale, scale), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def r(x, y, w, h, c):
        d.rectangle([x * u, y * u, (x + w) * u - 1, (y + h) * u - 1], fill=c)

    gold, paper, steel = (224, 164, 74), (230, 223, 210), (127, 168, 207)
    if kind == "files":
        r(2, 5, 12, 9, gold)
        r(2, 3, 6, 3, gold)
        r(2, 5, 12, 1, paper)
    elif kind == "changes":
        r(3, 2, 8, 10, paper)
        r(5, 4, 8, 10, (196, 188, 172))
        r(7, 7, 4, 1, INK)
        r(7, 9, 4, 1, INK)
    else:
        r(2, 8, 12, 6, steel)
        r(2, 8, 12, 1, paper)
        r(5, 10, 6, 2, INK)
    return im


def build_icons() -> None:
    out = os.path.join(ROOT, "mods/office-tabs/art")
    os.makedirs(out, exist_ok=True)
    for kind in ("files", "changes", "inbox"):
        icon(kind).save(os.path.join(out, f"{kind}.png"))


def build_sidebar() -> None:
    """The sidebar's backdrop: a dim night wall, barely there under the text."""
    w, h = 460, 1844
    im = Image.new("RGB", (w, h), INK)
    px = im.load()
    for y in range(h):
        c = mix((19, 27, 36), (13, 19, 26), y / h)
        for x in range(w):
            px[x, y] = c
    d = ImageDraw.Draw(im)
    for x in range(0, w, 46):
        d.line([x, 0, x, h], fill=(17, 24, 32), width=2)
    im.save(os.path.join(ROOT, "mods/office-chrome/sidebar.png"))


def build_floor() -> None:
    """The terminals' backdrop: the same carpet as the office, darker."""
    carpet(415, 306, (18, 25, 33), seed=5).save(os.path.join(ROOT, "mods/office-chrome/floor.png"))


def main() -> None:
    build_desks()
    build_portraits()
    build_room()
    build_icons()
    build_sidebar()
    build_floor()
    print("office art written")


if __name__ == "__main__":
    main()
