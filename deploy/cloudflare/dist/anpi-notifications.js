/**
 * 安否通知センター（契約者向け一覧・詳細・未読）
 */
(function () {
  "use strict";

  const STATUS_LABELS = window.TasuAnpiNotifications?.STATUS_LABELS || {};
  const EVENT_TYPE_LABELS = window.TasuAnpiNotifications?.EVENT_TYPE_LABELS || {};
  const LINE_STATUS_LABELS = window.TasuAnpiNotifications?.LINE_STATUS_LABELS || {
    pending: "TASFUL TALK未送信",
    sent: "TASFUL TALK送信済み",
    failed: "TASFUL TALK送信失敗",
  };

  /** @type {Set<string>} */
  const lineRetryInFlight = new Set();

  const PRIORITY_LABELS = {
    urgent: "緊急",
    high: "高",
    medium: "中",
    normal: "通常",
  };

  /** @type {string|null} */
  let expandedId = null;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDt(iso) {
    try {
      return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      }).format(new Date(iso));
    } catch {
      return String(iso || "");
    }
  }

  function getViewerOptions() {
    const holderId = window.TasuAnpiNotifications?.getContractHolderIdFromUrl?.() || "";
    return { contractHolderId: holderId };
  }

  function getLogs() {
    return window.TasuAnpiNotifications?.getLogsForContractHolder?.(getViewerOptions()) || [];
  }

  function renderSummary() {
    const summary = window.TasuAnpiNotifications?.getNotificationSummary?.(getViewerOptions()) || {
      total: 0,
      unread: 0,
      urgent: 0,
    };
    const unreadEl = document.querySelector("[data-anpi-summary-unread]");
    const totalEl = document.querySelector("[data-anpi-summary-total]");
    const urgentEl = document.querySelector("[data-anpi-summary-urgent]");
    if (unreadEl) unreadEl.textContent = `${summary.unread}件`;
    if (totalEl) totalEl.textContent = `${summary.total}件`;
    if (urgentEl) urgentEl.textContent = `${summary.urgent}件`;

    const filterNote = document.querySelector("[data-anpi-filter-note]");
    const holderId = getViewerOptions().contractHolderId;
    if (filterNote) {
      if (holderId) {
        filterNote.hidden = false;
        filterNote.textContent = `契約者IDでフィルタ中: ${holderId}`;
      } else {
        filterNote.hidden = true;
        filterNote.textContent = "";
      }
    }
  }

  function renderLineStatusBlock(log) {
    if (log.line_notification_enabled !== true) return "";
    if (!String(log.line_user_id || "").trim()) return "";

    const status = String(log.line_status || "pending");
    const label = LINE_STATUS_LABELS[status] || status;
    const mod =
      status === "sent"
        ? "sent"
        : status === "failed"
          ? "failed"
          : "pending";

    let extra = "";
    if (log.line_sent_at) {
      extra += `<span class="anpi-line-status__sent-at">送信 ${esc(formatDt(log.line_sent_at))}</span>`;
    }
    if (log.line_error_message && status === "failed") {
      const friendly =
        window.TasuAnpiNotifications?.formatUserFacingLineError?.(
          log.line_error_message,
          log.line_error_code
        ) || { message: log.line_error_message, code: "" };
      if (friendly.message) {
        extra += `<p class="anpi-line-status__error">${esc(friendly.message)}</p>`;
      }
    }

    return (
      `<div class="anpi-line-status anpi-line-status--${mod}" data-anpi-line-status>` +
      `<span class="anpi-line-status__badge">${esc(label)}</span>` +
      extra +
      `</div>`
    );
  }

  function canRetryLine(log) {
    return window.TasuAnpiNotifications?.canRetryLineNotification?.(log) === true;
  }

  function renderLineRetryButton(log) {
    if (!canRetryLine(log)) return "";
    const busy = lineRetryInFlight.has(log.id);
    return (
      `<div class="anpi-line-retry">` +
      `<button type="button" class="anpi-line-retry__btn" data-anpi-line-retry data-log-id="${esc(log.id)}"${
        busy ? " disabled" : ""
      }>${busy ? "再送中..." : "TASFUL TALK再送"}</button>` +
      `</div>`
    );
  }

  function renderActionLink(log) {
    const eventType = String(log?.event_type || "");
    if (eventType === "urgent_keyword_detected") {
      return (
        `<div class="anpi-notification-action">` +
        `<a class="anpi-notification-action__btn" href="anpi-dashboard.html#check">安否を確認する</a>` +
        `</div>`
      );
    }
    if (eventType === "line_oauth_unlinked") {
      return (
        `<div class="anpi-notification-action">` +
        `<a class="anpi-notification-action__btn" href="anpi-register.html">TASFUL TALKを再連携する</a>` +
        `</div>`
      );
    }
    return "";
  }

  function renderCardHtml(log, { inUrgentZone = false } = {}) {
    const isUrgent = window.TasuAnpiNotifications?.isUrgentLog?.(log);
    const typeLabel = EVENT_TYPE_LABELS[log.event_type] || log.event_type;
    const statusLabel = STATUS_LABELS[log.status] || log.status;
    const priorityLabel = PRIORITY_LABELS[log.priority] || log.priority;
    const isExpanded = expandedId === log.id;
    const unreadClass = log.is_read ? "" : " anpi-notification-card--unread";
    const urgentClass = isUrgent ? " anpi-notification-card--urgent" : "";
    const lineStatusHtml = renderLineStatusBlock(log);

    const category =
      log.item_category ||
      (log.source_type ? String(log.source_type) : "—");

    return (
      `<li class="anpi-notification-card${urgentClass}${unreadClass}" data-anpi-card data-log-id="${esc(log.id)}">` +
      `<button type="button" class="anpi-notification-card__toggle" data-anpi-toggle aria-expanded="${isExpanded ? "true" : "false"}">` +
      `<div class="anpi-notification-card__head">` +
      `<h3 class="anpi-notification-title">${esc(log.title)}</h3>` +
      `<p class="anpi-notification-meta">` +
      `<time datetime="${esc(log.created_at)}">${esc(formatDt(log.created_at))}</time>` +
      `<span class="anpi-notification-meta__type">${esc(typeLabel)}</span>` +
      `<span class="anpi-notification-meta__priority${isUrgent ? " anpi-notification-meta__priority--urgent" : ""}">重要度: ${esc(priorityLabel)}</span>` +
      `<span class="anpi-notification-status">${esc(statusLabel)}</span>` +
      (log.is_read ? "" : `<span class="anpi-notification-status">未読</span>`) +
      `</p>` +
      (lineStatusHtml ? lineStatusHtml : "") +
      `</div>` +
      `</button>` +
      `<div class="anpi-notification-card__detail" data-anpi-detail ${isExpanded ? "" : "hidden"}>` +
      `<pre class="anpi-notification-detail__body">${esc(log.message)}</pre>` +
      `<dl class="anpi-notification-detail__dl">` +
      `<dt>利用者名</dt><dd>${esc(log.user_name || "—")}</dd>` +
      `<dt>契約者名</dt><dd>${esc(log.contract_holder_name || "—")}（${esc(log.contract_holder_relation || "—")}）</dd>` +
      `<dt>カテゴリ</dt><dd>${esc(category)}</dd>` +
      `<dt>作成日時</dt><dd>${esc(formatDt(log.created_at))}</dd>` +
      `<dt>状態</dt><dd>${esc(statusLabel)}${log.is_read ? " · 既読" : " · 未読"}</dd>` +
      (log.phone_masked
        ? `<dt>電話（マスク）</dt><dd>${esc(log.phone_masked)}</dd>`
        : "") +
      `</dl>` +
      renderActionLink(log) +
      renderLineRetryButton(log) +
      `</div>` +
      `</li>`
    );
  }

  function renderUrgent(logs) {
    const zone = document.querySelector("[data-anpi-urgent-zone]");
    const list = document.querySelector("[data-anpi-urgent-list]");
    const urgentLogs = logs.filter((l) => window.TasuAnpiNotifications?.isUrgentLog?.(l));
    if (!zone || !list) return;
    if (!urgentLogs.length) {
      zone.hidden = true;
      list.innerHTML = "";
      return;
    }
    zone.hidden = false;
    list.innerHTML = urgentLogs.map((log) => renderCardHtml(log, { inUrgentZone: true })).join("");
  }

  function renderList() {
    const logs = getLogs();
    const listEl = document.querySelector("[data-anpi-notification-list]");
    const emptyEl = document.querySelector("[data-anpi-empty]");
    if (!listEl || !emptyEl) return;

    renderSummary();
    renderUrgent(logs);

    if (!logs.length) {
      emptyEl.hidden = false;
      listEl.innerHTML = "";
      return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = logs.map((log) => renderCardHtml(log)).join("");
  }

  async function onLineRetryClick(e) {
    const btn = e.target.closest("[data-anpi-line-retry]");
    if (!btn || btn.disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const id = btn.getAttribute("data-log-id");
    if (!id || lineRetryInFlight.has(id)) return;

    lineRetryInFlight.add(id);
    renderList();

    try {
      await window.TasuAnpiNotifications?.sendLineNotificationForLog?.(id);
    } finally {
      lineRetryInFlight.delete(id);
      renderList();
    }
  }

  function onToggleClick(e) {
    const btn = e.target.closest("[data-anpi-toggle]");
    if (!btn) return;
    const card = btn.closest("[data-anpi-card]");
    const id = card?.getAttribute("data-log-id");
    if (!id) return;

    if (expandedId === id) {
      expandedId = null;
    } else {
      expandedId = id;
      window.TasuAnpiNotifications?.markNotificationRead?.(id);
    }
    renderList();
  }

  function bindMenu() {
    const sidebar = document.getElementById("dashSidebar");
    const overlay = document.querySelector("[data-dash-overlay]");
    const menuBtn = document.querySelector("[data-dash-menu]");
    const close = () => {
      sidebar?.classList.remove("is-open");
      overlay?.setAttribute("aria-hidden", "true");
    };
    menuBtn?.addEventListener("click", () => {
      sidebar?.classList.toggle("is-open");
      overlay?.setAttribute(
        "aria-hidden",
        sidebar?.classList.contains("is-open") ? "false" : "true"
      );
    });
    overlay?.addEventListener("click", close);
  }

  function markAllReadOnOpen() {
    const opts = getViewerOptions();
    window.TasuAnpiNotifications?.markAllNotificationsReadForContractHolder?.(opts);
  }

  function init() {
    const root = document.querySelector("[data-anpi-notifications-root]");
    if (!root || root.dataset.anpiPageBound === "1") return;
    root.dataset.anpiPageBound = "1";

    bindMenu();
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-anpi-line-retry]")) {
        void onLineRetryClick(e);
        return;
      }
      onToggleClick(e);
    });
    document.querySelector("[data-anpi-refresh]")?.addEventListener("click", renderList);
    const refreshEvents = [
      "tasu:anpi-notification-log-created",
      "tasu:anpi-notification-read",
      "tasu:anpi-notification-bulk-read",
      "tasful:anpi-notification-created",
      "tasful:anpi-notification-updated",
      "tasu:anpi-notification-line-sent",
      "tasful:anpi-notification-line-sent",
      "tasu:anpi-line-send-failed",
      "tasful:anpi-line-send-failed",
      "tasu:anpi-line-send-retried",
      "tasful:anpi-line-send-retried",
    ];
    refreshEvents.forEach((name) => {
      document.addEventListener(name, renderList);
      window.addEventListener(name, renderList);
    });
    ["tasu:anpi-notification-logs-restored", "tasful:anpi-notification-logs-restored"].forEach(
      (name) => {
        document.addEventListener(name, renderList);
        window.addEventListener(name, renderList);
      }
    );

    renderList();
    void window.TasuAnpiNotifications?.initAnpiNotificationLogs?.().then(() => {
      renderList();
      markAllReadOnOpen();
      renderList();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.TasuAnpiNotificationsPage = {
    renderList,
    getViewerOptions,
  };
})();
