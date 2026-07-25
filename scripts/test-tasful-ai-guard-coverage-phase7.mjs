/**
 * Phase 7 static guard coverage regression.
 * This is intentionally source-only: Staging remains paused.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(resolve(root, path), "utf8");
let passed = 0;

function expect(condition, label) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  passed += 1;
  console.log(`PASS ${label}`);
}

const cfGuard = source("deploy/cloudflare/functions/_shared/ai-usage-guard.mjs");
expect(cfGuard.includes('from "./ai-plan-policy.mjs"'), "CF OCR imports plan policy");
expect(cfGuard.includes("plan_feature_denied"), "CF OCR returns plan feature denial");

const media = source("supabase/functions/_shared/ai-workspace-media-generate.ts");
expect(media.includes("enforceGuardFeatureEntry"), "media uses authenticated feature guard");
expect(media.includes("resolveAuthenticatedWorkspaceUser"), "media resolves JWT workspace user");
expect(!media.includes("resolveWorkspaceUserId("), "media has no claimed-only user path");

for (const path of [
  "supabase/functions/serper-search/index.ts",
  "supabase/functions/gemini-tts/index.ts",
  "deploy/cloudflare/functions/api/gemini-tts.js",
  "supabase/functions/gemini-image-character-analyze/index.ts",
]) {
  const body = source(path);
  expect(
    body.includes("enforceGuardFeatureEntry") || body.includes("auth_required"),
    `${path} has authentication guard`
  );
}

const guard = source("supabase/functions/_shared/ai-usage-guard.ts");
expect(guard.includes("usage_guard_unavailable"), "usage guard fails closed");
expect(guard.includes("enforceGuardOpenRouterPocEntry"), "OpenRouter PoC guard remains");

const policy = source("scripts/lib/ai-plan-policy.mjs");
expect(policy.includes("text_to_speech") && policy.includes("search"), "plan policy covers search and TTS");
expect(policy.includes("resolveQuotaCategory"), "plan policy resolves quota category");

for (const path of [
  "supabase/functions/gemini-chat/index.ts",
  "supabase/functions/openai-chat/index.ts",
  "supabase/functions/claude-chat/index.ts",
]) {
  expect(source(path).includes("enforceGuardChatEntry"), `${path} retains chat guard`);
}

console.log(`Phase 7 guard coverage: ${passed} checks PASS`);
