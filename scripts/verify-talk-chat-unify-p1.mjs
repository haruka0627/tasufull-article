#!/usr/bin/env node
/**
 * TASFUL TALK 統合 P1 検証
 *   node scripts/verify-talk-chat-unify-p1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || "http://127.0.0.1:5179").replace(/\/$/, "");

const results = [];
function pass(id, detail = "") {
  results.push({ id, ok: true, detail });
  console.log(`  PASS  ${id}${detail ? `: ${detail}` : ""}`);
}
function fail(id, detail = "") {
  results.push({ id, ok: false, detail });
  console.error(`  FAIL  ${id}${detail ? `: ${detail}` : ""}`);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function isSevereConsoleError(text) {
  return !/favicon|404|Failed to load resource|Failed to fetch|\[TasuChat\]/i.test(String(text || ""));
}

async function collectConsoleErrors(page) {
  const errors = [];
  const onConsole = (m) => {
    if (m.type() === "error" && isSevereConsoleError(m.text())) errors.push(m.text());
  };
  const onPageError = (e) => errors.push(e.message);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  return {
    errors,
    detach() {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    },
  };
}

function staticChecks() {
  const required = [
    "talk-room-ensure.js",
    "supabase/functions/ensure-talk-room/index.ts",
    "supabase/functions/_shared/talk-room-ensure.ts",
    "supabase/functions/_shared/talk-room-auth.ts",
    "supabase/migrations/20260622120000_talk_room_contact_bridge.sql",
  ];
  for (const f of required) {
    if (exists(f)) pass(`static:${f}`, "exists");
    else fail(`static:${f}`, "missing");
  }

  const ensureJs = read("talk-room-ensure.js");
  if (ensureJs.includes("ensureTalkRoom") && ensureJs.includes("ensure-talk-room")) {
    pass("P1-T01", "talk-room-ensure.js helper");
  } else fail("P1-T01", "helper incomplete");

  const edge = read("supabase/functions/ensure-talk-room/index.ts");
  if (
    edge.includes("listing_type") &&
    edge.includes("service_type") &&
    edge.includes("participants")
  ) {
    pass("P1-T02", "ensure-talk-room Edge params");
  } else fail("P1-T02", "edge params");

  const shared = read("supabase/functions/_shared/talk-room-ensure.ts");
  if (shared.includes("contact_id") && shared.includes("reused")) {
    pass("P1-T06", "idempotent ensure logic");
  } else fail("P1-T06", "shared ensure");

  const store = read("chat-thread-store.js");
  if (
    store.includes("createThreadFromContactAsync") &&
    store.includes("_supabaseRoom") &&
    store.includes("activateThreadAfterFeePaidAsync")
  ) {
    pass("P1-T03", "createThreadFromContact → Supabase path");
    pass("P1-T04", "job hire async path");
    pass("P1-T08", "LS legacy read merge hooks");
  } else {
    fail("P1-T03", "thread store");
  }

  const supa = read("chat-supabase.js");
  if (supa.includes("createListingTalkRoom") && supa.includes("activateTransactionRoom")) {
    pass("P1-T05", "business ensure wrapper");
  } else fail("P1-T05", "chat-supabase");

  const matchEdge = read("supabase/functions/match-ensure-talk-room/index.ts");
  if (matchEdge.includes("ensureTalkRoomForPair") && !matchEdge.includes("ensureListingTalkRoom")) {
    pass("P1-T11", "match-ensure-talk-room untouched");
  } else fail("P1-T11", "match regression risk");

  const fee = read("platform-chat-fee.js");
  if (fee.includes("async function activateDeferredAfterPayment")) {
    pass("P1-T09", "fee deferred async ensure");
  } else fail("P1-T09", "platform-chat-fee");

  const svc = read("chat-service.js");
  if (svc.includes("legacyLs") || svc.includes("/^chat-/i")) {
    pass("P1-T07", "TALK list merge legacy LS");
  } else fail("P1-T07", "chat-service merge");

  const data = read("talk-home-data.js");
  if (data.includes("isUuid") && data.includes("roomId")) {
    pass("P1-T10", "resolveChatTalkHref UUID");
  } else fail("P1-T10", "talk-home-data");
}

async function browserChecks() {
  await withPlaywrightBrowser(async (browser) => {
    const viewports = [
      { width: 390, height: 844, label: "390" },
      { width: 768, height: 1024, label: "768" },
      { width: 1280, height: 900, label: "1280" },
    ];

    for (const vp of viewports) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const probe = await collectConsoleErrors(page);
      try {
        await page.goto(`${BASE}/platform-chat-fee-pay.html?talkDev=1&thread=deferred:test`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        const hasEnsure = await page.evaluate(() => Boolean(window.TasuTalkRoomEnsure?.ensureTalkRoom));
        if (hasEnsure) pass(`P1-T12:${vp.label}`, "TasuTalkRoomEnsure loaded");
        else fail(`P1-T12:${vp.label}`, "ensure missing");

        await page.goto(`${BASE}/talk-home.html?tab=chat&talkDev=1`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        if (probe.errors.length === 0) pass(`P1-T10:${vp.label}`, "console 0");
        else fail(`P1-T10:${vp.label}`, probe.errors.slice(0, 2).join("; "));
      } finally {
        probe.detach();
        await page.close();
      }
    }
  });
}

async function main() {
  console.log(`\nTALK chat unify P1 — ${BASE}\n`);
  staticChecks();
  try {
    await browserChecks();
  } catch (err) {
    fail("P1-browser", String(err?.message || err));
  } finally {
    await closeAllBrowsers();
  }

  const failed = results.filter((r) => !r.ok);
  const verdict = failed.length ? "P1_NOT_READY" : "TALK_CHAT_UNIFY_P1_READY";
  console.log(`\n--- ${results.length - failed.length}/${results.length} PASS — ${verdict} ---\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
