/**
 * AI秘書 Phase 6-B — Google 接続状態 UI（最小）
 */
(function (global) {
  "use strict";

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

  function notifyConnectionChanged(status) {
    const Coordinator = global.TasuSecretaryGoogleReadonlyCoordinator;
    if (Coordinator?.dispatchConnectionChanged) {
      Coordinator.dispatchConnectionChanged({
        connected: Boolean(status?.connected),
        mock: Boolean(status?.mock),
        configured: Boolean(status?.configured),
        source: "connect-ui",
      });
      return;
    }
    try {
      global.dispatchEvent(
        new CustomEvent(Coordinator?.EVENT_NAME || "tasu:secretary-google-connection-changed", {
          detail: {
            connected: Boolean(status?.connected),
            mock: Boolean(status?.mock),
            configured: Boolean(status?.configured),
            source: "connect-ui",
          },
        })
      );
    } catch {
      /* ignore */
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
    notifyConnectionChanged(status);
  }

  function resolveConnectAuthUrl(result) {
    if (!result || typeof result !== "object") return "";
    const direct = String(result.authUrl || "").trim();
    if (direct) return direct;
    const nested = String(result.data?.authUrl || "").trim();
    return nested;
  }

  /** Google は Playwright / WebDriver ブラウザを拒否するため consent へ遷移しない */
  function isAutomationControlledBrowser() {
    try {
      if (global.navigator?.webdriver === true) return true;
      const ua = String(global.navigator?.userAgent || "");
      if (/HeadlessChrome|Playwright/i.test(ua)) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  async function onConnect(root) {
    const Client = global.TasuSecretaryGoogleOAuthClient;
    if (!Client?.startConnect) return;
    const connectBtn = $(root, "[data-ops-secretary-google-connect-btn]");
    const label = $(root, "[data-ops-secretary-google-status-label]");
    if (connectBtn) connectBtn.disabled = true;

    if (Client.getDevUserId && !Client.getDevUserId()) {
      if (label) {
        label.textContent =
          "Google接続エラー: 運営ログイン（Supabase Auth）または secretary 用 UUID が必要です";
      }
      if (connectBtn) connectBtn.disabled = false;
      return;
    }

    let redirecting = false;
    try {
      const result = await Client.startConnect();
      const authUrl = resolveConnectAuthUrl(result);
      if (authUrl) {
        if (isAutomationControlledBrowser()) {
          if (label) {
            label.textContent =
              "Google OAuth: 通常ブラウザで consent を完了してください（自動操作ブラウザは Google に拒否されます）";
          }
          return;
        }
        redirecting = true;
        global.location.assign(authUrl);
        return;
      }
      if (result?.ok) {
        await refreshUi(root);
        return;
      }
      const msg = String(result?.error || "connect_failed");
      if (label) label.textContent = `Google接続エラー: ${msg.slice(0, 80)}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (label) label.textContent = `Google接続エラー: ${msg.slice(0, 80)}`;
    } finally {
      if (connectBtn && !redirecting) connectBtn.disabled = false;
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

  function bindConnectHandlers(root) {
    const connectBtn = $(root, "[data-ops-secretary-google-connect-btn]");
    const disconnectBtn = $(root, "[data-ops-secretary-google-disconnect-btn]");
    if (connectBtn && connectBtn.dataset.opsGoogleConnectBound !== "1") {
      connectBtn.dataset.opsGoogleConnectBound = "1";
      connectBtn.addEventListener("click", () => onConnect(root));
    }
    if (disconnectBtn && disconnectBtn.dataset.opsGoogleDisconnectBound !== "1") {
      disconnectBtn.dataset.opsGoogleDisconnectBound = "1";
      disconnectBtn.addEventListener("click", () => onDisconnect(root));
    }
  }

  function mount(root) {
    root = root || document.querySelector("[data-ops-secretary-google-connect]");
    if (!root) return;

    global.TasuSecretaryGoogleOAuthClient?.clearDevUserIdCache?.();
    global.TasuSecretaryGoogleOAuthClient?.getDevUserId?.();

    bindConnectHandlers(root);

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
