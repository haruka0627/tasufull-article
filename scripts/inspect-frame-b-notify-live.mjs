#!/usr/bin/env node
/**
 * 実際の #frame-b-notify を chatStarted 直後に検査 + 空表示スクショ
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "bench-b-notify-inspect");
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function readBNotifyFrame(bench) {
  const src = await bench.locator("#frame-b-notify").getAttribute("src");
  const frame = bench.frame({ url: /userId=u_hiro|tab=notify/ });
  if (!frame) {
    return { src, frameFound: false };
  }
  const data = await frame.evaluate(() => {
    const params = new URLSearchParams(location.search);
    const emptyEl = document.querySelector(".talk-notify-empty-state__title");
    const cards = [...document.querySelectorAll(".talk-notify-card")];
    const titles = cards
      .map((c) => c.querySelector(".talk-notify-card__title")?.textContent?.trim() || "")
      .filter(Boolean);
    window.TasuTalkData?.invalidateNotificationsBootstrap?.();
    const visibleAll =
      window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false, showMuted: true }) || [];
    const filtered =
      window.TasuTalkJobFullReviewMode?.filterJobFullReviewNotifications?.(visibleAll) || visibleAll;
    const listOpts = window.TasuTalkHomeUi ? null : null;
    return {
      iframeUserId: params.get("userId"),
      demoProfile: params.get("demoProfile"),
      review: params.get("review"),
      benchEmbed: params.get("benchEmbed"),
      domCardCount: cards.length,
      visibleTitles: titles,
      emptyStateText: emptyEl?.textContent?.trim() || null,
      benchCompact: document.body.classList.contains("talk-bench-notify-compact"),
      tabNotify: document.body.classList.contains("talk-home--tab-notify"),
      pipelineAll: visibleAll.length,
      pipelineFiltered: filtered.length,
      pipelineTitles: filtered.map((n) => n.title),
      rawStarted: (() => {
        try {
          return JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]").filter((n) =>
            /やりとりが開始/.test(n.title || "")
          ).length;
        } catch {
          return -1;
        }
      })(),
    };
  });
  return { src, frameFound: true, ...data };
}

try {
  const bench = await (await browser.newContext()).newPage({ viewport: { width: 1280, height: 900 } });
  const contactId = "contact-demo-skill-dual-001";

  await bench.goto(
    `${BASE}/chat-dual-window-demo.html?benchPattern=skill-0&liveFlow=1&liveFlowReset=1&benchViewport=1280`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await bench.waitForTimeout(2500);

  const before = await readBNotifyFrame(bench);
  console.log("\n=== BEFORE chatStarted ===");
  console.log(JSON.stringify(before, null, 2));
  await bench.locator("#frame-b-notify").screenshot({ path: path.join(OUT_DIR, "01-before-chat-started.png") });

  await bench.evaluate((cid) => {
    const C = window.TasuListingContactRequestsStore;
    const now = new Date().toISOString();
    localStorage.setItem(
      C.STORAGE_KEY,
      JSON.stringify([
        {
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
        },
      ])
    );
    const F = window.TasuPlatformChatFee;
    F.ensurePendingFeeDeferred({ listing: C.resolveListing("demo-skill-001"), contactId: cid, feeAmount: 550 });
    F.markFeePaid(`deferred:contact:${cid}`, { listingId: "demo-skill-001", feeAmount: 550 });
    const activated = F.activateDeferredAfterPayment({ contactId: cid, listingId: "demo-skill-001" });
    if (!activated?.ok) throw new Error(activated?.reason);
    return window.TasuPlatformChatDualWindowNotify?.notifyDemoChatStarted?.({
      thread: activated.thread,
      threadId: activated.threadId,
      payerId: "u_sachi",
    });
  }, contactId);

  for (const ms of [0, 100, 500, 1500, 3000]) {
    if (ms) await bench.waitForTimeout(ms);
    const snap = await readBNotifyFrame(bench);
    console.log(`\n=== +${ms}ms after chatStarted ===`);
    console.log(JSON.stringify(snap, null, 2));
    if (snap.emptyStateText === "該当する通知はありません") {
      await bench.locator("#frame-b-notify").screenshot({
        path: path.join(OUT_DIR, `02-empty-at-${ms}ms.png`),
      });
      console.log(`>>> 空表示スクショ: screenshots/bench-b-notify-inspect/02-empty-at-${ms}ms.png`);
    }
    if (snap.domCardCount > 0) {
      await bench.locator("#frame-b-notify").screenshot({
        path: path.join(OUT_DIR, `03-with-card-at-${ms}ms.png`),
      });
    }
  }

  const parentNotify = await bench.evaluate(() => {
    const n = (window.TasuTalkNotifications?.getAll?.() || []).find(
      (r) => r.recipientUserId === "u_hiro" && /やりとりが開始/.test(r.title || "")
    );
    return n
      ? {
          id: n.id,
          title: n.title,
          recipientUserId: n.recipientUserId,
          category: n.category,
          type: n.type,
          createdAt: n.createdAt,
        }
      : null;
  });
  console.log("\n=== parent store record ===");
  console.log(JSON.stringify(parentNotify, null, 2));

  const final = await readBNotifyFrame(bench);
  console.log("\n=== 差異分析 ===");
  if (parentNotify && final.emptyStateText === "該当する通知はありません") {
    console.log("差異: parent store にはレコードあり / B上 iframe は空表示");
    if (final.pipelineFiltered > 0 && final.domCardCount === 0) {
      console.log("原因候補: pipeline にあるが DOM 未描画（renderNotifications 未実行 or 古いDOM）");
    } else if (final.pipelineFiltered === 0 && final.rawStarted > 0) {
      console.log("原因候補: localStorage にはあるが filter/getNotifications で除外");
    } else if (final.rawStarted === 0) {
      console.log("原因候補: iframe 側 localStorage 未同期（別オリジン/未読込）");
    } else {
      console.log(`原因候補: pipelineFiltered=${final.pipelineFiltered} domCardCount=${final.domCardCount}`);
    }
  } else if (!parentNotify) {
    console.log("差異: 生成失敗（parent store なし）");
  } else {
    console.log("差異なし: B上にカード表示");
  }
} finally {
  await browser.close();
}
