#!/usr/bin/env python3
"""Draw the office art pixel by pixel from the palette below: no image model, no
third-party assets, so the layout runs out of the box and the art carries the
code's license.

    python3 tools/build-art.py

Every picture is drawn on a small art grid, outlined (a darker edge around each
shape, "sel-out" style), then scaled 4x with nearest-neighbour: one art pixel is
2 points on screen and 4 device pixels on Retina.

Output (relative to the repo root):
    mods/office-agents/desks/<role>-<working|blocked|done|idle>.gif  144x120
    mods/office-agents/desks/empty.png    a pane with no agent        144x120
    mods/office-agents/desks/shadow.png   soft shadow under a desk    144x120
    mods/office-agents/art/<role>.png     bust portraits (tab bar)     88x88
    mods/office-agents/room/wall.png      the office's back wall      600x88
    mods/office-agents/room/floor.png     office carpet              600x1600
    mods/office-tabs/art/<files|changes|inbox>.png                    256x256
    mods/office-chrome/wallpaper.png      night windows behind everything   1840x1844
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


# ---- people: pastel chibi ---------------------------------------------------
# Big heads, eyes with a shine, rosy cheeks, soft warm outlines and blocky
# light-top / dark-side shading, after a pastel voxel office. Desks, chairs and
# screens keep their own look; only the people are drawn this way.

ROLES = {
    "manager": dict(shirt=(120, 132, 176), skin=(255, 222, 196), hair=(110, 70, 52), style="short", acc=(246, 204, 92)),
    "developer": dict(shirt=(242, 158, 128), skin=(246, 206, 172), hair=(92, 58, 46), style="messy", acc=(150, 214, 186)),
    "designer": dict(shirt=(196, 166, 226), skin=(255, 226, 204), hair=(246, 166, 190), style="long", acc=(255, 214, 110)),
    "analyst": dict(shirt=(150, 192, 236), skin=(250, 214, 184), hair=(250, 214, 130), style="ponytail", acc=(240, 120, 140)),
    "intern": dict(shirt=(250, 214, 96), skin=(255, 222, 196), hair=(150, 92, 62), style="cap", acc=(120, 170, 230)),
    "support": dict(shirt=(246, 150, 140), skin=(204, 146, 108), hair=(120, 64, 60), style="headset", acc=(150, 156, 176)),
    "tester": dict(shirt=(236, 204, 116), skin=(176, 118, 84), hair=(96, 64, 50), style="afro", acc=(255, 214, 64)),
    "writer": dict(shirt=(246, 234, 214), skin=(250, 214, 184), hair=(214, 214, 222), style="grey", acc=(150, 110, 90)),
}

EDGE = (92, 62, 64)
EYE, SHINE = (44, 34, 42), (255, 255, 255)
BLUSH = (248, 168, 166)
LIP, MOUTH, TONGUE = (196, 104, 104), (150, 58, 70), (240, 128, 138)
CREAM = (252, 238, 222)


def soft_outline(a: Art) -> Art:
    """Art.outline with a warm brown edge instead of ink: soft, pastel."""
    src = a.im.copy().load()
    for y in range(a.h):
        for x in range(a.w):
            if src[x, y][3]:
                continue
            for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < a.w and 0 <= ny < a.h and src[nx, ny][3]:
                    a.px[x, y] = (*mix(src[nx, ny][:3], EDGE, 0.62), 255)
                    break
    return a


# ---- the desk: staff facing you ---------------------------------------------
# 36x30 art pixels: the monitor on the left with its screen to you, the staff
# member behind the desk in a high-backed chair looking at you, their things on
# the right. The head is x19..26, y2..9; eyes on y5..6.

DW, DH = 36, 30

KIT = {
    "manager": ("mug", "papers"),
    "developer": ("mug_dark", "can"),
    "designer": ("plant",),
    "analyst": ("chart",),
    "intern": ("cactus", "can"),
    "support": ("phone",),
    "tester": ("duck",),
    "writer": ("books", "mug"),
}

# Hair from the front: (first column, rows from y=0); "." leaves the face.
# The head is x18..27, y1..10; eyes x20..21 and x24..25 on y6..7.
HAIR = {
    "short": (17, [
        "....hHHh....",
        "...hHLLHHh..",
        "..hHHLLHHHh.",
        ".hHHLHHHHHHh",
        ".HHHH...HHHh",
        ".HH......HHh",
        ".H........H.",
        ".h........h.",
    ]),
    "grey": (17, [
        "....LLLL....",
        "...LLHHHLL..",
        "..LHHHHHHHL.",
        ".LHHHHHHHHHh",
        ".HHH.HHHHHHh",
        ".HH.....HHHh",
        ".H........H.",
        ".h........h.",
    ]),
    "messy": (17, [
        "...H.HH.H.H.",
        "..HHHHHHHHH.",
        ".HHLHHHLHHHh",
        ".HHHHHHHHHHh",
        ".HHH.HHH.HHh",
        ".HH......HHh",
        ".h........h.",
    ]),
    "long": (17, [
        "....hHHh....",
        "...hHLLHHh..",
        "..hHLLHHHHh.",
        ".hHLHHHHHHHh",
        "HHHHHHHHHHHH",
        "HHH.H..H.HHH",
        "HH........HH",
        "HH........HH",
        "HH........HH",
        "HH........Hh",
        "HHh......hHh",
        "HHh......hHh",
        ".Hh......hH.",
        ".h........h.",
    ]),
    "ponytail": (17, [
        "....hHHh....",
        "...hHLLHHh..",
        "..hHHLHHHHh.",
        ".hHHHHHHHHHH",
        ".HHHH...HHHH",
        ".HH......HHH",
        ".H........HH",
        "..........HH",
        "..........Hh",
        "..........Hh",
        "...........h",
    ]),
    "cap": (17, [
        "...aAAAAa...",
        "..aAABBAAa..",
        ".aAAAAAAAAa.",
        ".aAAAAAAAAAa",
        "bbbbbbbbbbb.",
        ".HH......HH.",
        ".H........H.",
    ]),
    "afro": (16, [
        "....HHLHHLH...",
        "..HHHHHHHHHHH.",
        ".HHLHHHHHHLHH.",
        "HHHHHHHHHHHHHh",
        "HHHHHHHHHHHHhh",
        "HHH........Hhh",
        "HH..........hh",
        "HH..........hh",
        ".H..........h.",
    ]),
}
HAIR["headset"] = HAIR["long"]

# The top of a head resting on the desk (idle), from x=17, y=9.
TOP = [
    "...hHHHHh...",
    "..hHLLHHHh..",
    ".hHLHHHHHHh.",
    ".HHHHHHHHHHh",
    ".HHHHHHHHHHh",
    "..hHHHHHHh..",
]


def hair_pal(r):
    return {"H": r["hair"], "h": dark(r["hair"], 0.25), "L": light(r["hair"], 0.3),
            "A": r["acc"], "a": dark(r["acc"], 0.25), "B": light(r["acc"], 0.5), "b": light(r["acc"], 0.3)}


def headwear(a: Art, role: str, dy: int = 0) -> None:
    """Headphones, a headset, a hair clip or a scrunchie, over the hair."""
    r = ROLES[role]
    acc, hi, side = r["acc"], light(r["acc"], 0.35), dark(r["acc"], 0.22)
    style = r["style"]
    if style == "messy":
        a.rect(19, dy, 8, 1, hi)
        a.dot(18, dy + 1, acc)
        a.dot(27, dy + 1, acc)
        a.rect(17, dy + 2, 1, 3, acc)
        a.rect(28, dy + 2, 1, 3, acc)
        for x in (16, 27):
            a.rect(x, dy + 5, 3, 5, acc)
            a.rect(x, dy + 5, 3, 1, hi)
        a.rect(29, dy + 6, 1, 4, side)
    elif style == "headset":
        a.rect(19, dy, 8, 1, acc)
        a.rect(27, dy + 5, 3, 3, acc)
        a.rect(27, dy + 5, 3, 1, hi)
        if not dy:  # a short mic boom by the cheek
            a.dot(28, 8, acc)
            a.dot(27, 9, (232, 88, 80))
    elif style == "long":
        a.dot(26, dy + 3, acc)
        a.dot(27, dy + 4, acc)
    elif style == "ponytail":
        a.rect(27, dy + 4, 2, 1, acc)


def head(role: str, mood: str, glow=None) -> Art:
    """The head, face and hair, softly outlined. `mood`: look (at the monitor,
    left), front, blink, open (surprised or laughing), happy (eyes closed)."""
    r = ROLES[role]
    skin = r["skin"]
    skin_d = dark(skin, 0.14)
    a = Art(DW, DH)
    a.rect(20, 1, 6, 1, skin)
    a.rect(19, 2, 8, 1, skin)
    a.rect(18, 3, 10, 6, skin)
    a.rect(19, 9, 8, 1, skin)
    a.rect(20, 10, 6, 1, skin)
    a.rect(27, 3, 1, 6, skin_d)
    a.dot(26, 9, skin_d)
    a.rect(17, 6, 1, 2, skin)
    a.rect(28, 6, 1, 2, skin_d)
    glasses = role in ("analyst", "writer")
    shift = -1 if mood in ("look", "blink") and not glasses else 0
    if mood == "happy":
        for x in (19, 24):
            a.dot(x, 7, EYE)
            a.dot(x + 1, 6, EYE)
            a.dot(x + 2, 7, EYE)
    elif mood == "blink":
        a.rect(20 + shift, 7, 2, 1, EYE)
        a.rect(24 + shift, 7, 2, 1, EYE)
    else:
        for x in (20 + shift, 24 + shift):
            a.rect(x, 6, 2, 2, EYE)
            a.dot(x, 6, SHINE)
    a.rect(18, 8, 2, 1, BLUSH)
    a.rect(26, 8, 2, 1, BLUSH)
    if role == "intern":  # freckles
        a.dot(19, 8, mix(skin, (170, 100, 60), 0.5))
        a.dot(26, 8, mix(skin, (170, 100, 60), 0.5))
    if mood == "open":
        a.rect(22, 8, 2, 1, MOUTH)
        a.rect(22, 9, 2, 1, TONGUE)
    elif mood == "happy":
        a.dot(21, 8, MOUTH)
        a.dot(24, 8, MOUTH)
        a.rect(22, 9, 2, 1, MOUTH)
    else:
        a.rect(22, 9, 2, 1, LIP)
    x0, rows = HAIR[r["style"]]
    a.rows(x0, 0, rows, hair_pal(r))
    headwear(a, role)
    if glasses:  # light half-rims: a bar over each eye and the outer sides
        frame = (150, 112, 104) if role == "writer" else (120, 140, 190)
        a.rect(19, 5, 3, 1, frame)
        a.rect(24, 5, 3, 1, frame)
        a.rect(22, 5, 2, 1, dark(frame, 0.15))
        a.dot(19, 6, frame)
        a.dot(26, 6, frame)
    if glow is not None:  # the monitor's light on the near cheek
        for y in range(3, 10):
            a.tint(18, y, glow, 0.12)
    return soft_outline(a)


def outfit(a: Art, role: str, cx: int, top: int, x0: int, x1: int, bottom: int) -> None:
    """Shirt details: `cx` the left of the two middle columns, `top` the
    shoulder row, the body x0..x1 down to `bottom`."""
    r = ROLES[role]
    shirt, skin, acc = r["shirt"], r["skin"], r["acc"]
    shirt_d, shirt_l = dark(shirt, 0.18), light(shirt, 0.35)
    if role == "developer":  # stripes, like a peach and cream tee
        for y in range(top, bottom + 1):
            if (y - top) % 2 == 0:
                for x in range(x0, x1 + 1):
                    if a.get(x, y) is not None:
                        a.dot(x, y, CREAM if x < x1 else dark(CREAM, 0.12))
    elif role == "manager":
        a.rect(cx, top, 2, 1, WHITE)
        a.rect(cx, top + 1, 2, bottom - top, acc)
        a.rect(cx, top + 1, 2, 1, dark(acc, 0.25))
        a.dot(cx - 1, top + 1, shirt_d)
        a.dot(cx + 2, top + 1, shirt_d)
    elif role == "designer":
        a.rect(cx - 1, top, 4, 1, skin)
        a.rect(cx, top + 1, 2, 1, acc)
    elif role == "analyst":
        a.dot(cx - 1, top, WHITE)
        a.dot(cx + 2, top, WHITE)
        for y in range(top + 2, bottom + 1, 2):
            a.dot(cx + 1, y, shirt_l)
    elif role == "intern":
        a.dot(cx - 1, top, shirt_l)
        a.dot(cx + 2, top, shirt_l)
        a.rect(cx, top + 1, 2, 1, shirt_d)
    elif role == "support":
        a.dot(cx - 1, top, WHITE)
        a.dot(cx + 2, top, WHITE)
        a.dot(x1 - 1, top + 2, WHITE)
    elif role == "tester":
        a.rect(x0 + 1, top + 2, 2, 2, (110, 80, 60))
    elif role == "writer":
        a.rect(cx, top, 2, bottom - top + 1, (150, 110, 90))
        a.dot(cx - 1, top + 2, dark(shirt, 0.3))
        a.dot(cx + 2, top + 2, dark(shirt, 0.3))


def torso(role: str) -> Art:
    r = ROLES[role]
    shirt = r["shirt"]
    a = Art(DW, DH)
    a.rect(21, 11, 4, 1, dark(r["skin"], 0.14))
    a.rect(19, 12, 8, 1, light(shirt, 0.2))
    a.rect(18, 13, 10, 3, shirt)
    a.rect(18, 13, 1, 3, light(shirt, 0.2))
    a.rect(27, 13, 1, 3, dark(shirt, 0.18))
    outfit(a, role, 22, 12, 18, 27, 15)
    return soft_outline(a)


def sleeve(a: Art, role: str, x: int, y: int, w: int, h: int) -> None:
    shirt = ROLES[role]["shirt"]
    a.rect(x, y, w, h, shirt)
    if role == "developer":
        for yy in range(y, y + h, 2):
            a.rect(x, yy, w, 1, CREAM)
    a.rect(x + w - 1, y, 1, h, dark(shirt, 0.18) if role != "developer" else dark(CREAM, 0.1))


def person_back(role: str, state: str, f: int) -> Art:
    """Everything of the person behind the desk's top edge."""
    r = ROLES[role]
    a = Art(DW, DH)
    if state == "done":  # stretching, hands behind the head
        arms = Art(DW, DH)
        sleeve(arms, role, 16, 4, 2, 8)
        sleeve(arms, role, 28, 4, 2, 8)
        arms.rect(17, 3, 2, 1, r["shirt"])
        arms.rect(27, 3, 2, 1, r["shirt"])
        a.over(soft_outline(arms))
    a.over(torso(role))
    if state == "idle":  # head down on the desk: its top, and what is on it
        top = Art(DW, DH)
        rows = TOP
        if r["style"] == "cap":
            rows = [row.replace("H", "A").replace("L", "B").replace("h", "a") for row in TOP[:3]] + TOP[3:]
        top.rows(17, 9, rows, hair_pal(r))
        if r["style"] == "afro":
            top.rect(16, 10, 1, 4, r["hair"])
            top.rect(29, 10, 1, 4, dark(r["hair"], 0.25))
        if r["style"] in ("messy", "headset"):
            top.rect(18, 11, 10, 1, r["acc"])
        a.over(soft_outline(top))
        return a
    mood = {"working": "blink" if f == 7 else "look", "blocked": "open", "done": "happy"}.get(state, "front")
    a.over(head(role, mood, GLOW.get(state)))
    if state == "blocked":  # one hand up, waving
        wave = f % 2
        arm = Art(DW, DH)
        sleeve(arm, role, 28 + wave, 5, 2, 7)
        arm.rect(28 + wave, 2, 3, 3, r["skin"])
        arm.dot(27 + wave, 3, r["skin"])
        a.over(soft_outline(arm))
    return a


def person_front(role: str, state: str, f: int) -> Art:
    """Hands on the keyboard, or arms folded on the desk."""
    r = ROLES[role]
    a = Art(DW, DH)
    skin = r["skin"]
    if state == "idle":
        sleeve(a, role, 18, 15, 10, 2)
        a.rect(18, 15, 10, 1, light(r["shirt"], 0.25))
        return soft_outline(a)
    if state == "done":
        return a  # hands are behind the head
    lift_l = lift_r = 0
    if state == "working":  # a key every frame, hands taking turns
        lift_l, lift_r = (1, 0) if f % 2 == 0 else (0, 1)
    hands = [(20, lift_l)] if state == "blocked" else [(20, lift_l), (24, lift_r)]
    for x, lift in hands:
        sleeve(a, role, x, 15 - lift, 2, 1)
        a.rect(x, 16 - lift, 2, 1, skin)
    return soft_outline(a)


def keyboard() -> Art:
    a = Art(DW, DH)
    a.rect(19, 16, 8, 2, (196, 200, 210))
    for x in range(19, 27, 2):
        a.dot(x, 16, (150, 156, 170))
        a.dot(x + 1, 17, (150, 156, 170))
    a.rect(29, 17, 2, 1, (196, 200, 210))
    return a.outline()


def chair_front(empty: bool = False) -> Art:
    a = Art(DW, DH)
    x = 16
    a.rect(x + 1, 1, 12, 1, CHAIR_HI)
    a.rect(x, 2, 14, 14, CHAIR)
    a.rect(x, 2, 1, 14, CHAIR_HI)
    a.rect(x + 13, 2, 1, 14, CHAIR_SH)
    if empty:
        for y in (5, 9):
            a.rect(x + 3, y, 8, 1, mix(CHAIR, CHAIR_SH, 0.7))
        a.rect(x + 2, 13, 10, 3, CHAIR_SH)
    return a.outline()


def desk_front(state: str) -> Art:
    a = Art(DW, DH)
    a.rect(1, 16, 34, 2, WOOD)
    a.rect(1, 18, 34, 1, WOOD_HI)
    for x, y, n in ((3, 16, 6), (12, 17, 5), (24, 16, 7), (31, 17, 3)):
        a.rect(x, y, n, 1, WOOD_GRAIN)
    a.rect(2, 19, 32, 8, WOOD_SH)
    a.rect(2, 19, 32, 1, WOOD_DK)
    a.rect(4, 21, 18, 4, mix(WOOD_SH, WOOD_DK, 0.35))
    a.rect(4, 21, 18, 1, WOOD_DK)
    a.rect(25, 20, 7, 2, WOOD)
    a.rect(25, 23, 7, 2, WOOD)
    a.rect(25, 22, 7, 1, WOOD_DK)
    a.rect(28, 20, 2, 1, BRASS)
    a.rect(28, 23, 2, 1, BRASS)
    a.rect(2, 26, 32, 1, WOOD_DK)
    a.rect(2, 27, 3, 2, WOOD_DK)
    a.rect(31, 27, 3, 2, WOOD_DK)
    if state in GLOW:  # the screen's light on the desk below it
        for x in range(2, 15):
            a.tint(x, 16, GLOW[state], 0.22)
            a.tint(x, 17, GLOW[state], 0.12)
    return a.outline()


def screen(a: Art, state: str, f: int) -> None:
    x0, y0, w, h = 3, 5, 11, 6
    bg = SCREEN[state]
    if state == "blocked" and f % 2:
        bg = (128, 36, 34)
    a.rect(x0, y0, w, h, bg)
    if state == "working":
        for i in range(h):
            indent, length, col = CODE[(f + i) % len(CODE)]
            a.rect(x0 + 1 + indent, y0 + i, min(length, w - 2 - indent), 1, col)
        if f % 2 == 0:
            a.dot(x0 + w - 2, y0 + h - 1, WHITE)
    elif state == "blocked":
        fg = (255, 244, 236) if f % 2 == 0 else (236, 150, 140)
        a.rect(x0 + 4, y0, 2, 4, fg)
        a.rect(x0 + 4, y0 + 5, 2, 1, fg)
    elif state == "done":
        check = ["...........", "........#..", ".......#...", "..#...#....", "...#.#.....", "....#......"]
        a.rows(x0, y0, [r.replace("#", "C") for r in check], {"C": (156, 240, 166)})
        sparkle = [(1, 0), (9, 4), (2, 5)][f % 3]
        a.dot(x0 + sparkle[0], y0 + sparkle[1], (200, 220, 255))
    elif state == "idle":
        xs, ys = [0, 2, 4, 6, 9, 6, 4, 2], [0, 1, 2, 4, 2, 1, 0, 1]
        col = [(232, 120, 160), (120, 200, 240), (240, 200, 100)][(f // 3) % 3]
        a.rect(x0 + xs[f % 8], y0 + ys[f % 8], 2, 2, dark(col, 0.25))
        a.dot(x0 + 5, y0 + 5 - ys[(f + 3) % 8], (44, 52, 76))
    else:  # switched off: only a reflection
        for i in range(4):
            a.dot(x0 + 6 + i, y0 + i, (46, 54, 72))
        a.dot(x0 + 8, y0, (46, 54, 72))


def monitor_front(state: str, f: int) -> Art:
    a = Art(DW, DH)
    a.rect(2, 4, 13, 9, BEZEL)
    a.rect(2, 4, 13, 1, BEZEL_HI)
    a.rect(7, 13, 3, 2, METAL_D)
    a.rect(5, 15, 7, 1, METAL)
    a.outline()
    screen(a, state, f)
    a.dot(13, 12, LED[state])
    return a


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


def props_front(role: str, state: str, f: int) -> Art:
    a = Art(DW, DH)
    after = []
    for p in KIT[role]:
        if p == "mug":
            x = 31 if "books" not in KIT[role] else 30
            mug(a, x, 14 if "books" not in KIT[role] else 9, PAPER, (224, 120, 74))
            after.append((x, 13 if "books" not in KIT[role] else 8))
        elif p == "mug_dark":
            mug(a, 30, 14, (56, 60, 74), (240, 180, 80))
            after.append((30, 13))
        elif p == "papers":
            a.rect(29, 16, 5, 1, PAPER)
            a.rect(30, 17, 5, 1, PAPER_D)
        elif p == "plant":
            a.rect(30, 13, 4, 3, TERRA)
            a.rect(29, 13, 6, 1, TERRA_L)
            a.rows(28, 4, [
                "...l....",
                ".lGG.G..",
                "GGgGlGG.",
                ".GgGGgGG",
                "GGGlGGg.",
                ".gGGGgG.",
                "..gGGg..",
                "...gG...",
                "...g....",
            ], {"G": LEAF, "g": LEAF_D, "l": LEAF_L})
        elif p == "chart":
            a.rect(29, 7, 6, 7, PAPER)
            a.rect(30, 12, 1, 1, (120, 180, 240))
            a.rect(31, 11, 1, 2, (120, 210, 140))
            a.rect(32, 10, 1, 3, (240, 190, 90))
            a.rect(33, 9, 1, 4, (232, 110, 110))
            a.rect(31, 14, 2, 2, METAL_D)
        elif p == "cactus":
            a.rect(29, 14, 3, 2, TERRA)
            a.rect(30, 10, 1, 4, LEAF)
            a.dot(29, 11, LEAF)
            a.dot(29, 12, LEAF_D)
            a.dot(31, 12, LEAF_D)
            a.dot(30, 9, (240, 120, 160))
        elif p == "can":
            a.rect(33, 13, 2, 3, (70, 200, 120))
            a.rect(33, 14, 2, 1, (30, 40, 40))
            a.dot(33, 13, (200, 255, 210))
        elif p == "phone":
            a.rect(29, 14, 5, 2, (200, 70, 60))
            a.rect(29, 13, 5, 1, (150, 44, 40))
            a.dot(29, 12, (150, 44, 40))
            a.dot(33, 12, (150, 44, 40))
            a.dot(31, 15, (250, 220, 200))
            if state == "blocked" and f % 2 == 0:
                a.dot(34, 11, (255, 230, 120))
        elif p == "duck":
            a.rect(29, 14, 4, 2, (250, 214, 64))
            a.rect(31, 12, 2, 2, (250, 214, 64))
            a.dot(33, 13, (240, 130, 50))
            a.dot(32, 12, (40, 40, 40))
            a.dot(29, 14, (255, 236, 140))
        elif p == "books":
            a.rect(29, 15, 6, 1, (170, 60, 60))
            a.rect(30, 14, 5, 1, (60, 110, 170))
            a.rect(29, 13, 6, 1, (90, 150, 90))
            a.rect(30, 12, 4, 1, (220, 180, 90))
            for y in (12, 13, 14, 15):
                a.dot(34 if y != 12 else 33, y, PAPER)
    a.outline()
    if state == "working":
        for x, y in after:
            steam(a, x, y, f)
    return a


def overlay(state: str, f: int) -> Art:
    a = Art(DW, DH)
    if state == "idle":
        step = (f // 2) % 4
        col = {"#": (206, 218, 255)}
        if step >= 1:
            a.rows(29, 6, ["###", ".#.", "###"], col)
        if step >= 2:
            a.rows(31, 0, ["####", "..#.", ".#..", "####"], col)
        return a.outline() if step else a
    if state == "blocked":  # a speech bubble with an exclamation mark
        a.rect(31, 0, 4, 7, WHITE)
        red = (220, 60, 50) if f % 2 == 0 else (160, 40, 36)
        a.rect(32, 1, 2, 3, red)
        a.rect(32, 5, 2, 1, red)
        a.dot(31, 7, WHITE)
        return a.outline()
    return a


def scene(role: str | None, state: str, f: int) -> Art:
    a = Art(DW, DH)
    if state == "empty":
        a.over(chair_front(empty=True))
        a.over(desk_front("empty"))
        a.over(monitor_front("empty", 0))
        a.over(keyboard())
        return a
    a.over(chair_front())
    a.over(person_back(role, state, f))
    a.over(desk_front(state))
    a.over(monitor_front(state, f))
    a.over(keyboard())
    a.over(person_front(role, state, f))
    a.over(props_front(role, state, f))
    a.over(overlay(state, f))
    return a


# Working is fast on purpose: twelve frames (one full scroll of CODE) at 90 ms.
DESK_STATES = {"working": (12, 90), "blocked": (4, 320), "done": (6, 520), "idle": (8, 420)}


def build_desks() -> None:
    out = os.path.join(ROOT, "mods/office-agents/desks")
    os.makedirs(out, exist_ok=True)
    for role in ROLES:
        for state, (count, ms) in DESK_STATES.items():
            frames = [scene(role, state, i).big() for i in range(count)]
            write_gif(os.path.join(out, f"{role}-{state}.gif"), frames, ms)
    scene(None, "empty", 0).big().save(os.path.join(out, "empty.png"))
    shadow = Art(DW, DH)
    for y in range(DH):
        for x in range(DW):
            d = ((x - 17.5) / 17.5) ** 2 + ((y - 27.5) / 3.5) ** 2
            if d <= 1:
                shadow.px[x, y] = (6, 8, 14, round(120 * (1 - d) ** 0.6))
    shadow.big().save(os.path.join(out, "shadow.png"))


# ---- portraits (tab bar) ---------------------------------------------------
# The same head as at the desk, laughing, over a wider body: 22x22.


def bust(role: str) -> Art:
    r = ROLES[role]
    shirt = r["shirt"]
    body = Art(22, 22)
    body.rect(9, 14, 4, 1, dark(r["skin"], 0.14))
    body.rect(6, 15, 10, 1, light(shirt, 0.2))
    body.rect(4, 16, 14, 6, shirt)
    body.rect(4, 16, 1, 6, light(shirt, 0.2))
    body.rect(17, 16, 1, 6, dark(shirt, 0.18))
    outfit(body, role, 10, 15, 4, 17, 21)
    a = Art(22, 22)
    a.over(soft_outline(body))
    face = head(role, "open")
    a.im.alpha_composite(face.im, dest=(0, 3), source=(12, 0, 34, 19))
    return a


def build_portraits() -> None:
    out = os.path.join(ROOT, "mods/office-agents/art")
    os.makedirs(out, exist_ok=True)
    for role in ROLES:
        bust(role).big().save(os.path.join(out, f"{role}.png"))


# ---- the room --------------------------------------------------------------


def window(a: Art, x: int, y: int, w: int, h: int, seed: int, moon: bool) -> None:
    R = random.Random(seed)
    frame = (74, 84, 106)
    a.rect(x - 1, y - 1, w + 2, h + 2, frame)
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
    a.rect(x + w // 2, y, 1, h, frame)
    a.rect(x, y + h // 2, w, 1, frame)
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


def build_wallpaper() -> None:
    """Night office windows, some lit by a lamp, some by a screen: the backdrop
    of the sidebar, the work column, the side panel and the terminals. Dim, so
    text stays readable on top."""
    R = random.Random(9)
    w, h = 920, 922  # square-ish, so "cover" scales it alike in tall and wide areas
    a = Art(w, h)
    a.rect(0, 0, w, h, (14, 21, 29))
    for y in range(0, h, 23):
        for x in range(0, w, 19):
            a.rect(x + 3, y + 4, 11, 12, (24, 33, 42))
            lit = R.random()
            if lit < 0.15:
                a.rect(x + 4, y + 5, 9, 10, (74, 58, 36))
                a.rect(x + 4, y + 5, 9, 1, (90, 71, 44))
            elif lit < 0.22:
                a.rect(x + 4, y + 5, 9, 10, (28, 44, 60))
                a.rect(x + 4, y + 5, 9, 1, (36, 56, 76))
            a.rect(x + 8, y + 4, 1, 12, (18, 26, 34))
    a.big(2).convert("RGB").save(os.path.join(ROOT, "mods/office-chrome/wallpaper.png"))


def main() -> None:
    build_desks()
    build_portraits()
    build_room()
    build_icons()
    build_wallpaper()
    print("office art written")


if __name__ == "__main__":
    main()
