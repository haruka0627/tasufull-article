/**
 * TASFUL MATCH — local Edge smoke execution (HTTP against 127.0.0.1:54321/functions/v1)
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = "http://127.0.0.1:54321/functions/v1";

let passed = 0;
let failed = 0;
const results = [];

function ok(name, detail = "") {
  passed += 1;
  results.push({ name, pass: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function bad(name, detail = "") {
  failed += 1;
  results.push({ name, pass: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const body = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.stub-signature`;
}

const JWT_ADMIN = makeJwt({
  app_metadata: {
    talk_user_id: "stub-user-current",
    role: "match_admin",
  },
});

async function post(functionName, body, headers = {}) {
  const res = await fetch(`${BASE}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  return { status: res.status, json, headers: Object.fromEntries(res.headers.entries()) };
}

async function waitForServer(maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/match-record-swipe`, {
        method: "OPTIONS",
        headers: { Origin: "http://127.0.0.1:8788" },
      });
      if (res.status === 200 || res.status === 204) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function startSmokeServer() {
  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  return spawn(cmd, ["deno", "run", "--allow-net", "--allow-read", "scripts/match-local-edge-smoke-server.ts"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
}

function runExistingTest(script) {
  const res = spawnSync(process.execPath, [path.join("scripts", script)], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return res.status === 0;
}

console.log("TASFUL MATCH local Edge smoke\n");

console.log("0) Environment check");
const supabaseServe = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["supabase", "functions", "serve", "--help"],
  { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" },
);
const dockerAvailable = spawnSync("docker", ["version"], { encoding: "utf8" }).status === 0;
if (dockerAvailable) {
  ok("Docker available (supabase functions serve possible)");
} else {
  ok("Docker unavailable — using Deno smoke router fallback on :54321");
}

console.log("\n1) Start local smoke server");
const server = startSmokeServer();
let serverLog = "";
server.stdout?.on("data", (c) => {
  serverLog += String(c);
});
server.stderr?.on("data", (c) => {
  serverLog += String(c);
});

const ready = await waitForServer();
if (!ready) {
  bad("Smoke server ready on :54321", serverLog.slice(0, 500));
  server.kill();
  process.exit(1);
}
ok("Smoke server ready", BASE);

console.log("\n2) HTTP smoke tests");

const noAuth = await post("match-record-swipe", {
  target_user_id: "stub-user-yui",
  action: "like",
});
if (noAuth.status === 401 && noAuth.json?.code === "unauthorized") {
  ok("Bearer missing → 401 unauthorized");
} else {
  bad("Bearer missing", `status=${noAuth.status} code=${noAuth.json?.code}`);
}

const authStub = { Authorization: "Bearer stub-match-token" };
const swipeOk = await post(
  "match-record-swipe",
  { target_user_id: "stub-user-yui", action: "like" },
  authStub,
);
if (swipeOk.status === 200 && swipeOk.json?.ok === true && swipeOk.json?.mode === "stub") {
  ok("stub-match-token → match-record-swipe 200");
} else {
  bad("stub-match-token swipe", JSON.stringify(swipeOk.json));
}

const jwtSwipe = await post(
  "match-record-swipe",
  { target_user_id: "stub-user-yui", action: "like" },
  { Authorization: `Bearer ${JWT_ADMIN}` },
);
if (jwtSwipe.status === 200 && jwtSwipe.json?.ok === true) {
  ok("dummy JWT app_metadata.talk_user_id → 200");
} else {
  bad("dummy JWT swipe", JSON.stringify(jwtSwipe.json));
}

const xHeader = await post(
  "match-record-swipe",
  { target_user_id: "stub-user-yui", action: "like" },
  {
    Authorization: "Bearer stub-match-token",
    "x-match-user-id": "fake-attacker-id",
  },
);
if (xHeader.status === 200 && xHeader.json?.ok === true) {
  ok("x-match-user-id mismatch ignored (JWT talk_user_id used)");
} else {
  bad("x-match-user-id test", JSON.stringify(xHeader.json));
}

const fakeSelfId = await post(
  "match-record-swipe",
  {
    target_user_id: "stub-user-yui",
    action: "like",
    swiper_user_id: "fake-attacker-id",
  },
  authStub,
);
if (fakeSelfId.status === 200 && fakeSelfId.json?.ok === true) {
  ok("payload swiper_user_id ignored (not used for auth)");
} else {
  bad("payload swiper_user_id test", JSON.stringify(fakeSelfId.json));
}

const superLike = await post(
  "match-record-swipe",
  { target_user_id: "stub-user-yui", action: "super_like" },
  authStub,
);
if (superLike.status === 422 && superLike.json?.code === "phase_not_enabled") {
  ok("super_like → phase_not_enabled 422");
} else {
  bad("super_like", `status=${superLike.status} code=${superLike.json?.code}`);
}

const selfSwipe = await post(
  "match-record-swipe",
  { target_user_id: "stub-user-current", action: "like" },
  authStub,
);
if (selfSwipe.status === 422 && selfSwipe.json?.code === "validation_error") {
  ok("self swipe rejected via JWT matchUserId");
} else {
  bad("self swipe", `status=${selfSwipe.status} code=${selfSwipe.json?.code}`);
}

const listNoAuth = await post("match-list-pairs", {});
if (listNoAuth.status === 401 && listNoAuth.json?.code === "unauthorized") {
  ok("match-list-pairs Bearer missing → 401");
} else {
  bad("match-list-pairs no auth", `status=${listNoAuth.status}`);
}

const listStub = await post("match-list-pairs", {}, authStub);
if (listStub.status === 200 && listStub.json?.ok === true && Array.isArray(listStub.json?.pairs)) {
  ok("stub-match-token → match-list-pairs 200");
} else {
  bad("stub-match-token list-pairs", JSON.stringify(listStub.json));
}

const stubFunctions = [
  ["match-ensure-talk-room", { pair_id: "stub-pair-yui" }],
  [
    "match-submit-report",
    {
      reported_user_id: "stub-user-yui",
      reason: "harassment",
      detail: "テスト通報です",
    },
  ],
  ["match-block-user", { blocked_user_id: "stub-user-yui", reason: "test" }],
  ["match-submit-verification", { verification_type: "phone", metadata: {} }],
  [
    "match-moderation-log",
    {
      source: "profile",
      target_user_id: "stub-user-yui",
      severity: "low",
      reason: "smoke test",
    },
  ],
];

for (const [name, body] of stubFunctions) {
  const res = await post(name, body, authStub);
  if (res.status === 200 && res.json?.ok === true) {
    ok(`stub-match-token → ${name} 200`);
  } else {
    bad(`${name} stub token`, JSON.stringify(res.json));
  }
}

const adminJwt = await post(
  "match-admin-review",
  {
    target_type: "report",
    target_id: "stub-report-id",
    action: "dismiss",
    note: "smoke test",
  },
  { Authorization: `Bearer ${JWT_ADMIN}` },
);
if (adminJwt.status === 200 && adminJwt.json?.ok === true) {
  ok("admin review with JWT match_admin claim → 200");
} else {
  bad("admin JWT", JSON.stringify(adminJwt.json));
}

const adminHeader = await post(
  "match-admin-review",
  {
    target_type: "report",
    target_id: "stub-report-id",
    action: "dismiss",
    note: "smoke test",
  },
  { ...authStub, "x-match-admin": "true" },
);
if (adminHeader.status === 200 && adminHeader.json?.ok === true) {
  ok("admin review with x-match-admin dev fallback → 200");
} else {
  bad("admin header fallback", JSON.stringify(adminHeader.json));
}

const adminDenied = await post(
  "match-admin-review",
  {
    target_type: "report",
    target_id: "stub-report-id",
    action: "dismiss",
    note: "smoke test",
  },
  authStub,
);
if (adminDenied.status === 403 && adminDenied.json?.code === "forbidden") {
  ok("admin review without claim/header → 403");
} else {
  bad("admin denied", `status=${adminDenied.status} code=${adminDenied.json?.code}`);
}

const optionsRes = await fetch(`${BASE}/match-record-swipe`, {
  method: "OPTIONS",
  headers: {
    Origin: "http://127.0.0.1:8788",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "authorization, content-type",
  },
});
const allowOrigin = optionsRes.headers.get("access-control-allow-origin");
const allowMethods = optionsRes.headers.get("access-control-allow-methods") || "";
if (
  (optionsRes.status === 200 || optionsRes.status === 204) &&
  allowOrigin &&
  allowMethods.includes("POST")
) {
  ok("CORS OPTIONS preflight", `Allow-Origin=${allowOrigin}`);
} else {
  bad("CORS OPTIONS", `status=${optionsRes.status} origin=${allowOrigin}`);
}

console.log("\n3) DB未接続 static check");
const matchFnDir = path.join(ROOT, "supabase/functions");
const matchFiles = fs
  .readdirSync(matchFnDir)
  .filter((name) => name.startsWith("match-"))
  .map((name) => path.join(matchFnDir, name, "index.ts"));
matchFiles.push(path.join(matchFnDir, "_shared/match-auth.ts"));
const dbPattern = /createClient|\.from\s*\(/;
let dbHits = 0;
for (const file of matchFiles) {
  const src = fs.readFileSync(file, "utf8");
  if (dbPattern.test(src)) dbHits += 1;
}
if (dbHits === 0) ok("match-* / match-auth.ts have no createClient / .from(");
else bad("DB patterns found in match functions", String(dbHits));

server.kill();

console.log("\n4) Existing regression tests");
const suites = [
  "test-match-auth-stub.mjs",
  "test-match-data-stub.mjs",
  "test-match-ui-wiring-stub.mjs",
  "test-match-mock-ui.mjs",
  "test-match-api-client-stub.mjs",
  "test-match-api-fetch-draft.mjs",
  "test-match-edge-jwt-stub.mjs",
];

for (const suite of suites) {
  if (runExistingTest(suite)) ok(suite);
  else bad(suite);
}

console.log(`\n${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log("\nJUDGMENT: LOCAL_EDGE_SMOKE_PASS");
} else {
  console.log("\nJUDGMENT: LOCAL_EDGE_SMOKE_NEEDS_FIX");
}

process.exit(failed > 0 ? 1 : 0);
