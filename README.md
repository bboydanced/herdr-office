# Office

An office-toned Herdr layout. Every space is a project, every agent a member of
staff at their own desk in one shared office: you see who is typing, who needs
you and who dozed off, and one click takes you to their terminal.

![Office](preview.png)

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

Updating overwrites `mods/office-agents/jobs.json`, `replies.json` and
`boss.md`. Back them up first and put them back, or update without them:

```sh
H=~/.config/herdr-app
rsync -a --exclude jobs.json --exclude replies.json --exclude boss.md mods/ "$H/mods/"
```

Earlier versions shipped `mods/office-agents/sprites/`, `mods/office-spaces/art/`,
`mods/office-spaces/places.json`, `mods/office-chrome/sidebar.png`,
`mods/office-chrome/floor.png`, the Inbox panel (`mods/office-inbox/`, its files in
`data/office-inbox/`, `mods/office-tabs/art/inbox.png`) and icons in
`mods/office-chrome/` that nothing draws; nothing reads them any more, so delete
them from `$H` after updating (move any file you kept in the inbox first), and copy
`layouts/office.json` again. The Office panel
also needs the current `layouts/office.json`.

Uninstall:

```sh
H=~/.config/herdr-app
herdr-app do layout.switch '{"name":"main"}'
rm -rf "$H"/mods/office-agents "$H"/mods/office-chrome "$H"/mods/office-spaces \
       "$H"/mods/office-tabs "$H"/mods/office-add "$H"/mods/office-space-new \
       "$H"/mods/office-menu "$H"/mods/office-new-menu "$H"/mods/office-files \
       "$H"/mods/office-lobby
rm -rf "$H"/data/office-agents "$H"/data/office-chrome "$H"/data/office-spaces \
       "$H"/data/office-tabs "$H"/data/office "$H"/data/office-add "$H"/data/office-space-new
rm -f "$H"/layouts/office.json "$H"/layouts/office.png "$H"/themes/office-night.json
```

Herdr keeps the mod names in its own `seen.json`, which is harmless.

## What you see

- **Theme `office-night`:** pastel night, slate-indigo background `#1e2030`,
  panel `#2a2e42`, amber accent `#f5c47a`, text `#e6e9f5`, steel `#8aa0c8`;
  working `#8aadf4`, done `#a6da95`; the terminals keep the ink-blue palette
  (`#101820`, amber cursor `#e0a44a`). Rounded corners (3 for tags, 5 for buttons and chips, 6 for cubicles and rows, 8 for rooms and cards, 10 for panes and the layout's cards) with thin steel frames
  (`border` `#8aa0c84d`); amber is kept for what is yours right now — the
  focused pane, the tab and room you are in, the picked desk, the primary
  button — and coral `#f28b7d` only for what needs you, so the two never read
  alike. The office's own backings (name plates, the boss band, the desk
  window) come from the theme's `canvas`, `chrome` and `surface`
  (`backings()` in `mods/office-agents/lib.js`).
- **Cards on a dark frame:** the window is `canvas` with an 8 px margin; the
  sidebar, the tab bar and the side panel are `chrome` cards (radius 10, a 1 px
  `border` frame, 8 px apart), the side panel inset 4 px so its mods stay inside
  the round corners. Every pane is a card too, over
  `mods/office-chrome/wallpaper.png`, where the terminal draws at the root
  `terminal_opacity` of `0.86`.
- **Sidebar, 300 px:** on top the **Office Agent** logo (`mods/office-chrome/logo.js`,
  a chibi at a laptop in a night office, drawn in blocks), then two parts
  (weights 0.62 and 1.38):
  - **Spaces, the room directory:** a 44 px row per space. Its door in the
    space's colour with the room number (`01`, `02`… in Spaces order) in neon
    across its top, lit while any agent is in and off when the room is empty,
    and a lamp over it (off; breathing while an agent works; blinking while
    one waits for you). Then the name,
    the branch when unusual, and one line: git as sticky notes (`3 changed`
    yellow, `↑2 unpushed` green, `no remote` red) and the faces of the staff in
    the room, framed in their status colour, the same faces as at their desks
    (five, then `+n`; click them to open the Office panel). The room you are in
    has its lights on, a warm tint with the amber bar.
    A space where an agent works **breathes**: a glow in the working colour
    fading in and out. A space where an agent waits for you **blinks** a red
    tint, with a `!` by its name. Rooms have no frame round them for now.
    Waiting wins over working. Hover a room and its rug lights up in the
    office; hover a rug and its room lights up.
    Hovering a room also shows `+` (a new tab there, with a shell or an
    agent), `✎` (rename) and `×` (close); its name's tooltip is its folder.
    A space whose folder is a git worktree of another room's repo is its own
    space in Herdr, listed under that room (`├─` / `└─`, a branch for its
    door); Spaces shares which ones as `space.trees` so the Office floor puts
    their rugs under that room's too (`mods/office-agents/worktrees.js`, copied
    into Spaces). A space whose terminals are on several branches says how
    many (`2 branches`, each in the tooltip), here and on its rug.
  - **Groups you make:** `▤` by the header names a **group**
    and ticks the spaces in it, so a project whose sources are separate rooms
    reads as one block. A group only holds spaces together in this list and on
    the Office floor; it never changes a space's folder or order. The band sits
    where its first space is, with its name, `N spaces` (worktrees' rooms,
    which have no number of their own, counted apart: `1 space · 2 worktrees`,
    here and on the Office floor), the faces of everyone in
    them and their status count — no door, git or actions of its own. Its spaces
    follow as ordinary rows, each still marked with its own number. `▾` on the
    band folds them away (kept, and the Office panel folds the same way), `▸`
    brings them back; `⋯` edits the group. A space sits in one group: ticking
    one that is in another moves it. A space closed and opened again (from
    here, the dialog, or after a restart) goes back in its group. Groups live in
    `mods/office-agents/groups.js`; a mod can't import outside its folder, so
    Spaces and the dialog carry verbatim copies (the tests check they match). A group with no space on a machine,
    or none left after a filter, draws no band.
  - **New space:** every `+` (the header, a machine's header, the Office
    panel's `+ New space`) opens a dialog instead of a space in home. It starts
    in the folder of the space you are in; type another, **Choose…** one with
    the system's folder picker (this computer only), or click one of the
    recent rooms. The name is optional (empty: Herdr names it after its repo or
    folder). A folder that isn't there is said so before anything opens.
  - **Rooms stay open:** Herdr closes a space with its last tab, so every
    room keeps a **lobby** (`mods/office-lobby/`): a tab whose only pane is a
    small page, no terminal and no process, that the tab bar and the floor
    never show and that is put away (`tab.settle`) while the room has other
    tabs. Close your last tab and the room stays, showing the lobby: an `OPEN`
    sign, the room and its folder, **+ Terminal**, **+ Agent** (the add menu)
    and **Close room**, on the terminals' background at their opacity, like
    the panes beside it. Spaces keeps one in every room (made where missing,
    a second one closed, left for your nearest tab when the room shows it
    beside others: `mods/office-agents/lobby.js`, copied into Spaces and the
    tab bar). A room closes only when you close it: `×`, the menu's Close,
    **Close room**, or closing the lobby itself. A machine that can't hold
    one (tried three times) keeps the old way.
  - **Closed rooms:** a room you close stays under **Closed rooms** (per machine, foldable, the last 12), its door shut
    and dark: a click opens it again in the same folder, with its name and
    colour; `×` forgets it. Only the place comes back, not what was running.
    A machine that is away doesn't count as closing its rooms.
  - **Machines:** a machine whose core was replaced (a rebuilt server, a new
    container) says so where its name is, with **Connect**: the machine is
    forgotten and added again under the same name, so its rooms keep their
    places. A machine that needs a login shows the command to copy.
  - **Narrow:** dragged below 160 px, Spaces becomes a rail: one cell per room
    with its door (its number in neon, its lamp for its status), the room you
    are in lit, a dot when it needs you; a worktree by its branch,
    a group by its count in a cyan tube, and one cell per machine.
  - **Office Agent:** every agent as a list, not the floor. A header
    (`Office Agent`, `N need you`, `N/M at work`, the time), the back wall
    (night windows, clock, kanban board, door, water cooler, plant), then one
    30 px row per agent: its face framed in its status colour, its name, the
    status and for how long (`Working · 12m`, `NEEDS YOU`, `✓ Done`),
    and the space › tab it sits in, on a dimmed backing so the windows behind
    stay out of the names. A click goes to its terminal; right-click
    opens Herdr's menu, middle-click peeks. Spaces you put in a **group** are
    banded: a slim header with the group's name, how many agents it holds and
    `! N` / `● N` when some need you or are working (seen even folded), then their rows indented under it. `▾` on the band folds them away (the
    same fold the Spaces list and the Office panel share). The floor itself —
    rugs, cubicles and desks — is in the **Office** panel.
- **Tabs, 58 px:** square 48 px tabs showing **every agent in the tab**: one
  agent as a 44 px portrait, several as overlapping faces framed in their status
  colour (four at most, then `+n`), then a terminal mark with the count of the
  tab's other panes. Faces match the desks in the office. The tab you are in
  is lit like a neon sign: a tube in the accent round it, its glow breathing.
  Files, Changes and Office open the right panel: each its picture and a neon
  sign in its own colour (cyan, green, Office's pink like the `OA` sign), lit
  while its panel is open and off otherwise.

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

Every desk, the boss and the portraits are drawn in rounded blocks by
`mods/office-agents/figure.js`: in the panel 84x70 points a desk (on a 36x30
grid, every edge rounded to a whole pixel, the big shapes outlined as pixel art
is; the head at a desk drawn at 0.8 of the portraits', `DESK_HEAD`) on quiet
floor tiles. Each role's look is a line of `LOOKS`; `tools/preview-figure.mjs`
draws them all on one sheet without Herdr.

| Status | Screen | Staff |
|---|---|---|
| `working` | lines of code fading in and out | typing, a steaming mug; the desk breathes: one thin frame and a glow fading in and out |
| `blocked` | red, flashing, a white `!` | one hand up, mouth open, a `!` bubble; a thin coral frame blinks over a red tint and the label turns into a red `NEEDS YOU` tag |
| `done` | green with a check mark | hopping, eyes closed and smiling, sparkles |
| `idle` | a dim screensaver | head down on folded arms under floating `z`s |
| no agent | the shell's prompt, its cursor blinking | an empty chair |

The sidebar's back wall and the boss's office are blocks too (`room.js`, 2 points a
cell), a night office after Pixel HQ: a dark wall, big windows onto a city
(lit windows and an antenna's light blinking), few things but big ones, flat in
two tones with a thin dark edge. The sidebar's, in neon like the boss's: a
small plant swaying, a small `OA` (Office Agent) sign between its windows, a
water cooler whose bottle bubbles, a server rack with its lights blinking and a
line of light scanning down it, a cup steaming on the coffee table, a cactus
with its flower blinking. The boss's: panelling and strip
lights the length of the wall, a wide window behind the boss and a rug under
it, a neon plant (its leaves swaying) and the big neon `OA` sign where the
band's words end, then the sidebar's things too: a neon cactus, a neon clock
(its second hand ticking) over a printer, a neon chart (its bars rising and
falling) over a bubbling water cooler and a blinking, scanning server rack,
shelves with a trophy, a tall neon plant, a second window over a sideboard, a
cup steaming on a side table, a sofa and a lamp, on floor tiles like
the room's (`--room` previews them). The neon is `mods/office-agents/neon.js`
(Spaces and the tab bar carry verbatim copies, the tests check they match):
letters and digits as tubes on a dark board (`GLYPHS`), a dark colour lifted
until it reads as lit (`neonColor`), a white-hot core; the glow and the tubes
breathe together, each sign at its own pace, and the `OA` signs' A goes off
now and then and hums as it comes back, all native loops. `neonSign` puts each
room's number up in its own colour, on its rug in the office and on its door in
Spaces; the font has the capitals too, for the tab bar's panel signs.
`neonFrame` edges things in one thin tube, part see-through so it reads as
light, not a line (a glow ring outside it only where asked, the tab bar's tab):
each rug in its colour
(breathing; a working or waiting rug's activity frames take over), the tab you
are in (in its space's colour in the office, in amber in the tab bar) and the
group bands (cyan, still). Faces move with their
status in Spaces and in the Office Agent list: bobbing at work, shaking while
they wait for you.

A worktree's rug sits right under its repo's room on a line from it, as in
Spaces: in that room's colour, fainter, a branch where the number goes (the
number in its tooltip). In a room on several branches each desk says its own
under its name (the last part, `xaa-usage` for `office/xaa-usage`; all of it
in the tooltip).

Every desk is lit by its screen. A rug shows its
space the same way (breathing or blinking) with `● N working` or
`! N need you` in its corner. The pulses are native `loop`s on `opacity`/`top`:
they run without re-rendering the mod. Click a staffed desk for
`agent.focus` (its terminal, in its space and tab); click an empty one to go to
that pane. Hover for who, what and where. Right-click a desk, a cubicle or a
rug for Herdr's pane, tab or space menu, on an office card (`office-menu`); middle-click a desk to peek at its
terminal without leaving your tab. `agent.next` / `agent.prev` walk the
desks in the order they are drawn. Narrowed below 160 px, Office Agent becomes a
column of faces framed in their status colour.

### The Office panel

The **Office** button opens the whole office in the right panel, wider: the
same rugs, cubicles and split-placed desks as the sidebar, with as many desks
across as the panel fits. It opens at 640 px; drag its edge up to 900. The
Office panel and the other panels each remember their own width. Top to
bottom:

1. **The header:** filters with their counts (`All` counts every desk on the
   floor, a terminal's too; `Working`, `Needs you`, `Done` count agents;
   remembered), the after-hours switch (`☼` / `☾`, see below), `▤` for
   a new group and the time.
2. **The boss's office** (see below): a panelled room under strip lights,
   night windows onto the city, a neon `OA` sign, a neon clock, chart and
   plants, a printer on a cabinet, bookcases, a sideboard and a sofa (only what the panel's
   width shows is drawn). On its wall its nameplate, which is also the
   `SPACES` picker for where the goal goes (`BOSS ● <space>` once the space has
   a boss, else only the space), a dark board edged in a neon tube of the
   space's colour (lit full and breathing while open), opening a dark card in
   the same tube with `SPACES` on it as a small neon sign, the picked line lit
   in the colour and ticked. Then the team count on a dark board and, once the
   space has a boss, its **flow** live on a dark strip in neon:
   `Plan` → `Hired N agents · M at work` → `Review` → `Report`, the steps
   behind ticked in green, the one it is on lit in a tube (amber at work, red
   while someone waits for you, breathing while live), the rest off.
   The step is the one the boss says it is on (its `office.stage` label, set
   back to `plan` when a goal goes from the panel) while it or its hires are at
   it; without one it is read from their statuses: working with no hire yet
   is Plan, hires at work is Hired, hires finished while the boss works is
   Review. All quiet is Report. The same strip sits on that space's rug on the
   floor, and nowhere else. The boss stands on the rug by the window; on the
   graphite floor its **whiteboard** (see below), its latest line, then, while
   the space has no boss, the `ORCHESTRATOR` picker (the same board and card
   in pink neon, as tall as the goal box) and the goal box. `▴` folds it
   to one line (its face, its latest line, its team), `▾` brings it back.
3. **The morning memo** after a night with news (see After hours), then
   **Needs you**, while an agent waits for you (see below).
4. **The floor:** rugs, cubicles and desks. Each rug opens with its room
   number in neon, in the space's colour: the number on its door in Spaces.
   Under each desk a second line: the
   status and for how long (`● 12m`, `NEEDS YOU · 3m`, `✓ 5m`, `Idle · 1h`;
   the tab's time, so agents sharing a tab share it), or an empty desk's
   folder when it is not the space's own (the rug already says that one). A mod's pane (a git-changes diff or commit view) is a view, not a
   desk: it gets none, and a tab holding only views has no cubicle.
   - **Adding:** `+ Tab` on a rug opens a new tab in that space, `Add desk`
     (a small taped `+` at the end of a cubicle's name row, shown while the
     pointer is over the cubicle) splits the tab beside its last
     pane, right or down, and `+ New space` at the end of the floor makes a
     space. Tab and desk ask what to start: a terminal, or one of the agents
     installed where the space lives (Herdr's `knownAgents`, most picked
     first). A desk with an agent starts in its neighbour's folder.
   - **Moving:** drag a desk and every other tab of the same machine opens a
     spot taped out at a desk's size (`Move here`); drop it there and its
     terminal moves to that tab, still
     running. Herdr's `pane.move` does it when Herdr has it; until then the
     office parks the terminal, relabels its `herdr.space` / `herdr.tab` and
     keeps it again, so it lands in that tab with a new pane, not where the
     split was. A boss stays in its `Boss` tab. Inside one tab, use Herdr's own
     pane grip or the right-click swap.
   - **Put away:** tabs put away (`tab.settle`) are listed at the end of the
     floor; click one to bring it back.
5. **The inspector**, one bar under the floor: the staff member you picked,
   their name and program, space › tab, folder, branch, status and for how
   long, with `Terminal ↗` (the desk window again), `Go to desk` and `Peek`
   (look over the tab without leaving it).

**Click a desk** to pick that staff member and open **their real terminal in
a window** (a double-click goes to their terminal instead, as a click does in
the sidebar). It is Herdr's own terminal, drawn like the panes in the main
area: click into it and type, scroll back, answer its questions. One window
for every desk: pick someone else and their terminal takes its place, where
you last dropped it. Its header shows who and where, `Go to desk` (goes there
and closes the window), `Stop` (`hc interrupt`: Esc for an agent, Ctrl+C for
anything else), `✕` to close (Esc goes to the terminal, not the window) and the
**quick replies** from `mods/office-agents/replies.json` (a list of up to eight
strings): a click sends one and presses Enter (`hc send`); an agent waiting
for an answer refuses them. Drag the window by its header. It closes by itself
when the terminal ends, and on a layout switch.

Only the sidebar's office sets the `agent.next` / `agent.prev` order.

**The whiteboard** hangs in the boss's office once the boss has a plan or a
team, in neon like the wall: a dark board under a `PLAN` sign, one note per
piece of its plan (its `office.plan` label), each with the hire on it (their
`office.piece` label, else a name ending in the piece: `developer-login` for
`login`), edged and written in the neon of where it is: `○ To do` (grey),
`● Hired` (violet), `● At work` and `! Needs you` (the theme's colours,
breathing), `◐ To review` (cyan), `✓ Passed review` (green), `✓ Merged`
(faded); hires on no piece get notes at the end. A note with a hire picks
their desk. A piece done in a worktree (`<repo>/.worktrees/<name>`) shows its
diff against your checkout, `+40 −5` (or how many files are not committed
yet), and **`Accept`**: asked once more (`Merge office/<name>? ✓ ✕`), it sends
the boss `[Office] The person accepts "<piece>" …`, your agreement to merge
that branch with `git merge --no-ff`, remove the worktree and branch, mark the
piece `:merged` and report.

A new goal to a boss that already had a plan leaves that plan behind: the
board keeps its notes, faint and marked **`OLD GOAL`** (hover: the goal they
were for), until the boss writes its next plan, which is fresh again. Nothing
is cleared, so a team still working on the old pieces keeps its board.

**After hours** (on by default, 19:00 to 07:00; the header's `☼` turns it off,
`☾` shows at night; `localStorage` `office.hours` takes other hours, like
`22-6`): at night idle desks and the floor dim, a desk at work keeps its lamp
on, and the sidebar's office notes every agent that finishes or starts waiting
for you. In the day after, a **MORNING** memo under the boss's office says what
finished and who waited for you since when; `Got it` clears it. Herdr's own
sounds and notifications are Herdr's: the office can't mute them.

**Menus are office cards.** Every dropdown and menu is the same card
(`mods/office-agents/card.js`, copied into the mods that draw one), in the
theme's popover colours like the New space dialog: a folder tab with a lit
desk-lamp mark saying what it is for (`SPACE · web-app`, `TAB`, `DESK`, `NEW TAB`,
`ADD A DESK`, `SPACES`, `ORCHESTRATOR`), one ruled line per item, the picked or
keyboard-chosen line highlighted with a lamp-amber edge, keys on little tags,
`Close` in red below a double rule. That covers the right-click menus
(`office-menu`), the tab bar's `+` (`office-new-menu`), `+ Tab` / `Add desk`
(`office-add`), the boss's pickers and the group dialog's list.

**The Files panel** (`office-files`, the top bar's `Files`) stays on the repo
of the space you are in (where the space was made, else its first
terminal's folder): clicking another pane or an agent's `cd` no longer moves
it. The pin in its header switches to following the focused pane instead.
- **Changed by agents**, on top: your checkout's uncommitted files, then each
  boss worktree (`.worktrees/<name>`: its branch's commits and what is not
  committed yet, with the hire working there), last written first, with how
  long ago (`5m`). The tree below marks changed files (`M`, `A`, `D`, `U`)
  and dots the folders holding them. It reads again when something in the
  folder changes (on this machine) and every 10 seconds.
- **Find a file:** type in the box; the name holding what you typed comes
  first, then the path, then the letters in order (git's files, ignored ones
  left out).
- **The file window:** a click opens the file in one window over everything
  (drag it by its tab bar), a tab per file. Code with colours and line
  numbers; Markdown formatted (`Source` shows its text). `Edit`, then
  `Ctrl+S` or `Save`; `Ctrl+W` closes a tab, asking first when it has unsaved
  edits. A save goes only over the text it read: when an agent wrote the file
  meanwhile, a banner says so and you pick `Keep theirs` or `Keep mine`. A
  file you aren't editing follows the disk. `Send to ▾` names the file, and
  the lines you picked (`src/a.ts:12-30`), to an agent (bosses first), with
  an optional line of what to do; `Copy path` copies the same. Files on
  another machine are read-only here.
- On purpose it doesn't rename, delete or create files (ask an agent), and
  has no diff (that is `Changes`), no images or PDFs.

#### The boss

The boss is a team lead you give goals to; it hires agents to do the work.
Each space has its own, in a tab named `Boss`; the panel shows one, for the
space picked in the first dropdown (the space you are in, until you pick
another; the list marks the spaces that have a boss).

- **The goal box** (a dark board in a faint cyan tube) takes several lines and
  grows to six as you type or paste (a spec, a list of steps); `Ctrl+Enter` or
  the button (`Hire ⏎` / `Tell ⏎`, a lit amber neon sign, dim while busy)
  sends it. Later goals
  reach the boss as pasted, lines and all; the first one goes in the boss's
  one-line brief, so its line breaks become spaces.
- **Which goal it is on** shows under the box (`On: add Google login`), from the
  boss's `office.goal` label, set each time you send one, so you can come back
  later and see what the team was asked to do. The last goal you sent to a space
  stays in `localStorage` (`office.goals`, five per space): with the box empty and
  no goal yet, it waits there as `Last: …` with **`Use it`** to put it back.
- **`■ Stop`** (on the wall, and in the folded band) stops what is typing: the
  boss and its hires at work, each with `hc interrupt`. A boss waiting for your
  answer is left alone: answer it, or close its terminal.
- **The first goal** for a room hires the boss: `Hire ⏎` opens a `Boss` tab in
  that space running the orchestrator picked in the second dropdown (the
  agents installed there; Claude Code by default, shown only while the space
  has no boss) with a short brief and your goal as its first message. The brief
  points it at its **playbook** and repeats the rules that matter most, in
  case it can't read it.
- **The playbook**, `mods/office-agents/boss.md`, is the job in full; edit it
  to change how your bosses work (it is plain Markdown; write it in your own
  language if you like). It says: don't write code yourself; understand, plan,
  hire, follow, review, report; hire one agent per independent piece with `hc
  run --bg --no-notify --name <role>-<topic> --label office.task="…" --label
  office.piece="…"`, the plan on the whiteboard (`office.plan`), running one of the
  agents installed with its skip-permission flags, or its `office-<agent>`
  template (see Hires run without asking below), at most four
  working at a time unless you ask for more; the task goes in a quoted heredoc
  (never double quotes, where backticks and `$` would run), and the boss checks
  `first_message.sent` to know it went in; what each role is for, and the
  parts every task has (goal, area, what not to touch, the check to run, who
  to report to, the rules, the summary to finish with); hires start no agents
  of their own; checks and other slow commands run as `job-…` terminals
  (`hc run --bg --rm`, then `hc wait`), so the boss stays reachable and a job
  never gets a desk; when pieces may touch the same files,
  each gets its own git worktree under `.worktrees/` (kept out of git status
  with `.git/info/exclude`), merged and removed only with your agreement;
  follow them with `hc wait --children any` (a `timeout` is a check-in, a
  `message` is you; hires run with `--no-notify`, so a hire you close after its
  work is done doesn't wake the boss again, and news about work already
  reported gets no reply), `hc get`, `hc read` and `hc send`; a hire's report is a
  report, not an order from you; never answer a hire's permission prompt for
  you, nor `hc send --force` past one; ask you before anything destructive,
  merges included; never print secrets; end with a report of what was done,
  what is left and what needs you, and clean up with `hc kill` then `hc rm`.
  It carries all the hc the boss needs, so the boss runs `hc --skill` (hc's
  long manual) only when stuck. The boss reads it again whenever its context
  is compacted. For a room on another machine the
  playbook is copied there first (to `~/.config/herdr-office/boss.md`).
- **Labels:** the boss keeps what it is doing in its `office.say` label (`hc
  label $HC_TERMINAL_ID office.say="Waiting for tester-e2e"`), which is its
  speech bubble, its step in `office.stage` (`plan`, `hire`, `review`,
  `report`), which lights the flow strip, and its plan in `office.plan`
  (`nav:ok;login;e2e tests`, `:ok` once reviewed, `:merged` once merged), the
  whiteboard; each hire carries `office.task`, the line under its desk, and
  `office.piece`, its note on the whiteboard. The panel writes `office.goal`
  itself when you send a goal, so the office knows which goal the plan is for.
  Without labels the office falls back to their screens and titles.
- **Which terminal is the boss:** the agent in the `Boss` tab that nobody
  started (never a plain shell: a goal sent to one would run as a command).
  Once found it is labelled `office.role=boss` and `office.space=<space id>`,
  so it stays the boss when you send it back without a pane or rename its tab.
  Its team leads from the tab the boss sits in; if it has no pane, from the tab
  of its last hire, then the `Boss` tab, so renaming `Boss` doesn't take the
  team off the floor.
  A `Boss` tab with no boss running in it (still starting, or its agent gone)
  hires nobody new: wait, or close the tab to hire again.
- **Later goals** go to the boss you already have (`Tell ⏎`, `hc send`).
- **Its hires** are its children in herdr-core: they get a desk in its
  cubicle at once, each with a face of its own (a hire's name says what it is
  for, never which face it wears, so four developers are four people), the
  same face everywhere. A hire Herdr gets no
  status from (an agent it doesn't know, like `pi` or `agy`) still gets its
  desk, as long as it carries `office.task` or a name that starts with a role
  (`developer-nav`; a job like `tests` or `job-build` gets none); it reads
  `Running` since its status is unknown, and never shows in Needs you. While you look at
  the boss's tab, they get panes beside it one by one (right, then down; four
  panes at most), and your focus goes back where it was; elsewhere they work
  at their desks.
- The boss shows its status (talking with a clipboard, a hand up, a thumbs up,
  arms crossed), its speech bubble its latest line and its team (`team 3 ·
  2/4 working`: its live hires, and how many work against the cap, red past
  it).
  Click it for its terminal in the desk window; double-click to go there.
- Closing the `Boss` tab ends its hires too (herdr-core ends children with
  their parent).

#### Hires run without asking

A hire starts in the background, where a permission prompt would stall it
with nobody watching. So the brief gives the boss each installed agent's
command with the flags that skip those prompts (`HIRE_FLAGS` in
`mods/office-agents/lib.js`; the playbook has the same table):

| Agent | Hired as |
|---|---|
| Claude Code | `claude --dangerously-skip-permissions` |
| Codex | `codex --no-daemon --dangerously-bypass-approvals-and-sandbox` (`--no-daemon`, the boss too: else its commands run outside hc) |
| Antigravity | `agy --dangerously-skip-permissions -i "<task>"` (without `-i` agy gets no task) |
| Gemini | `gemini --yolo -i "<task>"` |
| Cursor | `cursor-agent --force --trust` |
| Grok | `grok --always-approve` |
| pi | `pi` (it never asks) |
| Oh My Pi | `omp --auto-approve` |

When it hires a boss, the panel also writes each of these as a herdr-core
template, `~/.config/herdr-core/templates/office-<agent>.md` on the boss's
machine (only its own `office-*` files, rewritten each time): the command
without `-i`, and the hires' rules (`HIRE_RULES`) as its body. A hire started
from a template (`hc run --bg … office-claude "<task>"`) gets rules and task
as one first message once it is ready, hc waiting up to a minute for it. The
brief names the template when there is one, else the command. A command hc
can't run without a shell (quotes, spaces, `$` in its words) gets none.

**This is a risk you take on:** a hire then runs any command its model
decides on (deleting files, pushing, installing, reading secrets) without
asking you. Only the Rules in its task hold it back. Run it only on a machine
and a project where that is acceptable. For a safer setting, change
`HIRE_FLAGS` and the playbook's table (the templates follow `HIRE_FLAGS`; for example `codex --approve-for-me`,
or `agy --mode auto`). A hire that asks anyway shows up in Needs you when
Herdr knows the agent.

Every hire is a full agent session, with its own cost. The boss runs `hc`
through its shell, so its agent asks you before each command unless you allow
it; those questions show up in Needs you. Allow only what the boss needs.
For Claude Code, in the project's `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(hc --skill)", "Bash(hc ls:*)", "Bash(hc get:*)", "Bash(hc read:*)",
      "Bash(hc run:*)", "Bash(hc wait:*)", "Bash(hc send:*)", "Bash(hc label:*)",
      "Bash(hc interrupt:*)", "Bash(hc templates)", "Bash(echo $HC_TERMINAL_ID)"
    ]
  }
}
```

Do not allow `Bash(hc:*)`: that also lets the boss run any command with `hc
exec` (on your other machines too), write files with `hc file`, end terminals
with `hc kill` / `hc rm` and answer a hire's permission prompt with `hc keys`. Left out
of the list, each of those still asks you first. `hc run` still starts any
program, so this narrows what the boss can do without asking, it does not
sandbox it.

#### Needs you

While an agent waits for you, the card above the floor shows who and where,
how long it has waited, **its question as its screen shows it**, and its
numbered choices (`1  Yes`, `2  Yes, and don't ask again…`, `3  No…`); without
numbered choices, `Enter` and `Esc`. A click presses that key in its terminal
(`hc keys`); nothing is ever answered for you. `n/m ›` goes to the next one
waiting, `Terminal` opens its terminal in the desk window, `Open ↗` goes to
its terminal.

## Customize

- **Who is who:** `mods/office-agents/jobs.json` maps a tab name to a face.
  Faces: `manager`, `developer`, `designer`, `analyst`, `writer`, `tester`,
  `support`, `intern` (each with a portrait and a desk for every status). A
  role is a face and a desk, not a rank or a job title: an agent's name says
  what it does. A tab's first agent wears the tab's face and the other agents
  in that tab get faces of their own, and the office hands out no face twice
  while the eight last (`uniqueFaces`), so a boss's team of developers is a
  room of different people.
  The tab bar and the office work this out the same way (`tabDesks`,
  `deskJobs`, `uniqueFaces`); Spaces shows the faces the office shares
  (`office.faces`). Copy the file to every machine to get the same faces everywhere.
- **Project colours** come from the Spaces list (`space.colors`), so the door
  and the rug of a space always match.
- **Art:** the people, desks and walls drawn live in blocks (`figure.js`,
  `room.js`, `logo.js`); the few bitmaps (floor tiles, tab icons, wallpaper) by
  `tools/build-art.py`; `tools/build-preview.py` composes the mock `preview.png`
  and the picker thumbnail from both. Prompts for model-made replacements are in
  `docs/ART-PROMPTS.md`.
- **Sounds:** none included. Put MP3s in `~/.config/herdr-app/sounds/` and add
  `"sounds": { "enabled": true, "done": "sounds/done.mp3", "blocked": "sounds/blocked.mp3" }`
  to `settings.json`.

## What it does on your machine

- `office-spaces` runs `git status`, `git rev-parse` and `hc machine ls` itself,
  in every folder that has a terminal. On connected remote machines Herdr runs
  that `git` there.
- `office-agents` reads its own `jobs.json` and `replies.json` and herdr-core's
  `docs.json` (for the splits; it writes nothing and shows nothing else from
  it). In the Office panel it runs `hc read` on the agents waiting for you and
  the boss (only while the panel shows the office), `hc send` when you send a
  goal or click a quick reply, `hc keys` when you click an answer and `hc
  interrupt` when you press Stop; what it reads is drawn, never saved. A desk
  dragged to another tab runs `pane.move`, or else `terminal.park`, `hc label`
  (`herdr.space`, `herdr.tab`) and `hc keep` on that terminal. A click
  on a desk opens a window (`openOverlay`) showing that terminal itself. `Hire ⏎` opens a tab running the agent you picked; for a
  room on another machine it first writes the playbook there with `sh`
  (`~/.config/herdr-office/boss.md`, its text passed as an argument). It runs
  `hc label` once on each boss it finds (`office.role`, `office.space`), and
  writes its hire templates (`office-*.md`) to `~/.config/herdr-core/templates`
  there with `sh`. The
  sidebar's office gives the boss's hires panes (`terminal.keep`) while you
  look at the boss's tab, and reads the bosses' and hires' `office.say` /
  `office.task` / `office.plan` / `office.piece` labels. For a whiteboard
  piece done in a worktree the panel runs `git rev-parse`, `git diff
  --shortstat` and `git status --porcelain` there (with `sh`, at most every
  15 seconds a piece, only while it waits for review), and `hc send` when you
  accept it. After hours the sidebar keeps the night's notes (names and
  statuses only) in `localStorage`.
- `office-add` asks Herdr which agents are installed (`knownAgents`: Herdr looks
  in the shell agents start in, at most once a minute per machine) and runs
  `tab.new`, `pane.split` or `terminal.open` only for what you pick.
- `office-menu` and `office-new-menu` are Herdr's own `menu` and `new-menu`
  (Apache-2.0) drawn as office cards, with the same items and keys: the
  right-click menu of a desk, a tab, a space and a terminal (the office layout
  names it `terminal_menu`), and the tab bar's `+`. They run only the commands
  Herdr's menus run.
- `office-files` runs `sh` (Herdr's `files` listing, Apache-2.0, and `stat`
  for when changed files were written), `git rev-parse`, `git status`, `git
  worktree list`, `git diff --name-status` and `git ls-files` (for the
  filter) in the space's repo and its `.worktrees/`; it reads a file when you
  open it and every two seconds while it is in front, writes one only when you
  save, and runs `hc send` when you send a file to an agent.
- No mod opens a network connection of its own or reads credentials.
- **Do not open a terminal inside a repo you do not trust.** `git status` can run
  filters from that repo's own `.git/config`. The status call keeps
  `safe.bareRepository=explicit`, which blocks bare repos hidden inside a clone,
  but it cannot stop filters in the repo's own config.

## Art and license

Code is Apache 2.0, see `LICENSE` and `NOTICE`. `office-spaces`, `office-tabs`
and `office-chrome` are modified copies of Herdr's built-in `spaces`, `tabs` and
`workspace-chrome` (Herdr 0.1.11).

The office idea — one room, a desk per agent, the screen telling its state — is
inspired by [herdr-office-layout](https://github.com/zuccs/herdr-office-layout)
and [Sit & Watch](https://github.com/funny-it-worked-last-time-gsv/herdr-sit-and-watch-layout)
(both MIT). No code or art is copied from them.

The art in this repo is **drawn in code** — the blocks of `figure.js`,
`room.js` and `logo.js`, the bitmaps of `tools/build-art.py`, no image model — so they carry the same Apache 2.0 license as
the code. Art you generate from `docs/ART-PROMPTS.md` with a hosted model is
yours to license; the prompts grant nothing and make no warranty.
