/**
 * Canonical Cursor-native ROLE → MODEL routing V1.
 * Overlay on Control Plane. Not a dispatcher engine. Not a 4th BOT.
 */
import { BLOCKED_DESTINATIONS } from "./tasful-external-transmission-policy-v1.mjs";

const PAID_API_HOST_RE =
  /(^|\.)(api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.x\.ai|openrouter\.ai)(:|\/|$)/i;

function denyDirectPaidOrRelay({ rawText = "", destination = "local_policy_decision" } = {}) {
  const blob = String(rawText || "");
  let paid = false;
  try {
    paid = PAID_API_HOST_RE.test(new URL(blob).host.toLowerCase());
  } catch {
    paid = PAID_API_HOST_RE.test(blob) || /generativelanguage\.googleapis\.com|api\.openai\.com|api\.anthropic\.com|api\.x\.ai|openrouter\.ai/i.test(blob);
  }
  if (paid) {
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

export const ROUTING_VERSION = "v1";
export const ROUTING_ACTIVE_TASK = "TASFUL_CURSOR_NATIVE_ROLE_MODEL_ROUTING_SSOT_V1";
export const ROUTING_SSOT = "docs/ops/CURSOR_NATIVE_ROLE_MODEL_ROUTING_V1.md";

export const AUTOMATIC_PROVIDER_FALLBACK = "DENY";

/**
 * Discovered 2026-09-04 from this local Windows Cursor session's Task tool
 * allowed `model` slugs. Not guessed. Not Cloud Agent. Not vendor REST catalogs.
 */
export const DISCOVERED_CURSOR_NATIVE_MODEL_SLUGS = Object.freeze([
  "inherit",
  "claude-sonnet-5-thinking-high",
  "composer-2.5",
  "composer-2.5-fast",
  "cursor-grok-4.6-high",
  "gemini-3.1-pro",
  "gemini-3.7-flash-high",
  "gpt-5.6-sol-medium",
]);

export const DISCOVERED_SLUG_SET = new Set(DISCOVERED_CURSOR_NATIVE_MODEL_SLUGS);

export const ROLE_IDS = Object.freeze([
  "SOFTWARE_BUILDER",
  "PLANNER_REVIEWER",
  "INDEPENDENT_JUDGE",
  "SECOND_OPINION_RED_TEAM",
  "RESEARCHER",
  "DETERMINISTIC_VERIFIER",
]);

export const ROLE_ROUTING = Object.freeze({
  SOFTWARE_BUILDER: Object.freeze({
    kind: "CURSOR_NATIVE_MODEL",
    model: "cursor-grok-4.6-high",
    mayEditSource: true,
    maySelfAuthorizePass: false,
  }),
  PLANNER_REVIEWER: Object.freeze({
    kind: "CURSOR_NATIVE_MODEL",
    model: "gpt-5.6-sol-medium",
    mayEditSource: false,
    maySelfAuthorizePass: false,
  }),
  INDEPENDENT_JUDGE: Object.freeze({
    kind: "CURSOR_NATIVE_MODEL",
    model: "claude-sonnet-5-thinking-high",
    mayEditSource: false,
    maySelfAuthorizePass: false,
    separateContextRequired: true,
  }),
  SECOND_OPINION_RED_TEAM: Object.freeze({
    kind: "CURSOR_NATIVE_MODEL",
    model: "gemini-3.1-pro",
    mayEditSource: false,
    maySelfAuthorizePass: false,
    mandatoryEveryIteration: false,
    advisoryUntilAuthorized: true,
  }),
  RESEARCHER: Object.freeze({
    kind: "CURSOR_NATIVE_MODEL",
    model: "cursor-grok-4.6-high",
    mayEditSource: false,
    maySelfAuthorizePass: false,
  }),
  DETERMINISTIC_VERIFIER: Object.freeze({
    kind: "TASFUL_LOCAL_TOOLING",
    model: null,
    executor: "TASFUL_LOCAL_TOOLING",
    mayEditSource: false,
    llmAuthorityForMachineFacts: false,
  }),
});

export const ROLE_MODEL_IDS = Object.freeze({
  SOFTWARE_BUILDER: ROLE_ROUTING.SOFTWARE_BUILDER.model,
  PLANNER_REVIEWER: ROLE_ROUTING.PLANNER_REVIEWER.model,
  INDEPENDENT_JUDGE: ROLE_ROUTING.INDEPENDENT_JUDGE.model,
  SECOND_OPINION_RED_TEAM: ROLE_ROUTING.SECOND_OPINION_RED_TEAM.model,
  RESEARCHER: ROLE_ROUTING.RESEARCHER.model,
  DETERMINISTIC_VERIFIER: "TASFUL_LOCAL_TOOLING",
});

/** V1: no silent substitutes. Empty table is intentional. */
export const PREAUTHORIZED_FALLBACKS = Object.freeze({});

export const SECOND_OPINION_TRIGGERS = Object.freeze([
  "HIGH_IMPACT_ARCHITECTURE",
  "REVIEWER_JUDGE_DISAGREEMENT",
  "SECURITY_SENSITIVE",
  "MAJOR_REGRESSION_RISK",
  "REPEATED_FIXABLE_LOOP",
  "EXPLICIT_HUMAN_REQUEST",
]);

export const CHATGPT_WEB_LOCAL_RELAY_STATUS = "SUPERSEDED_BY_CURSOR_NATIVE_MULTI_MODEL";

export function shouldInvokeSecondOpinion(flags = {}) {
  const hit = SECOND_OPINION_TRIGGERS.filter((key) => flags[key] === true);
  if (hit.length === 0) {
    return { invoke: false, reason: "NOT_MANDATORY" };
  }
  return { invoke: true, reason: hit[0], triggers: hit };
}

export function authorizeRoleModelDispatch({
  role,
  requestedModel = null,
  environment = "local",
  destination = "local_policy_decision",
  rawText = "",
  agentSelectedFallback = false,
  agentStartedNewRole = false,
  agentStartedNewTask = false,
} = {}) {
  if (environment === "cloud") {
    return { ok: false, reason: "CLOUD_AGENT_DENY", next: "FAIL_CLOSED" };
  }
  const forbidden = denyDirectPaidOrRelay({ rawText, destination });
  if (!forbidden.ok) {
    return { ok: false, reason: forbidden.reason, destination: forbidden.destination, next: "FAIL_CLOSED" };
  }
  if (agentStartedNewTask === true) {
    return { ok: false, reason: "NEW_TASK_ESCAPE", next: "FAIL_CLOSED" };
  }
  if (agentStartedNewRole === true) {
    return { ok: false, reason: "UNAUTHORIZED_ROLE_START", next: "FAIL_CLOSED" };
  }
  if (agentSelectedFallback === true) {
    return { ok: false, reason: "UNAUTHORIZED_MODEL_SUBSTITUTION", next: "FAIL_CLOSED" };
  }

  const assigned = ROLE_ROUTING[role];
  if (!assigned) {
    return { ok: false, reason: "UNKNOWN_ROLE", next: "FAIL_CLOSED" };
  }

  if (assigned.kind === "TASFUL_LOCAL_TOOLING") {
    if (requestedModel) {
      return { ok: false, reason: "LLM_AUTHORITY_DENIED_FOR_MACHINE_FACTS", next: "FAIL_CLOSED" };
    }
    return {
      ok: true,
      role,
      model: null,
      executor: assigned.executor,
      fallbackUsed: false,
    };
  }

  const model = assigned.model;
  if (!DISCOVERED_SLUG_SET.has(model)) {
    return { ok: false, reason: "MODEL_UNAVAILABLE", model, next: "HUMAN_GATE" };
  }
  if (requestedModel && requestedModel !== model) {
    const fallback = PREAUTHORIZED_FALLBACKS[role];
    if (AUTOMATIC_PROVIDER_FALLBACK === "DENY" || fallback !== requestedModel) {
      return {
        ok: false,
        reason: "UNAUTHORIZED_MODEL_SUBSTITUTION",
        assigned: model,
        requested: requestedModel,
        next: "FAIL_CLOSED",
      };
    }
  }

  return {
    ok: true,
    role,
    model,
    fallbackUsed: false,
    automaticFallback: AUTOMATIC_PROVIDER_FALLBACK,
  };
}

export function modelUnavailableNext({ assignedModel, transientRetryUsed = false } = {}) {
  if (!DISCOVERED_SLUG_SET.has(assignedModel)) {
    return { status: "MODEL_UNAVAILABLE", next: "HUMAN_GATE", retrySameSlug: false };
  }
  if (transientRetryUsed === true) {
    return { status: "MODEL_UNAVAILABLE", next: "HUMAN_GATE", retrySameSlug: false };
  }
  return { status: "MODEL_UNAVAILABLE", next: "RETRY_SAME_SLUG_ONCE", retrySameSlug: true };
}
