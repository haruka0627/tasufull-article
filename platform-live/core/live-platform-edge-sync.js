/**
 * Live Platform — Edge broadcast sync coordinator (P4-1)
 * setLive / clearLive / patchLive · idempotent · failures non-fatal
 * useEdgeSync=false → no-op · Chat/Recording/Monitoring Integration 未接続
 */
(function (global) {
  "use strict";

  const REDACT_KEYS = new Set([
    "token",
    "manualToken",
    "manualtoken",
    "secret",
    "serverSecret",
    "apiKey",
    "password",
    "authorization",
  ]);

  /** @param {Record<string, unknown>} raw */
  function sanitizeContext(raw = {}) {
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
      if (REDACT_KEYS.has(k) || REDACT_KEYS.has(String(k).toLowerCase())) continue;
      if (typeof v === "string" && /^eyJ/i.test(v) && v.length > 40) continue;
      out[k] = v;
    }
    return out;
  }

  class TasuLivePlatformEdgeSync {
    /**
     * @param {{
     *   useEdgeSync?: boolean,
     *   diagnostics?: import('./live-platform-diagnostics.js'),
     *   broadcastEdgeClient?: object,
     *   viewerEdgeClient?: object,
     *   chatEdgeClient?: object,
     *   recordingEdgeClient?: object,
     *   monitoringEdgeClient?: object,
     * }} [options]
     */
    constructor(options = {}) {
      /** @private */
      this._enabled = options.useEdgeSync === true;
      /** @private */
      this._diagnostics = options.diagnostics || null;
      /** @private */
      this._clients = {
        broadcast: options.broadcastEdgeClient || null,
        viewer: options.viewerEdgeClient || null,
        chat: options.chatEdgeClient || null,
        recording: options.recordingEdgeClient || null,
        monitoring: options.monitoringEdgeClient || null,
      };
      /** @private @type {Set<string>} */
      this._liveKeys = new Set();
      /** @private @type {object|null} */
      this._lastResult = null;
    }

    get enabled() {
      return this._enabled;
    }

    /** @private */
    _key(surface, broadcastId) {
      return `${String(surface || "").trim().toLowerCase()}:${String(broadcastId || "").trim()}`;
    }

    /** @private */
    _record(phase, payload) {
      const safe = sanitizeContext(payload);
      this._diagnostics?.recordEdgeSync?.(phase, safe);
      return safe;
    }

    /** @private */
    _finalize(result) {
      this._lastResult = result;
      return result;
    }

    /**
     * @param {object} res
     * @param {string} target
     */
    _isSoftOk(res, target) {
      if (!res || res.ok !== false) return true;
      if (res.idempotent || res.noop || res.alreadyLive) return true;
      const code = String(res.code || "").toUpperCase();
      const err = String(res.error || "").toLowerCase();
      if (code.includes("409") || err.includes("already") || err.includes("409")) return true;
      if (target === "broadcast" && (err.includes("draft") || err.includes("live"))) return true;
      return false;
    }

    /** @private @param {string} op @param {Record<string, unknown>} ctx */
    async _fanOutSetLive(op, ctx, live) {
      const surface = String(ctx.surface || "platform").trim().toLowerCase();
      const broadcastId = String(ctx.broadcastId || "").trim();
      const targets = /** @type {const} */ (["viewer", "chat", "recording"]);
      /** @type {Record<string, unknown>} */
      const results = {};
      /** @type {{ target: string, error: string }[]} */
      const failures = [];

      for (const name of targets) {
        const client = this._clients[name];
        if (!client) {
          results[name] = { ok: true, noop: true, reason: "client_missing" };
          continue;
        }
        const fn = live ? client.setLive : client.clearLive;
        if (typeof fn !== "function") {
          results[name] = { ok: true, noop: true, reason: "method_missing" };
          continue;
        }
        try {
          const r = await fn.call(client, { surface, broadcastId, roomId: ctx.roomId });
          results[name] = r;
          if (!this._isSoftOk(r, name)) {
            failures.push({ target: name, error: String(r?.error || "edge fan-out failed") });
          }
        } catch (err) {
          const message = err?.message || String(err);
          results[name] = { ok: false, error: message };
          failures.push({ target: name, error: message });
        }
      }

      const monitoring = this._clients.monitoring;
      if (monitoring && typeof monitoring.patchLive === "function") {
        try {
          results.monitoring = await monitoring.patchLive({
            surface,
            broadcastId,
            broadcastLive: live,
            sessionActive: live ? ctx.sessionActive !== false : false,
            providerState: ctx.providerState || null,
            roomId: ctx.roomId,
            streamId: ctx.streamId,
          });
          if (!this._isSoftOk(results.monitoring, "monitoring")) {
            failures.push({
              target: "monitoring",
              error: String(results.monitoring?.error || "monitoring patch failed"),
            });
          }
        } catch (err) {
          const message = err?.message || String(err);
          results.monitoring = { ok: false, error: message };
          failures.push({ target: "monitoring", error: message });
        }
      } else {
        results.monitoring = { ok: true, noop: true, reason: "client_missing" };
      }

      return { results, failures, op, surface, broadcastId };
    }

    /** @private */
    async _syncBroadcastStart(ctx) {
      const bc = this._clients.broadcast;
      if (!bc) return { ok: true, noop: true, target: "broadcast" };

      const surface = String(ctx.surface || "platform").trim().toLowerCase();
      const broadcastId = String(ctx.broadcastId || "").trim();
      const payload = {
        surface,
        broadcastId,
        roomId: ctx.roomId,
        hostUserId: ctx.hostUserId || ctx.userId,
        title: ctx.title,
      };

      let createRes = { ok: true, skipped: true };
      if (typeof bc.create === "function") {
        createRes = await bc.create(payload);
        if (createRes?.ok === false && !this._isSoftOk(createRes, "broadcast")) {
          return { ok: false, step: "create", ...createRes };
        }
      }

      if (typeof bc.start !== "function") {
        return { ok: true, noop: true, target: "broadcast", create: createRes };
      }

      const startRes = await bc.start({ surface, userId: ctx.hostUserId || ctx.userId });
      if (startRes?.ok === false && !this._isSoftOk(startRes, "broadcast")) {
        return { ok: false, step: "start", create: createRes, ...startRes };
      }
      return { ok: true, create: createRes, start: startRes };
    }

    /** @private */
    async _syncBroadcastStop(ctx) {
      const bc = this._clients.broadcast;
      if (!bc || typeof bc.stop !== "function") {
        return { ok: true, noop: true, target: "broadcast" };
      }
      const surface = String(ctx.surface || "platform").trim().toLowerCase();
      const stopRes = await bc.stop({ surface, reason: ctx.reason || "edge_sync_clear" });
      if (stopRes?.ok === false && !this._isSoftOk(stopRes, "broadcast")) {
        return { ok: false, step: "stop", ...stopRes };
      }
      return { ok: true, stop: stopRes };
    }

    /**
     * Broadcast LIVE propagation (idempotent)
     * @param {{
     *   surface: string,
     *   broadcastId: string,
     *   roomId?: string,
     *   hostUserId?: string,
     *   userId?: string,
     *   sessionId?: string,
     *   streamId?: string,
     *   providerState?: string,
     *   sessionActive?: boolean,
     * }} ctx
     */
    async setLive(ctx = {}) {
      const safeCtx = sanitizeContext(ctx);
      if (!this._enabled) {
        this._record("skipped", { op: "setLive", reason: "useEdgeSync_disabled", ...safeCtx });
        return this._finalize({
          ok: true,
          skipped: true,
          reason: "useEdgeSync_disabled",
          edgeSync: false,
        });
      }

      const surface = String(ctx.surface || "platform").trim().toLowerCase();
      const broadcastId = String(ctx.broadcastId || "").trim();
      if (!surface || !broadcastId) {
        this._record("failed", { op: "setLive", error: "surface/broadcastId required", ...safeCtx });
        return this._finalize({
          ok: false,
          error: "surface / broadcastId が必要です",
          edgeSync: true,
        });
      }

      const key = this._key(surface, broadcastId);
      this._record("attempted", { op: "setLive", ...safeCtx });

      if (this._liveKeys.has(key)) {
        this._record("succeeded", { op: "setLive", idempotent: true, alreadyLive: true, ...safeCtx });
        return this._finalize({
          ok: true,
          edgeSync: true,
          idempotent: true,
          alreadyLive: true,
          broadcastId,
          sessionId: ctx.sessionId || null,
          streamId: ctx.streamId || null,
          providerState: ctx.providerState || null,
        });
      }

      let broadcastResult = { ok: true, noop: true };
      try {
        broadcastResult = await this._syncBroadcastStart(ctx);
      } catch (err) {
        broadcastResult = { ok: false, error: err?.message || String(err) };
      }

      const fanOut = await this._fanOutSetLive("setLive", ctx, true);
      const failures = [...(fanOut.failures || [])];
      if (broadcastResult?.ok === false) {
        failures.push({ target: "broadcast", error: String(broadcastResult.error || "broadcast sync failed") });
      }

      const partial = failures.length > 0;
      if (!partial) {
        this._liveKeys.add(key);
      }

      const result = {
        ok: true,
        edgeSync: true,
        partial,
        failures,
        broadcast: broadcastResult,
        fanOut: fanOut.results,
        broadcastId,
        sessionId: ctx.sessionId || null,
        streamId: ctx.streamId || null,
        providerState: ctx.providerState || null,
      };

      this._record(partial ? "failed" : "succeeded", {
        op: "setLive",
        partial,
        failureCount: failures.length,
        ...safeCtx,
      });

      return this._finalize(result);
    }

    /**
     * Clear broadcast LIVE (idempotent)
     * @param {{
     *   surface: string,
     *   broadcastId: string,
     *   roomId?: string,
     *   sessionId?: string,
     *   streamId?: string,
     *   providerState?: string,
     *   reason?: string,
     * }} ctx
     */
    async clearLive(ctx = {}) {
      const safeCtx = sanitizeContext(ctx);
      if (!this._enabled) {
        this._record("skipped", { op: "clearLive", reason: "useEdgeSync_disabled", ...safeCtx });
        return this._finalize({
          ok: true,
          skipped: true,
          reason: "useEdgeSync_disabled",
          edgeSync: false,
        });
      }

      const surface = String(ctx.surface || "platform").trim().toLowerCase();
      const broadcastId = String(ctx.broadcastId || "").trim();
      if (!surface || !broadcastId) {
        this._record("failed", { op: "clearLive", error: "surface/broadcastId required", ...safeCtx });
        return this._finalize({ ok: false, error: "surface / broadcastId が必要です", edgeSync: true });
      }

      const key = this._key(surface, broadcastId);
      this._record("attempted", { op: "clearLive", ...safeCtx });

      const wasLive = this._liveKeys.has(key);
      if (!wasLive) {
        this._record("succeeded", { op: "clearLive", idempotent: true, alreadyClear: true, ...safeCtx });
        return this._finalize({
          ok: true,
          edgeSync: true,
          idempotent: true,
          alreadyClear: true,
          broadcastId,
        });
      }

      let broadcastResult = { ok: true, noop: true };
      try {
        broadcastResult = await this._syncBroadcastStop(ctx);
      } catch (err) {
        broadcastResult = { ok: false, error: err?.message || String(err) };
      }

      const fanOut = await this._fanOutSetLive("clearLive", ctx, false);
      const failures = [...(fanOut.failures || [])];
      if (broadcastResult?.ok === false) {
        failures.push({ target: "broadcast", error: String(broadcastResult.error || "broadcast stop failed") });
      }

      if (failures.length === 0) {
        this._liveKeys.delete(key);
      }

      const partial = failures.length > 0;
      const result = {
        ok: true,
        edgeSync: true,
        partial,
        failures,
        broadcast: broadcastResult,
        fanOut: fanOut.results,
        broadcastId,
        sessionId: ctx.sessionId || null,
        providerState: ctx.providerState || null,
      };

      this._record(partial ? "failed" : "succeeded", {
        op: "clearLive",
        partial,
        failureCount: failures.length,
        ...safeCtx,
      });

      return this._finalize(result);
    }

    /**
     * Partial LIVE metadata patch (monitoring-first)
     * @param {Record<string, unknown>} ctx
     */
    async patchLive(ctx = {}) {
      const safeCtx = sanitizeContext(ctx);
      if (!this._enabled) {
        this._record("skipped", { op: "patchLive", reason: "useEdgeSync_disabled", ...safeCtx });
        return this._finalize({
          ok: true,
          skipped: true,
          reason: "useEdgeSync_disabled",
          edgeSync: false,
        });
      }

      this._record("attempted", { op: "patchLive", ...safeCtx });

      const monitoring = this._clients.monitoring;
      if (!monitoring || typeof monitoring.patchLive !== "function") {
        this._record("succeeded", { op: "patchLive", noop: true, reason: "monitoring_client_missing", ...safeCtx });
        return this._finalize({ ok: true, edgeSync: true, noop: true, reason: "monitoring_client_missing" });
      }

      try {
        const patchRes = await monitoring.patchLive({
          surface: ctx.surface,
          broadcastId: ctx.broadcastId,
          broadcastLive: ctx.broadcastLive,
          sessionActive: ctx.sessionActive,
          recordingActive: ctx.recordingActive,
          providerState: ctx.providerState,
          roomId: ctx.roomId,
          streamId: ctx.streamId,
          sessionId: ctx.sessionId,
        });
        const failed = patchRes?.ok === false;
        this._record(failed ? "failed" : "succeeded", {
          op: "patchLive",
          partial: failed,
          ...safeCtx,
        });
        return this._finalize({
          ok: true,
          edgeSync: true,
          partial: failed,
          monitoring: patchRes,
          broadcastId: ctx.broadcastId || null,
          sessionId: ctx.sessionId || null,
          streamId: ctx.streamId || null,
          providerState: ctx.providerState || null,
          failures: failed ? [{ target: "monitoring", error: String(patchRes?.error || "patch failed") }] : [],
        });
      } catch (err) {
        const message = err?.message || String(err);
        this._record("failed", { op: "patchLive", error: message, ...safeCtx });
        return this._finalize({
          ok: true,
          edgeSync: true,
          partial: true,
          failures: [{ target: "monitoring", error: message }],
        });
      }
    }

    /** @returns {object|null} */
    getLastResult() {
      return this._lastResult ? { ...this._lastResult } : null;
    }

    /** @returns {{ enabled: boolean, liveKeys: string[], lastResult: object|null }} */
    getStatus() {
      return {
        enabled: this._enabled,
        liveKeys: [...this._liveKeys],
        lastResult: this.getLastResult(),
      };
    }

    reset() {
      this._liveKeys.clear();
      this._lastResult = null;
    }
  }

  global.TasuLivePlatformEdgeSync = TasuLivePlatformEdgeSync;
})(typeof window !== "undefined" ? window : globalThis);
