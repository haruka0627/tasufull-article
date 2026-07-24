#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = "http://127.0.0.1:8788";
const MIN_ARTICLES = 1000;

await withPlaywrightBrowser(async (browser) => {
  let failed = false;

  for (const [tag, w, h] of [
    ["1280", 1280, 900],
    ["390", 390, 844],
  ]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    const indexResp = await page.goto(`${BASE}/help/`, { waitUntil: "networkidle", timeout: 120000 });
    const indexData = await page.evaluate(() => {
      const stats = window.PlatformQaData?.getStats?.() || {};
      return {
        title: document.querySelector(".platform-qa-hub-hero__title")?.textContent?.trim(),
        hasSearch: Boolean(document.querySelector("[data-help-search-input]")),
        categoryCount: document.querySelectorAll("[data-help-category]").length,
        popularCount: document.querySelectorAll(".platform-qa-hub-popular-card").length,
        listRowCount: document.querySelectorAll(".platform-qa-hub-list-row").length,
        searchMeta: document.querySelector("[data-help-search-meta]")?.textContent?.trim(),
        articleCount: stats.articleCount || 0,
        keywordCount: stats.keywordCount || 0,
        duplicateHelpHeader: document.querySelectorAll(".platform-qa-help-header").length,
        adminDeleteBtns: document.querySelectorAll("[data-qa-admin-delete]").length,
        adminBanner: Boolean(document.querySelector("[data-qa-admin-banner]")),
        platformHeaderCount: document.querySelectorAll(".top-site-header.top-portal-header").length,
        platformFooterCount: document.querySelectorAll(".top-site-footer").length,
        mainCount: document.querySelectorAll("body > main").length,
        hasSearchCards: document.querySelectorAll(".ai-search-result-card").length,
        heroImg: document.querySelector(".platform-qa-hub-hero__img")?.getAttribute("src"),
        heroVisualBg: getComputedStyle(document.querySelector(".platform-qa-hub-hero__visual")).backgroundColor,
        heroImgBg: getComputedStyle(document.querySelector(".platform-qa-hub-hero__img")).backgroundColor,
      };
    });

    console.log(`=== /help/ ${tag}px HTTP ${indexResp?.status?.() ?? 0} ===`);
    console.log(JSON.stringify(indexData, null, 2));
    if (consoleErrors.length) console.log("console errors:", consoleErrors);

    const expectedPopular = tag === "390" ? 3 : 8;
    const indexOk =
      indexResp?.status?.() === 200 &&
      indexData.title === "TASFUL ヘルプ・Q&A" &&
      indexData.hasSearch &&
      indexData.categoryCount === 16 &&
      indexData.popularCount === expectedPopular &&
      indexData.listRowCount === 8 &&
      indexData.articleCount >= MIN_ARTICLES &&
      indexData.keywordCount >= 5000 &&
      indexData.searchMeta?.includes("件") &&
      indexData.duplicateHelpHeader === 0 &&
      indexData.adminDeleteBtns === 0 &&
      !indexData.adminBanner &&
      indexData.platformHeaderCount === 1 &&
      indexData.platformFooterCount === 1 &&
      indexData.mainCount === 1 &&
      indexData.heroImg === "/images/help/hero-pc-transparent.png" &&
      indexData.heroVisualBg === "rgba(0, 0, 0, 0)" &&
      indexData.heroImgBg === "rgba(0, 0, 0, 0)" &&
      indexData.hasSearchCards === 0 &&
      consoleErrors.length === 0;

    if (!indexOk) {
      console.error(`FAIL /help/ ${tag}px`);
      failed = true;
    } else {
      console.log(`PASS /help/ ${tag}px`);
    }

    await page.fill("[data-help-search-input]", "退会");
    await page.waitForTimeout(200);
    const deleteHit = await page.evaluate(() => ({
      rows: document.querySelectorAll(".platform-qa-hub-list-row").length,
      meta: document.querySelector("[data-help-search-meta]")?.textContent || "",
      first: document.querySelector(".platform-qa-hub-list-row__question")?.textContent?.trim(),
    }));
    if (deleteHit.rows < 1 || !deleteHit.meta.includes("退会")) {
      console.error(`FAIL synonym search 退会 ${tag}px`, deleteHit);
      failed = true;
    } else {
      console.log(`PASS synonym search 退会 ${tag}px rows=${deleteHit.rows}`);
    }

    await page.fill("[data-help-search-input]", "");
    await page.click('[data-help-category="ai"]');
    await page.waitForTimeout(150);
    const aiFiltered = await page.evaluate(
      () => document.querySelectorAll(".platform-qa-hub-list-row").length,
    );
    if (aiFiltered < 5) {
      console.error(`FAIL filter ai ${tag}px count=${aiFiltered}`);
      failed = true;
    } else {
      console.log(`PASS filter ai ${tag}px count=${aiFiltered}`);
    }

    const detailResp = await page.goto(`${BASE}/help/signup/`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    const detailData = await page.evaluate(() => ({
      hasArticle: Boolean(document.querySelector("[data-platform-qa-article]")),
      title: document.querySelector(".ai-site-qa-result__title")?.textContent?.trim(),
      hasSearchCards: document.querySelectorAll(".ai-search-result-card").length,
      duplicateHelpHeader: document.querySelectorAll(".platform-qa-help-header").length,
      platformHeaderCount: document.querySelectorAll(".top-site-header.top-portal-header").length,
      platformFooterCount: document.querySelectorAll(".top-site-footer").length,
      mainCount: document.querySelectorAll("body > main").length,
    }));

    console.log(`=== /help/signup/ ${tag}px HTTP ${detailResp?.status?.() ?? 0} ===`);
    console.log(JSON.stringify(detailData, null, 2));

    if (
      detailResp?.status?.() !== 200 ||
      !detailData.hasArticle ||
      detailData.title !== "会員登録方法" ||
      detailData.hasSearchCards !== 0 ||
      detailData.duplicateHelpHeader !== 0 ||
      detailData.platformHeaderCount !== 1 ||
      detailData.platformFooterCount !== 1 ||
      detailData.mainCount !== 1
    ) {
      console.error(`FAIL /help/signup/ ${tag}px`);
      failed = true;
    } else {
      console.log(`PASS /help/signup/ ${tag}px`);
    }

    await page.close();
  }

  const wsPage = await browser.newPage();
  const wsResp = await wsPage.goto(
    `${BASE}/ai-workspace/?uiReview=search&mode=cross-matching`,
    { waitUntil: "networkidle", timeout: 120000 },
  );
  const wsData = await wsPage.evaluate(() => ({
    qaCount: document.querySelectorAll(".ai-site-qa-layout__results .ai-site-qa-result").length,
    cardCount: document.querySelectorAll(".ai-search-ui-review-showcase__section").length,
    totalArticles: window.PlatformQaData?.getStats?.()?.articleCount || 0,
  }));
  console.log(`=== ai-workspace uiReview HTTP ${wsResp?.status?.() ?? 0} ===`);
  console.log(JSON.stringify(wsData, null, 2));
  if (wsData.qaCount !== 12 || wsData.cardCount !== 7 || wsData.totalArticles < MIN_ARTICLES) {
    console.error("FAIL ai-workspace regression");
    failed = true;
  } else {
    console.log("PASS ai-workspace regression");
  }
  await wsPage.close();

  await closeAllBrowsers();
  if (failed) process.exit(1);
  console.log("\nAll help Q&A checks PASS");
});
