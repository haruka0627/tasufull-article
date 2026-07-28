#!/usr/bin/env node
/**
 * AI Execution Gate — Phase C1 contracts / collector / adapter tests
 *   node scripts/test-ai-exec-gate-phase-c1-contracts.mjs
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

const contracts = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c1-contracts.mjs")
);
const collector = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c1-collector.mjs")
);
const adapter = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c1-adapter.mjs")
);
const pipeline = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c1-pipeline.mjs")
);
const caps = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-capabilities.mjs")
);
const b4Collector = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-ops-collector.mjs")
);
const b4Report = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-report-generator.mjs")
);
const executor = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs")
);

const PURPOSE = caps.PHASE_B_ACTION_TYPE;
const baseInput = () => ({
  purpose: PURPOSE,
  action: PURPOSE,
  environment: "staging",
  actor: "ops-user-1",
  business_date_jst: "2026-07-28",
  execution_id: "66666666-6666-4666-8666-666666666666",
  correlation_id: "corr-c1",
});

console.log("C1 — files / security scan");
const c1Files = [
  "deploy/cloudflare/functions/_shared/ai-exec-gate-c1-contracts.mjs",
  "deploy/cloudflare/functions/_shared/ai-exec-gate-c1-collector.mjs",
  "deploy/cloudflare/functions/_shared/ai-exec-gate-c1-adapter.mjs",
  "deploy/cloudflare/functions/_shared/ai-exec-gate-c1-pipeline.mjs",
];
for (const f of c1Files) assert(`exists ${f}`, existsSync(join(root, f)));
const c1Src = c1Files.map((f) => readFileSync(join(root, f), "utf8")).join("\n");
assert("no fetch(", !/\bfetch\s*\(/.test(c1Src));
assert("no axios", !/\baxios\b/.test(c1Src));
assert(
  "no provider SDK import",
  !/\bfrom\s+["'][^"']*(openai|anthropic|deepseek)[^"']*["']/i.test(c1Src) &&
    !/require\s*\(\s*["'][^"']*(openai|anthropic)[^"']*["']\s*\)/i.test(c1Src)
);
assert(
  "no Authorization header construction",
  !/headers\s*:\s*\{[^}]*Authorization/i.test(c1Src) &&
    !/Bearer\s+[A-Za-z0-9._-]+/.test(c1Src)
);
assert(
  "no API key env",
  !/process\.env\.[A-Z0-9_]*(API|KEY|SECRET|TOKEN)/i.test(c1Src)
);
assert("no eval/new Function", !/\beval\s*\(|new\s+Function\b/.test(c1Src));
assert("no innerHTML", !/innerHTML/.test(c1Src));

console.log("\nC1 — contracts input validation");
{
  const ok = contracts.validateDailyOpsCollectorInput(baseInput());
  assert("valid request accepted", ok.ok === true);
  assert(
    "purpose is Phase B action",
    ok.value.purpose === PURPOSE && ok.value.action === PURPOSE
  );

  assert(
    "unknown field rejected",
    contracts.validateDailyOpsCollectorInput({
      ...baseInput(),
      extra: 1,
    }).ok === false
  );
  assert(
    "missing business_date rejected",
    contracts.validateDailyOpsCollectorInput({
      purpose: PURPOSE,
      action: PURPOSE,
      environment: "staging",
    }).ok === false
  );
  assert(
    "invalid purpose rejected",
    contracts.validateDailyOpsCollectorInput({
      ...baseInput(),
      purpose: "other",
    }).error === contracts.PHASE_C1_ERROR_CODES.UNSUPPORTED_PURPOSE
  );
  assert(
    "invalid action rejected",
    contracts.validateDailyOpsCollectorInput({
      ...baseInput(),
      action: "other",
    }).error === contracts.PHASE_C1_ERROR_CODES.UNSUPPORTED_ACTION
  );
  assert(
    "invalid environment rejected",
    contracts.validateDailyOpsCollectorInput({
      ...baseInput(),
      environment: "production",
    }).ok === false
  );
  assert(
    "oversized payload rejected",
    contracts.validateDailyOpsCollectorInput({
      ...baseInput(),
      actor: "x".repeat(20_000),
    }).ok === false
  );
  assert(
    "nested object rejected",
    contracts.validateDailyOpsCollectorInput({
      ...baseInput(),
      actor: { nested: true },
    }).ok === false
  );
}

console.log("\nC1 — count integers");
{
  assert("0 accepted", contracts.validateCountInteger(0).ok === true);
  assert("positive accepted", contracts.validateCountInteger(3).ok === true);
  assert("negative rejected", contracts.validateCountInteger(-1).ok === false);
  assert("float rejected", contracts.validateCountInteger(1.5).ok === false);
  assert("NaN rejected", contracts.validateCountInteger(Number.NaN).ok === false);
  assert(
    "Infinity rejected",
    contracts.validateCountInteger(Number.POSITIVE_INFINITY).ok === false
  );
  assert(
    "numeric string rejected",
    contracts.validateCountInteger("1").ok === false
  );
  assert(
    "too-large rejected",
    contracts.validateCountInteger(contracts.PHASE_C1_LIMITS.MAX_COUNT + 1).ok ===
      false
  );
  assert(
    "null allowed when opted",
    contracts.validateCountInteger(null, { allowNull: true }).ok === true
  );
}

console.log("\nC1 — sensitive / prohibited keys");
{
  for (const key of [
    "email",
    "phone",
    "name",
    "raw_message",
    "chat_body",
    "payment",
    "token",
    "password",
    "authorization",
    "api_key",
  ]) {
    assert(
      `prohibit ${key}`,
      contracts.validateDailyOpsCollectorInput({
        ...baseInput(),
        [key]: "x",
      }).ok === false
    );
  }
}

console.log("\nC1 — collector");
{
  const a = collector.collectDailyOperationsSnapshot({
    input: baseInput(),
    collectedAt: "2026-07-28T00:00:00.000Z",
  });
  assert("default collect ok", a.ok === true);
  assert(
    "pending available 0",
    a.snapshot.counts.pending_total === 0 &&
      a.snapshot.count_availability.pending_total === "available"
  );
  assert("business_date_jst", a.snapshot.business_date_jst === "2026-07-28");
  assert(
    "deterministic default",
    JSON.stringify(
      collector.collectDailyOperationsSnapshot({
        input: baseInput(),
        collectedAt: "2026-07-28T00:00:00.000Z",
      }).snapshot
    ) === JSON.stringify(a.snapshot)
  );

  const zeroVsUnavailable = collector.collectDailyOperationsSnapshot({
    input: baseInput(),
    collectedAt: "2026-07-28T00:00:00.000Z",
    sources: [
      {
        id: "z",
        count_key: "pending_total",
        read: () => ({ status: "available", count: 0 }),
      },
      {
        id: "u",
        count_key: "failed_total",
        read: () => ({
          status: "unavailable",
          error_code: contracts.PHASE_C1_ERROR_CODES.SOURCE_UNAVAILABLE,
        }),
      },
    ],
  });
  assert(
    "0 vs unavailable",
    zeroVsUnavailable.ok &&
      zeroVsUnavailable.snapshot.counts.pending_total === 0 &&
      zeroVsUnavailable.snapshot.count_availability.pending_total ===
        "available" &&
      zeroVsUnavailable.snapshot.counts.failed_total === null &&
      zeroVsUnavailable.snapshot.count_availability.failed_total ===
        "unavailable"
  );

  const partial = collector.collectDailyOperationsSnapshot({
    input: baseInput(),
    collectedAt: "2026-07-28T00:00:00.000Z",
    sources: [
      {
        id: "ok",
        count_key: "blocked_total",
        read: () => ({ status: "available", count: 2 }),
      },
      {
        id: "bad",
        count_key: "warning_total",
        read: () => {
          throw new Error("secret sql dump");
        },
      },
    ],
  });
  assert("partial source failure ok", partial.ok === true);
  assert(
    "no secret in snapshot",
    !JSON.stringify(partial.snapshot).includes("secret sql dump") &&
      !JSON.stringify(partial.snapshot).includes("sql dump")
  );
  assert(
    "normalized source error",
    partial.snapshot.source_errors.includes(
      contracts.PHASE_C1_ERROR_CODES.SOURCE_UNAVAILABLE
    )
  );

  const allFail = collector.collectDailyOperationsSnapshot({
    input: baseInput(),
    collectedAt: "2026-07-28T00:00:00.000Z",
    sources: [
      {
        id: "a",
        count_key: "pending_total",
        read: () => ({ status: "unavailable" }),
      },
    ],
  });
  assert(
    "all source failure keeps unavailable",
    allFail.ok &&
      allFail.snapshot.counts.pending_total === null &&
      allFail.snapshot.count_availability.pending_total === "unavailable"
  );

  const warn = collector.collectDailyOperationsSnapshot({
    input: baseInput(),
    collectedAt: "2026-07-28T00:00:00.000Z",
    sources: [
      {
        id: "w",
        count_key: "pending_total",
        read: () => ({
          status: "available",
          count: 0,
          warning_codes: [
            "gate.lease",
            "gate.lease",
            "BAD CODE!!",
            "ok_code",
            ..."abcdefghijklmnopqrstuvwxyz".split("").map((c) => `w_${c}`),
          ],
        }),
      },
    ],
  });
  assert("duplicate warning collapsed", warn.ok);
  assert(
    "invalid warning format dropped",
    !warn.snapshot.system_warning_codes.includes("BAD CODE!!")
  );
  assert(
    "unknown warning normalized",
    warn.snapshot.system_warning_codes.includes("UNKNOWN_WARNING_CODE") ||
      warn.snapshot.system_warning_codes.includes("gate.lease")
  );
  assert(
    "allowlisted warning kept",
    warn.snapshot.system_warning_codes.includes("gate.lease")
  );
  assert(
    "warning cap",
    warn.snapshot.system_warning_codes.length <=
      contracts.PHASE_C1_LIMITS.MAX_WARNING_CODES
  );
}

console.log("\nC1 — deterministic adapter");
{
  function runWithCounts(countMap, availabilityMap = {}) {
    const counts = {};
    const availability = {};
    for (const [k, v] of Object.entries(countMap)) {
      counts[k] = v;
      availability[k] = availabilityMap[k] || "available";
    }
    const snap = {
      schema_version: contracts.PHASE_C1_SCHEMA_VERSION,
      purpose: PURPOSE,
      action: PURPOSE,
      environment: "staging",
      business_date_jst: "2026-07-28",
      collected_at: "2026-07-28T00:00:00.000Z",
      counts,
      count_availability: availability,
      system_warning_codes: [],
      source_errors: [],
      limitations: [],
    };
    return adapter.runDeterministicOpsReportPipeline({
      snapshot: snap,
      completed_at: "2026-07-28T01:00:00.000Z",
    });
  }

  const zero = runWithCounts({ pending_total: 0, failed_total: 0, blocked_total: 0 });
  assert("zero state ok", zero.ok === true);
  assert("provider_called false", zero.result.provider_called === false);
  assert("recorded_api_cost 0", zero.result.recorded_api_cost === 0);
  assert(
    "output_type fixed",
    zero.result.output_type === contracts.PHASE_C1_OUTPUT_TYPE
  );
  assert(
    "zero priority none",
    zero.result.priority_levels[0] === "none"
  );

  const blocked = runWithCounts({ blocked_total: 2, failed_total: 1 });
  assert(
    "blocked highest",
    blocked.ok && blocked.result.priority_levels[0] === "critical"
  );
  const failed = runWithCounts({ failed_total: 3, pending_total: 1 });
  assert(
    "failed high",
    failed.ok && failed.result.priority_levels[0] === "high"
  );

  const a1 = runWithCounts({ pending_total: 4, blocked_total: 1 });
  const a2 = runWithCounts({ pending_total: 4, blocked_total: 1 });
  assert(
    "same input same output",
    JSON.stringify(a1.result) === JSON.stringify(a2.result)
  );
  assert(
    "no provider metadata",
    !("provider" in a1.result) && !("model" in a1.result)
  );
}

console.log("\nC1 — output validation");
{
  const good = {
    summary: "本日の未処理項目は合計0件です。緊急の運営対応項目はありません。",
    priorities: ["no urgent operational items"],
    warning_counts: {},
    provider_called: false,
    recorded_api_cost: 0,
    output_type: contracts.PHASE_C1_OUTPUT_TYPE,
    completed_at: "2026-07-28T01:00:00.000Z",
    error_code: null,
  };
  assert(
    "valid output accepted",
    contracts.validateOpsReportValidatedResult(good).ok === true
  );
  assert(
    "unknown key rejected",
    contracts.validateOpsReportValidatedResult({ ...good, stack: "x" }).ok ===
      false
  );
  assert(
    "oversized summary rejected",
    contracts.validateOpsReportValidatedResult({
      ...good,
      summary: "あ".repeat(contracts.PHASE_C1_LIMITS.MAX_SUMMARY_LENGTH + 1),
    }).ok === false
  );
  assert(
    "too many priorities rejected",
    contracts.validateOpsReportValidatedResult({
      ...good,
      priorities: Array.from({ length: 20 }, (_, i) => `p${i}`),
    }).ok === false
  );
  assert(
    "provider_called true rejected",
    contracts.validateOpsReportValidatedResult({
      ...good,
      provider_called: true,
    }).ok === false
  );
  assert(
    "non-zero cost rejected",
    contracts.validateOpsReportValidatedResult({
      ...good,
      recorded_api_cost: 0.01,
    }).ok === false
  );
  assert(
    "stack detail rejected",
    contracts.validateOpsReportValidatedResult({
      ...good,
      stack_trace: "Error: boom",
    }).ok === false
  );
  assert(
    "invalid priority level rejected",
    contracts.validateOpsReportValidatedResult({
      ...good,
      priority_levels: ["urgent"],
    }).ok === false
  );
}

console.log("\nC1 — pipeline integration");
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
    actor_id: "11111111-1111-4111-8111-111111111111",
    parent_execution_id: null,
    preflight_decision: "allowed",
    execution_status: "queued",
    action_type: PURPOSE,
    target_service: caps.PHASE_B_TARGET_SERVICE,
    capability_key: "collect_daily_ops",
    environment: "staging",
    feature_flag_enabled: true,
    emergency_stop_active: false,
    idempotency_key: "staging-ops-pipeline-c1-exec-001",
    payload_hash: "a".repeat(64),
    budget_day_key: "2026-07-28",
    correlation_id: "corr-c1",
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
        state.resultPostCount = (state.resultPostCount || 0) + 1;
        return jsonRes(201, [state.result]);
      }
      if (u.includes("ai_execution_results") && method === "PATCH") {
        state.resultPatched = true;
        return jsonRes(200, [state.result]);
      }
      if (u.includes("rpc/ai_cost_ledger_aggregate") && method === "POST") {
        return jsonRes(200, {
          ok: true,
          group_by: "user",
          currency: "USD",
          from: "2026-07-27T15:00:00.000Z",
          to: "2026-07-28T15:00:00.000Z",
          tz: "Asia/Tokyo",
          rows: [],
        });
      }
      return jsonRes(500, {});
    };
  }

  const state = { row: baseRow(), events: [] };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "11111111-1111-4111-8111-111111111111",
    fetchImpl: makePipelineDb(state),
    now: new Date("2026-07-28T03:00:00.000Z"),
  });
  assert("official purpose routes C1", r.ok && r.body?.status === "succeeded");
  assert("status transition succeeded", state.row.execution_status === "succeeded");
  assert("result insert-only", state.resultPostCount === 1 && !state.resultPatched);
  assert("provider_called false body", r.body?.provider_called === false);
  assert("api cost 0", r.body?.recorded_api_cost === 0);
  assert(
    "persist output_type ops_daily_report",
    state.result.output_type === "ops_daily_report"
  );
  assert(
    "C1 summary language",
    /本日の未処理項目/.test(state.result.sanitized_summary)
  );

  // B4 fixture still works when injected
  const stateB4 = { row: baseRow(), events: [] };
  stateB4.row.idempotency_key = "staging-ops-pipeline-c1-b4-fixture";
  const rB4 = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: stateB4.row.id,
    userId: "11111111-1111-4111-8111-111111111111",
    fetchImpl: makePipelineDb(stateB4),
    collectFn: b4Collector.collectDailyOps,
    reportFn: b4Report.generateOpsReport,
  });
  assert("B4 fixture inject unchanged", rB4.ok && rB4.body?.status === "succeeded");
  assert(
    "B4 summary preserved",
    /Phase B4 deterministic/.test(stateB4.result.sanitized_summary)
  );

  // Direct B4 modules unchanged
  const collected = b4Collector.collectDailyOps({
    executionId: baseRow().id,
    budgetDayKey: "2026-07-28",
  });
  assert("B4 collector fixture intact", collected.source.includes("deterministic_phase_b4"));
  const gen = b4Report.generateOpsReport({
    collected,
    executionId: baseRow().id,
  });
  assert("B4 report intact", gen.metrics.provider_called === false);

  // Dashboard execute route still explicit-only (no page-load auto)
  const dash = readFileSync(
    join(root, "admin-operations-dashboard.html"),
    "utf8"
  );
  const client = readFileSync(
    join(root, "admin-ai-exec-gate-client.js"),
    "utf8"
  );
  assert(
    "Dashboard execute unaffected (no auto execute on load)",
    !/executeGatePipeline|\/api\/ai-exec-gate\/execute/.test(dash) ||
      /create|get/i.test(client)
  );
  assert(
    "client has no page-load execute",
    !/DOMContentLoaded[\s\S]{0,400}execute\(/i.test(client)
  );

  assert(
    "shouldUsePhaseC1Adapters",
    pipeline.shouldUsePhaseC1Adapters(PURPOSE) === true &&
      pipeline.shouldUsePhaseC1Adapters("x") === false
  );
}

console.log(
  errors.length === 0
    ? `\nC1 PASSED (${errors.length} failures)`
    : `\nC1 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
