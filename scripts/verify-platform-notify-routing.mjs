/**
 * プラット通知導線 — 通知タブ / TASFUL TALK / 手数料支払い / Connect完了
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { BASE_URL, requireDevServer } from "./lib/dev-base-url.mjs";

const OUT_DIR = "screenshots/platform-notify-routing";

function storageSeed() {
  return {
    notifications: "tasful_talk_notifications",
    threads: "tasful_chat_threads",
    fees: "tasful_platform_chat_fees_v1",
    messages: "tasful_chat_messages",
  };
}

async function run() {
  await requireDevServer();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  const keys = storageSeed();

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  // --- 1. マスター通知 + 通知タブ / TALK 表示 ---
  await page.goto(`${BASE_URL}/talk-home.html?tab=notify`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(5000);

  const masterAudit = await page.evaluate(() => {
    const list = window.TasuTalkNotifications?.getAll?.() || [];
    const feeRows = list.filter(
      (n) =>
        String(n.id || "").startsWith("platform-fee-") ||
        n.source === "platform_fee_master_v1" ||
        n.source === "platform_fee_v1"
    );
    const prepay = feeRows.filter((n) => n.title?.includes("手数料が必要"));
    const complete = feeRows.filter((n) => n.title === "取引が完了しました");
    const firstPrepay = prepay[0];
    const firstComplete = complete[0];
    const officialMsgs =
      window.TasuTalkOfficialRooms?.getRoomMessages?.("official_tasful") || [];
    const talkCards = officialMsgs.filter((m) => m.kind === "notify_card");
    return {
      feeCount: feeRows.length,
      prepayCount: prepay.length,
      completeCount: complete.length,
      talkCardCount: talkCards.length,
      prepay: firstPrepay
        ? {
            title: firstPrepay.title,
            actionLabel: firstPrepay.actionLabel,
            body: firstPrepay.body,
            href: firstPrepay.href,
          }
        : null,
      complete: firstComplete
        ? { title: firstComplete.title, actionLabel: firstComplete.actionLabel, href: firstComplete.href }
        : null,
    };
  });

  if (masterAudit.prepayCount < 4) errors.push(`prepay master count ${masterAudit.prepayCount} < 4`);
  if (masterAudit.completeCount < 2) errors.push(`complete master count ${masterAudit.completeCount} < 2`);
  if (!masterAudit.prepay?.actionLabel?.includes("確認")) {
    errors.push("prepay actionLabel missing 確認する");
  }
  if (masterAudit.prepay?.body) errors.push("prepay body should be empty");
  if (!masterAudit.prepay?.href?.includes("platform-chat-fee-pay")) {
    errors.push(`prepay href unexpected: ${masterAudit.prepay?.href}`);
  }
  if (!masterAudit.complete?.href || masterAudit.complete.href === "#") {
    errors.push("complete notification href missing");
  }
  if (masterAudit.complete?.href?.includes("deal-detail.html")) {
    errors.push(`complete href should be chat, got ${masterAudit.complete.href}`);
  }

  await page.screenshot({ path: path.join(OUT_DIR, "01-notify-tab-390.png") });

  await page.goto(`${BASE_URL}/talk-home.html?tab=chat`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT_DIR, "02-talk-list-390.png") });

  await page.goto(`${BASE_URL}/talk-home.html?tab=chat&room=official_tasful`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, "03-talk-official-tasful-390.png") });

  // --- 2. Connectなし: CTA → 手数料 → 支払い → チャット活性化 ---
  await page.goto(`${BASE_URL}/detail-skill.html?id=demo-skill-001`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
  await page.waitForTimeout(600);

  await Promise.all([
    page.waitForURL(/platform-chat-fee-pay\.html/, { timeout: 15000 }),
    page.locator(".cta-consult").first().click(),
  ]);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, "04-fee-pay-390.png") });

  const prePayThread = await page.evaluate(() => {
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get("thread") || "";
    let status = "";
    try {
      const raw = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
      const row = Array.isArray(raw) ? raw.find((t) => String(t.id) === threadId) : null;
      status = row?.status || "";
    } catch {
      /* ignore */
    }
    return { threadId, status };
  });

  if (prePayThread.status !== "fee_pending") {
    errors.push(`expected fee_pending before pay, got ${prePayThread.status || "(empty)"}`);
  }

  const runtimePrepayNotify = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem("tasful_talk_notifications");
      const list = raw ? JSON.parse(raw) : [];
      return (Array.isArray(list) ? list : []).find(
        (n) => n.source === "platform_fee_v1" && String(n.title || "").includes("手数料が必要")
      );
    } catch {
      return null;
    }
  });
  if (!runtimePrepayNotify) errors.push("runtime prepay notification missing after skill CTA");

  await page.click("[data-platform-fee-pay]");
  await page.waitForSelector("[data-platform-fee-complete]:not([hidden])", { timeout: 15000 });

  const completeUi = await page.evaluate(() => ({
    title: document.querySelector("[data-platform-fee-complete] .shop-checkout__title")?.textContent?.trim(),
    lead: document.querySelector(".shop-platform-fee-complete__lead")?.textContent?.trim(),
    chatLabel: document.querySelector("[data-platform-fee-chat-link]")?.textContent?.trim(),
    listingLabel: document.querySelector("[data-platform-fee-listing-link]")?.textContent?.trim(),
    chatHref: document.querySelector("[data-platform-fee-chat-link]")?.getAttribute("href") || "",
  }));
  if (completeUi.title !== "支払いが完了しました") {
    errors.push(`complete title: ${completeUi.title}`);
  }
  if (!completeUi.lead?.includes("やりとり")) {
    errors.push(`complete lead: ${completeUi.lead}`);
  }
  if (completeUi.chatLabel !== "やりとりチャットへ") {
    errors.push(`complete chat CTA: ${completeUi.chatLabel}`);
  }
  if (completeUi.listingLabel !== "対象ページへ戻る") {
    errors.push(`complete listing CTA: ${completeUi.listingLabel}`);
  }
  if (!completeUi.chatHref.includes("chat-detail.html") && !completeUi.chatHref.includes("chat-list.html")) {
    errors.push(`complete chat href: ${completeUi.chatHref}`);
  }

  await page.click("[data-platform-fee-chat-link]");
  await page.waitForURL(/chat-(detail|list)\.html/, { timeout: 15000 });
  await page.waitForTimeout(600);

  const postPay = await page.evaluate((threadId) => {
    let status = "";
    let msgCount = 0;
    let feePaid = false;
    let activatedNotify = false;
    try {
      const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
      const row = Array.isArray(threads) ? threads.find((t) => String(t.id) === threadId) : null;
      status = row?.status || "";
      const msgs = JSON.parse(localStorage.getItem("tasful_chat_messages") || "{}");
      msgCount = Array.isArray(msgs?.[threadId]) ? msgs[threadId].length : 0;
      const fees = JSON.parse(localStorage.getItem("tasful_platform_chat_fees_v1") || "[]");
      const fee = Array.isArray(fees) ? fees.find((f) => String(f.threadId) === threadId) : null;
      feePaid = String(fee?.status || "").toLowerCase() === "paid";
      const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      activatedNotify = (Array.isArray(notifs) ? notifs : []).some(
        (n) => n.feePhase === "chat_activated" && String(n.threadId) === threadId
      );
    } catch {
      /* ignore */
    }
    return { status, msgCount, feePaid, activatedNotify };
  }, prePayThread.threadId);

  if (postPay.status !== "open") errors.push(`expected open after pay, got ${postPay.status}`);
  if (!postPay.feePaid) errors.push("fee not marked paid");
  if (postPay.msgCount < 1) errors.push("messages not seeded after activation");
  if (!postPay.activatedNotify) errors.push("chat_activated notification missing");

  await page.screenshot({ path: path.join(OUT_DIR, "05-chat-after-fee-pay-390.png") });

  // --- 3. Connectあり完了通知（マスター確認 + ボタン遷移） ---
  await page.goto(`${BASE_URL}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const completeCard = page.locator('[data-talk-notify-id]').filter({ hasText: "取引が完了しました" }).first();
  const completeCount = await completeCard.count();
  if (completeCount < 1) errors.push("complete notification card not in notify tab");

  if (completeCount > 0) {
    const href = await completeCard.locator("a, button").filter({ hasText: "確認する" }).first().getAttribute("href");
    if (!href || href === "#") {
      const dataHref = await completeCard.evaluate((el) => {
        const btn = el.querySelector("[data-talk-notify-action], a, button");
        return btn?.getAttribute("href") || btn?.dataset?.href || "";
      });
      if (!dataHref || dataHref === "#") errors.push("complete notification 確認する href missing");
    }
    await page.screenshot({ path: path.join(OUT_DIR, "06-connect-complete-notify-390.png") });
  }

  // --- 4. 求人 — 最小通知 + TALK（手数料ゲート対象外） ---
  await page.evaluate((k) => {
    try {
      const raw = localStorage.getItem(k.notifications);
      const list = raw ? JSON.parse(raw) : [];
      const filtered = (Array.isArray(list) ? list : []).filter(
        (n) => !(n.source === "job" && n.title === "この求人に応募がありました")
      );
      localStorage.setItem(k.notifications, JSON.stringify(filtered));
    } catch {
      /* ignore */
    }
  }, keys);

  await page.goto(`${BASE_URL}/detail-job.html?id=demo-job-001`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
  await page.waitForTimeout(500);

  const jobApply = await page.evaluate(() => {
    const listing = window.__tasuDetailContactListing || window.__tasuListingDetail;
    const store = window.TasuJobApplicationsStore;
    if (!store?.submitApplication || !listing) return { ok: false, reason: "missing_store" };
    return store.submitApplication(listing);
  });

  if (!jobApply?.ok && jobApply?.reason !== "already_applied") {
    errors.push(`job apply failed: ${jobApply?.reason || "unknown"}`);
  }

  await page.goto(`${BASE_URL}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const jobNotify = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem("tasful_talk_notifications");
      const list = raw ? JSON.parse(raw) : [];
      const row = (Array.isArray(list) ? list : []).find(
        (n) => n.source === "job" && n.title === "この求人に応募がありました"
      );
      const officialMsgs =
        window.TasuTalkOfficialRooms?.getRoomMessages?.("official_tasful") || [];
      const talkMirror = officialMsgs.some(
        (m) => m.kind === "notify_card" && m.text === "この求人に応募がありました"
      );
      return row
        ? {
            title: row.title,
            actionLabel: row.actionLabel,
            body: row.body,
            href: row.href || row.targetUrl,
            sendTalkMessage: row.sendTalkMessage,
            minimalNotifyCard: row.minimalNotifyCard,
            talkMirror,
          }
        : null;
    } catch {
      return null;
    }
  });

  if (!jobNotify) errors.push("job application notification missing");
  else {
    if (jobNotify.actionLabel !== "確認する") errors.push(`job actionLabel: ${jobNotify.actionLabel}`);
    if (jobNotify.body) errors.push("job body should be empty");
    if (!jobNotify.sendTalkMessage) errors.push("job sendTalkMessage false");
    if (!jobNotify.minimalNotifyCard) errors.push("job minimalNotifyCard false");
    if (!jobNotify.href?.includes("detail-job")) errors.push(`job href: ${jobNotify.href}`);
    if (!jobNotify.href?.includes("#applications")) errors.push(`job href missing #applications: ${jobNotify.href}`);
    if (!jobNotify.href?.includes("userId=")) errors.push(`job href missing userId: ${jobNotify.href}`);
    if (!jobNotify.talkMirror) errors.push("job notification not mirrored to TASFUL TALK");
  }

  const jobFeeRules = await page.evaluate(() => {
    const Fee = window.TasuPlatformChatFee;
    const listing = { listing_type: "job", id: "demo-job-001" };
    return {
      gate: Fee?.shouldGateChatStart?.(listing),
      connect: Fee?.hasStripeConnect?.(listing, "job"),
      completion: Fee?.shouldNotifyOnCompletion?.(listing),
      flatFee: Fee?.calcJobChatFee?.(),
    };
  });
  if (!jobFeeRules.gate) errors.push("job should gate chat at 550 yen");
  if (jobFeeRules.connect) errors.push("job should not use Connect");
  if (jobFeeRules.completion) errors.push("job should not have completion fee");
  if (jobFeeRules.flatFee !== 550) errors.push(`job flat fee expected 550, got ${jobFeeRules.flatFee}`);

  await page.screenshot({ path: path.join(OUT_DIR, "07-job-notify-tab-390.png") });

    });

  const report = {
    masterAudit,
    prePayThread,
    postPay,
    jobNotify,
    jobFeeRules,
    errors,
    screenshots: fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png")),
  };

  console.log(JSON.stringify(report, null, 2));
  if (errors.length) {
    errors.forEach((e) => console.error(`NG: ${e}`));
    await closeAllBrowsers();
    process.exit(1);
  }
  console.log("ALL OK — platform notify routing verified");
}

await run();
