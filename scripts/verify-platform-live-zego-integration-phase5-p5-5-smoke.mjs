#!/usr/bin/env node
/**
 * Platform Live ZEGO Integration — Phase 5 P5-5 smoke (ZEGO provider lazy load)
 *
 *   node scripts/verify-platform-live-zego-integration-phase5-p5-5-smoke.mjs
 *   npm run verify:platform-live-zego-integration-phase5-p5-5-smoke
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_MD = path.join(ROOT, "reports/live-platform-zego-phase5-p5-5-zego-lazy-load.md");

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
    "# Platform Live ZEGO — Phase 5 P5-5 ZEGO provider lazy load",
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
  console.log("\n=== Platform Live ZEGO — Phase 5 P5-5 Smoke ===\n");

  if (process.env.P5_5_SKIP_BUILD !== "1") {
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
        const offState = await page.evaluate(() => ({
          tlvZego: typeof window.TlvZegoLiveProvider,
          zegoAdapter: typeof window.ZegoLiveProviderAdapter,
          bridge: typeof window.TlvPlatformLiveBridge,
        }));
        if (offState.tlvZego === "undefined" && offState.zegoAdapter === "undefined") {
          pass(`off:${vp.name}:zego-not-loaded`);
        } else {
          fail(`off:${vp.name}:zego-not-loaded`, JSON.stringify(offState));
        }

        await page.addInitScript(platformLiveFlagInitScript(), { on: true });
        await page.goto(watchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForSelector("[data-live-watch]", { timeout: 15000 });

        await page.waitForFunction(
          () => {
            const diag = window.TlvPlatformLiveBridge?.getDiagnostics?.();
            return Boolean(diag?.zegoProviderLoad) || Boolean(diag?.adapterReady);
          },
          { timeout: 90000 },
        );

        await page.waitForFunction(
          () =>
            Boolean(document.querySelector("[data-live-platform-player-mount]")) ||
            Boolean(document.querySelector("[data-live-platform-player-fallback]")) ||
            Boolean(document.querySelector("[data-live-watch-placeholder]")),
          { timeout: 60000 },
        );

        const onState = await page.evaluate(() => ({
          tlvZego: typeof window.TlvZegoLiveProvider,
          zegoAdapter: typeof window.ZegoLiveProviderAdapter,
          mount: Boolean(document.querySelector("[data-live-platform-player-mount]")),
          video: Boolean(document.querySelector("[data-live-platform-player-video]")),
          diag: window.TlvPlatformLiveBridge?.getDiagnostics?.() || null,
        }));

        if (onState.tlvZego === "function" && onState.zegoAdapter === "function") {
          pass(`on:${vp.name}:zego-lazy-loaded`);
        } else {
          fail(`on:${vp.name}:zego-lazy-loaded`, JSON.stringify(onState));
        }
        if (onState.diag?.zegoProviderReady === true) pass(`on:${vp.name}:zego-provider-ready-diag`);
        else fail(`on:${vp.name}:zego-provider-ready-diag`, JSON.stringify(onState.diag?.zegoProviderLoad));
        if (onState.diag?.providerId === "zego") pass(`on:${vp.name}:providerId-zego`);
        else fail(`on:${vp.name}:providerId-zego`, String(onState.diag?.providerId));
        if (onState.mount || onState.video) pass(`on:${vp.name}:player-mount-surface`);
        else fail(`on:${vp.name}:player-mount-surface`);

        const studioUrl = buildLocalPageUrl(base, "live/studio.html", "talkDev=1");
        await page.goto(studioUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        const studioDiag = await page.evaluate(async () => {
          const bridge = window.TlvPlatformLiveBridge;
          if (!bridge?.onStudioStart) return { ok: false, reason: "no-bridge" };
          const res = await bridge.onStudioStart({
            roomId: "studio-p5-5",
            creatorId: "host-p5-5",
            broadcastId: "bc-studio-p5-5",
          });
          return {
            ok: res?.via === "platform-live" && res?.op === "startHost",
            diag: bridge.getDiagnostics?.() || null,
          };
        });
        if (studioDiag.ok) pass(`studio:${vp.name}:onStudioStart-non-fatal`);
        else fail(`studio:${vp.name}:onStudioStart-non-fatal`, JSON.stringify(studioDiag));
        if (studioDiag.diag?.zegoProviderReady === true) pass(`studio:${vp.name}:zego-ready`);
        else fail(`studio:${vp.name}:zego-ready`, JSON.stringify(studioDiag.diag?.zegoProviderLoad));

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

  if (process.env.P5_5_SKIP_UNIT !== "1") {
    try {
      execSync("npm run test:platform-live-zego-integration-phase5-p5-5", {
        cwd: ROOT,
        stdio: "pipe",
        encoding: "utf8",
        timeout: 1_800_000,
        env: { ...process.env, P5_5_SKIP_REGRESSION: "1" },
      });
      pass("unit:p5-5");
    } catch (err) {
      fail("unit:p5-5", (err.stdout || err.message).slice(-400));
    }
  }

  if (process.env.P5_5_SKIP_REGRESSION !== "1") {
    const regression = [
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
        });
        pass(`regression:${script}`);
      } catch (err) {
        fail(`regression:${script}`, (err.stdout || err.stderr || err.message).slice(-400));
      }
    }

    if (process.env.P5_5_SKIP_P5_4_SMOKE !== "1") {
      try {
        execSync("npm run verify:platform-live-zego-integration-phase5-p5-4-smoke", {
          cwd: ROOT,
          stdio: "pipe",
          encoding: "utf8",
          timeout: 1_800_000,
          env: {
            ...process.env,
            P5_4_SKIP_BUILD: "1",
            P5_4_SKIP_REGRESSION: "1",
            P5_4_SKIP_E2E: process.env.P5_5_SKIP_P5_4_E2E === "1" ? "1" : process.env.P5_4_SKIP_E2E,
          },
        });
        pass("regression:p5-4-smoke");
      } catch (err) {
        fail("regression:p5-4-smoke", (err.stdout || err.message).slice(-400));
      }
    }
  }

  const verdict = failures.length === 0 ? "GO" : "NO-GO";
  writeReport({ base, verdict });
  console.log(`\nP5-5 ${verdict}\n`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
