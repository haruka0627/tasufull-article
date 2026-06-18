/**
 * 安否ダッシュボード（契約者向けサマリー）
 */
(function () {
  "use strict";

  const LEVEL_LABELS = {
    call_only: "電話操作・緊急時のみ",
    important_only: "電話・緊急・重要操作",
    all_ai_actions: "AI相談を含むすべて",
  };

  const CHANNEL_LABELS = {
    tasful_chat: "TASFUL内通知",
    line: "TASFUL TALK",
    email: "メール",
  };

  const CALL_EVENT_TYPES = new Set([
    "call_consent_opened",
    "call_consent_accepted",
    "call_consent_cancelled",
  ]);

  /** UI確認用デモ統計（未登録時のみ・保存しない） */
  const DEMO_STAT_VALUES = {
    users: "1,248名",
    holders: "12社",
    total: "28件",
    unread: "7件",
  };

  /** UI確認用デモ（実ログ0件時のみ表示） */
  const DEMO_RECENT_ITEMS = [
    {
      title: "定期安否確認（訓練）",
      message: "定期的な安否確認の訓練を実施しました。",
      status: "全員回答済み",
      statusMod: "success",
      icon: "check",
      datetime: "2024/05/20 10:30",
    },
    {
      title: "システムメンテナンスのお知らせ",
      message: "システムメンテナンスのため、一部機能が制限されます。",
      status: "既読",
      statusMod: "read",
      icon: "info",
      datetime: "2024/05/19 15:00",
    },
    {
      title: "台風接近に伴う注意喚起",
      message: "台風の接近が予想されます。安全確保をお願いします。",
      status: "未読 7名",
      statusMod: "unread",
      icon: "alert",
      datetime: "2024/05/18 09:00",
    },
    {
      title: "避難訓練の実施について",
      message: "来週の避難訓練についてお知らせします。",
      status: "全員回答済み",
      statusMod: "success",
      icon: "check",
      datetime: "2024/05/17 14:20",
    },
    {
      title: "安否確認リマインダー",
      message: "本日分の安否確認が未回答の利用者がいます。",
      status: "未読 2名",
      statusMod: "unread",
      icon: "bell",
      datetime: "2024/05/16 18:45",
    },
    {
      title: "利用者情報の更新",
      message: "登録情報の定期更新が完了しました。",
      status: "既読",
      statusMod: "read",
      icon: "info",
      datetime: "2024/05/15 11:10",
    },
    {
      title: "大雨注意報に伴う安否確認",
      message: "大雨注意報が発表されました。安否状況をご確認ください。",
      status: "未読 4名",
      statusMod: "unread",
      icon: "alert",
      datetime: "2024/05/14 07:30",
    },
  ];

  const MOBILE_RECENT_LIMIT = 5;
  const MOBILE_RECENT_DEMO_LIMIT = 5;

  const MOBILE_DETAIL_SUMMARY_DEMO = {
    registration: "登録済み（デモ）",
    lastActivity: "2024/05/20 10:30",
    familyCount: "3名",
    notificationSetting: "電話操作・緊急時のみ",
  };

  const RECENT_ICON_SVG = {
    check:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m22 4-10 11-3-3"/></svg>',
    info:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    alert:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>',
    bell:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  };

  /** @type {object|null} */
  let dashboardContext = null;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function resolveDashboardContext() {
    const api = window.TasuAnpiUserContext;
    if (!api) return null;
    await api.initAnpiUserContext?.();
    const primary = await api.getPrimaryAnpiUserContext?.();
    dashboardContext = primary || api.getAnpiUserContext?.() || null;
    return dashboardContext;
  }

  function getDashboardContext() {
    return dashboardContext || window.TasuAnpiUserContext?.getAnpiUserContext?.() || null;
  }

  function getViewerOptions() {
    const ctx = getDashboardContext();
    const holderId = ctx?.contract_holder_id || "";
    const memberId = ctx?.member_id || "";
    const opts = {};
    if (holderId) opts.contractHolderId = holderId;
    if (memberId) opts.memberId = memberId;
    return opts;
  }

  function getLogs() {
    return window.TasuAnpiNotifications?.getLogsForContractHolder?.(getViewerOptions()) || [];
  }

  function parseTime(iso) {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : NaN;
  }

  function computeLastActivityAt(ctx, logs) {
    const stamps = [];

    if (ctx?.updated_at) stamps.push(ctx.updated_at);
    if (ctx?.created_at) stamps.push(ctx.created_at);

    for (const log of logs) {
      if (!log?.created_at) continue;
      stamps.push(log.created_at);
      if (log.event_type === "ai_search") stamps.push(log.created_at);
      if (CALL_EVENT_TYPES.has(log.event_type)) stamps.push(log.created_at);
      if (log.event_type === "urgent_keyword_detected") stamps.push(log.created_at);
    }

    let best = "";
    let bestT = -Infinity;
    for (const iso of stamps) {
      const t = parseTime(iso);
      if (!Number.isFinite(t) || t <= bestT) continue;
      bestT = t;
      best = iso;
    }
    return best;
  }

  function formatLastActivity(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";

    const tz = "Asia/Tokyo";
    const now = new Date();
    const fmtDate = (date) =>
      new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: tz,
      }).format(date);

    const fmtTime = (date) =>
      new Intl.DateTimeFormat("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: tz,
      }).format(date);

    const today = fmtDate(now);
    const target = fmtDate(d);
    const time = fmtTime(d);

    if (target === today) return `今日 ${time}`;

    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    if (target === fmtDate(yesterdayDate)) return `昨日 ${time}`;

    const ymd = new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: tz,
    })
      .format(d)
      .replace(/\//g, "/");
    return `${ymd} ${time}`;
  }

  function formatChannels(channels) {
    const list = Array.isArray(channels) ? channels : [];
    if (!list.length) return "—";
    return list.map((c) => CHANNEL_LABELS[c] || c).join("・");
  }

  function formatRowDateTime(iso) {
    try {
      return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      })
        .format(new Date(iso))
        .replace(/\//g, "/");
    } catch {
      return String(iso || "");
    }
  }

  function setAll(sel, text) {
    document.querySelectorAll(sel).forEach((el) => {
      el.textContent = text;
    });
  }

  function setSummaryStat(field, text) {
    setAll(`[data-anpi-summary-${field}-main]`, text);
    setAll(`[data-anpi-summary-${field}-card]`, text);
  }

  function resolveProfileTypeLabel(profile) {
    const last = window.TasuMemberAuth?.readLastProfile?.();
    const fromProfile = String(profile?.accountType || profile?.account_type || "").trim();
    if (fromProfile) return fromProfile;
    const fromLast = String(last?.accountType || "").trim();
    if (fromLast) return fromLast;
    const memberType = last?.memberType || last?.member_type || "individual";
    if (memberType === "business") return "業者・法人";
    return "個人・事業者";
  }

  /** 会員ヘッダー — dashboard.html と同じ取得・表示 */
  async function syncDashProfileHeader() {
    let profile = {};
    try {
      if (window.TasuDashboardData?.loadDashboard) {
        const data = await window.TasuDashboardData.loadDashboard();
        profile = data?.profile || {};
      }
    } catch (err) {
      console.warn("[AnpiDashboard] profile load failed:", err);
    }

    const welcomeName =
      profile.welcomeName ||
      window.TasuDashboardData?.pickWelcomeName?.({
        nickname: profile.nickname,
        display_name: profile.display_name || profile.displayName,
        name: profile.name,
      }) ||
      "";
    const headerName = welcomeName || "会員";
    const avatarUrl =
      profile.avatarUrl ||
      window.TasuMemberProfile?.getStoredAvatarUrl?.() ||
      "";

    const avatar = document.querySelector("[data-dash-avatar]");
    if (avatar) {
      avatar.src =
        window.TasuMemberProfile?.resolveDisplayUrl?.(avatarUrl) ||
        avatarUrl ||
        avatar.src;
      avatar.alt = headerName;
    }
    setAll("[data-dash-user-name]", headerName);

    const subEl = document.querySelector(".anpi-dash-header__actions .dash-profile__sub");
    if (subEl) subEl.textContent = resolveProfileTypeLabel(profile);
  }

  function resolveRecentIconMod(log) {
    if (log?.event_type === "urgent_keyword_detected") return "alert";
    if (log?.is_read) return "info";
    return "bell";
  }

  function resolveRecentStatus(log) {
    if (log?.event_type === "urgent_keyword_detected" && !log?.is_read) {
      return { text: "未読", mod: "unread" };
    }
    if (log?.is_read) return { text: "既読", mod: "read" };
    return { text: "未読", mod: "unread" };
  }

  function buildRecentItemHtml(item, { demo = false } = {}) {
    const iconKey = item.icon || resolveRecentIconMod(item);
    const iconMod = item.iconMod || iconKey;
    const statusMod = item.statusMod || resolveRecentStatus(item).mod;
    const statusText = item.status || resolveRecentStatus(item).text;
    const unreadClass = !demo && !item.is_read ? " anpi-recent-item--unread" : "";
    const datetime = item.datetime || formatRowDateTime(item.created_at);
    const datetimeAttr = item.created_at ? ` datetime="${esc(item.created_at)}"` : "";
    const demoAttr = demo ? ' data-demo="true"' : "";
    const message = item.message || "";

    return (
      `<li${demoAttr}>` +
      `<a class="anpi-recent-item${unreadClass}" href="anpi-notifications.html">` +
      `<span class="anpi-recent-item__icon anpi-recent-item__icon--${esc(iconMod)}" aria-hidden="true">` +
      (RECENT_ICON_SVG[iconKey] || RECENT_ICON_SVG.info) +
      `</span>` +
      `<span class="anpi-recent-item__main">` +
      `<span class="anpi-recent-item__title">${esc(item.title)}</span>` +
      (message ? `<span class="anpi-recent-item__message">${esc(message)}</span>` : "") +
      `</span>` +
      `<span class="anpi-recent-item__aside">` +
      `<span class="anpi-recent-item__status anpi-recent-item__status--${esc(statusMod)}">${esc(statusText)}</span>` +
      `<span class="anpi-recent-item__datetime"><time${datetimeAttr}>${esc(datetime)}</time></span>` +
      `<span class="anpi-recent-item__chevron" aria-hidden="true">›</span>` +
      `</span>` +
      `</a>` +
      `</li>`
    );
  }

  function renderRecentListContent(items, { demo = false } = {}) {
    const listEl = document.querySelector("[data-anpi-recent-list]");
    const emptyEl = document.querySelector("[data-anpi-recent-empty]");
    if (!listEl || !emptyEl) return;

    if (!items.length) {
      listEl.innerHTML = "";
      listEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }

    listEl.hidden = false;
    emptyEl.hidden = true;
    listEl.innerHTML = items
      .map((item) => buildRecentItemHtml(item, { demo }))
      .join("");
  }

  function renderDemoRecentList() {
    renderRecentListContent(DEMO_RECENT_ITEMS.slice(0, MOBILE_RECENT_DEMO_LIMIT), { demo: true });
  }

  function renderRecentList(logs) {
    const recent = logs.slice(0, MOBILE_RECENT_LIMIT);
    if (!recent.length) {
      renderDemoRecentList();
      return;
    }
    const eventLabels = window.TasuAnpiNotifications?.EVENT_TYPE_LABELS || {};
    const rows = recent.map((log) => ({
      ...log,
      title: log.title || eventLabels[log.event_type] || log.event_type,
      message: log.message || "",
    }));
    renderRecentListContent(rows, { demo: false });
  }

  function renderUrgentList(logs, { showEmptyState = false } = {}) {
    const panelEl = document.querySelector(".anpi-urgent-panel");
    const listEl = document.querySelector("[data-anpi-urgent-list]");
    const emptyEl = document.querySelector("[data-anpi-urgent-empty]");
    if (!listEl || !emptyEl) return;

    const urgent = logs
      .filter((l) => l.event_type === "urgent_keyword_detected")
      .slice(0, 3);

    if (!urgent.length) {
      listEl.innerHTML = "";
      listEl.hidden = true;
      if (showEmptyState) {
        emptyEl.hidden = false;
        if (panelEl) panelEl.hidden = false;
      } else {
        emptyEl.hidden = true;
        if (panelEl) panelEl.hidden = true;
      }
      return;
    }

    if (panelEl) panelEl.hidden = false;
    listEl.hidden = false;
    emptyEl.hidden = true;
    const eventLabels = window.TasuAnpiNotifications?.EVENT_TYPE_LABELS || {};
    listEl.innerHTML = urgent
      .map((log) => {
        const typeLabel = eventLabels[log.event_type] || log.event_type;
        return (
          `<li>` +
          `<a class="anpi-urgent-item" href="anpi-notifications.html">` +
          `<p class="anpi-urgent-item__title">${esc(log.title)}</p>` +
          `<p class="anpi-urgent-item__meta">` +
          `<time datetime="${esc(log.created_at)}">${esc(formatRowDateTime(log.created_at))}</time>` +
          `<span>${esc(typeLabel)}</span>` +
          `<span>${log.is_read ? "既読" : "未読"}</span>` +
          `</p>` +
          `</a>` +
          `</li>`
        );
      })
      .join("");
  }

  function setDemoStatMode(on) {
    const grid = document.querySelector("[data-anpi-summary-grid]");
    if (grid) {
      grid.querySelectorAll(".anpi-stat-card").forEach((card) => {
        if (on) card.setAttribute("data-demo", "true");
        else card.removeAttribute("data-demo");
      });
    }
    document.querySelectorAll("[data-anpi-stat-sample]").forEach((el) => {
      el.hidden = !on;
    });
  }

  function renderMobileDetailSummary(ctx, { registered = false, logs = [] } = {}) {
    const registrationEl = document.querySelector("[data-anpi-mobile-registration-status]");
    const lastActivityEl = document.querySelector("[data-anpi-mobile-last-activity]");
    const familyCountEl = document.querySelector("[data-anpi-mobile-family-count]");
    const notifySettingEl = document.querySelector("[data-anpi-mobile-notification-setting]");
    if (!registrationEl || !lastActivityEl || !familyCountEl || !notifySettingEl) return;

    if (!registered) {
      registrationEl.textContent = MOBILE_DETAIL_SUMMARY_DEMO.registration;
      lastActivityEl.textContent = MOBILE_DETAIL_SUMMARY_DEMO.lastActivity;
      familyCountEl.textContent = MOBILE_DETAIL_SUMMARY_DEMO.familyCount;
      notifySettingEl.textContent = MOBILE_DETAIL_SUMMARY_DEMO.notificationSetting;
      return;
    }

    const userLabel = String(ctx?.user_name || "").trim();
    registrationEl.textContent = userLabel ? `${userLabel}（登録済み）` : "登録済み";
    lastActivityEl.textContent = formatLastActivity(computeLastActivityAt(ctx, logs));
    const relation = String(ctx?.contract_holder_relation || "").trim();
    familyCountEl.textContent = relation ? `1名（${relation}）` : "1名";
    notifySettingEl.textContent =
      LEVEL_LABELS[ctx?.notification_level] || ctx?.notification_level || "—";
  }

  /** 未登録時のみ — 表示用デモ値（DB/localStorage には書かない） */
  function renderDemoStats() {
    setSummaryStat("user-name", DEMO_STAT_VALUES.users);
    setSummaryStat("holder-name", DEMO_STAT_VALUES.holders);
    setSummaryStat("total", DEMO_STAT_VALUES.total);
    setSummaryStat("unread", DEMO_STAT_VALUES.unread);
    setAll("[data-anpi-summary-urgent]", "0");
    setAll("[data-anpi-summary-level]", "—");
    setAll("[data-anpi-summary-channels]", "—");
    setAll("[data-anpi-summary-last-activity]", "—");
    setDemoStatMode(true);
    renderMobileDetailSummary(null, { registered: false });
  }

  function renderSummary(ctx, logs, summary) {
    setDemoStatMode(false);
    setSummaryStat("user-name", ctx.user_name || "0");
    setSummaryStat("holder-name", ctx.contract_holder_name || "0");
    setAll(
      "[data-anpi-summary-level]",
      LEVEL_LABELS[ctx.notification_level] || ctx.notification_level || "—"
    );
    setAll("[data-anpi-summary-channels]", formatChannels(ctx.notify_channels));
    setAll(
      "[data-anpi-summary-last-activity]",
      formatLastActivity(computeLastActivityAt(ctx, logs))
    );
    setSummaryStat("unread", String(summary.unread ?? 0));
    setSummaryStat("total", String(summary.total ?? 0));
    setAll("[data-anpi-summary-urgent]", String(summary.urgent ?? 0));
    renderMobileDetailSummary(ctx, { registered: true, logs });
  }

  function renderLineFailurePanel() {
    const panel = document.querySelector("[data-anpi-line-fail-panel]");
    const meta = document.querySelector("[data-anpi-line-fail-meta]");
    const list = document.querySelector("[data-anpi-line-fail-list]");
    if (!panel || !meta || !list) return;

    const summary =
      window.TasuAnpiNotifications?.getLineSendFailureSummary?.(getViewerOptions()) || {
        failed_count: 0,
        latest_failed_logs: [],
      };

    if (!summary.failed_count) {
      panel.hidden = true;
      meta.textContent = "";
      list.innerHTML = "";
      return;
    }

    panel.hidden = false;
    meta.textContent = `送信失敗 ${summary.failed_count} 件${
      summary.latest_failed_at
        ? ` · 最新 ${formatRowDateTime(summary.latest_failed_at)}`
        : ""
    }`;

    list.innerHTML = (summary.latest_failed_logs || [])
      .map((log) => {
        const friendly =
          window.TasuAnpiNotifications?.formatUserFacingLineError?.(
            log.line_error_message,
            log.line_error_code
          ) || { message: "", code: "" };
        const err = friendly.message
          ? `<p class="anpi-line-fail-item__error">${esc(friendly.message)}</p>`
          : "";
        return (
          `<li class="anpi-line-fail-item">` +
          `<p class="anpi-line-fail-item__title">${esc(log.title)}</p>` +
          `<p class="anpi-line-fail-item__meta">${esc(formatRowDateTime(log.created_at))}</p>` +
          err +
          `</li>`
        );
      })
      .join("");
  }

  async function render() {
    await resolveDashboardContext();
    const registered = window.TasuAnpiUserContext?.isAnpiUser?.() === true;
    const unregisteredBanner = document.querySelector("[data-anpi-empty-unregistered]");
    const shellEl = document.querySelector("[data-anpi-dashboard-shell]");

    if (unregisteredBanner) {
      unregisteredBanner.hidden = registered;
    }

    if (!registered) {
      renderDemoStats();
      renderDemoRecentList();
      renderUrgentList([]);
      await syncDashProfileHeader();
      if (shellEl) shellEl.hidden = false;
      window.dispatchEvent(new CustomEvent("tasu:anpi-dashboard-ready"));
      return;
    }

    const ctx = getDashboardContext();
    const logs = getLogs();
    const summary =
      window.TasuAnpiNotifications?.getNotificationSummary?.(getViewerOptions()) || {
        total: 0,
        unread: 0,
        urgent: 0,
      };

    renderSummary(ctx, logs, summary);
    await syncDashProfileHeader();
    renderUrgentList(logs, { showEmptyState: true });
    renderLineFailurePanel();
    renderRecentList(logs);
    void window.TasuAnpiLineAdmin?.renderInto?.("[data-anpi-line-admin]", "[data-anpi-line-mode]");
    if (shellEl) shellEl.hidden = false;
    window.dispatchEvent(new CustomEvent("tasu:anpi-dashboard-ready"));
  }

  function bindMenu() {
    const sidebar = document.getElementById("dashSidebar");
    const overlay = document.querySelector("[data-dash-overlay]");
    const menuBtn = document.querySelector("[data-dash-menu]");
    menuBtn?.addEventListener("click", () => {
      sidebar?.classList.toggle("is-open");
      overlay?.setAttribute(
        "aria-hidden",
        sidebar?.classList.contains("is-open") ? "false" : "true"
      );
    });
    overlay?.addEventListener("click", () => {
      sidebar?.classList.remove("is-open");
      overlay?.setAttribute("aria-hidden", "true");
    });
  }

  function bindRefresh() {
    const names = [
      "tasu:anpi-notification-log-created",
      "tasu:anpi-notification-read",
      "tasu:anpi-notification-bulk-read",
      "tasful:anpi-notification-created",
      "tasful:anpi-notification-updated",
      "tasu:anpi-line-send-failed",
      "tasful:anpi-line-send-failed",
      "tasu:anpi-line-send-retried",
      "tasful:anpi-line-send-retried",
      "tasu:anpi-line-oauth-unlinked",
      "tasful:anpi-line-oauth-unlinked",
      "tasu:anpi-notification-line-sent",
      "tasful:anpi-notification-line-sent",
    ];
    names.forEach((name) => {
      document.addEventListener(name, render);
      window.addEventListener(name, render);
    });
  }

  function init() {
    const root = document.querySelector("[data-anpi-dashboard-root]");
    if (!root || root.dataset.anpiDashboardBound === "1") return;
    root.dataset.anpiDashboardBound = "1";
    bindMenu();
    bindRefresh();
    window.TasuAnpiLineAdmin?.bindRefresh?.("[data-anpi-line-admin]", "[data-anpi-line-mode]");
    void render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.TasuAnpiDashboard = {
    computeLastActivityAt,
    formatLastActivity,
    render,
  };
})(typeof window !== "undefined" ? window : globalThis);
