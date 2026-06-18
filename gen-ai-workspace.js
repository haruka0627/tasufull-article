/**
 * TASFUL 生成AIワークスペース（フロント土台）
 * 履歴・利用回数・添付UI・キャラ表示・音声読み上げ・マイキャラ設定
 */
(function () {
  "use strict";

  const STORAGE_HISTORY = "tasu_genai_history_";
  const STORAGE_USAGE = "tasu_genai_usage_count";
  const STORAGE_GENAI_USAGE = "tasu_genai_usage";
  const STORAGE_GENAI_PLAN = "tasu_genai_plan";
  const STORAGE_ATTACH = "tasu_genai_last_attach_name";
  const STORAGE_MY_CHARACTERS = "tasu_genai_my_characters";
  const STORAGE_ACTIVE_CHARACTER = "tasu_genai_active_character";

  const DEFAULT_CHARACTER_SRC = "images/ai-character.webp";
  const DEFAULT_CHARACTER_FALLBACK = "images/ai-character.png";

  const TASFUL_BUILTIN_CHARACTER_ID = "tasful_builtin";
  const TASFUL_CHARACTER_LABEL = "TASFUL AI キャラクター";
  const TASFUL_CHARACTER_SRC = "images/signup-ai-character.png";
  const TASFUL_CHARACTER_FALLBACK = "images/ai-character.png";
  const TASFUL_VRM_URL = "/models/vrm-sample.vrm";
  const DEFAULT_MOUTH = { mouthX: 50, mouthY: 45, mouthScale: 1 };
  const CHAR_IMAGE_MAX_DIMENSION = 960;
  const CHAR_IMAGE_JPEG_QUALITY = 0.82;
  const CHAR_IMAGE_MAX_DATA_URL_CHARS = 700_000;
  const CHAR_IMAGE_MAX_FILE_BYTES = 12 * 1024 * 1024;
  const CHAR_IMAGE_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const CHAR_IMAGE_STORAGE_BUCKET = "gen-ai-characters";

  const GENAI_USAGE_TYPES = {
    TEXT_CHAT: "text_chat",
    VOICE_CHAT: "voice_chat",
    IMAGE_CHARACTER: "image_character",
  };

  const DEFAULT_GENAI_PLAN = {
    plan: "free",
    label: "無料枠",
    dailyTextLimit: 5,
    dailyVoiceLimit: 5,
    dailyImageLimit: 3,
  };

  const GENAI_USAGE_LABELS = {
    text_chat: "テキスト会話",
    voice_chat: "音声会話",
    image_character: "画像キャラ保存",
  };

  const PLACEHOLDERS = {
    "AIキャラ会話": "話したいキャラクターの性格や口調、相談内容を入力してください...",
    "マイAIキャラ作成": "作りたいキャラクターの見た目・性格・話し方・用途を入力してください...",
    "画像キャラ化AI": "キャラ化したい画像をアップロードして、性格や話し方を入力してください...",
    "音声会話AI": "AIと音声で話したい内容を入力してください...",
    "汎用チャット": "質問や相談内容を入力してください...",
    "文章作成": "作りたい文章の種類・用途・トーンを入力してください...",
    "画像解析": "解析したい画像を添付するか、内容について入力してください...",
    "PDF要約": "要約したいPDFを添付するか、質問内容を入力してください...",
  };

  const TOOL_DESCRIPTIONS = {
    "AIキャラ会話": "キャラクターと会話するモード",
    "マイAIキャラ作成": "性格・話し方・見た目を設定して、自分だけのAIキャラを作る",
    "画像キャラ化AI": "アップロードした画像をもとにAIキャラを作る",
    "音声会話AI": "AIの返答を音声で聞ける会話モード",
    "汎用チャット": "自由な質問・相談に対応",
    "文章作成": "掲載文・返信文・資料のたたき台を作成",
    "画像解析": "画像から要点を読み取り提案",
    "PDF要約": "PDFの内容を要約・質問応答",
  };

  const CHARACTER_TOOLS = [
    { mode: "AIキャラ会話", icon: "💬", character: true },
    { mode: "マイAIキャラ作成", icon: "✨", character: true },
    { mode: "画像キャラ化AI", icon: "🖼️", character: true },
    { mode: "音声会話AI", icon: "🔊", character: true },
  ];

  const GENERIC_TOOLS = [
    { mode: "汎用チャット", icon: "🤖" },
    { mode: "文章作成", icon: "✍️" },
    { mode: "画像解析", icon: "👁️" },
    { mode: "PDF要約", icon: "📄" },
  ];

  const ALL_TOOLS = [...CHARACTER_TOOLS, ...GENERIC_TOOLS];
  const SPEECH_MODES = ["音声会話AI", "AIキャラ会話"];
  const CHARACTER_STAGE_MODES = [
    "AIキャラ会話",
    "音声会話AI",
    "マイAIキャラ作成",
    "画像キャラ化AI",
  ];
  const CHARACTER_PICKER_MODES = ["AIキャラ会話", "音声会話AI", "マイAIキャラ作成"];
  const GEMINI_CHARACTER_MODES = new Set([
    "AIキャラ会話",
    "音声会話AI",
    "マイAIキャラ作成",
    "画像キャラ化AI",
  ]);
  const GEMINI_HISTORY_LIMIT = 20;
  const STORAGE_AUTO_SEND_VOICE = "tasu_genai_auto_send_voice";

  const DEFAULT_MODE = "汎用チャット";

  /** URL ?mode= スラッグ（ai-workspace からの引き継ぎ） */
  const GENAI_MODE_URL_SLUGS = {
    "character-chat": "AIキャラ会話",
    "voice-chat": "音声会話AI",
    "my-character": "マイAIキャラ作成",
    "image-character": "画像キャラ化AI",
  };

  function resolveModeFromQuery() {
    const requested = String(new URLSearchParams(location.search).get("mode") || "").trim();
    if (GENAI_MODE_URL_SLUGS[requested]) return GENAI_MODE_URL_SLUGS[requested];
    if (ALL_TOOLS.some((t) => t.mode === requested)) return requested;
    return "";
  }

  /** @type {string|null} */
  let charFormImageData = null;
  /** @type {string|null} */
  let charFormImageUrl = null;
  /** @type {string|null} */
  let pendingCharImageData = null;
  /** @type {string|null} */
  let pendingCharImageUrl = null;
  /** @type {boolean} */
  let charFormImageDirty = false;
  /** @type {boolean} 画像解析で image_character を消費済み（保存時は二重消費しない） */
  let charFormImageAnalyzed = false;
  /** @type {boolean} 同一画像での解析 API 回数課金済み */
  let charFormImageUsageCharged = false;
  /** @type {string|null} */
  let charFormImageFingerprint = null;
  /** @type {string|null} */
  let charFormAppearanceGeneratedAt = null;
  /** @type {"ai"|"manual"} */
  let charFormAppearanceSource = "manual";
  /** @type {boolean} */
  let charFormSeedGenerated = false;
  /** @type {string|null} */
  let charFormSeedGeneratedAt = null;
  /** @type {"ai"|"manual"} */
  let charFormSeedSource = "manual";
  let charFormMouthAutoEstimated = false;
  let charFormMouthAutoEstimatedAt = null;
  /** @type {"heuristic"|"ai"|"manual"} */
  let charFormMouthEstimateSource = "manual";
  /** @type {"face_closeup"|"bust_up"|"full_body"|"unknown"} */
  let charFormMouthEstimateComposition = "unknown";
  let mouthEstimateBusy = false;

  const MOUTH_COMPOSITION = {
    FACE_CLOSEUP: "face_closeup",
    BUST_UP: "bust_up",
    FULL_BODY: "full_body",
    UNKNOWN: "unknown",
  };

  const MOUTH_COMPOSITION_LABELS = {
    face_closeup: "顔アップ画像",
    bust_up: "バストアップ画像",
    full_body: "全身画像",
    unknown: "画像",
  };
  /** @type {string|null} */
  let pendingCharAppearanceMemo = null;
  /** @type {object|null} */
  let pendingCharSeed = null;
  /** @type {object|null} */
  let pendingCharMouthEstimate = null;
  /** @type {boolean} */
  let pendingCharImageAnalyzed = false;
  /** @type {string|null} */
  let pendingCharImageFingerprint = null;
  /** @type {boolean} */
  let imageAnalyzeBusy = false;

  /** 音声入力ハンズフリー状態 */
  let isListening = false;
  let isSpeaking = false;
  let isSending = false;
  /** @type {"idle"|"submitting"|"responding"} */
  let voiceSendPhase = "idle";
  let autoSendVoice = true;
  let handsFreeMicActive = false;
  let voiceTurnBusy = false;
  let micToggleLock = false;
  let listenRestartSuppressed = 0;
  /** @type {SpeechRecognition|null} */
  let speechRecognition = null;
  let listenRestartTimer = null;
  let voiceStatusTimer = null;

  /** キャラステージ表示: 2d | live（画像疑似アニメ）| 3d */
  const STORAGE_STAGE_RENDERER = "tasu_genai_stage_renderer";
  const STORAGE_TRIPO_TEST_DONE = "tasu_tripo_test_generate_done";
  const STORAGE_TRIPO_LAST_RESULT = "tasu_tripo_last_test_result";
  const STORAGE_TRIPO_PENDING_3D = "tasu_genai_pending_3d_tasks";
  const STORAGE_VRM_BLOB_URLS = "tasu_genai_vrm_blob_urls";
  const TRIPO_TEST_TASK_ID = "5c1b78ec-410e-4932-ad94-d8e5bb6e4f3e";
  const STORAGE_GENAI_DEV_MODE = "tasu_genai_dev_mode";
  const TRIPO_3D_MSG = {
    BEFORE: "この画像から3Dモデルを生成します",
    GENERATING: "3Dモデルを生成中です。1〜2分ほどかかります",
    SUCCESS: "3Dモデルが完成しました",
    FAIL: "3D生成に失敗しました。チケットは消費されていません",
    NO_TICKET: "3D生成にはチケットが必要です",
    NO_IMAGE: "キャラ画像を設定してから3Dモデルを生成できます",
    UPDATING_URL: "3DモデルURLを更新しています",
    LOAD_FAIL: "3Dモデルの読み込みに失敗しました。再取得してください",
    LOADING: "3Dモデルを読み込み中です",
    DISPLAYING: "保存済みの3Dモデルを表示しています",
  };
  const PROD_3D_COMPLETE_NOTE = TRIPO_3D_MSG.SUCCESS;
  const STORAGE_3D_PROD_IN_PROGRESS = "tasu_genai_3d_prod_in_progress";
  const PROD_3D_POLL_MS = 12000;
  const PROD_3D_MAX_WAIT_MS = 600000;
  let stageRendererMode = "2d";
  let genAi3dPinnedNote = null;
  let tripo3dLastDetails = null;
  let tripo3dDetailsExpanded = false;
  let liveBlinkTimeout = null;
  let lastStageAutoImageSrc = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatText(text) {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  function generateCharacterId() {
    return "char_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  }

  function getSpeechRecognitionCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function isSpeechRecognitionSupported() {
    return Boolean(getSpeechRecognitionCtor());
  }

  function loadAutoSendVoicePreference() {
    try {
      return localStorage.getItem(STORAGE_AUTO_SEND_VOICE) !== "0";
    } catch {
      return true;
    }
  }

  function saveAutoSendVoicePreference(enabled) {
    autoSendVoice = Boolean(enabled);
    try {
      localStorage.setItem(STORAGE_AUTO_SEND_VOICE, autoSendVoice ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const setAutoSendVoicePreference = saveAutoSendVoicePreference;

  function resolveVoiceStatusKey() {
    if (isListening) return "listening";
    if (isSpeaking) return "speaking";
    if (isSending && voiceSendPhase === "submitting") return "sending";
    if (isSending) return "responding";
    if (handsFreeMicActive) return "standby";
    return "idle";
  }

  function getMicButtonLabel() {
    if (!isSpeechRecognitionSupported()) return "🎙 話す";
    if (isListening) return "聞き取り中…";
    if (handsFreeMicActive) return "停止";
    return "🎙 話す";
  }

  function showVoiceStatus(message, { persistMs = 0, isError = false } = {}) {
    const text = String(message || "");
    const statusKey = isError ? "error" : resolveVoiceStatusKey();
    [$("[data-gen-ai-voice-status]"), $("[data-gen-ai-voice-status-form]")].forEach((el) => {
      if (!el) return;
      el.textContent = text;
      el.setAttribute("data-voice-status", statusKey);
      el.classList.toggle("is-active", Boolean(text) && !isError);
      el.classList.toggle("is-error", Boolean(text) && isError);
    });
    if (voiceStatusTimer) clearTimeout(voiceStatusTimer);
    if (text && persistMs > 0) {
      voiceStatusTimer = setTimeout(() => {
        if (!isListening && !isSpeaking && !isSending && !voiceTurnBusy) updateVoiceInputUi();
      }, persistMs);
    }
  }

  function suppressListenRestartOnce() {
    listenRestartSuppressed += 1;
  }

  function mapRecognitionError(code) {
    switch (code) {
      case "not-allowed":
      case "service-not-allowed":
        return { message: "マイクの使用が許可されていません", isError: true, stopMic: true };
      case "no-speech":
        return { message: "聞き取れませんでした", isError: false, stopMic: false };
      case "network":
        return { message: "音声認識の通信エラーです", isError: true, stopMic: false };
      case "audio-capture":
        return { message: "マイクが見つかりません", isError: true, stopMic: true };
      case "aborted":
        return { message: "", isError: false, stopMic: false };
      default:
        return { message: "聞き取れませんでした", isError: false, stopMic: false };
    }
  }

  function canStartListening() {
    return (
      isSpeechRecognitionSupported() &&
      !isListening &&
      !isSpeaking &&
      !isSending &&
      !voiceTurnBusy &&
      handsFreeMicActive
    );
  }

  function isVoiceDebugEnabled() {
    try {
      if (new URLSearchParams(globalThis.location?.search || "").get("voice_debug") === "1") {
        return true;
      }
      return localStorage.getItem("tasu_genai_voice_debug") === "1";
    } catch {
      return false;
    }
  }

  function updateVoiceDebugPanel() {
    const el = $("[data-gen-ai-voice-debug]");
    if (!el) return;
    if (!isVoiceDebugEnabled()) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    const st = getVoiceInputState();
    const bodySpeaking = document.body?.getAttribute("data-ai-speaking") === "true";
    const statusKey = resolveVoiceStatusKey();
    const synthBusy = Boolean(
      window.speechSynthesis?.speaking || window.speechSynthesis?.pending
    );
    el.textContent = [
      `voice-status=${statusKey}`,
      `body-speaking=${bodySpeaking}`,
      `listening=${st.isListening}`,
      `speaking=${st.isSpeaking}`,
      `sending=${st.isSending}`,
      `phase=${st.voiceSendPhase}`,
      `mic=${st.handsFreeMicActive}`,
      `autoSend=${st.autoSendVoice}`,
      `synth=${synthBusy}`,
      `recognition=${st.supported}`,
    ].join(" | ");
  }

  function updateVoiceInputUi() {
    const micBtns = document.querySelectorAll("[data-gen-ai-mic]");
    const voiceInput = $("[data-gen-ai-voice-input]");
    const unsupportedNote = $("[data-gen-ai-voice-unsupported]");
    const autoToggle = $("[data-gen-ai-auto-send-voice]");
    const supported = isSpeechRecognitionSupported();

    if (autoToggle) autoToggle.checked = autoSendVoice;

    let statusText = "";
    let statusError = false;
    if (!supported) {
      statusText = "";
    } else if (isListening) {
      statusText = "聞き取り中…";
    } else if (isSpeaking) {
      statusText = "読み上げ中…";
    } else if (isSending && voiceSendPhase === "submitting") {
      statusText = "送信中…";
    } else if (isSending) {
      statusText = "応答中…";
    } else if (handsFreeMicActive) {
      statusText = "待機中（話しかけてください）";
    }

    if (statusText) showVoiceStatus(statusText, { isError: statusError });
    else showVoiceStatus("");

    syncStageAvatarState({
      speaking: isSpeaking,
      listening: isListening && handsFreeMicActive,
    });

    const micLabel = getMicButtonLabel();
    micBtns.forEach((btn) => {
      const disabled = !supported || isSpeaking || isSending || voiceTurnBusy;
      btn.hidden = !supported;
      btn.disabled = disabled;
      btn.classList.toggle("is-listening", isListening);
      btn.classList.toggle("is-active", handsFreeMicActive);
      btn.setAttribute("data-voice-status", resolveVoiceStatusKey());
      btn.setAttribute("aria-pressed", handsFreeMicActive ? "true" : "false");
      btn.setAttribute("aria-label", micLabel);
      const labelEl = btn.querySelector("[data-gen-ai-mic-label]");
      if (labelEl) labelEl.textContent = micLabel;
      else btn.textContent = micLabel;
    });

    if (voiceInput) voiceInput.hidden = !supported;
    if (unsupportedNote) unsupportedNote.hidden = supported;
    updateVoiceDebugPanel();
  }

  function clearListenRestartTimer() {
    if (listenRestartTimer) {
      clearTimeout(listenRestartTimer);
      listenRestartTimer = null;
    }
  }

  function scheduleListenRestart() {
    clearListenRestartTimer();
    if (listenRestartSuppressed > 0) {
      listenRestartSuppressed -= 1;
      return;
    }
    if (!handsFreeMicActive || isSpeaking || isSending || isListening || voiceTurnBusy) return;
    listenRestartTimer = setTimeout(() => {
      if (canStartListening()) startListening();
    }, 650);
  }

  function ensureSpeechRecognition() {
    if (speechRecognition) return speechRecognition;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return null;

    const rec = new Ctor();
    rec.lang = "ja-JP";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      isListening = true;
      updateVoiceInputUi();
    };

    rec.onend = () => {
      isListening = false;
      updateVoiceInputUi();
      scheduleListenRestart();
    };

    rec.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }

      const input = $("[data-gen-ai-input]");
      const preview = (finalText || interim).trim();
      if (input && preview && !finalText) input.value = preview;

      if (finalText.trim()) {
        void applyVoiceRecognitionResult(finalText.trim());
      }
    };

    rec.onerror = (event) => {
      isListening = false;
      const code = event?.error || "";
      const mapped = mapRecognitionError(code);
      if (mapped.message) {
        showVoiceStatus(mapped.message, { persistMs: mapped.isError ? 4000 : 2500, isError: mapped.isError });
        console.warn("[GenAi] SpeechRecognition error:", code);
      }
      if (mapped.stopMic) handsFreeMicActive = false;
      updateVoiceInputUi();
      if (handsFreeMicActive && code !== "aborted") scheduleListenRestart();
    };

    speechRecognition = rec;
    return rec;
  }

  function stopListening() {
    clearListenRestartTimer();
    isListening = false;
    if (!speechRecognition) return;
    try {
      speechRecognition.abort();
    } catch {
      try {
        speechRecognition.stop();
      } catch {
        /* ignore */
      }
    }
  }

  function startListening() {
    if (!canStartListening()) return false;
    const rec = ensureSpeechRecognition();
    if (!rec) return false;

    try {
      rec.start();
      return true;
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes("already started")) return true;
      console.warn("[GenAi] SpeechRecognition start failed:", err);
      showVoiceStatus("聞き取れませんでした", { persistMs: 2500 });
      return false;
    }
  }

  async function applyVoiceRecognitionResult(text) {
    voiceTurnBusy = true;
    suppressListenRestartOnce();
    clearListenRestartTimer();
    stopListening();

    try {
      if (!text) {
        showVoiceStatus("聞き取れませんでした", { persistMs: 2500 });
        return;
      }

      const input = $("[data-gen-ai-input]");
      if (input) input.value = text;

      if (autoSendVoice) {
        const modeId =
          $("[data-gen-ai-chat]")?.getAttribute("data-mode") || DEFAULT_MODE;
        const usageType = resolveUsageTypeForSend(modeId);
        if (!canUseGenAiFeature(usageType)) {
          showUsageLimitBlocked(usageType);
          return;
        }
        await sendMessage(text);
        return;
      }

      showVoiceStatus("認識しました。送信ボタンで送れます", { persistMs: 2000 });
    } finally {
      voiceTurnBusy = false;
      updateVoiceInputUi();
      if (!autoSendVoice) scheduleListenRestart();
    }
  }

  function toggleHandsFreeMic() {
    if (!isSpeechRecognitionSupported()) return;
    if (micToggleLock) return;

    micToggleLock = true;
    setTimeout(() => {
      micToggleLock = false;
    }, 320);

    if (handsFreeMicActive) {
      handsFreeMicActive = false;
      suppressListenRestartOnce();
      stopListening();
      showVoiceStatus("");
      updateVoiceInputUi();
      return;
    }

    if (isSending || isSpeaking || voiceTurnBusy) {
      showVoiceStatus("応答処理中です。完了後にもう一度お試しください", { persistMs: 2200 });
      return;
    }

    handsFreeMicActive = true;
    updateVoiceInputUi();
    if (canStartListening()) startListening();
  }

  function waitForSpeechEnd() {
    return new Promise((resolve) => {
      if (!window.speechSynthesis?.speaking) {
        resolve();
        return;
      }
      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed += 150;
        if (!window.speechSynthesis?.speaking) {
          clearInterval(timer);
          resolve();
        } else if (elapsed >= 90000) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  }

  function bindVoiceInputUi() {
    autoSendVoice = loadAutoSendVoicePreference();

    document.querySelectorAll("[data-gen-ai-mic]").forEach((btn) => {
      btn.addEventListener("click", () => toggleHandsFreeMic());
    });

    $("[data-gen-ai-auto-send-voice]")?.addEventListener("change", (e) => {
      saveAutoSendVoicePreference(e.target.checked);
    });

    updateVoiceInputUi();
  }

  function getVoiceInputState() {
    return {
      isListening,
      isSpeaking,
      autoSendVoice,
      handsFreeMicActive,
      isSending,
      voiceSendPhase,
      voiceTurnBusy,
      supported: isSpeechRecognitionSupported(),
    };
  }

  const SPEECH_SKIP_LINE_PATTERNS = [
    /^※/,
    /^【設定反映/,
    /^【キャラプレビュー/,
    /^【選択中キャラ/,
    /^【.*表示のみ/,
    /^---\s*$/,
    /^・キャラ名\s*[:：]/,
    /^・名前\s*[:：]/,
    /^・性格\s*[:：]/,
    /^・話し方\s*[:：]/,
    /^・一人称\s*[:：]/,
    /^・呼び方\s*[:：]/,
    /^・用途\s*[:：]/,
    /^・読み\s*[:：]/,
    /本番では/,
    /音声読み上げがONのとき/,
    /マイキャラを選択すると/,
    /^（添付\s*[:：]/,
    /^※本番では/,
  ];

  function getGeminiEndpoint() {
    const raw = window.TASU_CHAT_SUPABASE_CONFIG || window.TASU_SUPABASE_CONFIG || {};
    const base = String(raw.url || raw.SUPABASE_URL || "")
      .trim()
      .replace(/\/$/, "");
    const resolveKey =
      window.TasuSupabasePublicKey?.resolvePublishableAnonKey ||
      function fallbackResolve(config) {
        const k = String(config?.anonKey || config?.anon_key || "").trim();
        if (/^sb_secret_/i.test(k)) return "";
        return k;
      };
    const anonKey = resolveKey(raw);
    return {
      url: base ? `${base}/functions/v1/gemini-chat` : "",
      anonKey,
    };
  }

  function isGeminiConfigured() {
    const { url, anonKey } = getGeminiEndpoint();
    return Boolean(url && anonKey);
  }

  function getImageAnalyzeEndpoint() {
    const raw = window.TASU_CHAT_SUPABASE_CONFIG || window.TASU_SUPABASE_CONFIG || {};
    const base = String(raw.url || raw.SUPABASE_URL || "")
      .trim()
      .replace(/\/$/, "");
    const resolveKey =
      window.TasuSupabasePublicKey?.resolvePublishableAnonKey ||
      function fallbackResolve(config) {
        const k = String(config?.anonKey || config?.anon_key || "").trim();
        if (/^sb_secret_/i.test(k)) return "";
        return k;
      };
    const anonKey = resolveKey(raw);
    return {
      url: base ? `${base}/functions/v1/gemini-image-character-analyze` : "",
      anonKey,
    };
  }

  function isImageAnalyzeConfigured() {
    const { url, anonKey } = getImageAnalyzeEndpoint();
    return Boolean(url && anonKey);
  }

  function showImageAnalyzeStatus(message, isError, target = "form") {
    const selector =
      target === "mode"
        ? "[data-gen-ai-char-mode-analyze-status]"
        : "[data-gen-ai-char-analyze-status]";
    const el = $(selector);
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("is-error", Boolean(isError));
  }

  function getImageFingerprint(imageData, imageUrl) {
    const data = String(imageData || "");
    const url = String(imageUrl || "");
    if (data) return `d:${data.length}:${data.slice(0, 80)}`;
    if (url) return `u:${url}`;
    return null;
  }

  function resetCharFormImageAnalyzeState() {
    charFormImageAnalyzed = false;
    charFormImageUsageCharged = false;
    charFormImageFingerprint = null;
    charFormMouthAutoEstimated = false;
    charFormMouthAutoEstimatedAt = null;
    charFormMouthEstimateSource = "manual";
    charFormMouthEstimateComposition = MOUTH_COMPOSITION.UNKNOWN;
    charFormAppearanceGeneratedAt = null;
    charFormAppearanceSource = "manual";
    charFormSeedGenerated = false;
    charFormSeedGeneratedAt = null;
    charFormSeedSource = "manual";
  }

  function resetPendingImageAnalyzeState() {
    pendingCharAppearanceMemo = null;
    pendingCharSeed = null;
    pendingCharMouthEstimate = null;
    pendingCharImageAnalyzed = false;
    pendingCharImageFingerprint = null;
  }

  function getImageAnalyzeOverwrite(target = "form") {
    const sel =
      target === "mode"
        ? "[data-gen-ai-char-mode-overwrite-ai]"
        : "[data-gen-ai-char-overwrite-ai]";
    return Boolean($(sel)?.checked);
  }

  function chargeImageAnalyzeUsageOnce(fingerprint) {
    if (!fingerprint) return;
    if (charFormImageUsageCharged && charFormImageFingerprint === fingerprint) {
      return;
    }
    incrementGenAiUsage(GENAI_USAGE_TYPES.IMAGE_CHARACTER);
    charFormImageUsageCharged = true;
    charFormImageFingerprint = fingerprint;
    charFormImageAnalyzed = true;
  }

  function chargePendingImageAnalyzeUsageOnce(fingerprint) {
    if (!fingerprint) return;
    if (pendingCharImageAnalyzed && pendingCharImageFingerprint === fingerprint) {
      return;
    }
    incrementGenAiUsage(GENAI_USAGE_TYPES.IMAGE_CHARACTER);
    pendingCharImageAnalyzed = true;
    pendingCharImageFingerprint = fingerprint;
  }

  function applyAnalyzedAppearanceToForm(appearance, options = {}) {
    const text = String(appearance || "").trim().slice(0, 400);
    if (!text) return false;

    const field = $("[data-gen-ai-char-appearance]");
    if (!field) return false;

    const existing = String(field.value || "").trim();
    const mode = options.mode || (existing ? "confirm" : "replace");

    if (existing && mode === "confirm") {
      const append = window.confirm(
        "見た目メモに既に入力があります。AIの結果で上書きしますか？\n（キャンセルで末尾に追記します）"
      );
      if (append) {
        field.value = text;
      } else {
        const joined = `${existing} ${text}`.trim().slice(0, 400);
        field.value = joined;
      }
    } else if (existing && options.append) {
      field.value = `${existing} ${text}`.trim().slice(0, 400);
    } else {
      field.value = text;
    }

    charFormAppearanceSource = "ai";
    charFormAppearanceGeneratedAt = new Date().toISOString();
    return true;
  }

  function setFormFieldValue(selector, value, overwriteAll) {
    const el = $(selector);
    if (!el) return false;
    const next = String(value || "").trim();
    if (!next) return false;
    const existing = String(el.value || "").trim();
    if (existing && !overwriteAll) return false;
    el.value = next;
    return true;
  }

  function applyCharacterSeedToForm(seed, options = {}) {
    if (!seed || typeof seed !== "object") return { applied: 0 };
    const overwriteAll = Boolean(options.overwriteAll);
    let applied = 0;

    const map = [
      ["[data-gen-ai-char-name]", seed.name],
      ["[data-gen-ai-char-name-kana]", seed.nameReading],
      ["[data-gen-ai-char-personality]", seed.personality],
      ["[data-gen-ai-char-speaking]", seed.speakingStyle],
      ["[data-gen-ai-char-first-person]", seed.firstPerson],
      ["[data-gen-ai-char-user-call]", seed.userName],
      ["[data-gen-ai-char-user-call-kana]", seed.userNameReading],
      ["[data-gen-ai-char-purpose]", seed.purpose],
    ];

    map.forEach(([sel, val]) => {
      if (setFormFieldValue(sel, val, overwriteAll)) applied += 1;
    });

    if (seed.appearance || options.appearance) {
      const appearanceApplied = applyAnalyzedAppearanceToForm(
        seed.appearance || options.appearance,
        {
          mode: overwriteAll ? "replace" : "confirm",
          append: !overwriteAll,
        }
      );
      if (appearanceApplied) applied += 1;
    }

    charFormSeedGenerated = true;
    charFormSeedGeneratedAt = new Date().toISOString();
    charFormSeedSource = "ai";
    return { applied };
  }

  function applyPendingSeedToForm(overwriteAll) {
    if (!pendingCharSeed && !pendingCharAppearanceMemo) return;
    if (pendingCharSeed) {
      applyCharacterSeedToForm(
        { ...pendingCharSeed, appearance: pendingCharAppearanceMemo || pendingCharSeed.appearance },
        { overwriteAll, appearance: pendingCharAppearanceMemo }
      );
    } else if (pendingCharAppearanceMemo) {
      applyAnalyzedAppearanceToForm(pendingCharAppearanceMemo, {
        mode: overwriteAll ? "replace" : "replace",
      });
    }
    if (pendingCharImageAnalyzed) {
      charFormImageAnalyzed = true;
      charFormImageUsageCharged = true;
      charFormImageFingerprint = pendingCharImageFingerprint;
    }
  }

  async function analyzeCharacterImage(options = {}) {
    const target = options.target === "mode" ? "mode" : "form";
    const analyzeKind =
      options.analyzeKind === "seed" || options.includeSeed ? "seed" : "appearance";
    const imageData =
      options.imageData ?? (target === "mode" ? pendingCharImageData : charFormImageData);
    const imageUrl =
      options.imageUrl ?? (target === "mode" ? pendingCharImageUrl : charFormImageUrl);
    const fingerprint = getImageFingerprint(imageData, imageUrl);

    if (!imageData && !imageUrl) {
      showImageAnalyzeStatus("画像をアップロードしてください", true, target);
      return { ok: false };
    }

    if (!isImageAnalyzeConfigured()) {
      showImageAnalyzeStatus(
        "画像解析 API が未設定です。手入力してください。",
        true,
        target
      );
      return { ok: false };
    }

    const alreadyCharged =
      target === "mode"
        ? pendingCharImageAnalyzed && pendingCharImageFingerprint === fingerprint
        : charFormImageUsageCharged && charFormImageFingerprint === fingerprint;

    if (!alreadyCharged && !canUseGenAiFeature(GENAI_USAGE_TYPES.IMAGE_CHARACTER)) {
      showUsageLimitBlocked(GENAI_USAGE_TYPES.IMAGE_CHARACTER);
      showImageAnalyzeStatus("本日の画像キャラ回数の上限に達しました", true, target);
      return { ok: false };
    }

    const purpose =
      analyzeKind === "seed"
        ? "appearance_and_character_seed"
        : "appearance_only";

    const { url, anonKey } = getImageAnalyzeEndpoint();
    imageAnalyzeBusy = true;
    updateImageAnalyzeUi();

    try {
      showImageAnalyzeStatus(
        analyzeKind === "seed"
          ? "AIがキャラ設定を生成中…"
          : "AIが見た目を解析中…",
        false,
        target
      );
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          imageData: imageData || undefined,
          imageUrl: imageUrl || undefined,
          purpose,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok || !data.appearance) {
        const err = data.error || "解析できませんでした。手入力してください。";
        showImageAnalyzeStatus(err, true, target);
        return { ok: false, error: err };
      }

      const overwriteAll = getImageAnalyzeOverwrite(target);

      if (!alreadyCharged) {
        if (target === "mode") {
          chargePendingImageAnalyzeUsageOnce(fingerprint);
        } else {
          chargeImageAnalyzeUsageOnce(fingerprint);
        }
      } else if (target === "form") {
        charFormImageAnalyzed = true;
      }

      if (target === "mode") {
        pendingCharAppearanceMemo = String(data.appearance).trim();
        if (analyzeKind === "seed" && data.seed) {
          pendingCharSeed = { ...data.seed, appearance: pendingCharAppearanceMemo };
          showImageAnalyzeStatus(
            "キャラ設定案を生成しました。「マイキャラを作成」で反映できます。",
            false,
            target
          );
        } else {
          pendingCharSeed = null;
          showImageAnalyzeStatus(
            "見た目メモを生成しました。マイキャラ作成で反映できます。",
            false,
            target
          );
        }

        if (options.openForm) {
          await openMyCharacterFromStagedImage();
          applyPendingSeedToForm(overwriteAll);
          setCharStatus(
            analyzeKind === "seed"
              ? "キャラ設定案を反映しました。微調整して保存してください。"
              : "見た目メモを反映しました。性格・話し方を入力して保存してください。"
          );
        }
      } else {
        if (analyzeKind === "seed" && data.seed) {
          const { applied } = applyCharacterSeedToForm(
            { ...data.seed, appearance: data.appearance },
            { overwriteAll, appearance: data.appearance }
          );
          showImageAnalyzeStatus(
            `キャラ設定を ${applied} 項目反映しました。微調整して保存してください。`,
            false,
            target
          );
        } else {
          applyAnalyzedAppearanceToForm(data.appearance, {
            mode: overwriteAll ? "replace" : "confirm",
          });
          showImageAnalyzeStatus("見た目メモに反映しました。", false, target);
        }
      }

      if (data.mouthHint || data.composition) {
        let heuristic = estimateMouthHeuristic(640, 853);
        try {
          const dims = await loadImageDimensions(imageUrl || imageData);
          heuristic = estimateMouthHeuristic(dims.width, dims.height);
        } catch {
          /* ignore */
        }
        const merged = mergeMouthEstimates(heuristic, {
          composition: data.composition,
          mouthHint: data.mouthHint,
        });
        if (target === "form") {
          applyMouthEstimateToForm(merged, { source: "ai", auto: true });
        } else {
          pendingCharMouthEstimate = { ...merged, source: "ai" };
          applyCharacterMouthPosition(merged);
        }
      }

      return {
        ok: true,
        appearance: data.appearance,
        seed: data.seed || null,
        mouthHint: data.mouthHint || null,
        composition: data.composition || null,
      };
    } catch (err) {
      const msg = err?.message || "解析できませんでした。手入力してください。";
      showImageAnalyzeStatus(msg, true, target);
      return { ok: false, error: msg };
    } finally {
      imageAnalyzeBusy = false;
      updateImageAnalyzeUi();
    }
  }

  function updateImageAnalyzeUi() {
    const formWrap = $("[data-gen-ai-char-appearance-ai]");
    const formBtn = $("[data-gen-ai-char-analyze-btn]");
    const formSeedBtn = $("[data-gen-ai-char-seed-btn]");
    const modeBtn = $("[data-gen-ai-char-mode-analyze-btn]");
    const modeSeedBtn = $("[data-gen-ai-char-mode-seed-btn]");
    const hasFormImage = Boolean(charFormImageData);
    const hasModeImage = Boolean(pendingCharImageData);
    const canAnalyze = canUseGenAiFeature(GENAI_USAGE_TYPES.IMAGE_CHARACTER);
    const apiReady = isImageAnalyzeConfigured();
    const busy = imageAnalyzeBusy;

    if (formWrap) {
      formWrap.hidden = !hasFormImage;
    }
    const disableBtn = (btn, needsImage) => {
      if (btn) btn.disabled = busy || !needsImage || !canAnalyze || !apiReady;
    };
    disableBtn(formBtn, hasFormImage);
    disableBtn(formSeedBtn, hasFormImage);
    disableBtn(modeBtn, hasModeImage);
    disableBtn(modeSeedBtn, hasModeImage);
    updateMouthEstimateUi();
  }

  function buildGeminiCharacterPayload(character) {
    if (!character) return null;
    const c = normalizeCharacter(character);
    const hasProfile = Boolean(
      c.name || c.personality || c.speakingStyle || c.firstPerson || c.userCallName
    );
    if (!hasProfile) return null;

    return {
      name: c.name || "",
      nameReading: c.nameKana || "",
      personality: c.personality || "",
      speakingStyle: c.speakingStyle || "",
      firstPerson: c.firstPerson || "",
      userName: c.userCallName || "",
      userNameReading: c.userCallNameKana || "",
      appearance: c.appearanceMemo || "",
      purpose: c.purpose || "",
    };
  }

  function getCharacterForGemini(modeId) {
    if (!GEMINI_CHARACTER_MODES.has(modeId)) return null;
    if (modeId === "マイAIキャラ作成") {
      const draft = collectCharacterFromForm();
      if (draft?.name) return draft;
      return null;
    }
    return getDisplayCharacter();
  }

  function buildGeminiHistory(messages) {
    return (messages || [])
      .slice(-GEMINI_HISTORY_LIMIT)
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.content || "").slice(0, 2000),
      }))
      .filter((m) => m.content);
  }

  /**
   * ユーザー入力から Gemini 回答 intent を判定
   * @returns {"chat"|"work"|"business"|"support"}
   */
  function classifyGenAiIntent(message, modeId) {
    const text = String(message || "").trim();
    if (!text) return "chat";

    if (modeId === "音声会話AI") return "chat";

    if (modeId === "AIキャラ会話") {
      const explicitWork =
        /作って|まとめて|指示文|コード|SQL|実装|設計|プロンプト|仕様書|リファクタ/i.test(text);
      if (!explicitWork) return "chat";
    }

    const supportRe =
      /エラー|原因|どう直す|修正方法|直し方|バグ|例外|stack|ログ|動かない|表示されない|確認して|調査|デプロイ.*失敗|502|500/i;
    const businessRe =
      /事業|収益|単価|集客|プラン|料金|運用|TASFUL|ビジネス|売上|課金|サブスク|マネタイズ|収益性/i;
    const workRe =
      /作って|作成して|まとめて|書いて|指示|コード|SQL|修正|実装|設計|比較|分析|手順|企画|文案|ドラフト|下書き|プロンプト|仕様|リファクタ|関数|API|HTML|CSS|JavaScript|TypeScript|Cursor/i;

    if (supportRe.test(text)) return "support";
    if (businessRe.test(text)) return "business";
    if (workRe.test(text)) return "work";
    return "chat";
  }

  /**
   * Supabase Edge Function 経由で Gemini 2.5 Flash に問い合わせ
   * @returns {Promise<string|null>} 返答テキスト（失敗時 null → モックへフォールバック）
   */
  async function callGemini(message, options) {
    const { url, anonKey } = getGeminiEndpoint();
    if (!url || !anonKey) {
      console.warn("[GenAi] Gemini Error: Supabase URL / anon key not configured");
      return null;
    }

    const modeId = String(options?.mode || "").trim();
    const trimmedMessage = String(message || "").trim().slice(0, 2000);
    const intent = classifyGenAiIntent(trimmedMessage, modeId);

    const payload = {
      message: trimmedMessage,
      character: options?.character ?? null,
      history: buildGeminiHistory(options?.history || []),
      mode: modeId,
      intent,
      searchContext: options?.searchContext ? String(options.searchContext).slice(0, 6000) : undefined,
    };

    if (!payload.message && !payload.history.length) {
      console.warn("[GenAi] Gemini Error: empty message and history");
      return null;
    }

    console.log("[GenAi] Gemini Request", payload);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      const reply = String(data?.reply || "").trim();
      const usedGemini = data?.usedGemini === true && Boolean(reply);

      if (typeof data?.retryCount === "number" && data.retryCount > 0) {
        console.log(`[GenAi] Gemini retry success (retryCount=${data.retryCount})`);
      }
      if (data?.intent) {
        console.log(`[GenAi] Gemini intent=${data.intent}`);
      }

      if (!usedGemini || !reply) {
        console.warn("[GenAi] Gemini Error", {
          status: res.status,
          error: data?.error || "empty reply",
          usedGemini: data?.usedGemini,
          retryCount: data?.retryCount,
        });
        return null;
      }

      console.log("[GenAi] Gemini Response", reply);
      return reply;
    } catch (err) {
      console.warn("[GenAi] Gemini Error", err);
      return null;
    }
  }

  async function requestAssistantReply(modeId, userText, messages, attachName) {
    const rawText =
      String(userText || "").trim() ||
      (attachName ? `（添付: ${attachName}）` : "");

    if (global.TasuAiModelGateway?.completeTurn) {
      const turn = await global.TasuAiModelGateway.completeTurn({
        userText: rawText,
        modeId,
        messages,
        character: buildGeminiCharacterPayload(getCharacterForGemini(modeId)),
        surface: "gen-ai-workspace",
        mockFallback: () => mockReply(modeId, rawText, messages, attachName),
      });
      return {
        reply: turn.reply,
        usedGemini: turn.modelProvider === "gemini" && turn.usedRemote,
        search_used: turn.search_used,
        search_query: turn.search_query,
        search_provider: turn.search_provider,
        search_result_count: turn.search_result_count,
        uiBadgeHtml: turn.uiBadgeHtml,
        selected_model: turn.modelId,
        fallback_used: turn.fallback_used,
      };
    }

    const geminiReply = await callGemini(rawText, {
      mode: modeId,
      character: buildGeminiCharacterPayload(getCharacterForGemini(modeId)),
      history: (messages || []).slice(0, -1),
    });

    if (geminiReply) {
      return { reply: geminiReply, usedGemini: true, search_used: false };
    }

    return { reply: mockReply(modeId, rawText, messages, attachName), usedGemini: false, search_used: false };
  }

  function clampMouthValue(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function getMouthSettings(source) {
    const c = source && typeof source === "object" ? source : null;
    return {
      mouthX: clampMouthValue(c?.mouthX, 0, 100, DEFAULT_MOUTH.mouthX),
      mouthY: clampMouthValue(c?.mouthY, 0, 100, DEFAULT_MOUTH.mouthY),
      mouthScale: clampMouthValue(c?.mouthScale, 0.3, 2, DEFAULT_MOUTH.mouthScale),
    };
  }

  function normalizeComposition(value) {
    const v = String(value || "")
      .trim()
      .toLowerCase();
    if (v === MOUTH_COMPOSITION.FACE_CLOSEUP || v.includes("face") || v.includes("closeup")) {
      return MOUTH_COMPOSITION.FACE_CLOSEUP;
    }
    if (v === MOUTH_COMPOSITION.BUST_UP || v.includes("bust")) {
      return MOUTH_COMPOSITION.BUST_UP;
    }
    if (v === MOUTH_COMPOSITION.FULL_BODY || v.includes("full")) {
      return MOUTH_COMPOSITION.FULL_BODY;
    }
    return MOUTH_COMPOSITION.UNKNOWN;
  }

  function normalizeMouthHint(raw, compositionFallback) {
    if (!raw || typeof raw !== "object") return null;
    const x = clampMouthValue(raw.x ?? raw.mouthX, 0, 100, NaN);
    const y = clampMouthValue(raw.y ?? raw.mouthY, 0, 100, NaN);
    const scale = clampMouthValue(raw.scale ?? raw.mouthScale, 0.3, 2, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale)) return null;
    const confRaw = Number(raw.confidence);
    const confidence = Number.isFinite(confRaw) ? Math.min(1, Math.max(0, confRaw)) : 0.6;
    const composition = normalizeComposition(
      raw.composition || compositionFallback || MOUTH_COMPOSITION.UNKNOWN
    );
    return { mouthX: x, mouthY: y, mouthScale: scale, confidence, composition };
  }

  /**
   * 縦横比から構図を簡易判定（顔検出なし）
   */
  function detectCompositionHeuristic(width, height) {
    const w = Math.max(1, Number(width) || 1);
    const h = Math.max(1, Number(height) || 1);
    const ratio = w / h;
    const tallness = h / w;
    const near34 = Math.abs(ratio - 0.75) <= 0.1;

    if (tallness >= 1.85 || ratio < 0.52) {
      return MOUTH_COMPOSITION.FULL_BODY;
    }
    if (tallness >= 1.55 && ratio < 0.62) {
      return MOUTH_COMPOSITION.FULL_BODY;
    }
    if (
      ratio >= 0.7 &&
      ratio <= 0.85 &&
      tallness >= 1.15 &&
      tallness <= 1.45 &&
      near34
    ) {
      return MOUTH_COMPOSITION.FACE_CLOSEUP;
    }
    if (ratio >= 0.7 && ratio <= 0.85 && tallness >= 1.15 && tallness <= 1.45) {
      return MOUTH_COMPOSITION.FACE_CLOSEUP;
    }
    if (ratio >= 0.72 && ratio <= 0.92 && tallness > 1.45 && tallness < 1.85) {
      return MOUTH_COMPOSITION.BUST_UP;
    }
    if (ratio >= 0.62 && ratio <= 0.92 && tallness >= 1.15 && tallness < 1.85) {
      return MOUTH_COMPOSITION.BUST_UP;
    }
    return MOUTH_COMPOSITION.UNKNOWN;
  }

  function getMouthPresetForComposition(composition) {
    switch (composition) {
      case MOUTH_COMPOSITION.FACE_CLOSEUP:
        return { mouthX: 50, mouthY: 72, mouthScale: 0.85 };
      case MOUTH_COMPOSITION.BUST_UP:
        return { mouthX: 50, mouthY: 65, mouthScale: 0.9 };
      case MOUTH_COMPOSITION.FULL_BODY:
        return { mouthX: 50, mouthY: 52, mouthScale: 1 };
      default:
        return { mouthX: 50, mouthY: 65, mouthScale: 1 };
    }
  }

  /**
   * 画像の縦横比から口位置を簡易推定（構図別プリセット）
   */
  function estimateMouthHeuristic(width, height) {
    const composition = detectCompositionHeuristic(width, height);
    const preset = getMouthPresetForComposition(composition);
    return {
      ...preset,
      mouthY: Math.round(clampMouthValue(preset.mouthY, 0, 100, 65)),
      mouthScale: Number(clampMouthValue(preset.mouthScale, 0.3, 2, 1).toFixed(2)),
      composition,
      confidence: 0.55,
      source: "heuristic",
    };
  }

  function loadImageDimensions(src) {
    return new Promise((resolve, reject) => {
      const url = String(src || "").trim();
      if (!url) {
        reject(new Error("画像がありません"));
        return;
      }
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
      };
      img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      img.src = url;
    });
  }

  function mergeMouthEstimates(heuristic, aiPayload) {
    const aiComposition = normalizeComposition(
      aiPayload?.composition ||
        aiPayload?.mouthHint?.composition ||
        MOUTH_COMPOSITION.UNKNOWN
    );
    const hintRaw =
      aiPayload?.mouthHint && typeof aiPayload.mouthHint === "object"
        ? aiPayload.mouthHint
        : aiPayload?.mouthX !== undefined
          ? aiPayload
          : null;
    const hint = hintRaw ? normalizeMouthHint(hintRaw, aiComposition) : null;

    if (
      aiComposition === MOUTH_COMPOSITION.FACE_CLOSEUP ||
      aiComposition === MOUTH_COMPOSITION.BUST_UP ||
      aiComposition === MOUTH_COMPOSITION.FULL_BODY
    ) {
      const preset = getMouthPresetForComposition(aiComposition);
      if (hint && hint.confidence >= 0.35) {
        return {
          mouthX: hint.mouthX,
          mouthY: hint.mouthY,
          mouthScale: hint.mouthScale,
          composition: aiComposition,
          confidence: hint.confidence,
          source: "ai",
        };
      }
      return {
        ...preset,
        composition: aiComposition,
        confidence: 0.65,
        source: "ai",
      };
    }

    if (!hint || hint.confidence < 0.35) {
      return { ...heuristic, source: "heuristic" };
    }

    const w = Math.min(1, Math.max(0.35, hint.confidence));
    const blend = (a, b) => Math.round(a * (1 - w) + b * w);
    return {
      mouthX: blend(heuristic.mouthX, hint.mouthX),
      mouthY: blend(heuristic.mouthY, hint.mouthY),
      mouthScale: Number((heuristic.mouthScale * (1 - w) + hint.mouthScale * w).toFixed(2)),
      composition: hint.composition !== MOUTH_COMPOSITION.UNKNOWN ? hint.composition : heuristic.composition,
      confidence: hint.confidence,
      source: "ai",
    };
  }

  function formatMouthEstimateStatusMessage(estimate, source) {
    const comp = estimate?.composition || MOUTH_COMPOSITION.UNKNOWN;
    const label = MOUTH_COMPOSITION_LABELS[comp] || MOUTH_COMPOSITION_LABELS.unknown;
    const detail = `X ${estimate.mouthX}% / Y ${estimate.mouthY}% / 口 ${estimate.mouthScale}`;
    const via = source === "ai" ? "AI判定" : "簡易判定";
    return `${label}として口位置を自動設定しました（${via}: ${detail}）。必要なら微調整できます。`;
  }

  function showMouthEstimateStatus(message, isError, target = "form") {
    const sel =
      target === "mode"
        ? "[data-gen-ai-char-mode-mouth-estimate-status]"
        : "[data-gen-ai-char-mouth-estimate-status]";
    const el = $(sel);
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("is-error", Boolean(isError));
  }

  function updateMouthEstimateUi() {
    const hasFormImage = Boolean(charFormImageData || charFormImageUrl);
    const hasModeImage = Boolean(pendingCharImageData || pendingCharImageUrl);
    const busy = mouthEstimateBusy || imageAnalyzeBusy;

    $("[data-gen-ai-char-mouth-estimate-btn]")?.toggleAttribute("disabled", !hasFormImage || busy);
    $("[data-gen-ai-char-mode-mouth-estimate-btn]")?.toggleAttribute(
      "disabled",
      !hasModeImage || busy
    );
  }

  function applyMouthEstimateToForm(estimate, meta = {}) {
    const settings = getMouthSettings(estimate);
    setMouthFormValues(settings);
    applyCharacterMouthPosition(settings);
    previewMouthFromForm();

    const auto = meta.auto !== false;
    if (auto) {
      charFormMouthAutoEstimated = true;
      charFormMouthAutoEstimatedAt = new Date().toISOString();
      charFormMouthEstimateSource =
        meta.source === "ai" || meta.source === "heuristic" ? meta.source : "heuristic";
      charFormMouthEstimateComposition =
        estimate.composition || meta.composition || MOUTH_COMPOSITION.UNKNOWN;
    }
  }

  function markMouthManuallyAdjusted() {
    charFormMouthAutoEstimated = false;
    charFormMouthAutoEstimatedAt = null;
    charFormMouthEstimateSource = "manual";
    charFormMouthEstimateComposition = MOUTH_COMPOSITION.UNKNOWN;
  }

  async function fetchMouthHintFromAi(imageData, imageUrl) {
    const { url, anonKey } = getImageAnalyzeEndpoint();
    if (!url || !anonKey) return null;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        imageData: imageData || undefined,
        imageUrl: imageUrl || undefined,
        purpose: "mouth_hint_only",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return null;
    const composition = normalizeComposition(data.composition);
    const hint = data.mouthHint ? normalizeMouthHint(data.mouthHint, composition) : null;
    if (!hint && composition === MOUTH_COMPOSITION.UNKNOWN) return null;
    return { composition, mouthHint: hint };
  }

  /**
   * 口位置を自動推定（簡易推定 + 任意で AI mouthHint）
   * @returns {Promise<{ok: boolean, estimate?: object}>}
   */
  async function estimateMouthPosition(options = {}) {
    const target = options.target === "mode" ? "mode" : "form";
    const imageData =
      options.imageData ?? (target === "mode" ? pendingCharImageData : charFormImageData);
    const imageUrl =
      options.imageUrl ?? (target === "mode" ? pendingCharImageUrl : charFormImageUrl);
    const src = imageUrl || imageData;

    if (!src) {
      showMouthEstimateStatus("画像をアップロードしてください", true, target);
      return { ok: false };
    }

    mouthEstimateBusy = true;
    updateMouthEstimateUi();
    showMouthEstimateStatus("口位置を推定中…", false, target);

    try {
      let heuristic = estimateMouthHeuristic(640, 853);
      try {
        const dims = await loadImageDimensions(src);
        heuristic = estimateMouthHeuristic(dims.width, dims.height);
      } catch {
        /* デフォルト比率で推定 */
      }

      let finalEstimate = { ...heuristic };
      let source = "heuristic";

      if (options.tryAi !== false && isImageAnalyzeConfigured()) {
        try {
          const aiPayload = await fetchMouthHintFromAi(imageData, imageUrl);
          if (aiPayload) {
            finalEstimate = mergeMouthEstimates(heuristic, aiPayload);
            source = finalEstimate.source;
          }
        } catch (err) {
          console.warn("[GenAi] mouth AI hint failed:", err?.message || err);
        }
      }

      if (target === "mode") {
        pendingCharMouthEstimate = { ...finalEstimate, source };
        applyCharacterMouthPosition(finalEstimate);
        const previewChar = {
          ...(getActiveCharacter() || {}),
          imageData: imageData || getActiveCharacter()?.imageData,
          imageUrl: imageUrl || getActiveCharacter()?.imageUrl,
          ...getMouthSettings(finalEstimate),
        };
        applyCharacterStageImage(previewChar);
      } else {
        applyMouthEstimateToForm(finalEstimate, { source, auto: true });
      }

      showMouthEstimateStatus(formatMouthEstimateStatusMessage(finalEstimate, source), false, target);
      return { ok: true, estimate: finalEstimate, source };
    } catch (err) {
      const msg = err?.message || "口位置の推定に失敗しました";
      showMouthEstimateStatus(msg, true, target);
      return { ok: false, error: msg };
    } finally {
      mouthEstimateBusy = false;
      updateMouthEstimateUi();
    }
  }

  function applyCharacterMouthPosition(source) {
    const mouth = $("[data-character-mouth]");
    const stack = $("[data-gen-ai-stage-visual-stack]");
    const settings = getMouthSettings(source);
    if (mouth) {
      mouth.style.setProperty("--mouth-x", `${settings.mouthX}%`);
      mouth.style.setProperty("--mouth-y", `${settings.mouthY}%`);
      mouth.style.setProperty("--mouth-scale", String(settings.mouthScale));
    }
    if (stack) {
      stack.style.setProperty("--mouth-x", `${settings.mouthX}%`);
      stack.style.setProperty("--mouth-y", `${settings.mouthY}%`);
      stack.style.setProperty("--mouth-scale", String(settings.mouthScale));
      const eyeY = Math.max(20, Math.min(40, settings.mouthY - 13));
      stack.style.setProperty("--live-blink-y", `${eyeY}%`);
      stack.style.setProperty("--live-blink-left-x", "36%");
      stack.style.setProperty("--live-blink-right-x", "64%");
    }
  }

  function loadStageRendererPreference() {
    try {
      const v = localStorage.getItem(STORAGE_STAGE_RENDERER);
      if (v === "3d" || v === "live" || v === "2d") return v;
    } catch {
      /* ignore */
    }
    return "2d";
  }

  function saveStageRendererPreference(mode) {
    try {
      localStorage.setItem(STORAGE_STAGE_RENDERER, mode);
    } catch {
      /* ignore */
    }
  }

  function isGenericDefaultStageImageSrc(src) {
    const s = String(src || "");
    return s.includes("ai-character.webp") || s.includes("ai-character.png");
  }

  function characterHasCustomImage(character) {
    if (!character) return false;
    if (isTasfulBuiltinCharacter(character)) return true;
    const src = getStageImageSrc(character);
    if (!src) return false;
    if (String(src).startsWith("data:")) return true;
    if (/^https?:\/\//i.test(src)) return true;
    if (isGenericDefaultStageImageSrc(src)) return false;
    return src !== DEFAULT_CHARACTER_SRC;
  }

  function getRecommendedStageRenderer(character) {
    return characterHasCustomImage(character) ? "live" : "2d";
  }

  function applyStageRendererUi(mode) {
    const next = mode === "3d" ? "3d" : mode === "live" ? "live" : "2d";
    stageRendererMode = next;

    const stage = $("[data-ai-character-stage]");
    if (stage) {
      stage.classList.toggle("ai-character-stage--2d", next === "2d");
      stage.classList.toggle("ai-character-stage--3d", next === "3d");
      stage.classList.toggle("ai-character-stage--live", next === "live");
    }

    const layer2d = $("[data-gen-ai-stage-layer-2d]");
    const layerLive = $("[data-gen-ai-stage-layer-live]");
    const canvas = $("[data-gen-ai-char-3d-canvas]");
    if (layer2d) layer2d.hidden = next !== "2d";
    if (layerLive) layerLive.hidden = next !== "live";
    if (canvas) canvas.hidden = next !== "3d";

    document.querySelectorAll("[data-gen-ai-stage-renderer]").forEach((btn) => {
      const btnMode = btn.getAttribute("data-gen-ai-stage-renderer");
      const active = btnMode === next;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    const statusEl = $("[data-gen-ai-stage-3d-status]");
    if (statusEl) {
      statusEl.hidden = next !== "3d";
      if (next === "3d" && !statusEl.textContent.trim()) {
        statusEl.textContent = "3D: 読み込み中…";
      }
    }

    const actions3d = $("[data-gen-ai-3d-actions]");
    if (actions3d) actions3d.hidden = next !== "3d";

    if (next === "live") {
      startLiveBlinkLoop();
    } else {
      stopLiveBlinkLoop();
    }

    if (next === "3d") {
      updateGenAi3dPrepareUi();
      applyGenAi3dDevVisibility();
    }

    if (window.GenAiCharacter3D) {
      window.GenAiCharacter3D._rendererMode = next;
    }
  }

  function getTripoGenAiConfig() {
    return window.TasuTripoGenAiConfig || null;
  }

  function isTripoTestGenerateDone() {
    try {
      return localStorage.getItem(STORAGE_TRIPO_TEST_DONE) === "1";
    } catch {
      return false;
    }
  }

  function markTripoTestGenerateDone() {
    try {
      localStorage.setItem(STORAGE_TRIPO_TEST_DONE, "1");
    } catch {
      /* ignore */
    }
  }

  function isGenAiDevMode() {
    try {
      return localStorage.getItem(STORAGE_GENAI_DEV_MODE) === "1";
    } catch {
      return false;
    }
  }

  function applyGenAi3dDevVisibility() {
    const devOn = isGenAiDevMode();
    document.querySelectorAll("[data-gen-ai-3d-dev-only]").forEach((el) => {
      el.hidden = !devOn;
    });
    const toggle = $("[data-gen-ai-3d-details-toggle]");
    if (toggle) toggle.hidden = !tripo3dLastDetails;
  }

  function buildTripo3dDetailsHtml(data) {
    if (!data) return "";
    const rows = [];
    const push = (label, value) => {
      const v = String(value || "").trim();
      if (v) rows.push(`<p class="ai-character-stage__3d-result-line"><span>${label}:</span> ${escapeHtml(v)}</p>`);
    };
    push("taskId", data.taskId);
    push("modelUrl", data.modelUrl || data.downloadUrl);
    push("previewUrl", data.previewUrl);
    push("downloadUrl", data.downloadUrl);
    if (data.creditsUsed != null) push("creditsUsed", String(data.creditsUsed));
    push("errorMessage", data.errorMessage || data.error);
    push("traceId", data.traceId);
    if (data.status) push("status", data.status);
    if (data.tickets3dRemaining != null) {
      push("tickets3dRemaining", String(data.tickets3dRemaining));
    }
    return rows.join("");
  }

  function setTripo3dDetailsExpanded(expanded) {
    tripo3dDetailsExpanded = Boolean(expanded);
    const details = $("[data-gen-ai-3d-details]");
    const toggle = $("[data-gen-ai-3d-details-toggle]");
    if (details) details.hidden = !tripo3dDetailsExpanded;
    if (toggle) {
      toggle.setAttribute("aria-expanded", tripo3dDetailsExpanded ? "true" : "false");
      toggle.textContent = tripo3dDetailsExpanded ? "詳細を閉じる" : "詳細を表示";
    }
  }

  function renderTripo3dResultPanel(data, { isError = false, summaryText = "" } = {}) {
    const panel = $("[data-gen-ai-3d-result-panel]");
    const summaryHost = $("[data-gen-ai-3d-result-summary]");
    const detailsHost = $("[data-gen-ai-3d-details]");
    const toggle = $("[data-gen-ai-3d-details-toggle]");
    if (!panel || !summaryHost) return;

    if (!data) {
      tripo3dLastDetails = null;
      panel.hidden = true;
      summaryHost.innerHTML = "";
      if (detailsHost) detailsHost.innerHTML = "";
      setTripo3dDetailsExpanded(false);
      if (toggle) toggle.hidden = true;
      return;
    }

    tripo3dLastDetails = data;
    panel.hidden = false;

    const summary = summaryText
      ? summaryText
      : isError
        ? `<p class="ai-character-stage__3d-result-line ai-character-stage__3d-result-line--error">${escapeHtml(
            data.errorMessage || data.error || TRIPO_3D_MSG.FAIL
          )}</p>`
        : `<p class="ai-character-stage__3d-result-line"><strong>${escapeHtml(TRIPO_3D_MSG.SUCCESS)}</strong></p>`;

    summaryHost.innerHTML = summary;
    if (detailsHost) detailsHost.innerHTML = buildTripo3dDetailsHtml(data);
    if (toggle) {
      const hasDetails = Boolean(buildTripo3dDetailsHtml(data));
      toggle.hidden = !hasDetails;
      if (hasDetails) setTripo3dDetailsExpanded(tripo3dDetailsExpanded);
      else setTripo3dDetailsExpanded(false);
    }
  }

  function renderTripoTestResult(data, isError = false) {
    renderTripo3dResultPanel(data, { isError });
  }

  function renderTripoProductionSuccess(data) {
    renderTripo3dResultPanel(data, { isError: false, summaryText: "" });
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isGenAi3dProductionInProgress() {
    try {
      return sessionStorage.getItem(STORAGE_3D_PROD_IN_PROGRESS) === "1";
    } catch {
      return false;
    }
  }

  function setGenAi3dProductionInProgress(on) {
    try {
      if (on) sessionStorage.setItem(STORAGE_3D_PROD_IN_PROGRESS, "1");
      else sessionStorage.removeItem(STORAGE_3D_PROD_IN_PROGRESS);
    } catch {
      /* ignore */
    }
  }

  function applyServerTickets3dRemaining(remaining) {
    if (remaining === undefined || remaining === null) return;
    const plan = getGenAiPlan();
    saveGenAiPlan({
      ...plan,
      tickets3dRemaining: Math.max(0, Number(remaining) || 0),
    });
    updateGenAiUsageUi();
    renderGenAiPlanPanel();
  }

  async function callGenAi3dApi(body) {
    const cfg = getTripoGenAiConfig();
    const res = await fetch(cfg.healthCheckUrl, {
      method: "POST",
      headers: cfg.getHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data, httpStatus: res.status };
  }

  function setGenAi3dPinnedNote(text) {
    genAi3dPinnedNote = text ? String(text) : null;
    const note = $("[data-gen-ai-3d-prepare-status]");
    if (note && genAi3dPinnedNote) note.textContent = genAi3dPinnedNote;
  }

  function clearGenAi3dPinnedNote() {
    genAi3dPinnedNote = null;
  }

  function readPending3dTaskIds() {
    try {
      const raw = localStorage.getItem(STORAGE_TRIPO_PENDING_3D);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.map((x) => String(x).trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function rememberPending3dTask(taskId) {
    const id = String(taskId || "").trim();
    if (!id) return;
    const next = [...new Set([...readPending3dTaskIds(), id])].slice(-10);
    try {
      localStorage.setItem(STORAGE_TRIPO_PENDING_3D, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function forgetPending3dTask(taskId) {
    const id = String(taskId || "").trim();
    if (!id) return;
    const next = readPending3dTaskIds().filter((x) => x !== id);
    try {
      if (next.length) localStorage.setItem(STORAGE_TRIPO_PENDING_3D, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_TRIPO_PENDING_3D);
    } catch {
      /* ignore */
    }
  }

  function mapTripoApiPayload(data, fallbackTaskId = "") {
    if (!data) return null;
    const modelUrl = String(data.modelUrl || data.downloadUrl || "").trim();
    if (!modelUrl && data.status !== "failed" && data.status !== "expired" && !data.processing) {
      return null;
    }
    return {
      taskId: String(data.taskId || fallbackTaskId || "").trim() || null,
      status: data.status || (data.processing ? "processing" : data.ok ? "success" : "failed"),
      modelUrl: modelUrl || null,
      previewUrl: data.previewUrl || null,
      downloadUrl: data.downloadUrl || modelUrl || null,
      creditsUsed: data.creditsUsed ?? null,
      idempotent: Boolean(data.idempotent),
      processing: Boolean(data.processing),
      error: data.error || null,
      traceId: data.traceId || null,
      tickets3dRemaining: data.tickets3dRemaining,
    };
  }

  async function fetchTripoTaskPollOnce(taskId) {
    const cfg = getTripoGenAiConfig();
    if (!cfg?.healthCheckUrl || !taskId) return null;
    const { data } = await callGenAi3dApi({ action: "task_poll", taskId });
    if (!data?.modelUrl && !data?.done) return mapTripoApiPayload(data, taskId);
    if (!data?.modelUrl) return null;
    return mapTripoApiPayload(
      {
        taskId,
        status: data.status,
        modelUrl: data.modelUrl,
        previewUrl: data.previewUrl,
        downloadUrl: data.downloadUrl || data.modelUrl,
        creditsUsed: data.creditsUsed,
      },
      taskId
    );
  }

  async function fetchTripoCompleteGeneration(userId, characterId, taskId) {
    if (!userId || !characterId || !taskId) return null;
    const { data } = await callGenAi3dApi({
      action: "complete_generation",
      userId,
      characterId,
      taskId,
    });
    return mapTripoApiPayload(data, taskId);
  }

  async function refreshTripoGlbUrls(character, options = {}) {
    const c = character || getActiveCharacter();
    const taskId = String(c?.tripoTaskId || getTripoLastTestResult()?.taskId || "").trim();
    const storedTripo = String(c?.tripoModelUrl || "").trim();
    const storedModel = String(c?.modelUrl || "").trim();
    const userId = getGenAiUserId();
    const charId = c?.id || getActiveCharacterId();
    const allowComplete =
      options.allowCompleteGeneration !== false && Boolean(userId && charId && taskId);

    if (!options.forceRefresh && (storedTripo || storedModel)) {
      return {
        taskId: c?.tripoTaskId || taskId || null,
        status: "cached",
        modelUrl: storedTripo || storedModel,
        previewUrl: c?.tripoPreviewUrl || null,
        downloadUrl: c?.tripoDownloadUrl || storedTripo || storedModel,
        fromCache: true,
      };
    }

    if (allowComplete) {
      const fromDb = await fetchTripoCompleteGeneration(userId, charId, taskId);
      if (fromDb?.modelUrl) {
        saveCharacterTripoModel(charId, fromDb);
        return fromDb;
      }
      if (fromDb?.status === "success" && !fromDb.modelUrl) {
        return fromDb;
      }
      if (fromDb?.status === "failed" || fromDb?.status === "expired") {
        return fromDb;
      }
      if (fromDb?.processing) {
        return fromDb;
      }
    }

    if (taskId) {
      const polled = await fetchTripoTaskPollOnce(taskId);
      if (polled?.modelUrl) {
        if (charId) saveCharacterTripoModel(charId, polled);
        return polled;
      }
      if (polled) return polled;
    }

    if (storedTripo || storedModel) {
      return {
        taskId: c?.tripoTaskId || taskId || null,
        status: "cached",
        modelUrl: storedTripo || storedModel,
        previewUrl: c?.tripoPreviewUrl || null,
        downloadUrl: c?.tripoDownloadUrl || storedTripo || storedModel,
        fromCache: true,
      };
    }

    return null;
  }

  async function reconcileStale3dGenerations() {
    const userId = getGenAiUserId();
    if (!userId) return { ok: false, error: "no_user" };
    const { data } = await callGenAi3dApi({
      action: "reconcile_stale_generations",
      userId,
    });
    if (Array.isArray(data?.results)) {
      for (const row of data.results) {
        if (row.status === "success" || row.status === "failed" || row.status === "expired") {
          forgetPending3dTask(row.taskId);
        }
      }
    }
    return data;
  }

  async function loadTripoGlbInBackground(glbUrl, characterId, resolved) {
    return refresh3dStageAfterTripoSave(characterId, glbUrl);
  }

  async function refresh3dStageAfterTripoSave(characterId, glbUrl) {
    const statusEl = $("[data-gen-ai-stage-3d-status]");
    const id = resolveCharacterStorageId(characterId);
    const char = getCharacterById(id) || getActiveCharacter();
    const url = String(glbUrl || getCharacterTripoModelUrl(char) || "").trim();

    if (statusEl) statusEl.textContent = TRIPO_3D_MSG.LOADING;
    updateGenAi3dPrepareUi();

    try {
      await setStageRendererMode("3d", { save: true, skipTripoGlb: true });
      const ctrl = await window.GenAiCharacter3D?.ensure3dMounted?.();
      let loaded = false;
      if (url && ctrl?.loadGltfFromUrl) {
        loaded = (await ctrl.loadGltfFromUrl(url)) || false;
      }
      if (!loaded && char && hasTripoCharacterModel(char)) {
        const retry = await loadTripoGlbToStage(char, { refresh: true, quiet: true });
        loaded = Boolean(retry?.ok);
      }
      if (loaded && statusEl) statusEl.textContent = "3Dモデル表示中";
      else if (!loaded && statusEl) statusEl.textContent = "3D表示エラー";
      ctrl?.updateStatusLabel?.();
      return loaded;
    } catch (err) {
      console.warn("[GenAi3D] refresh3dStageAfterTripoSave:", err);
      if (statusEl) statusEl.textContent = TRIPO_3D_MSG.LOAD_FAIL;
      return false;
    }
  }

  async function runGenAi3dProductionGenerate() {
    const note = $("[data-gen-ai-3d-prepare-status]");
    const ticketBtn = $("[data-gen-ai-3d-generate-ticket]");
    const userId = getGenAiUserId();
    const character = getCharacterFor3dWorkflow();
    const charId = resolveCharacterStorageId(null, character);
    const cfg = getTripoGenAiConfig();

    if (!cfg?.healthCheckUrl) {
      if (note) note.textContent = TRIPO_3D_MSG.FAIL;
      return { ok: false };
    }
    if (!userId) {
      if (note) note.textContent = TRIPO_3D_MSG.FAIL;
      return { ok: false };
    }
    if (isGenAi3dProductionInProgress()) {
      if (note) note.textContent = TRIPO_3D_MSG.GENERATING;
      return { ok: false };
    }
    if (!charId || !characterHasCustomImage(character)) {
      if (note) note.textContent = TRIPO_3D_MSG.NO_IMAGE;
      return { ok: false };
    }
    const tickets = Math.max(0, Number(getGenAiPlan().tickets3dRemaining) || 0);
    if (tickets < 1) {
      if (note) note.textContent = TRIPO_3D_MSG.NO_TICKET;
      return { ok: false };
    }

    const imageUrl = String(character?.imageUrl || "").trim();
    const imageData = character?.imageData || null;

    if (ticketBtn) ticketBtn.disabled = true;
    setGenAi3dProductionInProgress(true);
    renderTripo3dResultPanel(null);
    clearGenAi3dPinnedNote();
    if (note) note.textContent = TRIPO_3D_MSG.GENERATING;

    let taskId = "";

    try {
      const start = await callGenAi3dApi({
        action: "generate_from_ticket",
        userId,
        characterId: charId,
        characterName: character?.name || "",
        imageUrl: /^https?:\/\//i.test(imageUrl) ? imageUrl : undefined,
        imageData: imageData || undefined,
      });

      if (start.httpStatus === 402 || start.data?.code === "no_tickets") {
        if (note) note.textContent = TRIPO_3D_MSG.NO_TICKET;
        return { ok: false, data: start.data };
      }
      if (!start.data?.ok || !start.data?.taskId) {
        const err = start.data?.error || TRIPO_3D_MSG.FAIL;
        renderTripo3dResultPanel(
          { errorMessage: err, taskId: start.data?.taskId, traceId: start.data?.traceId },
          { isError: true }
        );
        if (note) note.textContent = TRIPO_3D_MSG.FAIL;
        return { ok: false, data: start.data };
      }

      taskId = start.data.taskId;
      rememberPending3dTask(taskId);
      if (start.data.tickets3dRemaining !== undefined) {
        applyServerTickets3dRemaining(start.data.tickets3dRemaining);
      }

      const pollStarted = Date.now();
      let lastComplete = null;

      while (Date.now() - pollStarted < PROD_3D_MAX_WAIT_MS) {
        const tick = await callGenAi3dApi({
          action: "complete_generation",
          userId,
          characterId: charId,
          taskId,
        });
        lastComplete = tick.data;

        if (tick.data?.tickets3dRemaining !== undefined) {
          applyServerTickets3dRemaining(tick.data.tickets3dRemaining);
        }

        if (tick.data?.processing) {
          if (note) note.textContent = TRIPO_3D_MSG.GENERATING;
          await new Promise((r) => setTimeout(r, PROD_3D_POLL_MS));
          continue;
        }

        if (tick.data?.ok && tick.data?.status === "success" && (tick.data.modelUrl || tick.data.downloadUrl)) {
          const glbUrl = tick.data.modelUrl || tick.data.downloadUrl;
          const targetId = resolveCharacterStorageId(charId, character);
          const savePayload = {
            taskId,
            modelUrl: glbUrl,
            previewUrl: tick.data.previewUrl || null,
            downloadUrl: tick.data.downloadUrl || glbUrl,
            creditsUsed: tick.data.creditsUsed,
          };
          const saved = saveCharacterTripoModel(targetId, savePayload);
          if (!saved) {
            console.error("[GenAi3D] saveCharacterTripoModel failed after generation", {
              targetId,
              savePayload,
            });
          }
          forgetPending3dTask(taskId);
          saveTripoLastTestResult({
            taskId,
            modelUrl: glbUrl,
            previewUrl: tick.data.previewUrl,
            downloadUrl: tick.data.downloadUrl,
            creditsUsed: tick.data.creditsUsed,
          });
          renderTripoProductionSuccess(tick.data);
          setGenAi3dPinnedNote(PROD_3D_COMPLETE_NOTE);
          await refresh3dStageAfterTripoSave(targetId, glbUrl);
          return { ok: true, data: tick.data, saved };
        }

        break;
      }

      const err = lastComplete?.error || lastComplete?.status || "タイムアウト";
      forgetPending3dTask(taskId);
      renderTripo3dResultPanel(
        {
          errorMessage: err,
          taskId: taskId || lastComplete?.taskId,
          traceId: lastComplete?.traceId,
        },
        { isError: true }
      );
      clearGenAi3dPinnedNote();
      if (note) note.textContent = TRIPO_3D_MSG.FAIL;
      return { ok: false, data: lastComplete };
    } catch (err) {
      const msg = err?.message || TRIPO_3D_MSG.FAIL;
      forgetPending3dTask(taskId);
      renderTripo3dResultPanel({ errorMessage: msg, taskId }, { isError: true });
      clearGenAi3dPinnedNote();
      if (note) note.textContent = TRIPO_3D_MSG.FAIL;
      return { ok: false, error: msg };
    } finally {
      setGenAi3dProductionInProgress(false);
      updateGenAi3dPrepareUi();
      void syncGenAiPlanFromServer();
    }
  }

  function updateGenAi3dPrepareUi() {
    const healthBtn = $("[data-gen-ai-3d-health-check]");
    const testBtn = $("[data-gen-ai-3d-test-generate]");
    const ticketBtn = $("[data-gen-ai-3d-generate-ticket]");
    const buyBtn = $("[data-gen-ai-3d-buy-ticket]");
    const loadBtn = $("[data-gen-ai-3d-load-glb]");
    const taskInput = $("[data-gen-ai-3d-task-id-input]");
    const note = $("[data-gen-ai-3d-prepare-status]");
    const cfg = getTripoGenAiConfig();
    const plan = getGenAiPlan();
    const tickets = Math.max(0, Number(plan.tickets3dRemaining) || 0);
    const canCall = Boolean(cfg?.isConfigured?.());
    const testDone = isTripoTestGenerateDone();
    const userId = getGenAiUserId();
    const char = getActiveCharacter();
    const hasImage = characterHasCustomImage(char);
    const hasSaved3d = hasTripoCharacterModel(char);
    const inProgress = isGenAi3dProductionInProgress();

    applyGenAi3dDevVisibility();

    if (healthBtn) healthBtn.disabled = !canCall;
    if (testBtn) {
      testBtn.disabled = !canCall || testDone;
      testBtn.textContent = testDone ? "初回3Dテスト済み" : "初回3Dテスト生成";
    }
    if (ticketBtn) {
      const showTicket = Boolean(userId && canCall && hasImage && tickets > 0);
      ticketBtn.hidden = !showTicket;
      ticketBtn.disabled = !showTicket || inProgress;
    }
    if (buyBtn) {
      const showBuy = Boolean(userId && canCall && tickets < 1);
      buyBtn.hidden = !showBuy;
      buyBtn.disabled = inProgress;
    }
    if (loadBtn) {
      loadBtn.hidden = !hasSaved3d;
      loadBtn.disabled = inProgress;
    }
    if (taskInput && char?.tripoTaskId) {
      taskInput.value = String(char.tripoTaskId);
    }

    if (!note) return;
    if (genAi3dPinnedNote) {
      note.textContent = genAi3dPinnedNote;
      return;
    }
    if (inProgress) {
      note.textContent = TRIPO_3D_MSG.GENERATING;
      return;
    }
    if (!hasImage) {
      note.textContent = TRIPO_3D_MSG.NO_IMAGE;
      return;
    }
    if (userId && tickets < 1 && canCall) {
      note.textContent = TRIPO_3D_MSG.NO_TICKET;
      return;
    }
    if (tickets > 0 && hasImage && canCall && userId) {
      note.textContent = TRIPO_3D_MSG.BEFORE;
      return;
    }
    if (hasSaved3d) {
      note.textContent = TRIPO_3D_MSG.DISPLAYING;
      return;
    }
    note.textContent = "";
  }

  async function runGenAi3dHealthCheck() {
    const cfg = getTripoGenAiConfig();
    const note = $("[data-gen-ai-3d-prepare-status]");

    if (!cfg?.healthCheckUrl) {
      if (note) note.textContent = "Tripo 接続 API が未設定です。";
      return { ok: false };
    }

    updateGenAi3dPrepareUi();
    if (note) note.textContent = "Tripo API 接続を確認中…";

    try {
      const res = await fetch(cfg.healthCheckUrl, {
        method: "POST",
        headers: cfg.getHeaders(),
        body: JSON.stringify({
          action: "health_check",
          user_id: getGenAiUserId() || undefined,
          include_entitlements: true,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.connected) {
        const ticketPart =
          data.tickets3dRemaining != null
            ? ` チケット残り ${data.tickets3dRemaining} 枚。`
            : "";
        if (note) note.textContent = `Tripo 接続 OK。${ticketPart}`;
        return { ok: true, data };
      }

      const errMsg = data.tripo?.error || data.error || "Tripo API に接続できませんでした";
      if (note) note.textContent = errMsg;
      return { ok: false, error: errMsg };
    } catch (err) {
      const msg = err?.message || "接続確認に失敗しました";
      if (note) note.textContent = msg;
      return { ok: false, error: msg };
    } finally {
      updateGenAi3dPrepareUi();
    }
  }

  async function pollTripoTaskUntilDone(taskId, noteEl) {
    const cfg = getTripoGenAiConfig();
    const maxMs = 600_000;
    const intervalMs = 10_000;
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      const res = await fetch(cfg.healthCheckUrl, {
        method: "POST",
        headers: cfg.getHeaders(),
        body: JSON.stringify({ action: "task_poll", taskId }),
      });
      const data = await res.json().catch(() => ({}));
      if (noteEl) {
        noteEl.textContent = `生成待機中… status=${data.status || "unknown"} (${Math.round(
          (Date.now() - started) / 1000
        )}秒)`;
      }
      if (res.ok && data.done) return data;
      if (res.ok && (data.status === "failed" || data.status === "banned")) return data;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return { ok: false, error: "クライアント側タイムアウト", taskId, timedOut: true };
  }

  async function runGenAi3dTestGenerate() {
    const cfg = getTripoGenAiConfig();
    const note = $("[data-gen-ai-3d-prepare-status]");
    const testBtn = $("[data-gen-ai-3d-test-generate]");

    if (!cfg?.healthCheckUrl) {
      if (note) note.textContent = "Tripo API が未設定です。";
      return { ok: false };
    }
    if (isTripoTestGenerateDone()) {
      if (note) note.textContent = "この端末では初回テストは既に実行済みです。";
      return { ok: false };
    }

    const character = getActiveCharacter();
    const imageUrl = String(character?.imageUrl || "").trim();
    const imageData = character?.imageData || null;
    if (!characterHasCustomImage(character)) {
      if (note) note.textContent = "キャラ画像がありません。マイAIキャラを保存してください。";
      return { ok: false };
    }

    if (testBtn) testBtn.disabled = true;
    renderTripoTestResult(null);
    if (note) note.textContent = "Tripo 3D初回テスト生成を開始…（数分かかります）";

    try {
      const res = await fetch(cfg.healthCheckUrl, {
        method: "POST",
        headers: cfg.getHeaders(),
        body: JSON.stringify({
          action: "test_generate",
          imageUrl: /^https?:\/\//i.test(imageUrl) ? imageUrl : undefined,
          imageData: imageData || undefined,
          maxWaitMs: 0,
        }),
      });
      let data = await res.json().catch(() => ({}));

      if (data.taskId && !data.modelUrl) {
        if (note) note.textContent = "Tripo 生成完了待ち（クライアント側）…";
        const polled = await pollTripoTaskUntilDone(data.taskId, note);
        data = {
          ...data,
          ...polled,
          ok: polled.success || Boolean(polled.modelUrl),
          generationTimeMs: polled.generationTimeMs,
          creditsUsed: polled.creditsUsed ?? data.creditsUsed,
        };
      }

      if (!data.ok && !data.modelUrl) {
        renderTripoTestResult(
          {
            error: data.error || data.tripo?.error || "生成に失敗しました",
            taskId: data.taskId,
            traceId: data.traceId,
          },
          true
        );
        if (note) note.textContent = data.error || "生成に失敗しました";
        return { ok: false, data };
      }

      if (!data.modelUrl && !data.ok) {
        renderTripoTestResult(
          { error: data.error || "modelUrl がありません", taskId: data.taskId, traceId: data.traceId },
          true
        );
        return { ok: false, data };
      }

      markTripoTestGenerateDone();
      saveTripoLastTestResult(data);
      const charId = getActiveCharacterId();
      if (charId && (data.modelUrl || data.downloadUrl)) {
        const glb = data.modelUrl || data.downloadUrl;
        saveCharacterTripoModel(resolveCharacterStorageId(charId, character), {
          taskId: data.taskId,
          modelUrl: glb,
          previewUrl: data.previewUrl,
          downloadUrl: data.downloadUrl || glb,
          creditsUsed: data.creditsUsed,
        });
        await refresh3dStageAfterTripoSave(charId, glb);
      }
      renderTripoTestResult(data, false);
      if (note) {
        note.textContent = `初回テスト生成完了（${Math.round(
          (data.generationTimeMs || 0) / 1000
        )}秒 / クレジット ${data.creditsUsed ?? 0}）`;
      }

      const glbUrl = data.modelUrl || data.downloadUrl;
      if (glbUrl && window.GenAiCharacter3D?.loadGltfFromUrl) {
        await setStageRendererMode("3d", { save: true });
        const loaded = await window.GenAiCharacter3D.loadGltfFromUrl(glbUrl);
        if (!loaded) {
          if (note) note.textContent += " GLBの3D表示に失敗しました（URLは上記リンクから確認可）。";
        }
      }

      return { ok: true, data };
    } catch (err) {
      const msg = err?.message || "テスト生成に失敗しました";
      renderTripoTestResult({ error: msg }, true);
      if (note) note.textContent = msg;
      return { ok: false, error: msg };
    } finally {
      updateGenAi3dPrepareUi();
    }
  }

  function bindGenAi3dPrepareUi() {
    $("[data-gen-ai-3d-health-check]")?.addEventListener("click", () => {
      void runGenAi3dHealthCheck();
    });
    $("[data-gen-ai-3d-test-generate]")?.addEventListener("click", () => {
      void runGenAi3dTestGenerate();
    });
    $("[data-gen-ai-3d-load-glb]")?.addEventListener("click", () => {
      void loadTripoGlbToStage(getActiveCharacter(), { refresh: false });
    });
    $("[data-gen-ai-3d-refresh-url]")?.addEventListener("click", () => {
      void refreshTripoGlbFromTaskId();
    });
    $("[data-gen-ai-3d-generate-ticket]")?.addEventListener("click", () => {
      void runGenAi3dProductionGenerate();
    });
    $("[data-gen-ai-3d-buy-ticket]")?.addEventListener("click", () => {
      void startGenAiCheckout("genai_3d_generate_500");
    });
    $("[data-gen-ai-3d-details-toggle]")?.addEventListener("click", () => {
      setTripo3dDetailsExpanded(!tripo3dDetailsExpanded);
    });
    $("[data-gen-ai-3d-task-id-input]")?.addEventListener("change", () => {
      const id = String($("[data-gen-ai-3d-task-id-input]")?.value || "").trim();
      const charId = getActiveCharacterId();
      if (!id || !charId) return;
      saveCharacterTripoModel(charId, {
        taskId: id,
        modelUrl: getCharacterTripoModelUrl(getActiveCharacter()),
        rendererModeOnly: true,
      });
    });
    window.GenAiCharacter3D?.bindRotationDevControls?.();
    bindGenAiVrmPocUi();
    updateGenAi3dPrepareUi();
    applyGenAi3dDevVisibility();
    void reconcileStale3dGenerations();
  }

  function bindGenAiVrmPocUi() {
    const fileInput = $("[data-gen-ai-vrm-file]");
    if ($("[data-gen-ai-vrm-poc]")?.dataset?.vrmPocBound === "1") return;
    const poc = $("[data-gen-ai-vrm-poc]");
    if (poc) poc.dataset.vrmPocBound = "1";

    $("[data-gen-ai-vrm-load-sample]")?.addEventListener("click", async () => {
      setVrmPocNote("サンプル VRM を読み込み中…");
      await setStageRendererMode("3d", { save: true, skip3dLoad: true });
      const charId = getActiveCharacterId() || "poc_sample";
      const sample = window.GenAiCharacterVrm?.SAMPLE_URL || "";
      if (sample) saveCharacterVrmModel(charId, { vrmUrl: sample, vrmSource: "sample" });
      const result = await loadVrmToStage(
        getActiveCharacter() || { id: charId, vrmModelUrl: sample },
        { quiet: false }
      );
      if (!result.ok) {
        setVrmPocNote(
          "サンプル読込に失敗しました。Neural4D から書き出した .vrm を「ファイル選択」で試してください。"
        );
      }
    });

    $("[data-gen-ai-vrm-pick-file]")?.addEventListener("click", () => fileInput?.click());

    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) return;
      setVrmPocNote(`${file.name} を読み込み中…`);
      await setStageRendererMode("3d", { save: true, skip3dLoad: true });
      window.GenAiCharacter3D?.disposeActive?.();
      const ok = await window.GenAiCharacterVrm?.loadFromFile?.(file);
      if (!ok) {
        setVrmPocNote("VRMファイルの読み込みに失敗しました。");
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      const charId = getActiveCharacterId() || `vrm_${Date.now()}`;
      writeVrmBlobUrl(charId, objectUrl);
      const report = window.GenAiCharacterVrm?.inspectActive?.();
      saveCharacterVrmModel(charId, {
        vrmUrl: objectUrl,
        vrmSource: "local_file",
        inspectReport: report,
      });
      setVrmPocNote(formatVrmInspectNote(report));
      window.GenAiCharacterVrm?.logInspectReport?.();
    });

    $("[data-gen-ai-vrm-load-url]")?.addEventListener("click", async () => {
      const url = String($("[data-gen-ai-vrm-url-input]")?.value || "").trim();
      if (!url) {
        setVrmPocNote("VRM の URL を入力してください。");
        return;
      }
      setVrmPocNote("URL から VRM を読み込み中…");
      await setStageRendererMode("3d", { save: true, skip3dLoad: true });
      const charId = getActiveCharacterId() || `vrm_${Date.now()}`;
      saveCharacterVrmModel(charId, { vrmUrl: url, vrmSource: "url" });
      await loadVrmToStage(getActiveCharacter() || { id: charId, vrmModelUrl: url });
    });

    $("[data-gen-ai-vrm-inspect]")?.addEventListener("click", () => {
      const report = window.GenAiCharacterVrm?.logInspectReport?.();
      setVrmPocNote(formatVrmInspectNote(report));
    });
  }

  async function setStageRendererMode(mode, { save = true, skipTripoGlb = false, skip3dLoad = false } = {}) {
    const next = mode === "3d" ? "3d" : mode === "live" ? "live" : "2d";
    if (save) saveStageRendererPreference(next);
    applyStageRendererUi(next);
    if (next === "3d") {
      const char = getDisplayCharacter();
      if (char?.rendererMode !== "3d" && hasTripoCharacterModel(char)) {
        saveCharacterTripoModel(char.id, {
          taskId: char.tripoTaskId,
          modelUrl: getCharacterTripoModelUrl(char),
          previewUrl: char.tripoPreviewUrl,
          downloadUrl: char.tripoDownloadUrl,
          rendererModeOnly: true,
        });
      }
      if (!skip3dLoad && !skipTripoGlb) {
        void loadPreferred3dStage(char, { quiet: true });
      } else if (!skip3dLoad && skipTripoGlb && getActive3dBackend(char) === "vrm") {
        void loadVrmToStage(char, { quiet: true });
      } else if (!skip3dLoad) {
        const ctrl = await window.GenAiCharacter3D?.ensure3dMounted?.();
        ctrl?.resize?.();
        ctrl?.updateStatusLabel?.();
      }
    }
    syncStageAvatarState();
    return next;
  }

  function maybeAutoSelectStageRenderer(character) {
    const src = getStageImageSrc(character);
    if (!characterHasCustomImage(character)) {
      lastStageAutoImageSrc = null;
      if (stageRendererMode === "live") {
        void setStageRendererMode("2d", { save: true });
      }
      return;
    }
    if (src === lastStageAutoImageSrc) return;
    lastStageAutoImageSrc = src;
    if (loadStageRendererPreference() === "3d") return;
    void setStageRendererMode("live", { save: true });
  }

  function syncLiveStageImage(src, alt) {
    const liveImg = $("[data-gen-ai-char-live-img]");
    if (!liveImg) return;
    liveImg.src = src;
    liveImg.alt = alt || "AIキャラクター";
    liveImg.onerror = function onLiveErr() {
      if (liveImg.src.indexOf(DEFAULT_CHARACTER_FALLBACK) === -1 && !String(src).startsWith("data:")) {
        liveImg.src = DEFAULT_CHARACTER_FALLBACK;
      } else {
        liveImg.onerror = null;
      }
    };
  }

  function stopLiveBlinkLoop() {
    if (liveBlinkTimeout) {
      clearTimeout(liveBlinkTimeout);
      liveBlinkTimeout = null;
    }
    $("[data-ai-character-stage]")?.classList.remove("is-live-blink");
  }

  function startLiveBlinkLoop() {
    stopLiveBlinkLoop();
    const schedule = () => {
      liveBlinkTimeout = setTimeout(() => {
        if (stageRendererMode !== "live") return;
        const stage = $("[data-ai-character-stage]");
        if (!stage) return;
        stage.classList.add("is-live-blink");
        setTimeout(() => stage.classList.remove("is-live-blink"), 160);
        schedule();
      }, 2200 + Math.random() * 2800);
    };
    schedule();
  }

  function clearStageLiveExpression() {
    const stage = $("[data-ai-character-stage]");
    if (!stage) return;
    stage.classList.remove("is-expr-happy", "is-expr-surprised", "is-expr-sad", "is-expr-neutral");
  }

  function syncStageLiveExpression(expression) {
    const stage = $("[data-ai-character-stage]");
    if (!stage || stageRendererMode !== "live") return;
    clearStageLiveExpression();
    const cls =
      window.GenAiCharacterExpression?.toLiveStageClass?.(expression) || "is-expr-neutral";
    if (cls) stage.classList.add(cls);
  }

  function syncStageAvatarState(options = {}) {
    const stage = $("[data-ai-character-stage]");
    const speaking =
      options.speaking !== undefined
        ? Boolean(options.speaking)
        : Boolean(stage?.classList.contains("is-speaking") || isSpeaking);
    const listening =
      options.listening !== undefined ? Boolean(options.listening) : Boolean(isListening);

    if (stageRendererMode === "3d") {
      syncStageAvatar3D({ speaking, listening, expression: options.expression });
    }
    if (options.expression) {
      syncStageLiveExpression(options.expression);
    }
  }

  function bindStageRendererToggle() {
    document.querySelectorAll("[data-gen-ai-stage-renderer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-gen-ai-stage-renderer");
        void setStageRendererMode(mode, { save: true });
      });
    });
  }

  function initStageRenderer() {
    bindGenAi3dPrepareUi();
    const saved = loadStageRendererPreference();
    applyStageRendererUi(saved);
    bindStageRendererToggle();
    if (saved === "3d") {
      void window.GenAiCharacter3D?.ensure3dMounted?.();
    }
  }

  function syncMouthPreviewMode(modeId) {
    const mouth = $("[data-character-mouth]");
    if (!mouth) return;
    mouth.classList.toggle("character-mouth--preview", modeId === "マイAIキャラ作成");
  }

  function updateMouthSliderOutputs(settings) {
    const s = getMouthSettings(settings);
    const xVal = $("[data-gen-ai-char-mouth-x-val]");
    const yVal = $("[data-gen-ai-char-mouth-y-val]");
    const scaleVal = $("[data-gen-ai-char-mouth-scale-val]");
    if (xVal) xVal.textContent = `${Math.round(s.mouthX)}%`;
    if (yVal) yVal.textContent = `${Math.round(s.mouthY)}%`;
    if (scaleVal) scaleVal.textContent = s.mouthScale.toFixed(2);
  }

  function readMouthFromForm() {
    return getMouthSettings({
      mouthX: $("[data-gen-ai-char-mouth-x]")?.value,
      mouthY: $("[data-gen-ai-char-mouth-y]")?.value,
      mouthScale: $("[data-gen-ai-char-mouth-scale]")?.value,
    });
  }

  function setMouthFormValues(settings) {
    const s = getMouthSettings(settings);
    const xInput = $("[data-gen-ai-char-mouth-x]");
    const yInput = $("[data-gen-ai-char-mouth-y]");
    const scaleInput = $("[data-gen-ai-char-mouth-scale]");
    if (xInput) xInput.value = String(s.mouthX);
    if (yInput) yInput.value = String(s.mouthY);
    if (scaleInput) scaleInput.value = String(s.mouthScale);
    updateMouthSliderOutputs(s);
  }

  function previewMouthFromForm() {
    const settings = readMouthFromForm();
    updateMouthSliderOutputs(settings);
    applyCharacterMouthPosition(settings);
  }

  function normalizeCharacter(raw) {
    if (!raw || typeof raw !== "object") return null;
    const mouth = getMouthSettings(raw);
    return {
      ...raw,
      name: String(raw.name || "").trim(),
      nameKana: String(raw.nameKana || "").trim(),
      personality: String(raw.personality || "").trim(),
      speakingStyle: String(raw.speakingStyle || "").trim(),
      firstPerson: String(raw.firstPerson || "").trim(),
      userCallName: String(raw.userCallName || "").trim(),
      userCallNameKana: String(raw.userCallNameKana || "").trim(),
      appearanceMemo: String(raw.appearanceMemo || "").trim(),
      purpose: String(raw.purpose || "").trim(),
      imageData: raw.imageData || null,
      imageUrl: String(raw.imageUrl || "").trim() || null,
      image: raw.image || raw.imageUrl || raw.imageData || null,
      mouthX: mouth.mouthX,
      mouthY: mouth.mouthY,
      mouthScale: mouth.mouthScale,
      imageAnalyzed: Boolean(raw.imageAnalyzed),
      imageAppearanceGeneratedAt: raw.imageAppearanceGeneratedAt || null,
      appearanceSource:
        raw.appearanceSource === "ai" || raw.appearanceSource === "manual"
          ? raw.appearanceSource
          : raw.imageAnalyzed
            ? "ai"
            : "manual",
      characterSeedGenerated: Boolean(raw.characterSeedGenerated),
      characterSeedGeneratedAt: raw.characterSeedGeneratedAt || null,
      characterSeedSource:
        raw.characterSeedSource === "ai" || raw.characterSeedSource === "manual"
          ? raw.characterSeedSource
          : raw.characterSeedGenerated
            ? "ai"
            : "manual",
      mouthAutoEstimated: Boolean(raw.mouthAutoEstimated),
      mouthAutoEstimatedAt: raw.mouthAutoEstimatedAt || null,
      mouthEstimateSource:
        raw.mouthEstimateSource === "ai" ||
        raw.mouthEstimateSource === "heuristic" ||
        raw.mouthEstimateSource === "manual"
          ? raw.mouthEstimateSource
          : raw.mouthAutoEstimated
            ? "heuristic"
            : "manual",
      mouthEstimateComposition: normalizeComposition(raw.mouthEstimateComposition),
      tripoTaskId: String(raw.tripoTaskId || "").trim() || null,
      tripoModelUrl: String(raw.tripoModelUrl || raw.modelUrl || "").trim() || null,
      tripoPreviewUrl: String(raw.tripoPreviewUrl || "").trim() || null,
      tripoDownloadUrl: String(raw.tripoDownloadUrl || "").trim() || null,
      modelUrl: String(raw.modelUrl || raw.tripoModelUrl || "").trim() || null,
      tripoModelSavedAt: raw.tripoModelSavedAt || null,
      vrmModelUrl: String(raw.vrmModelUrl || "").trim() || null,
      vrmModelSavedAt: raw.vrmModelSavedAt || null,
      vrmSource: String(raw.vrmSource || "").trim() || null,
      vrmInspectReport: raw.vrmInspectReport && typeof raw.vrmInspectReport === "object" ? raw.vrmInspectReport : null,
      rendererMode:
        raw.rendererMode === "3d" || raw.rendererMode === "live" || raw.rendererMode === "2d"
          ? raw.rendererMode
          : null,
    };
  }

  function getTripoLastTestResult() {
    try {
      const raw = localStorage.getItem(STORAGE_TRIPO_LAST_RESULT);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveTripoLastTestResult(data) {
    if (!data?.taskId && !data?.modelUrl) return;
    try {
      localStorage.setItem(
        STORAGE_TRIPO_LAST_RESULT,
        JSON.stringify({
          taskId: data.taskId || null,
          modelUrl: data.modelUrl || data.downloadUrl || null,
          previewUrl: data.previewUrl || null,
          downloadUrl: data.downloadUrl || data.modelUrl || null,
          creditsUsed: data.creditsUsed ?? null,
          savedAt: new Date().toISOString(),
        })
      );
    } catch {
      /* ignore */
    }
  }

  function hasTripoCharacterModel(character) {
    const c = character || getDisplayCharacter();
    if (!c) return false;
    return Boolean(
      String(c.tripoTaskId || "").trim() ||
        String(c.tripoModelUrl || "").trim() ||
        String(c.modelUrl || "").trim()
    );
  }

  function getCharacterTripoModelUrl(character) {
    const c = character || getDisplayCharacter();
    if (!c) return "";
    return String(c.tripoModelUrl || c.modelUrl || "").trim();
  }

  function getPreferred3dModelUrl(character) {
    const c = character || getDisplayCharacter();
    const fromChar = getCharacterTripoModelUrl(c);
    if (fromChar) return fromChar;
    const last = getTripoLastTestResult();
    return String(last?.modelUrl || last?.downloadUrl || "").trim();
  }

  function readVrmBlobUrls() {
    try {
      const raw = localStorage.getItem(STORAGE_VRM_BLOB_URLS);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeVrmBlobUrl(characterId, objectUrl) {
    const id = String(characterId || "").trim();
    if (!id || !objectUrl) return;
    const all = readVrmBlobUrls();
    all[id] = objectUrl;
    try {
      localStorage.setItem(STORAGE_VRM_BLOB_URLS, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }

  function getCharacterVrmModelUrl(character) {
    const c = character || getDisplayCharacter();
    if (!c) return "";
    const stored = String(c.vrmModelUrl || "").trim();
    if (stored) return stored;
    const blob = readVrmBlobUrls()[c.id];
    return blob ? String(blob).trim() : "";
  }

  function hasVrmCharacterModel(character) {
    return Boolean(getCharacterVrmModelUrl(character));
  }

  function getPreferredVrmModelUrl(character) {
    return getCharacterVrmModelUrl(character);
  }

  /** 3D表示バックエンド: VRM（口パク）優先、なければ Tripo（静止） */
  function getActive3dBackend(character) {
    if (hasVrmCharacterModel(character)) return "vrm";
    if (hasTripoCharacterModel(character)) return "tripo";
    return "fallback";
  }

  function setVrmPocNote(text) {
    const el = $("[data-gen-ai-vrm-poc-note]");
    if (el) el.textContent = text ? String(text) : "";
  }

  function formatVrmInspectNote(report) {
    if (!report) return "検証結果がありません。VRMを読み込んでください。";
    const yn = (v) => (v ? "○" : "×");
    const v = report.vowels || {};
    return [
      `表情 ${report.expressionCount}件`,
      `A${yn(v.aa?.found)} I${yn(v.ih?.found)} U${yn(v.ou?.found)} E${yn(v.ee?.found)} O${yn(v.oh?.found)}`,
      `Blink${yn(report.hasBlink)} Joy${yn(report.hasJoy)} Sorrow${yn(report.hasSorrow)} Angry${yn(report.hasAngry)} Surprised${yn(report.hasSurprised)}`,
    ].join(" / ");
  }

  function saveCharacterVrmModel(characterId, payload) {
    if (!payload) return false;
    const vrmUrl = String(payload.vrmUrl || payload.modelUrl || "").trim();
    if (!vrmUrl) {
      console.warn("[GenAiVRM] saveCharacterVrmModel: no vrmUrl");
      return false;
    }
    const id = resolveCharacterStorageId(characterId, payload);
    if (!id) return false;
    if (isTasfulBuiltinCharacter({ id })) {
      console.log("[GenAiVRM] skip save for TASFUL builtin");
      return true;
    }

    const list = loadCharacters();
    let idx = list.findIndex((c) => c.id === id);
    if (idx < 0) {
      list.push(
        normalizeCharacter({
          id,
          name: payload.name || "VRMキャラ",
          imageUrl: DEFAULT_CHARACTER_SRC,
        })
      );
      idx = list.length - 1;
    }
    const prev = list[idx];
    const next = normalizeCharacter({
      ...prev,
      vrmModelUrl: vrmUrl,
      vrmModelSavedAt: new Date().toISOString(),
      vrmSource: payload.vrmSource || prev.vrmSource || "poc",
      vrmInspectReport: payload.inspectReport || prev.vrmInspectReport || null,
      rendererMode: payload.rendererModeOnly ? prev.rendererMode : "3d",
    });
    list[idx] = next;
    if (!saveCharactersList(list)) return false;
    if (getActiveCharacterId() === id) applyCharacterStageImage(next);
    console.log("[GenAiVRM] saveCharacterVrmModel", id, { vrmUrl: vrmUrl.slice(0, 80) });
    return true;
  }

  async function loadVrmToStage(character, options = {}) {
    const char = character || getDisplayCharacter();
    const url = getCharacterVrmModelUrl(char);
    if (!url) {
      if (!options.quiet) setVrmPocNote("VRM URL が未設定です。Neural4D から .vrm を書き出して読み込んでください。");
      return { ok: false };
    }
    global.__genAi3dBackend = "vrm";
    window.GenAiCharacter3D?.disposeActive?.();
    const loaded = await window.GenAiCharacterVrm?.loadFromUrl?.(url);
    if (loaded) {
      const report = window.GenAiCharacterVrm?.inspectActive?.();
      if (report && char?.id) {
        saveCharacterVrmModel(char.id, {
          vrmUrl: url,
          inspectReport: report,
          rendererModeOnly: true,
        });
      }
      if (!options.quiet) {
        setVrmPocNote(formatVrmInspectNote(report));
        const status = $("[data-gen-ai-stage-3d-status]");
        if (status) status.textContent = "VRM: 表示中（口パク対応）";
      }
    } else if (!options.quiet) {
      setVrmPocNote(
        window.__genAiVrmLastLoadError
          ? `読込失敗: ${window.__genAiVrmLastLoadError}`
          : "VRMの読み込みに失敗しました"
      );
    }
    return { ok: Boolean(loaded), url };
  }

  async function loadPreferred3dStage(character, options = {}) {
    const char = character || getDisplayCharacter();
    const backend = getActive3dBackend(char);
    global.__genAi3dBackend = backend;

    if (backend === "vrm") {
      return loadVrmToStage(char, options);
    }

    window.GenAiCharacterVrm?.disposeActive?.();
    const ctrl = await window.GenAiCharacter3D?.ensure3dMounted?.();
    ctrl?.resize?.();
    ctrl?.updateStatusLabel?.();

    const preferred = getPreferred3dModelUrl(char);
    if (preferred) {
      return loadTripoGlbInBackground(preferred, char?.id, null);
    }
    if (hasTripoCharacterModel(char)) {
      return loadTripoGlbToStage(char, { refresh: true, quiet: Boolean(options.quiet) });
    }
    return { ok: false };
  }

  async function resolveTripoGlbForDisplay(character, options = {}) {
    const c = character || getDisplayCharacter();
    const storedTripo = String(c?.tripoModelUrl || "").trim();
    const storedModel = String(c?.modelUrl || "").trim();
    const storedUrl = storedTripo || storedModel;
    const storedPreview = c?.tripoPreviewUrl || getTripoLastTestResult()?.previewUrl || "";
    const storedDownload = c?.tripoDownloadUrl || getTripoLastTestResult()?.downloadUrl || storedUrl;

    if (!options.forceRefresh && storedUrl) {
      return {
        taskId: c?.tripoTaskId || null,
        modelUrl: storedTripo || storedModel,
        previewUrl: storedPreview,
        downloadUrl: storedDownload,
        fromCache: true,
      };
    }

    return refreshTripoGlbUrls(c, {
      forceRefresh: Boolean(options.forceRefresh),
      allowCompleteGeneration: options.allowCompleteGeneration !== false,
    });
  }

  function saveCharacterTripoModel(characterId, payload) {
    if (!payload) {
      console.warn("[GenAi3D] saveCharacterTripoModel: empty payload");
      return false;
    }

    const glbUrl = String(
      payload.modelUrl || payload.tripoModelUrl || payload.downloadUrl || ""
    ).trim();
    const taskId = String(payload.taskId || "").trim();
    if (!glbUrl && !taskId && !payload.rendererModeOnly) {
      console.warn("[GenAi3D] saveCharacterTripoModel: no modelUrl or taskId", payload);
      return false;
    }

    const id = resolveCharacterStorageId(characterId, payload._characterHint || getCharacterFor3dWorkflow());
    if (!id) {
      console.warn("[GenAi3D] saveCharacterTripoModel: could not resolve character id");
      return false;
    }
    if (isTasfulBuiltinCharacter({ id })) {
      console.log("[GenAi3D] skip save for TASFUL builtin");
      return true;
    }

    let list = loadCharacters();
    let idx = findCharacterIndexInList(list, id);

    if (idx < 0) {
      const hint = payload._characterHint || getCharacterFor3dWorkflow() || collectCharacterFromForm();
      const base = normalizeCharacter({
        ...(hint && typeof hint === "object" ? hint : {}),
        id,
        createdAt: hint?.createdAt || new Date().toISOString(),
      });
      if (!base) {
        console.warn("[GenAi3D] saveCharacterTripoModel: character not in list", id);
        return false;
      }
      list.push(base);
      idx = list.length - 1;
      console.log("[GenAi3D] saveCharacterTripoModel: inserted missing character", id);
    }

    const prev = list[idx];
    const savedAt = new Date().toISOString();
    const tripoModelUrl = glbUrl || prev.tripoModelUrl || prev.modelUrl || null;

    const next = normalizeCharacter({
      ...prev,
      id: prev.id || id,
      tripoTaskId: taskId || prev.tripoTaskId,
      tripoModelUrl,
      modelUrl: tripoModelUrl,
      tripoPreviewUrl: payload.previewUrl || prev.tripoPreviewUrl,
      tripoDownloadUrl: payload.downloadUrl || tripoModelUrl || prev.tripoDownloadUrl,
      tripoModelSavedAt: savedAt,
      rendererMode: "3d",
      updatedAt: savedAt,
    });

    list[idx] = next;
    if (!saveCharactersList(list)) {
      console.warn("[GenAi3D] saveCharacterTripoModel: localStorage write failed");
      return false;
    }

    setActiveCharacterId(next.id);
    saveStageRendererPreference("3d");

    saveTripoLastTestResult({
      taskId: next.tripoTaskId,
      modelUrl: tripoModelUrl,
      previewUrl: next.tripoPreviewUrl,
      downloadUrl: next.tripoDownloadUrl,
      creditsUsed: payload.creditsUsed,
    });

    const verify = getCharacterById(next.id);
    console.log("[GenAi3D] saveCharacterTripoModel saved", next.id, {
      tripoTaskId: verify?.tripoTaskId,
      tripoModelUrl: Boolean(verify?.tripoModelUrl),
      modelUrl: Boolean(verify?.modelUrl),
      tripoPreviewUrl: Boolean(verify?.tripoPreviewUrl),
      tripoDownloadUrl: Boolean(verify?.tripoDownloadUrl),
      tripoModelSavedAt: verify?.tripoModelSavedAt,
      rendererMode: verify?.rendererMode,
    });

    updateGenAi3dPrepareUi();
    return true;
  }

  async function refreshTripoGlbFromTaskId(overrideTaskId) {
    const note = $("[data-gen-ai-3d-prepare-status]");
    const char = getActiveCharacter();
    const charId = char?.id || getActiveCharacterId();
    const devInput = $("[data-gen-ai-3d-task-id-input]");
    const taskId = String(
      overrideTaskId || devInput?.value || char?.tripoTaskId || getTripoLastTestResult()?.taskId || ""
    ).trim();
    if (!taskId) {
      if (note) note.textContent = TRIPO_3D_MSG.LOAD_FAIL;
      return { ok: false, error: "no_task_id" };
    }
    if (note) note.textContent = TRIPO_3D_MSG.UPDATING_URL;
    const charForRefresh = char
      ? { ...char, tripoTaskId: taskId }
      : { id: charId, tripoTaskId: taskId };
    const resolved = await refreshTripoGlbUrls(charForRefresh, { forceRefresh: true });
    if (!resolved?.modelUrl) {
      const err = resolved?.error || resolved?.status || TRIPO_3D_MSG.LOAD_FAIL;
      if (note) note.textContent = TRIPO_3D_MSG.LOAD_FAIL;
      renderTripo3dResultPanel(
        { errorMessage: err, taskId, traceId: resolved?.traceId },
        { isError: true }
      );
      return { ok: false, resolved };
    }
    if (charId) saveCharacterTripoModel(charId, { ...resolved, taskId: resolved.taskId || taskId });
    if (resolved.status === "success" || resolved.idempotent) {
      setGenAi3dPinnedNote(PROD_3D_COMPLETE_NOTE);
    }
    return loadTripoGlbToStage(getCharacterById(charId) || charForRefresh, {
      refresh: false,
      quiet: false,
      skipUrlRefresh: true,
    });
  }

  async function loadTripoGlbToStage(character, options = {}) {
    const note = $("[data-gen-ai-3d-prepare-status]");
    const quiet = Boolean(options.quiet);
    if (note && !quiet && !genAi3dPinnedNote) note.textContent = TRIPO_3D_MSG.LOADING;

    let resolved = options.skipUrlRefresh
      ? {
          taskId: character?.tripoTaskId,
          modelUrl: getCharacterTripoModelUrl(character),
          previewUrl: character?.tripoPreviewUrl,
          downloadUrl: character?.tripoDownloadUrl,
        }
      : await resolveTripoGlbForDisplay(character, {
          forceRefresh: Boolean(options.refresh),
        });

    let glbUrl = resolved?.modelUrl || resolved?.downloadUrl;
    if (!glbUrl) {
      if (note && !quiet) note.textContent = TRIPO_3D_MSG.LOAD_FAIL;
      return { ok: false, error: "no_glb_url", resolved };
    }

    const charId = (character || getActiveCharacter())?.id || getActiveCharacterId();
    if (charId) saveCharacterTripoModel(charId, resolved);

    let loaded = await loadTripoGlbInBackground(glbUrl, charId, resolved);
    if (!loaded && hasTripoCharacterModel(character || getActiveCharacter())) {
      if (note && !quiet) note.textContent = TRIPO_3D_MSG.UPDATING_URL;
      resolved = await refreshTripoGlbUrls(character || getActiveCharacter(), { forceRefresh: true });
      glbUrl = resolved?.modelUrl || resolved?.downloadUrl;
      if (glbUrl) {
        if (charId) saveCharacterTripoModel(charId, resolved);
        loaded = await loadTripoGlbInBackground(glbUrl, charId, resolved);
      }
    }

    if (loaded) {
      if (note && !genAi3dPinnedNote && !quiet) note.textContent = TRIPO_3D_MSG.DISPLAYING;
      if (!quiet) {
        renderTripo3dResultPanel({
          taskId: resolved.taskId,
          modelUrl: resolved.modelUrl,
          previewUrl: resolved.previewUrl,
          downloadUrl: resolved.downloadUrl,
          creditsUsed: resolved.creditsUsed ?? getTripoLastTestResult()?.creditsUsed,
          idempotent: resolved.idempotent,
        });
      }
    } else if (note && !genAi3dPinnedNote) {
      note.textContent = TRIPO_3D_MSG.LOAD_FAIL;
      if (!quiet) {
        renderTripo3dResultPanel(
          { errorMessage: TRIPO_3D_MSG.LOAD_FAIL, taskId: resolved?.taskId },
          { isError: true }
        );
      }
    }
    return { ok: loaded, url: glbUrl, resolved };
  }

  function loadCharacters() {
    try {
      const raw = localStorage.getItem(STORAGE_MY_CHARACTERS);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.map((c) => normalizeCharacter(c)).filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * 表示用テキストから音声読み上げ用のみを抽出
   * @param {string} displayText
   * @param {object|null} activeCharacter
   * @returns {string}
   */
  function buildSpeechText(displayText, activeCharacter) {
    let text = String(displayText || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "");

    text = text.replace(/```[\s\S]*?```/g, "");
    text = text.replace(/`[^`]+`/g, "");

    const cutPatterns = [/\n---\s*\n[\s\S]*/, /\n【設定反映[\s\S]*/, /\n【キャラプレビュー[\s\S]*/, /\n※本番では[\s\S]*/];
    for (const re of cutPatterns) {
      text = text.replace(re, "");
    }

    const lines = text.split(/\n/);
    const kept = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (SPEECH_SKIP_LINE_PATTERNS.some((re) => re.test(trimmed))) continue;
      if (/^【[^】]+】\s*$/.test(trimmed)) continue;
      kept.push(trimmed);
    }

    let speech = kept.join("\n").trim();
    speech = speech.replace(/https?:\/\/\S+/g, "");
    speech = speech.replace(/[#*_~[\]]/g, "");

    const character = activeCharacter ? normalizeCharacter(activeCharacter) : null;
    if (character?.name && character.nameKana) {
      speech = speech.split(character.name).join(character.nameKana);
    }
    if (character?.userCallName && character.userCallNameKana) {
      speech = speech.split(character.userCallName).join(character.userCallNameKana);
    }

    speech = speech
      .split(/\n+/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("。");

    return speech.trim().slice(0, 800);
  }

  function saveCharactersList(list) {
    try {
      localStorage.setItem(STORAGE_MY_CHARACTERS, JSON.stringify(list));
      return true;
    } catch (err) {
      console.warn("[GenAi] character save failed:", err);
      return false;
    }
  }

  function parseStoredCharacterId(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    if (s.startsWith("{")) {
      try {
        const parsed = JSON.parse(s);
        return String(parsed?.id || "").trim();
      } catch {
        return "";
      }
    }
    return s;
  }

  function getActiveCharacterId() {
    try {
      return parseStoredCharacterId(localStorage.getItem(STORAGE_ACTIVE_CHARACTER));
    } catch {
      return "";
    }
  }

  function setActiveCharacterId(id) {
    try {
      const plain = parseStoredCharacterId(
        typeof id === "object" && id !== null ? id.id : id
      );
      if (plain) localStorage.setItem(STORAGE_ACTIVE_CHARACTER, plain);
      else localStorage.removeItem(STORAGE_ACTIVE_CHARACTER);
    } catch {
      /* ignore */
    }
  }

  function resolveCharacterStorageId(characterId, characterHint) {
    let id = parseStoredCharacterId(characterId);
    if (!id && characterHint?.id) id = parseStoredCharacterId(characterHint.id);
    if (!id) id = getActiveCharacterId();
    if (!id) {
      id = String($("[data-gen-ai-character-select]")?.value || "").trim();
    }
    if (!id) {
      id = String($("[data-gen-ai-char-editing-id]")?.value || "").trim();
    }
    return id;
  }

  function findCharacterIndexInList(list, id) {
    const norm = String(id || "").trim();
    if (!norm || !Array.isArray(list)) return -1;
    let idx = list.findIndex((c) => c.id === norm);
    if (idx >= 0) return idx;
    return list.findIndex((c) => String(c.id || "").trim() === norm);
  }

  /** 3D生成・保存用にキャラを解決（一覧・選択・フォーム） */
  function getCharacterFor3dWorkflow() {
    const activeId = getActiveCharacterId();
    const fromList = activeId ? getCharacterById(activeId) : null;
    if (fromList && characterHasCustomImage(fromList)) return fromList;

    const selectId = String($("[data-gen-ai-character-select]")?.value || "").trim();
    if (selectId) {
      const selected = getCharacterById(selectId);
      if (selected && characterHasCustomImage(selected)) return selected;
    }

    const editingId = String($("[data-gen-ai-char-editing-id]")?.value || "").trim();
    const draft = collectCharacterFromForm();
    if (editingId) draft.id = editingId;
    else if (selectId) draft.id = selectId;
    else if (activeId) draft.id = activeId;

    if (characterHasCustomImage(draft)) return draft;
    return fromList || (draft?.id ? draft : null);
  }

  function getCharacterById(id) {
    if (!id) return null;
    return loadCharacters().find((c) => c.id === id) || null;
  }

  function getActiveCharacter() {
    return getCharacterById(getActiveCharacterId());
  }

  function isTasfulBuiltinCharacter(character) {
    return (
      character?.id === TASFUL_BUILTIN_CHARACTER_ID ||
      character?.characterKind === "tasful_builtin"
    );
  }

  function createTasfulBuiltinCharacter() {
    return normalizeCharacter({
      id: TASFUL_BUILTIN_CHARACTER_ID,
      characterKind: "tasful_builtin",
      name: "TASFUL AI",
      nameKana: "タスフル エーアイ",
      personality: "明るく親しみやすい案内役。相談に乗り、手順を整理して伝える。",
      speakingStyle: "です・ます調でわかりやすく、丁寧でフレンドリー",
      firstPerson: "私",
      userCallName: "あなた",
      purpose: "TASFULの案内・相談・作成をサポートします",
      imageUrl: TASFUL_CHARACTER_SRC,
      image: TASFUL_CHARACTER_SRC,
      vrmModelUrl: TASFUL_VRM_URL,
      vrmSource: "tasful_builtin",
      mouthX: 50,
      mouthY: 68,
      mouthScale: 1,
    });
  }

  /** 表示・会話用キャラ（保存済み > TASFUL標準） */
  function getDisplayCharacter() {
    const saved = getActiveCharacter();
    if (saved) return saved;
    return createTasfulBuiltinCharacter();
  }

  function isAllowedCharacterImageType(file) {
    if (!file) return false;
    const type = String(file.type || "").toLowerCase();
    if (CHAR_IMAGE_ALLOWED_TYPES.has(type)) return true;
    return /\.(jpe?g|png|webp)$/i.test(String(file.name || ""));
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//i.test(file.type)) {
        reject(new Error("画像ファイルを選択してください"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("読み込みに失敗しました"));
      reader.readAsDataURL(file);
    });
  }

  function compressCharacterImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//i.test(file.type)) {
        resolve(file);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        const scale = Math.min(1, CHAR_IMAGE_MAX_DIMENSION / Math.max(width, height, 1));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const baseName = String(file.name || "character").replace(/\.[^.]+$/, "");
            resolve(
              new File([blob], `${baseName}.jpg`, {
                type: "image/jpeg",
              })
            );
          },
          "image/jpeg",
          CHAR_IMAGE_JPEG_QUALITY
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("画像の読み込みに失敗しました"));
      };

      img.src = objectUrl;
    });
  }

  async function uploadCharacterImageToStorage(file) {
    const sb = window.TasuSupabase?.getClient?.();
    if (!sb) return null;

    const cfg = window.TasuSupabase?.getConfig?.() || {};
    const userId = String(cfg.currentUserId || cfg.me?.id || "anon").replace(/[^\w\-]+/g, "_");
    const safeName = String(file.name || "character.jpg")
      .replace(/[^\w.\-]+/g, "_")
      .slice(0, 80);
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeName}`;

    const { error } = await sb.storage.from(CHAR_IMAGE_STORAGE_BUCKET).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

    if (error) {
      console.warn("[GenAi] character image storage upload failed:", error.message || error);
      return null;
    }

    const { data } = sb.storage.from(CHAR_IMAGE_STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  }

  /**
   * キャラ画像を圧縮し、Storage が使えれば URL も取得
   * @returns {Promise<{ imageData: string, imageUrl: string|null, label: string }>}
   */
  async function prepareCharacterImage(file) {
    if (!file) throw new Error("画像ファイルを選択してください");
    if (!isAllowedCharacterImageType(file)) {
      throw new Error("jpg / png / webp の画像を選択してください");
    }
    if (file.size > CHAR_IMAGE_MAX_FILE_BYTES) {
      throw new Error("画像サイズが大きすぎます（12MB以下にしてください）");
    }

    const compressed = await compressCharacterImageFile(file);
    const imageData = await readFileAsDataUrl(compressed);
    if (String(imageData).length > CHAR_IMAGE_MAX_DATA_URL_CHARS) {
      throw new Error("画像サイズが大きすぎます。別の画像をお試しください。");
    }

    let imageUrl = null;
    try {
      imageUrl = await uploadCharacterImageToStorage(compressed);
    } catch (err) {
      console.warn("[GenAi] storage upload skipped:", err);
    }

    const kb = Math.max(1, Math.round(String(imageData).length / 1024));
    return {
      imageData,
      imageUrl,
      label: `${file.name || "画像"}（約${kb}KB）`,
    };
  }

  function setCharModeStatus(message, isError) {
    const el = $("[data-gen-ai-char-mode-status]");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("is-error", Boolean(isError));
  }

  function updateCharModePreview(prepared) {
    const wrap = $("[data-gen-ai-char-mode-preview]");
    const img = $("[data-gen-ai-char-mode-preview-img]");
    const cta = $("[data-gen-ai-char-from-image]");
    const lead = $("[data-gen-ai-char-from-image-lead]");

    if (prepared?.imageData) {
      if (wrap) wrap.hidden = false;
      if (img) img.src = prepared.imageUrl || prepared.imageData;
      if (cta) cta.hidden = false;
      if (lead) {
        lead.textContent = pendingCharAppearanceMemo
          ? "見た目メモを生成済みです。マイキャラ作成で反映できます。"
          : "この画像をマイキャラの見た目として使えます。";
      }
      updateImageAnalyzeUi();
      return;
    }

    if (wrap) wrap.hidden = true;
    if (img) img.removeAttribute("src");
    updateImageAnalyzeUi();
  }

  async function syncStagedImageForCharMode(modeId) {
    if (modeId !== "画像キャラ化AI") {
      updateCharModePreview(null);
      setCharModeStatus("");
      return;
    }

    const file = getStagedFile();
    if (!file) {
      pendingCharImageData = null;
      pendingCharImageUrl = null;
      resetPendingImageAnalyzeState();
      updateCharModePreview(null);
      updateCharacterPanels(modeId);
      applyCharacterStageImage(getDisplayCharacter());
      return;
    }

    if (!isAllowedCharacterImageType(file)) {
      setCharModeStatus("jpg / png / webp の画像を添付してください", true);
      return;
    }

    try {
      setCharModeStatus("画像を読み込み中…");
      const prepared = await prepareCharacterImage(file);
      pendingCharImageData = prepared.imageData;
      pendingCharImageUrl = prepared.imageUrl;
      resetPendingImageAnalyzeState();
      updateCharModePreview(prepared);
      setCharModeStatus(`画像を設定しました（${prepared.label}）`);
      updateCharacterPanels(modeId);
      applyCharacterStageImage({
        ...(getActiveCharacter() || {}),
        name: getActiveCharacter()?.name || "プレビュー",
        imageData: prepared.imageData,
        imageUrl: prepared.imageUrl,
      });
    } catch (err) {
      pendingCharImageData = null;
      pendingCharImageUrl = null;
      resetPendingImageAnalyzeState();
      updateCharModePreview(null);
      setCharModeStatus(err.message || "画像の読み込みに失敗しました", true);
    }
  }

  async function applyCharacterImageToForm(file) {
    const prepared = await prepareCharacterImage(file);
    charFormImageData = prepared.imageData;
    charFormImageUrl = prepared.imageUrl;
    charFormImageDirty = true;
    resetCharFormImageAnalyzeState();
    updateCharImagePreviewUi();
    setCharStatus(`画像を設定しました（${prepared.label}）`);
    applyCharacterStageImage({
      ...(collectCharacterFromForm() || {}),
      name: String($("[data-gen-ai-char-name]")?.value || "").trim() || "プレビュー",
      imageData: prepared.imageData,
      imageUrl: prepared.imageUrl,
    });
    return prepared;
  }

  function buildPromptContext(character) {
    if (!character) return { lines: [], summary: "" };
    const c = normalizeCharacter(character);
    const lines = [
      c.name ? `キャラ名: ${c.name}` : "",
      c.nameKana ? `読み仮名: ${c.nameKana}` : "",
      c.personality ? `性格: ${c.personality}` : "",
      c.speakingStyle ? `話し方: ${c.speakingStyle}` : "",
      c.firstPerson ? `一人称: ${c.firstPerson}` : "",
      c.userCallName ? `ユーザーの呼び方: ${c.userCallName}` : "",
      c.userCallNameKana ? `呼び方読み: ${c.userCallNameKana}` : "",
      c.purpose ? `用途: ${c.purpose}` : "",
      c.appearanceMemo ? `見た目: ${c.appearanceMemo}` : "",
    ].filter(Boolean);
    return { lines, summary: lines.join(" / ") };
  }

  function logCharacterPromptDebug(character, modeId) {
    if (!character) return;
    console.log("[GenAi] activeCharacter", character);
    console.log("[GenAi] promptContext", buildPromptContext(character));
    if (modeId) console.log("[GenAi] mode", modeId);
  }

  function usesKansaiTone(character) {
    const hay = `${character.speakingStyle || ""} ${character.personality || ""} ${character.firstPerson || ""}`;
    return /関西|大阪|京都|やで|やな|〜せん|へん|なあ|やろ/.test(hay);
  }

  function usesPoliteTone(character) {
    const hay = `${character.speakingStyle || ""}`;
    return /です・ます|丁寧|敬語/.test(hay);
  }

  function getStageImageSrc(character) {
    if (!character) return TASFUL_CHARACTER_SRC;
    if (isTasfulBuiltinCharacter(character)) return TASFUL_CHARACTER_SRC;
    const url = String(character.imageUrl || "").trim();
    if (url && /^https?:\/\//i.test(url)) return url;
    if (character.imageData) return character.imageData;
    const legacy = character.image;
    if (legacy && (String(legacy).startsWith("data:") || /^https?:\/\//i.test(String(legacy)))) {
      return legacy;
    }
    return DEFAULT_CHARACTER_SRC;
  }

  function applyCharacterStageImage(character) {
    const resolved = character ?? getDisplayCharacter();
    const img = $("[data-ai-character-img]");
    const nameEl = $("[data-gen-ai-stage-char-name]");
    const hint = $("[data-ai-character-stage-hint]");
    const stage = $("[data-ai-character-stage]");

    const src = getStageImageSrc(resolved);
    const fallback = isTasfulBuiltinCharacter(resolved)
      ? TASFUL_CHARACTER_FALLBACK
      : DEFAULT_CHARACTER_FALLBACK;
    const alt = resolved?.name || "AIキャラクター";

    if (img) {
      img.src = src;
      img.onerror = function onErr() {
        if (img.src.indexOf(fallback) === -1 && !String(src).startsWith("data:")) {
          img.src = fallback;
        } else if (img.src.indexOf(fallback) === -1) {
          img.src = fallback;
        } else {
          img.onerror = null;
        }
      };
      img.alt = alt;
    }

    syncLiveStageImage(src, alt);

    if (stage) {
      stage.classList.toggle("is-tasful-builtin", isTasfulBuiltinCharacter(resolved));
    }

    if (nameEl) {
      if (resolved?.name) {
        nameEl.textContent = resolved.name;
        nameEl.hidden = false;
      } else {
        nameEl.textContent = "";
        nameEl.hidden = true;
      }
    }

    if (hint && resolved) {
      hint.textContent = isTasfulBuiltinCharacter(resolved)
        ? TASFUL_CHARACTER_LABEL
        : resolved.purpose || resolved.name || "";
    }

    applyCharacterMouthPosition(resolved);
    maybeAutoSelectStageRenderer(resolved);
  }

  function setCharStatus(message, isError) {
    const el = $("[data-gen-ai-char-status]");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("is-error", Boolean(isError));
  }

  function updateCharImagePreviewUi() {
    const preview = $("[data-gen-ai-char-image-preview]");
    const previewImg = $("[data-gen-ai-char-image-preview-img]");
    const nameEl = $("[data-gen-ai-char-image-name]");
    const clearBtn = $("[data-gen-ai-char-image-clear]");

    if (charFormImageData) {
      if (preview) preview.hidden = false;
      if (previewImg) previewImg.src = charFormImageUrl || charFormImageData;
      if (nameEl) {
        nameEl.textContent = charFormImageUrl
          ? "画像を設定済み（Storage URL + ローカル保存）"
          : "画像を設定済み（ローカル保存）";
      }
      if (clearBtn) clearBtn.hidden = false;
    } else {
      if (preview) preview.hidden = true;
      if (previewImg) previewImg.removeAttribute("src");
      if (nameEl) nameEl.textContent = "未設定（デフォルト画像を使用）";
      if (clearBtn) clearBtn.hidden = true;
    }
    updateImageAnalyzeUi();
  }

  function populateCharacterForm(character) {
    const setVal = (sel, val) => {
      const el = $(sel);
      if (el) el.value = val ?? "";
    };

    setVal("[data-gen-ai-char-editing-id]", character?.id || "");
    setVal("[data-gen-ai-char-name]", character?.name || "");
    setVal("[data-gen-ai-char-name-kana]", character?.nameKana || "");
    setVal("[data-gen-ai-char-personality]", character?.personality || "");
    setVal("[data-gen-ai-char-speaking]", character?.speakingStyle || "");
    setVal("[data-gen-ai-char-first-person]", character?.firstPerson || "");
    setVal("[data-gen-ai-char-user-call]", character?.userCallName || "");
    setVal("[data-gen-ai-char-user-call-kana]", character?.userCallNameKana || "");
    setVal("[data-gen-ai-char-appearance]", character?.appearanceMemo || "");
    setVal("[data-gen-ai-char-purpose]", character?.purpose || "");
    charFormImageData = character?.imageData || null;
    charFormImageUrl = character?.imageUrl || null;
    charFormImageDirty = false;
    charFormImageAnalyzed = Boolean(character?.imageAnalyzed);
    charFormImageUsageCharged = Boolean(character?.imageAnalyzed);
    charFormAppearanceGeneratedAt = character?.imageAppearanceGeneratedAt || null;
    charFormAppearanceSource =
      character?.appearanceSource === "ai" ? "ai" : "manual";
    charFormSeedGenerated = Boolean(character?.characterSeedGenerated);
    charFormSeedGeneratedAt = character?.characterSeedGeneratedAt || null;
    charFormSeedSource =
      character?.characterSeedSource === "ai" ? "ai" : "manual";
    charFormMouthAutoEstimated = Boolean(character?.mouthAutoEstimated);
    charFormMouthAutoEstimatedAt = character?.mouthAutoEstimatedAt || null;
    charFormMouthEstimateSource =
      character?.mouthEstimateSource === "ai" ||
      character?.mouthEstimateSource === "heuristic"
        ? character.mouthEstimateSource
        : "manual";
    charFormMouthEstimateComposition = normalizeComposition(
      character?.mouthEstimateComposition
    );
    setMouthFormValues(character || DEFAULT_MOUTH);
    updateCharImagePreviewUi();
    updateMouthEstimateUi();
    setCharStatus(character ? `「${character.name}」を編集中` : "");
  }

  function clearCharacterForm() {
    populateCharacterForm(null);
    resetCharFormImageAnalyzeState();
    setCharStatus("");
    showImageAnalyzeStatus("", false, "form");
  }

  function collectCharacterFromForm() {
    const editingId = String($("[data-gen-ai-char-editing-id]")?.value || "").trim();
    const existing = editingId ? getCharacterById(editingId) : null;
    const mouth = readMouthFromForm();
    return normalizeCharacter({
      ...(existing || {}),
      id: editingId || existing?.id || undefined,
      name: String($("[data-gen-ai-char-name]")?.value || "").trim(),
      nameKana: String($("[data-gen-ai-char-name-kana]")?.value || "").trim(),
      personality: String($("[data-gen-ai-char-personality]")?.value || "").trim(),
      speakingStyle: String($("[data-gen-ai-char-speaking]")?.value || "").trim(),
      firstPerson: String($("[data-gen-ai-char-first-person]")?.value || "").trim(),
      userCallName: String($("[data-gen-ai-char-user-call]")?.value || "").trim(),
      userCallNameKana: String($("[data-gen-ai-char-user-call-kana]")?.value || "").trim(),
      appearanceMemo: String($("[data-gen-ai-char-appearance]")?.value || "").trim(),
      purpose: String($("[data-gen-ai-char-purpose]")?.value || "").trim(),
      imageData: charFormImageData || null,
      imageUrl: charFormImageUrl || null,
      image: charFormImageUrl || charFormImageData || null,
      mouthX: mouth.mouthX,
      mouthY: mouth.mouthY,
      mouthScale: mouth.mouthScale,
      imageAnalyzed: charFormImageAnalyzed,
      imageAppearanceGeneratedAt: charFormAppearanceGeneratedAt,
      appearanceSource: charFormAppearanceSource,
      characterSeedGenerated: charFormSeedGenerated,
      characterSeedGeneratedAt: charFormSeedGeneratedAt,
      characterSeedSource: charFormSeedSource,
      mouthAutoEstimated: charFormMouthAutoEstimated,
      mouthAutoEstimatedAt: charFormMouthAutoEstimatedAt,
      mouthEstimateSource: charFormMouthEstimateSource,
      mouthEstimateComposition: charFormMouthEstimateComposition,
    });
  }

  function saveCharacterFromForm() {
    const data = collectCharacterFromForm();
    if (!data.name) {
      setCharStatus("キャラ名を入力してください", true);
      return null;
    }

    const editingId = String($("[data-gen-ai-char-editing-id]")?.value || "").trim();
    const willCountImage = shouldCountImageCharacterUsage(data, editingId);
    if (willCountImage && !canUseGenAiFeature(GENAI_USAGE_TYPES.IMAGE_CHARACTER)) {
      showUsageLimitBlocked(GENAI_USAGE_TYPES.IMAGE_CHARACTER);
      return null;
    }

    const list = loadCharacters();
    const now = new Date().toISOString();
    let saved;

    if (editingId) {
      const idx = list.findIndex((c) => c.id === editingId);
      if (idx >= 0) {
        saved = { ...list[idx], ...data, updatedAt: now };
        list[idx] = saved;
      } else {
        saved = { id: editingId, ...data, createdAt: now, updatedAt: now };
        list.push(saved);
      }
    } else {
      saved = { id: generateCharacterId(), ...data, createdAt: now, updatedAt: now };
      list.push(saved);
    }

    if (!saveCharactersList(list)) {
      setCharStatus("保存に失敗しました。画像が大きすぎる可能性があります。", true);
      return null;
    }

    setActiveCharacterId(saved.id);
    renderCharacterSelect();
    populateCharacterForm(saved);
    applyCharacterStageImage(saved);
    setCharStatus(`「${saved.name}」を保存しました`);
    if (willCountImage) incrementGenAiUsage(GENAI_USAGE_TYPES.IMAGE_CHARACTER);
    charFormImageDirty = false;
    return saved;
  }

  function renderCharacterSelect() {
    const select = $("[data-gen-ai-character-select]");
    if (!select) return;

    const activeId = getActiveCharacterId();
    const list = loadCharacters();

    select.innerHTML = '<option value="">TASFUL AI（標準）</option>';
    list.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name || "名称未設定";
      select.appendChild(opt);
    });
    select.value = activeId;
  }

  function updateCharacterPanels(modeId) {
    const bar = $("[data-gen-ai-character-bar]");
    const editor = $("[data-gen-ai-my-character-panel]");
    const fromImage = $("[data-gen-ai-char-from-image]");

    if (bar) bar.hidden = !CHARACTER_PICKER_MODES.includes(modeId);
    if (editor) editor.hidden = modeId !== "マイAIキャラ作成";

    const file = getStagedFile();
    const showFromImage =
      modeId === "画像キャラ化AI" &&
      (Boolean(pendingCharImageData) || (file && isAllowedCharacterImageType(file)));
    if (fromImage) fromImage.hidden = !showFromImage;
  }

  function getTokyoDateKey() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
  }

  function getDefaultGenAiUsage(dateKey) {
    return {
      date: dateKey || getTokyoDateKey(),
      textChatUsed: 0,
      voiceChatUsed: 0,
      imageCharacterUsed: 0,
    };
  }

  function isGenAiPeriodEndActive(periodEnd) {
    if (!periodEnd) return false;
    const t = new Date(periodEnd).getTime();
    return Number.isFinite(t) && t > Date.now();
  }

  function formatGenAiPeriodEndJa(periodEnd) {
    if (!periodEnd) return "";
    try {
      return new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(periodEnd));
    } catch {
      return String(periodEnd).slice(0, 10);
    }
  }

  function getGenAiPlan() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_GENAI_PLAN) || "null");
      if (!raw || typeof raw !== "object") return { ...DEFAULT_GENAI_PLAN };
      const cancelAtPeriodEnd = Boolean(raw.cancelAtPeriodEnd);
      const currentPeriodEnd = raw.currentPeriodEnd || null;
      const cancelScheduled =
        Boolean(raw.cancelScheduled) ||
        (cancelAtPeriodEnd && isGenAiPeriodEndActive(currentPeriodEnd));
      return {
        plan: String(raw.plan || DEFAULT_GENAI_PLAN.plan),
        label: String(raw.label || (raw.plan === "free" ? "無料枠" : raw.plan || DEFAULT_GENAI_PLAN.label)),
        dailyTextLimit: Math.max(0, Number(raw.dailyTextLimit ?? DEFAULT_GENAI_PLAN.dailyTextLimit) || 0),
        dailyVoiceLimit: Math.max(0, Number(raw.dailyVoiceLimit ?? DEFAULT_GENAI_PLAN.dailyVoiceLimit) || 0),
        dailyImageLimit: Math.max(0, Number(raw.dailyImageLimit ?? DEFAULT_GENAI_PLAN.dailyImageLimit) || 0),
        status: String(raw.status || "active"),
        subscriptionStatus: raw.subscriptionStatus || null,
        cancelAtPeriodEnd,
        currentPeriodEnd,
        canceledAt: raw.canceledAt || null,
        cancelScheduled,
        stripeSubscriptionId: raw.stripeSubscriptionId || null,
        updatedAt: raw.updatedAt || null,
        live2dUnlimited: Boolean(raw.live2dUnlimited),
        live2dStatus: raw.live2dStatus || "inactive",
        live2dCurrentPeriodEnd: raw.live2dCurrentPeriodEnd || null,
        live2dCancelScheduled: Boolean(raw.live2dCancelScheduled),
        tickets3dRemaining: Math.max(0, Number(raw.tickets3dRemaining) || 0),
        tickets3dTotalPurchased: Math.max(0, Number(raw.tickets3dTotalPurchased) || 0),
      };
    } catch {
      return { ...DEFAULT_GENAI_PLAN };
    }
  }

  function has2dLiveUnlimited(plan) {
    const p = plan || getGenAiPlan();
    return Boolean(p.live2dUnlimited);
  }

  function saveGenAiPlan(planPayload) {
    const cfg = window.TasuStripeGenAiConfig;
    const free = cfg?.FREE_PLAN || DEFAULT_GENAI_PLAN;
    const currentPeriodEnd = planPayload?.currentPeriodEnd || null;
    const cancelAtPeriodEnd = Boolean(planPayload?.cancelAtPeriodEnd);
    const cancelScheduled =
      Boolean(planPayload?.cancelScheduled) ||
      (cancelAtPeriodEnd && isGenAiPeriodEndActive(currentPeriodEnd));
    const next = {
      plan: String(planPayload?.plan || free.plan),
      label: String(planPayload?.label || free.label || "無料枠"),
      dailyTextLimit: Math.max(0, Number(planPayload?.dailyTextLimit ?? free.dailyTextLimit) || 0),
      dailyVoiceLimit: Math.max(0, Number(planPayload?.dailyVoiceLimit ?? free.dailyVoiceLimit) || 0),
      dailyImageLimit: Math.max(0, Number(planPayload?.dailyImageLimit ?? free.dailyImageLimit) || 0),
      status: String(planPayload?.status || "active"),
      subscriptionStatus: planPayload?.subscriptionStatus || null,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      canceledAt: planPayload?.canceledAt || null,
      cancelScheduled,
      stripeSubscriptionId: planPayload?.stripeSubscriptionId || null,
      updatedAt: planPayload?.updatedAt || new Date().toISOString(),
      live2dUnlimited: Boolean(planPayload?.live2dUnlimited),
      live2dStatus: planPayload?.live2dStatus || "inactive",
      live2dCurrentPeriodEnd: planPayload?.live2dCurrentPeriodEnd || null,
      live2dCancelScheduled: Boolean(planPayload?.live2dCancelScheduled),
      tickets3dRemaining: Math.max(0, Number(planPayload?.tickets3dRemaining) || 0),
      tickets3dTotalPurchased: Math.max(0, Number(planPayload?.tickets3dTotalPurchased) || 0),
    };
    try {
      localStorage.setItem(STORAGE_GENAI_PLAN, JSON.stringify(next));
    } catch (err) {
      console.warn("[GenAi] plan save failed:", err);
    }
    updateGenAiUsageUi();
    updateGenAi3dPrepareUi();
    renderGenAiPlanPanel();
    return next;
  }

  function getGenAiUserId() {
    const cfg = window.TASU_CHAT_SUPABASE_CONFIG || window.TASU_SUPABASE_CONFIG || {};
    return String(cfg.currentUserId || cfg.userId || cfg.user_id || "").trim();
  }

  function getStripeGenAiConfig() {
    return window.TasuStripeGenAiConfig || null;
  }

  function stripeGenAiHeaders() {
    const cfg = getStripeGenAiConfig();
    const anonKey =
      cfg?.getPublishableAnonKey?.() ||
      cfg?.anonKey ||
      window.TasuSupabasePublicKey?.resolvePublishableAnonKey?.(
        window.TASU_CHAT_SUPABASE_CONFIG || window.TASU_SUPABASE_CONFIG || {}
      ) ||
      "";
    if (!anonKey || window.TasuSupabasePublicKey?.isForbiddenKey?.(anonKey)) {
      throw new Error("Supabase 公開キーが未設定です");
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    };
  }

  function showGenAiBillingNotice(message, isError) {
    const target = $("[data-gen-ai-plan-soon]");
    if (!target) return;
    target.hidden = false;
    target.textContent = String(message || "");
    target.classList.toggle("gen-ai-plan-soon--error", Boolean(isError));
    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function cleanGenAiCheckoutUrlParams(keys) {
    try {
      const url = new URL(location.href);
      keys.forEach((key) => url.searchParams.delete(key));
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch {
      /* ignore */
    }
  }

  function setGenAiPlanPanelBusy(busy) {
    const panel = $("[data-gen-ai-plan-panel]");
    if (panel) panel.classList.toggle("gen-ai-plan-panel--busy", Boolean(busy));
    panel
      ?.querySelectorAll(
        "[data-gen-ai-plan-subscribe], [data-gen-ai-plan-portal], [data-gen-ai-plan-addon-cards] button, [data-gen-ai-3d-health-check], [data-gen-ai-3d-test-generate], [data-gen-ai-3d-generate-ticket], [data-gen-ai-3d-buy-ticket]"
      )
      .forEach((btn) => {
        btn.disabled = Boolean(busy);
      });
  }

  function isPaidGenAiPlan(plan) {
    const p = plan || getGenAiPlan();
    const code = String(p.plan || "free");
    return code === "basic_300" || code === "pro_980";
  }

  function hasGenAiStripeBilling(plan) {
    const p = plan || getGenAiPlan();
    return (
      isPaidGenAiPlan(p) ||
      has2dLiveUnlimited(p) ||
      String(p.live2dStatus || "") === "active" ||
      Number(p.tickets3dTotalPurchased) > 0
    );
  }

  function formatGenAiPlanStatusText(current) {
    const plan = current || getGenAiPlan();
    const imageLimitLabel = has2dLiveUnlimited(plan)
      ? "画像アニメ 無制限"
      : `画像 ${plan.dailyImageLimit} 回・日`;
    const limits = `（テキスト ${plan.dailyTextLimit} / 音声 ${plan.dailyVoiceLimit} / ${imageLimitLabel}）`;
    const addonLines = [];
    if (has2dLiveUnlimited(plan)) {
      addonLines.push("2D Live：無制限（適用中）");
    } else if (plan.live2dCancelScheduled && plan.live2dCurrentPeriodEnd) {
      addonLines.push(
        `2D Live：${formatGenAiPeriodEndJa(plan.live2dCurrentPeriodEnd)} まで利用可`
      );
    }
    if (Number(plan.tickets3dRemaining) > 0) {
      addonLines.push(`3D生成チケット：残り ${plan.tickets3dRemaining} 枚`);
    }

    if (plan.plan === "free" && !addonLines.length) {
      return "現在のプラン：無料";
    }

    if (plan.plan === "free" && addonLines.length) {
      return ["現在のプラン：無料", ...addonLines].join("\n");
    }

    const planName = plan.label || plan.plan;
    if (plan.cancelScheduled && plan.currentPeriodEnd) {
      const endLabel = formatGenAiPeriodEndJa(plan.currentPeriodEnd);
      return [
        `現在のプラン：${planName}${limits}`,
        `このプランは ${endLabel} まで利用できます`,
        "期間終了後、無料プランに戻ります",
      ].join("\n");
    }

    const base = `現在のプラン：${planName}${limits}`;
    return addonLines.length ? [base, ...addonLines].join("\n") : base;
  }

  function getGenAiPortalEndpoint() {
    const cfg = getStripeGenAiConfig();
    return cfg?.createPortalUrl || "";
  }

  function handleGenAiPortalError(message, code) {
    const text = String(message || "プラン管理画面を開けませんでした。");
    if (code === "no_customer_id") {
      showGenAiBillingNotice(
        "先にプラン登録が必要です。Basic または Pro プランをお申し込みください。",
        true
      );
      return;
    }
    showGenAiBillingNotice(`${text} AI 機能は引き続きご利用いただけます。`, true);
  }

  async function openGenAiCustomerPortal() {
    const cfg = getStripeGenAiConfig();
    const portalUrl = getGenAiPortalEndpoint();

    if (!cfg?.isConfigured?.() || !portalUrl) {
      handleGenAiPortalError("Stripe プラン管理が未設定です。");
      return;
    }

    const userId = getGenAiUserId();
    if (!userId) {
      handleGenAiPortalError("ユーザーIDが未設定です。chat-supabase-config.js を確認してください。");
      return;
    }

    if (!hasGenAiStripeBilling()) {
      handleGenAiPortalError("有料プランまたはオプション契約中のみプラン管理が利用できます。");
      return;
    }

    try {
      setGenAiPlanPanelBusy(true);
      const res = await fetch(portalUrl, {
        method: "POST",
        headers: stripeGenAiHeaders(),
        body: JSON.stringify({
          userId,
          user_id: userId,
          returnUrl: "gen-ai-workspace.html",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        handleGenAiPortalError(data.error || "Portal Session の作成に失敗しました", data.code);
        return;
      }
      location.href = data.url;
    } catch (err) {
      handleGenAiPortalError(err.message || "プラン管理画面を開けませんでした");
    } finally {
      setGenAiPlanPanelBusy(false);
    }
  }

  function openGenAiPlanPanel() {
    const panel = $("[data-gen-ai-plan-panel]");
    if (!panel) {
      showGenAiBillingNotice("プラン画面を開けませんでした。", true);
      return;
    }
    renderGenAiPlanPanel();
    panel.hidden = false;
    document.body.classList.add("gen-ai-plan-panel-open");
    panel.querySelector("[data-gen-ai-plan-close]")?.focus();
  }

  function closeGenAiPlanPanel() {
    const panel = $("[data-gen-ai-plan-panel]");
    if (panel) panel.hidden = true;
    document.body.classList.remove("gen-ai-plan-panel-open");
  }

  function renderGenAiPlanPanel() {
    const cfg = getStripeGenAiConfig();
    const cardsHost = $("[data-gen-ai-plan-cards]");
    const statusEl = $("[data-gen-ai-plan-status]");
    if (!cardsHost) return;

    const current = getGenAiPlan();
    const free = cfg?.FREE_PLAN || DEFAULT_GENAI_PLAN;
    const plans = cfg?.PLANS ? Object.values(cfg.PLANS) : [];

    if (statusEl) {
      statusEl.textContent = formatGenAiPlanStatusText(current);
      statusEl.classList.toggle(
        "gen-ai-plan-panel__status--cancel-scheduled",
        Boolean(current.cancelScheduled)
      );
    }

    const freeActive = current.plan === "free";
    const cardHtml = [
      `<article class="gen-ai-plan-card${freeActive ? " gen-ai-plan-card--active" : ""}">
        <h3 class="gen-ai-plan-card__title">${free.label || "無料枠"}</h3>
        <p class="gen-ai-plan-card__price">${free.priceLabel || "¥0"}</p>
        <ul class="gen-ai-plan-card__limits">
          <li>テキスト ${free.dailyTextLimit} 回/日</li>
          <li>音声 ${free.dailyVoiceLimit} 回/日</li>
          <li>画像 ${free.dailyImageLimit} 回/日</li>
        </ul>
        ${freeActive ? '<p class="gen-ai-plan-card__badge">適用中</p>' : ""}
      </article>`,
      ...plans.map((plan) => {
        const active = current.plan === plan.plan;
        return `<article class="gen-ai-plan-card${active ? " gen-ai-plan-card--active" : ""}">
          <h3 class="gen-ai-plan-card__title">${plan.label}</h3>
          <p class="gen-ai-plan-card__price">${plan.priceLabel}</p>
          <ul class="gen-ai-plan-card__limits">
            <li>テキスト ${plan.dailyTextLimit} 回/日</li>
            <li>音声 ${plan.dailyVoiceLimit} 回/日</li>
            <li>画像 ${plan.dailyImageLimit} 回/日</li>
          </ul>
          ${
            active
              ? '<p class="gen-ai-plan-card__badge">適用中</p>'
              : `<button type="button" class="gen-ai-plan-card__btn" data-gen-ai-plan-subscribe data-plan-id="${plan.id}">このプランで申し込む</button>`
          }
        </article>`;
      }),
    ].join("");

    cardsHost.innerHTML = cardHtml;
    cardsHost.querySelectorAll("[data-gen-ai-plan-subscribe]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const planId = btn.getAttribute("data-plan-id");
        if (planId) void startGenAiCheckout(planId);
      });
    });

    const addonHost = $("[data-gen-ai-plan-addon-cards]");
    const addons = cfg?.ADDON_PLANS ? Object.values(cfg.ADDON_PLANS) : [];
    if (addonHost) {
      addonHost.innerHTML = addons
        .map((addon) => {
          const liveActive =
            addon.id === "genai_2d_live_300" && has2dLiveUnlimited(current);
          const tickets = Number(current.tickets3dRemaining) || 0;
          const ticketActive = addon.id === "genai_3d_generate_500" && tickets > 0;
          const active = liveActive || ticketActive;
          const badge = liveActive
            ? '<p class="gen-ai-plan-card__badge">2D Live 適用中</p>'
            : ticketActive
              ? `<p class="gen-ai-plan-card__badge">チケット ${tickets} 枚</p>`
              : "";
          const apiNote =
            addon.id === "genai_3d_generate_500" && addon.apiReady === false
              ? '<p class="gen-ai-plan-card__note">3D生成APIは準備中。チケット購入のみ利用できます。</p>'
              : "";
          return `<article class="gen-ai-plan-card gen-ai-plan-card--addon${
            active ? " gen-ai-plan-card--active" : ""
          }">
          <h3 class="gen-ai-plan-card__title">${addon.label}</h3>
          <p class="gen-ai-plan-card__price">${addon.priceLabel}</p>
          <p class="gen-ai-plan-card__desc">${addon.description || ""}</p>
          ${apiNote}
          ${
            active && addon.checkoutMode === "subscription"
              ? badge
              : active
                ? badge
                : `<button type="button" class="gen-ai-plan-card__btn" data-gen-ai-plan-subscribe data-plan-id="${addon.id}">購入する</button>`
          }
        </article>`;
        })
        .join("");
      addonHost.querySelectorAll("[data-gen-ai-plan-subscribe]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const planId = btn.getAttribute("data-plan-id");
          if (planId) void startGenAiCheckout(planId);
        });
      });
    }

    const portalWrap = $("[data-gen-ai-plan-portal-wrap]");
    if (portalWrap) {
      portalWrap.hidden = !hasGenAiStripeBilling(current);
    }
  }

  async function startGenAiCheckout(planId) {
    const cfg = getStripeGenAiConfig();
    if (!cfg?.isConfigured?.()) {
      showGenAiBillingNotice(
        "Stripe Checkout は現在利用できません。無料枠のまま AI 機能はご利用いただけます。",
        true
      );
      return;
    }

    const userId = getGenAiUserId();
    if (!userId) {
      showGenAiBillingNotice(
        "ユーザーIDが未設定です。chat-supabase-config.js の currentUserId を設定してください。",
        true
      );
      return;
    }

    try {
      setGenAiPlanPanelBusy(true);
      const res = await fetch(cfg.createCheckoutUrl, {
        method: "POST",
        headers: stripeGenAiHeaders(),
        body: JSON.stringify({
          genai_plan: planId,
          user_id: userId,
          origin: location.origin,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Checkout Session の作成に失敗しました");
      }
      location.href = data.url;
    } catch (err) {
      showGenAiBillingNotice(
        `${err.message || "決済画面を開けませんでした"}。無料枠のまま AI 機能はご利用いただけます。`,
        true
      );
    } finally {
      setGenAiPlanPanelBusy(false);
    }
  }

  async function confirmGenAiCheckout(sessionId) {
    const cfg = getStripeGenAiConfig();
    if (!cfg?.confirmCheckoutUrl) {
      showGenAiBillingNotice(
        "決済確認 API が未設定です。しばらく待ってからページを再読み込みしてください。",
        true
      );
      return false;
    }

    try {
      showGenAiBillingNotice("決済を確認しています…", false);
      const res = await fetch(cfg.confirmCheckoutUrl, {
        method: "POST",
        headers: stripeGenAiHeaders(),
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "プラン適用に失敗しました");
      }
      if (data.plan) {
        saveGenAiPlan({
          ...data.plan,
          ...(data.entitlements || {}),
          live2dUnlimited: data.entitlements?.live2dUnlimited ?? data.plan.live2dUnlimited,
          tickets3dRemaining:
            data.entitlements?.tickets3dRemaining ?? data.plan.tickets3dRemaining,
          tickets3dTotalPurchased:
            data.entitlements?.tickets3dTotalPurchased ?? data.plan.tickets3dTotalPurchased,
        });
      } else if (data.entitlements) {
        const current = getGenAiPlan();
        saveGenAiPlan({ ...current, ...data.entitlements });
      } else if (data.tickets3dRemaining !== undefined) {
        const current = getGenAiPlan();
        saveGenAiPlan({
          ...current,
          tickets3dRemaining: data.tickets3dRemaining,
          tickets3dTotalPurchased:
            data.entitlements?.tickets3dTotalPurchased ?? current.tickets3dTotalPurchased,
        });
      } else {
        throw new Error(data.error || "プラン適用に失敗しました");
      }
      const noticePlan =
        data.plan?.label ||
        (data.genai_plan === "genai_2d_live_300"
          ? "2D Live 無制限"
          : data.genai_plan === "genai_3d_generate_500"
            ? "3D生成チケット"
            : "オプション");
      showGenAiBillingNotice(`${noticePlan}が適用されました。`, false);
      closeGenAiPlanPanel();
      return true;
    } catch (err) {
      showGenAiBillingNotice(
        `${err.message || "決済確認に失敗しました"}。Webhook 反映までお待ちいただくか、ページを再読み込みしてください。AI 機能は引き続きご利用いただけます。`,
        true
      );
      void syncGenAiPlanFromServer();
      return false;
    }
  }

  async function syncGenAiPlanFromServer() {
    const cfg = getStripeGenAiConfig();
    const userId = getGenAiUserId();
    if (!cfg?.getPlanUrl || !userId) return false;

    try {
      const res = await fetch(cfg.getPlanUrl, {
        method: "POST",
        headers: stripeGenAiHeaders(),
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.plan) {
        saveGenAiPlan(data.plan);
        return true;
      }
    } catch (err) {
      console.warn("[GenAi] plan sync failed:", err);
    }
    return false;
  }

  async function bootGenAiBilling() {
    const params = new URLSearchParams(location.search);
    const checkout = params.get("genai_checkout");
    const sessionId = params.get("session_id");
    const portalReturn = params.get("genai_portal");

    if (checkout === "success" && sessionId) {
      await confirmGenAiCheckout(sessionId);
      cleanGenAiCheckoutUrlParams(["genai_checkout", "session_id"]);
    } else if (checkout === "cancelled") {
      showGenAiBillingNotice("決済はキャンセルされました。無料枠のままご利用いただけます。", false);
      cleanGenAiCheckoutUrlParams(["genai_checkout"]);
    } else if (portalReturn === "return") {
      const synced = await syncGenAiPlanFromServer();
      updateGenAiUsageUi();
      showGenAiBillingNotice(
        synced
          ? "プラン情報を更新しました。"
          : "プラン情報の同期に失敗しました。しばらく待ってから再度お試しください。",
        !synced
      );
      cleanGenAiCheckoutUrlParams(["genai_portal"]);
    }

    void syncGenAiPlanFromServer();
  }

  function saveGenAiUsage(usage) {
    try {
      localStorage.setItem(STORAGE_GENAI_USAGE, JSON.stringify(usage));
      return true;
    } catch (err) {
      console.warn("[GenAi] usage save failed:", err);
      return false;
    }
  }

  function resetGenAiDailyUsageIfNeeded() {
    const today = getTokyoDateKey();
    let usage;
    try {
      usage = JSON.parse(localStorage.getItem(STORAGE_GENAI_USAGE) || "null");
    } catch {
      usage = null;
    }
    if (!usage || typeof usage !== "object" || usage.date !== today) {
      usage = getDefaultGenAiUsage(today);
      saveGenAiUsage(usage);
    }
    return usage;
  }

  function getGenAiUsage() {
    const usage = resetGenAiDailyUsageIfNeeded();
    return {
      date: usage.date,
      textChatUsed: Math.max(0, Number(usage.textChatUsed) || 0),
      voiceChatUsed: Math.max(0, Number(usage.voiceChatUsed) || 0),
      imageCharacterUsed: Math.max(0, Number(usage.imageCharacterUsed) || 0),
    };
  }

  function getGenAiUsageLimit(type) {
    const plan = getGenAiPlan();
    if (type === GENAI_USAGE_TYPES.VOICE_CHAT) return plan.dailyVoiceLimit;
    if (type === GENAI_USAGE_TYPES.IMAGE_CHARACTER) {
      if (has2dLiveUnlimited(plan)) return 999999;
      return plan.dailyImageLimit;
    }
    return plan.dailyTextLimit;
  }

  function getGenAiUsageUsed(type) {
    const usage = getGenAiUsage();
    if (type === GENAI_USAGE_TYPES.VOICE_CHAT) return usage.voiceChatUsed;
    if (type === GENAI_USAGE_TYPES.IMAGE_CHARACTER) return usage.imageCharacterUsed;
    return usage.textChatUsed;
  }

  function getGenAiUsageRemaining(type) {
    return Math.max(0, getGenAiUsageLimit(type) - getGenAiUsageUsed(type));
  }

  function canUseGenAiFeature(type) {
    return getGenAiUsageRemaining(type) > 0;
  }

  function incrementGenAiUsage(type) {
    const usage = getGenAiUsage();
    if (type === GENAI_USAGE_TYPES.VOICE_CHAT) usage.voiceChatUsed += 1;
    else if (type === GENAI_USAGE_TYPES.IMAGE_CHARACTER) usage.imageCharacterUsed += 1;
    else usage.textChatUsed += 1;
    saveGenAiUsage(usage);
    updateGenAiUsageUi();
    return usage;
  }

  function resolveUsageTypeForSend(modeId) {
    if (modeId === "音声会話AI") return GENAI_USAGE_TYPES.VOICE_CHAT;
    return GENAI_USAGE_TYPES.TEXT_CHAT;
  }

  function shouldCountImageCharacterUsage(saved, editingId) {
    if (!saved?.imageData) return false;
    if (charFormImageAnalyzed) return false;
    if (!editingId) return true;
    return charFormImageDirty || /画像キャラ化/.test(String(saved.purpose || ""));
  }

  function showUsageLimitBlocked(type) {
    const label = GENAI_USAGE_LABELS[type] || "この機能";
    const plan = getGenAiPlan();
    const remaining = getGenAiUsageRemaining(type);
    const msg =
      plan.plan === "free"
        ? `本日の無料回数を使い切りました（${label}）`
        : `${label}の残り回数：${remaining}回`;
    const limitEl = $("[data-gen-ai-usage-limit]");
    const limitMsg = $("[data-gen-ai-usage-limit-msg]");
    if (limitEl) limitEl.hidden = false;
    if (limitMsg) limitMsg.textContent = msg;
    showVoiceStatus(msg, { persistMs: 3500, isError: true });
    setCharStatus(msg, true);
    updateGenAiUsageUi();
  }

  function hideUsageLimitBanner() {
    const limitEl = $("[data-gen-ai-usage-limit]");
    if (limitEl) limitEl.hidden = true;
  }

  function updateGenAiUsageUi() {
    resetGenAiDailyUsageIfNeeded();
    const plan = getGenAiPlan();
    const textRemaining = getGenAiUsageRemaining(GENAI_USAGE_TYPES.TEXT_CHAT);
    const voiceRemaining = getGenAiUsageRemaining(GENAI_USAGE_TYPES.VOICE_CHAT);
    const imageRemaining = getGenAiUsageRemaining(GENAI_USAGE_TYPES.IMAGE_CHARACTER);
    const imageLabel = has2dLiveUnlimited(plan) ? "画像アニメ 無制限" : `画像残り ${imageRemaining} 回`;

    const planLabel = plan.label || (plan.plan === "free" ? "無料枠" : plan.plan);
    const ticketNote =
      Number(plan.tickets3dRemaining) > 0 ? ` / 3Dチケット ${plan.tickets3dRemaining}` : "";
    const headerLine = `${planLabel} テキスト残り ${textRemaining} 回 / 音声残り ${voiceRemaining} 回 / ${imageLabel}${ticketNote}`;
    const chatLine = has2dLiveUnlimited(plan)
      ? `本日 テキスト ${textRemaining} ・ 音声 ${voiceRemaining} ・ 画像アニメ 無制限${ticketNote}`
      : `本日 テキスト ${textRemaining} ・ 音声 ${voiceRemaining} ・ 画像 ${imageRemaining}${ticketNote}`;

    [$("[data-gen-ai-usage-header]"), $("[data-gen-ai-usage-detail]")].forEach((el) => {
      if (el) el.textContent = headerLine;
    });
    const chat = $("[data-gen-ai-usage-chat]");
    if (chat) chat.textContent = chatLine;

    const anyDepleted =
      textRemaining <= 0 || voiceRemaining <= 0 || imageRemaining <= 0;
    document.querySelectorAll("[data-gen-ai-usage-plan-btn]").forEach((btn) => {
      btn.classList.toggle("gen-ai-plan-btn--emphasis", anyDepleted);
    });
    updateImageAnalyzeUi();

    const allDepleted =
      textRemaining <= 0 && voiceRemaining <= 0 && imageRemaining <= 0;
    if (!allDepleted) hideUsageLimitBanner();
  }

  function bindGenAiUsageUi() {
    document.querySelectorAll("[data-gen-ai-usage-plan-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openGenAiPlanPanel();
      });
    });
    $("[data-gen-ai-plan-close]")?.addEventListener("click", () => {
      closeGenAiPlanPanel();
    });
    $("[data-gen-ai-plan-panel]")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeGenAiPlanPanel();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeGenAiPlanPanel();
    });
    $("[data-gen-ai-plan-portal]")?.addEventListener("click", () => {
      void openGenAiCustomerPortal();
    });
    renderGenAiPlanPanel();
    updateGenAiUsageUi();
  }

  function getUsageCount() {
    try {
      return Number(localStorage.getItem(STORAGE_USAGE) || 0) || 0;
    } catch {
      return 0;
    }
  }

  function incrementUsageCount() {
    incrementGenAiUsage(GENAI_USAGE_TYPES.TEXT_CHAT);
  }

  function updateUsageUi() {
    updateGenAiUsageUi();
  }

  function getHistory(mode) {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_HISTORY + mode) || "[]");
    } catch {
      return [];
    }
  }

  function setHistory(mode, messages) {
    try {
      localStorage.setItem(STORAGE_HISTORY + mode, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
  }

  function getModeMeta(modeId) {
    const useDisplay =
      CHARACTER_STAGE_MODES.includes(modeId) || GEMINI_CHARACTER_MODES.has(modeId);
    const character = useDisplay ? getDisplayCharacter() : getActiveCharacter();
    const imageFallback = isTasfulBuiltinCharacter(character)
      ? TASFUL_CHARACTER_FALLBACK
      : DEFAULT_CHARACTER_FALLBACK;
    return {
      id: modeId,
      label: modeId,
      description: TOOL_DESCRIPTIONS[modeId] || "",
      conciergePlaceholder: character
        ? character.purpose || character.name || ""
        : TOOL_DESCRIPTIONS[modeId] || "",
      inputPlaceholder: PLACEHOLDERS[modeId] || "メッセージを入力…",
      characterImage: character ? getStageImageSrc(character) : DEFAULT_CHARACTER_SRC,
      characterImageFallback: imageFallback,
      speechEnabled: SPEECH_MODES.includes(modeId),
    };
  }

  function shouldShowCharacterStage(modeId) {
    return CHARACTER_STAGE_MODES.includes(modeId);
  }

  function shouldSpeak(modeId) {
    return SPEECH_MODES.includes(modeId);
  }

  function syncStageAvatar3D(options = {}) {
    if (stageRendererMode !== "3d") return;
    const stage = document.querySelector("[data-ai-character-stage]");
    const speaking =
      options.speaking !== undefined
        ? Boolean(options.speaking)
        : Boolean(stage?.classList.contains("is-speaking") || isSpeaking);
    const listening =
      options.listening !== undefined ? Boolean(options.listening) : Boolean(isListening);
    const backend = getActive3dBackend();
    if (backend === "vrm" && window.GenAiCharacterVrm) {
      window.GenAiCharacterVrm.syncSpeaking(speaking, listening);
      if (options.expression) window.GenAiCharacterVrm.syncExpression(options.expression);
      return;
    }
    const g3d = window.GenAiCharacter3D;
    if (!g3d) return;
    g3d.syncSpeaking(speaking, listening);
    if (options.expression) g3d.syncExpression(options.expression);
  }

  function inferStageExpressionFromText(text) {
    if (window.GenAiCharacterExpression?.inferExpressionFromText) {
      return window.GenAiCharacterExpression.inferExpressionFromText(text);
    }
    return (
      window.GenAiCharacterVrm?.inferExpressionFromText?.(text) ||
      window.GenAiCharacter3D?.inferExpressionFromText?.(text) ||
      "neutral"
    );
  }

  function setMouthSpeaking(active) {
    const on = Boolean(active);
    const mouth = document.querySelector("[data-character-mouth]");
    if (mouth) mouth.classList.toggle("is-speaking", on);
    const stage = document.querySelector("[data-ai-character-stage]");
    if (stage) stage.classList.toggle("is-speaking", on);
    if (document.body) {
      if (on) document.body.setAttribute("data-ai-speaking", "true");
      else document.body.removeAttribute("data-ai-speaking");
    }
    isSpeaking = on;
    syncStageAvatarState({ speaking: on });
    updateVoiceInputUi();
  }

  /**
   * 表示テキストを音声読み上げ（口パク連動は ai-concierge 経由）
   * @returns {boolean}
   */
  function speak(displayText, options) {
    if (!window.TasuAiConcierge?.speak) return false;
    return window.TasuAiConcierge.speak(displayText, options || {});
  }

  function getCharacterGreeting(character) {
    logCharacterPromptDebug(character, "greeting");
    const call = character.userCallName || "きみ";
    const name = character.name || "キャラ";

    if (usesKansaiTone(character)) {
      return `うちは${name}やで。\n${call}、はじめまして。\n\n今日は何を話そっか？\n相談でも雑談でもええよ。`;
    }
    if (usesPoliteTone(character)) {
      return `はじめまして、${name}です。\n${call}、こんにちは。\n\n今日はどのようなお話をしましょうか？`;
    }
    return `はじめまして、${name}です。\n${call}、こんにちは。\n\n今日は何を話しましょう？\n相談でも雑談でも大丈夫ですよ。`;
  }

  function getGreeting(modeId) {
    const character =
      modeId === "AIキャラ会話" || modeId === "音声会話AI" ? getDisplayCharacter() : getActiveCharacter();

    if (modeId === "AIキャラ会話") {
      return getCharacterGreeting(character);
    }
    if (modeId === "音声会話AI") {
      const call = character.userCallName || "きみ";
      const name = character.name || "キャラ";
      logCharacterPromptDebug(character, "greeting");
      if (usesKansaiTone(character)) {
        return `うちは${name}やで。\n${call}、声でも話そ。\n\n話したいことを送ってな。`;
      }
      return `${name}です。\n${call}、こんにちは。\n\n話したいことを送ってください。音声ONなら読み上げます。`;
    }
    if (modeId === "マイAIキャラ作成") {
      return (
        "マイAIキャラ作成モードです。\n下の設定パネルに入力して「キャラを保存」してください。" +
        "\n\n保存したキャラは会話モードのセレクトから選べます。"
      );
    }
    if (modeId === "画像キャラ化AI") {
      return (
        "画像キャラ化AIです。\n" +
        "jpg / png / webp の画像を添付してください。\n" +
        "性格・話し方を入力し、「この画像でマイキャラを作成」から保存できます。\n\n" +
        "画像生成API未設定時は、アップロード画像をそのままキャラ画像として使います。"
      );
    }
    const desc = TOOL_DESCRIPTIONS[modeId] || "";
    return `${modeId}モードです。\n${desc}\n\nメッセージを入力するか、必要に応じてファイルを添付してください。`;
  }

  function mockReplyInCharacterVoice(character, userText, attachName) {
    logCharacterPromptDebug(character, "AIキャラ会話");

    const c = normalizeCharacter(character);
    const call = c.userCallName || "きみ";
    const name = c.name || "キャラ";
    const t = String(userText || "").trim();
    const kansai = usesKansaiTone(c);
    const polite = usesPoliteTone(c);

    if (/^(こんにちは|こんばんは|おはよう|やあ|ども|hello|hi|やっほー|よー)/i.test(t) || /^こんにちは/.test(t)) {
      if (kansai) {
        return `うちは${name}やで。\n${call}、こんにちは。\n\n今日は何を話そっか？\n相談でも雑談でも聞くよ。`;
      }
      if (polite) {
        return `はじめまして、${name}です。\n${call}、こんにちは。\n\n本日はどのようなご用件でしょうか？`;
      }
      return `はじめまして、${name}です。\n${call}、こんにちは。\n\n今日は何を話しましょう？\n相談でも雑談でも大丈夫ですよ。`;
    }

    if (/ありがと|感謝|サンキュー|thanks/i.test(t)) {
      if (kansai) {
        return `こちらこそ、${call}。\nうれしいわ。`;
      }
      return `${call}、こちらこそありがとう。\nお力になれてうれしいです。`;
    }

    if (/疲れた|しんどい|つらい|悲しい|落ち込|不安|悩ん|困っ|相談/i.test(t)) {
      if (kansai) {
        return `おお、${call}。\nそれはしんどいな。\nゆっくり話してみて。うちが聞くから。`;
      }
      return `${call}、大変でしたね。\nよければ、少しずつ話してみてください。\nゆっくり聞きます。`;
    }

    if (/元気|どう|調子|最近/i.test(t)) {
      if (kansai) {
        return `うちは元気やで。\n${call}はどう？`;
      }
      return `おかげさまで元気です。\n${call}はいかがですか？`;
    }

    if (!t && attachName) {
      if (kansai) {
        return `おお、送ってくれたんやな。\n${call}、どんな話から始める？`;
      }
      return `ありがとう、${call}。\n送ってくれた内容、一緒に見ていきましょう。`;
    }

    const topic = t.slice(0, 80) + (t.length > 80 ? "…" : "");

    if (kansai) {
      return `${call}、そうなんや。\n「${topic}」のこと、うちと一緒に考えよ。\n\n他にも気になることあったら、なんでも言うてな。`;
    }
    if (polite) {
      return `${call}、承知いたしました。\n「${topic}」について、一緒に整理していきましょう。`;
    }
    if (/？|\?/.test(t)) {
      return `${call}、いい質問ですね。\n「${topic}」について、一緒に考えてみましょう。`;
    }
    return `${call}、なるほど。\n「${topic}」のこと、一緒に考えていきましょう。\n\n他にも話したいことがあれば、どうぞ。`;
  }

  function mockReply(modeId, userText, messages, attachName) {
    const t = String(userText || "").trim();
    const character =
      modeId === "AIキャラ会話" || modeId === "音声会話AI"
        ? getDisplayCharacter()
        : getActiveCharacter();

    if (modeId === "AIキャラ会話") {
      return mockReplyInCharacterVoice(character, t, attachName);
    }

    if (modeId === "音声会話AI") {
      return mockReplyInCharacterVoice(character, t, attachName);
    }

    if (modeId === "マイAIキャラ作成") {
      const draft = collectCharacterFromForm();
      return (
        "【キャラプレビュー】\n" +
        "・名前: " +
        (draft.name || "（未入力）") +
        "\n" +
        "・読み仮名: " +
        (draft.nameKana || "—") +
        "\n" +
        "・性格: " +
        (draft.personality || "—") +
        "\n" +
        "・話し方: " +
        (draft.speakingStyle || "—") +
        "\n" +
        "・一人称: " +
        (draft.firstPerson || "—") +
        "\n" +
        "・呼び方: " +
        (draft.userCallName || "—") +
        "\n" +
        "・呼び方読み: " +
        (draft.userCallNameKana || "—") +
        "\n" +
        "・用途: " +
        (draft.purpose || t.slice(0, 60) || "—") +
        "\n\n「キャラを保存」で localStorage に登録できます。"
      );
    }

    if (modeId === "画像キャラ化AI") {
      return (
        "画像キャラ化AIです。\n" +
        (attachName || pendingCharImageData
          ? `・参照画像: ${attachName || "設定済み"}\n`
          : "・画像を添付してください（jpg / png / webp）。\n") +
        "・性格・話し方: " +
        (t.slice(0, 80) || "（入力待ち）") +
        "\n\n「この画像でマイキャラを作成」から設定画面へ進めます。\n" +
        "画像生成API未設定時は、アップロード画像をそのままキャラ画像として使います。"
      );
    }

    if (modeId === "文章作成") {
      return (
        "【文章たたき台（デモ）】\n" + t.slice(0, 120) + "\n\nご希望に合わせてトーンや長さを調整できます。"
      );
    }
    if (modeId === "画像解析") {
      return (
        "【画像解析結果（デモ）】\n" +
        (attachName ? `ファイル「${attachName}」を受け取りました。\n` : "") +
        (t ? `補足: ${t}` : "")
      );
    }
    if (modeId === "PDF要約") {
      return (
        "【PDF要約（デモ）】\n" +
        (attachName ? `「${attachName}」の要約プレビューです。\n` : "PDFを添付すると要約します。\n") +
        (t ? `質問への回答: ${t.slice(0, 100)}` : "")
      );
    }

    return (
      "ご質問ありがとうございます。\n\n" +
      (t || "（内容なし）") +
      attachNote +
      "\n\n※本番では生成AI APIに接続予定です。"
    );
  }

  function renderWelcomeTools() {
    const host = $("[data-welcome-tools]");
    if (!host) return;
    host.innerHTML = "";

    const charLabel = document.createElement("p");
    charLabel.className = "welcome-tools__group-label welcome-tools__group-label--character";
    charLabel.textContent = "AIキャラクター";
    host.appendChild(charLabel);

    CHARACTER_TOOLS.forEach((tool) => {
      host.appendChild(createWelcomeCard(tool, true));
    });

    const genLabel = document.createElement("p");
    genLabel.className = "welcome-tools__group-label";
    genLabel.textContent = "汎用AI";
    host.appendChild(genLabel);

    GENERIC_TOOLS.forEach((tool) => {
      host.appendChild(createWelcomeCard(tool, false));
    });
  }

  function createWelcomeCard(tool, isCharacter) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "welcome-tool-card" + (isCharacter ? " welcome-tool-card--character" : "");
    btn.setAttribute("data-mode", tool.mode);
    btn.setAttribute("data-welcome-tool", "");
    btn.innerHTML =
      '<span class="welcome-tool-card__icon" aria-hidden="true">' +
      escapeHtml(tool.icon) +
      "</span>" +
      '<span class="welcome-tool-card__title">' +
      escapeHtml(tool.mode) +
      "</span>" +
      '<span class="welcome-tool-card__desc">' +
      escapeHtml(TOOL_DESCRIPTIONS[tool.mode] || "") +
      "</span>";
    return btn;
  }

  function renderToolDropdown(select, activeMode) {
    if (!select) return;
    select.innerHTML = "";
    const charGroup = document.createElement("optgroup");
    charGroup.label = "AIキャラクター";
    CHARACTER_TOOLS.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.mode;
      opt.textContent = t.mode;
      charGroup.appendChild(opt);
    });
    select.appendChild(charGroup);

    const genGroup = document.createElement("optgroup");
    genGroup.label = "汎用AI";
    GENERIC_TOOLS.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.mode;
      opt.textContent = t.mode;
      genGroup.appendChild(opt);
    });
    select.appendChild(genGroup);

    select.value = activeMode;
  }

  function appendMessage(role, content, meta) {
    const chatRoot = $("[data-gen-ai-chat]");
    const modeId = chatRoot?.getAttribute("data-mode") || DEFAULT_MODE;
    const messagesEl = $("[data-gen-ai-messages]");
    if (!messagesEl) return [];
    const messages = getHistory(modeId);
    const row = {
      role: role === "user" ? "user" : "assistant",
      content: String(content || ""),
    };
    if (meta && typeof meta === "object") {
      if (meta.search_used) row.search_used = true;
      if (meta.search_query) row.search_query = meta.search_query;
      if (meta.search_provider) row.search_provider = meta.search_provider;
      if (meta.search_result_count != null) row.search_result_count = meta.search_result_count;
    }
    messages.push(row);
    setHistory(modeId, messages);
    renderMessages(messagesEl, messages);
    return messages;
  }

  function renderMessages(container, messages) {
    container.innerHTML = messages
      .map((m) => {
        const role = m.role === "user" ? "user" : "assistant";
        const badge =
          role === "assistant" && m.search_used
            ? global.TasuAiSearchOrchestrator?.BADGE_HTML || ""
            : "";
        return (
          '<div class="chat-area__msg chat-area__msg--' +
          role +
          '">' +
          '<div class="chat-area__bubble">' +
          badge +
          (role === "assistant" ? formatText(m.content) : escapeHtml(m.content)) +
          "</div></div>"
        );
      })
      .join("");
    container.scrollTop = container.scrollHeight;
  }

  function syncCharacterUi(modeId) {
    const meta = getModeMeta(modeId);
    const character =
      CHARACTER_STAGE_MODES.includes(modeId) ? getDisplayCharacter() : getActiveCharacter();

    if (window.TasuAiConcierge?.updateCharacterStageForMode) {
      window.TasuAiConcierge.updateCharacterStageForMode(meta, {
        showStage: shouldShowCharacterStage(modeId),
      });
    }

    applyCharacterStageImage(character);

    syncMouthPreviewMode(modeId);
    if (modeId === "マイAIキャラ作成") {
      previewMouthFromForm();
    }

    const layout = $("[data-gen-ai-layout]");
    const panel = $("[data-gen-ai-character-panel]");
    const show = shouldShowCharacterStage(modeId);
    if (layout) layout.classList.toggle("gen-ai-layout--with-stage", show);
    if (panel) {
      panel.hidden = !show;
      panel.classList.toggle("is-visible", show);
    }

    const voice = $("[data-ai-voice-control]");
    if (voice) voice.hidden = !SPEECH_MODES.includes(modeId);

    renderCharacterSelect();
    updateCharacterPanels(modeId);

    if (modeId === "マイAIキャラ作成") {
      const active = getActiveCharacter();
      if (active && !$("[data-gen-ai-char-editing-id]")?.value) {
        populateCharacterForm(active);
      }
    }

    updateVoiceInputUi();
  }

  function setActiveMode(modeId, { reset = false } = {}) {
    const chatRoot = $("[data-gen-ai-chat]");
    const messagesEl = $("[data-gen-ai-messages]");
    const input = $("[data-gen-ai-input]");
    const dropdown = $("[data-tool-dropdown]");
    const welcome = $("[data-gen-ai-welcome]");
    const chatView = $("[data-gen-ai-chat-view]");

    if (!chatRoot || !messagesEl) return;

    chatRoot.setAttribute("data-mode", modeId);
    if (input) input.placeholder = PLACEHOLDERS[modeId] || "メッセージを入力…";
    if (dropdown) renderToolDropdown(dropdown, modeId);

    let messages = reset ? [] : getHistory(modeId);
    if (!messages.length) {
      messages = [{ role: "assistant", content: getGreeting(modeId) }];
      setHistory(modeId, messages);
    }
    renderMessages(messagesEl, messages);
    syncCharacterUi(modeId);

    if (modeId === "画像キャラ化AI") {
      void syncStagedImageForCharMode(modeId);
    } else {
      pendingCharImageData = null;
      pendingCharImageUrl = null;
      updateCharModePreview(null);
      setCharModeStatus("");
    }

    if (welcome) welcome.hidden = true;
    if (chatView) chatView.hidden = false;

    const url = new URL(location.href);
    url.searchParams.set("mode", modeId);
    history.replaceState({}, "", url);
  }

  function getStagedFile() {
    const input = $("[data-gen-ai-file]");
    return input?.files?.[0] || null;
  }

  function clearStagedFile() {
    const input = $("[data-gen-ai-file]");
    const nameEl = $("[data-gen-ai-file-name]");
    if (input) input.value = "";
    if (nameEl) nameEl.textContent = "";
    pendingCharImageData = null;
    pendingCharImageUrl = null;
    resetPendingImageAnalyzeState();
    const modeId = $("[data-gen-ai-chat]")?.getAttribute("data-mode");
    if (modeId) {
      updateCharModePreview(null);
      setCharModeStatus("");
      updateCharacterPanels(modeId);
      if (modeId === "画像キャラ化AI") applyCharacterStageImage(getDisplayCharacter());
    }
  }

  async function openMyCharacterFromStagedImage(options = {}) {
    const file = getStagedFile();
    const imageData = pendingCharImageData;
    const imageUrl = pendingCharImageUrl;

    if (!imageData && (!file || !isAllowedCharacterImageType(file))) {
      setCharModeStatus("画像ファイルを添付してください", true);
      return;
    }

    try {
      let prepared;
      if (imageData) {
        prepared = { imageData, imageUrl, label: file?.name || "画像" };
      } else {
        prepared = await prepareCharacterImage(file);
      }

      const memo = pendingCharAppearanceMemo;
      const seed = pendingCharSeed;
      const analyzed = pendingCharImageAnalyzed;
      const fp = pendingCharImageFingerprint;

      charFormImageData = prepared.imageData;
      charFormImageUrl = prepared.imageUrl;
      charFormImageDirty = true;
      charFormImageAnalyzed = analyzed;
      charFormImageUsageCharged = analyzed;
      charFormImageFingerprint =
        fp || getImageFingerprint(prepared.imageData, prepared.imageUrl);

      setActiveMode("マイAIキャラ作成", { reset: false });
      populateCharacterForm({
        id: "",
        name: "",
        personality: "",
        speakingStyle: "",
        purpose: "画像キャラ化から作成",
        appearanceMemo: "",
        imageData: prepared.imageData,
        imageUrl: prepared.imageUrl,
        image: prepared.imageUrl || prepared.imageData,
        imageAnalyzed: analyzed,
      });

      const overwriteAll = getImageAnalyzeOverwrite("form");
      if (seed) {
        applyCharacterSeedToForm(
          { ...seed, appearance: memo || seed.appearance },
          { overwriteAll, appearance: memo }
        );
      } else if (memo) {
        applyAnalyzedAppearanceToForm(memo, { mode: overwriteAll ? "replace" : "replace" });
      }

      if (pendingCharMouthEstimate) {
        applyMouthEstimateToForm(pendingCharMouthEstimate, {
          source: pendingCharMouthEstimate.source || "heuristic",
          auto: true,
        });
        pendingCharMouthEstimate = null;
      }

      const statusMsg = seed
        ? "画像とキャラ設定案を反映しました。微調整して保存してください。"
        : memo
          ? "画像と見た目メモを設定しました。性格・話し方を入力して保存してください。"
          : "画像を設定しました。性格・話し方を入力して保存してください。";
      setCharStatus(statusMsg);
      clearStagedFile();
    } catch (err) {
      setCharModeStatus(err.message || "画像の読み込みに失敗しました", true);
      setCharStatus(err.message || "画像の読み込みに失敗しました", true);
    }
  }

  async function sendMessage(forcedText) {
    const chatRoot = $("[data-gen-ai-chat]");
    const modeId = chatRoot?.getAttribute("data-mode") || DEFAULT_MODE;
    const input = $("[data-gen-ai-input]");
    const messagesEl = $("[data-gen-ai-messages]");
    const sendBtn = $("[data-gen-ai-send]");
    const text =
      forcedText !== undefined
        ? String(forcedText || "").trim()
        : String(input?.value || "").trim();
    const file = getStagedFile();
    const attachName = file?.name || "";

    if (!text && !file) return;
    if (isSending) return;

    const usageType = resolveUsageTypeForSend(modeId);
    if (!canUseGenAiFeature(usageType)) {
      showUsageLimitBlocked(usageType);
      return;
    }

    clearListenRestartTimer();
    suppressListenRestartOnce();
    stopListening();
    voiceSendPhase = "submitting";
    isSending = true;
    updateVoiceInputUi();

    const userContent = text || (attachName ? `（${attachName} を添付）` : "");
    let messages = appendMessage("user", userContent);
    if (input) input.value = "";
    if (sendBtn) sendBtn.disabled = true;

    try {
      voiceSendPhase = "responding";
      updateVoiceInputUi();
      const result = await requestAssistantReply(modeId, text, messages, attachName);
      const reply = result?.reply || result;
      const usedGemini = Boolean(result?.usedGemini);
      messages = appendMessage("assistant", reply, {
        search_used: result?.search_used,
        search_query: result?.search_query,
        search_provider: result?.search_provider,
        search_result_count: result?.search_result_count,
      });
      isSending = false;
      voiceSendPhase = "idle";
      updateVoiceInputUi();

      if (usedGemini) {
        incrementGenAiUsage(usageType);
      }

      if (isGeminiConfigured() && !usedGemini && handsFreeMicActive) {
        showVoiceStatus("接続エラーのため通常応答に切り替えました", { persistMs: 2800, isError: true });
      }

      const expr = inferStageExpressionFromText(reply);
      syncStageAvatarState({ expression: expr });

      if (shouldSpeak(modeId)) {
        setMouthSpeaking(true);
        speak(reply, {
          mode: getModeMeta(modeId),
          activeCharacter: getDisplayCharacter(),
        });
        await waitForSpeechEnd();
        setMouthSpeaking(false);
      } else {
        setMouthSpeaking(false);
      }
    } catch (err) {
      console.warn("[GenAi] sendMessage error:", err);
      syncStageAvatarState({ expression: "concerned" });
      showVoiceStatus("エラーが発生しました。通常チャットは続けられます", { persistMs: 2800, isError: true });
    } finally {
      isSending = false;
      voiceSendPhase = "idle";
      clearStagedFile();
      if (sendBtn) sendBtn.disabled = false;
      updateVoiceInputUi();
      scheduleListenRestart();
      if (forcedText === undefined) input?.focus();
    }
  }

  function bindCharacterUi() {
    $("[data-gen-ai-character-select]")?.addEventListener("change", (e) => {
      const id = e.target.value;
      setActiveCharacterId(id);
      const character = id ? getActiveCharacter() : getDisplayCharacter();
      applyCharacterStageImage(character);
      const modeId = $("[data-gen-ai-chat]")?.getAttribute("data-mode") || DEFAULT_MODE;
      syncCharacterUi(modeId);
      if (stageRendererMode === "3d") {
        void loadPreferred3dStage(character, { quiet: true });
      }
    });

    $("[data-gen-ai-char-form]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveCharacterFromForm();
    });

    $("[data-gen-ai-char-new]")?.addEventListener("click", () => {
      clearCharacterForm();
      setActiveCharacterId("");
      renderCharacterSelect();
      applyCharacterStageImage(getDisplayCharacter());
    });

    $("[data-gen-ai-char-image-pick]")?.addEventListener("click", () => {
      $("[data-gen-ai-char-image]")?.click();
    });

    $("[data-gen-ai-char-image]")?.addEventListener("change", async () => {
      const file = $("[data-gen-ai-char-image]")?.files?.[0];
      if (!file) return;
      try {
        await applyCharacterImageToForm(file);
      } catch (err) {
        setCharStatus(err.message || "画像の読み込みに失敗しました", true);
      }
    });

    $("[data-gen-ai-char-image-clear]")?.addEventListener("click", () => {
      charFormImageData = null;
      charFormImageUrl = null;
      charFormImageDirty = false;
      resetCharFormImageAnalyzeState();
      const input = $("[data-gen-ai-char-image]");
      if (input) input.value = "";
      updateCharImagePreviewUi();
      showImageAnalyzeStatus("", false, "form");
      applyCharacterStageImage(getDisplayCharacter());
    });

    $("[data-gen-ai-char-analyze-btn]")?.addEventListener("click", () => {
      void analyzeCharacterImage({ target: "form", analyzeKind: "appearance" });
    });

    $("[data-gen-ai-char-seed-btn]")?.addEventListener("click", () => {
      void analyzeCharacterImage({ target: "form", analyzeKind: "seed" });
    });

    $("[data-gen-ai-char-mode-analyze-btn]")?.addEventListener("click", () => {
      void analyzeCharacterImage({ target: "mode", analyzeKind: "appearance" });
    });

    $("[data-gen-ai-char-mode-seed-btn]")?.addEventListener("click", () => {
      void analyzeCharacterImage({ target: "mode", analyzeKind: "seed" });
    });

    $("[data-gen-ai-char-appearance]")?.addEventListener("input", () => {
      if (charFormAppearanceSource === "ai") {
        charFormAppearanceSource = "manual";
      }
    });

    ["[data-gen-ai-char-mouth-x]", "[data-gen-ai-char-mouth-y]", "[data-gen-ai-char-mouth-scale]"].forEach(
      (selector) => {
        $(selector)?.addEventListener("input", () => {
          markMouthManuallyAdjusted();
          previewMouthFromForm();
        });
      }
    );

    $("[data-gen-ai-char-mouth-estimate-btn]")?.addEventListener("click", () => {
      void estimateMouthPosition({ target: "form" });
    });

    $("[data-gen-ai-char-mode-mouth-estimate-btn]")?.addEventListener("click", () => {
      void estimateMouthPosition({ target: "mode" });
    });

    $("[data-gen-ai-char-from-image-btn]")?.addEventListener("click", () => {
      void openMyCharacterFromStagedImage();
    });
  }

  function bind() {
    renderWelcomeTools();
    renderCharacterSelect();
    applyCharacterStageImage(getDisplayCharacter());
    updateUsageUi();
    bindCharacterUi();
    bindVoiceInputUi();
    bindGenAiUsageUi();

    document.querySelectorAll("[data-welcome-tool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode");
        if (mode) setActiveMode(mode, { reset: false });
      });
    });

    const dropdown = $("[data-tool-dropdown]");
    dropdown?.addEventListener("change", () => {
      const mode = dropdown.value;
      window.TasuAiConcierge?.cancelSpeech?.();
      stopListening();
      handsFreeMicActive = false;
      isSpeaking = false;
      voiceTurnBusy = false;
      showVoiceStatus("");
      setActiveMode(mode, { reset: false });
    });

    $("[data-gen-ai-form]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      void sendMessage();
    });

    $("[data-gen-ai-reset]")?.addEventListener("click", () => {
      const modeId = $("[data-gen-ai-chat]")?.getAttribute("data-mode") || DEFAULT_MODE;
      window.TasuAiConcierge?.cancelSpeech?.();
      stopListening();
      handsFreeMicActive = false;
      isSpeaking = false;
      voiceTurnBusy = false;
      showVoiceStatus("");
      setHistory(modeId, []);
      setActiveMode(modeId, { reset: true });
    });

    $("[data-gen-ai-attach]")?.addEventListener("click", () => {
      $("[data-gen-ai-file]")?.click();
    });

    $("[data-gen-ai-file]")?.addEventListener("change", () => {
      const file = getStagedFile();
      const nameEl = $("[data-gen-ai-file-name]");
      if (nameEl) {
        nameEl.textContent = file ? `添付: ${file.name}` : "";
      }
      try {
        if (file) localStorage.setItem(STORAGE_ATTACH, file.name);
      } catch {
        /* ignore */
      }
      const modeId = $("[data-gen-ai-chat]")?.getAttribute("data-mode");
      if (modeId) {
        void syncStagedImageForCharMode(modeId);
        updateCharacterPanels(modeId);
      }
    });
  }

  function init() {
    if (!document.querySelector("[data-gen-ai-root]")) return;

    initStageRenderer();

    window.TasuGenAiWorkspace = {
      GENAI_MODE_URL_SLUGS,
      resolveModeFromQuery,
      PLACEHOLDERS,
      ALL_TOOLS,
      SPEECH_MODES,
      CHARACTER_STAGE_MODES,
      CHARACTER_PICKER_MODES,
      STORAGE_MY_CHARACTERS,
      STORAGE_ACTIVE_CHARACTER,
      getModeMeta,
      shouldShowCharacterStage,
      shouldSpeak,
      loadCharacters,
      getActiveCharacter,
      getDisplayCharacter,
      createTasfulBuiltinCharacter,
      isTasfulBuiltinCharacter,
      TASFUL_BUILTIN_CHARACTER_ID,
      TASFUL_CHARACTER_SRC,
      TASFUL_VRM_URL,
      getActiveCharacterId,
      setActiveCharacterId,
      buildPromptContext,
      buildSpeechText,
      appendMessage,
      sendMessage,
      normalizeCharacter,
      getMouthSettings,
      isGeminiConfigured,
      isImageAnalyzeConfigured,
      getImageAnalyzeEndpoint,
      analyzeCharacterImage,
      estimateMouthPosition,
      estimateMouthHeuristic,
      detectCompositionHeuristic,
      normalizeComposition,
      MOUTH_COMPOSITION,
      applyAnalyzedAppearanceToForm,
      applyCharacterSeedToForm,
      callGemini,
      classifyGenAiIntent,
      isSpeechRecognitionSupported,
      getVoiceInputState,
      setAutoSendVoicePreference,
      toggleHandsFreeMic,
      startListening,
      stopListening,
      setMouthSpeaking,
      setStageRendererMode,
      getPreferred3dModelUrl,
      getPreferredVrmModelUrl,
      getActive3dBackend,
      hasVrmCharacterModel,
      hasTripoCharacterModel,
      saveCharacterVrmModel,
      loadVrmToStage,
      loadPreferred3dStage,
      refreshTripoGlbUrls,
      refreshTripoGlbFromTaskId,
      loadTripoGlbToStage,
      runGenAi3dProductionGenerate,
      saveCharacterTripoModel,
      getCharacterFor3dWorkflow,
      resolveCharacterStorageId,
      refresh3dStageAfterTripoSave,
      resolveTripoGlbForDisplay,
      reconcileStale3dGenerations,
      isGenAiDevMode,
      applyGenAi3dDevVisibility,
      TRIPO_3D_MSG,
      PROD_3D_COMPLETE_NOTE,
      getStageRendererMode: () => stageRendererMode,
      characterHasCustomImage,
      getRecommendedStageRenderer,
      applyStageRendererUi,
      syncStageLiveExpression,
      speak,
      saveCharacterFromForm,
      applyCharacterStageImage,
      applyCharacterMouthPosition,
      prepareCharacterImage,
      getStageImageSrc,
      getGenAiPlan,
      saveGenAiPlan,
      getGenAiUsage,
      canUseGenAiFeature,
      incrementGenAiUsage,
      resetGenAiDailyUsageIfNeeded,
      updateGenAiUsageUi,
      getGenAiUsageRemaining,
      openGenAiPlanPanel,
      openGenAiCustomerPortal,
      getGenAiPortalEndpoint,
      isPaidGenAiPlan,
      startGenAiCheckout,
      confirmGenAiCheckout,
      syncGenAiPlanFromServer,
      GENAI_USAGE_TYPES,
    };

    bind();
    void bootGenAiBilling();

    const resolved = resolveModeFromQuery();
    if (resolved) {
      setActiveMode(resolved, { reset: false });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
