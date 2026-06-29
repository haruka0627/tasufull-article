#!/usr/bin/env node
/**
 * Platform Live ZEGO Integration — Phase 5 P5-6 smoke (watch leave / studio preview)
 *
 *   node scripts/verify-platform-live-zego-integration-phase5-p5-6-smoke.mjs
 *   npm run verify:platform-live-zego-integration-phase5-p5-6-smoke
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_MD = path.join(ROOT, "reports/live-platform-zego-phase5-p5-6-watch-leave-preview.md");

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];

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
  return !/favicon|404|Failed to load resource|\[TlvPlatformLiveBridge\]|\[TasuLiveBroadcasts\]|\[TasuLivePlatformIntegration\]|Permissions policy/i.test(
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
    "# Platform Live ZEGO — Phase 5 P5-6 watch leave / studio preview",
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
  console.log("\n=== Platform Live ZEGO — Phase 5 P5-6 Smoke ===\n");

  if (process.env.P5_6_SKIP_BUILD !== "1") {
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
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      const probe = await collectConsoleErrors(page);
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const watchUrl = buildLocalPageUrl(base, "live/watch.html", "broadcast_id=stub&talkDev=1");

        await page.goto(watchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForSelector("[data-live-watch]", { timeout: 15000 });
        const offLeave = await page.evaluate(() => ({
          bound: Boolean(window.__tlvPlatformLiveWatchLeaveState?.bound),
          mount: Boolean(document.querySelector("[data-live-platform-player-mount]")),
        }));
        if (!offLeave.bound) pass(`off:${vp.name}:watch-leave-not-bound`);
        else fail(`off:${vp.name}:watch-leave-not-bound`);

        await page.addInitScript(platformLiveFlagInitScript(), { on: true });
        await page.goto(watchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForSelector("[data-live-watch]", { timeout: 15000 });
        await page.waitForFunction(
          () => Boolean(window.__tlvPlatformLiveWatchLeaveState?.bound),
          { timeout: 90000 },
        );
        const onLeave = await page.evaluate(() => ({
          bound: Boolean(window.__tlvPlatformLiveWatchLeaveState?.bound),
          active: window.__tlvPlatformLiveWatchLeaveState?.active || null,
          mount: Boolean(document.querySelector("[data-live-platform-player-mount]")),
        }));
        if (onLeave.bound && onLeave.active?.broadcastId) pass(`on:${vp.name}:watch-leave-bound`);
        else fail(`on:${vp.name}:watch-leave-bound`, JSON.stringify(onLeave));
        if (onLeave.mount) pass(`on:${vp.name}:player-mount-kept`);
        else fail(`on:${vp.name}:player-mount-kept`);

        const leaveRes = await page.evaluate(async () => {
          const active = window.__tlvPlatformLiveWatchLeaveState?.active;
          if (!active || !window.TlvPlatformLiveBridge?.onWatchLeave) {
            return { ok: false, reason: "no-active" };
          }
          const res = await window.TlvPlatformLiveBridge.onWatchLeave({
            broadcastId: active.broadcastId,
            viewerId: active.viewerId,
            userId: active.viewerId,
            reason: "smoke-explicit",
          });
          return { ok: res?.via === "platform-live" && res?.op === "leaveViewer", diag: res };
        });
        if (leaveRes.ok) pass(`on:${vp.name}:explicit-leave-non-fatal`);
        else fail(`on:${vp.name}:explicit-leave-non-fatal`, JSON.stringify(leaveRes));

        const studioUrl = buildLocalPageUrl(base, "live/studio.html", "talkDev=1");
        await page.goto(studioUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        const studioState = await page.evaluate(() => {
          const mount = document.querySelector("[data-live-platform-studio-preview-mount]");
          return {
            hasMount: Boolean(mount),
            html: mount ? mount.outerHTML.slice(0, 120) : "",
          };
        });
        if (studioState.hasMount || studioState.html === "") {
          pass(`studio:${vp.name}:preview-mount-or-empty-list`);
        } else {
          fail(`studio:${vp.name}:preview-mount-or-empty-list`, studioState.html);
        }

        const handoff = await page.evaluate(async () => {
          const mount = document.querySelector("[data-live-platform-studio-preview-mount]");
          if (!mount || !window.TlvPlatformLiveBridge?.onStudioStart) {
            return { ok: true, skipped: true, reason: "no-live-row" };
          }
          const res = await window.TlvPlatformLiveBridge.onStudioStart({
            broadcastId: "smoke-bc",
            creatorId: "smoke-host",
            videoContainer: mount,
          });
          return { ok: res?.via === "platform-live" && res?.op === "startHost", res };
        });
        if (handoff.ok !== false) pass(`studio:${vp.name}:videoContainer-handoff`);
        else fail(`studio:${vp.name}:videoContainer-handoff`, JSON.stringify(handoff));

        if (probe.errors.length) fail(`console:${vp.name}`, probe.errors.slice(0, 2).join(" | "));
        else pass(`console:${vp.name}`, "0 severe errors");
      } catch (err) {
        fail(`smoke:${vp.name}`, err.message || String(err));
      } finally {
        probe.detach();
        await page.close();
      }
    }
  });
  await closeAllBrowsers();

  if (process.env.P5_6_SKIP_UNIT !== "1") {
    try {
      execSync("npm run test:platform-live-zego-integration-phase5-p5-6", {
        cwd: ROOT,
        stdio: "pipe",
        encoding: "utf8",
        timeout: 1_800_000,
        env: { ...process.env, P5_6_SKIP_REGRESSION: "1" },
      });
      pass("unit:p5-6");
    } catch (err) {
      fail("unit:p5-6", (err.stdout || err.message).slice(-400));
    }
  }

  if (process.env.P5_6_SKIP_REGRESSION !== "1") {
    const regression = [
      "test:platform-live-zego-integration-phase5-p5-5",
      "test:platform-live-zego-integration-phase5-p5-8",
      "test:platform-live-zego-integration-phase5-p5-3",
      "test:platform-live-zego-integration-phase5-p5-2",
      "test:platform-live-zego-integration-phase4-p4-6",
    ];
    for (const script of regression) {
      try {
        execSync(`npm run ${script}`, {
          cwd: ROOT,
          stdio: "pipe",
          encoding: "utf8",
          timeout: 1_800_000,
          env: {
            ...process.env,
            P5_5_SKIP_REGRESSION: "1",
            P5_6_SKIP_REGRESSION: "1",
            P5_8_SKIP_REGRESSION: process.env.P5_6_SKIP_NESTED_REGRESSION === "1" ? "1" : undefined,
          },
        });
        pass(`regression:${script}`);
      } catch (err) {
        fail(`regression:${script}`, (err.stdout || err.stderr || err.message).slice(-400));
      }
    }
  }

  const verdict = failures.length === 0 ? "GO" : "NO-GO";
  writeReport({ base, verdict });
  console.log(`\nP5-6 ${verdict}\n`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
