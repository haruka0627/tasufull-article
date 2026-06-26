#!/usr/bin/env node
/**
 * Builder Project Finance Phase 6-C tests
 *   node scripts/test-builder-project-finance-phase6c.mjs
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

const detailHtml = fs.readFileSync(path.join(builder, "project-detail.html"), "utf8");
const hubHtml = fs.readFileSync(path.join(builder, "project-hub.html"), "utf8");
const storeSrc = fs.readFileSync(path.join(builder, "builder-project-store.js"), "utf8");
const uiJs = fs.readFileSync(path.join(builder, "builder-ai-ui.js"), "utf8");
const hubJs = fs.readFileSync(path.join(builder, "builder-project-hub.js"), "utf8");

assert(detailHtml.includes("data-builder-pd-finance-form"), "detail finance panel");
assert(hubHtml.includes("data-builder-ph-finance-summary"), "hub finance summary");
assert(hubHtml.includes("見積額"), "hub finance columns");
assert(hubJs.includes("renderFinanceSummary"), "hub finance summary render");
assert(storeSrc.includes("updateFinance"), "store updateFinance");
assert(storeSrc.includes("getFinanceSummary"), "store getFinanceSummary");
assert(storeSrc.includes("finance_updated"), "timeline finance_updated");
assert(uiJs.includes("prepareFinanceIntent"), "builder-ai prepareFinanceIntent");

const Store = loadStore();
Store.clearForTests();
Store.ensureSeed();

const all = Store.listProjects();
assert(all.length >= 3, "seed projects");
assert(all.every((p) => p.finance && typeof p.finance.estimateAmount === "number"), "finance defaults");

const calc = Store.calculateProjectFinance({ finance: { estimateAmount: 1000000, costAmount: 600000 } });
assert(calc.grossProfit === 400000, "grossProfit calc", String(calc.grossProfit));
assert(calc.grossProfitRate === 40, "grossProfitRate calc", String(calc.grossProfitRate));

const saved = Store.updateFinance("PRJ-2026-002", {
  estimateAmount: 3600000,
  costAmount: 2500000,
  paymentStatus: "partial",
  paymentDueDate: Store.todayDateOnly(),
  memo: "テスト更新",
  financeReason: "テスト収支更新",
});
assert(saved.ok && saved.finance.estimateAmount === 3600000, "updateFinance save");
assert(saved.finance.grossProfit === 1100000, "updateFinance grossProfit");
assert(
  saved.project.timeline.some((e) => e.type === "finance_updated"),
  "timeline finance_updated"
);

const unpaid = Store.getUnpaidProjects();
assert(unpaid.length >= 2, "unpaid projects", String(unpaid.length));

const overdue = Store.getOverduePaymentProjects();
assert(overdue.some((p) => p.id === "PRJ-2026-003"), "overdue payment project");

const summary = Store.getFinanceSummary();
assert(summary.totalEstimate > 0 && summary.projectCount >= 3, "finance summary totals");
assert(typeof summary.unpaidCount === "number", "summary unpaidCount");
assert(summary.overdueCount >= 1, "summary overdueCount", String(summary.overdueCount));

const preview = Store.previewFinanceIntent("見積 150万");
assert(preview.ok && preview.intent.estimateAmount === 1500000, "previewFinanceIntent");

const applied = Store.applyFinanceIntent("PRJ-2026-001", {
  type: Store.FINANCE_INTENT_TYPES.SET_ESTIMATE,
  estimateAmount: 1300000,
  reason: "AI 見積更新テスト",
});
assert(applied.ok && applied.finance.estimateAmount === 1300000, "applyFinanceIntent");

console.log(`\n--- Phase 6-C unit ${pass}/${pass + fail} ---`);
if (fail) process.exit(1);

console.log("\nRunning phase6b regression …");
const p6b = spawnSync("node", ["scripts/test-builder-project-calendar-phase6b.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (p6b.status !== 0) {
  bad("phase6b regression");
  process.exit(1);
}
ok("phase6b regression");

console.log("\nRunning build:pages …");
const build = spawnSync("npm", ["run", "build:pages"], { cwd: root, stdio: "inherit", shell: true });
if (build.status !== 0) {
  bad("build:pages");
  process.exit(1);
}
ok("build:pages PASS");

assert(
  fs.readFileSync(path.join(builder, "builder-project-store.js"), "utf8").includes("PAYMENT_STATUSES"),
  "dist source mirror finance"
);

console.log(`\n=== ALL ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
