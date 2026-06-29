#!/usr/bin/env node
/**
 * Platform Live ZEGO Integration — Phase 5 P5-5 (ZEGO provider lazy load)
 *
 *   node scripts/test-platform-live-zego-integration-phase5-p5-5.mjs
 *   npm run test:platform-live-zego-integration-phase5-p5-5
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BRIDGE_PATH = "live/tlv-platform-live-bridge.js";
const ADAPTER_PATH = "live/tlv-platform-live-adapter.js";
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

const ZEGO_LOAD = [
  "live/providers/zego-live-provider.js",
  "platform-live/provider/adapters/zego-live-provider-adapter.js",
];

const REGRESSION_SCRIPTS = [
  "test:platform-live-zego-integration-phase5-p5-8",
  "test:platform-live-zego-integration-phase5-p5-3",
  "test:platform-live-zego-integration-phase5-p5-2",
  "test:platform-live-zego-integration-phase4-p4-6",
];

const summary = { pass: 0, fail: 0 };
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

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

function resolveScriptRel(src) {
  if (src.startsWith("../")) return src.slice(3);
  if (src.startsWith("providers/")) return `live/${src}`;
  if (src === "tlv-platform-live-adapter.js") return ADAPTER_PATH;
  return src;
}

function createScriptDocument(ctx, options = {}) {
  const loadedAbs = new Set();
  const base = options.baseUrl || "http://127.0.0.1:8788/live/studio.html";
  const failSrc = options.failSrc || null;

  return {
    head: {
      appendChild(el) {
        const src = el.src;
        const absolute = new URL(src, base).href;
        if (loadedAbs.has(absolute)) {
          queueMicrotask(() => el.onload?.());
          return;
        }
        loadedAbs.add(absolute);
        if (failSrc && src === failSrc) {
          queueMicrotask(() => el.onerror?.());
          return;
        }
        try {
          const rel = resolveScriptRel(src);
          vm.runInContext(read(rel), ctx);
          queueMicrotask(() => el.onload?.());
        } catch (err) {
          queueMicrotask(() => el.onerror?.());
        }
      },
    },
    querySelector(sel) {
      const m = /data-tlv-platform-live="([^"]+)"/.exec(sel);
      if (!m) return null;
      return loadedAbs.has(m[1]) ? {} : null;
    },
    createElement() {
      return { setAttribute() {}, src: "", onload: null, onerror: null };
    },
  };
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
    URL,
    queueMicrotask,
    setTimeout,
    clearTimeout,
    fetch: async () => ({ ok: false, status: 503, json: async () => ({ error: "mock fetch disabled" }) }),
    location: { href: options.baseUrl || "http://127.0.0.1:8788/live/studio.html" },
  };
  context.window = context;
  context.globalThis = context;
  const ctx = vm.createContext(context);

  if (options.usePlatformLive === true) {
    vm.runInContext(
      `(function(g){g.TLV_FEATURE_FLAGS=Object.freeze({usePlatformLive:true,liveSessionManagerEnabled:false});})(globalThis);`,
      ctx,
    );
  } else {
    vm.runInContext(
      `(function(g){g.TLV_FEATURE_FLAGS=Object.freeze({usePlatformLive:false,liveSessionManagerEnabled:false});})(globalThis);`,
      ctx,
    );
  }

  context.document = createScriptDocument(ctx, options);
  vm.runInContext(read(BRIDGE_PATH), ctx);
  return ctx;
}

async function run() {
  console.log("\n=== Platform Live ZEGO Integration — Phase 5 P5-5 ===\n");

  const bridgeSrc = read(BRIDGE_PATH);

  console.log("--- Guardrails ---\n");
  {
    const platformStart = bridgeSrc.indexOf("PLATFORM_LIVE_SCRIPTS");
    const platformEnd = bridgeSrc.indexOf("]);", platformStart);
    const platformBlock = bridgeSrc.slice(platformStart, platformEnd);
    assert(!/zego-live-provider/.test(platformBlock), "static:platform-stack-no-eager-zego");
  }
  assert(/ZEGO_LIVE_SCRIPTS/.test(bridgeSrc), "static:zego-lazy-scripts");
  assert(/ensureZegoProviderLoaded/.test(bridgeSrc), "static:ensure-zego-lazy");
  assert(/zegoProviderReady/.test(bridgeSrc), "static:diagnostics-zego-ready");
  assert(/console\.warn/.test(bridgeSrc), "static:non-fatal-warn");

  console.log("\n--- Flag OFF ---\n");
  {
    const ctx = loadRuntime({ usePlatformLive: false });
    const bridge = ctx.TlvPlatformLiveBridge;
    assert(bridge.isEnabled() === false, "off:isEnabled-false");
    assert(bridge.isZegoProviderReady() === false, "off:zego-not-ready");
    const res = await bridge.ensureZegoProviderLoaded();
    assert(res.skipped === true, "off:zego-load-skipped");
    assert(ctx.TlvZegoLiveProvider === undefined, "off:no-tlv-zego-global");
    assert(ctx.ZegoLiveProviderAdapter === undefined, "off:no-zego-adapter-global");
    const diag = bridge.getDiagnostics();
    assert(diag.zegoProviderReady === false, "off:diag-not-ready");
  }

  console.log("\n--- Flag ON · lazy load success ---\n");
  {
    const ctx = loadRuntime({ usePlatformLive: true });
    const bridge = ctx.TlvPlatformLiveBridge;
    assert(bridge.isZegoProviderReady() === false, "on:before-not-ready");
    const platformRes = await bridge.ensurePlatformLiveLoaded();
    assert(platformRes.ok === true, "on:platform-stack-loaded");
    const zegoRes = await bridge.ensureZegoProviderLoaded();
    assert(zegoRes.ok === true, "on:zego-load-ok");
    assert(zegoRes.ready === true, "on:zego-ready");
    assert(bridge.isZegoProviderReady() === true, "on:isZegoProviderReady");
    assert(bridge.resolveAdapterProviderId() === "zego", "on:providerId-zego");
    const diag = bridge.getDiagnostics();
    assert(diag.zegoProviderReady === true, "on:diag-ready");
    assert(diag.zegoProviderLoad?.ready === true, "on:diag-load-ready");
  }

  console.log("\n--- Flag ON · adapter uses zego providerId ---\n");
  {
    const ctx = loadRuntime({ usePlatformLive: true });
    const bridge = ctx.TlvPlatformLiveBridge;
    const joinRes = await bridge.onWatchJoin({
      roomId: "room-p5-5",
      userId: "viewer-p5-5",
      broadcastId: "bc-p5-5",
      videoContainer: { appendChild() {} },
    });
    assert(joinRes?.op === "joinViewer", "on:watch-join-returned", JSON.stringify(joinRes));
    assert(joinRes?.via === "platform-live", "on:watch-join-non-fatal");
    const diag = bridge.getDiagnostics();
    assert(diag.providerId === "zego", "on:adapter-provider-zego", String(diag.providerId));
    assert(diag.adapterReady === true, "on:adapter-ready");
  }

  console.log("\n--- Flag ON · load failure non-fatal (stub fallback) ---\n");
  {
    const ctx = loadRuntime({
      usePlatformLive: true,
      failSrc: "providers/zego-live-provider.js",
    });
    const bridge = ctx.TlvPlatformLiveBridge;
    const zegoRes = await bridge.ensureZegoProviderLoaded();
    assert(zegoRes.partial === true, "fail:partial");
    assert(zegoRes.ready === false, "fail:not-ready");
    assert(bridge.isZegoProviderReady() === false, "fail:isZegoProviderReady-false");
    assert(bridge.resolveAdapterProviderId() === "stub", "fail:providerId-stub");
    const joinRes = await bridge.onWatchJoin({
      roomId: "room-fail",
      userId: "viewer-fail",
      broadcastId: "bc-fail",
      videoContainer: { appendChild() {} },
    });
    assert(joinRes?.op === "joinViewer", "fail:watch-join-returned");
    assert(joinRes?.ok !== false || joinRes?.partial === true, "fail:watch-join-non-fatal");
    const diag = bridge.getDiagnostics();
    assert(diag.providerId === "stub", "fail:adapter-stub", String(diag.providerId));
    assert(Boolean(diag.zegoProviderLoad?.error), "fail:diag-error-recorded");
  }

  if (process.env.P5_5_SKIP_REGRESSION !== "1") {
    console.log("\n--- Regression ---\n");
    for (const script of REGRESSION_SCRIPTS) {
      try {
        execSync(`npm run ${script}`, { cwd: ROOT, stdio: "pipe", encoding: "utf8", timeout: 1_800_000 });
        pass(`regression:${script}`);
      } catch (err) {
        fail(`regression:${script}`, (err.stdout || err.stderr || err.message).slice(-400));
      }
    }
  } else {
    pass("regression", "skipped");
  }

  console.log(`\n=== P5-5 ${summary.fail === 0 ? "GO" : "NO-GO"} — ${summary.pass} PASS / ${summary.fail} FAIL ===\n`);
  if (failures.length) {
    console.log(failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
