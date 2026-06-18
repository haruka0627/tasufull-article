#!/usr/bin/env node
/**
 * Capture ops-talk split screenshots (unified talk-home UI)
 *   node scripts/capture-talk-ops-split.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
const OUT = path.join("reports", "screenshots", "talk-ops-split");
fs.mkdirSync(OUT, { recursive: true });

async function capture(page, file, label) {
  const target = path.join(OUT, file);
  await page.screenshot({ path: target, fullPage: false });
  console.log(`  saved ${target} (${label})`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto(buildLocalPageUrl(base, "talk-home.html", "?tab=chat&talkDev=1"), {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await mobile.waitForSelector(".talk-line-list__item", { timeout: 15000 });
    await capture(mobile, "talk-home-user-390.png", "user TALK 390px");

    await mobile.goto(
      buildLocalPageUrl(base, "talk-home.html", "?audience=admin_ops&tab=chat&talkAdmin=1"),
      { waitUntil: "domcontentloaded", timeout: 20000 }
    );
    await mobile.waitForSelector(".talk-line-list__item", { timeout: 15000 });
    await capture(mobile, "ops-talk-390.png", "ops TALK 390px (talk-home)");

    await mobile.goto(
      buildLocalPageUrl(
        base,
        "talk-home.html",
        "?audience=admin_ops&tab=chat&talkAdmin=1&thread=talk-ops-operations-room"
      ),
      { waitUntil: "domcontentloaded", timeout: 20000 }
    );
    await mobile.waitForSelector("[data-talk-line-room-active]:not([hidden])", { timeout: 15000 });
    await capture(mobile, "ops-talk-ai-room-390.png", "ops AI room 390px");
    await mobile.close();

    const pc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await pc.goto(
      buildLocalPageUrl(base, "talk-home.html", "?audience=admin_ops&tab=chat&talkAdmin=1"),
      { waitUntil: "domcontentloaded", timeout: 20000 }
    );
    await pc.waitForSelector(".talk-line-list__item", { timeout: 15000 });
    await capture(pc, "ops-talk-pc.png", "ops TALK PC (talk-home)");
    await pc.close();
    console.log("\nScreenshots ready in reports/screenshots/talk-ops-split/");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
