/**
 * AI 運営秘書 — DeepSeek 専用 Adapter（Gateway 非経由 · AD-010）
 * API: /api/secretary-deepseek-chat（Cloudflare Pages Function）
 * Secret: DEEPSEEK_API_KEY — 本番 CF Pages/Workers · ローカル .env（サーバーのみ）
 */
(function (global) {
  "use strict";

  const API_PATH = "/api/secretary-deepseek-chat";
  const SURFACE = "ops_secretary";
  const DEFAULT_TIMEOUT_MS = 12000;

  function getSecretaryApiUrl() {
    if (typeof location !== "undefined" && location?.origin && !/^file:/i.test(location.protocol)) {
      return `${String(location.origin).replace(/\/$/, "")}${API_PATH}`;
    }
    const base = String(global.TASU_SECRETARY_API_BASE || "").trim().replace(/\/$/, "");
    return base ? `${base}${API_PATH}` : "";
  }

  function buildHistory(messages) {
    return (Array.isArray(messages) ? messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .slice(-12)
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 2000),
      }))
      .filter((m) => m.content);
  }

  async function postSecretaryEdge(payload, options = {}) {
    const url = getSecretaryApiUrl();
    if (!url) {
      return {
        ok: false,
        httpStatus: 0,
        error: "Secretary API 未設定（同一オリジン / TASU_SECRETARY_API_BASE）",
        data: null,
        configured: false,
      };
    }
    try {
      const controller = new AbortController();
      const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          surface: SURFACE,
          mode: payload.modeId || SURFACE,
        }),
        signal: controller.signal,
        credentials: "same-origin",
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      const reply = String(data?.reply || "").trim();
      if (reply && data?.usedDeepSeek) {
        return {
          ok: true,
          reply,
          data,
          httpStatus: res.status,
          modelLabel: data.modelLabel || "DeepSeek",
          configured: data.configured !== false,
        };
      }
      const err = String(data?.error || `edge_${res.status}`).trim();
      return {
        ok: false,
        httpStatus: res.status,
        error: err,
        data,
        configured: data?.configured !== false && res.status !== 503,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const aborted = err instanceof Error && err.name === "AbortError";
      return {
        ok: false,
        httpStatus: 0,
        error: aborted ? "リクエストがタイムアウトしました" : msg,
        data: null,
        configured: true,
      };
    }
  }

  function formatConfigError(detail) {
    const d = String(detail || "").toLowerCase();
    if (/deepseek_api_key not configured|not configured/.test(d)) {
      return "DeepSeek API が未設定です（Secret: DEEPSEEK_API_KEY）";
    }
    if (/secretary api 未設定|同一オリジン/.test(d)) {
      return "Secretary API 未設定（Pages Function / ローカル dev）";
    }
    return String(detail || "DeepSeek API エラー").slice(0, 200);
  }

  const adapter = {
    API_PATH,
    SURFACE,
    postSecretaryEdge,
    buildHistory,
    getSecretaryApiUrl,
    formatConfigError,
  };

  adapter.completeTurn = async function completeTurn(params) {
    const userText = String(params?.userText || "").trim();
    const systemPrompt = String(params?.systemPrompt || "").trim();
    const history = buildHistory(params?.messages);
    const mockFn =
      typeof params?.mockFallback === "function"
        ? params.mockFallback
        : () => "";

    const edge = await adapter.postSecretaryEdge({
      message: userText,
      history,
      systemPrompt: systemPrompt || undefined,
      modeId: params?.modeId || SURFACE,
    });

    if (edge.ok && edge.reply) {
      return {
        reply: edge.reply,
        modelLabel: edge.modelLabel || "DeepSeek",
        modelProvider: "deepseek",
        usedRemote: true,
        fallback_used: false,
        apiError: "",
      };
    }

    const apiError = formatConfigError(edge.error);
    const mockReply = String(mockFn({ message: userText }) || "").trim();
    return {
      reply: mockReply,
      modelLabel: "DeepSeek (mock)",
      modelProvider: "deepseek",
      usedRemote: false,
      fallback_used: true,
      apiError,
      apiHttpStatus: edge.httpStatus || 0,
      configured: edge.configured,
    };
  };

  global.TasuSecretaryDeepSeekAdapter = adapter;
})(typeof window !== "undefined" ? window : globalThis);
