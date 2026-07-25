/**
 * TASFUL AI — Model Identity（Workspace / Gateway / Provider / Cost Ledger の単一対応表）
 * 各ファイルへ同一 mapping を重複ハードコードしない。
 * OpenRouter PoC は pocOnly · productionEnabled=false · 一般 UI 非表示。
 */
(function (global) {
  "use strict";

  /**
   * workspaceId = Gateway / Manual チップ / allowlist の正本 ID
   * providerModelId = Edge が実際に呼ぶ model · SAFE-07 price rate の model 列
   * routeType = direct | openrouter
   */
  const ENTRIES = Object.freeze({
    "gemini-flash": Object.freeze({
      workspaceId: "gemini-flash",
      uiLabel: "最速",
      provider: "gemini",
      providerModelId: "gemini-2.5-flash",
      edge: "gemini-chat",
      routeType: "direct",
      upstreamProvider: "google",
      available: true,
      pocOnly: false,
      productionEnabled: true,
    }),
    gpt: Object.freeze({
      workspaceId: "gpt",
      uiLabel: "標準",
      provider: "openai",
      providerModelId: "gpt-4o-mini",
      edge: "openai-chat",
      routeType: "direct",
      upstreamProvider: "openai",
      available: true,
      pocOnly: false,
      productionEnabled: true,
    }),
    claude: Object.freeze({
      workspaceId: "claude",
      uiLabel: "高精度",
      provider: "claude",
      providerModelId: "claude-haiku-4-5",
      edge: "claude-chat",
      routeType: "direct",
      upstreamProvider: "anthropic",
      available: true,
      pocOnly: false,
      productionEnabled: true,
    }),
    /** Phase 6 PoC — 一般 UI / Auto / Manual には出さない */
    "or-gemini-flash": Object.freeze({
      workspaceId: "or-gemini-flash",
      uiLabel: "OpenRouter Gemini Flash (PoC)",
      provider: "openrouter",
      providerModelId: "google/gemini-2.5-flash",
      openrouterModelSlug: "google/gemini-2.5-flash",
      edge: "openrouter-chat",
      routeType: "openrouter",
      upstreamProvider: "google",
      available: false,
      pocOnly: true,
      productionEnabled: false,
      compareDirectWorkspaceId: "gemini-flash",
    }),
    "or-gpt": Object.freeze({
      workspaceId: "or-gpt",
      uiLabel: "OpenRouter GPT-4o mini (PoC)",
      provider: "openrouter",
      providerModelId: "openai/gpt-4o-mini",
      openrouterModelSlug: "openai/gpt-4o-mini",
      edge: "openrouter-chat",
      routeType: "openrouter",
      upstreamProvider: "openai",
      available: false,
      pocOnly: true,
      productionEnabled: false,
      compareDirectWorkspaceId: "gpt",
    }),
  });

  /** 設定 UI カタログ id → workspaceId（PoC ID は含めない） */
  const CATALOG_TO_WORKSPACE = Object.freeze({
    auto: "gemini-flash",
    gemini: "gemini-flash",
    "gemini-2.5-pro": "gemini-flash",
    "gemini-search": "gemini-flash",
    "google-search": "gemini-flash",
    "brave-search": "gemini-flash",
    deepseek: "gemini-flash",
    mistral: "gemini-flash",
    grok: "gemini-flash",
    "gpt-5": "gpt",
    "gpt-image": "gpt",
    "claude-sonnet": "claude",
    imagen: "gemini-flash",
    flux: "gemini-flash",
    "stable-diffusion": "gemini-flash",
    runway: "gemini-flash",
    veo: "gemini-flash",
    pika: "gemini-flash",
  });

  const WORKSPACE_IDS = Object.freeze(
    Object.keys(ENTRIES).filter(
      (id) => ENTRIES[id]?.productionEnabled === true && ENTRIES[id]?.pocOnly !== true
    )
  );

  const POC_WORKSPACE_IDS = Object.freeze(
    Object.keys(ENTRIES).filter((id) => ENTRIES[id]?.pocOnly === true)
  );

  function getEntry(workspaceId) {
    const id = String(workspaceId || "").trim();
    return ENTRIES[id] || null;
  }

  function isKnownWorkspaceId(workspaceId) {
    const e = getEntry(workspaceId);
    return Boolean(e?.available && e?.productionEnabled && !e?.pocOnly);
  }

  function isPocWorkspaceId(workspaceId) {
    return Boolean(getEntry(workspaceId)?.pocOnly);
  }

  function catalogToWorkspaceId(catalogId) {
    const raw = String(catalogId || "").trim();
    if (!raw) return null;
    if (ENTRIES[raw] && ENTRIES[raw].productionEnabled && !ENTRIES[raw].pocOnly) {
      return raw;
    }
    const mapped = CATALOG_TO_WORKSPACE[raw];
    return mapped && ENTRIES[mapped] && !ENTRIES[mapped].pocOnly ? mapped : null;
  }

  function toProviderModelId(workspaceId) {
    return getEntry(workspaceId)?.providerModelId || null;
  }

  function toProvider(workspaceId) {
    return getEntry(workspaceId)?.provider || null;
  }

  function toEdge(workspaceId) {
    return getEntry(workspaceId)?.edge || null;
  }

  function toUiLabel(workspaceId) {
    return getEntry(workspaceId)?.uiLabel || workspaceId || "";
  }

  function toRouteType(workspaceId) {
    return getEntry(workspaceId)?.routeType || null;
  }

  function toOpenRouterSlug(workspaceId) {
    const e = getEntry(workspaceId);
    return e?.openrouterModelSlug || (e?.routeType === "openrouter" ? e.providerModelId : null);
  }

  /** Cost Ledger lookup 用（provider + model）· OpenRouter は provider=openrouter */
  function toCostLedgerKey(workspaceId) {
    const e = getEntry(workspaceId);
    if (!e) return null;
    return { provider: e.provider, model: e.providerModelId };
  }

  /**
   * フォールバック候補（同一リクエスト最大1回用）
   * PoC / OpenRouter は含めない（Production fallback 無効）
   */
  function listFallbackWorkspaceIds(excludeId) {
    const exclude = String(excludeId || "").trim();
    return WORKSPACE_IDS.filter((id) => id !== exclude && ENTRIES[id]?.available);
  }

  /** 一般 UI に出してよい ID のみ */
  function listProductionWorkspaceIds() {
    return [...WORKSPACE_IDS];
  }

  function listPocWorkspaceIds() {
    return [...POC_WORKSPACE_IDS];
  }

  global.TasuAiModelIdentity = {
    ENTRIES,
    CATALOG_TO_WORKSPACE,
    WORKSPACE_IDS,
    POC_WORKSPACE_IDS,
    getEntry,
    isKnownWorkspaceId,
    isPocWorkspaceId,
    catalogToWorkspaceId,
    toProviderModelId,
    toProvider,
    toEdge,
    toUiLabel,
    toRouteType,
    toOpenRouterSlug,
    toCostLedgerKey,
    listFallbackWorkspaceIds,
    listProductionWorkspaceIds,
    listPocWorkspaceIds,
  };
})(typeof window !== "undefined" ? window : globalThis);
