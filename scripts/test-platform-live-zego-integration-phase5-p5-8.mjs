#!/usr/bin/env node
/**
 * Platform Live ZEGO Integration — Phase 5 P5-8 (renderStreamPlayer)
 *
 *   node scripts/test-platform-live-zego-integration-phase5-p5-8.mjs
 *   npm run test:platform-live-zego-integration-phase5-p5-8
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BROADCASTS_PATH = "live/live-broadcasts.js";
const STUB_PROVIDER_PATH = "platform-live/provider/stub-live-provider.js";

const REGRESSION_SCRIPTS = [
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
    },
    TlvPlatformLiveBridge: { isEnabled: () => options.usePlatformLive === true },
    window: {},
    globalThis: {},
  });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(read(BROADCASTS_PATH), ctx);
  return ctx;
}

function loadStubProviderRuntime() {
  const iface = `
    global.PlatformLiveProviderInterface = class {
      _emitSignal() {}
      _emitBroadcastSignal() {}
    };
    global.PLATFORM_LIVE_PROVIDER_SIGNALS = {
      PROVIDER_CONNECTING: "PROVIDER_CONNECTING",
      PROVIDER_CONNECTED: "PROVIDER_CONNECTED",
      PROVIDER_DISCONNECTED: "PROVIDER_DISCONNECTED",
    };
  `;
  const ctx = vm.createContext({ console, document: global.document, window: {}, globalThis: {} });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(iface, ctx);
  vm.runInContext(read(STUB_PROVIDER_PATH), ctx);
  return ctx;
}

async function run() {
  console.log("\n=== Platform Live ZEGO Integration — Phase 5 P5-8 ===\n");

  const broadcastsSrc = read(BROADCASTS_PATH);
  const stubSrc = read(STUB_PROVIDER_PATH);

  console.log("--- Static guards ---\n");
  assert(/isUsePlatformLivePlayer/.test(broadcastsSrc), "static:isUsePlatformLivePlayer");
  assert(/data-live-platform-player-mount/.test(broadcastsSrc), "static:player-mount-markup");
  assert(/finalizePlatformLivePlayerMount/.test(broadcastsSrc), "static:finalize-mount");
  assert(/invokePlatformLiveBridge/.test(broadcastsSrc), "static:invoke-bridge");
  assert(/_mountPlayerSurface/.test(stubSrc), "static:stub-mount-surface");
  assert(/playerMounted/.test(stubSrc), "static:stub-playerMounted");

  console.log("\n--- Flag OFF renderStreamPlayer ---\n");
  {
    const ctx = loadBroadcastsRuntime({ usePlatformLive: false });
    const html = ctx.TasuLiveBroadcasts.renderStreamPlayer({
      status: "live",
      stream_provider: "stub",
    });
    assert(/data-live-watch-placeholder/.test(html), "off:placeholder-live");
    assert(!/data-live-platform-player-mount/.test(html), "off:no-player-mount");
  }

  console.log("\n--- Flag ON renderStreamPlayer ---\n");
  {
    const ctx = loadBroadcastsRuntime({ usePlatformLive: true });
    const liveHtml = ctx.TasuLiveBroadcasts.renderStreamPlayer({
      status: "live",
      stream_provider: "stub",
    });
    assert(/data-live-platform-player-mount/.test(liveHtml), "on:player-mount-live");
    assert(!/data-live-watch-placeholder/.test(liveHtml), "on:no-placeholder-live");

    const endedHtml = ctx.TasuLiveBroadcasts.renderStreamPlayer({
      status: "ended",
      stream_provider: "stub",
    });
    assert(/data-live-watch-placeholder/.test(endedHtml), "on:placeholder-ended");
  }

  console.log("\n--- Stub provider mount ---\n");
  {
    const ctx = vm.createContext({
      console,
      document: {
        createElement() {
          return {
            className: "",
            muted: false,
            controls: false,
            setAttribute() {},
          };
        },
      },
      window: {},
      globalThis: {},
    });
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.runInContext(
      `globalThis.PlatformLiveProviderInterface = class { _emitSignal(){} _emitBroadcastSignal(){} };
       globalThis.PLATFORM_LIVE_PROVIDER_SIGNALS = { PROVIDER_CONNECTING:"a", PROVIDER_CONNECTED:"b", PROVIDER_DISCONNECTED:"c" };`,
      ctx,
    );
    vm.runInContext(read(STUB_PROVIDER_PATH), ctx);
    const container = {
      _children: [],
      innerHTML: "",
      appendChild(el) {
        this._children.push(el);
      },
    };
    const provider = new ctx.StubLiveProvider();
    const res = await provider.joinLive({
      roomId: "room-p58",
      userId: "viewer-1",
      surface: "tlv",
      videoContainer: container,
    });
    assert(res.playerMounted === true, "stub:joinLive-mounted");
    assert(container._children.length === 1, "stub:video-element");
    assert(res.ok !== false, "stub:joinLive-ok");
  }

  console.log("\n--- finalize non-fatal ---\n");
  {
    const ctx = loadBroadcastsRuntime({ usePlatformLive: true });
    const doc = {
      querySelector(sel) {
        if (sel === "[data-live-platform-player-loading]") return { hidden: false, setAttribute() {} };
        if (sel === "[data-live-platform-player-mount]") return { innerHTML: "" };
        if (sel === "[data-live-platform-player-video]") return null;
        return null;
      },
    };
    const scope = { querySelector: (s) => doc.querySelector(s) };
    let threw = false;
    try {
      ctx.TasuLiveBroadcasts.finalizePlatformLivePlayerMount(scope, {
        ok: false,
        partial: true,
        error: "simulated",
      });
    } catch {
      threw = true;
    }
    assert(threw === false, "finalize:no-throw");
  }

  console.log("\n--- Regression ---\n");
  for (const script of REGRESSION_SCRIPTS) {
    try {
      execSync(`npm run ${script}`, { cwd: ROOT, stdio: "pipe", encoding: "utf8", timeout: 1_800_000 });
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
  console.log("\nP5-8 GO\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
