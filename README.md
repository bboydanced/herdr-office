# Office

An office-toned Herdr layout. Each agent is a staff member at a desk with a
portrait, HP/SP bars and a state animation; each machine is an office building;
every tab carries its colleague's face.

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

`herdr-app check` must pass for every mod before you switch. Never overwrite your
own files — rename first if you already have a mod or theme called `office-*`.

Updating overwrites `mods/office-agents/jobs.json` and
`mods/office-spaces/places.json`. Back both up first and put them back, or
update without them:

```sh
H=~/.config/herdr-app
rsync -a --exclude jobs.json --exclude places.json mods/ "$H/mods/"
```

Uninstall:

```sh
H=~/.config/herdr-app
herdr-app do layout.switch '{"name":"main"}'
rm -rf "$H"/mods/office-agents "$H"/mods/office-chrome "$H"/mods/office-spaces \
       "$H"/mods/office-tabs "$H"/mods/office-inbox
rm -rf "$H"/data/office-agents "$H"/data/office-chrome "$H"/data/office-spaces \
       "$H"/data/office-tabs "$H"/data/office "$H"/data/office-inbox
rm -f "$H"/layouts/office.json "$H"/layouts/office.png "$H"/themes/office-night.json
```

This deletes everything in the inbox folder; move anything you want to keep
first. Herdr keeps the mod names in its own `seen.json`, which is harmless.

## What you see

- **Theme `office-night`:** ink blue background `#101820`, panel `#1b252f`,
  amber accent `#e0a44a`, paper text `#e6dfd2`, muted steel `#5f8fa8`. Square
  corners with thin amber frames.
- **Terminals** sit on a dark office floor: the pane `background` is
  `mods/office-chrome/floor.png` (`cover`), root `terminal_opacity` is `0.62`.
- **Sidebar, 268 px,** a night view of office windows behind translucent panels.
- **Spaces, top half:** a 76 px row per space with a 72 px building icon
  (`hq`, `branch`, `studio`, `lab`), the name, and up to three git lines:
  uncommitted files (`ansi3`), unpushed commits (`ansi2`), repos without a
  remote (`ansi1`).
- **Agents, bottom half:** a framed card per agent with a 72x96 animated sprite,
  tab name, status word, session name, program tag (`Claude` amber,
  `Codex`/`OpenCode` purple) then `model · effort`, then HP and SP bars.
- **Tabs, 58 px:** square 48 px tabs with a 44 px portrait, plus Files, Changes
  and Inbox buttons that open the right panel.

Behaviour is unchanged from the upstream kit: `working` blue with a spinner,
`blocked` orange with an alert mark, `done` green, `idle` dim. HP is the
session's remaining context and SP the account's remaining 5-hour quota; without
the status line script both show `—` and nothing is ever estimated.

## Customize

- **Who is who:** `mods/office-agents/jobs.json` maps a tab name to a role.
  Roles: `manager`, `developer`, `designer`, `analyst`, `writer`, `tester`,
  `support`, `intern`. Unlisted tabs get a free role, so faces repeat only past
  eight names. Tabs and cards share this file — copy it to every machine to get
  the same faces everywhere.
- **Buildings:** `mods/office-spaces/places.json`, e.g. `{"My Mac": "hq"}`.
- **Art:** placeholders are drawn by `tools/build-art.py`; prompts for real art
  are in `docs/ART-PROMPTS.md`.
- **Sounds:** none included. Put MP3s in `~/.config/herdr-app/sounds/` and add
  `"sounds": { "enabled": true, "done": "sounds/done.mp3", "blocked": "sounds/blocked.mp3" }`
  to `settings.json`.

## HP and SP (optional, Claude Code)

```sh
mkdir -p ~/.config/herdr-app/data/office
cp scripts/office-statusline.mjs ~/.config/herdr-app/data/office/statusline.mjs
```

Add to `~/.claude/settings.json` (this replaces any status line you already
have):

```json
{ "statusLine": { "type": "command", "command": "node ~/.config/herdr-app/data/office/statusline.mjs", "refreshInterval": 60 } }
```

It writes only numbers, the session name, the model and the effort. Install it
on every machine whose agents you want numbers for.

Codex and OpenCode have no status line. The upstream
`traveler-builder-models.mjs` helper reads Codex rollout files and the OpenCode
database (which also holds provider credentials) to recover their model name.
That script is **not** included here — copy it from the upstream repo and read it
first if you want model names on builder cards. Without it those cards show only
their tag.

## What it does on your machine

- `office-spaces` runs `git status`, `git rev-parse` and `hc machine ls` itself,
  in every folder that has a terminal. On connected remote machines Herdr runs
  that `git` there.
- `office-inbox` runs `mkdir`, `find`, `stat` and `open`.
- No mod opens a network connection of its own or reads credentials.
- **Do not open a terminal inside a repo you do not trust.** `git status` can run
  filters from that repo's own `.git/config`. The status call keeps
  `safe.bareRepository=explicit`, which blocks bare repos hidden inside a clone,
  but it cannot stop filters in the repo's own config.

## Art and license

Code is Apache 2.0, see `LICENSE` and `NOTICE`. `office-spaces`, `office-tabs`
and `office-chrome` are modified copies of Herdr's built-in `spaces`, `tabs` and
`workspace-chrome` (Herdr 0.1.11), as are the upstream mods they derive from.

The images in this repo are **generated by `tools/build-art.py`** — drawn pixel
by pixel in code, no image model — so they carry the same Apache 2.0 license as
the code. Art you generate from `docs/ART-PROMPTS.md` with a hosted model is
yours to license; the prompts grant nothing and make no warranty.
