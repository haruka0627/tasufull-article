#!/usr/bin/env node
/**
 * TASFUL TALK — 通話着信 × 通知センター E2E（Phase3）
 *
 *   node scripts/test-talk-call-notification-center.mjs
 *   SUPABASE_STRICT=1 node scripts/test-talk-call-notification-center.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { ensureTalkTestUsers, loadTalkSupabaseConfig } from "./lib/talk-rls-test-auth.mjs";
import {
  enableTalkDevMode,
  gotoTalkHome,
  signInTalkTestUser,
  talkHomeUrl,
} from "./lib/talk-test-env.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const STRICT = process.env.SUPABASE_STRICT === "1";
const USER_A = "u_me";
const USER_B = "u_store";
const ROOM_ID = `talk-call-nc-${Date.now()}`;

/** @type {string[]} */
const errors = [];

function pass(msg) {
  console.log(`  OK  ${msg}`);
}

function fail(msg) {
  errors.push(msg);
  console.error(`  NG  ${msg}`);
}

function chatDetailUrl(userId, threadId, extra = "") {
  const url = new URL(`${BASE}/chat-detail.html`);
  url.searchParams.set("thread", threadId);
  url.searchParams.set("userId", userId);
  url.searchParams.set("talkDev", "1");
  url.searchParams.set("review", "chat-demo");
  if (extra) {
    extra.split("&").forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k) url.searchParams.set(k, v || "");
    });
  }
  return url.toString();
}

function buildTestThread(meId, partnerId) {
  return {
    id: ROOM_ID,
    buyerId: meId,
    sellerId: partnerId,
    partnerUserId: partnerId,
    partner: { id: partnerId, displayName: partnerId === USER_B ? "Store" : "Me" },
    me: { id: meId, displayName: meId === USER_A ? "Me" : "Store" },
    listing: { id: "demo-listing", title: "通話テスト" },
    threadKind: "listing_inquiry",
  };
}

async function waitTalkHomeCallModules(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        window.TasuTalkCallService &&
          window.TasuTalkCallNotifyBridge &&
          window.TasuTalkCallUi
      ),
    { timeout: 20000 }
  );
}

async function waitChatDetailCallModules(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        window.TasuTalkCallService &&
          window.TasuTalkCallChatDetail &&
          window.TasuTalkCallUi
      ),
    { timeout: 20000 }
  );
}

async function cleanupCallNotifications(page) {
  await page.evaluate(() => {
    const store = window.TasuTalkNotifications;
    if (!store?.getAll || !store?.remove) return;
    (store.getAll() || []).forEach((n) => {
      if (String(n?.source || "") === "talk_call_v1") store.remove(n.id);
    });
  });
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

async function syncTestThread(page, meId, partnerId) {
  await page.evaluate((t) => {
    window.TasuTalkCallChatDetail.syncFromThread(t);
  }, buildTestThread(meId, partnerId));
}

async function waitCallNotifyCard(page, roomId) {
  await page.waitForFunction(
    async (rid) => {
      await window.TasuTalkCallNotifyBridge?.pollIncomingCalls?.();
      await window.TasuTalkHome?.refreshTalkSurfaces?.({ notifyOnly: true });
      const cards = [...document.querySelectorAll("article[data-talk-call-notification]")];
      return cards.some((c) => c.getAttribute("data-room-id") === rid);
    },
    roomId,
    { timeout: 30000 }
  );
}

async function callNotifyCardCount(page, roomId) {
  return page.evaluate((rid) => {
    return [...document.querySelectorAll("article[data-talk-call-notification]")].filter(
      (c) => c.getAttribute("data-room-id") === rid
    ).length;
  }, roomId);
}

async function cardLayoutOk(page) {
  return page.evaluate(() => {
    const card = document.querySelector("article[data-talk-call-notification]");
    if (!card) return { ok: false, reason: "no card" };
    const vw = window.innerWidth;
    const rect = card.getBoundingClientRect();
    const accept = card.querySelector('[data-talk-call-action="call-accept"], [data-talk-notify-action="call-accept"]');
    const reject = card.querySelector('[data-talk-notify-action="call-reject"]');
    const acceptRect = accept?.getBoundingClientRect();
    const rejectRect = reject?.getBoundingClientRect();
    return {
      ok: rect.width <= vw + 1,
      vw,
      cardW: rect.width,
      acceptOk: !acceptRect || acceptRect.width <= vw + 1,
      rejectOk: !rejectRect || rejectRect.width <= vw + 1,
    };
  });
}

async function main() {
  console.log("\n=== TALK 通話着信 × 通知センター E2E ===\n");

  if (STRICT) {
    await ensureTalkTestUsers([USER_A, USER_B]);
    await cleanupActiveCallSessions([USER_A, USER_B]);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });

  try {
    const pageB = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await enableTalkDevMode(pageB);
    await gotoTalkHome(pageB, BASE, USER_B, "notify");
    await waitTalkHomeCallModules(pageB);
    pass("call notify modules loaded on talk-home");

    if (!STRICT) {
      console.log("\n  (skip full flow — set SUPABASE_STRICT=1)\n");
    } else {
      await signInTalkTestUser(pageB, USER_B);
      await cleanupCallNotifications(pageB);
      await pageB.evaluate(() => window.TasuTalkCallNotifyBridge.init());

      const pageA = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await enableTalkDevMode(pageA);
      await pageA.goto(chatDetailUrl(USER_A, ROOM_ID), { waitUntil: "domcontentloaded" });
      await waitChatDetailCallModules(pageA);
      await signInTalkTestUser(pageA, USER_A);
      await syncTestThread(pageA, USER_A, USER_B);
      await pageA.evaluate(() => window.TasuTalkCallService.init());

      await pageB.bringToFront();
      await pageB.goto(talkHomeUrl(BASE, USER_B, "notify"), { waitUntil: "load" });
      await waitTalkHomeCallModules(pageB);
      await pageB.evaluate(() => window.TasuTalkCallNotifyBridge.init());

      const initiateRes = await pageA.evaluate(async () => {
        const thread = window.TasuTalkCallChatDetail.getActiveThread();
        return window.TasuTalkCallService.initiateCall(thread);
      });
      if (!initiateRes?.ok) fail(`A initiate: ${initiateRes?.reason || "failed"}`);
      else pass("A→B initiate from chat-detail");

      await pageB.bringToFront();
      await waitCallNotifyCard(pageB, ROOM_ID);
      await pageB.evaluate(() => {
        global.dispatchEvent(
          new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } })
        );
      });
      await pageB.waitForTimeout(500);
      const cardText = await pageB.evaluate((rid) => {
        const card = document.querySelector(`article[data-talk-call-notification][data-room-id="${rid}"]`);
        return {
          title: card?.querySelector(".talk-notify-card__title")?.textContent || "",
          body: card?.querySelector(".talk-notify-card__text")?.textContent || "",
          callId: card?.getAttribute("data-call-id") || "",
          roomId: card?.getAttribute("data-room-id") || "",
        };
      }, ROOM_ID);
      if (!/音声通話の着信/.test(cardText.title)) fail(`notify title: ${cardText.title}`);
      else pass("notify card title");
      if (!/通話リクエスト/.test(cardText.body)) fail(`notify body: ${cardText.body}`);
      else pass("notify card body");
      if (cardText.roomId !== ROOM_ID) fail(`notify roomId: ${cardText.roomId}`);
      else pass("notify card roomId");

      const dupCount = await callNotifyCardCount(pageB, ROOM_ID);
      if (dupCount !== 1) fail(`duplicate notify cards: ${dupCount}`);
      else pass("single notify card per call");

      const layout = await cardLayoutOk(pageB);
      if (!layout.ok || !layout.acceptOk || !layout.rejectOk) {
        fail(`390px card layout card=${layout.ok} accept=${layout.acceptOk} reject=${layout.rejectOk}`);
      } else pass("390px notify card layout ok");

      await pageB.locator(`article[data-room-id="${ROOM_ID}"] [data-talk-notify-action="call-accept"]`).click();
      await pageB.waitForURL(/chat-detail\.html/, { timeout: 20000 });
      await waitChatDetailCallModules(pageB);
      await syncTestThread(pageB, USER_B, USER_A);
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
      pass("B navigated to chat-detail with incoming overlay");

      await pageB.locator('[data-talk-call-action="accept"]').click();
      let states = ["", ""];
      for (let i = 0; i < 40; i += 1) {
        states = await Promise.all([
          pageA.evaluate(() => window.TasuTalkCallService.getCurrentSession()?.status),
          pageB.evaluate(() => window.TasuTalkCallService.getCurrentSession()?.status),
        ]);
        if (states[0] === "active" && states[1] === "active") break;
        await pageA.waitForTimeout(500);
      }
      if (states[0] !== "active" || states[1] !== "active") {
        fail(`accept flow active A=${states[0]} B=${states[1]}`);
      } else pass("A/B active after notify accept flow");

      const hangupPage =
        (await pageA.locator('[data-talk-call-action="hangup"]').count()) > 0 ? pageA : pageB;
      await hangupPage.locator('[data-talk-call-action="hangup"]').click();
      for (let i = 0; i < 20; i += 1) {
        const cleared = await Promise.all([
          pageA.evaluate(() => !window.TasuTalkCallService.getCurrentSession()),
          pageB.evaluate(() => !window.TasuTalkCallService.getCurrentSession()),
        ]);
        if (cleared[0] && cleared[1]) break;
        await pageA.waitForTimeout(400);
      }
      pass("hangup after notify accept");

      await pageB.goto(talkHomeUrl(BASE, USER_B, "notify"), { waitUntil: "load" });
      await cleanupCallNotifications(pageB);
      await pageB.evaluate(async () => {
        await window.TasuTalkCallNotifyBridge?.pollIncomingCalls?.();
        await window.TasuTalkCallNotifyBridge?.init?.();
        global.dispatchEvent(
          new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } })
        );
      });
      await pageB.waitForTimeout(800);
      const afterEndCount = await pageB.evaluate(
        () => document.querySelectorAll("article[data-talk-call-notification]").length
      );
      if (afterEndCount > 0) fail(`call notify card remained after ended: ${afterEndCount}`);
      else pass("notify card removed after ended");

      await cleanupActiveCallSessions([USER_A, USER_B]);
      await cleanupCallNotifications(pageB);

      await pageA.goto(chatDetailUrl(USER_A, ROOM_ID), { waitUntil: "domcontentloaded" });
      await waitChatDetailCallModules(pageA);
      await syncTestThread(pageA, USER_A, USER_B);
      await pageA.evaluate(() => window.TasuTalkCallService.init());
      await pageB.goto(talkHomeUrl(BASE, USER_B, "notify"), { waitUntil: "load" });
      await waitTalkHomeCallModules(pageB);
      await cleanupCallNotifications(pageB);
      await pageB.evaluate(() => window.TasuTalkCallNotifyBridge.init());

      const initiate2 = await pageA.evaluate(async () => {
        const thread = window.TasuTalkCallChatDetail.getActiveThread();
        return window.TasuTalkCallService.initiateCall(thread);
      });
      if (!initiate2?.ok) fail(`reject test initiate: ${initiate2?.reason}`);
      await waitCallNotifyCard(pageB, ROOM_ID);
      await pageB.evaluate(() => {
        global.dispatchEvent(
          new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } })
        );
      });
      await pageB.waitForTimeout(500);

      await pageB.locator(`article[data-room-id="${ROOM_ID}"] [data-talk-notify-action="call-reject"]`).click();
      await pageB.waitForTimeout(2500);

      const aState = await pageA.evaluate(async () => {
        for (let i = 0; i < 20; i += 1) {
          const s = window.TasuTalkCallService.getCurrentSession();
          if (!s) return "cleared";
          if (s.status === "rejected" || s.status === "ended") return s.status;
          await new Promise((r) => setTimeout(r, 400));
        }
        return window.TasuTalkCallService.getCurrentSession()?.status || "unknown";
      });
      if (aState !== "cleared" && aState !== "rejected" && aState !== "ended") {
        fail(`A not rejected after notify reject: ${aState}`);
      } else pass("A reflects rejected after notify reject");

      const rejectCardGone = await pageB.evaluate(
        (rid) => !document.querySelector(`article[data-talk-call-notification][data-room-id="${rid}"]`),
        ROOM_ID
      );
      if (!rejectCardGone) fail("notify card still visible after reject");
      else pass("notify card removed after reject");

      await pageA.locator('[data-talk-call-action="cancel"]').click().catch(() => {});
      await cleanupActiveCallSessions([USER_A, USER_B]);

      const wrongUserCard = await pageB.evaluate(() => {
        window.TasuTalkNotifications?.add?.({
          id: "talk-call-fake-other-user",
          type: "general",
          source: "talk_call_v1",
          subType: "incoming_call",
          title: "音声通話の着信",
          body: "他人から",
          recipientUserId: "u_admin",
          threadId: "fake-room",
          callSessionId: "fake-session",
          priority: "urgent",
        });
        return [...document.querySelectorAll("[data-talk-call-notification]")].some(
          (el) => el.getAttribute("data-call-id") === "fake-session"
        );
      });
      if (wrongUserCard) fail("other user call card visible to B");
      else pass("other user call not shown to B");

      await pageB.close();
      await pageA.close();
    }

    console.log("");
    if (errors.length) {
      console.log(`FAILED (${errors.length}):`);
      errors.forEach((e) => console.log(`  - ${e}`));
      process.exit(1);
    }
    console.log("=== PASS (0 errors) ===\n");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
