#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK — 一般ユーザー簡素フィルター E2E
 *   node scripts/test-talk-simple-filters-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await page.goto(`${BASE}/talk-home.html?tab=notify`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForFunction(() => document.body.classList.contains("talk-home--simple"));
    await page.locator("[data-talk-notify-filter-toggle]").click();
    await page.waitForSelector("[data-talk-notify-filter-panel]:not([hidden])");

    const notifyLabels = await page
      .locator("[data-talk-notify-filter-sections] .talk-filter-chip")
      .allTextContents();
    const notifyText = notifyLabels.join(" ");
    for (const label of ["すべて", "未読", "重要"]) {
      if (!notifyText.includes(label)) fail(`notify missing ${label}`);
      else pass(`notify has ${label}`);
    }
    for (const hidden of ["運営連絡", "OPS WATCH", "安否", "通報", "Builder", "フォロー", "緊急", "運営("]) {
      if (notifyText.includes(hidden)) fail(`notify should hide ${hidden}`);
      else pass(`notify hides ${hidden}`);
    }

    await page.goto(`${BASE}/talk-home.html?tab=chat`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.classList.contains("talk-home--simple"));
    await page.locator("[data-talk-chat-filter-toggle]").click();
    const chatLabels = await page
      .locator("[data-talk-chat-filter-sections] .talk-filter-chip")
      .allTextContents();
    const chatText = chatLabels.join(" ");
    for (const label of ["すべて", "個人", "求人", "業務サービス", "店舗"]) {
      if (!chatText.includes(label)) fail(`chat missing ${label}`);
      else pass(`chat has ${label}`);
    }
    for (const hidden of ["Builder", "運営", "AI相談", "スキル", "ワーカー"]) {
      if (chatText.includes(hidden)) fail(`chat should hide ${hidden}`);
      else pass(`chat hides ${hidden}`);
    }

    await page.goto(`${BASE}/talk-home.html?tab=notify&talkAdmin=1`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(() => document.body.classList.contains("talk-home--admin"));
    await page.locator("[data-talk-notify-filter-toggle]").click();
    const adminText = await page.locator("[data-talk-notify-filter-sections]").innerText();
    if (!adminText.includes("OPS WATCH") || !adminText.includes("運営連絡")) {
      fail("admin missing top ops filters");
    } else pass("admin has OPS WATCH + 運営連絡 top row");
    if (adminText.includes("運営用")) fail("removed 運営用 section label");
    else pass("removed 運営用 section label");

    if (errors.length) {
      console.log(`\nFailed: ${errors.length}`);
      process.exitCode = 1;
    } else {
      console.log("\nAll talk-simple-filters checks passed.");
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }  });
  
}

main();
