#!/usr/bin/env node
/**
 * domCards vs 実表示の不一致調査 — 指定URLのみ
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const EXACT_PATH =
  "/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=skill-0";
const EXACT_URL = `${BASE}${EXACT_PATH}`;
const OUT_DIR = path.join("screenshots", "bench-b-notify-inspect");
fs.mkdirSync(OUT_DIR, { recursive: true });

const contactId = "contact-demo-skill-dual-001";

function auditBNotify(page) {
  return page.evaluate(() => {
    const el = document.getElementById("frame-b-notify");
    const win = el?.contentWindow;
    if (!win) return { error: "no contentWindow" };

    const doc = win.document;
    const listHost = doc.querySelector("[data-talk-notify-list]");
    const params = new URLSearchParams(win.location.search);

    const cardEls = [...doc.querySelectorAll(".talk-notify-card")];
    const titleEls = [...doc.querySelectorAll(".talk-notify-card__title")];
    const emptyEl = doc.querySelector(".talk-notify-empty-state__title");

    const cardVisibility = cardEls.map((card) => {
      const rect = card.getBoundingClientRect();
      const style = win.getComputedStyle(card);
      const title = card.querySelector(".talk-notify-card__title")?.textContent?.trim() || "";
      return {
        title,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        inList: listHost?.contains(card) ?? false,
      };
    });

    win.TasuTalkData?.invalidateNotificationsBootstrap?.();
    const pipelineAll =
      win.TasuTalkData?.getNotifications?.({
        filter: "all",
        applySettings: false,
        showMuted: true,
      }) || [];
    const pipelineRender =
      win.TasuTalkData?.getNotifications?.({
        filter: "all",
        applySettings: true,
        showMuted: false,
      }) || [];

    const storeAll = win.TasuTalkNotifications?.getAll?.() || [];
    const storeHiro = storeAll.filter((n) => n.recipientUserId === "u_hiro");
    const startedStore = storeHiro.filter((n) => /やりとりが開始/.test(n.title || ""));

    const Review = win.TasuTalkChatDemoReviewMode;
    const filteredManual = Review?.filterChatDemoReviewNotifications?.(storeAll) || storeAll;
    const startedFiltered = filteredManual.filter(
      (n) => n.recipientUserId === "u_hiro" && /やりとりが開始/.test(n.title || "")
    );

    const parentStore = (window.TasuTalkNotifications?.getAll?.() || []).filter(
      (n) => n.recipientUserId === "u_hiro" && /やりとりが開始/.test(n.title || "")
    );

    return {
      iframeUserId: params.get("userId"),
      demoProfile: params.get("demoProfile"),
      benchEmbed: params.get("benchEmbed"),
      benchCompact: doc.body.classList.contains("talk-bench-notify-compact"),
      listHostSig: listHost?.dataset?.notifyRenderSig || null,
      listHostClass: listHost?.className || "",
      listHostHtmlHead: (listHost?.innerHTML || "").slice(0, 280),
      emptyStateText: emptyEl?.textContent?.trim() || null,
      domCardCount: cardEls.length,
      domTitleCount: titleEls.length,
      domTitles: titleEls.map((n) => n.textContent?.trim()).filter(Boolean),
      cardVisibility,
      pipelineAllCount: pipelineAll.length,
      pipelineAllTitles: pipelineAll.map((n) => n.title),
      pipelineRenderCount: pipelineRender.length,
      pipelineRenderTitles: pipelineRender.map((n) => n.title),
      storeHiroCount: storeHiro.length,
      startedInStore: startedStore.map((n) => ({ title: n.title, source: n.source, id: n.id })),
      startedAfterFilter: startedFiltered.map((n) => ({ title: n.title, source: n.source })),
      parentStartedCount: parentStore.length,
      parentStartedTitles: parentStore.map((n) => n.title),
      mismatch:
        pipelineAll.some((n) => /やりとりが開始/.test(n.title || "")) &&
        !titleEls.some((n) => /やりとりが開始/.test(n.textContent || "")),
    };
  });
}

await withPlaywrightBrowser(async (browser) => {
  await page.goto(EXACT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);

  await page.evaluate((cid) => {
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
    window.TasuPlatformChatFee.ensurePendingFeeDeferred({
      listing: C.resolveListing("demo-skill-001"),
      contactId: cid,
      feeAmount: 550,
    });
  }, contactId);

  const feeUrl =
    `${BASE}/platform-chat-fee-pay.html?contactId=${contactId}&listingId=demo-skill-001&category=skill` +
    `&talkDev=1&review=chat-demo&liveFlow=1&demoProfile=skill&demoConnect=0&userId=u_sachi&from=notify&benchEmbed=1&benchViewport=1280`;

  await page.locator("#frame-a-chat").evaluate((el, url) => {
    el.src = url;
  }, feeUrl);
  await page.waitForTimeout(2500);

  const feeFrame = page.frames().find((f) => /platform-chat-fee-pay/.test(f.url()));
  if (!feeFrame) throw new Error("fee-pay missing");

  await feeFrame.evaluate(() => {
    window.confirm = () => true;
    document.querySelector("[data-platform-fee-pay]")?.click();
  });

  const timeline = [];
  let prevMs = 0;
  for (const ms of [0, 100, 300, 500, 1000, 1500, 3000, 5000]) {
    if (ms > prevMs) await page.waitForTimeout(ms - prevMs);
    prevMs = ms;
    const audit = await auditBNotify(page);
    const shot = path.join(OUT_DIR, `mismatch-t${ms}ms-b-notify.png`);
    await page.locator("#frame-b-notify").screenshot({ path: shot });
    timeline.push({ ms, audit, screenshot: shot });
    console.log(`\n=== t+${ms}ms ===`);
    console.log(
      JSON.stringify(
        {
          empty: audit.emptyStateText,
          domTitles: audit.domTitles,
          domCardCount: audit.domCardCount,
          pipelineAll: audit.pipelineAllTitles,
          pipelineRender: audit.pipelineRenderTitles,
          startedInStore: audit.startedInStore?.length,
          startedAfterFilter: audit.startedAfterFilter?.length,
          parentStarted: audit.parentStartedCount,
          mismatch: audit.mismatch,
          listHostSig: audit.listHostSig,
        },
        null,
        2
      )
    );
    if (audit.mismatch) {
      console.log(">>> MISMATCH detail:", JSON.stringify(audit, null, 2));
    }
  }

  const last = timeline.at(-1)?.audit;
  console.log("\n=== SUMMARY ===");
  if (last?.parentStartedCount > 0 && last?.domCardCount === 0) {
    console.log("確定: parent store に chat-started あり / B上 DOM カードなし");
    if (last.pipelineAllCount > 0 && last.pipelineRenderCount === 0) {
      console.log("原因候補: applySettings=true で render 用 pipeline が空");
    } else if (last.startedAfterFilter?.length === 0 && last.startedInStore?.length > 0) {
      console.log("原因候補: filterChatDemoReviewNotifications が chat-started を除外");
    } else if (last.pipelineAllCount > 0 && last.domCardCount === 0) {
      console.log("原因候補: pipeline にあるが renderNotifications 未実行 or 古い empty DOM");
    }
  } else if (last?.domCardCount > 0) {
    console.log("DOM にカードあり — 以前の全画面スクショは別ウィンドウの可能性");
  }
});

await closeAllBrowsers();
