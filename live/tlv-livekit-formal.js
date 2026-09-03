/**
 * TLV LiveKit Formal lifecycle — PRIMARY path for START LIVE / Viewer (AD-039).
 * Room SSOT = broadcastId → tlv_<id>. No manual room / Join Viewer UI.
 * Reconnect V1: prefer LiveKit native Reconnecting/Reconnected; soft rejoin only after full drop.
 * Runtime reconnecting state only — no DB schema change (broadcast stays status=live).
 * PoC (?tlvLiveKitPoc=1) remains separate and is not deleted.
 */
(function (global) {
  "use strict";

  var hostProvider = null;
  var viewerProvider = null;
  var hostBroadcastId = "";
  var hostRoomName = "";
  var viewerBroadcastId = "";
  var viewerContainer = null;
  var observerStarted = false;
  var lastHostError = null;
  /** @type {'idle'|'live'|'reconnecting'|'ended'} */
  var runtimePhase = "idle";
  var reconnectLog = [];
  var visibilityWired = false;

  function flags() {
    return global.TLV_FEATURE_FLAGS || {};
  }

  function isPrimaryEnabled() {
    return flags().liveKitPrimary !== false;
  }

  function Provider() {
    var Ctor = global.TlvLiveKitLiveProvider || global.TasuTlvLiveKitLiveProvider;
    if (!Ctor) throw new Error("TlvLiveKitLiveProvider_not_loaded");
    return new Ctor();
  }

  function pushReconnectLog(evt) {
    reconnectLog.push(Object.assign({ at: new Date().toISOString() }, evt || {}));
    if (reconnectLog.length > 40) reconnectLog = reconnectLog.slice(-40);
    try {
      if (document.body) {
        document.body.setAttribute("data-tlv-livekit-runtime-phase", runtimePhase);
      }
    } catch (_) {}
  }

  async function resolveBearer() {
    // QA / Playwright override only — never a Production auth bypass in shipped UI.
    var override = global.__TLV_LIVEKIT_POC_BEARER__;
    if (typeof override === "string" && override.trim()) return override.trim();

    var poc = global.TasuTlvLiveKitPocRoom;
    if (poc && typeof poc.resolvePocBearer === "function") {
      return poc.resolvePocBearer();
    }

    // Formal Viewer auto-join races empty session if mount fires before session hydrate.
    try {
      var cfg = global.TasuLiveConfig;
      if (cfg && typeof cfg.ensureSupabaseSession === "function") {
        await cfg.ensureSupabaseSession();
      }
    } catch (_) {}

    var wrap = global.TasuSupabase;
    var client = wrap && typeof wrap.getClient === "function" ? wrap.getClient() : null;
    if (!client || !client.auth || typeof client.auth.getSession !== "function") {
      var missing = new Error("supabase_client_unavailable");
      missing.code = "supabase_client_unavailable";
      throw missing;
    }
    var res = await client.auth.getSession();
    if (res && res.error) {
      var sessErr = new Error(res.error.message || "auth_session_error");
      sessErr.code = "auth_session_error";
      throw sessErr;
    }
    var token =
      (res && res.data && res.data.session && res.data.session.access_token) || "";
    if (!token) {
      var authReq = new Error("auth_required");
      authReq.code = "auth_required";
      throw authReq;
    }
    return String(token);
  }

  function roomApi() {
    var api = global.TasuTlvLiveKitRoom;
    if (!api || typeof api.roomNameFromBroadcastId !== "function") {
      throw new Error("TasuTlvLiveKitRoom_not_loaded");
    }
    return api;
  }

  function wireProviderSession(prov, role, broadcastId) {
    prov.setTokenRefreshHook(async function (reason) {
      var roomName = role === "broadcaster" ? hostRoomName : roomApi().roomNameFromBroadcastId(broadcastId);
      var bearer = await resolveBearer();
      var tokenRes = await prov.fetchAccessToken({
        roomName: roomName,
        role: role === "broadcaster" ? "broadcaster" : "viewer",
        bearerToken: bearer,
      });
      pushReconnectLog({ phase: "token_refresh", reason: reason, role: role });
      return {
        url: tokenRes.url,
        token: tokenRes.token,
        identity: tokenRes.identity,
        expiresAt: tokenRes.expiresAt ? Date.parse(tokenRes.expiresAt) || 0 : 0,
      };
    });
    prov.setReconnectHook(function (evt) {
      if (evt && (evt.phase === "reconnecting" || evt.phase === "soft_rejoin_start")) {
        runtimePhase = "reconnecting";
      } else if (evt && (evt.phase === "reconnected" || evt.phase === "soft_rejoin_done")) {
        runtimePhase = hostProvider || viewerProvider ? "live" : runtimePhase;
      } else if (evt && evt.phase === "disconnected" && runtimePhase === "live") {
        runtimePhase = "reconnecting";
      }
      pushReconnectLog(evt);
      // Do NOT flip Supabase broadcast status away from live during reconnect
    });
  }

  /**
   * Formal START LIVE → LiveKit PRIMARY publish.
   * @param {{ broadcastId: string, publishStream: MediaStream, videoContainer?: HTMLElement|null }} opts
   */
  async function startHost(opts) {
    opts = opts || {};
    lastHostError = null;
    if (!isPrimaryEnabled()) {
      return { ok: false, code: "livekit_primary_disabled", message: "LiveKit PRIMARY disabled by flag" };
    }
    var broadcastId = String(opts.broadcastId || "").trim();
    if (!broadcastId) {
      return { ok: false, code: "no_broadcast", message: "broadcastId required" };
    }
    var publishStream = opts.publishStream || null;
    if (!publishStream || typeof publishStream.getVideoTracks !== "function") {
      return { ok: false, code: "no_formal_stream", message: "Formal compositedStream / publishStream required" };
    }
    if (!publishStream.getVideoTracks().length) {
      return { ok: false, code: "no_formal_video", message: "Formal video track missing" };
    }

    var roomName;
    try {
      roomName = roomApi().roomNameFromBroadcastId(broadcastId);
    } catch (e) {
      return { ok: false, code: "invalid_room", message: e && e.message ? e.message : String(e) };
    }

    try {
      var bearer = await resolveBearer();
      var prov = Provider();
      wireProviderSession(prov, "broadcaster", broadcastId);
      var tokenRes = await prov.fetchAccessToken({
        roomName: roomName,
        role: "broadcaster",
        bearerToken: bearer,
      });
      var started = await prov.startBroadcast({
        url: tokenRes.url,
        token: tokenRes.token,
        roomName: tokenRes.roomName || roomName,
        identity: tokenRes.identity || "",
        publishStream: publishStream,
        videoContainer: opts.videoContainer || null,
        expiresAt: tokenRes.expiresAt ? Date.parse(tokenRes.expiresAt) || 0 : 0,
      });
      if (hostProvider && hostProvider !== prov) {
        try {
          await hostProvider.stop({ intentional: true });
        } catch (_) {}
      }
      hostProvider = prov;
      hostBroadcastId = broadcastId;
      hostRoomName = roomName;
      runtimePhase = "live";
      pushReconnectLog({ phase: "host_started", roomName: roomName, broadcastId: broadcastId });
      return {
        ok: true,
        provider: "livekit",
        primary: true,
        broadcastId: broadcastId,
        roomName: roomName,
        cameraReacquire: 0,
        audioTracks: publishStream.getAudioTracks().length,
        videoTracks: publishStream.getVideoTracks().length,
        diagnostics: started && started.diagnostics ? started.diagnostics : prov.getDiagnostics(),
        zegoFallbackPreserved: true,
        dualPublish: false,
        runtimePhase: runtimePhase,
      };
    } catch (err) {
      lastHostError = {
        ok: false,
        code: (err && err.code) || "livekit_host_failed",
        message: (err && err.message) || String(err),
        detail: (err && err.detail) || "",
        zegoFallbackPreserved: true,
        autoZegoFallback: false,
      };
      runtimePhase = "idle";
      return lastHostError;
    }
  }

  async function stopHost() {
    var bid = hostBroadcastId;
    var room = hostRoomName;
    runtimePhase = "ended";
    try {
      if (hostProvider) await hostProvider.stop({ intentional: true, clearSession: true });
    } catch (e) {
      console.warn("[TlvLiveKitFormal] stopHost:", e);
    }
    hostProvider = null;
    hostBroadcastId = "";
    hostRoomName = "";
    pushReconnectLog({ phase: "host_stopped", broadcastId: bid, roomName: room });
    runtimePhase = "idle";
    return { ok: true, broadcastId: bid, roomName: room };
  }

  async function onFormalStreamChanged(publishStream) {
    if (!hostProvider || !hostBroadcastId) {
      return { ok: false, code: "not_live" };
    }
    var stream =
      publishStream ||
      global.TasuOneTlvGoLiveService?.attachFormalPublishInput?.()?.publishStream ||
      global.TasuOneTlvGoLiveMedia?.getPublishStream?.() ||
      null;
    if (!stream) return { ok: false, code: "no_formal_stream" };
    try {
      var diag = await hostProvider.replaceFormalVideo(stream);
      return { ok: true, diagnostics: diag, cameraReacquire: 0 };
    } catch (err) {
      return { ok: false, code: "replace_failed", message: err && err.message ? err.message : String(err) };
    }
  }

  /**
   * Formal Viewer auto-join (room from broadcastId only).
   */
  async function mountViewer(container, broadcastOrId) {
    if (!container) return { ok: false, code: "no_container" };
    if (!isPrimaryEnabled()) {
      return { ok: false, code: "livekit_primary_disabled", skipped: true };
    }

    var broadcastId =
      typeof broadcastOrId === "string"
        ? String(broadcastOrId).trim()
        : String((broadcastOrId && (broadcastOrId.id || broadcastOrId.broadcastId)) || "").trim();
    var status =
      typeof broadcastOrId === "object" && broadcastOrId
        ? String(broadcastOrId.status || "").trim()
        : "live";

    if (!broadcastId || broadcastId.toLowerCase() === "stub") {
      return { ok: false, code: "no_broadcast", skipped: true };
    }
    if (status && status !== "live") {
      return { ok: false, code: "not_live", skipped: true, status: status };
    }

    var roomName;
    try {
      roomName = roomApi().roomNameFromBroadcastId(broadcastId);
    } catch (e) {
      return { ok: false, code: "invalid_room", message: e && e.message ? e.message : String(e) };
    }

    container.setAttribute("data-tlv-livekit-formal-mount", "1");
    container.setAttribute("data-broadcast-id", broadcastId);
    container.setAttribute("data-tlv-livekit-room", roomName);
    container.innerHTML =
      '<p class="live-muted" data-tlv-livekit-formal-loading aria-live="polite">LiveKit に接続中…</p>';

    try {
      var bearer = await resolveBearer();
      var prov = Provider();
      wireProviderSession(prov, "viewer", broadcastId);
      var tokenRes = await prov.fetchAccessToken({
        roomName: roomName,
        role: "viewer",
        bearerToken: bearer,
      });
      if (viewerProvider && viewerProvider !== prov) {
        try {
          await viewerProvider.stop({ intentional: true });
        } catch (_) {}
      }
      var joined = await prov.startViewer({
        url: tokenRes.url,
        token: tokenRes.token,
        roomName: tokenRes.roomName || roomName,
        identity: tokenRes.identity || "",
        videoContainer: container,
        waitForRemoteMs: 10000,
        expiresAt: tokenRes.expiresAt ? Date.parse(tokenRes.expiresAt) || 0 : 0,
      });
      viewerProvider = prov;
      viewerBroadcastId = broadcastId;
      viewerContainer = container;
      // Prefer connected mount (React may have replaced the node mid-join).
      var joinedEl = container.isConnected
        ? container
        : document.querySelector(
            '[data-tlv-human-visible-player="1"] [data-tlv-livekit-formal-mount][data-broadcast-id="' +
              broadcastId.replace(/"/g, "") +
              '"]',
          );
      if (joinedEl) {
        viewerContainer = joinedEl;
        joinedEl.setAttribute("data-tlv-livekit-joined", "1");
        var loading2 = joinedEl.querySelector("[data-tlv-livekit-formal-loading]");
        if (loading2) loading2.remove();
        if (joinedEl !== container && typeof prov.relocateVideoContainer === "function") {
          try {
            prov.relocateVideoContainer(joinedEl);
          } catch (_) {}
        }
      } else {
        container.setAttribute("data-tlv-livekit-joined", "1");
      }
      var loading = container.querySelector("[data-tlv-livekit-formal-loading]");
      if (loading) loading.remove();
      runtimePhase = runtimePhase === "idle" ? "live" : runtimePhase;
      return {
        ok: true,
        provider: "livekit",
        broadcastId: broadcastId,
        roomName: roomName,
        autoJoin: true,
        remoteTrackSubscribed: Boolean(joined && joined.remoteTrackSubscribed),
        diagnostics: joined && joined.diagnostics ? joined.diagnostics : prov.getDiagnostics(),
      };
    } catch (err) {
      var code = (err && err.code) || "livekit_viewer_failed";
      // One-shot auth race must not permanently kill Formal receive path.
      // auth_wait allows scanAndMount to retry after session hydrate / login.
      if (code === "auth_required" || code === "supabase_client_unavailable" || code === "auth_session_error") {
        var attempt = Number(container.getAttribute("data-tlv-livekit-auth-attempt") || "0") || 0;
        attempt += 1;
        container.setAttribute("data-tlv-livekit-auth-attempt", String(attempt));
        if (attempt <= 12) {
          container.setAttribute("data-tlv-livekit-joined", "auth_wait");
          container.innerHTML =
            '<p class="live-muted" data-tlv-livekit-formal-loading aria-live="polite">ログイン状態を確認中…</p>';
          setTimeout(function () {
            if (container.getAttribute("data-tlv-livekit-joined") === "auth_wait") {
              container.removeAttribute("data-tlv-livekit-joined");
              scanAndMount(container.parentElement || document);
            }
          }, Math.min(4000, 500 * attempt));
          return {
            ok: false,
            code: code,
            retrying: true,
            attempt: attempt,
            broadcastId: broadcastId,
            roomName: roomName,
            autoJoin: true,
          };
        }
      }
      var returnTo = "";
      try {
        returnTo = encodeURIComponent(
          (global.location && global.location.pathname ? global.location.pathname : "/live/watch/") +
            (global.location && global.location.search ? global.location.search : ""),
        );
      } catch (_) {
        returnTo = encodeURIComponent("/live/watch/?broadcast_id=" + broadcastId);
      }
      var errLabel =
        code === "auth_required" || code === "supabase_client_unavailable" || code === "auth_session_error"
          ? '視聴にはログインが必要です。<a href="/login.html?return=' +
            returnTo +
            '">ログイン</a>後にこのページを開き直してください。'
          : code === "invalid_token"
            ? "認証トークンが無効です。同じ環境で再ログインしてください（" + String(code) + "）"
            : "LiveKit 接続に失敗しました（" + String(code) + "）";
      container.innerHTML =
        '<p class="live-error" data-tlv-livekit-formal-error>' + errLabel + "</p>";
      container.setAttribute("data-tlv-livekit-joined", "error");
      return {
        ok: false,
        code: code,
        message: (err && err.message) || String(err),
        broadcastId: broadcastId,
        roomName: roomName,
        autoJoin: true,
      };
    }
  }

  async function unmountViewer() {
    try {
      if (viewerProvider) await viewerProvider.stop({ intentional: true, clearSession: true });
    } catch (_) {}
    viewerProvider = null;
    viewerBroadcastId = "";
    viewerContainer = null;
    return { ok: true };
  }

  /**
   * Vertical↔Landscape layout flip: keep LiveKit room + Formal mount DOM.
   * Move rescued mount into the new visible host and re-attach tracks (no reconnect).
   */
  function relocateViewer(container) {
    if (!container) return { ok: false, code: "no_container" };
    viewerContainer = container;
    container.setAttribute("data-tlv-livekit-formal-mount", "1");
    if (viewerBroadcastId) container.setAttribute("data-broadcast-id", viewerBroadcastId);
    if (!container.getAttribute("data-tlv-livekit-joined")) {
      container.setAttribute("data-tlv-livekit-joined", viewerProvider ? "1" : "pending");
    }
    if (!viewerProvider || typeof viewerProvider.relocateVideoContainer !== "function") {
      return { ok: false, code: "no_viewer_provider" };
    }
    var moved = viewerProvider.relocateVideoContainer(container);
    pushReconnectLog({ phase: "viewer_relocate", result: moved });
    return { ok: Boolean(moved && moved.ok), relocated: moved };
  }

  /** Probe host+viewer after network/visibility — never getUserMedia */
  async function recoverSessions(reason) {
    var out = { host: null, viewer: null, reason: reason || "recover" };
    if (hostProvider) {
      try {
        out.host = await hostProvider.probeAndRecover(reason || "recover");
      } catch (e) {
        out.host = { ok: false, error: String(e && e.message ? e.message : e) };
      }
    }
    if (viewerProvider) {
      try {
        out.viewer = await viewerProvider.probeAndRecover(reason || "recover");
        if (out.viewer && out.viewer.ok === false && viewerContainer && viewerBroadcastId) {
          // Full remount same broadcast_id (viewer-only; does not touch broadcaster)
          out.viewerRemount = await mountViewer(viewerContainer, {
            id: viewerBroadcastId,
            status: "live",
          });
        }
      } catch (e) {
        out.viewer = { ok: false, error: String(e && e.message ? e.message : e) };
      }
    }
    pushReconnectLog({ phase: "recover_sessions", result: out });
    return out;
  }

  function renderPlayerMountHtml(broadcast) {
    var cfg = global.TasuLiveConfig;
    var id = String((broadcast && broadcast.id) || "").trim();
    var esc = cfg && cfg.escapeHtml ? cfg.escapeHtml(id) : id.replace(/"/g, "");
    return (
      '<div class="live-watch__livekit-formal-mount" data-tlv-livekit-formal-mount data-live-watch-player-mount data-broadcast-id="' +
      esc +
      '" aria-label="LiveKit Formal Viewer">' +
      '<p class="live-muted" data-tlv-livekit-formal-loading aria-live="polite">配信に接続中…</p>' +
      "</div>"
    );
  }

  function shouldSkipAutoJoin(el) {
    if (!el || !el.getAttribute) return true;
    if (el.getAttribute("data-tlv-livekit-skip-autojoin") === "1") return true;
    if (el.closest && el.closest("[data-tlv-livekit-skip-autojoin='1']")) return true;
    // Hidden aspect probes (1px / opacity-0) must never steal Formal viewer.
    // IMPORTANT: do NOT permanently mark joined=skipped for aria-hidden park —
    // park is temporary during aspect flip; leaving "skipped" blocks remount forever.
    if (el.closest && el.closest('[aria-hidden="true"]')) return true;
    try {
      var r = el.getBoundingClientRect && el.getBoundingClientRect();
      if (r && r.width > 0 && r.width < 2 && r.height > 0 && r.height < 2) return true;
    } catch (_) {}
    return false;
  }

  function scanAndMount(root) {
    var scope = root || document;
    if (!scope || !scope.querySelectorAll) return;
    var nodes = scope.querySelectorAll(
      "[data-tlv-livekit-formal-mount][data-broadcast-id]:not([data-tlv-livekit-joined])," +
        "[data-tlv-livekit-formal-mount][data-broadcast-id][data-tlv-livekit-joined='auth_wait']," +
        "[data-tlv-livekit-formal-mount][data-broadcast-id][data-tlv-livekit-joined='error']",
    );
    nodes.forEach(function (el) {
      if (shouldSkipAutoJoin(el)) {
        // Leave attribute unset so a later visible placement can auto-join.
        return;
      }
      if (el.getAttribute("data-tlv-livekit-joined") === "1") return;
      if (el.getAttribute("data-tlv-livekit-joined") === "pending") return;
      // error mounts: only retry when a Supabase JWT is actually present
      if (el.getAttribute("data-tlv-livekit-joined") === "error") {
        var client = global.TasuSupabase && global.TasuSupabase.getClient && global.TasuSupabase.getClient();
        if (!client || !client.auth || typeof client.auth.getSession !== "function") return;
        // Fire-and-forget check; if session exists, clear error and remount
        void client.auth.getSession().then(function (res) {
          var token =
            res && res.data && res.data.session && res.data.session.access_token
              ? String(res.data.session.access_token)
              : "";
          if (!token) return;
          if (el.getAttribute("data-tlv-livekit-joined") !== "error") return;
          el.removeAttribute("data-tlv-livekit-joined");
          el.removeAttribute("data-tlv-livekit-auth-attempt");
          var bid2 = el.getAttribute("data-broadcast-id") || "";
          var st2 = el.getAttribute("data-broadcast-status") || "live";
          el.setAttribute("data-tlv-livekit-joined", "pending");
          void mountViewer(el, { id: bid2, status: st2 });
        });
        return;
      }
      var bid = el.getAttribute("data-broadcast-id") || "";
      var st = el.getAttribute("data-broadcast-status") || "live";
      el.setAttribute("data-tlv-livekit-joined", "pending");
      void mountViewer(el, { id: bid, status: st }).then(function (res) {
        if (!res || !res.ok) {
          if (!(res && res.retrying)) {
            console.warn("[TlvLiveKitFormal] auto viewer:", res && (res.code || res.message));
          }
        }
      });
    });
  }

  var authListenerWired = false;
  function wireAuthRemount() {
    if (authListenerWired) return;
    var client = global.TasuSupabase && global.TasuSupabase.getClient && global.TasuSupabase.getClient();
    if (!client || !client.auth || typeof client.auth.onAuthStateChange !== "function") return;
    authListenerWired = true;
    client.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        // Session hydrate after login return — clear auth_wait/error and join Formal.
        try {
          document.querySelectorAll("[data-tlv-livekit-formal-mount][data-tlv-livekit-joined='error']").forEach(function (el) {
            el.removeAttribute("data-tlv-livekit-joined");
            el.removeAttribute("data-tlv-livekit-auth-attempt");
          });
          document.querySelectorAll("[data-tlv-livekit-formal-mount][data-tlv-livekit-joined='auth_wait']").forEach(function (el) {
            el.removeAttribute("data-tlv-livekit-joined");
          });
        } catch (_) {}
        scanAndMount(document);
      }
    });
  }

  function wireVisibilityAndNetwork() {
    if (visibilityWired || typeof document === "undefined") return;
    visibilityWired = true;
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        void recoverSessions("visibility_foreground");
      } else {
        pushReconnectLog({ phase: "visibility_background" });
        // Do NOT stopHost — Formal LIVE continues; LiveKit disconnectOnPageLeave=false
      }
    });
    global.addEventListener("online", function () {
      void recoverSessions("browser_online");
    });
  }

  function startObserver() {
    if (observerStarted || typeof document === "undefined") return;
    observerStarted = true;
    wireVisibilityAndNetwork();
    wireAuthRemount();
    // Defer first scan so LiveWatchApp can ensureSupabaseSession before auto-join.
    setTimeout(function () {
      wireAuthRemount();
      scanAndMount(document);
    }, 0);
    try {
      var mo = new MutationObserver(function () {
        wireAuthRemount();
        scanAndMount(document);
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {
      console.warn("[TlvLiveKitFormal] observer:", e);
    }
    // Only tear down on real unload — not Safari background pagehide alone
    global.addEventListener("pagehide", function (ev) {
      if (ev && ev.persisted) {
        pushReconnectLog({ phase: "pagehide_bfcache" });
        return;
      }
      // Still avoid stop on transient mobile pagehide when session should survive;
      // intentional END LIVE calls stopHost explicitly.
      pushReconnectLog({ phase: "pagehide_ignored_keepalive" });
    });
    global.addEventListener("beforeunload", function () {
      // Best-effort cleanup on tab close; Formal tracks owned by Media/Scene
      try {
        if (hostProvider) hostProvider.stop({ intentional: true });
        if (viewerProvider) viewerProvider.stop({ intentional: true });
      } catch (_) {}
    });
  }

  function getHostSession() {
    return {
      active: Boolean(hostProvider && hostBroadcastId),
      broadcastId: hostBroadcastId,
      roomName: hostRoomName,
      state: hostProvider ? hostProvider.state : "idle",
      runtimePhase: runtimePhase,
      lastError: lastHostError,
      primary: "livekit",
      zegoFallbackPreserved: true,
      reconnectLog: reconnectLog.slice(),
      diagnostics: hostProvider ? hostProvider.getDiagnostics() : null,
    };
  }

  /**
   * Read-only viewer count for Broadcaster HUD (host excluded).
   * Does not change publish/receive/room lifecycle.
   */
  function getHostParticipantStats() {
    if (!hostProvider || typeof hostProvider.getParticipantStats !== "function") {
      var contract = global.TasuTlvLiveViewerCountContract;
      if (contract && typeof contract.fromRoomSnapshot === "function") {
        return contract.fromRoomSnapshot({ remotes: [], localIdentity: "" });
      }
      return {
        source: "livekit_remote_participants",
        viewerCount: 0,
        identities: [],
        excludedHosts: [],
        hostExcluded: true,
        fakeForbidden: true,
        remoteCount: 0,
        localIdentity: "",
      };
    }
    return hostProvider.getParticipantStats();
  }

  /**
   * @param {(stats: object) => void} listener
   * @returns {() => void} unsubscribe
   */
  function observeHostParticipantStats(listener) {
    if (!hostProvider || typeof hostProvider.subscribeParticipantStats !== "function") {
      if (typeof listener === "function") {
        try {
          listener(getHostParticipantStats());
        } catch (_) {}
      }
      return function () {};
    }
    return hostProvider.subscribeParticipantStats(listener);
  }

  function getReconnectAudit() {
    return {
      rootCauseFixed: [
        "disconnectOnPageLeave default true → set false",
        "missing RoomEvent.Reconnecting/Reconnected handlers",
        "pagehide stopped host (Safari background)",
        "no Formal publication recovery after reconnect",
        "no soft rejoin after full disconnect",
        "no token refresh hook for soft rejoin",
      ],
      runtimePhase: runtimePhase,
      reconnectLog: reconnectLog.slice(),
      host: hostProvider ? hostProvider.getDiagnostics() : null,
      viewer: viewerProvider ? viewerProvider.getDiagnostics() : null,
      dbStatusTouchedOnReconnect: false,
    };
  }

  function setRemoteAudioMuted(muted) {
    if (!viewerProvider || typeof viewerProvider.setRemoteAudioMuted !== "function") {
      return { ok: false, code: "no_viewer_provider" };
    }
    viewerProvider.setRemoteAudioMuted(muted);
    return { ok: true, muted: Boolean(muted) };
  }

  /**
   * True when Formal viewer Room is still alive (even if React wiped the mount DOM).
   * Used to re-adopt into a new VISIBLE mount without Room reconnect.
   */
  function hasActiveViewer() {
    if (!viewerProvider) return false;
    try {
      var diag = typeof viewerProvider.getDiagnostics === "function" ? viewerProvider.getDiagnostics() : null;
      if (diag && (diag.state === "watching" || diag.state === "live" || diag.state === "connected")) return true;
      if (viewerProvider._room && viewerProvider._sessionAlive !== false) return true;
    } catch (_) {}
    return Boolean(viewerProvider && viewerBroadcastId);
  }

  /**
   * React may destroy the Formal mount node (imperative child inside mediaHostRef).
   * Rebuild mount DOM in `container` and re-attach tracks — no room.connect.
   */
  function adoptViewerMount(container, broadcastId) {
    if (!container) return { ok: false, code: "no_container" };
    if (!hasActiveViewer()) return { ok: false, code: "no_active_viewer" };
    var bid = String(broadcastId || viewerBroadcastId || "").trim();
    container.setAttribute("data-tlv-livekit-formal-mount", "1");
    if (bid) container.setAttribute("data-broadcast-id", bid);
    if (viewerBroadcastId) {
      try {
        container.setAttribute(
          "data-tlv-livekit-room",
          roomApi().roomNameFromBroadcastId(viewerBroadcastId),
        );
      } catch (_) {}
    }
    container.setAttribute("data-tlv-livekit-joined", "1");
    // Drop stale loading copy if present
    try {
      var loading = container.querySelector("[data-tlv-livekit-formal-loading]");
      if (loading) loading.remove();
    } catch (_) {}
    return relocateViewer(container);
  }

  global.TasuTlvLiveKitFormal = {
    isPrimaryEnabled: isPrimaryEnabled,
    startHost: startHost,
    stopHost: stopHost,
    onFormalStreamChanged: onFormalStreamChanged,
    mountViewer: mountViewer,
    unmountViewer: unmountViewer,
    relocateViewer: relocateViewer,
    adoptViewerMount: adoptViewerMount,
    hasActiveViewer: hasActiveViewer,
    recoverSessions: recoverSessions,
    renderPlayerMountHtml: renderPlayerMountHtml,
    scanAndMount: scanAndMount,
    startObserver: startObserver,
    getHostSession: getHostSession,
    getHostParticipantStats: getHostParticipantStats,
    observeHostParticipantStats: observeHostParticipantStats,
    getReconnectAudit: getReconnectAudit,
    setRemoteAudioMuted: setRemoteAudioMuted,
    /** Diagnostic / retry only — same path mountViewer uses (no auth bypass). */
    resolveBearer: resolveBearer,
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startObserver);
    } else {
      startObserver();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
