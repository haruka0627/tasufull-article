/**
 * TASFUL AI Workspace — Gemini Live 音声会話
 * Phase 3: CF Pages WebSocket Proxy 経由で Gemini Live API に接続
 * APIキーは CF Pages Function 内でのみ参照。ブラウザには一切露出しない。
 *
 * 経路:
 *   ai-workspace-live.js → WebSocket /api/gemini-live-proxy → CF Function → Gemini Live
 */
(function (global) {
  "use strict";

  var LIVE_MODE = "gemini-live";

  /* ---- 状態 ---- */
  var isLiveActive = false;
  var isLiveConnecting = false;
  var ws = null;
  var audioContext = null;
  var micStream = null;
  var micSource = null;
  var micProcessor = null;
  var pendingAudioChunks = [];
  var sendInterval = null;
  var sessionStartTime = 0;
  var liveStartBtn = null;
  var liveStopBtn = null;
  var liveStateEl = null;

var PROXY_PORT = 8789;

  function getLiveProxyUrl() {
    // local dev: ws://127.0.0.1:8789 （Node.js proxy on 8789）
    // production: wss://gemini-live-proxy.tasful-article.workers.dev
    //
    // TODO: 本番カスタムドメイン確定後に URL を差し替える
    // TODO: Worker 側の ALLOWED_ORIGINS も同時に更新する
    // TODO: workers.dev のまま公開する場合、Origin check + session token で保護
    var hostname = global.location.hostname;
    if (hostname === "127.0.0.1" || hostname === "localhost") {
      return "ws://127.0.0.1:" + PROXY_PORT;
    }
    return "wss://gemini-live-proxy.tasful-article.workers.dev";
  }

  /* ---- AudioContext ---- */
  function getAudioContext() {
    if (!audioContext) {
      audioContext = new (global.AudioContext || global.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    return audioContext;
  }

  /* ---- PCM 24kHz → スピーカー ---- */
  function playPcmAudio(base64Data) {
    if (!base64Data) return;
    var binary = atob(base64Data);
    var len = binary.length;
    var pcm = new Int16Array(Math.floor(len / 2));
    for (var i = 0; i < len; i += 2) {
      pcm[i / 2] = binary.charCodeAt(i) | (binary.charCodeAt(i + 1) << 8);
    }
    var ctx = getAudioContext();
    var buffer = ctx.createBuffer(1, pcm.length, 24000);
    var channel = buffer.getChannelData(0);
    for (var j = 0; j < pcm.length; j++) {
      channel[j] = pcm[j] / 32768;
    }
    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  }

  /* ---- マイク → PCM 16kHz ---- */
  function startMicrophone() {
    if (micStream) return Promise.resolve(micStream);
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      micStream = stream;
      var ctx = getAudioContext();
      micSource = ctx.createMediaStreamSource(stream);
      micProcessor = ctx.createScriptProcessor(4096, 1, 1);
      micProcessor.onaudioprocess = function (event) {
        if (!isLiveActive || !ws || ws.readyState !== WebSocket.OPEN) return;
        var input = event.inputBuffer.getChannelData(0);
        var inRate = ctx.sampleRate;
        var ratio = inRate / 16000;
        var outLen = Math.floor(input.length / ratio);
        var pcm = new Int16Array(outLen);
        for (var i = 0; i < outLen; i++) {
          var idx = Math.floor(i * ratio);
          pcm[i] = Math.max(-32768, Math.min(32767, Math.round(input[Math.min(idx, input.length - 1)] * 32767)));
        }
        pendingAudioChunks.push(pcm);
      };
      micSource.connect(micProcessor);
      micProcessor.connect(ctx.destination);
      return stream;
    });
  }

  function stopMicrophone() {
    clearInterval(sendInterval);
    sendInterval = null;
    if (micProcessor) { try { micProcessor.disconnect(); } catch (e) {} micProcessor = null; }
    if (micSource) { try { micSource.disconnect(); } catch (e) {} micSource = null; }
    if (micStream) { micStream.getTracks().forEach(function (t) { t.stop(); }); micStream = null; }
    if (audioContext) {
      try { audioContext.close(); } catch (e) {}
      audioContext = null;
    }
    pendingAudioChunks.length = 0;
  }

  /* ---- 音声送信（200ms 間隔）---- */
  function startSendingAudio() {
    stopSendingAudio();
    pendingAudioChunks.length = 0;
    sendInterval = setInterval(function () {
      if (!isLiveActive || !ws || ws.readyState !== WebSocket.OPEN) return;
      if (pendingAudioChunks.length === 0) return;
      var totalLen = 0;
      for (var i = 0; i < pendingAudioChunks.length; i++) totalLen += pendingAudioChunks[i].length;
      var combined = new Int16Array(totalLen);
      var offset = 0;
      for (var j = 0; j < pendingAudioChunks.length; j++) {
        combined.set(pendingAudioChunks[j], offset);
        offset += pendingAudioChunks[j].length;
      }
      pendingAudioChunks.length = 0;
      var bytes = new Uint8Array(combined.buffer, combined.byteOffset, combined.byteLength);
      var bin = "";
      for (var k = 0; k < bytes.length; k++) bin += String.fromCharCode(bytes[k]);
      ws.send(JSON.stringify({ realtimeInput: { audio: { data: btoa(bin), mimeType: "audio/pcm;rate=16000" } } }));
    }, 200);
  }

  function stopSendingAudio() {
    clearInterval(sendInterval);
    sendInterval = null;
  }

  /* ---- セッション開始（WebSocket Proxy 経由）---- */
  function startLiveSession() {
    if (isLiveActive || isLiveConnecting || ws) {
      return Promise.reject(new Error("already_active"));
    }
    isLiveConnecting = true;

    // SpeechRecognition を停止（排他制御）
    if (global.TasuSpeechRecognition && global.TasuSpeechRecognition.isActive()) {
      global.TasuSpeechRecognition.stop();
    }

    return new Promise(function (resolve, reject) {
      // まず session token を取得（Supabase JWT 認証付き）
      var tokenHeaders = { "Content-Type": "application/json" };
      // Supabase セッションがあれば JWT を送信
      if (global.TASU_CHAT_SUPABASE_CONFIG) {
        var supabase = global.TASU_CHAT_SUPABASE_CONFIG;
        if (supabase.auth && supabase.auth.access_token) {
          tokenHeaders["Authorization"] = "Bearer " + supabase.auth.access_token;
        }
      }
      fetch("/api/gemini-live-session", { method: "POST", headers: tokenHeaders })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data.ok || !data.token) {
            isLiveConnecting = false;
            updateUI("error", data.reason || "セッション開始不可");
            reject(new Error(data.error || "session_token_failed"));
            return;
          }

          var proxyUrl = getLiveProxyUrl() + "?session=" + encodeURIComponent(data.token);

      ws = new WebSocket(proxyUrl);
      var resolved = false;

      ws.onopen = function () {
        ws.send(JSON.stringify({
          setup: { model: "models/gemini-3.1-flash-live-preview", generationConfig: { responseModalities: ["AUDIO"] } }
        }));
        updateUI("connecting");
      };

      ws.onmessage = function (event) {
        try {
          var msg = JSON.parse(event.data);

          if (msg.setupComplete) {
            isLiveConnecting = false;
            isLiveActive = true;
            sessionStartTime = Date.now();
            updateUI("listening");
            startMicrophone().then(function () {
              startSendingAudio();
              if (!resolved) { resolved = true; resolve({ ok: true }); }
            }).catch(function (err) {
              stopLiveSession();
              updateUI("error", err.message);
              if (!resolved) { resolved = true; reject(err); }
            });
            return;
          }

          if (msg.serverContent) {
            var sc = msg.serverContent;
            if (sc.modelTurn && Array.isArray(sc.modelTurn.parts)) {
              for (var i = 0; i < sc.modelTurn.parts.length; i++) {
                var part = sc.modelTurn.parts[i];
                if (part.inlineData && part.inlineData.data) {
                  playPcmAudio(part.inlineData.data);
                  updateUI("speaking");
                }
              }
            }
          }

          if (msg.error) {
            updateUI("error", msg.error.message || "Gemini Live error");
            console.warn("[GeminiLive]", msg.error);
          }
        } catch (e) {
          /* parse error - ignore */
        }
      };

      ws.onerror = function () {
        isLiveConnecting = false;
        if (!resolved) { resolved = true; reject(new Error("ws_error")); }
        updateUI("error", "WebSocket 接続エラー");
      };

      ws.onclose = function () {
        isLiveConnecting = false;
        isLiveActive = false;
        stopSendingAudio();
        stopMicrophone();
        ws = null;
        updateUI("idle");
        var durationSec = Math.round((Date.now() - sessionStartTime) / 1000);
        if (durationSec > 0) logLiveSession(durationSec);
      };
        })
        .catch(function (err) {
          isLiveConnecting = false;
          stopSendingAudio();
          stopMicrophone();
          if (ws) {
            try { ws.close(); } catch (e) {}
            ws = null;
          }
          updateUI("error", err.message || "セッション開始不可");
          reject(err);
        });
    }); // close new Promise
  }

  function stopLiveSession() {
    if (!isLiveActive && !isLiveConnecting && !ws) return;
    isLiveConnecting = false;
    isLiveActive = false;
    stopSendingAudio();
    stopMicrophone();
    if (ws) {
      try { ws.close(1000, "user_close"); } catch (e) {}
      ws = null;
    }
    updateUI("idle");
    var durationSec = Math.round((Date.now() - sessionStartTime) / 1000);
    var durationMin = Math.max(1, Math.round(durationSec / 60));
    if (durationSec > 0) {
      logLiveSession(durationSec); // 監査用ログ
      consumeVoiceLiveQuota(durationMin); // quota 消費
    }
  }

  /* ---- Quota 消費 ---- */
  function consumeVoiceLiveQuota(durationMin) {
    // CF Pages Function を経由して consume_voice_live_minutes RPC を呼ぶ
    var tokenHeaders = { "Content-Type": "application/json" };
    if (global.TASU_CHAT_SUPABASE_CONFIG) {
      var supabase = global.TASU_CHAT_SUPABASE_CONFIG;
      if (supabase.auth && supabase.auth.access_token) {
        tokenHeaders["Authorization"] = "Bearer " + supabase.auth.access_token;
      }
    }
    fetch("/api/gemini-live-session", {
      method: "POST",
      headers: tokenHeaders,
      body: JSON.stringify({ consume_minutes: durationMin }),
    }).catch(function () { /* quota consume is best-effort */ });
  }

  /* ---- インタラクションログ ---- */
  function logLiveSession(durationSec) {
    var logger = global.TasuAiInteractionLog;
    if (!logger || !logger.appendInteractionLog) return;
    var plan = "free";
    if (global.TasuAiWorkspaceUsage) {
      plan = global.TasuAiWorkspaceUsage.readGenAiPlan().plan || "free";
    }
    logger.appendInteractionLog({
      event_type: "voice_live_session",
      modeId: "cross-matching",
      surface: "tasful_ai",
      provider: "gemini_live",
      selected_model: "gemini-3.1-flash-live-preview",
      selected_provider: "gemini",
      user_plan: plan,
      duration_sec: durationSec,
      duration_min: Math.round(durationSec / 60),
      note: "duration_sec:" + durationSec + " duration_min:" + Math.round(durationSec / 60),
    });
  }

  /* ---- UI ---- */
  function updateUI(state, detail) {
    if (liveStartBtn) liveStartBtn.hidden = (state !== "idle");
    if (liveStopBtn) liveStopBtn.hidden = (state === "idle" || state === "error");

    if (liveStateEl) {
      var labels = {
        idle: "",
        connecting: "接続中…",
        listening: "🎙 聞取中",
        speaking: "🔊 応答中",
        error: "⚠ " + (detail || "エラー")
      };
      liveStateEl.textContent = labels[state] || state;
      liveStateEl.hidden = (state === "idle");
    }

    if (state === "error") {
      if (liveStartBtn) liveStartBtn.hidden = false;
      if (liveStopBtn) liveStopBtn.hidden = true;
    }
  }

  function mountEndLiveBtn() {
    var endBtn = document.querySelector("[data-ai-composer-live-end]");
    if (!endBtn || endBtn.dataset.liveEndBound === "1") return;
    endBtn.dataset.liveEndBound = "1";
    endBtn.addEventListener("click", function () {
      startLiveSession().catch(function (err) {
        console.warn("[GeminiLive] start failed:", err.message);
      });
    });
  }

  function mountUI() {
    var menuSlot = document.querySelector("[data-ai-composer-live-slot]");
    if (!menuSlot || menuSlot.dataset.liveUiMounted === "1") return;
    menuSlot.dataset.liveUiMounted = "1";

    // Live 開始ボタン
    liveStartBtn = document.createElement("button");
    liveStartBtn.type = "button";
    liveStartBtn.className = "ai-ref-composer__menu-item";
    liveStartBtn.setAttribute("role", "menuitem");
    liveStartBtn.setAttribute("aria-label", "Live会話開始");
    liveStartBtn.innerHTML =
      '<span class="material-symbols-outlined" aria-hidden="true">headset_mic</span>' +
      '<span class="ai-ref-composer__menu-label">Live</span>';
    liveStartBtn.addEventListener("click", function () {
      startLiveSession().catch(function (err) {
        console.warn("[GeminiLive] start failed:", err.message);
      });
    });

    // Live 終了ボタン
    liveStopBtn = document.createElement("button");
    liveStopBtn.type = "button";
    liveStopBtn.className = "ai-ref-composer__menu-item";
    liveStopBtn.setAttribute("role", "menuitem");
    liveStopBtn.setAttribute("aria-label", "Live会話終了");
    liveStopBtn.innerHTML =
      '<span class="material-symbols-outlined" aria-hidden="true">stop_circle</span>' +
      '<span class="ai-ref-composer__menu-label">終了</span>';
    liveStopBtn.hidden = true;
    liveStopBtn.addEventListener("click", function () {
      stopLiveSession();
    });

    // 状態表示
    liveStateEl = document.createElement("span");
    liveStateEl.className = "ai-live-state ai-ref-composer__menu-live-state";
    liveStateEl.hidden = true;

    menuSlot.appendChild(liveStartBtn);
    menuSlot.appendChild(liveStopBtn);
    menuSlot.appendChild(liveStateEl);
  }

  function injectLiveStyles() {
    if (document.getElementById("tasu-live-styles")) return;
    var style = document.createElement("style");
    style.id = "tasu-live-styles";
    style.textContent =
      ".ai-live-state {" +
      "  font-size: 0.75rem; color: #6ee7b7; font-weight: 600;" +
      "  margin-left: 4px; white-space: nowrap;" +
      "}" +
      ".ai-live-state[hidden] { display: none; }";
    document.head.appendChild(style);
  }

  /* ---- Cloudflare Pages 本番互換性 ---- */
  /*
   * Gemini Live Proxy は WebSocketPair を使用する。
   * wrangler dev では動作確認済み。
   * Cloudflare Pages Functions 本番で WebSocketPair が動作しない場合は、
   * Cloudflare Workers へ移行する。
   */

  /* ---- 初期化 ---- */
  function init() {
    injectLiveStyles();

    // VoiceController に capture provider として登録（将来の統合経路用）
    var ctrl = global.TasuWorkspaceVoiceController;
    if (ctrl && ctrl.registerCaptureProvider) {
      ctrl.registerCaptureProvider(LIVE_MODE, {
        capture: function () {
          return startLiveSession().then(function () {
            return { ok: true, text: "", liveSession: true };
          });
        },
        stop: stopLiveSession,
        isSupported: function () { return true; },
      });
    }

    // UI をマウント
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        mountUI();
        mountEndLiveBtn();
      });
    } else {
      mountUI();
      mountEndLiveBtn();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ---- 公開API ---- */
  global.TasuWorkspaceLive = {
    LIVE_MODE: LIVE_MODE,
    startLiveSession: startLiveSession,
    stopLiveSession: stopLiveSession,
    get isLiveActive() { return isLiveActive; },
  };
})(window);
