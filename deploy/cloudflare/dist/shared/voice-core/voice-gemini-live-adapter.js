/**
 * Voice Core — Gemini Live adapter
 * Phase 3: Gemini Live API の WebSocket 接続を Voice Core adapter interface に適合させる
 */
(function (global) {
  "use strict";

  var Transport = global.TasuVoiceCoreGeminiLiveTransport;
  var Events = global.TasuVoiceCoreEvents;
  var ADAPTER_KIND = Events ? Events.ADAPTER_KIND : { LIVE: "live" };
  var EVENT = Events ? Events.EVENT : {};

  function createGeminiLiveAdapter(options) {
    var opts = options || {};
    var transport = Transport ? Transport.createGeminiLiveTransport(opts) : null;
    if (!transport) throw new Error("gemini_live_transport_missing");

    var sessionId = null;
    var isActive = false;

    function startSession(sessionOpts, emit) {
      if (isActive) {
        if (emit) emit({ type: EVENT.ERROR_MOCK || "error_mock", code: "session_already_active", message: "call stopSession before starting again" });
        return { ok: false, reason: "session_already_active" };
      }

      sessionId = "gmlive-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      isActive = true;

      transport.setOnMessage(function (msg) {
        if (!isActive) return;

        if (msg.setupComplete) {
          if (emit) {
            emit({
              type: EVENT.SESSION_STARTED || "session_started",
              sessionId: sessionId,
              surface: sessionOpts.surface || "default",
              provider: "gemini_live",
              adapterId: "gemini-live-adapter",
              ts: Date.now(),
            });
          }
          return;
        }

        if (msg.error) {
          if (emit) {
            emit({
              type: EVENT.ERROR_MOCK || "error_mock",
              code: String(msg.error.code || "live_error"),
              message: String(msg.error.message || ""),
              sessionId: sessionId,
            });
          }
          return;
        }

        if (msg.serverContent) {
          var sc = msg.serverContent;

          // テキスト転写
          if (sc.inputTranscription && sc.inputTranscription.text) {
            if (emit) {
              emit({
                type: EVENT.TEXT_DELTA || "text_delta",
                sessionId: sessionId,
                text: String(sc.inputTranscription.text),
                source: "input_transcription",
                ts: Date.now(),
              });
            }
          }
          if (sc.outputTranscription && sc.outputTranscription.text) {
            if (emit) {
              emit({
                type: EVENT.TEXT_DELTA || "text_delta",
                sessionId: sessionId,
                text: String(sc.outputTranscription.text),
                source: "output_transcription",
                ts: Date.now(),
              });
            }
          }

          // 音声データ
          if (sc.modelTurn && Array.isArray(sc.modelTurn.parts)) {
            var parts = sc.modelTurn.parts;
            for (var i = 0; i < parts.length; i++) {
              var part = parts[i];
              if (part.inlineData && part.inlineData.data) {
                if (emit) {
                  emit({
                    type: "audio_delta",
                    sessionId: sessionId,
                    audioBase64: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
                    ts: Date.now(),
                  });
                }
              }
            }
          }
        }
      });

      transport.setOnClose(function (event) {
        isActive = false;
        if (emit) {
          emit({
            type: EVENT.SESSION_STOPPED || "session_stopped",
            sessionId: sessionId,
            reason: "ws_close",
            code: event ? event.code : 0,
            ts: Date.now(),
          });
        }
      });

      transport.setOnError(function (err) {
        if (emit) {
          emit({
            type: EVENT.ERROR_MOCK || "error_mock",
            code: "transport_error",
            message: err ? err.message : "unknown",
            sessionId: sessionId,
          });
        }
      });

      // 非同期で接続開始
      transport.connect().then(function () {
        // setupComplete は onMessage で処理
      }).catch(function (err) {
        isActive = false;
        if (emit) {
          emit({
            type: EVENT.ERROR_MOCK || "error_mock",
            code: "connect_failed",
            message: err ? err.message : "connection failed",
            sessionId: sessionId,
          });
        }
      });

      return { sessionId: sessionId };
    }

    function sendAudio(sid, chunk) {
      if (!isActive || sid !== sessionId) return;
      transport.sendAudio(chunk);
    }

    function sendText(sid, text) {
      if (!isActive || sid !== sessionId) return;
      transport.sendText(text);
    }

    function stopSession(sid) {
      if (!isActive) return { ok: false, reason: "not_active" };
      transport.close();
      isActive = false;
      var id = sessionId;
      sessionId = null;
      return {
        type: EVENT.SESSION_STOPPED || "session_stopped",
        sessionId: id,
        reason: "user_stop",
        ts: Date.now(),
      };
    }

    return {
      id: "gemini-live-adapter",
      kind: ADAPTER_KIND.LIVE || "live",
      startSession: startSession,
      sendAudio: sendAudio,
      sendText: sendText,
      stopSession: stopSession,
    };
  }

  global.TasuVoiceCoreGeminiLiveAdapter = createGeminiLiveAdapter;
})(window);
