/**
 * TASFUL AI Workspace — 相談・検索窓口シェル
 */
(function () {
  "use strict";

  const STORAGE_PREFIX = "tasu_ai_chat_";
  const TOOL_STORAGE_KEY = "tasu_ai_workspace_tool";
  const DEFAULT_MODE = "cross-matching";

  const WORKSPACE_TOOLS = [
    {
      id: "consult",
      label: "AI相談",
      searchTarget: "tasful",
      desc: "自然文で相談・案内・FAQ",
    },
    {
      id: "tasful",
      label: "TASFUL内検索",
      searchTarget: "tasful",
      resultLayout: "candidates-only",
      desc: "TASFUL内の掲載から候補を表示",
    },
    {
      id: "web",
      label: "Web検索",
      searchTarget: "web",
      desc: "Web上の情報を検索して整理",
    },
    {
      id: "both",
      label: "両方検索",
      searchTarget: "both",
      desc: "TASFUL内候補とWeb結果を併用",
    },
    {
      id: "media",
      label: "画像・PDF",
      searchTarget: "tasful",
      attach: true,
      desc: "画像・PDFを添付して解析",
    },
  ];

  const EARTH_ICON_HTML =
    '<div class="mini-earth-wrap"><svg class="mini-earth" viewBox="0 0 100 100" fill="none" aria-hidden="true">' +
    '<circle class="mini-earth-core" cx="50" cy="50" r="28"/>' +
    '<ellipse class="mini-earth-line" cx="50" cy="50" rx="20" ry="28"/>' +
    '<ellipse class="mini-earth-line" cx="50" cy="50" rx="10" ry="28"/>' +
    '<ellipse class="mini-earth-line" cx="50" cy="50" rx="28" ry="10"/></svg></div>';

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function getWorkspace() {
    return document.querySelector("[data-ai-workspace-chat]");
  }

  function getToolDef(toolId) {
    return WORKSPACE_TOOLS.find((t) => t.id === toolId) || WORKSPACE_TOOLS[0];
  }

  function readStoredTool() {
    try {
      const stored = sessionStorage.getItem(TOOL_STORAGE_KEY);
      if (stored && getToolDef(stored)) return stored;
    } catch {
      /* ignore */
    }
    return "consult";
  }

  function writeStoredTool(toolId) {
    try {
      sessionStorage.setItem(TOOL_STORAGE_KEY, toolId);
    } catch {
      /* ignore */
    }
  }

  function getActiveModeId() {
    const root = getWorkspace();
    return root?.getAttribute("data-mode") || DEFAULT_MODE;
  }

  function getStoredMessages(modeId) {
    if (!modeId) return [];
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_PREFIX + modeId) || "[]");
    } catch {
      return [];
    }
  }

  function hasUserMessages(modeId) {
    const id = modeId || getActiveModeId();
    if (!id) return false;
    return getStoredMessages(id).some((m) => m.role === "user");
  }

  function listHistory() {
    const items = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const modeId = key.slice(STORAGE_PREFIX.length);
      let messages = [];
      try {
        messages = JSON.parse(sessionStorage.getItem(key) || "[]");
      } catch {
        continue;
      }
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (!lastUser) continue;
      items.push({
        modeId,
        preview: String(lastUser.content || "").trim().slice(0, 48),
        updatedAt: messages.length,
      });
    }
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function renderHistory(host, filterText) {
    if (!host) return;
    const q = String(filterText || "")
      .trim()
      .toLowerCase();
    const items = listHistory().filter((item) => {
      if (!q) return true;
      return item.preview.toLowerCase().includes(q);
    });
    host.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "history-empty";
      empty.style.cssText = "padding:10px 14px;font-size:12px;color:#64748b;margin:0;";
      empty.textContent = q
        ? "該当する履歴はありません。"
        : "まだ履歴はありません。下の入力欄から相談を始めてください。";
      host.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "history-item";
      btn.setAttribute("data-tga-history-mode", item.modeId);
      btn.textContent = item.preview;
      host.appendChild(btn);
    });
  }

  function setWelcomeVisible(show) {
    const welcome = $("#welcome-screen");
    if (!welcome) return;
    if (show) welcome.removeAttribute("hidden");
    else welcome.hidden = true;
  }

  function syncView(modeId) {
    const showWelcome = !hasUserMessages(modeId);
    setWelcomeVisible(showWelcome);
    const list = $("#message-wrapper");
    if (list) list.hidden = showWelcome;
  }

  function closeSidebar() {
    $("#sidebar-fixed")?.classList.remove("is-open");
    $("[data-tga-sidebar-backdrop]")?.setAttribute("hidden", "");
    document.body.classList.remove("tga-sidebar-open");
  }

  function openSidebar() {
    $("#sidebar-fixed")?.classList.add("is-open");
    $("[data-tga-sidebar-backdrop]")?.removeAttribute("hidden");
    document.body.classList.add("tga-sidebar-open");
  }

  function closeModeDropdown() {
    $("#tool-dropdown")?.classList.remove("show");
    $("[data-tga-mode-toggle]")?.setAttribute("aria-expanded", "false");
  }

  function openModeDropdown() {
    $("#tool-dropdown")?.classList.add("show");
    $("[data-tga-mode-toggle]")?.setAttribute("aria-expanded", "true");
  }

  function toggleModeDropdown() {
    const dropdown = $("#tool-dropdown");
    if (dropdown?.classList.contains("show")) closeModeDropdown();
    else openModeDropdown();
  }

  function syncSearchTargetInputs(root, searchTarget) {
    const normalized = window.TasuAiSearchTarget?.normalizeTarget?.(searchTarget) || searchTarget || "tasful";
    root?.querySelectorAll("[data-ai-search-target-input]").forEach((input) => {
      input.checked = input.value === normalized;
    });
    window.TasuAiSearchTarget?.syncTargetOnRoot?.(root, normalized);
  }

  function applyWorkspaceTool(toolId, { focusInput = true, openAttach = false } = {}) {
    const root = getWorkspace();
    if (!root) return;
    const tool = getToolDef(toolId);
    writeStoredTool(tool.id);

    root.setAttribute("data-workspace-tool", tool.id);
    root.setAttribute("data-search-target", tool.searchTarget);
    root.setAttribute("data-result-layout", tool.resultLayout || "default");
    syncSearchTargetInputs(root, tool.searchTarget);

    const labelEl = $("[data-tga-mode-label]");
    if (labelEl) labelEl.textContent = tool.label;

    document.querySelectorAll("[data-tga-workspace-tool]").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-tool") === tool.id);
    });

    closeModeDropdown();

    if (openAttach || tool.attach) {
      root.querySelector("[data-ai-attach-input]")?.click();
    }

    if (focusInput) root.querySelector("[data-ai-chat-input]")?.focus();
  }

  function fillStarter(text) {
    const root = getWorkspace();
    const input = root?.querySelector("[data-ai-chat-input]");
    if (!input) return;
    if (window.TasuAiGenerateUi?.isGenerationIntent?.(text)) {
      applyWorkspaceTool("consult", { focusInput: false });
    }
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  async function restoreHistoryMode(modeId) {
    const root = getWorkspace();
    if (!root || !window.TasuAiChat?.switchMode) return;
    await window.TasuAiChat.switchMode(root, modeId || DEFAULT_MODE);
    syncView(modeId || DEFAULT_MODE);
    closeSidebar();
  }

  function bindShell() {
    const workspace = getWorkspace();
    const historyHost = $("[data-tga-history]");
    const historySearch = $("[data-tga-history-search]");

    document.querySelectorAll("[data-tga-starter-chip], [data-tga-welcome-card]").forEach((el) => {
      el.addEventListener("click", () => {
        fillStarter(el.getAttribute("data-starter")?.trim() || el.textContent?.trim() || "");
      });
    });

    historyHost?.addEventListener("click", (e) => {
      const item = e.target.closest("[data-tga-history-mode]");
      if (!item) return;
      void restoreHistoryMode(item.getAttribute("data-tga-history-mode"));
    });

    historySearch?.addEventListener("input", () => {
      renderHistory(historyHost, historySearch.value);
    });

    $("[data-tga-new-chat]")?.addEventListener("click", () => {
      const modeId = workspace?.getAttribute("data-mode") || DEFAULT_MODE;
      window.TasuAiChat?.resetChatSession?.(modeId);
      const list = workspace?.querySelector("[data-ai-chat-messages]");
      if (list) list.innerHTML = "";
      const input = workspace?.querySelector("[data-ai-chat-input]");
      if (input) {
        input.value = "";
        input.style.height = "auto";
      }
      const preview = workspace?.querySelector("[data-ai-attach-preview]");
      if (preview) {
        preview.hidden = true;
        preview.textContent = "";
      }
      syncView(modeId);
      renderHistory(historyHost, historySearch?.value);
      closeSidebar();
      workspace?.querySelector("[data-ai-chat-input]")?.focus();
    });

    $("[data-tga-history-toggle]")?.addEventListener("click", () => {
      const sidebar = $("#sidebar-fixed");
      if (sidebar?.classList.contains("is-open")) closeSidebar();
      else openSidebar();
    });

    $("[data-tga-sidebar-backdrop]")?.addEventListener("click", closeSidebar);

    $("[data-tga-mode-toggle]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleModeDropdown();
    });

    document.querySelectorAll("[data-tga-workspace-tool]").forEach((item) => {
      item.addEventListener("click", () => {
        applyWorkspaceTool(item.getAttribute("data-tool") || "consult", {
          openAttach: item.getAttribute("data-tool") === "media",
        });
      });
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest(".tool-selector-wrap")) return;
      closeModeDropdown();
    });

    const textarea = workspace?.querySelector("[data-ai-chat-input]");
    const composerFrame = workspace?.querySelector("[data-ai-composer-frame]");
    composerFrame?.addEventListener("click", (e) => {
      if (e.target.closest("button, a, label, input:not([data-ai-chat-input]), .tool-dropdown")) return;
      if (e.target.closest("[data-ai-chat-input]")) return;
      textarea?.focus();
    });
    textarea?.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = `${this.scrollHeight}px`;
    });
    textarea?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        workspace?.querySelector("[data-ai-chat-send]")?.click();
      }
    });

    const attachBtn = workspace?.querySelector("[data-ai-attach-btn]");
    const attachInput = workspace?.querySelector("[data-ai-attach-input]");
    attachBtn?.addEventListener("click", () => {
      applyWorkspaceTool("media", { focusInput: false, openAttach: true });
    });
    attachInput?.addEventListener("change", () => {
      const names = Array.from(attachInput.files || [])
        .map((f) => f.name)
        .slice(0, 3)
        .join(", ");
      const preview = workspace?.querySelector("[data-ai-attach-preview]");
      if (preview && names) {
        preview.hidden = false;
        preview.textContent = `添付: ${names}${(attachInput.files?.length || 0) > 3 ? "…" : ""}`;
      }
    });

    window.addEventListener("tasu:ai-chat-updated", (e) => {
      const modeId = e.detail?.modeId || getActiveModeId();
      renderHistory(historyHost, historySearch?.value);
      syncView(modeId);
    });
  }

  let shellReady = false;

  function maybeLoadCategoryDemo() {
    const params = new URLSearchParams(location.search);
    const demo = params.get("demo");
    const builders = {
      conversation: () => window.TasuAiConversationDemo?.build?.(),
      worker: () => window.TasuAiCategoryDemos?.buildWorker?.(),
      job: () => window.TasuAiCategoryDemos?.buildJob?.(),
      product: () => window.TasuAiCategoryDemos?.buildProduct?.(),
    };
    const build = builders[demo];
    if (!build) return;
    const messages = build();
    const root = getWorkspace();
    if (!messages?.length || !root || !window.TasuAiChat?.loadDemoConversation) return;
    window.TasuAiChat.loadDemoConversation(root, messages);
    renderHistory($("[data-tga-history]"));
    syncView(getActiveModeId());
  }

  function onChatReady() {
    if (shellReady) return;
    shellReady = true;
    bindShell();
    applyWorkspaceTool(readStoredTool(), { focusInput: false });
    maybeLoadCategoryDemo();
    renderHistory($("[data-tga-history]"));
    syncView(getActiveModeId());
  }

  function tryBootShell() {
    if (!getWorkspace() || !window.TasuAiChat) return;
    onChatReady();
  }

  window.TasuTgaShell = {
    EARTH_ICON_HTML,
    WORKSPACE_TOOLS,
    getToolDef,
    syncView,
    setWelcomeVisible,
    closeModeDropdown,
    applyWorkspaceTool,
    readStoredTool,
  };

  window.addEventListener("tasu:ai-chat-ready", onChatReady);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryBootShell);
  } else {
    tryBootShell();
  }
})();
