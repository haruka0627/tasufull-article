#!/usr/bin/env node
/**
 * AI 秘書 Phase 5-B — Orchestrator ingest / gate / morning report tests
 *   node scripts/test-secretary-orchestrator-phase5b.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PHASE5B_FILES = [
  "admin-ai-secretary-agent-registry.js",
  "admin-ai-secretary-classifier.js",
  "admin-ai-secretary-human-gate.js",
  "admin-ai-secretary-task-queue.js",
  "admin-ai-secretary-ci-ingest.js",
  "admin-ai-secretary-ops-event.js",
  "admin-ai-secretary-deepseek-classifier.js",
  "admin-ai-secretary-orchestrator.js",
  "admin-ai-secretary-morning-report.js",
];

const HSG_FILE = "admin-ai-human-send-gate.js";

function mockEl(extra = {}) {
  return {
    disabled: false,
    value: "",
    hidden: false,
    dataset: {},
    textContent: "",
    innerHTML: "",
    appendChild() {},
    focus() {},
    addEventListener() {},
    requestSubmit() {},
    querySelector(sel) {
      const s = String(sel || "");
      if (/input|send|secretary|phase4-status|agent-levels|morning-report|task-queue/.test(s)) return mockEl();
      return null;
    },
    ...extra,
  };
}

function loadModules(files, extraSandbox = {}) {
  const store = {};
  const doc = {
    readyState: "complete",
    querySelector(sel) {
      const s = String(sel || "");
      if (/chat-log|secretary|phase4|agent-levels|morning-report|task-queue|phase2-chat-form|phase7/.test(s)) {
        return mockEl();
      }
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
      __SECRETARY_CI_FS__: {
        readJson(relPath) {
          const abs = path.join(root, relPath.replace(/^\//, ""));
          return JSON.parse(fs.readFileSync(abs, "utf8"));
        },
      },
      TasuTalkOpsAssistant: {
        parseTalkOpsCommand(text) {
          if (/未対応/.test(text)) {
            return { ok: true, label: text, rows: [{ title: "Ticket A", meta: "open", href: "#" }] };
          }
          return { ok: false, error: "no match" };
        },
      },
      TasuAdminAiDailyInbox: {
        buildInboxItems() {
          return [{ id: "inbox-1", title: "Test inbox", category: "needs_judgment", priority: 0, createdAt: new Date().toISOString() }];
        },
      },
      TasuAdminAiOpsWatch: {
        buildOpsWatchSnapshot() {
          return {
            generatedAt: new Date().toISOString(),
            anomalies: [{ id: "a1", severity: "critical", title: "Watch alert", reason: "test" }],
          };
        },
      },
      TasuSecretaryDeepSeekAdapter: {
        completeTurn: async ({ userText }) => {
          if (/structured-ok/.test(userText)) {
            return {
              reply: '{"primaryAgentId":"ci","category":"ci_failure","severity":"high","confidence":0.95}',
              fallback_used: false,
            };
          }
          return { reply: "", fallback_used: true };
        },
      },
      ...extraSandbox,
    },
    document: doc,
    setTimeout(fn) {
      if (typeof fn === "function") fn();
      return 0;
    },
    clearTimeout() {},
    console,
    sessionStorage: {
      _data: {},
      getItem(k) {
        return this._data[k] ?? null;
      },
      setItem(k, v) {
        this._data[k] = String(v);
      },
      removeItem(k) {
        delete this._data[k];
      },
    },
  };
  sandbox.globalThis = sandbox.window;
  const ctx = vm.createContext(sandbox);
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
  }
  return sandbox.window;
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

// --- CI ingest ---
const wCi = loadModules(["admin-ai-secretary-ci-ingest.js"]);
const gateData = JSON.parse(fs.readFileSync(path.join(root, "reports/gate-d-smoke-last.json"), "utf8"));
const ciEvents = wCi.TasuSecretaryCiIngest.ingestFromData(gateData, "reports/gate-d-smoke-last.json");
assert(ciEvents.length > 0, "CI ingest gate-d events");
assert(ciEvents.some((e) => e.status === "failed"), "CI ingest detects failed/blocked");

// --- OpsEvent ---
const wOps = loadModules(["admin-ai-secretary-ci-ingest.js", "admin-ai-secretary-ops-event.js"]);
await wOps.TasuSecretaryCiIngest.refreshCiReports();
const syncEvents = wOps.TasuSecretaryOpsEvent.collectAllSync();
assert(syncEvents.some((e) => e.source === "inbox"), "OpsEvent inbox");
assert(syncEvents.some((e) => e.source === "ops_watch"), "OpsEvent ops-watch");
assert(syncEvents.some((e) => e.source === "ci"), "OpsEvent ci");

// --- Classifier + command ---
const wCls = loadModules(["admin-ai-secretary-classifier.js"], {
  TasuTalkOpsAssistant: {
    parseTalkOpsCommand(text) {
      if (/未対応/.test(text)) return { ok: true, label: text, rows: [{ title: "X" }] };
      return { ok: false };
    },
  },
});
const cmdCls = wCls.TasuSecretaryClassifier.classifyWithCommand("未対応の問い合わせ");
assert(cmdCls.method?.includes("command"), "Classifier command merge");
assert(cmdCls.commandExtracted === 1, "Classifier command extracted count");

// --- DeepSeek structured fallback ---
const wDs = loadModules(["admin-ai-secretary-deepseek-classifier.js", "admin-ai-secretary-classifier.js"]);
const merged = await wDs.TasuSecretaryClassifier.classifyUnified("structured-ok CI failure", { tryDeepSeek: true });
assert(merged.primaryAgentId === "ci", "DeepSeek structured primaryAgentId");
assert(merged.method === "deepseek+regex", "DeepSeek structured method");

const regexOnly = await wDs.TasuSecretaryClassifier.classifyUnified("Builder only", { tryDeepSeek: true });
assert(regexOnly.primaryAgentId === "builder", "DeepSeek fail → regex builder");

// --- Human Send Gate + Orchestrator L3 ---
const wFull = loadModules([...PHASE5B_FILES, HSG_FILE]);
wFull.TasuSecretaryTaskQueue.clearForTests();
wFull.TasuSecretaryOrchestrator.clearForTests();
wFull.TasuAdminAiHumanSendGate.clearForTests();

const l3Out = await wFull.TasuSecretaryOrchestrator.processMessageAsync("返金の問い合わせ", { tryDeepSeek: false });
assert(l3Out.level?.id === "L3", "L3 level on refund");
assert(l3Out.task?.status === "waiting_human", "L3 waiting_human");
assert(l3Out.humanGateBridge?.bridged === true, "L3 bridged to Human Send Gate");
const pending = wFull.TasuAdminAiHumanSendGate.readPendingQueue();
assert(pending.length >= 1, "Human Send Gate pending item");
assert(pending[0].source === "orchestrator", "HSG source orchestrator");

const l4Out = await wFull.TasuSecretaryOrchestrator.processMessageAsync("契約変更の相談", { tryDeepSeek: false });
assert(l4Out.level?.id === "L4", "L4 contract");
assert(l4Out.humanGateBridge?.ownerOnly === true, "L4 owner only no gate enqueue");

// --- Morning report ---
await wFull.TasuSecretaryCiIngest.refreshCiReports();
const report = await wFull.TasuSecretaryMorningReport.buildReport();
assert(report.eventSummary.total > 0, "Morning report has events");
assert(Array.isArray(report.queue), "Morning report queue array");
assert(report.ciSummary.headline.includes("CI"), "Morning report CI headline");

// --- Script load order (admin dashboard) ---
const dashHtml = fs.readFileSync(path.join(root, "admin-operations-dashboard.html"), "utf8");
const talkHtml = fs.readFileSync(path.join(root, "talk-ops-room.html"), "utf8");
for (const html of [dashHtml, talkHtml]) {
  const idxRegistry = html.indexOf("admin-ai-secretary-agent-registry.js");
  const idxOrchestrator = html.indexOf("admin-ai-secretary-orchestrator.js");
  const idxPhase2 = html.indexOf("admin-ai-secretary-phase2.js");
  const idxMorning = html.indexOf("admin-ai-secretary-morning-report.js");
  const idxCc = html.indexOf("admin-ai-secretary-command-center-ui.js");
  const idxHsg = html.indexOf("admin-ai-human-send-gate.js");
  assert(idxRegistry > 0 && idxOrchestrator > idxRegistry, "script order registry before orchestrator");
  assert(idxMorning > idxOrchestrator && idxCc > idxMorning && idxPhase2 > idxCc, "script order orchestrator → morning → cc-ui → phase2");
  if (html.includes("admin-ai-human-send-gate.js")) {
    assert(idxHsg < idxRegistry, "human send gate before orchestrator stack");
  }
}

console.log(`\n--- Phase 5-B ${pass}/${pass + fail} PASS ---`);

if (fail) process.exit(1);

console.log("\nRunning Phase 5-A regression …");
const reg = spawnSync(process.execPath, ["scripts/test-secretary-orchestrator-phase5a.mjs"], {
  cwd: root,
  stdio: "inherit",
});
if (reg.status !== 0) {
  console.error("FAIL: Phase 5-A regression");
  process.exit(1);
}
ok("Phase 5-A regression 34/34");

console.log(`\n=== Phase 5-B ALL ${pass + 1}/${pass + 1} PASS (incl. 5-A) ===`);
