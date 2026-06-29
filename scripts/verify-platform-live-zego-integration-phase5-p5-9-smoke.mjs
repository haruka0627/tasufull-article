#!/usr/bin/env node
/**
 * Platform Live ZEGO Integration — Phase 5 P5-9 smoke (watch URL normalization)
 *
 *   node scripts/verify-platform-live-zego-integration-phase5-p5-9-smoke.mjs
 *   npm run verify:platform-live-zego-integration-phase5-p5-9-smoke
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_MD = path.join(ROOT, "reports/live-platform-zego-phase5-p5-9-watch-url.md");

const results = [];
const failures = [];

function record(id, status, detail = "") {
  results.push({ id, status, detail });
  console.log(`  ${status.padEnd(5)} ${id}${detail ? ` — ${detail}` : ""}`);
}

function pass(id, detail = "") {
  record(id, "PASS", detail);
}

function fail(id, detail = "") {
  record(id, "FAIL", detail);
  failures.push(`${id}${detail ? `: ${detail}` : ""}`);
}

function isSevereConsoleError(text) {
  return !/favicon|404|Failed to load resource|\[TlvPlatformLiveBridge\]|\[TasuLiveBroadcasts\]|\[TasuLiveComments\]|Permissions policy/i.test(
    String(text || ""),
  );
}

function platformLiveFlagInitScript() {
  return ({ on }) => {
    window.TLV_FEATURE_FLAGS = Object.freeze({
      liveSessionManagerEnabled: false,
      usePlatformLive: on === true,
    });
  };
}

function writeReport({ base, verdict }) {
  const lines = [
    "# Platform Live ZEGO — Phase 5 P5-9 watch URL normalization",
    "",
    `**Date:** ${new Date().toISOString().slice(0, 10)}`,
    `**Base URL:** ${base || "n/a"}`,
    `**Verdict:** ${verdict}`,
    "",
    "## Results",
    "",
    ...results.map((r) => `- **${r.status}** \`${r.id}\`${r.detail ? ` — ${r.detail}` : ""}`),
    "",
  ];
  fs.mkdirSync(path.dirname(REPORT_MD), { recursive: true });
  fs.writeFileSync(REPORT_MD, lines.join("\n"), "utf8");
  console.log(`\nReport: ${REPORT_MD}`);
}

async function main() {
  console.log("\n=== Platform Live ZEGO — Phase 5 P5-9 Smoke ===\n");

  let base = "";
  try {
    base = await findDevServerBaseUrl({ probePath: "live/watch.html" });
    pass("dev:8788", base);
  } catch (err) {
    fail("dev:8788", err.message);
    writeReport({ base: "", verdict: "NO-GO" });
    process.exit(1);
  }

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error" && isSevereConsoleError(m.text())) errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    try {
      await page.setViewportSize({ width: 1280, height: 900 });

      const idUrl = buildLocalPageUrl(base, "live/watch.html", "id=stub&talkDev=1");
      await page.goto(idUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("[data-live-watch]", { timeout: 15000 });

      const offState = await page.evaluate(() => ({
        href: location.href,
        normalize: window.__tlvWatchUrlNormalizeLast || null,
        watchId: document.querySelector("[data-live-watch]")?.getAttribute("data-broadcast-id"),
        commentsBackend: document.querySelector("[data-live-comments-root]")?.getAttribute("data-live-comments-backend"),
      }));
      if (offState.href.includes("broadcast_id=stub")) pass("off:id-to-broadcast_id");
      else fail("off:id-to-broadcast_id", offState.href);
      if (!offState.href.includes("id=stub") || offState.href.includes("broadcast_id=stub")) pass("off:legacy-id-handled");
      else fail("off:legacy-id-handled", offState.href);
      if (offState.commentsBackend === "supabase") pass("off:comments-policy-attr");
      else fail("off:comments-policy-attr", String(offState.commentsBackend));

      await page.addInitScript(platformLiveFlagInitScript(), { on: true });
      const camelUrl = buildLocalPageUrl(base, "live/watch.html", "broadcastId=stub&talkDev=1");
      await page.goto(camelUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("[data-live-watch]", { timeout: 15000 });
      await page.waitForFunction(
        () => Boolean(window.TlvPlatformLiveBridge?.getDiagnostics?.()?.adapterReady || window.__tlvWatchUrlNormalizeLast),
        { timeout: 60000 },
      );

      const onState = await page.evaluate(() => ({
        href: location.href,
        normalize: window.__tlvWatchUrlNormalizeLast || null,
        policy: window.__tlvPlatformLiveCommentsPolicy || null,
        diag: window.TlvPlatformLiveBridge?.getDiagnostics?.() || null,
        deferred: document.querySelector("[data-live-comments-root]")?.getAttribute("data-live-platform-chat-deferred"),
      }));
      if (onState.href.includes("broadcast_id=stub")) pass("on:broadcastId-to-broadcast_id");
      else fail("on:broadcastId-to-broadcast_id", onState.href);
      if (onState.normalize?.normalized === true) pass("on:normalize-diagnostics");
      else fail("on:normalize-diagnostics", JSON.stringify(onState.normalize));
      if (onState.policy?.platformChatIntegrated === false) pass("on:chat-deferred-policy");
      else fail("on:chat-deferred-policy", JSON.stringify(onState.policy));
      if (onState.deferred === "true") pass("on:chat-deferred-attr");
      else fail("on:chat-deferred-attr", String(onState.deferred));

      if (errors.length) fail("console-clean", errors.slice(0, 2).join(" | "));
      else pass("console-clean", "0 severe errors");
    } catch (err) {
      fail("smoke", err.message || String(err));
    }
  });
  await closeAllBrowsers();

  const verdict = failures.length === 0 ? "GO" : "NO-GO";
  writeReport({ base, verdict });
  console.log(`\nP5-9 ${verdict}\n`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
