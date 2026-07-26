/**
 * TASFUL talk-voice-core — server-side duration / heartbeat helpers (pure)
 *
 * Client-reported duration is never authoritative.
 */
(function (global) {
  "use strict";

  function toMs(iso) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : null;
  }

  /**
   * Billable duration starts at connected_at (or started_at) — not ringing.
   * @returns {number|null} seconds or null if not computable
   */
  function computeDurationSeconds({ connectedAt, startedAt, endedAt, now }) {
    const start = toMs(connectedAt) ?? toMs(startedAt);
    const end = toMs(endedAt) ?? toMs(now) ?? Date.now();
    if (start == null || end < start) return null;
    return Math.max(0, Math.floor((end - start) / 1000));
  }

  /**
   * If last heartbeat is older than grace, session may be force-ended.
   */
  function shouldReconcileDisconnect({
    status,
    lastHeartbeatAt,
    connectedAt,
    startedAt,
    now,
    graceSec,
  }) {
    if (String(status || "") !== "active") return { ok: false, reason: "not_active" };
    const grace = Math.max(30, Number(graceSec) || 120);
    const nowMs = toMs(now) ?? Date.now();
    const hb = toMs(lastHeartbeatAt);
    const connected = toMs(connectedAt) ?? toMs(startedAt);
    const anchor = hb ?? connected;
    if (anchor == null) return { ok: false, reason: "no_anchor" };
    const ageSec = Math.floor((nowMs - anchor) / 1000);
    if (ageSec > grace) {
      return {
        ok: true,
        reason: "heartbeat_stale",
        ageSec,
        graceSec: grace,
        endAtIso: new Date(anchor + grace * 1000).toISOString(),
      };
    }
    return { ok: false, reason: "within_grace", ageSec, graceSec: grace };
  }

  function ignoreClientDuration(clientDuration) {
    void clientDuration;
    return null;
  }

  global.TasuTalkVoiceUsage = {
    computeDurationSeconds,
    shouldReconcileDisconnect,
    ignoreClientDuration,
  };
})(typeof window !== "undefined" ? window : globalThis);
