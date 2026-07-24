#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const url = "http://127.0.0.1:8788/ai-workspace/?uiReview=answer-patterns";

await withPlaywrightBrowser(async (browser) => {
  for (const [tag, w, h] of [
    ["1280", 1280, 900],
    ["390", 390, 844],
  ]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    const data = await page.evaluate(() => {
      const qaSections = document.querySelectorAll(".ai-site-qa-layout__results .ai-site-qa-result");
      const patternSections = document.querySelectorAll(
        ".ai-answer-pattern-showcase:not(.ai-answer-pattern-showcase--site-qa) .ai-answer-pattern-showcase__section"
      );
      const header = document.querySelector(".ai-site-qa-layout__header");
      return {
        siteQaSectionCount: qaSections.length,
        patternSectionCount: patternSections.length,
        sectionCount: qaSections.length + patternSections.length,
        hasSiteQaCommonHeader: Boolean(header),
        hasTextSteps: Boolean(document.querySelector(".ai-answer-pattern__steps")),
        hasFaqList: Boolean(document.querySelector(".ai-answer-pattern__price-list")),
        hasSiteQaNotice: Boolean(document.querySelector(".ai-answer-pattern__notice")),
        hasSiteQaBox: Boolean(document.querySelector(".ai-site-qa-answer__box")),
        hasSiteQaFeedback: Boolean(document.querySelector(".ai-site-qa-answer__feedback")),
        perAnswerSourceNoteCount: document.querySelectorAll(".ai-site-qa-answer__item-source-note").length,
        patternDisclaimerCount: document.querySelectorAll(".ai-answer-pattern__disclaimer").length,
        hasShopCards: Boolean(document.querySelector('[data-ai-compare-profile="shop"]')),
        hasJobCards: Boolean(document.querySelector('[data-ai-compare-profile="job"]')),
        hasMarketCards: Boolean(document.querySelector('[data-ai-compare-profile="market"]')),
        hasEmpty: Boolean(document.querySelector(".ai-answer-pattern__empty")),
        hasError: Boolean(document.querySelector(".ai-answer-pattern__error")),
        hasLoading: Boolean(document.querySelector(".ai-answer-pattern__loading")),
        disclaimerCount: document.querySelectorAll(".ai-answer-pattern__disclaimer").length,
        qaNoCardsInQaBlock:
          document.querySelectorAll(".ai-site-qa-showcase .ai-search-result-card").length === 0,
      };
    });

    console.log(`=== ${tag}px HTTP ${resp?.status?.() ?? 0} ===`);
    console.log(JSON.stringify(data, null, 2));

    const ok =
      data.siteQaSectionCount === 12 &&
      data.patternSectionCount === 12 &&
      data.hasTextSteps &&
      data.hasFaqList &&
      data.hasSiteQaNotice &&
      data.hasSiteQaCommonHeader &&
      data.hasSiteQaBox &&
      data.hasSiteQaFeedback &&
      data.perAnswerSourceNoteCount >= 12 &&
      data.patternDisclaimerCount >= 12 &&
      data.hasShopCards &&
      data.hasJobCards &&
      data.hasMarketCards &&
      data.hasEmpty &&
      data.hasError &&
      data.hasLoading &&
      data.qaNoCardsInQaBlock;
    if (!ok) process.exitCode = 1;

    await page.close();
  }
});

await closeAllBrowsers();
