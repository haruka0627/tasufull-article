/**
 * TLV Live — live-broadcasts ↔ Session Manager ブリッジ（Phase2-03 準備）
 * 既定 OFF · ZEGO / Live Service / Provider は未接続（Session 状態のみ）
 * Payment / Wallet / Coin / 投げ銭 / 30分 — 非接触
 */
(function (global) {
  "use strict";

  const STATES = global.LIVE_SESSION_STATES || global.TlvLiveSessionStates;
  const V = () => global.TlvLiveSessionValidation;
  const EC = () => global.LIVE_SESSION_ERROR_CODES || global.TlvLiveSessionErrorCodes;

  /** @returns {boolean} */
  function isEnabled() {
    return global.TLV_FEATURE_FLAGS?.liveSessionManagerEnabled === true;
  }

  /** @private @type {import('./session/live-session-manager.js')|null} */
  let _manager = null;
  /** @private @type {{ event: string, payload: unknown, at: string }|null} */
  let _lastEvent = null;
  /** @private @type {Array<{ event: string, payload: unknown, at: string }>} */
  let _recentEvents = [];
  /** @private @type {Array<{ event: string, handler: Function }>} */
  let _pendingHandlers = [];

  /** @private @param {{ ok: false, code?: string, message: string, field?: string }} vr */
  function _bridgeValidationError(vr) {
    return {
      enabled: true,
      ok: false,
      error: vr.message,
      code: vr.code || EC()?.VALIDATION_ERROR || "VALIDATION_ERROR",
      field: vr.field,
    };
  }

  /**
   * @private
   * @param {object} [payload]
   * @param {{ requireLive?: boolean }} [opts]
   */
  function _validateBroadcastPayload(payload, opts = {}) {
    if (opts.requireLive && String(payload?.status || "").trim() !== "live") {
      return { ok: true, skipped: true, reason: "not_live" };
    }
    if (V()) {
      const room = V().validateRoomId(payload?.broadcastId, { required: true });
      if (!room.ok) return room;
      return { ok: true, roomId: room.value };
    }
    const broadcastId = String(payload?.broadcastId || "").trim();
    if (!broadcastId) {
      return {
        ok: false,
        code: EC()?.VALIDATION_ERROR || "VALIDATION_ERROR",
        message: "broadcastId が必要です",
        field: "broadcastId",
      };
    }
    return { ok: true, roomId: broadcastId };
  }

  /** @private */
  function _recordEvent(name, payload) {
    const entry = { event: name, payload, at: new Date().toISOString() };
    _lastEvent = entry;
    _recentEvents.push(entry);
    if (_recentEvents.length > 8) _recentEvents.shift();
  }

  /** @private */
  function _wireTelemetry(m) {
    const events = global.LIVE_SESSION_EVENTS || global.TlvLiveSessionEvents;
    if (events) {
      for (const name of Object.values(events)) {
        m.on(name, (payload) => _recordEvent(name, payload));
      }
    }
    for (const { event, handler } of _pendingHandlers) {
      m.on(event, handler);
    }
    _pendingHandlers = [];
  }

  /** @private */
  function _ensureManager() {
    if (!isEnabled()) return null;
    const Manager = global.TlvLiveSessionManager;
    if (!Manager) {
      throw new Error("TlvLiveSessionManager が未ロードです");
    }
    if (!_manager) {
      _manager = new Manager();
      _wireTelemetry(_manager);
    }
    return _manager;
  }

  /**
   * @param {string} event
   * @param {Function} handler
   */
  function onSessionEvent(event, handler) {
    if (!isEnabled() || typeof handler !== "function") return;
    if (V()) {
      const ev = V().validateEventName(event);
      if (!ev.ok) return;
      if (_manager) _manager.on(ev.value, handler);
      else _pendingHandlers.push({ event: ev.value, handler });
      return;
    }
    const name = String(event || "").trim();
    if (!name) return;
    if (_manager) _manager.on(name, handler);
    else _pendingHandlers.push({ event: name, handler });
  }

  /**
   * @param {string} event
   * @param {Function} handler
   */
  function offSessionEvent(event, handler) {
    if (typeof handler !== "function") return;
    let name = String(event || "").trim();
    if (V()) {
      const ev = V().validateEventName(event);
      if (!ev.ok) return;
      name = ev.value;
    }
    if (!name) return;
    _pendingHandlers = _pendingHandlers.filter((e) => e.event !== name || e.handler !== handler);
    if (_manager) _manager.off(name, handler);
  }

  /**
   * @param {{ broadcastId: string, creatorId?: string|null }} payload
   * @returns {Promise<{ enabled: boolean, skipped?: boolean, state?: string, error?: string }>}
   */
  async function onStudioStart(payload) {
    if (!isEnabled()) return { enabled: false, skipped: true };
    const validated = _validateBroadcastPayload(payload);
    if (validated.skipped) return { enabled: true, ...validated };
    if (!validated.ok) return _bridgeValidationError(validated);
    const broadcastId = validated.roomId;

    const m = _ensureManager();
    if (m.state === STATES.IDLE || m.session?.roomId !== broadcastId) {
      if (m.state !== STATES.IDLE) await m.destroySession();
      const cr = await m.createSession({ roomId: broadcastId, role: "host" });
      if (!cr.ok) return { enabled: true, error: cr.error, code: cr.code, state: m.state };
    } else if (m.state === STATES.ENDED) {
      await m.reset();
    }

    const sr = await m.start();
    if (!sr.ok) return { enabled: true, error: sr.error, code: sr.code, state: m.state };
    return { enabled: true, state: m.state, session: m.session };
  }

  /**
   * @param {{ broadcastId: string, creatorId?: string|null }} payload
   */
  async function onStudioEnd(payload) {
    if (!isEnabled()) return { enabled: false, skipped: true };
    const validated = _validateBroadcastPayload(payload);
    if (!validated.ok) return _bridgeValidationError(validated);
    const broadcastId = validated.roomId;

    const m = _ensureManager();
    if (m.state === STATES.IDLE) {
      await m.createSession({ roomId: broadcastId, role: "host" });
    }
    if (m.state === STATES.LIVE || m.state === STATES.RECONNECTED) {
      const er = await m.end();
      if (!er.ok) return { enabled: true, error: er.error, code: er.code, state: m.state };
      return { enabled: true, state: m.state };
    }
    if (m.state === STATES.READY || m.state === STATES.CONNECTED) {
      const lr = await m.leave();
      if (!lr.ok) return { enabled: true, error: lr.error, code: lr.code, state: m.state };
      return { enabled: true, state: m.state };
    }
    return { enabled: true, state: m.state, skipped: true };
  }

  /**
   * @param {{ broadcastId: string, viewerId?: string|null, status?: string }} payload
   */
  async function onWatchJoin(payload) {
    if (!isEnabled()) return { enabled: false, skipped: true };
    const validated = _validateBroadcastPayload(payload, { requireLive: true });
    if (validated.skipped) return { enabled: true, ...validated };
    if (!validated.ok) return _bridgeValidationError(validated);
    const broadcastId = validated.roomId;

    const m = _ensureManager();
    if (m.state === STATES.IDLE || m.session?.roomId !== broadcastId) {
      if (m.state !== STATES.IDLE) await m.destroySession();
      const cr = await m.createSession({ roomId: broadcastId, role: "viewer" });
      if (!cr.ok) return { enabled: true, error: cr.error, code: cr.code, state: m.state };
    }

    const jr = await m.join();
    if (!jr.ok) return { enabled: true, error: jr.error, code: jr.code, state: m.state };

    if (!global.__tlvLiveWatchLeaveBound) {
      global.__tlvLiveWatchLeaveBound = true;
      global.addEventListener("beforeunload", () => {
        void onWatchLeave({ broadcastId });
      });
    }

    return { enabled: true, state: m.state, session: m.session };
  }

  /** @param {{ broadcastId?: string }} [payload] */
  async function onWatchLeave(payload) {
    if (!isEnabled()) return { enabled: false, skipped: true };
    const m = _manager;
    if (!m) return { enabled: true, skipped: true };
    const allowed = [STATES.CONNECTED, STATES.RECONNECTED];
    if (!allowed.includes(m.state)) return { enabled: true, skipped: true, state: m.state };
    const lr = await m.leave();
    return { enabled: true, state: m.state, ok: lr.ok, error: lr.error };
  }

  /** @returns {{ enabled: boolean, state: string, session: object|null, lastEvent?: object|null, status?: object|null }} */
  function getSnapshot() {
    if (!isEnabled()) {
      return { enabled: false, state: STATES?.IDLE || "IDLE", session: null };
    }
    const m = _manager;
    if (!m) {
      return { enabled: true, state: STATES?.IDLE || "IDLE", session: null };
    }
    return {
      enabled: true,
      state: m.state,
      session: m.session ? { ...m.session } : null,
      lastEvent: _lastEvent ? { ..._lastEvent } : null,
      recentEvents: _recentEvents.map((e) => ({ ...e })),
      status: typeof m.getStatus === "function" ? m.getStatus() : null,
    };
  }

  /**
   * Provider 抽象 signal 転送（Phase2-05 · flag ON · Provider 本接続なし）
   * @param {string} signal
   * @param {object} [payload]
   */
  async function handleProviderSignal(signal, payload = {}) {
    if (!isEnabled()) return { enabled: false, skipped: true };
    const m = _ensureManager();
    const result = await m.handleProviderSignal(signal, payload);
    return { enabled: true, ...result };
  }

  /** @param {{ message?: string, code?: string, recoverable?: boolean }} [options] */
  async function reportSessionError(options = {}) {
    if (!isEnabled()) return { enabled: false, skipped: true };
    const m = _ensureManager();
    const result = await m.reportError(options);
    return { enabled: true, ...result };
  }

  async function recoverSessionFromError() {
    if (!isEnabled()) return { enabled: false, skipped: true };
    const m = _manager;
    if (!m) return { enabled: true, skipped: true };
    const result = await m.recoverFromError();
    return { enabled: true, ...result };
  }

  async function dispose() {
    if (_manager) {
      await _manager.dispose();
      _manager = null;
    }
    _lastEvent = null;
    _recentEvents = [];
    _pendingHandlers = [];
    return { enabled: isEnabled(), state: STATES?.IDLE || "IDLE" };
  }

  global.TlvLiveBroadcastsSessionBridge = Object.freeze({
    isEnabled,
    onStudioStart,
    onStudioEnd,
    onWatchJoin,
    onWatchLeave,
    getSnapshot,
    onSessionEvent,
    offSessionEvent,
    handleProviderSignal,
    reportSessionError,
    recoverSessionFromError,
    dispose,
  });
})(typeof window !== "undefined" ? window : globalThis);
