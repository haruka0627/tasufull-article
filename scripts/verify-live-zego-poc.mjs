#!/usr/bin/env node
/**
 * TLV Live ZEGO PoC — static + HTTP smoke
 *
 *   node scripts/verify-live-zego-poc.mjs
 *   npm run verify:live-zego-poc
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_FILES = [
  "live/live-zego-poc.html",
  "live/live-zego-poc.js",
  "live/live-zego-poc.css",
  "live/live-service.js",
  "live/session/live-session-states.js",
  "live/session/live-session-events.js",
  "live/session/live-session-event-bus.js",
  "live/session/live-session-error-codes.js",
  "live/session/live-session-validation.js",
  "live/session/live-session-manager.js",
  "live/live-zego-config.example.js",
  "live/providers/live-provider-types.js",
  "live/providers/live-provider-interface.js",
  "live/providers/zego-live-provider.js",
  "deploy/cloudflare/functions/api/tlv-zego-token.js",
  "deploy/cloudflare/functions/_shared/zego-token04.mjs",
  "docs/TLV_LIVE_PROVIDER.md",
  "reports/tlv-live-zego-poc.md",
];

const summary = { pass: 0, fail: 0, skip: 0 };
const failures = [];

function pass(id, detail = "") {
  summary.pass += 1;
  console.log(`  PASS  ${id}${detail ? ` — ${detail}` : ""}`);
}

function fail(id, detail = "") {
  summary.fail += 1;
  failures.push(`${id}${detail ? `: ${detail}` : ""}`);
  console.log(`  FAIL  ${id}${detail ? ` — ${detail}` : ""}`);
}

function skip(id, detail = "") {
  summary.skip += 1;
  console.log(`  SKIP  ${id}${detail ? ` — ${detail}` : ""}`);
}

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function verifyStatic() {
  console.log("\n=== A. Static files ===\n");
  for (const rel of REQUIRED_FILES) {
    if (existsSync(path.join(ROOT, rel))) pass(`static:${rel}`);
    else fail(`static:${rel}`, "missing");
  }

  const pocJs = read("live/live-zego-poc.js");
  if (!/ZegoExpressEngine/.test(pocJs)) pass("layer:poc-no-direct-zego");
  else fail("layer:poc-no-direct-zego", "PoC UI must not reference ZEGO SDK");

  const serviceJs = read("live/live-service.js");
  if (!/ZegoExpressEngine/.test(serviceJs)) pass("layer:service-no-direct-zego");
  else fail("layer:service-no-direct-zego");

  if (serviceJs.includes("TlvLiveSessionManager") && serviceJs.includes("onSessionEvent")) {
    pass("layer:service-session-manager");
  } else fail("layer:service-session-manager");

  const pocHtml = read("live/live-zego-poc.html");
  if (pocHtml.includes("live-session-manager.js") && pocHtml.includes("live-service.js")) {
    pass("layer:poc-loads-session");
  } else fail("layer:poc-loads-session");

  if (pocJs.includes("getSessionSnapshot") && pocJs.includes("getSessionState")) {
    pass("layer:poc-session-ui");
  } else fail("layer:poc-session-ui");

  const iface = read("live/providers/live-provider-interface.js");
  if (iface.includes("createTlvLiveProvider") && iface.includes("LiveProviderInterface")) {
    pass("layer:interface-factory");
  } else fail("layer:interface-factory");

  const zego = read("live/providers/zego-live-provider.js");
  if (zego.includes("TlvZegoLiveProvider") && zego.includes("ZEGO_SDK_URL")) {
    pass("layer:zego-provider-isolated");
  } else fail("layer:zego-provider-isolated");

  const tokenApi = read("deploy/cloudflare/functions/api/tlv-zego-token.js");
  if (tokenApi.includes("ZEGO_SERVER_SECRET") && !tokenApi.includes('serverSecret = "')) {
    pass("secret:token-api-env-only");
  } else fail("secret:token-api-env-only");
}

async function verifyHttp() {
  console.log("\n=== B. HTTP smoke ===\n");
  const base = await findDevServerBaseUrl({ envKey: "BUILDER_BASE_URL" }).catch(() => null);
  if (!base) {
    skip("http:poc-page", "dev server not running — npm run dev");
    skip("http:existing-live-index", "dev server not running");
    return;
  }

  const urls = [
    { id: "http:poc-page", path: "/live/live-zego-poc.html" },
    { id: "http:existing-live-index", path: "/live/index.html" },
  ];

  for (const item of urls) {
    try {
      const res = await fetch(`${base}${item.path}`);
      if (res.status === 200) pass(item.id, `${base}${item.path}`);
      else fail(item.id, `status=${res.status}`);
    } catch (err) {
      fail(item.id, err?.message || String(err));
    }
  }
}

async function main() {
  console.log("TLV Live ZEGO PoC verify");
  verifyStatic();
  await verifyHttp();

  console.log("\n=== Summary ===");
  console.log(`  PASS ${summary.pass} · FAIL ${summary.fail} · SKIP ${summary.skip}`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main();
