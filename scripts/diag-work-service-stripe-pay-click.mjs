#!/usr/bin/env node
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();

const browser = await launchHeadlessBrowser();
const page = await browser.newPage();
try {
  await page.goto(
    `${BASE}/chat-dual-window-demo.html?benchPattern=business-1&demoProfile=business&demoConnect=1&liveFlow=1&liveFlowReset=1`,
    { waitUntil: "domcontentloaded" }
  );
  const ids = await page.evaluate(() => {
    const p = window.TasuPlatformChatDualWindowDemo.getProfile("business", true);
    window.TasuPlatformChatLiveFlow?.resetLiveFlow?.({ profile: "business", connect: true });
    window.TasuPlatformChatDualWindowDemo.seedPreStartDemoState?.(p);
    return { threadId: p.threadId, buyerId: p.partnerBId, sellerId: p.partnerAId };
  });

  const chatQs =
    `thread=${ids.threadId}&demoProfile=business&demoConnect=1&liveFlow=1&talkDev=1&review=chat-demo`;

  await page.goto(`${BASE}/chat-detail.html?${chatQs}&userId=${ids.sellerId}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => document.body?.dataset?.chatDetailReady === "true",
    { timeout: 30000 }
  );
  await page.evaluate(({ threadId, sellerId }) => {
    window.TasuPlatformChatCompletionFlow.requestCompletion({
      threadId,
      userId: sellerId,
      submittedContent: "作業完了",
      attachments: "写真1点",
    });
  }, ids);

  await page.goto(`${BASE}/chat-detail.html?${chatQs}&userId=${ids.buyerId}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => document.body?.dataset?.chatDetailReady === "true",
    { timeout: 30000 }
  );
  await page.evaluate(({ threadId, buyerId }) => {
    const C = window.TasuPlatformChatCompletionFlow;
    return C.approveCompletion({ threadId, thread: C.readThread(threadId), userId: buyerId });
  }, ids);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.body?.dataset?.chatDetailReady === "true",
    { timeout: 30000 }
  );

  const before = await page.evaluate(() => ({
    roomStatus: window.TasuPlatformChatCompletionFlow.readThread(
      new URLSearchParams(location.search).get("thread")
    )?.roomStatus,
    btn: Boolean(document.querySelector("[data-work-service-stripe-pay]")),
    bridge: document.documentElement.dataset.tasuFlowCardBridge,
  }));

  await page.click("[data-work-service-stripe-pay]", { timeout: 10000 });

  const after = await page.evaluate(({ threadId }) => {
    const thread = window.TasuPlatformChatCompletionFlow.readThread(threadId);
    const state = window.TasuPlatformChatWorkServiceConnectFlow.getThreadState(threadId);
    const msgs = window.TasuChatThreadStore.readMessagesMap()[threadId] || [];
    const notifies = (window.TasuTalkNotifications.getAll() || [])
      .filter((n) => String(n.threadId) === String(threadId))
      .map((n) => n.title);
    return {
      roomStatus: thread?.roomStatus,
      paymentCompleted: thread?.paymentCompleted,
      stateStatus: state.status,
      hasSellerCard: msgs.some((m) => m.kind === "work_service_seller_confirm_card"),
      paidLabel: document.body.innerText.includes("お支払いが完了しました"),
      notifies,
    };
  }, ids);

  const report = { before, after, pass: after.paymentCompleted === true && after.stateStatus === "paid" };
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
} finally {
  await browser.close();
}
