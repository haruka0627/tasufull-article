/**
 * トラブルセンター UI（管理者）
 */
(function () {
  "use strict";

  const Store = window.TasuSupportTicketStore;
  const Service = window.TasuSupportTicketService;
  const Notify = window.TasuSupportAdminNotify;
  const CATEGORIES = window.TasuSupportClassifier?.CATEGORIES || {};

  const root = document.querySelector("[data-support-trouble-root]");
  if (!root) return;

  let currentFilter = "all";
  let selectedId = null;
  let pendingAction = null;

  const els = {
    list: root.querySelector("[data-support-ticket-list]"),
    detail: root.querySelector("[data-support-ticket-detail]"),
    actions: root.querySelector("[data-support-admin-actions]"),
    notifyBar: root.querySelector("[data-support-notify-bar]"),
    notifyCount: root.querySelector("[data-support-notify-count]"),
    alertBadge: root.querySelector("[data-support-alert-badge]"),
    modal: document.querySelector("[data-support-confirm-modal]"),
    confirmMsg: document.querySelector("[data-support-confirm-message]"),
    confirmNote: document.querySelector("[data-support-confirm-note]"),
  };

  const ACTION_LABELS = {
    send_reply: "返信を送信（管理者確認済み・操作予定）",
    refund: "返金対応へ進む（API未実行・操作予定）",
    connect_verified: "出金/Connect確認済みにする（操作予定）",
    cancel_project: "案件キャンセル（操作予定）",
    account_restrict: "アカウント制限（操作予定）",
    ban_candidate: "BAN候補にする（操作予定）",
    resolved: "解決済みにする",
  };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function severityClass(sev) {
    return `support-trouble-tag support-trouble-tag--${esc(sev || "low")}`;
  }

  const CATEGORY_LABELS = {
    connect_issue: "Connect問題",
    admin_review: "要確認",
    legal_or_risk: "法的リスク",
    abuse_or_policy: "違反・通報",
    general_auto_reply: "一般",
  };

  function resolveTicketOrigin(ticket) {
    const src = String(ticket?.source || "").toLowerCase();
    if (/builder/.test(src)) return "Builder";
    if (/market|shop/.test(src)) return "市場";
    if (/talk/.test(src)) return "TALK";
    if (src === "stripe_webhook") return "Connect";
    if (ticket?.related_project_id) return "Builder";
    if (ticket?.related_order_id) return "市場";
    if (ticket?.related_stripe_account_id) return "Connect";
    return "共通";
  }

  function resolveTicketCategoryLabel(ticket) {
    const cat = ticket?.category;
    if (!cat) return "未分類";
    return CATEGORY_LABELS[cat] || "未分類";
  }

  function resolveTicketTarget(ticket) {
    const parts = [];
    if (ticket?.related_project_id) parts.push(`案件 ${ticket.related_project_id}`);
    if (ticket?.related_order_id) parts.push(`注文 ${ticket.related_order_id}`);
    const uid = ticket?.user_id;
    if (uid && uid !== "guest" && uid !== "system") parts.push(`ユーザー ${uid}`);
    if (ticket?.related_stripe_account_id) {
      parts.push(`Stripe ${ticket.related_stripe_account_id}`);
    }
    return parts.length ? parts.join(" / ") : null;
  }

  function buildOriginContext(ticket) {
    const target = resolveTicketTarget(ticket);
    const hasCategory = Boolean(ticket?.category && CATEGORY_LABELS[ticket.category]);
    return {
      origin: target || hasCategory ? resolveTicketOrigin(ticket) : "共通",
      category: hasCategory ? resolveTicketCategoryLabel(ticket) : "未分類",
      target,
    };
  }

  function renderOriginBlock(ctx, compact) {
    const cls = compact
      ? "support-trouble-origin support-trouble-origin--compact"
      : "support-trouble-origin";
    let html =
      `<div class="${cls}">` +
      `<p class="support-trouble-origin__line"><span class="support-trouble-origin__label">発生元:</span> ${esc(ctx.origin)}</p>` +
      `<p class="support-trouble-origin__line"><span class="support-trouble-origin__label">カテゴリ:</span> ${esc(ctx.category)}</p>`;
    if (ctx.target) {
      html += `<p class="support-trouble-origin__line"><span class="support-trouble-origin__label">対象:</span> ${esc(ctx.target)}</p>`;
    }
    html += `</div>`;
    return html;
  }

  function filterTickets(list) {
    switch (currentFilter) {
      case "open":
        return list.filter((t) => t.status === "open");
      case "ai_replied":
        return list.filter((t) => t.status === "ai_replied");
      case "needs_review":
        return list.filter((t) => t.status === "needs_review" || t.status === "in_progress");
      case "connect":
        return list.filter((t) => t.category === "connect_issue");
      case "risk":
        return list.filter(
          (t) =>
            t.category === "legal_or_risk" ||
            t.category === "abuse_or_policy" ||
            t.severity === "high" ||
            t.severity === "critical"
        );
      case "report":
        return list.filter(
          (t) =>
            t.status !== "resolved" &&
            (t.category === "abuse_or_policy" ||
              /通報/.test(String(t.title + t.body)))
        );
      case "resolved":
        return list.filter((t) => t.status === "resolved");
      default:
        return list;
    }
  }

  function updateCounts(all) {
    const counts = {
      all: all.length,
      open: all.filter((t) => t.status === "open").length,
      ai_replied: all.filter((t) => t.status === "ai_replied").length,
      needs_review: all.filter((t) => t.status === "needs_review" || t.status === "in_progress").length,
      connect: all.filter((t) => t.category === "connect_issue").length,
      risk: all.filter(
        (t) =>
          t.category === "legal_or_risk" ||
          t.category === "abuse_or_policy" ||
          t.severity === "high" ||
          t.severity === "critical"
      ).length,
      report: all.filter(
        (t) =>
          t.status !== "resolved" &&
          (t.category === "abuse_or_policy" || /通報/.test(String(t.title + t.body)))
      ).length,
      resolved: all.filter((t) => t.status === "resolved").length,
    };
    Object.keys(counts).forEach((key) => {
      const el = root.querySelector(`[data-support-count="${key}"]`);
      if (el) el.textContent = String(counts[key]);
    });

    const needs = all.filter(
      (t) => t.status === "needs_review" || t.status === "open" || t.severity === "critical"
    ).length;
    if (els.alertBadge) els.alertBadge.hidden = needs === 0;
  }

  function renderList() {
    const all = Store.listTickets();
    updateCounts(all);
    const filtered = filterTickets(all);

    if (!filtered.length) {
      els.list.innerHTML = '<p class="support-trouble-empty">該当チケットがありません</p>';
      return;
    }

    els.list.innerHTML = filtered
      .map((t) => {
        const ctx = buildOriginContext(t);
        return (
          `<button type="button" class="support-trouble-ticket-row${t.id === selectedId ? " is-selected" : ""}" data-support-ticket-id="${esc(t.id)}">` +
          `<div class="support-trouble-ticket-row__title">${esc(t.title)}</div>` +
          renderOriginBlock(ctx, true) +
          `<div class="support-trouble-ticket-row__meta">` +
          `<span class="${severityClass(t.severity)}">${esc(t.severity)}</span>` +
          `<span>${esc(t.status)}</span>` +
          `</div></button>`
        );
      })
      .join("");

    els.list.querySelectorAll("[data-support-ticket-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedId = btn.getAttribute("data-support-ticket-id");
        renderList();
        renderDetail();
      });
    });
  }

  function renderDetail() {
    if (!selectedId) {
      els.detail.innerHTML =
        '<p class="support-trouble-empty">左の一覧からチケットを選択してください</p>';
      els.actions.hidden = true;
      return;
    }

    const t = Store.getTicket(selectedId);
    if (!t) {
      els.detail.innerHTML = '<p class="support-trouble-empty">チケットが見つかりません</p>';
      els.actions.hidden = true;
      return;
    }

    const events = Store.listEvents(selectedId).slice(0, 8);
    els.actions.hidden = t.status === "resolved";
    const originCtx = buildOriginContext(t);

    els.detail.innerHTML =
      `<div class="support-trouble-detail__section support-trouble-detail__section--origin"><h3>発生元・分類</h3>${renderOriginBlock(originCtx, false)}</div>` +
      `<div class="support-trouble-detail__section"><h3>問い合わせ本文</h3><pre class="support-trouble-detail__pre">${esc(t.body)}</pre></div>` +
      `<div class="support-trouble-detail__section"><h3>重要度 / ステータス</h3><p><span class="${severityClass(t.severity)}">${esc(t.severity)}</span> / ${esc(t.status)}</p></div>` +
      `<div class="support-trouble-detail__section"><h3>AI要約</h3><pre class="support-trouble-detail__pre">${esc(t.ai_summary)}</pre></div>` +
      `<div class="support-trouble-detail__section"><h3>AI推奨対応</h3><pre class="support-trouble-detail__pre">${esc(t.ai_recommended_action)}</pre></div>` +
      `<div class="support-trouble-detail__section"><h3>AI返信文案</h3><pre class="support-trouble-detail__pre">${esc(t.ai_suggested_reply || "（未送信・管理者対応）")}</pre></div>` +
      `<div class="support-trouble-detail__section"><h3>関連</h3><p>案件: ${esc(t.related_project_id || "—")} / 注文: ${esc(t.related_order_id || "—")} / Stripe: ${esc(t.related_stripe_account_id || "—")}</p></div>` +
      `<div class="support-trouble-detail__section"><h3>管理者メモ</h3><pre class="support-trouble-detail__pre">${esc(t.admin_note || "—")}</pre></div>` +
      `<div class="support-trouble-detail__section"><h3>イベント</h3><pre class="support-trouble-detail__pre">${esc(
        events.map((e) => `${e.created_at} ${e.event_type}: ${e.payload_summary}`).join("\n") || "—"
      )}</pre></div>`;
    window.TasuStripeConnectTroubleUi?.appendStripePanelToHost?.(els.detail, t);
  }

  function updateNotifyUi() {
    const n = Notify?.getUnreadNotificationCount?.() ?? 0;
    if (els.notifyBar) els.notifyBar.hidden = n === 0;
    if (els.notifyCount) els.notifyCount.textContent = String(n);
  }

  function openConfirm(action) {
    pendingAction = action;
    if (els.confirmMsg) {
      els.confirmMsg.textContent =
        (ACTION_LABELS[action] || action) +
        " を記録します。Stripe返金・出金・BANのAPI実行は行いません。";
    }
    if (els.confirmNote) els.confirmNote.value = "";
    if (els.modal) els.modal.hidden = false;
  }

  function closeConfirm() {
    pendingAction = null;
    if (els.modal) els.modal.hidden = true;
  }

  root.querySelectorAll("[data-support-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.getAttribute("data-support-filter") || "all";
      root.querySelectorAll("[data-support-filter]").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderList();
    });
  });

  els.actions?.querySelectorAll("[data-support-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-support-action");
      if (!selectedId || !action) return;
      openConfirm(action);
    });
  });

  document.querySelectorAll("[data-support-modal-cancel]").forEach((el) => {
    el.addEventListener("click", closeConfirm);
  });

  document.querySelector("[data-support-modal-confirm]")?.addEventListener("click", () => {
    if (!selectedId || !pendingAction) return;
    const note = els.confirmNote?.value || "";
    Service.applyAdminAction(selectedId, pendingAction, note);
    closeConfirm();
    renderList();
    renderDetail();
    updateNotifyUi();
  });

  window.addEventListener("tasu:support-tickets-updated", () => {
    renderList();
    renderDetail();
    updateNotifyUi();
  });
  window.addEventListener("tasu:support-admin-notify", updateNotifyUi);
  window.addEventListener("tasu:supabase-ops-read-hydrated", () => {
    renderList();
    renderDetail();
    updateNotifyUi();
  });

  const params = new URLSearchParams(location.search);
  const preselect = params.get("ticket");
  const urlFilter = params.get("filter");
  if (preselect) selectedId = preselect;
  if (urlFilter && ["all", "open", "ai_replied", "needs_review", "connect", "risk", "report", "resolved"].includes(urlFilter)) {
    currentFilter = urlFilter;
    root.querySelectorAll("[data-support-filter]").forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-support-filter") === urlFilter);
    });
  }

  renderList();
  renderDetail();
  updateNotifyUi();
})();
