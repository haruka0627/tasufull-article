#!/usr/bin/env node
/**
 * Live Platform — ZEGO Integration Phase 2 E2E
 *
 * 前提:
 *   .env に ZEGO_APP_ID / ZEGO_SERVER / ZEGO_SERVER_SECRET（32 byte）
 *   npm run dev（8788）
 *
 *   node scripts/verify-platform-live-zego-integration-e2e.mjs
 *   npm run verify:platform-live-zego-integration-e2e
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { maskEnvValue, readZegoEnv } from "./lib/zego-env.mjs";
import { writeAllZegoConfigsToDist } from "./lib/write-platform-zego-config.mjs";
import { syncPagesDevVars } from "./lib/sync-pages-dev-vars.mjs";
import { closeAllBrowsers, withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST_ROOT = path.join(ROOT, "deploy/cloudflare/dist");
const REPORT_JSON = path.join(ROOT, "reports/live-platform-zego-integration-e2e.json");
const REPORT_MD = path.join(ROOT, "reports/live-platform-zego-integration-e2e.md");

const POC_PATH = "live/live-zego-poc.html";
const POC_PROVIDER_PATH = "live/providers/zego-live-provider.js";
const INTERFACE_PATH = "platform-live/provider/live-provider-interface.js";
const POC_PAGE = "platform-live/zego-platform-poc.html";

const FAKE_MEDIA_ARGS = [
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
];

const REGRESSION_SCRIPTS = [
  "test:platform-live-zego-adapter-phase1",
  "test:platform-live-core-phase-a",
  "test:platform-live-broadcast-phase-b",
  "test:platform-live-viewer-phase-c",
  "test:platform-live-chat-phase-d",
  "test:platform-live-recording-phase-e",
  "test:platform-live-monitoring-phase-f",
];

const summary = { pass: 0, fail: 0, skip: 0 };
const failures = [];
const results = [];

/** @type {Record<string, string>} */
const integrityBefore = {};

function sha256File(rel) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  return crypto.createHash("sha256").update(buf).digest("hex");
}

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

function writeReports(extra = {}) {
  const payload = {
    date: new Date().toISOString().slice(0, 10),
    phase: "2",
    summary,
    failures,
    results,
    env: {
      ZEGO_APP_ID: maskEnvValue("ZEGO_APP_ID"),
      ZEGO_SERVER: maskEnvValue("ZEGO_SERVER"),
      ZEGO_SERVER_SECRET: maskEnvValue("ZEGO_SERVER_SECRET"),
    },
    integrityBefore,
    ...extra,
  };

  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
  fs.writeFileSync(REPORT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const verdict = extra.verdict || (summary.fail > 0 ? "NO-GO" : summary.skip > 0 && summary.pass === 0 ? "SKIP" : "GO");
  const md = `# Live Platform — ZEGO Integration Phase 2 E2E

**日付:** ${payload.date}  
**Status:** **${verdict}**  
**PASS:** ${summary.pass} · **FAIL:** ${summary.fail} · **SKIP:** ${summary.skip}

---

## シナリオ結果

| # | シナリオ | 結果 |
| --- | --- | --- |
${results.map((r, i) => `| ${i + 1} | ${r.id} | ${r.status}${r.detail ? ` — ${r.detail}` : ""} |`).join("\n")}

---

## Token API

${results.filter((r) => r.id.startsWith("token:")).map((r) => `- **${r.id}:** ${r.status}${r.detail ? ` (${r.detail})` : ""}`).join("\n") || "- (未実行)"}

---

## Signal 確認

${results.filter((r) => r.id.includes("signal")).map((r) => `- **${r.id}:** ${r.status}${r.detail ? ` — ${r.detail}` : ""}`).join("\n") || "- (未実行)"}

---

## 未変更確認

| 対象 | 結果 |
| --- | --- |
| TLV PoC HTML | ${results.find((r) => r.id === "integrity:tlv-poc-html")?.status || "—"} |
| TLV ZEGO Provider | ${results.find((r) => r.id === "integrity:tlv-zego-provider")?.status || "—"} |
| Platform Interface | ${results.find((r) => r.id === "integrity:platform-interface")?.status || "—"} |

---

## Phase 2 判断

| 項目 | 結果 |
| --- | --- |
| Phase 2 Go / No-Go | **${verdict === "SKIP" ? "SKIP（環境未整備）" : verdict}** |
| Phase 3 開始可否 | ${extra.phase3 || "—"} |

${failures.length ? `\n## Failures\n\n${failures.map((f) => `- ${f}`).join("\n")}\n` : ""}
`;

  fs.writeFileSync(REPORT_MD, md, "utf8");
  console.log(`\n  Report: ${path.relative(ROOT, REPORT_MD)}`);
  console.log(`  Report: ${path.relative(ROOT, REPORT_JSON)}`);
}

async function verifyEnv() {
  console.log("\n=== 1. env 確認 ===\n");
  const env = readZegoEnv();
  console.log(`  ZEGO_APP_ID=${maskEnvValue("ZEGO_APP_ID")}`);
  console.log(`  ZEGO_SERVER=${maskEnvValue("ZEGO_SERVER")}`);
  console.log(`  ZEGO_SERVER_SECRET=${maskEnvValue("ZEGO_SERVER_SECRET")}`);

  if (!env.ok) {
    skip("env:zego-configured", env.missing.join(", ") || env.hints.join("; "));
    for (const h of env.hints) console.log(`  hint: ${h}`);
    return null;
  }
  pass("env:zego-configured");
  return env;
}

async function verifyDistConfig(env) {
  console.log("\n=== 2. dist config + .dev.vars ===\n");
  const devVars = syncPagesDevVars(DIST_ROOT);
  console.log(
    `  dist/.dev.vars presence: APP_ID=${devVars.presence.ZEGO_APP_ID} SERVER=${devVars.presence.ZEGO_SERVER} SECRET=${devVars.presence.ZEGO_SERVER_SECRET ? `present(${devVars.zegoSecretLen} chars)` : "missing"}`,
  );
  if (env.ok && !devVars.zegoRuntimeReady) {
    fail("config:dev-vars-zego", `runtime not ready (secretLen=${devVars.zegoSecretLen})`);
  } else if (devVars.zegoRuntimeReady) {
    pass("config:dev-vars-zego", path.relative(ROOT, devVars.path));
  } else {
    skip("config:dev-vars-zego", "ZEGO keys missing in .env");
  }

  const out = writeAllZegoConfigsToDist(DIST_ROOT, env);
  if (!out.platform.ok) {
    fail("config:platform-dist", out.platform.reason);
    return false;
  }
  pass("config:platform-dist", path.relative(ROOT, out.platform.path));
  if (out.live.ok) pass("config:tlv-dist", path.relative(ROOT, out.live.path));
  return devVars.zegoRuntimeReady;
}

async function verifyTokenApi(base) {
  console.log("\n=== 3–4. Token API ===\n");
  const roomId = `platform-e2e-${Date.now()}`;
  for (const c of [
    { id: "token:host", userId: "e2e_platform_host", role: "host" },
    { id: "token:audience", userId: "e2e_platform_viewer", role: "audience" },
  ]) {
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
        const diag = [
          `status=${res.status}`,
          body.error ? `error=${body.error}` : "",
          body.configured === false ? "configured=false" : "",
          body.hint ? `hint=${String(body.hint).slice(0, 80)}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        fail(c.id, diag);
        if (res.status === 503 && body.error === "ZEGO credentials not configured") {
          console.log(
            "  hint: Pages Functions は dist/.dev.vars が必要 — npm run dev 前に ensure-pages-dist が .env を同期します",
          );
        }
      }
    } catch (err) {
      fail(c.id, err?.message || String(err));
    }
  }
  return roomId;
}

async function verifyPocPage(base) {
  console.log("\n=== 5. PoC ページ表示 ===\n");
  const url = `${base}/${POC_PAGE}`;
  try {
    const res = await fetch(url);
    if (res.status === 200) {
      pass("page:platform-poc", url);
      return true;
    }
    fail("page:platform-poc", `HTTP ${res.status}`);
  } catch (err) {
    fail("page:platform-poc", err?.message || String(err));
  }
  return false;
}

async function waitStatus(page, pattern, timeoutMs = 120000) {
  try {
    await page.waitForFunction(
      ({ re }) => {
        const text = document.querySelector("[data-platform-status]")?.textContent || "";
        return new RegExp(re, "i").test(text);
      },
      { re: pattern },
      { timeout: timeoutMs },
    );
  } catch (err) {
    const status = await page.locator("[data-platform-status]").textContent().catch(() => "");
    throw new Error(`${err?.message || err} · status="${String(status).slice(0, 200)}"`);
  }
}

async function fillSession(page, { roomId, userId, userName, broadcastId }) {
  await page.fill('[name="roomId"]', roomId);
  await page.fill('[name="userId"]', userId);
  if (userName) await page.fill('[name="userName"]', userName);
  if (broadcastId) await page.fill('[name="broadcastId"]', broadcastId);
}

async function verifyBrowserE2E(base, roomId) {
  console.log("\n=== 6–12. Browser E2E (fake media) ===\n");

  const pocUrl = `${base}/${POC_PAGE}`;
  const launchArgs = ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu", ...FAKE_MEDIA_ARGS];

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
      await hostPage.goto(pocUrl, { waitUntil: "networkidle", timeout: 120000 });

      await hostPage.waitForFunction(
        () => typeof globalThis.ZegoExpressEngine === "function",
        { timeout: 120000 },
      );
      pass("browser:zego-sdk-loaded");

      await fillSession(hostPage, {
        roomId,
        userId: "e2e_platform_host",
        userName: "E2E Platform Host",
        broadcastId: `bc-${roomId}`,
      });

      await hostPage.click("[data-platform-init]");
      await waitStatus(hostPage, "initialize 成功|ready");
      pass("browser:initialize");

      const initDebug = await hostPage.evaluate(() => window.PlatformZegoPoc?.getDebugState?.());
      if (initDebug?.usesAdapterPath) pass("browser:adapter-path", `providerId=${initDebug.providerId}`);
      else fail("browser:adapter-path", JSON.stringify(initDebug));

      await hostPage.click("[data-platform-create-session]");
      await waitStatus(hostPage, "createSession");
      pass("browser:create-session");

      await hostPage.click("[data-platform-start]");
      await waitStatus(hostPage, "host publish|live");
      pass("browser:host-publish");

      await viewerPage.goto(pocUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await fillSession(viewerPage, {
        roomId,
        userId: "e2e_platform_viewer",
        userName: "E2E Platform Viewer",
        broadcastId: `bc-${roomId}`,
      });

      await viewerPage.click("[data-platform-init]");
      await waitStatus(viewerPage, "initialize 成功|ready");
      pass("browser:audience-initialize");

      await viewerPage.click("[data-platform-join]");
      await waitStatus(viewerPage, "audience join|watching|CONNECTED");
      pass("browser:audience-join");

      await viewerPage.waitForTimeout(5000);
      const remoteCount = await viewerPage.locator(".live-zego-poc__remote, .live-zego-poc__video, video").count();
      if (remoteCount > 0) pass("browser:audience-play", `nodes=${remoteCount}`);
      else skip("browser:audience-play", "remote DOM 未検出 — SDK/ネットワーク要確認");

      await hostPage.click("[data-platform-reconnect]");
      await waitStatus(hostPage, "reconnect");
      pass("browser:reconnect");

      await viewerPage.click("[data-platform-leave]");
      await waitStatus(viewerPage, "leave|ready|IDLE|ENDED");
      pass("browser:leave");

      await hostPage.click("[data-platform-cleanup]");
      await waitStatus(hostPage, "cleanup|disposed|IDLE");
      pass("browser:cleanup");

      const hostDebug = await hostPage.evaluate(() => window.PlatformZegoPoc?.getDebugState?.());
      const pSignals = hostDebug?.providerSignals?.map((x) => x.signal) || [];
      const bSignals = hostDebug?.broadcastSignals?.map((x) => x.signal) || [];

      if (pSignals.some((s) => /PROVIDER_CONNECTED|PROVIDER_CONNECTING/.test(s))) {
        pass("signals:provider", pSignals.join(", "));
      } else {
        fail("signals:provider", pSignals.join(", ") || "empty");
      }

      if (bSignals.some((s) => /BROADCAST_PROVIDER_STARTED|BROADCAST_PROVIDER_STARTING/.test(s))) {
        pass("signals:broadcast", bSignals.join(", "));
      } else {
        fail("signals:broadcast", bSignals.join(", ") || "empty");
      }

      const severe = [...consoleErrors.host, ...consoleErrors.viewer].filter(
        (t) =>
          !/favicon|404|Failed to load resource|platform-live-zego-config\.js|Permissions policy violation: (microphone|camera) is not allowed/i.test(
            t,
          ),
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

function verifyIntegrity() {
  console.log("\n=== 15–16. 未変更確認 ===\n");
  for (const [id, rel] of [
    ["integrity:tlv-poc-html", POC_PATH],
    ["integrity:tlv-zego-provider", POC_PROVIDER_PATH],
    ["integrity:platform-interface", INTERFACE_PATH],
  ]) {
    const after = sha256File(rel);
    if (integrityBefore[rel] === after) pass(id, rel);
    else fail(id, `${rel} changed`);
  }
}

function runRegression() {
  console.log("\n=== Regression (Phase 1 + A–F) ===\n");
  for (const script of REGRESSION_SCRIPTS) {
    try {
      execSync(`npm run ${script}`, { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
      pass(`regression:${script}`);
    } catch (err) {
      const out = `${err.stdout || ""}\n${err.stderr || ""}`.trim();
      fail(`regression:${script}`, out.slice(-200) || err.message);
    }
  }
}

async function main() {
  console.log("Live Platform ZEGO Integration — Phase 2 E2E");

  integrityBefore[POC_PATH] = sha256File(POC_PATH);
  integrityBefore[POC_PROVIDER_PATH] = sha256File(POC_PROVIDER_PATH);
  integrityBefore[INTERFACE_PATH] = sha256File(INTERFACE_PATH);

  const env = await verifyEnv();
  if (!env) {
    skip("config:platform-dist", "env missing");
    skip("token:host", "env missing");
    skip("token:audience", "env missing");
    skip("browser:e2e", "env missing");

    let base;
    try {
      base = await findDevServerBaseUrl({ envKey: "BUILDER_BASE_URL" });
      pass("dev:server", base);
      await verifyPocPage(base);
    } catch {
      skip("dev:server", "8788 not running");
      skip("page:platform-poc", "dev server not running");
    }

    verifyIntegrity();
    runRegression();
    writeReports({
      verdict: "SKIP",
      phase3: "Phase 2 E2E SKIP — ZEGO .env 整備後に再実行",
      blocker: "ZEGO credentials missing in .env（環境未整備 · No-Go ではない）",
      pocUrl: base ? `${base}/${POC_PAGE}` : undefined,
    });
    console.log("\n=== Summary ===");
    console.log(`  PASS ${summary.pass} · FAIL ${summary.fail} · SKIP ${summary.skip}`);
    console.log("\nPhase 2 E2E: SKIP（環境未整備）\n");
    return;
  }

  if (!(await verifyDistConfig(env))) {
    verifyIntegrity();
    writeReports({ verdict: "NO-GO", phase3: "dist config 失敗を解消後", blocker: "dist config generation failed" });
    process.exitCode = 1;
    return;
  }

  let base;
  try {
    base = await findDevServerBaseUrl({ envKey: "BUILDER_BASE_URL" });
  } catch {
    fail("dev:server", "8788 not running — npm run dev");
    verifyIntegrity();
    writeReports({ verdict: "NO-GO", phase3: "dev server 起動後", blocker: "dev server not running" });
    process.exitCode = 1;
    return;
  }
  pass("dev:server", base);

  await verifyPocPage(base);
  const roomId = await verifyTokenApi(base);

  if (summary.fail === 0) {
    try {
      await verifyBrowserE2E(base, roomId);
    } catch (err) {
      fail("browser:e2e", err?.message || String(err));
    }
  } else {
    skip("browser:e2e", "前提チェック失敗 — browser skipped");
  }

  verifyIntegrity();
  runRegression();

  console.log("\n=== Summary ===");
  console.log(`  PASS ${summary.pass} · FAIL ${summary.fail} · SKIP ${summary.skip}`);

  const verdict = summary.fail === 0 ? "GO" : "NO-GO";
  const phase3 =
    verdict === "GO"
      ? "Phase 3（Broadcast/Viewer 本接続）着手可 — 人間 Go 確認後"
      : "Phase 2 失敗解消後";

  writeReports({
    verdict,
    phase3,
    pocUrl: `${base}/${POC_PAGE}`,
  });

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
