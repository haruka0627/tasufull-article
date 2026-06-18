/**
 * 安否通知ログ — 開発用パネル（将来はマイページ通知へ移行）
 */
(function (global) {
  "use strict";

  const EVENT_TYPE_LABELS =
    global.TasuAnpiNotifications?.EVENT_TYPE_LABELS || {};

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
        second: "2-digit",
        timeZone: "Asia/Tokyo",
      }).format(new Date(iso));
    } catch {
      return String(iso || "");
    }
  }

  function renderLogs(container) {
    if (!container) return;
    const logs = global.TasuAnpiNotifications?.getRawLogsFromStorage?.() || [];
    const summary = global.TasuAnpiNotifications?.getNotificationSummary?.() || {
      total: 0,
      unread: 0,
      urgent: 0,
    };

    if (!logs.length) {
      container.innerHTML =
        '<p class="ai-anpi-panel__empty">通知ログはまだありません。</p>' +
        '<p class="ai-anpi-panel__empty"><a href="anpi-notifications.html">安否通知センター</a>で契約者向け一覧を開けます。</p>';
      return;
    }

    let html =
      `<p class="ai-anpi-panel__summary">未読 ${summary.unread} / 全 ${summary.total}（緊急 ${summary.urgent}） · ` +
      `<a href="anpi-notifications.html">安否通知センター →</a></p>`;
    html += '<ul class="ai-anpi-panel__list">';
    logs.slice(0, 8).forEach((log) => {
      const typeLabel = EVENT_TYPE_LABELS[log.event_type] || log.event_type;
      html += `<li class="ai-anpi-panel__item">`;
      html += `<p class="ai-anpi-panel__meta"><time>${esc(formatDt(log.created_at))}</time>`;
      html += ` · <span class="ai-anpi-panel__type">${esc(typeLabel)}</span>`;
      html += ` · <span class="ai-anpi-panel__status">${esc(log.status)}</span>`;
      if (!log.is_read) html += ` · <span class="ai-anpi-panel__unread">未読</span>`;
      html += `</p>`;
      html += `<p class="ai-anpi-panel__title">${esc(log.title)}</p>`;
      html += `<pre class="ai-anpi-panel__message">${esc(log.message)}</pre>`;
      html += `</li>`;
    });
    html += "</ul>";
    container.innerHTML = html;
  }

  function init() {
    const root = global.document.querySelector("[data-anpi-notification-dev]");
    if (!root || root.dataset.anpiPanelBound === "1") return;
    root.dataset.anpiPanelBound = "1";

    const toggle = root.querySelector("[data-anpi-notification-toggle]");
    const panel = root.querySelector("[data-anpi-notification-panel]");
    const listHost = root.querySelector("[data-anpi-notification-list]");
    const refreshBtn = root.querySelector("[data-anpi-notification-refresh]");

    toggle?.addEventListener("click", () => {
      if (!panel) return;
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) renderLogs(listHost);
    });

    refreshBtn?.addEventListener("click", () => renderLogs(listHost));

    global.document.addEventListener("tasu:anpi-notification-log-created", () => {
      if (panel && !panel.hidden) renderLogs(listHost);
    });
  }

  global.TasuAnpiNotificationPanel = {
    init,
    renderLogs,
    EVENT_TYPE_LABELS,
  };

  if (global.document) {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
