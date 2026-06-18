/**
 * Phase 4 追補 — ナビ遷移 + 公式通知カード UI（390 / 1280）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "talk-notify-center-final-390");
const LEGACY_OUT_DIR = path.join(__dirname, "..", "screenshots", "talk-nav-phase4-390");
const PORTS = [5173, 5174, 5176, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://localhost:${port}/talk-home.html?tab=chat`, { method: "GET" });
      if (res.ok) return `http://localhost:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(LEGACY_OUT_DIR, { recursive: true });
const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {async function ensureUnreadNotifyCards(page, roomId) {
  await page.evaluate((id) => {
    const store = window.TasuTalkNotifications;
    const rooms = window.TasuTalkOfficialRooms;
    if (!rooms?.loadMessagesForRoom) return;
    const messages = rooms.loadMessagesForRoom(id) || [];
    const ids = messages
      .map((m) => m?.notifyCard?.notificationId)
      .filter(Boolean)
      .slice(0, 3);
    ids.forEach((nid) => {
      store?.markUnread?.(nid);
      window.TasuTalkData?.markNotificationUnread?.(nid);
    });
  }, roomId);
}

async function openOfficialRoom(page, roomId) {
  await page.goto(`${base}/talk-home.html?tab=chat&talkDev=1`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector("[data-talk-line-messages], #talkChatThreadList", { timeout: 15000 }).catch(() => {});
  await ensureUnreadNotifyCards(page, roomId);
  await page.goto(`${base}/talk-home.html?tab=chat&thread=${encodeURIComponent(roomId)}&talkDev=1`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector("[data-talk-line-messages]", { timeout: 15000 });
  await page.waitForTimeout(1800);
}

async function inspectRoomCard(page, options = {}) {
  return page.evaluate(({ requireListing }) => {
    const cards = [...document.querySelectorAll(".talk-line-room-notify-card")];
    const card = cards[0];
    const cta = card?.querySelector(".talk-line-room-notify-card__cta");
    const href = cta?.getAttribute("href") || "";
    const listing =
      cards.map((el) => el.querySelector(".talk-line-room-notify-card__listing")?.textContent?.trim() || "").find(Boolean) ||
      "";
    const cardRect = card?.getBoundingClientRect?.();
    const ctaRect = cta?.getBoundingClientRect?.();
    const cardWrapRect = card?.closest(".chat-msg--official-notify")?.getBoundingClientRect?.();
    const tag = card?.querySelector(".talk-line-room-notify-card__tag");
    let ctaFullWidth = false;
    if (card && cta) {
      const cs = getComputedStyle(card);
      const innerW = card.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      ctaFullWidth = Math.abs(cta.getBoundingClientRect().width - innerW) < 2;
    }
    return {
      hasRichCard: cards.length > 0,
      cardCount: cards.length,
      tag: tag?.textContent?.trim() || "",
      tagTone: tag?.className?.match(/talk-line-room-notify-card__tag--(\w+)/)?.[1] || "",
      unreadDotCount: cards.filter((el) => el.querySelector(".talk-line-room-notify-card__unread-dot")).length,
      listing,
      hasListing: requireListing ? Boolean(listing) : Boolean(listing),
      event: card?.querySelector(".talk-line-room-notify-card__event")?.textContent?.trim() || "",
      body:
        cards
          .map((el) => el.querySelector(".talk-line-room-notify-card__body")?.textContent?.trim() || "")
          .find(Boolean) || "",
      cta: cta?.textContent?.trim() || "",
      ctaHref: href,
      ctaFullWidth,
      cardHeight: cardWrapRect?.height || cardRect?.height || 0,
      layout: card?.className || "",
      genericOnly: cta?.textContent?.trim() === "確認する",
    };
  }, { requireListing: options.requireListing === true });
}

function listChipCount(page, threadId) {
  return page.evaluate((id) => {
    const item = document.querySelector(`[data-talk-thread-id="${id}"]`);
    return item?.querySelectorAll(".talk-line-list__chip")?.length || 0;
  }, threadId);
}

const page390 = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page390.goto(`${base}/talk-home.html?tab=chat&talkDev=1`, { waitUntil: "domcontentloaded" });
await page390.waitForSelector(".talk-line-rail__label", { timeout: 15000 }).catch(() => {});
await page390.waitForTimeout(1200);

const nav390 = await page390.evaluate(() => {
  const builder = document.querySelector('[data-talk-line-nav="builder"]');
  const ai = document.querySelector('[data-talk-line-nav="ai"]');
  const platformItem = document.querySelector('[data-talk-thread-id="official_platform"]');
  const anpiItem = document.querySelector('[data-talk-thread-id="official_anpi"]');
  return {
    builderHref: builder?.getAttribute("href") || "",
    aiHref: ai?.getAttribute("href") || "",
    categoryTabs: [...document.querySelectorAll("[data-talk-line-list-filters] .talk-line-category-tab")].map((el) =>
      el.textContent?.trim()
    ),
    platformListChipCount: platformItem?.querySelectorAll(".talk-line-list__chip")?.length || 0,
    anpiListChipCount: anpiItem?.querySelectorAll(".talk-line-list__chip")?.length || 0,
    platformListPreview:
      platformItem?.querySelector(".talk-line-list__preview")?.textContent?.trim() || "",
  };
});

await openOfficialRoom(page390, "official_platform");
const platform390 = await inspectRoomCard(page390, { requireListing: true });
await page390.screenshot({ path: path.join(OUT_DIR, "talk-platform-notify-card-mobile390.png"), fullPage: true });

await openOfficialRoom(page390, "official_anpi");
const anpi390 = await inspectRoomCard(page390);
await page390.screenshot({ path: path.join(OUT_DIR, "talk-anpi-notify-card-mobile390.png"), fullPage: true });

await openOfficialRoom(page390, "official_tasful");
const tasful390 = await inspectRoomCard(page390);
await page390.screenshot({ path: path.join(OUT_DIR, "talk-tasful-notify-card-mobile390.png"), fullPage: true });

await page390.goto(`${base}/talk-home.html?tab=chat&talkDev=1`, { waitUntil: "domcontentloaded" });
await page390.waitForTimeout(800);
await page390.screenshot({ path: path.join(OUT_DIR, "talk-home-mobile390.png"), fullPage: true });
await page390.close();

const page1280 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await openOfficialRoom(page1280, "official_platform");
const platform1280 = await inspectRoomCard(page1280);
await page1280.screenshot({ path: path.join(OUT_DIR, "talk-home-desktop1280.png"), fullPage: true });
await page1280.close();

});

const checks = {
  builderToWorkspace: /builder\/index\.html$/i.test(nav390.builderHref),
  aiToWorkspace: /ai-workspace\.html$/i.test(nav390.aiHref),
  categoryTabsOk: ["すべて", "プラット", "安否", "運営", "友達"].every((l) => nav390.categoryTabs.includes(l)),
  singleBadgePlatformList: nav390.platformListChipCount <= 1,
  singleBadgeAnpiList: nav390.anpiListChipCount <= 1,
  platformRichCard: platform390.hasRichCard && !platform390.genericOnly,
  platformListingShown: Boolean(platform390.listing),
  platformCategoryTag: Boolean(platform390.tag),
  platformUnreadDots: platform390.unreadDotCount > 0,
  platformCtaFullWidth390: platform390.ctaFullWidth,
  platformCtaSemantic: platform390.cta && platform390.cta !== "確認する",
  platformCtaHref: Boolean(platform390.ctaHref && platform390.ctaHref !== "#"),
  anpiRichCard: anpi390.hasRichCard && !anpi390.genericOnly,
  anpiCta: anpi390.cta === "安否状況を見る",
  anpiCategoryTag: anpi390.tag === "安否" && anpi390.tagTone === "anpi",
  anpiUnreadDots: anpi390.unreadDotCount > 0,
  tasfulRichCard: tasful390.hasRichCard && !tasful390.genericOnly,
  tasfulCtaSemantic: tasful390.cta && tasful390.cta !== "確認する",
  tasfulBodyShown: Boolean(tasful390.body) && !/システムメンテナンス、規約変更/.test(tasful390.body || ""),
  tasfulNoGenericBody: !/システムメンテナンス、規約変更/.test(tasful390.body || ""),
};

const report = {
  pass: Object.values(checks).every(Boolean),
  checks,
  nav390,
  platform390,
  anpi390,
  tasful390,
  platform1280,
};

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.pass) {
  console.error("FAIL");
  await closeAllBrowsers();
  process.exit(1);
}
console.log("PASS");
