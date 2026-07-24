/**
 * TASFUL AI Workspace — データ管理設定（ストレージ · エクスポート · インポート · 削除）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_data_settings";
  const EVENT_NAME = "tasu:ai-data-settings-changed";

  const EXPORT_TYPES = Object.freeze([
    { id: "all", label: "すべてのデータ", icon: "database", description: "チャット・ファイル・設定を含む" },
    { id: "chat", label: "チャット履歴のみ", icon: "chat", description: "会話履歴のみをエクスポート" },
    { id: "uploads", label: "アップロードファイルのみ", icon: "upload_file", description: "添付・生成ファイルのみ" },
    { id: "custom", label: "カスタム選択", icon: "tune", description: "項目を個別に選択" },
  ]);

  const DEFAULT_STATE = Object.freeze({
    storageUsage: 2.4,
    storageLimit: 10.0,
    exportType: "all",
    exportFormat: "json",
    importEnabled: true,
    autoDeletePeriod: "180d",
    inactiveDelete: false,
    updatedAt: "",
  });

  /** @type {typeof DEFAULT_STATE} */
  let cachedState = loadState();

  function normalizeExportType(value) {
    const allowed = ["all", "chat", "uploads", "custom"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "all";
  }

  function normalizeExportFormat(value) {
    const allowed = ["json", "zip", "csv"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "json";
  }

  function normalizeAutoDeletePeriod(value) {
    const allowed = ["30d", "90d", "180d", "12m", "unlimited"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "180d";
  }

  function normalizeStorageGb(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.round(n * 10) / 10;
  }

  function cloneState(source) {
    const usage = normalizeStorageGb(source.storageUsage, DEFAULT_STATE.storageUsage);
    const limit = normalizeStorageGb(source.storageLimit, DEFAULT_STATE.storageLimit);
    return {
      storageUsage: usage,
      storageLimit: Math.max(usage, limit),
      exportType: normalizeExportType(source.exportType),
      exportFormat: normalizeExportFormat(source.exportFormat),
      importEnabled: Boolean(source.importEnabled),
      autoDeletePeriod: normalizeAutoDeletePeriod(source.autoDeletePeriod),
      inactiveDelete: Boolean(source.inactiveDelete),
      updatedAt: source.updatedAt || "",
    };
  }

  function sanitizePartial(input, base) {
    const next = cloneState(base);
    if (!input || typeof input !== "object") return next;
    Object.keys(DEFAULT_STATE).forEach((key) => {
      if (key in input && key !== "updatedAt") {
        next[key] = cloneState({ ...next, [key]: input[key] })[key];
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

  function setSetting(key, value) {
    if (!(key in DEFAULT_STATE) || key === "updatedAt") return cachedState;
    return setState({ [key]: value }, { changedKey: key });
  }

  function getStoragePercent(state) {
    const snapshot = cloneState(state || cachedState);
    if (snapshot.storageLimit <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((snapshot.storageUsage / snapshot.storageLimit) * 100)));
  }

  function getRemainingGb(state) {
    const snapshot = cloneState(state || cachedState);
    return Math.max(0, Math.round((snapshot.storageLimit - snapshot.storageUsage) * 10) / 10);
  }

  function formatStorageLabel(gb) {
    const n = Number(gb);
    if (!Number.isFinite(n)) return "0 GB";
    return `${n.toFixed(1)} GB`;
  }

  function getDonutMetrics(state) {
    const snapshot = cloneState(state || cachedState);
    const percent = getStoragePercent(snapshot);
    const radius = 48;
    const circumference = 2 * Math.PI * radius;
    const filled = (percent / 100) * circumference;
    return {
      percent,
      circumference,
      dashArray: `${filled} ${circumference - filled}`,
    };
  }

  function formatForApiRequest() {
    const snapshot = getSnapshot();
    const remainingGb = getRemainingGb(snapshot);
    const exportType = EXPORT_TYPES.find((item) => item.id === snapshot.exportType) || EXPORT_TYPES[0];
    return {
      storage: {
        usageGb: snapshot.storageUsage,
        limitGb: snapshot.storageLimit,
        remainingGb,
        percent: getStoragePercent(snapshot),
      },
      export: {
        type: snapshot.exportType,
        typeLabel: exportType.label,
        format: snapshot.exportFormat,
      },
      import: {
        enabled: snapshot.importEnabled,
      },
      retention: {
        autoDeletePeriod: snapshot.autoDeletePeriod,
        inactiveDelete: snapshot.inactiveDelete,
      },
      updatedAt: snapshot.updatedAt,
    };
  }

  function runIncreaseStorage() {
    console.info("[TasuAiWorkspaceDataSettings] increase storage (demo)");
    return { ok: true, action: "increase-storage" };
  }

  function runExport() {
    const snapshot = getSnapshot();
    console.info("[TasuAiWorkspaceDataSettings] export (demo)", snapshot.exportType, snapshot.exportFormat);
    return { ok: true, action: "export", ...formatForApiRequest().export };
  }

  function runImport(file) {
    const snapshot = getSnapshot();
    if (!snapshot.importEnabled) return { ok: false, reason: "import-disabled" };
    console.info("[TasuAiWorkspaceDataSettings] import (demo)", file?.name || "no-file");
    return { ok: true, action: "import", fileName: file?.name || null };
  }

  function runDeleteHistory() {
    console.info("[TasuAiWorkspaceDataSettings] delete chat history (demo)");
    return { ok: true, action: "delete-history" };
  }

  function runDeleteUploads() {
    console.info("[TasuAiWorkspaceDataSettings] delete uploads (demo)");
    return { ok: true, action: "delete-uploads" };
  }

  function runDeleteAllData() {
    console.info("[TasuAiWorkspaceDataSettings] delete all data (demo)");
    return { ok: true, action: "delete-all-data" };
  }

  init();

  function init() {
    cachedState = loadState();
  }

  global.TasuAiWorkspaceDataSettings = {
    STORAGE_KEY,
    EVENT_NAME,
    EXPORT_TYPES,
    DEFAULT_STATE,
    getState,
    getSnapshot,
    setState,
    setSetting,
    getStoragePercent,
    getRemainingGb,
    formatStorageLabel,
    getDonutMetrics,
    formatForApiRequest,
    runIncreaseStorage,
    runExport,
    runImport,
    runDeleteHistory,
    runDeleteUploads,
    runDeleteAllData,
  };
})(typeof window !== "undefined" ? window : globalThis);
