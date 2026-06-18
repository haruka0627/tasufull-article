#!/usr/bin/env node
/**
 * 通知システム棚卸し — 通知タブ / TASFUL TALK / シード一覧
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { writeFileSync, mkdirSync } from "fs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = "screenshots/notify-system-audit";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

await page.goto(`${BASE}/talk-home.html?tab=notify`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(3000);

const audit = await page.evaluate(() => {
  const pickHref = (n) =>
    String(n?.href || n?.targetUrl || n?.url || "#").trim() || "#";
  const pickType = (n) =>
    window.TasuTalkData?.resolveNotifyFilterTypeId?.(n) ||
    String(n?.type || "").toLowerCase() ||
    "(unknown)";
  const pickAction = (n) =>
    String(n?.actionLabel || n?.action_label || "確認する").trim() || "確認する";

  const listOpts = {
    filter: "all",
    applySettings: true,
    showMuted: false,
  };
  const notifyTab = (window.TasuTalkData?.getNotifications?.(listOpts) || []).map((n) => ({
    id: n.id,
    title: n.title,
    type: pickType(n),
    category: n.category || "",
    href: pickHref(n),
    actionLabel: pickAction(n),
    source: n.source || "",
    sendTalkMessage: Boolean(n.sendTalkMessage),
    officialRoomId: n.officialRoomId || "",
  }));

  const storeAll = (() => {
    try {
      return JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    } catch {
      return [];
    }
  })();

  const seeds = {
    platform: window.TasuTalkPlatformNotifyMaster?.buildMaster?.(Date.now()) || [],
    platformFee: window.TasuTalkPlatformFeeNotifyMaster?.buildMaster?.(Date.now()) || [],
    builder: window.TasuTalkBuilderNotifyMaster?.buildMaster?.(Date.now()) || [],
    anpi: window.TasuTalkAnpiNotifyMaster?.buildMaster?.(Date.now()) || [],
  };

  const seedRows = [
    ...seeds.platform.map((n) => ({ bucket: "PLATFORM_MASTER_V1", ...n })),
    ...seeds.platformFee.map((n) => ({ bucket: "PLATFORM_FEE_MASTER_V1", ...n })),
    ...seeds.builder.map((n) => ({ bucket: "BUILDER_MASTER_V1", ...n })),
    ...seeds.anpi.map((n) => ({ bucket: "ANPI_MASTER_V1", ...n })),
  ].map((n) => ({
    bucket: n.bucket,
    id: n.id,
    title: n.title,
    type: String(n.type || "").toLowerCase(),
    category: n.category || "",
    href: pickHref(n),
    actionLabel: pickAction(n),
    source: n.source || "",
    sendTalkMessage: Boolean(n.sendTalkMessage),
    officialRoomId: n.officialRoomId || "",
  }));

  const preserved = [
    {
      bucket: "PRESERVED_SPECIAL",
      id: "talk-n-006",
      title: "安否確認 — 契約者へ共有",
      type: "anpi",
      href: "anpi-dashboard.html#check",
      actionLabel: "安否を確認",
      source: "anpi-dashboard",
    },
    {
      bucket: "PRESERVED_SPECIAL",
      id: "talk-n-008",
      title: "完了報告の確認が必要です",
      type: "builder",
      href: "(listingRoute deal builder_demo_001)#completion",
      actionLabel: "完了を確認",
      source: "builder-mvp",
    },
  ];

  const talkMirror = storeAll
    .filter((n) => n.sendTalkMessage && n.officialRoomId)
    .map((n) => ({
      id: n.id,
      title: n.title,
      type: pickType(n),
      category: n.category || "",
      href: pickHref(n),
      actionLabel: pickAction(n),
      officialRoomId: n.officialRoomId || "",
      source: n.source || "",
    }));

  const messages = (() => {
    try {
      return JSON.parse(localStorage.getItem("tasful_chat_messages") || "{}");
    } catch {
      return {};
    }
  })();

  const talkCards = [];
  for (const roomId of ["official_tasful", "official_anpi", "official_builder"]) {
    const msgs = Array.isArray(messages[roomId]) ? messages[roomId] : [];
    for (const m of msgs) {
      const card = m.notifyCard || {};
      talkCards.push({
        roomId,
        notificationId: card.notificationId || m.notificationId || "",
        title: card.title || m.text || "",
        type: card.type || card.category || "",
        href: String(card.href || card.targetUrl || m.href || "#"),
        actionLabel: card.actionLabel || card.action_label || "確認する",
        messageId: m.id || "",
      });
    }
  }

  const renderedNotify = [...document.querySelectorAll("[data-talk-notify-id]")].map((el) => {
    const id = el.getAttribute("data-talk-notify-id") || "";
    const title =
      el.querySelector(".talk-notify-card__title")?.textContent?.trim() ||
      el.querySelector(".talk-notify-card__headline")?.textContent?.trim() ||
      "";
    const action =
      el.querySelector("[data-talk-notify-action]")?.textContent?.trim() ||
      el.querySelector(".talk-notify-card__action")?.textContent?.trim() ||
      "";
    const href =
      el.querySelector("[data-talk-notify-action]")?.getAttribute("href") ||
      el.querySelector("a[href]")?.getAttribute("href") ||
      "";
    const type =
      el.querySelector(".talk-notify-card__category-chip")?.textContent?.trim() || "";
    return { id, title, type, href, actionLabel: action };
  });

  return {
    notifyTab,
    renderedNotify,
    talkMirror,
    talkCards,
    seedRows,
    preserved,
    storeCount: storeAll.length,
    storeIds: storeAll.map((n) => n.id),
  };
});

writeFileSync(`${OUT}/audit.json`, JSON.stringify(audit, null, 2), "utf8");

console.log("=== 1. 通知タブ表示 (getNotifications) ===");
console.log(`件数: ${audit.notifyTab.length}`);
for (const n of audit.notifyTab) {
  console.log(`${n.id}\t${n.title}\t${n.type}\t${n.href}\t[${n.actionLabel}] src=${n.source}`);
}

console.log("\n=== 2. TASFUL TALK 公式ルーム通知 (sendTalkMessage) ===");
console.log(`件数: ${audit.talkMirror.length}`);
for (const n of audit.talkMirror) {
  console.log(`${n.id}\t${n.title}\t${n.type}\t${n.href}\troom=${n.officialRoomId}`);
}

console.log("\n=== 2b. TALK メッセージ内 notifyCard ===");
console.log(`件数: ${audit.talkCards.length}`);
for (const n of audit.talkCards) {
  console.log(`${n.notificationId || n.messageId}\t${n.title}\t${n.type}\t${n.href}\troom=${n.roomId}`);
}

console.log("\n=== 3. シード定義 (buildMaster) ===");
console.log(`件数: ${audit.seedRows.length + audit.preserved.length}`);
for (const n of [...audit.seedRows, ...audit.preserved]) {
  console.log(`[${n.bucket}] ${n.id}\t${n.title}\t${n.type || ""}\t${n.href}`);
}

console.log(`\nlocalStorage store: ${audit.storeCount} ids`);
console.log(`Saved: ${OUT}/audit.json`);

await browser.close();
