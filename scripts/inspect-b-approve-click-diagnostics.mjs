#!/usr/bin/env node
/**
 * B下「承認する」クリック診断（9項目）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const EXACT_PATH =
  "/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=skill-0";
const EXACT_URL = `${BASE}${EXACT_PATH}`;
const contactId = "contact-demo-skill-dual-001";

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();

const errors = [];
const pushErr = (m) => {
  errors.push(m);
  console.error(`NG: ${m}`);
};

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

  const chatA =
    `${BASE}/chat-detail.html?thread=${encodeURIComponent(threadId)}` +
    `&userId=u_sachi&talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&benchEmbed=1`;
  const chatBPath =
    `/chat-detail.html?thread=${encodeURIComponent(threadId)}` +
    `&userId=u_hiro&talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&benchEmbed=1`;

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

  await page.evaluate((href) => {
    window.postMessage({ type: "tasu-bench-frame-navigate", slot: "b-chat", href }, "*");
  }, chatBPath);
  await page.waitForFunction(
    () => /chat-detail\.html/.test(document.getElementById("frame-b-chat")?.src || ""),
    { timeout: 15000 }
  );
  await page.waitForTimeout(2000);

  const bFrameEl = await page.$("#frame-b-chat");
  const bFrame = await bFrameEl.contentFrame();

  const preClick = await bFrame.evaluate(() => {
    const btn = document.querySelector("[data-connect-complete-approve]");
    const wrap = btn?.closest("[data-connect-pending-card]");
    return {
      bridgeFlow: document.documentElement.dataset.tasuFlowCardBridge,
      bridgeConnect: document.documentElement.dataset.tasuConnectPendingBridge,
      hasApprove: Boolean(btn),
      selectorMatch: Boolean(btn?.matches("[data-connect-complete-approve]")),
      threadIdOnCard: wrap?.getAttribute("data-thread-id") || "",
      hasOnclick: Boolean(btn?.getAttribute("onclick")),
      hasFlow: Boolean(window.TasuPlatformChatCompletionFlow?.approveCompletion),
      hasConnectFlow: Boolean(window.TasuPlatformChatConnectChatFlow?.approvePendingCompletionFromUi),
      hasDetailUi: Boolean(window.TasuChatDetailUi?.afterFlowApprove),
      roomStatusBefore:
        window.TasuChatThreadStore?.readAll?.().find(
          (t) => t.id === new URL(location.href).searchParams.get("thread")
        )?.roomStatus || null,
    };
  });

  console.log("preClick", preClick);

  if (!preClick.hasApprove) pushErr("approve button missing before click");
  if (!preClick.selectorMatch) pushErr("[data-connect-complete-approve] selector mismatch");
  if (!preClick.bridgeFlow) pushErr("tasuFlowCardBridge not registered");
  if (!preClick.bridgeConnect) pushErr("tasuConnectPendingBridge not registered");
  if (!preClick.hasFlow) pushErr("approveCompletion unavailable");
  if (!preClick.hasConnectFlow) pushErr("approvePendingCompletionFromUi unavailable");

  const clickTrace = await bFrame.evaluate(() => {
    const trace = {
      handleFlowCardClick: 0,
      onApproveCompleteSubmit: 0,
      approvePendingCompletionFromUi: 0,
      approveCompletion: 0,
      consoleErrors: [],
    };
    const origErr = console.error;
    console.error = (...args) => {
      trace.consoleErrors.push(args.map(String).join(" "));
      origErr.apply(console, args);
    };

    const detailProto = window.TasuChatDetailUi;
    const flow = window.TasuPlatformChatCompletionFlow;
    const connect = window.TasuPlatformChatConnectChatFlow;

    if (connect?.approvePendingCompletionFromUi) {
      const orig = connect.approvePendingCompletionFromUi;
      connect.approvePendingCompletionFromUi = async (...args) => {
        trace.approvePendingCompletionFromUi += 1;
        return orig(...args);
      };
    }
    if (flow?.approveCompletion) {
      const orig = flow.approveCompletion;
      flow.approveCompletion = (...args) => {
        trace.approveCompletion += 1;
        return orig(...args);
      };
    }
    if (detailProto?.afterFlowApprove) {
      const orig = detailProto.afterFlowApprove;
      detailProto.afterFlowApprove = async (...args) => {
        trace.onApproveCompleteSubmit += 1;
        return orig(...args);
      };
    }

    document.addEventListener(
      "click",
      (ev) => {
        if (ev.target?.closest?.("[data-connect-complete-approve]")) {
          trace.handleFlowCardClick += 1;
        }
      },
      true
    );

    const btn = document.querySelector("[data-connect-complete-approve]");
    btn?.click();

    console.error = origErr;
    return trace;
  });

  await page.waitForTimeout(2000);

  const postClick = await bFrame.evaluate(() => {
    const tid = new URL(location.href).searchParams.get("thread");
    const row = window.TasuChatThreadStore?.readAll?.().find((t) => t.id === tid);
    const inlineError = document.getElementById("chatInlineError")?.textContent?.trim() || "";
    return {
      roomStatus: row?.roomStatus,
      hasPayCard: Boolean(document.querySelector("[data-manual-transfer-card]")),
      hasPaidBtn: Boolean(document.querySelector("[data-manual-pay-report-paid]")),
      inlineError,
      stillHasApprove: Boolean(document.querySelector("[data-connect-complete-approve]")),
    };
  });

  console.log("clickTrace", clickTrace);
  console.log("postClick", postClick);

  if (clickTrace.handleFlowCardClick < 1) pushErr("click event did not reach approve button (capture)");
  if (clickTrace.approvePendingCompletionFromUi < 1 && clickTrace.approveCompletion < 1) {
    pushErr("neither approvePendingCompletionFromUi nor approveCompletion called");
  }
  if (postClick.roomStatus !== "awaiting_payment") {
    pushErr(`roomStatus=${postClick.roomStatus} expected awaiting_payment`);
  }
  if (!postClick.hasPayCard) pushErr("buyer payment card missing after approve");
  if (!postClick.hasPaidBtn) pushErr("支払いました button missing after approve");
  if (postClick.inlineError) pushErr(`inline error: ${postClick.inlineError}`);
  if (clickTrace.consoleErrors.length) {
    pushErr(`console errors: ${clickTrace.consoleErrors.join(" | ")}`);
  }

  const report = { exactUrl: EXACT_URL, threadId, preClick, clickTrace, postClick, errors, ok: errors.length === 0 };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exit(1);
} finally {
  await browser.close();
}
