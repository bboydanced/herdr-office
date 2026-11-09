// Pure-function tests for the office mods. No Herdr needed:
//
//     node test/lib.test.mjs

import * as A from "./../mods/office-agents/lib.js";
import * as T from "./../mods/office-tabs/lib.js";
import * as I from "./../mods/office-inbox/lib.js";
import { readFileSync } from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };

// roles and pictures
ok(A.JOBS.length === 8, "eight roles");
for (const r of A.JOBS) {
  ok(A.portraitPath(r) === `mods/office-agents/art/${r}.png`, `portrait ${r}`);
  for (const s of ["working","blocked","done","idle"]) ok(A.deskPath(r, s) === `mods/office-agents/desks/${r}-${s}.gif`, `desk ${r}-${s}`);
}
ok(A.deskPath("nope","working") === null, "unknown role -> no desk");
ok(A.deskPath("manager", null) === "mods/office-agents/desks/manager-idle.gif", "unknown status dozes");
ok(A.portraitPath("../etc/passwd") === null, "traversal rejected");
ok(A.EMPTY_DESK === "mods/office-agents/desks/empty.png", "empty desk");

// job assignment
const jobs = { "Claude Code": "manager", "Bad Role": "wizard" };
ok(A.jobFor("claude code", jobs) === "manager", "case/space-insensitive match");
ok(A.jobFor("Bad Role", jobs) === null, "unknown role value -> null");
ok(A.jobFor("constructor", jobs) === null, "prototype key safe");
const assigned = A.assignJobs(["Claude Code","Frontend","Backend","Docs","Tests","Review","Deploy","Ops"], jobs);
ok(assigned.get("claude code") === "manager", "explicit job wins");
ok(new Set([...assigned.values()]).size === 8, "no duplicate roles within eight");

// cubicle columns
ok([1,2,3,4,5,6,7].map(A.deskColumns).join() === "1,2,3,2,3,3,3", "columns by desk count");
ok(A.deskColumns(0) === 1, "no desks still one column");

// office plan: space -> tab -> pane, sub-agents at the end of their tab
const spaces = [
  { id: "s1", name: "web", tabs: [{ id: "t1", name: "main" }, { id: "t2", name: "review" }, { id: "t3", name: "old", settled: true, status: "idle" }] },
  { id: "s2", name: "api", tabs: [{ id: "t4", name: "1", settled: true, status: "blocked" }] },
  { id: "s3", name: "empty", tabs: [] },
];
const panes = [
  { pane: "p1", tab: "t1" }, { pane: "p2", tab: "t1" }, { pane: "p3", tab: "t1" },
  { pane: "p4", tab: "t2" }, { pane: "p5", tab: "t3" }, { pane: "p6", tab: "t4" },
];
const agents = [
  { address: "a1", pane: "p1", tab: "t1", tab_name: "main", status: "working" },
  { address: "a3", pane: "p3", tab: "t1", tab_name: "main", status: "blocked" },
  { address: "a9", pane: "", tab: "t1", tab_name: "main", status: "working" },
  { address: "a6", pane: "p6", tab: "t4", tab_name: "1", status: "blocked" },
];
const plan = A.officePlan(spaces, panes, agents);
ok(plan.map((r) => r.space.id).join() === "s1,s2", "rugs in space order, empty space dropped");
ok(plan[0].tabs.map((c) => c.tab.id).join() === "t1,t2", "settled tab hidden");
ok(plan[1].tabs[0].tab.id === "t4", "settled tab that needs you stays");
const main = plan[0].tabs[0].desks;
ok(main.length === 4, "three panes plus a sub-agent");
ok(main[0].agent.address === "a1" && main[1].agent === null && main[2].agent.address === "a3", "desks in pane order, empty pane empty");
ok(main[3].pane === null && main[3].agent.address === "a9", "sub-agent at the end");
ok(A.officePlan(null, null, null).length === 0, "nothing in, nothing out");

// split trees, from layout documents of either shape
const rows = { layout: { tabs: [{ id: "t1", focus: "p2", root: { type: "row", children: [{ type: "pane", id: "p1" }, { type: "column", children: [{ type: "pane", id: "p2" }, { type: "pane", id: "p3" }] }] } }] } };
const bsp = { app: { value: { t1: { root: { split: "down", ratio: 0.5, first: { pane: "p1" }, second: { split: "right", first: { pane: "p2" }, second: { pane: "p3" } } } } } } };
ok(JSON.stringify(A.splitTree(rows, ["p1","p2","p3"])) === '{"dir":"across","children":[{"pane":"p1"},{"dir":"stacked","children":[{"pane":"p2"},{"pane":"p3"}]}]}', "row/column tree");
ok(JSON.stringify(A.splitTree(bsp, ["p1","p2","p3"])) === '{"dir":"stacked","children":[{"pane":"p1"},{"dir":"across","children":[{"pane":"p2"},{"pane":"p3"}]}]}', "first/second tree");
ok(A.treeWidth(A.splitTree(rows, ["p1","p2","p3"])) === 2 && A.treeWidth(A.splitTree(bsp, ["p1","p2","p3"])) === 2, "tree width");
ok(A.treeWidth({ dir: "across", children: [{ pane: "a" }, { pane: "b" }, { dir: "across", children: [{ pane: "c" }, { pane: "d" }] }] }) === 4, "nested across adds up");
ok(A.splitTree(rows, ["p1","p9"]) === null, "a pane the document lacks -> no tree");
ok(A.splitTree({ x: ["p1","p2"] }, ["p1","p2"]) === null, "no direction word -> no tree");
ok(A.splitTree({ type: "row", children: [{ id: "p1" }, { id: "p2", also: "p1" }] }, ["p1","p2"]) === null, "overlapping halves -> no tree");
ok(A.splitTree(null, ["p1"]) === null && A.splitTree(rows, []) === null, "nothing to read");
ok(A.localId("vps/p3", "vps") === "p3" && A.localId("p3", null) === "p3" && A.localId("other/p3", "vps") === "other/p3", "local pane id");

// desk roles: first agent of a tab keeps the tab's role, the rest differ
const roles = A.deskJobs(spaces, panes, agents, { main: "developer" });
ok(roles.get("a1") === "developer", "first agent wears the tab's role");
ok(roles.get("a3") !== "developer" && roles.get("a9") !== "developer" && roles.get("a3") !== roles.get("a9"), "tab mates get their own roles");
ok(roles.size === 4, "every agent has a role, settled tabs too");

// tabs lib: the same seats and roles, so a tab's faces match its desks
const tRoles = T.deskJobs(spaces, panes, agents, { main: "developer" });
ok([...roles].every(([k, v]) => tRoles.get(k) === v) && tRoles.size === roles.size, "tab bar roles match office roles");
ok(T.tabDesks(spaces, panes, agents).get("t1").map((d) => d.agent?.address ?? "-").join() === "a1,-,a3,a9", "tab seats in pane order");
ok(T.portraitPath("manager") === A.portraitPath("manager"), "tabs lib shares portrait path");
ok(T.parseCache === undefined && T.deskPath === undefined, "tabs lib has only the seating helpers");

// labels, tips, colours
const shell = { program: { name: "zsh", shell: true }, title: "khoenv@khoenv:~/smartgift/sg-AI/coyle-member-sync", cwd: "/home/k/smartgift/sg-AI/coyle-member-sync" };
ok(A.deskLabel({ agent: { title: "✳ Fix login bug", program: { name: "Claude Code" } } }) === "Fix login bug", "spinner marks dropped");
ok(A.deskLabel({ agent: { title: "  ", program: { name: "Claude Code" } } }) === "Claude Code", "empty title -> program");
ok(A.deskLabel({ agent: { title: "khoenv@khoenv:~/x", program: { name: "Codex" } } }) === "Codex", "prompt title -> program");
ok(A.deskLabel({ agent: { title: "a\u202eb" } }) === "ab", "bidi stripped");
ok(A.deskLabel({ pane: shell }) === "Terminal", "shell -> Terminal");
ok(A.deskLabel({ pane: { program: { name: "Neovim", shell: false }, title: "x" } }) === "Neovim", "other program -> its name");
ok(A.deskLabel({ pane: { mod: "browser", title: "" } }) === "browser", "mod pane -> mod");
ok(A.shortPath("/home/k/smartgift/sg-AI/coyle-member-sync") === "…/sg-AI/coyle-member-sync", "short path");
ok(A.deskTip({ job: "tester", agent: { status: "blocked", title: "e2e", program: { name: "Codex" } }, space: { name: "api" }, tab: { name: "1" } }) === "Tester · Needs you\nCodex\ne2e\napi › 1", "tip");
ok(A.deskTip({ pane: shell, space: { name: "api" }, tab: { name: "1" } }) === "Terminal\n…/sg-AI/coyle-member-sync\napi › 1", "terminal tip");
ok(A.withAlpha("#6fb6ad", "24") === "#6fb6ad24" && A.withAlpha("#e0a44a55", "88") === "#e0a44a88", "alpha");
ok(A.withAlpha("red", "24") === "red", "non-hex untouched");
ok(A.mixHex("#000000", "#ffffff", 0.5) === "#808080" && A.mixHex("#6fb6ad", "#6fb6ad", 0.3) === "#6fb6ad", "mix");
ok(A.mixHex("red", "#ffffff", 0.5) === "red", "mix leaves non-hex");
ok(A.spaceColor({ ansi6: "#6fb6ad", accent: "#e0a44a" }, { s1: "ansi6" }, "s1") === "#6fb6ad", "space colour");
ok(A.spaceColor({ muted: "#b0a894", accent: "#e0a44a" }, { s1: "ansi6" }, "s1") === "#b0a894", "unknown key -> muted");
ok(A.spaceColor({ accent: "#e0a44a" }, null, "s1") === "#e0a44a", "no colours, no muted -> accent");

// wide office: filters, counts, fit, times
ok(A.filterPlan(plan, "all") === plan && A.filterPlan(null, "working").length === 0, "no filter keeps the plan");
const busyPlan = A.filterPlan(plan, "working");
ok(busyPlan.length === 1 && busyPlan[0].tabs.length === 1 && busyPlan[0].tabs[0].desks.map((d) => d.agent.address).join() === "a1,a9", "working filter keeps working desks only");
ok(A.filterPlan(plan, "blocked").flatMap((r) => r.tabs.flatMap((c) => c.desks.map((d) => d.agent.address))).join() === "a3,a6", "blocked filter across rugs");
ok(A.filterPlan(plan, "done").length === 0, "nothing done -> empty office");
ok(JSON.stringify(A.tally(agents)) === '{"working":2,"blocked":2,"done":0,"idle":0}' && A.tally([{ status: "odd" }]).idle === 1, "tally");
ok(A.fitAcross(590, 120, 8) === 4 && A.fitAcross(260, 80, 6) === 3 && A.fitAcross(50, 120, 8) === 1 && A.fitAcross(9000, 120, 8) === 6, "desks across");
const now = 1_700_000_000_000;
ok(A.ago(now - 20_000, now) === "now" && A.ago(now - 4 * 60_000, now) === "4m", "ago minutes");
ok(A.ago(now - 125 * 60_000, now) === "2h 5m" && A.ago(now - 120 * 60_000, now) === "2h" && A.ago(now - 50 * 3_600_000, now) === "2d", "ago hours, days");
ok(A.ago((now - 4 * 60_000) / 1000, now) === "4m", "ago takes seconds");
ok(A.ago(null, now) === "" && A.ago(0, now) === "" && A.ago(now + 60_000, now) === "now", "ago edge cases");
ok(JSON.stringify(A.deskState({ status: "working" }, { working_since: now - 12 * 60_000 }, now)) === '{"status":"working","text":"Working · 12m"}', "working state");
ok(A.deskState({ status: "blocked" }, { changed_at: now - 3 * 60_000 }, now).text === "Needs you · 3m", "blocked state");
ok(A.deskState({ status: "weird" }, {}, now).text === "Idle" && A.deskState(null, {}, now) === null, "unknown state, no agent");

// screens read with hc, replies
const ESC = String.fromCharCode(27), RLO = String.fromCharCode(0x202e);
ok(JSON.stringify(A.screenLines(`a${ESC}[31mred${ESC}[0m\n\nlast  \n\n`, 5)) === '["ared","","last"]', "escapes out, trailing blanks dropped");
ok(A.screenLines("1\n2\n3\n4", 2).join() === "3,4", "last n lines");
ok(A.screenLines(`x${RLO}y\tz\r\nw`).join("|") === "xy    z|w", "bidi out, tabs, CRLF");
ok(A.screenLines(null).length === 0 && A.screenLines("a", 0).length === 0, "nothing to read");
ok(A.screenLines("a".repeat(300), 1, 10)[0].length === 10, "long lines cut");
ok(A.firstLine("\n  error: no such terminal t9\nmore") === "error: no such terminal t9" && A.firstLine(null) === "", "first line");
ok(A.parseReplies(JSON.stringify(["go on", " ", 5, "x".repeat(81), "  run   it "])).join("|") === "go on|run it", "replies cleaned");
ok(A.parseReplies("nope") === A.DEFAULT_REPLIES && A.parseReplies("[]") === A.DEFAULT_REPLIES && A.parseReplies("{}") === A.DEFAULT_REPLIES, "bad replies -> defaults");
ok(A.parseReplies(JSON.stringify(Array.from({ length: 12 }, (_, i) => `r${i}`))).length === 8, "at most eight replies");

// the boss
const brief = A.bossBrief({ goal: "  add Google\nlogin  ", playbook: "/h/mods/office-agents/boss.md", argv: ["claude"], folder: "/w/web app", space: "web-app", most: 4 });
ok(brief.endsWith("Goal: add Google login") && !brief.includes("\n"), "brief: one line, goal last");
ok(brief.includes("--cwd '/w/web app' <agent> \"<task>\"") && brief.includes("<agent>: `claude --dangerously-skip-permissions`,") && brief.includes("at most 4 hires working at a time") && brief.includes('"web-app"'), "brief: hire command, cap, space");
ok(brief.includes("Read your playbook now and follow it: /h/mods/office-agents/boss.md") && brief.includes("office.say=") && brief.includes("--label office.task="), "brief: playbook and labels");
ok(!A.bossBrief({ goal: "x" }).includes("playbook") && A.bossBrief({ goal: "x" }).includes("hc --skill"), "brief without a playbook");
ok(A.bossBrief({ goal: "x", argv: [] }).includes("<agent>: `claude --dangerously-skip-permissions`,") && !A.bossBrief({ goal: "x" }).includes("--cwd"), "brief: defaults");
ok(A.labelOf({ labels: { "office.say": "Hired 3" } }, "office.say") === "Hired 3" && A.labelOf({ labels: ["office.task=fix nav", "x=y"] }, "office.task") === "fix nav", "labels: map, k=v");
ok(A.labelOf({ labels: [{ key: "office.say", value: "Planning" }] }, "office.say") === "Planning" && A.labelOf({}, "office.say") === "" && A.labelOf(null, "x") === "", "labels: objects, none");
ok(A.labelOf({ labels: { "office.say": `a${ESC}[31mb\nmore` } }, "office.say") === "ab" && A.labelOf({ labels: { constructor: "x" } }, "toString") === "", "labels: one clean line, own keys only");
ok(A.bossBrief({ goal: "x", argv: ["codex", "--model", "o3"] }).includes("`codex --model o3 --dangerously-bypass-approvals-and-sandbox`"), "brief: agent argv");
const menu = A.bossBrief({ goal: "x", argv: ["claude"], hires: [["agy"], ["claude"], ["pi"], ["omp"]] });
ok(menu.includes("<agent>: `claude --dangerously-skip-permissions` or `agy --dangerously-skip-permissions -i` or `pi` or `omp --auto-approve`, flags exactly"), "brief: own agent first, installed ones once each");
ok(A.hireCommand(["/usr/bin/codex"]) === "/usr/bin/codex --dangerously-bypass-approvals-and-sandbox" && A.hireCommand(["claude", "--dangerously-skip-permissions"]) === "claude --dangerously-skip-permissions", "hire command: by name, flags once");
ok(A.hireCommand(["gemini"]) === "gemini --yolo -i" && A.hireCommand([]) === "claude --dangerously-skip-permissions" && A.hireCommand(["constructor"]) === "constructor", "hire command: prompt flag last, default, own keys only");
const playbookText = readFileSync(new URL("../mods/office-agents/boss.md", import.meta.url), "utf8");
ok(Object.keys(A.HIRE_FLAGS).every((k) => playbookText.includes(`\`${A.hireCommand([k])}\``)), "playbook lists every hire command");
ok(A.isHire({ name: "tester-e2e" }) && A.isHire({ name: "x", labels: { "office.task": "fix nav" } }) && !A.isHire({ name: "npm" }) && !A.isHire(undefined), "a hire: role name or task label");
const quiet = A.standIn({ address: "t8", name: "developer-nav", program: { name: "pi" } }, null, { tab: { id: "c1" } });
ok(quiet.standIn && quiet.status === null && quiet.tab === "c1" && quiet.pane === null && quiet.program.name === "pi", "stand-in: at the boss's tab, no status");
ok(A.standIn({ address: "t8", name: "x" }, { pane: "p4", tab: "c2", focused: true }, { tab: { id: "c1" } }).tab === "c2", "stand-in: in its own pane");
ok(A.deskState(quiet, {}, 0).text === "Running" && A.deskTip({ job: "developer", agent: quiet, space: { name: "s" }, tab: { name: "Boss" } }).startsWith("Developer · Running, no status"), "stand-in: Running, never a status");
ok(A.roleFromName("tester-e2e") === "tester" && A.roleFromName("frontend_nav") === "developer" && A.roleFromName("ui.polish") === "designer", "role from name");
ok(A.roleFromName("bob") === null && A.roleFromName(null) === null && A.roleFromName("x-docs") === "writer", "role from a later word, or none");
const terms = [{ address: "t3" }, { address: "t4", parent: "t3" }, { address: "t5", parent: "t3" }, { address: "t6", parent: "t9" },
  { address: "vps/t2", parent: "t1" }, { address: "vps/t1" }];
ok(A.staffOf(terms, "t3").join() === "t4,t5" && A.staffOf(terms, "vps/t1").join() === "vps/t2" && A.staffOf(terms, "").length === 0, "boss's staff");
ok(A.staffOf([...terms, { address: "t7", parent: "t3", state: "finished" }], "t3").join() === "t4,t5", "boss's staff: finished hires gone");
ok(JSON.stringify([1, 2, 3, 4].map(A.seatStep)) === '[{"from":"boss","place":"right"},{"from":"last","place":"down"},{"from":"boss","place":"down"},null]', "seating steps");
const claudeAsk = ["╭──────────────╮", "│ Bash command │", "│              │", "│   git push origin feat/login │", "│   Push the branch │", "│              │",
  "│ Do you want to proceed? │", "│ ❯ 1. Yes │", "│   2. Yes, and don't ask again for git push │", "│   3. No, and tell Claude what to do differently (esc) │", "╰──────────────╯"];
const asked = A.parsePrompt(claudeAsk);
ok(asked.options.map((o) => o.key).join() === "1,2,3" && asked.options[0].label === "Yes" && asked.options[2].label.startsWith("No, and tell"), "prompt options");
ok(asked.question.join("|") === "git push origin feat/login|Push the branch|Do you want to proceed?", "prompt question");
const plain = A.parsePrompt(["Running tool", "", "Allow write to config? [y/n]"]);
ok(plain.options.length === 0 && plain.question.join("|") === "Running tool|Allow write to config? [y/n]", "no numbered choices");
ok(A.parsePrompt(null).options.length === 0, "nothing to parse");
ok(A.speechLine(["● Hired tester-e2e and frontend-nav", "", "✻ Waiting for the team… (2m · ↓ 1k tokens · esc to interrupt)", "> ", "? for shortcuts"]) === "✻ Waiting for the team…", "speech: spinner without its hint");
ok(A.speechLine(["● Done: 3 changes merged", "────", "│ > │"]) === "● Done: 3 changes merged" && A.speechLine([]) === "", "speech: skips the input box");
ok(A.speechLine(["● Planning the login work", "", "auto mode on (shift+tab to cycle)"]) === "● Planning the login work", "speech: skips the mode line");
ok(A.speechLine(["● Hired 2", "⏵⏵ plan mode on"]) === "● Hired 2", "speech: skips plan mode");

// finding each space's boss
ok(A.isBossTab({ name: " Boss " }) && !A.isBossTab({ name: "Bossy" }) && !A.isBossTab(null), "boss tab by name");
const claudeProg = { agent: true, key: "claude" }, shellProg = { agent: false, shell: true, key: "shell" };
const bossSpaces = [{ id: "s1", tabs: [{ id: "b1", name: "Boss" }] }, { id: "s2", tabs: [{ id: "b2", name: "boss" }] }, { id: "s3", tabs: [{ id: "x3", name: "Work" }] }];
const bossPanes = [
  { tab: "b1", pane: "p1", terminal: "t1", status: "working", program: claudeProg },
  { tab: "b1", pane: "p2", terminal: "t2", status: "working", program: claudeProg },
  { tab: "b2", pane: "p3", terminal: "t3", status: null, program: shellProg },
];
const bossTerms = [{ address: "t1" }, { address: "t2", parent: "t1" }, { address: "t3", program: shellProg }];
ok(JSON.stringify(A.findBosses({ spaces: bossSpaces, panes: bossPanes, terminals: bossTerms, agents: [{ address: "t1" }, { address: "t2" }] })) === '{"s1":"t1"}',
  "boss: the agent nobody started, never a hire or a shell");
const parked = [{ address: "t9", state: "live", program: claudeProg, labels: { "office.role": "boss", "office.space": "s3" } }];
ok(A.findBosses({ spaces: bossSpaces, panes: [], terminals: parked, agents: [] }).s3 === "t9", "boss: labelled, found without a pane or a Boss tab");
ok(A.findBosses({ spaces: bossSpaces, panes: [], terminals: [{ ...parked[0], state: "finished" }], agents: [] }).s3 === undefined, "boss: a finished one is gone");
ok(A.findBosses({ spaces: bossSpaces, panes: [], terminals: [{ ...parked[0], program: shellProg }], agents: [] }).s3 === undefined, "boss: a labelled shell is not one");
ok(A.findBosses({ spaces: bossSpaces, panes: [], terminals: [{ ...parked[0], labels: { "office.role": "boss", "office.space": "gone" } }], agents: [] }).s3 === undefined, "boss: label for a space that is gone");
const twoBosses = [parked[0], { ...parked[0], address: "t8" }];
ok(A.findBosses({ spaces: bossSpaces, panes: [], terminals: twoBosses, agents: [], prev: { s3: "t8" } }).s3 === "t8", "boss: the last one wins a tie");
ok(JSON.stringify(A.findBosses({})) === "{}", "boss: nothing given");

// inbox lib
ok(I.kindOf("a.PNG") === "image", "ext case-insensitive");
ok(I.kindOf(".hidden.png") === null, "hidden file rejected");
ok(I.kindOf("a/b.png") === null, "path rejected");
ok(I.kindOf("a.sh") === null, "not whitelisted");
const listing = I.parseListing("1700000000 12 /in/a.png\n1700000001 3 /in/b.sh\n1700000002 4 /other/c.png", "/in");
ok(listing.length === 1 && listing[0].name === "a.png", "listing filters kind+prefix");
const trav = I.parseListing("1700000000 12 /in/../etc/p.png", "/in");
ok(trav.length === 0, "listing rejects path traversal by kind/prefix");
ok(I.openCommand("/in/a.png", "/in")?.cmd === "/usr/bin/open", "open allowed");
ok(I.openCommand("/etc/passwd", "/in") === null, "open outside rejected");
ok(I.formatSize(2048) === "2.0 KB", "format size");
console.log(`pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
