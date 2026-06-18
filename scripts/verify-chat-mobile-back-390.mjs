#!/usr/bin/env node
/**
 * スマホ chat-detail — 戻るヘッダー 390px 検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-chat-mobile-back");
const THREAD = "chat-demo-job-full-001";
const POSTER = "u_job_demo_full";
const LISTING = "job_demo_full_001";

fs.mkdirSync(OUT, { recursive: true });

async function openChat(page, query) {
  await page.goto(`${BASE}/chat-detail.html?${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true");
  await page.waitForTimeout(400);
}

async function measureHeader(page) {
  return page.evaluate(() => {
    const head = document.querySelector(".chat-mobile-head");
    const back = document.getElementById("chatMobileBack");
    const title = document.getElementById("chatMobileTitle");
    const composer = document.querySelector(".chat-composer");
    const style = head ? getComputedStyle(head) : null;
    return {
      headVisible: Boolean(head && style && style.display !== "none"),
      title: title?.textContent?.trim() || "",
      backLabel: back?.textContent?.trim() || "",
      backRect: back?.getBoundingClientRect(),
      composerPosition: composer ? getComputedStyle(composer).position : "",
    };
  });
}

await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const issues = [];


  await openChat(
    page,
    `thread=${THREAD}&userId=${POSTER}&talkDev=1&review=job-full&from=talk`
  );
  const header = await measureHeader(page);
  if (!header.headVisible) issues.push("モバイルヘッダーが表示されていません");
  if (header.title !== "求人チャット") {
    issues.push(`タイトル=${header.title} (求人チャット 期待)`);
  }
  if (header.composerPosition !== "static") {
    issues.push(`composer position=${header.composerPosition}`);
  }
  await page.screenshot({ path: path.join(OUT, "01-header-talk-390.png") });

  await Promise.all([
    page.waitForURL(/talk-home\.html.*tab=chat/, { timeout: 10000 }),
    page.locator("#chatMobileBack").click(),
  ]);

  await openChat(
    page,
    `thread=${THREAD}&userId=${POSTER}&talkDev=1&review=job-full&from=notify`
  );
  await Promise.all([
    page.waitForURL(/talk-home\.html.*tab=notify/, { timeout: 10000 }),
    page.locator("#chatMobileBack").click(),
  ]);

  await openChat(
    page,
    `thread=${THREAD}&userId=${POSTER}&talkDev=1&review=job-full&from=applications&listingId=${LISTING}`
  );
  await page.screenshot({ path: path.join(OUT, "02-header-applications-390.png") });
  await Promise.all([
    page.waitForURL(/detail-job\.html.*view=applications/, { timeout: 10000 }),
    page.locator("#chatMobileBack").click(),
  ]);

  if (issues.length) {
    console.error("verify-chat-mobile-back-390 FAILED:\n" + issues.join("\n"));
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        header,
        screenshots: [
          path.join(OUT, "01-header-talk-390.png"),
          path.join(OUT, "02-header-applications-390.png"),
        ],
      },
      null,
      2
    )
  );
  console.log("verify-chat-mobile-back-390 OK");
});

await closeAllBrowsers();
