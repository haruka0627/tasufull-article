#!/usr/bin/env node
/**
 * Builder Contract/Completion Phase 6-E tests
 *   node scripts/test-builder-contract-completion-phase6e.mjs
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

assert(storeSrc.includes("SCHEMA_VERSION = 5"), "SCHEMA v5");
assert(detailHtml.includes("data-builder-pd-contract-form"), "detail contract panel");
assert(detailHtml.includes("data-builder-pd-completion-form"), "detail completion panel");
assert(hubHtml.includes("data-builder-ph-contract-completion-summary"), "hub contract/completion summary");
assert(hubHtml.includes("契約状態"), "hub contract columns");
assert(hubHtml.includes("完了状態"), "hub completion columns");
assert(hubJs.includes("renderContractCompletionSummary"), "hub contract/completion summary render");
assert(storeSrc.includes("contract_updated"), "timeline contract_updated");
assert(storeSrc.includes("completion_updated"), "timeline completion_updated");
assert(uiJs.includes("prepareContractIntent"), "builder-ai prepareContractIntent");
assert(uiJs.includes("prepareCompletionIntent"), "builder-ai prepareCompletionIntent");

const Store = loadStore();
Store.clearForTests();
Store.ensureSeed();

assert(Store.SCHEMA_VERSION === 5, "store schema 5");

const all = Store.listProjects();
assert(all.every((p) => p.contract && p.completion), "contract/completion defaults");
assert(all.some((p) => p.contract?.contractStatus === "draft"), "seed contract draft");
assert(all.some((p) => p.completion?.completionStatus === "working"), "seed completion working");
assert(all.some((p) => p.completion?.completionStatus === "completed"), "seed completion completed");

const ctrUpd = Store.updateContract("PRJ-2026-001", {
  contractNumber: "CTR-2026-001",
  contractStatus: "sent",
  contractDate: Store.todayDateOnly(),
  contractReason: "テスト契約更新",
});
assert(ctrUpd.ok && ctrUpd.contract.contractStatus === "sent", "updateContract");
assert(
  ctrUpd.project.timeline.some((e) => e.type === "contract_updated"),
  "timeline contract_updated"
);

const cmpUpd = Store.updateCompletion("PRJ-2026-002", {
  completionStatus: "inspection",
  completedAt: Store.todayDateOnly(),
  ownerApproved: true,
  completionReason: "テスト完了更新",
});
assert(cmpUpd.ok && cmpUpd.completion.completionStatus === "inspection", "updateCompletion");
assert(
  cmpUpd.project.timeline.some((e) => e.type === "completion_updated"),
  "timeline completion_updated"
);

const working = Store.getWorkingProjects();
assert(working.length >= 0, "working projects query");

const completed = Store.getCompletedProjects();
assert(completed.some((p) => p.id === "PRJ-2026-003"), "completed projects");

const ctrSummary = Store.getContractSummary();
assert(ctrSummary.pendingCount >= 1, "contract summary pending", String(ctrSummary.pendingCount));

const cmpSummary = Store.getCompletionSummary();
assert(cmpSummary.completedCount >= 1, "completion summary completed", String(cmpSummary.completedCount));

const ctrPreview = Store.previewContractIntent("契約状態: 締結済");
assert(ctrPreview.ok && ctrPreview.intent.contractStatus === "signed", "previewContractIntent");

const cmpPreview = Store.previewCompletionIntent("完了状態: 引渡し済");
assert(cmpPreview.ok && cmpPreview.intent.completionStatus === "handed_over", "previewCompletionIntent");

const ctrApply = Store.applyContractIntent("PRJ-2026-002", {
  type: Store.CONTRACT_INTENT_TYPES.SET_STATUS,
  contractStatus: "signed",
  reason: "AI 契約テスト",
});
assert(ctrApply.ok, "applyContractIntent");

const cmpApply = Store.applyCompletionIntent("PRJ-2026-001", {
  type: Store.COMPLETION_INTENT_TYPES.SET_STATUS,
  completionStatus: "working",
  reason: "AI 完了テスト",
});
assert(cmpApply.ok && cmpApply.completion.completionStatus === "working", "applyCompletionIntent");

console.log(`\n--- Phase 6-E unit ${pass}/${pass + fail} ---`);
if (fail) process.exit(1);

console.log("\nRunning phase6d regression …");
const p6d = spawnSync("node", ["scripts/test-builder-estimate-invoice-phase6d.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (p6d.status !== 0) {
  bad("phase6d regression");
  process.exit(1);
}
ok("phase6d regression");

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

console.log("\nRunning vision phase5 regression …");
const p5 = spawnSync("node", ["scripts/test-builder-ai-vision-phase5.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (p5.status !== 0) {
  bad("phase5 vision regression");
  process.exit(1);
}
ok("phase5 vision regression");

console.log("\nRunning build:pages …");
const build = spawnSync("npm", ["run", "build:pages"], { cwd: root, stdio: "inherit", shell: true });
if (build.status !== 0) {
  bad("build:pages");
  process.exit(1);
}
ok("build:pages PASS");

console.log(`\n=== ALL ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
