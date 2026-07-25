/**
 * Generate ai-plan-policy.js browser IIFE from scripts/lib/ai-plan-policy.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "scripts/lib/ai-plan-policy.mjs"), "utf8");
const body = src
  .replace(/^\/\*\*[\s\S]*?\*\/\s*/m, "")
  .replace(/^export /gm, "")
  .replace(/\nexport default[\s\S]*$/m, "")
  .replace(/\ndefault \{[\s\S]*$/m, "")
  .trim();

const out = `/**
 * TASFUL AI — Plan Policy（ブラウザ）
 * 正本: scripts/lib/ai-plan-policy.mjs — 料金は含まない。
 */
(function (global) {
  "use strict";

${body}

  global.TasuAiPlanPolicy = {
    PLAN_POLICY_VERSION,
    CANONICAL_PLAN_IDS,
    PLAN_ID_ALIASES,
    PLAN_POLICIES,
    normalizePlanId,
    getPlanPolicy,
    getAnonymousPolicy,
    resolveStatusFromSubscription,
    policyFromGenAiPlan,
    isPlanExecutable,
    isModelAllowedForPolicy,
    isFeatureAllowedForPolicy,
    featureForEdge,
    edgeForWorkspaceModel,
    listAllowedModels,
    listFallbackModels,
    getDefaultModelForPolicy,
    buildPublicPlanSummary,
    evaluateLimitAction,
  };
})(typeof window !== "undefined" ? window : globalThis);
`;

writeFileSync(join(root, "ai-plan-policy.js"), out);
console.log("wrote ai-plan-policy.js");
