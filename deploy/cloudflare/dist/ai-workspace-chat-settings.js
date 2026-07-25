/**
 * TASFUL AI Workspace — チャット設定（表示 · 応答 · デフォルトモード）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_chat_settings";
  const EVENT_NAME = "tasu:ai-chat-settings-changed";

  const DEFAULT_CHAT_MODES = Object.freeze(["auto", "speed", "quality", "cost"]);

  const DEFAULT_STATE = Object.freeze({
    theme: "system",
    fontSize: "medium",
    messagePosition: "right",
    assistantStyle: "standard",
    responseLength: 50,
    paragraphStyle: "standard",
    codeBlockMode: "always",
    linkPreview: true,
    showCitation: true,
    defaultChatMode: "auto",
    updatedAt: "",
  });

  /** @type {typeof DEFAULT_STATE} */
  let cachedState = loadState();

  function cloneState(source) {
    return {
      theme: normalizeTheme(source.theme),
      fontSize: normalizeFontSize(source.fontSize),
      messagePosition: normalizeMessagePosition(source.messagePosition),
      assistantStyle: normalizeAssistantStyle(source.assistantStyle),
      responseLength: clampResponseLength(source.responseLength),
      paragraphStyle: normalizeParagraphStyle(source.paragraphStyle),
      codeBlockMode: normalizeCodeBlockMode(source.codeBlockMode),
      linkPreview: Boolean(source.linkPreview),
      showCitation: Boolean(source.showCitation),
      defaultChatMode: normalizeDefaultChatMode(source.defaultChatMode),
      updatedAt: source.updatedAt || "",
    };
  }

  function normalizeTheme(value) {
    const id = String(value || "").trim();
    return id === "light" || id === "dark" || id === "system" ? id : "system";
  }

  function normalizeFontSize(value) {
    const id = String(value || "").trim();
    return id === "small" || id === "large" || id === "medium" ? id : "medium";
  }

  function normalizeMessagePosition(value) {
    const id = String(value || "").trim();
    return id === "left" || id === "right" ? id : "right";
  }

  function normalizeAssistantStyle(value) {
    const id = String(value || "").trim();
    return id === "compact" || id === "standard" ? id : "standard";
  }

  function normalizeParagraphStyle(value) {
    const id = String(value || "").trim();
    return id === "short" || id === "long" || id === "standard" ? id : "standard";
  }

  function normalizeCodeBlockMode(value) {
    const id = String(value || "").trim();
    return id === "collapse" || id === "always" ? id : "always";
  }

  function normalizeDefaultChatMode(value) {
    const id = String(value || "").trim();
    return DEFAULT_CHAT_MODES.includes(id) ? id : "auto";
  }

  function clampResponseLength(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_STATE.responseLength;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function getResponseLengthLabel(value) {
    const n = clampResponseLength(value);
    if (n <= 33) return "短め";
    if (n >= 67) return "長め";
    return "標準";
  }

  function sanitizePartial(input, base) {
    const next = cloneState(base);
    if (!input || typeof input !== "object") return next;

    if ("theme" in input) next.theme = normalizeTheme(input.theme);
    if ("fontSize" in input) next.fontSize = normalizeFontSize(input.fontSize);
    if ("messagePosition" in input) next.messagePosition = normalizeMessagePosition(input.messagePosition);
    if ("assistantStyle" in input) next.assistantStyle = normalizeAssistantStyle(input.assistantStyle);
    if ("responseLength" in input) next.responseLength = clampResponseLength(input.responseLength);
    if ("paragraphStyle" in input) next.paragraphStyle = normalizeParagraphStyle(input.paragraphStyle);
    if ("codeBlockMode" in input) next.codeBlockMode = normalizeCodeBlockMode(input.codeBlockMode);
    if ("linkPreview" in input) next.linkPreview = Boolean(input.linkPreview);
    if ("showCitation" in input) next.showCitation = Boolean(input.showCitation);
    if ("defaultChatMode" in input) next.defaultChatMode = normalizeDefaultChatMode(input.defaultChatMode);

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

  function syncDefaultChatModeToRouter(mode) {
    const router = global.TasuAiWorkspaceModelRouterSettings;
    if (!router?.setModelMode) return;
    const normalized = normalizeDefaultChatMode(mode);
    if (router.getState?.().modelMode !== normalized) {
      router.setModelMode(normalized);
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
    if ("defaultChatMode" in partial) {
      syncDefaultChatModeToRouter(next.defaultChatMode);
    }
    return persistState(next, meta.changedKey || null);
  }

  function setSetting(key, value) {
    if (!(key in DEFAULT_STATE) || key === "updatedAt") return cachedState;
    return setState({ [key]: value }, { changedKey: key });
  }

  function formatForApiRequest() {
    const snapshot = getSnapshot();
    return {
      theme: snapshot.theme,
      fontSize: snapshot.fontSize,
      messagePosition: snapshot.messagePosition,
      assistantStyle: snapshot.assistantStyle,
      responseLength: snapshot.responseLength,
      responseLengthLabel: getResponseLengthLabel(snapshot.responseLength),
      paragraphStyle: snapshot.paragraphStyle,
      codeBlockMode: snapshot.codeBlockMode,
      linkPreview: snapshot.linkPreview,
      showCitation: snapshot.showCitation,
      defaultChatMode: snapshot.defaultChatMode,
      updatedAt: snapshot.updatedAt,
    };
  }

  function init() {
    cachedState = loadState();
  }

  init();

  global.TasuAiWorkspaceChatSettings = {
    STORAGE_KEY,
    EVENT_NAME,
    DEFAULT_STATE,
    DEFAULT_CHAT_MODES,
    getState,
    getSnapshot,
    setState,
    setSetting,
    getResponseLengthLabel,
    formatForApiRequest,
  };
})(typeof window !== "undefined" ? window : globalThis);
