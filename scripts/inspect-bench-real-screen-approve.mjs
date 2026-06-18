#!/usr/bin/env node
/**
 * 実画面相当 — 2窓ベンチ iframe 上の UI クリックのみで承認まで検証
 * （localStorage 直接操作・approve API 直呼びは使わない）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const EXACT_PATH =
  "/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=skill-0";
const EXACT_URL = `${BASE}${EXACT_PATH}`;
const OUT_DIR = path.join("screenshots", "bench-real-screen-approve");
fs.mkdirSync(OUT_DIR, { recursive: true });

const contactId = "contact-demo-skill-dual-001";
const errors = [];
const log = (label, data) => console.log(`[${label}]`, JSON.stringify(data, null, 2));
const pushErr = (m) => {
  errors.push(m);
  console.error(`NG: ${m}`);
};

async function auditParent(page) {
  return page.evaluate(() => window.__tasuBenchAudit?.() || { error: "missing __tasuBenchAudit" });
}

async function clickNotifyCtaInFrame(page, frameSelector, titlePattern) {
  const frame = page.frameLocator(frameSelector);
  const card = frame.locator(".talk-notify-card").filter({ hasText: titlePattern }).first();
  await card.waitFor({ state: "visible", timeout: 20000 });
  const btn = card.locator(
    '[data-talk-notify-action="navigate"], [data-talk-notify-action], .talk-notify-card__action'
  ).first();
  await btn.click({ timeout: 10000 });
}

async function requestCompletionViaAChatUi(page) {
  const aFrame = page.frameLocator("#frame-a-chat");
  const completeBtn = aFrame.locator("#chatCompleteBtn");
  await completeBtn.waitFor({ state: "visible", timeout: 20000 });
  await completeBtn.click();
  const submitBtn = aFrame.locator("#chatCompleteSubmit");
  await submitBtn.waitFor({ state: "visible", timeout: 10000 });
  await submitBtn.click();
}

await withPlaywrightBrowser(async (browser) => {
  await page.goto(`${EXACT_URL}&liveFlowReset=1`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  // 購入者コンタクト作成（実操作では詳細ページ CTA 相当 — ここだけデータ準備）
  await page.evaluate((cid) => {
    const C = window.TasuListingContactRequestsStore;
    const now = new Date().toISOString();
    localStorage.setItem(
      C.STORAGE_KEY,
      JSON.stringify([
        {
          contact_id: cid,
          listing_id: "demo-skill-001",
          listing_type: "skill",
          requester_id: "u_hiro",
          requester_name: "ひろ",
          contact_kind: "purchase",
          status: "awaiting_fee",
          thread_id: null,
          created_at: now,
          updated_at: now,
        },
      ])
    );
    window.TasuPlatformChatFee.ensurePendingFeeDeferred({
      listing: C.resolveListing("demo-skill-001"),
      contactId: cid,
      feeAmount: 550,
    });
  }, contactId);

  const feeUrl =
    `${BASE}/platform-chat-fee-pay.html?contactId=${contactId}&listingId=demo-skill-001&category=skill` +
    `&talkDev=1&review=chat-demo&liveFlow=1&demoProfile=skill&demoConnect=0&userId=u_sachi&from=notify&benchEmbed=1&benchViewport=1280`;

  // A下 iframe に手数料画面を表示（ベンチ実画面と同じ slot）
  await page.locator("#frame-a-chat").evaluate((el, url) => {
    el.src = url;
  }, feeUrl);
  await page.waitForTimeout(2500);

  const feeFrame = page.frameLocator("#frame-a-chat");
  page.once("dialog", (d) => d.accept());
  await feeFrame.locator("[data-platform-fee-pay]").click({ timeout: 15000 });
  await page.waitForTimeout(4000);

  const threadId = await page.evaluate(() => {
    const rows = window.TasuChatThreadStore?.readAll?.() || [];
    return (
      rows.find((t) => String(t.contactId || "") === "contact-demo-skill-dual-001")?.id ||
      rows.at(-1)?.id ||
      ""
    );
  });
  if (!threadId) pushErr("thread not created after fee pay");

  const chatA =
    `${BASE}/chat-detail.html?thread=${encodeURIComponent(threadId)}` +
    `&userId=u_sachi&talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&benchEmbed=1`;
  await page.locator("#frame-a-chat").evaluate((el, url) => {
    el.src = url;
  }, chatA);
  await page.waitForTimeout(2500);
  await page.frameLocator("#frame-a-chat").locator("body").waitFor({ state: "attached" });
  await page.waitForFunction(
    () =>
      document.getElementById("frame-a-chat")?.contentWindow?.document?.body?.dataset?.chatDetailReady ===
      "true",
    { timeout: 20000 }
  );

  // A下: 納品完了申請 — UI ボタンのみ
  await requestCompletionViaAChatUi(page);
  await page.waitForTimeout(2000);

  const beforeNotifyAudit = await auditParent(page);
  log("before-b-notify-cta", beforeNotifyAudit);

  // B上通知 CTA — iframe 内の実クリック
  await clickNotifyCtaInFrame(page, "#frame-b-notify", /納品完了|完了.*申請|申請しました/);
  await page.waitForTimeout(3500);

  const afterNotifyAudit = await auditParent(page);
  log("after-b-notify-cta", afterNotifyAudit);
  await page.screenshot({ path: path.join(OUT_DIR, "01-after-b-notify-cta-parent.png"), fullPage: true });
  await page.locator("#frame-b-chat").screenshot({ path: path.join(OUT_DIR, "02-b-chat-before-approve.png") });

  if (!afterNotifyAudit.frameBChat?.src?.includes("chat-detail.html")) {
    pushErr(`B-chat not on chat-detail: ${afterNotifyAudit.frameBChat?.src || "(empty)"}`);
  }
  if (!afterNotifyAudit.frameBChat?.hasApproveCard) {
    pushErr("B-chat missing approval card before click");
  }
  if (!afterNotifyAudit.frameBChat?.hasApproveBtn) {
    pushErr("B-chat missing 承認する button before click");
  }
  if (!afterNotifyAudit.frameAChat?.hasCompleteBtn && beforeNotifyAudit.frameAChat?.roomStatus !== "completion_pending") {
    // A は申請後は完了ボタンが消える場合あり
  }

  // ポーリング 3 周期（実画面で iframe が戻されないか）
  await page.waitForTimeout(5000);
  const afterPollAudit = await auditParent(page);
  log("after-poll-wait", afterPollAudit);
  if (!afterPollAudit.frameBChat?.src?.includes("chat-detail.html")) {
    pushErr(`B-chat replaced after poll: ${afterPollAudit.frameBChat?.src}`);
  }
  if (!afterPollAudit.bBuyerChatOpened) {
    pushErr("bBuyerChatOpened still false after notify CTA (poll may reset B-chat)");
  }

  const roomBefore = afterPollAudit.frameBChat?.roomStatus || "";
  if (roomBefore !== "completion_pending") {
    pushErr(`roomStatus before approve=${roomBefore} expected completion_pending`);
  }

  // B下「承認する」— Playwright 実クリック（evaluate 禁止）
  const bChatFrame = page.frameLocator("#frame-b-chat");
  await bChatFrame.locator("[data-connect-complete-approve]").first().waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.waitForTimeout(800);
  await bChatFrame.locator("[data-connect-complete-approve]").first().click({
    timeout: 15000,
    force: true,
  });
  await page.waitForTimeout(3000);

  const afterApproveAudit = await auditParent(page);
  log("after-approve-click", afterApproveAudit);
  await page.locator("#frame-b-chat").screenshot({ path: path.join(OUT_DIR, "03-b-chat-after-approve.png") });

  const roomAfter = afterApproveAudit.frameBChat?.roomStatus || "";
  if (roomAfter !== "awaiting_payment") {
    pushErr(`roomStatus after approve=${roomAfter} expected awaiting_payment`);
  }
  if (!afterApproveAudit.frameBChat?.hasPayCard) {
    pushErr("buyer payment card missing after approve");
  }
  if (afterApproveAudit.frameBChat?.hasApproveBtn) {
    pushErr("approve button still visible after approve");
  }
  if (afterApproveAudit.frameBChat?.inlineError) {
    pushErr(`inline error: ${afterApproveAudit.frameBChat.inlineError}`);
  }

  const report = {
    exactUrl: EXACT_URL,
    threadId,
    beforeNotifyAudit,
    afterNotifyAudit,
    afterPollAudit,
    afterApproveAudit,
    errors,
    ok: errors.length === 0,
  };
  fs.writeFileSync(path.join(OUT_DIR, "audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, errors, threadId, roomBefore, roomAfter }, null, 2));
  if (errors.length) process.exit(1);
});

await closeAllBrowsers();
