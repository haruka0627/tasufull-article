/**
 * Phase 8 final-integration static regression.
 * Staging remains paused; this script must not make network requests.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(resolve(root, path), "utf8");
let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${label}: ${error.message}`);
  }
}

const gateway = source("ai-model-gateway.js");
const workspace = source("ai-workspace-chat.js");
const quota = source("supabase/functions/_shared/ai-workspace-quota.ts");
const guard = source("supabase/functions/_shared/ai-usage-guard.ts");
const media = source("supabase/functions/_shared/ai-workspace-media-generate.ts");
const character = source("supabase/functions/gemini-image-character-analyze/index.ts");
const gauge = source("ai-workspace-usage-gauge.js");
const settings = source("ai-workspace-settings.js");
const workspaceHtml = source("ai-workspace.html");

check("Gateway resolves access token for postEdge", () => {
  assert.match(gateway, /async function resolveAccessToken\(\)/);
  assert.match(gateway, /Authorization:\s*`Bearer \$\{accessToken \|\| anonKey\}`/);
});

check("Gateway honors Manual deny", () => {
  assert.match(gateway, /routingDecision && routingDecision\.ok === false/);
  assert.match(gateway, /plan_model_denied/);
});

check("Provider fallback excludes Manual mode", () => {
  assert.match(gateway, /function shouldTryProviderFallback\(remote, routingDecision\)/);
  assert.match(
    gateway,
    /requestedMode \|\| ""\)\.toLowerCase\(\) === "manual"[\s\S]{0,160}return false/
  );
});

check("Workspace prefers remote and silences mock success", () => {
  assert.match(workspace, /preferRemote:\s*true/);
  assert.match(gateway, /String\(params\.surface \|\| ""\) === "ai-workspace"/);
  assert.match(gateway, /if \(preferRemote\) \{[\s\S]{0,120}formatApiErrorReply/);
  assert.match(gateway, /明示 preferRemote:false のみモック可/);
});

check("Workspace quota entry fails closed", () => {
  assert.match(quota, /export async function enforceWorkspaceQuotaEntry/);
  assert.match(quota, /error:\s*"usage_guard_unavailable"/);
});

check("Media and Character use one-shot usage logs", () => {
  assert.match(media, /createUsageLogOnce/);
  assert.match(character, /createUsageLogOnce/);
});

check("Gauge and settings identify text usage", () => {
  assert.match(gauge, /text_turn/);
  assert.match(settings, /テキスト利用枠/);
});

check("OpenRouter remains absent from Workspace HTML", () => {
  assert.doesNotMatch(workspaceHtml, /OpenRouter|openrouter-chat|or-gemini-flash/);
});

check("Shared AI usage guard fails closed", () => {
  assert.match(guard, /export async function enforceAiUsageGuard/);
  assert.match(guard, /usage_guard_unavailable/);
});

check("Phase 5, 6, and 7 regressions remain available", () => {
  for (const path of [
    "scripts/test-tasful-ai-plan-policy-phase5.mjs",
    "scripts/test-tasful-ai-openrouter-poc-phase6.mjs",
    "scripts/test-tasful-ai-guard-coverage-phase7.mjs",
  ]) {
    assert.ok(existsSync(resolve(root, path)), `${path} missing`);
  }
});

console.log(`\nPhase 8 final integration: ${passed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);

