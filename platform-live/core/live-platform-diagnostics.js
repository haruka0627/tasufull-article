/**
 * Live Platform — Integration 診断タイムライン
 * Phase 3 · provider / publish / viewer / event timeline
 */
(function (global) {
  "use strict";

  class TasuLivePlatformDiagnostics {
    constructor() {
      /** @private @type {{ kind: string, name: string, payload: unknown, at: string }[]} */
      this._timeline = [];
      /** @private @type {{ signal: string, payload: unknown, at: string }[]} */
      this._providerSignals = [];
      /** @private @type {{ signal: string, payload: unknown, at: string }[]} */
      this._broadcastSignals = [];
      /** @private @type {{ event: string, payload: unknown, at: string }[]} */
      this._viewerEvents = [];
      /** @private @type {{ event: string, payload: unknown, at: string }[]} */
      this._sessionEvents = [];
      /** @private @type {{ phase: string, payload: unknown, at: string }[]} */
      this._edgeSyncEvents = [];
      /** @private @type {{ phase: string, payload: unknown, at: string }[]} */
      this._chatEdgeEvents = [];
    }

    /** @private */
    _push(bucket, kind, name, payload) {
      const entry = { kind, name, payload, at: new Date().toISOString() };
      bucket.push(entry);
      this._timeline.push({ kind, name, payload, at: entry.at });
      return entry;
    }

    recordProviderSignal(signal, payload) {
      return this._push(this._providerSignals, "provider", signal, payload);
    }

    recordBroadcastSignal(signal, payload) {
      return this._push(this._broadcastSignals, "broadcast", signal, payload);
    }

    recordViewerEvent(event, payload) {
      return this._push(this._viewerEvents, "viewer", event, payload);
    }

    recordSessionEvent(event, payload) {
      return this._push(this._sessionEvents, "session", event, payload);
    }

    recordLifecycle(name, payload = {}) {
      return this._push(this._timeline, "lifecycle", name, payload);
    }

    /**
     * @param {"attempted"|"skipped"|"succeeded"|"failed"} phase
     * @param {Record<string, unknown>} [payload]
     */
    recordEdgeSync(phase, payload = {}) {
      return this._push(this._edgeSyncEvents, "edgeSync", phase, payload);
    }

    /**
     * @param {"attempted"|"skipped"|"succeeded"|"failed"} phase
     * @param {Record<string, unknown>} [payload]
     */
    recordChatEdge(phase, payload = {}) {
      return this._push(this._chatEdgeEvents, "chatEdge", phase, payload);
    }

    snapshot(extra = {}) {
      return {
        timeline: this._timeline.slice(),
        providerSignals: this._providerSignals.slice(),
        broadcastSignals: this._broadcastSignals.slice(),
        viewerEvents: this._viewerEvents.slice(),
        sessionEvents: this._sessionEvents.slice(),
        edgeSyncEvents: this._edgeSyncEvents.slice(),
        chatEdgeEvents: this._chatEdgeEvents.slice(),
        ...extra,
      };
    }

    reset() {
      this._timeline = [];
      this._providerSignals = [];
      this._broadcastSignals = [];
      this._viewerEvents = [];
      this._sessionEvents = [];
      this._edgeSyncEvents = [];
      this._chatEdgeEvents = [];
    }
  }

  global.TasuLivePlatformDiagnostics = TasuLivePlatformDiagnostics;
})(typeof window !== "undefined" ? window : globalThis);
