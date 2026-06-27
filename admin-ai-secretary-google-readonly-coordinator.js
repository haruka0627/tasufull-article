/**
 * AI秘書 — Google read-only UI coordinator (Step 1)
 * Connection gating · panel refresh · write hide · minimal summary
 */
(function (global) {
  "use strict";

  const EVENT_NAME = "tasu:secretary-google-connection-changed";

  const state = {
    connected: false,
    mock: false,
    configured: false,
    gmail: "gated",
    calendar: "gated",
    lastError: "",
  };

  let mounted = false;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function trim(value, max) {
    return String(value ?? "").trim().slice(0, max || 200);
  }

  function isReadOnlyMode() {
    return true;
  }

  function isConnected() {
    return Boolean(state.connected);
  }

  function getState() {
    return { ...state };
  }

  function setPanelStatus(panel, status) {
    if (panel === "gmail") state.gmail = trim(status, 40) || "gated";
    if (panel === "calendar") state.calendar = trim(status, 40) || "gated";
    renderSummary();
  }

  function setLastError(code) {
    state.lastError = trim(code, 120);
    renderSummary();
  }

  function applyWriteHide() {
    document.querySelectorAll("[data-readonly-hide]").forEach((el) => {
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
    });
  }

  function panelStatusLabel(key) {
    const v = state[key];
    if (v === "ready") return "ready";
    if (v === "loading") return "loading…";
    if (v === "empty") return "ready（0件）";
    if (v === "error") return "error";
    return "gated";
  }

  function modeLabel() {
    if (!state.connected) return "OFFLINE";
    return state.mock ? "MOCK" : "LIVE";
  }

  function connectionLabel() {
    if (!state.connected) return "未接続";
    return state.mock ? "接続済み（mock）" : "接続済み";
  }

  function renderSummary() {
    const host = $("[data-ops-secretary-google-readonly-summary]");
    if (!host) return;

    const conn = $("[data-ops-secretary-readonly-summary-connection]", host);
    const mode = $("[data-ops-secretary-readonly-summary-mode]", host);
    const gmail = $("[data-ops-secretary-readonly-summary-gmail]", host);
    const cal = $("[data-ops-secretary-readonly-summary-calendar]", host);
    const err = $("[data-ops-secretary-readonly-summary-error]", host);

    if (conn) conn.textContent = connectionLabel();
    if (mode) {
      mode.textContent = modeLabel();
      mode.dataset.mode = modeLabel();
    }
    if (gmail) gmail.textContent = panelStatusLabel("gmail");
    if (cal) cal.textContent = panelStatusLabel("calendar");

    if (err) {
      if (state.lastError && state.connected) {
        err.hidden = false;
        err.textContent = `読込エラー: ${state.lastError}`;
      } else {
        err.hidden = true;
        err.textContent = "";
      }
    }

    host.dataset.connected = state.connected ? "1" : "0";
    host.dataset.mock = state.mock ? "1" : "0";
  }

  function dispatchConnectionChanged(detail) {
    try {
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: detail || {} }));
    } catch {
      /* ignore */
    }
  }

  function applyConnectionState(patch) {
    patch = patch || {};
    const prevConnected = state.connected;
    state.connected = Boolean(patch.connected);
    state.mock = Boolean(patch.mock);
    state.configured = Boolean(patch.configured);
    if (!state.connected) {
      state.gmail = "gated";
      state.calendar = "gated";
      state.lastError = "";
    }
    applyWriteHide();
    renderSummary();

    if (!state.connected) {
      global.TasuSecretaryGoogleGmailUI?.showGated?.();
      global.TasuSecretaryGoogleCalendarUI?.showGated?.();
      return;
    }

    if (state.connected && (!prevConnected || patch.forceRefresh)) {
      void refreshPanels();
    }
  }

  async function refreshPanels() {
    if (!state.connected) return;
    state.lastError = "";
    state.gmail = "loading";
    state.calendar = "loading";
    renderSummary();

    const gmailUi = global.TasuSecretaryGoogleGmailUI;
    const calUi = global.TasuSecretaryGoogleCalendarUI;

    try {
      if (gmailUi?.refreshDefault) await gmailUi.refreshDefault();
      if (calUi?.refreshDefault) await calUi.refreshDefault();
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    }
    renderSummary();
  }

  async function syncConnection(options) {
    options = options || {};
    const Client = global.TasuSecretaryGoogleOAuthClient;
    if (!Client?.fetchStatus) {
      applyConnectionState({ connected: false, mock: false, configured: false, forceRefresh: options.forceRefresh });
      dispatchConnectionChanged({ connected: false, source: "sync" });
      return getState();
    }
    const status = await Client.fetchStatus();
    applyConnectionState({
      connected: Boolean(status.connected),
      mock: Boolean(status.mock),
      configured: Boolean(status.configured),
      forceRefresh: options.forceRefresh,
    });
    dispatchConnectionChanged({
      connected: state.connected,
      mock: state.mock,
      configured: state.configured,
      source: "sync",
    });
    return getState();
  }

  function onConnectionChanged(ev) {
    const detail = ev?.detail || {};
    applyConnectionState({
      connected: Boolean(detail.connected),
      mock: Boolean(detail.mock),
      configured: Boolean(detail.configured),
      forceRefresh: true,
    });
  }

  function mount() {
    if (mounted) return;
    mounted = true;
    applyWriteHide();
    renderSummary();
    global.addEventListener(EVENT_NAME, onConnectionChanged);
  }

  global.TasuSecretaryGoogleReadonlyCoordinator = {
    EVENT_NAME,
    mount,
    syncConnection,
    refreshPanels,
    applyConnectionState,
    applyWriteHide,
    isConnected,
    isReadOnlyMode,
    getState,
    setPanelStatus,
    setLastError,
    dispatchConnectionChanged,
  };
})(typeof window !== "undefined" ? window : globalThis);
