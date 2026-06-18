/**
 * AI運営センター UI
 */
(function () {
  "use strict";

  const Store = window.TasuAiOpsCaseStore;
  const Types = window.TasuAiOpsTypes;
  const Command = window.TasuAiOpsCommand;
  const Notify = window.TasuAiOpsNotify;
  if (!Store || !Types) return;

  let currentTab = Types.TABS.NEEDS_REVIEW;
  let commandFilter = null;
  let selectedId = null;
  let pendingAction = null;

  const ACTION_LABELS = {
    send_reply: "返信を送信（管理者確認済み・予定）",
    needs_review: "要確認へ変更",
    resolved: "解決済みにする",
    refund_candidate: "返金候補にする（API未実行）",
    listing_suspend_candidate: "掲載停止候補（未実行）",
    account_restrict_candidate: "アカウント制限候補（未実行）",
    ban_candidate: "BAN候補（未実行）",
    connect_verified: "Connect確認済み（記録のみ）",
  };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function riskTag(risk) {
    const r = esc(risk || "low");
    return `<span class="ai-ops-tag ai-ops-tag--${r}">${r}</span>`;
  }

  function buildFilter() {
    const f = { ...(commandFilter || {}) };
    if (!commandFilter?.tab) f.tab = currentTab;
    return f;
  }

  function renderTabs() {
    const host = document.querySelector("[data-ai-ops-tabs]");
    if (!host) return;
    host.innerHTML = Object.values(Types.TABS)
      .map(
        (tab) =>
          `<button type="button" class="ai-ops-tab${tab === currentTab ? " is-active" : ""}" data-ai-ops-tab="${esc(tab)}">${esc(Types.TAB_LABELS[tab])}</button>`
      )
      .join("");
    host.querySelectorAll("[data-ai-ops-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentTab = btn.getAttribute("data-ai-ops-tab");
        commandFilter = null;
        document.querySelector("[data-ai-ops-command-hint]").hidden = true;
        renderTabs();
        renderList();
      });
    });
  }

  function renderList() {
    const listHost = document.querySelector("[data-ai-ops-case-list]");
    const countEl = document.querySelector("[data-ai-ops-list-count]");
    if (!listHost) return;

    const rows = Store.listCases(buildFilter());
    if (countEl) countEl.textContent = `(${rows.length})`;

    if (!rows.length) {
      listHost.innerHTML = `<p class="ai-ops-hint" style="padding:1rem">該当案件がありません</p>`;
      return;
    }

    listHost.innerHTML = rows
      .map(
        (c) =>
          `<button type="button" class="ai-ops-case-btn${c.id === selectedId ? " is-selected" : ""}" data-ai-ops-case-id="${esc(c.id)}">` +
          `<div class="ai-ops-case-btn__title">${esc(c.title)}</div>` +
          `<div class="ai-ops-case-btn__meta">${riskTag(c.ai_risk)}<span>${esc(c.ops_category)}</span> · <span>${esc(c.status)}</span></div>` +
          `</button>`
      )
      .join("");

    listHost.querySelectorAll("[data-ai-ops-case-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedId = btn.getAttribute("data-ai-ops-case-id");
        renderList();
        renderDetail();
      });
    });
  }

  function renderDetail() {
    const host = document.querySelector("[data-ai-ops-case-detail]");
    const actions = document.querySelector("[data-ai-ops-actions]");
    if (!host) return;

    if (!selectedId) {
      host.innerHTML = `<p class="ai-ops-hint">案件を選択してください</p>`;
      if (actions) actions.hidden = true;
      return;
    }

    const c = Store.getCase(selectedId);
    if (!c) {
      host.innerHTML = `<p class="ai-ops-hint">案件が見つかりません</p>`;
      return;
    }

    if (actions) actions.hidden = c.status === "resolved";

    host.innerHTML =
      `<section><h3>本文</h3><pre class="ai-ops-pre">${esc(c.body)}</pre></section>` +
      `<section><h3>AI要約</h3><pre class="ai-ops-pre">${esc(c.ai_summary)}</pre></section>` +
      `<section><h3>推定カテゴリ / リスク / ステータス</h3><p>${esc(c.ai_category || c.ops_category)} · ${riskTag(c.ai_risk)} · ${esc(c.status)}</p></section>` +
      `<section><h3>AI推奨対応</h3><pre class="ai-ops-pre">${esc(c.ai_recommended_action)}</pre></section>` +
      `<section><h3>AI返信案</h3><pre class="ai-ops-pre">${esc(c.ai_reply_draft)}</pre></section>` +
      `<section><h3>関連</h3><p>案件: ${esc(c.related_project_id || "—")} / 注文: ${esc(c.related_order_id || "—")} / チケット: ${esc(c.support_ticket_id || "—")}</p></section>` +
      `<section><h3>管理者メモ</h3><pre class="ai-ops-pre">${esc(c.admin_note || "—")}</pre></section>`;
    window.TasuStripeConnectTroubleUi?.appendStripePanelToHost?.(host, c);
  }

  function updateNotify() {
    const n = Notify?.getUnreadCount?.() ?? 0;
    const bar = document.querySelector("[data-ai-ops-notify-bar]");
    const cnt = document.querySelector("[data-ai-ops-notify-count]");
    if (bar) bar.hidden = n === 0;
    if (cnt) cnt.textContent = String(n);
  }

  function openModal(action) {
    pendingAction = action;
    const modal = document.querySelector("[data-ai-ops-modal]");
    const title = document.querySelector("[data-ai-ops-modal-title]");
    const text = document.querySelector("[data-ai-ops-modal-text]");
    if (title) title.textContent = "操作の確認";
    if (text) {
      text.textContent = `${ACTION_LABELS[action] || action} を記録します。返金・BAN・出金停止・掲載停止・Stripe操作は実行しません。`;
    }
    document.querySelector("[data-ai-ops-modal-note]").value = "";
    if (modal) modal.hidden = false;
  }

  function closeModal() {
    pendingAction = null;
    const modal = document.querySelector("[data-ai-ops-modal]");
    if (modal) modal.hidden = true;
  }

  function bind() {
    document.querySelector("[data-ai-ops-command-run]")?.addEventListener("click", () => {
      const raw = document.querySelector("[data-ai-ops-command-input]")?.value || "";
      const parsed = Command?.parseOpsCommand(raw);
      const hint = document.querySelector("[data-ai-ops-command-hint]");
      if (!parsed?.ok) {
        if (hint) {
          hint.hidden = false;
          hint.textContent = parsed?.error || "解析失敗";
          hint.classList.remove("is-ok");
        }
        return;
      }
      commandFilter = parsed.filter;
      if (parsed.filter.tab) currentTab = parsed.filter.tab;
      if (hint) {
        hint.hidden = false;
        hint.textContent = `コマンド適用: ${parsed.label}`;
        hint.classList.add("is-ok");
      }
      renderTabs();
      renderList();
    });

    document.querySelector("[data-ai-ops-command-clear]")?.addEventListener("click", () => {
      commandFilter = null;
      document.querySelector("[data-ai-ops-command-input]").value = "";
      document.querySelector("[data-ai-ops-command-hint]").hidden = true;
      renderList();
    });

    document.querySelectorAll("[data-ai-ops-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-ai-ops-action");
        if (!selectedId || !action) return;
        openModal(action);
      });
    });

    document.querySelectorAll("[data-ai-ops-modal-cancel]").forEach((el) => {
      el.addEventListener("click", closeModal);
    });

    document.querySelector("[data-ai-ops-modal-confirm]")?.addEventListener("click", () => {
      if (!selectedId || !pendingAction) return;
      const note = document.querySelector("[data-ai-ops-modal-note]")?.value || "";
      Store.applyAdminAction(selectedId, pendingAction, note);
      closeModal();
      renderList();
      renderDetail();
      updateNotify();
    });

    window.addEventListener("tasu:ai-ops-cases-changed", () => {
      renderList();
      renderDetail();
      updateNotify();
    });
    window.addEventListener("tasu:ai-ops-notify", updateNotify);
    window.addEventListener("tasu:supabase-ops-read-hydrated", () => {
      renderList();
      renderDetail();
      updateNotify();
    });
  }

  function init() {
    Store.syncFromSupportTickets();
    renderTabs();
    renderList();
    updateNotify();
    bind();

    const params = new URLSearchParams(location.search);
    if (params.get("case")) {
      selectedId = params.get("case");
      renderDetail();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
