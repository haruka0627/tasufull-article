#!/usr/bin/env node
/**
 * TASFUL AI Core Phase 1 — SAFE-05 Usage Guard 静的検証 + CF guard 単体
 *   node scripts/test-tasful-ai-safe-ops-guard-phase1.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

async function main() {
  const guardTs = read("supabase/functions/_shared/ai-usage-guard.ts");
  const guardMjs = read("deploy/cloudflare/functions/_shared/ai-usage-guard.mjs");
  const geminiOcr = read("deploy/cloudflare/functions/api/gemini-ocr.js");
  const chatOcr = read("chat-ocr.js");

  assert("ai-usage-guard.ts exists", guardTs.includes("enforceGuardChatEntry"));
  assert("ai-usage-guard.ts ocr feature", guardTs.includes('GUARD_FEATURE_OCR = "ocr_turn"'));
  assert("ai-usage-guard.ts wraps quota", guardTs.includes("checkWorkspaceQuota"));

  assert("gemini-chat uses guard", read("supabase/functions/gemini-chat/index.ts").includes("enforceGuardChatEntry"));
  assert("openai-chat uses guard", read("supabase/functions/openai-chat/index.ts").includes("enforceGuardChatEntry"));
  assert("claude-chat uses guard", read("supabase/functions/claude-chat/index.ts").includes("enforceGuardChatEntry"));

  assert("gemini-ocr imports guard", geminiOcr.includes("ai-usage-guard.mjs"));
  assert("gemini-ocr enforces guard", geminiOcr.includes("enforceCfOcrGuard"));
  assert("gemini-ocr consumes quota", geminiOcr.includes("finalizeCfOcrConsume"));

  assert("chat-ocr passes user_id", chatOcr.includes("user_id: guard.user_id"));
  assert("chat-ocr passes surface", chatOcr.includes("surface: guard.surface"));
  assert("chat-ocr ocr_turn feature", chatOcr.includes('feature: "ocr_turn"'));
  assert("chat-ocr sends Authorization Bearer", chatOcr.includes('Authorization: "Bearer "'));
  assert("chat-ocr uses getSession", chatOcr.includes("getSession"));
  assert("gemini-ocr verifies /auth/v1/user", geminiOcr.includes("/auth/v1/user"));
  assert("gemini-ocr uses authenticatedUserId", geminiOcr.includes("authenticatedUserId"));

  assert("CF guard rejects production ref", guardMjs.includes('PRODUCTION_REF = "ddojquacsyqesrjhcvmn"'));
  assert("CF guard staging ref", guardMjs.includes('STAGING_REF = "ahlxuyvhzqdqaojiywmu"'));
  assert("CF guard maps ocr to vision", guardMjs.includes('explicit === FEATURE_OCR'));

  const modUrl = new URL("../deploy/cloudflare/functions/_shared/ai-usage-guard.mjs", import.meta.url);
  const cf = await import(modUrl.href);

  assert("CF normalize ocr_turn", cf.normalizeGuardFeature("ocr_turn") === "vision_turn");
  assert("CF normalize vision_turn", cf.normalizeGuardFeature("vision_turn") === "vision_turn");
  assert("CF workspace surface detect", cf.isWorkspaceSurface({ surface: "ai-workspace" }) === true);
  assert("CF non-workspace skip", cf.isWorkspaceSurface({ surface: "talk" }) === false);
  assert(
    "CF staging url ok",
    cf.assertStagingSupabaseUrl("https://ahlxuyvhzqdqaojiywmu.supabase.co") === true
  );
  assert(
    "CF production url blocked",
    cf.assertStagingSupabaseUrl("https://ddojquacsyqesrjhcvmn.supabase.co") === false
  );

  const blocked = await cf.enforceCfOcrGuard(
    new Request("http://127.0.0.1/api/gemini-ocr", { method: "POST" }),
    { surface: "ai-workspace" },
    {}
  );
  assert("OCR guard blocks missing user", blocked.blocked !== null);
  if (blocked.blocked) {
    const payload = await blocked.blocked.json();
    assert("OCR guard error code", payload.error === "guard_missing_user_id", payload.error);
  }

  const skipped = await cf.enforceCfOcrGuard(
    new Request("http://127.0.0.1/api/gemini-ocr", { method: "POST" }),
    { surface: "talk", user_id: "u_test" },
    {}
  );
  assert("Non-workspace OCR passes guard", skipped.blocked === null);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} PASS ---`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
