#!/usr/bin/env node
/**
 * TASFUL TALK — WebRTC 1:1 通話 MVP E2E
 *
 *   node scripts/test-talk-webrtc-call-browser.mjs
 *   SUPABASE_STRICT=1 node scripts/test-talk-webrtc-call-browser.mjs
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
const DIRECT_THREAD = "talk-mock-friend-001";
const GROUP_THREAD = "talk-mock-group-001";
const OFFICIAL_THREAD = "official_anpi";
const USER_A = "u_me";
const USER_B = "u_store";

/** @type {string[]} */
const errors = [];

function pass(msg) {
  console.log(`  OK  ${msg}`);
}

function fail(msg) {
  errors.push(msg);
  console.error(`  NG  ${msg}`);
}

async function openThread(page, threadId) {
  await page.locator(`[data-talk-select-thread][data-talk-thread-id="${threadId}"]`).first().click();
  await page.waitForSelector("[data-talk-line-room-active]:not([hidden])", { timeout: 15000 });
  await page.waitForTimeout(400);
}

async function callButtonState(page) {
  return page.evaluate(() => {
    const btn = document.querySelector('[data-talk-line-action="call"]');
    return {
      exists: Boolean(btn),
      disabled: btn?.disabled !== false,
      enabledClass: btn?.classList.contains("talk-call-btn--enabled") === true,
      title: btn?.title || "",
    };
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
  if (STRICT) {
    await ensureTalkTestUsers([USER_A, USER_B]);
    await cleanupActiveCallSessions([USER_A, USER_B]);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await enableTalkDevMode(page);
    await gotoTalkHome(page, BASE, USER_A, "chat");
    await page.waitForFunction(
      () =>
        Boolean(
          window.TasuTalkCallService &&
            window.TasuTalkCallSignaling &&
            window.TasuTalkCallWebRtc &&
            window.TasuTalkCallUi
        ),
      { timeout: 15000 }
    );
    pass("call modules loaded");

    await openThread(page, DIRECT_THREAD);
    const directBtn = await callButtonState(page);
    if (!directBtn.exists) fail("direct thread: call button missing");
    else if (directBtn.disabled) {
      pass(`direct thread: call button present (disabled=${directBtn.disabled}, supabase may be offline)`);
    } else pass(`direct thread: call button enabled=${!directBtn.disabled}`);

    await openThread(page, GROUP_THREAD);
    const groupBtn = await callButtonState(page);
    if (!groupBtn.disabled) fail("group thread: call button should be disabled");
    else pass("group thread: call button disabled");

    await openThread(page, OFFICIAL_THREAD);
    const officialBtn = await callButtonState(page);
    if (!officialBtn.disabled) fail("official thread: call button should be disabled");
    else pass("official thread: call button disabled");

    if (!STRICT) {
      console.log("\n  (skip full call flow — set SUPABASE_STRICT=1 and apply sql/talk-call-schema.sql)");
    } else {
      await signInTalkTestUser(page, USER_A);
      const pageB = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await enableTalkDevMode(pageB);
      await gotoTalkHome(pageB, BASE, USER_B, "chat");
      await signInTalkTestUser(pageB, USER_B);

      await page.goto(talkHomeUrl(BASE, USER_A, "chat"), { waitUntil: "load" });
      await page.waitForTimeout(800);
      await openThread(page, DIRECT_THREAD);

      await pageB.goto(talkHomeUrl(BASE, USER_B, "chat"), { waitUntil: "load" });
      await pageB.waitForTimeout(800);
      await openThread(pageB, DIRECT_THREAD);
      await pageB.evaluate(() => window.TasuTalkCallService.init());

      const calleeCheck = await page.evaluate(() => {
        const thread = window.TasuTalkLineRoom?.getActiveThread?.();
        return thread?.partnerUserId || thread?.partner?.id || "";
      });
      if (calleeCheck !== USER_B) fail(`A thread partner expected ${USER_B}, got ${calleeCheck || "(empty)"}`);
      else pass(`A thread partner=${USER_B} (dev mock remap)`);

      const initiateRes = await page.evaluate(async () => {
        const thread = window.TasuTalkLineRoom?.getActiveThread?.();
        return window.TasuTalkCallService.initiateCall(thread);
      });
      if (!initiateRes?.ok) fail(`initiate: ${initiateRes?.reason || "failed"}`);
      else pass("A→B initiate");

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
      else pass("B incoming UI (Realtime)");

      await pageB.locator('[data-talk-call-action="accept"]').click();
      await page.waitForSelector("[data-talk-call-overlay]:not([hidden])", { timeout: 20000 });
      await page.waitForTimeout(2000);

      const states = await Promise.all([
        page.evaluate(() => ({
          session: window.TasuTalkCallService.getCurrentSession()?.status,
          pc: window.TasuTalkCallWebRtc.getPeerConnection()?.connectionState,
          remoteAudio: Boolean(document.querySelector("audio")?.srcObject),
        })),
        pageB.evaluate(() => ({
          session: window.TasuTalkCallService.getCurrentSession()?.status,
          pc: window.TasuTalkCallWebRtc.getPeerConnection()?.connectionState,
          remoteAudio: Boolean(document.querySelector("audio")?.srcObject),
        })),
      ]);
      if (states[0].session !== "active" || states[1].session !== "active") {
        fail(`active session A=${states[0].session} B=${states[1].session}`);
      } else pass("both sides active session");
      if (!states[0].remoteAudio && !states[1].remoteAudio) {
        fail(`audio: no remote stream A.pc=${states[0].pc} B.pc=${states[1].pc}`);
      } else pass(`audio path ok (A.pc=${states[0].pc}, B.pc=${states[1].pc})`);

      await page.locator('[data-talk-call-action="hangup"]').click();
      await page.waitForFunction(
        () => !window.TasuTalkCallService.getCurrentSession(),
        { timeout: 10000 }
      );
      await pageB.waitForFunction(
        () => !window.TasuTalkCallService.getCurrentSession(),
        { timeout: 10000 }
      );
      const afterHangup = await page.evaluate(() => window.TasuTalkCallService.getCurrentSession());
      if (afterHangup) fail("session not cleared after hangup");
      else pass("hangup cleanup");

      // busy: callee ringing → caller duplicate + callee outbound blocked
      await openThread(page, DIRECT_THREAD);
      await openThread(pageB, DIRECT_THREAD);
      const ringRes = await page.evaluate(async () => {
        try {
          const t = window.TasuTalkLineRoom.getActiveThread();
          return await window.TasuTalkCallService.initiateCall(t);
        } catch (err) {
          return { ok: false, reason: err.message };
        }
      });
      if (!ringRes?.ok) fail(`busy setup: ${ringRes?.reason || "failed"}`);
      await page.waitForTimeout(500);
      const busyCaller = await page.evaluate(async () => {
        try {
          const t = window.TasuTalkLineRoom.getActiveThread();
          return await window.TasuTalkCallService.initiateCall(t);
        } catch (err) {
          return { ok: false, reason: err.message };
        }
      });
      const busyCallee = await pageB.evaluate(async () => {
        try {
          const t = window.TasuTalkLineRoom.getActiveThread();
          return await window.TasuTalkCallService.initiateCall(t);
        } catch (err) {
          return { ok: false, reason: err.message };
        }
      });
      if (busyCaller?.ok) fail("busy: duplicate caller initiate should fail");
      else pass("busy blocks duplicate caller initiate");
      if (busyCallee?.ok) fail("busy: callee outbound while ringing should fail");
      else pass("busy blocks callee while ringing");

      await page.locator('[data-talk-call-action="cancel"]').click().catch(() => {});
      await pageB.locator('[data-talk-call-action="reject"]').click().catch(() => {});
      await page.waitForFunction(
        () => !window.TasuTalkCallService.getCurrentSession(),
        { timeout: 10000 }
      );
      await pageB.waitForFunction(
        () => !window.TasuTalkCallService.getCurrentSession(),
        { timeout: 10000 }
      );

      // 60s timeout → missed (no answer)
      await openThread(page, DIRECT_THREAD);
      await openThread(pageB, DIRECT_THREAD);
      const timeoutStart = await page.evaluate(async () => {
        try {
          const t = window.TasuTalkLineRoom.getActiveThread();
          return await window.TasuTalkCallService.initiateCall(t);
        } catch (err) {
          return { ok: false, reason: err.message };
        }
      });
      if (!timeoutStart?.ok) fail(`timeout setup initiate: ${timeoutStart?.reason || "failed"}`);
      else pass("timeout test: ringing started");
      await page.waitForTimeout(62000);
      const timeoutState = await Promise.all([
        page.evaluate(() => ({
          session: window.TasuTalkCallService.getCurrentSession(),
          overlayHidden: document.querySelector("[data-talk-call-overlay]")?.hidden !== false,
        })),
        pageB.evaluate(async (sessionId) => {
          const sb = window.TasuSupabase?.getClient?.();
          if (!sb) return { dbStatus: null };
          const { data } = await sb.from("talk_call_sessions").select("status").eq("id", sessionId).maybeSingle();
          return { dbStatus: data?.status || null, overlayHidden: document.querySelector("[data-talk-call-overlay]")?.hidden !== false };
        }, timeoutStart.sessionId),
      ]);
      if (timeoutState[1].dbStatus !== "missed") {
        fail(`60s timeout: expected missed, db=${timeoutState[1].dbStatus}`);
      } else pass("60s timeout → missed");
      if (!timeoutState[0].overlayHidden) fail("60s timeout: caller overlay not cleared");
      else pass("60s timeout: caller UI cleared");

      await pageB.close();
    }

    await page.close();
  } finally {
    await browser.close();
  }

  console.log(`\n=== ${errors.length ? "FAIL" : "PASS"} (${errors.length} errors) ===`);
  if (errors.length) {
    errors.forEach((e) => console.error(` - ${e}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
