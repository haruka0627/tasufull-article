/**
 * TLV LIVE Momentum V1 — milestone + momentum signal contract.
 * Real measurements only. Fake engagement forbidden.
 * Extensible toward Trending / 急上昇 without DB schema changes in V1.
 */
(function (global) {
  "use strict";

  /** Configurable milestone thresholds (once per live). */
  var DEFAULT_MILESTONES = [5, 10, 25, 50, 100, 500, 1000];

  /**
   * Momentum V1 uses concurrent viewers + growth rate only.
   * comments / gifts / retention are reserved for later (signal slots, not computed yet).
   */
  var MOMENTUM_DEFAULTS = {
    /** Absolute concurrent viewers required for "盛り上がっています" */
    heatMinViewers: 10,
    /** Net viewer gain within window to fire surge */
    surgeDelta: 5,
    /** Window length for surge detection (ms) */
    surgeWindowMs: 60_000,
    /** Cooldown between surge notifications (ms) */
    surgeCooldownMs: 120_000,
  };

  function storageKey(broadcastId) {
    return "tlv.live.milestones.v1:" + String(broadcastId || "");
  }

  function loadFired(broadcastId) {
    try {
      var raw = global.sessionStorage && global.sessionStorage.getItem(storageKey(broadcastId));
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(Number).filter(function (n) {
        return Number.isFinite(n);
      }) : [];
    } catch (_) {
      return [];
    }
  }

  function saveFired(broadcastId, fired) {
    try {
      if (global.sessionStorage) {
        global.sessionStorage.setItem(storageKey(broadcastId), JSON.stringify(fired || []));
      }
    } catch (_) {}
  }

  /**
   * @param {object} [opts]
   */
  function createController(opts) {
    opts = opts || {};
    var milestones = Array.isArray(opts.milestones) && opts.milestones.length
      ? opts.milestones.slice().map(Number).sort(function (a, b) {
          return a - b;
        })
      : DEFAULT_MILESTONES.slice();
    var cfg = Object.assign({}, MOMENTUM_DEFAULTS, opts.momentum || {});
    var broadcastId = String(opts.broadcastId || "");
    var fired = broadcastId ? loadFired(broadcastId) : [];
    var samples = [];
    var lastSurgeAt = 0;
    var peakViewers = 0;
    var lastCount = 0;

    function setBroadcastId(id) {
      broadcastId = String(id || "");
      fired = broadcastId ? loadFired(broadcastId) : [];
      samples = [];
      lastSurgeAt = 0;
      peakViewers = 0;
      lastCount = 0;
    }

    function hasFired(n) {
      return fired.indexOf(Number(n)) >= 0;
    }

    /**
     * Evaluate viewer count. Returns notifications to show (0..n).
     * @param {number} viewerCount
     * @param {number} [nowMs]
     * @returns {{ milestones: Array<{threshold:number,message:string}>, momentum: Array<{kind:string,message:string,signal:object}>, state: object }}
     */
    function observe(viewerCount, nowMs) {
      var now = Number.isFinite(nowMs) ? nowMs : Date.now();
      var count = Math.max(0, Math.floor(Number(viewerCount) || 0));
      lastCount = count;
      if (count > peakViewers) peakViewers = count;

      samples.push({ t: now, n: count });
      var cutoff = now - cfg.surgeWindowMs;
      while (samples.length && samples[0].t < cutoff) samples.shift();

      var milestoneEvents = [];
      for (var i = 0; i < milestones.length; i++) {
        var th = milestones[i];
        if (count >= th && !hasFired(th)) {
          fired.push(th);
          milestoneEvents.push({
            threshold: th,
            message:
              th <= 10
                ? "視聴者が" + th + "人を超えました"
                : "現在" + th + "人が視聴中です",
          });
        }
      }
      if (milestoneEvents.length && broadcastId) saveFired(broadcastId, fired);

      var momentumEvents = [];
      var oldest = samples.length ? samples[0] : null;
      var delta = oldest ? count - oldest.n : 0;
      var surgeReady = now - lastSurgeAt >= cfg.surgeCooldownMs;
      if (delta >= cfg.surgeDelta && count >= Math.min(cfg.heatMinViewers, cfg.surgeDelta) && surgeReady) {
        lastSurgeAt = now;
        momentumEvents.push({
          kind: "viewer_surge",
          message: "視聴者が急増しています",
          signal: {
            concurrentViewers: count,
            delta: delta,
            windowMs: cfg.surgeWindowMs,
            source: "realtime_viewer_count",
          },
        });
      } else if (count >= cfg.heatMinViewers && delta >= Math.max(2, Math.floor(cfg.surgeDelta / 2)) && surgeReady) {
        // Slightly softer heat — still requires measured growth, not static high CCU alone
        lastSurgeAt = now;
        momentumEvents.push({
          kind: "heat",
          message: "このLIVEが盛り上がっています",
          signal: {
            concurrentViewers: count,
            delta: delta,
            windowMs: cfg.surgeWindowMs,
            source: "realtime_viewer_count",
          },
        });
      }

      return {
        milestones: milestoneEvents,
        momentum: momentumEvents,
        state: getState(),
      };
    }

    function getState() {
      return {
        broadcastId: broadcastId,
        viewerCount: lastCount,
        peakViewers: peakViewers,
        firedMilestones: fired.slice(),
        milestonesSsot: milestones.slice(),
        momentumConfig: Object.assign({}, cfg),
        reservedSignals: ["concurrent_viewers", "viewer_growth_rate", "comments", "gifts", "watch_retention"],
        activeSignalsV1: ["concurrent_viewers", "viewer_growth_rate"],
        trendingReady: false,
      };
    }

    function resetSession() {
      fired = [];
      samples = [];
      lastSurgeAt = 0;
      peakViewers = 0;
      lastCount = 0;
      if (broadcastId) saveFired(broadcastId, []);
    }

    return {
      setBroadcastId: setBroadcastId,
      observe: observe,
      getState: getState,
      resetSession: resetSession,
      hasFired: hasFired,
    };
  }

  global.TasuTlvLiveMomentumV1 = {
    createController: createController,
    DEFAULT_MILESTONES: DEFAULT_MILESTONES.slice(),
    MOMENTUM_DEFAULTS: Object.assign({}, MOMENTUM_DEFAULTS),
    ssot: "tlv-live-momentum-v1 · sessionStorage milestones · realtime viewer growth",
  };
})(typeof window !== "undefined" ? window : globalThis);
