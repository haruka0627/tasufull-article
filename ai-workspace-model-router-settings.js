/**
 * TASFUL AI Workspace — モデルルーター設定（用途別モデル · モード · Auto/手動）
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

  /** モード別 Auto 解決プリセット（カタログ model id） */
  const MODE_PRESETS = Object.freeze({
    auto: {
      chat: "claude-sonnet",
      image: "gpt-image",
      video: "veo",
      search: "gemini-search",
      code: "gpt-5",
      translation: "gemini",
      analysis: "claude-sonnet",
    },
    speed: {
      chat: "mistral",
      image: "flux",
      video: "pika",
      search: "gemini-search",
      code: "deepseek",
      translation: "gemini",
      analysis: "mistral",
    },
    quality: {
      chat: "claude-sonnet",
      image: "gpt-image",
      video: "runway",
      search: "google-search",
      code: "gpt-5",
      translation: "gpt-5",
      analysis: "gpt-5",
    },
    cost: {
      chat: "deepseek",
      image: "stable-diffusion",
      video: "pika",
      search: "brave-search",
      code: "deepseek",
      translation: "gemini",
      analysis: "deepseek",
    },
  });

  /** カタログ id → ai-plan-models gateway id（チャット系） */
  const GATEWAY_MODEL_MAP = Object.freeze({
    "claude-sonnet": "claude",
    "gpt-5": "gpt",
    "gemini-2.5-pro": "gemini-flash",
    gemini: "gemini-flash",
    "gemini-search": "gemini-flash",
    "google-search": "gemini-flash",
    "brave-search": "gemini-flash",
    deepseek: "gemini-flash",
    mistral: "gemini-flash",
    grok: "gemini-flash",
    "gpt-image": "gpt",
    imagen: "gemini-flash",
    flux: "gemini-flash",
    "stable-diffusion": "gemini-flash",
    runway: "gemini-flash",
    veo: "gemini-flash",
    pika: "gemini-flash",
    auto: "gemini-flash",
  });

  const DEFAULT_STATE = Object.freeze({
    modelMode: "auto",
    modelAutoRouting: true,
    useCaseModels: { ...DEFAULT_USE_CASE_MODELS },
    updatedAt: "",
  });

  /** @type {typeof DEFAULT_STATE} */
  let cachedState = loadState();

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
    return next;
  }

  function setUseCaseModel(useCaseId, modelId) {
    const useCase = String(useCaseId || "").trim();
    if (!USE_CASES.includes(useCase)) return cachedState;
    const partial = { useCaseModels: { ...cachedState.useCaseModels, [useCase]: normalizeCatalogModelId(modelId) } };
    return setState(partial, { changedKey: USE_CASE_SETTING_KEYS[useCase] });
  }

  function getModePresetModel(useCaseId) {
    const mode = normalizeModelMode(cachedState.modelMode);
    const preset = MODE_PRESETS[mode] || MODE_PRESETS.auto;
    return preset[useCaseId] || MODE_PRESETS.auto[useCaseId] || "claude-sonnet";
  }

  function resolveUseCaseCatalogModel(useCaseId) {
    const useCase = String(useCaseId || "chat").trim();
    const configured = cachedState.useCaseModels[useCase] || "auto";
    const preset = getModePresetModel(useCase);

    if (!cachedState.modelAutoRouting) {
      return configured === "auto" ? preset : configured;
    }

    if (configured !== "auto") {
      return configured;
    }

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
      source = configured === "auto" ? "preset" : "manual";
    } else if (configured !== "auto") {
      source = "manual";
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
    const id = String(catalogModelId || "").trim();
    return GATEWAY_MODEL_MAP[id] || GATEWAY_MODEL_MAP["claude-sonnet"];
  }

  function resolveGatewayModelId(context = {}) {
    const Plans = global.TasuAiPlanModels;
    const fallback = Plans?.getSelectedModelId?.() || "gemini-flash";
    const useCase = context.useCase || inferUseCase(context);
    const catalogModel = resolveUseCaseCatalogModel(useCase);
    const gatewayId = toGatewayModelId(catalogModel);
    if (Plans?.isModelAllowed?.(gatewayId)) return gatewayId;
    return Plans?.getDefaultModelIdForPlan?.(Plans.resolveUserPlan?.()) || fallback;
  }

  function formatForApiRequest(context = {}) {
    const snapshot = getSnapshot();
    const useCase = context.useCase || inferUseCase(context);
    const routing = getResolvedRouting();
    const models = {};
    USE_CASES.forEach((id) => {
      models[USE_CASE_SETTING_KEYS[id]] = snapshot.useCaseModels[id];
    });
    return {
      modelMode: snapshot.modelMode,
      modelAutoRouting: snapshot.modelAutoRouting,
      useCaseModels: { ...snapshot.useCaseModels },
      models,
      resolvedRouting: routing,
      resolvedModelId: resolveGatewayModelId({ ...context, useCase }),
      resolvedCatalogModelId: resolveUseCaseCatalogModel(useCase),
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
    GATEWAY_MODEL_MAP,
    DEFAULT_STATE,
    getState,
    getSnapshot,
    setState,
    setModelMode,
    setAutoRoutingEnabled,
    setUseCaseModel,
    resolveUseCaseCatalogModel,
    resolveUseCaseDisplay,
    getResolvedRouting,
    resolveGatewayModelId,
    toGatewayModelId,
    inferUseCase,
    formatForApiRequest,
  };
})(typeof window !== "undefined" ? window : globalThis);
