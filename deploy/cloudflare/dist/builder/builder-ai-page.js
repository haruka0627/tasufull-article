/**
 * Builder AI — 独立ページ UI
 */
(function (global) {
  "use strict";

  const STORAGE_HISTORY = "tasu_builder_ai_chat_v1";
  const MAX_MESSAGES = 24;

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
      const raw = sessionStorage.getItem(STORAGE_HISTORY);
      const list = JSON.parse(raw || "[]");
      return Array.isArray(list) ? list.slice(-MAX_MESSAGES) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(messages) {
    try {
      sessionStorage.setItem(STORAGE_HISTORY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
    } catch {
      /* ignore */
    }
  }

  function getActor() {
    return global.TasuBuilderAIContext?.resolveActor?.({}) || { actorType: "guest", label: "ゲスト" };
  }

  function getDraftStore() {
    return global.TasuBuilderAIDraftStore;
  }

  function formatDraftTime(iso) {
    try {
      return new Date(iso).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return String(iso || "");
    }
  }

  function populateProjects(actor) {
    const select = $("[data-builder-ai-project-select]");
    const manual = $("[data-builder-ai-project-id]");
    if (!select) return;
    const list = global.TasuBuilderAIContext?.listAccessibleProjects?.(actor) || [];
    select.innerHTML =
      '<option value="">— 案件を選択（任意） —</option>' +
      list.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)} (${escapeHtml(p.id)})</option>`).join("");
    if (list.length === 1 && manual && !manual.value) {
      select.value = list[0].id;
      manual.value = list[0].id;
    }
  }

  function populateTemplates(actor) {
    const wrap = $("[data-builder-ai-templates]");
    if (!wrap) return;
    const actions = global.TasuBuilderAIActions?.listActions?.(actor.actorType) || [];
    wrap.innerHTML = actions
      .map(
        (a) =>
          `<button type="button" class="builder-ai-chip" data-builder-ai-action="${escapeHtml(a.id)}" data-template="${escapeHtml(a.template)}">${escapeHtml(a.label)}</button>`
      )
      .join("");
  }

  function renderMessages(messages) {
    const log = $("[data-builder-ai-messages]");
    if (!log) return;
    log.innerHTML = "";
    messages.forEach((m) => {
      const div = document.createElement("div");
      div.className = `builder-ai-msg builder-ai-msg--${m.role === "user" ? "user" : "assistant"}`;
      if (m.role === "assistant") {
        const footerHtml =
          window.TasuCommonAiDisclaimer?.renderAnswerFooterHtml?.({ builder: true }) || "";
        div.innerHTML = `<pre class="builder-ai-msg__body">${escapeHtml(m.content)}</pre>${footerHtml}`;
        if (m.action) {
          const meta = document.createElement("p");
          meta.className = "builder-ai-msg__meta";
          meta.textContent = `action: ${m.action}`;
          div.appendChild(meta);
        }
      } else {
        div.textContent = m.content;
      }
      log.appendChild(div);
    });
    log.scrollTop = log.scrollHeight;
  }

  function renderDraftHistory() {
    const listEl = $("[data-builder-ai-draft-list]");
    const emptyEl = $("[data-builder-ai-draft-empty]");
    const saveBtn = $("[data-builder-ai-save-draft]");
    const Store = getDraftStore();
    const actor = getActor();
    if (saveBtn) saveBtn.hidden = Store?.canPersistDrafts ? !Store.canPersistDrafts(actor) : actor.actorType === "guest";
    if (!listEl || !Store?.listDrafts) return;
    const drafts = Store.listDrafts(actor);
    listEl.innerHTML = "";

    if (emptyEl) emptyEl.hidden = drafts.length > 0;

    drafts.forEach((row) => {
      const item = document.createElement("article");
      item.className = "builder-ai-draft-item";
      item.dataset.draftId = row.id;
      const preview = String(row.content || "")
        .replace(/^【下書き・確認用】\s*/u, "")
        .slice(0, 120);
      item.innerHTML = `
        <header class="builder-ai-draft-item__head">
          <strong class="builder-ai-draft-item__action">${escapeHtml(row.action || "faq_answer")}</strong>
          <time class="builder-ai-draft-item__time">${escapeHtml(formatDraftTime(row.created_at))}</time>
        </header>
        <p class="builder-ai-draft-item__meta">
          ${row.project_id ? `案件: ${escapeHtml(row.project_id)} · ` : ""}${escapeHtml(row.actor_label || row.actor_type)}
        </p>
        <p class="builder-ai-draft-item__preview">${escapeHtml(preview)}${preview.length >= 120 ? "…" : ""}</p>
        <div class="builder-ai-draft-item__actions">
          <button type="button" class="builder-btn builder-btn--ghost builder-btn--sm" data-builder-ai-draft-copy="${escapeHtml(row.id)}">コピー</button>
          <button type="button" class="builder-btn builder-btn--ghost builder-btn--sm" data-builder-ai-draft-hide="${escapeHtml(row.id)}">非表示</button>
        </div>
      `;
      listEl.appendChild(item);
    });
  }

  function setStatus(text, busy) {
    const el = $("[data-builder-ai-status]");
    if (el) el.textContent = text || "";
    const send = $("[data-builder-ai-send]");
    const input = $("[data-builder-ai-input]");
    if (send) send.disabled = Boolean(busy);
    if (input) input.disabled = Boolean(busy);
  }

  function resolveProjectId() {
    const select = $("[data-builder-ai-project-select]");
    const manual = $("[data-builder-ai-project-id]");
    return String(select?.value || manual?.value || "").trim();
  }

  function resolveActionId() {
    const hidden = $("[data-builder-ai-current-action]");
    return String(hidden?.value || "faq_answer").trim();
  }

  function getLastAssistantMessage() {
    return [...messages].reverse().find((m) => m.role === "assistant" && m.content);
  }

  let messages = loadHistory();
  let sending = false;
  let lastResult = null;

  async function sendMessage() {
    if (sending) return;
    const input = $("[data-builder-ai-input]");
    const text = String(input?.value || "").trim();
    if (!text) return;

    const Core = global.TasuBuilderAICore;
    if (!Core?.runAction) {
      setStatus("Builder AI Core が読み込まれていません", false);
      return;
    }

    sending = true;
    setStatus("生成中…", true);
    messages.push({ role: "user", content: text });
    renderMessages(messages);
    if (input) input.value = "";

    const actor = getActor();
    const result = await Core.runAction({
      action: resolveActionId(),
      userText: text,
      projectId: resolveProjectId(),
      actor,
      messages: messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content })),
    });

    lastResult = result;
    const reply = result?.draft || result?.error || "応答を取得できませんでした。";
    messages.push({ role: "assistant", content: reply, action: result?.action || "" });
    saveHistory(messages);
    renderMessages(messages);
    setStatus(result?.usedRemote ? "Edge 応答" : result?.fallback_used ? "モック応答" : "", false);
    sending = false;
  }

  function saveLastDraftToStore() {
    const Store = getDraftStore();
    const last = getLastAssistantMessage();
    if (!Store?.saveDraft || !last?.content) {
      setStatus("保存する回答がありません", false);
      return;
    }
    const actor = getActor();
    const res = Store.saveDraft({
      content: last.content,
      action: last.action || lastResult?.action || resolveActionId(),
      projectId: resolveProjectId(),
      actor,
    });
    if (!res.ok) {
      setStatus(res.error === "not_draft_content" ? "下書き形式の回答のみ保存できます" : "保存に失敗しました", false);
      return;
    }
    renderDraftHistory();
    setStatus("下書きを保存しました（正式文書ではありません）", false);
    setTimeout(() => setStatus("", false), 2000);
  }

  function bindCopy() {
    const btn = $("[data-builder-ai-copy]");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const last = getLastAssistantMessage();
      if (!last?.content) return;
      navigator.clipboard?.writeText(last.content).catch(() => {});
      setStatus("コピーしました", false);
      setTimeout(() => setStatus("", false), 1500);
    });
  }

  function bindDraftPanel() {
    const saveBtn = $("[data-builder-ai-save-draft]");
    if (saveBtn) saveBtn.addEventListener("click", saveLastDraftToStore);

    const listEl = $("[data-builder-ai-draft-list]");
    if (listEl) {
      listEl.addEventListener("click", (ev) => {
        const copyBtn = ev.target.closest("[data-builder-ai-draft-copy]");
        const hideBtn = ev.target.closest("[data-builder-ai-draft-hide]");
        const Store = getDraftStore();
        const actor = getActor();
        if (copyBtn && Store?.getDraft) {
          const id = copyBtn.getAttribute("data-builder-ai-draft-copy");
          const row = Store.getDraft(id, actor);
          if (row?.content) {
            navigator.clipboard?.writeText(row.content).catch(() => {});
            setStatus("下書きをコピーしました", false);
            setTimeout(() => setStatus("", false), 1500);
          }
        }
        if (hideBtn && Store?.hideDraft) {
          const id = hideBtn.getAttribute("data-builder-ai-draft-hide");
          const res = Store.hideDraft(id, actor);
          if (res.ok) {
            renderDraftHistory();
            setStatus("下書きを非表示にしました", false);
            setTimeout(() => setStatus("", false), 1500);
          }
        }
      });
    }

    try {
      global.addEventListener(getDraftStore()?.EVENT_NAME || "tasu:builder-ai-drafts-changed", renderDraftHistory);
    } catch {
      /* ignore */
    }
  }

  function bindTemplates() {
    const wrap = $("[data-builder-ai-templates]");
    const input = $("[data-builder-ai-input]");
    const actionField = $("[data-builder-ai-current-action]");
    if (!wrap) return;
    wrap.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-builder-ai-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-builder-ai-action") || "faq_answer";
      const template = btn.getAttribute("data-template") || "";
      if (actionField) actionField.value = action;
      if (input) input.value = template;
      input?.focus();
      wrap.querySelectorAll(".builder-ai-chip").forEach((el) => el.classList.remove("builder-ai-chip--active"));
      btn.classList.add("builder-ai-chip--active");
    });
  }

  function bindProjectSync() {
    const select = $("[data-builder-ai-project-select]");
    const manual = $("[data-builder-ai-project-id]");
    if (select && manual) {
      select.addEventListener("change", () => {
        manual.value = select.value;
      });
      manual.addEventListener("input", () => {
        const val = manual.value;
        const opt = [...select.options].find((o) => o.value === val);
        if (opt) select.value = val;
      });
    }
  }

  function applyUrlParams() {
    const params = new URLSearchParams(global.location.search);
    const action = params.get("action");
    const projectId = params.get("project_id") || params.get("projectId");
    const roleLabel = $("[data-builder-ai-role-label]");
    const actor = getActor();
    if (roleLabel) roleLabel.textContent = actor.label || actor.actorType;
    if (projectId) {
      const manual = $("[data-builder-ai-project-id]");
      const select = $("[data-builder-ai-project-select]");
      if (manual) manual.value = projectId;
      if (select) select.value = projectId;
    }
    if (action) {
      const actionField = $("[data-builder-ai-current-action]");
      if (actionField) actionField.value = action;
      const btn = document.querySelector(`[data-builder-ai-action="${action.replace(/"/g, "")}"]`);
      btn?.classList.add("builder-ai-chip--active");
    }
  }

  function init() {
    const actor = getActor();
    populateProjects(actor);
    populateTemplates(actor);
    renderMessages(messages);
    renderDraftHistory();
    applyUrlParams();
    bindTemplates();
    bindProjectSync();
    bindCopy();
    bindDraftPanel();

    const Store = getDraftStore();
    if (Store?.syncFromSupabase) {
      void Store.syncFromSupabase(getActor()).finally(() => renderDraftHistory());
    }
    if (global.TasuBuilderAIJwtResolver?.resolveActorAsync) {
      void global.TasuBuilderAIJwtResolver.resolveActorAsync().then(() => {
        populateProjects(getActor());
        renderDraftHistory();
      });
    }

    $("[data-builder-ai-send]")?.addEventListener("click", sendMessage);
    $("[data-builder-ai-input]")?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        sendMessage();
      }
    });
    $("[data-builder-ai-clear]")?.addEventListener("click", () => {
      messages = [];
      lastResult = null;
      saveHistory(messages);
      renderMessages(messages);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuBuilderAIPage = { init, sendMessage, getActor, renderDraftHistory, saveLastDraftToStore };
})(typeof window !== "undefined" ? window : globalThis);
