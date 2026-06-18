#!/usr/bin/env node
/**
 * 利用者TALK — サポートルーム導線 QA
 *   node scripts/test-talk-support-room.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT = path.join(root, "reports", "screenshots", "talk-support-room");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "430", width: 430, height: 932 },
  { id: "768", width: 768, height: 1024 },
  { id: "pc", width: 1280, height: 900 },
];

const SUPPORT_ID = "talk-hub-support";

function pageUrl(params = "") {
  const base = process.env.BUILDER_BASE_URL;
  const q = params ? (params.startsWith("?") ? params : `?${params}`) : "";
  if (base) return `${base.replace(/\/$/, "")}/talk-home.html${q}`;
  return `${pathToFileURL(path.join(root, "talk-home.html")).href.split("?")[0]}${q}`;
}

const failures = [];

function fail(msg) {
  failures.push(msg);
  console.error(`  ✗ ${msg}`);
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function isIgnorableConsoleError(text) {
  const t = String(text || "").replace(/^\[[\w.]+\]\s*/, "");
  return /CORS|ERR_FAILED|supabase\.co|Failed to load resource/i.test(t);
}

async function seed(page) {
  await page.goto(pageUrl("?talkDev=1&tab=chat"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuTalkData?.buildChatDisplayList, { timeout: 15000 });
  await page.waitForSelector(".talk-line-list__item", { timeout: 15000 });
}

async function checkViewport(page, vp) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(pageUrl("?talkDev=1&tab=chat"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".talk-line-list__item", { timeout: 15000 });

  const listState = await page.evaluate((supportId) => {
    const names = [...document.querySelectorAll(".talk-line-list__name")].map((el) =>
      el.textContent?.trim()
    );
    const cards = window.TasuTalkData.getStaticChatHubCards();
    const support = cards.find((c) => c.id === supportId);
    return {
      names,
      hasAiList: names.some((n) => n === "TASFUL AI"),
      hasSupportList: names.some((n) => n === "TASFULサポート"),
      hasAiCard: cards.some((c) => c.id === "talk-hub-ai"),
      supportHref: window.TasuTalkData.resolveChatTalkHref(support || {}),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  }, SUPPORT_ID);

  if (listState.overflow) fail(`${vp.id} horizontal overflow`);
  else pass(`${vp.id} no horizontal overflow`);

  if (listState.hasAiList || listState.hasAiCard) fail(`${vp.id} TASFUL AI visible in list`);
  else pass(`${vp.id} TASFUL AI hidden`);

  if (!listState.hasSupportList) fail(`${vp.id} TASFULサポート missing`);
  else pass(`${vp.id} TASFULサポート visible`);

  if (!listState.supportHref?.includes("#thread=talk-hub-support")) {
    fail(`${vp.id} support href not inline: ${listState.supportHref}`);
  } else pass(`${vp.id} support opens inline room`);

  await page.screenshot({ path: path.join(OUT, `${vp.id}-support-list.png`), fullPage: false });

  await page.click(`[data-talk-select-thread][data-talk-thread-id="${SUPPORT_ID}"]`);
  await page.waitForFunction(
    () => {
      const active = document.querySelector("[data-talk-line-room-active]");
      const welcome = document.querySelector("[data-talk-line-messages] .chat-bubble__text");
      return active && !active.hidden && /TASFULサポートです/.test(welcome?.textContent || "");
    },
    { timeout: 10000 }
  );

  const roomState = await page.evaluate(() => {
    const composer = document.querySelector("[data-talk-line-composer]");
    const btn = document.querySelector("[data-talk-support-new-inquiry]");
    const blocks = [...document.querySelectorAll(".talk-support-room-extras__block")].map((el) =>
      el.getAttribute("aria-label")
    );
    return {
      composerHidden: composer?.hidden === true,
      hasInquiryBtn: Boolean(btn),
      blocks,
      peerName: document.querySelector("[data-talk-line-peer-name]")?.textContent?.trim() || "",
    };
  });

  if (roomState.peerName !== "TASFULサポート") fail(`${vp.id} room title: ${roomState.peerName}`);
  else pass(`${vp.id} support room header`);

  if (!roomState.composerHidden) fail(`${vp.id} composer should be hidden in support room`);
  else pass(`${vp.id} composer hidden in support room`);

  if (!roomState.hasInquiryBtn) fail(`${vp.id} missing 新しい問い合わせ button`);
  else pass(`${vp.id} 新しい問い合わせ button visible`);

  for (const label of ["お問い合わせ履歴", "運営からの返信", "対応状況"]) {
    if (!roomState.blocks.includes(label)) fail(`${vp.id} missing placeholder: ${label}`);
  }
  if (roomState.blocks.length === 3) pass(`${vp.id} future sections (dummy) visible`);

  const placeholderText = await page.locator(".talk-support-room-extras").innerText();
  const welcomeText = await page.locator("[data-talk-line-messages]").innerText();
  for (const snippet of [
    "現在お問い合わせはありません",
    "返信はありません",
    "進行中の案件はありません",
  ]) {
    if (!placeholderText.includes(snippet)) fail(`${vp.id} missing copy: ${snippet}`);
  }
  if (!/ご質問内容に応じてAIまたは運営が対応します/.test(welcomeText)) {
    fail(`${vp.id} welcome message incomplete`);
  }
  pass(`${vp.id} welcome + placeholder copy OK`);

  await page.screenshot({ path: path.join(OUT, `${vp.id}-support-room.png`), fullPage: false });

  if (vp.id === "390") {
    const [popup] = await Promise.all([
      page.waitForEvent("popup", { timeout: 8000 }).catch(() => null),
      page.click("[data-talk-support-new-inquiry]"),
    ]);
    const navigated = await page.evaluate(() => /support-intake\.html/.test(window.location.href));
    const popupUrl = popup?.url() || "";
    if (!navigated && !/support-intake\.html/.test(popupUrl)) {
      await page.waitForFunction(() => /support-intake\.html/.test(window.location.href), {
        timeout: 8000,
      }).catch(() => fail("390 intake navigation failed"));
    }
    const onIntake =
      /support-intake\.html/.test(page.url()) || /support-intake\.html/.test(popupUrl);
    if (!onIntake) fail(`390 support-intake not opened: ${page.url()}`);
    else pass("390 support-intake.html opens from button");
    if (onIntake && /support-intake\.html/.test(page.url())) {
      await page.screenshot({ path: path.join(OUT, `${vp.id}-support-intake.png`), fullPage: false });
    }
  }
}

async function checkAdminOpsUnchanged(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(pageUrl("?audience=admin_ops&tab=chat&talkAdmin=1"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".talk-line-list__item", { timeout: 15000 });
  const ops = await page.evaluate(() => {
    const names = [...document.querySelectorAll(".talk-line-list__name")].map((el) =>
      el.textContent?.trim()
    );
    return {
      hasSecretary: names.includes("AI秘書"),
      hasOpsWatch: names.includes("OPS WATCH"),
      hasInquiry: names.includes("問い合わせセンター"),
      hasConnect: names.includes("Connect監視"),
      hasPayment: names.some((n) => /決済監視/.test(n)),
      hasMarketplace: names.some((n) => /Marketplace監視/.test(n)),
    };
  });
  for (const [key, ok] of Object.entries(ops)) {
    if (!ok) fail(`admin_ops missing ${key}`);
    else pass(`admin_ops ${key} unchanged`);
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let consoleErrors = [];
await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });

  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp.id} ===`);
    await checkViewport(page, vp);
  }

  console.log("\n=== admin_ops ===");
  await checkAdminOpsUnchanged(page);

  if (consoleErrors.length) {
    consoleErrors.forEach((e) => fail(`console: ${e}`));
  } else {
    pass("console errors: 0 (UI relevant)");
  }

    });
  console.log(`\nScreenshots: ${OUT}`);
  if (failures.length) {
    console.error(`\nFAIL (${failures.length})`);
    process.exit(1);
  }
  console.log("\nPASS talk support room QA");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

await closeAllBrowsers();
