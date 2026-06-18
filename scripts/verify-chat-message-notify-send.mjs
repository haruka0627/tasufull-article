#!/usr/bin/env node
/**
 * chat-detail 送信 → 相手向け「新しいメッセージが届きました」
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const THREAD = "chat-demo-skill-plain-001";
const SENDER = "u_sachi";
const RECIPIENT = "u_hiro";
const issues = [];

function ok(m) {
  console.log("OK", m);
}
function ng(m) {
  console.log("NG", m);
  issues.push(m);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

try {
  const senderPage = await context.newPage();
  const senderUrl =
    `${BASE}/chat-detail.html?thread=${THREAD}&userId=${SENDER}&talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&demoState=active`;
  await senderPage.goto(senderUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await senderPage.evaluate(() => {
    window.TasuPlatformChatDualWindowDemo?.resetDemoState?.({
      profile: "skill",
      connect: false,
      state: "active",
    });
    window.TasuPlatformChatDualWindowDemo?.ensureDemoThreadForAccess?.("chat-demo-skill-plain-001");
  });
  await senderPage.reload({ waitUntil: "domcontentloaded" });
  await senderPage.waitForSelector('[data-chat-detail-ready="true"]', { timeout: 20000 }).catch(() => null);
  await senderPage.waitForTimeout(1500);

  const composerReady = await senderPage.evaluate(() => {
    const input = document.getElementById("chatInput");
    const send = document.getElementById("chatSend");
    return {
      inputDisabled: input?.disabled,
      sendDisabled: send?.disabled,
      roomId: window.TasuChatService?.getRoomIdFromLocation?.(),
      meId: window.TasuChatUserIdentity?.getEffectiveUserId?.(),
      hasThread: Boolean(window.TasuChatThreadStore?.loadRoom?.(window.TasuChatService?.getRoomIdFromLocation?.())),
    };
  });
  console.log("[composer]", composerReady);

  const testText = "こんにちは、よろしくお願いします";
  const before = await senderPage.evaluate((uid) => {
    return (window.TasuTalkNotifications?.getAll?.() || []).filter(
      (n) => n.source === "platform_chat_demo_message_v1" && String(n.recipientUserId) === uid
    ).length;
  }, RECIPIENT);

  if (composerReady.sendDisabled) {
    ng("send button disabled — trying saveMessage directly");
    const direct = await senderPage.evaluate(
      async ({ threadId, senderId, text }) => {
        const res = await window.TasuChatService.saveMessage(
          threadId,
          { senderId, senderName: "さちこ", text },
          window.TasuChatThreadStore?.loadRoom?.(threadId)?.thread
        );
        const notify = (window.TasuTalkNotifications?.getAll?.() || []).filter(
          (n) => n.source === "platform_chat_demo_message_v1"
        );
        return { save: res, notifyCount: notify.length, lastNotify: notify[notify.length - 1] || null };
      },
      { threadId: THREAD, senderId: SENDER, text: testText }
    );
    console.log("[direct-save]", direct);
    if (!direct.save?.ok) ng(`saveMessage failed: ${direct.save?.reason}`);
    else ok("saveMessage ok (direct)");
  } else {
    await senderPage.fill("#chatInput", testText);
    await senderPage.click("#chatSend");
    await senderPage.waitForTimeout(1000);
    ok("UI send clicked");
  }

  const afterAudit = await senderPage.evaluate(
    ({ uid, text, threadId, senderId }) => {
      const msgs = window.TasuChatThreadStore?.getMessages?.(threadId) || [];
      const last = msgs[msgs.length - 1];
      const rows = (window.TasuTalkNotifications?.getAll?.() || []).filter(
        (n) => n.source === "platform_chat_demo_message_v1" && String(n.recipientUserId) === uid
      );
      const latest = rows[rows.length - 1] || null;
      return {
        lastMsg: last,
        notifyRows: rows.map((n) => ({
          title: n.title,
          recipientUserId: n.recipientUserId,
          senderUserId: n.senderUserId,
          href: n.href,
          threadId: n.threadId,
          body: n.body,
          actionLabel: n.actionLabel,
        })),
        latest,
      };
    },
    { uid: RECIPIENT, text: testText, threadId: THREAD, senderId: SENDER }
  );

  console.log("[after]", JSON.stringify(afterAudit, null, 2));

  const after = afterAudit.notifyRows.length;
  if (after <= before) ng(`notify not created (before=${before} after=${after})`);
  else ok(`notify created count=${after}`);

  const latest = afterAudit.latest;
  if (!latest) {
    ng("no latest notify for recipient");
  } else {
    if (latest.title !== "新しいメッセージが届きました") ng(`title=${latest.title}`);
    else ok("title");
    if (latest.actionLabel !== "チャットを開く") ng(`cta=${latest.actionLabel}`);
    else ok("cta");
    if (String(latest.recipientUserId) !== RECIPIENT) ng(`recipient=${latest.recipientUserId}`);
    else ok("recipientUserId");
    if (String(latest.senderUserId) !== SENDER) ng(`sender=${latest.senderUserId}`);
    else ok("senderUserId");
    if (!String(latest.href || "").includes(THREAD)) ng(`href=${latest.href}`);
    else ok("href threadId");
  }

  const recipientPage = await context.newPage();
  await recipientPage.goto(
    `${BASE}/talk-home.html?tab=notify&talkDev=1&review=chat-demo&demoProfile=skill&userId=${RECIPIENT}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await recipientPage.waitForTimeout(1500);

  const recipientAudit = await recipientPage.evaluate((uid) => {
    const rows =
      window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || [];
    const msg = rows.filter(
      (n) => n.source === "platform_chat_demo_message_v1" && String(n.recipientUserId) === uid
    );
    const dom = [...document.querySelectorAll(".talk-notify-card__title")]
      .map((el) => el.textContent?.trim())
      .filter((t) => /新しいメッセージ/.test(t || ""));
    return { dataCount: msg.length, domCount: dom.length, latest: msg[0] || null };
  }, RECIPIENT);

  console.log("[recipient]", recipientAudit);
  if (!recipientAudit.dataCount) ng("recipient talk-home data missing message notify");
  else ok("recipient talk-home data has notify");
  if (!recipientAudit.domCount) ng("recipient DOM missing message notify card");
  else ok("recipient DOM shows message notify");
} finally {
  await browser.close();
}

if (issues.length) {
  console.log("\nVERIFY FAILED", issues.length);
  process.exit(1);
}
console.log("\nVERIFY PASSED");
