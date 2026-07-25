/**
 * Platform Q&A → AI Workspace 回答ブリッジ（QA-D-05）
 * PlatformQaData 検索 + PlatformQaArticle.buildResultHtml（AI文章生成なし）
 */
(function (global) {
  "use strict";

  const MAX_QA_HITS = 1;

  function searchHits(query, categoryId) {
    const Data = global.PlatformQaData;
    if (!Data?.searchArticles) return [];
    const q = String(query || "").trim();
    if (!q) return [];
    return Data.searchArticles(q, categoryId || "all").slice(0, MAX_QA_HITS);
  }

  function toArticleShape(article) {
    const Data = global.PlatformQaData;
    if (Data?.toReviewShape) return Data.toReviewShape(article);
    return article;
  }

  function formatPlain(article) {
    if (!article) return "";
    const title = article.title || article.label || "";
    const question = article.question || article.query || "";
    const summary = article.summary || "";
    return [title, question, summary].filter(Boolean).join("\n");
  }

  function formatArticleHtml(article, options) {
    const Article = global.PlatformQaArticle;
    if (!Article?.buildResultHtml || !article) return "";
    return Article.buildResultHtml(toArticleShape(article), {
      includeHeader: options?.includeHeader !== false,
      showIndex: false,
    });
  }

  function tryPlatformQaReply(userText, options) {
    const hits = searchHits(userText, options?.categoryId);
    if (!hits.length) return null;
    const top = hits[0];
    return {
      plain: formatPlain(top),
      html: formatArticleHtml(top, options),
      provider: "platform-qa-data",
      slug: top.slug,
      hits,
    };
  }

  function mergeQaAndCrossHtml(qaHtml, crossHtml) {
    const qa = String(qaHtml || "").trim();
    const cards = String(crossHtml || "").trim();
    if (!qa && !cards) return "";
    if (!cards) return qa;
    if (!qa) return cards;
    return (
      `<div class="ai-workspace-qa-search-stack">` +
      `<div class="ai-workspace-qa-search-stack__qa">${qa}</div>` +
      `<div class="ai-workspace-qa-search-stack__cards">${cards}</div>` +
      `</div>`
    );
  }

  function mergePlain(qaPlain, crossPlain) {
    return [qaPlain, crossPlain].map((s) => String(s || "").trim()).filter(Boolean).join("\n\n");
  }

  global.PlatformQaAiBridge = {
    searchHits,
    tryPlatformQaReply,
    formatArticleHtml,
    formatPlain,
    mergeQaAndCrossHtml,
    mergePlain,
  };
})(typeof window !== "undefined" ? window : globalThis);
