#!/usr/bin/env node
/**
 * TASFUL TALK — chat-detail 通話連携 E2E
 *
 *   node scripts/test-talk-call-chat-detail.mjs
 *   SUPABASE_STRICT=1 node scripts/test-talk-call-chat-detail.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { ensureTalkTestUsers, loadTalkSupabaseConfig } from "./lib/talk-rls-test-auth.mjs";
import { enableTalkDevMode, signInTalkTestUser } from "./lib/talk-test-env.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const STRICT = process.env.SUPABASE_STRICT === "1";
const USER_A = "u_me";
const USER_B = "u_store";
const ROOM_ID = `talk-call-cd-${Date.now()}`;
const DEMO_1TO1_THREAD = "chat-demo-skill-deal-001";
const OFFICIAL_THREAD = "official_anpi";

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
    chatDomain: "work",
  };
}

async function waitCallModules(page) {
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

async function waitChatDetailReady(page) {
  await page.waitForFunction(
    () => document.body?.dataset?.chatDetailReady === "true",
    { timeout: 45000 }
  );
}

async function syncTestThread(page, meId, partnerId) {
  const thread = buildTestThread(meId, partnerId);
  await page.evaluate((t) => {
    window.TasuTalkCallChatDetail.syncFromThread(t);
  }, thread);
  return thread;
}

async function callButtonState(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll("[data-talk-call-start-button]")];
    const visible = buttons.filter((b) => !b.hidden);
    return {
      count: buttons.length,
      visibleCount: visible.length,
      enabled: visible.some((b) => !b.disabled && b.classList.contains("talk-call-btn--enabled")),
      disabled: visible.length ? visible.every((b) => b.disabled) : true,
    };
  });
}

async function headerLayoutOk(page) {
  return page.evaluate(() => {
    const peer = document.getElementById("chatPeerHeader");
    const mobile = document.getElementById("chatMobileHead");
    const vw = window.innerWidth;
    const peerOk = !peer || peer.getBoundingClientRect().width <= vw + 1;
    const mobileOk = !mobile || mobile.getBoundingClientRect().width <= vw + 1;
    return { peerOk, mobileOk, vw };
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

async function main() {
  console.log("\n=== TALK chat-detail 通話連携 E2E ===\n");
  if (STRICT) {
    await ensureTalkTestUsers([USER_A, USER_B]);
    await cleanupActiveCallSessions([USER_A, USER_B]);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await enableTalkDevMode(page);
    await page.goto(chatDetailUrl(USER_A, DEMO_1TO1_THREAD), { waitUntil: "load", timeout: 30000 });
    await waitCallModules(page);
    pass("call modules loaded on chat-detail");

    const layout390 = await headerLayoutOk(page);
    if (!layout390.peerOk || !layout390.mobileOk) {
      fail(`390px header overflow peer=${layout390.peerOk} mobile=${layout390.mobileOk}`);
    } else pass("390px header layout ok");

    await syncTestThread(page, USER_A, USER_B);
    const btn1 = await callButtonState(page);
    if (btn1.count < 1) fail("call button missing in DOM");
    else pass(`call button in DOM (${btn1.count})`);
    if (STRICT && !btn1.enabled) fail("1:1 thread: call button should be enabled (STRICT)");
    else if (btn1.enabled) pass("1:1 thread: call button enabled");
    else pass("1:1 thread: call button present (disabled — Supabase offline ok for non-STRICT)");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(chatDetailUrl(USER_A, OFFICIAL_THREAD), { waitUntil: "load" });
    await waitCallModules(page);
    const officialBtn = await callButtonState(page);
    if (officialBtn.visibleCount > 0 && officialBtn.enabled) {
      fail("official thread: call button should be hidden/disabled");
    } else pass("official/special thread: call button hidden or disabled");

    if (!STRICT) {
      console.log("\n  (skip full call flow — set SUPABASE_STRICT=1)\n");
    } else {
      const pageA = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await enableTalkDevMode(pageA);
      const pageB = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await enableTalkDevMode(pageB);

      await pageA.goto(chatDetailUrl(USER_A, ROOM_ID), { waitUntil: "domcontentloaded" });
      await waitCallModules(pageA);
      await signInTalkTestUser(pageA, USER_A);
      await syncTestThread(pageA, USER_A, USER_B);
      await pageA.evaluate(() => window.TasuTalkCallService.init());

      await pageB.goto(chatDetailUrl(USER_B, ROOM_ID), { waitUntil: "domcontentloaded" });
      await waitCallModules(pageB);
      await signInTalkTestUser(pageB, USER_B);
      await syncTestThread(pageB, USER_B, USER_A);
      await pageB.evaluate(() => window.TasuTalkCallService.init());
      await pageB.waitForTimeout(1000);

      const pageC = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await enableTalkDevMode(pageC);
      await pageC.goto(chatDetailUrl(USER_B, "other-room-not-matching"), { waitUntil: "domcontentloaded" });
      await waitCallModules(pageC);
      await signInTalkTestUser(pageC, USER_B);
      await pageC.evaluate(() => {
        window.TasuTalkCallChatDetail.syncFromThread({
          id: "other-room-not-matching",
          buyerId: "u_me",
          sellerId: "u_store",
          partnerUserId: "u_me",
          partner: { id: "u_me", displayName: "Other" },
          me: { id: "u_store", displayName: "Store" },
          listing: { title: "Other" },
        });
        window.TasuTalkCallService.init();
      });
      await pageC.waitForTimeout(800);
      const otherIncomingBefore = await pageC.evaluate(
        () => !document.querySelector("[data-talk-call-overlay]:not([hidden])")
      );
      if (!otherIncomingBefore) fail("other room page should not show incoming before call");
      else pass("incoming not shown for different room (pre-call)");
      await pageC.close();

      const initiateRes = await pageA.evaluate(async () => {
        const thread = window.TasuTalkCallChatDetail.getActiveThread();
        return window.TasuTalkCallService.initiateCall(thread);
      });
      if (!initiateRes?.ok) fail(`initiate: ${initiateRes?.reason || "failed"}`);
      else pass("A→B initiate from chat-detail");

      await pageB.waitForFunction(
        async () => {
          if (document.querySelector("[data-talk-call-overlay]:not([hidden])")) return true;
          await window.TasuTalkCallService?.refreshIncomingForActiveRoom?.();
          return Boolean(document.querySelector("[data-talk-call-overlay]:not([hidden])"));
        },
        { timeout: 25000 }
      );
      const incoming = await pageB.evaluate(() => document.querySelector("[data-talk-call-title]")?.textContent);
      if (!/着信/.test(String(incoming || ""))) fail(`B incoming UI: ${incoming}`);
      else pass("B incoming overlay on chat-detail (same room)");

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
        fail(`active session A=${states[0]} B=${states[1]}`);
      } else pass("both sides active after accept");

      const hangupPage = (await pageA.locator('[data-talk-call-action="hangup"]').count()) > 0 ? pageA : pageB;
      await hangupPage.locator('[data-talk-call-action="hangup"]').click();
      for (let i = 0; i < 30; i += 1) {
        const cleared = await Promise.all([
          pageA.evaluate(() => !window.TasuTalkCallService.getCurrentSession()),
          pageB.evaluate(() => !window.TasuTalkCallService.getCurrentSession()),
        ]);
        if (cleared[0] && cleared[1]) break;
        await pageA.waitForTimeout(500);
      }
      const afterHangup = await Promise.all([
        pageA.evaluate(() => Boolean(window.TasuTalkCallService.getCurrentSession())),
        pageB.evaluate(() => Boolean(window.TasuTalkCallService.getCurrentSession())),
      ]);
      if (afterHangup[0] || afterHangup[1]) {
        fail(`session not cleared after hangup A=${afterHangup[0]} B=${afterHangup[1]}`);
      } else pass("hangup from chat-detail");

      await syncTestThread(pageA, USER_A, USER_B);
      const first = await pageA.evaluate(async () => {
        const t = window.TasuTalkCallChatDetail.getActiveThread();
        return window.TasuTalkCallService.initiateCall(t);
      });
      if (!first?.ok) fail(`first call for busy test: ${first?.reason}`);
      const dup = await pageA.evaluate(async () => {
        try {
          const t = window.TasuTalkCallChatDetail.getActiveThread();
          return await window.TasuTalkCallService.initiateCall(t);
        } catch (err) {
          return { ok: false, reason: err.message };
        }
      });
      if (dup?.ok) fail("duplicate initiate should be blocked");
      else pass("duplicate initiate blocked while ringing");

      await pageA.locator('[data-talk-call-action="cancel"]').click().catch(() => {});
      await pageA
        .waitForFunction(() => !window.TasuTalkCallService.getCurrentSession(), { timeout: 15000 })
        .catch(() => {});
      await pageB.evaluate(() => window.TasuTalkCallService.hangup?.("cleanup")).catch(() => {});
      await cleanupActiveCallSessions([USER_A, USER_B]);
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
