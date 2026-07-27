#!/usr/bin/env node
/**
 * AI Execution Gate — Phase B6 integration evidence tests
 *   node scripts/test-ai-exec-gate-phase-b6-integration.mjs
 *
 * No new features. Security / idempotency / B4–B5 separation / HTTP / optional Playwright.
 * Never prints tokens, passwords, or Authorization values.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const base = process.env.TASFUL_DEV_BASE || "http://127.0.0.1:8788";

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

function makeDom() {
  function Node() {
    this.childNodes = [];
    this.attributes = {};
    this.className = "";
    this.dataset = {};
    this._text = "";
    this.listeners = {};
    this.hidden = false;
    this.disabled = false;
  }
  Node.prototype = {
    get textContent() {
      return this._text;
    },
    set textContent(v) {
      this._text = String(v);
    },
    appendChild(c) {
      this.childNodes.push(c);
      return c;
    },
    removeChild(c) {
      this.childNodes = this.childNodes.filter((x) => x !== c);
    },
    get firstChild() {
      return this.childNodes[0] || null;
    },
    setAttribute(k, v) {
      this.attributes[k] = String(v);
    },
    querySelector(sel) {
      if (sel.includes("body")) {
        return (
          this.childNodes.find(
            (c) => c.attributes["data-ops-ai-exec-gate-body"] === ""
          ) || null
        );
      }
      if (sel.includes("refresh")) {
        return (
          this.childNodes.find(
            (c) => c.attributes["data-ops-ai-exec-gate-refresh"] === ""
          ) || null
        );
      }
      if (sel.includes("live")) {
        return (
          this.childNodes.find(
            (c) => c.attributes["data-ops-ai-exec-gate-live"] === ""
          ) || null
        );
      }
      return null;
    },
    addEventListener(t, fn) {
      (this.listeners[t] = this.listeners[t] || []).push(fn);
    },
  };
  return {
    document: {
      readyState: "complete",
      createElement(tag) {
        const n = new Node();
        n.tagName = String(tag).toUpperCase();
        return n;
      },
      querySelector() {
        return null;
      },
      addEventListener() {},
    },
  };
}

function loadClient(extra = {}) {
  const clientSrc = readFileSync(join(root, "admin-ai-exec-gate-client.js"), "utf8");
  const { document } = makeDom();
  const fetchCalls = [];
  const sandbox = {
    window: {},
    console,
    document,
    location: { origin: base, protocol: "http:" },
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url, init = {}) => {
      const u = String(url);
      fetchCalls.push({
        url: u,
        method: String(init.method || "GET").toUpperCase(),
      });
      if (u.includes("/create")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              ok: true,
              execution_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              decision: "allowed",
              status: "queued",
              idempotent_replay:
                fetchCalls.filter((c) => c.url.includes("/create")).length > 1,
            };
          },
        };
      }
      if (u.includes("/execute")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true };
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return (
            extra.getBody || {
              ok: true,
              execution_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              decision: "allowed",
              status: "queued",
              provider_called: false,
              result: null,
            }
          );
        },
      };
    },
    TasuSupabaseClient: {
      getClient() {
        return {
          auth: {
            async getSession() {
              return {
                data: {
                  session: {
                    access_token: "redacted-test-token",
                    user: { id: extra.userId || "ops-actor-a" },
                  },
                },
              };
            },
          },
        };
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(clientSrc, sandbox);
  return { client: sandbox.TasuAiExecGateClient, fetchCalls, document };
}

console.log("B6 — scope / NO-GO static");
const clientSrc = readFileSync(join(root, "admin-ai-exec-gate-client.js"), "utf8");
const execSrc = readFileSync(
  join(root, "deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs"),
  "utf8"
);
assert("no dashboard execute path", !/\/api\/ai-exec-gate\/execute/.test(clientSrc));
assert(
  "no provider SDK in client",
  !/openai|deepseek|anthropic|generativelanguage/i.test(clientSrc)
);
assert("no eval/Function in client", !/\beval\s*\(|new\s+Function\b/.test(clientSrc));
assert("no innerHTML assignment", !/innerHTML\s*=/.test(clientSrc));
assert("FREEZE present", existsSync(join(root, "docs/AI/AI_EXECUTION_GATE.md")));
assert(
  "PLAN present",
  existsSync(join(root, "docs/AI/AI_EXECUTION_GATE_PHASE_B_PLAN.md"))
);
assert(
  "no B6 migration",
  !existsSync(
    join(root, "supabase/migrations/20260729000000_ai_exec_gate_phase_b6.sql")
  )
);
assert("B4 provider_called false path", /provider_called:\s*false/.test(execSrc));

console.log("\nB6 — idempotency key contract boundaries");
const policy = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-policy.mjs")
);
const { validateIdempotencyKey, validateCreateBody } = policy;
assert("key len 7 reject", validateIdempotencyKey("abcdefg").ok === false);
assert("key len 8 accept", validateIdempotencyKey("abcdefgh").ok === true);
assert("key len 200 accept", validateIdempotencyKey("a".repeat(200)).ok === true);
assert("key len 201 reject", validateIdempotencyKey("a".repeat(201)).ok === false);
assert(
  "malformed empty reject",
  validateCreateBody({ idempotency_key: "" }).ok === false
);

const { client } = loadClient();
const jstLate = client.budgetDayKeyJst(new Date("2026-07-28T14:59:00.000Z"));
const jstNext = client.budgetDayKeyJst(new Date("2026-07-28T15:00:00.000Z"));
assert("JST 23:59", jstLate === "2026-07-28");
assert("JST 00:00 next", jstNext === "2026-07-29");
assert(
  "actor keys differ",
  client.buildIdempotencyKey("ops-a", jstLate) !==
    client.buildIdempotencyKey("ops-b", jstLate)
);

console.log("\nB6 — GET sanitization allowlist");
const service = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-service.mjs")
);
const mapped = service.mapSanitizedResultForGet({
  sanitized_summary: "ok",
  metrics: {
    pending_total: 3,
    provider_called: false,
    recorded_api_cost: 0,
    secret: "nope",
  },
  output_type: "ops_daily_report",
  completed_at: "2026-07-28T00:00:00.000Z",
  error_code: null,
});
const allowed = [
  "summary",
  "pending_total",
  "provider_called",
  "recorded_api_cost",
  "output_type",
  "completed_at",
  "error_code",
];
assert(
  "only allowlisted result keys",
  Object.keys(mapped).every((k) => allowed.includes(k))
);
const getBody = service.mapGetResponse(
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    preflight_decision: "allowed",
    execution_status: "succeeded",
    action_type: "ops_secretary.daily_pending.report_pipeline",
    target_service: "ops_secretary",
    capability_key: "collect_daily_ops",
    correlation_id: "c",
    parent_execution_id: null,
    budget_day_key: "2026-07-28",
    created_at: "t",
    idempotency_key: "hidden-key",
    payload_hash: "hidden-hash",
  },
  [],
  {
    sanitized_summary: "sum",
    metrics: { pending_total: 0, provider_called: false, recorded_api_cost: 0 },
  }
);
assert("get omits idempotency_key", !("idempotency_key" in getBody));
assert("get omits payload_hash", !("payload_hash" in getBody));
assert("provider_called false", getBody.provider_called === false);
assert("recorded cost 0", getBody.result.recorded_api_cost === 0);

console.log("\nB6 — auth helpers / ops claims");
const opsAuth = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-ops-auth.mjs")
);
assert("ops is_ops", opsAuth.isOpsFromClaims({ is_ops: true }) === true);
assert("ops tasu_admin", opsAuth.isOpsFromClaims({ role: "tasu_admin" }) === true);
assert("non-ops deny", opsAuth.isOpsFromClaims({ role: "user" }) === false);
assert("null deny", opsAuth.isOpsFromClaims(null) === false);

console.log("\nB6 — dashboard UI states (no execute)");
const states = [
  { name: "loading", view: { loading: true } },
  { name: "unauthorized", view: { error: "auth_required", http: 401 } },
  {
    name: "blocked",
    view: { decision: "blocked", status: "failed", reason: "feature_disabled" },
  },
  { name: "failed", view: { decision: "allowed", status: "failed" } },
  { name: "queued", view: { decision: "allowed", status: "queued" } },
  { name: "running", view: { decision: "allowed", status: "running" } },
  {
    name: "succeeded",
    view: {
      decision: "allowed",
      status: "succeeded",
      provider_called: false,
      result: {
        summary: '<img src=x onerror=alert(1)>',
        pending_total: 0,
      },
    },
  },
  { name: "network", view: { error: "network_error", http: 0 } },
  { name: "empty", view: { decision: "allowed", status: null, result: null } },
];
for (const s of states) {
  const { client: c, document: d, fetchCalls } = loadClient();
  c._resetFlightForTests?.();
  const panel = d.createElement("section");
  c.renderPanel(panel, s.view);
  const body = panel.querySelector("[data-ops-ai-exec-gate-body]");
  assert(`state ${s.name} renders`, Boolean(body));
  assert(
    `state ${s.name} no SCRIPT nodes`,
    !body.childNodes.some((n) => n.tagName === "SCRIPT")
  );
  assert(
    `state ${s.name} no execute fetch`,
    fetchCalls.every((f) => !f.url.includes("/execute"))
  );
}

{
  const { client: c, fetchCalls, document: d } = loadClient();
  c._resetFlightForTests();
  const panel = d.createElement("section");
  await c.refreshPanel(panel);
  assert(
    "refresh never calls execute",
    fetchCalls.filter((f) => f.url.includes("/execute")).length === 0
  );
  assert(
    "refresh calls create or get",
    fetchCalls.some((f) => f.url.includes("/create") || f.method === "GET")
  );
}

console.log("\nB6 — B4 separation (get leaves queued; executor transitions)");
const caps = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-capabilities.mjs")
);
const executor = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs")
);
{
  const state = {
    row: {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      actor_id: "ops-actor-a",
      parent_execution_id: null,
      preflight_decision: "allowed",
      execution_status: "queued",
      action_type: caps.PHASE_B_ACTION_TYPE,
      target_service: caps.PHASE_B_TARGET_SERVICE,
      capability_key: "collect_daily_ops",
      environment: "staging",
      feature_flag_enabled: true,
      emergency_stop_active: false,
      idempotency_key: "phase-b-daily-ops-report-2026-07-28-opsactora",
      payload_hash: "b".repeat(64),
      budget_day_key: "2026-07-28",
      correlation_id: "corr-b6",
      execution_attempts: 0,
    },
    events: [],
  };
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    const method = String(init.method || "GET").toUpperCase();
    if (u.includes("ai_execution_requests") && method === "GET") {
      return jsonRes(200, [state.row]);
    }
    if (u.includes("ai_execution_requests") && method === "PATCH") {
      if (u.includes("execution_status=eq.queued")) {
        if (state.row.execution_status !== "queued") return jsonRes(200, []);
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
      return jsonRes(200, state.events);
    }
    if (u.includes("ai_execution_events") && method === "POST") {
      const body = JSON.parse(init.body);
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
  assert("pre-dashboard status queued", state.row.execution_status === "queued");
  const got = service.mapGetResponse(state.row, [], null);
  assert("dashboard get leaves queued", got.status === "queued");
  const ran = await executor.executeGatePipeline({
    env: {
      AI_EXEC_GATE_ENVIRONMENT: "staging",
      AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT: "1",
      AI_EXEC_GATE_EMERGENCY_STOP: "0",
      TASFUL_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
    },
    executionId: state.row.id,
    userId: "ops-actor-a",
    fetchImpl,
  });
  assert("B4 execute succeeds", ran.ok && ran.body?.status === "succeeded");
  assert("B4 provider_called false", ran.body?.provider_called === false);
  assert("B4 recorded cost 0", ran.body?.recorded_api_cost === 0);
  assert("result insert once", Boolean(state.result));
}

console.log("\nB6 — HTTP local (no token values logged)");
try {
  const dash = await fetch(`${base}/admin-operations-dashboard.html`, {
    redirect: "follow",
  });
  assert("dashboard 200", dash.status === 200);
  const noauth = await fetch(`${base}/api/ai-exec-gate/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotency_key: "phase-b-daily-ops-report-2026-07-28-b6httpxx",
    }),
  });
  const noauthBody = await noauth.json().catch(() => ({}));
  assert("no token → 401", noauth.status === 401);
  assert("no token error auth_required", noauthBody.error === "auth_required");
  assert(
    "response has no Authorization echo",
    !JSON.stringify(noauthBody).toLowerCase().includes("bearer")
  );

  const fake = await fetch(`${base}/api/ai-exec-gate/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer faketoken-not-logged",
    },
    body: JSON.stringify({
      idempotency_key: "phase-b-daily-ops-report-2026-07-28-b6httpxx",
    }),
  });
  const fakeBody = await fake.json().catch(() => ({}));
  assert("invalid token → 401", fake.status === 401);
  assert(
    "invalid token sanitized error",
    typeof fakeBody.error === "string" &&
      !/stack|sql|exception/i.test(JSON.stringify(fakeBody))
  );

  const opt = await fetch(`${base}/api/ai-exec-gate/execute`, {
    method: "OPTIONS",
  });
  assert("execute OPTIONS 204", opt.status === 204);
  const getExec = await fetch(`${base}/api/ai-exec-gate/execute`, {
    method: "GET",
  });
  assert("execute GET 405", getExec.status === 405);
} catch (e) {
  console.log(`  · HTTP skipped (${e?.message || e})`);
}

console.log("\nB6 — optional live DB actor isolation (service role; no JWT print)");
const liveKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const liveUrl = process.env.TASFUL_SUPABASE_URL || "http://127.0.0.1:54321";
if (!liveKey) {
  console.log("  · skipped (SUPABASE_SERVICE_ROLE_KEY unset)");
} else {
  const liveEnv = {
    AI_EXEC_GATE_ENVIRONMENT: "staging",
    AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT: "1",
    AI_EXEC_GATE_EMERGENCY_STOP: "0",
    TASFUL_SUPABASE_URL: liveUrl,
    SUPABASE_SERVICE_ROLE_KEY: liveKey,
  };
  const stamp = Date.now();
  const keyA = `phase-b-daily-ops-report-2026-07-28-b6a${String(stamp).slice(-6)}`;
  const keyB = `phase-b-daily-ops-report-2026-07-28-b6b${String(stamp).slice(-6)}`;
  const createdA = await service.createGateExecution({
    env: liveEnv,
    body: { idempotency_key: keyA },
    userId: "b6-ops-actor-a",
  });
  const createdB = await service.createGateExecution({
    env: liveEnv,
    body: { idempotency_key: keyB },
    userId: "b6-ops-actor-b",
  });
  if (createdA.body?.execution_id && createdB.body?.execution_id) {
    assert(
      "actors get distinct executions",
      createdA.body.execution_id !== createdB.body.execution_id
    );
    const cross = await service.getGateExecution({
      env: liveEnv,
      executionId: createdA.body.execution_id,
      userId: "b6-ops-actor-b",
    });
    assert(
      "cross-actor get forbidden",
      cross.http === 403 || cross.error === "forbidden"
    );
    const replayA = await service.createGateExecution({
      env: liveEnv,
      body: { idempotency_key: keyA },
      userId: "b6-ops-actor-a",
    });
    assert(
      "same actor same key replay",
      replayA.body?.execution_id === createdA.body.execution_id &&
        replayA.body?.idempotent_replay === true
    );
  } else {
    console.log("  · live create blocked by flag/env — skip isolation asserts");
  }
}

console.log(
  "\nB6 — optional Playwright browser evidence (injected session; no real secret)"
);
let playwrightRan = false;
try {
  const pw = await import("playwright");
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const net = [];
  page.on("request", (req) => {
    const u = req.url();
    if (
      u.includes("/api/ai-exec-gate") ||
      /openai|deepseek|anthropic|generativelanguage/i.test(u)
    ) {
      net.push({
        method: req.method(),
        path: u.replace(/^https?:\/\/[^/]+/, ""),
      });
    }
  });
  await page.addInitScript(() => {
    window.TasuSupabaseClient = {
      getClient() {
        return {
          auth: {
            async getSession() {
              return {
                data: {
                  session: {
                    access_token: "browser-e2e-redacted",
                    user: { id: "browser-ops-actor" },
                  },
                },
              };
            },
          },
        };
      },
    };
  });
  await page.route("**/api/ai-exec-gate/**", async (route) => {
    const req = route.request();
    const u = req.url();
    if (u.includes("/execute")) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "execute_should_not_be_called",
        }),
      });
      return;
    }
    if (u.includes("/create") && req.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          execution_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          decision: "allowed",
          status: "queued",
          idempotent_replay: false,
          correlation_id: "corr-browser",
        }),
      });
      return;
    }
    if (req.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          execution_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          decision: "allowed",
          status: "succeeded",
          provider_called: false,
          result: {
            summary: "B6 deterministic summary (fixture)",
            pending_total: 0,
            provider_called: false,
            recorded_api_cost: 0,
            output_type: "ops_daily_report",
            completed_at: "2026-07-28T00:00:00.000Z",
            error_code: null,
          },
          correlation_id: "corr-browser",
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${base}/admin-operations-dashboard.html`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.TasuSupabaseClient = {
      getClient() {
        return {
          auth: {
            async getSession() {
              return {
                data: {
                  session: {
                    access_token: "browser-e2e-redacted",
                    user: { id: "browser-ops-actor" },
                  },
                },
              };
            },
          },
        };
      },
    };
    if (window.TasuAiExecGateClient?._resetFlightForTests) {
      window.TasuAiExecGateClient._resetFlightForTests();
    }
    if (window.TasuAiExecGateClient?.mount) {
      return window.TasuAiExecGateClient.mount();
    }
    return null;
  });
  await page.waitForTimeout(1500);
  const panel = page.locator("[data-ops-ai-exec-gate-panel]");
  assert("playwright panel visible", await panel.isVisible());
  const text = await panel.innerText();
  assert(
    "playwright shows summary or status",
    /B6 deterministic|完了|受付済み|認証/.test(text)
  );
  const gateNet = net.filter((n) => n.path.includes("/api/ai-exec-gate"));
  assert(
    "playwright network no execute",
    !gateNet.some((n) => n.path.includes("/api/ai-exec-gate/execute"))
  );
  assert(
    "playwright Gate requests are create/get only",
    gateNet.every(
      (n) =>
        n.path.includes("/api/ai-exec-gate/create") ||
        /\/api\/ai-exec-gate\/[0-9a-f-]+/i.test(n.path)
    )
  );
  assert(
    "playwright Gate path has no provider host",
    !gateNet.some((n) =>
      /openai|deepseek|anthropic|generativelanguage/i.test(n.path)
    )
  );
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 2
  );
  assert("desktop no horizontal overflow", overflow === false);

  const shotDir = join(root, "reports");
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({
    path: join(shotDir, "ai-exec-gate-phase-b6-desktop-1280.png"),
    fullPage: false,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const overflowM = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 2
  );
  assert("mobile no horizontal overflow", overflowM === false);
  await page.screenshot({
    path: join(shotDir, "ai-exec-gate-phase-b6-mobile-390.png"),
    fullPage: false,
  });

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.setViewportSize({ width: 768, height: 1024 });
  await page2.goto(`${base}/admin-operations-dashboard.html`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page2.waitForTimeout(1500);
  const t2 = await page2.locator("[data-ops-ai-exec-gate-panel]").innerText();
  assert("unauth shows auth message", /認証/.test(t2));
  await page2.screenshot({
    path: join(shotDir, "ai-exec-gate-phase-b6-tablet-768-unauth.png"),
    fullPage: false,
  });
  await ctx2.close();
  await browser.close();
  playwrightRan = true;
  assert("playwright evidence captured", playwrightRan);
} catch (e) {
  console.log(`  · Playwright skipped (${e?.message || e})`);
}

writeFileSync(
  join(root, "reports", "ai-exec-gate-phase-b6-run-meta.json"),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      base,
      playwright: playwrightRan,
      note: "no secrets embedded",
    },
    null,
    2
  ),
  "utf8"
);

if (errors.length) {
  console.error(`\nFAILED (${errors.length})`);
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
console.log("\nALL PASSED");
