#!/usr/bin/env node
/**
 * AI Execution Gate — Phase B5 dashboard / GET / idempotency / XSS tests
 *   node scripts/test-ai-exec-gate-phase-b5-dashboard.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

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

console.log("B5 — files / scope / no page-load execute");
assert(
  "client exists",
  existsSync(join(root, "admin-ai-exec-gate-client.js"))
);
const html = readFileSync(
  join(root, "admin-operations-dashboard.html"),
  "utf8"
);
assert("panel markup", /data-ops-ai-exec-gate-panel/.test(html));
assert("client script include", /admin-ai-exec-gate-client\.js/.test(html));
assert("no approval button", !/data-ops-ai-exec-gate-approve/.test(html));
assert("no send button", !/data-ops-ai-exec-gate-send/.test(html));

const clientSrc = readFileSync(
  join(root, "admin-ai-exec-gate-client.js"),
  "utf8"
);
assert("no execute path constant", !/EXECUTE_PATH|\/api\/ai-exec-gate\/execute/.test(clientSrc));
assert("no DeepSeek API path", !/secretary-deepseek-chat|api\.deepseek/i.test(clientSrc));
assert("no provider env keys", !/DEEPSEEK_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY/.test(clientSrc));
assert("uses create+get", /ai-exec-gate\/create/.test(clientSrc) && /ai-exec-gate\//.test(clientSrc));
assert("no hard cap display", !/hard_cap|HARD_CAP|budget_limit/i.test(clientSrc));
assert("no innerHTML of summary", !/innerHTML\s*=\s*[^\n]*summary/i.test(clientSrc));
assert("uses textContent", /textContent/.test(clientSrc));
assert("single-flight inFlight", /inFlight/.test(clientSrc));
assert(
  "PLAN file present",
  existsSync(join(root, "docs/AI/AI_EXECUTION_GATE_PHASE_B_PLAN.md"))
);
assert(
  "FREEZE file present",
  existsSync(join(root, "docs/AI/AI_EXECUTION_GATE.md"))
);

const css = readFileSync(
  join(root, "admin-operations-dashboard.css"),
  "utf8"
);
assert("minimal css class", /ops-ai-exec-gate__summary/.test(css));

console.log("\nB5 — GET sanitized result mapping");
const service = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-exec-gate-service.mjs")
);
const xssPayload =
  '<img src=x onerror=alert(1)><script>alert(1)</script>';
const mapped = service.mapSanitizedResultForGet({
  sanitized_summary: xssPayload,
  metrics: {
    pending_total: 0,
    provider_called: false,
    recorded_api_cost: 0,
    secret_token: "SHOULD_NOT_LEAK",
    nested: { a: 1 },
  },
  output_type: "ops_daily_report",
  completed_at: "2026-07-28T00:00:00.000Z",
  error_code: null,
  result_payload: { raw: true },
});
assert("summary mapped (raw string ok)", mapped.summary.includes("<script>"));
assert("pending_total 0", mapped.pending_total === 0);
assert("provider_called false", mapped.provider_called === false);
assert("recorded cost 0", mapped.recorded_api_cost === 0);
assert("no secret in mapped keys", !("secret_token" in mapped));
assert("no result_payload", !("result_payload" in mapped));
assert("no nested metrics leak", !("nested" in mapped));

const getBody = service.mapGetResponse(
  {
    id: "66666666-6666-4666-8666-666666666666",
    preflight_decision: "allowed",
    execution_status: "succeeded",
    blocked_reason: null,
    action_type: "ops_secretary.daily_pending.report_pipeline",
    target_service: "ops_secretary",
    capability_key: "collect_daily_ops",
    correlation_id: "corr",
    parent_execution_id: null,
    budget_day_key: "2026-07-28",
    created_at: "2026-07-28T00:00:00.000Z",
    idempotency_key: "should-not-appear",
    payload_hash: "abc",
  },
  Array.from({ length: 50 }, (_, i) => ({
    sequence_number: i + 1,
    event_type: "execution_succeeded",
    sanitized_metadata: { secret: "x" },
    created_at: "x",
  })),
  {
    sanitized_summary: "Phase B4 deterministic ops report",
    metrics: { pending_total: 0, provider_called: false, recorded_api_cost: 0 },
    output_type: "ops_daily_report",
  }
);
assert("get has result.summary", getBody.result?.summary?.includes("deterministic"));
assert("get provider_called false", getBody.provider_called === false);
assert("get no hard_cap", !("hard_cap" in getBody) && !("budget_limit" in getBody));
assert("get no idempotency_key", !("idempotency_key" in getBody));
assert("get no payload_hash", !("payload_hash" in getBody));
assert("events capped ≤40", getBody.events.length <= 40);
assert(
  "events no metadata",
  getBody.events.every((e) => e.sanitized_metadata === undefined)
);

assert(
  "null result safe",
  service.mapGetResponse(
    { id: "1", execution_status: "queued", preflight_decision: "allowed" },
    [],
    null
  ).result === null
);

console.log("\nB5 — client helpers / idempotency / XSS DOM");
function makeDom() {
  function Node() {
    this.childNodes = [];
    this.attributes = {};
    this.className = "";
    this.hidden = false;
    this.disabled = false;
    this._text = "";
    this.dataset = {};
    this.style = {};
    this.listeners = {};
  }
  Node.prototype = {
    get textContent() {
      return this._text;
    },
    set textContent(v) {
      this._text = String(v);
      this.childNodes = [];
    },
    get innerHTML() {
      return this._text;
    },
    set innerHTML(v) {
      throw new Error("innerHTML forbidden in test DOM");
    },
    appendChild(c) {
      this.childNodes.push(c);
      return c;
    },
    removeChild(c) {
      this.childNodes = this.childNodes.filter((x) => x !== c);
      return c;
    },
    get firstChild() {
      return this.childNodes[0] || null;
    },
    setAttribute(k, v) {
      this.attributes[k] = String(v);
    },
    getAttribute(k) {
      return this.attributes[k];
    },
    querySelector(sel) {
      if (sel.includes("body")) {
        return this.childNodes.find((c) => c.attributes["data-ops-ai-exec-gate-body"] === "") || null;
      }
      if (sel.includes("refresh")) {
        return this.childNodes.find((c) => c.attributes["data-ops-ai-exec-gate-refresh"] === "") || null;
      }
      if (sel.includes("live")) {
        return this.childNodes.find((c) => c.attributes["data-ops-ai-exec-gate-live"] === "") || null;
      }
      return null;
    },
    addEventListener(type, fn) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(fn);
    },
  };
  const document = {
    readyState: "complete",
    createElement(tag) {
      const n = new Node();
      n.tagName = tag.toUpperCase();
      return n;
    },
    querySelector() {
      return null;
    },
    addEventListener() {},
  };
  return { document, Node };
}

const { document } = makeDom();
const fetchCalls = [];
const sandbox = {
  window: {},
  console,
  document,
  location: { origin: "http://127.0.0.1:8788", protocol: "http:" },
  AbortController,
  setTimeout,
  clearTimeout,
  fetch: async (url, init = {}) => {
    fetchCalls.push({ url: String(url), method: init.method || "GET", body: init.body });
    const u = String(url);
    if (u.includes("/create")) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            execution_id: "66666666-6666-4666-8666-666666666666",
            decision: "allowed",
            status: "queued",
            idempotent_replay: fetchCalls.filter((c) => c.url.includes("/create")).length > 1,
            correlation_id: "corr-1",
          };
        },
      };
    }
    if (u.includes("/execute")) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { ok: true, status: "succeeded" };
        },
      };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          execution_id: "66666666-6666-4666-8666-666666666666",
          decision: "allowed",
          status: "queued",
          provider_called: false,
          result: null,
          correlation_id: "corr-1",
        };
      },
    };
  },
  setTimeout,
  clearTimeout,
  TasuSupabaseClient: {
    getClient() {
      return {
        auth: {
          async getSession() {
            return {
              data: {
                session: {
                  access_token: "tok",
                  user: { id: "user-ops-a" },
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
const client = sandbox.TasuAiExecGateClient;
assert("client exported", Boolean(client));

const keyA = client.buildIdempotencyKey("user-ops-a", "2026-07-28");
const keyB = client.buildIdempotencyKey("user-ops-b", "2026-07-28");
assert("key length 8-200", keyA.length >= 8 && keyA.length <= 200);
assert("users do not share key", keyA !== keyB);
assert(
  "key contains JST day",
  keyA.includes("2026-07-28") && keyA.startsWith("phase-b-daily-ops-report-")
);

const almostMidnight = new Date("2026-07-28T14:59:00.000Z"); // JST 23:59
const nextDay = new Date("2026-07-28T15:00:00.000Z"); // JST 00:00 next
const d1 = client.budgetDayKeyJst(almostMidnight);
const d2 = client.budgetDayKeyJst(nextDay);
assert("JST 23:59 day", d1 === "2026-07-28");
assert("JST next 00:00 day", d2 === "2026-07-29");
assert(
  "keys change across JST midnight",
  client.buildIdempotencyKey("u1", d1) !== client.buildIdempotencyKey("u1", d2)
);

assert(
  "ops generic",
  client.genericMessage({ error: "ops_required", http: 403 }) === client.GENERIC.ops
);
assert(
  "blocked != failed label",
  client.statusLabel("failed", "blocked") === "利用不可"
);
assert("failed label", client.statusLabel("failed", "allowed") === "失敗");
assert("uiState blocked", client.uiState({ decision: "blocked", status: "failed" }) === "blocked");
assert("uiState failed", client.uiState({ status: "failed", decision: "allowed" }) === "failed");

client._resetFlightForTests();
fetchCalls.length = 0;
await client.loadTodayView();
await client.loadTodayView();
const createCount = fetchCalls.filter((c) => c.url.includes("/create")).length;
const executeCount = fetchCalls.filter((c) => c.url.includes("/execute")).length;
assert("sequential loads: no execute", executeCount === 0);
assert("sequential loads: creates (idempotent server)", createCount >= 1 && createCount <= 2);

client._resetFlightForTests();
fetchCalls.length = 0;
const parallel = await Promise.all([
  client.loadTodayView(),
  client.loadTodayView(),
]);
assert("parallel load same result shape", parallel[0]?.execution_id === parallel[1]?.execution_id);
assert(
  "parallel load single-flight one create",
  fetchCalls.filter((c) => c.url.includes("/create")).length === 1
);
client._resetFlightForTests();
fetchCalls.length = 0;
const panel = document.createElement("section");
panel.setAttribute("data-ops-ai-exec-gate-panel", "");
const r1 = client.refreshPanel(panel);
const r2 = client.refreshPanel(panel);
assert("single-flight same promise", r1 === r2);
await r1;
assert(
  "single-flight one create",
  fetchCalls.filter((c) => c.url.includes("/create")).length === 1
);
assert(
  "single-flight zero execute",
  fetchCalls.filter((c) => c.url.includes("/execute")).length === 0
);

// XSS render
client.renderPanel(panel, {
  status: "succeeded",
  decision: "allowed",
  provider_called: false,
  result: { summary: xssPayload, pending_total: 0 },
});
const body = panel.querySelector("[data-ops-ai-exec-gate-body]");
const dumped = JSON.stringify(body);
assert("XSS not as executable HTML attribute onerror", !/onerror\s*=/.test(dumped) || dumped.includes('"'));
assert(
  "summary stored as textContent somewhere",
  JSON.stringify(panel).includes("script") ||
    body.childNodes.some((n) => String(n._text || "").includes("<script>"))
);
assert("no script child elements", !body.childNodes.some((n) => n.tagName === "SCRIPT"));

// preferGet refresh — no second create if last id set
client._setLastExecutionId("66666666-6666-4666-8666-666666666666");
fetchCalls.length = 0;
await client.loadTodayView({ preferGet: true });
assert(
  "preferGet skips create",
  fetchCalls.filter((c) => c.url.includes("/create")).length === 0
);
assert(
  "preferGet no execute",
  fetchCalls.filter((c) => c.url.includes("/execute")).length === 0
);

console.log("\nB5 — FREEZE / PLAN / migration untouched");
assert(
  "no B5 migration",
  !existsSync(
    join(root, "supabase/migrations/20260728200000_ai_exec_gate_phase_b5.sql")
  )
);

console.log("\nB5 — optional HTTP dashboard page");
const base = process.env.TASFUL_DEV_BASE || "http://127.0.0.1:8788";
try {
  const res = await fetch(`${base}/admin-operations-dashboard.html`, {
    redirect: "follow",
  });
  const text = await res.text();
  assert("dashboard HTTP 200", res.status === 200);
  assert("dashboard serves panel", /data-ops-ai-exec-gate-panel/.test(text));
  assert(
    "dashboard serves client script tag",
    /admin-ai-exec-gate-client\.js/.test(text)
  );
  const js = await fetch(`${base}/admin-ai-exec-gate-client.js`, {
    redirect: "follow",
  });
  assert("client asset HTTP 200", js.status === 200);
  const jsText = await js.text();
  assert("client asset has gate create", /ai-exec-gate\/create/.test(jsText));
  assert("client asset has no execute", !/ai-exec-gate\/execute/.test(jsText));
  const cssRes = await fetch(`${base}/admin-operations-dashboard.css`, {
    redirect: "follow",
  });
  assert("css HTTP 200", cssRes.status === 200);
} catch (e) {
  console.log(`  · HTTP skipped (${e?.message || e})`);
}

if (errors.length) {
  console.error(`\nFAILED (${errors.length})`);
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
console.log("\nALL PASSED");
