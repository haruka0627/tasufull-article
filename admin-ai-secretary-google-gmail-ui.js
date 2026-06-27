/**
 * AI秘書 Phase 6-D — Gmail UI cards (read + draft workflow + Human Gate)
 */
(function (global) {
  "use strict";

  let mounted = false;
  const cardState = new Map();

  const STATE_LABELS = Object.freeze({
    view: "閲覧",
    reply: "返信案",
    pending_draft: "送信確認待ち",
    draft: "下書き済み",
    confirm: "送信確認待ち",
    sent: "送信済み",
  });

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function $(root, sel) {
    return (root || document).querySelector(sel);
  }

  function formatDate(raw) {
    const t = Date.parse(String(raw || ""));
    if (!Number.isFinite(t)) return esc(raw || "");
    try {
      return esc(
        new Date(t).toLocaleString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
          month: "short",
          day: "numeric",
        })
      );
    } catch {
      return esc(raw || "");
    }
  }

  function getState(messageId) {
    return (
      cardState.get(messageId) || {
        phase: "view",
        body: "",
        plan: null,
        draftId: "",
        draftPendingId: "",
        sendPendingId: "",
      }
    );
  }

  function setState(messageId, patch) {
    const prev = getState(messageId);
    cardState.set(messageId, { ...prev, ...patch });
    return cardState.get(messageId);
  }

  function renderStateBadge(phase) {
    const label = STATE_LABELS[phase] || STATE_LABELS.view;
    return `<span class="ops-secretary-gmail__state ops-secretary-gmail__state--${esc(phase)}">${esc(label)}</span>`;
  }

  function renderActions(message, state) {
    const id = message.id;
    if (state.phase === "view") {
      return (
        `<div class="ops-secretary-gmail__actions">` +
        `<button type="button" class="ops-p3-action" data-gmail-action="propose-reply" data-gmail-id="${esc(id)}">返信案を作る</button>` +
        `</div>`
      );
    }
    if (state.phase === "reply") {
      return (
        `<div class="ops-secretary-gmail__actions">` +
        `<button type="button" class="ops-p3-action" data-gmail-action="save-draft" data-gmail-id="${esc(id)}">下書き保存</button>` +
        `<button type="button" class="ops-p3-action" data-gmail-action="cancel" data-gmail-id="${esc(id)}">キャンセル</button>` +
        `</div>`
      );
    }
    if (state.phase === "pending_draft") {
      return (
        `<div class="ops-secretary-gmail__actions">` +
        `<button type="button" class="ops-p3-action" data-gmail-action="approve-draft" data-gmail-id="${esc(id)}">下書きを承認作成</button>` +
        `<button type="button" class="ops-p3-action" data-gmail-action="cancel" data-gmail-id="${esc(id)}">キャンセル</button>` +
        `<p class="ops-secretary-gmail__readonly">Human Gate 承認後に drafts.create を実行</p>` +
        `</div>`
      );
    }
    if (state.phase === "draft") {
      return (
        `<div class="ops-secretary-gmail__actions">` +
        `<button type="button" class="ops-p3-action" data-gmail-action="confirm-send" data-gmail-id="${esc(id)}">送信確認</button>` +
        `<button type="button" class="ops-p3-action" data-gmail-action="cancel" data-gmail-id="${esc(id)}">キャンセル</button>` +
        `</div>`
      );
    }
    if (state.phase === "confirm") {
      return (
        `<div class="ops-secretary-gmail__confirm">` +
        `<label class="ops-secretary-gmail__confirm-check">` +
        `<input type="checkbox" data-gmail-confirm-check data-gmail-id="${esc(id)}" /> 内容を確認しました` +
        `</label>` +
        `<div class="ops-secretary-gmail__actions">` +
        `<button type="button" class="ops-p3-action ops-secretary-gmail__send-btn" data-gmail-action="final-send" data-gmail-id="${esc(id)}" disabled>送信する</button>` +
        `<button type="button" class="ops-p3-action" data-gmail-action="cancel" data-gmail-id="${esc(id)}">キャンセル</button>` +
        `</div>` +
        `<p class="ops-secretary-gmail__readonly">Human Gate 承認後のみ送信されます</p>` +
        `</div>`
      );
    }
    if (state.phase === "sent") {
      return `<p class="ops-secretary-gmail__readonly">送信済み（Human Gate 承認後）</p>`;
    }
    return "";
  }

  function renderDraftEditor(message, state) {
    if (!["reply", "pending_draft", "confirm", "draft"].includes(state.phase)) return "";
    const body = esc(state.body || "");
    const readonly = state.phase === "confirm" || state.phase === "pending_draft" || state.phase === "draft" ? "readonly" : "";
    return (
      `<div class="ops-secretary-gmail__draft">` +
      `<label class="ops-secretary-gmail__draft-label">返信案</label>` +
      `<textarea class="ops-secretary-gmail__draft-body" data-gmail-draft-body data-gmail-id="${esc(message.id)}" rows="4" ${readonly}>${body}</textarea>` +
      (state.plan
        ? `<p class="ops-secretary-gmail__draft-meta">To: ${esc(state.plan.to)} · ${esc(state.plan.subject)}</p>`
        : "") +
      `</div>`
    );
  }

  function renderCards(host, messages) {
    if (!host) return;
    messages = Array.isArray(messages) ? messages : [];
    if (!messages.length) {
      host.innerHTML = '<p class="ops-secretary-gmail__empty">該当メールはありません</p>';
      return;
    }
    host.innerHTML = messages
      .map((m) => {
        const state = getState(m.id);
        const badges = [
          m.unread ? '<span class="ops-secretary-gmail__badge ops-secretary-gmail__badge--unread">未読</span>' : "",
          m.important ? '<span class="ops-secretary-gmail__badge ops-secretary-gmail__badge--important">重要</span>' : "",
          m.hasAttachment ? '<span class="ops-secretary-gmail__badge">添付</span>' : "",
        ].join("");
        const att =
          Array.isArray(m.attachments) && m.attachments.length
            ? `<ul class="ops-secretary-gmail__attachments">${m.attachments
                .map((a) => `<li>${esc(a.filename)} · ${esc(a.mimeType)} · ${Number(a.size || 0)} bytes</li>`)
                .join("")}</ul>`
            : "";
        return (
          `<article class="ops-secretary-gmail__card" data-gmail-message-id="${esc(m.id)}" data-gmail-thread-id="${esc(m.threadId || "")}">` +
          `<header class="ops-secretary-gmail__card-head">` +
          `<strong class="ops-secretary-gmail__subject">${esc(m.subject)}</strong>` +
          `<span class="ops-secretary-gmail__meta">${formatDate(m.date)} · ${esc(m.from)} ${renderStateBadge(state.phase)}</span>` +
          `</header>` +
          `<p class="ops-secretary-gmail__snippet">${esc(m.snippet)}</p>` +
          (badges ? `<div class="ops-secretary-gmail__badges">${badges}</div>` : "") +
          att +
          renderDraftEditor(m, state) +
          renderActions(m, state) +
          `</article>`
        );
      })
      .join("");
    bindCardActions(host);
  }

  async function handleProposeReply(root, messageId, cardEl) {
    const Client = global.TasuSecretaryGoogleGmailClient;
    if (!Client?.proposeReply) return;
    const card = cardEl || root.querySelector(`[data-gmail-message-id="${messageId}"]`);
    const btn = card?.querySelector('[data-gmail-action="propose-reply"]');
    if (btn) btn.disabled = true;
    const messages = cardState.__lastMessages || [];
    const message = messages.find((m) => m.id === messageId) || { id: messageId };
    const result = await Client.proposeReply(message);
    if (!result.ok) {
      if (btn) btn.disabled = false;
      return;
    }
    setState(messageId, {
      phase: "reply",
      body: result.body,
      plan: result.plan,
    });
    renderCards($(root, "[data-ops-secretary-gmail-cards]"), messages);
  }

  async function handleSaveDraft(root, messageId) {
    const Client = global.TasuSecretaryGoogleGmailClient;
    const HSG = global.TasuAdminAiHumanSendGate;
    const state = getState(messageId);
    const textarea = root.querySelector(`textarea[data-gmail-draft-body][data-gmail-id="${messageId}"]`);
    const body = String(textarea?.value || state.body || "").trim();
    if (!body || !state.plan) return;

    const queued = Client.enqueueDraftHumanGate({
      messageId,
      threadId: state.plan.threadId,
      replyToMessageId: state.plan.replyToMessageId,
      to: state.plan.to,
      subject: state.plan.subject,
      body,
    });
    if (!queued.ok || !queued.item?.id) return;

    setState(messageId, { phase: "pending_draft", body, draftPendingId: queued.item.id });
    HSG?.renderHumanSendGatePanel?.("[data-ops-ai-human-send-gate]");
    renderCards($(root, "[data-ops-secretary-gmail-cards]"), cardState.__lastMessages || []);
  }

  async function handleApproveDraft(root, messageId) {
    const Client = global.TasuSecretaryGoogleGmailClient;
    const state = getState(messageId);
    if (!state.draftPendingId) return;
    const approved = await Client.approveDraftPending(state.draftPendingId);
    const draftId = approved?.executed?.raw?.data?.draftId || "";
    if (approved?.ok) {
      setState(messageId, { phase: "draft", draftId, body: state.body });
    }
    renderCards($(root, "[data-ops-secretary-gmail-cards]"), cardState.__lastMessages || []);
  }

  function handleConfirmSend(root, messageId) {
    const Client = global.TasuSecretaryGoogleGmailClient;
    const HSG = global.TasuAdminAiHumanSendGate;
    const state = getState(messageId);
    const queued = Client.enqueueSendHumanGate({
      messageId,
      threadId: state.plan?.threadId,
      replyToMessageId: state.plan?.replyToMessageId,
      to: state.plan?.to,
      subject: state.plan?.subject,
      body: state.body,
      draftId: state.draftId,
    });
    if (!queued.ok || !queued.item?.id) return;
    setState(messageId, { phase: "confirm", sendPendingId: queued.item.id });
    HSG?.renderHumanSendGatePanel?.("[data-ops-ai-human-send-gate]");
    renderCards($(root, "[data-ops-secretary-gmail-cards]"), cardState.__lastMessages || []);
  }

  async function handleFinalSend(root, messageId) {
    const Client = global.TasuSecretaryGoogleGmailClient;
    const state = getState(messageId);
    const check = root.querySelector(`input[data-gmail-confirm-check][data-gmail-id="${messageId}"]`);
    if (!check?.checked || !state.sendPendingId) return;

    const approved = await Client.approveSendPending(state.sendPendingId);
    if (approved?.ok) {
      setState(messageId, { phase: "sent" });
    }
    renderCards($(root, "[data-ops-secretary-gmail-cards]"), cardState.__lastMessages || []);
  }

  function handleCancel(messageId) {
    cardState.delete(messageId);
    const host = document.querySelector("[data-ops-secretary-gmail-cards]");
    if (host) renderCards(host, cardState.__lastMessages || []);
  }

  function bindCardActions(root) {
    root = root || document.querySelector("[data-ops-secretary-gmail-panel]");
    if (!root) return;

    root.querySelectorAll("[data-gmail-action]").forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-gmail-action");
        const messageId = btn.getAttribute("data-gmail-id");
        if (!messageId) return;
        if (action === "propose-reply") void handleProposeReply(root, messageId, btn.closest(".ops-secretary-gmail__card"));
        if (action === "save-draft") void handleSaveDraft(root, messageId);
        if (action === "approve-draft") void handleApproveDraft(root, messageId);
        if (action === "confirm-send") handleConfirmSend(root, messageId);
        if (action === "final-send") void handleFinalSend(root, messageId);
        if (action === "cancel") handleCancel(messageId);
      });
    });

    root.querySelectorAll("[data-gmail-confirm-check]").forEach((check) => {
      if (check.dataset.bound === "1") return;
      check.dataset.bound = "1";
      check.addEventListener("change", () => {
        const messageId = check.getAttribute("data-gmail-id");
        const sendBtn = root.querySelector(`button[data-gmail-action="final-send"][data-gmail-id="${messageId}"]`);
        if (sendBtn) sendBtn.disabled = !check.checked;
      });
    });

    root.querySelectorAll("[data-gmail-draft-body]").forEach((ta) => {
      if (ta.dataset.bound === "1") return;
      ta.dataset.bound = "1";
      ta.addEventListener("input", () => {
        const messageId = ta.getAttribute("data-gmail-id");
        const state = getState(messageId);
        setState(messageId, { body: ta.value, plan: state.plan });
      });
    });
  }

  async function loadQuery(root, q, label) {
    const Client = global.TasuSecretaryGoogleGmailClient;
    const host = $(root, "[data-ops-secretary-gmail-cards]");
    const status = $(root, "[data-ops-secretary-gmail-status]");
    if (!Client?.listMessages || !host) return;
    if (status) status.textContent = `${label || "読込中"}…`;
    host.innerHTML = '<p class="ops-secretary-gmail__empty">読込中…</p>';
    const result = await Client.listMessages({ q, maxResults: 10 });
    if (!result.ok) {
      if (status) status.textContent = `Gmail エラー: ${String(result.error || "failed").slice(0, 80)}`;
      host.innerHTML = '<p class="ops-secretary-gmail__empty">Gmail を読み込めませんでした</p>';
      return;
    }
    const messages = result.data?.messages || [];
    cardState.__lastMessages = messages;
    renderCards(host, messages);
    const mock = result.data?.mock ? " · mock" : "";
    if (status) status.textContent = `${label || "Gmail"} ${messages.length} 件${mock} · Human Gate`;
  }

  function bindPresets(root) {
    const Client = global.TasuSecretaryGoogleGmailClient;
    if (!Client) return;
    root.querySelectorAll("[data-ops-secretary-gmail-preset]").forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const preset = btn.getAttribute("data-ops-secretary-gmail-preset") || "inbox";
        const q = Client.PRESETS[preset] || Client.PRESETS.inbox;
        void loadQuery(root, q, btn.textContent?.trim() || preset);
      });
    });
    const searchForm = $(root, "[data-ops-secretary-gmail-search-form]");
    if (searchForm && searchForm.dataset.bound !== "1") {
      searchForm.dataset.bound = "1";
      searchForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const input = $(root, "[data-ops-secretary-gmail-search-input]");
        const q = String(input?.value || "").trim();
        if (!q) return;
        void loadQuery(root, q, `検索: ${q.slice(0, 24)}`);
      });
    }
  }

  function mount(root) {
    root = root || document.querySelector("[data-ops-secretary-gmail-panel]");
    if (!root || mounted) return;
    mounted = true;
    bindPresets(root);
    global.addEventListener("tasu:admin-ai-human-send-gate-updated", () => {
      const host = $(root, "[data-ops-secretary-gmail-cards]");
      if (host && cardState.__lastMessages) renderCards(host, cardState.__lastMessages);
    });
    void loadQuery(root, global.TasuSecretaryGoogleGmailClient?.PRESETS?.unread, "未読");
  }

  global.TasuSecretaryGoogleGmailUI = { mount, loadQuery, renderCards, getState, STATE_LABELS };
})(typeof window !== "undefined" ? window : globalThis);
