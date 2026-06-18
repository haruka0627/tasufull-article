#!/usr/bin/env node
/**
 * Connectなし — 承認後の振込→支払い報告→入金確認→完了 検証
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const EXACT_PATH =
  "/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=skill-0";
const EXACT_URL = `${BASE}${EXACT_PATH}`;
const OUT_DIR = path.join("screenshots", "bench-b-manual-transfer");
fs.mkdirSync(OUT_DIR, { recursive: true });

const contactId = "contact-demo-skill-dual-001";
const errors = [];
const pushErr = (m) => {
  errors.push(m);
  console.error(`NG: ${m}`);
};

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();

try {
  await page.goto(EXACT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);

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

  await page.locator("#frame-a-chat").evaluate((el, url) => {
    el.src = url;
  }, feeUrl);
  await page.waitForTimeout(2500);
  const feeFrame = page.frames().find((f) => /platform-chat-fee-pay/.test(f.url()));
  await feeFrame.evaluate(() => {
    window.confirm = () => true;
    document.querySelector("[data-platform-fee-pay]")?.click();
  });
  await page.waitForTimeout(5000);

  const threadId = await page.evaluate(() => {
    const rows = window.TasuChatThreadStore?.readAll?.() || [];
    const row =
      rows.find((t) => String(t.contactId || "") === "contact-demo-skill-dual-001") || rows.at(-1);
    return row?.id || "";
  });

  const chatB =
    `${BASE}/chat-detail.html?thread=${encodeURIComponent(threadId)}` +
    `&userId=u_hiro&talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&benchEmbed=1`;
  const chatA =
    `${BASE}/chat-detail.html?thread=${encodeURIComponent(threadId)}` +
    `&userId=u_sachi&talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&benchEmbed=1`;

  await page.locator("#frame-a-chat").evaluate((el, url) => {
    el.src = url;
  }, chatA);
  await page.waitForTimeout(2000);
  const aFrame = page.frames().find((f) => /chat-detail/.test(f.url()) && f.url().includes("u_sachi"));
  await aFrame.evaluate(() => {
    const tid = new URL(location.href).searchParams.get("thread");
    const row = window.TasuChatThreadStore.readAll().find((t) => t.id === tid);
    window.TasuPlatformChatCompletionFlow.requestCompletion({
      threadId: tid,
      thread: row,
      userId: "u_sachi",
    });
  });
  await page.waitForTimeout(1500);

  const chatBPath = chatB.replace(BASE, "");
  await page.evaluate((href) => {
    window.postMessage({ type: "tasu-bench-frame-navigate", slot: "b-chat", href }, "*");
  }, chatBPath);
  await page.waitForFunction(
    () => {
      const src = document.getElementById("frame-b-chat")?.src || "";
      return /chat-detail\.html/.test(src) && src.includes("u_hiro");
    },
    { timeout: 15000 }
  );
  await page.waitForTimeout(2000);

  const bFrameEl = await page.$("#frame-b-chat");
  const bFrame = await bFrameEl.contentFrame();
  await bFrame.click("[data-connect-complete-approve]").catch(() =>
    bFrame.evaluate(() => document.querySelector("[data-connect-complete-approve]")?.click())
  );
  await page.waitForTimeout(2000);

  const afterApprove = await bFrame.evaluate(() => {
    const tid = new URL(location.href).searchParams.get("thread");
    const row = window.TasuChatThreadStore.readAll().find((t) => t.id === tid);
    return {
      roomStatus: row?.roomStatus,
      hasPayCard: Boolean(document.querySelector("[data-manual-transfer-card]")),
      hasPaidBtn: Boolean(document.querySelector("[data-manual-pay-report-paid]")),
      hasReview: Boolean(document.querySelector("[data-platform-job-review-prompt]")),
    };
  });

  if (afterApprove.roomStatus !== "awaiting_payment") {
    pushErr(`after approve status=${afterApprove.roomStatus} expected awaiting_payment`);
  }
  if (!afterApprove.hasPayCard) pushErr("buyer payment card missing after approve");
  if (!afterApprove.hasPaidBtn) pushErr("支払いました button missing");
  if (afterApprove.hasReview) pushErr("review shown too early after approve");

  await bFrame.evaluate(() => {
    document.querySelector("[data-manual-pay-report-paid]")?.click();
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.postNotifyRefreshAllFrames?.());
  await page.waitForTimeout(1000);

  const afterPaid = await page.evaluate(() => {
    const win = document.getElementById("frame-a-notify")?.contentWindow;
    const rows =
      win?.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false, showMuted: true }) ||
      [];
    const row = rows.find((n) => /購入者が支払いました/.test(n.title || ""));
    return {
      notifyTitle: row?.title,
      cta: row?.actionLabel,
      bPaidDone: Boolean(
        document
          .getElementById("frame-b-chat")
          ?.contentWindow?.document?.querySelector(".chat-manual-pay__done")
      ),
    };
  });

  if (afterPaid.notifyTitle !== "購入者が支払いました") pushErr("A notify missing 購入者が支払いました");
  if (afterPaid.cta !== "入金を確認する") pushErr(`A notify CTA=${afterPaid.cta}`);
  if (!afterPaid.bPaidDone) pushErr("B paid status not shown");

  await page.evaluate(() => window.postNotifyRefreshAllFrames?.());
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const el = document.getElementById("frame-a-notify");
    const win = el?.contentWindow;
    const doc = win?.document;
    const rows =
      win?.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false, showMuted: true }) ||
      [];
    const row = rows.find((n) => /購入者が支払いました/.test(n.title || ""));
    const btn = row
      ? doc?.querySelector(
          `[data-talk-notify-id="${row.id}"] [data-talk-notify-action="navigate"], [data-talk-notify-id="${row.id}"] [data-talk-notify-action]`
        )
      : null;
    btn?.click();
  });
  await page.waitForFunction(
    () => /chat-detail\.html/.test(document.getElementById("frame-a-chat")?.src || ""),
    { timeout: 15000 }
  );
  await page.waitForTimeout(2500);

  const msgAudit = await page.evaluate((tid) => {
    const key = window.TasuChatThreadStore.MESSAGES_KEY;
    const map = JSON.parse(localStorage.getItem(key) || "{}");
    const kinds = (map[tid] || []).map((m) => m.kind);
    const manual = window.TasuPlatformChatManualTransferFlow.getThreadState(tid);
    return { kinds, manual };
  }, threadId);
  console.log("msgAudit", msgAudit);
  const aFrameEl = await page.$("#frame-a-chat");
  const aChat = await aFrameEl.contentFrame();

  const depositCard = await aChat.evaluate(() => ({
    href: location.href,
    meId:
      new URLSearchParams(location.search).get("userId") ||
      window.TasuChatUserIdentity?.getCurrentUserId?.(),
    hasDepositCard: Boolean(document.querySelector("[data-manual-deposit-card]")),
    hasConfirmBtn: Boolean(document.querySelector("[data-manual-pay-confirm-deposit]")),
    messageKinds: [...document.querySelectorAll("#chatMessages [data-manual-deposit-card]")].length,
  }));
  console.log("depositCard", depositCard);
  if (!depositCard.hasDepositCard) pushErr("seller deposit card missing");
  if (!depositCard.hasConfirmBtn) pushErr("入金確認して完了 missing");

  await aChat.evaluate(() => {
    document.querySelector("[data-manual-pay-confirm-deposit]")?.click();
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.postNotifyRefreshAllFrames?.());
  await page.waitForTimeout(1000);

  const finalAudit = await page.evaluate(() => {
    const tid = [...window.TasuChatThreadStore.readAll()].find((t) =>
      /skill/.test(String(t.listingId || ""))
    )?.id;
    const row = window.TasuChatThreadStore.readAll().find((t) => t.id === tid);
    const bWin = document.getElementById("frame-b-notify")?.contentWindow;
    const bRows =
      bWin?.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false, showMuted: true }) ||
      [];
    const completeNotify = bRows.find((n) => /取引が完了|納品が完了|やりとりが完了/.test(n.title || ""));
    const manual = window.TasuPlatformChatManualTransferFlow.getThreadState(tid);
    return {
      roomStatus: row?.roomStatus,
      manualStatus: manual.status,
      completeNotifyTitle: completeNotify?.title,
      completeCta: completeNotify?.actionLabel,
    };
  });

  if (finalAudit.roomStatus !== "completed") pushErr(`final status=${finalAudit.roomStatus}`);
  if (finalAudit.manualStatus !== "confirmed") pushErr(`manual transfer=${finalAudit.manualStatus}`);
  if (!finalAudit.completeNotifyTitle) pushErr("B completion notify missing");
  if (!/レビュー|評価/.test(finalAudit.completeCta || "")) {
    pushErr(`B completion CTA=${finalAudit.completeCta}`);
  }

  await page.locator("#frame-b-chat").screenshot({
    path: path.join(OUT_DIR, "final-b-chat-1280.png"),
  });

  console.log(JSON.stringify({ threadId, afterApprove, afterPaid, depositCard, finalAudit, errors, ok: !errors.length }, null, 2));
  if (errors.length) process.exit(1);
} finally {
  await browser.close();
}
