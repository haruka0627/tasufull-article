#!/usr/bin/env node
/**
 * Builder Command Dashboard Phase 6-H tests
 *   node scripts/test-builder-dashboard-phase6h.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(root, "builder");
const reportsDir = path.join(root, "reports");

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

function loadDashboard() {
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
    document: {
      readyState: "complete",
      addEventListener() {},
      querySelector() {
        return null;
      },
    },
    console,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(
    fs.readFileSync(path.join(builder, "builder-project-store.js"), "utf8"),
    sandbox,
    { filename: "builder-project-store.js" }
  );
  vm.runInNewContext(fs.readFileSync(path.join(builder, "builder-project-dashboard.js"), "utf8"), sandbox, {
    filename: "builder-project-dashboard.js",
  });
  return sandbox.TasuBuilderProjectDashboard;
}

const dashHtml = fs.readFileSync(path.join(builder, "project-dashboard.html"), "utf8");
const dashJs = fs.readFileSync(path.join(builder, "builder-project-dashboard.js"), "utf8");
const dashCss = fs.readFileSync(path.join(builder, "builder-project-dashboard.css"), "utf8");
const indexHtml = fs.readFileSync(path.join(builder, "index.html"), "utf8");

assert(dashHtml.includes("data-builder-pd-kpi"), "dashboard KPI section");
assert(dashHtml.includes("data-builder-pd-today-list"), "dashboard today list");
assert(dashHtml.includes("data-builder-pd-active-list"), "dashboard active list");
assert(dashHtml.includes("data-builder-pd-ntf-list"), "dashboard notifications list");
assert(dashHtml.includes("data-builder-pd-activity-list"), "dashboard activity list");
assert(dashHtml.includes("data-builder-pd-upcoming-list"), "dashboard upcoming list");
assert(dashHtml.includes('href="builder-ai.html"'), "builder AI link preserved");
assert(dashJs.includes("getFinanceSummary"), "reads getFinanceSummary");
assert(dashJs.includes("getNotificationSummary"), "reads getNotificationSummary");
assert(dashJs.includes("getDocumentSummary"), "reads getDocumentSummary");
assert(dashJs.includes("getTodayProjects"), "reads getTodayProjects");
assert(dashJs.includes("getWorkingProjects"), "reads getWorkingProjects");
assert(dashJs.includes("getDelayedProjects"), "reads getDelayedProjects");
assert(dashJs.includes("getThisWeekProjects"), "reads getThisWeekProjects");
assert(!dashJs.includes("previewNotificationIntent"), "no notification intent");
assert(!dashJs.includes("TasuBuilderAIVision"), "no vision AI");
assert(!dashJs.includes("TasuAiModelGateway"), "no gateway");
assert(dashCss.includes("builder-pd-kpi"), "dashboard css");
assert(indexHtml.includes("project-dashboard.html"), "index link to dashboard");

const Store = loadStore();
Store.clearForTests();
Store.ensureSeed();

assert(typeof Store.getFinanceSummary === "function", "store finance summary exists");
assert(typeof Store.getNotificationSummary === "function", "store notification summary exists");
assert(Store.getFinanceSummary().totalGrossProfit >= 0, "finance summary readable");
assert(Store.getNotificationSummary().unreadCount >= 0, "notification summary readable");
assert(Store.getDocumentSummary().totalDocuments >= 0, "document summary readable");
assert(Array.isArray(Store.getTodayProjects()), "today projects array");
assert(Array.isArray(Store.getWorkingProjects()), "working projects array");
assert(Array.isArray(Store.getDelayedProjects()), "delayed projects array");

const Dashboard = loadDashboard();
assert(typeof Dashboard?.refresh === "function", "dashboard module export");

console.log(`\n--- Phase 6-H unit ${pass}/${pass + fail} ---`);
if (fail) process.exit(1);

console.log("\nRunning phase6g regression …");
const p6g = spawnSync("node", ["scripts/test-builder-notification-center-phase6g.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (p6g.status !== 0) {
  bad("phase6g regression");
  process.exit(1);
}
ok("phase6g regression");

console.log("\nRunning build:pages …");
const build = spawnSync("npm", ["run", "build:pages"], { cwd: root, stdio: "inherit", shell: true });
if (build.status !== 0) {
  bad("build:pages");
  process.exit(1);
}
ok("build:pages PASS");

const distDash = path.join(root, "deploy/cloudflare/dist/builder/project-dashboard.html");
assert(fs.existsSync(distDash), "dist dashboard html");

console.log("\nCapturing dashboard screenshot …");
const shotRun = spawnSync("node", ["scripts/capture-builder-dashboard-phase6h.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (shotRun.status !== 0) {
  bad("dashboard screenshot");
} else {
  ok("dashboard screenshot → reports/builder-dashboard-phase6h-1280.png");
}

console.log(`\n=== ALL ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
