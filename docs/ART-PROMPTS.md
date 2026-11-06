# Office art prompts

Art for this layout is **drawn by `tools/build-art.py`**: pixel art placed in
code on a small grid, outlined and scaled 4x, no image model, no third-party
assets, so `herdr-app check` and the layout itself work out of the box.

To replace a file with generated art, keep its name and pixel size — the mods
reference them by name and draw them at half that size in points — and use the
prompts below. Green screen (`#00FF00`) backgrounds get cut out afterwards.

## Sizes

| File | Size | Notes |
|---|---|---|
| `mods/office-agents/art/<role>.png` | 88x88 | 8 role busts, transparent, shown at 44 pt |
| `mods/office-agents/desks/<role>-<state>.gif` | 120x112 | `state` = `working` \| `blocked` \| `done` \| `idle`, transparent, looping, shown at 60x56 pt |
| `mods/office-agents/desks/empty.png` | 120x112 | a desk with nobody at it, screen off |
| `mods/office-agents/desks/shadow.png` | 120x112 | soft shadow drawn under every desk |
| `mods/office-agents/room/wall.png` | 600x88 | the office's back wall, shown 300x44 pt |
| `mods/office-agents/room/floor.png` | 600x1600 | carpet behind the rugs, low contrast |
| `mods/office-tabs/art/<kind>.png` | 256x256 | `files`, `changes`, `inbox`, transparent |
| `mods/office-chrome/sidebar.png` | 460x1844 | full-height sidebar, `cover`-cropped |
| `mods/office-chrome/floor.png` | 1660x1224 | terminal background, low contrast |
| `layouts/office.png` | 640x468 | layout picker thumbnail (from `tools/build-preview.py`) |

Roles: `manager` (Claude Code), `developer`, `designer`, `analyst`, `writer`,
`tester`, `support`, `intern`.

## Portrait: common block

```
Pixel art character bust portrait, high resolution detailed 32-bit sprite style, hand-placed pixels, limited rich palette, soft cool light from upper left, warm amber highlights and deep ink-blue shadows, head and shoulders visible, three-quarter view facing right, centered, plain solid pure green background (#00FF00), no text, no logo, no border, no frame, no scenery. Modern office workplace, late evening.
```

## Portraits: one per role

```
manager: neat short brown hair with a side part, charcoal suit, white shirt, gold tie, calm confident expression.
developer: messy dark hair, red over-ear headphones, teal hoodie with white drawstrings, focused half-smile.
designer: long pink hair with a small gold clip, plum sweater, a gold necklace, bright curious eyes.
analyst: blonde hair in a ponytail with a red scrunchie, round dark glasses, steel-blue button shirt.
writer: short silver-grey hair, round dark glasses, cream cardigan over a brown shirt, thoughtful look.
tester: big curly dark-brown afro, mustard t-shirt with a tiny bug print, one eyebrow arched.
support: long dark auburn hair, a grey headset with a mic in front of the mouth, coral polo, warm smile.
intern: ginger hair under a backwards red cap, freckles, green t-shirt, a lanyard with a white badge, eager expression.
```

## Desks: one per role per state

Desks are seen from slightly above, the worker from behind in an office chair,
the monitor facing you so its screen shows the state. Keep the canvas: 30x28 art
pixels, drawn at 4x.

Common block:

```
Pixel art office desk seen from slightly above and behind the worker, 30x28 logical pixels scaled up with hard square pixels, dark outlines, limited palette, modern office at night, a warm desk lamp on the left, a monitor facing the viewer, the worker seated in a dark office chair with their back to the viewer, centered, plain solid pure green background (#00FF00), no text, no border, no floor, no scenery.
```

Then one line per state:

```
working: hands on the keyboard, green screen with scrolling code, coffee steaming.
blocked: one arm raised high, the screen flashing red with a white exclamation mark.
done: leaning back with hands behind the head, blue screen with a green check mark.
idle: head down on folded arms, dim screensaver on the screen, a small zZz above.
```

## Tab icons

```
files: Pixel art game icon of one manila document folder with a few sheets sticking out, bold simple silhouette, large and centered, few details, visible square pixels, plain solid pure green background (#00FF00), no text, no border.

changes: Pixel art game icon of two overlapping sheets of paper with a small curved arrow between them, bold simple silhouette, large and centered, few details, visible square pixels, plain solid pure green background (#00FF00), no text, no border.

inbox: Pixel art game icon of one shallow metal inbox tray seen from the front, a single sheet inside, bold simple silhouette, large and centered, few details, visible square pixels, plain solid pure green background (#00FF00), no text, no border.
```

## Back wall

```
Wide strip pixel art, 150x22 logical pixels scaled up with hard square pixels, the back wall of a modern office at night: two windows onto a city skyline with lit windows and a moon, a round wall clock, a kanban board with colourful sticky notes, a wooden door under a green exit sign, a water cooler and a tall potted plant, dark slate-blue wall with a wainscot, no characters, no text, no border.
```

## Sidebar strip

```
Tall narrow vertical illustration, pixel art, a dark ink-blue office wall at night with faint vertical panels, extremely dark and low contrast so white UI text stays readable on top, no characters, no text, no logo, no border. Aspect ratio about 1:4.
```

## Carpet (office floor and terminal floor)

```
Seamless pixel art office carpet tiles seen from above, alternating pile direction per tile, dark blue-grey, very low contrast, no light pools, no objects, no text, no border.
```

## Tuning

- Too painterly: prepend `strictly pixel art, visible square pixels, no smooth shading`.
- Background not flat: add `flat single color background, no gradient, no shadow on background`.
- Inconsistent style across a set: use the best result as a reference image and
  generate the rest in the same conversation.
- Floor too bright: add `darker, night tones, muted highlights`.
