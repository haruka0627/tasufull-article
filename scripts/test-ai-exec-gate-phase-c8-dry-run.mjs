#!/usr/bin/env node
/**
 * AI Execution Gate — Phase C8 dry-run execution tests
 *   node scripts/test-ai-exec-gate-phase-c8-dry-run.mjs
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
  "deploy/cloudflare/functions/_shared/ai-exec-gate-c8-dry-run.mjs";
const EXEC =
  "deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs";

console.log("C8 — files / static security");
assert("exists c8 module", existsSync(join(root, FILE)));
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
assert("no api_key", !/\bapi[_-]?key\b/i.test(codeOnly));
assert("no eval/Function", !/\beval\s*\(|new\s+Function\b/.test(codeOnly));
assert("no dynamic import", !/\bimport\s*\(/.test(codeOnly));
assert("no adapter.execute", !/adapter\.execute\s*\(/.test(codeOnly));
assert(
  "executor wires dry run",
  /executeDryRun|sanitizeDryRunEventMetadata/.test(execSrc)
);
assert(
  "executor never adapter.execute",
  !/adapter\.execute\s*\(/.test(execSrc)
);
assert(
  "event provider_invocation_dry_run",
  policy.GATE_EVENT_TYPES.PROVIDER_INVOCATION_DRY_RUN ===
    "provider_invocation_dry_run"
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
      correlation_id: "corr-c8",
      actor_id: PHASE_C7_TEST_ACTOR_ID,
      budget_day_key: PHASE_C7_TEST_DAY_KEY,
    },
    provider_id: prep.provider_id,
    prepared_request: prep.prepared,
    budget_decision: opts.budget || sampleBudget("allowed"),
    metadata: {
      port: "secretary_deepseek",
      provider_id: prep.provider_id,
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

console.log("\nC8 — DryRunExecutor / SimulationResult");
{
  const { plan, dispatched } = buildC5();
  const invCtx = c6.buildInvocationContext({
    provider_id: "deepseek",
    plan,
    envelope: dispatched.envelope,
    executed: false,
    provider_called: false,
    recorded_api_cost: 0,
    execution_id: plan.execution_id,
    request_id: plan.request_id,
  });
  assert("inv ctx", invCtx.ok);
  const invocation = c6.evaluateInvocationGate({ context: invCtx.value });
  assert("invocation denied", invocation.decision === "denied");

  const dry = c8.executeDryRun({
    plan,
    envelope: dispatched.envelope,
    invocation,
  });
  assert("dry ok", dry.ok === true);
  assert("simulated", dry.result.simulated === true);
  assert("executed false", dry.executed === false && dry.result.executed === false);
  assert("provider_called false", dry.provider_called === false);
  assert("transmit false", dry.transmit === false);
  assert("cost 0", dry.recorded_api_cost === 0);
  assert("would_invoke false", dry.result.metadata.would_invoke === false);
  assert(
    "would_call_adapter_execute false",
    dry.result.would_call_adapter_execute === false
  );
  assert("result frozen", Object.isFrozen(dry.result));
  assert("metadata frozen", Object.isFrozen(dry.result.metadata));
  assert(
    "hash present",
    typeof dry.result.metadata.prepared_request_hash === "string" &&
      dry.result.metadata.prepared_request_hash.startsWith("fnv1a32:")
  );
  assert(
    "no prompt in metadata",
    !("prepared_request" in dry.result.metadata) &&
      !("prompt" in dry.result.metadata)
  );
  assert(
    "invocation decision recorded",
    dry.result.metadata.invocation_decision === "denied"
  );

  const dry2 = c8.executeDryRun({
    plan,
    envelope: dispatched.envelope,
    invocation,
  });
  assert(
    "deterministic hash",
    dry.result.metadata.prepared_request_hash ===
      dry2.result.metadata.prepared_request_hash
  );

  const meta = c8.sanitizeDryRunEventMetadata(dry);
  assert("event meta simulated", meta.simulated === true);
  assert("event meta no body", !("prepared_request" in meta));

  // invalid mutable plan
  const bad = c8.executeDryRun({
    plan: {
      schema_version: plan.schema_version,
      provider: plan.provider,
      prepared_request: plan.prepared_request,
      budget_decision: plan.budget_decision,
      metadata: plan.metadata,
      request_id: plan.request_id,
      execution_id: plan.execution_id,
      provider_called: false,
      recorded_api_cost: 0,
    },
  });
  assert(
    "mutable plan denied",
    bad.ok === false &&
      (bad.error === c8.PHASE_C8_REASONS.INVALID_PLAN ||
        bad.error === c8.PHASE_C8_REASONS.IMMUTABLE_VIOLATION ||
        bad.reason === c8.PHASE_C8_REASONS.INVALID_PLAN)
  );

  // transmit true forbidden
  const tx = c8.executeDryRun({
    plan,
    envelope: Object.freeze({
      ...dispatched.envelope,
      transmit: true,
    }),
    invocation,
  });
  // buildSimulationContext forces envelope_transmit from input; if transmit true → fail
  assert(
    "transmit true fail-closed",
    tx.ok === false || tx.transmit === false
  );
}

console.log("\nC8 — metadata / hash validation");
{
  assert(
    "hash rejects non-object",
    c8.hashPreparedRequest(null).ok === false
  );
  assert(
    "meta rejects executed true",
    c8.validateSimulationMetadata(
      Object.freeze({
        schema_version: c8.PHASE_C8_SCHEMA_VERSION,
        provider: "deepseek",
        execution_id: "e",
        request_id: "r",
        budget_decision: "allowed",
        invocation_decision: "denied",
        invocation_reason: "provider_disabled",
        prepared_request_hash: "fnv1a32:deadbeef",
        would_invoke: false,
        executed: true,
        provider_called: false,
        transmit: false,
        recorded_api_cost: 0,
      })
    ).ok === false
  );
  assert(
    "meta rejects extra key",
    c8.validateSimulationMetadata(
      Object.freeze({
        schema_version: c8.PHASE_C8_SCHEMA_VERSION,
        provider: "deepseek",
        execution_id: "e",
        request_id: "r",
        budget_decision: null,
        invocation_decision: null,
        invocation_reason: null,
        prepared_request_hash: "fnv1a32:deadbeef",
        would_invoke: false,
        executed: false,
        provider_called: false,
        transmit: false,
        recorded_api_cost: 0,
        prompt: "x",
      })
    ).ok === false
  );
}

console.log("\nC8 — pipeline integration");
{
  const stagingEnv = {
    AI_EXEC_GATE_ENVIRONMENT: "staging",
    AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT: "1",
    AI_EXEC_GATE_EMERGENCY_STOP: "0",
    TASFUL_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  };
  const baseRow = () => ({
    id: "c8c8c8c8-c8c8-4c8c-8c8c-c8c8c8c8c8c8",
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
    idempotency_key: "staging-ops-pipeline-c8-001",
    payload_hash: "a".repeat(64),
    budget_day_key: PHASE_C7_TEST_DAY_KEY,
    correlation_id: "corr-c8",
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
    "dry_run meta",
    r1.body?.dry_run?.simulated === true &&
      r1.body?.dry_run?.executed === false &&
      r1.body?.dry_run?.provider_called === false
  );
  assert(
    "C6 still denied",
    r1.body?.provider_invocation?.decision === "denied"
  );
  assert(
    "dry_run event after invocation denied",
    (() => {
      const i = allowed.events.findIndex(
        (e) => e.event_type === "provider_invocation_denied"
      );
      const d = allowed.events.findIndex(
        (e) => e.event_type === "provider_invocation_dry_run"
      );
      return i >= 0 && d > i;
    })()
  );

  const blocked = { row: baseRow(), events: [] };
  blocked.row.idempotency_key = "staging-ops-pipeline-c8-blocked";
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
  assert("queued preserved", blocked.row.execution_status === "queued");
  assert(
    "no dry_run on blocked",
    !(blocked.events || []).some(
      (e) => e.event_type === "provider_invocation_dry_run"
    )
  );
}

console.log(
  errors.length === 0
    ? `\nC8 PASSED (${errors.length} failures)`
    : `\nC8 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
