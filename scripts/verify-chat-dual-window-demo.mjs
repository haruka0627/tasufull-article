#!/usr/bin/env node
/**
 * 2窓デモ — complete-request / チャット通知 / 戻る
 */
import { devices, withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const SKILL_THREAD = "chat-demo-skill-plain-001";
const NOTIFY_COMPLETE = "platform-chat-demo-skill-complete-request-001";

let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const ok = (msg) => console.log("OK", msg);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});

const chatUrl =
  `${BASE}/chat-detail.html?thread=${SKILL_THREAD}&userId=u_hiro&talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&demoNotify=${NOTIFY_COMPLETE}&from=notify`;

await page.goto(chatUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1500);

const completeRequestAudit = await page.evaluate(() => {
  const sys = [...document.querySelectorAll(".chat-system-msg__text")].map((el) => el.textContent?.trim());
  const pendingCard = document.querySelector("[data-connect-pending-card]");
  const approve = document.querySelector("[data-connect-complete-approve]");
  const reject = document.querySelector("[data-connect-complete-reject]");
  const back = document.getElementById("chatMobileBack");
  return {
    sys,
    hasPendingCard: Boolean(pendingCard),
    approveLabel: approve?.textContent?.trim() || "",
    rejectLabel: reject?.textContent?.trim() || "",
    backVisible: back && getComputedStyle(back).display !== "none",
    roomStatus: window.TasuChatThreadStore?.readAll?.()?.find((t) => t.id === "chat-demo-skill-plain-001")
      ?.roomStatus,
  };
});

if (!completeRequestAudit.sys.some((t) => /申請/.test(t || ""))) {
  fail(`missing completion request system message: ${JSON.stringify(completeRequestAudit.sys)}`);
} else ok("completion request system message");

if (!completeRequestAudit.hasPendingCard) fail("missing pending approval card");
else ok("pending approval card");

if (completeRequestAudit.approveLabel !== "承認する") {
  fail(`approve label: ${completeRequestAudit.approveLabel}`);
} else ok("approve button");

if (completeRequestAudit.rejectLabel !== "差し戻す") {
  fail(`reject label: ${completeRequestAudit.rejectLabel}`);
} else ok("reject button");

if (completeRequestAudit.roomStatus !== "completion_pending") {
  fail(`roomStatus: ${completeRequestAudit.roomStatus}`);
} else ok("roomStatus completion_pending");

if (!completeRequestAudit.backVisible) fail("back button not visible");
else ok("back button visible");

await page.evaluate(() => {
  window.TasuPlatformChatDualWindowNotify?.onDemoMessageSent?.({
    threadId: "chat-demo-skill-plain-001",
    senderId: "u_sachi",
    text: "よろしくお願いします",
  });
});

await page.goto(
  `${BASE}/talk-home.html?tab=notify&talkDev=1&review=chat-demo&demoProfile=skill&userId=u_hiro`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForTimeout(1200);

const msgNotify = await page.evaluate(() => {
  const row = (window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || []).find(
    (n) => n.source === "platform_chat_demo_message_v1"
  );
  return {
    found: Boolean(row),
    title: row?.title || "",
    cta: row?.actionLabel || "",
    body: row?.body || "",
  };
});

if (!msgNotify.found) fail("chat message notify missing for B");
else ok("chat message notify for B");

if (msgNotify.title !== "新しいメッセージが届きました") fail(`title: ${msgNotify.title}`);
else ok("message notify title");

if (msgNotify.cta !== "チャットを開く") fail(`cta: ${msgNotify.cta}`);
else ok("message notify CTA");

if (!/よろしく/.test(msgNotify.body)) fail(`body: ${msgNotify.body}`);
else ok("message notify body preview");

});
if (failed) {
  console.log("\nVERIFY FAILED");
  await closeAllBrowsers();
  process.exit(1);
}
console.log("\nVERIFY PASSED");
