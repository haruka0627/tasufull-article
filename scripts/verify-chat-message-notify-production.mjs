#!/usr/bin/env node
/**
 * 本番相当 chat-detail（review なし）— 送信で通知
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const THREAD = "chat-demo-skill-plain-001";
const issues = [];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(
    `${BASE}/chat-detail.html?thread=${THREAD}&userId=u_sachi&talkDev=1&demoProfile=skill&demoConnect=0`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await page.evaluate(() => {
    window.TasuPlatformChatDualWindowDemo?.resetDemoState?.({
      profile: "skill",
      connect: false,
      state: "active",
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const gate = await page.evaluate(() => ({
    sendDisabled: document.getElementById("chatSend")?.disabled,
    hasThread: Boolean(window.TasuChatThreadStore?.loadRoom?.("chat-demo-skill-plain-001")),
    shouldEmit: window.TasuPlatformChatDualWindowDemo?.isDemoThread?.("chat-demo-skill-plain-001"),
  }));
  console.log("[gate]", gate);

  if (gate.sendDisabled) {
    const res = await page.evaluate(async () => {
      return window.TasuChatService.saveMessage(
        "chat-demo-skill-plain-001",
        { senderId: "u_sachi", senderName: "さちこ", text: "本番パステスト" },
        window.TasuChatThreadStore?.loadRoom?.("chat-demo-skill-plain-001")?.thread
      );
    });
    console.log("[direct]", res);
  } else {
    await page.fill("#chatInput", "本番パステスト");
    await page.click("#chatSend");
    await page.waitForTimeout(1000);
  }

  const audit = await page.evaluate(() => {
    const rows = (window.TasuTalkNotifications?.getAll?.() || []).filter(
      (n) => n.source === "platform_chat_demo_message_v1" && n.recipientUserId === "u_hiro"
    );
    const emitProbe = window.TasuPlatformChatDualWindowNotify?.notifyDemoChatMessage?.({
      threadId: "chat-demo-skill-plain-001",
      senderId: "u_sachi",
      text: "probe",
    });
    return { count: rows.length, latest: rows[rows.length - 1] || null, probe: emitProbe };
  });
  console.log("[audit]", audit);

  if (!audit.count) issues.push("no notify without review=chat-demo");
  if (audit.latest?.title !== "新しいメッセージが届きました") issues.push(`title=${audit.latest?.title}`);
} finally {
  await browser.close();
}

if (issues.length) {
  issues.forEach((i) => console.log("NG", i));
  process.exit(1);
}
console.log("VERIFY PASSED");
