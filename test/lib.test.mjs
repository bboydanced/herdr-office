// Pure-function tests for the office mods. No Herdr needed:
//
//     node test/lib.test.mjs

import * as A from "./../mods/office-agents/lib.js";
import * as T from "./../mods/office-tabs/lib.js";
import * as I from "./../mods/office-inbox/lib.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };

// roles
ok(A.JOBS.length === 8, "eight roles");
for (const r of A.JOBS) {
  ok(A.portraitPath(r) === `mods/office-agents/art/${r}.png`, `portrait ${r}`);
  for (const s of ["working","blocked","rest"]) ok(A.spritePath(r, s) === `mods/office-agents/sprites/${r}-${s}.gif`, `sprite ${r}-${s}`);
}
ok(A.spritePath("nope","working") === null, "unknown role -> no sprite");
ok(A.portraitPath("../etc/passwd") === null, "traversal rejected");
ok(A.spritePath("manager","done") === "mods/office-agents/sprites/manager-rest.gif", "done maps to rest");
ok(A.spritePath("manager","idle") === "mods/office-agents/sprites/manager-rest.gif", "idle maps to rest");

// job assignment
const jobs = { "Claude Code": "manager", "Bad Role": "wizard" };
ok(A.jobFor("claude code", jobs) === "manager", "case/space-insensitive match");
ok(A.jobFor("Bad Role", jobs) === null, "unknown role value -> null");
ok(A.jobFor("constructor", jobs) === null, "prototype key safe");
const assigned = A.assignJobs(["Claude Code","Frontend","Backend","Docs","Tests","Review","Deploy","Ops"], jobs);
ok(assigned.get("claude code") === "manager", "explicit job wins");
ok(new Set([...assigned.values()]).size === 8, "no duplicate roles within eight");

// cache parse
const good = A.parseCache(JSON.stringify({updatedAt: 1000, contextRemainingPct: 42, fiveHourRemainingPct: 88, sessionName: "  my  session ", model: "Opus 5.5", effort: "high"}));
ok(good.hp === 42 && good.sp === 88, "hp/sp parsed");
ok(good.name === "my session", "name collapsed+trimmed");
ok(A.modelText(good.model, good.effort) === "Opus 5.5 · high", "model line");
ok(A.parseCache("{") === null, "bad json -> null");
ok(A.parseCache(JSON.stringify({contextRemainingPct: 10})) === null, "missing updatedAt -> null");
ok(A.parseCache(JSON.stringify({updatedAt: 1, contextRemainingPct: 150}))?.hp === null, "out of range pct -> null");
ok(A.parseCache(JSON.stringify({updatedAt: 1, sessionName: "a‮b"}))?.name === "ab", "bidi stripped");

// gauge
ok(A.gauge(null, 1000, 1100).text === "—", "no value dash");
ok(A.gauge(50, null, 1100).text === "—", "no timestamp dash");
const g = A.gauge(50, 1000, 1000 + 301);
ok(g.text === "50%" && g.stale === true && g.pct === 50, "stale marks but keeps value");
const fresh = A.gauge(50, 1000, 1000 + 10);
ok(fresh.stale === false, "fresh not stale");

// paths
ok(A.cachePath("/home/x", "abc-1") === "/home/x/data/office/sessions/abc-1.json", "cache path");
ok(A.cachePath("/home/x", "../evil") === null, "cache path rejects traversal");
ok(A.cachePath("/home/x", "vps/t1") === null, "remote id has no local path");
ok(A.remoteCachePath("vps/t1")?.path === ".config/herdr-app/data/office/sessions/t1.json", "remote cache path");
ok(A.remoteCachePath("vps") === null, "single part -> null");

// tabs lib is the same minus model helpers
ok(T.portraitPath("manager") === A.portraitPath("manager"), "tabs lib shares portrait path");
ok(T.parseCache(JSON.stringify({updatedAt:1, contextRemainingPct: 5})).hp === 5, "tabs cache parse");
ok(T.modelText === undefined, "tabs lib has no modelText");

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
