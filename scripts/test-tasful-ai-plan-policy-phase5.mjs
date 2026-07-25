#!/usr/bin/env node
/**
 * TASFUL AI Phase 5 — Plan Policy 静的 + 計算検証
 *   node scripts/test-tasful-ai-plan-policy-phase5.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizePlanId,
  getPlanPolicy,
  getAnonymousPolicy,
  policyFromGenAiPlan,
  isModelAllowedForPolicy,
  isFeatureAllowedForPolicy,
  isPlanExecutable,
  buildPublicPlanSummary,
  evaluateLimitAction,
  listFallbackModels,
} from "./lib/ai-plan-policy.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}
function assert(name, cond, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
}
function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const policyJs = read("ai-plan-policy.js");
const planModels = read("ai-plan-models.js");
const quotaTs = read("supabase/functions/_shared/ai-workspace-quota.ts");
const guardTs = read("supabase/functions/_shared/ai-usage-guard.ts");
const html = read("ai-workspace.html");
const usageJs = read("ai-workspace-usage.js");

assert("browser policy module", /TasuAiPlanPolicy/.test(policyJs));
assert("html loads policy before models", html.indexOf("ai-plan-policy.js") < html.indexOf("ai-plan-models.js"));
assert("no workspace model bypass", !planModels.includes("workspace && WORKSPACE_MODEL_IDS.includes"));
assert("plan override disabled", planModels.includes("権限に使わない"));
assert("quota JWT only auth_required", quotaTs.includes("auth_required") && quotaTs.includes("claimed-only 廃止"));
assert("guard plan_model_denied", guardTs.includes("plan_model_denied"));
assert("guard plan_feature_denied", guardTs.includes("plan_feature_denied"));
assert("chat hook sends access token", usageJs.includes("resolveAccessToken") && usageJs.includes("CHAT_EDGE_PATTERN"));
assert("getServerPlanId exported", usageJs.includes("getServerPlanId"));
assert("no amountJpy in public summary builder", !buildPublicPlanSummary(getPlanPolicy("pro")).amountJpy);

assert("known free", normalizePlanId("free") === "free");
assert("alias lite", normalizePlanId("basic_300") === "lite");
assert("alias light", normalizePlanId("light") === "lite");
assert("alias pro_980", normalizePlanId("pro_980") === "pro");
assert("unknown → free", normalizePlanId("ultra-hacker") === "free");
assert("forged blank → free", normalizePlanId("") === "free");

assert("anonymous plan", getAnonymousPolicy().planId === "anonymous");
assert("anonymous no ocr", getAnonymousPolicy().ocrAllowed === false);
assert("free gemini only", getPlanPolicy("free").allowedWorkspaceModels.join() === "gemini-flash");
assert("pro has 3 models", getPlanPolicy("pro").allowedWorkspaceModels.length === 3);
assert("lite denies gpt", !isModelAllowedForPolicy(getPlanPolicy("lite"), "gpt"));
assert("pro allows claude", isModelAllowedForPolicy(getPlanPolicy("pro"), "claude"));
assert("free allows ocr feature", isFeatureAllowedForPolicy(getPlanPolicy("free"), "ocr"));
assert("free denies openai_chat", !isFeatureAllowedForPolicy(getPlanPolicy("free"), "openai_chat"));
assert("anonymous denies ocr", !isFeatureAllowedForPolicy(getAnonymousPolicy(), "ocr"));

const suspended = policyFromGenAiPlan({
  plan: "pro_980",
  label: "Pro",
  dailyTextLimit: 100,
  subscriptionStatus: "suspended",
});
assert("suspended not executable", !isPlanExecutable(suspended));

const expired = policyFromGenAiPlan({
  plan: "basic_300",
  dailyTextLimit: 30,
  subscriptionStatus: "expired",
  currentPeriodEnd: "2020-01-01T00:00:00Z",
});
assert("expired not executable", !isPlanExecutable(expired));

const maxInactive = policyFromGenAiPlan({ plan: "max", label: "Max", dailyTextLimit: 100 });
assert("max inactive falls to free min", maxInactive.planId === "free" && maxInactive.status === "inactive");

assert("fallback plan-scoped", listFallbackModels(getPlanPolicy("lite"), "gemini-flash").length === 0);
assert("fallback pro", listFallbackModels(getPlanPolicy("pro"), "gpt").includes("gemini-flash"));

assert("limit action ok", evaluateLimitAction(getPlanPolicy("free"), 0.5) === "ok");
assert("limit action warn", evaluateLimitAction(getPlanPolicy("free"), 0.91) === "warn");
assert("limit action deny", evaluateLimitAction(getPlanPolicy("free"), 1) === "deny");

const pub = buildPublicPlanSummary(getPlanPolicy("lite"), { used: 3, remaining: 27 });
assert("public has planId", pub.planId === "lite");
assert("public no cost keys", !("unit_price" in pub) && !("amountJpy" in pub) && !("profit" in pub));
assert("public canExecute", pub.canExecute === true);

const nullPlan = policyFromGenAiPlan(null);
assert("null plan → free", nullPlan.planId === "free");

assert("gemini-chat uses edge name", read("supabase/functions/gemini-chat/index.ts").includes('"gemini-chat"'));
assert("openai finalize passes req", read("supabase/functions/openai-chat/index.ts").includes("finalizeGuardChatConsume(req, body)"));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exitCode = 1;
