#!/usr/bin/env node
/**
 * Platform Live ZEGO Integration — Phase 5 P5-6 (watch leave / studio preview)
 *
 *   node scripts/test-platform-live-zego-integration-phase5-p5-6.mjs
 *   npm run test:platform-live-zego-integration-phase5-p5-6
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BROADCASTS_PATH = "live/live-broadcasts.js";
const BRIDGE_PATH = "live/tlv-platform-live-bridge.js";

const REGRESSION_SCRIPTS = [
  "test:platform-live-zego-integration-phase5-p5-5",
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

function loadBroadcastsRuntime(options = {}) {
  const listeners = { pagehide: [], beforeunload: [] };
  const ctx = vm.createContext({
    console,
    document: {
      createElement: () => ({ setAttribute() {}, appendChild() {} }),
      querySelector: () => null,
    },
    TLV_FEATURE_FLAGS: {
      usePlatformLive: options.usePlatformLive === true,
      liveSessionManagerEnabled: false,
    },
    TasuLiveConfig: {
      LIVE_STREAM_PROVIDER_DEFAULT: "stub",
      escapeHtml: (s) =>
        String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;"),
      labelBroadcastStatus: (s) => String(s || "unknown"),
      labelStreamProvider: (s) => String(s || "stub"),
      watchUrl: (id) => `/live/watch.html?broadcast_id=${encodeURIComponent(id || "")}`,
      profileUrl: (id) => `/live/profile.html?user=${encodeURIComponent(id || "")}`,
    },
    TlvPlatformLiveBridge: {
      isEnabled: () => options.usePlatformLive === true,
      onWatchLeave: async (payload) => ({
        ok: true,
        via: "platform-live",
        op: "leaveViewer",
        payload,
      }),
      onStudioStart: async (payload) => ({
        ok: true,
        via: "platform-live",
        op: "startHost",
        videoContainer: payload?.videoContainer || null,
      }),
    },
    addEventListener(type, fn) {
      if (listeners[type]) listeners[type].push(fn);
    },
    __listeners: listeners,
    window: {},
    globalThis: {},
  });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(read(BROADCASTS_PATH), ctx);
  return ctx;
}

async function run() {
  console.log("\n=== Platform Live ZEGO Integration — Phase 5 P5-6 ===\n");

  const broadcastsSrc = read(BROADCASTS_PATH);
  const bridgeSrc = read(BRIDGE_PATH);

  console.log("--- Guardrails ---\n");
  assert(/bindPlatformLiveWatchLeave/.test(broadcastsSrc), "static:watch-leave-bind");
  assert(/onWatchLeave/.test(broadcastsSrc), "static:watch-leave-bridge-call");
  assert(/data-live-platform-studio-preview-mount/.test(broadcastsSrc), "static:studio-preview-mount");
  assert(/videoContainer/.test(broadcastsSrc), "static:videoContainer-handoff");
  assert(/finalizePlatformLiveStudioPreview/.test(broadcastsSrc), "static:studio-preview-finalize");
  assert(/onWatchLeave/.test(bridgeSrc), "static:bridge-onWatchLeave");

  console.log("\n--- Flag OFF non-regression ---\n");
  {
    const ctx = loadBroadcastsRuntime({ usePlatformLive: false });
    const studioHtml = ctx.TasuLiveBroadcasts.renderStudioRow({
      id: "bc-off",
      title: "off",
      status: "live",
      stream_provider: "stub",
    });
    assert(!/data-live-platform-studio-preview-mount/.test(studioHtml), "off:no-studio-preview");
    ctx.TasuLiveBroadcasts.bindPlatformLiveWatchLeave("bc-off", "viewer-off");
    assert(ctx.__listeners.pagehide.length === 0, "off:no-watch-leave-listener");
  }

  console.log("\n--- Flag ON studio preview mount ---\n");
  {
    const ctx = loadBroadcastsRuntime({ usePlatformLive: true });
    const liveHtml = ctx.TasuLiveBroadcasts.renderStudioRow({
      id: "bc-on",
      title: "on",
      status: "live",
      stream_provider: "stub",
    });
    assert(/data-live-platform-studio-preview-mount/.test(liveHtml), "on:studio-preview-mount");
    const scheduledHtml = ctx.TasuLiveBroadcasts.renderStudioRow({
      id: "bc-sched",
      title: "sched",
      status: "scheduled",
      stream_provider: "stub",
    });
    assert(!/data-live-platform-studio-preview-mount/.test(scheduledHtml), "on:no-preview-scheduled");
  }

  console.log("\n--- Flag ON watch leave binding ---\n");
  {
    const ctx = loadBroadcastsRuntime({ usePlatformLive: true });
    ctx.TasuLiveBroadcasts.bindPlatformLiveWatchLeave("bc-leave", "viewer-1");
    assert(ctx.__listeners.pagehide.length === 1, "on:pagehide-bound");
    assert(ctx.__listeners.beforeunload.length === 1, "on:beforeunload-bound");
    ctx.TasuLiveBroadcasts.bindPlatformLiveWatchLeave("bc-leave-2", "viewer-2");
    assert(ctx.__listeners.pagehide.length === 1, "on:single-bind");
    assert(ctx.__tlvPlatformLiveWatchLeaveState?.active?.broadcastId === "bc-leave-2", "on:active-updated");
  }

  console.log("\n--- Watch leave cleanup non-fatal ---\n");
  {
    const ctx = loadBroadcastsRuntime({ usePlatformLive: true });
    ctx.TasuLiveBroadcasts.bindPlatformLiveWatchLeave("bc-cleanup", "viewer-c");
    let threw = false;
    try {
      await ctx.__listeners.pagehide[0]();
    } catch {
      threw = true;
    }
    assert(threw === false, "leave:cleanup-no-throw");
    assert(ctx.globalThis.__tlvPlatformLiveWatchLeaveState?.active === null, "leave:active-cleared");
  }

  console.log("\n--- Studio preview finalize non-fatal ---\n");
  {
    const ctx = loadBroadcastsRuntime({ usePlatformLive: true });
    const scope = {
      querySelector(sel) {
        if (sel === "[data-live-platform-studio-preview-loading]") {
          return { hidden: false, setAttribute() {} };
        }
        if (sel === "[data-live-platform-studio-preview-mount]") return { innerHTML: "" };
        if (sel === "[data-live-platform-studio-preview-video]") return null;
        return null;
      },
    };
    let threw = false;
    try {
      ctx.TasuLiveBroadcasts.finalizePlatformLiveStudioPreview(scope, {
        ok: false,
        partial: true,
        error: "simulated",
      });
    } catch {
      threw = true;
    }
    assert(threw === false, "studio:finalize-no-throw");
  }

  console.log("\n--- videoContainer handoff to bridge ---\n");
  {
    const ctx = loadBroadcastsRuntime({ usePlatformLive: true });
    const container = { tag: "preview-mount" };
    const res = await ctx.TasuLiveBroadcasts.invokePlatformLiveBridge("onStudioStart", {
      broadcastId: "bc-handoff",
      creatorId: "host-1",
      videoContainer: container,
    });
    assert(res?.op === "startHost", "handoff:startHost-op");
    assert(res?.videoContainer === container, "handoff:videoContainer");
  }

  if (process.env.P5_6_SKIP_REGRESSION !== "1") {
    console.log("\n--- Regression ---\n");
    for (const script of REGRESSION_SCRIPTS) {
      try {
        execSync(`npm run ${script}`, {
          cwd: ROOT,
          stdio: "pipe",
          encoding: "utf8",
          timeout: 1_800_000,
          env: { ...process.env, P5_5_SKIP_REGRESSION: "1", P5_6_SKIP_REGRESSION: "1" },
        });
        pass(`regression:${script}`);
      } catch (err) {
        fail(`regression:${script}`, (err.stdout || err.stderr || err.message).slice(-400));
      }
    }
  } else {
    pass("regression", "skipped");
  }

  console.log(`\n=== P5-6 ${summary.fail === 0 ? "GO" : "NO-GO"} — ${summary.pass} PASS / ${summary.fail} FAIL ===\n`);
  if (failures.length) {
    console.log(failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
