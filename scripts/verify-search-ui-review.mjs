#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const url = "http://127.0.0.1:8788/ai-workspace/?uiReview=search&mode=cross-matching";

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
      const cardSections = document.querySelectorAll(
        ".ai-search-ui-review-showcase__section"
      );
      const header = document.querySelector(".ai-site-qa-layout__header");
      return {
        siteQaSectionCount: qaSections.length,
        cardSectionCount: cardSections.length,
        hasSiteQaCommonHeader: Boolean(header),
        commonHeaderLead: header?.querySelector(".ai-site-qa-layout__lead")?.textContent?.trim(),
        commonHeaderSourceNote: header?.querySelector(".ai-site-qa-layout__source-note")?.textContent?.trim(),
        hasCardGroupHeading: Boolean(
          document.querySelector(".ai-search-ui-review-showcase__group-heading")
        ),
        hasNotice: Boolean(document.querySelector(".ai-answer-pattern__notice")),
        hasCtaGroup: Boolean(document.querySelector(".ai-answer-pattern__cta-group")),
        hasSiteQaBox: Boolean(document.querySelector(".ai-site-qa-answer__box")),
        hasSiteQaBrand: Boolean(document.querySelector(".ai-site-qa-layout__brand")),
        hasSiteQaQueryLabel: Boolean(document.querySelector(".ai-site-qa-result__query-label")),
        hasSiteQaFeedbackRule: Boolean(document.querySelector(".ai-site-qa-answer__feedback-rule")),
        hasStepDesc: Boolean(document.querySelector(".ai-site-qa-answer .ai-answer-pattern__step-desc")),
        ctaHasArrow: [...document.querySelectorAll(".ai-site-qa-answer .ai-message-context-cta__btn")].some(
          (el) => el.textContent.includes("→")
        ),
        feedbackLabelText: document.querySelector(".ai-site-qa-answer__feedback-label")?.textContent?.trim(),
        cardSectionUnchanged: document.querySelectorAll(".ai-search-ui-review-showcase__section").length === 7,
        hasSiteQaRelated: Boolean(document.querySelector(".ai-site-qa-answer__related")),
        hasSiteQaFeedback: Boolean(document.querySelector(".ai-site-qa-answer__feedback")),
        perAnswerSourceNoteCount: document.querySelectorAll(".ai-site-qa-answer__item-source-note").length,
        ctaBeforeRelatedOk: [...document.querySelectorAll(".ai-site-qa-result")].every((sec) => {
          const cta = sec.querySelector(".ai-answer-pattern__cta, .ai-site-qa-answer__cta-group");
          const related = sec.querySelector(".ai-site-qa-answer__related");
          if (!cta || !related) return true;
          return (cta.compareDocumentPosition(related) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        }),
        item12HasQuery: Boolean(
          document.querySelector('[data-ai-site-qa-id="12"] .ai-site-qa-result__query')
        ),
        item12HasSteps: Boolean(
          document.querySelector('[data-ai-site-qa-id="12"] .ai-site-qa-answer__steps')
        ),
        item12NoGuides: document.querySelectorAll('[data-ai-site-qa-id="12"] .ai-site-qa-answer__guides').length === 0,
        hasShopCards: Boolean(document.querySelector('[data-ai-compare-profile="shop"]')),
        qaNoCardsInQaBlock:
          document.querySelectorAll(".ai-site-qa-showcase .ai-search-result-card").length === 0,
      };
    });

    console.log(`=== search ${tag}px HTTP ${resp?.status?.() ?? 0} ===`);
    console.log(JSON.stringify(data, null, 2));

    const ok =
      data.siteQaSectionCount === 12 &&
      data.cardSectionCount === 7 &&
      data.hasSiteQaCommonHeader &&
      data.commonHeaderLead === "ご質問に関連する案内が見つかりました。" &&
      data.commonHeaderSourceNote === "TASFUL内の登録データ・案内ページをもとに回答しています。" &&
      data.hasCardGroupHeading &&
      data.hasNotice &&
      data.hasCtaGroup &&
      data.hasSiteQaBox &&
      data.hasSiteQaBrand &&
      data.hasSiteQaQueryLabel &&
      data.hasSiteQaFeedbackRule &&
      data.hasStepDesc &&
      data.ctaHasArrow &&
      data.feedbackLabelText === "この回答は役に立ちましたか？" &&
      data.cardSectionUnchanged &&
      data.hasSiteQaRelated &&
      data.hasSiteQaFeedback &&
      data.perAnswerSourceNoteCount >= 12 &&
      data.ctaBeforeRelatedOk &&
      data.item12HasQuery &&
      data.item12HasSteps &&
      data.item12NoGuides &&
      data.hasShopCards &&
      data.qaNoCardsInQaBlock;
    if (!ok) process.exitCode = 1;

    await page.close();
  }
});

await closeAllBrowsers();
