#!/usr/bin/env node
/**
 * TASFUL TALK — 通話履歴 UI E2E（Phase4）
 *
 *   node scripts/test-talk-call-history-ui.mjs
 *   SUPABASE_STRICT=1 node scripts/test-talk-call-history-ui.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { ensureTalkTestUsers, loadTalkSupabaseConfig } from "./lib/talk-rls-test-auth.mjs";
import { enableTalkDevMode, signInTalkTestUser, talkHomeUrl } from "./lib/talk-test-env.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const STRICT = process.env.SUPABASE_STRICT === "1";
const USER_A = "u_me";
const USER_B = "u_store";
const ROOM_ID = `talk-call-hist-${Date.now()}`;
const OTHER_ROOM = `talk-call-hist-other-${Date.now()}`;

/** @type {string[]} */
const errors = [];

function pass(msg) {
  console.log(`  OK  ${msg}`);
}

function fail(msg) {
  errors.push(msg);
  console.error(`  NG  ${msg}`);
}

function chatDetailUrl(userId, threadId) {
  const url = new URL(`${BASE}/chat-detail.html`);
  url.searchParams.set("thread", threadId);
  url.searchParams.set("userId", userId);
  url.searchParams.set("talkDev", "1");
  url.searchParams.set("review", "chat-demo");
  return url.toString();
}

function buildTestThread(roomId, meId, partnerId) {
  return {
    id: roomId,
    buyerId: meId,
    sellerId: partnerId,
    partnerUserId: partnerId,
    partner: { id: partnerId, displayName: partnerId === USER_B ? "Store" : "Me" },
    me: { id: meId, displayName: meId === USER_A ? "Me" : "Store" },
    listing: { id: "demo-listing", title: "通話履歴テスト" },
    threadKind: "listing_inquiry",
  };
}

async function waitChatDetailModules(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        window.TasuTalkCallService &&
          window.TasuTalkCallHistory &&
          window.TasuTalkCallChatDetail
      ),
    { timeout: 20000 }
  );
}

async function syncThread(page, roomId, meId, partnerId) {
  await page.evaluate((t) => {
    window.TasuTalkCallChatDetail.syncFromThread(t);
  }, buildTestThread(roomId, meId, partnerId));
}

async function cleanupActiveCallSessions(userIds) {
  const cfg = loadTalkSupabaseConfig();
  if (!cfg.url || !cfg.serviceKey) return;
  for (const uid of userIds) {
    await fetch(
      `${cfg.url}/rest/v1/talk_call_sessions?or=(caller_id.eq.${uid},callee_id.eq.${uid})&status=in.(ringing,active)`,
      {
        method: "PATCH",
        headers: {
          apikey: cfg.serviceKey,
          Authorization: `Bearer ${cfg.serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ status: "ended", ended_at: new Date().toISOString() }),
      }
    ).catch(() => {});
  }
}

async function patchSessionStatus(sessionId, status) {
  const cfg = loadTalkSupabaseConfig();
  if (!cfg.url || !cfg.serviceKey || !sessionId) return;
  const body = { status, ended_at: new Date().toISOString() };
  if (status === "active") {
    body.started_at = new Date(Date.now() - 5000).toISOString();
  }
  await fetch(`${cfg.url}/rest/v1/talk_call_sessions?id=eq.${sessionId}`, {
    method: "PATCH",
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  }).catch(() => {});
}

async function waitHistoryItem(page, roomId, textPattern) {
  await page.waitForFunction(
    async ({ rid, re }) => {
      global.dispatchEvent(new CustomEvent("tasu:talk-call-history-refresh", { detail: { roomId: rid } }));
      await new Promise((r) => setTimeout(r, 400));
      const items = [...document.querySelectorAll(`[data-talk-call-history-item][data-room-id="${rid}"]`)];
      return items.some((el) => re.test(el.textContent || ""));
    },
    { rid: roomId, re: textPattern },
    { timeout: 35000 }
  );
}

async function historyCount(page, roomId) {
  return page.evaluate((rid) => {
    return document.querySelectorAll(`[data-talk-call-history-item][data-room-id="${rid}"]`).length;
  }, roomId);
}

async function historyCountForCall(page, roomId, callId) {
  return page.evaluate(
    ({ rid, cid }) =>
      document.querySelectorAll(
        `[data-talk-call-history-item][data-room-id="${rid}"][data-call-id="${cid}"]`
      ).length,
    { rid: roomId, cid: callId }
  );
}

async function layoutOk(page) {
  return page.evaluate(() => {
    const item = document.querySelector("[data-talk-call-history-item]");
    if (!item) return { ok: false };
    const vw = window.innerWidth;
    const rect = item.getBoundingClientRect();
    return { ok: rect.width <= vw + 1, vw, w: rect.width };
  });
}

async function runEndedFlow(pageA, pageB) {
  await cleanupActiveCallSessions([USER_A, USER_B]);
  await pageA.goto(chatDetailUrl(USER_A, ROOM_ID), { waitUntil: "domcontentloaded" });
  await waitChatDetailModules(pageA);
  await syncThread(pageA, ROOM_ID, USER_A, USER_B);
  await pageA.evaluate(() => window.TasuTalkCallService.init());

  await pageB.goto(chatDetailUrl(USER_B, ROOM_ID), { waitUntil: "domcontentloaded" });
  await waitChatDetailModules(pageB);
  await syncThread(pageB, ROOM_ID, USER_B, USER_A);
  await pageB.evaluate(() => window.TasuTalkCallService.init());

  const initiate = await pageA.evaluate(async () => {
    const t = window.TasuTalkCallChatDetail.getActiveThread();
    return window.TasuTalkCallService.initiateCall(t);
  });
  if (!initiate?.ok) throw new Error(`initiate failed: ${initiate?.reason}`);
  const callId = initiate.sessionId;

  await pageB.waitForFunction(
    async () => {
      if (document.querySelector("[data-talk-call-overlay]:not([hidden])")) return true;
      await window.TasuTalkCallService?.prepareIncomingForCallId?.(
        new URLSearchParams(location.search).get("callId")
      );
      return Boolean(document.querySelector("[data-talk-call-overlay]:not([hidden])"));
    },
    { timeout: 25000 }
  );
  await pageB.locator('[data-talk-call-action="accept"]').click();

  for (let i = 0; i < 40; i += 1) {
    const states = await Promise.all([
      pageA.evaluate(() => window.TasuTalkCallService.getCurrentSession()?.status),
      pageB.evaluate(() => window.TasuTalkCallService.getCurrentSession()?.status),
    ]);
    if (states[0] === "active" && states[1] === "active") break;
    await pageA.waitForTimeout(500);
  }

  const hangupPage =
    (await pageA.locator('[data-talk-call-action="hangup"]').count()) > 0 ? pageA : pageB;
  await hangupPage.locator('[data-talk-call-action="hangup"]').click();
  await pageA.waitForTimeout(2000);

  await waitHistoryItem(pageA, ROOM_ID, /通話が終了しました/);
  await waitHistoryItem(pageB, ROOM_ID, /通話が終了しました/);

  return callId;
}

async function main() {
  console.log("\n=== TALK 通話履歴 UI E2E ===\n");

  if (!STRICT) {
    console.log("  (skip — set SUPABASE_STRICT=1)\n");
    return;
  }

  await ensureTalkTestUsers([USER_A, USER_B]);
  await cleanupActiveCallSessions([USER_A, USER_B]);

  await withPlaywrightBrowser(async (browser) => {
    const pageA = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageB = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await enableTalkDevMode(pageA);
    await enableTalkDevMode(pageB);
    await pageA.goto(chatDetailUrl(USER_A, ROOM_ID), { waitUntil: "domcontentloaded" });
    await pageB.goto(chatDetailUrl(USER_B, ROOM_ID), { waitUntil: "domcontentloaded" });
    await signInTalkTestUser(pageA, USER_A);
    await signInTalkTestUser(pageB, USER_B);

    const endedCallId = await runEndedFlow(pageA, pageB);
    pass("ended history on A/B chat-detail");

    const dupEnded = await historyCountForCall(pageA, ROOM_ID, endedCallId);
    if (dupEnded !== 1) fail(`duplicate ended history: ${dupEnded}`);
    else pass("single history per call_id (ended)");

    await pageA.evaluate(() => {
      global.dispatchEvent(
        new CustomEvent("tasu:talk-call-history-refresh", { detail: { roomId: location.search.match(/thread=([^&]+)/)?.[1] } })
      );
    });
    await pageA.waitForTimeout(500);
    const dupAfterRerender = await historyCountForCall(pageA, ROOM_ID, endedCallId);
    if (dupAfterRerender !== 1) fail(`duplicate after rerender: ${dupAfterRerender}`);
    else pass("no duplicate on rerender");

    const layout = await layoutOk(pageA);
    if (!layout.ok) fail(`390px layout overflow w=${layout.w} vw=${layout.vw}`);
    else pass("390px history card layout ok");

    await cleanupActiveCallSessions([USER_A, USER_B]);
    await pageA.goto(chatDetailUrl(USER_A, ROOM_ID), { waitUntil: "domcontentloaded" });
    await waitChatDetailModules(pageA);
    await syncThread(pageA, ROOM_ID, USER_A, USER_B);
    await pageB.goto(chatDetailUrl(USER_B, ROOM_ID), { waitUntil: "domcontentloaded" });
    await waitChatDetailModules(pageB);
    await syncThread(pageB, ROOM_ID, USER_B, USER_A);

    const rejectInit = await pageA.evaluate(async () => {
      window.TasuTalkCallService.init();
      const t = window.TasuTalkCallChatDetail.getActiveThread();
      return window.TasuTalkCallService.initiateCall(t);
    });
    if (!rejectInit?.ok) fail(`reject flow initiate: ${rejectInit?.reason}`);
    else {
      await pageB.goto(talkHomeUrl(BASE, USER_B, "notify"), { waitUntil: "load" });
      await pageB.evaluate(() => window.TasuTalkCallNotifyBridge.init());
      await pageB.waitForFunction(
        (rid) =>
          Boolean(document.querySelector(`article[data-room-id="${rid}"] [data-talk-notify-action="call-reject"]`)),
        ROOM_ID,
        { timeout: 25000 }
      );
      await pageB.locator(`article[data-room-id="${ROOM_ID}"] [data-talk-notify-action="call-reject"]`).click();
      await pageA.waitForTimeout(2500);
      await pageA.goto(chatDetailUrl(USER_A, ROOM_ID), { waitUntil: "domcontentloaded" });
      await syncThread(pageA, ROOM_ID, USER_A, USER_B);
      await waitHistoryItem(pageA, ROOM_ID, /拒否されました/);
      await pageB.goto(chatDetailUrl(USER_B, ROOM_ID), { waitUntil: "domcontentloaded" });
      await syncThread(pageB, ROOM_ID, USER_B, USER_A);
      await waitHistoryItem(pageB, ROOM_ID, /拒否されました/);
      pass("reject history on A/B");
    }

    await cleanupActiveCallSessions([USER_A, USER_B]);
    await pageA.goto(chatDetailUrl(USER_A, ROOM_ID), { waitUntil: "domcontentloaded" });
    await syncThread(pageA, ROOM_ID, USER_A, USER_B);
    const missedInit = await pageA.evaluate(async () => {
      window.TasuTalkCallService.init();
      const t = window.TasuTalkCallChatDetail.getActiveThread();
      return window.TasuTalkCallService.initiateCall(t);
    });
    if (!missedInit?.ok) fail(`missed flow initiate: ${missedInit?.reason}`);
    else {
      await patchSessionStatus(missedInit.sessionId, "missed");
      await pageA.goto(chatDetailUrl(USER_A, ROOM_ID), { waitUntil: "domcontentloaded" });
      await syncThread(pageA, ROOM_ID, USER_A, USER_B);
      await waitHistoryItem(pageA, ROOM_ID, /応答されませんでした/);
      await pageB.goto(chatDetailUrl(USER_B, ROOM_ID), { waitUntil: "domcontentloaded" });
      await syncThread(pageB, ROOM_ID, USER_B, USER_A);
      await waitHistoryItem(pageB, ROOM_ID, /不在着信/);
      pass("missed history on A/B");
    }

    const cfg = loadTalkSupabaseConfig();
    if (cfg.url && cfg.serviceKey) {
      for (let i = 0; i < 25; i += 1) {
        await fetch(`${cfg.url}/rest/v1/talk_call_sessions`, {
          method: "POST",
          headers: {
            apikey: cfg.serviceKey,
            Authorization: `Bearer ${cfg.serviceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            room_id: ROOM_ID,
            caller_id: USER_A,
            callee_id: USER_B,
            status: "ended",
            created_at: new Date(Date.now() - i * 60000).toISOString(),
            ended_at: new Date(Date.now() - i * 60000 + 1000).toISOString(),
            started_at: new Date(Date.now() - i * 60000 + 500).toISOString(),
          }),
        }).catch(() => {});
      }
      await pageA.goto(chatDetailUrl(USER_A, ROOM_ID), { waitUntil: "domcontentloaded" });
      await waitChatDetailModules(pageA);
      await syncThread(pageA, ROOM_ID, USER_A, USER_B);
      await pageA.waitForTimeout(1200);
      const capCheck = await pageA.evaluate(async (rid) => {
        global.dispatchEvent(new CustomEvent("tasu:talk-call-history-refresh", { detail: { roomId: rid } }));
        await new Promise((r) => setTimeout(r, 800));
        const sessions = await window.TasuTalkCallSignaling?.fetchSessionsByRoom?.(rid, { limit: 25 });
        const dom = document.querySelectorAll(`[data-talk-call-history-item][data-room-id="${rid}"]`).length;
        return { dom, db: Array.isArray(sessions) ? sessions.length : 0 };
      }, ROOM_ID);
      if (capCheck.db < 1) fail(`seed sessions not visible in DB: ${capCheck.db}`);
      else if (capCheck.dom > 20) fail(`history max 20 exceeded: ${capCheck.dom}`);
      else if (capCheck.dom < 1) fail(`history not rendered (db=${capCheck.db}, dom=${capCheck.dom})`);
      else pass(`history capped at 20 (shown=${capCheck.dom}, db=${capCheck.db})`);
    }

    await pageA.goto(chatDetailUrl(USER_A, OTHER_ROOM), { waitUntil: "domcontentloaded" });
    await syncThread(pageA, OTHER_ROOM, USER_A, USER_B);
    await pageA.waitForTimeout(1000);
    const otherRoomCount = await historyCount(pageA, ROOM_ID);
    if (otherRoomCount > 0) fail(`other room shows foreign history: ${otherRoomCount}`);
    else pass("other room history isolated");

    await pageA.close();
    await pageB.close();

    console.log("");
    if (errors.length) {
      console.log(`FAILED (${errors.length}):`);
      errors.forEach((e) => console.log(`  - ${e}`));
      process.exit(1);
    }
    console.log("=== PASS (0 errors) ===\n");
    });
  
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
