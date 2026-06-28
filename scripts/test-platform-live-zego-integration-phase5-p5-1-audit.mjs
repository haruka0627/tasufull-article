#!/usr/bin/env node
/**
 * Platform Live ZEGO Integration — Phase 5 P5-1 (connection audit) static tests
 *
 *   node scripts/test-platform-live-zego-integration-phase5-p5-1-audit.mjs
 *   npm run test:platform-live-zego-integration-phase5-p5-1
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TLV_POC_PROVIDER = "live/providers/zego-live-provider.js";
const TLV_INTERFACE = "live/providers/live-provider-interface.js";
const PLATFORM_INTERFACE = "platform-live/provider/live-provider-interface.js";
const INTEGRATION = "platform-live/core/live-platform-integration.js";
const TLV_SERVICE = "live/live-service.js";
const TLV_BROADCASTS = "live/live-broadcasts.js";
const TLV_BRIDGE = "live/live-broadcasts-session-bridge.js";
const TLV_FLAGS = "live/tlv-feature-flags.js";
const TOKEN_API = "deploy/cloudflare/functions/api/tlv-zego-token.js";
const STUDIO_HTML = "live/studio.html";
const WATCH_HTML = "live/watch.html";
const REPORT = "reports/live-platform-zego-phase5-p5-1-connection-audit.md";

const summary = { pass: 0, fail: 0 };
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

function assert(cond, id, detail = "") {
  if (cond) pass(id, detail);
  else fail(id, detail);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function sha256(rel) {
  return crypto.createHash("sha256").update(read(rel)).digest("hex");
}

async function run() {
  console.log("\n=== Platform Live ZEGO Integration — Phase 5 P5-1 Audit ===\n");

  const tlvProvSha = sha256(TLV_POC_PROVIDER);
  const platIfaceSha = sha256(PLATFORM_INTERFACE);

  console.log("--- Guardrails (unchanged sources) ---\n");
  assert(fs.existsSync(path.join(ROOT, TLV_POC_PROVIDER)), "static:tlv-zego-provider-exists");
  assert(fs.existsSync(path.join(ROOT, PLATFORM_INTERFACE)), "static:platform-interface-exists");
  assert(fs.existsSync(path.join(ROOT, REPORT)), "static:audit-report-exists");

  console.log("\n--- TLV Provider stack ---\n");
  const tlvIface = read(TLV_INTERFACE);
  const tlvService = read(TLV_SERVICE);
  assert(/createTlvLiveProvider/.test(tlvIface), "tlv:createTlvLiveProvider");
  assert(/class ZegoLiveProvider/.test(read(TLV_POC_PROVIDER)), "tlv:ZegoLiveProvider");
  assert(/global\.TlvZegoLiveProvider/.test(read(TLV_POC_PROVIDER)), "tlv:TlvZegoLiveProvider-export");
  assert(/async startLive/.test(tlvService), "tlv:service-startLive");
  assert(/async joinLive/.test(tlvService), "tlv:service-joinLive");
  assert(/fetchToken/.test(tlvService), "tlv:service-fetchToken");
  assert(/\/api\/tlv-zego-token/.test(tlvService), "tlv:token-path");

  console.log("\n--- Platform Integration stack ---\n");
  const integ = read(INTEGRATION);
  assert(/TasuLivePlatformIntegration/.test(integ), "platform:integration-class");
  assert(/startPublish/.test(integ), "platform:startPublish");
  assert(/joinLive/.test(integ), "platform:joinLive");
  assert(/joinAsViewer/.test(integ), "platform:joinAsViewer");
  assert(/_executeIntegrationRetry/.test(integ), "platform:p4-6-retry");
  assert(/recordMonitoring/.test(integ), "platform:p4-5-monitoring");
  assert(/_recordRecordingCandidate/.test(integ), "platform:p4-4-recording");

  console.log("\n--- TLV production pages (not wired to provider) ---\n");
  const studio = read(STUDIO_HTML);
  const watch = read(WATCH_HTML);
  const broadcasts = read(TLV_BROADCASTS);
  assert(!/live-service\.js/.test(studio), "prod:studio-no-live-service");
  assert(!/zego-live-provider/.test(studio), "prod:studio-no-zego-provider");
  assert(!/live-platform-integration/.test(studio), "prod:studio-no-platform-integration");
  assert(/live-broadcasts-session-bridge/.test(studio), "prod:studio-has-bridge");
  assert(/live-comments/.test(watch), "prod:watch-has-supabase-comments");
  assert(/renderStreamPlayer/.test(broadcasts), "prod:renderStreamPlayer");
  assert(/stream_provider.*stub/.test(broadcasts), "prod:default-stub-provider");
  assert(/実映像未接続/.test(broadcasts), "prod:p0-hint-present");

  console.log("\n--- Session bridge ---\n");
  const bridge = read(TLV_BRIDGE);
  assert(/onStudioStart/.test(bridge), "bridge:onStudioStart");
  assert(/onWatchJoin/.test(bridge), "bridge:onWatchJoin");
  assert(/Provider.*未接続|非接触/.test(bridge), "bridge:provider-not-connected-doc");
  assert(/runSessionBridge/.test(broadcasts), "broadcasts:runSessionBridge");

  console.log("\n--- Feature flags ---\n");
  const flags = read(TLV_FLAGS);
  assert(/liveSessionManagerEnabled:\s*false/.test(flags), "flags:session-manager-default-off");
  assert(/usePlatformLive:\s*false/.test(flags), "flags:usePlatformLive-default-false");

  console.log("\n--- Token API ---\n");
  assert(fs.existsSync(path.join(ROOT, TOKEN_API)), "token:api-file-exists");
  const tokenApi = read(TOKEN_API);
  assert(/generateToken04|token04/i.test(tokenApi), "token:token04-generation");

  console.log("\n--- Adapter reuse path ---\n");
  const factory = read("platform-live/provider/create-platform-live-provider.js");
  assert(/TlvZegoLiveProvider/.test(factory), "adapter:wraps-tlv-zego-provider");
  assert(/ZegoLiveProviderAdapter/.test(factory), "adapter:ZegoLiveProviderAdapter");

  console.log("\n--- P5-2 seam markers ---\n");
  assert(/onStudioStart/.test(broadcasts) || /data-live-studio-start/.test(broadcasts), "seam:studio-start-hook");
  assert(/onWatchJoin/.test(broadcasts), "seam:watch-join-hook");

  console.log("\n--- Integrity (PoC / Interface unchanged this phase) ---\n");
  assert(sha256(TLV_POC_PROVIDER) === tlvProvSha, "integrity:tlv-zego-provider-unchanged");
  assert(sha256(PLATFORM_INTERFACE) === platIfaceSha, "integrity:platform-interface-unchanged");

  console.log("\n--- Phase 4 regression ---\n");
  try {
    execSync("npm run test:platform-live-zego-integration-phase4-p4-6", {
      cwd: ROOT,
      stdio: "pipe",
      encoding: "utf8",
    });
    pass("regression:p4-6");
  } catch (err) {
    fail("regression:p4-6", err.stdout?.slice(-300) || err.message);
  }

  console.log("\n=== Summary ===");
  console.log(`PASS: ${summary.pass}  FAIL: ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nP5-1 Audit GO\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
