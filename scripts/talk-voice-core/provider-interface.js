/**
 * TASFUL talk-voice-core — VoiceProviderAdapter interface (contract)
 */
(function (global) {
  "use strict";

  /**
   * Documented adapter surface. Concrete adapters must implement these methods.
   * @typedef {object} VoiceProviderAdapter
   * @property {(context?: object) => Promise<{ok:boolean,error?:string}>| {ok:boolean}} initialize
   * @property {(params: object) => Promise<object>} createOutgoingConnection
   * @property {(params: object) => Promise<object>} acceptIncomingConnection
   * @property {(params: object) => Promise<void>} applyRemoteDescription
   * @property {(params: object) => Promise<void>} addIceCandidate
   * @property {(value: boolean) => void} setMuted
   * @property {() => string|null} getConnectionState
   * @property {(reason?: string) => Promise<void>|void} disconnect
   * @property {() => Promise<void>|void} dispose
   */

  const REQUIRED_METHODS = Object.freeze([
    "initialize",
    "createOutgoingConnection",
    "acceptIncomingConnection",
    "applyRemoteDescription",
    "addIceCandidate",
    "setMuted",
    "getConnectionState",
    "disconnect",
    "dispose",
  ]);

  function assertAdapter(adapter) {
    if (!adapter || typeof adapter !== "object") {
      return { ok: false, missing: REQUIRED_METHODS.slice() };
    }
    const missing = REQUIRED_METHODS.filter((m) => typeof adapter[m] !== "function");
    return { ok: missing.length === 0, missing };
  }

  global.TasuTalkVoiceProviderInterface = {
    REQUIRED_METHODS,
    assertAdapter,
  };
})(typeof window !== "undefined" ? window : globalThis);
