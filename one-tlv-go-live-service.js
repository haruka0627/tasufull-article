/**
 * one-tlv-go-live-service.js
 * Formal Go Live service — create broadcast + status start/end + Formal Publish Input wiring.
 * Publish media comes from TasuOneTlvGoLiveMedia.getPublishStream() (Formal Output today;
 * Scene compositedStream later via setPublishStream).
 */
(function (global) {
  "use strict";

  var session = {
    phase: "idle", // idle|ready|live|error
    broadcast: null,
    broadcastId: "",
    lastError: null,
    /** Last Formal Publish Input snapshot at start (reference only — do not stop) */
    publishStreamAttached: false,
    publishReady: false,
    uiOnly: {
      description: "",
      category: "",
      visibility: "",
      tags: [],
      resolution: "",
      fps: "",
      bitrate: "",
      autoQuality: true,
      noiseCancel: false,
      echoCancel: true,
    },
  };

  function tt(key, vars) {
    var L = global.TasuTlvGoLiveLabelsJa;
    return L && typeof L.t === "function" ? L.t(key, vars) : key;
  }

  function userMsg(code, fallback) {
    var L = global.TasuTlvGoLiveLabelsJa;
    if (L && typeof L.userMessage === "function") return L.userMessage(code, fallback);
    return fallback || tt("code.unknown");
  }

  function cfg() {
    return global.TasuLiveConfig;
  }

  function setPhase(p) {
    session.phase = p;
    if (document.body) document.body.setAttribute("data-go-live-phase", p);
  }

  async function checkAuth() {
    var c = cfg();
    if (!c) return { ok: false, code: "no_config", message: userMsg("no_config") };
    await c.ensureSupabaseSession?.();
    var userId = c.getTalkUserId?.() || "";
    if (!userId) return { ok: false, code: "auth", message: userMsg("auth") };
    return { ok: true, userId: userId };
  }

  async function checkPermission(userId) {
    var create = global.TasuLiveCreate;
    if (!create?.fetchOwnProfile) {
      return { ok: false, code: "no_create_api", message: userMsg("no_create_api") };
    }
    var profile = await create.fetchOwnProfile();
    var allowed = cfg().hasBroadcastPermission(profile);
    if (!allowed) {
      return {
        ok: false,
        code: "permission",
        message: userMsg("permission"),
        profile: profile,
      };
    }
    return { ok: true, profile: profile, userId: userId };
  }

  function validateTitle(title) {
    var t = String(title || "").trim();
    if (!t) return { ok: false, message: tt("statusTitleRequired") };
    if (t.length > 120) return { ok: false, message: tt("statusTitleTooLong") };
    return { ok: true, title: t };
  }

  /**
   * Persist UI-only fields in session (not DB — columns do not exist on live_broadcasts).
   */
  function setUiDetails(details) {
    Object.keys(session.uiOnly).forEach(function (k) {
      if (details && details[k] !== undefined) session.uiOnly[k] = details[k];
    });
    return session.uiOnly;
  }

  async function prepareBroadcast(title, options) {
    var auth = await checkAuth();
    if (!auth.ok) return auth;
    var perm = await checkPermission(auth.userId);
    if (!perm.ok) return perm;
    var v = validateTitle(title);
    if (!v.ok) return { ok: false, code: "validation", message: v.message };

    if (session.broadcastId && session.broadcast?.status !== "ended") {
      return { ok: true, broadcast: session.broadcast, reused: true };
    }

    var status = options?.status || "preparing";
    if (status !== "scheduled" && status !== "preparing") status = "preparing";

    var row = {
      creator_id: auth.userId,
      title: v.title,
      status: status,
      stream_provider: cfg().LIVE_STREAM_PROVIDER_DEFAULT || "stub",
      scheduled_at: options?.scheduledAt || null,
    };

    var created = await global.TasuLiveCreate.insertBroadcast(row);
    session.broadcast = created;
    session.broadcastId = created?.id || "";
    setPhase("ready");
    return { ok: true, broadcast: created, reused: false };
  }

  /**
   * Wire Formal MediaStream Output → Formal Publish Input (Scene compositor hook later).
   * When Scene Editor is enabled, prefer compositedStream over raw Formal Output.
   * @returns {{ ok: boolean, publishStream: MediaStream|null, code?: string, message?: string }}
   */
  function attachFormalPublishInput() {
    var mediaApi = global.TasuOneTlvGoLiveMedia;
    if (!mediaApi?.getPublishStream) {
      session.publishStreamAttached = false;
      session.publishReady = false;
      return { ok: false, publishStream: null, code: "no_media", message: userMsg("no_media") };
    }

    var scene = global.TasuOneTlvSceneEditor;
    if (scene?.isEnabled?.()) {
      var composed = scene.getCompositedStream?.() || null;
      if (!composed && scene.onFormalStreamReady) {
        scene.onFormalStreamReady();
        composed = scene.getCompositedStream?.() || null;
      }
      if (composed && mediaApi.setPublishStream) {
        mediaApi.setPublishStream(composed);
        session.publishStreamAttached = true;
        session.publishReady = true;
        return {
          ok: true,
          publishStream: composed,
          code: "scene_composited",
          message: tt("statusPreviewReady"),
          diagnostics: Object.assign({}, mediaApi.getDiagnostics?.() || {}, scene.getDiagnostics?.() || {}),
        };
      }
    }

    if (!mediaApi.syncPublishFromFormalOutput) {
      session.publishStreamAttached = false;
      session.publishReady = false;
      return { ok: false, publishStream: null, code: "no_media", message: userMsg("no_media") };
    }
    mediaApi.syncPublishFromFormalOutput();
    var publishStream = mediaApi.getPublishStream() || null;
    session.publishStreamAttached = Boolean(publishStream);
    session.publishReady = Boolean(publishStream);
    return {
      ok: Boolean(publishStream),
      publishStream: publishStream,
      code: publishStream ? "formal_publish_ready" : "no_formal_stream",
      message: publishStream ? tt("statusPreviewReady") : userMsg("publish_input"),
      diagnostics: mediaApi.getDiagnostics?.() || null,
    };
  }

  async function bridgePreflight(videoContainer) {
    var bridge = global.TlvPlatformLiveBridge;
    var usePl = global.TLV_FEATURE_FLAGS?.usePlatformLive === true;
    var liveKitOn = global.TasuTlvLiveKitFormal?.isPrimaryEnabled?.() !== false &&
      global.TLV_FEATURE_FLAGS?.liveKitPrimary !== false;
    if (liveKitOn) {
      return {
        ok: true,
        skipped: false,
        liveKitPrimary: true,
        reason: "livekit_formal_primary",
        providerReadiness: "LIVEKIT_PRIMARY",
        note: "Formal START → LiveKit Cloud PRIMARY (ZEGO FALLBACK preserved, not auto-started)",
        videoContainer: videoContainer || null,
      };
    }
    if (!usePl) {
      return {
        ok: true,
        skipped: true,
        reason: "usePlatformLive_disabled",
        providerReadiness: "FORMAL_NOT_READY",
        note: "status=live only — not video publish success",
      };
    }
    if (!bridge?.onStudioStart) {
      return { ok: false, code: "no_bridge", message: userMsg("no_bridge") };
    }
    return {
      ok: true,
      ready: true,
      bridge: true,
      videoContainer: videoContainer || null,
      providerReadiness: "FLAG_ON",
    };
  }

  async function controlledStart(opts) {
    opts = opts || {};
    setPhase("preparing");
    session.lastError = null;

    try {
      var auth = await checkAuth();
      if (!auth.ok) {
        setPhase("error");
        session.lastError = auth;
        return auth;
      }
      var perm = await checkPermission(auth.userId);
      if (!perm.ok) {
        setPhase("error");
        session.lastError = perm;
        return perm;
      }
      var v = validateTitle(opts.title);
      if (!v.ok) {
        setPhase("error");
        session.lastError = { ok: false, code: "validation", message: v.message };
        return session.lastError;
      }

      var hubClient = global.TasuTlvVroidHubClient;
      if (hubClient && typeof hubClient.assertStartLiveLicense === "function") {
        var hubLicense = await hubClient.assertStartLiveLicense();
        if (hubLicense && hubLicense.ok === false) {
          setPhase("error");
          session.lastError = {
            ok: false,
            code: hubLicense.code || "LICENSE_INELIGIBLE",
            message: userMsg(hubLicense.code || "LICENSE_INELIGIBLE", hubLicense.reason),
          };
          return session.lastError;
        }
      }

      var mediaApi = global.TasuOneTlvGoLiveMedia;
      var media = mediaApi?.getState?.() || {};
      var formalStream = mediaApi?.getActiveMediaStream?.() || null;
      if (opts.requireMedia && !(media.hasStream || formalStream)) {
        setPhase("error");
        session.lastError = {
          ok: false,
          code: "media",
          message: userMsg("media"),
        };
        return session.lastError;
      }

      var liveKitOn =
        global.TLV_FEATURE_FLAGS?.liveKitPrimary !== false &&
        Boolean(global.TasuTlvLiveKitFormal?.startHost);
      var requirePublish = opts.requirePublishStream === true || liveKitOn;

      var publishAttach = attachFormalPublishInput();
      if (requirePublish && !publishAttach.ok) {
        setPhase("error");
        session.lastError = {
          ok: false,
          code: "publish_input",
          message: userMsg("publish_input", publishAttach.message),
        };
        return session.lastError;
      }

      var prepared = await prepareBroadcast(v.title, { status: "preparing" });
      if (!prepared.ok) {
        setPhase("error");
        session.lastError = prepared;
        return prepared;
      }

      var pf = await bridgePreflight(opts.videoContainer);
      if (!pf.ok) {
        setPhase("error");
        session.lastError = pf;
        return pf;
      }

      if (opts.confirm !== false) {
        var okConfirm = global.confirm(tt("confirmStartLive", { title: v.title }));
        if (!okConfirm) {
          setPhase(session.broadcastId ? "ready" : "idle");
          return { ok: false, code: "cancelled", message: userMsg("cancelled") };
        }
      }

      // Re-sync in case toggle/device changed during confirm dialog
      publishAttach = attachFormalPublishInput();
      if (requirePublish && !publishAttach.ok) {
        setPhase("error");
        session.lastError = {
          ok: false,
          code: "publish_input",
          message: userMsg("publish_input", publishAttach.message),
        };
        return session.lastError;
      }

      var liveKitRes = null;
      if (liveKitOn) {
        try {
          liveKitRes = await global.TasuTlvLiveKitFormal.startHost({
            broadcastId: session.broadcastId,
            publishStream: publishAttach.publishStream,
            videoContainer: opts.videoContainer || null,
          });
        } catch (lkErr) {
          liveKitRes = {
            ok: false,
            code: "livekit_exception",
            message: userMsg("livekit_exception"),
            detail: lkErr?.message || String(lkErr),
            zegoFallbackPreserved: true,
          };
        }
        if (!liveKitRes?.ok) {
          setPhase("error");
          if (liveKitRes) {
            liveKitRes.message = userMsg(liveKitRes.code, liveKitRes.message);
          }
          session.lastError = liveKitRes || { ok: false, code: "livekit_failed", message: userMsg("livekit_failed") };
          return session.lastError;
        }
      }

      var updated = await global.TasuLiveBroadcasts.updateBroadcastStatus(session.broadcastId, "live");
      session.broadcast = updated;
      setPhase("live");

      var bridgeRes = null;
      // ZEGO Platform Live only when LiveKit PRIMARY is off and flag ON (no dual publish)
      if (!liveKitOn && !pf.skipped && global.TlvPlatformLiveBridge?.onStudioStart) {
        try {
          bridgeRes = await global.TlvPlatformLiveBridge.onStudioStart({
            broadcastId: session.broadcastId,
            creatorId: auth.userId,
            creatorName: cfg().resolveDisplayName(auth.userId),
            videoContainer: opts.videoContainer || null,
            publishStream: publishAttach.publishStream,
            mediaStream: publishAttach.publishStream,
          });
        } catch (bridgeErr) {
          console.warn("[GoLiveService] bridge:", bridgeErr);
          bridgeRes = { ok: false, error: bridgeErr?.message || String(bridgeErr) };
        }
      }

      var watchUrl =
        typeof cfg().watchUrl === "function" ? cfg().watchUrl(session.broadcastId) : "";

      return {
        ok: true,
        broadcast: updated,
        bridge: bridgeRes || pf,
        liveKit: liveKitRes,
        publish: publishAttach,
        uiOnly: session.uiOnly,
        formalPublishReady: publishAttach.ok,
        videoPublish: liveKitRes?.ok
          ? "livekit_primary"
          : pf.skipped
            ? "not_started_flag_off"
            : bridgeRes?.ok
              ? "bridge_requested"
              : "bridge_partial",
        primary: liveKitRes?.ok ? "livekit" : liveKitOn ? "livekit_failed" : "stub_or_zego",
        watchUrl: watchUrl,
        roomName: liveKitRes?.roomName || "",
        cameraReacquire: 0,
        zegoFallbackPreserved: true,
      };
    } catch (err) {
      console.error("[GoLiveService] start:", err);
      setPhase("error");
      session.lastError = { ok: false, code: "exception", message: userMsg("exception"), detail: err?.message || String(err) };
      return session.lastError;
    }
  }

  async function controlledStop() {
    if (!session.broadcastId) {
      return { ok: false, code: "no_broadcast", message: userMsg("no_broadcast") };
    }
    try {
      var auth = await checkAuth();
      if (global.TasuTlvLiveKitFormal?.stopHost) {
        try {
          await global.TasuTlvLiveKitFormal.stopHost();
        } catch (lkStopErr) {
          console.warn("[GoLiveService] livekit stop:", lkStopErr);
        }
      }
      var updated = await global.TasuLiveBroadcasts.updateBroadcastStatus(session.broadcastId, "ended");
      session.broadcast = updated;
      setPhase("ready");
      session.publishReady = false;
      if (
        global.TLV_FEATURE_FLAGS?.liveKitPrimary === false &&
        global.TLV_FEATURE_FLAGS?.usePlatformLive === true &&
        global.TlvPlatformLiveBridge?.onStudioEnd
      ) {
        try {
          await global.TlvPlatformLiveBridge.onStudioEnd({
            broadcastId: session.broadcastId,
            creatorId: auth.userId,
          });
        } catch (e) {
          console.warn("[GoLiveService] bridge end:", e);
        }
      }
      // Keep Formal Output / Preview alive after stop (preview may continue).
      // Prefer Scene compositedStream when Scene Editor is enabled.
      if (global.TasuOneTlvSceneEditor?.isEnabled?.()) {
        global.TasuOneTlvSceneEditor.onFormalStreamReady?.();
        global.TasuOneTlvGoLiveService?.attachFormalPublishInput?.();
      } else if (global.TasuOneTlvGoLiveMedia?.syncPublishFromFormalOutput) {
        global.TasuOneTlvGoLiveMedia.syncPublishFromFormalOutput();
      }
      return { ok: true, broadcast: updated };
    } catch (err) {
      session.lastError = { ok: false, code: "exception", message: userMsg("exception"), detail: err?.message || String(err) };
      setPhase("error");
      return session.lastError;
    }
  }

  function getSession() {
    var media = global.TasuOneTlvGoLiveMedia;
    return {
      phase: session.phase,
      broadcastId: session.broadcastId,
      broadcast: session.broadcast,
      lastError: session.lastError,
      publishStreamAttached: session.publishStreamAttached,
      publishReady: session.publishReady,
      hasFormalStream: Boolean(media?.getActiveMediaStream?.()),
      hasPublishStream: Boolean(media?.getPublishStream?.()),
      uiOnly: Object.assign({}, session.uiOnly),
    };
  }

  function getFormalPublishInput() {
    return attachFormalPublishInput();
  }

  global.TasuOneTlvGoLiveService = {
    checkAuth: checkAuth,
    checkPermission: checkPermission,
    validateTitle: validateTitle,
    setUiDetails: setUiDetails,
    prepareBroadcast: prepareBroadcast,
    bridgePreflight: bridgePreflight,
    controlledStart: controlledStart,
    controlledStop: controlledStop,
    getSession: getSession,
    attachFormalPublishInput: attachFormalPublishInput,
    getFormalPublishInput: getFormalPublishInput,
  };
})(typeof window !== "undefined" ? window : globalThis);
