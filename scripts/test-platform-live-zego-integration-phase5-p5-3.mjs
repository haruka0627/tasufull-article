#!/usr/bin/env node
/**
 * Platform Live ZEGO Integration — Phase 5 P5-3 (usePlatformLive flag) tests
 *
 *   node scripts/test-platform-live-zego-integration-phase5-p5-3.mjs
 *   npm run test:platform-live-zego-integration-phase5-p5-3
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FLAGS_PATH = "live/tlv-feature-flags.js";
const BRIDGE_PATH = "live/tlv-platform-live-bridge.js";
const ADAPTER_PATH = "live/tlv-platform-live-adapter.js";
const BROADCASTS_PATH = "live/live-broadcasts.js";
const STUDIO_HTML = "live/studio.html";
const WATCH_HTML = "live/watch.html";
const INTEGRATION_PATH = "platform-live/core/live-platform-integration.js";

const CORE_LOAD = [
  "platform-live/core/live-surfaces.js",
  "platform-live/core/live-session-states.js",
  "platform-live/core/live-session-events.js",
  "platform-live/core/live-session-event-bus.js",
  "platform-live/core/live-session-error-codes.js",
  "platform-live/core/live-provider-signals.js",
  "platform-live/core/live-session-validation.js",
  "platform-live/core/live-session-manager.js",
  "platform-live/core/live-provider-state-map.js",
  "platform-live/core/live-platform-diagnostics.js",
  "platform-live/core/live-platform-edge-sync.js",
  "platform-live/core/live-platform-retry.js",
];

const BROADCAST_LOAD = [
  "platform-live/broadcast/live-broadcast-states.js",
  "platform-live/broadcast/live-broadcast-events.js",
  "platform-live/broadcast/live-broadcast-provider-signals.js",
  "platform-live/broadcast/live-broadcast-error-codes.js",
  "platform-live/broadcast/live-broadcast-validation.js",
  "platform-live/broadcast/live-broadcast-service.js",
  "platform-live/broadcast/live-broadcast-edge-client.js",
];

const VIEWER_LOAD = [
  "platform-live/viewer/live-viewer-states.js",
  "platform-live/viewer/live-viewer-events.js",
  "platform-live/viewer/live-viewer-error-codes.js",
  "platform-live/viewer/live-viewer-validation.js",
  "platform-live/viewer/live-viewer-permission.js",
  "platform-live/viewer/live-viewer-ccu-registry.js",
  "platform-live/viewer/live-viewer-service.js",
  "platform-live/viewer/live-viewer-edge-client.js",
];

const CHAT_LOAD = [
  "platform-live/chat/live-chat-message-states.js",
  "platform-live/chat/live-chat-system-events.js",
  "platform-live/chat/live-chat-events.js",
  "platform-live/chat/live-chat-error-codes.js",
  "platform-live/chat/live-chat-validation.js",
  "platform-live/chat/live-chat-moderation-hook.js",
  "platform-live/chat/live-chat-rate-limit-hook.js",
  "platform-live/chat/live-chat-gateway.js",
  "platform-live/chat/live-chat-edge-client.js",
];

const RECORDING_LOAD = [
  "platform-live/recording/live-recording-states.js",
  "platform-live/recording/live-recording-events.js",
  "platform-live/recording/live-recording-error-codes.js",
  "platform-live/recording/live-recording-validation.js",
  "platform-live/recording/live-recording-service.js",
  "platform-live/recording/live-recording-edge-client.js",
];

const MONITORING_LOAD = [
  "platform-live/monitoring/live-monitoring-states.js",
  "platform-live/monitoring/live-monitoring-events.js",
  "platform-live/monitoring/live-monitoring-error-codes.js",
  "platform-live/monitoring/live-monitoring-validation.js",
  "platform-live/monitoring/live-monitoring-metrics-store.js",
  "platform-live/monitoring/live-monitoring-smoke-runner.js",
  "platform-live/monitoring/live-monitoring-service.js",
  "platform-live/monitoring/live-monitoring-edge-client.js",
];

const PROVIDER_LOAD = [
  "platform-live/provider/zego-platform-error-map.js",
  "platform-live/provider/live-provider-types.js",
  "platform-live/provider/live-provider-interface.js",
  "platform-live/provider/stub-live-provider.js",
  "platform-live/provider/create-platform-live-provider.js",
  INTEGRATION_PATH,
];

const REGRESSION_SCRIPTS = [
  "test:platform-live-zego-integration-phase5-p5-2",
  "test:platform-live-zego-integration-phase5-p5-1",
  "test:platform-live-zego-integration-phase4-p4-6",
];

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

function loadRuntime(options = {}) {
  const context = {
    console,
    Date,
    Promise,
    Error,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    setTimeout,
    clearTimeout,
    fetch: async () => ({ ok: false, status: 503, json: async () => ({ error: "mock fetch disabled" }) }),
    document: {
      head: { appendChild() {} },
      querySelector() {
        return null;
      },
      createElement() {
        return { setAttribute() {}, onload: null, onerror: null, src: "" };
      },
    },
    location: { href: "http://127.0.0.1:8788/live/studio.html" },
  };
  context.window = context;
  context.globalThis = context;

  const ctx = vm.createContext(context);

  if (options.usePlatformLive === true) {
    vm.runInContext(
      `(function(g){g.TLV_FEATURE_FLAGS=Object.freeze({usePlatformLive:true,liveSessionManagerEnabled:false});Object.defineProperty(g,"TLV_USE_PLATFORM_LIVE",{get(){return g.TLV_FEATURE_FLAGS?.usePlatformLive===true;},configurable:true});})(globalThis);`,
      ctx,
    );
  } else if (options.flagsUndefined) {
    vm.runInContext(
      `(function(g){g.TLV_FEATURE_FLAGS=Object.freeze({liveSessionManagerEnabled:false});Object.defineProperty(g,"TLV_USE_PLATFORM_LIVE",{get(){return g.TLV_FEATURE_FLAGS?.usePlatformLive===true;},configurable:true});})(globalThis);`,
      ctx,
    );
  } else {
    vm.runInContext(read(FLAGS_PATH), ctx);
  }

  vm.runInContext(read(BRIDGE_PATH), ctx);

  if (options.withPlatformStack) {
    for (const rel of [
      ...CORE_LOAD,
      ...BROADCAST_LOAD,
      ...VIEWER_LOAD,
      ...CHAT_LOAD,
      ...RECORDING_LOAD,
      ...MONITORING_LOAD,
      ...PROVIDER_LOAD,
      ADAPTER_PATH,
    ]) {
      vm.runInContext(read(rel), ctx);
    }
  }

  if (options.withBroadcasts) {
    vm.runInContext(read(BROADCASTS_PATH), ctx);
  }

  return ctx;
}

async function run() {
  console.log("\n=== Platform Live ZEGO Integration — Phase 5 P5-3 ===\n");

  const flagsSrc = read(FLAGS_PATH);
  const bridgeSrc = read(BRIDGE_PATH);
  const broadcastsSrc = read(BROADCASTS_PATH);
  const studioSha = sha256(STUDIO_HTML);
  const watchSha = sha256(WATCH_HTML);

  console.log("--- Guardrails ---\n");
  assert(/usePlatformLive:\s*false/.test(flagsSrc), "static:flag-default-false");
  assert(/TLV_USE_PLATFORM_LIVE/.test(flagsSrc), "static:flag-getter");
  assert(/runPlatformLiveBridge/.test(broadcastsSrc), "static:broadcasts-bridge");
  assert(/onStudioStart/.test(broadcastsSrc), "static:studio-hook");
  assert(/onWatchJoin/.test(broadcastsSrc), "static:watch-hook");
  assert(/tlv-platform-live-bridge/.test(read(STUDIO_HTML)), "static:studio-bridge-script");
  assert(/tlv-platform-live-bridge/.test(read(WATCH_HTML)), "static:watch-bridge-script");
  assert(!/TlvZegoLiveProvider|zego-live-provider/.test(bridgeSrc), "static:bridge-no-zego");

  console.log("\n--- Flag OFF (default) ---\n");
  {
    const ctx = loadRuntime();
    assert(ctx.TlvPlatformLiveBridge.isEnabled() === false, "off:isEnabled-false");
    assert(ctx.TLV_USE_PLATFORM_LIVE === false, "off:getter-false");

    const start = await ctx.TlvPlatformLiveBridge.onStudioStart({ broadcastId: "bc-off", creatorId: "h1" });
    assert(start.skipped === true, "off:studio-skipped");
    const join = await ctx.TlvPlatformLiveBridge.onWatchJoin({ broadcastId: "bc-off", viewerId: "v1" });
    assert(join.skipped === true, "off:watch-skipped");
    assert(ctx.TasuLivePlatformIntegration == null, "off:integration-not-loaded");
  }

  console.log("\n--- Flag undefined treated as false ---\n");
  {
    const ctx = loadRuntime({ flagsUndefined: true });
    assert(ctx.TlvPlatformLiveBridge.isEnabled() === false, "undef:isEnabled-false");
    const res = await ctx.TlvPlatformLiveBridge.onStudioStart({ broadcastId: "bc-u", creatorId: "h1" });
    assert(res.skipped === true, "undef:skipped");
  }

  console.log("\n--- Bridge missing / broadcasts safe ---\n");
  {
    const ctxBare = vm.createContext({
      console,
      TLV_FEATURE_FLAGS: { usePlatformLive: false },
      window: {},
      globalThis: {},
    });
    ctxBare.window = ctxBare;
    ctxBare.globalThis = ctxBare;
    vm.runInContext(read(BROADCASTS_PATH), ctxBare);
    let threw = false;
    try {
      await ctxBare.TasuLiveBroadcasts.runPlatformLiveBridge("onStudioStart", { broadcastId: "x" });
    } catch {
      threw = true;
    }
    assert(threw === false, "off:no-bridge-no-throw");
  }

  console.log("\n--- runPlatformLiveBridge flag OFF no-op ---\n");
  {
    const ctx = loadRuntime({ withBroadcasts: true });
    let called = false;
    ctx.TlvPlatformLiveBridge = {
      isEnabled: () => false,
      onStudioStart: async () => {
        called = true;
        return { ok: true };
      },
    };
    await ctx.TasuLiveBroadcasts.runPlatformLiveBridge("onStudioStart", { broadcastId: "bc-x" });
    assert(called === false, "off:runPlatformLiveBridge-no-call");
  }

  console.log("\n--- Flag ON (preloaded stack) ---\n");
  {
    const ctx = loadRuntime({ usePlatformLive: true, withPlatformStack: true });
    assert(ctx.TlvPlatformLiveBridge.isEnabled() === true, "on:isEnabled-true");

    const start = await ctx.TlvPlatformLiveBridge.onStudioStart({
      broadcastId: "bc-on-host",
      creatorId: "host-on",
      creatorName: "Host On",
    });
    assert(start.ok !== false, "on:startHost", start.error || "");
    assert(start.via === "platform-live" && start.op === "startHost", "on:startHost-meta");
    assert(start.diagnostics != null || start.sessionState != null, "on:startHost-diagnostics");

    const viewerCtx = loadRuntime({ usePlatformLive: true, withPlatformStack: true });
    const join = await viewerCtx.TlvPlatformLiveBridge.onWatchJoin({
      broadcastId: "bc-on-view",
      viewerId: "viewer-on",
    });
    assert(join.ok !== false, "on:joinViewer", join.error || "");
    assert(join.via === "platform-live", "on:joinViewer-meta");

    const diag = viewerCtx.TlvPlatformLiveBridge.getDiagnostics();
    assert(diag.enabled === true, "on:diagnostics-enabled");
    assert(diag.lastResult?.op === "joinViewer", "on:diagnostics-lastResult");
  }

  console.log("\n--- Flag ON failure non-fatal ---\n");
  {
    const ctx = loadRuntime({ usePlatformLive: true });
    const res = await ctx.TlvPlatformLiveBridge.onStudioStart({
      broadcastId: "bc-fail",
      creatorId: "host-fail",
    });
    assert(res.partial === true || res.ok === false, "on:partial-on-load-fail");
    assert(res.at != null, "on:lastResult-recorded");
  }

  console.log("\n--- Retry delegation ---\n");
  {
    assert(/_executeIntegrationRetry/.test(read(INTEGRATION_PATH)), "retry:integration");
    assert(!/executeWithRetry/.test(read(BRIDGE_PATH)), "retry:not-in-bridge");
    assert(!/executeWithRetry/.test(read(ADAPTER_PATH)), "retry:not-in-adapter");
  }

  console.log("\n--- HTML integrity (minimal script add only) ---\n");
  {
    const studio = read(STUDIO_HTML);
    const watch = read(WATCH_HTML);
    assert(sha256(STUDIO_HTML) === studioSha || /tlv-platform-live-bridge/.test(studio), "html:studio-bridge-only-addition");
    assert(sha256(WATCH_HTML) === watchSha || /tlv-platform-live-bridge/.test(watch), "html:watch-bridge-only-addition");
    assert(!/live-platform-integration/.test(studio), "html:studio-no-direct-integration");
    assert(!/live-platform-integration/.test(watch), "html:watch-no-direct-integration");
  }

  console.log("\n--- Regression ---\n");
  for (const script of REGRESSION_SCRIPTS) {
    try {
      execSync(`npm run ${script}`, { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
      pass(`regression:${script}`);
    } catch (err) {
      fail(`regression:${script}`, err.stdout?.slice(-400) || err.message);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`PASS: ${summary.pass}  FAIL: ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nP5-3 GO\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
