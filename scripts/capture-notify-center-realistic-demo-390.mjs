#!/usr/bin/env node
/**
 * 通知センター — 実運用想定デモ（390×667）
 *
 * 混在5件: 市場×2 / 友達 / Connect / 運営
 * 提出: スクリーンショット + mp4（通知一覧のみ）
 *
 *   npm run demo:notify-center-realistic
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import {
  closeDemoVideoContext,
  demoPause,
  DEMO_DEVICE_PROFILE,
  DEMO_VIEWPORT_390,
  openDemoVideoContext,
  writeDemoVideoManifest,
} from "./lib/capture-demo-video-390.mjs";
import {
  buildRealisticNotifyCenterRows,
  injectRealisticNotifyCenterSeed,
  REALISTIC_DEMO_USER_ID,
  realisticNotifyCenterUrl,
} from "./lib/seed-notify-center-realistic-demo.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SHOT_DIR = path.join(ROOT, "screenshots", "notify-center-realistic-390");
const VIDEO_DIR = path.join(ROOT, "videos", "notify-center-realistic-390");
const MANIFEST_PATH = path.join(SHOT_DIR, "demo-manifest.json");

fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });

async function openNotifyList(page, base) {
  await page.goto(realisticNotifyCenterUrl(base), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('[data-talk-panel="notify"]:not([hidden])', { timeout: 20000 });
  await page.waitForSelector("[data-talk-notify-list]", { timeout: 20000 });
  await page.waitForSelector("[data-talk-notify-id]", { timeout: 20000 });
  await demoPause(page, 1200);
}

async function measureNotifyListUx(page) {
  return page.evaluate(() => {
    const list = document.querySelector("[data-talk-notify-list]");
    const cards = [...document.querySelectorAll("[data-talk-notify-id]")];
    const sections = [...document.querySelectorAll(".talk-notify-section__title")].map(
      (el) => el.textContent?.trim() || ""
    );
    const gaps = [];
    for (let i = 1; i < cards.length; i += 1) {
      const prev = cards[i - 1].getBoundingClientRect();
      const cur = cards[i].getBoundingClientRect();
      gaps.push(Math.round(cur.top - prev.bottom));
    }
    const listRect = list?.getBoundingClientRect();
    return {
      cardCount: cards.length,
      sections,
      cardTitles: cards.map((c) => c.querySelector(".talk-notify-card__title, .talk-notify-card__title--job-event")?.textContent?.trim() || ""),
      cardGapsPx: gaps,
      listClientHeight: Math.round(list?.clientHeight || 0),
      listScrollHeight: Math.round(list?.scrollHeight || 0),
      needsScroll: Boolean(list && list.scrollHeight > list.clientHeight + 2),
      cardsFullyVisible: cards.filter((c) => {
        const r = c.getBoundingClientRect();
        const lr = list?.getBoundingClientRect();
        if (!lr) return false;
        return r.top >= lr.top - 1 && r.bottom <= lr.bottom + 1;
      }).length,
      viewportHeight: document.documentElement.clientHeight,
    };
  });
}

async function captureScreenshot(page, outPath) {
  const panel = page.locator('[data-talk-panel="notify"]');
  await panel.screenshot({ path: outPath });
  return outPath.replace(/\\/g, "/");
}

async function recordListVideo(browser, base) {
  const mp4Path = path.join(VIDEO_DIR, "notify-center-realistic-list-390.mp4");
  const context = await openDemoVideoContext(browser, path.join(VIDEO_DIR, ".tmp", "list"));
  const page = await context.newPage();
  await injectRealisticNotifyCenterSeed(page);
  await openNotifyList(page, base);

  await demoPause(page, 3000);

  const scrollMeta = await page.evaluate(() => {
    const list = document.querySelector("[data-talk-notify-list]");
    if (!list || list.scrollHeight <= list.clientHeight + 2) {
      return { scrolled: false, maxScroll: 0 };
    }
    const maxScroll = list.scrollHeight - list.clientHeight;
    return { scrolled: true, maxScroll };
  });

  if (scrollMeta.scrolled && scrollMeta.maxScroll > 0) {
    await page.evaluate(() => {
      const list = document.querySelector("[data-talk-notify-list]");
      if (list) list.scrollTop = list.scrollHeight * 0.35;
    });
    await demoPause(page, 2500);
    await page.evaluate(() => {
      const list = document.querySelector("[data-talk-notify-list]");
      if (list) list.scrollTop = 0;
    });
    await demoPause(page, 2500);
  } else {
    await demoPause(page, 4000);
  }

  const meta = await closeDemoVideoContext(page, context, mp4Path);
  return meta;
}

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
await withPlaywrightBrowser(async (browser) => {const setupContext = await browser.newContext({
  ...DEMO_DEVICE_PROFILE,
  viewport: DEMO_VIEWPORT_390,
  isMobile: true,
  hasTouch: true,
});
const setupPage = await setupContext.newPage();
await injectRealisticNotifyCenterSeed(setupPage);
await openNotifyList(setupPage, base);

const ux = await measureNotifyListUx(setupPage);
const screenshotPath = path.join(SHOT_DIR, "notify-center-realistic-list.png");
await captureScreenshot(setupPage, screenshotPath);
await setupContext.close();

let videoMeta = null;
try {
  videoMeta = await recordListVideo(browser, base);
} catch (err) {
  console.error(String(err?.message || err));
}

});

const manifest = {
  generatedAt: new Date().toISOString(),
  baseUrl: base,
  viewport: DEMO_VIEWPORT_390,
  userId: REALISTIC_DEMO_USER_ID,
  notificationCount: buildRealisticNotifyCenterRows().length,
  mix: ["市場通知×2", "友達追加通知", "Connect通知", "運営通知"],
  uxReview: ux,
  screenshot: screenshotPath.replace(/\\/g, "/"),
  video: videoMeta
    ? {
        fileName: "notify-center-realistic-list-390.mp4",
        path: videoMeta.path,
        duration: videoMeta.durationLabel,
      }
    : null,
  reviewPoints: [
    "通知カード同士の余白",
    "画面全体の見え方",
    "重要通知の視認性",
    "スクロールしなくても見える情報量",
  ],
};

writeDemoVideoManifest(MANIFEST_PATH, manifest);

const ok = Boolean(videoMeta) && ux.cardCount >= 3;
console.log(
  JSON.stringify(
    {
      ok,
      screenshot: manifest.screenshot,
      video: manifest.video,
      ux,
    },
    null,
    2
  )
);

await closeAllBrowsers();
process.exit(ok ? 0 : 1);
