// Pure-function tests for the office mods. No Herdr needed:
//
//     node test/lib.test.mjs

import * as A from "./../mods/office-agents/lib.js";
import * as T from "./../mods/office-tabs/lib.js";
import * as I from "./../mods/office-inbox/lib.js";
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
