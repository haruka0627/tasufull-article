/**
 * TASFUL AI Workspace — セキュリティ設定（ログイン · MFA · セッション · OAuth）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_security_settings";
  const EVENT_NAME = "tasu:ai-security-settings-changed";

  const DEFAULT_LOGIN_PROVIDERS = Object.freeze({
    google: true,
    github: false,
    discord: false,
  });

  const DEFAULT_STATE = Object.freeze({
    passwordEnabled: true,
    passkeyEnabled: false,
    loginProviders: DEFAULT_LOGIN_PROVIDERS,
    authenticatorEnabled: false,
    emailVerification: false,
    smsVerification: false,
    activeSessions: 3,
    loginAlerts: true,
    deviceVerification: true,
    apiKeyCount: 2,
    oauthAppCount: 1,
    anonymousTraining: false,
    analyticsSharing: false,
    updatedAt: "",
  });

  /** @type {typeof DEFAULT_STATE} */
  let cachedState = loadState();

  function cloneLoginProviders(source) {
    const base = DEFAULT_LOGIN_PROVIDERS;
    const input = source && typeof source === "object" ? source : {};
    return {
      google: Boolean(input.google ?? base.google),
      github: Boolean(input.github ?? base.github),
      discord: Boolean(input.discord ?? base.discord),
    };
  }

  function normalizeSessionCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return DEFAULT_STATE.activeSessions;
    return Math.min(99, Math.round(n));
  }

  function normalizeCount(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.min(999, Math.round(n));
  }

  function cloneState(source) {
    return {
      passwordEnabled: Boolean(source.passwordEnabled),
      passkeyEnabled: Boolean(source.passkeyEnabled),
      loginProviders: cloneLoginProviders(source.loginProviders),
      authenticatorEnabled: Boolean(source.authenticatorEnabled),
      emailVerification: Boolean(source.emailVerification),
      smsVerification: Boolean(source.smsVerification),
      activeSessions: normalizeSessionCount(source.activeSessions),
      loginAlerts: Boolean(source.loginAlerts),
      deviceVerification: Boolean(source.deviceVerification),
      apiKeyCount: normalizeCount(source.apiKeyCount, DEFAULT_STATE.apiKeyCount),
      oauthAppCount: normalizeCount(source.oauthAppCount, DEFAULT_STATE.oauthAppCount),
      anonymousTraining: Boolean(source.anonymousTraining),
      analyticsSharing: Boolean(source.analyticsSharing),
      updatedAt: source.updatedAt || "",
    };
  }

  function sanitizePartial(input, base) {
    const next = cloneState(base);
    if (!input || typeof input !== "object") return next;
    Object.keys(DEFAULT_STATE).forEach((key) => {
      if (key in input && key !== "updatedAt") {
        if (key === "loginProviders") {
          next.loginProviders = cloneLoginProviders({ ...next.loginProviders, ...input.loginProviders });
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

  function getConnectedProviderLabels(providers) {
    const map = cloneLoginProviders(providers || cachedState.loginProviders);
    const labels = [];
    if (map.google) labels.push("Google");
    if (map.github) labels.push("GitHub");
    if (map.discord) labels.push("Discord");
    return labels;
  }

  function formatForApiRequest() {
    const snapshot = getSnapshot();
    return {
      login: {
        passwordEnabled: snapshot.passwordEnabled,
        passkeyEnabled: snapshot.passkeyEnabled,
        providers: { ...snapshot.loginProviders },
        connectedProviders: getConnectedProviderLabels(snapshot.loginProviders),
      },
      mfa: {
        authenticatorEnabled: snapshot.authenticatorEnabled,
        emailVerification: snapshot.emailVerification,
        smsVerification: snapshot.smsVerification,
      },
      sessions: {
        activeSessions: snapshot.activeSessions,
      },
      advanced: {
        loginAlerts: snapshot.loginAlerts,
        deviceVerification: snapshot.deviceVerification,
        apiKeyCount: snapshot.apiKeyCount,
        oauthAppCount: snapshot.oauthAppCount,
      },
      privacy: {
        anonymousTraining: snapshot.anonymousTraining,
        analyticsSharing: snapshot.analyticsSharing,
      },
      updatedAt: snapshot.updatedAt,
    };
  }

  function runChangePassword() {
    console.info("[TasuAiWorkspaceSecuritySettings] change password (demo)");
    return { ok: true, action: "change-password" };
  }

  function runAddPasskey() {
    setSetting("passkeyEnabled", true);
    console.info("[TasuAiWorkspaceSecuritySettings] add passkey (demo)");
    return { ok: true, action: "add-passkey" };
  }

  function runManageLoginProviders() {
    console.info("[TasuAiWorkspaceSecuritySettings] manage login providers (demo)");
    return { ok: true, action: "manage-login-providers" };
  }

  function runManageSessions() {
    console.info("[TasuAiWorkspaceSecuritySettings] manage sessions (demo)");
    return { ok: true, action: "manage-sessions" };
  }

  function runLogoutOtherDevices() {
    console.info("[TasuAiWorkspaceSecuritySettings] logout other devices (demo)");
    return { ok: true, action: "logout-other-devices" };
  }

  function runManageApiKeys() {
    console.info("[TasuAiWorkspaceSecuritySettings] manage api keys (demo)");
    return { ok: true, action: "manage-api-keys" };
  }

  function runManageOAuthApps() {
    console.info("[TasuAiWorkspaceSecuritySettings] manage oauth apps (demo)");
    return { ok: true, action: "manage-oauth-apps" };
  }

  function runLogoutAllDevices() {
    setSetting("activeSessions", 1);
    console.info("[TasuAiWorkspaceSecuritySettings] logout all devices (demo)");
    return { ok: true, action: "logout-all-devices" };
  }

  function runDeleteAllApiKeys() {
    setSetting("apiKeyCount", 0);
    console.info("[TasuAiWorkspaceSecuritySettings] delete all api keys (demo)");
    return { ok: true, action: "delete-all-api-keys" };
  }

  function runResetSecuritySettings() {
    const next = cloneState(DEFAULT_STATE);
    next.updatedAt = new Date().toISOString();
    return persistState(next, "reset");
  }

  init();

  function init() {
    cachedState = loadState();
  }

  global.TasuAiWorkspaceSecuritySettings = {
    STORAGE_KEY,
    EVENT_NAME,
    DEFAULT_STATE,
    getState,
    getSnapshot,
    setState,
    setSetting,
    getConnectedProviderLabels,
    formatForApiRequest,
    runChangePassword,
    runAddPasskey,
    runManageLoginProviders,
    runManageSessions,
    runLogoutOtherDevices,
    runManageApiKeys,
    runManageOAuthApps,
    runLogoutAllDevices,
    runDeleteAllApiKeys,
    runResetSecuritySettings,
  };
})(typeof window !== "undefined" ? window : globalThis);
