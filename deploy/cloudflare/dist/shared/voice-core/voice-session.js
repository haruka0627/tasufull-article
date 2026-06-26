/**
 * Voice Core — session manager
 */
(function (global) {
  "use strict";

  const { resolveAdapter } = global.TasuVoiceCoreProviderRouter;

  let sessionCounter = 0;

  function createSession(options = {}) {
    const listeners = new Set();
    let active = false;
    let sessionId = null;
    let adapterRef = null;
    let providerRef = null;

    function emit(event) {
      for (const fn of listeners) {
        try {
          fn(event);
        } catch {
          /* listener errors must not break session */
        }
      }
    }

    function receiveEvent(callback) {
      if (typeof callback !== "function") {
        throw new Error("voice_core_invalid_listener");
      }
      listeners.add(callback);
      return () => listeners.delete(callback);
    }

    function startSession(startOptions = {}) {
      if (active) {
        emit({
          type: "error_mock",
          code: "session_already_active",
          message: "call stopSession before starting again",
        });
        return { ok: false, reason: "session_already_active" };
      }

      const merged = { ...options, ...startOptions };
      const resolved = resolveAdapter({
        provider: merged.provider || "mock",
        kind: merged.kind || "mock",
      });
      adapterRef = resolved.adapter;
      providerRef = resolved.provider;

      const started = adapterRef.startSession(merged, emit);
      sessionId = started.sessionId;
      active = true;
      sessionCounter += 1;

      return { ok: true, sessionId, provider: providerRef, adapterId: adapterRef.id };
    }

    function sendAudio(chunk) {
      if (!active || !adapterRef) {
        const err = { type: "error_mock", code: "not_active", message: "no active session" };
        emit(err);
        return err;
      }
      const event = adapterRef.sendAudio(sessionId, chunk);
      emit(event);
      return event;
    }

    function sendText(text) {
      if (!active || !adapterRef) {
        const err = { type: "error_mock", code: "not_active", message: "no active session" };
        emit(err);
        return err;
      }
      const event = adapterRef.sendText(sessionId, text);
      emit(event);
      return event;
    }

    function stopSession() {
      if (!active || !adapterRef) {
        return { ok: false, reason: "not_active" };
      }
      const event = adapterRef.stopSession(sessionId);
      emit(event);
      active = false;
      sessionId = null;
      adapterRef = null;
      providerRef = null;
      return { ok: true, event };
    }

    return {
      get id() {
        return sessionId;
      },
      get active() {
        return active;
      },
      get sessionIndex() {
        return sessionCounter;
      },
      startSession,
      sendAudio,
      sendText,
      receiveEvent,
      stopSession,
    };
  }

  global.TasuVoiceCoreSession = {
    createSession,
  };
})(typeof window !== "undefined" ? window : globalThis);
