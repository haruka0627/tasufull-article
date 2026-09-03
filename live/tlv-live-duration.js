/**
 * TLV LIVE elapsed duration SSOT.
 * Same contract as Viewer Human UI (started_at → mm:ss / hh:mm:ss).
 * Do not invent a second client clock origin — use broadcast.started_at.
 */
(function (global) {
  "use strict";

  /**
   * @param {string|null|undefined} startedAt ISO timestamp
   * @param {number} [nowMs]
   * @returns {string|null}
   */
  function formatDuration(startedAt, nowMs) {
    if (!startedAt) return null;
    var start = Date.parse(String(startedAt));
    if (!Number.isFinite(start)) return null;
    var now = Number.isFinite(nowMs) ? nowMs : Date.now();
    var sec = Math.max(0, Math.floor((now - start) / 1000));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    return h > 0 ? pad(h) + ":" + pad(m) + ":" + pad(s) : pad(m) + ":" + pad(s);
  }

  /**
   * @param {string|null|undefined} startedAt
   * @param {number} [nowMs]
   * @returns {number} elapsed seconds (>=0) or -1 if invalid
   */
  function elapsedSeconds(startedAt, nowMs) {
    if (!startedAt) return -1;
    var start = Date.parse(String(startedAt));
    if (!Number.isFinite(start)) return -1;
    var now = Number.isFinite(nowMs) ? nowMs : Date.now();
    return Math.max(0, Math.floor((now - start) / 1000));
  }

  global.TasuTlvLiveDuration = {
    formatDuration: formatDuration,
    elapsedSeconds: elapsedSeconds,
    /** Contract id for audits / tests */
    ssot: "live_broadcasts.started_at",
  };
})(typeof window !== "undefined" ? window : globalThis);
