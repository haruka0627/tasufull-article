/**
 * TASFUL AI Workspace — 履歴自動保存ブリッジ（Gateway / AI Core 非接触）
 */
(function (global) {
  "use strict";

  const CHAT_PREFIX = "tasu_ai_chat_";

  function getStore() {
    return global.TasuAiHistoryStore;
  }

  function getModelFromMessages(messages) {
    const last = [...(messages || [])].reverse().find((m) => m.role === "assistant");
    return last?.model_label || last?.model_id || "";
  }

  function inferCategory(root, modeId, messages, tool) {
    const category = root?.getAttribute("data-ai-category") || "chat";
    if (category === "video" || category === "music" || category === "document" || category === "image") {
      return category === "image" ? "image" : category;
    }
    const workspaceTool = tool || root?.getAttribute("data-workspace-tool") || "";
    if (workspaceTool === "web") return "web_search";
    const params = new URLSearchParams(global.location?.search || "");
    if (params.get("source") === "builder") return "builder";
    const lastUser = [...(messages || [])].reverse().find((m) => m.role === "user");
    const text = String(lastUser?.content || "");
    if (/翻訳|translate/i.test(text)) return "translate";
    if (/要約|サマリ|summary/i.test(text)) return "summary";
    if (/コード|HTML|JavaScript|Python/i.test(text)) return "code";
    if (/資料|提案書|企画書|議事録|見積|マニュアル/i.test(text)) return "document";
    if (/画像.*生成|画像を作/i.test(text)) return "image";
    if (modeId === "cross-matching" && workspaceTool === "web") return "web_search";
    return "chat";
  }

  function recordFromChat(modeId, root) {
    const store = getStore();
    if (!store) return null;
    let messages = [];
    try {
      messages = JSON.parse(global.sessionStorage?.getItem(CHAT_PREFIX + modeId) || "[]");
    } catch {
      return null;
    }
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return null;

    const sessionKey = `${modeId}:${CHAT_PREFIX}${modeId}`;
    const category = inferCategory(root, modeId, messages);
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const existing = store.findBySessionKey(sessionKey);

    return store.upsert({
      id: existing?.id,
      sessionKey,
      modeId,
      category,
      title: store.deriveTitle(lastUser.content, store.categoryLabel(category)),
      model: getModelFromMessages(messages),
      modelLabel: getModelFromMessages(messages),
      prompt: String(lastUser.content || "").slice(0, 2000),
      resultPreview: String(lastAssistant?.content || "").slice(0, 500),
      resultMarkdown: String(lastAssistant?.content || ""),
      messages: messages.slice(-20),
      folderId: existing?.folderId,
      favorite: existing?.favorite,
      pinned: existing?.pinned,
    });
  }

  function recordGeneration(payload) {
    const store = getStore();
    if (!store || !payload) return null;
    return store.upsert({
      category: payload.category,
      title: payload.title || store.deriveTitle(payload.prompt, store.categoryLabel(payload.category)),
      model: payload.model || global.TasuAiPlanModels?.getSelectedModelId?.() || "default",
      modelLabel: payload.modelLabel || "",
      prompt: payload.prompt || "",
      params: payload.params || {},
      resultPreview: payload.resultPreview || payload.message || "",
      resultMarkdown: payload.resultMarkdown || payload.markdown || "",
      messages: payload.messages || [],
      folderId: payload.folderId,
    });
  }

  function bind() {
    const on = global.addEventListener?.bind(global);
    if (!on) return;
    on("tasu:ai-chat-updated", (ev) => {
      const root = global.document?.querySelector("[data-ai-workspace-chat]");
      const modeId = ev.detail?.modeId || root?.getAttribute("data-mode");
      if (!modeId || root?.getAttribute("data-ai-category") === "history") return;
      recordFromChat(modeId, root);
    });

    on("tasu:ai-generation-complete", (ev) => {
      recordGeneration(ev.detail || {});
    });
  }

  global.TasuAiHistoryBridge = {
    recordFromChat,
    recordGeneration,
    inferCategory,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})(typeof window !== "undefined" ? window : globalThis);
