/**
 * Live Platform Monitoring — Smoke Runner（stub · Phase A〜E 横断検証）
 * Phase F · TLV 非接続
 */
(function (global) {
  "use strict";

  const STEPS = Object.freeze([
    "session_create",
    "broadcast_create",
    "broadcast_start",
    "viewer_join",
    "viewer_heartbeat",
    "chat_send",
    "recording_start",
    "recording_stop",
    "cleanup",
  ]);

  class TasuLivePlatformMonitoringSmokeRunner {
    /**
     * @param {{
     *   SessionManager?: Function,
     *   BroadcastService?: Function,
     *   ViewerService?: Function,
     *   ChatGateway?: Function,
     *   RecordingService?: Function,
     *   CcuRegistry?: Function,
     *   createProvider?: Function,
     * }} deps
     */
    constructor(deps = {}) {
      this._deps = deps;
    }

    /**
     * @param {{
     *   surface: string,
     *   broadcastId?: string,
     *   userId?: string,
     *   failAtStep?: string,
     *   stack?: object,
     * }} options
     */
    async run(options = {}) {
      const surface = String(options.surface || "platform").trim().toLowerCase();
      const broadcastId = String(options.broadcastId || `bc-smoke-${Date.now()}`).trim();
      const userId = String(options.userId || "smoke-user-1").trim();
      const failAtStep = options.failAtStep ? String(options.failAtStep).trim() : null;

      const steps = [];
      /** @type {object|null} */
      let stack = options.stack || null;
      let disposed = false;

      const record = (name, ok, detail = "") => {
        steps.push({ name, ok, detail: detail || undefined });
        return ok;
      };

      const maybeFail = (name) => {
        if (failAtStep && failAtStep === name) {
          record(name, false, "injected failure");
          return true;
        }
        return false;
      };

      try {
        if (!stack) {
          stack = this._createStack(surface, broadcastId);
        }

        const {
          session,
          broadcast,
          viewer,
          chat,
          recording,
          provider,
        } = stack;

        // session_create
        if (maybeFail("session_create")) {
          return this._result(false, steps, surface, "session_create");
        }
        const scr = await session.createSession({
          surface,
          roomId: `room-${broadcastId}`,
          role: "host",
        });
        if (!scr?.ok && session.state === global.PLATFORM_LIVE_SESSION_STATES?.IDLE) {
          record("session_create", false, scr?.error || "create failed");
          return this._result(false, steps, surface, "session_create");
        }
        record("session_create", true);

        // broadcast_create
        if (maybeFail("broadcast_create")) {
          return this._result(false, steps, surface, "broadcast_create");
        }
        const bcr = await broadcast.createBroadcast({
          surface,
          broadcastId,
          roomId: `room-${broadcastId}`,
        });
        if (!bcr?.ok) {
          record("broadcast_create", false, bcr?.error || "create failed");
          return this._result(false, steps, surface, "broadcast_create");
        }
        record("broadcast_create", true);

        // broadcast_start
        if (maybeFail("broadcast_start")) {
          return this._result(false, steps, surface, "broadcast_start");
        }
        const bsr = await broadcast.startBroadcast({ surface });
        if (!bsr?.ok) {
          record("broadcast_start", false, bsr?.error || "start failed");
          return this._result(false, steps, surface, "broadcast_start");
        }
        record("broadcast_start", true);

        // viewer_join
        if (maybeFail("viewer_join")) {
          return this._result(false, steps, surface, "viewer_join");
        }
        const vjr = await viewer.joinViewer({ surface, broadcastId, userId });
        if (!vjr?.ok) {
          record("viewer_join", false, vjr?.error || "join failed");
          return this._result(false, steps, surface, "viewer_join");
        }
        record("viewer_join", true);

        // viewer_heartbeat
        if (maybeFail("viewer_heartbeat")) {
          return this._result(false, steps, surface, "viewer_heartbeat");
        }
        const hbr = await viewer.heartbeat({ surface, userId });
        if (!hbr?.ok) {
          record("viewer_heartbeat", false, hbr?.error || "heartbeat failed");
          return this._result(false, steps, surface, "viewer_heartbeat");
        }
        record("viewer_heartbeat", true);

        // chat_send
        if (maybeFail("chat_send")) {
          return this._result(false, steps, surface, "chat_send");
        }
        const csr = await chat.sendMessage({
          surface,
          broadcastId,
          userId,
          text: "smoke test message",
        });
        if (!csr?.ok) {
          record("chat_send", false, csr?.error || "send failed");
          return this._result(false, steps, surface, "chat_send");
        }
        record("chat_send", true);

        // recording_start
        if (maybeFail("recording_start")) {
          return this._result(false, steps, surface, "recording_start");
        }
        const rsr = await recording.startRecording({ surface, broadcastId });
        if (!rsr?.ok) {
          record("recording_start", false, rsr?.error || "start failed");
          return this._result(false, steps, surface, "recording_start");
        }
        record("recording_start", true);

        // recording_stop
        if (maybeFail("recording_stop")) {
          return this._result(false, steps, surface, "recording_stop");
        }
        const rst = await recording.stopRecording({ surface });
        if (!rst?.ok) {
          record("recording_stop", false, rst?.error || "stop failed");
          return this._result(false, steps, surface, "recording_stop");
        }
        record("recording_stop", true);

        // cleanup
        if (maybeFail("cleanup")) {
          return this._result(false, steps, surface, "cleanup");
        }
        await viewer.leaveViewer({ surface, userId });
        await broadcast.stopBroadcast({ surface });
        await recording.resetRecording({ surface });
        if (provider?.dispose) await provider.dispose();
        await chat.dispose();
        await viewer.dispose();
        await broadcast.dispose();
        await session.dispose();
        disposed = true;
        record("cleanup", true);

        return this._result(true, steps, surface, null);
      } catch (err) {
        const msg = err?.message || String(err);
        steps.push({ name: "exception", ok: false, detail: msg });
        return this._result(false, steps, surface, "exception");
      } finally {
        if (stack && !disposed) {
          try {
            await stack.recording?.resetRecording?.({ surface });
            await stack.chat?.dispose?.();
            await stack.viewer?.dispose?.();
            await stack.broadcast?.dispose?.();
            await stack.session?.dispose?.();
            await stack.provider?.dispose?.();
          } catch {
            /* best-effort cleanup */
          }
        }
      }
    }

    /** @private */
    _createStack(surface, broadcastId) {
      const SessionManager = this._deps.SessionManager || global.TasuLivePlatformSessionManager;
      const BroadcastService = this._deps.BroadcastService || global.TasuLivePlatformBroadcastService;
      const ViewerService = this._deps.ViewerService || global.TasuLivePlatformViewerService;
      const ChatGateway = this._deps.ChatGateway || global.TasuLivePlatformChatGateway;
      const RecordingService = this._deps.RecordingService || global.TasuLivePlatformRecordingService;
      const CcuRegistry = this._deps.CcuRegistry || global.TasuLivePlatformViewerCcuRegistry;
      const createProvider = this._deps.createProvider || global.createPlatformLiveProvider;

      const session = new SessionManager();
      const provider = createProvider ? createProvider("stub") : null;
      const broadcast = new BroadcastService({ sessionManager: session, provider });
      const ccuRegistry = CcuRegistry ? new CcuRegistry() : null;
      const viewer = new ViewerService({ broadcastService: broadcast, ccuRegistry, provider });
      const chat = new ChatGateway({ broadcastService: broadcast, viewerService: viewer, sessionManager: session, provider });
      const recording = new RecordingService({ broadcastService: broadcast, sessionManager: session, provider });

      return { session, broadcast, viewer, chat, recording, provider, ccuRegistry, broadcastId };
    }

    /** @private */
    _result(ok, steps, surface, failedStep) {
      return {
        ok,
        surface,
        steps,
        failedStep: failedStep || null,
        stepCount: steps.length,
        passedCount: steps.filter((s) => s.ok).length,
      };
    }
  }

  global.TasuLivePlatformMonitoringSmokeRunner = TasuLivePlatformMonitoringSmokeRunner;
  global.PLATFORM_LIVE_MONITORING_SMOKE_STEPS = STEPS;
})(typeof window !== "undefined" ? window : globalThis);
