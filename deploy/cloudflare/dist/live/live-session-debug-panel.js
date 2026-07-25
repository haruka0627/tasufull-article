/**
 * TLV Live — Session Debug Panel（Phase2-04 · 開発確認用）
 * flag OFF 時は DOM 追加なし · ZEGO / Provider / Payment 非接触
 */
(function (global) {
  "use strict";

  /** @private @type {HTMLElement|null} */
  let _panelEl = null;
  /** @private @type {Function|null} */
  let _boundRefresh = null;

  function bridge() {
    return global.TlvLiveBroadcastsSessionBridge;
  }

  function isEnabled() {
    return bridge()?.isEnabled?.() === true;
  }

  /** @private */
  function formatEvent(entry) {
    if (!entry) return "—";
    const payload = entry.payload && typeof entry.payload === "object" ? entry.payload : {};
    const room = payload.roomId || payload.sessionId || "";
    const code = payload.code ? ` · ${payload.code}` : "";
    return `${entry.event}${code}${room ? ` · ${room}` : ""}`;
  }

  /** @private */
  function formatStatus(snap) {
    const st = snap.status || {};
    const err = st.lastError;
    if (err) {
      const field = err.field ? ` · ${err.field}` : "";
      return `${err.code || "ERROR"}${field} · recoverable=${err.recoverable}`;
    }
    const sig = st.lastProviderSignal;
    if (sig) return sig.signal;
    return "—";
  }

  /** @private */
  function renderPanel(page) {
    const snap = bridge()?.getSnapshot?.() || {};
    const session = snap.session || {};
    const status = snap.status || {};
    const recent = Array.isArray(snap.recentEvents) ? snap.recentEvents : [];
    const recentHtml = recent.length
      ? recent
          .slice()
          .reverse()
          .map((e) => `<li>${formatEvent(e)}</li>`)
          .join("")
      : "<li>—</li>";

    return `
      <aside class="live-session-debug" data-live-session-debug aria-label="Session debug (dev)">
        <header class="live-session-debug__head">
          <strong>Session Debug</strong>
          <span class="live-session-debug__badge">dev · ${page || "live"}</span>
        </header>
        <dl class="live-session-debug__grid">
          <div><dt>State</dt><dd data-live-session-debug-state>${snap.state || "IDLE"}</dd></div>
          <div><dt>Room</dt><dd data-live-session-debug-room>${session.roomId || "—"}</dd></div>
          <div><dt>Role</dt><dd data-live-session-debug-role>${session.role || "—"}</dd></div>
          <div><dt>Last Event</dt><dd data-live-session-debug-event>${formatEvent(snap.lastEvent)}</dd></div>
          <div><dt>Reconnect #</dt><dd data-live-session-debug-reconnect>${status.reconnectAttempt ?? 0}</dd></div>
          <div><dt>Error / Signal</dt><dd data-live-session-debug-status>${formatStatus(snap)}</dd></div>
          <div><dt>Error Code</dt><dd data-live-session-debug-error-code>${status.lastError?.code || "—"}</dd></div>
        </dl>
        <p class="live-session-debug__label">Recent</p>
        <ul class="live-session-debug__events" data-live-session-debug-recent>${recentHtml}</ul>
      </aside>
    `;
  }

  function refresh() {
    if (!isEnabled() || !_panelEl) return;
    const snap = bridge()?.getSnapshot?.() || {};
    const session = snap.session || {};
    const status = snap.status || {};
    const set = (sel, text) => {
      const el = _panelEl.querySelector(sel);
      if (el) el.textContent = text;
    };
    set("[data-live-session-debug-state]", snap.state || "IDLE");
    set("[data-live-session-debug-room]", session.roomId || "—");
    set("[data-live-session-debug-role]", session.role || "—");
    set("[data-live-session-debug-event]", formatEvent(snap.lastEvent));
    set("[data-live-session-debug-reconnect]", String(status.reconnectAttempt ?? 0));
    set("[data-live-session-debug-status]", formatStatus(snap));
    set("[data-live-session-debug-error-code]", status.lastError?.code || "—");
    const recentEl = _panelEl.querySelector("[data-live-session-debug-recent]");
    if (recentEl) {
      const recent = Array.isArray(snap.recentEvents) ? snap.recentEvents : [];
      recentEl.innerHTML = recent.length
        ? recent
            .slice()
            .reverse()
            .map((e) => `<li>${formatEvent(e)}</li>`)
            .join("")
        : "<li>—</li>";
    }
  }

  /**
   * @param {{ page?: string, anchor?: HTMLElement }} [options]
   * @returns {HTMLElement|null}
   */
  function mount(options = {}) {
    if (!isEnabled()) return null;
    if (_panelEl?.isConnected) {
      refresh();
      return _panelEl;
    }

    const anchor = options.anchor || document.body;
    if (!anchor) return null;

    const wrap = document.createElement("div");
    wrap.innerHTML = renderPanel(options.page || "live");
    const panel = wrap.firstElementChild;
    if (!panel) return null;

    anchor.appendChild(panel);
    _panelEl = panel;

    const b = bridge();
    if (b?.onSessionEvent && global.LIVE_SESSION_EVENTS) {
      _boundRefresh = () => refresh();
      const E = global.LIVE_SESSION_EVENTS;
      b.onSessionEvent(E.STATE_CHANGED, _boundRefresh);
      b.onSessionEvent(E.RECONNECTING, _boundRefresh);
      b.onSessionEvent(E.RECONNECTED, _boundRefresh);
      b.onSessionEvent(E.ERROR, _boundRefresh);
    }

    refresh();
    return _panelEl;
  }

  function unmount() {
    const b = bridge();
    if (b?.offSessionEvent && _boundRefresh && global.LIVE_SESSION_EVENTS) {
      const E = global.LIVE_SESSION_EVENTS;
      b.offSessionEvent(E.STATE_CHANGED, _boundRefresh);
      b.offSessionEvent(E.RECONNECTING, _boundRefresh);
      b.offSessionEvent(E.RECONNECTED, _boundRefresh);
      b.offSessionEvent(E.ERROR, _boundRefresh);
    }
    _boundRefresh = null;
    _panelEl?.remove();
    _panelEl = null;
  }

  global.TlvLiveSessionDebugPanel = Object.freeze({
    isEnabled,
    mount,
    refresh,
    unmount,
  });
})(typeof window !== "undefined" ? window : globalThis);
