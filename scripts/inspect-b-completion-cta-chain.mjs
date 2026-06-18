#!/usr/bin/env node
/**
 * 指定URLのみ — 納品完了申請通知 CTA → B下承認カード 6項目検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const EXACT_PATH =
  "/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=skill-0";
const EXACT_URL = `${BASE}${EXACT_PATH}`;
const OUT_DIR = path.join("screenshots", "bench-b-completion-cta");
fs.mkdirSync(OUT_DIR, { recursive: true });

const contactId = "contact-demo-skill-dual-001";
const errors = [];

function pushErr(msg) {
  errors.push(msg);
  console.error(`NG: ${msg}`);
}

await withPlaywrightBrowser(async (browser) => {
  await page.goto(EXACT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

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
  if (!feeFrame) throw new Error("fee-pay missing");

  await feeFrame.evaluate(() => {
    window.confirm = () => true;
    document.querySelector("[data-platform-fee-pay]")?.click();
  });
  await page.waitForTimeout(6000);

  const threadId = await page.evaluate(() => {
    const rows = window.TasuChatThreadStore?.readAll?.() || [];
    const row =
      rows.find((t) => String(t.contactId || t.contact_id || "") === "contact-demo-skill-dual-001") ||
      rows.find((t) => /demo-skill-001/i.test(String(t.listingId || t.listing_id || ""))) ||
      rows[rows.length - 1];
    return row?.id || "";
  });
  if (!threadId) pushErr("threadId not found after fee pay");

  const chatDetailUrl =
    `${BASE}/chat-detail.html?thread=${encodeURIComponent(threadId)}` +
    `&userId=u_sachi&talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&benchEmbed=1&benchViewport=1280`;

  await page.locator("#frame-a-chat").evaluate((el, url) => {
    el.src = url;
  }, chatDetailUrl);
  await page.waitForTimeout(3000);

  const aChatFrame = page.frames().find((f) => /chat-detail\.html/.test(f.url()));
  if (!aChatFrame) throw new Error("a-chat chat-detail frame missing");

  const requested = await aChatFrame.evaluate(() => {
    const tid = new URL(location.href).searchParams.get("thread");
    const row = (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(tid));
    const flow = window.TasuPlatformChatCompletionFlow;
    if (!row || !flow) return { ok: false, reason: "missing_row_or_flow" };
    if (!flow.canRequestCompletion?.(row, "u_sachi")) {
      return { ok: false, reason: "cannot_request", status: row?.roomStatus };
    }
    return flow.requestCompletion?.({
      threadId: tid,
      thread: row,
      userId: "u_sachi",
    });
  });

  if (!requested?.ok) pushErr(`requestCompletion failed: ${requested?.reason || "unknown"}`);
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    window.postNotifyRefreshAllFrames?.();
  });
  await page.waitForTimeout(1500);

  const notifyAudit = await page.evaluate(() => {
    const el = document.getElementById("frame-b-notify");
    const win = el?.contentWindow;
    const doc = win?.document;
    const rows =
      win?.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false, showMuted: true }) || [];
    const row = rows.find((n) => /納品完了|完了.*申請|申請しました/.test(String(n.title || "")));
    const card = row
      ? doc?.querySelector(
          `[data-talk-notify-id="${row.id}"] [data-talk-notify-action="navigate"], [data-talk-notify-id="${row.id}"] [data-talk-notify-action]`
        )
      : null;
    const href =
      card?.getAttribute("data-talk-notify-href") ||
      card?.getAttribute("href") ||
      row?.href ||
      row?.targetUrl ||
      "";
    const slot = win?.TasuPlatformChatBenchEmbed?.resolveBenchNavigateSlot?.(href);
    return {
      notifyTitle: row?.title || null,
      notifyHref: href,
      actionLabel: card?.textContent?.trim() || row?.actionLabel,
      threadIdOnNotify: row?.threadId || null,
      resolveSlot: slot,
      domHasCard: Boolean(card),
    };
  });

  if (!notifyAudit.notifyTitle) pushErr("completion notify missing on B-notify");
  if (notifyAudit.actionLabel !== "承認する") {
    pushErr(`CTA label: ${notifyAudit.actionLabel}`);
  }
  if (!notifyAudit.notifyHref.includes("chat-detail.html")) {
    pushErr(`notify href not chat-detail: ${notifyAudit.notifyHref}`);
  }
  if (!/[?&]thread=/.test(notifyAudit.notifyHref)) {
    pushErr(`notify href missing thread param: ${notifyAudit.notifyHref}`);
  }
  if (notifyAudit.resolveSlot !== "b-chat") {
    pushErr(`resolveBenchNavigateSlot: ${notifyAudit.resolveSlot}`);
  }

  await page.locator("#frame-b-notify").screenshot({
    path: path.join(OUT_DIR, "01-b-notify-completion-1280.png"),
  });

  const beforeBChat = await page.evaluate(() => document.getElementById("frame-b-chat")?.src || "");

  await page.evaluate(() => {
    const el = document.getElementById("frame-b-notify");
    const win = el?.contentWindow;
    const doc = win?.document;
    const rows =
      win?.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false, showMuted: true }) || [];
    const row = rows.find((n) => /納品完了|完了.*申請|申請しました/.test(String(n.title || "")));
    const card = row
      ? doc?.querySelector(
          `[data-talk-notify-id="${row.id}"] [data-talk-notify-action="navigate"], [data-talk-notify-id="${row.id}"] [data-talk-notify-action]`
        )
      : null;
    if (!card) return { ok: false, reason: "cta_missing" };
    card.click();
    return { ok: true, href: card.getAttribute("data-talk-notify-href") || card.getAttribute("href") };
  });

  await page.waitForTimeout(3500);

  const afterAudit = await page.evaluate(() => {
    const bChatSrc = document.getElementById("frame-b-chat")?.src || "";
    const debug = document.getElementById("benchDebugPanel")?.textContent || "";
    const bBuyerOpened = /bBuyerChatOpened:\s*yes/.test(debug);
    const el = document.getElementById("frame-b-chat");
    const win = el?.contentWindow;
    const doc = win?.document;
    const pendingCard = doc?.querySelector("[data-connect-pending-card]");
    const approveBtn = doc?.querySelector("[data-connect-complete-approve]");
    const rejectBtn = doc?.querySelector("[data-connect-complete-reject]");
    const fields = [...(doc?.querySelectorAll(".chat-connect-card__field dt") || [])].map((n) =>
      n.textContent?.trim()
    );
    const completionStatus =
      win?.TasuPlatformChatCompletionFlow?.getCompletionStatus?.(
        win?.TasuChatService?.getCurrentRoom?.() || {}
      ) || null;
    return {
      bChatSrc,
      bBuyerOpened,
      hasPendingCard: Boolean(pendingCard),
      hasApprove: Boolean(approveBtn),
      hasReject: Boolean(rejectBtn),
      fieldLabels: fields,
      completionStatus,
      cardTitle: doc?.querySelector(".chat-connect-card__title")?.textContent?.trim() || null,
    };
  });

  await page.locator("#frame-b-chat").screenshot({
    path: path.join(OUT_DIR, "02-b-chat-approval-card-1280.png"),
  });

  if (afterAudit.bChatSrc === beforeBChat) {
    pushErr(`B-chat src unchanged: ${afterAudit.bChatSrc}`);
  }
  if (!afterAudit.bChatSrc.includes("chat-detail.html")) {
    pushErr(`B-chat not chat-detail: ${afterAudit.bChatSrc}`);
  }
  if (!/[?&]thread=/.test(afterAudit.bChatSrc)) {
    pushErr(`B-chat missing thread: ${afterAudit.bChatSrc}`);
  }
  if (!afterAudit.bBuyerOpened) pushErr("bBuyerChatOpened still no after CTA");
  if (!afterAudit.hasPendingCard) pushErr("connect_completion pending card missing in B-chat");
  if (!afterAudit.hasApprove) pushErr("承認する button missing on card");
  if (!afterAudit.hasReject) pushErr("差し戻す button missing on card");
  if (!afterAudit.fieldLabels.includes("納品内容")) pushErr("納品内容 field missing");
  if (!afterAudit.fieldLabels.includes("申請者")) pushErr("申請者 field missing");
  if (!afterAudit.fieldLabels.includes("対象案件")) pushErr("対象案件 field missing");

  const report = {
    exactUrl: EXACT_URL,
    threadId,
    requested,
    notifyAudit,
    beforeBChat,
    afterAudit,
    navMessages,
    errors,
    ok: errors.length === 0,
  };

  console.log(JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "audit.json"), JSON.stringify(report, null, 2));

  if (errors.length) process.exit(1);
});

await closeAllBrowsers();
