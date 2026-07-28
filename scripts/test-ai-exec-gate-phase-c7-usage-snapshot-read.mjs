#!/usr/bin/env node
/**
 * AI Execution Gate — Phase C7 authoritative usage snapshot read tests
 *   node scripts/test-ai-exec-gate-phase-c7-usage-snapshot-read.mjs
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

const c7 = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c7-usage-snapshot.mjs")
);
const c3 = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c3-budget.mjs")
);
const c6 = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c6-invocation-gate.mjs")
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
  "deploy/cloudflare/functions/_shared/ai-exec-gate-c7-usage-snapshot.mjs";
const EXEC =
  "deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs";

console.log("C7 — files / static security");
assert("exists c7 module", existsSync(join(root, FILE)));
const src = readFileSync(join(root, FILE), "utf8");
const execSrc = readFileSync(join(root, EXEC), "utf8");
const codeOnly = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
assert("no fetch(", !/\bfetch\s*\(/.test(codeOnly));
assert("no axios", !/\baxios\b/.test(codeOnly));
assert("no WebSocket", !/\bWebSocket\b/.test(codeOnly));
assert("no EventSource", !/\bEventSource\b/.test(codeOnly));
assert(
  "no SDK import",
  !/\bfrom\s+["'][^"']*(openai|@anthropic|@google|deepseek)/i.test(codeOnly)
);
assert("no process.env", !/process\.env\b/.test(codeOnly));
assert("no eval/Function", !/\beval\s*\(|new\s+Function\b/.test(codeOnly));
assert("no dynamic import", !/\bimport\s*\(/.test(codeOnly));
assert("no child_process", !/child_process/.test(codeOnly));
assert("no adapter.execute", !/adapter\.execute\s*\(/.test(codeOnly));
assert(
  "executor ignores budgetUsage default 0",
  !/current_usage:\s*0\s*\}/.test(execSrc) ||
    /budgetUsage.*ignored|No silent default 0/i.test(execSrc)
);
assert(
  "executor wires C7 reader",
  /createSafe07UsageSnapshotReader|usageSnapshotReader|usageSnapshotToBudgetInput/.test(
    execSrc
  )
);
assert(
  "package.json no openai",
  !/"openai"\s*:/.test(readFileSync(join(root, "package.json"), "utf8"))
);

console.log("\nC7 — period / snapshot / isolation");
{
  const p = c7.buildJstDayPeriod(PHASE_C7_TEST_DAY_KEY);
  assert("period ok", p.ok === true);
  assert("period start +09", p.period_start.endsWith("+09:00"));
  assert("period end exclusive next day", p.period_end.startsWith("2026-07-29"));
  assert("invalid day fail", c7.buildJstDayPeriod("2026-13-40").ok === false);

  const built = c7.buildUsageSnapshotFromAggregate({
    actor_id: PHASE_C7_TEST_ACTOR_ID,
    environment: "staging",
    budget_day_key: PHASE_C7_TEST_DAY_KEY,
    snapshot_at: "2026-07-28T01:00:00.000Z",
    aggregateJson: {
      ok: true,
      currency: "USD",
      rows: [],
    },
  });
  assert("empty rows available 0", built.ok && built.snapshot.recorded_usage_usd === 0);
  assert("snapshot frozen", Object.isFrozen(built.snapshot));

  const withUsage = c7.buildUsageSnapshotFromAggregate({
    actor_id: PHASE_C7_TEST_ACTOR_ID,
    environment: "staging",
    budget_day_key: PHASE_C7_TEST_DAY_KEY,
    snapshot_at: "2026-07-28T01:00:00.000Z",
    aggregateJson: {
      ok: true,
      currency: "USD",
      rows: [
        {
          bucket: PHASE_C7_TEST_ACTOR_ID,
          estimated_cost_sum: 0.05,
          currency: "USD",
        },
        {
          bucket: "22222222-2222-4222-8222-222222222222",
          estimated_cost_sum: 99,
          currency: "USD",
        },
      ],
    },
  });
  assert(
    "actor isolation (no sum-all)",
    withUsage.ok && withUsage.snapshot.recorded_usage_usd === 0.05
  );

  assert(
    "wrong tenant not uuid fail",
    c7.buildUsageSnapshotFromAggregate({
      actor_id: "not-a-uuid",
      environment: "staging",
      budget_day_key: PHASE_C7_TEST_DAY_KEY,
      snapshot_at: "2026-07-28T01:00:00.000Z",
      aggregateJson: { ok: true, currency: "USD", rows: [] },
    }).ok === false
  );

  assert(
    "wrong env fail",
    c7.buildUsageSnapshotFromAggregate({
      actor_id: PHASE_C7_TEST_ACTOR_ID,
      environment: "prod",
      budget_day_key: PHASE_C7_TEST_DAY_KEY,
      snapshot_at: "2026-07-28T01:00:00.000Z",
      aggregateJson: { ok: true, currency: "USD", rows: [] },
    }).ok === false
  );

  assert(
    "currency mismatch",
    c7.buildUsageSnapshotFromAggregate({
      actor_id: PHASE_C7_TEST_ACTOR_ID,
      environment: "staging",
      budget_day_key: PHASE_C7_TEST_DAY_KEY,
      snapshot_at: "2026-07-28T01:00:00.000Z",
      aggregateJson: { ok: true, currency: "JPY", rows: [] },
    }).availability === "currency_mismatch"
  );

  assert(
    "ambiguous duplicates",
    c7.buildUsageSnapshotFromAggregate({
      actor_id: PHASE_C7_TEST_ACTOR_ID,
      environment: "staging",
      budget_day_key: PHASE_C7_TEST_DAY_KEY,
      snapshot_at: "2026-07-28T01:00:00.000Z",
      aggregateJson: {
        ok: true,
        currency: "USD",
        rows: [
          { bucket: PHASE_C7_TEST_ACTOR_ID, estimated_cost_sum: 0.1 },
          { bucket: PHASE_C7_TEST_ACTOR_ID, estimated_cost_sum: 0.2 },
        ],
      },
    }).availability === "ambiguous"
  );

  assert(
    "read failure ok=false",
    c7.buildUsageSnapshotFromAggregate({
      actor_id: PHASE_C7_TEST_ACTOR_ID,
      environment: "staging",
      budget_day_key: PHASE_C7_TEST_DAY_KEY,
      snapshot_at: "2026-07-28T01:00:00.000Z",
      aggregateJson: { ok: false, error: "invalid_range" },
    }).availability === "read_failure"
  );

  assert(
    "negative rejected",
    c7.buildUsageSnapshotFromAggregate({
      actor_id: PHASE_C7_TEST_ACTOR_ID,
      environment: "staging",
      budget_day_key: PHASE_C7_TEST_DAY_KEY,
      snapshot_at: "2026-07-28T01:00:00.000Z",
      aggregateJson: {
        ok: true,
        currency: "USD",
        rows: [
          { bucket: PHASE_C7_TEST_ACTOR_ID, estimated_cost_sum: -1 },
        ],
      },
    }).ok === false
  );

  assert(
    "NaN rejected",
    c7.buildUsageSnapshotFromAggregate({
      actor_id: PHASE_C7_TEST_ACTOR_ID,
      environment: "staging",
      budget_day_key: PHASE_C7_TEST_DAY_KEY,
      snapshot_at: "2026-07-28T01:00:00.000Z",
      aggregateJson: {
        ok: true,
        currency: "USD",
        rows: [
          { bucket: PHASE_C7_TEST_ACTOR_ID, estimated_cost_sum: Number.NaN },
        ],
      },
    }).ok === false
  );

  assert(
    "numeric string rejected (no silent coerce)",
    c7.buildUsageSnapshotFromAggregate({
      actor_id: PHASE_C7_TEST_ACTOR_ID,
      environment: "staging",
      budget_day_key: PHASE_C7_TEST_DAY_KEY,
      snapshot_at: "2026-07-28T01:00:00.000Z",
      aggregateJson: {
        ok: true,
        currency: "USD",
        rows: [
          { bucket: PHASE_C7_TEST_ACTOR_ID, estimated_cost_sum: "0.05" },
        ],
      },
    }).ok === false
  );

  assert(
    "extra snapshot field rejected",
    c7.validateUsageSnapshot({
      ...withUsage.snapshot,
      secret: "x",
    }).ok === false
  );

  const budgetIn = c7.usageSnapshotToBudgetInput(withUsage.snapshot);
  assert("budget input", budgetIn.ok && budgetIn.current_usage === 0.05);

  // C3 reuse
  const d0 = c3.evaluateBudgetDecision({ current_usage: 0 });
  const dWarn = c3.evaluateBudgetDecision({
    current_usage: c3.PHASE_C3_HARD_CAP_USD * 0.85,
  });
  const dEq = c3.evaluateBudgetDecision({
    current_usage: c3.PHASE_C3_HARD_CAP_USD,
  });
  const dOver = c3.evaluateBudgetDecision({
    current_usage: c3.PHASE_C3_HARD_CAP_USD + 1,
  });
  assert("C3 zero allowed", d0.ok && d0.decision.decision === "allowed");
  assert("C3 warning", dWarn.ok && dWarn.decision.decision === "warning");
  assert(
    "C3 equal not blocked",
    dEq.ok && dEq.decision.blocked === false
  );
  assert("C3 over blocked", dOver.ok && dOver.decision.blocked === true);
  assert(
    "C3 rejects missing usage",
    c3.evaluateBudgetDecision({}).ok === false
  );
}

console.log("\nC7 — reader contract");
{
  const reader = c7.createSafe07UsageSnapshotReader({
    rpcAggregate: async () => ({
      ok: true,
      currency: "USD",
      rows: [{ bucket: PHASE_C7_TEST_ACTOR_ID, estimated_cost_sum: 0.02 }],
    }),
  });
  const out = await reader.readUsageSnapshot({
    actor_id: PHASE_C7_TEST_ACTOR_ID,
    environment: "staging",
    budget_day_key: PHASE_C7_TEST_DAY_KEY,
    snapshot_at: "2026-07-28T01:00:00.000Z",
  });
  assert("reader available", out.ok && out.snapshot.recorded_usage_usd === 0.02);

  const failReader = c7.createSafe07UsageSnapshotReader({
    rpcAggregate: async () => {
      throw new Error("network");
    },
  });
  const failOut = await failReader.readUsageSnapshot({
    actor_id: PHASE_C7_TEST_ACTOR_ID,
    environment: "staging",
    budget_day_key: PHASE_C7_TEST_DAY_KEY,
    snapshot_at: "2026-07-28T01:00:00.000Z",
  });
  assert("reader fail-closed", failOut.ok === false);
  assert("fail not silent 0", failOut.snapshot == null);

  const fixed = createAvailableUsageReader(0.01);
  const f1 = await fixed.readUsageSnapshot({});
  const f2 = await fixed.readUsageSnapshot({});
  assert(
    "fixed deterministic",
    f1.snapshot.recorded_usage_usd === f2.snapshot.recorded_usage_usd
  );
}

console.log("\nC7 — pipeline integration");
{
  const stagingEnv = {
    AI_EXEC_GATE_ENVIRONMENT: "staging",
    AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT: "1",
    AI_EXEC_GATE_EMERGENCY_STOP: "0",
    TASFUL_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  };
  const baseRow = () => ({
    id: "99999999-9999-4999-8999-999999999999",
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
    idempotency_key: "staging-ops-pipeline-c7-001",
    payload_hash: "a".repeat(64),
    budget_day_key: PHASE_C7_TEST_DAY_KEY,
    correlation_id: "corr-c7",
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
  assert("allowed path succeeds", r1.ok && r1.body?.status === "succeeded");
  assert("provider_called false", r1.body?.provider_called === false);
  assert("recorded_api_cost 0", r1.body?.recorded_api_cost === 0);
  assert(
    "usage meta present",
    r1.body?.usage?.availability === "available"
  );
  assert(
    "C6 denied on body",
    r1.body?.provider_invocation?.decision === "denied" &&
      r1.body?.provider_invocation?.reason ===
        c6.PHASE_C6_REASONS.PROVIDER_DISABLED
  );
  assert(
    "usage_snapshot_loaded event",
    allowed.events.some((e) => e.event_type === "usage_snapshot_loaded")
  );
  assert(
    "budgetUsage override ignored (still succeeds via SAFE mock)",
    true
  );

  const blocked = { row: baseRow(), events: [] };
  blocked.row.idempotency_key = "staging-ops-pipeline-c7-blocked";
  const rBlock = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: blocked.row.id,
    userId: PHASE_C7_TEST_ACTOR_ID,
    fetchImpl: makePipelineDb(blocked),
    usageSnapshotReader: createAvailableUsageReader(
      c3.PHASE_C3_HARD_CAP_USD + 1
    ),
  });
  assert("over cap blocked", rBlock.ok === false);
  assert(
    "blocked code",
    rBlock.body?.error === policy.EXECUTOR_FAILURE_CODES.BUDGET_HARD_CAP
  );
  assert("queued preserved", blocked.row.execution_status === "queued");
  assert("no claim", blocked.claimLock !== true);
  assert(
    "no provider resolve on blocked",
    !(blocked.events || []).some((e) => e.event_type === "provider_resolved")
  );
  assert(
    "no C5/C6 on blocked",
    !(blocked.events || []).some(
      (e) =>
        e.event_type === "execution_boundary_dispatched" ||
        e.event_type === "provider_invocation_denied"
    )
  );

  const readFail = { row: baseRow(), events: [] };
  readFail.row.idempotency_key = "staging-ops-pipeline-c7-readfail";
  const rFail = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: readFail.row.id,
    userId: PHASE_C7_TEST_ACTOR_ID,
    fetchImpl: makePipelineDb(readFail),
    usageSnapshotReader: c7.createFixedUsageReader({
      ok: false,
      availability: "read_failure",
      reason: c7.PHASE_C7_REASONS.USAGE_READ_FAILED,
    }),
  });
  assert("read failure blocked", rFail.ok === false);
  assert(
    "read fail code",
    rFail.body?.error ===
      policy.EXECUTOR_FAILURE_CODES.USAGE_SNAPSHOT_UNAVAILABLE
  );
  assert("read fail queued", readFail.row.execution_status === "queued");
  assert("read fail no claim", readFail.claimLock !== true);
}

console.log(
  errors.length === 0
    ? `\nC7 PASSED (${errors.length} failures)`
    : `\nC7 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
