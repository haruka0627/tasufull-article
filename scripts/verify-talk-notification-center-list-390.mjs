/**
 * Phase 1 — TALK 運営通知センター一覧（390px）
 * 期待: TASFUL運営 / TASFUL AI / TASFULサポート / 友達 のみ
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "talk-notification-center-390");
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
  "Builder",
  "Builder運営",
  "TASFUL安否センター",
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

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${base}/talk-home.html?tab=chat`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#talkChatThreadList [data-talk-thread-id]", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2000);

const result = await page.evaluate(
  ({ allowedNames, forbiddenNames }) => {
    const names = [...document.querySelectorAll("#talkChatThreadList .talk-line-list__name, #talkChatThreadList .talk-chat-line__name")]
      .map((el) => el.textContent?.trim() || "")
      .filter(Boolean);
    const ids = [...document.querySelectorAll("#talkChatThreadList [data-talk-thread-id]")].map((el) =>
      el.getAttribute("data-talk-thread-id")
    );
    const display = window.TasuTalkData?.buildChatDisplayList?.([]) || [];
    const displayNames = display.map((r) => r.partner?.displayName || r.listing?.title || r.id);
    const txInStore = (window.TasuChatThreadStore?.readAll?.() || []).filter((t) =>
      window.TasuTalkData?.isTransactionPartnerThread?.(t)
    ).length;
    return {
      names,
      ids,
      displayNames,
      txInStore,
      chatListUntouched: typeof window.TasuChatThreadStore?.getAllForChatList === "function",
    };
  },
  { allowedNames: [...ALLOWED_NAMES], forbiddenNames: FORBIDDEN_NAMES }
);

await page.screenshot({ path: path.join(OUT_DIR, "talk-list-mobile390.png"), fullPage: true });
});

const forbiddenFound = result.names.filter((n) =>
  FORBIDDEN_NAMES.some((f) => n.includes(f.replace(/\s/g, "")) || n.includes(f) || f.includes(n))
);
const unexpected = result.names.filter((n) => !ALLOWED_NAMES.has(n));
const missing = [...ALLOWED_NAMES].filter((n) => !result.names.includes(n));

const report = {
  pass: forbiddenFound.length === 0 && unexpected.length === 0 && missing.length === 0,
  names: result.names,
  ids: result.ids,
  displayNames: result.displayNames,
  forbiddenFound,
  unexpected,
  missing,
  txInStore: result.txInStore,
  chatListUntouched: result.chatListUntouched,
};

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));
if (!report.pass) {
  console.error("FAIL");
  await closeAllBrowsers();
  process.exit(1);
}
console.log("PASS");
