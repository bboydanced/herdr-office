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

// desk roles: first agent of a tab keeps the tab's role, the rest differ
const roles = A.deskJobs(plan, { main: "developer" }, A.tabNames(spaces, agents));
ok(roles.get("a1") === "developer", "first agent wears the tab's role");
ok(roles.get("a3") !== "developer" && roles.get("a9") !== "developer" && roles.get("a3") !== roles.get("a9"), "tab mates get their own roles");
ok(T.portraitPath(T.jobIn("main", T.assignJobs(T.tabNames(spaces, agents), { main: "developer" }))) === A.portraitPath(roles.get("a1")), "tab bar face matches first desk");

// labels, tips, colours
ok(A.deskLabel("✳ Fix login bug", "Claude") === "Fix login bug", "spinner marks dropped");
ok(A.deskLabel("  ", "Claude Code") === "Claude Code", "empty title -> program");
ok(A.deskLabel("a\u202eb", null) === "ab", "bidi stripped");
ok(A.deskTip({ job: "tester", agent: { status: "blocked", title: "e2e", program: { name: "Codex" } }, space: { name: "api" }, tab: { name: "1" } }) === "Tester · Needs you\nCodex\ne2e\napi › 1", "tip");
ok(A.deskTip({ pane: { title: "zsh" }, space: { name: "api" }, tab: { name: "1" } }).startsWith("zsh\nNo agent here"), "empty desk tip");
ok(A.withAlpha("#6fb6ad", "24") === "#6fb6ad24" && A.withAlpha("#e0a44a55", "88") === "#e0a44a88", "alpha");
ok(A.withAlpha("red", "24") === "red", "non-hex untouched");
ok(A.spaceColor({ ansi6: "#6fb6ad", accent: "#e0a44a" }, { s1: "ansi6" }, "s1") === "#6fb6ad", "space colour");
ok(A.spaceColor({ muted: "#b0a894", accent: "#e0a44a" }, { s1: "ansi6" }, "s1") === "#b0a894", "unknown key -> muted");
ok(A.spaceColor({ accent: "#e0a44a", __proto__: { x: 1 } }, null, "s1") === "#e0a44a", "no colours -> accent");

// tabs lib: only the role helpers
ok(T.portraitPath("manager") === A.portraitPath("manager"), "tabs lib shares portrait path");
ok(T.parseCache === undefined && T.spritePath === undefined, "tabs lib has no cache or sprite helpers");

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
