/**
 * Serper Web検索（Supabase Edge 経由・クライアントから API キー非公開）
 */
(function (global) {
  "use strict";

  const PROVIDER = "serper";
  const DEFAULT_NUM = 5;

  function getEndpoint() {
    const raw = global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
    const base = String(raw.url || raw.SUPABASE_URL || "")
      .trim()
      .replace(/\/$/, "");
    const resolveKey =
      global.TasuSupabasePublicKey?.resolvePublishableAnonKey ||
      function fallbackResolve(config) {
        const k = String(config?.anonKey || config?.anon_key || "").trim();
        if (/^sb_secret_/i.test(k)) return "";
        return k;
      };
    const anonKey = resolveKey(raw);
    return {
      url: base ? `${base}/functions/v1/serper-search` : "",
      anonKey,
    };
  }

  function isConfigured() {
    const { url, anonKey } = getEndpoint();
    return Boolean(url && anonKey);
  }

  function normalizeResult(item) {
    return {
      title: String(item?.title || "").trim().slice(0, 300),
      url: String(item?.link || item?.url || "").trim().slice(0, 2000),
      snippet: String(item?.snippet || "").trim().slice(0, 800),
    };
  }

  /**
   * @param {string} query
   * @param {{ num?: number }} [options]
   * @returns {Promise<{ ok: boolean, query: string, results: {title:string,url:string,snippet:string}[], provider: string, message?: string }>}
   */
  async function search(query, options = {}) {
    const q = String(query || "").trim();
    if (!q) {
      return { ok: false, query: "", results: [], provider: PROVIDER, message: "empty_query" };
    }

    const num = Math.min(5, Math.max(1, Number(options.num) || DEFAULT_NUM));
    const mock = global.__TASU_SERPER_MOCK_RESPONSE__;
    if (mock && typeof mock === "object") {
      const results = (Array.isArray(mock.results) ? mock.results : []).slice(0, num).map(normalizeResult);
      return {
        ok: mock.ok !== false,
        query: mock.query || q,
        results,
        provider: PROVIDER,
      };
    }

    const { url, anonKey } = getEndpoint();
    if (!url || !anonKey) {
      return { ok: false, query: q, results: [], provider: PROVIDER, message: "not_configured" };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ query: q, num }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        return { ok: false, query: q, results: [], provider: PROVIDER, message: "invalid_json" };
      }

      if (!res.ok && data?.ok !== true) {
        return {
          ok: false,
          query: q,
          results: [],
          provider: PROVIDER,
          message: data?.message || `http_${res.status}`,
        };
      }

      const results = (Array.isArray(data.results) ? data.results : []).slice(0, num).map(normalizeResult);
      return {
        ok: true,
        query: data.query || q,
        results,
        provider: PROVIDER,
      };
    } catch (err) {
      const detail = String(err?.message || err || "");
      console.warn("[TasuSerperSearchService]", err);
      const isCors =
        /failed to fetch|networkerror|load failed|cors/i.test(detail) ||
        (err instanceof TypeError && /fetch/i.test(detail));
      return {
        ok: false,
        query: q,
        results: [],
        provider: PROVIDER,
        message: isCors ? "cors_or_network" : "network_error",
        errorDetail: detail.slice(0, 300),
      };
    }
  }

  function formatContextForAi(results, query) {
    const list = Array.isArray(results) ? results : [];
    if (!list.length) return "";

    const lines = [
      "【Web検索結果（参考。タイトル・URL・スニペットのみ。要約して回答すること）】",
      `検索クエリ: ${query}`,
      "",
    ];

    list.forEach((item, i) => {
      lines.push(`${i + 1}. ${item.title || "（タイトルなし）"}`);
      lines.push(`URL: ${item.url || ""}`);
      lines.push(`スニペット: ${item.snippet || ""}`);
      lines.push("");
    });

    lines.push("※ 情報は変動する可能性があります。公式サイト・一次情報を優先して伝えてください。");
    return lines.join("\n").trim();
  }

  global.TasuSerperSearchService = {
    PROVIDER,
    DEFAULT_NUM,
    getEndpoint,
    isConfigured,
    search,
    formatContextForAi,
    normalizeResult,
  };
})(typeof window !== "undefined" ? window : globalThis);
