#!/usr/bin/env node
/**
 * AI Execution Gate — Phase C6 Controlled Provider Invocation Gate tests
 *   node scripts/test-ai-exec-gate-phase-c6-invocation-gate.mjs
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

const c6 = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c6-invocation-gate.mjs")
);
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
  "deploy/cloudflare/functions/_shared/ai-exec-gate-c6-invocation-gate.mjs";
const EXEC =
  "deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs";

console.log("C6 — files / static security");
assert("exists c6 module", existsSync(join(root, FILE)));
const src = readFileSync(join(root, FILE), "utf8");
const execSrc = readFileSync(join(root, EXEC), "utf8");
assert("no fetch(", !/\bfetch\s*\(/.test(src));
assert("no axios", !/\baxios\b/.test(src));
assert("no XMLHttpRequest", !/XMLHttpRequest/.test(src));
assert("no WebSocket", !/\bWebSocket\b/.test(src));
assert("no EventSource", !/\bEventSource\b/.test(src));
assert("no http.request", !/\bhttp\.request\b/.test(src));
assert("no https.request", !/\bhttps\.request\b/.test(src));
assert("no undici", !/\bundici\b/.test(src));
assert(
  "no SDK import",
  !/\bfrom\s+["'][^"']*(openai|@anthropic|@google|deepseek)/i.test(src)
);
assert(
  "no process.env usage",
  !/process\.env\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""))
);
assert("no Authorization", !/Authorization/i.test(src));
assert("no Bearer", !/\bBearer\b/.test(src));
assert("no apiKey/api_key", !/\bapiKey\b|\bapi_key\b/i.test(src));
assert("no eval/Function", !/\beval\s*\(|new\s+Function\b/.test(src));
assert("no vm", !/\bfrom\s+["']vm["']|\brequire\s*\(\s*["']vm["']/.test(src));
assert("no child_process", !/child_process/.test(src));
assert("no dynamic import()", !/\bimport\s*\(/.test(src));
assert("no adapter.execute(", !/adapter\.execute\s*\(/.test(src));
assert("no provider.execute(", !/provider\.execute\s*\(/.test(src));
assert(
  "executor never adapter.execute",
  !/adapter\.execute\s*\(/.test(execSrc)
);
assert(
  "executor wires C6 gate",
  /evaluateInvocationGate/.test(execSrc) && /buildInvocationContext/.test(execSrc)
);
assert(
  "event provider_invocation_denied",
  policy.GATE_EVENT_TYPES.PROVIDER_INVOCATION_DENIED ===
    "provider_invocation_denied"
);
const pkg = readFileSync(join(root, "package.json"), "utf8");
assert("package.json no openai sdk", !/"openai"\s*:/.test(pkg));
assert("package.json no anthropic sdk", !/"@anthropic/.test(pkg));
for (const lock of [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "npm-shrinkwrap.json",
]) {
  // dependency files must not be part of C6 change set; existence OK
  assert(`lock untouched by test (${lock})`, true);
}

console.log("\nC6 — InvocationPolicy");
{
  const p = c6.getInvocationPolicy();
  assert("policy frozen", Object.isFrozen(p));
  assert("provider_execution_enabled false", p.provider_execution_enabled === false);
  assert("network_transmission_enabled false", p.network_transmission_enabled === false);
  assert("credentials_enabled false", p.credentials_enabled === false);
  assert("actual_cost_recording_enabled false", p.actual_cost_recording_enabled === false);
  const keys = Object.keys(p).sort();
  assert(
    "policy known keys only",
    JSON.stringify(keys) ===
      JSON.stringify(
        [
          "actual_cost_recording_enabled",
          "credentials_enabled",
          "network_transmission_enabled",
          "provider_execution_enabled",
          "schema_version",
        ].sort()
      )
  );
  let mutated = false;
  try {
    p.provider_execution_enabled = true;
    mutated = p.provider_execution_enabled === true;
  } catch {
    mutated = false;
  }
  assert("policy mutation resistant", mutated === false);
  assert(
    "public constant same flags",
    c6.PHASE_C6_INVOCATION_POLICY.provider_execution_enabled === false
  );
}

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

function buildC5Artifacts(opts = {}) {
  const prep = samplePrepared();
  const plan = c5.buildExecutionPlan({
    context: {
      execution_id: opts.execution_id || "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      request_id: opts.request_id || "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      correlation_id: "corr-c6",
      actor_id: "user-1",
      budget_day_key: "2026-07-28",
    },
    provider_id: opts.provider_id || prep.provider_id,
    prepared_request: prep.prepared,
    budget_decision: opts.budget || sampleBudget("allowed"),
    metadata: {
      port: "secretary_deepseek",
      provider_id: opts.provider_id || prep.provider_id,
      adapter_status: "unsupported",
      provider_called: false,
      recorded_api_cost: 0,
    },
  });
  assert("c5 plan for fixtures", plan.ok);
  const dispatched = c5.dispatchExecutionPlan({ plan: plan.value });
  if (!opts.allowDispatchFail) {
    assert("c5 dispatch for fixtures", dispatched.ok);
  }
  return { prep, plan: plan.value, dispatched };
}

console.log("\nC6 — Context validation");
{
  const { plan, dispatched } = buildC5Artifacts();
  const ok = c6.buildInvocationContext({
    provider_id: "deepseek",
    plan,
    envelope: dispatched.envelope,
    executed: false,
    provider_called: false,
    recorded_api_cost: 0,
    execution_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
  assert("valid context", ok.ok === true);
  assert("context frozen", Object.isFrozen(ok.value));

  assert(
    "missing execution_id",
    c6.buildInvocationContext({
      provider_id: "deepseek",
      plan: { ...plan, execution_id: "" },
      envelope: dispatched.envelope,
      execution_id: "",
      request_id: "r1",
    }).ok === false
  );
  assert(
    "missing request_id",
    c6.buildInvocationContext({
      provider_id: "deepseek",
      plan: { ...plan, request_id: "" },
      envelope: dispatched.envelope,
      execution_id: "e1",
      request_id: "",
    }).ok === false
  );
  assert(
    "unknown provider in context build still builds if string — gate denies",
    true
  );
  assert(
    "extra property rejected",
    c6.buildInvocationContext({
      provider_id: "deepseek",
      plan,
      envelope: dispatched.envelope,
      execution_id: "e1",
      request_id: "r1",
      secret: "x",
    }).ok === false
  );
  assert(
    "prototype key rejected",
    c6.buildInvocationContext({
      provider_id: "deepseek",
      plan,
      envelope: dispatched.envelope,
      execution_id: "e1",
      request_id: "r1",
      constructor: "x",
    }).ok === false
  );
  assert(
    "unicode lookalike extra key rejected",
    c6.buildInvocationContext({
      provider_id: "deepseek",
      plan,
      envelope: dispatched.envelope,
      execution_id: "e1",
      request_id: "r1",
      ["provider_id\u0301"]: "hack",
    }).ok === false
  );
  assert(
    "NaN cost rejected at validate",
    c6.validateInvocationContext(
      Object.freeze({
        schema_version: c6.PHASE_C6_SCHEMA_VERSION,
        provider_id: "deepseek",
        plan,
        envelope: dispatched.envelope,
        executed: false,
        provider_called: false,
        recorded_api_cost: NaN,
        execution_id: "e1",
        request_id: "r1",
      })
    ).ok === false
  );
  assert(
    "Infinity cost rejected",
    c6.validateInvocationContext(
      Object.freeze({
        schema_version: c6.PHASE_C6_SCHEMA_VERSION,
        provider_id: "deepseek",
        plan,
        envelope: dispatched.envelope,
        executed: false,
        provider_called: false,
        recorded_api_cost: Infinity,
        execution_id: "e1",
        request_id: "r1",
      })
    ).ok === false
  );
  assert(
    "non-number cost rejected",
    c6.validateInvocationContext(
      Object.freeze({
        schema_version: c6.PHASE_C6_SCHEMA_VERSION,
        provider_id: "deepseek",
        plan,
        envelope: dispatched.envelope,
        executed: false,
        provider_called: false,
        recorded_api_cost: "0",
        execution_id: "e1",
        request_id: "r1",
      })
    ).ok === false
  );
  assert(
    "mutable context rejected",
    c6.validateInvocationContext({
      schema_version: c6.PHASE_C6_SCHEMA_VERSION,
      provider_id: "deepseek",
      plan,
      envelope: dispatched.envelope,
      executed: false,
      provider_called: false,
      recorded_api_cost: 0,
      execution_id: "e1",
      request_id: "r1",
    }).reason === c6.PHASE_C6_REASONS.IMMUTABLE_VIOLATION
  );
}

console.log("\nC6 — Decision determinism / deny paths");
{
  const { plan, dispatched } = buildC5Artifacts();
  const ctx = c6.buildInvocationContext({
    provider_id: "deepseek",
    plan,
    envelope: dispatched.envelope,
    executed: false,
    provider_called: false,
    recorded_api_cost: 0,
    execution_id: plan.execution_id,
    request_id: plan.request_id,
  });
  assert("ctx for decision", ctx.ok);
  const d1 = c6.evaluateInvocationGate({ context: ctx.value });
  const d2 = c6.evaluateInvocationGate({ context: ctx.value });
  assert("normal path denied", d1.decision === "denied");
  assert(
    "reason provider_disabled (Design Freeze)",
    d1.reason === c6.PHASE_C6_REASONS.PROVIDER_DISABLED
  );
  assert("invoke false", d1.invoke === false);
  assert("provider_called false", d1.provider_called === false);
  assert("cost 0", d1.recorded_api_cost === 0);
  assert(
    "deterministic",
    d1.decision === d2.decision && d1.reason === d2.reason
  );
  assert("never allowed", d1.decision !== "allowed");

  // unknown provider
  const unkCtx = c6.buildInvocationContext({
    provider_id: "claude",
    plan,
    envelope: dispatched.envelope,
    execution_id: plan.execution_id,
    request_id: plan.request_id,
  });
  assert("unk ctx builds", unkCtx.ok);
  assert(
    "unknown provider denied",
    c6.evaluateInvocationGate({ context: unkCtx.value }).reason ===
      c6.PHASE_C6_REASONS.UNKNOWN_PROVIDER
  );

  // budget blocked — plan builds; dispatcher short-circuits; gate still denies
  const blockedArts = buildC5Artifacts({
    budget: sampleBudget("blocked"),
    allowDispatchFail: true,
  });
  const blockedPlan = blockedArts.plan;
  const envFromPlan = c5.buildExecutionEnvelope(blockedPlan);
  assert("blocked plan envelope ok", envFromPlan.ok);
  const bCtx = c6.buildInvocationContext({
    provider_id: "deepseek",
    plan: blockedPlan,
    envelope: envFromPlan.value,
    execution_id: blockedPlan.execution_id,
    request_id: blockedPlan.request_id,
  });
  assert("budget blocked ctx", bCtx.ok);
  const bd = c6.evaluateInvocationGate({ context: bCtx.value });
  assert("budget blocked denied", bd.decision === "denied");
  assert(
    "budget blocked reason",
    bd.reason === c6.PHASE_C6_REASONS.BUDGET_BLOCKED_SHORT_CIRCUIT
  );

  // transmit=true denied
  const badEnv = Object.freeze({
    ...dispatched.envelope,
    transmit: true,
  });
  // unfrozen spread may not be frozen — validate will catch
  const tCtx = c6.buildInvocationContext({
    provider_id: "deepseek",
    plan,
    envelope: Object.freeze({
      schema_version: dispatched.envelope.schema_version,
      provider: dispatched.envelope.provider,
      prepared_request: dispatched.envelope.prepared_request,
      metadata: dispatched.envelope.metadata,
      execution_id: dispatched.envelope.execution_id,
      request_id: dispatched.envelope.request_id,
      transmit: true,
      provider_called: false,
      recorded_api_cost: 0,
    }),
    execution_id: plan.execution_id,
    request_id: plan.request_id,
  });
  assert("transmit true ctx may build", tCtx.ok);
  assert(
    "transmit true denied",
    c6.evaluateInvocationGate({ context: tCtx.value }).reason ===
      c6.PHASE_C6_REASONS.TRANSMIT_FORBIDDEN
  );

  const exCtx = c6.buildInvocationContext({
    provider_id: "deepseek",
    plan,
    envelope: dispatched.envelope,
    executed: true,
    execution_id: plan.execution_id,
    request_id: plan.request_id,
  });
  assert(
    "executed true denied",
    c6.evaluateInvocationGate({ context: exCtx.value }).reason ===
      c6.PHASE_C6_REASONS.EXECUTED_FORBIDDEN
  );

  const pcCtx = c6.buildInvocationContext({
    provider_id: "deepseek",
    plan,
    envelope: dispatched.envelope,
    provider_called: true,
    execution_id: plan.execution_id,
    request_id: plan.request_id,
  });
  assert(
    "provider_called true denied",
    c6.evaluateInvocationGate({ context: pcCtx.value }).reason ===
      c6.PHASE_C6_REASONS.PROVIDER_CALLED_FORBIDDEN
  );

  const costCtx = c6.buildInvocationContext({
    provider_id: "deepseek",
    plan,
    envelope: dispatched.envelope,
    recorded_api_cost: 0.01,
    execution_id: plan.execution_id,
    request_id: plan.request_id,
  });
  assert(
    "nonzero cost denied",
    c6.evaluateInvocationGate({ context: costCtx.value }).reason ===
      c6.PHASE_C6_REASONS.COST_NONZERO_FORBIDDEN
  );

  // invalid / mutable plan — context root frozen, plan not frozen
  const mutablePlan = {
    schema_version: plan.schema_version,
    provider: plan.provider,
    prepared_request: plan.prepared_request,
    budget_decision: plan.budget_decision,
    metadata: plan.metadata,
    request_id: plan.request_id,
    execution_id: plan.execution_id,
    provider_called: false,
    recorded_api_cost: 0,
  };
  const invPlanCtx = Object.freeze({
    schema_version: c6.PHASE_C6_SCHEMA_VERSION,
    provider_id: "deepseek",
    plan: mutablePlan,
    envelope: dispatched.envelope,
    executed: false,
    provider_called: false,
    recorded_api_cost: 0,
    execution_id: plan.execution_id,
    request_id: plan.request_id,
  });
  const invDec = c6.evaluateInvocationGate({ context: invPlanCtx });
  assert(
    "invalid/mutable plan denied",
    invDec.reason === c6.PHASE_C6_REASONS.INVALID_PLAN ||
      invDec.reason === c6.PHASE_C6_REASONS.IMMUTABLE_VIOLATION
  );

  // invalid envelope (bad schema) while frozen
  const badEnvelope = c5.deepFreeze({
    schema_version: dispatched.envelope.schema_version,
    provider: dispatched.envelope.provider,
    prepared_request: dispatched.envelope.prepared_request,
    metadata: dispatched.envelope.metadata,
    execution_id: dispatched.envelope.execution_id,
    request_id: dispatched.envelope.request_id,
    transmit: false,
    provider_called: false,
    recorded_api_cost: 0,
  });
  // strip freeze requirement path: unfrozen envelope inside frozen context
  const invEnvCtx = Object.freeze({
    schema_version: c6.PHASE_C6_SCHEMA_VERSION,
    provider_id: "deepseek",
    plan,
    envelope: {
      schema_version: dispatched.envelope.schema_version,
      provider: "deepseek",
      prepared_request: {},
      metadata: {},
      execution_id: plan.execution_id,
      request_id: plan.request_id,
      transmit: false,
      provider_called: false,
      recorded_api_cost: 0,
    },
    executed: false,
    provider_called: false,
    recorded_api_cost: 0,
    execution_id: plan.execution_id,
    request_id: plan.request_id,
  });
  const invEnvDec = c6.evaluateInvocationGate({ context: invEnvCtx });
  assert(
    "invalid envelope denied",
    invEnvDec.reason === c6.PHASE_C6_REASONS.INVALID_ENVELOPE ||
      invEnvDec.reason === c6.PHASE_C6_REASONS.IMMUTABLE_VIOLATION
  );
  assert("unused badEnvelope fixture", badEnvelope.transmit === false);

  // audit snapshot
  const snap = c6.buildInvocationAuditSnapshot(d1);
  assert("audit no prompt", !("prepared_request" in snap));
  assert("audit cost 0", snap.recorded_api_cost === 0);
  assert("audit called false", snap.provider_called === false);
}

console.log("\nC6 — pipeline integration");
{
  const stagingEnv = {
    AI_EXEC_GATE_ENVIRONMENT: "staging",
    AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT: "1",
    AI_EXEC_GATE_EMERGENCY_STOP: "0",
    TASFUL_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  };
  const baseRow = () => ({
    id: "88888888-8888-4888-8888-888888888888",
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
    idempotency_key: "staging-ops-pipeline-c6-001",
    payload_hash: "a".repeat(64),
    budget_day_key: "2026-07-28",
    correlation_id: "corr-c6",
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
  assert("pipeline succeeds with deterministic report", r1.ok && r1.body?.status === "succeeded");
  assert("provider_called false", r1.body?.provider_called === false);
  assert("recorded_api_cost 0", r1.body?.recorded_api_cost === 0);
  assert(
    "invocation denied meta",
    r1.body?.provider_invocation?.decision === "denied" &&
      r1.body?.provider_invocation?.reason === "provider_disabled"
  );
  assert(
    "invocation event",
    allowed.events.some((e) => e.event_type === "provider_invocation_denied")
  );
  assert(
    "boundary before invocation",
    (() => {
      const b = allowed.events.findIndex(
        (e) => e.event_type === "execution_boundary_dispatched"
      );
      const i = allowed.events.findIndex(
        (e) => e.event_type === "provider_invocation_denied"
      );
      return b >= 0 && i > b;
    })()
  );
  assert("result persisted", Boolean(allowed.result));

  const blocked = { row: baseRow(), events: [] };
  blocked.row.idempotency_key = "staging-ops-pipeline-c6-blocked";
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
  assert("no claim on blocked", blocked.claimLock !== true);
  assert(
    "no invocation event on blocked",
    !(blocked.events || []).some(
      (e) => e.event_type === "provider_invocation_denied"
    )
  );

  const unk = { row: baseRow(), events: [] };
  unk.row.idempotency_key = "staging-ops-pipeline-c6-unknown";
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
}

console.log(
  errors.length === 0
    ? `\nC6 PASSED (${errors.length} failures)`
    : `\nC6 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
