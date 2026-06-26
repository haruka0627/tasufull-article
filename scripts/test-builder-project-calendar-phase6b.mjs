#!/usr/bin/env node
/**
 * Builder Project Calendar Phase 6-B tests
 *   node scripts/test-builder-project-calendar-phase6b.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(root, "builder");

let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function assert(cond, label, detail) {
  if (cond) ok(label);
  else bad(label, detail);
}

const storage = {};

function loadStore() {
  const sandbox = {
    localStorage: {
      getItem(k) {
        return storage[k] ?? null;
      },
      setItem(k, v) {
        storage[k] = String(v);
      },
      removeItem(k) {
        delete storage[k];
      },
    },
    console,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(
    fs.readFileSync(path.join(builder, "builder-project-store.js"), "utf8"),
    sandbox,
    { filename: "builder-project-store.js" }
  );
  return sandbox.TasuBuilderProjectStore;
}

const calHtml = fs.readFileSync(path.join(builder, "project-calendar.html"), "utf8");
const calJs = fs.readFileSync(path.join(builder, "builder-project-calendar.js"), "utf8");
const calCss = fs.readFileSync(path.join(builder, "builder-project-calendar.css"), "utf8");
const detailHtml = fs.readFileSync(path.join(builder, "project-detail.html"), "utf8");
const hubHtml = fs.readFileSync(path.join(builder, "project-hub.html"), "utf8");
const storeSrc = fs.readFileSync(path.join(builder, "builder-project-store.js"), "utf8");
const uiJs = fs.readFileSync(path.join(builder, "builder-ai-ui.js"), "utf8");

assert(calHtml.includes("builder-project-calendar.js"), "calendar html scripts");
assert(calHtml.includes("data-builder-pc-calendar-body"), "calendar body slot");
assert(calJs.includes("renderMonth") && calJs.includes("renderWeek"), "month/week views");
assert(calCss.includes("builder-pc-event"), "calendar css");
assert(detailHtml.includes("data-builder-pd-schedule-form"), "detail schedule form");
assert(hubHtml.includes("project-calendar.html"), "hub calendar link");
assert(storeSrc.includes("SCHEDULE_PHASES"), "store schedule phases");
assert(storeSrc.includes("applyScheduleIntent"), "store AI intent hook");
assert(uiJs.includes("prepareScheduleIntent"), "builder-ai schedule prep");
assert(storeSrc.includes("schedule_updated"), "timeline schedule event");

const Store = loadStore();
Store.clearForTests();
Store.ensureSeed();

assert(Store.SCHEDULE_PHASES.length === 8, "8 schedule phases", String(Store.SCHEDULE_PHASES.length));

const all = Store.listProjects();
assert(all.every((p) => p.schedulePhase), "seed has schedule phase");

const scheduled = Store.listScheduledProjects();
assert(scheduled.length >= 3, "scheduled projects", String(scheduled.length));

const delayed = Store.getDelayedProjects();
assert(delayed.some((p) => p.id === "PRJ-2026-003"), "delayed project seed");

const start = new Date();
start.setDate(start.getDate() + 5);
const end = new Date();
end.setDate(end.getDate() + 12);
const fmt = (d) => d.toISOString().slice(0, 10);
const upd2 = Store.updateSchedule("PRJ-2026-002", {
  scheduleStartDate: fmt(start),
  scheduleEndDate: fmt(end),
  schedulePhase: "site_survey",
  reason: "テスト日程更新",
});
assert(upd2.ok && upd2.project.schedulePhase === "site_survey", "schedule update");
assert(
  upd2.project.timeline.some((e) => e.type === "schedule_updated"),
  "timeline schedule_updated"
);

const preview = Store.previewScheduleIntent("PRJ-2026-001", {
  type: Store.SCHEDULE_INTENT_TYPES.RESCHEDULE_BY_DAYS,
  deltaDays: 7,
  source: "ai_assistant",
});
assert(preview.ok && preview.preview.scheduleStartDate, "intent preview reschedule");

const applied = Store.applyScheduleIntent("PRJ-2026-001", {
  type: Store.SCHEDULE_INTENT_TYPES.RESCHEDULE_BY_DAYS,
  deltaDays: 7,
  reason: "来週へ変更（テスト）",
  source: "ai_assistant",
});
assert(applied.ok, "intent apply");

const week = Store.getWeekRange(Store.todayDateOnly());
const weekProjects = Store.getProjectsForDateRange(week.start, week.end);
assert(Array.isArray(weekProjects), "week range query");

console.log(`\n--- Phase 6-B unit ${pass}/${pass + fail} ---`);
if (fail) process.exit(1);

console.log("\nRunning phase6a regression …");
const p6a = spawnSync("node", ["scripts/test-builder-project-hub-phase6a.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (p6a.status !== 0) {
  bad("phase6a regression");
  process.exit(1);
}
ok("phase6a regression");

console.log("\nRunning build:pages …");
const build = spawnSync("npm", ["run", "build:pages"], { cwd: root, stdio: "inherit", shell: true });
if (build.status !== 0) {
  bad("build:pages");
  process.exit(1);
}
ok("build:pages PASS");

assert(fs.existsSync(path.join(root, "deploy/cloudflare/dist/builder/project-calendar.html")), "dist calendar");
assert(
  fs.existsSync(path.join(root, "deploy/cloudflare/dist/builder/builder-project-calendar.js")),
  "dist calendar js"
);

console.log(`\n=== ALL ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
