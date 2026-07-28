#!/usr/bin/env node
/**
 * AI Execution Gate — Phase C9 activation readiness tests
 *   node scripts/test-ai-exec-gate-phase-c9-activation-readiness.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  PHASE_C7_TEST_ACTOR_ID,
  PHASE_C7_TEST_DAY_KEY,
  createAvailableUsageReader,
} from "./lib/ai-exec-gate-c7-test-fixtures.mjs";

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

const c9 = await import(
  relUrl(
    "deploy/cloudflare/functions/_shared/ai-exec-gate-c9-activation-readiness.mjs"
  )
);
const c8 = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c8-dry-run.mjs")
);
const c5 = await import(
  relUrl(
    "deploy/cloudflare/functions/_shared/ai-exec-gate-c5-execution-boundary.mjs"
  )
);
const c4 = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c4-provider.mjs")
);
const c6 = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c6-invocation-gate.mjs")
);
const c3 = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c3-budget.mjs")
);
const caps = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-capabilities.mjs")
);
const collector = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c1-collector.mjs")
);
const executor = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs")
);
const policy = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-policy.mjs")
);

const FILE =
  "deploy/cloudflare/functions/_shared/ai-exec-gate-c9-activation-readiness.mjs";
const EXEC =
  "deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs";

console.log("C9 — files / static security");
assert("exists c9 module", existsSync(join(root, FILE)));
const src = readFileSync(join(root, FILE), "utf8");
const execSrc = readFileSync(join(root, EXEC), "utf8");
const codeOnly = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
assert("no fetch(", !/\bfetch\s*\(/.test(codeOnly));
assert("no axios", !/\baxios\b/.test(codeOnly));
assert("no WebSocket", !/\bWebSocket\b/.test(codeOnly));
assert(
  "no SDK import",
  !/\bfrom\s+["'][^"']*(openai|@anthropic|@google|deepseek)/i.test(codeOnly)
);
assert("no process.env", !/process\.env\b/.test(codeOnly));
assert("no Authorization", !/Authorization/i.test(codeOnly));
assert("no Bearer", !/\bBearer\b/.test(codeOnly));
assert("no api_key", !/\bapi[_-]?key\b/i.test(codeOnly));
assert("no eval/Function", !/\beval\s*\(|new\s+Function\b/.test(codeOnly));
assert("no dynamic import", !/\bimport\s*\(/.test(codeOnly));
assert("no adapter.execute", !/adapter\.execute\s*\(/.test(codeOnly));
assert(
  "executor wires activation",
  /evaluateActivation|sanitizeActivationEventMetadata/.test(execSrc)
);
assert(
  "executor never adapter.execute",
  !/adapter\.execute\s*\(/.test(execSrc)
);
assert(
  "event activation_readiness_evaluated",
  policy.GATE_EVENT_TYPES.ACTIVATION_READINESS_EVALUATED ===
    "activation_readiness_evaluated"
);

function samplePrepared() {
  const PURPOSE = caps.PHASE_B_ACTION_TYPE;
  const snap = collector.collectDailyOperationsSnapshot({
    input: {
      purpose: PURPOSE,
      action: PURPOSE,
      environment: "staging",
      business_date_jst: PHASE_C7_TEST_DAY_KEY,
    },
    collectedAt: "2026-07-28T00:00:00.000Z",
  });
  assert("snapshot ok", snap.ok);
  const prep = c4.prepareProviderNeutralRequest(snap.snapshot, "deepseek");
  assert("prepare ok", prep.ok);
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

function buildC5(opts = {}) {
  const prep = samplePrepared();
  const plan = c5.buildExecutionPlan({
    context: {
      execution_id: opts.execution_id || "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      request_id: opts.request_id || "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      correlation_id: "corr-c9",
      actor_id: PHASE_C7_TEST_ACTOR_ID,
      budget_day_key: PHASE_C7_TEST_DAY_KEY,
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
  assert("c5 plan", plan.ok);
  const dispatched = c5.dispatchExecutionPlan({ plan: plan.value });
  if (!opts.allowDispatchFail) assert("c5 dispatch", dispatched.ok);
  return { prep, plan: plan.value, dispatched };
}

function enabledPolicy() {
  return Object.freeze({
    schema_version: c6.PHASE_C6_SCHEMA_VERSION,
    provider_execution_enabled: true,
    network_transmission_enabled: true,
    credentials_enabled: true,
    actual_cost_recording_enabled: true,
  });
}

function allowedInvocation() {
  return Object.freeze({
    decision: c6.PHASE_C6_DECISIONS.ALLOWED,
    reason: "test_synthetic_allowed",
  });
}

function dryFor(plan, envelope, invocation) {
  return c8.executeDryRun({ plan, envelope, invocation });
}

console.log("\nC9 — Capability / Provider");
{
  const badCap = c9.evaluateCapabilityEligibility("unknown_capability_xyz");
  assert("unknown capability not eligible", badCap.eligible === false);
  assert(
    "unknown capability reason",
    badCap.reason === c9.PHASE_C9_REASONS.UNKNOWN_CAPABILITY
  );
  const goodCap = c9.evaluateCapabilityEligibility("generate_ops_report");
  assert("known capability eligible", goodCap.eligible === true);

  const badProv = c9.evaluateProviderEligibility("not-a-provider");
  assert("unknown provider not eligible", badProv.eligible === false);
  assert(
    "unknown provider reason",
    badProv.reason === c9.PHASE_C9_REASONS.UNKNOWN_PROVIDER
  );
  const goodProv = c9.evaluateProviderEligibility("deepseek");
  assert("known provider eligible", goodProv.eligible === true);

  const uni = c9.evaluateProviderEligibility("deepseek\u200b");
  assert("unicode provider rejected", uni.eligible === false);
}

console.log("\nC9 — ActivationEvaluator decisions");
{
  const { plan, dispatched } = buildC5();
  const dry = dryFor(plan, dispatched.envelope, allowedInvocation());
  assert("dry ok baseline", dry.ok === true);

  const eligible = c9.evaluateActivation({
    capability: "generate_ops_report",
    provider: "deepseek",
    plan,
    envelope: dispatched.envelope,
    budget_decision: plan.budget_decision,
    invocation: allowedInvocation(),
    dry_run: dry,
    policy: enabledPolicy(),
    executed: false,
    provider_called: false,
    transmit: false,
    recorded_api_cost: 0,
  });
  assert("activation eligible", eligible.decision === "eligible");
  assert(
    "activation ready reason",
    eligible.reason === c9.PHASE_C9_REASONS.ACTIVATION_READY
  );
  assert("eligible snapshot frozen", Object.isFrozen(eligible.snapshot));
  assert("eligible executed false", eligible.executed === false);
  assert("eligible provider_called false", eligible.provider_called === false);
  assert("eligible transmit false", eligible.transmit === false);
  assert("eligible cost 0", eligible.recorded_api_cost === 0);
  assert(
    "snapshot has required fields",
    eligible.snapshot.provider === "deepseek" &&
      eligible.snapshot.capability === "generate_ops_report" &&
      eligible.snapshot.activation_decision === "eligible" &&
      eligible.snapshot.budget_decision === "allowed" &&
      eligible.snapshot.invocation_decision === "allowed" &&
      typeof eligible.snapshot.dry_run_decision === "string"
  );
  assert(
    "snapshot no prompt",
    !("prompt" in eligible.snapshot) &&
      !("prepared_request" in eligible.snapshot) &&
      !("Authorization" in eligible.snapshot)
  );

  const unknownCap = c9.evaluateActivation({
    capability: "totally_unknown",
    provider: "deepseek",
    plan,
    envelope: dispatched.envelope,
    invocation: allowedInvocation(),
    dry_run: dry,
    policy: enabledPolicy(),
  });
  assert(
    "unknown capability → not_eligible",
    unknownCap.decision === "not_eligible" &&
      unknownCap.reason === c9.PHASE_C9_REASONS.UNKNOWN_CAPABILITY
  );

  const unknownProv = c9.evaluateActivation({
    capability: "generate_ops_report",
    provider: "nope",
    plan,
    envelope: dispatched.envelope,
    invocation: allowedInvocation(),
    dry_run: dry,
    policy: enabledPolicy(),
  });
  assert(
    "unknown provider → not_eligible",
    unknownProv.decision === "not_eligible" &&
      unknownProv.reason === c9.PHASE_C9_REASONS.UNKNOWN_PROVIDER
  );

  const { plan: blockedPlan } = buildC5({
    budget: sampleBudget("blocked"),
    allowDispatchFail: true,
  });
  // C5 dispatch short-circuits on blocked budget — evaluate plan only.
  const budgetBlocked = c9.evaluateActivation({
    capability: "generate_ops_report",
    provider: "deepseek",
    plan: blockedPlan,
    budget_decision: blockedPlan.budget_decision,
    invocation: allowedInvocation(),
    dry_run: {
      ok: true,
      simulated: true,
      executed: false,
      provider_called: false,
      transmit: false,
      recorded_api_cost: 0,
      result: {
        simulated: true,
        executed: false,
        provider_called: false,
        transmit: false,
        recorded_api_cost: 0,
      },
    },
    policy: enabledPolicy(),
  });
  assert(
    "budget blocked → not_eligible",
    budgetBlocked.decision === "not_eligible" &&
      budgetBlocked.reason === c9.PHASE_C9_REASONS.BUDGET_BLOCKED
  );

  const invDenied = c9.evaluateActivation({
    capability: "generate_ops_report",
    provider: "deepseek",
    plan,
    envelope: dispatched.envelope,
    invocation: Object.freeze({
      decision: c6.PHASE_C6_DECISIONS.DENIED,
      reason: c6.PHASE_C6_REASONS.PROVIDER_DISABLED,
    }),
    dry_run: dry,
    policy: enabledPolicy(),
  });
  assert(
    "invocation denied → not_eligible",
    invDenied.decision === "not_eligible" &&
      invDenied.reason === c9.PHASE_C9_REASONS.INVOCATION_DENIED
  );

  const dryInvalid = c9.evaluateActivation({
    capability: "generate_ops_report",
    provider: "deepseek",
    plan,
    envelope: dispatched.envelope,
    invocation: allowedInvocation(),
    dry_run: { ok: false, reason: "invalid" },
    policy: enabledPolicy(),
  });
  assert(
    "dry run invalid → not_eligible",
    dryInvalid.decision === "not_eligible" &&
      dryInvalid.reason === c9.PHASE_C9_REASONS.DRY_RUN_INVALID
  );

  const policyOff = c9.evaluateActivation({
    capability: "generate_ops_report",
    provider: "deepseek",
    plan,
    envelope: dispatched.envelope,
    invocation: allowedInvocation(),
    dry_run: dry,
    policy: c6.getInvocationPolicy(),
  });
  assert(
    "policy disabled → not_eligible",
    policyOff.decision === "not_eligible" &&
      policyOff.reason === c9.PHASE_C9_REASONS.PROVIDER_DISABLED
  );

  const notEligibleDefault = c9.evaluateActivation({
    capability: "generate_ops_report",
    provider: "deepseek",
    plan,
    envelope: dispatched.envelope,
    invocation: Object.freeze({
      decision: "denied",
      reason: "provider_disabled",
    }),
    dry_run: dry,
    policy: c6.getInvocationPolicy(),
  });
  assert(
    "activation not eligible (live-like)",
    notEligibleDefault.decision === "not_eligible"
  );
}

console.log("\nC9 — Immutable / pollution / extras");
{
  const { plan, dispatched } = buildC5();
  const dry = dryFor(plan, dispatched.envelope, allowedInvocation());
  const r = c9.evaluateActivation({
    capability: "generate_ops_report",
    provider: "deepseek",
    plan,
    envelope: dispatched.envelope,
    invocation: allowedInvocation(),
    dry_run: dry,
    policy: enabledPolicy(),
  });
  assert("result ok", r.ok === true);
  try {
    r.snapshot.activation_decision = "eligible_hack";
  } catch {
    /* freeze may throw in strict */
  }
  assert(
    "snapshot immutable",
    r.snapshot.activation_decision === "eligible"
  );

  const polluted = c9.buildActivationSnapshot({
    provider: "deepseek",
    capability: "generate_ops_report",
    budget_decision: "allowed",
    invocation_decision: "allowed",
    dry_run_decision: "simulated",
    activation_decision: "eligible",
    reason: "activation_ready",
    __proto__: { polluted: true },
  });
  // __proto__ as own key may appear depending on object literal — treat as extra
  const extra = c9.buildActivationSnapshot({
    provider: "deepseek",
    capability: "generate_ops_report",
    budget_decision: "allowed",
    invocation_decision: "allowed",
    dry_run_decision: "simulated",
    activation_decision: "eligible",
    reason: "activation_ready",
    prompt: "SECRET",
  });
  assert("extra fields rejected", extra.ok === false);

  const ctxBad = c9.validateActivationContext({
    schema_version: c9.PHASE_C9_SCHEMA_VERSION,
    evil_field: 1,
  });
  assert("context extras rejected", ctxBad.ok === false);
}

console.log("\nC9 — pipeline integration");
{
  const stagingEnv = {
    AI_EXEC_GATE_ENVIRONMENT: "staging",
    AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT: "1",
    AI_EXEC_GATE_EMERGENCY_STOP: "0",
    TASFUL_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  };
  const baseRow = () => ({
    id: "c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c9c9",
    actor_id: PHASE_C7_TEST_ACTOR_ID,
    parent_execution_id: null,
    preflight_decision: "allowed",
    execution_status: "queued",
    action_type: caps.PHASE_B_ACTION_TYPE,
    target_service: caps.PHASE_B_TARGET_SERVICE,
    capability_key: "collect_daily_ops",
    environment: "staging",
    feature_flag_enabled: true,
    emergency_stop_active: false,
    idempotency_key: "staging-ops-pipeline-c9-001",
    payload_hash: "a".repeat(64),
    budget_day_key: PHASE_C7_TEST_DAY_KEY,
    correlation_id: "corr-c9",
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
      if (u.includes("rpc/ai_cost_ledger_aggregate") && method === "POST") {
        return jsonRes(200, {
          ok: true,
          currency: "USD",
          group_by: "user",
          rows: [],
        });
      }
      return jsonRes(500, {});
    };
  }

  const allowed = { row: baseRow(), events: [] };
  const r1 = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: allowed.row.id,
    userId: PHASE_C7_TEST_ACTOR_ID,
    fetchImpl: makePipelineDb(allowed),
  });
  assert("pipeline succeeds", r1.ok && r1.body?.status === "succeeded");
  assert("provider_called false", r1.body?.provider_called === false);
  assert("recorded_api_cost 0", r1.body?.recorded_api_cost === 0);
  assert(
    "activation meta present",
    r1.body?.activation?.activation_decision === "not_eligible"
  );
  assert(
    "activation reason invocation or policy",
    r1.body?.activation?.reason === "invocation_denied" ||
      r1.body?.activation?.reason === "provider_disabled"
  );
  assert("activation executed false", r1.body?.activation?.executed === false);
  assert(
    "activation provider_called false",
    r1.body?.activation?.provider_called === false
  );
  assert("activation transmit false", r1.body?.activation?.transmit === false);
  assert(
    "activation cost 0",
    r1.body?.activation?.recorded_api_cost === 0
  );
  assert(
    "C6 still denied",
    r1.body?.provider_invocation?.decision === "denied"
  );
  assert(
    "dry_run still simulated",
    r1.body?.dry_run?.simulated === true
  );
  assert(
    "activation event after dry_run",
    (() => {
      const d = allowed.events.findIndex(
        (e) => e.event_type === "provider_invocation_dry_run"
      );
      const a = allowed.events.findIndex(
        (e) => e.event_type === "activation_readiness_evaluated"
      );
      const r = allowed.events.findIndex(
        (e) => e.event_type === "step_report_start"
      );
      return d >= 0 && a > d && r > a;
    })()
  );

  const blocked = { row: baseRow(), events: [] };
  blocked.row.idempotency_key = "staging-ops-pipeline-c9-blocked";
  const rBlock = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: blocked.row.id,
    userId: PHASE_C7_TEST_ACTOR_ID,
    fetchImpl: makePipelineDb(blocked),
    usageSnapshotReader: createAvailableUsageReader(
      c3.PHASE_C3_HARD_CAP_USD + 1
    ),
  });
  assert("budget blocked", rBlock.ok === false);
  assert(
    "blocked code",
    rBlock.body?.error === policy.EXECUTOR_FAILURE_CODES.BUDGET_HARD_CAP
  );
  assert(
    "no activation on blocked",
    !(blocked.events || []).some(
      (e) => e.event_type === "activation_readiness_evaluated"
    )
  );
}

console.log(
  errors.length === 0
    ? `\nC9 PASSED (${errors.length} failures)`
    : `\nC9 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
