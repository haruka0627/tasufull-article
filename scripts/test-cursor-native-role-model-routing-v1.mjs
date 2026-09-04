import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BLOCKED_DESTINATIONS } from "./lib/tasful-external-transmission-policy-v1.mjs";
import {
  CURSOR_NATIVE_MODELS,
} from "./lib/tasful-cursor-native-multi-model-closed-loop.mjs";
import {
  AUTOMATIC_PROVIDER_FALLBACK,
  CHATGPT_WEB_LOCAL_RELAY_STATUS,
  DISCOVERED_SLUG_SET,
  PREAUTHORIZED_FALLBACKS,
  ROLE_IDS,
  ROLE_MODEL_IDS,
  ROLE_ROUTING,
  ROUTING_ACTIVE_TASK,
  authorizeRoleModelDispatch,
  modelUnavailableNext,
  shouldInvokeSecondOpinion,
} from "./lib/tasful-cursor-native-role-model-routing.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
function add(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail: String(detail || "") });
  if (!ok) console.error(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`);
}

add("SOFTWARE_BUILDER_GROK", ROLE_MODEL_IDS.SOFTWARE_BUILDER === "cursor-grok-4.6-high");
add("PLANNER_REVIEWER_GPT", ROLE_MODEL_IDS.PLANNER_REVIEWER === "gpt-5.6-sol-medium");
add("INDEPENDENT_JUDGE_CLAUDE", ROLE_MODEL_IDS.INDEPENDENT_JUDGE === "claude-sonnet-5-thinking-high");
add("SECOND_OPINION_GEMINI_31", ROLE_MODEL_IDS.SECOND_OPINION_RED_TEAM === "gemini-3.1-pro");
add("RESEARCHER_GROK", ROLE_MODEL_IDS.RESEARCHER === "cursor-grok-4.6-high");
add("DETERMINISTIC_NO_LLM", ROLE_ROUTING.DETERMINISTIC_VERIFIER.llmAuthorityForMachineFacts === false);
add("LOOP_LIB_IMPORTS_ROUTING", CURSOR_NATIVE_MODELS.reviewer === ROLE_MODEL_IDS.PLANNER_REVIEWER);
add("GEMINI_SLUG_DISCOVERED", DISCOVERED_SLUG_SET.has("gemini-3.1-pro"));
add("DO_NOT_BIND_GEMINI_37_TO_RED_TEAM", ROLE_MODEL_IDS.SECOND_OPINION_RED_TEAM !== "gemini-3.7-flash-high");
add("AUTOMATIC_FALLBACK_DENY", AUTOMATIC_PROVIDER_FALLBACK === "DENY");
add("NO_PREAUTHORIZED_FALLBACKS", Object.keys(PREAUTHORIZED_FALLBACKS).length === 0);
add("CHATGPT_WEB_SUPERSEDED", CHATGPT_WEB_LOCAL_RELAY_STATUS === "SUPERSEDED_BY_CURSOR_NATIVE_MULTI_MODEL");
add("CHATGPT_WEB_STILL_BLOCKED", BLOCKED_DESTINATIONS.has("chatgpt_web"));
add("CLOUD_AGENT_STILL_BLOCKED", BLOCKED_DESTINATIONS.has("cloud_agent"));
add("BUILDER_CANNOT_SELF_PASS", ROLE_ROUTING.SOFTWARE_BUILDER.maySelfAuthorizePass === false);
add("JUDGE_NO_EDIT", ROLE_ROUTING.INDEPENDENT_JUDGE.mayEditSource === false);
add("RED_TEAM_NOT_MANDATORY", ROLE_ROUTING.SECOND_OPINION_RED_TEAM.mandatoryEveryIteration === false);

const builderOk = authorizeRoleModelDispatch({
  role: "SOFTWARE_BUILDER",
  requestedModel: "cursor-grok-4.6-high",
});
add("BUILDER_DISPATCH_OK", builderOk.ok === true && builderOk.fallbackUsed === false);

const mismatch = authorizeRoleModelDispatch({
  role: "PLANNER_REVIEWER",
  requestedModel: "claude-sonnet-5-thinking-high",
});
add("ROLE_MODEL_MISMATCH_REJECTED", mismatch.reason === "UNAUTHORIZED_MODEL_SUBSTITUTION");

const silent = authorizeRoleModelDispatch({
  role: "INDEPENDENT_JUDGE",
  requestedModel: "gpt-5.6-sol-medium",
  agentSelectedFallback: true,
});
add("UNAUTHORIZED_SUBSTITUTION_REJECTED", silent.reason === "UNAUTHORIZED_MODEL_SUBSTITUTION");

const cloud = authorizeRoleModelDispatch({
  role: "SOFTWARE_BUILDER",
  environment: "cloud",
});
add("CLOUD_AGENT_DENY", cloud.reason === "CLOUD_AGENT_DENY");

const web = authorizeRoleModelDispatch({
  role: "PLANNER_REVIEWER",
  destination: "chatgpt_web_local_ui",
});
add("WEB_RELAY_DENY", web.ok === false);

const paid = authorizeRoleModelDispatch({
  role: "RESEARCHER",
  rawText: "https://generativelanguage.googleapis.com/v1beta/models",
});
add("DIRECT_API_DENY", paid.reason === "PAID_DIRECT_API_DENY");

const escape = authorizeRoleModelDispatch({
  role: "SOFTWARE_BUILDER",
  agentStartedNewTask: true,
});
add("NEW_TASK_ESCAPE_DENY", escape.reason === "NEW_TASK_ESCAPE");

const newRole = authorizeRoleModelDispatch({
  role: "SOFTWARE_BUILDER",
  agentStartedNewRole: true,
});
add("UNAUTHORIZED_ROLE_START_DENY", newRole.reason === "UNAUTHORIZED_ROLE_START");

const facts = authorizeRoleModelDispatch({
  role: "DETERMINISTIC_VERIFIER",
  requestedModel: "gpt-5.6-sol-medium",
});
add("DETERMINISTIC_LLM_AUTHORITY_DENIED", facts.reason === "LLM_AUTHORITY_DENIED_FOR_MACHINE_FACTS");

const detOk = authorizeRoleModelDispatch({ role: "DETERMINISTIC_VERIFIER" });
add("DETERMINISTIC_TOOLING_OK", detOk.ok === true && detOk.executor === "TASFUL_LOCAL_TOOLING");

add("SECOND_OPINION_DEFAULT_OFF", shouldInvokeSecondOpinion({}).invoke === false);
add(
  "SECOND_OPINION_ON_DISAGREEMENT",
  shouldInvokeSecondOpinion({ REVIEWER_JUDGE_DISAGREEMENT: true }).invoke === true,
);

const unavailable = modelUnavailableNext({ assignedModel: "not-a-real-slug" });
add("MODEL_UNAVAILABLE_HUMAN_GATE", unavailable.status === "MODEL_UNAVAILABLE" && unavailable.next === "HUMAN_GATE");

const src = fs.readFileSync(path.join(ROOT, "scripts/lib/tasful-cursor-native-role-model-routing.mjs"), "utf8");
add("NO_CLOUD_AGENT_LAUNCH", !/environment\s*[:=]\s*["']cloud["']/.test(src));
add("NO_CURSOR_API_KEY", !/CURSOR_API_KEY/.test(src));
add("ALL_ROLES_COVERED", ROLE_IDS.every((id) => Boolean(ROLE_ROUTING[id])));

const failed = checks.filter((row) => !row.ok);
const report = {
  activeTask: ROUTING_ACTIVE_TASK,
  at: new Date().toISOString(),
  passed: checks.filter((row) => row.ok).length,
  failed: failed.length,
  total: checks.length,
  checks,
};
const outDir = path.join(ROOT, "reports", "ops", "cursor-native-role-model-routing");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "unit-qa.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
if (failed.length) {
  console.error(`FAIL test-cursor-native-role-model-routing-v1 ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`PASS test-cursor-native-role-model-routing-v1 ${checks.length}/${checks.length}`);
