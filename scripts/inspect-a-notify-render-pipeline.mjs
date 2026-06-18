#!/usr/bin/env node
/**
 * A-notify 描画パイプライン監査 — purchased + contact-gate 状態
 * 1. rows.length  2. demo-worker-001 の有無  3. filter 除外  4. store  5. reconcile ループ
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedWorkerBenchUrl } from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedWorkerBenchUrl(BASE);

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();

try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6500);

  const bFrame = page.frames().find((f) => /detail-worker/i.test(f.url()));
  if (!bFrame) throw new Error("b_detail_frame_missing");

  await bFrame.evaluate(() => {
    document.querySelector("[data-listing-primary-cta]")?.click();
  });
  await page.waitForTimeout(5500);

  // reconcile を意図的に連打して remount ループを誘発
  for (let i = 0; i < 12; i += 1) {
    await page.evaluate(() => window.__tasuBenchReconcile?.({ skipRender: true }));
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3000);

  const report = await page.evaluate(() => {
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.("worker", false);
    const partnerAId = profile?.partnerAId || "demo-worker-001";
    const storeKey = window.TasuTalkNotifications?.STORAGE_KEY || "tasful_talk_notifications";
    const storeAll = window.TasuTalkNotifications?.getAll?.() || [];
    const forSeller = storeAll.filter((n) => String(n.recipientUserId) === partnerAId);

    const aWin = document.getElementById("frame-a-notify")?.contentWindow;
    const diag = aWin?.__tasuBenchNotifyRenderDiag || null;
    const dbg = document.getElementById("benchDebugPanel")?.textContent || "";

    const pipelineStep = (name) =>
      (diag?.pipelineSteps || []).find((s) => String(s.name).includes(name)) || null;

    return {
      debug: {
        currentStep: dbg.match(/currentStep: (.+)/)?.[1]?.trim(),
        flowPhase: dbg.match(/flowPhase: (.+)/)?.[1]?.trim(),
        bBuyerChatOpened: dbg.includes("bBuyerChatOpened: yes"),
        iframeReloadANotify: Number(dbg.match(/iframe reload A-notify: (\d+)/)?.[1] || 0),
        iframeReloadBChat: Number(dbg.match(/iframe reload B-chat: (\d+)/)?.[1] || 0),
        parentRender: Number(dbg.match(/parent render: (\d+)/)?.[1] || 0),
        lastReconcile: dbg.match(/lastReconcile: (.+)/)?.[1]?.trim(),
        storageSellerNotify: dbg.match(/storage seller notify: (\d+)/)?.[1],
        aNotifyRowsLength: dbg.match(/a-notify rows\.length: (\d+|—)/)?.[1],
      },
      store: {
        key: storeKey,
        forSellerCount: forSeller.length,
        forSellerTitles: forSeller.map((n) => n.title),
      },
      iframeDiag: diag,
      dom: aWin
        ? {
            cardCount: aWin.document.querySelectorAll(".talk-notify-card").length,
            titles: [...aWin.document.querySelectorAll(".talk-notify-card__title")].map((el) =>
              el.textContent?.trim()
            ),
            emptyText: aWin.document.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || null,
          }
        : { error: "a_notify_frame_missing" },
      pipeline: {
        ensureNotifications: pipelineStep("1_ensure"),
        inboxSettings: pipelineStep("4_applyInboxSettings"),
        chatDemoFilter: pipelineStep("7_modeFilter_chat_demo"),
      },
      reconcileLoopSuspected:
        Number(dbg.match(/iframe reload A-notify: (\d+)/)?.[1] || 0) > 15 &&
        (diag?.rowsLength === 0 || (aWin?.document?.querySelectorAll(".talk-notify-card").length || 0) === 0),
    };
  });

  console.log(JSON.stringify(report, null, 2));
  const ok =
    report.store.forSellerCount > 0 &&
    (report.dom.cardCount > 0 || report.iframeDiag?.rowsLength > 0);
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
}
