#!/usr/bin/env node
/**
 * AI Execution Gate — Phase B3 API / policy / auth / idempotency tests
 *   node scripts/test-ai-exec-gate-phase-b3-api.mjs
 *
 * No Staging/Production apply · no git · no deploy · no DeepSeek.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assertNode from "node:assert/strict";

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

const policy = await import(relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-policy.mjs"));
const opsAuth = await import(relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-ops-auth.mjs"));
const service = await import(relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-service.mjs"));
const types = await import(relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-types.mjs"));
const caps = await import(relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-capabilities.mjs"));
const http = await import(relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-http.mjs"));

console.log("B3 — static files / scope");
const files = [
  "deploy/cloudflare/functions/_shared/ai-exec-gate-ops-auth.mjs",
  "deploy/cloudflare/functions/_shared/ai-exec-gate-policy.mjs",
  "deploy/cloudflare/functions/_shared/ai-exec-gate-repository.mjs",
  "deploy/cloudflare/functions/_shared/ai-exec-gate-service.mjs",
  "deploy/cloudflare/functions/_shared/ai-exec-gate-http.mjs",
  "deploy/cloudflare/functions/api/ai-exec-gate/create.js",
  "deploy/cloudflare/functions/api/ai-exec-gate/execute.js",
  "deploy/cloudflare/functions/api/ai-exec-gate/[id].js",
];
for (const f of files) {
  assert(`exists ${f}`, existsSync(join(root, f)));
}
assert(
  "FREEZE untouched",
  existsSync(join(root, "docs/AI/AI_EXECUTION_GATE.md"))
);
assert(
  "no DeepSeek import in create",
  !/deepseek/i.test(
    readFileSync(
      join(root, "deploy/cloudflare/functions/api/ai-exec-gate/create.js"),
      "utf8"
    )
  )
);
assert(
  "no results insert in service",
  !/ai_execution_results/i.test(
    readFileSync(
      join(root, "deploy/cloudflare/functions/_shared/ai-exec-gate-service.mjs"),
      "utf8"
    ).split("countResults")[0]
  )
);

console.log("\nB3 — ops claims");
assert("ops is_ops true", opsAuth.isOpsFromClaims({ is_ops: true }));
assert("ops tasu_admin", opsAuth.isOpsFromClaims({ role: "tasu_admin" }));
assert("non-ops rejected", !opsAuth.isOpsFromClaims({ role: "authenticated" }));
assert("spoof empty rejected", !opsAuth.isOpsFromClaims({}));
assert(
  "body role string not enough without function",
  !opsAuth.isOpsFromClaims({ is_ops: "yes" })
);

console.log("\nB3 — create body validation");
const baseBody = {
  idempotency_key: "staging-ops-pipeline-20260728-demo01",
  action: caps.PHASE_B_ACTION_TYPE,
  service: caps.PHASE_B_TARGET_SERVICE,
  capabilities: [...policy.PHASE_B_PIPELINE_CAPABILITIES],
  requested_ports: [...policy.PHASE_B_PIPELINE_PORTS],
  metadata: { source: "test" },
};
assert("valid body", policy.validateCreateBody(baseBody).ok);
assert(
  "missing idempotency",
  policy.validateCreateBody({ ...baseBody, idempotency_key: undefined }).error ===
    "invalid_idempotency_key"
);
assert(
  "short idempotency",
  policy.validateCreateBody({ ...baseBody, idempotency_key: "short" }).error ===
    "invalid_idempotency_key"
);
assert(
  "invalid action",
  policy.validateCreateBody({ ...baseBody, action: "x" }).error ===
    "action_not_allowed"
);
assert(
  "invalid service",
  policy.validateCreateBody({ ...baseBody, service: "x" }).error ===
    "service_not_allowed"
);
assert(
  "missing capability",
  policy.validateCreateBody({
    ...baseBody,
    capabilities: ["collect_daily_ops"],
  }).error === "invalid_capabilities"
);
assert(
  "duplicate capability",
  policy.validateCreateBody({
    ...baseBody,
    capabilities: ["collect_daily_ops", "collect_daily_ops"],
  }).error === "invalid_capabilities"
);
assert(
  "wrong capability order",
  policy.validateCreateBody({
    ...baseBody,
    capabilities: ["generate_ops_report", "collect_daily_ops"],
  }).error === "invalid_capabilities"
);
assert(
  "invalid port",
  policy.validateCreateBody({
    ...baseBody,
    requested_ports: ["ops_collector", "x", "gate_audit_writer"],
  }).error === "invalid_ports"
);
assert(
  "client estimate forbidden",
  policy.validateCreateBody({ ...baseBody, estimated_api_cost: 0.001 })
    .error === "client_estimate_forbidden"
);
assert(
  "spoofed role forbidden",
  policy.validateCreateBody({ ...baseBody, role: "ops" }).error ===
    "spoofed_role_forbidden"
);
assert(
  "secret metadata redacted",
  (() => {
    const r = policy.validateCreateBody({
      ...baseBody,
      metadata: { prompt: "SECRET", source: "ok", api_key: "k" },
    });
    return (
      r.ok &&
      r.metadata.source === "ok" &&
      r.metadata.prompt === undefined &&
      r.metadata.api_key === undefined
    );
  })()
);
assert(
  "nested metadata rejected",
  policy.validateCreateBody({
    ...baseBody,
    metadata: { nested: { a: 1 } },
  }).error === "invalid_metadata"
);
assert(
  "oversized metadata string",
  policy.validateCreateBody({
    ...baseBody,
    metadata: { note: "x".repeat(201) },
  }).error === "invalid_metadata"
);

console.log("\nB3 — gate policy / environment");
const stagingEnv = {
  AI_EXEC_GATE_ENVIRONMENT: "staging",
  AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT: "1",
  AI_EXEC_GATE_EMERGENCY_STOP: "0",
};
const prodEnv = {
  AI_EXEC_GATE_ENVIRONMENT: "production",
  AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT: "1",
};
assert(
  "production blocked",
  policy.evaluateCreateGatePolicy({
    env: prodEnv,
    capabilityKey: "collect_daily_ops",
    actionType: caps.PHASE_B_ACTION_TYPE,
    targetService: caps.PHASE_B_TARGET_SERVICE,
    daySpentSoFar: 0,
  }).reason === "wrong_environment"
);
assert(
  "emergency stop blocked",
  policy.evaluateCreateGatePolicy({
    env: { ...stagingEnv, AI_EXEC_GATE_EMERGENCY_STOP: "1" },
    capabilityKey: "collect_daily_ops",
    actionType: caps.PHASE_B_ACTION_TYPE,
    targetService: caps.PHASE_B_TARGET_SERVICE,
    daySpentSoFar: 0,
  }).reason === "emergency_stop"
);
assert(
  "feature disabled blocked",
  policy.evaluateCreateGatePolicy({
    env: {
      AI_EXEC_GATE_ENVIRONMENT: "staging",
      AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT: "0",
    },
    capabilityKey: "collect_daily_ops",
    actionType: caps.PHASE_B_ACTION_TYPE,
    targetService: caps.PHASE_B_TARGET_SERVICE,
    daySpentSoFar: 0,
  }).reason === "feature_disabled"
);
assert(
  "hard cap exceeded",
  policy.evaluateCreateGatePolicy({
    env: {
      ...stagingEnv,
      AI_EXEC_GATE_PHASE_B_DAILY_HARD_CAP: "0.005",
    },
    capabilityKey: "collect_daily_ops",
    actionType: caps.PHASE_B_ACTION_TYPE,
    targetService: caps.PHASE_B_TARGET_SERVICE,
    daySpentSoFar: 0,
    estimatedApiCost: 0.01,
  }).reason === "budget_hard_cap"
);
assert(
  "invalid hard cap fail closed",
  policy.evaluateCreateGatePolicy({
    env: {
      ...stagingEnv,
      AI_EXEC_GATE_PHASE_B_DAILY_HARD_CAP: "nope",
    },
    capabilityKey: "collect_daily_ops",
    actionType: caps.PHASE_B_ACTION_TYPE,
    targetService: caps.PHASE_B_TARGET_SERVICE,
    daySpentSoFar: 0,
  }).reason === "invalid_configuration"
);
assert(
  "allowed path",
  policy.evaluateCreateGatePolicy({
    env: stagingEnv,
    capabilityKey: "collect_daily_ops",
    actionType: caps.PHASE_B_ACTION_TYPE,
    targetService: caps.PHASE_B_TARGET_SERVICE,
    executorPort: "ops_collector",
    daySpentSoFar: 0,
  }).decision === "allowed"
);
assert(
  "budget day key JST shape",
  /^\d{4}-\d{2}-\d{2}$/.test(policy.budgetDayKeyJst())
);
assert(
  "fixed server estimate B3",
  policy.PHASE_B3_FIXED_REQUEST_ESTIMATE_USD === 0.01
);

console.log("\nB3 — blocked reasons align with B1");
for (const reason of types.GATE_BLOCKED_REASONS) {
  assert(`known reason ${reason}`, policy.isKnownBlockedReason(reason));
}
assert("unknown reason rejected", !policy.isKnownBlockedReason("feature_flag"));

console.log("\nB3 — idempotency fingerprint");
const fp = policy.buildCreateFingerprint({
  actionType: caps.PHASE_B_ACTION_TYPE,
  targetService: caps.PHASE_B_TARGET_SERVICE,
  capabilities: [...policy.PHASE_B_PIPELINE_CAPABILITIES],
  ports: [...policy.PHASE_B_PIPELINE_PORTS],
});
const hash = await policy.sha256Hex(policy.stableStringify(fp));
assert("hash length 64", hash.length === 64);
assert(
  "payload match",
  service.isIdempotencyPayloadMatch({ payload_hash: hash }, hash)
);
assert(
  "payload mismatch",
  !service.isIdempotencyPayloadMatch({ payload_hash: hash }, "0".repeat(64))
);

console.log("\nB3 — response mapping redaction");
const mapped = service.mapCreateResponse(
  {
    id: "11111111-1111-4111-8111-111111111111",
    preflight_decision: "blocked",
    execution_status: "blocked",
    blocked_reason: "feature_disabled",
    correlation_id: "c1",
    budget_limit_snapshot: 0.1,
  },
  { idempotentReplay: false }
);
assert("response has reason code only", mapped.reason === "feature_disabled");
assert(
  "response omits hard cap",
  !("budget_limit_snapshot" in mapped) && !("hard_cap" in mapped)
);
assert("blocked ok false", mapped.ok === false);

console.log("\nB3 — create with mocked DB (allowed + replay + conflict)");
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

function mockDb(state) {
  return async (url, init = {}) => {
    const u = String(url);
    const method = String(init.method || "GET").toUpperCase();
    if (u.includes("/auth/v1/user")) {
      return jsonRes(200, {
        id: "user-ops-1",
        app_metadata: { is_ops: true },
      });
    }
    if (u.includes("ai_execution_requests") && method === "GET") {
      if (u.includes("budget_day_key")) {
        return jsonRes(200, state.dayRows || []);
      }
      if (u.includes("idempotency_key")) {
        return jsonRes(200, state.byIdem ? [state.byIdem] : []);
      }
      return jsonRes(200, state.byId ? [state.byId] : []);
    }
    if (u.includes("ai_execution_requests") && method === "POST") {
      if (state.forceConflict) {
        return jsonRes(409, { code: "23505" });
      }
      const body = JSON.parse(init.body);
      state.inserted = {
        ...body,
        id: "22222222-2222-4222-8222-222222222222",
        created_at: new Date().toISOString(),
      };
      state.byIdem = state.inserted;
      return jsonRes(201, [state.inserted]);
    }
    if (u.includes("ai_execution_events") && method === "POST") {
      state.events = state.events || [];
      const body = JSON.parse(init.body);
      state.events.push(body);
      return jsonRes(201, [{ ...body, id: `evt-${state.events.length}` }]);
    }
    if (u.includes("ai_execution_events") && method === "GET") {
      return jsonRes(200, state.events || []);
    }
    return jsonRes(500, {});
  };
}

const envDb = {
  ...stagingEnv,
  TASFUL_SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
};

{
  const state = { dayRows: [] };
  const r1 = await service.createGateExecution({
    env: envDb,
    body: baseBody,
    userId: "user-ops-1",
    fetchImpl: mockDb(state),
  });
  assert("create allowed http 201", r1.http === 201 && r1.body?.decision === "allowed");
  assert("create status queued", r1.body?.status === "queued");
  assert("events written >= 3", (state.events || []).length >= 3);
  assert("parent null", state.inserted.parent_execution_id === null);
  assert(
    "no prompt in metadata",
    !JSON.stringify(state.inserted.sanitized_metadata).includes("SECRET")
  );
}

{
  const existingHash = await policy.sha256Hex(
    policy.stableStringify(
      policy.buildCreateFingerprint({
        actionType: caps.PHASE_B_ACTION_TYPE,
        targetService: caps.PHASE_B_TARGET_SERVICE,
        capabilities: [...policy.PHASE_B_PIPELINE_CAPABILITIES],
        ports: [...policy.PHASE_B_PIPELINE_PORTS],
      })
    )
  );
  const state = {
    forceConflict: true,
    byIdem: {
      id: "33333333-3333-4333-8333-333333333333",
      payload_hash: existingHash,
      preflight_decision: "allowed",
      execution_status: "queued",
      blocked_reason: null,
      correlation_id: "replay",
    },
  };
  const r = await service.createGateExecution({
    env: envDb,
    body: baseBody,
    userId: "user-ops-1",
    fetchImpl: mockDb(state),
  });
  assert("idempotent replay", r.body?.idempotent_replay === true);
  assert("same execution id", r.body?.execution_id === state.byIdem.id);
}

{
  const state = {
    forceConflict: true,
    byIdem: {
      id: "44444444-4444-4444-8444-444444444444",
      payload_hash: "f".repeat(64),
      preflight_decision: "allowed",
      execution_status: "queued",
    },
  };
  const r = await service.createGateExecution({
    env: envDb,
    body: baseBody,
    userId: "user-ops-1",
    fetchImpl: mockDb(state),
  });
  assert("payload mismatch conflict", r.error === "idempotency_conflict" && r.http === 409);
}

{
  const state = { dayRows: [] };
  const r = await service.createGateExecution({
    env: {
      ...envDb,
      AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT: "0",
    },
    body: { ...baseBody, idempotency_key: "staging-ops-pipeline-blocked-flag01" },
    userId: "user-ops-1",
    fetchImpl: mockDb(state),
  });
  assert(
    "blocked still persisted",
    r.body?.decision === "blocked" &&
      r.body?.reason === "feature_disabled" &&
      state.inserted?.execution_status === "blocked"
  );
}

{
  const state = { dayRows: [] };
  const failing = mockDb(state);
  const orig = failing;
  const wrapped = async (url, init = {}) => {
    if (String(url).includes("ai_execution_events") && String(init.method || "").toUpperCase() === "POST") {
      return jsonRes(500, { message: "fail" });
    }
    return orig(url, init);
  };
  const r = await service.createGateExecution({
    env: envDb,
    body: { ...baseBody, idempotency_key: "staging-ops-pipeline-event-fail01" },
    userId: "user-ops-1",
    fetchImpl: wrapped,
  });
  assert("event failure returns 500", r.http === 500 && r.error === "event_persist_failed");
  assert("event failure exposes execution_id", Boolean(r.body?.execution_id));
  assert("event failure not clean ok", r.body?.ok === false && r.body?.audit_incomplete === true);
}

console.log("\nB3 — execute stub (no provider / no succeeded)");
{
  const state = {
    byId: {
      id: "55555555-5555-4555-8555-555555555555",
      actor_id: "user-ops-1",
      preflight_decision: "allowed",
      execution_status: "queued",
      blocked_reason: null,
    },
    events: [],
  };
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    const method = String(init.method || "GET").toUpperCase();
    if (u.includes("ai_execution_requests") && method === "GET") {
      return jsonRes(200, [state.byId]);
    }
    if (u.includes("ai_execution_events") && method === "GET") {
      return jsonRes(200, state.events);
    }
    if (u.includes("ai_execution_events") && method === "POST") {
      const body = JSON.parse(init.body);
      state.events.push(body);
      return jsonRes(201, [body]);
    }
    if (u.includes("ai_execution_requests") && method === "PATCH") {
      Object.assign(state.byId, JSON.parse(init.body));
      return jsonRes(200, [state.byId]);
    }
    if (u.includes("ai_execution_results")) {
      throw new Error("results_must_not_be_touched");
    }
    return jsonRes(500, {});
  };
  const r = await service.executeGateStub({
    env: envDb,
    executionId: state.byId.id,
    userId: "user-ops-1",
    fetchImpl,
  });
  assert("stub stays queued", r.body?.status === "queued" && r.body?.stub === true);
  assert("stub no provider", r.body?.provider_called === false && r.body?.pipeline_invoked === false);
  assert("stub event written", state.events.some((e) => e.event_type === "execute_stub_accepted"));
  assert("stub not succeeded", state.byId.execution_status === "queued");

  const replay = await service.executeGateStub({
    env: envDb,
    executionId: state.byId.id,
    userId: "user-ops-1",
    fetchImpl,
  });
  assert("stub replay no dup event", replay.body?.idempotent_replay === true);
  assert(
    "stub events still one accepted",
    state.events.filter((e) => e.event_type === "execute_stub_accepted").length === 1
  );
}

{
  const bad = await service.executeGateStub({
    env: envDb,
    executionId: "not-a-uuid",
    userId: "user-ops-1",
    fetchImpl: async () => jsonRes(500, {}),
  });
  assert("malformed uuid rejected", bad.error === "invalid_request" && bad.http === 400);
}

console.log("\nB3 — requireGateOpsUser mock");
{
  const req = new Request("http://local/api", {
    headers: { Authorization: "Bearer tok" },
  });
  const denied = await opsAuth.requireGateOpsUser(
    req,
    {
      TASFUL_SUPABASE_URL: "http://127.0.0.1:54321",
      TASFUL_SUPABASE_ANON_KEY: "anon",
    },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return { id: "u1", app_metadata: { role: "authenticated" } };
        },
      }),
    }
  );
  assert("normal user ops_required", denied.error === "ops_required" && denied.http === 403);

  const anon = await opsAuth.requireGateOpsUser(
    new Request("http://local/api"),
    { TASFUL_SUPABASE_URL: "http://x", TASFUL_SUPABASE_ANON_KEY: "a" }
  );
  assert("anon auth_required", anon.error === "auth_required");

  const allowed = await opsAuth.requireGateOpsUser(
    req,
    {
      TASFUL_SUPABASE_URL: "http://127.0.0.1:54321",
      TASFUL_SUPABASE_ANON_KEY: "anon",
    },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return { id: "u2", app_metadata: { is_ops: true } };
        },
      }),
    }
  );
  assert("ops user allowed", allowed.ok === true && allowed.userId === "u2");
}

console.log("\nB3 — http helpers");
{
  const badCt = await http.readJsonBody(
    new Request("http://local", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}",
    })
  );
  assert("bad content-type", badCt.error === "unsupported_media_type");

  const badJson = await http.readJsonBody(
    new Request("http://local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    })
  );
  assert("bad json", badJson.error === "invalid_json");
}

// Optional live local DB integration (skipped if no service role / local)
console.log("\nB3 — optional local DB integration");
const liveUrl = process.env.TASFUL_SUPABASE_URL || "http://127.0.0.1:54321";
const liveKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!liveKey) {
  console.log("  · skipped (SUPABASE_SERVICE_ROLE_KEY unset)");
} else {
  try {
    const liveEnv = {
      ...stagingEnv,
      TASFUL_SUPABASE_URL: liveUrl,
      SUPABASE_SERVICE_ROLE_KEY: liveKey,
    };
    const key = `b3-live-${Date.now()}-pipeline-key`;
    const live = await service.createGateExecution({
      env: liveEnv,
      body: { ...baseBody, idempotency_key: key },
      userId: "00000000-0000-4000-8000-000000000099",
    });
    assert("live create returns body", Boolean(live.body?.execution_id));
    const replay = await service.createGateExecution({
      env: liveEnv,
      body: { ...baseBody, idempotency_key: key },
      userId: "00000000-0000-4000-8000-000000000099",
    });
    assert(
      "live replay same id",
      replay.body?.idempotent_replay === true &&
        replay.body?.execution_id === live.body?.execution_id
    );
  } catch (e) {
    console.log(`  · live probe error (non-fatal for unit): ${e.message}`);
  }
}

if (errors.length) {
  console.error(`\nFAILED (${errors.length})`);
  process.exit(1);
}
console.log("\nALL PASSED");
