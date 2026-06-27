/**
 * AI秘書 Phase 6-B — Google 接続状態 UI（最小）
 */
(function (global) {
  "use strict";

  let mounted = false;

  function $(root, sel) {
    return (root || document).querySelector(sel);
  }

  function setLabel(el, connected, email, mock) {
    if (!el) return;
    if (connected) {
      const who = email ? ` (${email})` : "";
      el.textContent = mock ? `Google接続済み（mock）${who}` : `Google接続済み${who}`;
    } else {
      el.textContent = "Google未接続";
    }
  }

  async function refreshUi(root) {
    const Client = global.TasuSecretaryGoogleOAuthClient;
    const label = $(root, "[data-ops-secretary-google-status-label]");
    const connectBtn = $(root, "[data-ops-secretary-google-connect-btn]");
    const disconnectBtn = $(root, "[data-ops-secretary-google-disconnect-btn]");
    if (!Client?.fetchStatus) return;

    const status = await Client.fetchStatus();
    const connected = Boolean(status.connected);
    setLabel(label, connected, status.googleAccountEmail, status.mock);
    if (connectBtn) connectBtn.hidden = connected;
    if (disconnectBtn) disconnectBtn.hidden = !connected;
    root.dataset.state = connected ? "connected" : "disconnected";
    root.dataset.mock = status.mock ? "1" : "0";
  }

  async function onConnect(root) {
    const Client = global.TasuSecretaryGoogleOAuthClient;
    if (!Client?.startConnect) return;
    const connectBtn = $(root, "[data-ops-secretary-google-connect-btn]");
    if (connectBtn) connectBtn.disabled = true;
    try {
      const result = await Client.startConnect();
      if (result.redirect && result.authUrl) {
        global.location.href = result.authUrl;
        return;
      }
      if (result.ok) {
        await refreshUi(root);
        return;
      }
      const msg = String(result.error || "connect_failed");
      const label = $(root, "[data-ops-secretary-google-status-label]");
      if (label) label.textContent = `Google接続エラー: ${msg.slice(0, 80)}`;
    } finally {
      if (connectBtn) connectBtn.disabled = false;
    }
  }

  async function onDisconnect(root) {
    const Client = global.TasuSecretaryGoogleOAuthClient;
    if (!Client?.disconnect) return;
    const disconnectBtn = $(root, "[data-ops-secretary-google-disconnect-btn]");
    if (disconnectBtn) disconnectBtn.disabled = true;
    try {
      await Client.disconnect();
      await refreshUi(root);
    } finally {
      if (disconnectBtn) disconnectBtn.disabled = false;
    }
  }

  function mount(root) {
    root = root || document.querySelector("[data-ops-secretary-google-connect]");
    if (!root || mounted) return;
    mounted = true;

    const connectBtn = $(root, "[data-ops-secretary-google-connect-btn]");
    const disconnectBtn = $(root, "[data-ops-secretary-google-disconnect-btn]");
    connectBtn?.addEventListener("click", () => onConnect(root));
    disconnectBtn?.addEventListener("click", () => onDisconnect(root));

    const params = new URLSearchParams(global.location?.search || "");
    if (params.get("google_oauth") === "success") {
      params.delete("google_oauth");
      const next = `${global.location.pathname}${params.toString() ? `?${params}` : ""}${global.location.hash || ""}`;
      global.history?.replaceState?.({}, "", next);
    }

    refreshUi(root);
  }

  global.TasuSecretaryGoogleConnectUI = { mount, refreshUi };
})(typeof window !== "undefined" ? window : globalThis);
