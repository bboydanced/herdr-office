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
| `mods/office-agents/desks/<role>-<state>.gif` | 144x120 | `state` = `working` \| `blocked` \| `done` \| `idle`, transparent, looping, shown at 72x60 pt |
| `mods/office-agents/desks/empty.png` | 144x120 | a desk with nobody at it, screen off |
| `mods/office-agents/desks/shadow.png` | 144x120 | soft shadow drawn under every desk |
| `mods/office-agents/room/wall.png` | 600x88 | the office's back wall, shown 300x44 pt |
| `mods/office-agents/room/floor.png` | 600x1600 | wooden floor behind the rugs |
| `mods/office-tabs/art/<kind>.png` | 256x256 | `files`, `changes`, `inbox`, transparent |
| `mods/office-chrome/sidebar.png` | 460x1844 | wallpaper behind the sidebar, the work column and the side panel, `cover`-cropped |
| `mods/office-chrome/floor.png` | 1660x1224 | terminal background, dim wood |
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

Desks are seen from the front and slightly above: the worker behind the desk in
a high-backed chair, facing you, the monitor on the left also facing you so its
screen shows the state, the role's things on the right. Keep the canvas: 36x30
art pixels, drawn at 4x.

Common block:

```
Pixel art wooden office desk seen from the front, 36x30 logical pixels scaled up with hard square pixels, dark outlines, limited palette, modern office, a monitor on the left of the desk facing the viewer, the worker seated behind the desk in a dark high-backed office chair facing the viewer, a keyboard in front of them, centered, plain solid pure green background (#00FF00), no text, no border, no floor, no scenery.
```

Then one line per state:

```
working: hands on the keyboard, eyes on the screen, green screen with scrolling code, coffee steaming.
blocked: one arm raised high, mouth open, a speech bubble with a red exclamation mark, the screen flashing red.
done: stretching with hands behind the head, eyes closed and smiling, blue screen with a green check mark.
idle: head down on folded arms on the desk, dim screensaver on the screen, a small zZz above.
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
Seamless pixel art wallpaper, dark ink-blue vertical stripes with a tiny dot pattern, extremely dark and low contrast so white UI text stays readable on top, no characters, no text, no logo, no border.
```

## Wooden floor (office floor and terminal floor)

```
Seamless pixel art wooden floor seen from above, rows of warm oak planks of random length with staggered joints and faint grain, soft pools of ceiling light, no objects, no text, no border. For the terminal floor: the same, much darker and lower contrast.
```

## Tuning

- Too painterly: prepend `strictly pixel art, visible square pixels, no smooth shading`.
- Background not flat: add `flat single color background, no gradient, no shadow on background`.
- Inconsistent style across a set: use the best result as a reference image and
  generate the rest in the same conversation.
- Floor too bright: add `darker, night tones, muted highlights`.
