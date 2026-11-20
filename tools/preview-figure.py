#!/usr/bin/env python3
"""Paint the blocks recorded by preview-figure.mjs: every role in every state,
2x, on the office floor colour (loops shown at their start), or, given the
--busts JSON, the portraits into mods/office-agents/art/, or, given the --room
JSON, the sidebar's wall and the boss's office."""

import json
import sys

from PIL import Image, ImageDraw, ImageFont

K = 1  # device pixels per point: 1, as on a 1x screen (the sheet is enlarged after)
ZOOM = 3


def rgba(c):
    c = c.lstrip("#")
    if len(c) == 6:
        c += "ff"
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4, 6))


def num(v):
    return float(v[0] if isinstance(v, list) else v) if v is not None else None


def shape(d, x0, y0, x1, y1, rt, rb, fill):
    """A box with its own top and bottom corner radii (Pillow 9.0 has no per-corner)."""
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return
    rt, rb = max(0, min(rt, w / 2, h / 2)), max(0, min(rb, w / 2, h / 2))
    if rt >= rb:
        d.rounded_rectangle([x0, y0, x1 - 1, y1 - 1], radius=rt, fill=fill)
        if rb < rt:
            d.rounded_rectangle([x0, y0 + rt, x1 - 1, y1 - 1], radius=rb, fill=fill)
    else:
        d.rounded_rectangle([x0, y0, x1 - 1, y1 - 1], radius=rb, fill=fill)
        d.rounded_rectangle([x0, y0, x1 - 1, y1 - 1 - rb], radius=rt, fill=fill)


def paint(img, n, ox, oy, pw, ph):
    s = n["s"]
    x = ox + (num(s.get("left")) or 0)
    y = oy + (num(s.get("top")) or 0)
    for lp in n["loops"]:
        if lp["prop"] == "top":
            y = oy + lp["from"]
        if lp["prop"] == "left":
            x = ox + lp["from"]
    w = pw if s.get("w_full") is not None else num(s.get("w"))
    h = ph if s.get("h_full") is not None else num(s.get("h"))
    alpha = 1.0
    for lp in n["loops"]:
        if lp["prop"] == "opacity":
            alpha = max(lp["from"], lp["to"]) * 0.85
    if w and h and (s.get("bg") or s.get("border")):
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        base = num(s.get("rounded")) or 0
        rt = num(s.get("rounded_t")) if s.get("rounded_t") is not None else base
        rb = num(s.get("rounded_b")) if s.get("rounded_b") is not None else base
        x0, y0, x1, y1 = x * K, y * K, (x + w) * K, (y + h) * K
        bw = (num(s.get("border")) or 0) * K
        if bw and s.get("border_color"):
            shape(d, x0, y0, x1, y1, rt * K, rb * K, rgba(s["border_color"]))
            x0, y0, x1, y1 = x0 + bw, y0 + bw, x1 - bw, y1 - bw
            rt, rb = max(0, rt - bw / K), max(0, rb - bw / K)
        if s.get("bg"):
            c = rgba(s["bg"])
            if bw and c[3] == 0:
                # an outlined ring: punch the inside out
                inner = Image.new("L", img.size, 0)
                shape(ImageDraw.Draw(inner), x0, y0, x1, y1, rt * K, rb * K, 255)
                layer.putalpha(Image.composite(Image.new("L", img.size, 0), layer.getchannel("A"), inner))
            else:
                shape(d, x0, y0, x1, y1, rt * K, rb * K, c[:3] + (int(c[3] * alpha),))
        img.alpha_composite(layer)
    if n.get("text"):
        d = ImageDraw.Draw(img)
        size = int((num(s.get("text_size")) or 10) * K)
        try:
            font = ImageFont.truetype("DejaVuSans-Bold.ttf", size)
        except OSError:
            font = ImageFont.load_default()
        d.text((x * K, y * K), n["text"], fill=rgba(s.get("text_color", "#ffffff")), font=font)
    for kid in n["kids"]:
        paint(img, kid, x, y, w or pw, h or ph)


def main():
    data = json.load(open(sys.argv[1]))
    if "busts" in data:
        import os
        out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mods/office-agents/art")
        n = data["size"]
        for it in data["busts"]:
            img = Image.new("RGBA", (n * K, n * K), (0, 0, 0, 0))
            paint(img, it["node"], 0, 0, n, n)
            img.save(os.path.join(out, f'{it["job"]}.png'))
        print("portraits written:", ", ".join(it["job"] for it in data["busts"]))
        return
    if "rooms" in data:
        W = max(it["w"] for it in data["rooms"]) + 24
        img = Image.new("RGBA", (W, sum(it["h"] + 30 for it in data["rooms"]) + 12), (24, 26, 40, 255))
        d, y = ImageDraw.Draw(img), 18
        for it in data["rooms"]:
            d.text((12, y - 14), it["name"], fill=(200, 205, 225, 255))
            paint(img, it["node"], 12, y, it["w"], it["h"])
            y += it["h"] + 30
        img.resize((img.width * 2, img.height * 2), Image.NEAREST).save(sys.argv[2])
        return
    W, H = data["W"], data["H"]
    cols, rows = data["cols"], data["rows"]
    img = Image.new("RGBA", ((cols * (W + 24) + 12) * K, (rows * (H + 30) + 24) * K), (36, 39, 56, 255))
    d = ImageDraw.Draw(img)
    for it in data["sheet"]:
        d.text((it["x"] * K, (it["y"] - 14) * K), f'{it["job"]} {it["state"]}', fill=(200, 205, 225, 255))
        paint(img, it["node"], it["x"], it["y"], W, H)
    img.resize((img.width * ZOOM, img.height * ZOOM), Image.NEAREST).save(sys.argv[2])


if __name__ == "__main__":
    main()
