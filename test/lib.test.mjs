// Pure-function tests for the office mods. No Herdr needed:
//
//     node test/lib.test.mjs

import * as A from "./../mods/office-agents/lib.js";
import * as Gr from "./../mods/office-agents/groups.js";
import * as T from "./../mods/office-tabs/lib.js";
import * as F from "./../mods/office-files/lib.js";
import { readFileSync } from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };

// roles and portraits
ok(A.JOBS.length === 8, "eight roles");
for (const r of A.JOBS) {
  ok(A.portraitPath(r) === `mods/office-agents/art/${r}.png`, `portrait ${r}`);
}
ok(A.portraitPath("../etc/passwd") === null, "traversal rejected");

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
ok(A.deskTip({ agent: { status: "blocked", title: "tester-e2e", program: { name: "Codex" } }, space: { name: "api" }, tab: { name: "1" } }) === "tester-e2e · Needs you\nCodex\napi › 1", "tip: its name, not its face");
ok(A.deskTip({ pane: shell, space: { name: "api" }, tab: { name: "1" } }) === "Terminal\n…/sg-AI/coyle-member-sync\napi › 1", "terminal tip");
ok(A.withAlpha("#6fb6ad", "24") === "#6fb6ad24" && A.withAlpha("#e0a44a55", "88") === "#e0a44a88", "alpha");
ok(A.withAlpha("red", "24") === "red", "non-hex untouched");
ok(A.mixHex("#000000", "#ffffff", 0.5) === "#808080" && A.mixHex("#6fb6ad", "#6fb6ad", 0.3) === "#6fb6ad", "mix");
ok(A.mixHex("red", "#ffffff", 0.5) === "red", "mix leaves non-hex");
ok(A.spaceColor({ ansi6: "#6fb6ad", accent: "#e0a44a" }, { s1: "ansi6" }, "s1") === "#6fb6ad", "space colour");
ok(A.spaceColor({ muted: "#b0a894", accent: "#e0a44a" }, { s1: "ansi6" }, "s1") === "#b0a894", "unknown key -> muted");
ok(A.spaceColor({ accent: "#e0a44a" }, null, "s1") === "#e0a44a", "no colours, no muted -> accent");
{
  const bk = A.backings({ canvas: "#181a28", chrome: "#24273a", surface: "#2a2e42", blocked: "#f28b7d" });
  ok(bk.shade === A.mixHex("#181a28", "#000000", 0.4) && bk.panel === "#24273a" && bk.button === "#2a2e42", "backings from the theme");
  ok(bk.alert === A.mixHex("#24273a", "#f28b7d", 0.14), "alert tinted by blocked");
  const bare = A.backings({ background: "#1e2030" });
  ok(bare.panel === "#1e2030" && bare.button === "#1e2030", "backings fall back to the background");
}

// groups you make yourself
const G = (id, name, spaces, folded = false) => ({ id, name, spaces, folded });
ok(Gr.readGroups(null).length === 0 && Gr.readGroups("x").length === 0 && Gr.readGroups([null, 3]).length === 0, "nothing in, nothing out");
ok(Gr.readGroups([G("g1", "  Checkout  ", ["s1", "s1", 7]), G("g1", "dup"), { name: "no id" }]).length === 1, "one per id, spaces deduped, junk dropped");
const g1 = Gr.readGroups([G("g1", "  Checkout  ", ["s1", "s1", 7])])[0];
ok(g1.name === "Checkout" && g1.spaces.join() === "s1" && g1.folded === false, "group read clean");
const deck = Gr.planGroups(plan, [G("g1", "One", ["s2"]), G("g2", "Empty", [])]);
ok(deck.map((d) => d.band?.name ?? "-").join() === "-,One", "a group sits where its first space is, an empty one nowhere");
ok(deck[0].rows.length === 1 && deck[0].rows[0].space.id === "s1" && deck[1].rows[0].space.id === "s2", "its spaces in the floor's order");
ok(Gr.planGroups(plan, []).length === 2 && Gr.planGroups(null, [G("g1", "x", ["s1"])]).length === 0, "no rows: no group");
ok(Gr.planGroups(plan, [G("a", "A", ["s1"]), G("b", "B", ["s1", "s2"])])[1].rows.length === 1, "a space in two groups stays in the first");

ok(Gr.planGroups([{ w: { id: "s2" } }, { w: { id: "s1" } }], [G("g", "G", ["s1", "s2"])], (r) => r.w.id)[0].rows.length === 2, "rows keyed another way (Spaces list)");
ok(Gr.groupOf([G("a", "A", ["s1"])], "s1") === "a" && Gr.groupOf([], "s1") === null, "group of a space");
const put = Gr.putGroup([G("a", "A", ["s1", "s2"], true), G("b", "B", ["s3"])], { id: "a", name: "A2", spaces: ["s1", "s3"] });
ok(put.map((g) => `${g.id}:${g.spaces.join("+")}:${g.folded}`).join() === "a:s1+s3:true,b::false", "putGroup: edit keeps place and fold, takes its spaces from others");
ok(Gr.putGroup([G("a", "A", ["s1"])], { id: "n", name: "N", spaces: ["s1"] }).map((g) => `${g.id}:${g.spaces.join("+")}`).join() === "a:,n:s1", "putGroup: a new group goes last");
const rg = Gr.regroup([G("a", "A", ["old", "s2"]), G("b", "B", ["s9"])], ["old"], [["new", "a"], ["s9", "a"], ["x", "gone"]]);
ok(rg.map((g) => `${g.id}:${g.spaces.join("+")}`).join() === "a:s2+new,b:s9", "regroup: closed id out, reopened id back, one group per space");
ok(Gr.regroup([G("a", "A", ["s1"])], ["zz"], []) === null, "regroup: nothing changed -> null");

const groupsSrc = readFileSync(new URL("../mods/office-agents/groups.js", import.meta.url), "utf8");
for (const m of ["office-spaces", "office-space-new"]) {
  ok(readFileSync(new URL(`../mods/${m}/groups.js`, import.meta.url), "utf8") === groupsSrc, `${m}/groups.js is a verbatim copy`);
}
const cardSrc = readFileSync(new URL("../mods/office-agents/card.js", import.meta.url), "utf8");
for (const m of ["office-menu", "office-new-menu", "office-add", "office-files"]) {
  ok(readFileSync(new URL(`../mods/${m}/card.js`, import.meta.url), "utf8") === cardSrc, `${m}/card.js is a verbatim copy`);
}

// the boss's flow
const W = (status) => ({ status });
ok(A.bossStage(W("idle"), []).stage === "plan" && !A.bossStage(W("idle"), []).live, "flow: a new boss waits to plan");
ok(A.bossStage(W("working"), []).stage === "plan" && A.bossStage(W("working"), []).live, "flow: working alone is planning");
const hiring = A.bossStage(W("idle"), [W("working"), W("blocked"), W("done")]);
ok(hiring.stage === "hire" && hiring.hired === 3 && hiring.busy === 2 && hiring.blocked && hiring.live, "flow: hires at work");
ok(A.bossStage(W("working"), [W("done"), W("idle")]).stage === "review", "flow: hires done, boss at it -> review");
ok(A.bossStage(W("done"), [W("done")]).stage === "report" && A.bossStage(W("done"), []).stage === "report", "flow: all quiet -> report");
ok(A.bossStage(null, null).step === 0, "flow: nothing known");
ok(A.bossStage(W("working"), [W("done")], "plan").stage === "plan" && A.bossStage(W("working"), [W("done")]).stage === "review", "flow: its office.stage wins while it works (a second goal)");
ok(A.bossStage(W("idle"), [W("working")], "review").stage === "review" && A.bossStage(W("working"), [], "nonsense").stage === "plan", "flow: label while hires work; a bad label is ignored");
ok(A.bossStage(W("idle"), [W("done")], "plan").stage === "plan" && A.bossStage(W("done"), [], "plan").stage === "report" && A.bossStage(W("idle"), [W("done")], "review").stage === "report", "flow: quiet -> report, unless it asks while planning");
ok(A.tabDesks([], [{ pane: "p1", tab: "t1", terminal: "a" }, { pane: "p2", tab: "t1", terminal: null, mod: "git-changes" }, { pane: "p3", tab: "t2", terminal: null, mod: "git-changes" }], []).get("t1").length === 1
  && !A.tabDesks([], [{ pane: "p3", tab: "t2", terminal: null, mod: "git-changes" }], []).has("t2"), "mod panes are views, not desks");

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
ok(brief.includes("--cwd '/w/web app' <agent> \"$(cat <<'EOF'") && brief.includes("never the task in double quotes") && brief.includes("<agent>: `claude --dangerously-skip-permissions`,") && brief.includes("at most 4 hires working at a time") && brief.includes('"web-app"'), "brief: hire command, cap, space");
ok(brief.includes("Read your playbook now and follow it: /h/mods/office-agents/boss.md") && brief.includes("office.say=") && brief.includes("office.stage=plan|hire|review|report") && brief.includes("--label office.task="), "brief: playbook and labels");
ok(brief.includes("hc run --bg --no-notify --name <role>-<topic>") && brief.includes("first_message.sent") && brief.includes("not instructions") && brief.includes("`hc --skill` only if you get stuck"), "brief: check the task went in, reports aren't orders, manual on demand");
const tbrief = A.bossBrief({ goal: "x", argv: ["claude"], hires: [["claude"], ["agy"]], templates: { "claude --dangerously-skip-permissions": "office-claude" } });
ok(tbrief.includes("<agent>: `office-claude` or `agy --dangerously-skip-permissions -i` (office-* is a template") && !A.bossBrief({ goal: "x" }).includes("office-*"), "brief: templates by name");
ok(!A.bossBrief({ goal: "x" }).includes("playbook") && A.bossBrief({ goal: "x" }).includes("hc --skill"), "brief without a playbook");
const hbrief = A.bossBrief({ goal: "x", argv: ["claude"], folder: "/w/web app", hire: "/h/mods/office-agents/hire.sh" });
ok(hbrief.includes("sh /h/mods/office-agents/hire.sh --name <role>-<topic> --task \"<the task in a few words>\" --piece \"<its piece of the plan>\" --cwd '/w/web app' <agent> <<'EOF'") && !hbrief.includes("hc run --bg") && !hbrief.includes("\n"), "brief: hire.sh when there is one");
ok(A.bossBrief({ goal: "x", hire: "" }).includes("hc run --bg --no-notify") && A.bossBrief({ goal: "x", hire: null }).includes("then )\""), "brief: hc run without hire.sh");
ok(A.bossBrief({ goal: "x", argv: [] }).includes("<agent>: `claude --dangerously-skip-permissions`,") && !A.bossBrief({ goal: "x" }).includes("--cwd"), "brief: defaults");
ok(A.labelOf({ labels: { "office.say": "Hired 3" } }, "office.say") === "Hired 3" && A.labelOf({ labels: ["office.task=fix nav", "x=y"] }, "office.task") === "fix nav", "labels: map, k=v");
ok(A.labelOf({ labels: [{ key: "office.say", value: "Planning" }] }, "office.say") === "Planning" && A.labelOf({}, "office.say") === "" && A.labelOf(null, "x") === "", "labels: objects, none");
ok(A.labelOf({ labels: { "office.say": `a${ESC}[31mb\nmore` } }, "office.say") === "ab" && A.labelOf({ labels: { constructor: "x" } }, "toString") === "", "labels: one clean line, own keys only");
ok(A.bossBrief({ goal: "x", argv: ["codex", "--model", "o3"] }).includes("`codex --model o3 --no-daemon --dangerously-bypass-approvals-and-sandbox`"), "brief: agent argv");
const menu = A.bossBrief({ goal: "x", argv: ["claude"], hires: [["agy"], ["claude"], ["pi"], ["omp"]] });
ok(menu.includes("<agent>: `claude --dangerously-skip-permissions` or `agy --dangerously-skip-permissions -i` or `pi` or `omp --auto-approve`, exactly as written"), "brief: own agent first, installed ones once each");
ok(A.hireCommand(["/usr/bin/codex"]) === "/usr/bin/codex --no-daemon --dangerously-bypass-approvals-and-sandbox" && A.hireCommand(["claude", "--dangerously-skip-permissions"]) === "claude --dangerously-skip-permissions", "hire command: by name, flags once");
ok(A.hireCommand(["gemini"]) === "gemini --yolo -i" && A.hireCommand([]) === "claude --dangerously-skip-permissions" && A.hireCommand(["constructor"]) === "constructor", "hire command: prompt flag last, default, own keys only");
const playbookText = readFileSync(new URL("../mods/office-agents/boss.md", import.meta.url), "utf8");
ok(Object.keys(A.HIRE_FLAGS).every((k) => playbookText.includes(`\`${A.hireCommand([k])}\``)), "playbook lists every hire command");
ok(A.isHire({ name: "tester-e2e" }) && A.isHire({ name: "x", labels: { "office.task": "fix nav" } }) && !A.isHire({ name: "npm" }) && !A.isHire(undefined), "a hire: role name or task label");
ok(!A.isHire({ name: "tests" }) && !A.isHire({ name: "build" }) && !A.isHire({ name: "job-tests" }) && !A.isHire({ name: "frontend-nav" }), "jobs and loose names are not hires");
ok(A.underHc(["codex", "--model", "o3"]).join(" ") === "codex --model o3 --no-daemon" && A.underHc(["codex", "--no-daemon"]).length === 2 && A.underHc(["claude"]).join(" ") === "claude" && A.underHc(null).length === 0, "boss argv: what hc needs");
const tpl = A.hireTemplate(["gemini"]);
ok(tpl.name === "office-gemini" && tpl.command === "gemini --yolo" && tpl.text.startsWith("---\nname: office-gemini\n") && tpl.text.includes("\ncommand: gemini --yolo\n---\n") && tpl.text.includes("Do not start other agents"), "template: flags without the task flag, rules as body");
ok(A.hireTemplate([]).command === "claude --dangerously-skip-permissions" && A.hireTemplate(["/opt/bin/cursor-agent"]).name === "office-cursor-agent" && A.hireTemplate(["codex"]).command === "codex --no-daemon --dangerously-bypass-approvals-and-sandbox", "template: default, path, codex");
ok(A.hireTemplate(["claude", "--model", "a b"]) === null && A.hireTemplate(["claude", "$(x)"]) === null, "template: none for a command hc would refuse");
const quiet = A.standIn({ address: "t8", name: "developer-nav", program: { name: "pi" } }, null, { tab: { id: "c1" } });
ok(quiet.standIn && quiet.status === null && quiet.tab === "c1" && quiet.pane === null && quiet.program.name === "pi", "stand-in: at the boss's tab, no status");
ok(A.standIn({ address: "t8", name: "x" }, { pane: "p4", tab: "c2", focused: true }, { tab: { id: "c1" } }).tab === "c2", "stand-in: in its own pane");
ok(A.deskState(quiet, {}, 0).text === "Running" && A.deskTip({ agent: quiet, space: { name: "s" }, tab: { name: "Boss" } }).startsWith("developer-nav · Running, no status"), "stand-in: Running, never a status");
// faces: one each, while the eight roles last
const seats = new Map([["b1", "manager"], ["h1", "developer"], ["h2", "developer"], ["h3", "developer"], ["h4", "developer"]]);
const faces = A.uniqueFaces(seats, ["b1"]);
ok(faces.get("b1") === "manager", "faces: the boss keeps the manager's");
ok(new Set(faces.values()).size === faces.size, "faces: no two agents share one");
ok(faces.get("h1") === "developer" && faces.get("h2") !== "developer" && faces.get("h3") !== "developer", "faces: a team of developers is a room of different people");
const room = A.uniqueFaces(seats, ["b1", "h1"]);
ok(room.get("b1") === "manager" && room.get("h1") === "developer" && room.get("h2") !== "developer", "faces: the ones kept keep theirs");
const many = new Map([...Array(10)].map((_, i) => [`a${i}`, "developer"]));
ok(A.uniqueFaces(many).size === 10 && new Set(A.uniqueFaces(many).values()).size === 8, "faces: only past eight does one repeat");
ok(A.uniqueFaces(new Map([["x", "wizard"]]), ["x"]).size === 0 && A.uniqueFaces(new Map(), ["nope"]).size === 0 && A.uniqueFaces(null).size === 0, "faces: unknown roles and nothing given");
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
// the tab a team leads from: its own, its hire's (a renamed Boss tab), the Boss tab
const leadSpaces = [{ id: "s1", tabs: [{ id: "t1", name: "Boss" }, { id: "t2", name: "renamed" }] }];
ok(A.bossTabOf(leadSpaces[0], "t2")?.id === "t2" && A.bossTabOf(leadSpaces[0], null, ["t2"])?.id === "t2" && A.bossTabOf(leadSpaces[0], null)?.id === "t1",
  "team tab: its own, else a hire's, else the Boss tab");
ok(A.bossTabOf({ id: "s", tabs: [{ id: "x", name: "Boss" }] }, "gone", ["gone"])?.id === "x" && A.bossTabOf({ id: "s", tabs: [] }, "t9") === null && A.bossTabOf(null) === null,
  "team tab: a tab that is gone falls back; no tabs, none");
// the goal it works on, and a board left by the goal before it
ok(A.oneLine("  add Google\nlogin\n\nand a  test  ", 40) === "add Google login and a test" && A.oneLine("abcdef", 3) === "abc" && A.oneLine(null) === "", "one line: lines joined, cut, nothing");
ok(A.goalOf({ labels: { "office.goal": "add Google login\nand a test" } }) === "add Google login", "goal: its label, one line");
ok(A.goalOf({}, 4) === "" && A.goalOf(null) === "", "goal: none");
ok(A.planAge({ plan: "nav;login", mark: { plan: "nav;login", goal: "old" } }).stale && A.planAge({ plan: "nav;login", mark: { plan: "nav;login", goal: "old" } }).previous === "old",
  "board: the plan the last goal left is old");
ok(!A.planAge({ plan: "pay;billing", mark: { plan: "nav;login", goal: "old" } }).stale && !A.planAge({ plan: "nav", mark: null }).stale
  && !A.planAge({ plan: "", mark: { plan: "", goal: "x" } }).stale && !A.planAge({}).stale, "board: a new plan is fresh; no mark, no age");

// the whiteboard
ok(JSON.stringify(A.parsePlan(" nav:ok ; login; e2e tests:MERGED;;Nav; a:b ")) === '[{"piece":"nav","mark":"ok"},{"piece":"login","mark":null},{"piece":"e2e tests","mark":"merged"},{"piece":"a:b","mark":null}]', "plan: pieces, marks, unique");
ok(A.parsePlan(null).length === 0 && A.parsePlan(Array(12).fill(0).map((_, i) => `p${i}`).join(";")).length === 8, "plan: nothing, at most 8");
const wbHires = [
  { address: "t2", name: "developer-nav", piece: "", status: "working" },
  { address: "t3", name: "tester-x", piece: "E2E tests", status: "idle", cwd: "/r/.worktrees/e2e" },
  { address: "t4", name: "writer-docs", piece: "", task: "write docs", status: null },
  { address: "t5", name: "designer-login", piece: "", status: "blocked" },
];
const wb = A.planNotes("nav:ok;login:ok;e2e tests:ok;deploy", wbHires);
ok(wb.map((n) => `${n.piece}=${n.state}=${n.hire?.address ?? "-"}`).join("|") === "nav=working=t2|login=blocked=t5|e2e tests=ok=t3|deploy=todo=-|write docs=hired=t4",
  "notes: by piece label, by name, live status wins over a mark, extras last");
ok(A.planNotes("x", [{ address: "t9", piece: "x", status: "done" }])[0].state === "done" && A.planNotes("", []).length === 0, "notes: done is to review; nothing, no board");
ok(JSON.stringify(A.worktreeOf("/home/me/app/.worktrees/nav/")) === '{"root":"/home/me/app","name":"nav","path":"/home/me/app/.worktrees/nav"}', "worktree from cwd");
ok(A.worktreeOf("/home/me/app") === null && A.worktreeOf("/a/.worktrees/x/src") === null && A.worktreeOf(null) === null, "not a worktree");
ok(JSON.stringify(A.parseProbe("office/nav\n 3 files changed, 40 insertions(+), 5 deletions(-)\n@@\n      2\n")) === '{"branch":"office/nav","files":3,"add":40,"del":5,"dirty":2}', "probe: diff and dirty");
ok(JSON.stringify(A.parseProbe("office/a\n 1 file changed, 1 insertion(+)\n@@\n0\n")) === '{"branch":"office/a","files":1,"add":1,"del":0,"dirty":0}', "probe: singular, no deletions");
ok(A.parseProbe("office/a\n@@\n0").files === 0 && A.parseProbe("HEAD\n@@\n0") === null && A.parseProbe("x") === null, "probe: no diff, detached, junk");
ok(A.acceptMessage({ piece: "nav", name: "developer-nav", branch: "office/nav" }).startsWith("[Office] The person accepts \"nav\" (developer-nav)") && A.acceptMessage({ piece: "a", name: "b", branch: "office/a" }).includes("(git merge --no-ff office/a)")
  && A.acceptMessage({ piece: "a", name: "b", branch: "office/a", root: "/my app" }).includes("git -C '/my app' merge --no-ff office/a"), "accept message, in its repo");
ok(/office\.piece=/.test(A.bossBrief({ goal: "g", argv: ["claude"] })) && /office\.plan=/.test(A.bossBrief({ goal: "g", argv: ["claude"] })), "brief: whiteboard labels");
const playbook = readFileSync(new URL("../mods/office-agents/boss.md", import.meta.url), "utf8");
ok(playbook.includes("office.plan") && playbook.includes("office.piece") && playbook.includes("[Office] The person accepts"), "playbook: whiteboard and accept");

// after hours
ok(JSON.stringify(A.parseHours("22-6")) === '{"from":22,"to":6}' && JSON.stringify(A.parseHours("x")) === '{"from":19,"to":7}' && A.parseHours("5-5").from === 19 && A.parseHours("25-3").from === 19, "hours");
const at = (h) => new Date(2026, 10, 16, h, 30);
ok(A.isNight(at(23)) && A.isNight(at(3)) && !A.isNight(at(7)) && !A.isNight(at(12)) && A.isNight(at(19)), "night across midnight");
ok(A.isNight(at(13), { from: 12, to: 14 }) && !A.isNight(at(14), { from: 12, to: 14 }), "night within a day");
const before = new Map([["t1", "working"], ["t2", "working"], ["t3", "done"]]);
const ev = A.nightEvents(before, [{ address: "t1", status: "done" }, { address: "t2", status: "blocked", program: { name: "Codex" } }, { address: "t3", status: "done" }, { address: "t4", status: "done" }], new Map([["t1", "developer-nav"]]), 5);
ok(ev.map((e) => `${e.name}:${e.status}:${e.at}`).join("|") === "developer-nav:done:5|Codex:blocked:5", "night events: changes to done or blocked, seen before");
ok(JSON.stringify(A.morningSummary([...ev, { address: "t2", name: "Codex", status: "done" }])) === '{"done":["developer-nav","Codex"],"blocked":[]}' && A.morningSummary(null).done.length === 0, "morning: last word per agent");

// office files
ok(JSON.stringify(F.parseListing("f\0b.txt\0d\0src\0f\0a.md\0")) === '[{"name":"src","dir":true},{"name":"a.md","dir":false},{"name":"b.txt","dir":false}]', "files: listing, folders first");
ok(JSON.stringify(F.parseStatus(" M a.js\0?? new/b.ts\0D  gone.md\0UU c.js\0A  d.js\0")) === '[{"path":"a.js","mark":"M"},{"path":"new/b.ts","mark":"A"},{"path":"gone.md","mark":"D"},{"path":"c.js","mark":"U"},{"path":"d.js","mark":"A"}]', "files: status marks");
ok(F.parseStamps("1700000000\0a.js\0x\0b\0").get("a.js") === 1700000000000 && F.parseStamps("1700000000\0a.js\0x\0b\0").get("b") === 0, "files: stamps");
const wtText = "worktree /r\nHEAD 1\nbranch refs/heads/main\n\nworktree /r/.worktrees/nav\nHEAD 2\nbranch refs/heads/office/nav\n\nworktree /r/.worktrees/x/deep\nHEAD 3\ndetached\n\nworktree /elsewhere\nbranch refs/heads/b\n";
ok(JSON.stringify(F.parseWorktrees(wtText, "/r/")) === '[{"path":"/r/.worktrees/nav","branch":"office/nav"}]', "files: boss worktrees only");
ok(JSON.stringify(F.parseNameStatus("M\0a.js\0A\0n.js\0D\0g.js\0")) === '[{"path":"a.js","mark":"M"},{"path":"n.js","mark":"A"},{"path":"g.js","mark":"D"}]', "files: branch name-status");
ok(F.mergeChanges([{ path: "a", mark: "A" }, { path: "b", mark: "M" }], [{ path: "a", mark: "M" }]).map((x) => x.path + x.mark).join() === "aM,bM", "files: uncommitted mark wins");
ok(F.changedList([{ path: "a", mark: "M" }, { path: "b", mark: "A" }, { path: "c", mark: "M" }], new Map([["a", 5], ["b", 9]])).map((x) => x.path).join() === "b,a,c", "files: last written first");
ok([...F.changedDirs(["a/b/c.js", "a/d.js", "e.js"])].sort().join() === "a,a/b", "files: changed folders");
ok(F.rankFiles(["src/app/main.js", "main.js", "docs/domain.md", "lib/remain.js", "x/m/a/i/n.txt"], "main").join() === "main.js,src/app/main.js,lib/remain.js,docs/domain.md,x/m/a/i/n.txt", "files: filter ranks names first");
ok(F.rankFiles(["a"], "").length === 0 && F.rankFiles(["abc"], "xyz").length === 0, "files: empty query, no match");
const txt = "one\ntwo\nthree\nfour";
ok(F.lineRange(txt, { start: 4, end: 7 }).from === 2 && F.lineRange(txt, { start: 4, end: 7 }).to === 2, "files: one line picked");
ok(JSON.stringify(F.lineRange(txt, { start: 0, end: 8 })) === '{"from":1,"to":2}', "files: ending at a line start leaves it out");
ok(JSON.stringify(F.lineRange(txt, { start: 4, end: 15 })) === '{"from":2,"to":4}' && F.lineRange(txt, { start: 3, end: 3 }) === null, "files: lines, nothing picked");
ok(F.fileRef("a.js", null) === "a.js" && F.fileRef("a.js", { from: 3, to: 3 }) === "a.js:3" && F.fileRef("a.js", { from: 3, to: 9 }) === "a.js:3-9", "files: refs");
ok(F.refFor("/r/", "src/a.js", "/r") === "src/a.js" && F.refFor("/r", "src/a.js", "/r/.worktrees/x") === "/r/src/a.js" && F.refFor("/r", "a", null) === "/r/a", "files: relative only in the agent's root");
ok(F.langOf("a/b.tsx") === "js" && F.langOf("Makefile") === "txt" && F.langOf("x.rs") === "rs" && F.isMarkdown("README.MD") && !F.isMarkdown("a.js"), "files: languages");
ok(F.ago(0, 5) === "" && F.ago(1000, 30000) === "now" && F.ago(0 + 1, 1 + 5 * 60000) === "5m" && F.ago(1, 1 + 3 * 3600000) === "3h", "files: ago");
ok(JSON.stringify(F.splitPath("a/b/c.js")) === '{"name":"c.js","dir":"a/b"}' && F.splitPath("c.js").dir === "", "files: split path");
ok(F.parseAll("./a\0b/c\0\0").join() === "a,b/c" && F.parseAll(null).length === 0, "files: all files");

console.log(`pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
