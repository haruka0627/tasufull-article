#!/usr/bin/env node
/**
 * TLV Live Session Debug Panel — unit tests (Phase2-04)
 *
 *   node scripts/test-live-session-debug-panel.mjs
 *   npm run test:live-session-debug-panel
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SESSION_LOAD = [
  "live/session/live-session-states.js",
  "live/session/live-session-events.js",
  "live/session/live-session-event-bus.js",
  "live/session/live-provider-signals.js",
  "live/session/live-provider-signals.js",
  "live/session/live-session-error-codes.js",
  "live/session/live-session-validation.js",
  "live/session/live-session-manager.js",
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

function loadPanelRuntime(flagOn = false) {
  const body = { children: [] };
  body.appendChild = (el) => {
    body.children.push(el);
    el.isConnected = true;
  };

  function createMockPanel() {
    const fields = {};
    return {
      isConnected: false,
      querySelector(sel) {
        if (!fields[sel]) fields[sel] = { textContent: "" };
        return fields[sel];
      },
      remove() {
        this.isConnected = false;
        const idx = body.children.indexOf(this);
        if (idx >= 0) body.children.splice(idx, 1);
      },
    };
  }

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
    document: {
      body,
      createElement() {
        let panel = null;
        return {
          set innerHTML(_html) {
            panel = createMockPanel();
          },
          get firstElementChild() {
            return panel;
          },
        };
      },
    },
    addEventListener: () => {},
    __tlvLiveWatchLeaveBound: false,
  };
  context.window = context;
  context.globalThis = context;

  const ctx = vm.createContext(context);
  for (const rel of SESSION_LOAD) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, "live/tlv-feature-flags.js"), "utf8"), ctx);
  if (flagOn) {
    context.TLV_FEATURE_FLAGS = Object.freeze({
      ...context.TLV_FEATURE_FLAGS,
      liveSessionManagerEnabled: true,
    });
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, "live/live-broadcasts-session-bridge.js"), "utf8"), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "live/live-session-debug-panel.js"), "utf8"), ctx);
  return context;
}

async function run() {
  console.log("\n=== TLV Session Debug Panel — unit tests ===\n");

  console.log("--- Flag OFF ---\n");
  {
    const ctx = loadPanelRuntime(false);
    const Panel = ctx.TlvLiveSessionDebugPanel;
    assert(Panel.isEnabled() === false, "off:isEnabled");
    const el = Panel.mount({ page: "studio" });
    assert(el === null, "off:mount-null");
    assert(ctx.document.body.children.length === 0, "off:no-dom");
  }

  console.log("\n--- Flag ON ---\n");
  {
    const ctx = loadPanelRuntime(true);
    const Panel = ctx.TlvLiveSessionDebugPanel;
    const Bridge = ctx.TlvLiveBroadcastsSessionBridge;
    const S = ctx.LIVE_SESSION_STATES;

    assert(Panel.isEnabled() === true, "on:isEnabled");
    const el = Panel.mount({ page: "studio" });
    assert(el !== null, "on:mount-panel");
    assert(ctx.document.body.children.length === 1, "on:dom-added");

    await Bridge.onStudioStart({ broadcastId: "room-ui", creatorId: "c1" });
    Panel.refresh();
    const snap = Bridge.getSnapshot();
    assert(snap.state === S.LIVE, "on:state-LIVE");
    assert(
      snap.recentEvents?.some((e) => e.event === ctx.LIVE_SESSION_EVENTS.LIVE_STARTED),
      "on:recent-has-LIVE_STARTED"
    );
    assert(Array.isArray(snap.recentEvents) && snap.recentEvents.length > 0, "on:recentEvents");

    Panel.unmount();
    assert(ctx.document.body.children.length === 0, "on:unmount-clears");
  }

  console.log("\n--- Static ---\n");
  {
    const panel = fs.readFileSync(path.join(ROOT, "live/live-session-debug-panel.js"), "utf8");
    const bc = fs.readFileSync(path.join(ROOT, "live/live-broadcasts.js"), "utf8");
    assert(panel.includes('if (!isEnabled()) return null'), "static:panel-flag-guard");
    assert(!/ZegoExpressEngine|TlvLiveService|createTlvLiveProvider/.test(panel), "static:panel-no-provider");
    assert(bc.includes("mountSessionDebugPanel"), "static:broadcasts-mount-hook");
    assert(bc.includes("TlvLiveSessionDebugPanel?.refresh"), "static:broadcasts-refresh-hook");
  }

  console.log(`\n=== Result: ${summary.pass} pass, ${summary.fail} fail ===\n`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("ALL PASS\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
