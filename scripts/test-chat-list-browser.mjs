#!/usr/bin/env node
/**
 * chat-list — ダッシュボード戻り導線 E2E
 *   node scripts/test-chat-list-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5179").replace(/\/$/, "");
const PAGE = "/chat-list.html";

const results = [];
function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}
function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  console.log(`\nchat-list 戻る導線 E2E — ${BASE}${PAGE}\n`);
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  try {
    await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-chat-back-dashboard]", { timeout: 15000 });
    pass("chat-list.html が開く");

    const backBtn = page.locator("[data-chat-back-dashboard]");
    const backText = await backBtn.textContent();
    if (backText?.includes("ダッシュボードへ戻る")) {
      pass("戻るボタン表示", backText.trim());
    } else {
      fail("戻るボタン表示", backText || "");
    }

    const logoLink = page.locator("[data-chat-dashboard-link]");
    const logoHref = await logoLink.getAttribute("href");
    if (logoHref?.includes("dashboard.html")) pass("ロゴ導線", logoHref);
    else fail("ロゴ導線", logoHref || "");

    await page.waitForFunction(
      () => {
        const el = document.getElementById("chatThreadList");
        if (!el) return false;
        const html = el.innerHTML;
        return html && !html.includes("読み込み中");
      },
      { timeout: 20000 }
    );
    const listHtml = await page.locator("#chatThreadList").innerHTML();
    if (listHtml?.includes("chat-list__item")) {
      pass("相談一覧表示", listHtml.includes("チャットがありません") ? "空状態" : "一覧描画済み");
    } else {
      fail("相談一覧表示", listHtml?.slice(0, 80) || "");
    }

    await backBtn.click();
    await page.waitForURL(/dashboard\.html/, { timeout: 15000 });
    pass("戻るボタン → dashboard.html");

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
    const pcBox = await page.locator(".chat-list-top").boundingBox();
    if (pcBox && pcBox.width > 200) pass("PC レイアウト", `${Math.round(pcBox.width)}px`);
    else fail("PC レイアウト");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
    const mobileVisible = await backBtn.isVisible();
    const mobileBox = await page.locator(".chat-list-top").boundingBox();
    if (mobileVisible && mobileBox) pass("スマホ レイアウト", `${Math.round(mobileBox.width)}px`);
    else fail("スマホ レイアウト");

    const severe = errors.filter(
      (e) =>
        !/favicon|404|Failed to load resource|Failed to fetch|\[TasuChat\]/i.test(e)
    );
    if (severe.length) fail("コンソールエラー", severe.join(" | "));
    else pass("コンソールエラーなし");
  } catch (err) {
    fail("例外", err instanceof Error ? err.message : String(err));
  }  });
  

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) process.exitCode = 1;
}

main();

await closeAllBrowsers();
