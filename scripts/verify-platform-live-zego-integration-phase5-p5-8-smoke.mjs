#!/usr/bin/env node
/**
 * Platform Live ZEGO Integration — Phase 5 P5-8 smoke (renderStreamPlayer)
 *
 *   node scripts/verify-platform-live-zego-integration-phase5-p5-8-smoke.mjs
 *   npm run verify:platform-live-zego-integration-phase5-p5-8-smoke
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_MD = path.join(ROOT, "reports/live-platform-zego-phase5-p5-8-render-stream-player.md");

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
  return !/favicon|404|Failed to load resource|\[TlvPlatformLiveBridge\]|\[TasuLiveBroadcasts\]|Permissions policy/i.test(
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

async function collectConsoleErrors(page) {
  const errors = [];
  const onConsole = (m) => {
    if (m.type() === "error" && isSevereConsoleError(m.text())) errors.push(m.text());
  };
  page.on("console", onConsole);
  page.on("pageerror", (e) => errors.push(e.message));
  return {
    errors,
    detach() {
      page.off("console", onConsole);
    },
  };
}

function writeReport({ base, verdict }) {
  const lines = [
    "# Platform Live ZEGO — Phase 5 P5-8 renderStreamPlayer",
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
  console.log("\n=== Platform Live ZEGO — Phase 5 P5-8 Smoke ===\n");

  if (process.env.P5_8_SKIP_BUILD !== "1") {
    try {
      execSync("npm run build:pages", { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
      pass("build:pages");
    } catch (err) {
      fail("build:pages", err.stderr?.slice(-300) || err.message);
    }
  } else {
    pass("build:pages", "skipped");
  }

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
    const probe = await collectConsoleErrors(page);
    try {
      await page.setViewportSize({ width: 1280, height: 900 });

      const watchOff = buildLocalPageUrl(base, "live/watch.html", "broadcast_id=stub&talkDev=1");
      await page.goto(watchOff, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("[data-live-watch]", { timeout: 15000 });
      const offState = await page.evaluate(() => ({
        placeholder: Boolean(document.querySelector("[data-live-watch-placeholder]")),
        mount: Boolean(document.querySelector("[data-live-platform-player-mount]")),
      }));
      if (offState.placeholder && !offState.mount) pass("off:stub-placeholder");
      else fail("off:stub-placeholder", JSON.stringify(offState));

      await page.addInitScript(platformLiveFlagInitScript(), { on: true });
      await page.goto(watchOff, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("[data-live-watch]", { timeout: 15000 });

      await page.waitForFunction(
        () =>
          Boolean(document.querySelector("[data-live-platform-player-video]")) ||
          Boolean(document.querySelector("[data-live-platform-player-fallback]")),
        { timeout: 90000 },
      );

      const onState = await page.evaluate(() => ({
        mount: Boolean(document.querySelector("[data-live-platform-player-mount]")),
        video: Boolean(document.querySelector("[data-live-platform-player-video]")),
        placeholder: Boolean(document.querySelector("[data-live-watch-placeholder]")),
        diag: window.TlvPlatformLiveBridge?.getDiagnostics?.() || null,
      }));
      if (onState.mount) pass("on:player-mount");
      else fail("on:player-mount");
      if (onState.video) pass("on:player-video-element");
      else fail("on:player-video-element");
      if (!onState.placeholder) pass("on:no-stub-placeholder");
      else fail("on:no-stub-placeholder");
      if (onState.diag?.lastResult?.op === "joinViewer") pass("on:joinViewer-diagnostics");
      else fail("on:joinViewer-diagnostics", JSON.stringify(onState.diag?.lastResult));

      if (probe.errors.length) fail("console-clean", probe.errors.slice(0, 2).join(" | "));
      else pass("console-clean", "0 severe errors");
    } catch (err) {
      fail("smoke", err.message || String(err));
    } finally {
      probe.detach();
    }
  });
  await closeAllBrowsers();

  if (process.env.P5_8_SKIP_REGRESSION !== "1") {
    try {
      execSync("npm run test:platform-live-zego-integration-phase5-p5-8", {
        cwd: ROOT,
        stdio: "pipe",
        encoding: "utf8",
        timeout: 1_800_000,
      });
      pass("regression:p5-8");
    } catch (err) {
      fail("regression:p5-8", (err.stdout || err.message).slice(-400));
    }
  }

  const verdict = failures.length === 0 ? "GO" : "NO-GO";
  writeReport({ base, verdict });
  console.log(`\nP5-8 ${verdict}\n`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
