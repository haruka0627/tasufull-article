/**
 * @deprecated 表示互換 — 実装は serper-search-service / ai-search-orchestrator へ集約
 */
(function (global) {
  "use strict";

  const Service = () => global.TasuSerperSearchService;
  const Orchestrator = () => global.TasuAiSearchOrchestrator;

  function getSerperEndpoint() {
    return Service()?.getEndpoint?.() || { url: "", anonKey: "" };
  }

  function isSerperConfigured() {
    return Service()?.isConfigured?.() === true;
  }

  async function fetchSerperResults(query, num) {
    return Service()?.search?.(query, { num }) || { ok: false, results: [], query };
  }

  function formatResultsHtml(results, query) {
    const fetchedAt = new Date().toLocaleString("ja-JP");
    const esc = Orchestrator()?.escapeHtml || ((s) => String(s));
    let html = `<section class="ai-web-results" aria-label="Web検索結果">`;
    html += `<h3 class="ai-web-results__title">Web検索結果</h3>`;
    html += `<p class="ai-web-results__query">検索: ${esc(query)}</p>`;
    if (!results.length) {
      html += `<p class="ai-web-results__empty">該当するWeb結果が見つかりませんでした。</p>`;
    } else {
      html += `<ul class="ai-web-results__list">`;
      results.forEach((item) => {
        html += `<li class="ai-web-result-card">`;
        html += `<h4 class="ai-web-result-card__title"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h4>`;
        if (item.snippet) html += `<p class="ai-web-result-card__snippet">${esc(item.snippet)}</p>`;
        html += `</li>`;
      });
      html += `</ul>`;
    }
    html += `<p class="ai-web-result-note">取得: ${esc(fetchedAt)}</p></section>`;
    return html;
  }

  function formatResultsPlain(results, query) {
    return Service()?.formatContextForAi?.(results, query) || "";
  }

  /** 互換: 検索結果を HTML で返す（新フローは orchestrator + AI 回答） */
  async function tryHandle({ userText, webQuery, num }) {
    const prep = await Orchestrator()?.prepare?.({
      userText,
      modeId: "cross-matching",
      forceSearch: true,
    });
    if (prep?.searchUsed && prep.results?.length) {
      return {
        plain: formatResultsPlain(prep.results, prep.searchQuery),
        html: formatResultsHtml(prep.results, prep.searchQuery),
      };
    }
    const data = await fetchSerperResults(webQuery || userText, num);
    if (!data?.ok) return null;
    return {
      plain: formatResultsPlain(data.results, data.query),
      html: formatResultsHtml(data.results, data.query),
    };
  }

  global.TasuAiWebSearchSerper = {
    WEB_NOTE: "Web検索結果です。最新情報は公式サイトで確認してください。",
    getSerperEndpoint,
    isSerperConfigured,
    fetchSerperResults,
    formatResultsHtml,
    formatResultsPlain,
    tryHandle,
  };
})(typeof window !== "undefined" ? window : globalThis);
