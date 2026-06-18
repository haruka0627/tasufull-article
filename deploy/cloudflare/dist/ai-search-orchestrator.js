/**
 * TASFUL AI 共通 Web検索オーケストレータ（Gemini / GPT / Claude 共通）
 */
(function (global) {
  "use strict";

  const BADGE_TEXT = "";
  const BADGE_HTML = "";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * @param {string} userText
   * @param {{ searchContext?: string, siteContext?: string }} blocks
   */
  function buildMessageForAi(userText, blocks = {}) {
    const parts = [String(userText || "").trim()];
    if (blocks.siteContext) {
      parts.push("", "---", String(blocks.siteContext).trim());
    }
    if (blocks.searchContext) {
      parts.push("", "---", String(blocks.searchContext).trim());
    }
    return parts.filter(Boolean).join("\n");
  }

  /**
   * @param {{
   *   userText: string,
   *   modeId?: string,
   *   forceSearch?: boolean,
   *   skipSearch?: boolean,
   *   siteContext?: string,
   * }} params
   */
  async function prepare(params) {
    const userText = String(params?.userText || "").trim();
    const modeId = String(params?.modeId || "").trim();
    const Detector = global.TasuSearchIntentDetector;
    const Serper = global.TasuSerperSearchService;
    const Log = global.TasuAiInteractionLog;

    const intent = params?.skipSearch
      ? { needed: false, reason: "skipped", query: "" }
      : params?.forceSearch
        ? { needed: true, reason: "forced", query: userText }
        : Detector?.detectSearchIntent?.(userText, { modeId }) || {
            needed: false,
            reason: "no_detector",
            query: "",
          };

    const base = {
      searchUsed: false,
      searchQuery: "",
      searchProvider: "",
      searchResultCount: 0,
      contextForAi: "",
      messageForAi: buildMessageForAi(userText, { siteContext: params?.siteContext }),
      uiBadgeHtml: "",
      results: [],
      intent,
    };

    if (!intent.needed) {
      if (!params?.skipLog && Log?.appendInteractionLog) {
        Log.appendInteractionLog({
          modeId,
          userText,
          search_used: false,
          search_query: "",
          search_provider: "",
          search_result_count: 0,
          fallback_used: false,
        });
      }
      return { ...base, fallback_used: false };
    }

    const searchRes = Serper?.search
      ? await Serper.search(intent.query || userText)
      : { ok: false, results: [], query: intent.query || userText, provider: "serper" };

    if (!searchRes?.ok || !(searchRes.results || []).length) {
      if (!params?.skipLog && Log?.appendInteractionLog) {
        Log.appendInteractionLog({
          modeId,
          userText,
          search_used: false,
          search_query: searchRes?.query || intent.query || userText,
          search_provider: searchRes?.provider || "serper",
          search_result_count: 0,
          fallback_used: true,
        });
      }
      return {
        ...base,
        searchQuery: searchRes?.query || intent.query || userText,
        searchProvider: searchRes?.provider || "serper",
        intent,
        fallback_used: true,
        searchFailed: true,
        searchMessage: searchRes?.message || "search_empty",
      };
    }

    const contextForAi = Serper?.formatContextForAi
      ? Serper.formatContextForAi(searchRes.results, searchRes.query)
      : "";

    const logRow =
      !params?.skipLog && Log?.appendInteractionLog
        ? Log.appendInteractionLog({
            modeId,
            userText,
            search_used: true,
            search_query: searchRes.query,
            search_provider: searchRes.provider || "serper",
            search_result_count: searchRes.results.length,
            fallback_used: false,
          })
        : null;

    return {
      searchUsed: true,
      fallback_used: false,
      searchQuery: searchRes.query,
      searchProvider: searchRes.provider || "serper",
      searchResultCount: searchRes.results.length,
      contextForAi,
      messageForAi: buildMessageForAi(userText, {
        siteContext: params?.siteContext,
        searchContext: contextForAi,
      }),
      uiBadgeHtml: "",
      results: searchRes.results,
      intent,
      logRow,
    };
  }

  global.TasuAiSearchOrchestrator = {
    BADGE_TEXT,
    BADGE_HTML,
    prepare,
    buildMessageForAi,
    escapeHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
