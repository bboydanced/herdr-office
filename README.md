# Office

An office-toned Herdr layout. Every space is a project, every agent a member of
staff at their own desk in one shared office: you see who is typing, who needs
you and who dozed off, and one click takes you to their terminal.

![Office](preview.png)

Derived from [herdr-traveler](https://github.com/franky5440-afk/herdr-traveler)
(Apache 2.0, Copyright 2026 Frank Lin): same node tree and same mod structure,
rethemed from a pixel RPG to a modern office and renamed throughout. See
`NOTICE`.

## Install

```sh
H=~/.config/herdr-app
cp layouts/office.* "$H/layouts/"
cp themes/office-night.json "$H/themes/"
cp -R mods/* "$H/mods/"
herdr-app do layout.switch '{"name":"office"}'
```

The Changes panel is [Git Changes](https://github.com/aBER0724/herdr-git-changes)
(MIT), not the one Herdr ships, so install that mod too:

```sh
git clone https://github.com/aBER0724/herdr-git-changes
cp -R herdr-git-changes/mods/git-changes "$H/mods/"
```

`herdr-app check` must pass for every mod before you switch. Never overwrite your
own files — rename first if you already have a mod or theme called `office-*`.

Updating overwrites `mods/office-agents/jobs.json` and `replies.json`. Back
them up first and put them back, or update without them:

```sh
H=~/.config/herdr-app
rsync -a --exclude jobs.json --exclude replies.json mods/ "$H/mods/"
```

Earlier versions shipped `mods/office-agents/sprites/`, `mods/office-spaces/art/`,
`mods/office-spaces/places.json`, `mods/office-chrome/sidebar.png` and
`mods/office-chrome/floor.png`; nothing reads them any more, so delete them from
`$H/mods` after updating, and copy `layouts/office.json` again. The Office panel
also needs the current `layouts/office.json`.

Uninstall:

```sh
H=~/.config/herdr-app
herdr-app do layout.switch '{"name":"main"}'
rm -rf "$H"/mods/office-agents "$H"/mods/office-chrome "$H"/mods/office-spaces \
       "$H"/mods/office-tabs "$H"/mods/office-inbox "$H"/mods/office-add
rm -rf "$H"/data/office-agents "$H"/data/office-chrome "$H"/data/office-spaces \
       "$H"/data/office-tabs "$H"/data/office "$H"/data/office-inbox "$H"/data/office-add
rm -f "$H"/layouts/office.json "$H"/layouts/office.png "$H"/themes/office-night.json
```

This deletes everything in the inbox folder; move anything you want to keep
first. Herdr keeps the mod names in its own `seen.json`, which is harmless.

## What you see

- **Theme `office-night`:** ink blue background `#101820`, panel `#1b252f`,
  amber accent `#e0a44a`, paper text `#e6dfd2`, muted steel `#5f8fa8`. Square
  corners with thin amber frames.
- **One backdrop everywhere:** night office windows, a few lit by a lamp or a
  screen, `mods/office-chrome/wallpaper.png` (`cover`). It is the `background`
  of the sidebar, the work column (behind the translucent tab bar and between
  the panes), the side panel and every pane, where the terminal draws over it at
  the root `terminal_opacity` of `0.62`.
- **Sidebar, 300 px**, two parts (weights 0.62 and 1.38):
  - **Spaces, the room directory:** a 44 px row per space. Its door in the
    space's colour with the room number (`01`, `02`… in Spaces order) on the
    plate, a lamp over it (off; breathing while an agent works; blinking while
    one waits for you) and a window lit while any agent is in. Then the name,
    the branch when unusual, and one line: git as sticky notes (`3 changed`
    yellow, `↑2 unpushed` green, `no remote` red) and the faces of the staff in
    the room, framed in their status colour, the same faces as at their desks
    (five, then `+n`; click them to open the Office panel). The room you are in
    has its lights on, a warm tint with the amber bar.
    A space where an agent works **breathes**: a steady frame in the working
    colour over a glow that fades in and out. A space where an agent waits for
    you **blinks** a thick orange frame over a red tint, with a `!` by its name.
    Waiting wins over working. Hover a room and its rug lights up in the
    office; hover a rug and its room lights up.
  - **Office:** a header (`N need you`, `N/M at work`, the time), the back wall
    (night windows, clock, kanban board, door, water cooler, plant), then the
    dark carpet. Each **space is a rug** tinted in its door's colour, in the
    Spaces order. On it each **tab is a cubicle** with its name (amber for the
    tab you are on). In it each **pane is a desk, placed the way the tab is
    split**: panes split right sit side by side, panes split down sit one above
    the other, so a tab split right and then down on the right shows one desk
    on the left and two stacked on the right. A pane with an agent has
    its staff member (a pastel chibi) behind the desk facing you, the monitor beside them showing
    the state; any other pane is an empty desk with the screen off, labelled
    `Terminal` for a shell (never the long `user@host:path` title) or its
    program's name. A sub-agent without a pane of its own takes an extra desk at
    the end of its tab. Put-away tabs stay out unless someone in them needs you.
- **Tabs, 58 px:** square 48 px tabs showing **every agent in the tab**: one
  agent as a 44 px portrait, several as overlapping faces framed in their status
  colour (four at most, then `+n`), then a terminal mark with the count of the
  tab's other panes. Faces match the desks in the office. Files, Changes,
  Inbox and Office buttons open the right panel.

Herdr's mod API gives a tab's panes in order but not where a split put them.
The office reads that from Herdr's own layout document, which herdr-core keeps
in `~/.local/state/herdr-core/default/docs.json` (on a remote machine, the same
path in its home): read only, again whenever a tab's panes change. It looks for
the part of the document that names the tab's panes and follows its splits down
by their direction words (`right`/`row`/`horizontal`, `down`/`column`/
`vertical`). When it can't tell (another `HC_SESSION` or `XDG_STATE_HOME`, a
document it doesn't understand, or a split more than three desks wide), the
desks fall back to pane order: up to three in a row, four as two by two.

### At the desk

| Status | Screen | Staff |
|---|---|---|
| `working` | green, code scrolling fast, LED green | typing fast (a key every 90 ms), eyes on the screen, coffee steaming; the desk breathes: a bright frame, a glow and a wider ring fading in and out |
| `blocked` | red, blinking `!` | one hand up, mouth open, a `!` bubble; a thick orange frame blinks over a red tint, a `!` badge bobs on the corner, the label turns into a red `NEEDS YOU` tag |
| `done` | blue with a check mark | stretching, hands behind the head, smiling |
| `idle` | screensaver | head down on folded arms, `zZz` |

Every desk is lit by its screen, and each role keeps its own things on it (a
plant, a rubber duck, a phone, a chart, a stack of books...). A rug shows its
space the same way (breathing or blinking) with `● N working` or
`! N need you` in its corner. The pulses are native `loop`s on `opacity`/`top`:
they run without re-rendering the mod. Click a staffed desk for
`agent.focus` (its terminal, in its space and tab); click an empty one to go to
that pane. Hover for who, what and where. Right-click a desk, a cubicle or a
rug for Herdr's own pane, tab or space menu; middle-click a desk to peek at its
terminal without leaving your tab. `agent.next` / `agent.prev` walk the
desks in the order they are drawn. Narrowed below 160 px, the office becomes a
column of faces framed in their status colour.

### The Office panel

The **Office** button opens the whole office in the right panel, wider: the
same rugs, cubicles and split-placed desks as the sidebar, with as many desks
across as the panel fits. It opens at 640 px; drag its edge up to 900. The
Office panel and the other panels each remember their own width. Top to
bottom:

1. **The header:** filters with their counts (`All`, `Working`, `Needs you`,
   `Done`, remembered), `−` / `+` for desk size (sidebar size, or half as big
   again once the panel is 480 px wide) and the time.
2. **The boss**, standing in front of the back wall (see below).
3. **Needs you**, while an agent waits for you (see below).
4. **The floor:** rugs, cubicles and desks. Under each desk a second line: the
   status and for how long (`Working · 12m`, `NEEDS YOU · 3m`, `✓ Done · 5m`;
   the tab's time, so agents sharing a tab share it), or an empty desk's
   folder.
   - **Adding:** `+ Tab` on a rug opens a new tab in that space, `Add desk`
     (the faded desk at the end of a cubicle) splits the tab beside its last
     pane, right or down, and `+ New space` at the end of the floor makes a
     space. Tab and desk ask what to start: a terminal, or one of the agents
     installed where the space lives (Herdr's `knownAgents`, most picked
     first). A desk with an agent starts in its neighbour's folder.
   - **Put away:** tabs put away (`tab.settle`) are listed at the end of the
     floor; click one to bring it back.
5. **The inspector:** **click a desk** to pick that staff member (a
   double-click goes to their terminal, as a click does in the sidebar). It
   shows:
   - who and where: role and program, space › tab, folder, branch, status and
     for how long, the task in their title;
   - **their screen**, the last lines as `hc read` prints them, read again
     every 2 s while they work and the panel shows the office (on any change
     otherwise); shown only, never stored;
   - a **message box**: Enter or `Send ⏎` pastes it into their terminal and
     presses Enter (`hc send`). Quick replies above it fill the box (they never
     send on their own) and come from `mods/office-agents/replies.json`, a
     list of up to eight strings;
   - `Go to desk`, `Peek` (look over the tab without leaving it) and `Stop`
     (`hc interrupt`: Esc for an agent, Ctrl+C for anything else).

   An agent waiting for an answer refuses messages: answer it in Needs you.
   `▾` folds the inspector away.

Only the sidebar's office sets the `agent.next` / `agent.prev` order.

#### The boss

The boss is a team lead you give goals to; it hires agents to do the work.
Each space has its own, in a tab named `Boss`; the panel shows one, for the
room picked by the chips beside it (the space you are in, until you pick
another; `●` marks rooms that have one).

- **The first goal** for a room hires the boss: `Hire ⏎` opens a `Boss` tab in
  that space running the agent you picked (the chips list the agents installed
  there) with a brief and your goal as its first message. The brief tells it
  not to write the code itself, to split the goal into independent pieces,
  to hire one agent per piece with `hc run --bg --name <role>-<topic>` (at most
  four at a time unless you ask for more), to follow them with `hc ls`, `hc
  read`, `hc wait --children any` and `hc send`, to review their changes and
  report back, and to ask you before anything destructive.
- **Later goals** go to the boss you already have (`Tell ⏎`, `hc send`).
- **Its hires** are its children in herdr-core: they get a desk in its
  cubicle at once, with a role from their name (`tester-e2e` is a tester,
  `frontend-nav` a developer), the same face everywhere. While you look at
  the boss's tab, they get panes beside it one by one (right, then down; four
  panes at most), and your focus goes back where it was; elsewhere they work
  at their desks.
- The boss shows its status (talking with a clipboard, a hand up, a thumbs up,
  arms crossed), its speech bubble its latest line and the size of its team.
  Click it for the inspector; double-click for its terminal.
- Closing the `Boss` tab ends its hires too (herdr-core ends children with
  their parent).

Every hire is a full agent session, with its own cost. The boss runs `hc`
through its shell, so its agent asks you before each command unless you allow
`hc` there (Claude Code: `Bash(hc:*)` in its permissions); those questions show
up in Needs you.

#### Needs you

While an agent waits for you, the card above the floor shows who and where,
how long it has waited, **its question as its screen shows it**, and its
numbered choices (`1  Yes`, `2  Yes, and don't ask again…`, `3  No…`); without
numbered choices, `Enter` and `Esc`. A click presses that key in its terminal
(`hc keys`); nothing is ever answered for you. `n/m ›` goes to the next one
waiting, `Details` picks it in the inspector, `Open ↗` goes to its terminal.

## Customize

- **Who is who:** `mods/office-agents/jobs.json` maps a tab name to a role.
  Roles: `manager`, `developer`, `designer`, `analyst`, `writer`, `tester`,
  `support`, `intern`. A tab's first agent wears the tab's role and the other
  agents in that tab get roles of their own, so faces repeat only past eight.
  The tab bar and the office work this out the same way (`tabDesks`,
  `deskJobs`); Spaces shows the faces the office shares (`office.faces`). Copy the file to every machine to get the same faces everywhere.
- **Project colours** come from the Spaces list (`space.colors`), so the door
  and the rug of a space always match.
- **Art:** drawn by `tools/build-art.py`; `tools/build-preview.py` composes the
  mock `preview.png` and the picker thumbnail from it. Prompts for model-made
  replacements are in `docs/ART-PROMPTS.md`.
- **Sounds:** none included. Put MP3s in `~/.config/herdr-app/sounds/` and add
  `"sounds": { "enabled": true, "done": "sounds/done.mp3", "blocked": "sounds/blocked.mp3" }`
  to `settings.json`.

## What it does on your machine

- `office-spaces` runs `git status`, `git rev-parse` and `hc machine ls` itself,
  in every folder that has a terminal. On connected remote machines Herdr runs
  that `git` there.
- `office-agents` reads its own `jobs.json` and `replies.json` and herdr-core's
  `docs.json` (for the splits; it writes nothing and shows nothing else from
  it). In the Office panel it runs `hc read` on the staff member you picked,
  the agents waiting for you and the boss (only while the panel shows the
  office), `hc send` when you send a message or a goal, `hc keys` when you
  click an answer and `hc interrupt` when you press Stop; what it reads is
  drawn, never saved. `Hire ⏎` opens a tab running the agent you picked. The
  sidebar's office gives the boss's hires panes (`terminal.keep`) while you
  look at the boss's tab.
- `office-inbox` runs `mkdir`, `find`, `stat` and `open`.
- `office-add` asks Herdr which agents are installed (`knownAgents`: Herdr looks
  in the shell agents start in, at most once a minute per machine) and runs
  `tab.new`, `pane.split` or `terminal.open` only for what you pick.
- No mod opens a network connection of its own or reads credentials.
- **Do not open a terminal inside a repo you do not trust.** `git status` can run
  filters from that repo's own `.git/config`. The status call keeps
  `safe.bareRepository=explicit`, which blocks bare repos hidden inside a clone,
  but it cannot stop filters in the repo's own config.

## Art and license

Code is Apache 2.0, see `LICENSE` and `NOTICE`. `office-spaces`, `office-tabs`
and `office-chrome` are modified copies of Herdr's built-in `spaces`, `tabs` and
`workspace-chrome` (Herdr 0.1.11), as are the upstream mods they derive from.

The office idea — one room, a desk per agent, the screen telling its state — is
inspired by [herdr-office-layout](https://github.com/zuccs/herdr-office-layout)
and [Sit & Watch](https://github.com/funny-it-worked-last-time-gsv/herdr-sit-and-watch-layout)
(both MIT). No code or art is copied from them.

The images in this repo are **generated by `tools/build-art.py`** — drawn pixel
by pixel in code, no image model — so they carry the same Apache 2.0 license as
the code. Art you generate from `docs/ART-PROMPTS.md` with a hosted model is
yours to license; the prompts grant nothing and make no warranty.
