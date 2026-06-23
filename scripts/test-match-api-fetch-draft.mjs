/**
 * TASFUL MATCH API — edge fetch draft tests
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = "http://127.0.0.1:8788/match/match-review";

let passed = 0;
let failed = 0;

function ok(msg) {
  passed += 1;
  console.log(`  ✓ ${msg}`);
}

function bad(msg) {
  failed += 1;
  console.error(`  ✗ ${msg}`);
}

console.log("TASFUL MATCH API fetch draft tests\n");

console.log("1) Existing client_stub suite");
const clientStub = spawnSync(process.execPath, ["scripts/test-match-api-client-stub.mjs"], {
  cwd: ROOT,
  encoding: "utf8",
});
if (clientStub.status === 0) ok("test-match-api-client-stub.mjs PASS");
else {
  bad("test-match-api-client-stub.mjs FAILED");
  if (clientStub.stdout) console.error(clientStub.stdout);
  if (clientStub.stderr) console.error(clientStub.stderr);
}

console.log("\n2) edge_stub fetch draft (Playwright)");

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });

  const edgeModeText = await page.textContent("[data-match-api-edge-mode]");
  if (edgeModeText === "available but disabled") {
    ok('match-review shows Edge fetch mode "available but disabled"');
  } else bad(`Edge fetch mode text: ${edgeModeText}`);

  const baseUrlText = await page.textContent("[data-match-api-base-url]");
  if (baseUrlText === "not configured") ok('Functions base URL shows "not configured"');
  else bad(`Functions base URL text: ${baseUrlText}`);

  const edgeTests = await page.evaluate(async () => {
    const api = window.TasfulMatchAPI;
    const results = {};

    api.configure({ mode: "client_stub", functionsBaseUrl: "", debugHeaders: false });

    window.__edgeFetchCalls = [];
    const originalFetch = window.fetch;
    window.fetch = function (url, init) {
      window.__edgeFetchCalls.push({ url: String(url), init: init || {} });
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, mode: "stub" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    };

    try {
      api.configure({ mode: "edge_stub", functionsBaseUrl: "" });
      const noBase = await api.recordSwipe({ target_user_id: "user-a", action: "like" });
      results.configError = noBase.ok === false && noBase.code === "config_error";

      api.configure({
        mode: "edge_stub",
        functionsBaseUrl: "https://example.test/functions/v1",
        getAuthHeaders: () => ({}),
      });
      const noAuth = await api.recordSwipe({ target_user_id: "user-a", action: "like" });
      results.authRequired = noAuth.ok === false && noAuth.code === "auth_required";

      window.__edgeFetchCalls = [];
      api.configure({
        mode: "edge_stub",
        functionsBaseUrl: "https://example.test/functions/v1",
        debugHeaders: false,
        getAuthHeaders: () => ({
          Authorization: "Bearer stub-match-token",
          "x-match-user-id": "should-not-forward",
        }),
      });

      await api.recordSwipe({ target_user_id: "user-a", action: "like" });
      results.fetchOnce = window.__edgeFetchCalls.length === 1;
      results.swipePath = window.__edgeFetchCalls[0]?.url?.endsWith("/match-record-swipe");
      results.noDebugHeader =
        !window.__edgeFetchCalls[0]?.init?.headers?.["x-match-user-id"];

      window.__edgeFetchCalls = [];
      await api.submitReport({
        reported_user_id: "user-b",
        reason: "harassment",
      });
      results.reportPath = window.__edgeFetchCalls[0]?.url?.endsWith("/match-submit-report");

      window.fetch = function (_url, _init) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: false, code: "internal_error", message: "boom" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
        );
      };
      const serverErr = await api.recordSwipe({ target_user_id: "user-a", action: "skip" });
      results.http500 =
        serverErr.ok === false &&
        serverErr.code === "internal_error" &&
        serverErr.status === 500;

      window.fetch = function () {
        return new Promise(function () {
          /* never resolves */
        });
      };
      api.configure({ timeoutMs: 80 });
      const timedOut = await api.recordSwipe({ target_user_id: "user-a", action: "like" });
      results.timeout = timedOut.ok === false && timedOut.code === "timeout";

      window.fetch = originalFetch;
      window.__edgeFetchCalls = [];
      window.fetch = function (url, init) {
        window.__edgeFetchCalls.push({ url: String(url), init: init || {} });
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      };

      api.configure({
        mode: "edge_stub",
        functionsBaseUrl: "https://example.test/functions/v1",
        debugHeaders: true,
        getAuthHeaders: () => ({ Authorization: "Bearer stub-match-token" }),
      });
      await api.recordSwipe({ target_user_id: "user-a", action: "like" });
      results.debugHeaderSent =
        window.__edgeFetchCalls[0]?.init?.headers?.["x-match-user-id"] === "stub-user-current";
    } finally {
      window.fetch = originalFetch;
      api.configure({ mode: "client_stub", functionsBaseUrl: "", debugHeaders: false, timeoutMs: 10000 });
    }

    return results;
  });

  if (edgeTests.configError) ok("edge_stub without functionsBaseUrl returns config_error");
  else bad("config_error case failed");

  if (edgeTests.authRequired) ok("edge_stub without Authorization returns auth_required");
  else bad("auth_required case failed");

  if (edgeTests.fetchOnce) ok("edge_stub with Authorization calls fetch once");
  else bad("fetch once case failed");

  if (edgeTests.swipePath) ok("recordSwipe POSTs to /match-record-swipe");
  else bad("recordSwipe path failed");

  if (edgeTests.reportPath) ok("submitReport POSTs to /match-submit-report");
  else bad("submitReport path failed");

  if (edgeTests.noDebugHeader) ok("debugHeaders false omits x-match-user-id");
  else bad("x-match-user-id leak when debugHeaders false");

  if (edgeTests.http500) ok("HTTP 500 normalized with code/status");
  else bad("HTTP 500 normalization failed");

  if (edgeTests.timeout) ok("timeout normalized as code timeout");
  else bad("timeout normalization failed");

  if (edgeTests.debugHeaderSent) ok("debugHeaders true sends x-match-user-id from TasfulMatchAuth");
  else bad("debugHeaders true header failed");

  await page.close();
});

console.log("\n3) Static checks — match-api.js");
const apiSrc = fs.readFileSync(path.join(ROOT, "match/match-api.js"), "utf8");
if (!/createClient/.test(apiSrc)) ok("match-api.js has no createClient");
else bad("match-api.js contains createClient");

if (/mode:\s*"client_stub"/.test(apiSrc)) ok("default mode remains client_stub");
else bad("client_stub default missing");

await closeAllBrowsers();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
