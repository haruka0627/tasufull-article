#!/usr/bin/env node
/**
 * ZEGO Phase 2.5 — host publish blocker 深掘り
 * Adapter SDK call トレース · Secret 非表示
 *
 *   node scripts/verify-platform-live-zego-publish-blocker-debug.mjs
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
const REPORT_MD = path.join(ROOT, "reports/live-platform-zego-publish-blocker-debug.md");
const REPORT_JSON = path.join(ROOT, "reports/live-platform-zego-publish-blocker-debug.json");
const POC_PAGE = "platform-live/zego-platform-poc.html";
const PUBLISH_WAIT_MS = 75000;

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

async function runPublishProbe({ label, headless, base, roomId }) {
  const consoleLines = [];
  const browser = await chromium.launch({ headless, args: FAKE_MEDIA_ARGS });
  let diag = null;
  let stuck = null;
  let publishOk = false;

  try {
    const ctx = await browser.newContext({
      permissions: ["camera", "microphone"],
      viewport: { width: 1280, height: 900 },
    });
    const page = await ctx.newPage();
    page.on("console", (msg) => {
      const text = msg.text();
      if (/ZegoAdapterPublishDiag|ZegoAdapterSdkEvent|TlvZegoLiveProvider/.test(text)) {
        consoleLines.push(`[${msg.type()}] ${text.slice(0, 240)}`);
      }
      if (msg.type() === "error") consoleLines.push(`[error] ${text.slice(0, 240)}`);
    });

    await page.goto(`${base}/${POC_PAGE}`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForFunction(() => typeof globalThis.ZegoExpressEngine === "function", {
      timeout: 120000,
    });

    await page.fill('[name="roomId"]', roomId);
    await page.fill('[name="userId"]', `dbg_${label}_host`);
    await page.fill('[name="userName"]', `Debug ${label}`);
    await page.fill('[name="broadcastId"]', `bc-${roomId}`);

    await page.click("[data-platform-init]");
    await page.waitForFunction(
      () => /initialize 成功|ready/i.test(document.querySelector("[data-platform-status]")?.textContent || ""),
      { timeout: 60000 },
    );

    await page.click("[data-platform-create-session]");
    await page.waitForFunction(
      () => /createSession/i.test(document.querySelector("[data-platform-status]")?.textContent || ""),
      { timeout: 30000 },
    );

    await page.click("[data-platform-start]");

    try {
      await page.waitForFunction(
        () => /host publish · provider=live/i.test(document.querySelector("[data-platform-status]")?.textContent || ""),
        { timeout: PUBLISH_WAIT_MS },
      );
      publishOk = true;
    } catch {
      publishOk = false;
    }

    stuck = await page.evaluate(() => {
      const stage = document.querySelector("[data-platform-video]");
      const dbg = window.PlatformZegoPoc?.getDebugState?.();
      return {
        status: document.querySelector("[data-platform-status]")?.textContent || "",
        provider: document.querySelector("[data-platform-provider-state]")?.textContent || "",
        session: document.querySelector("[data-platform-session-state]")?.textContent || "",
        videoCount: stage?.querySelectorAll("video").length || 0,
        stageChildCount: stage?.children?.length || 0,
        debug: dbg,
      };
    });
    diag = stuck?.debug?.publishDiagnostics || null;

    await page.close().catch(() => null);
    await ctx.close().catch(() => null);
  } finally {
    await browser.close().catch(() => null);
  }

  return { label, headless, publishOk, stuck, diag, consoleLines };
}

function inferBlockedStep(diag) {
  if (!diag) return "unknown";
  if (diag.blockedAt) return diag.blockedAt;
  if (diag.lastStep) return diag.lastStep;
  const steps = diag.steps?.map((s) => s.step) || [];
  if (steps.length === 0) return "no-steps";
  return steps[steps.length - 1];
}

function writeReport(extra) {
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;

  const md = `# Live Platform — ZEGO Publish Blocker Debug

**日付:** ${new Date().toISOString().slice(0, 10)}  
**目的:** host publish が \`provider=live\` に到達しない SDK/WebRTC 停止点の特定  
**PoC URL:** ${extra.pocUrl || "—"}  
**Verdict:** **${extra.verdict}**

---

## Executive summary

| 項目 | 結果 |
| --- | --- |
| Token API | ${extra.tokenOk ? "PASS" : "FAIL"} |
| env / .dev.vars | ${extra.envOk ? "PASS" : "FAIL"} |
| headless publish | ${extra.headless?.publishOk ? "PASS" : "FAIL"} · blocked=\`${extra.headlessBlocked}\` |
| headed publish | ${extra.headed?.publishOk ? "PASS" : "FAIL"} · blocked=\`${extra.headedBlocked}\` |
| local video DOM | host headless videos=${extra.headless?.stuck?.videoCount ?? "—"} · headed=${extra.headed?.stuck?.videoCount ?? "—"} |

**停止 SDK call（推定）:** \`${extra.primaryBlocked}\`

${extra.recommendation || ""}

---

## 確認結果

| # | 項目 | 結果 | 詳細 |
| --- | --- | --- | --- |
${results.map((r, i) => `| ${i + 1} | ${r.id} | **${r.status}** | ${r.detail || "—"} |`).join("\n")}

**Summary:** PASS ${pass} · FAIL ${fail}

---

## Adapter publish diagnostics

### headless

\`\`\`json
${JSON.stringify(extra.headless?.diag || {}, null, 2)}
\`\`\`

### headed

\`\`\`json
${JSON.stringify(extra.headed?.diag || {}, null, 2)}
\`\`\`

---

## SDK steps timeline (headless)

${(extra.headless?.diag?.steps || []).map((s) => `- \`${s.step}\` @ ${s.at}${s.error ? ` — ${s.error}` : ""}`).join("\n") || "—"}

---

## SDK events (headless · 抜粋)

${(extra.headless?.diag?.sdkEvents || [])
  .slice(0, 20)
  .map((e) => `- \`${e.event}\` ${JSON.stringify(e.payloadSummary || {})}`)
  .join("\n") || "—"}

---

## Stuck snapshot (headless)

\`\`\`json
${JSON.stringify(extra.headless?.stuck || {}, null, 2)}
\`\`\`

---

## Console trace (headless · 抜粋)

${(extra.headless?.consoleLines || []).slice(0, 30).map((l) => `- ${l}`).join("\n") || "—"}

---

## 分析メモ

| 確認項目 | 所見 |
| --- | --- |
| publish 順序 | initialize → token → loginRoom → createStream → startPublishingStream |
| token / roomId / userId | API 200 · adapter \`token:ok\` まで到達 |
| camera/mic | Playwright fake media + permissions 付与 |
| HTTPS / localhost | \`http://127.0.0.1:8788\` secure context |
| PROVIDER_CONNECTED | publish 完了後のみ emit（現状未到達） |

---

## 次アクション

${extra.nextActions || "—"}
`;

  fs.mkdirSync(path.dirname(REPORT_MD), { recursive: true });
  fs.writeFileSync(REPORT_MD, md, "utf8");
  fs.writeFileSync(
    REPORT_JSON,
    JSON.stringify({ results, ...extra, generatedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
  console.log(`\n  Report: ${path.relative(ROOT, REPORT_MD)}`);
}

async function main() {
  console.log("\n=== ZEGO Publish Blocker Debug ===\n");

  const env = readZegoEnv();
  console.log(`  ZEGO_APP_ID=${maskEnvValue("ZEGO_APP_ID")}`);
  console.log(`  ZEGO_SERVER=${maskEnvValue("ZEGO_SERVER")}`);
  console.log(`  ZEGO_SERVER_SECRET=${maskEnvValue("ZEGO_SERVER_SECRET")}`);

  const envOk = env.ok;
  record("env:zego", envOk ? "PASS" : "FAIL", envOk ? "present" : env.missing.join(", "));

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
    record("dev:8788", "FAIL", "not listening — run npm run dev");
    writeReport({ verdict: "NO-GO", envOk, tokenOk: false, primaryBlocked: "dev-not-running" });
    process.exitCode = 1;
    return;
  }

  const roomId = `publish-blocker-${Date.now()}`;
  let tokenOk = true;
  for (const c of [
    { id: "token:host", userId: "dbg_host", role: "host" },
    { id: "token:audience", userId: "dbg_aud", role: "audience" },
  ]) {
    const res = await fetch(`${base}/api/tlv-zego-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, userId: c.userId, role: c.role }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 200 && body.configured && body.token) {
      record(c.id, "PASS", `configured=${body.configured} len=${body.token.length}`);
    } else {
      tokenOk = false;
      record(c.id, "FAIL", `status=${res.status} configured=${body.configured}`);
    }
  }

  console.log("\n--- headless probe ---");
  const headless = await runPublishProbe({ label: "headless", headless: true, base, roomId });
  const headlessBlocked = inferBlockedStep(headless.diag);
  record(
    "publish:headless",
    headless.publishOk ? "PASS" : "FAIL",
    headless.publishOk ? "provider=live" : `blocked=${headlessBlocked}`,
  );
  record(
    "video:headless",
    headless.stuck?.videoCount > 0 ? "PASS" : "FAIL",
    `videos=${headless.stuck?.videoCount ?? 0}`,
  );

  console.log("\n--- headed probe ---");
  const headed = await runPublishProbe({ label: "headed", headless: false, base, roomId: `${roomId}-h` });
  const headedBlocked = inferBlockedStep(headed.diag);
  record(
    "publish:headed",
    headed.publishOk ? "PASS" : "FAIL",
    headed.publishOk ? "provider=live" : `blocked=${headedBlocked}`,
  );
  record(
    "video:headed",
    headed.stuck?.videoCount > 0 ? "PASS" : "FAIL",
    `videos=${headed.stuck?.videoCount ?? 0}`,
  );

  const primaryBlocked = headlessBlocked !== "unknown" ? headlessBlocked : headedBlocked;
  const anyPublishPass = headless.publishOk || headed.publishOk;
  const verdict = anyPublishPass ? "GO (publish unblock)" : "NO-GO (publish blocked)";

  let recommendation = "";
  let nextActions = "";

  if (primaryBlocked.startsWith("loginRoom:start") && !primaryBlocked.includes(":done")) {
    recommendation =
      "\n**所見:** `loginRoom` が resolve/reject せずハング。Token は valid だが SDK シグナリング/WebSocket 接続待ちの可能性。";
    nextActions =
      "1. DevTools Network で ZEGO server への WS 接続確認\n2. `ZEGO_SERVER` リージョンと AppID の一致確認\n3. 手動 Chrome で同一 PoC を試し WS/roomStateUpdate を確認";
  } else if (primaryBlocked.startsWith("createZegoStream") || primaryBlocked.startsWith("createStream")) {
    recommendation =
      "\n**所見:** room login 後、`createStream` / `getUserMedia` で停止。Playwright fake media でも失敗する場合は SDK API 互換性を疑う。";
    nextActions =
      "1. 手動 Chrome で camera 許可後に publish\n2. SDK 3.12 createZegoStream vs createStream 分岐確認\n3. Permissions-Policy / iframe 制約確認";
  } else if (primaryBlocked.startsWith("startPublishingStream")) {
    recommendation =
      "\n**所見:** local stream 作成後 publish で停止。ICE/TURN または publisher state 遷移待ちの可能性。";
    nextActions =
      "1. `publisherStateUpdate` イベント内容確認\n2. ZEGO Console で stream publish ログ確認\n3. 手動 Chrome 2-window test";
  } else if (anyPublishPass) {
    recommendation = "\n**所見:** いずれかのモードで publish PASS — audience play 確認へ進める。";
    nextActions = "1. `verify-platform-live-zego-browser-play-check.mjs` 再実行\n2. audience join/play 確認";
  } else {
    recommendation = `\n**所見:** publish は \`${primaryBlocked}\` で停止。Adapter 診断 steps/sdkEvents を参照。`;
    nextActions =
      "1. レポート JSON の steps タイムライン確認\n2. 手動 Chrome で DevTools Console `[ZegoAdapterPublishDiag]` を確認\n3. 必要なら SDK バージョン/Server 設定見直し";
  }

  writeReport({
    verdict,
    envOk,
    tokenOk,
    pocUrl: `${base}/${POC_PAGE}`,
    roomId,
    headless,
    headed,
    headlessBlocked,
    headedBlocked,
    primaryBlocked,
    recommendation,
    nextActions,
  });

  if (!anyPublishPass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
