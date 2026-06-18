/**
 * Phase 3 — TALK 通知ルーム整理（390px）
 * 期待: プラット / 安否 / 運営 / AI / サポート / 友達
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "talk-notification-center-phase3-390");
const PORTS = [5173, 5174, 5176, 5199, 5200, 5188];

const ALLOWED_NAMES = new Set([
  "TASFULプラット通知",
  "TASFUL安否通知",
  "TASFUL運営通知",
  "TASFUL AI",
  "TASFULサポート",
  "友達",
]);

const FORBIDDEN_NAMES = [
  "クリエイター K",
  "クリエイターK",
  "山田 太郎",
  "山田太郎",
  "さちこ",
  "Builder運営",
  "TASFUL安否センター",
  "official_builder",
];

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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${base}/talk-home.html?tab=chat&talkDev=1`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("#talkChatThreadList [data-talk-thread-id]", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2500);

const result = await page.evaluate(() => {
  const names = [
    ...document.querySelectorAll(
      "#talkChatThreadList .talk-line-list__name, #talkChatThreadList .talk-chat-line__name"
    ),
  ]
    .map((el) => el.textContent?.trim() || "")
    .filter(Boolean);
  const ids = [...document.querySelectorAll("#talkChatThreadList [data-talk-thread-id]")].map((el) =>
    el.getAttribute("data-talk-thread-id")
  );
  const uniqueIds = [...new Set(ids)];
  const display = window.TasuTalkData?.buildChatDisplayList?.([]) || [];
  const displayNames = display.map((r) => r.partner?.displayName || r.listing?.title || r.id);
  const rooms = window.TasuTalkOfficialRooms?.ROOMS || {};
  const roomLabels = Object.values(rooms).map((r) => r.displayName);
  const platformMsgs = window.TasuTalkOfficialRooms?.getRoomMessages?.("official_platform") || [];
  const sampleTitles = platformMsgs.slice(-3).map((m) => m.notifyCard?.title || m.text);
  const txInStore = (window.TasuChatThreadStore?.readAll?.() || []).filter((t) =>
    window.TasuTalkData?.isTransactionPartnerThread?.(t)
  ).length;
  return {
    names,
    ids: uniqueIds,
    displayNames,
    roomLabels,
    samplePlatformTitles: sampleTitles,
    txInStore,
    phase3Marker: localStorage.getItem("tasful_official_talk_phase3_v1"),
  };
});

await page.screenshot({ path: path.join(OUT_DIR, "talk-list-mobile390.png"), fullPage: true });
await browser.close();

const forbiddenFound = result.names.filter((n) => {
  if (ALLOWED_NAMES.has(n)) return false;
  return FORBIDDEN_NAMES.some((f) => {
    const norm = (s) => String(s || "").replace(/\s/g, "");
    return norm(n) === norm(f);
  });
});
const unexpected = result.names.filter((n) => !ALLOWED_NAMES.has(n));
const missing = [...ALLOWED_NAMES].filter((n) => !result.names.includes(n));

const report = {
  pass:
    forbiddenFound.length === 0 &&
    unexpected.length === 0 &&
    missing.length === 0 &&
    result.ids.includes("official_platform") &&
    result.ids.includes("official_anpi") &&
    result.ids.includes("official_tasful") &&
    !result.ids.includes("official_builder"),
  names: result.names,
  ids: result.ids,
  displayNames: result.displayNames,
  roomLabels: result.roomLabels,
  samplePlatformTitles: result.samplePlatformTitles,
  forbiddenFound,
  unexpected,
  missing,
  txInStore: result.txInStore,
  phase3Marker: result.phase3Marker,
};

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));
if (!report.pass) {
  console.error("FAIL");
  process.exit(1);
}
console.log("PASS");
