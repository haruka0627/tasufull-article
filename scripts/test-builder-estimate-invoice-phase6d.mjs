#!/usr/bin/env node
/**
 * Builder Estimate/Invoice Phase 6-D tests
 *   node scripts/test-builder-estimate-invoice-phase6d.mjs
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

assert(storeSrc.includes("SCHEMA_VERSION = 6"), "SCHEMA v6");
assert(detailHtml.includes("data-builder-pd-estimate-form"), "detail estimate panel");
assert(detailHtml.includes("data-builder-pd-invoice-form"), "detail invoice panel");
assert(hubHtml.includes("data-builder-ph-est-inv-summary"), "hub est/inv summary");
assert(hubHtml.includes("見積状態"), "hub estimate columns");
assert(hubJs.includes("renderEstInvSummary"), "hub est/inv summary render");
assert(storeSrc.includes("estimate_updated"), "timeline estimate_updated");
assert(storeSrc.includes("invoice_updated"), "timeline invoice_updated");
assert(uiJs.includes("prepareEstimateIntent"), "builder-ai prepareEstimateIntent");
assert(uiJs.includes("prepareInvoiceIntent"), "builder-ai prepareInvoiceIntent");

const Store = loadStore();
Store.clearForTests();
Store.ensureSeed();

assert(Store.SCHEMA_VERSION === 6, "store schema 6");

const all = Store.listProjects();
assert(all.every((p) => p.estimate && p.invoice && p.contract && p.completion && Array.isArray(p.documents)), "estimate/invoice/contract/completion/documents defaults");

const calc = Store.calculateEstimate({
  items: [{ description: "テスト", quantity: 2, unitPrice: 50000 }],
});
assert(calc.subtotal === 100000, "estimate subtotal", String(calc.subtotal));
assert(calc.tax === 10000, "estimate tax", String(calc.tax));
assert(calc.total === 110000, "estimate total", String(calc.total));

const invCalc = Store.calculateInvoice({ subtotal: 200000 });
assert(invCalc.tax === 20000 && invCalc.total === 220000, "invoice calc");

const estSummary = Store.getEstimateSummary();
assert(estSummary.totalEstimate > 0, "estimate summary total");

const invSummary = Store.getInvoiceSummary();
assert(invSummary.totalInvoice > 0, "invoice summary total");

const uninvoiced = Store.getUninvoicedProjects();
assert(uninvoiced.length >= 2, "uninvoiced projects", String(uninvoiced.length));

const outstanding = Store.getOutstandingInvoices();
assert(outstanding.some((p) => p.id === "PRJ-2026-003"), "outstanding invoices");

const estUpd = Store.updateEstimate("PRJ-2026-002", {
  estimateStatus: "submitted",
  items: [{ description: "追加工事", quantity: 1, unitPrice: 100000 }],
  estimateReason: "テスト見積更新",
});
assert(estUpd.ok && estUpd.estimate.estimateStatus === "submitted", "updateEstimate");
assert(
  estUpd.project.timeline.some((e) => e.type === "estimate_updated"),
  "timeline estimate_updated"
);

const invUpd = Store.updateInvoice("PRJ-2026-001", {
  invoiceNumber: "INV-2026-001",
  invoiceStatus: "issued",
  subtotal: 1000000,
  issuedAt: Store.todayDateOnly(),
  dueDate: Store.todayDateOnly(),
  invoiceReason: "テスト請求更新",
});
assert(invUpd.ok && invUpd.invoice.invoiceStatus === "issued", "updateInvoice");
assert(
  invUpd.project.timeline.some((e) => e.type === "invoice_updated"),
  "timeline invoice_updated"
);

const estPreview = Store.previewEstimateIntent("見積状態: 承認済");
assert(estPreview.ok && estPreview.intent.estimateStatus === "approved", "previewEstimateIntent");

const invPreview = Store.previewInvoiceIntent("入金済");
assert(invPreview.ok && invPreview.intent.invoiceStatus === "paid", "previewInvoiceIntent");

const estApply = Store.applyEstimateIntent("PRJ-2026-001", {
  type: Store.ESTIMATE_INTENT_TYPES.SET_STATUS,
  estimateStatus: "approved",
  reason: "AI 承認テスト",
});
assert(estApply.ok, "applyEstimateIntent");

const invApply = Store.applyInvoiceIntent("PRJ-2026-003", {
  type: Store.INVOICE_INTENT_TYPES.MARK_PAID,
  reason: "AI 入金テスト",
});
assert(invApply.ok && invApply.invoice.invoiceStatus === "paid", "applyInvoiceIntent");

console.log(`\n--- Phase 6-D unit ${pass}/${pass + fail} ---`);
if (fail) process.exit(1);

console.log("\nRunning phase6c regression …");
const p6c = spawnSync("node", ["scripts/test-builder-project-finance-phase6c.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (p6c.status !== 0) {
  bad("phase6c regression");
  process.exit(1);
}
ok("phase6c regression");

console.log("\nRunning build:pages …");
const build = spawnSync("npm", ["run", "build:pages"], { cwd: root, stdio: "inherit", shell: true });
if (build.status !== 0) {
  bad("build:pages");
  process.exit(1);
}
ok("build:pages PASS");

console.log(`\n=== ALL ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
