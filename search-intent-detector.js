/**
 * Web検索が必要かどうかの判定（Serper 実行前）
 */
(function (global) {
  "use strict";

  const EXPLICIT_SEARCH =
    /検索して|調べて|調べてください|調べてほしい|調べ|ググって|googleして|ウェブ検索|web検索/i;

  const FRESHNESS =
    /最新|現在|今の|いまの|今日の|今週|今月|2026年|2025年|リアルタイム|速報|ニュース/i;

  const TOPICS =
    /ニュース|法律|法令|条例|判例|補助金|助成金|給付金|商品|価格|相場|いくら|料金目安|平均価格|店舗|営業時間|定休日|業者|施工|修理|地域情報|イベント|開催|求人|募集|年収|株価|日経|TOPIX|仮想通貨|ビットコイン|BTC|ETH|暗号資産|為替|円安|円高|Stripe|Connect|手数料/i;

  const URL_IN_TEXT = /https?:\/\/[^\s]+/i;

  const SKIP_CASUAL =
    /^(こんにちは|こんばんは|おはよう|ありがとう|ありがとうございます|お疲れ|元気|ただいま|雑談)[!！.。?\s]*$/i;

  const SKIP_MATH = /^[\d\s+\-*/().,=%^√×÷]+$/;

  const SKIP_PROGRAMMING_ONLY =
    /^(javascript|typescript|python|java|css|html|sql|react|vue|node)(の)?(書き方|意味|使い方)?[?？]?$/i;

  const TASFUL_INTERNAL_ONLY =
    /^(会員登録|ログイン|掲載方法|出品方法|お気に入り|チャット一覧|TASFULの使い方|TASFULとは|タスフルとは)(の方法)?[?？]?$/i;

  function normalize(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * @param {string} userText
   * @param {{ modeId?: string }} [options]
   */
  function detectSearchIntent(userText, options = {}) {
    const text = normalize(userText);
    const modeId = String(options.modeId || "").trim();

    if (!text) {
      return { needed: false, reason: "empty", query: "" };
    }

    if (SKIP_CASUAL.test(text)) {
      return { needed: false, reason: "casual_chat", query: "" };
    }

    if (SKIP_MATH.test(text)) {
      return { needed: false, reason: "math", query: "" };
    }

    if (SKIP_PROGRAMMING_ONLY.test(text)) {
      return { needed: false, reason: "programming_reference", query: "" };
    }

    if (TASFUL_INTERNAL_ONLY.test(text) && !EXPLICIT_SEARCH.test(text) && !FRESHNESS.test(text)) {
      return { needed: false, reason: "tasful_internal", query: "" };
    }

    if (URL_IN_TEXT.test(text)) {
      return { needed: true, reason: "url_in_question", query: text };
    }

    if (EXPLICIT_SEARCH.test(text)) {
      return { needed: true, reason: "explicit_search", query: text };
    }

    if (FRESHNESS.test(text)) {
      return { needed: true, reason: "freshness", query: text };
    }

    if (TOPICS.test(text)) {
      return { needed: true, reason: "topic_signal", query: text };
    }

    if (/相場|費用感|市場価格|チャージバック制度|インボイス制度/.test(text)) {
      return { needed: true, reason: "market_or_policy", query: text };
    }

    if (modeId === "cross-matching" && /おすすめ|探して|紹介/.test(text) && TOPICS.test(text)) {
      return { needed: true, reason: "matching_with_topic", query: text };
    }

    return { needed: false, reason: "no_search_signal", query: "" };
  }

  function shouldSkipWebSearch(userText, options) {
    return !detectSearchIntent(userText, options).needed;
  }

  global.TasuSearchIntentDetector = {
    detectSearchIntent,
    shouldSkipWebSearch,
  };
})(typeof window !== "undefined" ? window : globalThis);
