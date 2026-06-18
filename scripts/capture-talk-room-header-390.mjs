/**
 * TASFUL 公式通知ルーム — ヘッダー・カード余白確認（390px）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "talk-room-header-390");
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
const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function openOfficialRoom(roomId) {
  await page.goto(`${base}/talk-home.html?tab=chat&thread=${encodeURIComponent(roomId)}&talkDev=1`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector("[data-talk-line-messages]", { timeout: 15000 });
  await page.waitForSelector(".talk-line-room-header--notify-center", { timeout: 10000 });
  await page.waitForSelector(".talk-line-room-notify-card", { timeout: 10000 });
  await page.waitForTimeout(1500);
}

function measureSpacing() {
  const header = document.querySelector(".talk-line-room-header--notify-center");
  const name = header?.querySelector("[data-talk-line-peer-name]");
  const chips = header?.querySelector("[data-talk-line-peer-chips]");
  const nameRect = name?.getBoundingClientRect();
  const chipsRect = chips?.getBoundingClientRect();
  const nameToBadge = nameRect && chipsRect && !chips?.hidden ? Math.round(chipsRect.top - nameRect.bottom) : null;
  const headerChipHidden = !chips || chips.hidden || !chips.textContent?.trim();

  const cards = [...document.querySelectorAll(".chat-msg--official-notify")];
  const gaps = [];
  for (let i = 0; i < cards.length - 1; i++) {
    const a = cards[i].getBoundingClientRect();
    const b = cards[i + 1].getBoundingClientRect();
    gaps.push(Math.round(b.top - a.bottom));
  }

  const cardTags = [...document.querySelectorAll(".talk-line-room-notify-card__tag")].map((el) =>
    el.textContent?.trim()
  );
  const roomTypeTags = cardTags.filter((t) => ["プラット", "安否", "運営"].includes(t));

  return {
    hasNotifyHeader: Boolean(header),
    headerChipHidden,
    nameToBadge,
    cardGaps: gaps,
    cardTags: cardTags.slice(0, 8),
    roomTypeTags,
  };
}

const rooms = [
  { id: "official_platform", file: "talk-room-header-platform-mobile390.png" },
  { id: "official_anpi", file: "talk-room-header-anpi-mobile390.png" },
  { id: "official_tasful", file: "talk-room-header-ops-mobile390.png" },
];

const report = {};

for (const room of rooms) {
  await openOfficialRoom(room.id);
  const metrics = await page.evaluate(measureSpacing);
  report[room.id] = metrics;
  await page.screenshot({ path: path.join(OUT_DIR, room.file), fullPage: false });
  console.log(room.file, metrics);
}

// 友達ルーム — ヘッダー縦位置確認
await page.goto(`${base}/talk-home.html?tab=chat&thread=talk-mock-friend-001&talkDev=1`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-talk-line-peer-name]", { timeout: 15000 });
await page.waitForTimeout(1500);

const friendAlign = await page.evaluate(() => {
  const avatar = document.querySelector(".talk-line-room-header__avatar-slot, .talk-line-room-header__avatar");
  const meta = document.querySelector(".talk-line-room-header__meta");
  const name = document.querySelector("[data-talk-line-peer-name]");
  const chip = document.querySelector(".talk-line-room-header__chips .talk-line-room-chip");
  const header = document.querySelector(".talk-line-room-header");
  const peer = document.querySelector(".talk-line-room-header__main, .talk-line-room-header__peer");
  const avatarLink = document.querySelector(".talk-line-room-header__avatar-link");
  const avatarRect = avatar?.getBoundingClientRect();
  const headerRect = header?.getBoundingClientRect();
  const nameRect = name?.getBoundingClientRect();
  const chipRect = chip?.getBoundingClientRect();
  const avatarCenterY = avatarRect ? avatarRect.top + avatarRect.height / 2 : null;
  const nameCenterY = nameRect ? nameRect.top + nameRect.height / 2 : null;
  const nameToChip = nameRect && chipRect ? Math.round(chipRect.top - nameRect.bottom) : null;
  const avatarToName = avatarRect && nameRect ? Math.round(nameRect.left - avatarRect.right) : null;
  const back = document.querySelector(".talk-line-room-header__back");
  const backRect = back?.getBoundingClientRect();
  const backToAvatar =
    backRect && avatarRect ? Math.round(avatarRect.left - backRect.right) : null;
  return {
    headerHeight: Math.round(headerRect?.height || 0),
    avatarSize: avatarRect ? Math.round(avatarRect.width) : 0,
    avatarCenterY: avatarCenterY != null ? Math.round(avatarCenterY * 10) / 10 : null,
    nameCenterY: nameCenterY != null ? Math.round(nameCenterY * 10) / 10 : null,
    centerYDiff:
      avatarCenterY != null && nameCenterY != null
        ? Math.round(Math.abs(avatarCenterY - nameCenterY) * 10) / 10
        : null,
    backToAvatar,
    avatarToName,
    nameToChip,
    hasFriendChip: chip?.textContent?.trim() === "友達",
    peerDisplay: getComputedStyle(peer || document.body).display,
    metaDisplay: getComputedStyle(meta || document.body).display,
    metaPaddingTop: getComputedStyle(meta || document.body).paddingTop,
    metaGap: getComputedStyle(meta || document.body).gap,
    avatarLinkDisplay: getComputedStyle(avatarLink || document.body).display,
  };
});

await page.screenshot({
  path: path.join(OUT_DIR, "talk-room-header-friend-mobile390.png"),
  fullPage: false,
});
console.log("talk-room-header-friend-mobile390.png", friendAlign);

const friendPass =
  friendAlign.headerHeight >= 64 &&
  friendAlign.headerHeight <= 80 &&
  friendAlign.avatarSize === 36 &&
  friendAlign.centerYDiff <= 1 &&
  friendAlign.backToAvatar === 12 &&
  friendAlign.avatarToName === 14 &&
  friendAlign.hasFriendChip &&
  friendAlign.nameToChip === 4 &&
  friendAlign.peerDisplay === "flex" &&
  friendAlign.metaDisplay === "flex" &&
  friendAlign.metaPaddingTop === "2px" &&
  friendAlign.metaGap === "4px" &&
  friendAlign.avatarLinkDisplay === "flex";

console.log("FRIEND PASS:", friendPass);

});

const pass =
  rooms.every((r) => report[r.id]?.hasNotifyHeader) &&
  rooms.every((r) => report[r.id]?.headerChipHidden) &&
  rooms.every((r) => (report[r.id]?.roomTypeTags || []).length === 0) &&
  report.official_platform?.cardTags?.some((t) => /購入|応募|相談|レビュー|採用|支払|チャット|完了/.test(t));

console.log("\nPASS:", pass);
await closeAllBrowsers();
process.exit(pass && friendPass ? 0 : 1);
