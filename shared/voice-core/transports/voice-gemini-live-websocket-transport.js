/**
 * Gemini Live WebSocket Transport
 * Phase 3: Gemini Live API のブラウザ WebSocket 接続を管理する
 */
(function (global) {
  "use strict";

  /**
   * Gemini API key is never accepted by browser code.
   * @param {{ proxyUrl: string, sessionToken: string, model?: string }} options
   * @returns {object} transport
   */
  function createGeminiLiveTransport(options) {
    var opts = options || {};
    var proxyUrl = String(opts.proxyUrl || "").trim();
    var sessionToken = String(opts.sessionToken || "").trim();
    var model = String(opts.model || "models/gemini-3.1-flash-live-preview").trim();

    var ws = null;
    var onMessage = null;
    var onClose = null;
    var onError = null;
    var isOpen = false;
    var pendingMessages = [];

    function connect() {
      return new Promise(function (resolve, reject) {
        if (!proxyUrl || !sessionToken) {
          reject(new Error("gemini_live_proxy_session_not_configured"));
          return;
        }

        var separator = proxyUrl.indexOf("?") >= 0 ? "&" : "?";
        var url = proxyUrl + separator + "session=" + encodeURIComponent(sessionToken);
        ws = new WebSocket(url);
        var resolved = false;

        ws.onopen = function () {
          var setupMsg = JSON.stringify({
            setup: {
              model: model,
              generationConfig: {
                responseModalities: ["AUDIO"],
              },
            },
          });
          ws.send(setupMsg);
        };

        ws.onmessage = function (event) {
          try {
            var msg = JSON.parse(event.data);

            if (msg.setupComplete) {
              isOpen = true;
              if (!resolved) { resolved = true; resolve(msg); }
              // 接続待ちメッセージをフラッシュ
              flushPending();
            }

            if (onMessage) {
              try { onMessage(msg); } catch (e) { /* ignore */ }
            }
          } catch (e) {
            if (onError) onError(new Error("parse_error: " + e.message));
          }
        };

        ws.onerror = function (e) {
          if (!resolved) { resolved = true; reject(new Error("ws_error")); }
          if (onError) onError(new Error("ws_error"));
        };

        ws.onclose = function (event) {
          isOpen = false;
          if (!resolved) { resolved = true; reject(new Error("ws_closed")); }
          if (onClose) {
            try { onClose(event); } catch (e) { /* ignore */ }
          }
          ws = null;
        };
      });
    }

    function flushPending() {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      while (pendingMessages.length > 0) {
        ws.send(pendingMessages.shift());
      }
    }

    function send(data) {
      var payload = JSON.stringify(data);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      } else {
        pendingMessages.push(payload);
      }
    }

    function sendAudio(base64Data) {
      send({
        realtimeInput: {
          audio: {
            data: base64Data,
            mimeType: "audio/pcm;rate=16000",
          },
        },
      });
    }

    function sendText(text) {
      send({
        realtimeInput: {
          text: String(text || ""),
        },
      });
    }

    function close() {
      pendingMessages.length = 0;
      if (ws) {
        try { ws.close(1000, "user_close"); } catch (e) { /* ignore */ }
        ws = null;
      }
      isOpen = false;
    }

    function setOnMessage(fn) {
      onMessage = typeof fn === "function" ? fn : null;
    }

    function setOnClose(fn) {
      onClose = typeof fn === "function" ? fn : null;
    }

    function setOnError(fn) {
      onError = typeof fn === "function" ? fn : null;
    }

    return {
      connect: connect,
      send: send,
      sendAudio: sendAudio,
      sendText: sendText,
      close: close,
      setOnMessage: setOnMessage,
      setOnClose: setOnClose,
      setOnError: setOnError,
      get isOpen() { return isOpen; },
    };
  }

  global.TasuVoiceCoreGeminiLiveTransport = {
    createGeminiLiveTransport: createGeminiLiveTransport,
  };
})(window);
