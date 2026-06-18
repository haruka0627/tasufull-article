#!/usr/bin/env node
/**
 * 2窓ベンチ — A送信 → B上「新しいメッセージが届きました」（storage refresh）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
await withPlaywrightBrowser(async (browser) => {const issues = [];

function ok(msg) {
  console.log("OK", msg);
}
function ng(msg) {
  console.log("NG", msg);
  issues.push(msg);
}


  const context = await browser.newContext();
  const bench = await context.newPage({ viewport: { width: 1280, height: 900 } });

  await bench.goto(
    `${BASE}/chat-dual-window-demo.html?benchPattern=skill-0&liveFlow=1&liveFlowReset=1&benchViewport=1280`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await bench.waitForTimeout(2000);

  const profile = await bench.evaluate(() => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const Live = window.TasuPlatformChatLiveFlow;
    Demo.resetDemoState({ profile: "skill", connect: false, state: "active" });
    const p = Demo.getProfile("skill", false);
    const sides = Demo.getSideMeta(p);
    const append = (url) => {
      const u = new URL(url, location.href);
      u.searchParams.set("benchEmbed", "1");
      u.searchParams.set("benchViewport", "1280");
      return u.href;
    };
    const aUrl = Demo.chatUrl(p.id, sides.A.userId, {
      review: "chat-demo",
      connect: false,
      state: "active",
      threadId: p.threadId,
    });
    const bUrl = Demo.chatUrl(p.id, sides.B.userId, {
      review: "chat-demo",
      connect: false,
      state: "active",
      threadId: p.threadId,
    });
    document.getElementById("frame-a-chat").src = append(aUrl);
    document.getElementById("frame-b-chat").src = append(bUrl);
    document.getElementById("frame-a-notify").src = append(Live.notifyTabUrl(p, sides.A.userId));
    document.getElementById("frame-b-notify").src = append(Live.notifyTabUrl(p, sides.B.userId));
    return { threadId: p.threadId, aId: sides.A.userId, bId: sides.B.userId };
  });
  await bench.waitForTimeout(2500);

  const aChatFrame = bench.frameLocator("#frame-a-chat");
  const bNotifyFrame = bench.frameLocator("#frame-b-notify");

  await aChatFrame.locator("#chatInput").waitFor({ state: "visible", timeout: 20000 });
  const composer = await aChatFrame.locator("body").evaluate(() => ({
    sendDisabled: document.getElementById("chatSend")?.disabled,
    hasThread: Boolean(window.TasuChatThreadStore?.loadRoom?.(window.TasuChatService?.getRoomIdFromLocation?.())),
    meId: window.TasuChatUserIdentity?.getEffectiveUserId?.(),
  }));
  console.log("[a-chat]", composer);
  if (composer.sendDisabled) ng("A send disabled");
  else ok("A composer ready");

  const before = await bench.evaluate(
    (uid) =>
      (window.TasuTalkNotifications?.getAll?.() || []).filter(
        (n) => n.source === "platform_chat_demo_message_v1" && String(n.recipientUserId) === uid
      ).length,
    profile.bId
  );

  const testText = "ベンチ通知テストです";
  await aChatFrame.locator("#chatInput").fill(testText);
  await aChatFrame.locator("#chatSend").click();
  await bench.waitForTimeout(2000);

  const parentAudit = await bench.evaluate(
    ({ uid, text }) => {
      const rows = (window.TasuTalkNotifications?.getAll?.() || []).filter(
        (n) => n.source === "platform_chat_demo_message_v1" && String(n.recipientUserId) === uid
      );
      const latest = rows[rows.length - 1] || null;
      return {
        count: rows.length,
        latest,
        bodyHasText: /ベンチ通知テスト/.test(latest?.body || ""),
      };
    },
    { uid: profile.bId, text: testText }
  );
  console.log("[parent-store]", parentAudit);

  if (parentAudit.count <= before) ng(`parent store: before=${before} after=${parentAudit.count}`);
  else ok("parent store has new message notify");
  if (parentAudit.latest?.title !== "新しいメッセージが届きました") ng(`title=${parentAudit.latest?.title}`);
  else ok("parent title");
  if (!parentAudit.bodyHasText) ng(`body=${parentAudit.latest?.body}`);
  else ok("parent body preview");

  const bAudit = await bNotifyFrame.locator("body").evaluate((body, uid) => {
    const rows =
      window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || [];
    const msg = rows.filter(
      (n) => n.source === "platform_chat_demo_message_v1" && String(n.recipientUserId) === uid
    );
    const domTitles = [...document.querySelectorAll(".talk-notify-card__title")]
      .map((el) => el.textContent?.trim())
      .filter((t) => /新しいメッセージ/.test(t || ""));
    return {
      dataCount: msg.length,
      domCount: domTitles.length,
      latest: msg[0] || null,
      domTitles,
      urlUserId: new URLSearchParams(location.search).get("userId"),
    };
  }, profile.bId);
  console.log("[b-notify]", bAudit);

  if (!bAudit.dataCount) ng("B notify iframe data missing (storage refresh failed?)");
  else ok("B notify iframe data");
  if (!bAudit.domCount) ng(`B notify DOM empty: ${JSON.stringify(bAudit.domTitles)}`);
  else ok("B notify DOM");
  if (bAudit.latest && !String(bAudit.latest.href || "").includes(profile.threadId)) {
    ng(`B href missing thread: ${bAudit.latest.href}`);
  } else if (bAudit.latest) ok("B href threadId");
});


if (issues.length) {
  console.log("\nVERIFY FAILED", issues.length);
  await closeAllBrowsers();
  process.exit(1);
}
console.log("\nVERIFY PASSED");

await closeAllBrowsers();
