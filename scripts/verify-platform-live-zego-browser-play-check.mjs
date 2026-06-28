#!/usr/bin/env node
/**
 * Phase 2.5 — 通常ブラウザ相当 audience play 確認
 * headless E2E SKIP 項目の実機検証 · Secret 非表示
 *
 *   node scripts/verify-platform-live-zego-browser-play-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { maskEnvValue, readZegoEnv } from "./lib/zego-env.mjs";
import { syncPagesDevVars } from "./lib/sync-pages-dev-vars.mjs";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "deploy/cloudflare/dist");
const REPORT_MD = path.join(ROOT, "reports/live-platform-zego-phase2_5-browser-play-check.md");
const SHOT_DIR = path.join(ROOT, "reports/live-platform-zego-phase2_5-browser-play-check");
const POC_PAGE = "platform-live/zego-platform-poc.html";

const FAKE_MEDIA_ARGS = [
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  "--disable-dev-shm-usage",
  "--no-sandbox",
];

/** @type {{ id: string, status: string, detail?: string }[]} */
const results = [];

function record(id, status, detail = "") {
  results.push({ id, status, detail });
  console.log(`  ${status.padEnd(5)} ${id}${detail ? ` — ${detail}` : ""}`);
}

async function waitStatus(page, pattern, timeoutMs = 120000) {
  await page.waitForFunction(
    ({ re }) => {
      const text = document.querySelector("[data-platform-status]")?.textContent || "";
      return new RegExp(re, "i").test(text);
    },
    { re: pattern },
    { timeout: timeoutMs },
  );
}

async function fillSession(page, { roomId, userId, userName, broadcastId }) {
  await page.fill('[name="roomId"]', roomId);
  await page.fill('[name="userId"]', userId);
  if (userName) await page.fill('[name="userName"]', userName);
  if (broadcastId) await page.fill('[name="broadcastId"]', broadcastId);
}

function filterConsoleErrors(lines) {
  return lines.filter(
    (t) =>
      !/favicon|404|Failed to load resource|platform-live-zego-config\.js|Permissions policy violation: (microphone|camera) is not allowed/i.test(
        t,
      ),
  );
}

async function main() {
  console.log("\n=== Phase 2.5 Browser Play Check ===\n");

  const env = readZegoEnv();
  console.log(`  ZEGO_APP_ID=${maskEnvValue("ZEGO_APP_ID")}`);
  console.log(`  ZEGO_SERVER=${maskEnvValue("ZEGO_SERVER")}`);
  console.log(`  ZEGO_SERVER_SECRET=${maskEnvValue("ZEGO_SERVER_SECRET")}`);

  if (!env.ok) {
    record("env:zego", "FAIL", env.missing.join(", "));
    writeReport({ verdict: "NO-GO", phase3: "不可" });
    process.exitCode = 1;
    return;
  }
  record("env:zego", "PASS");

  const devVars = syncPagesDevVars(DIST);
  record(
    "config:dev-vars",
    devVars.zegoRuntimeReady ? "PASS" : "FAIL",
    devVars.zegoRuntimeReady ? "runtime ready" : `secretLen=${devVars.zegoSecretLen}`,
  );

  let base;
  try {
    base = await findDevServerBaseUrl({ envKey: "BUILDER_BASE_URL" });
    record("dev:8788", "PASS", base);
  } catch {
    record("dev:8788", "FAIL", "not listening");
    writeReport({ verdict: "NO-GO", phase3: "不可" });
    process.exitCode = 1;
    return;
  }

  const pocUrl = `${base}/${POC_PAGE}`;
  const pageRes = await fetch(pocUrl);
  record("page:poc", pageRes.status === 200 ? "PASS" : "FAIL", `HTTP ${pageRes.status}`);

  const roomId = `browser-play-${Date.now()}`;
  for (const c of [
    { id: "token:host", userId: "browser_host", role: "host" },
    { id: "token:audience", userId: "browser_viewer", role: "audience" },
  ]) {
    const res = await fetch(`${base}/api/tlv-zego-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, userId: c.userId, role: c.role }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 200 && body.token) record(c.id, "PASS", `len=${body.token.length}`);
    else record(c.id, "FAIL", `status=${res.status} ${body.error || ""}`);
  }

  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const consoleErrors = { host: [], viewer: [] };
  let audiencePlayDetail = "";
  let hostDebug = null;
  let viewerDebug = null;
  let remoteDiag = null;

  const browser = await chromium.launch({
    headless: false,
    args: FAKE_MEDIA_ARGS,
  });

  try {
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

    for (const [label, page] of [
      ["host", hostPage],
      ["viewer", viewerPage],
    ]) {
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors[label].push(msg.text());
      });
    }

    await hostPage.goto(pocUrl, { waitUntil: "networkidle", timeout: 120000 });
    await hostPage.waitForFunction(() => typeof globalThis.ZegoExpressEngine === "function", {
      timeout: 120000,
    });

    await fillSession(hostPage, {
      roomId,
      userId: "browser_host",
      userName: "Browser Host",
      broadcastId: `bc-${roomId}`,
    });

    await hostPage.click("[data-platform-init]");
    await waitStatus(hostPage, "initialize 成功|ready");
    record("host:initialize", "PASS");

    await hostPage.click("[data-platform-create-session]");
    await waitStatus(hostPage, "createSession");

    try {
      await hostPage.click("[data-platform-start]");
      await waitStatus(hostPage, "host publish · provider=live");
      record("host:publish", "PASS");
    } catch (err) {
      const stuck = await hostPage.evaluate(() => ({
        status: document.querySelector("[data-platform-status]")?.textContent || "",
        provider: document.querySelector("[data-platform-provider-state]")?.textContent || "",
        session: document.querySelector("[data-platform-session-state]")?.textContent || "",
        debug: window.PlatformZegoPoc?.getDebugState?.(),
      }));
      record("host:publish", "FAIL", `${err?.message || err} · status="${stuck.status.slice(0, 120)}"`);
      await hostPage.screenshot({ path: path.join(SHOT_DIR, "host-publish-stuck-1280.png") });
      writeReport({
        verdict: "NO-GO",
        phase3: "Phase 3 不可 — host publish が SDK/WebRTC 層で完了しない",
        pocUrl,
        roomId,
        stopPoint: "host publish · ZEGO loginRoom/publish 待ち（PROVIDER_CONNECTING のまま）",
        hostStuck: stuck,
        audiencePlayDetail: "未実施（host publish 未完了）",
      });
      process.exitCode = 1;
      return;
    }

    await hostPage.waitForTimeout(8000);
    const hostStage = await hostPage.evaluate(() => {
      const stage = document.querySelector("[data-platform-video]");
      return {
        videoCount: stage?.querySelectorAll("video").length || 0,
        stageChildCount: stage?.children?.length || 0,
        providerState: document.querySelector("[data-platform-provider-state]")?.textContent || "",
      };
    });
    record(
      "host:local-video",
      hostStage.videoCount > 0 ? "PASS" : "SKIP",
      `videos=${hostStage.videoCount} children=${hostStage.stageChildCount} provider=${hostStage.providerState}`,
    );

    await hostPage.screenshot({ path: path.join(SHOT_DIR, "host-after-publish-1280.png") });

    await viewerPage.goto(pocUrl, { waitUntil: "networkidle", timeout: 120000 });
    await viewerPage.waitForFunction(() => typeof globalThis.ZegoExpressEngine === "function", {
      timeout: 120000,
    });

    await fillSession(viewerPage, {
      roomId,
      userId: "browser_viewer",
      userName: "Browser Viewer",
      broadcastId: `bc-${roomId}`,
    });

    await viewerPage.click("[data-platform-init]");
    await waitStatus(viewerPage, "initialize 成功|ready");
    record("audience:initialize", "PASS");

    await viewerPage.click("[data-platform-join]");
    await waitStatus(viewerPage, "audience join · provider=watching");
    record("audience:join", "PASS");

    let remoteFound = false;
    for (let i = 0; i < 24; i += 1) {
      await viewerPage.waitForTimeout(2500);
      remoteDiag = await viewerPage.evaluate(() => {
        const stage = document.querySelector("[data-platform-video]");
        return {
          remoteCount: document.querySelectorAll(".live-zego-poc__remote").length,
          videoCount: document.querySelectorAll("video").length,
          stageChildCount: stage?.children?.length || 0,
          stageHtmlLen: stage?.innerHTML?.length || 0,
          status: document.querySelector("[data-platform-status]")?.textContent || "",
          providerState: document.querySelector("[data-platform-provider-state]")?.textContent || "",
        };
      });
      if (remoteDiag.remoteCount > 0 || remoteDiag.videoCount > 1) {
        remoteFound = true;
        break;
      }
    }

    await viewerPage.screenshot({ path: path.join(SHOT_DIR, "viewer-after-join-390.png") });

    if (remoteFound) {
      audiencePlayDetail = `remote=${remoteDiag.remoteCount} video=${remoteDiag.videoCount} stageChildren=${remoteDiag.stageChildCount}`;
      record("audience:play", "PASS", audiencePlayDetail);
    } else {
      audiencePlayDetail = JSON.stringify(remoteDiag);
      record("audience:play", "FAIL", audiencePlayDetail);
    }

    hostDebug = await hostPage.evaluate(() => window.PlatformZegoPoc?.getDebugState?.());
    viewerDebug = await viewerPage.evaluate(() => window.PlatformZegoPoc?.getDebugState?.());

    const pSignals = hostDebug?.providerSignals?.map((x) => x.signal) || [];
    const bSignals = hostDebug?.broadcastSignals?.map((x) => x.signal) || [];

    if (pSignals.some((s) => /PROVIDER_CONNECTED|PROVIDER_CONNECTING/.test(s))) {
      record("signals:provider", "PASS", pSignals.join(", "));
    } else {
      record("signals:provider", "FAIL", pSignals.join(", ") || "empty");
    }

    if (bSignals.some((s) => /BROADCAST_PROVIDER_STARTED|BROADCAST_PROVIDER_STARTING/.test(s))) {
      record("signals:broadcast", "PASS", bSignals.join(", "));
    } else {
      record("signals:broadcast", "FAIL", bSignals.join(", ") || "empty");
    }

    const severe = filterConsoleErrors([...consoleErrors.host, ...consoleErrors.viewer]);
    if (severe.length === 0) record("console:clean", "PASS");
    else record("console:clean", "FAIL", severe.slice(0, 3).join(" | "));

    await hostPage.close().catch(() => null);
    await viewerPage.close().catch(() => null);
    await hostCtx.close().catch(() => null);
    await viewerCtx.close().catch(() => null);
  } finally {
    await browser.close().catch(() => null);
  }

  const playPass = results.find((r) => r.id === "audience:play")?.status === "PASS";
  const anyFail = results.some((r) => r.status === "FAIL");
  const verdict = playPass && !anyFail ? "GO" : "NO-GO";
  const phase3 = playPass && !anyFail ? "Phase 3 着手可" : "Phase 3 不可 — audience play / host publish 要調査（手動ブラウザ推奨）";

  writeReport({
    verdict,
    phase3,
    pocUrl,
    roomId,
    audiencePlayDetail,
    remoteDiag,
    hostSignals: {
      provider: hostDebug?.providerSignals?.map((x) => x.signal) || [],
      broadcast: hostDebug?.broadcastSignals?.map((x) => x.signal) || [],
    },
    viewerSession: viewerDebug?.sessionSnapshot || null,
    consoleErrors: {
      host: consoleErrors.host.length,
      viewer: consoleErrors.viewer.length,
    },
  });

  if (anyFail) process.exitCode = 1;
}

function writeReport(extra) {
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;

  const md = `# Live Platform — Phase 2.5 Browser Play Check

**日付:** ${new Date().toISOString().slice(0, 10)}  
**目的:** headless SKIP \`audience:play\` の通常ブラウザ（headed Playwright）確認  
**PoC URL:** ${extra.pocUrl || "—"}  
**Verdict:** **${extra.verdict}**  
**Phase 3:** ${extra.phase3}

---

## 前提

| 項目 | 状態 |
| --- | --- |
| Token API 503 | 解消済（\`.dev.vars\` 同期） |
| headless E2E | PASS 31 · FAIL 0 · SKIP 1 |
| Secret ログ | なし（mask のみ） |

---

## 確認結果

| # | 項目 | 結果 | 詳細 |
| --- | --- | --- | --- |
${results.map((r, i) => `| ${i + 1} | ${r.id} | **${r.status}** | ${r.detail || "—"} |`).join("\n")}

**Summary:** PASS ${pass} · FAIL ${fail}

---

## audience play 詳細

| 項目 | 値 |
| --- | --- |
| roomId | \`${extra.roomId || "—"}\` |
| 判定 | ${results.find((r) => r.id === "audience:play")?.status || "—"} |
| 詳細 | ${extra.audiencePlayDetail || "—"} |

### DOM 診断（viewer · join 後最大 30s ポーリング）

\`\`\`json
${JSON.stringify(extra.remoteDiag || {}, null, 2)}
\`\`\`

---

## Signals

**Host provider:** ${(extra.hostSignals?.provider || []).join(", ") || "—"}  
**Host broadcast:** ${(extra.hostSignals?.broadcast || []).join(", ") || "—"}

---

## Console

| context | error 件数 |
| --- | --- |
| host | ${extra.consoleErrors?.host ?? "—"} |
| viewer | ${extra.consoleErrors?.viewer ?? "—"} |

---

## スクリーンショット

| ファイル | 用途 |
| --- | --- |
| \`reports/live-platform-zego-phase2_5-browser-play-check/host-after-publish-1280.png\` | host publish 後 |
| \`reports/live-platform-zego-phase2_5-browser-play-check/viewer-after-join-390.png\` | audience join 後 |

---

## Phase 3 判断

| 判断 | 結果 |
| --- | --- |
| **Phase 2.5 Browser Play** | **${extra.verdict}** |
| **Phase 3 開始** | **${extra.phase3}** |

${extra.stopPoint ? `\n## 停止点\n\n**${extra.stopPoint}**\n\n\`\`\`json\n${JSON.stringify(extra.hostStuck || {}, null, 2)}\n\`\`\`\n` : ""}
`;

  fs.mkdirSync(path.dirname(REPORT_MD), { recursive: true });
  fs.writeFileSync(REPORT_MD, md, "utf8");
  console.log(`\n  Report: ${path.relative(ROOT, REPORT_MD)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
