/**
 * TASFUL AI Workspace — カテゴリ（チャット / 画像 / 動画 / 音楽 / 資料 / 履歴）
 */
(function (global) {
  "use strict";

  const CATEGORIES = Object.freeze([
    { id: "chat", label: "チャット", icon: "💬" },
    { id: "image", label: "画像", icon: "🖼️" },
    { id: "video", label: "動画", icon: "🎬" },
    { id: "music", label: "音楽", icon: "🎵" },
    { id: "document", label: "資料", icon: "📄" },
    { id: "history", label: "履歴", icon: "📋" },
  ]);

  const CATEGORY_STORAGE_KEY = "tasu_ai_workspace_category";

  function $(sel, root) {
    return (root || global.document).querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function formatHistoryModeLabel(modelId) {
    const id = String(modelId || "").trim();
    const fromPlan = global.TasuAiPlanModels?.getModel?.(id)?.label;
    if (fromPlan) return fromPlan;
    const legacy = { "gemini-flash": "最速", gpt: "標準", claude: "高精度", grok: "準備中" };
    return legacy[id] || id || "—";
  }

  function getRoot() {
    return global.document.querySelector("[data-ai-workspace-chat]");
  }

  function readCategory() {
    try {
      const stored = global.sessionStorage?.getItem(CATEGORY_STORAGE_KEY);
      if (stored && CATEGORIES.some((c) => c.id === stored)) return stored;
    } catch {
      /* ignore */
    }
    return "chat";
  }

  function writeCategory(id) {
    try {
      global.sessionStorage?.setItem(CATEGORY_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "—";
      return d.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  }

  function dispatchGeneration(detail) {
    global.dispatchEvent?.(new CustomEvent("tasu:ai-generation-complete", { detail }));
  }

  function appendResultToChat(userText, assistantText, assistantHtml) {
    const root = getRoot();
    if (!root || !global.TasuAiChat?.appendExchange) return;
    global.TasuTgaShell?.setWelcomeVisible?.(false);
    const list = root.querySelector("[data-ai-chat-messages]");
    if (list) list.hidden = false;
    global.TasuAiChat.appendExchange(root, {
      userContent: userText,
      assistant: {
        plain: assistantText,
        html: assistantHtml || `<pre class="ai-gen-result">${esc(assistantText)}</pre>`,
      },
    });
  }

  function buildVideoFormHtml() {
    const d = global.TasuAiVideoGenerate?.DEFAULTS || {};
    return `
      <form class="ai-cat-form" data-ai-video-form>
        <h2 class="ai-cat-form__title">動画生成</h2>
        <p class="ai-cat-form__lead">プロンプトとオプションを指定して動画を生成します（API未設定時は案内またはモック）。</p>
        <label class="ai-cat-form__field"><span>プロンプト</span><textarea name="prompt" rows="3" placeholder="例: 30秒のサービス紹介動画"></textarea></label>
        <div class="ai-cat-form__grid">
          <label class="ai-cat-form__field"><span>サイズ</span><input name="size" value="${esc(d.size || "1280x720")}"></label>
          <label class="ai-cat-form__field"><span>時間（秒）</span><input name="durationSec" type="number" min="1" max="120" value="${Number(d.durationSec) || 8}"></label>
          <label class="ai-cat-form__field"><span>品質</span><input name="quality" value="${esc(d.quality || "standard")}"></label>
          <label class="ai-cat-form__field"><span>スタイル</span><input name="style" value="${esc(d.style || "cinematic")}"></label>
        </div>
        <button type="submit" class="ai-cat-form__submit">動画を生成</button>
      </form>`;
  }

  function buildMusicFormHtml() {
    const d = global.TasuAiMusicGenerate?.DEFAULTS || {};
    return `
      <form class="ai-cat-form" data-ai-music-form>
        <h2 class="ai-cat-form__title">音楽生成</h2>
        <p class="ai-cat-form__lead">ジャンル · BPM · 雰囲気などを指定してBGMを生成します。</p>
        <label class="ai-cat-form__field"><span>補足プロンプト（任意）</span><textarea name="prompt" rows="2" placeholder="例: 明るい作業用BGM"></textarea></label>
        <div class="ai-cat-form__grid">
          <label class="ai-cat-form__field"><span>ジャンル</span><input name="genre" value="${esc(d.genre || "ambient")}"></label>
          <label class="ai-cat-form__field"><span>BPM</span><input name="bpm" type="number" min="40" max="200" value="${Number(d.bpm) || 90}"></label>
          <label class="ai-cat-form__field"><span>雰囲気</span><input name="mood" value="${esc(d.mood || "calm")}"></label>
          <label class="ai-cat-form__field"><span>長さ（秒）</span><input name="lengthSec" type="number" min="5" max="300" value="${Number(d.lengthSec) || 30}"></label>
        </div>
        <div class="ai-cat-form__checks">
          <label><input type="checkbox" name="vocal"> ボーカルあり</label>
          <label><input type="checkbox" name="lyrics"> 歌詞あり</label>
        </div>
        <button type="submit" class="ai-cat-form__submit">音楽を生成</button>
      </form>`;
  }

  function buildDocumentFormHtml() {
    const types = global.TasuAiDocumentGenerate?.DOC_TYPES || [];
    const options = types
      .map((t) => `<option value="${esc(t.id)}">${esc(t.label)}</option>`)
      .join("");
    return `
      <form class="ai-cat-form" data-ai-document-form>
        <h2 class="ai-cat-form__title">資料生成</h2>
        <p class="ai-cat-form__lead">Markdown テンプレートを生成します（将来 PDF / PPT 変換）。</p>
        <label class="ai-cat-form__field"><span>資料種別</span><select name="type">${options}</select></label>
        <label class="ai-cat-form__field"><span>タイトル / 件名</span><input name="topic" placeholder="例: 新規サービス提案"></label>
        <label class="ai-cat-form__field"><span>内容・補足</span><textarea name="detail" rows="4" placeholder="背景 · 要件 · 議題など"></textarea></label>
        <button type="submit" class="ai-cat-form__submit">資料を生成</button>
      </form>`;
  }

  function buildImagePanelHtml() {
    return `
      <section class="ai-cat-form ai-cat-form--image">
        <h2 class="ai-cat-form__title">画像生成</h2>
        <p class="ai-cat-form__lead">下の入力欄に「画像生成」「広告バナーを作って」などと入力して送信してください。添付画像の解析も可能です。</p>
        <div class="ai-cat-form__chips">
          <button type="button" class="welcome-starter-chip" data-ai-image-starter="草刈りサービスの広告バナー画像を生成したい">広告バナー</button>
          <button type="button" class="welcome-starter-chip" data-ai-image-starter="SNS投稿用の画像を生成したい">SNS投稿</button>
          <button type="button" class="welcome-starter-chip" data-ai-image-starter="求人募集バナー画像を生成したい">求人バナー</button>
        </div>
      </section>`;
  }

  function renderHistoryPanel(host, state) {
    const store = global.TasuAiHistoryStore;
    if (!host || !store) return;
    const st = state || {};
    const folders = store.FOLDERS;
    const folderOpts = folders.map((f) => `<option value="${esc(f.id)}"${st.folderId === f.id ? " selected" : ""}>${esc(f.label)}</option>`).join("");
    const catOpts = [{ id: "", label: "すべて" }, ...store.CATEGORIES]
      .map((c) => `<option value="${esc(c.id)}"${st.category === c.id ? " selected" : ""}>${esc(c.label)}</option>`)
      .join("");

    const rows = store.list({
      query: st.query,
      category: st.category || undefined,
      folderId: st.folderId || undefined,
      favoriteOnly: st.favoriteOnly,
      sort: st.sort || "date-desc",
    });

    const items = rows.length
      ? rows
          .map(
            (r) => `
        <article class="ai-history-item${r.pinned ? " ai-history-item--pinned" : ""}" data-ai-history-id="${esc(r.id)}">
          <header class="ai-history-item__head">
            <span class="ai-history-item__cat">${esc(store.categoryLabel(r.category))}</span>
            <time class="ai-history-item__time">${esc(formatDate(r.updatedAt))}</time>
          </header>
          <h3 class="ai-history-item__title">${esc(r.title)}</h3>
          <p class="ai-history-item__meta">モード: ${esc(formatHistoryModeLabel(r.model))} · ${esc(store.folderLabel(r.folderId))}</p>
          <p class="ai-history-item__preview">${esc(r.resultPreview || r.prompt || "")}</p>
          <div class="ai-history-item__actions">
            <button type="button" data-ai-history-resume="${esc(r.id)}">再開</button>
            <button type="button" data-ai-history-reuse="${esc(r.id)}">再利用</button>
            <button type="button" data-ai-history-fav="${esc(r.id)}" aria-pressed="${r.favorite}">${r.favorite ? "★" : "☆"}</button>
            <button type="button" data-ai-history-pin="${esc(r.id)}" aria-pressed="${r.pinned}">${r.pinned ? "📌" : "📍"}</button>
            <select data-ai-history-folder="${esc(r.id)}" aria-label="フォルダ">${folders.map((f) => `<option value="${esc(f.id)}"${f.id === r.folderId ? " selected" : ""}>${esc(f.label)}</option>`).join("")}</select>
            <button type="button" class="ai-history-item__delete" data-ai-history-delete="${esc(r.id)}">削除</button>
          </div>
        </article>`
          )
          .join("")
      : `<p class="ai-history-empty">履歴がありません。チャットや生成を行うと自動保存されます。</p>`;

    host.innerHTML = `
      <div class="ai-history-panel">
        <header class="ai-history-panel__head">
          <h2 class="ai-history-panel__title">AI履歴</h2>
          <p class="ai-history-panel__sub">検索 · お気に入り · ピン留め · フォルダ · 再開</p>
        </header>
        <div class="ai-history-toolbar">
          <input type="search" class="ai-history-toolbar__search" data-ai-history-search placeholder="履歴を検索..." value="${esc(st.query || "")}">
          <select data-ai-history-category>${catOpts}</select>
          <select data-ai-history-folder-filter><option value="">すべてのフォルダ</option>${folderOpts}</select>
          <select data-ai-history-sort>
            <option value="date-desc"${st.sort === "date-desc" ? " selected" : ""}>新しい順</option>
            <option value="date-asc"${st.sort === "date-asc" ? " selected" : ""}>古い順</option>
            <option value="title"${st.sort === "title" ? " selected" : ""}>タイトル順</option>
          </select>
          <label class="ai-history-toolbar__fav"><input type="checkbox" data-ai-history-fav-only${st.favoriteOnly ? " checked" : ""}> お気に入りのみ</label>
        </div>
        <div class="ai-history-list">${items}</div>
      </div>`;
  }

  const historyUiState = { query: "", category: "", folderId: "", sort: "date-desc", favoriteOnly: false };

  function refreshHistoryPanel() {
    const host = $("[data-ai-category-panel]");
    if (getRoot()?.getAttribute("data-ai-category") === "history") {
      renderHistoryPanel(host, historyUiState);
    }
  }

  async function handleVideoSubmit(form) {
    const fd = new FormData(form);
    const opts = {
      prompt: fd.get("prompt"),
      size: fd.get("size"),
      durationSec: fd.get("durationSec"),
      quality: fd.get("quality"),
      style: fd.get("style"),
      allowMock: global.TasuAiMediaGenConfig?.video?.mock === true,
    };
    const gen = global.TasuAiVideoGenerate;
    if (!gen?.generate) return;
    const result = await gen.generate(opts);
    const userText = `動画生成: ${opts.prompt}`;
    const assistantText = result.message || result.markdown || "（結果なし）";
    appendResultToChat(userText, assistantText);
    dispatchGeneration({
      category: "video",
      title: global.TasuAiHistoryStore?.deriveTitle(opts.prompt, "動画生成"),
      prompt: opts.prompt,
      params: opts,
      resultPreview: assistantText.slice(0, 500),
      resultMarkdown: result.markdown || assistantText,
      message: result.message,
    });
  }

  async function handleMusicSubmit(form) {
    const fd = new FormData(form);
    const opts = {
      prompt: fd.get("prompt"),
      genre: fd.get("genre"),
      bpm: fd.get("bpm"),
      mood: fd.get("mood"),
      lengthSec: fd.get("lengthSec"),
      vocal: fd.get("vocal") === "on",
      lyrics: fd.get("lyrics") === "on",
      allowMock: global.TasuAiMediaGenConfig?.music?.mock === true,
    };
    const result = await global.TasuAiMusicGenerate?.generate?.(opts);
    const userText = `音楽生成: ${opts.genre} / ${opts.mood}`;
    const assistantText = result?.message || result?.markdown || "（結果なし）";
    appendResultToChat(userText, assistantText);
    dispatchGeneration({
      category: "music",
      title: global.TasuAiHistoryStore?.deriveTitle(opts.prompt || opts.genre, "音楽生成"),
      prompt: opts.prompt || `${opts.genre} ${opts.mood}`,
      params: opts,
      resultPreview: assistantText.slice(0, 500),
      resultMarkdown: result?.markdown || assistantText,
    });
  }

  function handleDocumentSubmit(form) {
    const fd = new FormData(form);
    const opts = {
      type: fd.get("type"),
      topic: fd.get("topic"),
      detail: fd.get("detail"),
    };
    const result = global.TasuAiDocumentGenerate?.generate?.(opts);
    if (!result?.ok) return;
    const userText = `資料生成（${result.typeLabel}）: ${opts.topic || ""}`;
    appendResultToChat(userText, result.markdown, `<pre class="ai-doc-md">${esc(result.markdown)}</pre>`);
    dispatchGeneration({
      category: "document",
      title: opts.topic || result.typeLabel,
      prompt: `${result.typeLabel}\n${opts.detail || ""}`,
      params: opts,
      resultPreview: result.preview,
      resultMarkdown: result.markdown,
    });
  }

  function resumeHistory(id) {
    const row = global.TasuAiHistoryStore?.findById?.(id);
    if (!row) return;
    if (row.modeId && row.sessionKey && global.TasuAiChat?.switchMode) {
      const root = getRoot();
      applyCategory("chat");
      void global.TasuAiChat.switchMode(root, row.modeId).then(() => {
        global.TasuTgaShell?.setWelcomeVisible?.(false);
        const list = root?.querySelector("[data-ai-chat-messages]");
        if (list && row.messages?.length) {
          list.hidden = false;
          global.TasuAiChat.loadDemoConversation?.(root, row.messages);
        }
      });
      return;
    }
    reuseHistory(id);
  }

  function reuseHistory(id) {
    const row = global.TasuAiHistoryStore?.findById?.(id);
    if (!row) return;
    const catMap = { video: "video", music: "music", document: "document", image: "image" };
    const cat = catMap[row.category] || "chat";
    applyCategory(cat);
    const input = getRoot()?.querySelector("[data-ai-chat-input]");
    if (input) {
      input.value = row.prompt || row.title || "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    }
  }

  function renderCategoryPanel(category) {
    const host = $("[data-ai-category-panel]");
    const welcome = $("#welcome-screen");
    const messages = $("[data-ai-chat-messages]");
    const composer = $("#bottom-container");
    if (!host) return;

    if (category === "history") {
      host.hidden = false;
      if (welcome) welcome.hidden = true;
      if (messages) messages.hidden = true;
      if (composer) composer.hidden = true;
      renderHistoryPanel(host, historyUiState);
      return;
    }

    host.hidden = false;
    if (composer) composer.hidden = false;

    if (category === "chat") {
      host.innerHTML = "";
      host.hidden = true;
      global.TasuTgaShell?.syncView?.(getRoot()?.getAttribute("data-mode"));
      return;
    }

    if (category === "image") host.innerHTML = buildImagePanelHtml();
    else if (category === "video") host.innerHTML = buildVideoFormHtml();
    else if (category === "music") host.innerHTML = buildMusicFormHtml();
    else if (category === "document") host.innerHTML = buildDocumentFormHtml();
    else host.innerHTML = "";

    if (welcome) welcome.hidden = true;
    if (messages) messages.hidden = category === "chat" ? false : true;
  }

  function applyCategory(categoryId) {
    const root = getRoot();
    if (!root) return;
    const id = CATEGORIES.some((c) => c.id === categoryId) ? categoryId : "chat";
    root.setAttribute("data-ai-category", id);
    writeCategory(id);
    global.document.querySelectorAll("[data-ai-workspace-category]").forEach((btn) => {
      const active = btn.getAttribute("data-ai-workspace-category") === id;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderCategoryPanel(id);
  }

  function bindCategoryNav() {
    const nav = $("[data-ai-workspace-categories]");
    nav?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-ai-workspace-category]");
      if (!btn) return;
      applyCategory(btn.getAttribute("data-ai-workspace-category") || "chat");
    });

    const panel = $("[data-ai-category-panel]");
    panel?.addEventListener("submit", (ev) => {
      const form = ev.target;
      if (form.matches("[data-ai-video-form]")) {
        ev.preventDefault();
        void handleVideoSubmit(form);
      } else if (form.matches("[data-ai-music-form]")) {
        ev.preventDefault();
        void handleMusicSubmit(form);
      } else if (form.matches("[data-ai-document-form]")) {
        ev.preventDefault();
        handleDocumentSubmit(form);
      }
    });

    panel?.addEventListener("click", (ev) => {
      const starter = ev.target.closest("[data-ai-image-starter]");
      if (starter) {
        global.TasuTgaShell?.fillStarter?.(starter.getAttribute("data-ai-image-starter") || "");
        applyCategory("chat");
        getRoot()?.querySelector("[data-ai-chat-send]")?.click();
      }
    });

    panel?.addEventListener("click", (ev) => {
      const resume = ev.target.closest("[data-ai-history-resume]");
      if (resume) {
        resumeHistory(resume.getAttribute("data-ai-history-resume"));
        return;
      }
      const reuse = ev.target.closest("[data-ai-history-reuse]");
      if (reuse) {
        reuseHistory(reuse.getAttribute("data-ai-history-reuse"));
        return;
      }
      const del = ev.target.closest("[data-ai-history-delete]");
      if (del) {
        global.TasuAiHistoryStore?.remove?.(del.getAttribute("data-ai-history-delete"));
        refreshHistoryPanel();
        return;
      }
      const fav = ev.target.closest("[data-ai-history-fav]");
      if (fav) {
        global.TasuAiHistoryStore?.toggleFavorite?.(fav.getAttribute("data-ai-history-fav"));
        refreshHistoryPanel();
        return;
      }
      const pin = ev.target.closest("[data-ai-history-pin]");
      if (pin) {
        global.TasuAiHistoryStore?.togglePinned?.(pin.getAttribute("data-ai-history-pin"));
        refreshHistoryPanel();
        return;
      }
    });

    panel?.addEventListener("change", (ev) => {
      const folderSel = ev.target.closest("[data-ai-history-folder]");
      if (folderSel) {
        global.TasuAiHistoryStore?.update?.(folderSel.getAttribute("data-ai-history-folder"), {
          folderId: folderSel.value,
        });
        return;
      }
      if (ev.target.matches("[data-ai-history-search]")) historyUiState.query = ev.target.value;
      if (ev.target.matches("[data-ai-history-category]")) historyUiState.category = ev.target.value;
      if (ev.target.matches("[data-ai-history-folder-filter]")) historyUiState.folderId = ev.target.value;
      if (ev.target.matches("[data-ai-history-sort]")) historyUiState.sort = ev.target.value;
      if (ev.target.matches("[data-ai-history-fav-only]")) historyUiState.favoriteOnly = ev.target.checked;
      refreshHistoryPanel();
    });

    panel?.addEventListener("input", (ev) => {
      if (ev.target.matches("[data-ai-history-search]")) {
        historyUiState.query = ev.target.value;
        refreshHistoryPanel();
      }
    });

    global.addEventListener("tasu:ai-history-changed", refreshHistoryPanel);
  }

  function mount() {
    bindCategoryNav();
    applyCategory(readCategory());
  }

  global.TasuAiWorkspaceCategories = {
    CATEGORIES,
    applyCategory,
    resumeHistory,
    reuseHistory,
    mount,
  };

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})(typeof window !== "undefined" ? window : globalThis);
