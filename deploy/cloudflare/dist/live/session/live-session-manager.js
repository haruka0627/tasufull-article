/**
 * TLV Live Session Manager — 状態管理 Skeleton（SDK 非依存）
 * Phase2-01 · Live Service / Provider / UI 未接続
 *
 * Future hooks（実装禁止 · Event 監視のみ将来接続）:
 *   TODO-FUTURE: Wallet — LIVE_ENDED 等
 *   TODO-FUTURE: Coin — Payment Engine 正本 · Manager 非経由
 *   TODO-FUTURE: Tip — LIVE_STARTED + tip UI · Session Manager 非経由
 *   TODO-FUTURE: Membership — LIVE_JOINED gate
 *   TODO-FUTURE: Ranking — LIVE_ENDED 集計
 *   TODO-FUTURE: Creator Score — LIVE_ENDED batch
 *   TODO-FUTURE: Moderation — LIVE_STARTED / chat Event
 *   TODO-FUTURE: AI Clip — LIVE_ENDED
 *   TODO-FUTURE: AI Subtitle — LIVE_STARTED
 *   TODO-FUTURE: AI Translation — chat 連携 Future
 */
(function (global) {
  "use strict";

  const STATES = global.LIVE_SESSION_STATES || global.TlvLiveSessionStates;
  const EVENTS = global.LIVE_SESSION_EVENTS || global.TlvLiveSessionEvents;
  const EventBus = global.TlvLiveSessionEventBus;
  const V = () => global.TlvLiveSessionValidation;
  const EC = () => global.LIVE_SESSION_ERROR_CODES || global.TlvLiveSessionErrorCodes;

  if (!STATES || !EVENTS || !EventBus) {
    throw new Error(
      "TlvLiveSessionManager: load live-session-states.js, live-session-events.js, live-session-event-bus.js first"
    );
  }

  class TlvLiveSessionManager {
    constructor() {
      /** @private */
      this._bus = new EventBus();
      /** @private */
      this._state = STATES.IDLE;
      /** @private @type {{ id: string, roomId: string, role: 'host'|'viewer'|null, createdAt: string } | null} */
      this._session = null;
      /** @private */
      this._disposed = false;
      /** @private @type {'host'|'viewer'|null} */
      this._role = null;
      /** @private @type {string|null} */
      this._resumeState = null;
      /** @private */
      this._reconnectAttempt = 0;
      /** @private @type {{ code: string, message: string, recoverable: boolean, at: string }|null} */
      this._lastError = null;
      /** @private @type {{ signal: string, payload: unknown, at: string }|null} */
      this._lastProviderSignal = null;
    }

    /** @returns {{ reconnectAttempt: number, lastError: object|null, lastProviderSignal: object|null, resumeState: string|null }} */
    getStatus() {
      return {
        reconnectAttempt: this._reconnectAttempt,
        lastError: this._lastError ? { ...this._lastError } : null,
        lastProviderSignal: this._lastProviderSignal ? { ...this._lastProviderSignal } : null,
        resumeState: this._resumeState,
      };
    }

    /** @returns {string} */
    get state() {
      return this._state;
    }

    /** @returns {{ id: string, roomId: string, role: 'host'|'viewer'|null, createdAt: string } | null} */
    get session() {
      if (!this._session) return null;
      return { ...this._session };
    }

    /**
     * @param {string} event
     * @param {Function} handler
     */
    on(event, handler) {
      if (typeof handler !== "function") return this;
      const val = V()?.validateEventName(event);
      if (val && !val.ok) {
        this._validationFail(val);
        return this;
      }
      this._bus.on(val?.value || String(event || "").trim(), handler);
      return this;
    }

    /**
     * @param {string} event
     * @param {Function} handler
     */
    off(event, handler) {
      if (typeof handler !== "function") return this;
      const val = V()?.validateEventName(event);
      if (val && !val.ok) return this;
      this._bus.off(val?.value || String(event || "").trim(), handler);
      return this;
    }

    /**
     * @param {string} event
     * @param {Function} handler
     */
    once(event, handler) {
      if (typeof handler !== "function") return this;
      const val = V()?.validateEventName(event);
      if (val && !val.ok) {
        this._validationFail(val);
        return this;
      }
      this._bus.once(val?.value || String(event || "").trim(), handler);
      return this;
    }

    /**
     * @param {{ roomId?: string, sessionId?: string, role?: 'host'|'viewer' }} [options]
     * @returns {Promise<{ ok: boolean, state: string, session?: object, error?: string, code?: string }>}
     */
    async createSession(options = {}) {
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (this._state !== STATES.IDLE) {
        return this._stateFail(`createSession は ${STATES.IDLE} のみ可能です（現在: ${this._state}）`);
      }

      let roomId = `room-${Date.now()}`;
      let role = null;
      let id = `sess-${Date.now()}`;

      if (V()) {
        if (options.roomId != null && String(options.roomId).trim()) {
          const vr = V().validateRoomId(options.roomId, { required: true });
          if (!vr.ok) return this._validationFail(vr);
          roomId = vr.value;
        }
        const rr = V().validateRole(options.role);
        if (!rr.ok) return this._validationFail(rr);
        role = rr.value;
        if (options.sessionId != null && String(options.sessionId).trim()) {
          const sr = V().validateSessionId(options.sessionId);
          if (!sr.ok) return this._validationFail(sr);
          id = sr.value;
        }
      } else {
        roomId = String(options.roomId || "").trim() || roomId;
        role = options.role === "host" || options.role === "viewer" ? options.role : null;
        id = String(options.sessionId || "").trim() || id;
      }

      this._transition(STATES.INITIALIZING);

      this._session = {
        id,
        roomId,
        role,
        createdAt: new Date().toISOString(),
      };
      this._role = role;

      this._transition(STATES.READY);
      this._bus.emit(EVENTS.LIVE_CREATED, {
        sessionId: id,
        roomId,
        hostUserId: role === "host" ? null : undefined,
        role,
        createdAt: this._session.createdAt,
      });

      return { ok: true, state: this._state, session: this.session };
    }

    /**
     * @returns {Promise<{ ok: boolean, state: string, error?: string }>}
     */
    async destroySession() {
      if (this._disposed) return { ok: true, state: STATES.IDLE };
      if (this._state === STATES.IDLE) return { ok: true, state: STATES.IDLE };

      this._session = null;
      this._role = null;
      this._resumeState = null;
      this._reconnectAttempt = 0;
      this._transition(STATES.IDLE);
      return { ok: true, state: this._state };
    }

    /**
     * Host: READY → STARTING → LIVE
     * @returns {Promise<{ ok: boolean, state: string, error?: string }>}
     */
    async start() {
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (!this._session) return this._stateFail("session がありません");
      if (this._state !== STATES.READY) {
        return this._stateFail(`start は ${STATES.READY} のみ可能です（現在: ${this._state}）`);
      }

      this._role = "host";
      this._session.role = "host";
      const { roomId } = this._session;

      this._transition(STATES.STARTING);
      this._transition(STATES.LIVE);

      const startedAt = new Date().toISOString();
      this._bus.emit(EVENTS.LIVE_STARTED, { roomId, hostUserId: null, startedAt });
      this._bus.emit(EVENTS.HOST_CONNECTED, { roomId, userId: null });

      return { ok: true, state: this._state };
    }

    /**
     * Viewer: READY → JOINING → CONNECTED
     * @returns {Promise<{ ok: boolean, state: string, error?: string }>}
     */
    async join() {
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (!this._session) return this._stateFail("session がありません");
      if (this._state !== STATES.READY) {
        return this._stateFail(`join は ${STATES.READY} のみ可能です（現在: ${this._state}）`);
      }

      this._role = "viewer";
      this._session.role = "viewer";
      const { roomId } = this._session;

      this._transition(STATES.JOINING);
      this._transition(STATES.CONNECTED);

      const joinedAt = new Date().toISOString();
      this._bus.emit(EVENTS.LIVE_JOINED, { roomId, viewerUserId: null, joinedAt });
      this._bus.emit(EVENTS.VIEWER_CONNECTED, { roomId, userId: null });

      return { ok: true, state: this._state };
    }

    /**
     * LIVE or CONNECTED → LEAVING → ENDED (host) or READY (viewer)
     * @returns {Promise<{ ok: boolean, state: string, error?: string }>}
     */
    async leave() {
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (!this._session) return this._stateFail("session がありません");

      const allowed = [STATES.LIVE, STATES.CONNECTED, STATES.RECONNECTED, STATES.RECONNECTING];
      if (!allowed.includes(this._state)) {
        return this._stateFail(`leave は ${allowed.join("|")} のみ可能です（現在: ${this._state}）`);
      }

      const { roomId } = this._session;
      const role = this._role;
      this._transition(STATES.LEAVING);
      this._bus.emit(EVENTS.LIVE_LEFT, { roomId, userId: null, role, reason: "user" });

      if (role === "host") {
        this._transition(STATES.ENDED);
      } else {
        this._transition(STATES.READY);
      }

      return { ok: true, state: this._state };
    }

    /**
     * Host: LIVE → LEAVING → ENDED
     * @returns {Promise<{ ok: boolean, state: string, error?: string }>}
     */
    async end() {
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (!this._session) return this._stateFail("session がありません");
      if (this._role !== "host") {
        const code = EC()?.PERMISSION_ERROR || "PERMISSION_ERROR";
        return { ok: false, state: this._state, error: "end は host のみ可能です", code };
      }
      if (this._state !== STATES.LIVE && this._state !== STATES.RECONNECTED) {
        return this._stateFail(`end は ${STATES.LIVE} のみ可能です（現在: ${this._state}）`);
      }

      const { roomId } = this._session;
      this._transition(STATES.LEAVING);
      this._bus.emit(EVENTS.LIVE_LEFT, { roomId, userId: null, role: "host", reason: "host_end" });
      this._transition(STATES.ENDED);
      this._bus.emit(EVENTS.LIVE_ENDED, {
        roomId,
        endedAt: new Date().toISOString(),
        reason: "host",
      });

      return { ok: true, state: this._state };
    }

    /**
     * Provider 抽象 signal 受信（Phase2-05 · SDK 非露出）
     * @param {string} signal
     * @param {{ message?: string, code?: string, recoverable?: boolean, userId?: string, reason?: string }} [payload]
     */
    async handleProviderSignal(signal, payload = {}) {
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (!this._session) return this._stateFail("session がありません");

      const SIG = global.LIVE_PROVIDER_SIGNALS || global.TlvLiveProviderSignals;
      let sig = String(signal || "").trim();
      if (V()) {
        const sv = V().validateProviderSignal(sig, SIG);
        if (!sv.ok) return this._validationFail(sv);
        sig = sv.value;
        if (payload?.userId != null && String(payload.userId).trim()) {
          const uv = V().validateUserId(payload.userId);
          if (!uv.ok) return this._validationFail(uv);
        }
      } else if (!SIG || !Object.values(SIG).includes(sig)) {
        return this._validationFail({
          ok: false,
          code: EC()?.VALIDATION_ERROR || "VALIDATION_ERROR",
          message: `未知の Provider signal: ${sig}`,
          field: "providerSignal",
        });
      }

      this._lastProviderSignal = { signal: sig, payload, at: new Date().toISOString() };
      const { roomId } = this._session;
      const CODES = EC();

      switch (sig) {
        case SIG.PROVIDER_CONNECTING:
          return { ok: true, state: this._state, signal: sig };

        case SIG.PROVIDER_CONNECTED: {
          if (payload?.userId != null && V()) {
            const uv = V().validateUserId(payload.userId);
            if (!uv.ok) return this._validationFail(uv);
          }
          if (this._state === STATES.STARTING) {
            this._transition(STATES.LIVE);
            this._bus.emit(EVENTS.HOST_CONNECTED, { roomId, userId: payload.userId ?? null });
          } else if (this._state === STATES.JOINING) {
            this._transition(STATES.CONNECTED);
            this._bus.emit(EVENTS.VIEWER_CONNECTED, { roomId, userId: payload.userId ?? null });
          }
          return { ok: true, state: this._state, signal: sig };
        }

        case SIG.PROVIDER_DISCONNECTED:
          this._captureResumeState();
          if ([STATES.LIVE, STATES.CONNECTED, STATES.RECONNECTED].includes(this._state)) {
            return this._enterReconnecting(payload, "disconnected");
          }
          return { ok: true, state: this._state, signal: sig, skipped: true };

        case SIG.PROVIDER_RECONNECTING:
        case SIG.PROVIDER_CONNECTION_LOST:
          this._captureResumeState();
          return this._enterReconnecting(
            payload,
            sig === SIG.PROVIDER_CONNECTION_LOST ? "connection_lost" : "reconnecting"
          );

        case SIG.PROVIDER_RECONNECTED:
          return this._completeReconnect(payload);

        case SIG.PROVIDER_ERROR: {
          if (V()) {
            const ep = V().validateErrorPayload({
              message: payload.message || payload.code || "Provider error",
              code: CODES?.PROVIDER_ERROR || "PROVIDER_ERROR",
              recoverable: payload.recoverable,
            });
            if (!ep.ok) return this._validationFail(ep);
            return this._setError(ep.value.message, ep.value.recoverable, ep.value.code);
          }
          return this._setError(
            String(payload.message || payload.code || "Provider error"),
            payload.recoverable !== false,
            CODES?.PROVIDER_ERROR || "PROVIDER_ERROR"
          );
        }

        default:
          return { ok: true, state: this._state, signal: sig };
      }
    }

    /**
     * @param {{ message?: string, code?: string, recoverable?: boolean }} [options]
     */
    async reportError(options = {}) {
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (!this._session) return this._stateFail("session がありません");
      if (V()) {
        const ep = V().validateErrorPayload(options);
        if (!ep.ok) return this._validationFail(ep);
        const code = V().normalizeErrorCode(ep.value.code);
        return this._setError(ep.value.message, ep.value.recoverable, code);
      }
      return this._setError(
        String(options.message || "error"),
        options.recoverable !== false,
        String(options.code || EC()?.UNKNOWN_ERROR || "UNKNOWN_ERROR")
      );
    }

    /**
     * ERROR（recoverable）→ reconnect 試行
     */
    async recoverFromError() {
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (this._state !== STATES.ERROR) {
        return this._stateFail(`recoverFromError は ${STATES.ERROR} のみ可能です（現在: ${this._state}）`);
      }
      if (this._lastError && this._lastError.recoverable === false) {
        return this._stateFail("recover 不可（非 recoverable）");
      }
      return this.reconnect();
    }

    /**
     * LIVE | CONNECTED | ERROR → RECONNECTING → RECONNECTED → resume
     * @returns {Promise<{ ok: boolean, state: string, error?: string }>}
     */
    async reconnect() {
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (!this._session) return this._stateFail("session がありません");

      const allowed = [STATES.LIVE, STATES.CONNECTED, STATES.ERROR, STATES.RECONNECTED];
      if (!allowed.includes(this._state)) {
        return this._stateFail(`reconnect は ${allowed.join("|")} のみ可能です（現在: ${this._state}）`);
      }

      if (this._state === STATES.RECONNECTING) {
        return this._completeReconnect({});
      }

      this._captureResumeState();
      const enter = this._enterReconnecting({}, "manual");
      if (!enter.ok) return enter;
      return this._completeReconnect({});
    }

    /** @private */
    _captureResumeState() {
      if ([STATES.LIVE, STATES.CONNECTED, STATES.RECONNECTED].includes(this._state)) {
        this._resumeState = this._state;
      } else if (!this._resumeState) {
        this._resumeState = this._role === "host" ? STATES.LIVE : STATES.CONNECTED;
      }
    }

    /** @private */
    _enterReconnecting(payload, reason) {
      const { roomId } = this._session;
      if (this._state === STATES.RECONNECTING) {
        this._reconnectAttempt += 1;
        this._bus.emit(EVENTS.RECONNECTING, {
          roomId,
          userId: payload.userId ?? null,
          attempt: this._reconnectAttempt,
          reason,
        });
        return { ok: true, state: this._state };
      }

      const allowed = [STATES.LIVE, STATES.CONNECTED, STATES.RECONNECTED, STATES.ERROR];
      if (!allowed.includes(this._state)) {
        return this._stateFail(`RECONNECTING 不可（現在: ${this._state}）`);
      }

      this._reconnectAttempt += 1;
      this._transition(STATES.RECONNECTING);
      this._bus.emit(EVENTS.RECONNECTING, {
        roomId,
        userId: payload.userId ?? null,
        attempt: this._reconnectAttempt,
        reason: reason || "connection_lost",
      });
      return { ok: true, state: this._state };
    }

    /** @private */
    _completeReconnect(payload) {
      if (this._state !== STATES.RECONNECTING && this._state !== STATES.ERROR) {
        return this._stateFail(`RECONNECTED 不可（現在: ${this._state}）`);
      }
      if (this._state === STATES.ERROR && this._lastError?.recoverable === false) {
        return this._stateFail("RECONNECTED 不可（非 recoverable ERROR）");
      }

      const { roomId } = this._session;
      this._transition(STATES.RECONNECTED);
      this._bus.emit(EVENTS.RECONNECTED, { roomId, userId: payload.userId ?? null });
      this._lastError = null;

      const target =
        this._resumeState === STATES.LIVE || this._resumeState === STATES.CONNECTED
          ? this._resumeState
          : this._role === "host"
            ? STATES.LIVE
            : STATES.CONNECTED;
      this._transition(target);
      return { ok: true, state: this._state };
    }

    /**
     * ENDED | ERROR → READY（session 保持）
     * @returns {Promise<{ ok: boolean, state: string, error?: string }>}
     */
    async reset() {
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (this._state === STATES.IDLE) return { ok: true, state: STATES.IDLE };

      const allowed = [STATES.ENDED, STATES.ERROR, STATES.READY, STATES.RECONNECTED];
      if (!allowed.includes(this._state)) {
        return this._stateFail(`reset は ${STATES.ENDED}|${STATES.ERROR} 等のみ可能です（現在: ${this._state}）`);
      }

      this._reconnectAttempt = 0;
      this._lastError = null;
      this._lastProviderSignal = null;
      this._resumeState = null;
      this._role = this._session?.role || null;
      this._transition(STATES.READY);
      return { ok: true, state: this._state };
    }

    /**
     * 全リスナー解除 · IDLE へ
     * @returns {Promise<{ ok: boolean, state: string }>}
     */
    async dispose() {
      this._disposed = true;
      this._session = null;
      this._role = null;
      this._resumeState = null;
      this._reconnectAttempt = 0;
      this._lastError = null;
      this._lastProviderSignal = null;
      this._bus.clear();
      this._state = STATES.IDLE;
      return { ok: true, state: STATES.IDLE };
    }

    /** @private */
    _transition(next) {
      const from = this._state;
      if (from === next) return;
      this._state = next;
      this._bus.emit(EVENTS.STATE_CHANGED, { from, to: next, sessionId: this._session?.id, roomId: this._session?.roomId });
    }

    /** @private */
    _stateFail(message) {
      const code = EC()?.SESSION_STATE_ERROR || "SESSION_STATE_ERROR";
      return { ok: false, state: this._state, error: String(message || "unknown"), code };
    }

    /** @private @param {{ ok: false, code?: string, message: string, field?: string }} vr */
    _validationFail(vr) {
      const code = vr.code || EC()?.VALIDATION_ERROR || "VALIDATION_ERROR";
      const message = String(vr.message || "validation failed");
      this._lastError = {
        code,
        message,
        recoverable: true,
        field: vr.field || "",
        at: new Date().toISOString(),
      };
      this._bus.emit(EVENTS.ERROR, {
        roomId: this._session?.roomId,
        code,
        message,
        field: vr.field,
        recoverable: true,
      });
      if (this._session && ![STATES.IDLE, STATES.INITIALIZING].includes(this._state)) {
        this._captureResumeState();
        this._transition(STATES.ERROR);
      }
      return { ok: false, state: this._state, error: message, code, recoverable: true };
    }

    /** @private @deprecated alias */
    _reject(message) {
      return this._stateFail(message);
    }

    /** @private */
    _setError(message, recoverable = false, code) {
      const CODES = EC();
      const normalized = V()?.normalizeErrorCode(code) || code || CODES?.UNKNOWN_ERROR || "UNKNOWN_ERROR";
      this._captureResumeState();
      this._lastError = {
        code: normalized,
        message: String(message || "unknown"),
        recoverable: Boolean(recoverable),
        at: new Date().toISOString(),
      };
      this._transition(STATES.ERROR);
      this._bus.emit(EVENTS.ERROR, {
        roomId: this._session?.roomId,
        code: this._lastError.code,
        message: this._lastError.message,
        recoverable: this._lastError.recoverable,
      });
      return {
        ok: false,
        state: this._state,
        error: this._lastError.message,
        code: this._lastError.code,
        recoverable: this._lastError.recoverable,
      };
    }
  }

  global.TlvLiveSessionManager = TlvLiveSessionManager;
})(typeof window !== "undefined" ? window : globalThis);
