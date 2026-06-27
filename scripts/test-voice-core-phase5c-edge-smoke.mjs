#!/usr/bin/env node
/**
 * Voice Core Phase 5-C-3 — Edge session contract + session client smoke
 *   node scripts/test-voice-core-phase5c-edge-smoke.mjs
 *
 * No real OpenAI / no deployed Edge required — local mock server only.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_DIR = path.join(ROOT, "shared/voice-core");

const VOICE_SURFACES = Object.freeze(["tasful_ai", "builder_ai", "ops_secretary"]);
const MOCK_ENDPOINT = "wss://mock.example/v1/realtime";
const MOCK_MODEL = "gpt-4o-realtime-preview-mock";

const SECRET_PATTERNS = [
  { name: "sk-*", re: /\bsk-[a-zA-Z0-9_-]{8,}\b/ },
  { name: "sb_secret_*", re: /\bsb_secret_[^\s"']+/i },
  { name: "service_role", re: /\bservice_role\b/i },
];

let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function assertNoSecretsInJson(value, label) {
  const text = JSON.stringify(value);
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(text)) {
      bad(`${label}: no ${name} in response`, text.slice(0, 200));
      return false;
    }
  }
  ok(`${label}: no secrets in response`);
  return true;
}

function normalizeEdgeRequest(body) {
  const surface = String(body?.surface ?? "").trim();
  if (!surface) {
    return { ok: false, error: "surface is required" };
  }
  if (!VOICE_SURFACES.includes(surface)) {
    return {
      ok: false,
      error: `surface must be one of: ${VOICE_SURFACES.join(", ")}`,
    };
  }
  const model = String(body?.model ?? "").trim() || MOCK_MODEL;
  return { ok: true, surface, model };
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

/**
 * Local mock of POST /functions/v1/openai-realtime-session (contract mirror · no OpenAI).
 */
function startMockEdge(options = {}) {
  const openAiKeyConfigured = options.openAiKeyConfigured !== false;

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");

      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        });
        res.end();
        return;
      }

      if (url.pathname !== "/functions/v1/openai-realtime-session") {
        sendJson(res, 404, { ok: false, error: "not_found" });
        return;
      }

      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: "Method not allowed" });
        return;
      }

      if (!openAiKeyConfigured) {
        sendJson(res, 503, { ok: false, error: "OPENAI_API_KEY not configured" });
        return;
      }

      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
        return;
      }

      const normalized = normalizeEdgeRequest(body);
      if (!normalized.ok) {
        sendJson(res, 400, { ok: false, error: normalized.error });
        return;
      }

      const expiresAt = new Date(Date.now() + 120_000).toISOString();
      sendJson(res, 200, {
        ok: true,
        endpoint: MOCK_ENDPOINT,
        model: normalized.model,
        surface: normalized.surface,
        credential: {
          type: "ephemeral_token",
          value: `ek_mock_smoke_${normalized.surface}_${Date.now()}`,
          expiresAt,
        },
      });
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
        close() {
          return new Promise((resolve) => {
            server.closeAllConnections?.();
            server.close(() => resolve());
          });
        },
      });
    });
  });
}

async function postEdge(baseUrl, body, anonKey = "anon-smoke-key") {
  const res = await fetch(`${baseUrl}/functions/v1/openai-realtime-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let sessionClientLoaded = false;

function loadSessionClient() {
  if (sessionClientLoaded) {
    globalThis.TasuVoiceRealtimeSessionClient?.clear?.();
    return globalThis.TasuVoiceRealtimeSessionClient;
  }

  const files = [
    "voice-realtime-connect-policy.js",
    "voice-realtime-config.js",
    "voice-realtime-session-client.js",
  ];
  for (const name of files) {
    const code = fs.readFileSync(path.join(VOICE_DIR, name), "utf8");
    Function("global", code)(globalThis);
  }

  globalThis.TasuVoiceCore = {
    setRuntimeInjectors: globalThis.TasuVoiceCoreRealtimeConnectPolicy.setRuntimeInjectors,
    resolveConnectPolicy: globalThis.TasuVoiceCoreRealtimeConnectPolicy.resolveConnectPolicy,
    createRealtimeConfig: globalThis.TasuVoiceCoreRealtimeConfig.createRealtimeConfig,
  };

  sessionClientLoaded = true;
  return globalThis.TasuVoiceRealtimeSessionClient;
}

async function runEdgeContractTests(mock) {
  console.log("\n=== Edge contract (mock server) ===");

  const success = await postEdge(mock.baseUrl, { surface: "tasful_ai" });
  if (success.status === 200 && success.data?.ok === true) ok("edge POST success status 200");
  else bad("edge POST success status 200", JSON.stringify(success));

  if (success.data?.endpoint === MOCK_ENDPOINT) ok("edge response endpoint");
  else bad("edge response endpoint", success.data?.endpoint);

  if (success.data?.model === MOCK_MODEL) ok("edge response model");
  else bad("edge response model", success.data?.model);

  const cred = success.data?.credential;
  if (cred?.type === "ephemeral_token" && cred?.value?.startsWith("ek_mock")) ok("edge credential type/value");
  else bad("edge credential type/value", JSON.stringify(cred));

  if (cred?.expiresAt && Number.isFinite(Date.parse(cred.expiresAt))) ok("edge credential expiresAt");
  else bad("edge credential expiresAt", cred?.expiresAt);

  assertNoSecretsInJson(success.data, "edge success");

  const missingSurface = await postEdge(mock.baseUrl, {});
  if (missingSurface.status === 400 && /surface is required/i.test(String(missingSurface.data?.error))) {
    ok("edge surface required → 400");
  } else {
    bad("edge surface required → 400", JSON.stringify(missingSurface));
  }
  assertNoSecretsInJson(missingSurface.data, "edge missing surface");

  const invalidSurface = await postEdge(mock.baseUrl, { surface: "not_a_surface" });
  if (invalidSurface.status === 400 && /surface must be one of/i.test(String(invalidSurface.data?.error))) {
    ok("edge invalid surface → 400");
  } else {
    bad("edge invalid surface → 400", JSON.stringify(invalidSurface));
  }
  assertNoSecretsInJson(invalidSurface.data, "edge invalid surface");

  const noKey = await startMockEdge({ openAiKeyConfigured: false });
  const noKeyRes = await postEdge(noKey.baseUrl, { surface: "tasful_ai" });
  if (noKeyRes.status === 503 && /OPENAI_API_KEY not configured/i.test(String(noKeyRes.data?.error))) {
    ok("edge OPENAI_API_KEY missing → 503");
  } else {
    bad("edge OPENAI_API_KEY missing → 503", JSON.stringify(noKeyRes));
  }
  assertNoSecretsInJson(noKeyRes.data, "edge 503");
  await noKey.close();

  return success.data;
}

async function runSessionClientTests(mock) {
  console.log("\n=== Session client + injectors ===");

  globalThis.TASU_CHAT_SUPABASE_CONFIG = {
    url: mock.baseUrl,
    anonKey: "anon-smoke-key",
  };
  globalThis.fetch = globalThis.fetch || fetch;

  const client = loadSessionClient();

  const refresh = await client.refresh({ surface: "tasful_ai" });
  if (refresh.ok === true) ok("client refresh() success");
  else bad("client refresh() success", JSON.stringify(refresh));

  const inj = client.getInjectorsStatus();
  if (inj.registered && inj.liveEnabled && inj.useWebSocketTransport) {
    ok("client injectors registered");
  } else {
    bad("client injectors registered", JSON.stringify(inj));
  }

  const cfg = globalThis.TasuVoiceCore.createRealtimeConfig();
  if (cfg.getEndpoint() === MOCK_ENDPOINT) ok("injectors getEndpoint()");
  else bad("injectors getEndpoint()", cfg.getEndpoint());

  if (cfg.getModel() === MOCK_MODEL) ok("injectors getModel()");
  else bad("injectors getModel()", cfg.getModel());

  const credential = await cfg.getSessionCredential();
  if (credential?.value?.startsWith("ek_mock") && credential?.type === "ephemeral_token") {
    ok("injectors getSessionCredential()");
  } else {
    bad("injectors getSessionCredential()", JSON.stringify(credential));
  }

  const policyLive = client.getPolicySnapshot({ mockCompatible: false });
  if (policyLive.mode === "live" && policyLive.allowLive === true) {
    ok("getPolicySnapshot mockCompatible:false → live");
  } else {
    bad("getPolicySnapshot mockCompatible:false → live", JSON.stringify(policyLive));
  }

  const session = client.getCurrentSession();
  if (session?.endpoint && session?.model && session?.credential?.expiresAt) {
    ok("getCurrentSession() fields");
  } else {
    bad("getCurrentSession() fields", JSON.stringify(session));
  }

  assertNoSecretsInJson(
    {
      session,
      inj,
      policyLive,
      credential: credential ? { ...credential, value: "[redacted]" } : null,
    },
    "client state"
  );

  if (session?.credential?.valueMasked && !session.credential.valueMasked.startsWith("sk-")) {
    ok("getCurrentSession masks credential value");
  } else {
    bad("getCurrentSession masks credential value", session?.credential?.valueMasked);
  }

  client.clear();
  const afterClear = client.getInjectorsStatus();
  if (!afterClear.registered && !afterClear.liveEnabled) {
    ok("clear() removes injectors");
  } else {
    bad("clear() removes injectors", JSON.stringify(afterClear));
  }

  const policyAfterClear = client.getPolicySnapshot({ mockCompatible: false });
  if (policyAfterClear.mode === "mock" && policyAfterClear.reason === "live_disabled") {
    ok("after clear policy returns live_disabled");
  } else {
    bad("after clear policy returns live_disabled", JSON.stringify(policyAfterClear));
  }
}

async function runRejectSkCredentialTest() {
  console.log("\n=== Client rejects sk-* credential from edge ===");

  globalThis.TASU_CHAT_SUPABASE_CONFIG = {
    url: "http://127.0.0.1:9",
    anonKey: "anon-smoke-key",
  };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      endpoint: MOCK_ENDPOINT,
      model: MOCK_MODEL,
      surface: "tasful_ai",
      credential: {
        type: "ephemeral_token",
        value: "sk-testkey1234567890abcdef",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    }),
  });

  const client = loadSessionClient();
  const result = await client.refresh({ surface: "tasful_ai" });
  if (!result.ok && result.error === "invalid_session_response") {
    ok("client rejects sk-* credential in edge response");
  } else {
    bad("client rejects sk-* credential in edge response", JSON.stringify(result));
  }
  assertNoSecretsInJson({ error: result.error, ok: result.ok }, "sk rejection result");
  client.clear();
}

async function main() {
  console.log("Voice Core Phase 5-C-3 — edge session smoke\n");

  const mock = await startMockEdge({ openAiKeyConfigured: true });
  try {
    await runEdgeContractTests(mock);
  } finally {
    await mock.close();
  }

  const clientMock = await startMockEdge({ openAiKeyConfigured: true });
  try {
    await runSessionClientTests(clientMock);
  } finally {
    await clientMock.close();
  }

  await runRejectSkCredentialTest();

  globalThis.TasuVoiceRealtimeSessionClient?.clear?.();

  console.log(`\n=== Summary: ${pass} passed, ${fail} failed ===`);
  const code = fail ? 1 : 0;
  setTimeout(() => process.exit(code), 50);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
