/**
 * TASFUL AI 共通モデルゲートウェイ（検索は orchestrator、モデル呼び出しのみ分岐）
 */
(function (global) {
  "use strict";

  const DEFAULT_TIMEOUT_MS = 12000;
  const WRITING_TIMEOUT_MS = 60000;

  function getSupabaseEndpoint(edgeName) {
    const raw = global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
    const base = String(raw.url || raw.SUPABASE_URL || "")
      .trim()
      .replace(/\/$/, "");
    const resolveKey =
      global.TasuSupabasePublicKey?.resolvePublishableAnonKey ||
      function fallback(config) {
        const k = String(config?.anonKey || config?.anon_key || "").trim();
        if (/^sb_secret_/i.test(k)) return "";
        return k;
      };
    const anonKey = resolveKey(raw);
    return {
      url: base ? `${base}/functions/v1/${edgeName}` : "",
      anonKey,
    };
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

  function resolveGeminiIntent(params) {
    if (params?.intent) return params.intent;
    const text = String(params?.message || params?.userText || "");
    if (global.TasuAiGenerateUi?.isGenerationIntent?.(text)) return "work";
    return "chat";
  }

  async function postEdge(edgeName, payload, options = {}) {
    const { url, anonKey } = getSupabaseEndpoint(edgeName);
    if (!url || !anonKey) {
      return {
        ok: false,
        httpStatus: 0,
        error: "Supabase Edge 未設定（url / anonKey）",
        data: null,
      };
    }
    try {
      const controller = new AbortController();
      const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      const reply = String(data?.reply || "").trim();
      if (reply) {
        return { ok: true, reply, data, httpStatus: res.status };
      }
      return {
        ok: false,
        httpStatus: res.status,
        error: String(data?.error || `edge_${res.status}`),
        data,
      };
    } catch (err) {
      const message =
        err instanceof Error && err.name === "AbortError"
          ? `Edge timeout (${edgeName})`
          : err instanceof Error
            ? err.message
            : String(err);
      console.warn(`[TasuAiModelGateway] ${edgeName}`, err);
      return { ok: false, httpStatus: 0, error: message, data: null };
    }
  }

  function mockReply(model, message, searchContext) {
    const label = model?.label || "AI";
    const text = String(message || "").trim();
    const preview = text.slice(0, 120);
    const searchNote = searchContext
      ? "\n\n（Web検索結果を参考に回答する想定です。接続先API未設定時はモック応答です。）"
      : "";
    if (/^(こんにちは|こんばんは|おはよう|はじめまして|hello|hi)(?:[!！.。\s]|$)/i.test(text)) {
      return `こんにちは。TASFUL AI Workspaceです。${label}でお答えしています。ご用件を教えてください。${searchNote}`;
    }
    return `【${label}・モック応答】\n\n「${preview}」についてお答えします。${searchNote}\n\n※本番では Edge Function 経由で ${label} が応答します。`;
  }

  function formatApiErrorReply(model, errorInfo) {
    const label = model?.label || model?.id || "AI";
    const code = String(errorInfo?.error || "unknown_error").trim();
    const status = errorInfo?.httpStatus ? `HTTP ${errorInfo.httpStatus}` : "接続エラー";
    return (
      `【${label} APIエラー】\n\n` +
      `${status}: ${code}\n\n` +
      "Supabase Edge の環境変数（APIキー）とデプロイ状態を確認してください。"
    );
  }

  async function callModel(model, params) {
    const message = String(params.message || "").trim();
    const searchContext = params.searchContext ? String(params.searchContext).slice(0, 6000) : "";
    const history = buildHistory(params.messages);
    const systemPrompt = String(params.systemPrompt || "").trim();
    const mode = String(params.modeId || "").trim();
    const writing = global.TasuAiGenerateUi?.isGenerationIntent?.(message);
    const timeoutMs = writing ? WRITING_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

    if (model.provider === "gemini") {
      const out = await postEdge(
        "gemini-chat",
        {
          message,
          history,
          mode,
          intent: resolveGeminiIntent({ ...params, message }),
          searchContext: searchContext || undefined,
          character: params.character || null,
        },
        { timeoutMs }
      );
      if (out.ok && out.reply) {
        return { reply: out.reply, usedRemote: true, provider: "gemini", edge: "gemini-chat" };
      }
      return {
        reply: "",
        usedRemote: false,
        provider: "gemini",
        edge: "gemini-chat",
        error: out.error,
        httpStatus: out.httpStatus,
      };
    }

    if (model.provider === "openai") {
      const out = await postEdge(
        "openai-chat",
        {
          message,
          history,
          mode,
          searchContext: searchContext || undefined,
          systemPrompt: systemPrompt || undefined,
        },
        { timeoutMs }
      );
      if (out.ok && out.reply) {
        return { reply: out.reply, usedRemote: true, provider: "openai", edge: "openai-chat" };
      }
      return {
        reply: "",
        usedRemote: false,
        provider: "openai",
        edge: "openai-chat",
        error: out.error,
        httpStatus: out.httpStatus,
      };
    }

    if (model.provider === "anthropic") {
      const out = await postEdge(
        "claude-chat",
        {
          message,
          history,
          mode,
          searchContext: searchContext || undefined,
          systemPrompt: systemPrompt || undefined,
        },
        { timeoutMs }
      );
      if (out.ok && out.reply) {
        return { reply: out.reply, usedRemote: true, provider: "anthropic", edge: "claude-chat" };
      }
      return {
        reply: "",
        usedRemote: false,
        provider: "anthropic",
        edge: "claude-chat",
        error: out.error,
        httpStatus: out.httpStatus,
      };
    }

    if (model.comingSoon || model.provider === "xai") {
      return {
        reply: "",
        usedRemote: false,
        provider: model.provider,
        error: "coming_soon",
        httpStatus: 503,
      };
    }

    return { reply: "", usedRemote: false, provider: model.provider, error: "unsupported_provider" };
  }

  function logTurn(entry) {
    if (!global.TasuAiInteractionLog?.appendInteractionLog) return null;
    return global.TasuAiInteractionLog.appendInteractionLog(entry);
  }

  /**
   * @param {{
   *   userText: string,
   *   modeId?: string,
   *   messages?: object[],
   *   systemPrompt?: string,
   *   character?: object,
   *   intent?: string,
   *   modelId?: string,
   *   siteContext?: string,
   *   skipSearch?: boolean,
   *   preferRemote?: boolean,
   *   mockFallback?: (args: object) => string,
   *   surface?: string,
   * }} params
   */
  async function completeTurn(params) {
    const Plans = global.TasuAiPlanModels;
    const Orchestrator = global.TasuAiSearchOrchestrator;
    const userPlan = Plans?.resolveUserPlan?.() || "free";
    let modelId = params?.modelId || Plans?.getSelectedModelId?.() || "gemini-flash";
    if (!Plans?.isModelAllowed?.(modelId, userPlan)) {
      modelId = Plans?.getDefaultModelIdForPlan?.(userPlan) || "gemini-flash";
    }
    const model = Plans?.getModel?.(modelId) || { id: modelId, label: modelId, provider: "gemini" };

    const prep = Orchestrator?.prepare
      ? await Orchestrator.prepare({
          userText: params.userText,
          modeId: params.modeId,
          siteContext: params.siteContext,
          skipSearch: params.skipSearch,
          forceSearch: params.forceSearch,
          skipLog: true,
        })
      : {
          searchUsed: false,
          searchQuery: "",
          searchProvider: "",
          searchResultCount: 0,
          contextForAi: "",
          messageForAi: String(params.userText || ""),
          uiBadgeHtml: "",
          fallback_used: false,
        };

    const searchFallback =
      prep.intent?.needed &&
      !prep.searchUsed &&
      (prep.searchResultCount === 0 || prep.searchQuery);

    let remote = await callModel(model, {
      message: prep.messageForAi,
      searchContext: prep.contextForAi,
      messages: params.messages,
      systemPrompt: params.systemPrompt,
      character: params.character,
      intent: params.intent,
      modeId: params.modeId,
      userText: params.userText,
    });

    let fallback_used = false;
    let reply = remote?.reply || "";
    let apiError = "";

    if (reply && global.TasuAiWorkspaceResponseUx?.normalizeModelReply) {
      reply = global.TasuAiWorkspaceResponseUx.normalizeModelReply(reply);
    }

    if (!reply) {
      apiError = String(remote?.error || "").trim();
      if (params.preferRemote) {
        reply = formatApiErrorReply(model, remote);
        fallback_used = true;
      } else {
        fallback_used = true;
        if (typeof params.mockFallback === "function") {
          reply = String(
            params.mockFallback({
              model,
              message: prep.messageForAi,
              searchContext: prep.contextForAi,
              modeId: params.modeId,
              messages: params.messages,
            }) || ""
          ).trim();
        }
        if (!reply) reply = mockReply(model, prep.messageForAi, prep.contextForAi);
      }
    }

    logTurn({
      modeId: params.modeId,
      userText: params.userText,
      user_plan: userPlan,
      selected_model: model.id,
      selected_provider: model.provider,
      search_used: Boolean(prep.searchUsed),
      search_query: prep.searchQuery || "",
      search_provider: prep.searchProvider || "",
      search_result_count: prep.searchResultCount || 0,
      fallback_used: Boolean(fallback_used || searchFallback),
      provider: remote?.provider || model.provider,
      surface: params.surface || "",
      api_error: apiError || undefined,
      used_remote: Boolean(remote?.usedRemote),
    });

    return {
      reply,
      modelId: model.id,
      modelLabel: model.label,
      modelProvider: model.provider,
      usedRemote: Boolean(remote?.usedRemote),
      fallback_used: Boolean(fallback_used || searchFallback),
      apiError,
      apiHttpStatus: remote?.httpStatus || 0,
      apiEdge: remote?.edge || "",
      search_used: Boolean(prep.searchUsed),
      search_query: prep.searchQuery || "",
      search_provider: prep.searchProvider || "",
      search_result_count: prep.searchResultCount || 0,
      uiBadgeHtml: prep.uiBadgeHtml || "",
      contextForAi: prep.contextForAi || "",
      messageForAi: prep.messageForAi,
      user_plan: userPlan,
    };
  }

  global.TasuAiModelGateway = {
    completeTurn,
    callModel,
    postEdge,
    getSupabaseEndpoint,
    formatApiErrorReply,
    WRITING_TIMEOUT_MS,
  };
})(typeof window !== "undefined" ? window : globalThis);
