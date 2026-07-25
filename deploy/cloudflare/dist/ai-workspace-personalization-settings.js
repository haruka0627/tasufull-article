/**
 * TASFUL AI Workspace — パーソナライズ設定（応答スタイル · プロフィール · メモリ）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_personalization_settings";
  const EVENT_NAME = "tasu:ai-personalization-settings-changed";
  const MAX_INSTRUCTION_LENGTH = 1000;

  const STYLES = Object.freeze([
    { id: "professional", label: "プロフェッショナル", icon: "domain" },
    { id: "casual", label: "カジュアル", icon: "local_cafe" },
    { id: "polite", label: "丁寧", icon: "editor_choice" },
    { id: "friendly", label: "フレンドリー", icon: "sentiment_satisfied" },
  ]);

  const PRESETS = Object.freeze([
    {
      id: "programming",
      label: "プログラミング",
      icon: "code",
      description: "コード中心の正確な回答",
      values: {
        style: "professional",
        warmth: 35,
        detailLevel: 75,
        emojiUsage: 5,
        headingUsage: 65,
        fastResponse: true,
      },
    },
    {
      id: "writing",
      label: "ライティング",
      icon: "edit",
      description: "文章作成に最適化",
      values: {
        style: "polite",
        warmth: 55,
        detailLevel: 70,
        emojiUsage: 15,
        headingUsage: 50,
        fastResponse: false,
      },
    },
    {
      id: "business",
      label: "ビジネス",
      icon: "business_center",
      description: "ビジネス向けの簡潔な回答",
      values: {
        style: "professional",
        warmth: 40,
        detailLevel: 60,
        emojiUsage: 0,
        headingUsage: 55,
        fastResponse: true,
      },
    },
    {
      id: "learning",
      label: "学習",
      icon: "menu_book",
      description: "学習・解説向けの丁寧な回答",
      values: {
        style: "friendly",
        warmth: 65,
        detailLevel: 80,
        emojiUsage: 20,
        headingUsage: 70,
        fastResponse: false,
      },
    },
    {
      id: "creative",
      label: "クリエイティブ",
      icon: "auto_awesome",
      description: "発想・創作向けの柔軟な回答",
      values: {
        style: "casual",
        warmth: 75,
        detailLevel: 55,
        emojiUsage: 45,
        headingUsage: 35,
        fastResponse: false,
      },
    },
  ]);

  const DEFAULT_STATE = Object.freeze({
    style: "professional",
    warmth: 50,
    detailLevel: 50,
    emojiUsage: 20,
    headingUsage: 50,
    fastResponse: true,
    nickname: "",
    occupation: "エンジニア",
    interests: ["野球", "ガジェット", "読書", "AI"],
    usagePurpose: ["仕事", "学習", "日常の相談"],
    memoryEnabled: true,
    memoryMode: "balance",
    conversationMemory: true,
    customInstruction: "",
    preset: "",
    updatedAt: "",
  });

  /** @type {typeof DEFAULT_STATE} */
  let cachedState = loadState();
  /** @type {typeof DEFAULT_STATE | null} */
  let draftState = null;

  function clampPercent(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function normalizeStyle(value) {
    const id = String(value || "").trim();
    return STYLES.some((item) => item.id === id) ? id : "professional";
  }

  function normalizeMemoryMode(value) {
    const allowed = ["balance", "minimal", "aggressive"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "balance";
  }

  function normalizePreset(value) {
    const id = String(value || "").trim();
    return PRESETS.some((item) => item.id === id) ? id : "";
  }

  function normalizeTags(value, fallback) {
    if (!Array.isArray(value)) return [...fallback];
    const tags = value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 20);
    return tags.length ? tags : [...fallback];
  }

  function cloneState(source) {
    return {
      style: normalizeStyle(source.style),
      warmth: clampPercent(source.warmth, 50),
      detailLevel: clampPercent(source.detailLevel, 50),
      emojiUsage: clampPercent(source.emojiUsage, 20),
      headingUsage: clampPercent(source.headingUsage, 50),
      fastResponse: Boolean(source.fastResponse),
      nickname: String(source.nickname || ""),
      occupation: String(source.occupation || ""),
      interests: normalizeTags(source.interests, DEFAULT_STATE.interests),
      usagePurpose: normalizeTags(source.usagePurpose, DEFAULT_STATE.usagePurpose),
      memoryEnabled: Boolean(source.memoryEnabled),
      memoryMode: normalizeMemoryMode(source.memoryMode),
      conversationMemory: Boolean(source.conversationMemory),
      customInstruction: String(source.customInstruction || "").slice(0, MAX_INSTRUCTION_LENGTH),
      preset: normalizePreset(source.preset),
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
    draftState = cloneState(cachedState);
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

  function getDraftSnapshot() {
    return Object.freeze(cloneState(draftState || cachedState));
  }

  function beginDraft() {
    draftState = cloneState(cachedState);
    return getDraftSnapshot();
  }

  function setDraftSetting(key, value) {
    if (!(key in DEFAULT_STATE) || key === "updatedAt") return getDraftSnapshot();
    draftState = sanitizePartial({ [key]: value }, draftState || cachedState);
    return getDraftSnapshot();
  }

  function addDraftTag(key, tag) {
    const text = String(tag || "").trim();
    if (!text || (key !== "interests" && key !== "usagePurpose")) return getDraftSnapshot();
    const current = getDraftSnapshot();
    const list = [...current[key]];
    if (list.includes(text) || list.length >= 20) return getDraftSnapshot();
    list.push(text);
    return setDraftSetting(key, list);
  }

  function removeDraftTag(key, index) {
    if (key !== "interests" && key !== "usagePurpose") return getDraftSnapshot();
    const current = getDraftSnapshot();
    const list = [...current[key]];
    const idx = Number(index);
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) return getDraftSnapshot();
    list.splice(idx, 1);
    return setDraftSetting(key, list);
  }

  function applyPreset(presetId) {
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) return getDraftSnapshot();
    if (!draftState) beginDraft();
    draftState = sanitizePartial(
      {
        ...draftState,
        ...preset.values,
        preset: preset.id,
      },
      draftState
    );
    return getDraftSnapshot();
  }

  function commitDraft() {
    const next = cloneState(draftState || cachedState);
    next.updatedAt = new Date().toISOString();
    return persistState(next, "commit");
  }

  function discardDraft() {
    draftState = cloneState(cachedState);
    return getDraftSnapshot();
  }

  function resetDraft() {
    draftState = cloneState(DEFAULT_STATE);
    return getDraftSnapshot();
  }

  function getSliderScale(key) {
    if (key === "warmth") return { low: "低い", high: "高い" };
    if (key === "detailLevel") return { low: "簡潔", high: "詳細" };
    if (key === "emojiUsage") return { low: "なし", high: "多い" };
    if (key === "headingUsage") return { low: "少ない", high: "多い" };
    return { low: "", high: "" };
  }

  function formatForApiRequest() {
    const snapshot = getSnapshot();
    const style = STYLES.find((item) => item.id === snapshot.style) || STYLES[0];
    const preset = PRESETS.find((item) => item.id === snapshot.preset);
    return {
      style: snapshot.style,
      styleLabel: style.label,
      warmth: snapshot.warmth,
      detailLevel: snapshot.detailLevel,
      emojiUsage: snapshot.emojiUsage,
      headingUsage: snapshot.headingUsage,
      fastResponse: snapshot.fastResponse,
      profile: {
        nickname: snapshot.nickname,
        occupation: snapshot.occupation,
        interests: [...snapshot.interests],
        usagePurpose: [...snapshot.usagePurpose],
      },
      memory: {
        enabled: snapshot.memoryEnabled,
        mode: snapshot.memoryMode,
        conversationMemory: snapshot.conversationMemory,
      },
      customInstruction: snapshot.customInstruction,
      preset: snapshot.preset,
      presetLabel: preset?.label || "",
      updatedAt: snapshot.updatedAt,
    };
  }

  function buildAugmentedSystemPrompt(basePrompt) {
    const snapshot = getSnapshot();
    const parts = [String(basePrompt || "").trim()];
    const style = STYLES.find((item) => item.id === snapshot.style);
    if (style) parts.push(`応答スタイル: ${style.label}`);
    if (snapshot.nickname) parts.push(`ユーザーのニックネーム: ${snapshot.nickname}`);
    if (snapshot.occupation) parts.push(`職業: ${snapshot.occupation}`);
    if (snapshot.interests.length) parts.push(`興味・趣味: ${snapshot.interests.join("、")}`);
    if (snapshot.usagePurpose.length) parts.push(`利用目的: ${snapshot.usagePurpose.join("、")}`);
    if (snapshot.customInstruction.trim()) parts.push(snapshot.customInstruction.trim());
    return parts.filter(Boolean).join("\n\n");
  }

  function runManageMemory() {
    console.info("[TasuAiWorkspacePersonalizationSettings] manage memory (demo)");
    return { ok: true, action: "manage-memory" };
  }

  init();

  function init() {
    cachedState = loadState();
  }

  global.TasuAiWorkspacePersonalizationSettings = {
    STORAGE_KEY,
    EVENT_NAME,
    MAX_INSTRUCTION_LENGTH,
    STYLES,
    PRESETS,
    DEFAULT_STATE,
    getState,
    getSnapshot,
    getDraftSnapshot,
    beginDraft,
    setDraftSetting,
    addDraftTag,
    removeDraftTag,
    applyPreset,
    commitDraft,
    discardDraft,
    resetDraft,
    getSliderScale,
    formatForApiRequest,
    buildAugmentedSystemPrompt,
    runManageMemory,
  };
})(typeof window !== "undefined" ? window : globalThis);
