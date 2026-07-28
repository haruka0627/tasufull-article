#!/usr/bin/env node
/**
 * AI Execution Gate — Phase C10 production readiness tests
 *   node scripts/test-ai-exec-gate-phase-c10-production-readiness.mjs
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

const c10 = await import(
  relUrl(
    "deploy/cloudflare/functions/_shared/ai-exec-gate-c10-production-readiness.mjs"
  )
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

const FILE =
  "deploy/cloudflare/functions/_shared/ai-exec-gate-c10-production-readiness.mjs";
const EXEC =
  "deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs";

console.log("C10 — files / static security");
assert("exists c10 module", existsSync(join(root, FILE)));
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
  "executor wires readiness",
  /evaluateProductionReadiness|sanitizeReadinessEventMetadata/.test(execSrc)
);
assert(
  "executor never adapter.execute",
  !/adapter\.execute\s*\(/.test(execSrc)
);
assert(
  "pipeline order activation then readiness then report",
  (() => {
    const a = execSrc.indexOf("ACTIVATION_READINESS_EVALUATED");
    const p = execSrc.indexOf("PRODUCTION_READINESS_EVALUATED");
    const r = execSrc.indexOf("STEP_REPORT_START");
    return a >= 0 && p > a && r > p;
  })()
);
assert(
  "event production_readiness_evaluated",
  policy.GATE_EVENT_TYPES.PRODUCTION_READINESS_EVALUATED ===
    "production_readiness_evaluated"
);

function happyInput(overrides = {}) {
  const integration = c10.buildIntegrationSummary({
    validation: true,
    hardening: true,
    safe_usage: true,
    budget: true,
    resolve: true,
    execution_boundary: true,
    invocation_gate: true,
    dry_run: true,
    activation: true,
    deterministic_report: true,
    persist: true,
  });
  assert("integration ok", integration.ok);
  return {
    pipeline_version: c10.PHASE_C10_PIPELINE_VERSION,
    completed_phases: [...c10.PHASE_C10_COMPLETED_PHASES],
    contracts: c10.buildDefaultContracts(),
    security: {
      provider_called: false,
      executed: false,
      transmit: false,
      recorded_api_cost: 0,
      network: false,
      sdk: false,
    },
    regression: { ok: true, suite: "B-C10" },
    integration: integration.value,
    capability: "generate_ops_report",
    provider: "deepseek",
    budget: { decision: "allowed", blocked: false },
    invocation: { decision: "denied", reason: "provider_disabled" },
    dry_run: {
      simulated: true,
      executed: false,
      provider_called: false,
      transmit: false,
      recorded_api_cost: 0,
    },
    activation: { activation_decision: "not_eligible", reason: "invocation_denied" },
    executed: false,
    provider_called: false,
    transmit: false,
    recorded_api_cost: 0,
    ...overrides,
  };
}

console.log("\nC10 — ReadinessEvaluator ready / not_ready");
{
  const ready = c10.evaluateProductionReadiness(happyInput());
  assert("ready decision", ready.decision === "ready");
  assert(
    "ready reason",
    ready.reason === c10.PHASE_C10_REASONS.PRODUCTION_READY
  );
  assert("ready snapshot frozen", Object.isFrozen(ready.snapshot));
  assert("ready executed false", ready.executed === false);
  assert("ready provider_called false", ready.provider_called === false);
  assert("ready transmit false", ready.transmit === false);
  assert("ready cost 0", ready.recorded_api_cost === 0);
  assert(
    "snapshot fields",
    ready.snapshot.decision === "ready" &&
      ready.snapshot.pipeline_version === c10.PHASE_C10_PIPELINE_VERSION &&
      Array.isArray(ready.snapshot.completed_phases) &&
      ready.snapshot.completed_phases.includes("C9")
  );
  assert(
    "no prompt in snapshot",
    !("prompt" in ready.snapshot) && !("Authorization" in ready.snapshot)
  );

  const missing = c10.evaluateProductionReadiness(
    happyInput({ completed_phases: ["B", "C1"] })
  );
  assert(
    "missing phase → not_ready",
    missing.decision === "not_ready" &&
      missing.reason === c10.PHASE_C10_REASONS.MISSING_PHASE
  );

  const pipe = c10.evaluateProductionReadiness(
    happyInput({ pipeline_version: "wrong.pipeline" })
  );
  assert(
    "pipeline mismatch → not_ready",
    pipe.decision === "not_ready" &&
      pipe.reason === c10.PHASE_C10_REASONS.PIPELINE_MISMATCH
  );

  const badCap = c10.evaluateProductionReadiness(
    happyInput({ capability: "unknown_cap" })
  );
  assert(
    "unknown capability → not_ready",
    badCap.decision === "not_ready" &&
      badCap.reason === c10.PHASE_C10_REASONS.UNKNOWN_CAPABILITY
  );

  const badProv = c10.evaluateProductionReadiness(
    happyInput({ provider: "nope" })
  );
  assert(
    "unknown provider → not_ready",
    badProv.decision === "not_ready" &&
      badProv.reason === c10.PHASE_C10_REASONS.UNKNOWN_PROVIDER
  );

  const uni = c10.evaluateProductionReadiness(
    happyInput({ provider: "deepseek\u200b" })
  );
  assert("unicode provider → not_ready", uni.decision === "not_ready");

  const contracts = { ...c10.buildDefaultContracts() };
  // frozen contracts — rebuild mutable for mutation
  const mutableContracts = {};
  for (const k of c10.PHASE_C10_CONTRACT_KEYS) mutableContracts[k] = true;
  mutableContracts.budget = false;
  const badContract = c10.evaluateProductionReadiness(
    happyInput({ contracts: mutableContracts })
  );
  assert(
    "invalid/missing contract → not_ready",
    badContract.decision === "not_ready"
  );

  const policyMismatch = c10.evaluateProductionReadiness(
    happyInput({ invocation: { decision: "" } })
  );
  assert(
    "policy mismatch → not_ready",
    policyMismatch.decision === "not_ready" &&
      policyMismatch.reason === c10.PHASE_C10_REASONS.POLICY_MISMATCH
  );

  const execFlags = c10.evaluateProductionReadiness(
    happyInput({ executed: true })
  );
  assert(
    "execute flags → not_ready",
    execFlags.decision === "not_ready" &&
      execFlags.reason === c10.PHASE_C10_REASONS.EXECUTE_FLAGS_FORBIDDEN
  );

  const noReg = c10.evaluateProductionReadiness(
    happyInput({ regression: { ok: false, suite: "B-C10" } })
  );
  assert(
    "regression incomplete → not_ready",
    noReg.decision === "not_ready" &&
      noReg.reason === c10.PHASE_C10_REASONS.REGRESSION_INCOMPLETE
  );

  const badAct = c10.evaluateProductionReadiness(
    happyInput({ activation: { activation_decision: "maybe" } })
  );
  assert(
    "activation inconsistent → not_ready",
    badAct.decision === "not_ready" &&
      badAct.reason === c10.PHASE_C10_REASONS.ACTIVATION_INCONSISTENT
  );
}

console.log("\nC10 — Immutable / pollution / extras");
{
  const r = c10.evaluateProductionReadiness(happyInput());
  try {
    r.snapshot.decision = "hack";
  } catch {
    /* may throw */
  }
  assert("snapshot immutable", r.snapshot.decision === "ready");

  const extra = c10.buildProductionReadinessSnapshot({
    completed_phases: [...c10.PHASE_C10_COMPLETED_PHASES],
    pipeline_version: c10.PHASE_C10_PIPELINE_VERSION,
    contracts: c10.buildDefaultContracts(),
    security: {
      provider_called: false,
      executed: false,
      transmit: false,
      recorded_api_cost: 0,
    },
    regression: { ok: true, suite: "B-C10" },
    decision: "ready",
    reason: "production_ready",
    prompt: "SECRET",
  });
  assert("extra fields rejected", extra.ok === false);

  const ctxBad = c10.validateReadinessContext({
    schema_version: c10.PHASE_C10_SCHEMA_VERSION,
    evil_field: 1,
  });
  assert("context extras rejected", ctxBad.ok === false);
}

console.log("\nC10 — pipeline integration");
{
  const stagingEnv = {
    AI_EXEC_GATE_ENVIRONMENT: "staging",
    AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT: "1",
    AI_EXEC_GATE_EMERGENCY_STOP: "0",
    TASFUL_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  };
  const baseRow = () => ({
    id: "c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0",
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
    idempotency_key: "staging-ops-pipeline-c10-001",
    payload_hash: "a".repeat(64),
    budget_day_key: PHASE_C7_TEST_DAY_KEY,
    correlation_id: "corr-c10",
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
    "production_readiness ready",
    r1.body?.production_readiness?.decision === "ready"
  );
  assert(
    "readiness executed false",
    r1.body?.production_readiness?.executed === false
  );
  assert(
    "activation still not_eligible",
    r1.body?.activation?.activation_decision === "not_eligible"
  );
  assert(
    "C6 still denied",
    r1.body?.provider_invocation?.decision === "denied"
  );
  assert(
    "event order activation → readiness → report",
    (() => {
      const a = allowed.events.findIndex(
        (e) => e.event_type === "activation_readiness_evaluated"
      );
      const p = allowed.events.findIndex(
        (e) => e.event_type === "production_readiness_evaluated"
      );
      const r = allowed.events.findIndex(
        (e) => e.event_type === "step_report_start"
      );
      return a >= 0 && p > a && r > p;
    })()
  );

  const blocked = { row: baseRow(), events: [] };
  blocked.row.idempotency_key = "staging-ops-pipeline-c10-blocked";
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
    "no readiness on blocked",
    !(blocked.events || []).some(
      (e) => e.event_type === "production_readiness_evaluated"
    )
  );
}

console.log(
  errors.length === 0
    ? `\nC10 PASSED (${errors.length} failures)`
    : `\nC10 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
