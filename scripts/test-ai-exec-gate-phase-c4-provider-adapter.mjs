#!/usr/bin/env node
/**
 * AI Execution Gate — Phase C4 provider-neutral adapter tests
 *   node scripts/test-ai-exec-gate-phase-c4-provider-adapter.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    return;
  }
  errors.push(label);
  console.log(`  ✗ ${label}`);
}

function relUrl(rel) {
  return `${pathToFileURL(join(root, rel)).href}?t=${Date.now()}`;
}

function jsonRes(status, body) {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return text;
    },
  };
}

const c4 = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c4-provider.mjs")
);
const c3 = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c3-budget.mjs")
);
const caps = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-capabilities.mjs")
);
const executor = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs")
);
const policy = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-policy.mjs")
);
const collector = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c1-collector.mjs")
);

console.log("C4 — files / static security");
const file = "deploy/cloudflare/functions/_shared/ai-exec-gate-c4-provider.mjs";
assert("exists c4 module", existsSync(join(root, file)));
const src = readFileSync(join(root, file), "utf8");
const execSrc = readFileSync(
  join(root, "deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs"),
  "utf8"
);
assert("no fetch(", !/\bfetch\s*\(/.test(src));
assert("no axios", !/\baxios\b/.test(src));
assert("no XMLHttpRequest", !/XMLHttpRequest/.test(src));
assert("no WebSocket", !/\bWebSocket\b/.test(src));
assert(
  "no SDK import",
  !/\bfrom\s+["'][^"']*(openai|@anthropic|@google)/i.test(src)
);
assert(
  "no process.env",
  !/process\.env/.test(src)
);
assert("no eval/Function", !/\beval\s*\(|new\s+Function\b/.test(src));
assert("no dynamic import()", !/\bimport\s*\(/.test(src));
assert("no child_process", !/child_process/.test(src));
assert("executor never calls adapter.execute", !/\.execute\s*\(/.test(execSrc) || !/adapter\.execute\s*\(/.test(execSrc));
assert(
  "executor resolve wired",
  /resolveProviderAdapter|validateProviderIdentifier/.test(execSrc)
);
assert(
  "package.json no new openai sdk",
  !readFileSync(join(root, "package.json"), "utf8").includes('"openai"')
);

console.log("\nC4 — registry / resolver");
{
  const reg = c4.createProviderRegistry();
  assert("registry ids frozen list", reg.listIds().includes("deepseek"));
  assert("has openai", reg.has("openai"));
  assert("has gemini", reg.has("gemini"));
  assert("has anthropic", reg.has("anthropic"));
  const snap = reg.snapshot();
  let mutated = false;
  try {
    snap.ids.push("hack");
    mutated = true;
  } catch {
    mutated = false;
  }
  assert("snapshot ids immutable or isolated", mutated === false);
  assert("registry size stable", reg.snapshot().size === 4);

  const ok = c4.resolveProviderAdapter("deepseek", { registry: reg });
  assert("valid resolve", ok.ok && ok.adapter.provider_id === "deepseek");
  assert("NoOp unsupported status", ok.adapter.status === "unsupported");
  assert("provider_called false", ok.adapter.provider_called === false);
  assert("recorded_api_cost 0", ok.adapter.recorded_api_cost === 0);

  assert(
    "unknown rejected",
    c4.resolveProviderAdapter("claude").error ===
      c4.PHASE_C4_ERROR_CODES.UNKNOWN_PROVIDER
  );
  assert(
    "uppercase rejected",
    c4.validateProviderIdentifier("Deepseek").ok === false
  );
  assert(
    "whitespace rejected",
    c4.validateProviderIdentifier(" deepseek").ok === false
  );
  assert(
    "empty rejected",
    c4.validateProviderIdentifier("").ok === false
  );
  assert(
    "__proto__ rejected",
    c4.validateProviderIdentifier("__proto__").ok === false
  );
  assert(
    "prototype rejected",
    c4.validateProviderIdentifier("prototype").ok === false
  );
  assert(
    "constructor rejected",
    c4.validateProviderIdentifier("constructor").ok === false
  );
  assert(
    "null rejected",
    c4.validateProviderIdentifier(null).ok === false
  );
  assert(
    "object rejected",
    c4.validateProviderIdentifier({}).ok === false
  );
  assert(
    "array rejected",
    c4.validateProviderIdentifier(["deepseek"]).ok === false
  );
  // unicode lookalike / non-NFC: composing mark appended
  assert(
    "unicode variant rejected",
    c4.validateProviderIdentifier("deepseek\u0301").ok === false
  );
}

console.log("\nC4 — NoOp non-execution");
{
  const adapter = c4.createNoOpProviderAdapter("openai");
  const ex = adapter.execute();
  assert("execute returns non-ok", ex.ok === false);
  assert("execute provider_called false", ex.provider_called === false);
  assert("execute cost 0", ex.recorded_api_cost === 0);
  assert("no fake summary on execute", ex.summary == null);
  const norm = adapter.normalizeResult({
    provider_called: false,
    recorded_api_cost: 0,
  });
  assert("normalize ok envelope", norm.ok === true);
  assert("normalize summary null", norm.result.summary === null);
  assert(
    "normalize rejects provider_called true",
    adapter.normalizeResult({ provider_called: true, recorded_api_cost: 0 })
      .ok === false
  );
  const est = adapter.estimatePlaceholder();
  assert("estimate 0", est.estimated === 0);
}

console.log("\nC4 — prepare reuses C1");
{
  const PURPOSE = caps.PHASE_B_ACTION_TYPE;
  const snap = collector.collectDailyOperationsSnapshot({
    input: {
      purpose: PURPOSE,
      action: PURPOSE,
      environment: "staging",
      business_date_jst: "2026-07-28",
    },
    collectedAt: "2026-07-28T00:00:00.000Z",
  });
  assert("snapshot ok", snap.ok);
  const prep = c4.prepareProviderNeutralRequest(snap.snapshot, "deepseek");
  assert("prepare ok", prep.ok === true);
  assert("prepare provider_called false", prep.provider_called === false);
  assert("prepare cost 0", prep.recorded_api_cost === 0);
  assert(
    "unknown prepare fail-closed",
    c4.prepareProviderNeutralRequest(snap.snapshot, "gpt").ok === false
  );
}

console.log("\nC4 — pipeline integration");
{
  const stagingEnv = {
    AI_EXEC_GATE_ENVIRONMENT: "staging",
    AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT: "1",
    AI_EXEC_GATE_EMERGENCY_STOP: "0",
    TASFUL_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  };
  const baseRow = () => ({
    id: "66666666-6666-4666-8666-666666666666",
    actor_id: "user-ops-1",
    parent_execution_id: null,
    preflight_decision: "allowed",
    execution_status: "queued",
    action_type: caps.PHASE_B_ACTION_TYPE,
    target_service: caps.PHASE_B_TARGET_SERVICE,
    capability_key: "collect_daily_ops",
    environment: "staging",
    feature_flag_enabled: true,
    emergency_stop_active: false,
    idempotency_key: "staging-ops-pipeline-c4-001",
    payload_hash: "a".repeat(64),
    budget_day_key: "2026-07-28",
    correlation_id: "corr-c4",
    execution_attempts: 0,
    blocked_reason: null,
  });

  function makePipelineDb(state) {
    return async (url, init = {}) => {
      const u = String(url);
      const method = String(init.method || "GET").toUpperCase();
      if (u.includes("ai_execution_requests") && method === "GET") {
        return jsonRes(200, state.row ? [state.row] : []);
      }
      if (u.includes("ai_execution_requests") && method === "PATCH") {
        if (u.includes("execution_status=eq.queued")) {
          if (state.row.execution_status !== "queued") return jsonRes(200, []);
          if (state.claimLock) return jsonRes(200, []);
          state.claimLock = true;
          Object.assign(state.row, JSON.parse(init.body));
          return jsonRes(200, [state.row]);
        }
        if (u.includes("execution_status=eq.running")) {
          Object.assign(state.row, JSON.parse(init.body));
          return jsonRes(200, [state.row]);
        }
        return jsonRes(200, []);
      }
      if (u.includes("ai_execution_events") && method === "GET") {
        return jsonRes(200, state.events || []);
      }
      if (u.includes("ai_execution_events") && method === "POST") {
        const body = JSON.parse(init.body);
        state.events = state.events || [];
        state.events.push(body);
        return jsonRes(201, [body]);
      }
      if (u.includes("ai_execution_results") && method === "GET") {
        return jsonRes(200, state.result ? [state.result] : []);
      }
      if (u.includes("ai_execution_results") && method === "POST") {
        if (state.result) return jsonRes(409, { code: "23505" });
        state.result = JSON.parse(init.body);
        return jsonRes(201, [state.result]);
      }
      return jsonRes(500, {});
    };
  }

  const allowed = { row: baseRow(), events: [] };
  const r1 = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: allowed.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(allowed),
    budgetUsage: { current_usage: 0 },
  });
  assert("budget allowed path succeeds", r1.ok && r1.body?.status === "succeeded");
  assert("provider_called false", r1.body?.provider_called === false);
  assert("recorded_api_cost 0", r1.body?.recorded_api_cost === 0);
  assert("provider meta present", r1.body?.provider?.provider_id === "deepseek");
  assert(
    "provider_resolved event",
    allowed.events.some((e) => e.event_type === "provider_resolved")
  );
  assert(
    "provider_prepare_done event",
    allowed.events.some((e) => e.event_type === "provider_prepare_done")
  );

  const warnState = { row: baseRow(), events: [] };
  warnState.row.idempotency_key = "staging-ops-pipeline-c4-warn";
  const rWarn = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: warnState.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(warnState),
    budgetUsage: { current_usage: c3.PHASE_C3_HARD_CAP_USD * 0.85 },
  });
  assert("budget warning still succeeds", rWarn.ok && rWarn.body?.status === "succeeded");
  assert("warning budget decision", rWarn.body?.budget?.decision === "warning");

  const blocked = { row: baseRow(), events: [] };
  blocked.row.idempotency_key = "staging-ops-pipeline-c4-blocked";
  const rBlock = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: blocked.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(blocked),
    budgetUsage: { current_usage: c3.PHASE_C3_HARD_CAP_USD + 1 },
  });
  assert("budget blocked", rBlock.ok === false);
  assert(
    "blocked code",
    rBlock.body?.error === policy.EXECUTOR_FAILURE_CODES.BUDGET_HARD_CAP
  );
  assert("queued preserved", blocked.row.execution_status === "queued");
  assert("no claim", blocked.claimLock !== true);
  assert("no result", !blocked.result);
  assert(
    "no provider events on blocked",
    !(blocked.events || []).some((e) => e.event_type === "provider_resolved")
  );

  const unk = { row: baseRow(), events: [] };
  unk.row.idempotency_key = "staging-ops-pipeline-c4-unknown";
  const rUnk = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: unk.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(unk),
    budgetUsage: { current_usage: 0 },
    providerId: "claude",
  });
  assert("unknown provider rejected", rUnk.ok === false);
  assert(
    "unknown provider error",
    rUnk.body?.error === policy.EXECUTOR_FAILURE_CODES.UNKNOWN_PROVIDER
  );
  assert("unknown keeps queued", unk.row.execution_status === "queued");
  assert("unknown no claim", unk.claimLock !== true);
}

console.log(
  errors.length === 0
    ? `\nC4 PASSED (${errors.length} failures)`
    : `\nC4 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
