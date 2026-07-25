/**
 * TASFUL AI Workspace — Gemini TTS 読み上げ
 * Phase 2: Supabase Edge Function 経由で Gemini TTS を呼び出し、AI回答を音声再生する
 * APIキーはフロントに露出させない（Edge Function 内でのみ参照）
 */
(function (global) {
  "use strict";

  var SURFACE = "ai-workspace";
  var PLAYING_CLASS = "tts-playing";
  var GENERATING_CLASS = "tts-generating";

  var currentAudio = null;
  var activeBtn = null;

  /* ---- Cloudflare Pages Function を呼び出す ---- */
  var EDGE_URL = "/api/gemini-tts";

  async function resolveAccessToken() {
    try {
      var client = global.TasuSupabaseClient?.getClient?.();
      if (client?.auth?.getSession) {
        var sessionRes = await client.auth.getSession();
        var token = sessionRes?.data?.session?.access_token;
        if (token) return String(token).trim();
      }
    } catch (_e) {
      /* ignore */
    }
    var config = global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
    return String(
      config?.auth?.access_token ||
        config?.session?.access_token ||
        global.TASU_SUPABASE_SESSION?.access_token ||
        ""
    ).trim();
  }

  /**
   * Gemini TTS を呼び出し base64 audio を返す
   * @param {string} text
   * @param {{ voice?: string, language?: string }} [options]
   * @returns {Promise<{ok: boolean, audioBase64?: string, error?: string}>}
   */
  async function fetchTts(text, options) {
    var opts = options || {};
    var token = await resolveAccessToken();
    if (!token) {
      return { ok: false, error: "auth_required" };
    }
    var headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    };

    try {
      var res = await fetch(EDGE_URL, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          text: text,
          voice: opts.voice,
          language: opts.language,
          surface: SURFACE,
        }),
      });

      var data = await res.json().catch(function () { return {}; });
      if (data.ok && data.audioBase64) {
        return { ok: true, audioBase64: data.audioBase64, mimeType: data.mimeType || "audio/wav" };
      }
      return { ok: false, error: String(data?.error || "tts_failed") };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /* ---- 音声再生 ---- */
  function stopCurrentAudio() {
    if (currentAudio) {
      try { currentAudio.pause(); } catch (e) { /* ignore */ }
      try { currentAudio.src = ""; } catch (e) { /* ignore */ }
      currentAudio = null;
    }
    clearActiveButton();
  }

  function clearActiveButton() {
    if (activeBtn) {
      activeBtn.classList.remove(PLAYING_CLASS, GENERATING_CLASS);
      activeBtn.setAttribute("aria-pressed", "false");
      var icon = activeBtn.querySelector(".material-symbols-outlined");
      if (icon) icon.textContent = "volume_up";
      var label = activeBtn.querySelector(".ai-message__action-label");
      if (label) label.textContent = "音声で聞く";
      activeBtn.disabled = false;
      activeBtn = null;
    }
  }

  function playAudioBase64(base64, mimeType, btn) {
    stopCurrentAudio();

    var mime = mimeType || "audio/wav";
    var audio = new Audio("data:" + mime + ";base64," + base64);

    audio.onplay = function () {
      currentAudio = audio;
      if (btn) {
        activeBtn = btn;
        btn.classList.remove(GENERATING_CLASS);
        btn.classList.add(PLAYING_CLASS);
        btn.setAttribute("aria-pressed", "true");
        var icon = btn.querySelector(".material-symbols-outlined");
        if (icon) icon.textContent = "pause";
        var label = btn.querySelector(".ai-message__action-label");
        if (label) label.textContent = "再生中";
        btn.disabled = false;
      }
    };

    audio.onended = function () {
      clearActiveButton();
      currentAudio = null;
      logTtsUsage(mime);
    };

    audio.onerror = function () {
      clearActiveButton();
      currentAudio = null;
      if (btn) {
        btn.classList.remove(PLAYING_CLASS, GENERATING_CLASS);
        var label = btn.querySelector(".ai-message__action-label");
        if (label) label.textContent = "再生失敗";
        btn.disabled = false;
        setTimeout(function () {
          if (label && label.textContent === "再生失敗") {
            label.textContent = "音声で聞く";
          }
        }, 3000);
      }
    };

    audio.play().catch(function () {
      clearActiveButton();
      currentAudio = null;
    });
  }

  /* ---- Gemini TTS Adapter（VoiceCore に登録するだけの構造） ---- */
  var geminiTtsAdapter = {
    id: "gemini-tts",
    synthesize: function (text, options) {
      return fetchTts(text, options).then(function (result) {
        if (!result.ok) throw new Error(result.error || "tts_failed");
        return { ok: true, adapter: "gemini-tts", audioBase64: result.audioBase64 };
      });
    },
  };

  /* ---- インタラクションログ ---- */
  function logTtsUsage(mimeType) {
    var logger = global.TasuAiInteractionLog;
    if (!logger?.appendInteractionLog) return;
    logger.appendInteractionLog({
      event_type: "voice_tts_play",
      modeId: "cross-matching",
      surface: SURFACE,
      provider: "gemini",
      selected_model: "gemini-tts",
      selected_provider: "gemini",
      note: String(mimeType || "audio/wav").slice(0, 40),
    });
  }

  /* ---- ボタンにクリックハンドラ追加 ---- */
  function handleTtsButtonClick(event) {
    var btn = event.currentTarget;
    if (!btn) return;

    // 再生中クリック → 停止
    if (btn.classList.contains(PLAYING_CLASS)) {
      stopCurrentAudio();
      return;
    }

    // 生成中クリック → 無視
    if (btn.classList.contains(GENERATING_CLASS)) return;

    var row = btn.closest(".ai-msg-row[data-ai-msg-index]");
    if (!row) return;

    // AI回答のテキストを抽出
    var contentEl = row.querySelector(".ai-message__content");
    var text = contentEl ? (contentEl.textContent || "").trim() : "";
    if (!text) return;

    // 5000文字制限
    if (text.length > 5000) text = text.slice(0, 5000);

    // 生成中UI
    btn.classList.add(GENERATING_CLASS);
    btn.disabled = true;
    var icon = btn.querySelector(".material-symbols-outlined");
    if (icon) icon.textContent = "downloading";
    var label = btn.querySelector(".ai-message__action-label");
    if (label) label.textContent = "生成中…";

    fetchTts(text).then(function (result) {
      if (result.ok && result.audioBase64) {
        playAudioBase64(result.audioBase64, result.mimeType, btn);
      } else {
        // エラー表示
        btn.classList.remove(GENERATING_CLASS);
        btn.disabled = false;
        if (icon) icon.textContent = "error";
        if (label) label.textContent = "音声の生成に失敗しました";
        setTimeout(function () {
          if (label) {
            label.textContent = "音声で聞く";
            if (icon) icon.textContent = "volume_up";
          }
        }, 3000);
      }
    }).catch(function () {
      btn.classList.remove(GENERATING_CLASS);
      btn.disabled = false;
      if (label) label.textContent = "音声の生成に失敗しました";
      setTimeout(function () {
        if (label) label.textContent = "音声で聞く";
        if (icon) icon.textContent = "volume_up";
      }, 3000);
    });
  }

  /* ---- AI回答に「音声で聞く」ボタンを追加 ---- */
  function injectTtsButtons() {
    var rows = document.querySelectorAll(".ai-msg-row[data-ai-msg-index]");
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.dataset.ttsInjected === "1") continue;
      row.dataset.ttsInjected = "1";

      var actionsBar = row.querySelector(".ai-message__actions");
      if (!actionsBar) continue;

      if (actionsBar.querySelector("[data-ai-message-tts]")) continue;

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ai-message__action";
      btn.setAttribute("data-ai-message-tts", "1");
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("title", "音声で聞く");
      btn.innerHTML =
        '<span class="material-symbols-outlined" aria-hidden="true">volume_up</span>' +
        '<span class="ai-message__action-label">音声で聞く</span>';
      btn.addEventListener("click", handleTtsButtonClick);

      // 「その他」ボタンの前に挿入
      var moreBtn = actionsBar.querySelector("[data-ai-message-more]");
      if (moreBtn) {
        actionsBar.insertBefore(btn, moreBtn);
      } else {
        actionsBar.appendChild(btn);
      }
    }
  }

  /* ---- MutationObserver で新着メッセージにも対応 ---- */
  function startObserver() {
    var chatEl = document.querySelector("[data-ai-chat-messages]");
    if (!chatEl) return;

    var observer = new MutationObserver(function () {
      injectTtsButtons();
    });

    observer.observe(chatEl, { childList: true, subtree: true });

    // 初回注入
    injectTtsButtons();
  }

  /* ---- スタイル注入 ---- */
  function injectStyles() {
    if (document.getElementById("tasu-tts-styles")) return;
    var style = document.createElement("style");
    style.id = "tasu-tts-styles";
    style.textContent =
      ".ai-message__action.tts-generating .material-symbols-outlined {" +
      "  animation: tasu-tts-spin 1s linear infinite;" +
      "}" +
      "@keyframes tasu-tts-spin {" +
      "  from { transform: rotate(0deg); }" +
      "  to { transform: rotate(360deg); }" +
      "}" +
      ".ai-message__action.tts-playing .material-symbols-outlined {" +
      "  color: #2563eb;" +
      "}" +
      ".ai-message__action.tts-playing::after {" +
      "  content: '';" +
      "  position: absolute;" +
      "  bottom: 0;" +
      "  left: 50%;" +
      "  transform: translateX(-50%);" +
      "  width: 24px;" +
      "  height: 2px;" +
      "  background: #2563eb;" +
      "  border-radius: 2px;" +
      "  animation: tasu-tts-bar 0.6s ease-in-out infinite alternate;" +
      "}" +
      "@keyframes tasu-tts-bar {" +
      "  from { opacity: 0.4; transform: translateX(-50%) scaleX(0.6); }" +
      "  to { opacity: 1; transform: translateX(-50%) scaleX(1); }" +
      "}" +
      "[data-ai-message-tts] {" +
      "  position: relative;" +
      "}";
    document.head.appendChild(style);
  }

  /* ---- 初期化 ---- */
  function init() {
    // Gemini TTS adapter を VoiceCore に登録（後方互換のため）
    var voiceCore = global.TasuAiVoiceCore;
    if (voiceCore?.setTtsAdapter) {
      voiceCore.setTtsAdapter(geminiTtsAdapter);
    }

    injectStyles();
    startObserver();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ---- 公開API ---- */
  global.TasuWorkspaceTts = {
    fetchTts: fetchTts,
    getAccessToken: resolveAccessToken,
    resolveAccessToken: resolveAccessToken,
    playAudioBase64: playAudioBase64,
    stop: stopCurrentAudio,
    adapter: geminiTtsAdapter,
  };
})(window);
