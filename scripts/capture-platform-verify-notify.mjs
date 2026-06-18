#!/usr/bin/env node
/**
 * プラット通知 v3 検証 — 390px スクショ + カテゴリ切替
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "platform-verify-notify");
const MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_platform_fee_notify_master_v2",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
];

const CATEGORY_CHIPS = [
  { id: "all", label: "すべて" },
  { id: "job", label: "求人" },
  { id: "worker", label: "ワーカー" },
  { id: "skill", label: "スキル" },
  { id: "product", label: "商品" },
  { id: "business", label: "業務" },
  { id: "shop", label: "店舗" },
  { id: "builder", label: "Builder" },
  { id: "anpi", label: "安否" },
  { id: "ai", label: "AI" },
  { id: "official", label: "公式" },
  { id: "system", label: "運営" },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

await page.addInitScript(({ markers }) => {
  markers.forEach((k) => localStorage.removeItem(k));
}, { markers: MARKERS });

await page.goto(`${BASE}/talk-home.html?tab=notify`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(3500);

const audit = await page.evaluate(() => {
  const rows = (window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: true }) || []).map(
    (n) => ({
      id: n.id,
      title: n.title,
      type: window.TasuTalkData?.resolveNotifyFilterTypeId?.(n) || n.type,
      href: n.href || n.targetUrl || "#",
      actionLabel: n.actionLabel || "確認する",
      sendTalkMessage: Boolean(n.sendTalkMessage),
      officialRoomId: n.officialRoomId || "",
    })
  );
  const cards = [...document.querySelectorAll("[data-talk-notify-id]")].map((el) => ({
    id: el.getAttribute("data-talk-notify-id"),
    title: el.querySelector(".talk-notify-card__title, .talk-notify-card__headline")?.textContent?.trim(),
    bodyLen: el.querySelector(".talk-notify-card__body")?.textContent?.trim()?.length || 0,
    action: el.querySelector("[data-talk-notify-action], .talk-notify-card__action")?.textContent?.trim(),
  }));
  return {
    count: rows.length,
    version: window.TasuTalkPlatformNotifyMaster?.VERSION,
    rows,
    cards,
    storeCount: JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]").length,
  };
});

fs.writeFileSync(path.join(OUT_DIR, "audit.json"), JSON.stringify(audit, null, 2));

if (audit.count !== 18) {
  console.error("Expected 18 notifications, got", audit.count);
  await closeAllBrowsers();
  process.exit(1);
}

await page.screenshot({ path: path.join(OUT_DIR, "01-notify-tab-390.png"), fullPage: false });
console.log("Saved 01-notify-tab-390.png");

for (const chip of CATEGORY_CHIPS) {
  await page.evaluate((chipId) => {
    if (chipId === "all") {
      document.querySelector('[data-talk-notify-mobile-chip="all"]')?.click();
      return;
    }
    document.querySelector(`[data-talk-notify-mobile-chip="${chipId}"]`)?.click();
  }, chip.id);
  await page.waitForTimeout(500);
  const slug = chip.id === "all" ? "all" : chip.id;
  await page.screenshot({
    path: path.join(OUT_DIR, `02-notify-filter-${slug}-390.png`),
    fullPage: false,
  });
  console.log(`Saved 02-notify-filter-${slug}-390.png`);
}

await page.goto(`${BASE}/talk-home.html?tab=chat`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  window.TasuTalkOfficialRooms?.syncAllFromStore?.();
  window.TasuTalkOfficialRooms?.repairOfficialThreadsFromMessages?.();
});
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT_DIR, "03-talk-list-390.png"), fullPage: false });
console.log("Saved 03-talk-list-390.png");

await page.locator('[data-talk-select-thread][data-talk-thread-id="official_tasful"]').click();
await page.waitForSelector("[data-talk-line-room-active]:not([hidden])", { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT_DIR, "04-talk-official-tasful-390.png"), fullPage: false });
console.log("Saved 04-talk-official-tasful-390.png");

console.log("\n=== 通知タイトル一覧 ===");
audit.rows.forEach((r) => console.log(`${r.id}\t${r.title}`));

console.log("\n=== 通知 → 確認する → 遷移先 ===");
audit.rows.forEach((r) => console.log(`${r.title}\t→\t${r.actionLabel}\t→\t${r.href}`));

console.log(`\nOK: platform verify notify v${audit.version} (${audit.count} items)`);
});
