/**
 * TASFUL AI — Site Assistant UI（右下 · 既存サイトAI cross-matching のみ）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_site_assistant_chat_v1";
  const ROOT_ID = "tasu-site-assistant-root";
  const INITIAL_MESSAGE =
    "TASFULの使い方で困ったことを聞いてください。登録・掲載・応募・各サービス案内に対応できます。";

  const QUICK_QUESTIONS = [
    "会員登録したい",
    "案件を掲載したい",
    "案件に応募したい",
    "Builderを使いたい",
    "問い合わせしたい",
  ];

  let sending = false;

  function shouldSkipMount() {
    if (global.TASU_SITE_ASSISTANT_DISABLED) return true;
    if (document.body?.dataset?.tasuSiteAssistant === "off") return true;
    if (document.getElementById(ROOT_ID)) return true;
    const path = String(global.location?.pathname || "").toLowerCase();
    if (/\/admin-operations-dashboard\.html$/i.test(path)) return true;
    if (/\/talk-ops-room\.html$/i.test(path)) return true;
    if (/\/ai-workspace\.html$/i.test(path)) return true;
    if (/\/gen-ai-workspace\.html$/i.test(path)) return true;
    if (/\/builder-ai\.html$/i.test(path)) return true;
    if (/\/live\/admin-/i.test(path)) return true;
    if (/^\/admin-/i.test(path)) return true;
    return false;
  }

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const list = JSON.parse(raw || "[]");
      return Array.isArray(list) ? list.slice(-40) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(messages) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
  }

  function renderMessages(logEl, messages) {
    if (!logEl) return;
    logEl.innerHTML = "";
    messages.forEach((msg) => {
      const div = document.createElement("div");
      div.className = `tasu-site-assist__msg tasu-site-assist__msg--${msg.role === "user" ? "user" : "assistant"}`;
      div.textContent = msg.content;
      logEl.appendChild(div);
    });
    logEl.scrollTop = logEl.scrollHeight;
  }

  function ensureShell() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "tasu-site-assist";
    root.setAttribute("data-tasu-site-assistant", "");
    root.innerHTML =
      `<div class="tasu-site-assist__panel" data-tasu-site-panel hidden>` +
      `<header class="tasu-site-assist__head">` +
      `<div><p class="tasu-site-assist__title">TASFUL サイトAI</p>` +
      `<p class="tasu-site-assist__subtitle">TASFUL AI · サイト案内モード</p></div>` +
      `<button type="button" class="tasu-site-assist__close" data-tasu-site-close aria-label="閉じる">×</button>` +
      `</header>` +
      `<div class="tasu-site-assist__log" data-tasu-site-log role="log" aria-live="polite"></div>` +
      `<div class="tasu-site-assist__quick" data-tasu-site-quick></div>` +
      `<form class="tasu-site-assist__form" data-tasu-site-form>` +
      `<input class="tasu-site-assist__input" data-tasu-site-input type="text" autocomplete="off" ` +
      `placeholder="メッセージを入力" maxlength="500" aria-label="サイトAI メッセージ">` +
      `<button type="submit" class="tasu-site-assist__send" data-tasu-site-send>送信</button>` +
      `</form></div>` +
      `<button type="button" class="tasu-site-assist__fab" data-tasu-site-fab aria-label="TASFUL サイトAI を開く" aria-expanded="false">AI</button>`;

    document.body.appendChild(root);

    const quickEl = root.querySelector("[data-tasu-site-quick]");
    QUICK_QUESTIONS.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tasu-site-assist__quick-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => void sendUserMessage(label, root));
      quickEl.appendChild(btn);
    });

    root.querySelector("[data-tasu-site-fab]").addEventListener("click", () => {
      void openPanel(root);
    });
    root.querySelector("[data-tasu-site-close]").addEventListener("click", () => closePanel(root));
    root.querySelector("[data-tasu-site-form]").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const input = root.querySelector("[data-tasu-site-input]");
      void sendUserMessage(input?.value || "", root);
    });

    const history = loadHistory();
    if (!history.length) {
      history.push({ role: "assistant", content: INITIAL_MESSAGE });
      saveHistory(history);
    }
    renderMessages(root.querySelector("[data-tasu-site-log]"), history);
    return root;
  }

  async function openPanel(root) {
    const panel = root.querySelector("[data-tasu-site-panel]");
    const fab = root.querySelector("[data-tasu-site-fab]");
    panel.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    try {
      await global.TasuSiteAssistantAdapter?.ensureSiteAiDeps?.();
    } catch {
      /* deps load failure — stub guide still works */
    }
    root.querySelector("[data-tasu-site-input]")?.focus();
  }

  function closePanel(root) {
    const panel = root.querySelector("[data-tasu-site-panel]");
    const fab = root.querySelector("[data-tasu-site-fab]");
    panel.hidden = true;
    fab.setAttribute("aria-expanded", "false");
  }

  async function sendUserMessage(rawText, root) {
    const text = String(rawText || "").trim();
    if (!text || sending) return;

    const Adapter = global.TasuSiteAssistantAdapter;
    if (!Adapter?.completeTurn) return;

    sending = true;
    const input = root.querySelector("[data-tasu-site-input]");
    const sendBtn = root.querySelector("[data-tasu-site-send]");
    if (input) input.value = "";
    if (sendBtn) sendBtn.disabled = true;

    const logEl = root.querySelector("[data-tasu-site-log]");
    let history = loadHistory();
    history.push({ role: "user", content: text });
    renderMessages(logEl, history);

    const pageContext = Adapter.collectPageContext();
    const out = await Adapter.completeTurn({
      userText: text,
      messages: history,
      pageContext,
    });

    history.push({
      role: "assistant",
      content: String(out?.reply || "応答を取得できませんでした。"),
    });
    saveHistory(history);
    renderMessages(logEl, history);

    sending = false;
    if (sendBtn) sendBtn.disabled = false;
    input?.focus();
  }

  function mount() {
    if (shouldSkipMount()) return;
    if (!document.body) return;
    ensureShell();
  }

  global.TasuSiteAssistant = {
    mount,
    INITIAL_MESSAGE,
    QUICK_QUESTIONS,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})(typeof window !== "undefined" ? window : globalThis);
