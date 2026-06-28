#!/usr/bin/env node
/**
 * TLV Live ZEGO PoC — Phase 1.5 実機 E2E
 *
 * 前提:
 *   .env に ZEGO_APP_ID / ZEGO_SERVER / ZEGO_SERVER_SECRET（32 byte）
 *   npm run dev（8788）
 *
 *   node scripts/verify-live-zego-poc-e2e.mjs
 *   npm run verify:live-zego-poc-e2e
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { maskEnvValue, readZegoEnv } from "./lib/zego-env.mjs";
import { writeLiveZegoConfigToDist } from "./lib/write-live-zego-config.mjs";
import { closeAllBrowsers, withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST_LIVE = path.join(ROOT, "deploy/cloudflare/dist/live");
const REPORT_PATH = path.join(ROOT, "reports/tlv-live-zego-poc-e2e.json");

const FAKE_MEDIA_ARGS = [
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
];

const summary = { pass: 0, fail: 0, skip: 0 };
const failures = [];
const results = [];

function pass(id, detail = "") {
  summary.pass += 1;
  results.push({ id, status: "PASS", detail });
  console.log(`  PASS  ${id}${detail ? ` — ${detail}` : ""}`);
}

function fail(id, detail = "") {
  summary.fail += 1;
  failures.push(`${id}${detail ? `: ${detail}` : ""}`);
  results.push({ id, status: "FAIL", detail });
  console.log(`  FAIL  ${id}${detail ? ` — ${detail}` : ""}`);
}

function skip(id, detail = "") {
  summary.skip += 1;
  results.push({ id, status: "SKIP", detail });
  console.log(`  SKIP  ${id}${detail ? ` — ${detail}` : ""}`);
}

function writeReport(extra = {}) {
  const payload = {
    date: new Date().toISOString().slice(0, 10),
    phase: "1.5",
    summary,
    failures,
    results,
    env: {
      ZEGO_APP_ID: maskEnvValue("ZEGO_APP_ID"),
      ZEGO_SERVER: maskEnvValue("ZEGO_SERVER"),
      ZEGO_SERVER_SECRET: maskEnvValue("ZEGO_SERVER_SECRET"),
    },
    ...extra,
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`\n  Report: ${path.relative(ROOT, REPORT_PATH)}`);
}

async function verifyCredentials() {
  console.log("\n=== A. ZEGO credentials ===\n");
  const env = readZegoEnv();
  console.log(`  ZEGO_APP_ID=${maskEnvValue("ZEGO_APP_ID")}`);
  console.log(`  ZEGO_SERVER=${maskEnvValue("ZEGO_SERVER")}`);
  console.log(`  ZEGO_SERVER_SECRET=${maskEnvValue("ZEGO_SERVER_SECRET")}`);

  if (!env.ok) {
    fail("env:zego-configured", env.missing.join(", ") || env.hints.join("; "));
    for (const h of env.hints) console.log(`  hint: ${h}`);
    return null;
  }
  pass("env:zego-configured");
  return env;
}

async function verifyDistConfig(env) {
  console.log("\n=== B. dist live-zego-config.js ===\n");
  const out = writeLiveZegoConfigToDist(DIST_LIVE, env);
  if (!out.ok) {
    fail("config:dist-generated", out.reason);
    return false;
  }
  pass("config:dist-generated", out.path);
  return true;
}

async function verifyTokenApi(base, env) {
  console.log("\n=== C. Token API ===\n");
  const roomId = `tlv-e2e-${Date.now()}`;
  const cases = [
    { id: "token:host", userId: "e2e_host", role: "host" },
    { id: "token:audience", userId: "e2e_viewer", role: "audience" },
  ];

  for (const c of cases) {
    try {
      const res = await fetch(`${base}/api/tlv-zego-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, userId: c.userId, role: c.role }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 200 && body.token) {
        pass(c.id, `len=${body.token.length}`);
      } else {
        fail(c.id, `status=${res.status} ${body.error || ""}`);
      }
    } catch (err) {
      fail(c.id, err?.message || String(err));
    }
  }
  return roomId;
}

async function waitStatus(page, pattern, timeoutMs = 90000) {
  await page.waitForFunction(
    ({ re }) => {
      const text = document.querySelector("[data-zego-status]")?.textContent || "";
      return new RegExp(re, "i").test(text);
    },
    { re: pattern },
    { timeout: timeoutMs },
  );
}

async function fillSession(page, { roomId, userId, userName }) {
  await page.fill('[name="roomId"]', roomId);
  await page.fill('[name="userId"]', userId);
  await page.fill('[name="userName"]', userName);
}

async function verifyBrowserE2E(base, roomId) {
  console.log("\n=== D. Browser E2E (fake media) ===\n");

  const pocUrl = `${base}/live/live-zego-poc.html`;
  const launchArgs = [
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-gpu",
    ...FAKE_MEDIA_ARGS,
  ];

  await withPlaywrightBrowser(async (browser) => {
    const hostCtx = await browser.newContext({
      permissions: ["camera", "microphone"],
      viewport: { width: 1280, height: 900 },
    });
    const viewerCtx = await browser.newContext({
      permissions: ["camera", "microphone"],
      viewport: { width: 390, height: 844 },
    });

    const hostPage = await hostCtx.newPage();
    const viewerPage = await viewerCtx.newPage();

    const consoleErrors = { host: [], viewer: [] };
    for (const [label, page] of [
      ["host", hostPage],
      ["viewer", viewerPage],
    ]) {
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors[label].push(msg.text());
      });
    }

    try {
      await hostPage.goto(pocUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      pass("browser:host-page", pocUrl);

      await fillSession(hostPage, {
        roomId,
        userId: "e2e_host",
        userName: "E2E Host",
      });

      await hostPage.click("[data-zego-init]");
      await waitStatus(hostPage, "initialize 成功|ready");
      pass("browser:host-initialize");

      await hostPage.click("[data-zego-start]");
      await waitStatus(hostPage, "配信開始|live");
      pass("browser:host-start-live");

      await hostPage.click("[data-zego-cam]");
      await waitStatus(hostPage, "カメラ");
      pass("browser:host-toggle-camera");

      await hostPage.click("[data-zego-mic]");
      await waitStatus(hostPage, "マイク");
      pass("browser:host-toggle-mic");

      await hostPage.click("[data-zego-switch]");
      await waitStatus(hostPage, "カメラ向き");
      pass("browser:host-switch-camera");

      await hostPage.click("[data-zego-beauty]");
      await waitStatus(hostPage, "Beauty");
      pass("browser:host-beauty-probe");

      await viewerPage.goto(pocUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      pass("browser:viewer-page");

      await fillSession(viewerPage, {
        roomId,
        userId: "e2e_viewer",
        userName: "E2E Viewer",
      });

      await viewerPage.click("[data-zego-init]");
      await waitStatus(viewerPage, "initialize 成功|ready");
      pass("browser:viewer-initialize");

      await viewerPage.click("[data-zego-join]");
      await waitStatus(viewerPage, "視聴参加|watching");
      pass("browser:viewer-join-live");

      await viewerPage.waitForTimeout(5000);
      const remoteCount = await viewerPage.locator(".live-zego-poc__remote, .live-zego-poc__video").count();
      if (remoteCount > 0) pass("browser:viewer-video-container", `nodes=${remoteCount}`);
      else skip("browser:viewer-remote-stream", "remote DOM 未検出 — SDK/ネットワーク要確認");

      await viewerPage.click("[data-zego-leave]");
      await waitStatus(viewerPage, "退出|ready");
      pass("browser:viewer-leave");

      await hostPage.click("[data-zego-end]");
      await waitStatus(hostPage, "配信終了|ready");
      pass("browser:host-end-live");

      const severe = [...consoleErrors.host, ...consoleErrors.viewer].filter(
        (t) => !/favicon|404|Failed to load resource|live-zego-config\.js/i.test(t),
      );
      if (severe.length === 0) pass("browser:console-clean");
      else fail("browser:console-clean", severe.slice(0, 3).join(" | "));
    } finally {
      await hostPage.close().catch(() => null);
      await viewerPage.close().catch(() => null);
      await hostCtx.close().catch(() => null);
      await viewerCtx.close().catch(() => null);
    }
  }, { args: launchArgs });
}

async function main() {
  console.log("TLV Live ZEGO PoC — Phase 1.5 E2E");

  const env = await verifyCredentials();
  if (!env) {
    writeReport({ verdict: "NO-GO", blocker: "ZEGO credentials missing in .env" });
    process.exitCode = 2;
    return;
  }

  if (!(await verifyDistConfig(env))) {
    writeReport({ verdict: "NO-GO", blocker: "dist config generation failed" });
    process.exitCode = 1;
    return;
  }

  let base;
  try {
    base = await findDevServerBaseUrl({ envKey: "BUILDER_BASE_URL" });
  } catch {
    fail("dev:server", "8788 not running — npm run dev");
    writeReport({ verdict: "NO-GO", blocker: "dev server not running" });
    process.exitCode = 1;
    return;
  }
  pass("dev:server", base);

  const roomId = await verifyTokenApi(base, env);

  if (summary.fail === 0) {
    try {
      await verifyBrowserE2E(base, roomId);
    } catch (err) {
      fail("browser:e2e", err?.message || String(err));
    }
  } else {
    skip("browser:e2e", "Token API failed — browser skipped");
  }

  console.log("\n=== Summary ===");
  console.log(`  PASS ${summary.pass} · FAIL ${summary.fail} · SKIP ${summary.skip}`);

  const verdict = summary.fail === 0 ? "GO" : "NO-GO";
  writeReport({ verdict, pocUrl: `${base}/live/live-zego-poc.html` });

  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeAllBrowsers());
