/**
 * ユーザー質問 → 検索ルート判定（TASFUL内 / Web / ハイブリッド / 通常チャット）
 */
(function (global) {
  "use strict";

  const INTENTS = global.TasuAiIntentRouter?.INTENTS || {};

  const WEB_SIGNAL =
    /相場|いくら|料金目安|平均価格|費用感|補助金|助成金|法律的|法律.+大丈夫|違法|ニュース|今日のニュース|制度とは|インボイス|インボイス制度|とは\?|とは？|市場価格|価格帯|相場を教えて|相場は/i;

  const HYBRID_SIGNAL =
    /と相場|と料金|と一般的な料金|業者と相場|業者と料金|できる人と|できる業者と|と費用|クリーニング業者と|塗装.*と相場|代行.*と(相場|料金)/i;

  const SITE_FIND_SIGNAL =
    /探して|ある\?|ない\?|いる\?|直して|修理して|頼みたい|してほしい|依頼したい|紹介して|マッチング|おすすめの(業者|店|商品|求人)/i;

  const CASUAL_CHAT =
    /^(こんにちは|こんばんは|おはよう|ありがとう|お疲れ|元気|雑談|ただいま)[!！.。?\s]*$/i;

  function normalizeText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasSiteSearchIntent(text, modeId) {
    const { intent } = global.TasuAiIntentRouter?.classifyIntent?.(text) || {
      intent: INTENTS.UNKNOWN,
    };
    if (intent && intent !== INTENTS.UNKNOWN) return true;
    if (global.TasuAiIntentRouter?.shouldUseCrossSearch?.(modeId, text)) return true;
    if (SITE_FIND_SIGNAL.test(text)) return true;
    return false;
  }

  function isPureWebQuery(text) {
    if (global.TasuSearchIntentDetector?.detectSearchIntent?.(text)?.needed) {
      if (HYBRID_SIGNAL.test(text)) return false;
      if (/探して|直して|頼みたい|してほしい|業者を|できる人/.test(text)) return false;
      return true;
    }
    if (/今日のニュース|ニュースは|最新ニュース/.test(text)) return true;
    if (/法律的|法律.+大丈夫|違法にならない|合法/.test(text)) return true;
    if (/インボイス制度とは|制度とは|制度について/.test(text)) return true;
    if (/補助金|助成金/.test(text) && !/掲載|出品|業者を探/.test(text)) return true;
    if (/相場|いくら|料金目安|平均価格|費用感|相場を教えて|相場は/.test(text)) {
      if (HYBRID_SIGNAL.test(text)) return false;
      if (/探して|直して|頼みたい|してほしい|業者を|できる人/.test(text)) return false;
      return true;
    }
    return false;
  }

  function isHybridQuery(text) {
    if (HYBRID_SIGNAL.test(text)) return true;
    if (!WEB_SIGNAL.test(text)) return false;
    const wantsProvider =
      /業者|と相場|と料金|できる人|できる業者|探して|頼みたい|してほしい|依頼したい|紹介して|代行/.test(
        text
      );
    if (!wantsProvider) return false;
    return hasSiteSearchIntent(text, "cross-matching");
  }

  /**
   * @param {string} userText
   * @param {{ modeId?: string }} [options]
   * @returns {{ route: string, reason: string, siteIntent: string, webQuery: string }}
   */
  function classifySearchRoute(userText, options = {}) {
    const text = normalizeText(userText);
    const modeId = String(options.modeId || "").trim();
    const classified = global.TasuAiIntentRouter?.classifyIntent?.(text) || {
      intent: INTENTS.UNKNOWN,
      navKey: "",
    };
    const siteIntent = classified.intent || INTENTS.UNKNOWN || "unknown";

    if (!text) {
      return {
        route: "normal_chat",
        reason: "empty_input",
        siteIntent,
        webQuery: "",
      };
    }

    if (CASUAL_CHAT.test(text)) {
      return {
        route: "normal_chat",
        reason: "casual_greeting",
        siteIntent,
        webQuery: "",
      };
    }

    const webQuery = text;

    if (isHybridQuery(text)) {
      return {
        route: "hybrid_search",
        reason: "site_and_web",
        siteIntent,
        webQuery,
      };
    }

    if (WEB_SIGNAL.test(text) && isPureWebQuery(text)) {
      return {
        route: "web_search",
        reason: "external_knowledge",
        siteIntent,
        webQuery,
      };
    }

    if (
      siteIntent === INTENTS.SITE_NAVIGATION ||
      siteIntent === INTENTS.LISTING_SUPPORT ||
      (siteIntent && siteIntent !== INTENTS.UNKNOWN) ||
      hasSiteSearchIntent(text, modeId)
    ) {
      return {
        route: "site_search",
        reason: "tasful_internal",
        siteIntent,
        webQuery: "",
      };
    }

    return {
      route: "normal_chat",
      reason: "no_search_signal",
      siteIntent,
      webQuery: "",
    };
  }

  function shouldRunSearchRouter(modeId) {
    if (global.TasuAiModes?.isConciergeMode?.(modeId)) return false;
    return true;
  }

  global.TasuAiSearchRouter = {
    classifySearchRoute,
    shouldRunSearchRouter,
    WEB_SIGNAL,
    HYBRID_SIGNAL,
  };
})(typeof window !== "undefined" ? window : globalThis);
