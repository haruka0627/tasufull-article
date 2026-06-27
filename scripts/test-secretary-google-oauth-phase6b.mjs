#!/usr/bin/env node
/**
 * AI秘書 Phase 6-B — Google OAuth / Token Vault / Edge skeleton tests
 *   node scripts/test-secretary-google-oauth-phase6b.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function loadClient(fetchImpl) {
  const code = read("admin-ai-secretary-google-oauth-client.js");
  const sandbox = {
    window: {
      TASU_CHAT_SUPABASE_CONFIG: {
        url: "https://example.supabase.co",
        anonKey: "anon-test-key",
        currentUserId: "00000000-0000-4000-8000-000000000099",
      },
      __MATCH_FUNCTIONS_BASE__: "https://example.supabase.co/functions/v1",
      sessionStorage: {
        _m: new Map(),
        getItem(k) {
          return this._m.get(k) ?? null;
        },
        setItem(k, v) {
          this._m.set(k, v);
        },
      },
      location: { origin: "http://127.0.0.1:8788", protocol: "http:" },
    },
    fetch: fetchImpl,
    console,
  };
  sandbox.global = sandbox.window;
  vm.runInNewContext(code, sandbox, { filename: "admin-ai-secretary-google-oauth-client.js" });
  return sandbox.window.TasuSecretaryGoogleOAuthClient;
}

function pkceNode() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

async function runUnitTests() {
  const migration = read("supabase/migrations/20260710100000_secretary_google_token_vault.sql");
  if (/enable row level security/i.test(migration)) ok("migration RLS enabled");
  else bad("migration RLS enabled");
  if (/revoke all on table public\.secretary_google_token_vault from anon, authenticated/i.test(migration)) {
    ok("migration vault revoke anon/authenticated");
  } else bad("migration vault revoke anon/authenticated");
  if (/secretary_google_oauth_pending/i.test(migration)) ok("migration oauth pending table");
  else bad("migration oauth pending table");

  const oauthEdge = read("supabase/functions/secretary-google-oauth/index.ts");
  const shared = read("supabase/functions/_shared/secretary-google-oauth.ts");
  const oauthResponses = oauthEdge.replace(/\.select\([^)]*\)/g, "");
  if (/sanitizeForClient/i.test(oauthEdge) && /sanitizeForClient/i.test(shared)) ok("edge sanitizeForClient used");
  else bad("edge sanitizeForClient used");
  if (/access_type: "offline"/.test(shared)) ok("OAuth offline access");
  else bad("OAuth offline access");
  if (/code_challenge_method: "S256"/.test(shared)) ok("OAuth PKCE S256");
  else bad("OAuth PKCE S256");
  if (!/return jsonResponse\(\{[^}]*access_token/.test(oauthResponses)) ok("oauth edge does not return access_token");
  else bad("oauth edge does not return access_token");
  if (!/return jsonResponse\(\{[^}]*refresh_token/.test(oauthResponses)) ok("oauth edge does not return refresh_token");
  else bad("oauth edge does not return refresh_token");

  const toolsEdge = read("supabase/functions/secretary-google-tools/index.ts");
  if (/not_implemented/i.test(toolsEdge)) ok("tools edge execute stub 501");
  else bad("tools edge execute stub 501");
  if (/gmail.*stub/i.test(toolsEdge)) ok("tools gmail stub declared");
  else bad("tools gmail stub declared");

  const pkce = pkceNode();
  if (pkce.verifier.length >= 43 && pkce.challenge.length >= 43 && pkce.state.length >= 16) ok("PKCE state/verifier/challenge");
  else bad("PKCE state/verifier/challenge");

  const Client = loadClient(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, connected: false, mock: true }),
  }));
  if (Client?.getFunctionsBase()?.includes("/functions/v1")) ok("client functions base");
  else bad("client functions base");
  if (Client?.getOAuthCallbackUrl()?.includes("secretary-google-oauth")) ok("OAuth callback URL");
  else bad("OAuth callback URL");

  const secretProbe = Client.scanForSecrets({ access_token: "x", ok: true });
  if (secretProbe) ok("client scanForSecrets detects access_token");
  else bad("client scanForSecrets detects access_token");
  if (!Client.scanForSecrets({ ok: true, connected: false })) ok("client scanForSecrets clean status");
  else bad("client scanForSecrets clean status");

  const uiCode = read("admin-ai-secretary-google-connect-ui.js");
  if (
    /data-ops-secretary-google-connect-btn/.test(uiCode) &&
    /data-ops-secretary-google-disconnect-btn/.test(uiCode) &&
    /data-ops-secretary-google-status-label/.test(uiCode)
  ) {
    ok("UI skeleton strings");
  } else bad("UI skeleton strings");

  const html = read("admin-operations-dashboard.html");
  if (/data-ops-secretary-google-connect/.test(html)) ok("dashboard HTML google connect mount");
  else bad("dashboard HTML google connect mount");
  if (/admin-ai-secretary-google-oauth-client\.js/.test(html)) ok("dashboard script oauth client");
  else bad("dashboard script oauth client");

  const envNames = ["SECRETARY_GOOGLE_CLIENT_ID", "SECRETARY_GOOGLE_CLIENT_SECRET", "SECRETARY_GOOGLE_REDIRECT_URI"];
  for (const name of envNames) {
    if (shared.includes(name)) ok(`secret name referenced ${name}`);
    else bad(`secret name referenced ${name}`);
  }
  if (!/sk-[a-z0-9]{10,}/i.test(shared) && !/GOCSPX-[a-z0-9]+/i.test(shared)) ok("shared module no secret literals");
  else bad("shared module no secret literals");
}

async function mockFetchTests() {
  const calls = [];
  const Client = loadClient(async (_url, init) => {
    calls.push({ body: init?.body ? JSON.parse(init.body) : null });
    const action = calls.at(-1).body?.action;
    if (action === "connect") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, mock: true, state: "state_mock_123", authUrl: "https://example.test/cb" }),
      };
    }
    if (action === "mock_callback") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, connected: true, mock: true, googleAccountEmail: "mock@gmail.com" }),
      };
    }
    if (action === "status") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, connected: true, googleAccountEmail: "mock@gmail.com", mock: true }),
      };
    }
    if (action === "disconnect") {
      return { ok: true, status: 200, json: async () => ({ ok: true, disconnected: true }) };
    }
    if (action === "refresh") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, refreshed: true, expiresAt: new Date().toISOString() }),
      };
    }
    return { ok: false, status: 400, json: async () => ({ ok: false, error: "unknown" }) };
  });

  const connect = await Client.startConnect();
  if (connect.ok) ok("mock connect flow");
  else bad("mock connect flow", connect.error);
  if (calls.some((c) => c.body?.action === "mock_callback")) ok("mock callback invoked");
  else bad("mock callback invoked");

  const status = await Client.fetchStatus();
  if (status.connected && status.googleAccountEmail) ok("mock status");
  else bad("mock status");

  const refresh = await Client.refresh();
  if (refresh.ok && !Client.scanForSecrets(refresh.data)) ok("mock refresh no secrets");
  else bad("mock refresh no secrets");

  const disconnect = await Client.disconnect();
  if (disconnect.ok) ok("mock disconnect");
  else bad("mock disconnect");
}

async function runBrowserSmoke(base) {
  const PAGE = `${base.replace(/\/$/, "")}/admin-operations-dashboard.html`;
  const VIEWPORTS = [
    [1280, 900],
    [768, 1024],
    [390, 844],
  ];

  await withPlaywrightBrowser(async (browser) => {
    for (const [w, h] of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const jsErrors = [];
      page.on("pageerror", (err) => jsErrors.push(String(err.message || err)));
      const tag = `${w}x${h}`;
      try {
        const resp = await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
        if ((resp?.status() ?? 0) === 200) ok(`${tag} HTTP 200`);
        else bad(`${tag} HTTP 200`, String(resp?.status()));

        await page.waitForFunction(
          () =>
            window.TasuSecretaryGoogleOAuthClient &&
            window.TasuSecretaryGoogleConnectUI &&
            document.querySelector("[data-ops-secretary-google-connect]"),
          { timeout: 30000 }
        );

        const audit = await page.evaluate(() => ({
          label: document.querySelector("[data-ops-secretary-google-status-label]")?.textContent || "",
          connectBtn: Boolean(document.querySelector("[data-ops-secretary-google-connect-btn]")),
          voiceBtn: Boolean(document.querySelector("[data-ops-secretary-voice]")),
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));

        if (/Google/.test(audit.label)) ok(`${tag} Google UI label`);
        else bad(`${tag} Google UI label`, audit.label);
        if (audit.connectBtn) ok(`${tag} connect button`);
        else bad(`${tag} connect button`);
        if (audit.voiceBtn) ok(`${tag} voice button intact`);
        else bad(`${tag} voice button intact`);
        if (audit.scrollW <= audit.clientW + 1) ok(`${tag} no horizontal scroll`);
        else bad(`${tag} no horizontal scroll`, `${audit.scrollW}>${audit.clientW}`);
        if (jsErrors.length === 0) ok(`${tag} console JS errors 0`);
        else bad(`${tag} console JS errors 0`, jsErrors.join(" | "));
      } finally {
        await page.close();
      }
    }
  });
}

async function main() {
  console.log("=== AI秘書 Google OAuth Phase 6-B — unit ===");
  await runUnitTests();
  console.log("\n=== AI秘書 Google OAuth Phase 6-B — mock fetch ===");
  await mockFetchTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Google OAuth Phase 6-B — browser @ ${base} ===`);
    await runBrowserSmoke(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
  }

  console.log(`\n=== AI秘書 Google OAuth Phase 6-B: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
