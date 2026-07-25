/**
 * TASFUL AI — Model Identity（Workspace / Gateway / Provider / Cost Ledger の単一対応表）
 * 各ファイルへ同一 mapping を重複ハードコードしない。
 * OpenRouter / 新 Provider は後続 Phase（本ファイルに枠のみ）。
 */
(function (global) {
  "use strict";

  /**
   * workspaceId = Gateway / Manual チップ / allowlist の正本 ID
   * providerModelId = Edge が実際に呼ぶ model · SAFE-07 price rate の model 列
   */
  const ENTRIES = Object.freeze({
    "gemini-flash": Object.freeze({
      workspaceId: "gemini-flash",
      uiLabel: "最速",
      provider: "gemini",
      providerModelId: "gemini-2.5-flash",
      edge: "gemini-chat",
      available: true,
    }),
    gpt: Object.freeze({
      workspaceId: "gpt",
      uiLabel: "標準",
      provider: "openai",
      providerModelId: "gpt-4o-mini",
      edge: "openai-chat",
      available: true,
    }),
    claude: Object.freeze({
      workspaceId: "claude",
      uiLabel: "高精度",
      provider: "claude",
      providerModelId: "claude-haiku-4-5",
      edge: "claude-chat",
      available: true,
    }),
  });

  /** 設定 UI カタログ id → workspaceId */
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

  const WORKSPACE_IDS = Object.freeze(Object.keys(ENTRIES));

  function getEntry(workspaceId) {
    const id = String(workspaceId || "").trim();
    return ENTRIES[id] || null;
  }

  function isKnownWorkspaceId(workspaceId) {
    return Boolean(getEntry(workspaceId)?.available);
  }

  function catalogToWorkspaceId(catalogId) {
    const raw = String(catalogId || "").trim();
    if (!raw) return null;
    if (ENTRIES[raw]) return raw;
    const mapped = CATALOG_TO_WORKSPACE[raw];
    return mapped && ENTRIES[mapped] ? mapped : null;
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

  /** Cost Ledger lookup 用（provider + model） */
  function toCostLedgerKey(workspaceId) {
    const e = getEntry(workspaceId);
    if (!e) return null;
    return { provider: e.provider, model: e.providerModelId };
  }

  /**
   * フォールバック候補（同一リクエスト最大1回用）
   * 優先: gemini-flash → gpt → claude（利用可能のみ）
   */
  function listFallbackWorkspaceIds(excludeId) {
    const exclude = String(excludeId || "").trim();
    return WORKSPACE_IDS.filter((id) => id !== exclude && ENTRIES[id]?.available);
  }

  global.TasuAiModelIdentity = {
    ENTRIES,
    CATALOG_TO_WORKSPACE,
    WORKSPACE_IDS,
    getEntry,
    isKnownWorkspaceId,
    catalogToWorkspaceId,
    toProviderModelId,
    toProvider,
    toEdge,
    toUiLabel,
    toCostLedgerKey,
    listFallbackWorkspaceIds,
  };
})(typeof window !== "undefined" ? window : globalThis);
