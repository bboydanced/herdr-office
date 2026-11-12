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
| `mods/office-agents/boss/<state>.gif` | 128x176 | the boss standing, `state` = `working` \| `blocked` \| `done` \| `idle`, transparent, looping, shown at 64x88 pt |
| `mods/office-agents/room/wall.png` | 600x88 | the office's back wall, shown 300x44 pt |
| `mods/office-agents/room/wall-wide.png` | 1800x88 | the Office panel's back wall, shown 900x44 pt and cut to the panel; its kanban board (x 104-200 pt) keeps three empty columns for the live counts |
| `mods/office-agents/room/floor.png` | 1824x1600 | dark carpet behind the rugs, shown 912x800 pt; the sidebar shows its left part |
| `mods/office-tabs/art/<kind>.png` | 256x256 | `files`, `changes`, `office`, transparent |
| `mods/office-chrome/wallpaper.png` | 1840x1844 | night windows behind the sidebar, the work column, the side panel and the terminals, `cover`-cropped |
| `layouts/office.png` | 640x468 | layout picker thumbnail (from `tools/build-preview.py`) |

Roles: `manager` (Claude Code), `developer`, `designer`, `analyst`, `writer`,
`tester`, `support`, `intern`.

## People: the style

Staff are drawn as **pastel chibi** characters, after a pastel voxel office:
big heads, eyes with a white shine, rosy cheeks, soft warm-brown outlines (no
black), blocky shading (lit top, darker right side). Desks, chairs and screens
keep the darker office look around them. The tab portrait is the desk's head,
laughing, over a wider body.

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

## Desks: one per role per state

Desks are seen from the front and slightly above: the worker, a pastel chibi,
behind the desk in a high-backed chair, facing you, the monitor on the left also
facing you so its screen shows the state, the role's things on the right. Keep
the canvas: 36x30 art pixels, drawn at 4x.

Common block:

```
Pixel art wooden office desk seen from the front, 36x30 logical pixels scaled up with hard square pixels, dark outlines, limited palette, modern office, a monitor on the left of the desk facing the viewer, a cute pastel chibi worker with a big head seated behind the desk in a dark high-backed office chair facing the viewer, soft warm-brown outlines on the worker, a keyboard in front of them, centered, plain solid pure green background (#00FF00), no text, no border, no floor, no scenery.
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

office: Pixel art game icon of one computer monitor on a small wooden desk, two lines of amber text on the screen, bold simple silhouette, large and centered, few details, visible square pixels, plain solid pure green background (#00FF00), no text, no border.
```

## The boss

```
Pixel art chibi office boss standing, full body, 32x44 logical pixels scaled up with hard square pixels, big head, short brown hair, navy suit with a white collar and a gold tie, soft warm-brown outlines, pastel palette, four looping states: talking and pointing with a clipboard in the other hand; one hand raised with a white speech bubble holding a red exclamation mark; a clear thumbs up with a small sparkle; arms crossed, blinking. Transparent background, no text, no border, no floor.
```

## Back wall

```
Wide strip pixel art, 150x22 logical pixels scaled up with hard square pixels, the back wall of a modern office at night: two windows onto a city skyline with lit windows and a moon, a round wall clock, a kanban board with colourful sticky notes, a wooden door under a green exit sign, a water cooler and a tall potted plant, dark slate-blue wall with a wainscot, no characters, no text, no border.
```

The panel's wall is the same strip at 450x22: more windows, bookshelves and
filing cabinets, and a bigger kanban board with three empty columns headed
blue, orange and green (no sticky notes: the office writes the counts there).

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
