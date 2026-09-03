/**
 * Broadcaster Go Live HUD — LIVE timer · viewer count · milestones · momentum toasts.
 * Does not touch Formal LiveKit publish/receive paths.
 */
(function (global) {
  "use strict";

  var state = {
    active: false,
    broadcastId: "",
    startedAt: null,
    timerId: null,
    unsubParticipants: null,
    momentum: null,
    viewerCount: 0,
  };

  function labels() {
    return global.TasuTlvGoLiveLabelsJa;
  }

  function durationApi() {
    return global.TasuTlvLiveDuration;
  }

  function countContract() {
    return global.TasuTlvLiveViewerCountContract;
  }

  function ensureHudDom() {
    var host =
      document.querySelector("[data-go-live-preview-host]") ||
      document.querySelector(".relative.aspect-video.bg-black.group") ||
      document.querySelector(".relative.aspect-video.bg-black");
    if (!host) return null;
    host.setAttribute("data-go-live-preview-host", "1");
    var hud = host.querySelector('[data-tlv-broadcaster-hud="1"]');
    if (!hud) {
      hud = document.createElement("div");
      hud.setAttribute("data-tlv-broadcaster-hud", "1");
      hud.setAttribute("aria-live", "polite");
      hud.className =
        "absolute top-4 left-4 z-[6] flex flex-wrap items-center gap-2 max-w-[calc(100%-5rem)] pointer-events-none";
      hud.hidden = true;
      hud.innerHTML =
        '<div class="px-2.5 py-1 bg-error rounded-md text-white font-bold text-[10px] tracking-widest flex items-center shadow-lg gap-1.5">' +
        '<span class="w-1.5 h-1.5 rounded-full bg-white pulse-live" aria-hidden="true"></span>' +
        '<span data-tlv-hud-live>LIVE</span>' +
        '<span data-tlv-hud-duration class="font-mono tabular-nums tracking-normal font-semibold">00:00</span>' +
        "</div>" +
        '<div class="px-2.5 py-1 bg-black/50 backdrop-blur-md rounded-md text-white/90 text-[10px] font-label-sm flex items-center gap-1">' +
        '<span class="material-symbols-outlined text-[14px]" data-icon="visibility" aria-hidden="true">visibility</span>' +
        '<span data-tlv-hud-viewers>視聴中 0人</span>' +
        "</div>" +
        '<div class="px-2.5 py-1 bg-black/50 backdrop-blur-md rounded-md text-white/80 text-[10px] font-label-sm flex items-center gap-1">' +
        '<span class="material-symbols-outlined text-[14px]" data-icon="wifi" aria-hidden="true">wifi</span>' +
        '<span data-tlv-hud-connection>接続良好</span>' +
        "</div>";
      host.appendChild(hud);
    }
    // Tailwind CDN may miss late-injected utilities — keep critical layout inline.
    hud.style.pointerEvents = "none";
    hud.style.position = "absolute";
    hud.style.top = "1rem";
    hud.style.left = "1rem";
    hud.style.zIndex = "6";
    hud.style.display = hud.hidden ? "none" : "flex";
    hud.style.flexWrap = "wrap";
    hud.style.alignItems = "center";
    hud.style.gap = "0.5rem";
    hud.style.maxWidth = "calc(100% - 5rem)";

    if (!document.getElementById("tlv-broadcaster-toast-style")) {
      var style = document.createElement("style");
      style.id = "tlv-broadcaster-toast-style";
      style.textContent =
        "[data-tlv-broadcaster-toast-host]{position:fixed;top:max(12px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:2147483600;display:flex;flex-direction:column;gap:8px;max-width:min(92vw,360px);pointer-events:none;}" +
        "[data-tlv-broadcaster-toast]{background:rgba(12,12,16,.88);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px 14px;font-size:13px;line-height:1.35;box-shadow:0 8px 24px rgba(0,0,0,.35);backdrop-filter:blur(8px);animation:tlvHudToastIn .2s ease-out;}" +
        "@keyframes tlvHudToastIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}";
      document.head.appendChild(style);
    }
    return hud;
  }

  function toastHost() {
    var el = document.querySelector("[data-tlv-broadcaster-toast-host]");
    if (el) return el;
    el = document.createElement("div");
    el.setAttribute("data-tlv-broadcaster-toast-host", "1");
    document.body.appendChild(el);
    return el;
  }

  function showToast(message) {
    if (!message) return;
    var host = toastHost();
    var n = document.createElement("div");
    n.setAttribute("data-tlv-broadcaster-toast", "1");
    n.setAttribute("role", "status");
    n.textContent = String(message);
    host.appendChild(n);
    setTimeout(function () {
      try {
        n.remove();
      } catch (_) {}
    }, 4200);
  }

  function watchingLabel(n) {
    var L = labels();
    if (L && typeof L.t === "function") return L.t("watchingN", { n: n });
    return "視聴中 " + n + "人";
  }

  function renderTimer() {
    var hud = ensureHudDom();
    if (!hud) return;
    var el = hud.querySelector("[data-tlv-hud-duration]");
    var api = durationApi();
    var text =
      state.active && state.startedAt && api
        ? api.formatDuration(state.startedAt, Date.now())
        : null;
    if (el) el.textContent = text || "00:00";
  }

  function renderViewers(count) {
    state.viewerCount = Math.max(0, Math.floor(Number(count) || 0));
    var hud = ensureHudDom();
    if (!hud) return;
    var el = hud.querySelector("[data-tlv-hud-viewers]");
    if (el) el.textContent = watchingLabel(state.viewerCount);
    if (document.body) {
      document.body.setAttribute("data-tlv-viewer-count", String(state.viewerCount));
    }
  }

  function renderConnection(quality) {
    var hud = ensureHudDom();
    if (!hud) return;
    var el = hud.querySelector("[data-tlv-hud-connection]");
    if (!el) return;
    var L = labels() && labels().LABELS ? labels().LABELS : {};
    var q = String(quality || "").toLowerCase();
    if (q === "reconnecting" || q === "poor") {
      el.textContent = L.reconnecting || L.connectionWeak || "再接続中";
    } else {
      el.textContent = L.stableConnection || "接続良好";
    }
  }

  function applyMomentum(count) {
    if (!state.momentum) return;
    var res = state.momentum.observe(count, Date.now());
    (res.milestones || []).forEach(function (m) {
      showToast(m.message);
    });
    (res.momentum || []).forEach(function (m) {
      showToast(m.message);
    });
  }

  function pullParticipantStats() {
    var formal = global.TasuTlvLiveKitFormal;
    var contract = countContract();
    var stats =
      formal && typeof formal.getHostParticipantStats === "function"
        ? formal.getHostParticipantStats()
        : null;
    if (!stats && contract) {
      stats = contract.fromRoomSnapshot({ remotes: [], localIdentity: "" });
    }
    var count = stats && Number.isFinite(stats.viewerCount) ? stats.viewerCount : 0;
    renderViewers(count);
    applyMomentum(count);
    return stats;
  }

  function startParticipantWatch() {
    stopParticipantWatch();
    var formal = global.TasuTlvLiveKitFormal;
    if (formal && typeof formal.observeHostParticipantStats === "function") {
      state.unsubParticipants = formal.observeHostParticipantStats(function (stats) {
        if (!state.active) return;
        var count = stats && Number.isFinite(stats.viewerCount) ? stats.viewerCount : 0;
        renderViewers(count);
        applyMomentum(count);
        var host = formal.getHostSession && formal.getHostSession();
        var q =
          host && host.diagnostics && host.diagnostics.connectionQuality
            ? host.diagnostics.connectionQuality
            : host && host.state === "reconnecting"
              ? "reconnecting"
              : "excellent";
        renderConnection(q);
      });
    }
    pullParticipantStats();
  }

  function stopParticipantWatch() {
    if (typeof state.unsubParticipants === "function") {
      try {
        state.unsubParticipants();
      } catch (_) {}
    }
    state.unsubParticipants = null;
  }

  function startTimer() {
    stopTimer();
    renderTimer();
    state.timerId = setInterval(renderTimer, 1000);
  }

  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
  }

  /**
   * @param {{ broadcastId: string, startedAt?: string|null, broadcast?: object }} opts
   */
  function start(opts) {
    opts = opts || {};
    var broadcast = opts.broadcast || {};
    var startedAt =
      opts.startedAt ||
      broadcast.started_at ||
      (broadcast && broadcast.startedAt) ||
      null;
    var broadcastId = String(opts.broadcastId || broadcast.id || "").trim();
    if (!startedAt) {
      // Fail-closed: do not invent Date.now() as SSOT — wait for row
      startedAt = null;
    }
    state.active = true;
    state.broadcastId = broadcastId;
    state.startedAt = startedAt;
    if (global.TasuTlvLiveMomentumV1) {
      state.momentum = global.TasuTlvLiveMomentumV1.createController({
        broadcastId: broadcastId,
      });
    }
    var hud = ensureHudDom();
    if (hud) {
      hud.hidden = false;
      hud.style.display = "flex";
    }
    // Soft-hide static LIVE PREVIEW chip while live HUD is on
    document.querySelectorAll("[data-tlv-preview-chips]").forEach(function (row) {
      row.style.visibility = "hidden";
    });
    if (document.body) {
      document.body.setAttribute("data-tlv-broadcaster-hud-state", "live");
      document.body.setAttribute("data-tlv-live-started-at", String(startedAt || ""));
    }
    startTimer();
    startParticipantWatch();
    // If started_at missing (race), refresh from session shortly
    if (!startedAt && broadcastId) {
      setTimeout(function () {
        if (!state.active) return;
        var sess = global.TasuOneTlvGoLiveService && global.TasuOneTlvGoLiveService.getSession();
        var row = sess && sess.broadcast;
        if (row && row.started_at) {
          state.startedAt = row.started_at;
          if (document.body) document.body.setAttribute("data-tlv-live-started-at", row.started_at);
          renderTimer();
        }
      }, 400);
    }
    return getState();
  }

  function stop() {
    state.active = false;
    stopTimer();
    stopParticipantWatch();
    var hud = ensureHudDom();
    if (hud) {
      hud.hidden = true;
      hud.style.display = "none";
    }
    document.querySelectorAll("[data-tlv-preview-chips]").forEach(function (row) {
      row.style.visibility = "";
    });
    if (document.body) {
      document.body.setAttribute("data-tlv-broadcaster-hud-state", "idle");
      document.body.removeAttribute("data-tlv-live-started-at");
      document.body.setAttribute("data-tlv-viewer-count", "0");
    }
    state.startedAt = null;
    state.broadcastId = "";
    state.momentum = null;
    renderViewers(0);
    return getState();
  }

  function getState() {
    return {
      active: state.active,
      broadcastId: state.broadcastId,
      startedAt: state.startedAt,
      viewerCount: state.viewerCount,
      duration: state.startedAt && durationApi() ? durationApi().formatDuration(state.startedAt) : null,
      momentum: state.momentum ? state.momentum.getState() : null,
    };
  }

  global.TasuTlvBroadcasterHud = {
    start: start,
    stop: stop,
    getState: getState,
    showToast: showToast,
    refreshViewerCount: pullParticipantStats,
  };
})(typeof window !== "undefined" ? window : globalThis);
