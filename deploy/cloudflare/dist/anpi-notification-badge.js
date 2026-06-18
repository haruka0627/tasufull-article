/**
 * 安否通知バッジ — TASFUL内未読/緊急サマリー
 */
(function (global) {
  "use strict";

  function getContractHolderId() {
    const ctx = global.TasuAnpiUserContext?.getAnpiUserContext?.();
    return String(ctx?.contract_holder_id || "").trim();
  }

  function getSummaryOptions() {
    const holderId = getContractHolderId();
    return holderId ? { contractHolderId: holderId } : {};
  }

  /**
   * @returns {{
   *   registered: boolean,
   *   unread_count: number,
   *   urgent_count: number,
   *   unread_urgent_count: number,
   *   latest_urgent_at: string,
   *   total_count: number
   * }}
   */
  function getAnpiBadgeState() {
    const empty = {
      registered: false,
      unread_count: 0,
      urgent_count: 0,
      unread_urgent_count: 0,
      latest_urgent_at: "",
      total_count: 0,
    };

    if (global.TasuAnpiUserContext?.isAnpiUser?.() !== true) {
      return empty;
    }

    const summary =
      global.TasuAnpiNotifications?.getNotificationSummary?.(getSummaryOptions()) || empty;

    return {
      registered: true,
      unread_count: Number(summary.unread) || 0,
      urgent_count: Number(summary.urgent) || 0,
      unread_urgent_count: Number(summary.unread_urgent) || 0,
      latest_urgent_at: String(summary.latest_urgent_at || ""),
      total_count: Number(summary.total) || 0,
    };
  }

  function shouldShowBadges(state) {
    if (!state?.registered) return false;
    return state.unread_count > 0 || state.urgent_count > 0;
  }

  function shouldShowUrgentAlert(state) {
    if (!state?.registered) return false;
    return state.unread_urgent_count > 0 || (state.urgent_count > 0 && state.unread_count > 0);
  }

  /**
   * @param {{ unread_count?: number, urgent_count?: number, unread_urgent_count?: number }} state
   */
  function renderBadgeHtml(state, { forNav = false, prioritySingle = false } = {}) {
    if (!shouldShowBadges(state)) return "";

    const urgentN =
      state.unread_urgent_count > 0 ? state.unread_urgent_count : state.urgent_count;

    if (prioritySingle) {
      if (urgentN > 0) {
        return `<span class="anpi-badge-wrap${forNav ? " anpi-badge-wrap--nav" : ""}"><span class="anpi-badge anpi-badge--urgent${forNav ? " anpi-badge--nav" : ""}">緊急 ${urgentN > 99 ? "99+" : urgentN}</span></span>`;
      }
      if (state.unread_count > 0) {
        return `<span class="anpi-badge-wrap${forNav ? " anpi-badge-wrap--nav" : ""}"><span class="anpi-badge anpi-badge--unread${forNav ? " anpi-badge--nav" : ""}">未読 ${state.unread_count > 99 ? "99+" : state.unread_count}</span></span>`;
      }
      return "";
    }

    const parts = [];
    if (urgentN > 0) {
      parts.push(
        `<span class="anpi-badge anpi-badge--urgent${forNav ? " anpi-badge--nav" : ""}">緊急 ${urgentN > 99 ? "99+" : urgentN}</span>`
      );
    }
    if (state.unread_count > 0) {
      parts.push(
        `<span class="anpi-badge anpi-badge--unread${forNav ? " anpi-badge--nav" : ""}">未読 ${state.unread_count > 99 ? "99+" : state.unread_count}</span>`
      );
    }

    return parts.length
      ? `<span class="anpi-badge-wrap${forNav ? " anpi-badge-wrap--nav" : ""}">${parts.join("")}</span>`
      : "";
  }

  function renderUrgentAlertHtml(state) {
    if (!shouldShowUrgentAlert(state)) return "";

    const urgentLabel =
      state.unread_urgent_count > 0 ? state.unread_urgent_count : state.urgent_count;

    return (
      `<section class="dash-anpi-urgent" data-dash-anpi-urgent role="alert">` +
      `<div class="dash-anpi-urgent__body">` +
      `<h2 class="dash-anpi-urgent__title">緊急の安否通知があります</h2>` +
      `<p class="dash-anpi-urgent__text">至急、安否通知センターを確認してください。</p>` +
      `<p class="dash-anpi-urgent__count">緊急通知 <strong>${urgentLabel}</strong> 件</p>` +
      `<a class="dash-anpi-urgent__cta" href="anpi-notifications.html">安否通知センターを開く</a>` +
      `</div>` +
      `</section>`
    );
  }

  function getLineFailureSummary() {
    const holderId =
      global.TasuAnpiUserContext?.getAnpiUserContext?.()?.contract_holder_id || "";
    const opts = holderId ? { contractHolderId: holderId } : {};
    return (
      global.TasuAnpiNotifications?.getLineSendFailureSummary?.(opts) || {
        failed_count: 0,
        latest_failed_at: "",
        latest_failed_logs: [],
        retryable_count: 0,
      }
    );
  }

  function renderLineFailureAlertHtml(summary) {
    if (!summary?.failed_count) return "";
    const n = summary.failed_count;
    return (
      `<section class="dash-anpi-line-fail" data-dash-anpi-line-fail role="alert">` +
      `<div class="dash-anpi-line-fail__body">` +
      `<h2 class="dash-anpi-line-fail__title">LINE通知の送信に失敗しています</h2>` +
      `<p class="dash-anpi-line-fail__text">TASFUL内通知は記録されています。LINE連携状態を確認してください。</p>` +
      `<p class="dash-anpi-line-fail__count">送信失敗 <strong>${n}</strong> 件</p>` +
      `<a class="dash-anpi-line-fail__cta" href="anpi-notifications.html">安否通知センターを開く</a>` +
      `</div>` +
      `</section>`
    );
  }

  global.TasuAnpiNotificationBadge = {
    getAnpiBadgeState,
    getLineFailureSummary,
    shouldShowBadges,
    shouldShowUrgentAlert,
    renderBadgeHtml,
    renderUrgentAlertHtml,
    renderLineFailureAlertHtml,
    getSummaryOptions,
  };
})(typeof window !== "undefined" ? window : globalThis);
