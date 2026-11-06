#!/usr/bin/env python3
"""Compose a mock office window from the real mod art, so the layout can be
reviewed without Herdr. Not part of the mods - nothing reads this file.

    python3 tools/build-preview.py     # writes preview.png

The mock follows layouts/office.json: 268 px sidebar (46 header, spaces,
agents, 69 footer), 58 px tab bar, 8 px padding, 1 px amber frames, and the
same type sizes the mods ask for.
"""

from __future__ import annotations

import json
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1280, 800
SIDEBAR = 268
TABS = 58
PAD = 8

THEME = json.load(open(os.path.join(ROOT, "themes/office-night.json")))
C = THEME["colors"]


def hexa(key: str, alpha: int = 255) -> tuple[int, int, int, int]:
    v = key if key.startswith("#") else (
        THEME["ansi"][int(key[4:]) - 1] if key.startswith("ansi") and key[4:].isdigit() else C[key]
    )
    v = v.lstrip("#")
    return (int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16), alpha)


def font(size: int, bold: bool = False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else ""),
        "/usr/share/fonts/truetype/liberation/LiberationSans%s.ttf" % ("-Bold" if bold else ""),
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def art(rel: str, size: int) -> Image.Image:
    im = Image.open(os.path.join(ROOT, rel)).convert("RGBA")
    return im.resize((size, size), Image.NEAREST)


def frame(d, box, color, width=1):
    d.rectangle(box, outline=color, width=width)


def main() -> None:
    im = Image.new("RGB", (W, H), hexa("canvas")[:3])
    # Terminal area: the floor, cover-cropped into the pane.
    floor = Image.open(os.path.join(ROOT, "mods/office-chrome/floor.png")).convert("RGB")
    pane_box = (SIDEBAR + PAD, TABS + PAD, W - PAD, H - 28 - PAD)
    pw, ph = pane_box[2] - pane_box[0], pane_box[3] - pane_box[1]
    scale = max(pw / floor.width, ph / floor.height)
    crop = floor.resize((int(floor.width * scale) + 1, int(floor.height * scale) + 1))
    crop = crop.crop((0, 0, pw, ph))
    im.paste(crop, (pane_box[0], pane_box[1]))

    d = ImageDraw.Draw(im, "RGBA")
    frame(d, pane_box, hexa("accent", 0x99))
    d.rectangle(pane_box, outline=hexa("accent", 0x99), width=1)

    # Pane header with a fake tab title.
    d.rectangle([pane_box[0], pane_box[1], pane_box[2], pane_box[1] + 30], fill=hexa("chrome", 0xC8))
    d.text((pane_box[0] + 12, pane_box[1] + 7), "main — claude · office", font=font(13), fill=hexa("muted"))
    d.line([pane_box[0], pane_box[1] + 30, pane_box[2], pane_box[1] + 30], fill=hexa("border", 0x66))

    # Terminal text over the floor, at the layout's terminal_opacity.
    lines = [
        ("accent", "$ herdr-app do layout.switch '{\"name\":\"office\"}'"),
        ("foreground", "switched to office (office-night)"),
        ("dim", ""),
        ("working", "● 3 agents working · 1 needs you"),
        ("foreground", "working  manager   Opus 5.5 · high   HP 72%  SP 88%"),
        ("foreground", "working  designer  Sonnet 5.5 · med   HP 61%  SP 88%"),
        ("blocked", "needs you  developer                HP 34%  SP 88%"),
        ("foreground", "done     tester                   HP —    SP —"),
    ]
    y = pane_box[1] + 46
    for key, text in lines:
        if text:
            d.text((pane_box[0] + 14, y), text, font=font(14, bold=text.startswith("●")), fill=hexa(key))
        y += 22

    # Sidebar.
    sb = Image.new("RGBA", (SIDEBAR, H), hexa("canvas"))
    strip = art("mods/office-chrome/sidebar.png", 1)
    strip = Image.open(os.path.join(ROOT, "mods/office-chrome/sidebar.png")).convert("RGB")
    scale = max(SIDEBAR / strip.width, H / strip.height)
    strip = strip.resize((int(strip.width * scale), int(strip.height * scale))).crop((0, 0, SIDEBAR, H))
    sb.paste(strip, (0, 0))
    sd = ImageDraw.Draw(sb, "RGBA")
    sd.rectangle([0, 0, SIDEBAR, 46], fill=hexa("chrome", 0xC8))
    sd.text((16, 15), "Herdr", font=font(14, bold=True), fill=hexa("foreground"))
    sd.text((SIDEBAR - 62, 16), "search", font=font(11), fill=hexa("muted"))

    # Spaces: three rows with a building, name and one git line.
    sf = font(11)
    y = 60
    sd.text((16, y), "Spaces", font=sf, fill=hexa("dim"))
    y += 20
    spaces = [
        ("web-app", "hq", [("ansi3", "2 uncommitted files")], True),
        ("api", "branch", [("ansi3", "4 uncommitted files"), ("ansi2", "1 unpushed commit")], False),
        ("notes", "lab", [], False),
    ]
    for name, place, gitlines, active in spaces:
        row = [8, y, SIDEBAR - 8, y + 76]
        if active:
            sd.rectangle(row, fill=hexa("surface", 0xC8), outline=hexa("accent"), width=1)
        sd._image.paste(art(f"mods/office-spaces/art/{place}.png", 62), (row[0] + 6, y + 7),
                        art(f"mods/office-spaces/art/{place}.png", 62))
        sd.text((row[0] + 76, y + 12), name, font=font(13), fill=hexa("foreground"))
        ty = y + 32
        for color, line in gitlines:
            sd.text((row[0] + 76, ty), line, font=sf, fill=hexa(color))
            ty += 15
        y += 78

    # Agents: three cards with sprite, name, status, tag and bars.
    y += 6
    sd.text((16, y), "Agents", font=sf, fill=hexa("dim"))
    y += 18
    cards = [
        ("manager", "Claude", "Opus 5.5 · high", "working", 72, 88, True),
        ("designer", "Claude", "Sonnet 5.5 · medium", "working", 61, 88, False),
        ("developer", "Codex", "gpt-5.5 · high", "blocked", 34, 88, False),
    ]
    for role, app, model, status, hp, sp, focused in cards:
        kind = status if status in ("working", "blocked") else "rest"
        sprite = Image.open(os.path.join(ROOT, f"mods/office-agents/sprites/{role}-{kind}.gif")).convert("RGBA")
        card_h = 116
        box = [8, y, SIDEBAR - 8, y + card_h]
        border = C["blocked"] if status == "blocked" else (C["accent"] if focused else C["border"])
        sd.rectangle(box, fill=hexa("surface", 0xC8), outline=hexa(border) if border.startswith("#") else hexa("border"), width=1)
        spr = sprite.resize((72, 96), Image.NEAREST)
        sd._image.paste(spr, (box[0] + 8, y + 10), spr)
        tx = box[0] + 92
        sd.text((tx, y + 10), role.capitalize(), font=font(13, bold=True), fill=hexa("foreground"))
        sd.text((SIDEBAR - 82, y + 11), {"working": "Working", "blocked": "Needs you"}[status],
                font=font(10), fill=hexa(status))
        sd.text((tx, y + 28), app, font=font(9), fill=hexa("unknown" if app != "Claude" else "accent"))
        sd.text((tx + 42, y + 28), model, font=font(10), fill=hexa("dim"))
        for label, val, color in (("HP", hp, "accent"), ("SP", sp, "solid")):
            by = y + 46 + (0 if label == "HP" else 18)
            sd.text((tx, by), label, font=font(10), fill=hexa("dim"))
            sd.rectangle([tx + 22, by + 3, tx + 132, by + 9], fill=hexa("raised"))
            sd.rectangle([tx + 22, by + 3, tx + 22 + int(110 * val / 100), by + 9], fill=hexa(color))
            sd.text((tx + 138, by - 1), f"{val}%", font=font(10), fill=hexa("foreground"))
        y += card_h + 8

    sd.rectangle([0, H - 69, SIDEBAR, H], fill=hexa("chrome", 0xC8))
    sd.line([0, H - 69, SIDEBAR, H - 69], fill=hexa("border", 0x66))
    sd.text((16, H - 60), "Settings", font=font(13), fill=hexa("muted"))
    sd.text((16, H - 34), "Add machine", font=font(13), fill=hexa("dim"))
    im.paste(sb.convert("RGB"), (0, 0))

    # Tab bar.
    td = ImageDraw.Draw(im, "RGBA")
    td.rectangle([0, 0, W, TABS], fill=hexa("chrome"))
    td.line([0, TABS, W, TABS], fill=hexa("border", 0x66))
    x = SIDEBAR + 10
    tabs = [("manager", "manager", True), ("designer", "designer", False), ("developer", "developer", False)]
    for role, name, active in tabs:
        tw = 168
        box = [x, 5, x + tw, TABS - 5]
        td.rectangle(box, fill=hexa("raised" if active else "chrome"),
                     outline=hexa("border" if active else "chrome"), width=1)
        p = art(f"mods/office-agents/art/{role}.png", 44)
        im.paste(p, (x + 6, 7), p)
        td.text((x + 58, 22), name, font=font(13), fill=hexa("foreground" if active else "muted"))
        if not active:
            td.ellipse([x + tw - 16, 26, x + tw - 10, 32], fill=hexa("working"))
        x += tw + 3
    td.text((x + 8, 20), "+", font=font(16), fill=hexa("dim"))
    bx = W - 300
    for i, (kind, label) in enumerate((("files", "Files"), ("changes", "Changes"), ("inbox", "Inbox"))):
        px = bx + i * 98
        icon = art(f"mods/office-tabs/art/{kind}.png", 20)
        im.paste(icon, (px, 19), icon)
        td.text((px + 26, 22), label, font=font(12), fill=hexa("muted"))

    # Status bar.
    td.rectangle([SIDEBAR, H - 28, W, H], fill=hexa("chrome"))
    td.text((SIDEBAR + 14, H - 22), "office · 3 spaces · 3 agents", font=font(11), fill=hexa("dim"))

    im.save(os.path.join(ROOT, "preview.png"))
    print("wrote preview.png")


if __name__ == "__main__":
    main()
