#!/usr/bin/env python3
"""Draw the office's remaining bitmaps pixel by pixel: no image model, no
third-party assets, so the layout runs out of the box and the art carries the
code's license. The desks, the boss, the portraits and the walls are drawn live
in blocks by mods/office-agents/figure.js and room.js (tools/preview-figure.mjs).

    python3 tools/build-art.py            # everything
    python3 tools/build-art.py room       # only some: room icons wallpaper

Each picture is drawn on a small art grid, then scaled with nearest-neighbour.

Output (relative to the repo root):
    mods/office-agents/room/floor-tiles.png  the panel's tiled floor   1824x1600
    mods/office-tabs/art/<files|changes|office>.png                   256x256
    mods/office-chrome/wallpaper.png      night windows behind everything   1840x1844
"""

from __future__ import annotations

import os
import random

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UP = 4  # device pixels per art pixel
INK = (16, 24, 32)


def mix(a, b, t: float):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def dark(c, t: float = 0.3):
    return mix(c, (0, 0, 0), t)


def light(c, t: float = 0.3):
    return mix(c, (255, 255, 255), t)


class Art:
    """An RGBA art-pixel canvas."""

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

    def big(self, k: int = UP) -> Image.Image:
        return self.im.resize((self.w * k, self.h * k), Image.NEAREST)


# ---- the room --------------------------------------------------------------


def build_room() -> None:
    out = os.path.join(ROOT, "mods/office-agents/room")
    os.makedirs(out, exist_ok=True)
    # The side panel's floor, under the rugs.
    tiles(456, 400, PLANK, seed=3).save(os.path.join(out, "floor-tiles.png"))


# Slate-indigo boards, the theme's chrome: quiet enough for the rugs, cubicles and
# their text on top. Its base is mirrored in mods/office-agents/main.js (CARPET).
PLANK = (36, 39, 56)


def tiles(w: int, h: int, base, seed: int, size: int = 12):
    """Quiet square floor tiles, each a shade off the next, a thin dark joint
    and a faint lit edge: the floor under the desks."""
    R = random.Random(seed)
    a = Art(w, h)
    joint = dark(base, 0.13)
    for ty in range(0, h, size):
        for tx in range(0, w, size):
            shade = mix(base, light(base, 0.025) if R.random() < 0.5 else dark(base, 0.025), R.random())
            a.rect(tx, ty, size, size, shade)
            a.rect(tx + 1, ty + 1, size - 2, 1, light(shade, 0.04))
            a.rect(tx, ty, size, 1, joint)
            a.rect(tx, ty, 1, size, joint)
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
    elif kind == "office":
        r(3, 2, 10, 8, steel)
        r(4, 3, 8, 6, (36, 52, 70))
        r(5, 4, 4, 1, gold)
        r(5, 6, 6, 1, paper)
        r(7, 10, 2, 2, steel)
        r(1, 12, 14, 2, gold)
        r(2, 14, 1, 2, gold)
        r(13, 14, 1, 2, gold)
    return im


def build_icons() -> None:
    out = os.path.join(ROOT, "mods/office-tabs/art")
    os.makedirs(out, exist_ok=True)
    for kind in ("files", "changes", "office"):
        icon(kind).save(os.path.join(out, f"{kind}.png"))


def build_wallpaper() -> None:
    """Night office windows, some lit by a lamp, some by a screen: the backdrop
    of the sidebar, the work column, the side panel and the terminals. Dim, so
    text stays readable on top."""
    R = random.Random(9)
    w, h = 920, 922  # square-ish, so "cover" scales it alike in tall and wide areas
    a = Art(w, h)
    a.rect(0, 0, w, h, (30, 32, 48))
    for y in range(0, h, 23):
        for x in range(0, w, 19):
            a.rect(x + 3, y + 4, 11, 12, (40, 43, 62))
            lit = R.random()
            if lit < 0.15:
                a.rect(x + 4, y + 5, 9, 10, (96, 78, 52))
                a.rect(x + 4, y + 5, 9, 1, (116, 94, 62))
            elif lit < 0.22:
                a.rect(x + 4, y + 5, 9, 10, (48, 62, 96))
                a.rect(x + 4, y + 5, 9, 1, (60, 78, 118))
            a.rect(x + 8, y + 4, 1, 12, (32, 35, 52))
    a.big(2).convert("RGB").save(os.path.join(ROOT, "mods/office-chrome/wallpaper.png"))


def main() -> None:
    import sys
    parts = {"room": build_room, "icons": build_icons, "wallpaper": build_wallpaper}
    wanted = sys.argv[1:] or list(parts)
    for name in wanted:
        parts[name]()
    print(f"office art written: {', '.join(wanted)}")


if __name__ == "__main__":
    main()
