import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SAME_CAUSE_RETRY_MAX } from "./lib/closed-loop-contract.mjs";
import { BLOCKED_DESTINATIONS } from "./lib/tasful-external-transmission-policy-v1.mjs";
import {
  CURSOR_NATIVE_MODELS,
  NATIVE_LOOP_ACTIVE_TASK,
  applyHarmlessFixable,
  authorizeSemanticVerdict,
  controlPlaneRoute,
  denyForbiddenRuntimes,
  sameCauseRetryMax,
  verifyProbeState,
  writeInitialProbe,
} from "./lib/tasful-cursor-native-multi-model-closed-loop.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
function add(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail: String(detail || "") });
  if (!ok) console.error(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`);
}

add("NO_.tasful_DIR", !fs.existsSync(path.join(ROOT, ".tasful")));
add("CONTROL_PLANE_REUSED", fs.existsSync(path.join(ROOT, "scripts/lib/ai-control-plane-parallel-agent-contract.mjs")));
add("THREE_BOT_ROUTE_REUSED", fs.existsSync(path.join(ROOT, "scripts/lib/tasful-3bot-operating-model-contract.mjs")));
add("CHATGPT_WEB_STILL_BLOCKED", BLOCKED_DESTINATIONS.has("chatgpt_web"));
add("CLOUD_AGENT_STILL_BLOCKED", BLOCKED_DESTINATIONS.has("cloud_agent"));
add("REVIEWER_MODEL_GPT_FAMILY", /gpt/i.test(CURSOR_NATIVE_MODELS.reviewer));
add("JUDGE_MODEL_CLAUDE_FAMILY", /claude/i.test(CURSOR_NATIVE_MODELS.judge));
add("BUILDER_NOT_SAME_AS_JUDGE", CURSOR_NATIVE_MODELS.builder !== CURSOR_NATIVE_MODELS.judge);
add("RETRY_MAX_REUSED", sameCauseRetryMax() === SAME_CAUSE_RETRY_MAX);

add("DENY_CHATGPT_WEB", denyForbiddenRuntimes({ destination: "chatgpt_web" }).ok === false);
add("DENY_CHATGPT_WEB_LOCAL_UI", denyForbiddenRuntimes({ destination: "chatgpt_web_local_ui" }).ok === false);
add("DENY_CLOUD_AGENT", denyForbiddenRuntimes({ destination: "cloud_agent" }).ok === false);
add("DENY_PAID_API_URL", denyForbiddenRuntimes({ rawText: "https://api.openai.com/v1/chat/completions" }).ok === false);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tasful-native-loop-"));
const probePath = path.join(tmp, "probe-state.json");
writeInitialProbe(probePath, NATIVE_LOOP_ACTIVE_TASK);
add("INITIAL_PROBE_ACK_FALSE", verifyProbeState(probePath, NATIVE_LOOP_ACTIVE_TASK).ok === false);

const reviewerFixable = {
  STATUS: "FIXABLE",
  ROLE: "REVIEWER",
  ACTIVE_TASK_ID: NATIVE_LOOP_ACTIVE_TASK,
  SCOPE_VALID: "YES",
  NEXT_TASK_SELECTED: "NO",
  NEW_PHASE_SELECTED: "NO",
  HUMAN_GATE: "NO",
  PRODUCTION_GATE_BYPASS: "NO",
  CRITICAL_HIGH_ACCEPTANCE: "NO",
  NEXT_INSTRUCTION: "Set probe ack=true for the same ACTIVE_TASK only.",
  FINDINGS: ["ack is false"],
};
const auth = authorizeSemanticVerdict({
  rawText: JSON.stringify(reviewerFixable),
  activeTaskId: NATIVE_LOOP_ACTIVE_TASK,
  role: "REVIEWER",
});
add("REVIEWER_FIXABLE_AUTHORIZED", auth.ok === true && auth.status === "FIXABLE", auth.reason);

const route = controlPlaneRoute({
  verdict: "FIXABLE",
  fingerprint: "ack-false",
  loopSafety: { retryCount: 0, sameCauseRetryMax: SAME_CAUSE_RETRY_MAX },
});
add("FIXABLE_AUTO_LOOP_ROUTE", route.autoFix === true && route.toRole === "EXECUTOR");

const applied = applyHarmlessFixable(probePath, {
  activeTaskId: NATIVE_LOOP_ACTIVE_TASK,
  instruction: reviewerFixable.NEXT_INSTRUCTION,
});
add("HARMLESS_FIX_APPLIED", applied.ok === true);
add("DETERMINISTIC_PROBE_PASS", verifyProbeState(probePath, NATIVE_LOOP_ACTIVE_TASK).ok === true);

const inject = authorizeSemanticVerdict({
  rawText: JSON.stringify({ ...reviewerFixable, NEXT_TASK_SELECTED: "YES" }),
  activeTaskId: NATIVE_LOOP_ACTIVE_TASK,
  role: "REVIEWER",
});
add("INJECT_NEXT_TASK_DENIED", inject.ok === false);

const wrongTask = authorizeSemanticVerdict({
  rawText: JSON.stringify({ ...reviewerFixable, ACTIVE_TASK_ID: "OTHER_TASK" }),
  activeTaskId: NATIVE_LOOP_ACTIVE_TASK,
  role: "REVIEWER",
});
add("WRONG_TASK_DENIED", wrongTask.reason === "ACTIVE_TASK_MISMATCH");

const circuit = controlPlaneRoute({
  verdict: "FIXABLE",
  fingerprint: "same",
  loopSafety: { retryCount: SAME_CAUSE_RETRY_MAX, lastFailureFingerprint: "same", sameCauseRetryMax: SAME_CAUSE_RETRY_MAX },
});
add("CIRCUIT_BREAKER_STOP", circuit.autoFix === false && circuit.next === "STOP");

const src = fs.readFileSync(path.join(ROOT, "scripts/lib/tasful-cursor-native-multi-model-closed-loop.mjs"), "utf8");
add("NO_CLOUD_AGENT_LAUNCH", !/environment\s*[:=]\s*["']cloud["']/.test(src));
add("NO_CURSOR_API_KEY", !/CURSOR_API_KEY/.test(src));

const failed = checks.filter((row) => !row.ok);
const report = {
  activeTask: NATIVE_LOOP_ACTIVE_TASK,
  at: new Date().toISOString(),
  passed: checks.filter((row) => row.ok).length,
  failed: failed.length,
  total: checks.length,
  checks,
};
fs.mkdirSync(path.join(ROOT, "reports", "ops", "cursor-native-multi-model"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "reports", "ops", "cursor-native-multi-model", "unit-qa.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
if (failed.length) {
  console.error(`FAIL test-cursor-native-multi-model-closed-loop-v1 ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`PASS test-cursor-native-multi-model-closed-loop-v1 ${checks.length}/${checks.length}`);
