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

  async function resolveAccessToken() {
    try {
      const client = global.TasuSupabaseClient?.getClient?.();
      if (client?.auth?.getSession) {
        const { data } = await client.auth.getSession();
        const token = data?.session?.access_token;
        if (token) return String(token).trim();
      }
    } catch (_err) {
      /* ignore */
    }
    return "";
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
      const accessToken = await resolveAccessToken();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken || anonKey}`,
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

  function mockReply(model, message, searchContext, attachments) {
    const label = model?.label || "AI";
    const text = String(message || "").trim();
    const preview = text.slice(0, 120);
    const searchNote = searchContext
      ? "\n\n（Web検索結果を参考に回答する想定です。接続先API未設定時はモック応答です。）"
      : "";
    let attachNote = "";
    if (Array.isArray(attachments) && attachments.length) {
      const names = attachments.map((a) => a?.name || "file").join(", ");
      attachNote = `\n\n【添付受信】${names} を受け取りました。`;
      if (attachments.some((a) => a?.kind === "pdf")) {
        attachNote += "\n※ PDF本文解析は後続フェーズです。";
      }
      if (attachments.some((a) => a?.kind === "image")) {
        attachNote += "\n※ 画像は Vision 接続時に内容を参照します（モックではファイル名のみ確認）。";
      }
    }
    if (/^(こんにちは|こんばんは|おはよう|はじめまして|hello|hi)(?:[!！.。\s]|$)/i.test(text)) {
      return `こんにちは。TASFUL AI Workspaceです。${label}でお答えしています。ご用件を教えてください。${searchNote}${attachNote}`;
    }
    return `【${label}・モック応答】\n\n「${preview}」についてお答えします。${searchNote}${attachNote}\n\n※本番では Edge Function 経由で ${label} が応答します。`;
  }

  function normalizeAttachments(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => item && typeof item === "object")
      .slice(0, 5)
      .map((item) => ({
        name: String(item.name || "attachment").slice(0, 200),
        mimeType: String(item.mimeType || "application/octet-stream").slice(0, 120),
        kind: String(item.kind || "").slice(0, 20),
        base64: item.base64 ? String(item.base64).slice(0, 7500000) : undefined,
        textContent: item.textContent ? String(item.textContent).slice(0, 12000) : undefined,
        sizeBytes: Number(item.sizeBytes) || 0,
        note: item.note ? String(item.note).slice(0, 500) : undefined,
      }));
  }

  function buildAttachmentTextBlock(attachments) {
    const blocks = [];
    for (const a of attachments) {
      if (a.kind === "document" && a.textContent) {
        blocks.push(`【添付: ${a.name}】\n${a.textContent}`);
      } else if (a.kind === "pdf") {
        const kb = a.sizeBytes ? `${Math.round(a.sizeBytes / 1024)}KB` : "";
        blocks.push(
          `【添付PDF: ${a.name}${kb ? ` (${kb})` : ""}】\n${a.note || "PDF本文解析は後続フェーズです。"}`
        );
      } else if (a.kind === "image") {
        blocks.push(`【添付画像: ${a.name}】画像内容は Vision 入力として参照してください。`);
      }
    }
    return blocks.join("\n\n");
  }

  function mergeMessageWithAttachments(message, attachments) {
    const block = buildAttachmentTextBlock(attachments);
    const msg = String(message || "").trim();
    if (!block) return msg;
    if (!msg) return block;
    return `${block}\n\n${msg}`;
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

  function buildRoutingPayload(decision, extra = {}) {
    if (!decision || typeof decision !== "object") return undefined;
    const payload = {
      requested_mode: String(decision.requestedMode || "").slice(0, 16),
      requested_model: String(decision.requestedModel || "").slice(0, 64),
      resolved_workspace_id: String(decision.resolvedWorkspaceId || decision.gatewayModelId || "").slice(0, 64),
      routing_reason: String(decision.routingReason || "").slice(0, 128),
      fallback_used: Boolean(decision.fallbackUsed),
      fallback_from: decision.fallbackFrom ? String(decision.fallbackFrom).slice(0, 64) : "",
      fallback_reason: decision.fallbackReason ? String(decision.fallbackReason).slice(0, 64) : "",
      use_case: decision.useCase ? String(decision.useCase).slice(0, 32) : "",
    };
    if (extra.provider_fallback_used) {
      payload.fallback_used = true;
      payload.fallback_from = String(extra.fallback_from || payload.fallback_from || "").slice(0, 64);
      payload.fallback_reason = String(extra.fallback_reason || "provider_error").slice(0, 64);
      payload.routing_reason = String(extra.routing_reason || "provider_fallback_once").slice(0, 128);
    }
    return payload;
  }

  function shouldTryProviderFallback(remote, routingDecision) {
    // Manual: 無言の別モデル置換禁止
    if (String(routingDecision?.requestedMode || "").toLowerCase() === "manual") {
      return false;
    }
    if (!remote || remote.usedRemote) return false;
    const status = Number(remote.httpStatus) || 0;
    if (status === 429 || status >= 500) return true;
    const err = String(remote.error || "").toLowerCase();
    return /timeout|unavailable|rate|5\d\d|429/.test(err);
  }

  async function callModel(model, params) {
    const attachments = normalizeAttachments(params.attachments);
    const message = mergeMessageWithAttachments(
      String(params.message || "").trim(),
      attachments
    );
    const searchContext = params.searchContext ? String(params.searchContext).slice(0, 6000) : "";
    const history = buildHistory(params.messages);
    const systemPrompt = String(params.systemPrompt || "").trim();
    const mode = String(params.modeId || "").trim();
    const writing = global.TasuAiGenerateUi?.isGenerationIntent?.(message);
    const timeoutMs = writing ? WRITING_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
    const routing = buildRoutingPayload(params.routingDecision, params.routingExtra);

    const basePayload = {
      message,
      history,
      mode,
      searchContext: searchContext || undefined,
      attachments: attachments.length ? attachments : undefined,
      surface: params.surface || "ai-workspace",
      routing: routing || undefined,
    };

    if (model.provider === "gemini") {
      const out = await postEdge(
        "gemini-chat",
        {
          ...basePayload,
          intent: resolveGeminiIntent({ ...params, message }),
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
          ...basePayload,
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
          ...basePayload,
          systemPrompt: systemPrompt || undefined,
        },
        { timeoutMs }
      );
      if (out.ok && out.reply) {
        return { reply: out.reply, usedRemote: true, provider: "claude", edge: "claude-chat" };
      }
      return {
        reply: "",
        usedRemote: false,
        provider: "claude",
        edge: "claude-chat",
        error: out.error,
        httpStatus: out.httpStatus,
      };
    }

    if (model.comingSoon || model.provider === "xai") {
      return {
        reply: "",
        usedRemote: false,
        provider: model.provider || "xai",
        edge: "",
        error: "model_unavailable",
        httpStatus: 503,
      };
    }

    return {
      reply: "",
      usedRemote: false,
      provider: model.provider || "unknown",
      edge: "",
      error: "unknown_provider",
      httpStatus: 400,
    };
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
   *   attachments?: object[],
   * }} params
   */
  async function completeTurn(params) {
    const Plans = global.TasuAiPlanModels;
    const Identity = global.TasuAiModelIdentity;
    const Orchestrator = global.TasuAiSearchOrchestrator;
    const attachments = normalizeAttachments(params?.attachments);
    const hasAttachments = attachments.length > 0;
    const userPlan = Plans?.resolveUserPlan?.() || "free";

    let routingDecision =
      params?.routingDecision && typeof params.routingDecision === "object"
        ? { ...params.routingDecision }
        : null;

    // Manual / Router 明示拒否 — 無言ダウングレード禁止
    if (routingDecision && routingDecision.ok === false) {
      const denyCode = String(routingDecision.error || "plan_model_denied").trim() || "plan_model_denied";
      return {
        reply: "選択したモデルは現在の利用区分では使えません。別のモデルを選ぶか、Auto に切り替えてください。",
        usedRemote: false,
        provider: "",
        edge: "",
        error: denyCode,
        httpStatus: 403,
        search_used: false,
        search_query: "",
        search_provider: "",
        search_result_count: 0,
        uiBadgeHtml: "",
        fallback_used: false,
        modelId: "",
        modelLabel: "",
        routingDecision,
        ok: false,
      };
    }

    let modelId = String(
      routingDecision?.gatewayModelId ||
        routingDecision?.resolvedWorkspaceId ||
        params?.modelId ||
        ""
    ).trim();

    // クライアント任意注入対策: workspace allowlist + plan policy 再検証
    const Policy = global.TasuAiPlanPolicy;
    const policy =
      Plans?.getActivePolicy?.() ||
      Policy?.getPlanPolicy?.(userPlan) ||
      null;
    const modelOk =
      Identity?.isKnownWorkspaceId?.(modelId) &&
      (Policy?.isModelAllowedForPolicy
        ? Policy.isModelAllowedForPolicy(policy || Policy.getPlanPolicy("free"), modelId)
        : Plans?.isModelAllowed?.(modelId, userPlan));
    if (!modelOk) {
      const requestedMode = String(routingDecision?.requestedMode || "").toLowerCase();
      if (requestedMode === "manual") {
        return {
          reply: "選択したモデルは利用できません（プラン外または不明なモデルです）。",
          usedRemote: false,
          provider: "",
          edge: "",
          error: "plan_model_denied",
          httpStatus: 403,
          search_used: false,
          search_query: "",
          search_provider: "",
          search_result_count: 0,
          uiBadgeHtml: "",
          fallback_used: false,
          modelId: modelId || "",
          modelLabel: "",
          routingDecision,
          ok: false,
        };
      }
      const fallbackId =
        (policy && Policy?.getDefaultModelForPolicy?.(policy)) ||
        Plans?.getDefaultModelIdForPlan?.(userPlan) ||
        "gemini-flash";
      if (routingDecision && modelId && modelId !== fallbackId) {
        routingDecision = {
          ...routingDecision,
          fallbackUsed: true,
          fallbackFrom: modelId,
          fallbackReason: "gateway_allowlist_reject",
          routingReason: "gateway_revalidate_default",
          resolvedWorkspaceId: fallbackId,
          gatewayModelId: fallbackId,
          resolvedProvider: Identity?.toProvider?.(fallbackId) || null,
          resolvedModel: Identity?.toProviderModelId?.(fallbackId) || null,
        };
      }
      modelId = fallbackId;
    }

    let model = Plans?.getModel?.(modelId) || { id: modelId, label: modelId, provider: "gemini" };
    let providerFallbackUsed = false;

    const prep = Orchestrator?.prepare
      ? await Orchestrator.prepare({
          userText: params.userText,
          modeId: params.modeId,
          siteContext: params.siteContext,
          skipSearch: params.skipSearch || hasAttachments,
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

    const callParams = {
      message: prep.messageForAi,
      searchContext: prep.contextForAi,
      messages: params.messages,
      systemPrompt: params.systemPrompt,
      character: params.character,
      intent: params.intent,
      modeId: params.modeId,
      userText: params.userText,
      attachments,
      surface: params.surface,
      routingDecision,
    };

    let remote = await callModel(model, callParams);

    // Provider 障害時の安全なフォールバック最大1回（無限禁止 · Manual は置換しない）
    if (shouldTryProviderFallback(remote, routingDecision) && !routingDecision?.fallbackUsed) {
      const Policy = global.TasuAiPlanPolicy;
      const policy = Plans?.getActivePolicy?.() || Policy?.getPlanPolicy?.(userPlan);
      const alts = (
        Policy?.listFallbackModels && policy
          ? Policy.listFallbackModels(policy, modelId)
          : Identity?.listFallbackWorkspaceIds?.(modelId) || []
      ).filter((id) =>
        Policy?.isModelAllowedForPolicy
          ? Policy.isModelAllowedForPolicy(policy || Policy.getPlanPolicy("free"), id)
          : Plans?.isModelAllowed?.(id, userPlan)
      );
      const altId = alts[0];
      if (altId) {
        const altModel = Plans?.getModel?.(altId);
        if (altModel) {
          providerFallbackUsed = true;
          const fromId = modelId;
          modelId = altId;
          model = altModel;
          routingDecision = {
            ...(routingDecision || {}),
            fallbackUsed: true,
            fallbackFrom: fromId,
            fallbackReason: `provider_http_${remote.httpStatus || "error"}`,
            routingReason: "provider_fallback_once",
            resolvedWorkspaceId: altId,
            gatewayModelId: altId,
            resolvedProvider: Identity?.toProvider?.(altId) || altModel.provider,
            resolvedModel: Identity?.toProviderModelId?.(altId) || null,
          };
          remote = await callModel(model, {
            ...callParams,
            routingDecision,
            routingExtra: {
              provider_fallback_used: true,
              fallback_from: fromId,
              fallback_reason: routingDecision.fallbackReason,
              routing_reason: "provider_fallback_once",
            },
          });
        }
      }
    }

    let fallback_used = Boolean(providerFallbackUsed || routingDecision?.fallbackUsed);
    let reply = remote?.reply || "";
    let apiError = "";

    if (reply && global.TasuAiWorkspaceResponseUx?.normalizeModelReply) {
      reply = global.TasuAiWorkspaceResponseUx.normalizeModelReply(reply);
    }

    if (!reply) {
      apiError = String(remote?.error || "").trim();
      // Workspace: 黙ってモック成功に見せない（明示 preferRemote:false のみモック可）
      const preferRemote =
        params.preferRemote === true ||
        (params.preferRemote !== false && String(params.surface || "") === "ai-workspace");
      if (preferRemote) {
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
              attachments,
            }) || ""
          ).trim();
        }
        if (!reply) reply = mockReply(model, prep.messageForAi, prep.contextForAi, attachments);
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
      requested_mode: routingDecision?.requestedMode || "",
      routing_reason: routingDecision?.routingReason || "",
    });

    return {
      reply,
      modelId: model.id,
      modelLabel: model.label,
      modelProvider: model.provider,
      providerModelId: Identity?.toProviderModelId?.(model.id) || null,
      usedRemote: Boolean(remote?.usedRemote),
      fallback_used: Boolean(fallback_used || searchFallback),
      routingDecision,
      apiError,
      apiHttpStatus: remote?.httpStatus || 0,
      apiEdge: remote?.edge || "",
      search_used: Boolean(prep.searchUsed),
      search_query: prep.searchQuery || "",
      search_provider: prep.searchProvider || "",
      search_result_count: prep.searchResultCount || 0,
      searchFailed: Boolean(prep.searchFailed),
      searchMessage: String(prep.searchMessage || ""),
      uiBadgeHtml: prep.uiBadgeHtml || "",
      contextForAi: prep.contextForAi || "",
      messageForAi: prep.messageForAi,
      user_plan: userPlan,
      attachments_count: attachments.length,
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
