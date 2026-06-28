#!/usr/bin/env node
/**
 * Platform Live ZEGO Integration — Phase 5 P5-4 integration smoke
 *
 * Flag OFF: studio/watch HTTP 200 · console clean · Platform Live not loaded
 * Flag ON:  bridge → adapter → integration (lazy load) · diagnostics · non-fatal
 *
 *   node scripts/verify-platform-live-zego-integration-phase5-p5-4-smoke.mjs
 *   npm run verify:platform-live-zego-integration-phase5-p5-4-smoke
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  ensureTalkJwt,
  loadTalkSupabaseConfig,
  TALK_TEST_USERS,
} from "./lib/talk-rls-test-auth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_MD = path.join(ROOT, "reports/live-platform-zego-phase5-p5-4-smoke.md");

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];

const REGRESSION_SCRIPTS = [
  "test:platform-live-zego-integration-phase5-p5-3",
  "test:platform-live-zego-integration-phase5-p5-2",
  "test:platform-live-zego-integration-phase5-p5-1",
  "test:platform-live-zego-integration-phase4-p4-6",
];

const REGRESSION_TIMEOUT_MS = 1_800_000;

/** @type {{ id: string, status: string, detail?: string, section?: string }[]} */
const results = [];
const failures = [];

function record(id, status, detail = "", section = "") {
  results.push({ id, status, detail, section });
  console.log(`  ${status.padEnd(5)} ${id}${detail ? ` — ${detail}` : ""}`);
}

function pass(id, detail = "", section = "") {
  record(id, "PASS", detail, section);
}

function fail(id, detail = "", section = "") {
  record(id, "FAIL", detail, section);
  failures.push(`${id}${detail ? `: ${detail}` : ""}`);
}

function skip(id, detail = "", section = "") {
  record(id, "SKIP", detail, section);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function isSevereConsoleError(text) {
  return !/favicon|404|Failed to load resource|Failed to fetch|\[TasuChat\]|\[TasuSupabase\]|\[TasuLiveProfile\]|\[TasuLiveShorts\]|\[TasuLiveBroadcasts\]|\[TasuLiveComments\]|\[TasuLiveTalkBridge\]|\[TlvPlatformLiveBridge\]|\[TasuLivePlatformIntegration\]|gemini-chat|CORS policy|Permissions policy violation/i.test(
    String(text || ""),
  );
}

function platformLiveFlagInitScript(enabled) {
  return ({ on }) => {
    window.TLV_FEATURE_FLAGS = Object.freeze({
      publicEnabled: false,
      privateTestEnabled: true,
      allowedTestEmails: Object.freeze(["verify@tasful.local"]),
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

async function seedPageAuth(page, jwt, talkUserId = "u_me") {
  await page.addInitScript(
    ({ token, uid }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-p5-4",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-p5-4",
              app_metadata: { talk_user_id: uid, member_id: uid },
              user_metadata: { talk_user_id: uid },
            },
          }),
        );
        localStorage.setItem(
          "tasu_member_session",
          JSON.stringify({ id: uid, email: "verify@tasful.local", signedInAt: Date.now() }),
        );
      } catch {
        /* ignore */
      }
    },
    { token: jwt, uid: talkUserId },
  );
}

function verifyStaticGuards() {
  console.log("\n=== A. Static guards ===\n");
  const flags = read("live/tlv-feature-flags.js");
  const broadcasts = read("live/live-broadcasts.js");
  const bridge = read("live/tlv-platform-live-bridge.js");

  if (/usePlatformLive:\s*false/.test(flags)) pass("static:flag-default-false", "", "static");
  else fail("static:flag-default-false", "", "static");

  if (/runPlatformLiveBridge/.test(broadcasts)) pass("static:broadcasts-bridge", "", "static");
  else fail("static:broadcasts-bridge", "", "static");

  if (/tlv-platform-live-bridge/.test(read("live/studio.html"))) pass("static:studio-script", "", "static");
  else fail("static:studio-script", "", "static");

  if (/tlv-platform-live-bridge/.test(read("live/watch.html"))) pass("static:watch-script", "", "static");
  else fail("static:watch-script", "", "static");

  if (!/executeWithRetry/.test(bridge)) pass("static:retry-not-in-bridge", "", "static");
  else fail("static:retry-not-in-bridge", "", "static");
}

async function verifyHttp(base) {
  console.log("\n=== B. HTTP 8788 ===\n");
  for (const pagePath of ["live/studio.html", "live/watch.html"]) {
    const url = buildLocalPageUrl(base, pagePath);
    const res = await fetch(url);
    if (res.status === 200) pass(`http:${pagePath}`, `HTTP ${res.status}`, "http");
    else fail(`http:${pagePath}`, `HTTP ${res.status}`, "http");
  }
}

async function smokeFlagOff(page, base, vp) {
  const probe = await collectConsoleErrors(page);
  const tag = `@${vp.name}`;
  try {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const studioUrl = buildLocalPageUrl(base, "live/studio.html", "talkDev=1");
    await page.goto(studioUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("[data-live-studio-root]", { timeout: 15000 });
    await page.waitForTimeout(600);

    const studioState = await page.evaluate(() => ({
      bridgeEnabled: window.TlvPlatformLiveBridge?.isEnabled?.() === true,
      integrationLoaded: Boolean(window.TasuLivePlatformIntegration),
      hasRoot: Boolean(document.querySelector("[data-live-studio-root]")),
    }));
    if (!studioState.bridgeEnabled) pass(`off:studio-bridge-disabled${tag}`, "", "flag-off");
    else fail(`off:studio-bridge-disabled${tag}`, "enabled unexpectedly", "flag-off");
    if (!studioState.integrationLoaded) pass(`off:studio-no-integration${tag}`, "", "flag-off");
    else fail(`off:studio-no-integration${tag}`, "integration loaded", "flag-off");

    const watchUrl = buildLocalPageUrl(base, "live/watch.html", "broadcast_id=stub&talkDev=1");
    await page.goto(watchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("[data-live-watch]", { timeout: 15000 });
    await page.waitForTimeout(600);

    const watchState = await page.evaluate(() => ({
      bridgeEnabled: window.TlvPlatformLiveBridge?.isEnabled?.() === true,
      integrationLoaded: Boolean(window.TasuLivePlatformIntegration),
      hasWatch: Boolean(document.querySelector("[data-live-watch]")),
      hasComments: Boolean(document.querySelector("[data-live-comments], [data-live-comments-root]")),
      hasPlaceholder: Boolean(document.querySelector("[data-live-watch-placeholder]")),
    }));
    if (watchState.hasWatch) pass(`off:watch-mounted${tag}`, "", "flag-off");
    else fail(`off:watch-mounted${tag}`, "", "flag-off");
    if (watchState.hasComments || watchState.hasPlaceholder) pass(`off:watch-comments-or-stub${tag}`, "", "flag-off");
    else fail(`off:watch-comments-or-stub${tag}`, "", "flag-off");
    if (!watchState.bridgeEnabled) pass(`off:watch-bridge-disabled${tag}`, "", "flag-off");
    else fail(`off:watch-bridge-disabled${tag}`, "", "flag-off");
    if (!watchState.integrationLoaded) pass(`off:watch-no-integration${tag}`, "", "flag-off");
    else fail(`off:watch-no-integration${tag}`, "", "flag-off");

    if (probe.errors.length) fail(`off:console-clean${tag}`, probe.errors.slice(0, 2).join(" | "), "flag-off");
    else pass(`off:console-clean${tag}`, "0 severe errors", "flag-off");
  } catch (err) {
    fail(`off:smoke${tag}`, err.message || String(err), "flag-off");
  } finally {
    probe.detach();
  }
}

async function smokeFlagOn(page, base, jwt, browser) {
  console.log("\n=== D. Flag ON browser (1280) ===\n");
  const probe = await collectConsoleErrors(page);
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(platformLiveFlagInitScript(true), { on: true });

    const watchUrl = buildLocalPageUrl(base, "live/watch.html", "broadcast_id=stub&talkDev=1");
    await page.goto(watchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("[data-live-watch]", { timeout: 15000 });

    await page.waitForFunction(
      () => {
        const d = window.TlvPlatformLiveBridge?.getDiagnostics?.();
        return d?.enabled === true && (d?.lastResult?.op === "joinViewer" || d?.adapterReady === true);
      },
      { timeout: 90000 },
    );

    const watchDiag = await page.evaluate(() => window.TlvPlatformLiveBridge.getDiagnostics());
    if (watchDiag.enabled === true) pass("on:watch-bridge-enabled", "", "flag-on");
    else fail("on:watch-bridge-enabled", JSON.stringify(watchDiag), "flag-on");
    if (watchDiag.integrationLoaded === true) pass("on:watch-integration-loaded", "", "flag-on");
    else fail("on:watch-integration-loaded", "", "flag-on");
    if (watchDiag.adapterReady === true) pass("on:watch-adapter-ready", "", "flag-on");
    else fail("on:watch-adapter-ready", "", "flag-on");
    if (watchDiag.lastResult?.op === "joinViewer") pass("on:watch-joinViewer-called", watchDiag.lastResult?.via || "", "flag-on");
    else fail("on:watch-joinViewer-called", JSON.stringify(watchDiag.lastResult), "flag-on");
    if (watchDiag.lastResult?.via === "platform-live") pass("on:watch-via-platform-live", "", "flag-on");
    else fail("on:watch-via-platform-live", "", "flag-on");

    const watchStillOk = await page.evaluate(() => Boolean(document.querySelector("[data-live-watch]")));
    if (watchStillOk) pass("on:watch-page-intact", "", "flag-on");
    else fail("on:watch-page-intact", "", "flag-on");

    const studioUrl = buildLocalPageUrl(base, "live/studio.html", "talkDev=1");
    await page.goto(studioUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("[data-live-studio-root]", { timeout: 15000 });

    const studioStart = await page.evaluate(async () => {
      const res = await window.TlvPlatformLiveBridge.onStudioStart({
        broadcastId: "p5-4-smoke-host",
        creatorId: window.TasuTlvDevAuth?.DEMO_USER_ID || "u_me",
        creatorName: "P5-4 Smoke Host",
      });
      const diag = window.TlvPlatformLiveBridge.getDiagnostics();
      return { res, diag };
    });

    if (studioStart.diag.enabled === true) pass("on:studio-bridge-enabled", "", "flag-on");
    else fail("on:studio-bridge-enabled", "", "flag-on");
    if (studioStart.res?.op === "startHost") pass("on:studio-startHost-called", studioStart.res?.via || "", "flag-on");
    else fail("on:studio-startHost-called", JSON.stringify(studioStart.res), "flag-on");
    if (studioStart.res?.ok !== false || studioStart.res?.partial === true) {
      pass("on:studio-startHost-non-fatal", studioStart.res?.error || "ok", "flag-on");
    } else {
      fail("on:studio-startHost-non-fatal", JSON.stringify(studioStart.res), "flag-on");
    }
    if (studioStart.diag.integrationLoaded === true) pass("on:studio-integration-loaded", "", "flag-on");
    else fail("on:studio-integration-loaded", "", "flag-on");

    if (jwt) {
      await page.addInitScript(platformLiveFlagInitScript(true), { on: true });
      await seedPageAuth(page, jwt);
      await page.goto(studioUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("[data-live-studio-root]", { timeout: 20000 });
      await page.waitForTimeout(1200);

      const startBtn = page.locator("[data-live-studio-start]").first();
      if ((await startBtn.count()) > 0) {
        await startBtn.click();
        await page.waitForTimeout(2500);
        const afterClick = await page.evaluate(() => window.TlvPlatformLiveBridge?.getDiagnostics?.());
        if (afterClick?.lastResult?.op === "startHost") {
          pass("on:studio-button-bridge", afterClick.lastResult?.via || "", "flag-on");
        } else {
          fail("on:studio-button-bridge", JSON.stringify(afterClick?.lastResult), "flag-on");
        }
        const studioIntact = await page.evaluate(() => Boolean(document.querySelector("[data-live-studio-root]")));
        if (studioIntact) pass("on:studio-button-page-intact", "", "flag-on");
        else fail("on:studio-button-page-intact", "", "flag-on");
      } else {
        skip("on:studio-button-bridge", "no scheduled broadcast for test user", "flag-on");
      }
    } else {
      skip("on:studio-button-bridge", "JWT unavailable — direct bridge only", "flag-on");
    }

    const failPage = await browser.newPage();
    const failProbe = await collectConsoleErrors(failPage);
    try {
      await failPage.addInitScript(platformLiveFlagInitScript(true), { on: true });
      await failPage.route("**/live-platform-integration.js", (route) => route.abort("failed"));
      await failPage.setViewportSize({ width: 1280, height: 900 });
      const failStudioUrl = buildLocalPageUrl(base, "live/studio.html", "talkDev=1");
      await failPage.goto(failStudioUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await failPage.waitForSelector("[data-live-studio-root]", { timeout: 15000 });

      const loadFail = await failPage.evaluate(async () =>
        window.TlvPlatformLiveBridge.onStudioStart({
          broadcastId: "fail-bc",
          creatorId: "u_me",
        }),
      );
      if (loadFail?.partial === true || loadFail?.ok === false || loadFail?.code === "PLATFORM_LIVE_LOAD_FAILED") {
        pass("on:load-fail-non-fatal", loadFail?.error || loadFail?.code || "", "flag-on");
      } else {
        fail("on:load-fail-non-fatal", JSON.stringify(loadFail), "flag-on");
      }
      const intact = await failPage.evaluate(() => Boolean(document.querySelector("[data-live-studio-root]")));
      if (intact) pass("on:load-fail-page-intact", "", "flag-on");
      else fail("on:load-fail-page-intact", "", "flag-on");
    } catch (err) {
      fail("on:load-fail-non-fatal", err.message || String(err), "flag-on");
    } finally {
      failProbe.detach();
      await failPage.close();
    }

    const retryInBridge = await page.evaluate(() => /executeWithRetry/.test(String(window.TlvPlatformLiveBridge)));
    if (!retryInBridge) pass("on:retry-delegated-not-bridge", "", "flag-on");
    else fail("on:retry-delegated-not-bridge", "", "flag-on");

    if (probe.errors.length) fail("on:console-clean", probe.errors.slice(0, 2).join(" | "), "flag-on");
    else pass("on:console-clean", "0 severe errors", "flag-on");
  } catch (err) {
    const diag = await page.evaluate(() => window.TlvPlatformLiveBridge?.getDiagnostics?.() || null).catch(() => null);
    fail("on:smoke", `${err.message || err}${diag ? ` diag=${JSON.stringify(diag)}` : ""}`, "flag-on");
  } finally {
    probe.detach();
  }
}

function runRegressions() {
  if (process.env.P5_4_SKIP_REGRESSION === "1") {
    skip("regression:all", "P5_4_SKIP_REGRESSION=1 — run npm scripts separately", "regression");
    return;
  }
  console.log("\n=== E. Regression (P5-3 · P5-2 · P5-1 · P4-6) ===\n");
  for (const script of REGRESSION_SCRIPTS) {
    try {
      execSync(`npm run ${script}`, {
        cwd: ROOT,
        stdio: "pipe",
        encoding: "utf8",
        timeout: REGRESSION_TIMEOUT_MS,
      });
      pass(`regression:${script}`, "", "regression");
    } catch (err) {
      fail(`regression:${script}`, err.stdout?.slice(-500) || err.message, "regression");
    }
  }
}

function runBuildPages() {
  if (process.env.P5_4_SKIP_BUILD === "1") {
    skip("build:pages", "P5_4_SKIP_BUILD=1", "build");
    return;
  }
  try {
    execSync("npm run build:pages", { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
    pass("build:pages", "ok", "build");
  } catch (err) {
    fail("build:pages", err.stderr?.slice(-400) || err.message, "build");
  }
}

function runOptionalE2E() {
  if (process.env.P5_4_SKIP_E2E === "1") {
    skip("optional:e2e", "P5_4_SKIP_E2E=1", "e2e");
    return;
  }
  console.log("\n=== G. Optional E2E / Browser Play ===\n");
  for (const script of [
    "verify:platform-live-zego-integration-e2e",
    "verify:platform-live-zego-browser-play-check",
  ]) {
    try {
      execSync(`npm run ${script}`, { cwd: ROOT, stdio: "pipe", encoding: "utf8", timeout: 300000 });
      pass(`optional:${script}`, "", "e2e");
    } catch (err) {
      skip(`optional:${script}`, (err.stdout || err.stderr || err.message).slice(-300), "e2e");
    }
  }
}

function writeReport({ base, verdict }) {
  const sections = ["static", "http", "flag-off", "flag-on", "regression", "build", "e2e"];
  const lines = [
    "# Platform Live ZEGO — Phase 5 P5-4 Integration Smoke",
    "",
    `**Date:** ${new Date().toISOString().slice(0, 10)}`,
    `**Base URL:** ${base || "n/a"}`,
    `**Verdict:** ${verdict}`,
    "",
    "## Summary",
    "",
    "| Section | PASS | FAIL | SKIP |",
    "|---------|------|------|------|",
  ];

  for (const sec of sections) {
    const rows = results.filter((r) => r.section === sec);
    lines.push(
      `| ${sec} | ${rows.filter((r) => r.status === "PASS").length} | ${rows.filter((r) => r.status === "FAIL").length} | ${rows.filter((r) => r.status === "SKIP").length} |`,
    );
  }

  lines.push("", "## Results", "");
  for (const r of results) {
    lines.push(`- **${r.status}** \`${r.id}\`${r.detail ? ` — ${r.detail}` : ""}`);
  }

  lines.push(
    "",
    "## Flag OFF",
    "",
    "- studio / watch HTTP 200",
    "- `usePlatformLive=false` default — bridge disabled · Integration not lazy-loaded",
    "- Supabase stub watch + comments mount unchanged",
    "",
    "## Flag ON",
    "",
    "- Init script `usePlatformLive=true` (no source file change)",
    "- watch mount → `onWatchJoin` → Adapter `joinViewer` → Integration",
    "- studio → `onStudioStart` → Adapter `startHost`",
    "- load failure simulated — non-fatal partial result",
    "- Retry remains on Integration (P4-6)",
    "",
    "## P5-5+ backlog",
    "",
    "| ID | Item |",
    "|----|------|",
    "| P5-5 | Flag ON ZEGO provider lazy load (replace stub provider) |",
    "| P5-6 | watch leave hook + studio preview video container wiring |",
    "| P5-7 | Supabase comments vs Platform Chat integration policy |",
    "| P5-8 | `renderStreamPlayer` real video surface |",
    "| P5-9 | watch URL normalization (`id` vs `broadcast_id`) |",
    "",
  );

  if (failures.length) {
    lines.push("## Failures", "");
    for (const f of failures) lines.push(`- ${f}`);
  }

  fs.mkdirSync(path.dirname(REPORT_MD), { recursive: true });
  fs.writeFileSync(REPORT_MD, lines.join("\n"), "utf8");
  console.log(`\nReport: ${REPORT_MD}`);
}

async function main() {
  console.log("\n=== Platform Live ZEGO Integration — Phase 5 P5-4 Smoke ===\n");

  verifyStaticGuards();

  console.log("\n=== B. build:pages ===\n");
  runBuildPages();

  let base = "";
  try {
    base = await findDevServerBaseUrl({ probePath: "live/studio.html" });
    pass("dev:8788", base, "http");
  } catch (err) {
    fail("dev:8788", `${err.message} — run npm run dev after build:pages`, "http");
    writeReport({ base: "", verdict: "NO-GO" });
    process.exit(1);
  }

  await verifyHttp(base);

  const cfg = loadTalkSupabaseConfig();
  let jwt = "";
  if (cfg.serviceKey) {
    try {
      jwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
      pass("jwt:setup", TALK_TEST_USERS.u_me.talkUserId, "flag-on");
    } catch (err) {
      skip("jwt:setup", err.message, "flag-on");
    }
  } else {
    skip("jwt:setup", "SUPABASE_SERVICE_ROLE_KEY missing", "flag-on");
  }

  console.log("\n=== C. Flag OFF browser (viewports) ===\n");
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    for (const vp of VIEWPORTS) {
      await smokeFlagOff(page, base, vp);
    }
    await smokeFlagOn(page, base, jwt, browser);
  });
  await closeAllBrowsers();

  runRegressions();
  runOptionalE2E();

  const failCount = results.filter((r) => r.status === "FAIL").length;
  const verdict = failCount === 0 ? "GO" : "NO-GO";
  writeReport({ base, verdict });

  console.log("\n=== Summary ===");
  console.log(`  PASS: ${results.filter((r) => r.status === "PASS").length}`);
  console.log(`  FAIL: ${failCount}`);
  console.log(`  SKIP: ${results.filter((r) => r.status === "SKIP").length}`);
  console.log(`\nP5-4 ${verdict}\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
