/**
 * TASFUL AI Workspace — ライブラリー設定（保存先 · 表示 · ストレージ）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_library_settings";
  const EVENT_NAME = "tasu:ai-library-settings-changed";

  const DEFAULT_STORAGE_INFO = Object.freeze({
    usedGb: 4.2,
    totalGb: 10.0,
    percent: 42,
  });

  const DEFAULT_FILE_STATISTICS = Object.freeze([
    { id: "images", label: "画像", icon: "image", sizeLabel: "2.1 GB", sizeBytes: 2.1 * 1024 ** 3 },
    { id: "videos", label: "動画", icon: "movie", sizeLabel: "1.3 GB", sizeBytes: 1.3 * 1024 ** 3 },
    { id: "audio", label: "音声", icon: "mic", sizeLabel: "420 MB", sizeBytes: 420 * 1024 ** 2 },
    { id: "documents", label: "ドキュメント", icon: "description", sizeLabel: "380 MB", sizeBytes: 380 * 1024 ** 2 },
    { id: "other", label: "その他", icon: "more_horiz", sizeLabel: "20 MB", sizeBytes: 20 * 1024 ** 2 },
  ]);

  const DEFAULT_STATE = Object.freeze({
    defaultSaveLocation: "library",
    autoSave: true,
    retentionPeriod: "unlimited",
    viewMode: "grid",
    sortOrder: "updated-desc",
    itemsPerPage: 24,
    detectDuplicates: true,
    storageInfo: DEFAULT_STORAGE_INFO,
    fileStatistics: DEFAULT_FILE_STATISTICS,
    updatedAt: "",
  });

  /** @type {typeof DEFAULT_STATE} */
  let cachedState = loadState();

  function normalizeDefaultSaveLocation(value) {
    const allowed = ["library", "chat", "download-only"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "library";
  }

  function normalizeRetentionPeriod(value) {
    const allowed = ["unlimited", "30d", "90d", "180d", "1y"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "unlimited";
  }

  function normalizeViewMode(value) {
    const id = String(value || "").trim();
    return id === "list" ? "list" : "grid";
  }

  function normalizeSortOrder(value) {
    const allowed = ["updated-desc", "updated-asc", "name", "size"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "updated-desc";
  }

  function normalizeItemsPerPage(value) {
    const n = Number(value);
    return n === 12 || n === 24 || n === 48 || n === 96 ? n : 24;
  }

  function cloneStorageInfo(source) {
    const base = DEFAULT_STORAGE_INFO;
    const usedGb = Number(source?.usedGb);
    const totalGb = Number(source?.totalGb);
    const safeUsed = Number.isFinite(usedGb) ? usedGb : base.usedGb;
    const safeTotal = Number.isFinite(totalGb) && totalGb > 0 ? totalGb : base.totalGb;
    const percentRaw = Number(source?.percent);
    const percent = Number.isFinite(percentRaw)
      ? Math.max(0, Math.min(100, Math.round(percentRaw)))
      : Math.round((safeUsed / safeTotal) * 100);
    return {
      usedGb: Math.round(safeUsed * 10) / 10,
      totalGb: Math.round(safeTotal * 10) / 10,
      percent,
    };
  }

  function cloneFileStatistics(source) {
    const list = Array.isArray(source) ? source : DEFAULT_FILE_STATISTICS;
    return DEFAULT_FILE_STATISTICS.map((fallback) => {
      const found = list.find((item) => item && item.id === fallback.id);
      if (!found) return { ...fallback };
      return {
        id: fallback.id,
        label: String(found.label || fallback.label),
        icon: String(found.icon || fallback.icon),
        sizeLabel: String(found.sizeLabel || fallback.sizeLabel),
        sizeBytes: Number(found.sizeBytes) || fallback.sizeBytes,
      };
    });
  }

  function cloneState(source) {
    return {
      defaultSaveLocation: normalizeDefaultSaveLocation(source.defaultSaveLocation),
      autoSave: Boolean(source.autoSave),
      retentionPeriod: normalizeRetentionPeriod(source.retentionPeriod),
      viewMode: normalizeViewMode(source.viewMode),
      sortOrder: normalizeSortOrder(source.sortOrder),
      itemsPerPage: normalizeItemsPerPage(source.itemsPerPage),
      detectDuplicates: Boolean(source.detectDuplicates),
      storageInfo: cloneStorageInfo(source.storageInfo),
      fileStatistics: cloneFileStatistics(source.fileStatistics),
      updatedAt: source.updatedAt || "",
    };
  }

  function sanitizePartial(input, base) {
    const next = cloneState(base);
    if (!input || typeof input !== "object") return next;
    Object.keys(DEFAULT_STATE).forEach((key) => {
      if (key in input && key !== "updatedAt") {
        if (key === "storageInfo") {
          next.storageInfo = cloneStorageInfo({ ...next.storageInfo, ...input.storageInfo });
        } else if (key === "fileStatistics") {
          next.fileStatistics = cloneFileStatistics(input.fileStatistics);
        } else {
          next[key] = cloneState({ ...next, [key]: input[key] })[key];
        }
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

  function getRemainingGb(storageInfo) {
    const info = cloneStorageInfo(storageInfo || cachedState.storageInfo);
    return Math.max(0, Math.round((info.totalGb - info.usedGb) * 10) / 10);
  }

  function formatStorageLabel(gb) {
    const n = Number(gb);
    if (!Number.isFinite(n)) return "0 GB";
    return `${n.toFixed(1)} GB`;
  }

  function getDonutMetrics(storageInfo) {
    const info = cloneStorageInfo(storageInfo || cachedState.storageInfo);
    const radius = 48;
    const circumference = 2 * Math.PI * radius;
    const filled = (info.percent / 100) * circumference;
    return {
      percent: info.percent,
      circumference,
      dashArray: `${filled} ${circumference - filled}`,
    };
  }

  function formatForApiRequest() {
    const snapshot = getSnapshot();
    const remainingGb = getRemainingGb(snapshot.storageInfo);
    return {
      defaultSaveLocation: snapshot.defaultSaveLocation,
      autoSave: snapshot.autoSave,
      retentionPeriod: snapshot.retentionPeriod,
      viewMode: snapshot.viewMode,
      sortOrder: snapshot.sortOrder,
      itemsPerPage: snapshot.itemsPerPage,
      detectDuplicates: snapshot.detectDuplicates,
      storage: {
        usedGb: snapshot.storageInfo.usedGb,
        totalGb: snapshot.storageInfo.totalGb,
        remainingGb,
        percent: snapshot.storageInfo.percent,
      },
      fileStatistics: snapshot.fileStatistics.map((item) => ({
        id: item.id,
        label: item.label,
        sizeLabel: item.sizeLabel,
        sizeBytes: item.sizeBytes,
      })),
      updatedAt: snapshot.updatedAt,
    };
  }

  function runCleanupUnused() {
    console.info("[TasuAiWorkspaceLibrarySettings] cleanup unused files (demo)");
    return { ok: true, action: "cleanup-unused" };
  }

  function runEmptyTrash() {
    console.info("[TasuAiWorkspaceLibrarySettings] empty trash (demo)");
    return { ok: true, action: "empty-trash" };
  }

  function runIncreaseStorage() {
    console.info("[TasuAiWorkspaceLibrarySettings] increase storage (demo)");
    return { ok: true, action: "increase-storage" };
  }

  function runViewFileDetails() {
    console.info("[TasuAiWorkspaceLibrarySettings] view file details (demo)");
    return { ok: true, action: "view-file-details" };
  }

  init();

  function init() {
    cachedState = loadState();
  }

  global.TasuAiWorkspaceLibrarySettings = {
    STORAGE_KEY,
    EVENT_NAME,
    DEFAULT_STATE,
    DEFAULT_STORAGE_INFO,
    DEFAULT_FILE_STATISTICS,
    getState,
    getSnapshot,
    setState,
    setSetting,
    getRemainingGb,
    formatStorageLabel,
    getDonutMetrics,
    formatForApiRequest,
    runCleanupUnused,
    runEmptyTrash,
    runIncreaseStorage,
    runViewFileDetails,
  };
})(typeof window !== "undefined" ? window : globalThis);
