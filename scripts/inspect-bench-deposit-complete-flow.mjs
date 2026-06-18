#!/usr/bin/env node
/**
 * Connectなし — 支払い報告後の入金確認→完了通知→レビュー導線（2窓ベンチ実UI）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const EXACT_PATH =
  "/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=skill-0";
const OUT_DIR = path.join("screenshots", "bench-deposit-complete-flow");
fs.mkdirSync(OUT_DIR, { recursive: true });

const contactId = "contact-demo-skill-dual-001";
const errors = [];
const pushErr = (m) => {
  errors.push(m);
  console.error(`NG: ${m}`);
};

async function audit(page) {
  return page.evaluate(() => window.__tasuBenchAudit?.() || {});
}

async function readChatFrame(page, frameId) {
  return page.evaluate((id) => {
    const doc = document.getElementById(id)?.contentWindow?.document;
    if (!doc) return {};
    return {
      depositGuide: doc.querySelector("[data-manual-deposit-card] .chat-manual-pay__note")?.textContent?.trim() || "",
      depositBtn: doc.querySelector("[data-manual-pay-confirm-deposit]")?.textContent?.trim() || "",
      reviewBody: doc.querySelector("[data-platform-job-review-prompt] .chat-job-review-prompt__body")?.textContent?.trim() || "",
      reviewStars: doc.querySelector("[data-platform-job-review-prompt] .chat-job-review-prompt__stars")?.textContent?.trim() || "",
      reviewBtn: doc.querySelector("[data-platform-job-review-prompt] [data-platform-job-review-open]")?.textContent?.trim() || "",
      hasReview: Boolean(doc.querySelector("[data-platform-job-review-prompt]")),
    };
  }, frameId);
}

async function clickNotifyCta(page, frameSelector, titlePattern) {
  const frame = page.frameLocator(frameSelector);
  const card = frame.locator(".talk-notify-card").filter({ hasText: titlePattern }).first();
  await card.waitFor({ state: "visible", timeout: 20000 });
  await card
    .locator(
      '[data-talk-notify-action="navigate"], [data-talk-notify-action], .talk-notify-card__action'
    )
    .first()
    .click({ timeout: 10000 });
}

const headed = process.env.PLAYWRIGHT_HEADED === "1";
const slowMo = Number(process.env.PLAYWRIGHT_SLOWMO || 0) || 0;
const browser = await chromium.launch({ headless: !headed, slowMo });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();

try {
  await page.goto(`${BASE}${EXACT_PATH}&liveFlowReset=1`, { waitUntil: "domcontentloaded", timeout: 45000 });
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
  page.once("dialog", (d) => d.accept());
  await page.frameLocator("#frame-a-chat").locator("[data-platform-fee-pay]").click();
  await page.waitForTimeout(4000);

  const threadId = await page.evaluate(() => {
    const rows = window.TasuChatThreadStore?.readAll?.() || [];
    return rows.find((t) => String(t.contactId || "") === "contact-demo-skill-dual-001")?.id || rows.at(-1)?.id || "";
  });

  const chatA =
    `${BASE}/chat-detail.html?thread=${encodeURIComponent(threadId)}` +
    `&userId=u_sachi&talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&benchEmbed=1`;
  await page.locator("#frame-a-chat").evaluate((el, url) => {
    el.src = url;
  }, chatA);
  await page.waitForTimeout(2500);
  await page.waitForFunction(
    () =>
      document.getElementById("frame-a-chat")?.contentWindow?.document?.body?.dataset?.chatDetailReady ===
      "true",
    { timeout: 20000 }
  );

  await page.frameLocator("#frame-a-chat").locator("#chatCompleteBtn").click();
  await page.frameLocator("#frame-a-chat").locator("#chatCompleteSubmit").click();
  await page.waitForTimeout(2000);

  await clickNotifyCta(page, "#frame-b-notify", /納品完了|完了.*申請|申請しました/);
  await page.waitForTimeout(3000);
  await page.frameLocator("#frame-b-chat").locator("[data-connect-complete-approve]").first().click({
    force: true,
    timeout: 15000,
  });
  await page.waitForTimeout(2500);

  await page.frameLocator("#frame-b-chat").locator("[data-manual-pay-report-paid]").first().click({
    force: true,
    timeout: 15000,
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.postNotifyRefreshAllFrames?.());
  await page.waitForTimeout(1500);

  const afterPaid = await page.evaluate(() => {
    const aWin = document.getElementById("frame-a-notify")?.contentWindow;
    const rows =
      aWin?.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false, showMuted: true }) || [];
    const row = rows.find((n) => /購入者が支払いました/.test(n.title || ""));
    return {
      title: row?.title,
      body: row?.body,
      cta: row?.actionLabel,
      href: row?.href || row?.targetUrl,
    };
  });

  if (afterPaid.title !== "購入者が支払いました") pushErr(`A notify title=${afterPaid.title}`);
  if (afterPaid.body !== "入金を確認してください") pushErr(`A notify body=${afterPaid.body}`);
  if (afterPaid.cta !== "入金を確認する") pushErr(`A notify CTA=${afterPaid.cta}`);
  if (!/[?&]thread=/.test(afterPaid.href || "")) pushErr(`A notify href missing thread: ${afterPaid.href}`);

  await clickNotifyCta(page, "#frame-a-notify", /購入者が支払いました/);
  await page.waitForTimeout(3500);
  await page.waitForFunction(
    () => /chat-detail\.html/.test(document.getElementById("frame-a-chat")?.src || ""),
    { timeout: 15000 }
  );

  const beforeDeposit = await audit(page);
  const beforeAChat = await readChatFrame(page, "frame-a-chat");
  const beforeBChat = await readChatFrame(page, "frame-b-chat");
  if (!beforeDeposit.frameAChat?.hasDepositCard) pushErr("A deposit card missing");
  if (!beforeDeposit.frameAChat?.hasDepositBtn) pushErr("A deposit confirm button missing");
  if (beforeDeposit.frameAChat?.hasReviewPrompt) pushErr("A review shown before 取引完了");
  if (beforeDeposit.frameBChat?.hasReviewPrompt) pushErr("B review shown before 取引完了");
  if (beforeAChat.depositBtn !== "取引完了") pushErr(`A deposit button=${beforeAChat.depositBtn}`);
  if (!/購入者から支払い報告がありました/.test(beforeAChat.depositGuide || "")) {
    pushErr(`A deposit guide missing: ${beforeAChat.depositGuide}`);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "00-before-deposit-parent.png"), fullPage: true });
  await page.locator("#frame-a-chat").screenshot({ path: path.join(OUT_DIR, "00-a-deposit-card.png") });

  await page.frameLocator("#frame-a-chat").locator("[data-manual-pay-confirm-deposit]").first().click({
    force: true,
    timeout: 15000,
  });
  await page.waitForTimeout(3500);
  await page.evaluate(() => window.postNotifyRefreshAllFrames?.());
  await page.waitForTimeout(1500);
  await page.waitForFunction(
    () =>
      Boolean(
        document
          .getElementById("frame-b-chat")
          ?.contentWindow?.document?.querySelector("[data-platform-job-review-prompt]")
      ),
    { timeout: 15000 }
  ).catch(() => null);

  const afterComplete = await audit(page);
  const notifies = await page.evaluate(
    ({ roomStatus, aReview, bReview }) => {
      const read = (frameId, uid) => {
        const win = document.getElementById(frameId)?.contentWindow;
        const rows =
          win?.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false, showMuted: true }) ||
          [];
        return rows
          .filter((n) => /取引が完了しました/.test(n.title || ""))
          .map((n) => ({
            userId: uid,
            title: n.title,
            cta: n.actionLabel,
          }));
      };
      return {
        a: read("frame-a-notify", "u_sachi"),
        b: read("frame-b-notify", "u_hiro"),
        roomStatus,
        aReview,
        bReview,
      };
    },
    {
      roomStatus: afterComplete.frameAChat?.roomStatus,
      aReview: afterComplete.frameAChat?.hasReviewPrompt,
      bReview: afterComplete.frameBChat?.hasReviewPrompt,
    }
  );

  if (afterComplete.frameAChat?.roomStatus !== "completed") {
    pushErr(`A roomStatus=${afterComplete.frameAChat?.roomStatus}`);
  }
  if (!notifies.a.length) pushErr("A missing 取引が完了しました notify");
  if (!notifies.b.length) pushErr("B missing 取引が完了しました notify");
  if (notifies.a[0]?.cta !== "レビューする") pushErr(`A complete CTA=${notifies.a[0]?.cta}`);
  if (notifies.b[0]?.cta !== "レビューする") pushErr(`B complete CTA=${notifies.b[0]?.cta}`);
  if (!notifies.aReview) pushErr("A chat review prompt missing");
  if (!notifies.bReview) pushErr("B chat review prompt missing");

  const afterAChat = await readChatFrame(page, "frame-a-chat");
  const afterBChat = await readChatFrame(page, "frame-b-chat");
  const reviewBodyExpected = "取引ありがとうございました。評価をお願いします。";
  if (afterAChat.reviewBody !== reviewBodyExpected) pushErr(`A review body=${afterAChat.reviewBody}`);
  if (afterBChat.reviewBody !== reviewBodyExpected) pushErr(`B review body=${afterBChat.reviewBody}`);
  if (afterAChat.reviewStars !== "★★★★★") pushErr(`A review stars=${afterAChat.reviewStars}`);
  if (afterBChat.reviewStars !== "★★★★★") pushErr(`B review stars=${afterBChat.reviewStars}`);
  if (afterAChat.reviewBtn !== "レビューする") pushErr(`A review btn=${afterAChat.reviewBtn}`);
  if (afterBChat.reviewBtn !== "レビューする") pushErr(`B review btn=${afterBChat.reviewBtn}`);

  await page.screenshot({ path: path.join(OUT_DIR, "01-after-complete-parent.png"), fullPage: true });
  await page.locator("#frame-a-chat").screenshot({ path: path.join(OUT_DIR, "02-a-chat-review.png") });
  await page.locator("#frame-b-chat").screenshot({ path: path.join(OUT_DIR, "03-b-chat-review.png") });

  const report = {
    threadId,
    afterPaid,
    beforeDeposit,
    beforeAChat,
    beforeBChat,
    afterComplete,
    afterAChat,
    afterBChat,
    notifies,
    errors,
    ok: !errors.length,
  };
  fs.writeFileSync(path.join(OUT_DIR, "audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exit(1);
} finally {
  await browser.close();
}
