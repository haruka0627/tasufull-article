#!/usr/bin/env node
/**
 * AI Execution Gate — Phase B4 executor / pipeline tests
 *   node scripts/test-ai-exec-gate-phase-b4-executor.mjs
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

const policy = await import(relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-policy.mjs"));
const caps = await import(relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-capabilities.mjs"));
const collector = await import(relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-ops-collector.mjs"));
const report = await import(relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-report-generator.mjs"));
const executor = await import(relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs"));
const repository = await import(relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-repository.mjs"));

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
  idempotency_key: "staging-ops-pipeline-b4-exec-001",
  payload_hash: "a".repeat(64),
  budget_day_key: "2026-07-28",
  correlation_id: "corr-b4",
  execution_attempts: 0,
  blocked_reason: null,
});

console.log("B4 — files / no provider");
const files = [
  "deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs",
  "deploy/cloudflare/functions/_shared/ai-exec-gate-ops-collector.mjs",
  "deploy/cloudflare/functions/_shared/ai-exec-gate-report-generator.mjs",
];
for (const f of files) assert(`exists ${f}`, existsSync(join(root, f)));
const execSrc = readFileSync(join(root, files[0]), "utf8");
const collectSrc = readFileSync(join(root, files[1]), "utf8");
const reportSrc = readFileSync(join(root, files[2]), "utf8");
const repoSrc = readFileSync(
  join(root, "deploy/cloudflare/functions/_shared/ai-exec-gate-repository.mjs"),
  "utf8"
);
assert("no deepseek fetch", !/api\.deepseek|openai\.com|generativelanguage|anthropic/i.test(execSrc));
assert("collector no fetch", !/\bfetch\s*\(/.test(collectSrc));
assert("report no fetch", !/\bfetch\s*\(/.test(reportSrc));
assert("no DEEPSEEK_API_KEY", !/DEEPSEEK_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY/i.test(execSrc + collectSrc + reportSrc));
assert("claim includes parent null", /parent_execution_id=is\.null/.test(repoSrc));
assert(
  "insert-only result (no upsert patch)",
  /export async function insertExecutionResult/.test(repoSrc) &&
    /method:\s*"POST"/.test(repoSrc.slice(repoSrc.indexOf("insertExecutionResult"))) &&
    !/ai_execution_results[\s\S]{0,400}method:\s*"PATCH"/.test(repoSrc) &&
    !/method:\s*"PATCH"[\s\S]{0,200}ai_execution_results/.test(
      repoSrc.slice(repoSrc.indexOf("insertExecutionResult"))
    )
);
assert(
  "execute route uses pipeline",
  /executeGatePipeline/.test(
    readFileSync(
      join(root, "deploy/cloudflare/functions/api/ai-exec-gate/execute.js"),
      "utf8"
    )
  )
);

console.log("\nB4 — collector / generator deterministic");
const collected = collector.collectDailyOps({
  executionId: baseRow().id,
  budgetDayKey: "2026-07-28",
});
assert("collector empty pending", collected.pending.total === 0);
assert("collector no llm source", collected.source.includes("deterministic"));
assert("fixture limitations", collected.limitations.some((l) => /Phase B4/i.test(l)));
const gen = report.generateOpsReport({
  collected,
  executionId: baseRow().id,
});
assert("recorded cost 0", gen.recorded_api_cost === 0);
assert("provider none", gen.report.provider === "none");
assert("metrics provider_called false", gen.metrics.provider_called === false);
assert("summary non-empty", gen.sanitized_summary.length > 10);
assert(
  "deterministic repeat",
  report.generateOpsReport({ collected, executionId: baseRow().id }).sanitized_summary ===
    gen.sanitized_summary
);

console.log("\nB4 — contract validation");
assert(
  "valid contract",
  executor.validateExecutableContract(baseRow(), stagingEnv) === null
);
assert(
  "blocked decision",
  executor.validateExecutableContract(
    { ...baseRow(), preflight_decision: "blocked" },
    stagingEnv
  ) === policy.EXECUTOR_FAILURE_CODES.EXECUTION_NOT_ALLOWED
);
assert(
  "not queued",
  executor.validateExecutableContract(
    { ...baseRow(), execution_status: "draft" },
    stagingEnv
  ) === policy.EXECUTOR_FAILURE_CODES.EXECUTION_NOT_QUEUED
);
assert(
  "wrong action",
  executor.validateExecutableContract(
    { ...baseRow(), action_type: "x" },
    stagingEnv
  ) === policy.EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT
);
assert(
  "parent non-null",
  executor.validateExecutableContract(
    { ...baseRow(), parent_execution_id: baseRow().id },
    stagingEnv
  ) === policy.EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT
);
assert(
  "production env bag",
  executor.validateExecutableContract(baseRow(), {
    ...stagingEnv,
    AI_EXEC_GATE_ENVIRONMENT: "production",
  }) === policy.EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT
);

console.log("\nB4 — pipeline mock DB success + concurrency");
function makePipelineDb(state) {
  return async (url, init = {}) => {
    const u = String(url);
    const method = String(init.method || "GET").toUpperCase();

    if (u.includes("ai_execution_requests") && method === "GET") {
      return jsonRes(200, state.row ? [state.row] : []);
    }
    if (u.includes("ai_execution_requests") && method === "PATCH") {
      if (u.includes("execution_status=eq.queued")) {
        if (!u.includes("parent_execution_id=is.null")) {
          state.claimMissingParentFilter = true;
        }
        if (state.claimFails || state.row.execution_status !== "queued") {
          return jsonRes(200, []);
        }
        // Simulate atomic claim: only first concurrent claim wins
        if (state.claimLock) {
          return jsonRes(200, []);
        }
        state.claimLock = true;
        Object.assign(state.row, JSON.parse(init.body));
        state.claimedCount = (state.claimedCount || 0) + 1;
        state.pipelineRuns = (state.pipelineRuns || 0) + 1;
        return jsonRes(200, [state.row]);
      }
      if (u.includes("execution_status=eq.running")) {
        if (state.failTransition) {
          return jsonRes(200, []);
        }
        Object.assign(state.row, JSON.parse(init.body));
        return jsonRes(200, [state.row]);
      }
      return jsonRes(200, []);
    }
    if (u.includes("ai_execution_events") && method === "GET") {
      return jsonRes(200, state.events || []);
    }
    if (u.includes("ai_execution_events") && method === "POST") {
      if (state.failEvents) {
        return jsonRes(500, { message: "event_db_down" });
      }
      const body = JSON.parse(init.body);
      state.events = state.events || [];
      if (
        state.events.some(
          (e) => e.sequence_number === body.sequence_number
        )
      ) {
        return jsonRes(409, { code: "23505" });
      }
      state.events.push(body);
      return jsonRes(201, [body]);
    }
    if (u.includes("ai_execution_results") && method === "GET") {
      return jsonRes(200, state.result ? [state.result] : []);
    }
    if (u.includes("ai_execution_results") && method === "POST") {
      if (state.failResultPost) {
        return jsonRes(500, { message: "result_db_down" });
      }
      if (state.result) return jsonRes(409, { code: "23505" });
      state.result = JSON.parse(init.body);
      state.resultPostCount = (state.resultPostCount || 0) + 1;
      return jsonRes(201, [state.result]);
    }
    if (u.includes("ai_execution_results") && method === "PATCH") {
      state.resultPatched = true;
      state.result = { ...state.result, ...JSON.parse(init.body) };
      return jsonRes(200, [state.result]);
    }
    return jsonRes(500, {});
  };
}

{
  const state = { row: baseRow(), events: [] };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
  });
  assert("pipeline succeeded", r.ok && r.body?.status === "succeeded");
  assert("provider_called false", r.body?.provider_called === false);
  assert("recorded cost 0", r.body?.recorded_api_cost === 0);
  assert("result persisted", Boolean(state.result));
  assert("no result PATCH", state.resultPatched !== true);
  assert(
    "collect before report events",
    state.events.findIndex((e) => e.event_type === "step_collect_start") <
      state.events.findIndex((e) => e.event_type === "step_report_start")
  );
  assert("terminal succeeded event", state.events.some((e) => e.event_type === "execution_succeeded"));
  assert(
    "single terminal success event",
    state.events.filter((e) => e.event_type === "execution_succeeded").length === 1
  );
  assert("no failure event on success", !state.events.some((e) => e.event_type === "execution_failed"));
  assert("row succeeded", state.row.execution_status === "succeeded");
  assert("no child", state.row.parent_execution_id === null);
  assert("claim parent filter used", state.claimMissingParentFilter !== true);

  const eventCount = state.events.length;
  const resultSnapshot = JSON.stringify(state.result);
  const replay = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
  });
  assert("success replay", replay.body?.idempotent_replay === true);
  assert("replay no new events", state.events.length === eventCount);
  assert("replay result unchanged", JSON.stringify(state.result) === resultSnapshot);
}

{
  // Concurrent claim: only one wins
  const state = { row: baseRow(), events: [] };
  const fetchImpl = makePipelineDb(state);
  const [a, b] = await Promise.all([
    executor.executeGatePipeline({
      env: stagingEnv,
      executionId: state.row.id,
      userId: "user-ops-1",
      fetchImpl,
    }),
    executor.executeGatePipeline({
      env: stagingEnv,
      executionId: state.row.id,
      userId: "user-ops-1",
      fetchImpl,
    }),
  ]);
  const wins = [a, b].filter((r) => r.ok && r.body?.status === "succeeded");
  const loses = [a, b].filter(
    (r) =>
      r.error === policy.EXECUTOR_FAILURE_CODES.EXECUTION_ALREADY_CLAIMED ||
      r.error === policy.EXECUTOR_FAILURE_CODES.EXECUTION_ALREADY_COMPLETED ||
      r.body?.idempotent_replay === true
  );
  assert("concurrent claim one winner", wins.length === 1);
  assert("concurrent loser rejected or replay", loses.length === 1);
  assert("claimed once", state.claimedCount === 1);
  assert("result once", state.resultPostCount === 1);
  assert(
    "one terminal success event",
    state.events.filter((e) => e.event_type === "execution_succeeded").length === 1
  );
}

{
  const state = { row: baseRow(), events: [], claimFails: true };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
  });
  assert(
    "concurrent claim rejected",
    r.error === policy.EXECUTOR_FAILURE_CODES.EXECUTION_ALREADY_CLAIMED && r.http === 409
  );
}

{
  const frozen = {
    execution_id: baseRow().id,
    output_type: "ops_daily_report",
    sanitized_summary: "frozen-success",
    completed_at: "2026-07-28T00:00:00.000Z",
  };
  const state = {
    row: { ...baseRow(), execution_status: "queued" },
    events: [],
    result: { ...frozen },
  };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
  });
  assert(
    "existing result blocks execute",
    r.error === policy.EXECUTOR_FAILURE_CODES.EXECUTION_ALREADY_COMPLETED
  );
  assert("result not overwritten", state.result.sanitized_summary === "frozen-success");
  assert("result timestamp frozen", state.result.completed_at === frozen.completed_at);
  assert("no PATCH overwrite", state.resultPatched !== true);
}

{
  const state = {
    row: { ...baseRow(), execution_status: "succeeded" },
    events: [],
    result: { execution_id: baseRow().id },
  };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
  });
  assert("completed cannot rerun", r.body?.idempotent_replay === true);
}

{
  const state = {
    row: { ...baseRow(), execution_status: "failed" },
    events: [],
  };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
  });
  assert(
    "failed terminal no retry",
    r.error === policy.EXECUTOR_FAILURE_CODES.EXECUTION_FAILED_TERMINAL
  );
}

{
  const state = {
    row: { ...baseRow(), execution_status: "running" },
    events: [],
  };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
  });
  assert(
    "running cannot reclaim",
    r.error === policy.EXECUTOR_FAILURE_CODES.EXECUTION_ALREADY_CLAIMED
  );
}

{
  const state = {
    row: {
      ...baseRow(),
      preflight_decision: "blocked",
      execution_status: "failed",
    },
    events: [],
  };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
  });
  assert(
    "blocked not executable",
    r.error === policy.EXECUTOR_FAILURE_CODES.EXECUTION_NOT_ALLOWED ||
      r.error === policy.EXECUTOR_FAILURE_CODES.EXECUTION_FAILED_TERMINAL
  );
}

console.log("\nB4 — failure paths");
{
  const state = { row: baseRow(), events: [] };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
    collectFn: () => {
      const e = new Error("boom");
      e.code = "collector";
      throw e;
    },
  });
  assert("collector failure → failed", r.error === policy.EXECUTOR_FAILURE_CODES.COLLECTOR_FAILED);
  assert("collector → status failed", state.row.execution_status === "failed");
  assert(
    "collector step failed event",
    state.events.some((e) => e.event_type === "step_collect_failed")
  );
  assert("no raw error leak", !JSON.stringify(r.body).includes("boom"));
}

{
  const state = { row: baseRow(), events: [] };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
    reportFn: () => {
      const e = new Error("report-boom");
      e.code = "report";
      throw e;
    },
  });
  assert("generator failure → failed", r.error === policy.EXECUTOR_FAILURE_CODES.REPORT_GENERATION_FAILED);
  assert("generator → status failed", state.row.execution_status === "failed");
  assert(
    "report step failed event",
    state.events.some((e) => e.event_type === "step_report_failed")
  );
}

{
  const state = { row: baseRow(), events: [], failResultPost: true };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
  });
  assert(
    "result persist failure → failed",
    r.error === policy.EXECUTOR_FAILURE_CODES.RESULT_PERSIST_FAILED
  );
  assert("result fail → status failed", state.row.execution_status === "failed");
}

{
  const state = { row: baseRow(), events: [], failEvents: true };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
  });
  assert(
    "event failure → audit incomplete",
    r.error === policy.EXECUTOR_FAILURE_CODES.EVENT_PERSIST_FAILED ||
      r.error === policy.EXECUTOR_FAILURE_CODES.INTERNAL_ERROR
  );
  assert("event failure not ok success", r.ok === false);
}

{
  const state = { row: baseRow(), events: [], failTransition: true };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
    collectFn: () => {
      throw Object.assign(new Error("x"), { code: "collector" });
    },
  });
  assert(
    "failed transition miss → orphan risk flag",
    r.body?.running_orphan_risk === true || r.ok === false
  );
}

{
  const state = { row: baseRow(), events: [] };
  const realNow = Date.now;
  let jumped = false;
  Date.now = () => (jumped ? realNow() + policy.PHASE_B4_EXECUTOR_TIMEOUT_MS + 5_000 : realNow());
  try {
    const r = await executor.executeGatePipeline({
      env: stagingEnv,
      executionId: state.row.id,
      userId: "user-ops-1",
      fetchImpl: makePipelineDb(state),
      collectFn: (input) => {
        jumped = true;
        return collector.collectDailyOps(input);
      },
    });
    assert(
      "timeout → 504 EXECUTION_TIMEOUT",
      r.error === policy.EXECUTOR_FAILURE_CODES.EXECUTION_TIMEOUT && r.http === 504
    );
    assert("timeout → status failed", state.row.execution_status === "failed");
    assert("timeout no success event", !state.events.some((e) => e.event_type === "execution_succeeded"));
  } finally {
    Date.now = realNow;
  }
}

{
  const bad = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: "bad-id",
    userId: "user-ops-1",
    fetchImpl: async () => jsonRes(500, {}),
  });
  assert("bad uuid", bad.error === "invalid_request");
}

{
  const state = { row: { ...baseRow(), actor_id: "other" }, events: [] };
  const r = await executor.executeGatePipeline({
    env: stagingEnv,
    executionId: state.row.id,
    userId: "user-ops-1",
    fetchImpl: makePipelineDb(state),
  });
  assert("owner mismatch forbidden", r.error === policy.EXECUTOR_FAILURE_CODES.FORBIDDEN);
}

{
  // insertExecutionResult unit: exists → no overwrite
  const state = {
    result: {
      execution_id: baseRow().id,
      sanitized_summary: "keep-me",
      completed_at: "2026-01-01T00:00:00.000Z",
    },
  };
  const cfg = {
    url: "http://127.0.0.1:54321",
    serviceRoleKey: "k",
    fetchImpl: makePipelineDb(state),
  };
  const ins = await repository.insertExecutionResult(cfg, {
    execution_id: baseRow().id,
    sanitized_summary: "overwrite-attempt",
  });
  assert("insert refuses existing", ins.ok === false && ins.reason === "exists");
  assert("existing summary intact", state.result.sanitized_summary === "keep-me");
  assert("no patch on refuse", state.resultPatched !== true);
}

console.log("\nB4 — optional live DB");
const liveKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const liveUrl = process.env.TASFUL_SUPABASE_URL || "http://127.0.0.1:54321";
if (!liveKey) {
  console.log("  · skipped (SUPABASE_SERVICE_ROLE_KEY unset)");
} else {
  const service = await import(relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-service.mjs"));
  const liveEnv = {
    ...stagingEnv,
    TASFUL_SUPABASE_URL: liveUrl,
    SUPABASE_SERVICE_ROLE_KEY: liveKey,
  };
  const key = `b4-live-${Date.now()}-pipeline-key`;
  const created = await service.createGateExecution({
    env: liveEnv,
    body: {
      idempotency_key: key,
      action: caps.PHASE_B_ACTION_TYPE,
      service: caps.PHASE_B_TARGET_SERVICE,
      capabilities: [...policy.PHASE_B_PIPELINE_CAPABILITIES],
      requested_ports: [...policy.PHASE_B_PIPELINE_PORTS],
    },
    userId: "user-ops-live-b4",
  });
  if (!created.body?.execution_id || created.body?.decision !== "allowed") {
    console.log("  · live create not allowed (flag/env) — skip execute");
  } else {
    const exec = await executor.executeGatePipeline({
      env: liveEnv,
      executionId: created.body.execution_id,
      userId: "user-ops-live-b4",
    });
    assert("live execute succeeded", exec.body?.status === "succeeded");
    const again = await executor.executeGatePipeline({
      env: liveEnv,
      executionId: created.body.execution_id,
      userId: "user-ops-live-b4",
    });
    assert("live replay", again.body?.idempotent_replay === true);
  }
}

if (errors.length) {
  console.error(`\nFAILED (${errors.length})`);
  process.exit(1);
}
console.log("\nALL PASSED");
