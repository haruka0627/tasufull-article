#!/usr/bin/env node
/**
 * Platform Live ZEGO Integration — Phase 5 P5-9 (watch URL normalization)
 *
 *   node scripts/test-platform-live-zego-integration-phase5-p5-9.mjs
 *   npm run test:platform-live-zego-integration-phase5-p5-9
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BROADCASTS_PATH = "live/live-broadcasts.js";

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
    URLSearchParams,
    document: { createElement: () => ({ setAttribute() {}, appendChild() {} }), querySelector: () => null },
    TLV_FEATURE_FLAGS: {
      usePlatformLive: options.usePlatformLive === true,
      liveSessionManagerEnabled: false,
    },
    TasuLiveConfig: {
      escapeHtml: (s) => String(s),
      LIVE_STREAM_PROVIDER_DEFAULT: "stub",
    },
    history: options.history || { replaceState() {} },
    location: options.location || { pathname: "/live/watch.html", search: "", hash: "" },
    window: {},
    globalThis: {},
  });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(read(BROADCASTS_PATH), ctx);
  return ctx;
}

function run() {
  console.log("\n=== Platform Live ZEGO Integration — Phase 5 P5-9 ===\n");

  const src = read(BROADCASTS_PATH);

  console.log("--- P5-9 guardrails ---\n");
  assert(/parseWatchBroadcastIdFromParams/.test(src), "static:parse-fn");
  assert(/buildCanonicalWatchSearch/.test(src), "static:canonical-search");
  assert(/maybeNormalizeWatchUrlInHistory/.test(src), "static:history-normalize");
  assert(/broadcastId/.test(src) && /broadcast_id/.test(src), "static:alias-keys");

  console.log("\n--- parse priority ---\n");
  {
    const ctx = loadBroadcastsRuntime();
    const b = ctx.TasuLiveBroadcasts;
    assert(
      b.parseWatchBroadcastIdFromParams("broadcast_id=bc1&id=bc2").id === "bc1",
      "parse:broadcast_id-wins",
    );
    assert(b.parseWatchBroadcastIdFromParams("id=legacy").id === "legacy", "parse:id-fallback");
    assert(b.parseWatchBroadcastIdFromParams("broadcastId=camel").id === "camel", "parse:broadcastId-fallback");
    assert(b.parseWatchBroadcastIdFromParams("").id === "", "parse:empty");
  }

  console.log("\n--- canonical search ---\n");
  {
    const ctx = loadBroadcastsRuntime();
    const qs = ctx.TasuLiveBroadcasts.buildCanonicalWatchSearch("bc-can", "id=legacy&talkDev=1");
    const p = new URLSearchParams(qs);
    assert(p.get("broadcast_id") === "bc-can", "canonical:broadcast_id-set");
    assert(!p.get("id"), "canonical:id-removed");
    assert(!p.get("broadcastId"), "canonical:broadcastId-removed");
    assert(p.get("talkDev") === "1", "canonical:preserves-other-params");
  }

  console.log("\n--- history normalize non-fatal ---\n");
  {
    let replaced = "";
    const ctx = loadBroadcastsRuntime({
      history: {
        replaceState(_s, _t, url) {
          replaced = url;
        },
      },
      location: { pathname: "/live/watch.html", search: "?id=stub&talkDev=1", hash: "" },
    });
    const res = ctx.TasuLiveBroadcasts.maybeNormalizeWatchUrlInHistory("stub", { source: "id" });
    assert(res.normalized === true, "normalize:ok");
    assert(replaced.includes("broadcast_id=stub"), "normalize:url-updated");
    const replacedParams = new URLSearchParams(replaced.split("?")[1] || "");
    assert(replacedParams.get("broadcast_id") === "stub", "normalize:broadcast_id-set");
    assert(!replacedParams.get("id"), "normalize:id-stripped");
  }

  console.log("\n--- already canonical skip ---\n");
  {
    let calls = 0;
    const ctx = loadBroadcastsRuntime({
      history: {
        replaceState() {
          calls += 1;
        },
      },
    });
    const res = ctx.TasuLiveBroadcasts.maybeNormalizeWatchUrlInHistory("stub", { source: "broadcast_id" });
    assert(res.skipped === true, "canonical:skip");
    assert(calls === 0, "canonical:no-replace");
  }

  console.log("\n--- P5-7 policy guard (light) ---\n");
  {
    const ctx = loadBroadcastsRuntime({ usePlatformLive: true });
    const el = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
    const policy = ctx.TasuLiveBroadcasts.applyPlatformLiveCommentsPolicy(el);
    assert(policy.watchCommentsBackend === "supabase", "p57:supabase-backend");
    assert(policy.platformChatIntegrated === false, "p57:chat-not-integrated");
    assert(el.attrs["data-live-comments-backend"] === "supabase", "p57:data-attr");
    assert(el.attrs["data-live-platform-chat-deferred"] === "true", "p57:deferred-attr");
  }

  console.log(`\n=== P5-9 ${summary.fail === 0 ? "GO" : "NO-GO"} — ${summary.pass} PASS / ${summary.fail} FAIL ===\n`);
  if (failures.length) {
    console.log(failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
}

run();
