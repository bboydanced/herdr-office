#!/usr/bin/env python3
"""Draw the office placeholder art: 8 role sprites (36x48 px at 4x) with three
animated states each, 8 bust portraits, 4 buildings, 3 tab icons, the sidebar
strip and the floor background.

Everything here is drawn pixel by pixel from the palette below - no image model,
no third-party assets - so the layout runs out of the box. Replace any file with
generated art of the same name and size; see docs/ART-PROMPTS.md.

    python3 tools/build-art.py

Output (paths relative to the repo root):
    mods/office-agents/sprites/<role>-<working|rest|blocked>.gif   144x192
    mods/office-agents/art/<role>.png                              256x256
    mods/office-spaces/art/<place>.png                             256x256
    mods/office-tabs/art/<files|changes|inbox>.png                 256x256
    mods/office-chrome/sidebar.png                                 460x1844
    mods/office-chrome/floor.png                                   1658x1224
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Palette shared with themes/office-night.json.
INK = (16, 24, 32)
DESK = (58, 46, 36)
DESK_LIGHT = (86, 68, 50)
PAPER = (230, 223, 210)
GOLD = (224, 164, 74)
STEEL = (127, 168, 207)
TEAL = (111, 182, 173)
GREEN = (143, 191, 138)
PLUM = (180, 142, 196)
RED = (224, 115, 107)
GREY = (109, 120, 131)
GLASS = (44, 60, 74)

# One identity colour per role: hair/shirt accent, keeps eight cards apart.
ROLE_COLOR = {
    "analyst": STEEL,
    "designer": PLUM,
    "developer": TEAL,
    "intern": GREEN,
    "manager": GOLD,
    "support": RED,
    "tester": GREY,
    "writer": PAPER,
}

PX = 4  # one art pixel; sprites are 36x48 art pixels rendered at 4x
SPRITE_W, SPRITE_H = 36, 48


def blank(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def rect(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color, scale: int = 1) -> None:
    d.rectangle([x * scale, y * scale, (x + w) * scale - 1, (y + h) * scale - 1], fill=color)


def figure(color, state: str, frame: int) -> Image.Image:
    """One 36x48 office worker at a desk: monitor, head, torso, arms.

    `frame` drives the animation: typing hands alternate, the blocked pose
    raises a hand, resting blinks every other frame.
    """
    im = blank(SPRITE_W * PX, SPRITE_H * PX)
    d = ImageDraw.Draw(im)

    # Desk and monitors, behind the person.
    rect(d, 2, 34, 32, 6, DESK, PX)
    rect(d, 2, 34, 32, 1, DESK_LIGHT, PX)
    rect(d, 4, 22, 9, 11, INK, PX)                # left monitor bezel
    rect(d, 5, 23, 7, 9, (26, 44, 56), PX)        # screen
    rect(d, 23, 25, 9, 8, INK, PX)                # right monitor bezel
    rect(d, 24, 26, 7, 6, (26, 44, 56), PX)
    if state == "working" and frame % 2 == 0:      # a line of output appears
        rect(d, 6, 25, 5, 1, TEAL, PX)
        rect(d, 6, 27, 4, 1, TEAL, PX)
    else:
        rect(d, 6, 25, 5, 1, (58, 86, 104), PX)
        rect(d, 6, 27, 3, 1, (58, 86, 104), PX)

    skin = (222, 188, 152)
    hair = (52, 42, 38)
    rect(d, 14, 6, 8, 10, skin, PX)               # head
    rect(d, 13, 4, 10, 4, hair, PX)               # hair
    rect(d, 13, 4, 2, 9, hair, PX)
    rect(d, 13, 15, 10, 1, color, PX)             # collar

    if state == "blocked":
        rect(d, 16, 9, 2, 2, INK, PX)
        rect(d, 20, 9, 2, 2, INK, PX)
    elif state == "rest" and frame % 2 == 0:
        rect(d, 16, 10, 2, 1, INK, PX)            # eyes closed
        rect(d, 20, 10, 2, 1, INK, PX)
    else:
        rect(d, 16, 9, 2, 2, INK, PX)
        rect(d, 20, 9, 2, 2, INK, PX)

    rect(d, 12, 16, 12, 12, color, PX)            # torso
    rect(d, 12, 16, 12, 1, PAPER, PX)             # shirt highlight

    if state == "blocked":
        rect(d, 24, 12, 3, 8, color, PX)          # raised arm
        rect(d, 24, 9, 3, 3, skin, PX)            # raised hand
        # The alert mark flashes: frame 0 bright, frame 1 dimmed.
        mark = RED if frame % 2 == 0 else (150, 74, 68)
        rect(d, 28, 5, 3, 7, mark, PX)
        rect(d, 29, 6, 1, 4, PAPER, PX)
        rect(d, 29, 11, 1, 1, PAPER, PX)
    else:
        # Both hands on the keyboard; working alternates which one lifts.
        left = 1 if state == "working" and frame % 2 == 0 else 0
        right = 1 if state == "working" and frame % 2 == 1 else 0
        rect(d, 10, 24 - left, 3, 10, color, PX)
        rect(d, 23, 24 - right, 3, 10, color, PX)
        rect(d, 10, 32 - left, 3, 2, skin, PX)
        rect(d, 23, 32 - right, 3, 2, skin, PX)

    return im


def write_gif(path: str, frames: list[Image.Image], duration: int) -> None:
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        disposal=2,
        optimize=True,
    )


def build_sprites() -> None:
    out = os.path.join(ROOT, "mods/office-agents/sprites")
    os.makedirs(out, exist_ok=True)
    plan = {"working": (5, 260), "rest": (4, 1800), "blocked": (2, 500)}
    for role, color in ROLE_COLOR.items():
        for state, (count, duration) in plan.items():
            frames = [figure(color, state, i) for i in range(count)]
            write_gif(os.path.join(out, f"{role}-{state}.gif"), frames, duration)


def bust(color, scale: int = 256) -> Image.Image:
    """A 256x256 head-and-shoulders portrait, centred, on transparency."""
    u = scale // 16  # 16x16 art grid
    im = blank(scale, scale)
    d = ImageDraw.Draw(im)
    rect(d, 2, 12, 12, 6, color, u)               # shoulders
    rect(d, 3, 11, 10, 1, PAPER, u)               # collar
    rect(d, 5, 4, 6, 8, (222, 188, 152), u)       # head
    rect(d, 4, 2, 8, 4, (52, 42, 38), u)          # hair
    rect(d, 4, 2, 2, 8, (52, 42, 38), u)
    rect(d, 6, 7, 1, 2, INK, u)                   # eyes
    rect(d, 9, 7, 1, 2, INK, u)
    rect(d, 7, 10, 2, 1, (176, 132, 108), u)      # mouth
    rect(d, 7, 13, 2, 2, GOLD, u)                 # badge
    return im


def build_portraits() -> None:
    out = os.path.join(ROOT, "mods/office-agents/art")
    os.makedirs(out, exist_ok=True)
    for role, color in ROLE_COLOR.items():
        bust(color).save(os.path.join(out, f"{role}.png"))


def building(place: str, scale: int = 256) -> Image.Image:
    """One 256x256 office block; the silhouette has to read at 72 px."""
    u = scale // 16
    im = blank(scale, scale)
    d = ImageDraw.Draw(im)
    body = {"hq": GOLD, "branch": TEAL, "studio": PLUM, "lab": STEEL}[place]

    # The fill stays mid-dark but a lit outline makes the silhouette read at 62 px
    # against the near-black sidebar.
    rect(d, 2, 4, 12, 12, (30, 41, 52), u)        # body
    d.rectangle([2 * u, 4 * u, 13 * u - 1, 15 * u - 1], outline=body, width=u)
    rect(d, 2, 4, 12, 1, body, u)                 # roof line
    for row in range(3):                          # window grid
        for col in range(4):
            lit = (row * 4 + col) % 3 != 1
            rect(d, 3 + col * 3, 6 + row * 3, 2, 2, GOLD if lit else (12, 18, 24), u)
    rect(d, 7, 13, 2, 3, (12, 18, 24), u)         # door

    if place == "hq":
        rect(d, 6, 0, 4, 4, (30, 41, 52), u)      # a tower on the roof
        d.rectangle([6 * u, 0, 9 * u - 1, 3 * u - 1], outline=body, width=u)
        rect(d, 7, 0, 2, 1, RED, u)
    elif place == "branch":
        rect(d, 3, 12, 10, 1, body, u)            # a shop awning
    elif place == "studio":
        rect(d, 10, 1, 3, 3, GLASS, u)            # a glass studio on top
    else:
        rect(d, 12, 2, 2, 2, GREEN, u)            # an antenna
    return im


def build_places() -> None:
    out = os.path.join(ROOT, "mods/office-spaces/art")
    os.makedirs(out, exist_ok=True)
    for place in ("hq", "branch", "studio", "lab"):
        building(place).save(os.path.join(out, f"{place}.png"))


def icon(kind: str, scale: int = 256) -> Image.Image:
    u = scale // 16
    im = blank(scale, scale)
    d = ImageDraw.Draw(im)
    if kind == "files":                            # a folder
        rect(d, 2, 5, 12, 9, GOLD, u)
        rect(d, 2, 3, 6, 3, GOLD, u)
        rect(d, 2, 5, 12, 1, PAPER, u)
    elif kind == "changes":                        # two sheets and an arrow
        rect(d, 3, 2, 8, 10, PAPER, u)
        rect(d, 5, 4, 8, 10, (196, 188, 172), u)
        rect(d, 7, 7, 4, 1, INK, u)
        rect(d, 7, 9, 4, 1, INK, u)
    else:                                          # inbox tray
        rect(d, 2, 8, 12, 6, STEEL, u)
        rect(d, 2, 8, 12, 1, PAPER, u)
        rect(d, 5, 10, 6, 2, INK, u)
    return im


def build_icons() -> None:
    out = os.path.join(ROOT, "mods/office-tabs/art")
    os.makedirs(out, exist_ok=True)
    for kind in ("files", "changes", "inbox"):
        icon(kind).save(os.path.join(out, f"{kind}.png"))


def build_sidebar() -> None:
    """A tall strip of office windows; the layout covers the sidebar with it.
    Kept very dark and low-contrast: text sits on top of it."""
    w, h = 460, 1844
    im = Image.new("RGB", (w, h), INK)
    d = ImageDraw.Draw(im)
    for y in range(0, h, 46):
        for x in range(0, w, 38):
            lit = ((x // 38) * 7 + (y // 46) * 3) % 7 == 0
            d.rectangle([x + 6, y + 8, x + 28, y + 32], fill=(24, 33, 42))
            if lit:
                # Dim amber, never bright: it must not fight the label text.
                d.rectangle([x + 9, y + 11, x + 25, y + 29], fill=(74, 58, 36))
    im.save(os.path.join(ROOT, "mods/office-chrome/sidebar.png"))


def build_floor() -> None:
    """A dark carpet-ish backdrop with faint floor lines, low contrast so the
    terminal text stays readable over it."""
    w, h = 1658, 1224
    im = Image.new("RGB", (w, h), (18, 26, 34))
    d = ImageDraw.Draw(im)
    for y in range(0, h, 64):
        d.line([0, y, w, y], fill=(23, 32, 41), width=2)
    for x in range(0, w, 96):
        d.line([x, 0, x, h], fill=(21, 30, 39), width=1)
    # Faint warm pools of desk lamps.
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for cx in range(180, w, 460):
        for cy in range(160, h, 400):
            gd.ellipse([cx - 150, cy - 110, cx + 150, cy + 110], fill=(30, 22, 12))
    im = Image.blend(im, Image.blend(im, glow, 0.5), 0.35)
    im.save(os.path.join(ROOT, "mods/office-chrome/floor.png"))


def build_layout_thumb() -> None:
    """A 640x468 stand-in for the layout picker thumbnail (layouts/office.png):
    the floor with a dark sidebar band and a hint of the gold frame."""
    floor = Image.open(os.path.join(ROOT, "mods/office-chrome/floor.png"))
    im = floor.resize((640, 468))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 122, 468], fill=(11, 18, 24))
    for y in range(24, 448, 76):                       # hint of staff cards
        d.rectangle([10, y, 112, y + 60], outline=(224, 164, 74, 255), width=1)
    d.rectangle([134, 12, 628, 428], outline=(224, 164, 74), width=1)
    d.rectangle([134, 12, 628, 40], fill=(22, 31, 40))
    im.save(os.path.join(ROOT, "layouts/office.png"))


def main() -> None:
    build_sprites()
    build_portraits()
    build_places()
    build_icons()
    build_sidebar()
    build_floor()
    build_layout_thumb()
    print("office placeholder art written")


if __name__ == "__main__":
    main()
