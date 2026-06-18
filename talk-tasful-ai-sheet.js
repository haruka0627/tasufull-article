/**
 * TASFUL AI — TALK 内コンパクト呼び出し（UIのみ / localStorage ダミー）
 */
(function (global) {
  "use strict";

  const MOBILE_MQ = "(max-width: 960px)";
  const STORAGE_KEY = "tasu_talk_tasful_ai_runs_v1";
  const DOM_VERSION = "6";
  const TOAST_SENT = "TASFUL AIに送信しました";

  let wired = false;
  let toastTimer = 0;

  function isMobileViewport() {
    try {
      return global.matchMedia(MOBILE_MQ).matches;
    } catch {
      return false;
    }
  }

  function getSheet() {
    return document.querySelector("[data-talk-tasful-ai-sheet]");
  }

  function getToast() {
    return document.querySelector("[data-talk-tasful-ai-toast]");
  }

  function getInput() {
    return document.querySelector("[data-talk-tasful-ai-input]");
  }

  function readHistory() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeHistory(entries) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 40)));
    } catch {
      /* ignore quota */
    }
  }

  function getContextMeta() {
    const page = document.body?.dataset?.page || "";
    const threadId =
      global.TasuTalkLineRoom?.getActiveThreadId?.() ||
      new URLSearchParams(global.location.search).get("thread") ||
      "";
    return { page, threadId: String(threadId || "").trim() };
  }

  function showToast(message) {
    const toast = getToast();
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2800);
  }

  function submitMessage(text) {
    const message = String(text || "").trim();
    if (!message) return false;
    const entry = {
      id: `${Date.now()}-msg`,
      text: message,
      at: new Date().toISOString(),
      context: getContextMeta(),
      source: "talk-compact",
    };
    writeHistory([entry, ...readHistory()]);
    const input = getInput();
    if (input) input.value = "";
    close();
    showToast(TOAST_SENT);
    return true;
  }

  function sheetShellHtml() {
    return `<div class="talk-tasful-ai-sheet" data-talk-tasful-ai-sheet data-tasful-ai-sheet-version="${DOM_VERSION}" hidden aria-hidden="true">
      <div class="talk-tasful-ai-sheet__backdrop" data-talk-tasful-ai-close tabindex="-1" aria-hidden="true"></div>
      <div class="talk-tasful-ai-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="talkTasfulAiSheetTitle">
        <header class="talk-tasful-ai-sheet__header">
          <h2 id="talkTasfulAiSheetTitle" class="talk-tasful-ai-sheet__title">TASFUL AI</h2>
          <button type="button" class="talk-tasful-ai-sheet__close" data-talk-tasful-ai-close aria-label="閉じる">×</button>
        </header>
        <div class="talk-tasful-ai-sheet__body">
          <div class="talk-tasful-ai-sheet__intro">
            <img class="talk-tasful-ai-sheet__avatar" src="images/tasful-ai-circle-icon.png" alt="" width="28" height="28" decoding="async">
            <p class="talk-tasful-ai-sheet__greeting">こんにちは、何を手伝いますか？</p>
          </div>
          <form class="talk-tasful-ai-sheet__composer" data-talk-tasful-ai-form>
            <label class="talk-tasful-ai-sheet__field">
              <span class="visually-hidden">メッセージを入力</span>
              <textarea class="talk-tasful-ai-sheet__input" data-talk-tasful-ai-input rows="2" placeholder="メッセージを入力"></textarea>
            </label>
            <button type="submit" class="talk-tasful-ai-sheet__send" data-talk-tasful-ai-send>送信</button>
          </form>
        </div>
      </div>
    </div>
    <div class="talk-tasful-ai-sheet__toast" data-talk-tasful-ai-toast role="status" aria-live="polite"></div>`;
  }

  function ensureDom() {
    const existing = document.querySelector("[data-talk-tasful-ai-sheet]");
    if (existing?.dataset?.tasfulAiSheetVersion === DOM_VERSION) return;
    existing?.closest("[data-talk-tasful-ai-sheet]")?.remove();
    document.querySelector("[data-talk-tasful-ai-toast]")?.remove();
    const root = document.createElement("div");
    root.innerHTML = sheetShellHtml();
    while (root.firstChild) document.body.appendChild(root.firstChild);
  }

  function syncLayout() {
    const sheet = getSheet();
    if (!sheet || sheet.hidden) return;
    sheet.classList.toggle("talk-tasful-ai-sheet--mobile", isMobileViewport());
    sheet.classList.toggle("talk-tasful-ai-sheet--desktop", !isMobileViewport());
  }

  function open() {
    ensureDom();
    const sheet = getSheet();
    if (!sheet) return;
    getToast()?.classList.remove("is-visible");
    sheet.hidden = false;
    sheet.setAttribute("aria-hidden", "false");
    syncLayout();
    document.body.classList.add("talk-tasful-ai-sheet-open");
    const input = getInput();
    if (input) {
      input.value = "";
      global.setTimeout(() => input.focus(), 60);
    } else {
      sheet.querySelector(".talk-tasful-ai-sheet__close")?.focus?.();
    }
  }

  function close() {
    const sheet = getSheet();
    if (!sheet) return;
    getToast()?.classList.remove("is-visible");
    sheet.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
    document.body.classList.remove("talk-tasful-ai-sheet-open");
  }

  function wireSheet() {
    if (wired) return;
    wired = true;
    ensureDom();
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest("[data-talk-tasful-ai-close]")) {
        event.preventDefault();
        close();
      }
    });
    document.addEventListener("submit", (event) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form?.matches("[data-talk-tasful-ai-form]")) return;
      event.preventDefault();
      const input = form.querySelector("[data-talk-tasful-ai-input]");
      submitMessage(input?.value || "");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    global.addEventListener("resize", syncLayout);
  }

  function wireTriggers() {
    document.querySelectorAll("[data-talk-tasful-ai-open]").forEach((btn) => {
      if (btn.dataset.tasfulAiWired) return;
      btn.dataset.tasfulAiWired = "1";
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        open();
      });
    });
  }

  function init() {
    wireSheet();
    wireTriggers();
  }

  global.TasuTalkTasfulAiSheet = {
    open,
    close,
    init,
    getHistory: readHistory,
    submitMessage,
    DOM_VERSION,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
