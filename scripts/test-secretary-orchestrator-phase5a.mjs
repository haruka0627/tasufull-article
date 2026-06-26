#!/usr/bin/env node
/**
 * AI 秘書 Phase 5-A — Orchestrator Core tests
 *   node scripts/test-secretary-orchestrator-phase5a.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ORCH_FILES = [
  "admin-ai-secretary-agent-registry.js",
  "admin-ai-secretary-classifier.js",
  "admin-ai-secretary-human-gate.js",
  "admin-ai-secretary-task-queue.js",
  "admin-ai-secretary-orchestrator.js",
];

const PHASE2_DEPS = [
  "admin-ai-secretary-ops-context-sanitize.js",
  "admin-ai-secretary-ops-context.js",
  "admin-ai-secretary-deepseek-adapter.js",
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
  "admin-ai-secretary-phase2.js",
];

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
    requestSubmit() {},
    querySelector(sel) {
      const s = String(sel || "");
      if (/input|send|secretary|phase4-status-icon|phase4-status-label/.test(s)) return mockEl();
      return null;
    },
    ...extra,
  };
  return el;
}

function loadModules(files) {
  const doc = {
    readyState: "complete",
    querySelector(sel) {
      const s = String(sel || "");
      if (/chat-log|secretary-input|secretary-send|phase4-status|agent-levels|phase2-chat-form|phase7/.test(s)) {
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
    },
    document: doc,
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

const w = loadModules(ORCH_FILES);
const Registry = w.TasuSecretaryAgentRegistry;
const Classifier = w.TasuSecretaryClassifier;
const Gate = w.TasuSecretaryHumanGate;
const Queue = w.TasuSecretaryTaskQueue;
const Orchestrator = w.TasuSecretaryOrchestrator;

Queue.clearForTests();
Orchestrator.clearForTests();

assert(Registry?.listAgents?.().length === 19, "Registry lists 19 agents");
assert(Boolean(Registry?.getAgent?.("builder")), "Registry getAgent builder");
assert(Boolean(Registry?.getAgent?.("devops")), "Registry getAgent devops");
assert(Registry?.resolveAgent?.("unknown")?.id === "secretary", "Registry default secretary");

const builderCls = Classifier.classify("Builder 案件の確認");
assert(builderCls.primaryAgentId === "builder", "Classifier Builder → builder");

const platformCls = Classifier.classify("Platform 掲載について");
assert(platformCls.primaryAgentId === "platform", "Classifier Platform → platform");

const tlvCls = Classifier.classify("TLV ライブの状況");
assert(tlvCls.primaryAgentId === "tlv", "Classifier TLV → tlv");

const ciCls = Classifier.classify("Build failed on CI");
assert(ciCls.primaryAgentId === "ci", "Classifier Build → ci");

const deployCls = Classifier.classify("Deploy to production");
assert(deployCls.primaryAgentId === "release", "Classifier Deploy → release");

const secCls = Classifier.classify("Security alert on RLS");
assert(secCls.primaryAgentId === "security", "Classifier Security → security");

const dbCls = Classifier.classify("Database migration error");
assert(dbCls.primaryAgentId === "database", "Classifier Database → database");

const visionCls = Classifier.classify("Vision prompt quality issue");
assert(visionCls.primaryAgentId === "prompt-ai", "Classifier Vision → prompt-ai");

const uiCls = Classifier.classify("UI layout broken on mobile");
assert(uiCls.primaryAgentId === "ux-ui", "Classifier UI → ux-ui");

const docsCls = Classifier.classify("docs TODO update");
assert(docsCls.primaryAgentId === "docs", "Classifier docs → docs");

const l2 = Gate.resolveLevel({ userText: "本日の優先対応", severity: "medium" });
assert(l2.id === "L2", "Human Gate default L2");

const l3 = Gate.resolveLevel({ userText: "返金対応が必要", severity: "high" });
assert(l3.id === "L3", "Human Gate refund → L3");

const l4 = Gate.resolveLevel({ userText: "契約変更の相談", severity: "medium" });
assert(l4.id === "L4", "Human Gate contract → L4");

assert(Gate.requiresHumanApproval("L3") === true, "Human Gate L3 requires approval");
assert(Gate.requiresHumanApproval("L2") === false, "Human Gate L2 no approval");

Queue.clearForTests();
const t1 = Queue.enqueue({ userText: "test", agentId: "builder", levelId: "L2" });
assert(t1.status === "pending", "Queue enqueue pending");
Queue.updateStatus(t1.id, "running");
assert(Queue.getTask(t1.id)?.status === "running", "Queue update running");
Queue.updateStatus(t1.id, "completed");
assert(Queue.getTask(t1.id)?.status === "completed", "Queue update completed");
assert(Queue.STATUSES.length === 5, "Queue 5 statuses");

Queue.clearForTests();
Orchestrator.clearForTests();
const out = await Orchestrator.processMessage("Builder 相談");
assert(out.ok === true, "Orchestrator processMessage ok");
assert(out.agent?.id === "builder", "Orchestrator assigns builder");
assert(out.task?.status === "completed", "Orchestrator builder → completed (L2)");
assert(out.agentResult?.stub === true, "Orchestrator agent stub");

const outRefund = await Orchestrator.processMessage("返金の問い合わせ");
assert(outRefund.level?.id === "L3", "Orchestrator refund → L3");
assert(outRefund.task?.status === "waiting_human", "Orchestrator L3 → waiting_human");

Queue.clearForTests();
Orchestrator.clearForTests();
const w2 = loadModules(PHASE2_DEPS);
assert(typeof w2.TasuAdminAiSecretaryPhase2?.sendMessage === "function", "Phase2 sendMessage loaded");

(async () => {
  w2.TasuSecretaryTaskQueue.clearForTests();
  w2.TasuSecretaryOrchestrator.clearForTests();
  w2.TasuAdminAiSecretaryPhase2.clearHistoryForTests?.();

  if (w2.TasuSecretaryDeepSeekAdapter) {
    w2.TasuSecretaryDeepSeekAdapter.completeTurn = async ({ mockFallback, userText }) => ({
      reply: "phase5a mock reply",
      fallback_used: false,
      modelLabel: "test",
    });
  }

  const sendOut = await w2.TasuAdminAiSecretaryPhase2.sendMessage("Platform 掲載の確認");
  assert(sendOut.ok === true, "Phase2 sendMessage returns ok");
  const last = w2.TasuSecretaryOrchestrator.getLastResult();
  assert(last?.agent?.id === "platform", "Phase2 integration classifies Platform");
  assert(last?.task?.status === "completed", "Phase2 integration queue completed");

  console.log(`\n--- unit ${pass}/${pass + fail} PASS ---`);

  if (fail) {
    process.exit(1);
  }

  console.log("\nRunning build:pages …");
  const build = spawnSync(process.execPath, ["deploy/cloudflare/stage-cloudflare-pages.mjs"], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (build.status !== 0) {
    console.error("FAIL: npm run build:pages (stage script)");
    process.exit(1);
  }
  ok("build:pages PASS");

  console.log(`\n=== ALL ${pass}/${pass + fail} PASS ===`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
