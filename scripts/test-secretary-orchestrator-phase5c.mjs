#!/usr/bin/env node
/**
 * AI 秘書 Phase 5-C — Command Center UI tests
 *   node scripts/test-secretary-orchestrator-phase5c.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CC_FILES = [
  "admin-ai-secretary-agent-registry.js",
  "admin-ai-secretary-classifier.js",
  "admin-ai-secretary-human-gate.js",
  "admin-ai-secretary-task-queue.js",
  "admin-ai-secretary-ci-ingest.js",
  "admin-ai-secretary-ops-event.js",
  "admin-ai-secretary-deepseek-classifier.js",
  "admin-ai-secretary-orchestrator.js",
  "admin-ai-secretary-morning-report.js",
  "admin-ai-secretary-command-center-ui.js",
];

const HSG = "admin-ai-human-send-gate.js";

function mockEl(extra = {}) {
  const el = {
    disabled: false,
    value: "",
    hidden: false,
    dataset: {},
    textContent: "",
    innerHTML: "",
    appendChild() {},
    focus() {},
    addEventListener() {},
    querySelector() {
      return mockEl();
    },
    querySelectorAll() {
      return [];
    },
    ...extra,
  };
  el.querySelectorAll = function querySelectorAll() {
    return [];
  };
  return el;
}

function loadModules(files, extra = {}) {
  const store = {};
  const commandCenter = mockEl({ innerHTML: "" });
  commandCenter.querySelectorAll = () => [];
  const doc = {
    readyState: "complete",
    querySelector(sel) {
      if (String(sel).includes("command-center")) return commandCenter;
      if (/agent-levels|morning-report/.test(String(sel))) return mockEl();
      return null;
    },
    createElement() {
      return mockEl({ className: "", classList: { add() {} } });
    },
    addEventListener() {},
  };
  const sandbox = {
    window: {
      document: doc,
      dispatchEvent() {},
      addEventListener() {},
      setTimeout(fn) {
        if (typeof fn === "function") fn();
        return 0;
      },
      clearTimeout() {},
      localStorage: {
        getItem(k) {
          return store[k] ?? null;
        },
        setItem(k, v) {
          store[k] = String(v);
        },
        removeItem(k) {
          delete store[k];
        },
      },
      TasuAdminAiDailyInbox: { buildInboxItems: () => [] },
      TasuAdminAiOpsWatch: { buildOpsWatchSnapshot: () => ({ anomalies: [] }) },
      ...extra,
    },
    document: doc,
    setTimeout(fn) {
      if (typeof fn === "function") fn();
      return 0;
    },
    clearTimeout() {},
    console,
  };
  sandbox.globalThis = sandbox.window;
  const ctx = vm.createContext(sandbox);
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
  }
  return { window: sandbox.window, commandCenter };
}

let pass = 0;
let fail = 0;

function ok(label) {
  console.log(`PASS: ${label}`);
  pass += 1;
}

function bad(label, detail) {
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
  fail += 1;
}

function assert(cond, label, detail) {
  if (cond) ok(label);
  else bad(label, detail);
}

// --- Setup ---
const w = loadModules([...CC_FILES, HSG]);
w.window.TasuAdminAiHumanSendGate.clearForTests();

// --- Queue filters ---
w.window.TasuSecretaryTaskQueue.clearForTests();
w.window.TasuSecretaryCommandCenterUI.clearForTests();
w.window.TasuSecretaryTaskQueue.enqueue({
  userText: "A",
  agentId: "builder",
  levelId: "L2",
  source: "chat",
  classification: { severity: "medium" },
});
w.window.TasuSecretaryTaskQueue.enqueue({
  userText: "B",
  agentId: "security",
  levelId: "L3",
  source: "chat",
  classification: { severity: "critical" },
});
w.window.TasuSecretaryTaskQueue.enqueue({
  userText: "C",
  agentId: "secretary",
  levelId: "L4",
  source: "chat",
  classification: { severity: "high" },
});

const all = w.window.TasuSecretaryTaskQueue.listTasks();
assert(all.length === 3, "Queue 3 tasks");
const l3only = w.window.TasuSecretaryTaskQueue.listTasks({ levelId: "L3" });
assert(l3only.length === 1 && l3only[0].levelId === "L3", "Filter level L3");
const crit = w.window.TasuSecretaryTaskQueue.listTasks({ urgency: "critical" });
assert(crit.length === 1, "Filter urgency critical");
assert(w.window.TasuSecretaryTaskQueue.mapUrgency({ severity: "high" }) === "high", "mapUrgency");

// --- Command Center render ---
w.window.TasuSecretaryCommandCenterUI.renderAll();
const html = w.commandCenter.innerHTML;
assert(html.includes("Task Queue"), "CC renders queue section");
assert(html.includes("L4"), "CC renders L4 badge");
assert(html.includes("ops-cc-filters"), "CC renders filters");
assert(html.includes("L3 承認キュー"), "CC renders L3 panel");
assert(html.includes("L4 オーナー対応"), "CC renders L4 panel");
assert(html.includes("朝レポート"), "CC renders morning section");
assert(html.includes("OpsEvent"), "CC renders detail section");

// --- Empty states ---
w.window.TasuSecretaryTaskQueue.clearForTests();
w.window.TasuSecretaryCommandCenterUI.renderAll();
assert(w.commandCenter.innerHTML.includes("Queue なし") || w.commandCenter.innerHTML.includes("一致するタスクがありません"), "Empty queue state");

// --- L3 approve without send ---
const wH = loadModules([...CC_FILES, HSG]);
wH.window.TasuAdminAiHumanSendGate.clearForTests();
wH.window.TasuSecretaryTaskQueue.clearForTests();
wH.window.TasuSecretaryCommandCenterUI.clearForTests();
const item = wH.window.TasuAdminAiHumanSendGate.enqueuePendingItem({
  source: "orchestrator",
  sourceId: "task-x",
  category: "support_answer",
  proposal: "返信案テスト",
  payload: { taskId: "task-x", orchestrator: true, agentId: "secretary" },
});
const approve = wH.window.TasuAdminAiHumanSendGate.approvePendingWithoutSend(item.id);
assert(approve.ok && approve.noSend === true, "approvePendingWithoutSend");
assert(wH.window.TasuAdminAiHumanSendGate.readPendingQueue().length === 0, "pending cleared after approve");

// --- Morning report UI ---
const report = {
  generatedAt: new Date().toISOString(),
  events: [{ id: "e1", title: "CI fail", source: "ci", severity: "high", status: "failed" }],
  eventSummary: { total: 1, bySource: { ci: 1 }, highSeverity: 1 },
  queue: [{ levelId: "L3", userText: "urgent", urgency: "critical" }],
  ciSummary: { headline: "CI: 1 件失敗" },
};
wH.window.TasuSecretaryCommandCenterUI.setMorningReport(report);
assert(wH.commandCenter.innerHTML.includes("CI: 1 件失敗"), "Morning report CI headline in UI");
assert(wH.commandCenter.innerHTML.includes("本日の優先対応"), "Morning report priorities section");

// --- HTML script order ---
const dashHtml = fs.readFileSync(path.join(root, "admin-operations-dashboard.html"), "utf8");
const talkHtml = fs.readFileSync(path.join(root, "talk-ops-room.html"), "utf8");
for (const htmlFile of [dashHtml, talkHtml]) {
  assert(htmlFile.includes("data-ops-secretary-command-center"), "HTML command center slot");
  const o = htmlFile.indexOf("admin-ai-secretary-orchestrator.js");
  const m = htmlFile.indexOf("admin-ai-secretary-morning-report.js");
  const c = htmlFile.indexOf("admin-ai-secretary-command-center-ui.js");
  const p = htmlFile.indexOf("admin-ai-secretary-phase2.js");
  assert(o > 0 && m > o && c > m && p > c, "script order phase5c stack");
}

console.log(`\n--- Phase 5-C ${pass}/${pass + fail} PASS ---`);
if (fail) process.exit(1);

console.log("\nRunning Phase 5-B regression …");
const b = spawnSync(process.execPath, ["scripts/test-secretary-orchestrator-phase5b.mjs"], {
  cwd: root,
  stdio: "inherit",
});
if (b.status !== 0) {
  console.error("FAIL: Phase 5-B regression");
  process.exit(1);
}
ok("Phase 5-B regression (incl. 5-A)");

console.log(`\n=== Phase 5-C ALL ${pass + 1}/${pass + 1} PASS ===`);
