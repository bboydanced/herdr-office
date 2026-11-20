# Office art prompts

The desks, the boss, the sidebar's back wall and the boss's office are **drawn
live in blocks**, not pictures: `mods/office-agents/figure.js` (the people and
their desks; each role's look is a line of its `LOOKS` table) and `room.js` (the
walls); the logo by `mods/office-chrome/logo.js`. To check a change without Herdr:

    node tools/preview-figure.mjs | python3 tools/preview-figure.py /dev/stdin sheet.png       # every role, every state
    node tools/preview-figure.mjs --room | python3 tools/preview-figure.py /dev/stdin room.png  # the walls
    node tools/preview-figure.mjs --busts | python3 tools/preview-figure.py /dev/stdin         # writes the portraits

The portraits (`art/<role>.png`) are written from figure.js that way. The few
remaining bitmaps are **drawn by `tools/build-art.py`**: pixel art placed in
code on a small grid, no image model, no third-party assets, so
`herdr-app check` and the layout itself work out of the box.

To replace one of those files with generated art, keep its name and pixel size —
the mods reference them by name and draw them at half that size in points — and
use the prompts below. Green screen (`#00FF00`) backgrounds get cut out afterwards.

## Sizes

| File | Size | Notes |
|---|---|---|
| `mods/office-agents/art/<role>.png` | 88x88 | 8 role busts, transparent, shown at 44 pt |
| `mods/office-agents/room/floor-tiles.png` | 1824x1600 | quiet carpet tiles behind the rugs, shown 912x800 pt |
| `mods/office-tabs/art/<kind>.png` | 256x256 | `files`, `changes`, `office`, transparent |
| `mods/office-chrome/wallpaper.png` | 1840x1844 | night windows behind the sidebar, the work column, the side panel and the terminals, `cover`-cropped |
| `layouts/office.png` | 640x468 | layout picker thumbnail (from `tools/build-preview.py`) |

Roles: `manager` (Claude Code), `developer`, `designer`, `analyst`, `writer`,
`tester`, `support`, `intern`.

## People: the style

Staff are drawn as **pastel chibi** characters: big heads, eyes with a white
shine, rosy cheeks, outlined blocks, every edge on a whole pixel. The portrait
is the desk's head, smiling, over its shoulders.

## Portrait: common block

```
Cute pastel chibi character bust in the style of a voxel / pixel art office game, big head, large dark eyes with a white highlight, rosy cheeks, open happy smile, soft pastel colours, soft warm-brown outlines, blocky light-top dark-side shading, head and shoulders, facing the viewer, centered, plain solid pure green background (#00FF00), no text, no logo, no border, no scenery.
```

## Portraits: one per role

```
manager: neat brown hair with a side part, slate-blue suit, white collar, gold tie.
developer: messy dark-brown hair, mint over-ear headphones, peach and cream striped tee.
designer: long pastel-pink hair with a small yellow clip, lilac sweater, a gold necklace.
analyst: blonde ponytail with a pink scrunchie, light blue half-rim glasses, sky-blue button shirt.
writer: short silver-grey hair, light half-rim glasses, cream cardigan over a brown shirt.
tester: big curly brown afro, warm brown skin, pastel mustard tee with a tiny bug print.
support: long auburn hair, a grey headset with a short mic, coral polo.
intern: brown hair under a light blue cap, freckles, yellow polo.
```

## Tab icons

```
files: Pixel art game icon of one manila document folder with a few sheets sticking out, bold simple silhouette, large and centered, few details, visible square pixels, plain solid pure green background (#00FF00), no text, no border.

changes: Pixel art game icon of two overlapping sheets of paper with a small curved arrow between them, bold simple silhouette, large and centered, few details, visible square pixels, plain solid pure green background (#00FF00), no text, no border.

office: Pixel art game icon of one computer monitor on a small wooden desk, two lines of amber text on the screen, bold simple silhouette, large and centered, few details, visible square pixels, plain solid pure green background (#00FF00), no text, no border.
```

## Wallpaper

```
Seamless pixel art night view of an office building facade, a regular grid of dark windows with thin mullions, about one in seven lit by a warm desk lamp and a few by a cool screen, extremely dark and low contrast so white UI text stays readable on top, no characters, no text, no logo, no border. Square.
```

## Office carpet

```
Seamless pixel art office carpet tiles seen from above, alternating pile direction per tile, dark blue-grey, very low contrast, no light pools, no objects, no text, no border.
```

## Tuning

- Too painterly: prepend `strictly pixel art, visible square pixels, no smooth shading`.
- Background not flat: add `flat single color background, no gradient, no shadow on background`.
- Inconsistent style across a set: use the best result as a reference image and
  generate the rest in the same conversation.
- Floor too bright: add `darker, night tones, muted highlights`.
