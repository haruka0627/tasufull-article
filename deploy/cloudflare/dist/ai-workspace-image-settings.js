/**
 * TASFUL AI Workspace — 画像設定（生成 · 解析 · モデル · スタイル）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_image_settings";
  const EVENT_NAME = "tasu:ai-image-settings-changed";

  const ASPECT_RATIOS = Object.freeze([
    { id: "1:1", ratio: "1:1", label: "正方形", width: 1, height: 1 },
    { id: "16:9", ratio: "16:9", label: "横長", width: 16, height: 9 },
    { id: "9:16", ratio: "9:16", label: "縦長", width: 9, height: 16 },
    { id: "4:3", ratio: "4:3", label: "横長（4:3）", width: 4, height: 3 },
    { id: "3:4", ratio: "3:4", label: "縦長（3:4）", width: 3, height: 4 },
    { id: "2:3", ratio: "2:3", label: "縦長（2:3）", width: 2, height: 3 },
  ]);

  const STYLES = Object.freeze([
    {
      id: "auto",
      label: "自動",
      thumb: "linear-gradient(180deg, #7dd3fc 0%, #38bdf8 45%, #ffffff 100%)",
    },
    {
      id: "photo",
      label: "写真",
      thumb: "linear-gradient(180deg, #86efac 0%, #22c55e 35%, #166534 100%)",
    },
    {
      id: "illustration",
      label: "イラスト",
      thumb: "linear-gradient(135deg, #fde68a 0%, #fb923c 55%, #f97316 100%)",
    },
    {
      id: "anime",
      label: "アニメ",
      thumb: "linear-gradient(135deg, #fbcfe8 0%, #f472b6 45%, #db2777 100%)",
    },
    {
      id: "3d",
      label: "3D",
      thumb: "linear-gradient(135deg, #e5e7eb 0%, #9ca3af 40%, #4b5563 100%)",
    },
    {
      id: "watercolor",
      label: "水彩画",
      thumb: "linear-gradient(135deg, #ddd6fe 0%, #a5b4fc 40%, #818cf8 100%)",
    },
    {
      id: "oil",
      label: "油絵",
      thumb: "linear-gradient(135deg, #1e3a8a 0%, #312e81 45%, #fbbf24 100%)",
    },
    {
      id: "other",
      label: "その他",
      thumb: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)",
      icon: "more_horiz",
    },
  ]);

  const DEFAULT_STATE = Object.freeze({
    model: "auto",
    quality: "standard",
    aspectRatio: "1:1",
    style: "auto",
    textRendering: true,
    negativePrompt: true,
    nsfwFilter: true,
    defaultCount: 4,
    saveDestination: "library",
    updatedAt: "",
  });

  /** @type {typeof DEFAULT_STATE} */
  let cachedState = loadState();

  function normalizeModel(value) {
    const allowed = ["auto", "gpt-image", "gemini-image", "stable-diffusion", "dalle", "future"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "auto";
  }

  function normalizeQuality(value) {
    const allowed = ["standard", "high", "ultra"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "standard";
  }

  function normalizeAspectRatio(value) {
    const id = String(value || "").trim();
    return ASPECT_RATIOS.some((item) => item.id === id) ? id : "1:1";
  }

  function normalizeStyle(value) {
    const id = String(value || "").trim();
    return STYLES.some((item) => item.id === id) ? id : "auto";
  }

  function normalizeDefaultCount(value) {
    const n = Number(value);
    return n === 1 || n === 2 || n === 4 ? n : 4;
  }

  function normalizeSaveDestination(value) {
    const allowed = ["library", "chat", "none"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "library";
  }

  function cloneState(source) {
    return {
      model: normalizeModel(source.model),
      quality: normalizeQuality(source.quality),
      aspectRatio: normalizeAspectRatio(source.aspectRatio),
      style: normalizeStyle(source.style),
      textRendering: Boolean(source.textRendering),
      negativePrompt: Boolean(source.negativePrompt),
      nsfwFilter: Boolean(source.nsfwFilter),
      defaultCount: normalizeDefaultCount(source.defaultCount),
      saveDestination: normalizeSaveDestination(source.saveDestination),
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

  function getAspectRatio(aspectRatioId) {
    const id = normalizeAspectRatio(aspectRatioId || cachedState.aspectRatio);
    return ASPECT_RATIOS.find((item) => item.id === id) || ASPECT_RATIOS[0];
  }

  function getStyle(styleId) {
    const id = normalizeStyle(styleId || cachedState.style);
    return STYLES.find((item) => item.id === id) || STYLES[0];
  }

  function formatForApiRequest() {
    const snapshot = getSnapshot();
    const aspect = getAspectRatio(snapshot.aspectRatio);
    const style = getStyle(snapshot.style);
    return {
      model: snapshot.model,
      quality: snapshot.quality,
      aspectRatio: snapshot.aspectRatio,
      aspectWidth: aspect.width,
      aspectHeight: aspect.height,
      style: snapshot.style,
      styleLabel: style.label,
      textRendering: snapshot.textRendering,
      negativePrompt: snapshot.negativePrompt,
      nsfwFilter: snapshot.nsfwFilter,
      defaultCount: snapshot.defaultCount,
      saveDestination: snapshot.saveDestination,
      updatedAt: snapshot.updatedAt,
    };
  }

  init();

  function init() {
    cachedState = loadState();
  }

  global.TasuAiWorkspaceImageSettings = {
    STORAGE_KEY,
    EVENT_NAME,
    ASPECT_RATIOS,
    STYLES,
    DEFAULT_STATE,
    getState,
    getSnapshot,
    getAspectRatio,
    getStyle,
    setState,
    setSetting,
    formatForApiRequest,
  };
})(typeof window !== "undefined" ? window : globalThis);
