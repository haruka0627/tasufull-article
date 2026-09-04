/**
 * Cursor-native multi-model closed loop V1.
 * Overlay on Control Plane / Closed Loop / 3BOT. Not a new engine.
 * ChatGPT Web / Cloud Agent / direct paid LLM APIs: deny.
 */
import fs from "node:fs";
import path from "node:path";
import {
  SAME_CAUSE_RETRY_MAX,
} from "./closed-loop-contract.mjs";
import {
  QA_VERDICTS,
  routeAfterQa,
} from "./tasful-3bot-operating-model-contract.mjs";
import { ROLE_MODEL_IDS } from "./tasful-cursor-native-role-model-routing.mjs";
import {
  BLOCKED_DESTINATIONS,
} from "./tasful-external-transmission-policy-v1.mjs";

const PAID_API_HOST_RE =
  /(^|\.)(api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.x\.ai|openrouter\.ai)(:|\/|$)/i;

function isPaidDirectApiUrl(rawUrl) {
  try {
    const host = new URL(String(rawUrl || "")).host.toLowerCase();
    return PAID_API_HOST_RE.test(host) || PAID_API_HOST_RE.test(`${host}/`);
  } catch {
    return PAID_API_HOST_RE.test(String(rawUrl || ""));
  }
}

export const NATIVE_LOOP_VERSION = "v1";
export const NATIVE_LOOP_ACTIVE_TASK = "TASFUL_CURSOR_NATIVE_MULTI_MODEL_CLOSED_LOOP_V1";
export const NATIVE_LOOP_SSOT = "docs/ops/CURSOR_NATIVE_MULTI_MODEL_CLOSED_LOOP_V1.md";

export const CURSOR_NATIVE_MODELS = Object.freeze({
  builder: ROLE_MODEL_IDS.SOFTWARE_BUILDER,
  reviewer: ROLE_MODEL_IDS.PLANNER_REVIEWER,
  judge: ROLE_MODEL_IDS.INDEPENDENT_JUDGE,
});

export const CURSOR_NATIVE_ROLES = Object.freeze({
  BUILDER: "EXECUTOR",
  REVIEWER: "QA_SEMANTIC",
  JUDGE: "QA_INDEPENDENT_VERIFIER",
});

export const SEMANTIC_VERDICTS = QA_VERDICTS;

export function probeStatePath(root) {
  return path.join(root, "reports", "ops", "cursor-native-multi-model", "probe-state.json");
}

export function parseSemanticJson(text) {
  const src = String(text || "").trim();
  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function denyForbiddenRuntimes({ rawText = "", destination = "local_policy_decision" } = {}) {
  if (isPaidDirectApiUrl(String(rawText || ""))) {
    return { ok: false, reason: "PAID_DIRECT_API_DENY" };
  }
  const overlayDenied = new Set([
    "chatgpt_web",
    "chatgpt_web_local_ui",
    "cloud_agent",
    "chatgpt_cookie",
    "chatgpt_unofficial_backend",
  ]);
  if (overlayDenied.has(destination) || BLOCKED_DESTINATIONS.has(destination)) {
    return { ok: false, reason: "FORBIDDEN_RUNTIME", destination };
  }
  return { ok: true };
}

export function authorizeSemanticVerdict({
  rawText,
  activeTaskId,
  role,
  closeoutActiveTaskId,
} = {}) {
  const forbidden = denyForbiddenRuntimes({ rawText });
  if (!forbidden.ok) return forbidden;
  const parsed = parseSemanticJson(rawText);
  if (!parsed) return { ok: false, reason: "MALFORMED_SEMANTIC_OUTPUT" };
  const status = String(parsed.STATUS || parsed.VERDICT || "").toUpperCase();
  if (!SEMANTIC_VERDICTS.includes(status)) {
    return { ok: false, reason: "BAD_VERDICT", status };
  }
  if (String(parsed.ACTIVE_TASK_ID || "") !== String(activeTaskId)) {
    return { ok: false, reason: "ACTIVE_TASK_MISMATCH" };
  }
  if (closeoutActiveTaskId && closeoutActiveTaskId !== activeTaskId) {
    return { ok: false, reason: "STATE_MISMATCH" };
  }
  if (String(parsed.SCOPE_VALID || "YES").toUpperCase() === "NO") {
    return { ok: false, reason: "SCOPE_ESCAPE" };
  }
  if (String(parsed.NEXT_TASK_SELECTED || "NO").toUpperCase() === "YES") {
    return { ok: false, reason: "NEW_TASK_SELECTED" };
  }
  if (String(parsed.NEW_PHASE_SELECTED || "NO").toUpperCase() === "YES") {
    return { ok: false, reason: "NEW_PHASE_SELECTED" };
  }
  if (String(parsed.PRODUCTION_GATE_BYPASS || "NO").toUpperCase() === "YES") {
    return { ok: false, reason: "PRODUCTION_GATE_BYPASS" };
  }
  if (String(parsed.CRITICAL_HIGH_ACCEPTANCE || "NO").toUpperCase() === "YES") {
    return { ok: false, reason: "CRITICAL_HIGH_ACCEPTANCE" };
  }
  if (String(parsed.HUMAN_GATE || "NO").toUpperCase() === "YES" && status !== "HUMAN_GATE") {
    return { ok: false, reason: "HUMAN_GATE_BYPASS" };
  }
  if (role && parsed.ROLE && String(parsed.ROLE).toUpperCase() !== String(role).toUpperCase()) {
    return { ok: false, reason: "ROLE_MISMATCH" };
  }
  if (status === "FIXABLE") {
    const instruction = parsed.NEXT_INSTRUCTION;
    if (!instruction || typeof instruction !== "string") {
      return { ok: false, reason: "FIXABLE_MISSING_INSTRUCTION" };
    }
    if (/次のACTIVE_TASK|NEXT_TASK_AUTO_START:\s*YES|NEW PHASE/i.test(instruction)) {
      return { ok: false, reason: "SCOPE_ESCAPE" };
    }
  }
  return { ok: true, status, parsed };
}

export function controlPlaneRoute({ verdict, loopSafety, fingerprint, humanGateHit = false } = {}) {
  return routeAfterQa({ verdict, loopSafety, fingerprint, humanGateHit });
}

export function applyHarmlessFixable(probePath, { activeTaskId, instruction } = {}) {
  if (/\b(deploy production|production migration|PRODUCTION_CHANGED:\s*YES|real payment|payout)\b/i.test(String(instruction || ""))) {
    return { ok: false, reason: "PRODUCTION_SCOPE" };
  }
  if (!fs.existsSync(probePath)) return { ok: false, reason: "PROBE_MISSING" };
  const current = JSON.parse(fs.readFileSync(probePath, "utf8"));
  if (current.activeTaskId !== activeTaskId) return { ok: false, reason: "ACTIVE_TASK_MISMATCH" };
  const next = {
    ...current,
    ack: true,
    lastFix: "SET_ACK_TRUE",
    productionChanged: "NO",
    at: new Date().toISOString(),
  };
  fs.writeFileSync(probePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return { ok: true, state: next };
}

export function verifyProbeState(probePath, activeTaskId) {
  if (!fs.existsSync(probePath)) return { ok: false, reason: "PROBE_MISSING" };
  const current = JSON.parse(fs.readFileSync(probePath, "utf8"));
  if (current.activeTaskId !== activeTaskId) return { ok: false, reason: "ACTIVE_TASK_MISMATCH" };
  if (current.productionChanged === "YES") return { ok: false, reason: "PRODUCTION_CHANGED" };
  if (current.ack !== true) return { ok: false, reason: "ACK_MISSING" };
  return { ok: true, state: current };
}

export function writeInitialProbe(probePath, activeTaskId) {
  fs.mkdirSync(path.dirname(probePath), { recursive: true });
  const body = {
    activeTaskId,
    probeId: "harmless-local-handoff-v1",
    requiredAck: true,
    ack: false,
    productionChanged: "NO",
    cloudAgentUsed: false,
    chatgptWebRelayUsed: false,
    directPaidApiCalls: 0,
    at: new Date().toISOString(),
  };
  fs.writeFileSync(probePath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  return body;
}

export function sameCauseRetryMax() {
  return SAME_CAUSE_RETRY_MAX;
}
