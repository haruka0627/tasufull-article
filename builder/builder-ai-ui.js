/**
 * Builder AI — Field diagnosis UI（Vision · Calc · Live Phase 4-A）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_builder_ai_field_ui_v1";
  const MAX_MESSAGES = 40;

  const QUICK_PROMPTS = [
    { label: "外壁の補修判断", text: "外壁の補修が必要かどうか判断したいです。" },
    { label: "屋根の状態確認", text: "屋根の状態を確認し、劣化や補修の必要性を知りたいです。" },
    { label: "水回りの交換判断", text: "水回り設備の交換が必要かどうか相談したいです。" },
    { label: "材料を相談", text: "この工事に必要な材料の目安を相談したいです。" },
    { label: "概算見積を作りたい", text: "概算見積のたたき台を作りたいです。" },
  ];

  const SOURCE_LABELS = {
    text: "",
    voice: "🎤 ",
    camera_snapshot: "📷 Live ",
  };

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

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const list = JSON.parse(raw || "[]");
      return Array.isArray(list) ? list.slice(-MAX_MESSAGES) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_MESSAGES)));
    } catch {
      /* ignore */
    }
  }

  function getVision() {
    return global.TasuBuilderAIVision;
  }

  function getActor() {
    return global.TasuBuilderAIContext?.resolveActor?.({}) || { actorType: "guest", label: "ゲスト" };
  }

  function getProjectIdFromUrl() {
    try {
      return new URLSearchParams(global.location?.search || "").get("projectId") || "";
    } catch {
      return "";
    }
  }

  function bindProjectContext() {
    const projectId = getProjectIdFromUrl();
    const panel = $("[data-builder-ai-project-context]");
    const text = $("[data-builder-ai-project-context-text]");
    const detailLink = $("[data-builder-ai-project-detail-link]");
    if (!projectId || !panel) return projectId;

    const Store = global.TasuBuilderProjectStore;
    Store?.ensureSeed?.();
    const project = Store?.getProject?.(projectId);
    panel.hidden = false;
    if (text) {
      text.textContent = project
        ? `診断結果は案件「${project.name}」（${project.id}）に保存されます。`
        : `案件 ID ${projectId} に診断を保存します。`;
    }
    if (detailLink) {
      detailLink.href = `project-detail.html?id=${encodeURIComponent(projectId)}`;
    }
    return projectId;
  }

  function saveDiagnosisToProject(result, meta) {
    const projectId = getProjectIdFromUrl();
    if (!projectId || !result?.diagnosis) return null;
    const Store = global.TasuBuilderProjectStore;
    return Store?.saveVisionDiagnosis?.(projectId, result.diagnosis, meta) || null;
  }

  /** Phase 6-B: 将来の AI 日程変更 intent プレビュー（現時点では UI から未呼び出し） */
  function prepareScheduleIntent(intent) {
    const projectId = getProjectIdFromUrl();
    if (!projectId || !intent) return null;
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewScheduleIntent?.(projectId, { ...intent, source: "ai_assistant" }) || null;
  }

  /** Phase 6-C: 将来の AI 収支 intent プレビュー（現時点では UI から未呼び出し） */
  function prepareFinanceIntent(intentText) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewFinanceIntent?.(intentText) || null;
  }

  /** Phase 6-D: 将来の AI 見積 intent プレビュー（現時点では UI から未呼び出し） */
  function prepareEstimateIntent(intentText) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewEstimateIntent?.(intentText) || null;
  }

  /** Phase 6-D: 将来の AI 請求 intent プレビュー（現時点では UI から未呼び出し） */
  function prepareInvoiceIntent(intentText) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewInvoiceIntent?.(intentText) || null;
  }

  /** Phase 6-E: 将来の AI 契約 intent プレビュー（現時点では UI から未呼び出し） */
  function prepareContractIntent(intentText) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewContractIntent?.(intentText) || null;
  }

  /** Phase 6-E: 将来の AI 完了 intent プレビュー（現時点では UI から未呼び出し） */
  function prepareCompletionIntent(intentText) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewCompletionIntent?.(intentText) || null;
  }

  let messages = loadHistory();
  let sending = false;
  let photoFile = null;
  let photoObjectUrl = "";

  function setStatus(text, busy) {
    const el = $("[data-builder-ai-ui-status]");
    if (el) {
      el.textContent = text || "";
      el.classList.toggle("builder-ai-ui-status--busy", Boolean(busy));
    }
    const send = $("[data-builder-ai-ui-send]");
    const input = $("[data-builder-ai-ui-input]");
    if (send) send.disabled = Boolean(busy);
    if (input) input.disabled = Boolean(busy);
  }

  function setVisionState(state) {
    const wrap = $("[data-builder-ai-ui-vision-result]");
    if (!wrap) return;
    const normalized = state || "idle";
    wrap.dataset.visionState = normalized;
    const visible = normalized !== "idle";
    wrap.hidden = !visible;
    wrap.classList.toggle("builder-ai-ui-vision-result--visible", visible);
    wrap.classList.toggle("builder-ai-ui-vision-result--analyzing", normalized === "analyzing");
    wrap.classList.toggle("builder-ai-ui-vision-result--complete", normalized === "complete");
    wrap.classList.toggle("builder-ai-ui-vision-result--error", normalized === "error");
    wrap.classList.toggle("builder-ai-ui-vision-result--no-image", normalized === "no_image");
  }

  function renderVisionDiagnosis(result) {
    const wrap = $("[data-builder-ai-ui-vision-result]");
    const body = $("[data-builder-ai-ui-vision-result-body]");
    if (!wrap || !body) return;

    if (!result?.diagnosis || !result?.displayHtml) {
      body.innerHTML = "";
      if (result?.visionState === "no_image") {
        body.innerHTML =
          '<p class="builder-ai-ui-vision-result__hint">現場写真を添付すると、AIの参考診断をより具体的に表示できます。</p>';
      }
      return;
    }

    body.innerHTML = result.displayHtml;
  }

  function formatMessageMeta(m) {
    const parts = [];
    const prefix = SOURCE_LABELS[m.source] || "";
    if (prefix) parts.push(prefix.trim());
    if (m.imageName && m.role === "user") parts.push(`📷 ${m.imageName}`);
    return parts.length ? parts.join(" · ") : "";
  }

  function renderMessages() {
    const log = $("[data-builder-ai-ui-messages]");
    if (!log) return;
    log.innerHTML = "";
    messages.forEach((m) => {
      const div = document.createElement("div");
      div.className = `builder-ai-ui-msg builder-ai-ui-msg--${m.role}`;
      const meta = formatMessageMeta(m);
      if (meta && m.role === "user") {
        div.innerHTML = `${escapeHtml(m.content)}<br><span class="builder-ai-ui-msg__meta">${escapeHtml(meta)}</span>`;
      } else if (m.imageName && m.role === "user") {
        div.innerHTML = `${escapeHtml(m.content)}<br><span class="builder-ai-ui-msg__meta">📷 ${escapeHtml(m.imageName)}</span>`;
      } else {
        div.textContent = m.content;
      }
      log.appendChild(div);
    });
    log.scrollTop = log.scrollHeight;
  }

  function pushSystem(text) {
    messages.push({ role: "system", content: text, source: "text" });
    saveHistory(messages);
    renderMessages();
  }

  function clearPhotoPreview() {
    if (photoObjectUrl) {
      try {
        URL.revokeObjectURL(photoObjectUrl);
      } catch {
        /* ignore */
      }
    }
    photoObjectUrl = "";
    photoFile = null;
    const preview = $("[data-builder-ai-ui-photo-preview]");
    const thumb = $("[data-builder-ai-ui-photo-thumb]");
    const nameEl = $("[data-builder-ai-ui-photo-name]");
    const input = $("[data-builder-ai-ui-photo-input]");
    if (preview) preview.classList.remove("builder-ai-ui-photo__preview--visible");
    if (thumb) {
      thumb.removeAttribute("src");
      thumb.hidden = true;
    }
    if (nameEl) nameEl.textContent = "";
    if (input) input.value = "";
  }

  function showPhotoPreview(file) {
    const Vision = getVision();
    if (Vision?.isImageTooLarge?.(file)) {
      pushSystem(`画像は ${Vision.MAX_IMAGE_MB || 4}MB 以下にしてください。`);
      return;
    }
    const preview = $("[data-builder-ai-ui-photo-preview]");
    const thumb = $("[data-builder-ai-ui-photo-thumb]");
    const nameEl = $("[data-builder-ai-ui-photo-name]");
    if (!preview || !thumb || !nameEl) return;
    if (photoObjectUrl) {
      try {
        URL.revokeObjectURL(photoObjectUrl);
      } catch {
        /* ignore */
      }
    }
    photoFile = file;
    photoObjectUrl = URL.createObjectURL(file);
    thumb.src = photoObjectUrl;
    thumb.hidden = false;
    nameEl.textContent = file.name;
    preview.classList.add("builder-ai-ui-photo__preview--visible");
  }

  function bindPhotoUpload() {
    const input = $("[data-builder-ai-ui-photo-input]");
    const removeBtn = $("[data-builder-ai-ui-photo-remove]");
    const Vision = getVision();
    if (!input) return;

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      if (Vision?.isAcceptedImage && !Vision.isAcceptedImage(file)) {
        pushSystem("jpg / png / webp 形式の画像を選択してください。");
        input.value = "";
        return;
      }
      showPhotoPreview(file);
    });

    removeBtn?.addEventListener("click", () => clearPhotoPreview());
  }

  function bindQuickPrompts() {
    const wrap = $("[data-builder-ai-ui-quick]");
    if (!wrap) return;
    wrap.innerHTML = QUICK_PROMPTS.map(
      (p) =>
        `<button type="button" class="builder-ai-ui-quick__btn" data-builder-ai-ui-quick="${escapeHtml(p.text)}">${escapeHtml(p.label)}</button>`
    ).join("");
    wrap.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-builder-ai-ui-quick]");
      if (!btn || sending) return;
      const text = btn.getAttribute("data-builder-ai-ui-quick") || "";
      void sendMessage(text, { fromQuick: true, source: "text" });
    });
  }

  function bindVoiceButton() {
    $("[data-builder-ai-ui-voice]")?.addEventListener("click", () => {
      if (sending) return;
      global.TasuBuilderAIVoice?.stopVoice?.();
      void global.TasuBuilderAIVoice?.quickVoiceCapture?.({
        onTranscript: (text) => sendMessage(text, { source: "voice", fromVoice: true }),
      }).then((out) => {
        if (!out?.ok && out?.error) pushSystem(out.error);
      });
    });
  }

  function bindLiveModule() {
    global.TasuBuilderAILive?.init?.({
      onSnapshot: async ({ file, question }) => {
        setVisionState("analyzing");
        setStatus("スナップショット解析中…", true);
        await sendMessage(question, {
          photoFile: file,
          source: "camera_snapshot",
          fromLive: true,
        });
      },
      onStatus: (text) => {
        if (text && !sending) setStatus(text, false);
      },
    });
  }

  function bindComposerVoice() {
    const input = $("[data-builder-ai-ui-input]");
    const composer = input?.closest(".builder-ai-ui-composer");
    if (!input || !composer) return;

    global.TasuBuilderAIVoice?.mountComposerVoice?.({
      inputEl: input,
      hostEl: composer,
    });

    $("[data-builder-ai-ui-send]")?.addEventListener(
      "click",
      () => global.TasuBuilderAIVoice?.stopVoice?.(),
      true
    );
  }

  async function sendMessage(forcedText, opts) {
    if (sending) return;
    const options = opts && typeof opts === "object" ? opts : {};
    const input = $("[data-builder-ai-ui-input]");
    const text = String(forcedText != null ? forcedText : input?.value || "").trim();
    if (!text) return;

    const source = options.source || "text";
    const Vision = getVision();
    const Orch = global.TasuBuilderAICalcOrchestrator;
    const sentPhoto = options.photoFile || photoFile;
    const sentPhotoName = sentPhoto?.name || "";

    global.TasuBuilderAIVoice?.stopVoice?.();

    if (!sentPhoto && Orch?.isCalcQuery?.(text)) {
      sending = true;
      setStatus("計算中…", true);
      messages.push({ role: "user", content: text, source });
      renderMessages();
      if (input && !options.fromQuick && !options.fromVoice) input.value = "";

      const calcResult = await Orch.runFromNaturalLanguage({
        userText: text,
        actor: getActor(),
        preferRemote: false,
      });

      if (calcResult.ok && calcResult.reply) {
        messages.push({ role: "assistant", content: calcResult.reply, source: "text" });
        saveHistory(messages);
        renderMessages();
        global.TasuBuilderAIVoice?.notifyAssistantReply?.(calcResult.reply);
        setStatus(calcResult.usedRemote ? "計算 + AI 要約" : "計算完了", false);
        setTimeout(() => setStatus("", false), 2000);
      } else if (calcResult.reply) {
        pushSystem(calcResult.reply);
        setStatus("", false);
      } else {
        pushSystem("計算条件が不足しています。面積 · 原価 · 金額 等を追記してください。");
        setStatus("", false);
      }
      sending = false;
      return;
    }

    if (!Vision?.runFieldDiagnosis) {
      pushSystem("Builder AI Vision モジュールが読み込まれていません。");
      return;
    }

    sending = true;
    setVisionState(sentPhoto ? "analyzing" : "idle");
    setStatus(sentPhoto ? "解析中…" : "送信中…", true);

    messages.push({
      role: "user",
      content: text,
      imageName: sentPhotoName,
      source,
    });
    renderMessages();
    if (input && !options.fromQuick && !options.fromVoice) input.value = "";

    const result = await Vision.runFieldDiagnosis({
      userText: text,
      photoFile: sentPhoto,
      messages,
      actor: getActor(),
    });

    if (!result.ok && result.reply) {
      setVisionState("error");
      renderVisionDiagnosis(result);
      pushSystem(result.reply);
      setStatus("エラー", false);
      setTimeout(() => setStatus("", false), 2500);
      sending = false;
      return;
    }

    if (result.reply) {
      messages.push({
        role: "assistant",
        content: result.reply,
        source: "text",
        diagnosis: result.diagnosis || null,
      });
      saveHistory(messages);
      renderMessages();
      global.TasuBuilderAIVoice?.notifyAssistantReply?.(result.reply);
    }

    if (result.visionState === "no_image" || result.photoRequired) {
      setVisionState("no_image");
      renderVisionDiagnosis(result);
    } else if (result.diagnosis) {
      setVisionState("complete");
      renderVisionDiagnosis(result);
      if (result.usedVision && getProjectIdFromUrl()) {
        const saved = saveDiagnosisToProject(result, {
          userText: text,
          imageName: sentPhotoName,
        });
        if (saved?.ok) {
          pushSystem(`案件 ${getProjectIdFromUrl()} に AI 参考診断を保存しました。`);
        }
      }
    } else {
      setVisionState("idle");
      renderVisionDiagnosis(null);
    }

    if (result.usedVision && sentPhoto && !options.fromLive) {
      clearPhotoPreview();
    }

    if (result.usedRemote) {
      setStatus("診断完了", false);
      setTimeout(() => setStatus("", false), 2000);
    } else if (result.fallback_used) {
      setStatus("参考診断（オフライン）", false);
      setTimeout(() => setStatus("", false), 2500);
    } else if (result.photoRequired) {
      setStatus("画像なし", false);
      setTimeout(() => setStatus("", false), 2000);
    } else {
      setStatus("", false);
    }

    sending = false;
  }

  function bindComposer() {
    $("[data-builder-ai-ui-send]")?.addEventListener("click", () => sendMessage());
    $("[data-builder-ai-ui-input]")?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        sendMessage();
      }
    });
    $("[data-builder-ai-ui-clear]")?.addEventListener("click", () => {
      messages = [];
      saveHistory(messages);
      renderMessages();
      clearPhotoPreview();
      global.TasuBuilderAILive?.closePanel?.();
      global.TasuBuilderAIVoice?.stopVoice?.();
      setStatus("", false);
      setVisionState("idle");
      renderVisionDiagnosis(null);
    });
  }

  function seedWelcome() {
    if (messages.length) return;
    messages.push({
      role: "assistant",
      content:
        "現場写真の診断・補修判断・見積補助の相談をどうぞ。写真を添付するか、カメラ診断 · 音声相談 · クイック相談から始められます。",
      source: "text",
    });
    saveHistory(messages);
  }

  function init() {
    bindProjectContext();
    seedWelcome();
    renderMessages();
    bindPhotoUpload();
    bindQuickPrompts();
    bindLiveModule();
    bindVoiceButton();
    bindComposerVoice();
    bindComposer();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuBuilderAIUi = {
    init,
    sendMessage,
    pushSystem,
    prepareScheduleIntent,
    prepareFinanceIntent,
    prepareEstimateIntent,
    prepareInvoiceIntent,
    prepareContractIntent,
    prepareCompletionIntent,
    useFieldStub: false,
  };
})(typeof window !== "undefined" ? window : globalThis);
