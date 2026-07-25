/**
 * TASFUL AI Workspace — モデルルーター設定（Auto / Manual · 用途別）
 * Auto: intent + モードプリセットで自動選択
 * Manual: チップ選択（TasuAiPlanModels）を尊重 · 無言で Auto に戻さない
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_model_router_settings";
  const EVENT_NAME = "tasu:ai-model-router-settings-changed";

  const MODEL_MODES = Object.freeze(["auto", "speed", "quality", "cost"]);

  const USE_CASES = Object.freeze([
    "chat",
    "image",
    "video",
    "search",
    "code",
    "translation",
    "analysis",
  ]);

  const USE_CASE_SETTING_KEYS = Object.freeze({
    chat: "chatModel",
    image: "imageModel",
    video: "videoModel",
    search: "searchModel",
    code: "codeModel",
    translation: "translationModel",
    analysis: "analysisModel",
  });

  const USE_CASE_LABELS = Object.freeze({
    chat: "チャット",
    image: "画像",
    video: "動画",
    search: "検索",
    code: "コード",
    translation: "翻訳",
    analysis: "分析",
  });

  const DEFAULT_USE_CASE_MODELS = Object.freeze({
    chat: "auto",
    image: "auto",
    video: "auto",
    search: "auto",
    code: "auto",
    translation: "auto",
    analysis: "auto",
  });

  /** モード別 Auto 解決プリセット（カタログ id · Identity 経由で workspace へ） */
  const MODE_PRESETS = Object.freeze({
    auto: {
      chat: "claude-sonnet",
      image: "gemini",
      video: "gemini",
      search: "gemini-search",
      code: "gpt-5",
      translation: "gemini",
      analysis: "claude-sonnet",
    },
    speed: {
      chat: "gemini",
      image: "gemini",
      video: "gemini",
      search: "gemini-search",
      code: "gemini",
      translation: "gemini",
      analysis: "gemini",
    },
    quality: {
      chat: "claude-sonnet",
      image: "gemini",
      video: "gemini",
      search: "gemini-search",
      code: "gpt-5",
      translation: "gpt-5",
      analysis: "gpt-5",
    },
    cost: {
      chat: "gemini",
      image: "gemini",
      video: "gemini",
      search: "gemini-search",
      code: "gemini",
      translation: "gemini",
      analysis: "gemini",
    },
  });

  const DEFAULT_STATE = Object.freeze({
    modelMode: "auto",
    modelAutoRouting: true,
    useCaseModels: { ...DEFAULT_USE_CASE_MODELS },
    updatedAt: "",
  });

  /** @type {typeof DEFAULT_STATE} */
  let cachedState = loadState();

  function identity() {
    return global.TasuAiModelIdentity;
  }

  function cloneUseCaseModels(source) {
    return {
      chat: source.chat || "auto",
      image: source.image || "auto",
      video: source.video || "auto",
      search: source.search || "auto",
      code: source.code || "auto",
      translation: source.translation || "auto",
      analysis: source.analysis || "auto",
    };
  }

  function cloneState(source) {
    return {
      modelMode: normalizeModelMode(source.modelMode),
      modelAutoRouting: Boolean(source.modelAutoRouting),
      useCaseModels: cloneUseCaseModels(source.useCaseModels || DEFAULT_USE_CASE_MODELS),
      updatedAt: source.updatedAt || "",
    };
  }

  function normalizeModelMode(value) {
    const id = String(value || "").trim();
    return MODEL_MODES.includes(id) ? id : "auto";
  }

  function normalizeCatalogModelId(value) {
    const id = String(value || "").trim();
    if (!id || id === "auto") return "auto";
    const catalog = global.TasuAiWorkspaceModelCatalog;
    if (catalog?.getProfile?.(id)) return id;
    if (identity()?.catalogToWorkspaceId?.(id)) return id;
    return "auto";
  }

  function sanitizePartial(input, base) {
    const next = cloneState(base);
    if (!input || typeof input !== "object") return next;

    if ("modelMode" in input) next.modelMode = normalizeModelMode(input.modelMode);
    if ("modelAutoRouting" in input) next.modelAutoRouting = Boolean(input.modelAutoRouting);

    if (input.useCaseModels && typeof input.useCaseModels === "object") {
      USE_CASES.forEach((useCase) => {
        if (useCase in input.useCaseModels) {
          next.useCaseModels[useCase] = normalizeCatalogModelId(input.useCaseModels[useCase]);
        }
      });
    }

    USE_CASES.forEach((useCase) => {
      const settingKey = USE_CASE_SETTING_KEYS[useCase];
      if (settingKey in input) {
        next.useCaseModels[useCase] = normalizeCatalogModelId(input[settingKey]);
      }
    });

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

  function syncAiRoutingAutoFlag(enabled) {
    const ai = global.TasuAiWorkspaceRoutingSettings;
    if (!ai?.getState || !ai?.setState) return;
    if (ai.getState().autoRouting === Boolean(enabled)) return;
    ai.setState({ autoRouting: Boolean(enabled) }, { changedKey: "autoRouting" });
  }

  function persistState(next, changedKey) {
    cachedState = cloneState(next);
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedState));
    } catch {
      /* ignore */
    }
    global.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { state: getSnapshot(), changedKey: changedKey || null },
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
    return persistState(next, meta.changedKey || null);
  }

  function setModelMode(modeId) {
    return setState({ modelMode: normalizeModelMode(modeId) }, { changedKey: "modelMode" });
  }

  function setAutoRoutingEnabled(enabled) {
    const next = setState({ modelAutoRouting: Boolean(enabled) }, { changedKey: "modelAutoRouting" });
    syncAiRoutingAutoFlag(enabled);
    global.dispatchEvent(
      new CustomEvent("tasu:ai-selection-mode-changed", {
        detail: { mode: enabled ? "auto" : "manual" },
      })
    );
    return next;
  }

  function isAutoMode() {
    return Boolean(cachedState.modelAutoRouting);
  }

  function getSelectionMode() {
    return isAutoMode() ? "auto" : "manual";
  }

  function setUseCaseModel(useCaseId, modelId) {
    const useCase = String(useCaseId || "").trim();
    if (!USE_CASES.includes(useCase)) return cachedState;
    const partial = {
      useCaseModels: { ...cachedState.useCaseModels, [useCase]: normalizeCatalogModelId(modelId) },
    };
    return setState(partial, { changedKey: USE_CASE_SETTING_KEYS[useCase] });
  }

  function getModePresetCatalog(useCaseId) {
    const mode = normalizeModelMode(cachedState.modelMode);
    const preset = MODE_PRESETS[mode] || MODE_PRESETS.auto;
    return preset[useCaseId] || MODE_PRESETS.auto[useCaseId] || "gemini";
  }

  function catalogToWorkspace(catalogId) {
    const Id = identity();
    const mapped = Id?.catalogToWorkspaceId?.(catalogId);
    if (mapped) return mapped;
    return "gemini-flash";
  }

  function resolveUseCaseCatalogModel(useCaseId) {
    const useCase = String(useCaseId || "chat").trim();
    const configured = cachedState.useCaseModels[useCase] || "auto";
    const preset = getModePresetCatalog(useCase);
    if (configured !== "auto") return configured;
    return preset;
  }

  function getDisplayName(catalogModelId) {
    return (
      global.TasuAiWorkspaceModelCatalog?.getDisplayName?.(catalogModelId) ||
      catalogModelId ||
      "Auto"
    );
  }

  function resolveUseCaseDisplay(useCaseId) {
    const configured = cachedState.useCaseModels[useCaseId] || "auto";
    const resolvedId = resolveUseCaseCatalogModel(useCaseId);
    const displayName = getDisplayName(resolvedId);
    let source = "preset";
    if (!cachedState.modelAutoRouting) {
      source = "manual";
    } else if (configured !== "auto") {
      source = "override";
    }
    return {
      useCase: useCaseId,
      label: USE_CASE_LABELS[useCaseId] || useCaseId,
      configuredModel: configured,
      resolvedModelId: resolvedId,
      displayName,
      source,
      settingKey: USE_CASE_SETTING_KEYS[useCaseId],
    };
  }

  function getResolvedRouting() {
    return USE_CASES.map((useCase) => resolveUseCaseDisplay(useCase));
  }

  function inferUseCase(context = {}) {
    const Router = global.TasuAiWorkspaceRoutingSettings;
    if (Router?.inferUseCase) return Router.inferUseCase(context);
    const text = String(context.userText || context.message || "").trim();
    if (/```|function |const |class |import |def /i.test(text)) return "code";
    if (/画像|生成|イラスト|draw|image/i.test(text)) return "image";
    if (/動画|video|veo|pika/i.test(text)) return "video";
    if (/検索|最新|ニュース|today|weather/i.test(text)) return "search";
    if (/翻訳|translate|英語に|日本語に/i.test(text)) return "translation";
    if (/分析|集計|csv|excel|表|データ/i.test(text)) return "analysis";
    return "chat";
  }

  function toGatewayModelId(catalogModelId) {
    return catalogToWorkspace(catalogModelId);
  }

  function pickAllowedWorkspace(workspaceId, reason) {
    const Plans = global.TasuAiPlanModels;
    const Id = identity();
    const id = String(workspaceId || "").trim();
    if (!Id?.isKnownWorkspaceId?.(id)) {
      return {
        ok: false,
        error: "unknown_model",
        workspaceId: null,
        reason: reason || "unknown_model",
      };
    }
    if (Plans?.isModelAllowed && !Plans.isModelAllowed(id)) {
      return {
        ok: false,
        error: "model_unavailable",
        workspaceId: id,
        reason: "not_allowed_for_plan",
      };
    }
    return { ok: true, workspaceId: id, reason: reason || "ok" };
  }

  /**
   * Auto / Manual の解決結果（Gateway · Usage Log 用）
   * Manual 指定を無言で Auto に戻さない · 不可時は明示 fallback 最大1回
   */
  function resolveTurnDecision(context = {}) {
    const Plans = global.TasuAiPlanModels;
    const Id = identity();
    const useCase = context.useCase || inferUseCase(context);
    const requestedMode = isAutoMode() ? "auto" : "manual";
    const defaultId = Plans?.getDefaultModelIdForPlan?.(Plans.resolveUserPlan?.()) || "gemini-flash";

    let requestedModel = null;
    let candidate = null;
    let routingReason = "";

    if (requestedMode === "manual") {
      requestedModel = Plans?.getSelectedModelId?.() || defaultId;
      candidate = requestedModel;
      routingReason = "manual_chip_selection";
    } else {
      const catalog = resolveUseCaseCatalogModel(useCase);
      requestedModel = catalog;
      candidate = catalogToWorkspace(catalog);
      routingReason = `auto:${normalizeModelMode(cachedState.modelMode)}:${useCase}`;
      if (context.hasAttachments || context.hasImage) {
        routingReason += "+attachments";
      }
    }

    let pick = pickAllowedWorkspace(candidate, routingReason);
    let fallbackUsed = false;
    let fallbackFrom = null;
    let fallbackReason = null;
    let resolvedWorkspace = pick.ok ? pick.workspaceId : null;

    if (!pick.ok) {
      if (requestedMode === "manual") {
        // Manual: 無言で別モデルへ切替しない · 明示1回フォールバックのみ（既定モデル）
        const fb = pickAllowedWorkspace(defaultId, "manual_fallback_default");
        if (fb.ok && fb.workspaceId !== candidate) {
          fallbackUsed = true;
          fallbackFrom = candidate || requestedModel;
          fallbackReason = pick.error || "model_unavailable";
          resolvedWorkspace = fb.workspaceId;
          routingReason = "manual_explicit_fallback_default";
        } else {
          return {
            ok: false,
            error: pick.error || "model_unavailable",
            requestedMode,
            requestedModel,
            resolvedWorkspaceId: null,
            resolvedProvider: null,
            resolvedModel: null,
            routingReason,
            fallbackUsed: false,
            fallbackFrom: null,
            fallbackReason: null,
            useCase,
          };
        }
      } else {
        const alts = Id?.listFallbackWorkspaceIds?.(candidate) || [defaultId];
        const alt = alts.find((id) => pickAllowedWorkspace(id).ok) || defaultId;
        const fb = pickAllowedWorkspace(alt, "auto_fallback");
        if (fb.ok) {
          fallbackUsed = true;
          fallbackFrom = candidate;
          fallbackReason = pick.error || "model_unavailable";
          resolvedWorkspace = fb.workspaceId;
          routingReason = `auto_fallback:${fallbackReason}`;
        } else {
          return {
            ok: false,
            error: "no_available_model",
            requestedMode,
            requestedModel,
            resolvedWorkspaceId: null,
            resolvedProvider: null,
            resolvedModel: null,
            routingReason,
            fallbackUsed: false,
            fallbackFrom: null,
            fallbackReason: null,
            useCase,
          };
        }
      }
    }

    const entry = Id?.getEntry?.(resolvedWorkspace);
    return {
      ok: true,
      requestedMode,
      requestedModel: String(requestedModel || ""),
      resolvedWorkspaceId: resolvedWorkspace,
      resolvedProvider: entry?.provider || null,
      resolvedModel: entry?.providerModelId || null,
      routingReason,
      fallbackUsed,
      fallbackFrom,
      fallbackReason,
      useCase,
      gatewayModelId: resolvedWorkspace,
    };
  }

  function resolveGatewayModelId(context = {}) {
    const decision = resolveTurnDecision(context);
    if (decision.ok && decision.resolvedWorkspaceId) return decision.resolvedWorkspaceId;
    const Plans = global.TasuAiPlanModels;
    return Plans?.getDefaultModelIdForPlan?.(Plans.resolveUserPlan?.()) || "gemini-flash";
  }

  function formatForApiRequest(context = {}) {
    const snapshot = getSnapshot();
    const useCase = context.useCase || inferUseCase(context);
    const decision = resolveTurnDecision({ ...context, useCase });
    const routing = getResolvedRouting();
    const models = {};
    USE_CASES.forEach((id) => {
      models[USE_CASE_SETTING_KEYS[id]] = snapshot.useCaseModels[id];
    });
    return {
      modelMode: snapshot.modelMode,
      modelAutoRouting: snapshot.modelAutoRouting,
      selectionMode: getSelectionMode(),
      useCaseModels: { ...snapshot.useCaseModels },
      models,
      resolvedRouting: routing,
      resolvedModelId: decision.gatewayModelId || resolveGatewayModelId({ ...context, useCase }),
      resolvedCatalogModelId: resolveUseCaseCatalogModel(useCase),
      turnDecision: decision,
      updatedAt: snapshot.updatedAt,
    };
  }

  function init() {
    cachedState = loadState();
  }

  init();

  global.TasuAiWorkspaceModelRouterSettings = {
    STORAGE_KEY,
    EVENT_NAME,
    MODEL_MODES,
    USE_CASES,
    USE_CASE_SETTING_KEYS,
    USE_CASE_LABELS,
    MODE_PRESETS,
    DEFAULT_STATE,
    getState,
    getSnapshot,
    setState,
    setModelMode,
    setAutoRoutingEnabled,
    isAutoMode,
    getSelectionMode,
    setUseCaseModel,
    resolveUseCaseCatalogModel,
    resolveUseCaseDisplay,
    getResolvedRouting,
    resolveGatewayModelId,
    resolveTurnDecision,
    toGatewayModelId,
    inferUseCase,
    formatForApiRequest,
  };
})(typeof window !== "undefined" ? window : globalThis);
