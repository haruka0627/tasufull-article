#!/usr/bin/env node
/**
 * liveFlow 動的 thread — A送信 → B通知
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const issues = [];

function ok(m) {
  console.log("OK", m);
}
function ng(m) {
  console.log("NG", m);
  issues.push(m);
}

await withPlaywrightBrowser(async (browser) => {
  const context = await browser.newContext();
  const bench = await context.newPage({ viewport: { width: 1280, height: 900 } });
  const contactId = "contact-demo-skill-dual-001";

  await bench.goto(
    `${BASE}/chat-dual-window-demo.html?benchPattern=skill-0&liveFlow=1&liveFlowReset=1&benchViewport=1280`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await bench.waitForTimeout(2000);

  const activated = await bench.evaluate((cid) => {
    const Contacts = window.TasuListingContactRequestsStore;
    const now = new Date().toISOString();
    const list = Contacts.readAll().filter((r) => String(r.contact_id) !== cid);
    list.unshift({
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
    });
    localStorage.setItem(Contacts.STORAGE_KEY, JSON.stringify(list));
    const F = window.TasuPlatformChatFee;
    F.ensurePendingFeeDeferred({
      listing: Contacts.resolveListing("demo-skill-001"),
      contactId: cid,
      feeAmount: 550,
    });
    F.markFeePaid(`deferred:contact:${cid}`, { listingId: "demo-skill-001", feeAmount: 550 });
    const act = F.activateDeferredAfterPayment({ contactId: cid, listingId: "demo-skill-001" });
    if (!act?.ok) return { ok: false, reason: act?.reason };
    const threadId = act.threadId;
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const Live = window.TasuPlatformChatLiveFlow;
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
      threadId,
    });
    const bUrl = Demo.chatUrl(p.id, sides.B.userId, {
      review: "chat-demo",
      connect: false,
      state: "active",
      threadId,
    });
    document.getElementById("frame-a-chat").src = append(aUrl);
    document.getElementById("frame-b-chat").src = append(bUrl);
    document.getElementById("frame-b-notify").src = append(Live.notifyTabUrl(p, sides.B.userId));
    return {
      ok: true,
      threadId,
      isDemo: Demo.isDemoThread(threadId),
      aId: sides.A.userId,
      bId: sides.B.userId,
    };
  }, contactId);

  console.log("[activated]", activated);
  if (!activated.ok) {
    ng(`activate failed: ${activated.reason}`);
  } else {
    ok(`dynamic thread ${activated.threadId} isDemo=${activated.isDemo}`);
  }

  await bench.waitForTimeout(3000);
  const aChat = bench.frameLocator("#frame-a-chat");
  const bNotify = bench.frameLocator("#frame-b-notify");

  await aChat.locator("#chatInput").waitFor({ timeout: 20000 });
  const composer = await aChat.locator("body").evaluate(() => ({
    sendDisabled: document.getElementById("chatSend")?.disabled,
    threadId: window.TasuChatService?.getRoomIdFromLocation?.(),
    meId: window.TasuChatUserIdentity?.getEffectiveUserId?.(),
  }));
  console.log("[composer]", composer);

  const text = "ライブフロー通知テスト";
  await aChat.locator("#chatInput").fill(text);
  await aChat.locator("#chatSend").click();
  await bench.waitForTimeout(2000);

  const audit = await bench.evaluate(
    ({ uid, threadId }) => {
      const rows = (window.TasuTalkNotifications?.getAll?.() || []).filter(
        (n) =>
          n.source === "platform_chat_demo_message_v1" &&
          String(n.recipientUserId) === uid &&
          String(n.threadId) === String(threadId)
      );
      return {
        count: rows.length,
        latest: rows[rows.length - 1] || null,
      };
    },
    { uid: activated.bId, threadId: activated.threadId }
  );
  console.log("[parent]", audit);

  if (!audit.count) ng("no message notify in parent store for liveFlow thread");
  else ok("parent message notify");
  if (audit.latest?.title !== "新しいメッセージが届きました") ng(`title=${audit.latest?.title}`);
  else ok("title");

  const bAudit = await bNotify.locator("body").evaluate((body, uid) => {
    const rows =
      window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || [];
    const msg = rows.filter(
      (n) => n.source === "platform_chat_demo_message_v1" && String(n.recipientUserId) === uid
    );
    const dom = [...document.querySelectorAll(".talk-notify-card__title")]
      .map((el) => el.textContent?.trim())
      .filter((t) => /新しいメッセージ/.test(t || ""));
    return { data: msg.length, dom: dom.length, latest: msg[0] || null };
  }, activated.bId);
  console.log("[b-notify]", bAudit);

  if (!bAudit.data) ng("B notify data missing");
  else ok("B notify data");
  if (!bAudit.dom) ng("B notify DOM missing");
  else ok("B notify DOM");
});


if (issues.length) {
  console.log("\nVERIFY FAILED", issues.length);
  await closeAllBrowsers();
  process.exit(1);
}
console.log("\nVERIFY PASSED");

await closeAllBrowsers();
