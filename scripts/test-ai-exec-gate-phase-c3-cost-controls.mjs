#!/usr/bin/env node
/**
 * AI Execution Gate — Phase C3 budget / cost controls tests
 *   node scripts/test-ai-exec-gate-phase-c3-cost-controls.mjs
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

const budget = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-c3-budget.mjs")
);
const { createAvailableUsageReader } = await import(
  relUrl("scripts/lib/ai-exec-gate-c7-test-fixtures.mjs")
);
const b1Budget = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-budget.mjs")
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

console.log("C3 — files / freeze alignment / security");
const file = "deploy/cloudflare/functions/_shared/ai-exec-gate-c3-budget.mjs";
assert("exists c3 budget", existsSync(join(root, file)));
const src = readFileSync(join(root, file), "utf8");
const execSrc = readFileSync(
  join(root, "deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs"),
  "utf8"
);
assert("no fetch", !/\bfetch\s*\(/.test(src));
assert("no axios", !/\baxios\b/.test(src));
assert("no SDK import", !/\bfrom\s+["'][^"']*(openai|anthropic)/i.test(src));
assert(
  "no API key env",
  !/process\.env\.[A-Z0-9_]*(API|KEY|SECRET|TOKEN)/i.test(src)
);
assert("no Authorization header", !/headers\s*:\s*\{[^}]*Authorization/i.test(src));
assert("no eval/Function", !/\beval\s*\(|new\s+Function\b/.test(src));
assert(
  "C3 does not read hard-cap env key",
  !src.includes("AI_EXEC_GATE_PHASE_B_DAILY_HARD_CAP") &&
    !/resolvePhaseBHardCapUsd/.test(src)
);
assert(
  "hard cap aligns B1 default constant",
  budget.PHASE_C3_HARD_CAP_USD === b1Budget.PHASE_B_DEFAULT_HARD_CAP_USD
);
assert("provider disconnected flags", budget.getPhaseC3BudgetPolicy().provider_connected === false);
assert("no SAFE writes", budget.getPhaseC3BudgetPolicy().safe06_write === false);
assert("executor wires budget guard", /evaluatePhaseC3BudgetGuard/.test(execSrc));
assert("freeze doc present", existsSync(join(root, "docs/AI/AI_EXECUTION_GATE.md")));

console.log("\nC3 — decision model");
{
  const under = budget.evaluateBudgetDecision({ current_usage: 0.01 });
  assert("under limit allowed", under.ok && under.decision.decision === "allowed");
  assert("remaining positive", under.decision.remaining > 0);
  assert("estimated 0", under.decision.estimated === 0);
  assert("actual 0", under.decision.actual === 0);
  assert("provider_called false", under.decision.provider_called === false);
  assert("recorded_api_cost 0", under.decision.recorded_api_cost === 0);

  const exact = budget.evaluateBudgetDecision({
    current_usage: budget.PHASE_C3_HARD_CAP_USD,
  });
  assert(
    "exact cap allowed (B1 equal-allowed)",
    exact.ok && exact.decision.blocked === false
  );
  assert("remaining zero", exact.decision.remaining === 0);

  const over = budget.evaluateBudgetDecision({
    current_usage: budget.PHASE_C3_HARD_CAP_USD + 0.0001,
  });
  assert("exceeded blocked", over.ok && over.decision.decision === "blocked");
  assert("reason hard cap", over.decision.reason === "budget_hard_cap");

  const warn = budget.evaluateBudgetDecision({
    current_usage: budget.PHASE_C3_HARD_CAP_USD * 0.85,
  });
  assert("warning near cap", warn.ok && warn.decision.decision === "warning");
  assert("warning still allowed flag", warn.decision.allowed === true);
}

console.log("\nC3 — validation");
{
  assert(
    "negative rejected",
    budget.evaluateBudgetDecision({ current_usage: -1 }).ok === false
  );
  assert(
    "NaN rejected",
    budget.evaluateBudgetDecision({ current_usage: Number.NaN }).ok === false
  );
  assert(
    "Infinity rejected",
    budget.evaluateBudgetDecision({
      current_usage: Number.POSITIVE_INFINITY,
    }).ok === false
  );
  assert(
    "overflow rejected",
    budget.evaluateBudgetDecision({
      current_usage: Number.MAX_SAFE_INTEGER + 1,
    }).ok === false
  );
  assert(
    "invalid budget limit",
    budget.evaluateBudgetDecision({ budget_limit: 0 }).ok === false
  );
  assert(
    "invalid usage string",
    budget.validateBudgetNumber("1").ok === false
  );
  assert(
    "missing budget via empty limit",
    budget.validateBudgetLimit(undefined).ok === false ||
      budget.validateBudgetLimit(null).ok === false
  );
}

console.log("\nC3 — determinism / output allowlist");
{
  const a = budget.evaluateBudgetDecision({ current_usage: 0.05 });
  const b = budget.evaluateBudgetDecision({ current_usage: 0.05 });
  assert(
    "determinism",
    JSON.stringify(a.decision) === JSON.stringify(b.decision)
  );
  assert(
    "extra key rejected",
    budget.validateBudgetDecisionOutput({
      ...a.decision,
      stack: "x",
    }).ok === false
  );
  assert(
    "provider detail rejected",
    budget.validateBudgetDecisionOutput({
      ...a.decision,
      provider: "deepseek",
    }).ok === false
  );
  const state = budget.buildBudgetState(a.decision);
  assert("budget state persistable", state.ok === true);
  const blocked = budget.evaluateBudgetDecision({
    current_usage: budget.PHASE_C3_HARD_CAP_USD + 1,
  });
  const blockedState = budget.buildBudgetState(blocked.decision);
  assert("blocked persist", blockedState.ok && blockedState.state.blocked === true);
  const warn = budget.evaluateBudgetDecision({
    current_usage: budget.PHASE_C3_HARD_CAP_USD * 0.9,
  });
  const warnState = budget.buildBudgetState(warn.decision);
  assert(
    "warning persist",
    warnState.ok && warnState.state.decision === "warning"
  );
}

console.log("\nC3 — pipeline budget guard");
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
    action_type: caps.PHASE_B_ACTION_TYPE,
    target_service: caps.PHASE_B_TARGET_SERVICE,
    capability_key: "collect_daily_ops",
    environment: "staging",
    feature_flag_enabled: true,
    emergency_stop_active: false,
    idempotency_key: "staging-ops-pipeline-c3-budget-001",
    payload_hash: "a".repeat(64),
    budget_day_key: "2026-07-28",
    correlation_id: "corr-c3",
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

  const okState = { row: baseRow(), events: [] };
  const ok = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: okState.row.id,
    userId: "11111111-1111-4111-8111-111111111111",
    fetchImpl: makePipelineDb(okState),
  });
  assert("pipeline under budget succeeds", ok.ok && ok.body?.status === "succeeded");
  assert("provider_called false", ok.body?.provider_called === false);
  assert("recorded_api_cost 0", ok.body?.recorded_api_cost === 0);
  assert("budget on success body", ok.body?.budget?.decision === "allowed");
  assert(
    "budget event emitted",
    okState.events.some((e) => e.event_type === "budget_guard_evaluated")
  );

  const blockedState = { row: baseRow(), events: [] };
  blockedState.row.idempotency_key = "staging-ops-pipeline-c3-budget-blocked";
  const blocked = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: blockedState.row.id,
    userId: "11111111-1111-4111-8111-111111111111",
    fetchImpl: makePipelineDb(blockedState),
    usageSnapshotReader: createAvailableUsageReader(budget.PHASE_C3_HARD_CAP_USD + 1),
  });
  assert("pipeline over budget blocked", blocked.ok === false);
  assert(
    "blocked code",
    blocked.body?.error === policy.EXECUTOR_FAILURE_CODES.BUDGET_HARD_CAP ||
      blocked.body?.code === policy.EXECUTOR_FAILURE_CODES.BUDGET_HARD_CAP ||
      String(JSON.stringify(blocked.body)).includes("budget_hard_cap")
  );
  assert(
    "blocked does not claim",
    blockedState.row.execution_status === "queued"
  );
  assert("blocked no result", !blockedState.result);
  assert(
    "blocked response has budget",
    blocked.body?.budget?.blocked === true
  );
}

console.log(
  errors.length === 0
    ? `\nC3 PASSED (${errors.length} failures)`
    : `\nC3 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
