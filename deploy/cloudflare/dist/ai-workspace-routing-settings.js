/**
 * TASFUL AI Workspace — AIルーティング共通設定（localStorage + ルーター参照用）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_routing_settings";
  const EVENT_NAME = "tasu:ai-routing-settings-changed";

  const OPERATION_MODES = Object.freeze(["balance", "speed", "quality", "cost"]);

  const SETTING_KEYS = Object.freeze([
    "operationMode",
    "syncWithMode",
    "responseLength",
    "detailLevel",
    "reasoningLevel",
    "webSearch",
    "fileAnalysis",
    "imageAnalysis",
    "autoRouting",
    "conversationMemory",
    "trainingOptIn",
    "contentFilter",
    "customInstructions",
  ]);

  const MODE_PRESETS = Object.freeze({
    balance: {
      responseLength: "standard",
      detailLevel: "standard",
      reasoningLevel: "standard",
      webSearch: "when_needed",
      fileAnalysis: true,
      imageAnalysis: true,
      autoRouting: true,
      conversationMemory: true,
      trainingOptIn: false,
      contentFilter: "standard",
    },
    speed: {
      responseLength: "short",
      detailLevel: "concise",
      reasoningLevel: "low",
      webSearch: "when_needed",
      fileAnalysis: true,
      imageAnalysis: true,
      autoRouting: true,
      conversationMemory: true,
      trainingOptIn: false,
      contentFilter: "standard",
    },
    quality: {
      responseLength: "long",
      detailLevel: "detailed",
      reasoningLevel: "high",
      webSearch: "when_needed",
      fileAnalysis: true,
      imageAnalysis: true,
      autoRouting: true,
      conversationMemory: true,
      trainingOptIn: false,
      contentFilter: "standard",
    },
    cost: {
      responseLength: "short",
      detailLevel: "concise",
      reasoningLevel: "low",
      webSearch: "off",
      fileAnalysis: true,
      imageAnalysis: false,
      autoRouting: true,
      conversationMemory: false,
      trainingOptIn: false,
      contentFilter: "standard",
    },
  });

  const DEFAULT_STATE = Object.freeze({
    operationMode: "balance",
    syncWithMode: true,
    ...MODE_PRESETS.balance,
    customInstructions: "",
    updatedAt: "",
  });

  /** @type {typeof DEFAULT_STATE} */
  let cachedState = loadState();

  function cloneState(source) {
    return {
      operationMode: source.operationMode,
      syncWithMode: source.syncWithMode,
      responseLength: source.responseLength,
      detailLevel: source.detailLevel,
      reasoningLevel: source.reasoningLevel,
      webSearch: source.webSearch,
      fileAnalysis: Boolean(source.fileAnalysis),
      imageAnalysis: Boolean(source.imageAnalysis),
      autoRouting: Boolean(source.autoRouting),
      conversationMemory: Boolean(source.conversationMemory),
      trainingOptIn: Boolean(source.trainingOptIn),
      contentFilter: source.contentFilter,
      customInstructions: String(source.customInstructions || ""),
      updatedAt: source.updatedAt || "",
    };
  }

  function normalizeOperationMode(value) {
    const id = String(value || "").trim();
    return OPERATION_MODES.includes(id) ? id : "balance";
  }

  function normalizeSelect(key, value, fallback) {
    const allowed = {
      responseLength: ["short", "standard", "long"],
      detailLevel: ["concise", "standard", "detailed"],
      reasoningLevel: ["low", "standard", "high"],
      webSearch: ["off", "when_needed", "always"],
      contentFilter: ["standard", "strict"],
    };
    const list = allowed[key];
    if (!list) return fallback;
    return list.includes(value) ? value : fallback;
  }

  function sanitizePartial(input, base) {
    const next = cloneState(base);
    if (!input || typeof input !== "object") return next;

    if ("operationMode" in input) {
      next.operationMode = normalizeOperationMode(input.operationMode);
    }
    if ("syncWithMode" in input) {
      next.syncWithMode = Boolean(input.syncWithMode);
    }
    if ("responseLength" in input) {
      next.responseLength = normalizeSelect("responseLength", input.responseLength, next.responseLength);
    }
    if ("detailLevel" in input) {
      next.detailLevel = normalizeSelect("detailLevel", input.detailLevel, next.detailLevel);
    }
    if ("reasoningLevel" in input) {
      next.reasoningLevel = normalizeSelect("reasoningLevel", input.reasoningLevel, next.reasoningLevel);
    }
    if ("webSearch" in input) {
      next.webSearch = normalizeSelect("webSearch", input.webSearch, next.webSearch);
    }
    if ("fileAnalysis" in input) next.fileAnalysis = Boolean(input.fileAnalysis);
    if ("imageAnalysis" in input) next.imageAnalysis = Boolean(input.imageAnalysis);
    if ("autoRouting" in input) next.autoRouting = Boolean(input.autoRouting);
    if ("conversationMemory" in input) next.conversationMemory = Boolean(input.conversationMemory);
    if ("trainingOptIn" in input) next.trainingOptIn = Boolean(input.trainingOptIn);
    if ("contentFilter" in input) {
      next.contentFilter = normalizeSelect("contentFilter", input.contentFilter, next.contentFilter);
    }
    if ("customInstructions" in input) {
      next.customInstructions = String(input.customInstructions || "").slice(0, 500);
    }
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function loadState() {
    try {
      const raw = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || "null");
      if (!raw || typeof raw !== "object") return cloneState(DEFAULT_STATE);
      return sanitizePartial(raw, DEFAULT_STATE);
    } catch {
      return cloneState(DEFAULT_STATE);
    }
  }

  function persistState(next) {
    const changedKey = next.__changedKey || null;
    delete next.__changedKey;
    cachedState = cloneState(next);
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedState));
    } catch {
      /* ignore quota */
    }
    global.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { state: getSnapshot(), changedKey },
      })
    );
    return cachedState;
  }

  function getState() {
    return cachedState;
  }

  function getSnapshot() {
    return Object.freeze(cloneState(cachedState));
  }

  function setState(partial, meta = {}) {
    const next = sanitizePartial(partial, cachedState);
    next.__changedKey = meta.changedKey || null;
    return persistState(next);
  }

  function applyModePreset(modeId, options = {}) {
    const operationMode = normalizeOperationMode(modeId);
    const preset = MODE_PRESETS[operationMode] || MODE_PRESETS.balance;
    const partial = { operationMode, ...preset };
    if (options.keepSyncFlag !== true) {
      partial.syncWithMode = cachedState.syncWithMode;
    }
    return setState(partial, { changedKey: "operationMode" });
  }

  function setOperationMode(modeId) {
    if (cachedState.syncWithMode) {
      return applyModePreset(modeId);
    }
    return setState({ operationMode: normalizeOperationMode(modeId) }, { changedKey: "operationMode" });
  }

  function setSyncWithMode(enabled) {
    const syncWithMode = Boolean(enabled);
    if (syncWithMode) {
      const operationMode = normalizeOperationMode(cachedState.operationMode);
      const preset = MODE_PRESETS[operationMode] || MODE_PRESETS.balance;
      return setState({ syncWithMode: true, operationMode, ...preset }, { changedKey: "syncWithMode" });
    }
    return setState({ syncWithMode: false }, { changedKey: "syncWithMode" });
  }

  function setSetting(key, value) {
    if (!SETTING_KEYS.includes(key) || key === "operationMode" || key === "syncWithMode") {
      return cachedState;
    }
    const partial = { [key]: value };
    if (cachedState.syncWithMode && key !== "customInstructions") {
      partial.syncWithMode = false;
    }
    return setState(partial, { changedKey: key });
  }

  function getSearchFlags(params = {}) {
    if (params.skipSearch === true) {
      return { skipSearch: true, forceSearch: false };
    }
    if (params.forceSearch === true) {
      return { skipSearch: false, forceSearch: true };
    }
    const mode = cachedState.webSearch;
    if (mode === "off") return { skipSearch: true, forceSearch: false };
    if (mode === "always") return { skipSearch: false, forceSearch: true };
    return { skipSearch: false, forceSearch: false };
  }

  function filterAttachments(attachments) {
    const list = Array.isArray(attachments) ? attachments : [];
    return list.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const kind = String(item.kind || "").toLowerCase();
      if (kind === "image" && !cachedState.imageAnalysis) return false;
      if ((kind === "pdf" || kind === "document") && !cachedState.fileAnalysis) return false;
      return true;
    });
  }

  function inferUseCase(context = {}) {
    const explicit = String(context.useCase || "").trim();
    if (explicit) return explicit;
    const text = String(context.userText || context.message || "").trim();
    const modeId = String(context.modeId || "").trim();
    if (/```|function |const |class |import |def |SELECT |API/i.test(text) || modeId === "skill-search") {
      return "code";
    }
    if (/画像|生成|イラスト|draw|image/i.test(text)) return "image";
    if (/検索|最新|ニュース|today|weather|相場|価格/i.test(text)) return "search";
    if (/分析|集計|csv|excel|表|データ/i.test(text)) return "analysis";
    return "chat";
  }

  const USE_CASE_MODEL = Object.freeze({
    chat: "gpt",
    code: "claude",
    search: "gemini-flash",
    image: "gemini-flash",
    analysis: "claude",
    translation: "gemini-flash",
  });

  const OPERATION_MODE_MODEL = Object.freeze({
    balance: null,
    speed: "gemini-flash",
    quality: "claude",
    cost: "gemini-flash",
  });

  function resolveModelId(context = {}) {
    const ModelRouter = global.TasuAiWorkspaceModelRouterSettings;
    if (ModelRouter?.resolveTurnDecision) {
      const decision = ModelRouter.resolveTurnDecision(context);
      if (decision?.ok && decision.resolvedWorkspaceId) return decision.resolvedWorkspaceId;
      if (decision && decision.ok === false) {
        return null;
      }
    }
    if (ModelRouter?.resolveGatewayModelId) {
      return ModelRouter.resolveGatewayModelId(context);
    }

    const Plans = global.TasuAiPlanModels;
    const fallback = Plans?.getSelectedModelId?.() || "gemini-flash";

    if (!cachedState.autoRouting) {
      const manual = Plans?.getSelectedModelId?.() || fallback;
      if (Plans?.isModelAllowed?.(manual)) return manual;
      return null;
    }

    const modeModel = OPERATION_MODE_MODEL[cachedState.operationMode];
    let candidate = modeModel;

    if (!candidate || cachedState.operationMode === "balance") {
      const useCase = inferUseCase(context);
      candidate = USE_CASE_MODEL[useCase] || fallback;
    }

    if (Plans?.isModelAllowed?.(candidate)) return candidate;
    return Plans?.getDefaultModelIdForPlan?.(Plans.resolveUserPlan?.()) || fallback;
  }

  function resolveTurnDecision(context = {}) {
    const ModelRouter = global.TasuAiWorkspaceModelRouterSettings;
    if (ModelRouter?.resolveTurnDecision) {
      return ModelRouter.resolveTurnDecision(context);
    }
    const modelId = resolveModelId(context);
    const Id = global.TasuAiModelIdentity;
    const entry = Id?.getEntry?.(modelId);
    return {
      ok: Boolean(modelId),
      requestedMode: cachedState.autoRouting ? "auto" : "manual",
      requestedModel: modelId,
      resolvedWorkspaceId: modelId,
      resolvedProvider: entry?.provider || null,
      resolvedModel: entry?.providerModelId || null,
      routingReason: "routing_settings_fallback",
      fallbackUsed: false,
      fallbackFrom: null,
      fallbackReason: null,
      useCase: inferUseCase(context),
      gatewayModelId: modelId,
    };
  }

  function getHistoryLimit() {
    return cachedState.conversationMemory ? 12 : 0;
  }

  function buildHistory(messages) {
    const list = (Array.isArray(messages) ? messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 2000),
      }))
      .filter((m) => m.content);

    const limit = getHistoryLimit();
    if (!limit) return [];
    return list.slice(-limit);
  }

  const RESPONSE_LENGTH_HINT = Object.freeze({
    short: "回答は短く要点のみ（2〜4文程度）",
    standard: "回答は標準的な長さ（必要に応じて箇条書き）",
    long: "回答は十分な長さで、背景・手順・補足まで含める",
  });

  const DETAIL_LEVEL_HINT = Object.freeze({
    concise: "簡潔に、冗長な説明は避ける",
    standard: "標準的な詳しさで説明する",
    detailed: "詳細に、例や根拠も含めて説明する",
  });

  const REASONING_LEVEL_HINT = Object.freeze({
    low: "推論は最小限にし、すぐ答える",
    standard: "必要な推論のみ行う",
    high: "深く考え、段階的に推論してから答える",
  });

  const CONTENT_FILTER_HINT = Object.freeze({
    standard: "不適切コンテンツは標準レベルで制御する",
    strict: "不適切コンテンツは厳格に制御する",
  });

  function buildAugmentedSystemPrompt(basePrompt, state) {
    const settings = state || cachedState;
    const lines = [String(basePrompt || "").trim()];

    lines.push(
      "",
      "--- TASFUL AI 応答設定 ---",
      RESPONSE_LENGTH_HINT[settings.responseLength] || RESPONSE_LENGTH_HINT.standard,
      DETAIL_LEVEL_HINT[settings.detailLevel] || DETAIL_LEVEL_HINT.standard,
      REASONING_LEVEL_HINT[settings.reasoningLevel] || REASONING_LEVEL_HINT.standard,
      CONTENT_FILTER_HINT[settings.contentFilter] || CONTENT_FILTER_HINT.standard
    );

    if (!settings.fileAnalysis) {
      lines.push("ファイル解析は無効です。添付ファイルの内容は参照しないでください。");
    }
    if (!settings.imageAnalysis) {
      lines.push("画像解析は無効です。画像内容は参照しないでください。");
    }
    if (!settings.trainingOptIn) {
      lines.push("この会話内容を学習データとして利用しないでください。");
    }

    const custom = String(settings.customInstructions || "").trim();
    if (custom) {
      lines.push("", "--- ユーザー追加指示 ---", custom);
    }

    return lines.filter(Boolean).join("\n");
  }

  function formatForApiRequest(context = {}) {
    const snapshot = getSnapshot();
    return {
      operationMode: snapshot.operationMode,
      syncWithMode: snapshot.syncWithMode,
      response: {
        length: snapshot.responseLength,
        detailLevel: snapshot.detailLevel,
        reasoningLevel: snapshot.reasoningLevel,
      },
      capabilities: {
        webSearch: snapshot.webSearch,
        fileAnalysis: snapshot.fileAnalysis,
        imageAnalysis: snapshot.imageAnalysis,
        autoRouting: snapshot.autoRouting,
        conversationMemory: snapshot.conversationMemory,
      },
      policy: {
        trainingOptIn: snapshot.trainingOptIn,
        contentFilter: snapshot.contentFilter,
      },
      customInstructions: snapshot.customInstructions,
      resolvedModelId: resolveModelId(context),
      modelRouter: global.TasuAiWorkspaceModelRouterSettings?.formatForApiRequest?.(context) || null,
      updatedAt: snapshot.updatedAt,
    };
  }

  function init() {
    cachedState = loadState();
  }

  init();

  global.TasuAiWorkspaceRoutingSettings = {
    STORAGE_KEY,
    EVENT_NAME,
    OPERATION_MODES,
    SETTING_KEYS,
    MODE_PRESETS,
    DEFAULT_STATE,
    getState,
    getSnapshot,
    setState,
    setOperationMode,
    setSyncWithMode,
    setSetting,
    applyModePreset,
    getSearchFlags,
    filterAttachments,
    resolveModelId,
    resolveTurnDecision,
    inferUseCase,
    getHistoryLimit,
    buildHistory,
    buildAugmentedSystemPrompt,
    formatForApiRequest,
  };
})(typeof window !== "undefined" ? window : globalThis);
