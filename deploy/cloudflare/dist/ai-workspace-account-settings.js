/**
 * TASFUL AI Workspace — アカウント設定（プロフィール · 連携 · メール · 操作）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_account_settings";
  const EVENT_NAME = "tasu:ai-account-settings-changed";

  const PROVIDER_IDS = Object.freeze(["google", "github", "discord", "x", "linkedin"]);

  const DEFAULT_CONNECTED_PROVIDERS = Object.freeze({
    google: true,
    github: false,
    discord: false,
    x: false,
    linkedin: false,
  });

  const DEFAULT_STATE = Object.freeze({
    name: "ルビィ",
    email: "rubi.hiro0613@gmail.com",
    userId: "TASFUL-000001",
    createdAt: "2024-01-15T09:00:00.000Z",
    lastLoginAt: "2026-06-29T03:00:00.000Z",
    avatar: "",
    displayName: "ルビィ",
    username: "rubih",
    bio: "",
    publicProfile: false,
    connectedProviders: DEFAULT_CONNECTED_PROVIDERS,
    feedbackEmail: false,
    importantNoticeEmail: true,
    marketingEmail: false,
    updatedAt: "",
  });

  /** @type {typeof DEFAULT_STATE} */
  let cachedState = loadState();

  function cloneConnectedProviders(source) {
    const base = DEFAULT_CONNECTED_PROVIDERS;
    const input = source && typeof source === "object" ? source : {};
    return {
      google: Boolean(input.google ?? base.google),
      github: Boolean(input.github ?? base.github),
      discord: Boolean(input.discord ?? base.discord),
      x: Boolean(input.x ?? base.x),
      linkedin: Boolean(input.linkedin ?? base.linkedin),
    };
  }

  function normalizeText(value, fallback, maxLen) {
    const text = String(value ?? fallback ?? "").trim();
    if (!text) return String(fallback ?? "");
    return text.slice(0, maxLen);
  }

  function cloneState(source) {
    return {
      name: normalizeText(source.name, DEFAULT_STATE.name, 80),
      email: normalizeText(source.email, DEFAULT_STATE.email, 120),
      userId: normalizeText(source.userId, DEFAULT_STATE.userId, 64),
      createdAt: source.createdAt || DEFAULT_STATE.createdAt,
      lastLoginAt: source.lastLoginAt || DEFAULT_STATE.lastLoginAt,
      avatar: String(source.avatar || ""),
      displayName: normalizeText(source.displayName, DEFAULT_STATE.displayName, 80),
      username: normalizeText(source.username, DEFAULT_STATE.username, 40),
      bio: String(source.bio || "").slice(0, 500),
      publicProfile: Boolean(source.publicProfile),
      connectedProviders: cloneConnectedProviders(source.connectedProviders),
      feedbackEmail: Boolean(source.feedbackEmail),
      importantNoticeEmail: Boolean(source.importantNoticeEmail),
      marketingEmail: Boolean(source.marketingEmail),
      updatedAt: source.updatedAt || "",
    };
  }

  function sanitizePartial(input, base) {
    const next = cloneState(base);
    if (!input || typeof input !== "object") return next;
    Object.keys(DEFAULT_STATE).forEach((key) => {
      if (key in input && key !== "updatedAt") {
        if (key === "connectedProviders") {
          next.connectedProviders = cloneConnectedProviders({
            ...next.connectedProviders,
            ...input.connectedProviders,
          });
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

  function setProviderConnected(providerId, connected) {
    if (!PROVIDER_IDS.includes(providerId)) return cachedState;
    const nextProviders = cloneConnectedProviders(cachedState.connectedProviders);
    nextProviders[providerId] = Boolean(connected);
    return setState({ connectedProviders: nextProviders }, { changedKey: "connectedProviders" });
  }

  function formatDisplayDate(iso, withTime) {
    if (!iso) return "—";
    try {
      const opts = withTime
        ? { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }
        : { year: "numeric", month: "long", day: "numeric" };
      return new Intl.DateTimeFormat("ja-JP", opts).format(new Date(iso));
    } catch {
      return String(iso);
    }
  }

  function getAvatarInitials(state) {
    const source = state?.displayName || state?.name || "?";
    const parts = String(source).trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(source).slice(0, 2).toUpperCase();
  }

  function formatForApiRequest() {
    const snapshot = getSnapshot();
    return {
      account: {
        name: snapshot.name,
        email: snapshot.email,
        userId: snapshot.userId,
        createdAt: snapshot.createdAt,
        lastLoginAt: snapshot.lastLoginAt,
      },
      profile: {
        avatar: snapshot.avatar,
        displayName: snapshot.displayName,
        username: snapshot.username,
        bio: snapshot.bio,
        publicProfile: snapshot.publicProfile,
      },
      connectedProviders: { ...snapshot.connectedProviders },
      emailPreferences: {
        feedbackEmail: snapshot.feedbackEmail,
        importantNoticeEmail: snapshot.importantNoticeEmail,
        marketingEmail: snapshot.marketingEmail,
      },
      updatedAt: snapshot.updatedAt,
    };
  }

  function runChangeName(nextName) {
    const prev = getSnapshot();
    const name = normalizeText(nextName, prev.name, 80);
    const shouldSyncDisplay = !prev.displayName || prev.displayName === prev.name;
    setSetting("name", name);
    if (shouldSyncDisplay) setSetting("displayName", name);
    console.info("[TasuAiWorkspaceAccountSettings] name updated (demo)");
    return { ok: true, action: "change-name", name };
  }

  function runChangeEmail(nextEmail) {
    const email = normalizeText(nextEmail, cachedState.email, 120);
    setSetting("email", email);
    console.info("[TasuAiWorkspaceAccountSettings] email updated (demo)");
    return { ok: true, action: "change-email", email };
  }

  function runChangeAvatar(dataUrl) {
    setSetting("avatar", String(dataUrl || ""));
    console.info("[TasuAiWorkspaceAccountSettings] avatar updated (demo)");
    return { ok: true, action: "change-avatar" };
  }

  function runConnectProvider(providerId) {
    if (!PROVIDER_IDS.includes(providerId)) return { ok: false };
    setProviderConnected(providerId, true);
    console.info("[TasuAiWorkspaceAccountSettings] connect provider (demo)", providerId);
    return { ok: true, action: "connect-provider", providerId };
  }

  function runManageProvider(providerId) {
    console.info("[TasuAiWorkspaceAccountSettings] manage provider (demo)", providerId);
    return { ok: true, action: "manage-provider", providerId };
  }

  function runDisconnectProvider(providerId) {
    if (!PROVIDER_IDS.includes(providerId)) return { ok: false };
    setProviderConnected(providerId, false);
    console.info("[TasuAiWorkspaceAccountSettings] disconnect provider (demo)", providerId);
    return { ok: true, action: "disconnect-provider", providerId };
  }

  function runLogout() {
    console.info("[TasuAiWorkspaceAccountSettings] logout (demo)");
    return { ok: true, action: "logout" };
  }

  function runDeleteAccount() {
    console.info("[TasuAiWorkspaceAccountSettings] delete account requested (demo — not executed)");
    return { ok: true, action: "delete-account-pending" };
  }

  function runConfirmDeleteAccount() {
    console.info("[TasuAiWorkspaceAccountSettings] delete account confirmed (demo — not executed)");
    return { ok: true, action: "delete-account" };
  }

  init();

  function init() {
    cachedState = loadState();
  }

  global.TasuAiWorkspaceAccountSettings = {
    STORAGE_KEY,
    EVENT_NAME,
    DEFAULT_STATE,
    PROVIDER_IDS,
    getState,
    getSnapshot,
    setState,
    setSetting,
    setProviderConnected,
    formatDisplayDate,
    getAvatarInitials,
    formatForApiRequest,
    runChangeName,
    runChangeEmail,
    runChangeAvatar,
    runConnectProvider,
    runManageProvider,
    runDisconnectProvider,
    runLogout,
    runDeleteAccount,
    runConfirmDeleteAccount,
  };
})(typeof window !== "undefined" ? window : globalThis);
