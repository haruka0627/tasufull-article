/**
 * Builder AI — Field diagnosis UI shell (Phase 1)
 * Vision / Live / Voice API 非接続 · ローカル stub のみ
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_builder_ai_field_ui_v1";
  const MAX_MESSAGES = 40;
  const STUB_REPLY =
    "Builder AIは現在UI準備中です。写真診断・見積補助は次フェーズで接続予定です。";
  const CAMERA_STUB = "カメラ診断は次フェーズで対応予定です。";
  const VOICE_STUB = "音声相談は次フェーズで対応予定です。";
  const ACCEPT_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const ACCEPT_EXT = /\.(jpe?g|png|webp)$/i;

  const QUICK_PROMPTS = [
    { label: "外壁の補修判断", text: "外壁の補修が必要かどうか判断したいです。" },
    { label: "屋根の状態確認", text: "屋根の状態を確認し、劣化や補修の必要性を知りたいです。" },
    { label: "水回りの交換判断", text: "水回り設備の交換が必要かどうか相談したいです。" },
    { label: "材料を相談", text: "この工事に必要な材料の目安を相談したいです。" },
    { label: "概算見積を作りたい", text: "概算見積のたたき台を作りたいです。" },
  ];

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

  function saveHistory(messages) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
    } catch {
      /* ignore */
    }
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

  function renderMessages() {
    const log = $("[data-builder-ai-ui-messages]");
    if (!log) return;
    log.innerHTML = "";
    messages.forEach((m) => {
      const div = document.createElement("div");
      div.className = `builder-ai-ui-msg builder-ai-ui-msg--${m.role}`;
      if (m.imageName && m.role === "user") {
        div.innerHTML = `${escapeHtml(m.content)}<br><span style="font-size:0.75rem;color:#64748b">📷 ${escapeHtml(m.imageName)}</span>`;
      } else {
        div.textContent = m.content;
      }
      log.appendChild(div);
    });
    log.scrollTop = log.scrollHeight;
  }

  function pushSystem(text) {
    messages.push({ role: "system", content: text });
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

  function isAcceptedImage(file) {
    if (!file) return false;
    if (ACCEPT_TYPES.includes(file.type)) return true;
    return ACCEPT_EXT.test(String(file.name || ""));
  }

  function bindPhotoUpload() {
    const input = $("[data-builder-ai-ui-photo-input]");
    const removeBtn = $("[data-builder-ai-ui-photo-remove]");
    if (!input) return;

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!isAcceptedImage(file)) {
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
      void sendMessage(text, { fromQuick: true });
    });
  }

  function bindMediaStubs() {
    $("[data-builder-ai-ui-camera]")?.addEventListener("click", () => {
      pushSystem(CAMERA_STUB);
    });
    $("[data-builder-ai-ui-voice]")?.addEventListener("click", () => {
      pushSystem(VOICE_STUB);
    });
  }

  async function sendMessage(forcedText, opts) {
    if (sending) return;
    const input = $("[data-builder-ai-ui-input]");
    const text = String(forcedText != null ? forcedText : input?.value || "").trim();
    if (!text) return;

    sending = true;
    setStatus("送信中…", true);

    const userMsg = {
      role: "user",
      content: text,
      imageName: photoFile ? photoFile.name : "",
    };
    messages.push(userMsg);
    renderMessages();
    if (input && !opts?.fromQuick) input.value = "";

    await new Promise((r) => setTimeout(r, 450));

    messages.push({ role: "assistant", content: STUB_REPLY });
    saveHistory(messages);
    renderMessages();
    setStatus("", false);
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
      setStatus("", false);
    });
  }

  function seedWelcome() {
    if (messages.length) return;
    messages.push({
      role: "assistant",
      content:
        "現場写真の診断・補修判断・見積補助の相談をどうぞ。写真を添付するか、下のクイック相談から始められます。",
    });
    saveHistory(messages);
  }

  function init() {
    seedWelcome();
    renderMessages();
    bindPhotoUpload();
    bindQuickPrompts();
    bindMediaStubs();
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
    STUB_REPLY,
    CAMERA_STUB,
    VOICE_STUB,
    useFieldStub: true,
  };
})(typeof window !== "undefined" ? window : globalThis);
