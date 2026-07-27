#!/usr/bin/env node
/**
 * AI Execution Gate — Phase C5 execution boundary tests
 *   node scripts/test-ai-exec-gate-phase-c5-execution-boundary.mjs
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

const c5 = await import(
  relUrl(
    "deploy/cloudflare/functions/_shared/ai-exec-gate-c5-execution-boundary.mjs"
  )
);
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

const FILE =
  "deploy/cloudflare/functions/_shared/ai-exec-gate-c5-execution-boundary.mjs";
const EXEC =
  "deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs";

console.log("C5 — files / static security");
assert("exists c5 module", existsSync(join(root, FILE)));
const src = readFileSync(join(root, FILE), "utf8");
const execSrc = readFileSync(join(root, EXEC), "utf8");
assert("no fetch(", !/\bfetch\s*\(/.test(src));
assert("no axios", !/\baxios\b/.test(src));
assert("no XMLHttpRequest", !/XMLHttpRequest/.test(src));
assert("no WebSocket", !/\bWebSocket\b/.test(src));
assert(
  "no SDK import",
  !/\bfrom\s+["'][^"']*(openai|@anthropic|@google)/i.test(src)
);
assert("no process.env", !/process\.env/.test(src));
assert("no Authorization header", !/Authorization/i.test(src));
assert("no API key literal patterns", !/api[_-]?key/i.test(src));
assert("no eval/Function", !/\beval\s*\(|new\s+Function\b/.test(src));
assert("no dynamic import()", !/\bimport\s*\(/.test(src));
assert("no child_process", !/child_process/.test(src));
assert(
  "c5 never calls adapter.execute",
  !/adapter\.execute\s*\(/.test(src) &&
    !/\.execute\s*\(\s*\{/.test(src)
);
assert(
  "c5 documents no-execute boundary",
  /Does NOT call ProviderAdapter\.execute|NEVER calls ProviderAdapter\.execute/.test(
    src
  )
);
assert(
  "executor never calls adapter.execute",
  !/adapter\.execute\s*\(/.test(execSrc)
);
assert(
  "executor wires C5 plan+dispatch",
  /buildExecutionPlan/.test(execSrc) && /dispatchExecutionPlan/.test(execSrc)
);
assert(
  "boundary event type",
  policy.GATE_EVENT_TYPES.EXECUTION_BOUNDARY_DISPATCHED ===
    "execution_boundary_dispatched"
);

function samplePrepared() {
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
  return prep;
}

function sampleBudget(decision = "allowed") {
  return Object.freeze({
    decision,
    reason: decision === "blocked" ? "hard_cap" : "ok",
    blocked: decision === "blocked",
    warning: decision === "warning",
    remaining: 0.05,
    budget_limit: 0.1,
    current_usage: 0,
    provider_called: false,
    recorded_api_cost: 0,
  });
}

console.log("\nC5 — ExecutionPlan generation");
{
  const prep = samplePrepared();
  const built = c5.buildExecutionPlan({
    context: {
      execution_id: "11111111-1111-4111-8111-111111111111",
      request_id: "11111111-1111-4111-8111-111111111111",
      correlation_id: "corr-c5",
      actor_id: "user-1",
      budget_day_key: "2026-07-28",
    },
    provider_id: prep.provider_id,
    prepared_request: prep.prepared,
    budget_decision: sampleBudget("allowed"),
    metadata: {
      port: "secretary_deepseek",
      provider_id: "deepseek",
      adapter_status: "unsupported",
      provider_called: false,
      recorded_api_cost: 0,
      schema_version: prep.prepared?.schema_version,
    },
  });
  assert("plan ok", built.ok === true);
  assert("plan frozen", Object.isFrozen(built.value));
  assert("plan provider deepseek", built.value.provider === "deepseek");
  assert("plan provider_called false", built.value.provider_called === false);
  assert("plan cost 0", built.value.recorded_api_cost === 0);
  assert(
    "plan has prepared_request",
    built.value.prepared_request &&
      typeof built.value.prepared_request === "object"
  );
  let mutated = false;
  try {
    built.value.provider = "hack";
    mutated = built.value.provider === "hack";
  } catch {
    mutated = false;
  }
  assert("plan immutable", mutated === false);

  assert(
    "unknown provider plan fail",
    c5.buildExecutionPlan({
      context: { execution_id: "x" },
      provider_id: "claude",
      prepared_request: prep.prepared,
      budget_decision: sampleBudget(),
      metadata: {
        provider_called: false,
        recorded_api_cost: 0,
      },
    }).ok === false
  );
}

console.log("\nC5 — Envelope + Dispatcher (NoOp)");
{
  const prep = samplePrepared();
  const plan = c5.buildExecutionPlan({
    context: { execution_id: "exec-c5-2", request_id: "req-c5-2" },
    provider_id: "openai",
    prepared_request: prep.prepared,
    budget_decision: sampleBudget("allowed"),
    metadata: {
      provider_id: "openai",
      provider_called: false,
      recorded_api_cost: 0,
    },
  });
  assert("plan for dispatcher", plan.ok);
  const env = c5.buildExecutionEnvelope(plan.value);
  assert("envelope ok", env.ok === true);
  assert("envelope transmit false", env.value.transmit === false);
  assert("envelope frozen", Object.isFrozen(env.value));
  assert("envelope no call", env.value.provider_called === false);

  const dispatched = c5.dispatchExecutionPlan({ plan: plan.value });
  assert("dispatch ok", dispatched.ok === true);
  assert("dispatch provider_called false", dispatched.provider_called === false);
  assert("dispatch cost 0", dispatched.recorded_api_cost === 0);
  assert("result executed false", dispatched.result.executed === false);
  assert("result dispatched true", dispatched.result.dispatched === true);
  assert(
    "reason not wired",
    dispatched.result.reason === c5.PHASE_C5_REASONS.PROVIDER_EXECUTE_NOT_WIRED
  );
  assert("no fake summary", dispatched.result.summary == null);

  const blockedPlan = c5.buildExecutionPlan({
    context: { execution_id: "exec-blocked" },
    provider_id: "deepseek",
    prepared_request: prep.prepared,
    budget_decision: sampleBudget("blocked"),
    metadata: { provider_called: false, recorded_api_cost: 0 },
  });
  assert("blocked plan builds", blockedPlan.ok);
  const blockedDisp = c5.dispatchExecutionPlan({ plan: blockedPlan.value });
  assert("budget blocked short-circuit", blockedDisp.ok === false);
  assert(
    "budget blocked reason",
    blockedDisp.error === c5.PHASE_C5_REASONS.BUDGET_BLOCKED_SHORT_CIRCUIT
  );
}

console.log("\nC5 — metadata / immutable validation");
{
  assert(
    "meta rejects provider_called true",
    c5.validateExecutionMetadata({
      provider_called: true,
      recorded_api_cost: 0,
    }).ok === false
  );
  assert(
    "meta rejects unknown key",
    c5.validateExecutionMetadata({
      provider_called: false,
      recorded_api_cost: 0,
      secret: "x",
    }).ok === false
  );
  assert(
    "unfrozen plan rejected",
    c5.validateExecutionPlan({
      schema_version: c5.PHASE_C5_SCHEMA_VERSION,
      provider: "deepseek",
      prepared_request: {},
      budget_decision: {},
      metadata: { provider_called: false, recorded_api_cost: 0 },
      request_id: "r",
      execution_id: "e",
      provider_called: false,
      recorded_api_cost: 0,
    }).error === c5.PHASE_C5_ERROR_CODES.IMMUTABLE_VIOLATION
  );
}

console.log("\nC5 — pipeline integration");
{
  const stagingEnv = {
    AI_EXEC_GATE_ENVIRONMENT: "staging",
    AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT: "1",
    AI_EXEC_GATE_EMERGENCY_STOP: "0",
    TASFUL_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  };
  const baseRow = () => ({
    id: "77777777-7777-4777-8777-777777777777",
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
    idempotency_key: "staging-ops-pipeline-c5-001",
    payload_hash: "a".repeat(64),
    budget_day_key: "2026-07-28",
    correlation_id: "corr-c5",
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
  assert(
    "execution_boundary meta",
    r1.body?.execution_boundary?.executed === false &&
      r1.body?.execution_boundary?.provider_called === false
  );
  assert(
    "boundary event",
    allowed.events.some(
      (e) => e.event_type === "execution_boundary_dispatched"
    )
  );
  assert(
    "prepare before boundary",
    (() => {
      const prepIdx = allowed.events.findIndex(
        (e) => e.event_type === "provider_prepare_done"
      );
      const boundIdx = allowed.events.findIndex(
        (e) => e.event_type === "execution_boundary_dispatched"
      );
      return prepIdx >= 0 && boundIdx > prepIdx;
    })()
  );

  const blocked = { row: baseRow(), events: [] };
  blocked.row.idempotency_key = "staging-ops-pipeline-c5-blocked";
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
  assert(
    "no boundary event on blocked",
    !(blocked.events || []).some(
      (e) => e.event_type === "execution_boundary_dispatched"
    )
  );

  const unk = { row: baseRow(), events: [] };
  unk.row.idempotency_key = "staging-ops-pipeline-c5-unknown";
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
}

console.log(
  errors.length === 0
    ? `\nC5 PASSED (${errors.length} failures)`
    : `\nC5 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
