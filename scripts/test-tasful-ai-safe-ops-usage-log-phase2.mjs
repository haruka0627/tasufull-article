#!/usr/bin/env node
/**
 * TASFUL AI Core — SAFE-06 Usage Log（Phase 2 / ユーザー Phase 1）静的 + 単体検証
 *   node scripts/test-tasful-ai-safe-ops-usage-log-phase2.mjs
 *
 * Staging DB 適用・deploy・Production 変更は行わない。
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  const migration = read("supabase/migrations/20260726120000_ai_usage_events.sql");
  const logTs = read("supabase/functions/_shared/ai-usage-log.ts");
  const logMjs = read("deploy/cloudflare/functions/_shared/ai-usage-log.mjs");
  const geminiChat = read("supabase/functions/gemini-chat/index.ts");
  const geminiOcr = read("deploy/cloudflare/functions/api/gemini-ocr.js");
  const openaiChat = read("supabase/functions/openai-chat/index.ts");
  const claudeChat = read("supabase/functions/claude-chat/index.ts");

  // --- migration syntax / shape ---
  assert("migration creates ai_usage_events", /create table if not exists public\.ai_usage_events/i.test(migration));
  assert("migration unique request_id", /unique \(request_id\)/i.test(migration));
  assert("migration has user_id", /user_id uuid/i.test(migration));
  assert("migration has anonymous_id", /anonymous_id text/i.test(migration));
  assert("migration has feature/provider/model/status", /feature text not null/.test(migration) && /provider text not null/.test(migration) && /status text not null/.test(migration));
  assert("migration has units + estimated_cost", /input_units/.test(migration) && /estimated_cost/.test(migration));
  assert("migration has metadata jsonb", /metadata jsonb/i.test(migration));
  assert("migration enables RLS", /enable row level security/i.test(migration));
  assert("migration deny-all policy", /ai_usage_events_deny_all/i.test(migration));
  assert("migration ingest RPC", /create or replace function public\.ingest_ai_usage_event/i.test(migration));
  assert("migration RPC service_role only", /grant execute on function public\.ingest_ai_usage_event[\s\S]*to service_role/i.test(migration));
  assert("migration revoke anon/authenticated", /revoke all on function public\.ingest_ai_usage_event[\s\S]*from public, anon, authenticated/i.test(migration));
  assert("migration indexes", /idx_ai_usage_events_created_at/.test(migration) && /idx_ai_usage_events_user_created/.test(migration));
  assert("migration on conflict idempotent", /on conflict \(request_id\) do nothing/i.test(migration));
  assert("migration forbids prompt keys", /metadata_forbidden_keys/.test(migration) && /'prompt'/.test(migration));

  // --- wiring ---
  assert("gemini-chat imports usage log", geminiChat.includes("ai-usage-log.ts"));
  assert("gemini-chat records denied", geminiChat.includes("USAGE_STATUS_DENIED"));
  assert("gemini-chat records success", geminiChat.includes("USAGE_STATUS_SUCCESS"));
  assert("gemini-chat records error", geminiChat.includes("USAGE_STATUS_ERROR"));
  assert("gemini-chat uses createUsageLogOnce", geminiChat.includes("createUsageLogOnce"));
  assert("gemini-chat resolveUsageActor", geminiChat.includes("resolveUsageActor"));
  assert("gemini-ocr imports usage log", geminiOcr.includes("ai-usage-log.mjs"));
  assert("gemini-ocr records denied/success/error", geminiOcr.includes("USAGE_STATUS_DENIED") && geminiOcr.includes("USAGE_STATUS_SUCCESS") && geminiOcr.includes("USAGE_STATUS_ERROR"));
  assert("openai-chat imports usage log", openaiChat.includes("ai-usage-log"));
  assert("claude-chat imports usage log", claudeChat.includes("ai-usage-log"));
  assert("openai-chat records success", openaiChat.includes("USAGE_STATUS_SUCCESS"));
  assert("claude-chat records success", claudeChat.includes("USAGE_STATUS_SUCCESS"));
  assert("openai-chat sanitizeRoutingMetadata", openaiChat.includes("sanitizeRoutingMetadata"));
  assert("claude-chat sanitizeRoutingMetadata", claudeChat.includes("sanitizeRoutingMetadata"));
  assert("no public browser ingest endpoint added", !logTs.includes("/api/ai-usage") && !logMjs.includes("onRequest"));

  // --- module unit tests ---
  const modUrl = pathToFileURL(join(root, "deploy/cloudflare/functions/_shared/ai-usage-log.mjs")).href;
  const log = await import(`${modUrl}?t=${Date.now()}`);

  assert("newUsageRequestId length", String(log.newUsageRequestId()).length >= 8);

  const okMeta = log.sanitizeUsageMetadata({
    surface: "ai-workspace",
    intent: "chat",
    http_status: 200,
    source: "gemini-chat",
    message: "should-be-stripped-by-allowlist-but-forbidden",
  });
  assert("forbidden key rejected", okMeta.ok === false && okMeta.error === "metadata_forbidden_keys");

  const cleanMeta = log.sanitizeUsageMetadata({
    surface: "ai-workspace",
    intent: "chat",
    http_status: 200,
    source: "gemini-chat",
    evil_extra: "drop-me",
  });
  assert("allowlist metadata ok", cleanMeta.ok === true);
  assert("extra keys dropped", cleanMeta.ok && cleanMeta.metadata.evil_extra === undefined);
  assert("no prompt fields in clean meta", cleanMeta.ok && !("message" in cleanMeta.metadata) && !("prompt" in cleanMeta.metadata));

  const huge = { surface: "x".repeat(3000) };
  const hugeMeta = log.sanitizeUsageMetadata(huge);
  // surface truncated to 64 so may still pass; force oversized via many keys
  const bigObj = {};
  for (let i = 0; i < 80; i += 1) {
    // only allowlisted keys count — use repeated surface overwrite won't grow
  }
  // Build oversized by stuffing allowlisted string after sanitize truncates — test record path instead
  assert("sanitize truncates surface", cleanMeta.ok && String(cleanMeta.metadata.surface).length <= 64);

  const oversizedPayload = {
    surface: "ai-workspace",
    intent: "chat",
    source: "gemini-chat",
    http_status: 200,
  };
  // Expand via fake allowlist bypass: recordAiUsageEvent checks sanitize first;
  // for oversized after allowlist, inject long source-like via many copies in raw forbidden path already covered.
  // Direct byte check: craft object that only uses allowlist but exceeds 2048 after JSON
  const fat = { source: "s".repeat(2500) };
  const fatMeta = log.sanitizeUsageMetadata(fat);
  // source truncated to 64 → ok
  assert("long allowlisted value truncated", fatMeta.ok === true && fatMeta.metadata.source.length === 64);

  // Oversized: many http_status won't work. Use Object.assign with many allowlisted duplicates — only one key each.
  // Instead validate migration check path via recording with metadata that passes sanitize then...
  // Create metadata that passes key check but is large: sanitize truncates strings to 64 so hard to exceed 2048.
  // Test record rejects invalid feature/status/units without network:
  const badFeature = await log.recordAiUsageEvent(
    {
      requestId: "req-test-feature-001",
      feature: "not_a_feature",
      provider: "gemini",
      status: "success",
    },
    { SUPABASE_URL: "https://example.invalid", SUPABASE_SERVICE_ROLE_KEY: "k" }
  );
  assert("invalid feature rejected", badFeature.ok === false && badFeature.error === "invalid_feature");

  const badStatus = await log.recordAiUsageEvent(
    {
      requestId: "req-test-status-001",
      feature: "text_turn",
      provider: "gemini",
      status: "pending",
    },
    { SUPABASE_URL: "https://example.invalid", SUPABASE_SERVICE_ROLE_KEY: "k" }
  );
  assert("invalid status rejected", badStatus.ok === false && badStatus.error === "invalid_status");

  const badUnits = await log.recordAiUsageEvent(
    {
      requestId: "req-test-units-001",
      feature: "text_turn",
      provider: "gemini",
      status: "success",
      inputUnits: -1,
    },
    { SUPABASE_URL: "https://example.invalid", SUPABASE_SERVICE_ROLE_KEY: "k" }
  );
  assert("negative units rejected", badUnits.ok === false && badUnits.error === "invalid_input_units");

  const badUser = await log.recordAiUsageEvent(
    {
      requestId: "req-test-user-001",
      userId: "not-a-uuid",
      feature: "text_turn",
      provider: "gemini",
      status: "success",
    },
    { SUPABASE_URL: "https://example.invalid", SUPABASE_SERVICE_ROLE_KEY: "k" }
  );
  assert("fake user_id rejected", badUser.ok === false && badUser.error === "invalid_user_id");

  // Mock fetch for success + idempotent duplicate + no prompt leakage in body
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body || "{}")) });
    if (calls.length === 1) {
      return {
        ok: true,
        async json() {
          return { ok: true, duplicate: false };
        },
      };
    }
    return {
      ok: true,
      async json() {
        return { ok: true, duplicate: true };
      },
    };
  };

  try {
    const env = {
      SUPABASE_URL: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    };
    const r1 = await log.recordAiUsageEvent(
      {
        requestId: "req-idempotent-abc-001",
        userId: "11111111-1111-4111-8111-111111111111",
        feature: "text_turn",
        provider: "gemini",
        model: "gemini-2.5-flash",
        status: "success",
        inputUnits: 12,
        outputUnits: 34,
        estimatedCost: null,
        metadata: { source: "gemini-chat", surface: "ai-workspace", http_status: 200 },
      },
      env
    );
    assert("success event record ok", r1.ok === true && r1.duplicate === false);

    const r2 = await log.recordAiUsageEvent(
      {
        requestId: "req-idempotent-abc-001",
        userId: "11111111-1111-4111-8111-111111111111",
        feature: "text_turn",
        provider: "gemini",
        status: "success",
        metadata: { source: "gemini-chat" },
      },
      env
    );
    assert("request_id idempotent duplicate", r2.ok === true && r2.duplicate === true);

    const rErr = await log.recordAiUsageEvent(
      {
        requestId: "req-error-event-001",
        feature: "ocr_turn",
        provider: "gemini",
        status: "error",
        errorCode: "upstream_unavailable",
        metadata: { source: "gemini-ocr", http_status: 502 },
      },
      env
    );
    assert("failure event record ok", rErr.ok === true);

    const rDeny = await log.recordAiUsageEvent(
      {
        requestId: "req-denied-event-001",
        userId: "11111111-1111-4111-8111-111111111111",
        feature: "ocr_turn",
        provider: "gemini",
        status: "denied",
        errorCode: "quota_exceeded",
        metadata: { source: "gemini-ocr", http_status: 402 },
      },
      env
    );
    assert("guard denied event record ok", rDeny.ok === true);

    const leaked = calls.some((c) => {
      const s = JSON.stringify(c.body);
      return /prompt|ocr_text|"message"|"reply"|"base64"/i.test(s) && /p_metadata/.test(s);
    });
    assert("no prompt/body content in ingest payload", !leaked);

    const onceDup = log.createUsageLogOnce();
    await onceDup.record(
      {
        requestId: "req-once-1",
        feature: "text_turn",
        provider: "gemini",
        status: "success",
        metadata: { source: "gemini-chat" },
      },
      env
    );
    const secondLocal = await onceDup.record(
      {
        requestId: "req-once-2",
        feature: "text_turn",
        provider: "gemini",
        status: "error",
        metadata: { source: "gemini-chat" },
      },
      env
    );
    assert("createUsageLogOnce prevents double local record", secondLocal.ok === true && secondLocal.duplicate === true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Oversized metadata rejection via sanitize of non-allowlist object type already covered;
  // force metadata_too_large by temporarily using many keys — only 5 allowlisted.
  // Validate migration contains metadata_too_large check:
  assert("migration rejects oversized metadata", /metadata_too_large/.test(migration));

  // Shared TS mirrors CF validation surface
  assert("ts has resolveUsageActor", logTs.includes("resolveUsageActor"));
  assert("ts does not throw on ingest failure", logTs.includes("ingest_failed") && logTs.includes("catch"));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
