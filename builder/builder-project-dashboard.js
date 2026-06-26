/**
 * Builder Command Dashboard — Phase 6-H
 * 既存 TasuBuilderProjectStore の読み取りのみ（新規業務ロジックなし）
 */
(function (global) {
  "use strict";

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

  function formatYen(Store, amount) {
    return Store?.formatYen?.(amount) || `¥${Number(amount || 0).toLocaleString("ja-JP")}`;
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      return d.toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return String(iso);
    }
  }

  function projectLink(id) {
    return `project-detail.html?id=${encodeURIComponent(id)}`;
  }

  function collectUnreadNotifications(Store) {
    const items = [];
    (Store.listProjects?.() || []).forEach((p) => {
      (Store.getUnreadNotifications?.(p.id) || []).forEach((n) => {
        items.push({ project: p, notification: n });
      });
    });
    return items.sort((a, b) =>
      String(b.notification.createdAt || "").localeCompare(String(a.notification.createdAt || ""))
    );
  }

  function collectRecentActivity(Store) {
    const events = [];
    (Store.listProjects?.() || []).forEach((p) => {
      (p.timeline || []).forEach((e) => {
        events.push({
          projectId: p.id,
          projectName: p.name,
          type: e.type,
          label: e.label || Store.TIMELINE_LABELS?.[e.type] || e.type,
          detail: e.detail || "",
          at: e.at || "",
        });
      });
    });
    return events
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 12);
  }

  function countVisionDiagnoses(Store) {
    return (Store.listProjects?.() || []).reduce(
      (sum, p) => sum + (Array.isArray(p.visionDiagnoses) ? p.visionDiagnoses.length : 0),
      0
    );
  }

  function renderKpiCards(Store) {
    const wrap = $("[data-builder-pd-kpi]");
    if (!wrap) return;

    const today = Store.getTodayProjects?.() || [];
    const completion = Store.getCompletionSummary?.() || {};
    const delayed = Store.getDelayedProjects?.() || [];
    const finance = Store.getFinanceSummary?.() || {};
    const invoice = Store.getInvoiceSummary?.() || {};
    const ntf = Store.getNotificationSummary?.() || {};
    const docs = Store.getDocumentSummary?.() || {};
    const visionCount = countVisionDiagnoses(Store);

    const cards = [
      { label: "Today's Work", value: `${today.length} 件`, warn: false },
      { label: "Active Projects", value: `${completion.workingCount || 0} 件`, warn: false },
      { label: "Completed", value: `${completion.completedCount || 0} 件`, warn: false },
      { label: "Delayed", value: `${delayed.length} 件`, warn: delayed.length > 0 },
      { label: "Revenue", value: formatYen(Store, invoice.totalInvoice), money: true, warn: false },
      { label: "Gross Profit", value: formatYen(Store, finance.totalGrossProfit), money: true, warn: false },
      { label: "Outstanding", value: `${finance.unpaidCount || 0} 件`, warn: (finance.unpaidCount || 0) > 0 },
      { label: "Notifications", value: `${ntf.unreadCount || 0} 件`, warn: (ntf.unreadCount || 0) > 0 },
      { label: "Documents", value: `${docs.totalDocuments || 0} 件`, warn: false },
      { label: "Vision", value: `${visionCount} 件`, warn: false },
    ];

    wrap.innerHTML = cards
      .map(
        (c) =>
          `<article class="builder-pd-kpi-card${c.warn ? " builder-pd-kpi-card--warn" : ""}">` +
          `<p class="builder-pd-kpi-card__label">${escapeHtml(c.label)}</p>` +
          `<p class="builder-pd-kpi-card__value${c.money ? " builder-pd-kpi-card__value--money" : ""}">${escapeHtml(c.value)}</p>` +
          `</article>`
      )
      .join("");
  }

  function renderProjectList(listEl, emptyEl, countEl, projects, metaFn) {
    if (!listEl) return;
    const list = projects || [];
    if (countEl) countEl.textContent = `${list.length} 件`;
    if (!list.length) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    listEl.innerHTML = list
      .map(
        (p) =>
          `<li>` +
          `<a href="${projectLink(p.id)}">${escapeHtml(p.name || p.id)}</a>` +
          `<span class="builder-pd-list__meta">${escapeHtml(metaFn(p))}</span>` +
          `</li>`
      )
      .join("");
  }

  function renderNotificationList(Store) {
    const listEl = $("[data-builder-pd-ntf-list]");
    const emptyEl = $("[data-builder-pd-ntf-empty]");
    const countEl = $("[data-builder-pd-ntf-count]");
    const items = collectUnreadNotifications(Store).slice(0, 8);
    if (countEl) countEl.textContent = `${Store.getNotificationSummary?.()?.unreadCount || 0} 未読`;
    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    listEl.innerHTML = items
      .map(
        (row) =>
          `<li>` +
          `<a href="${projectLink(row.project.id)}">${escapeHtml(row.notification.title || "通知")}</a>` +
          `<span class="builder-pd-list__meta">${escapeHtml(row.project.name)} · ${escapeHtml(row.notification.priorityLabel || "")}</span>` +
          `</li>`
      )
      .join("");
  }

  function renderActivity(Store) {
    const listEl = $("[data-builder-pd-activity-list]");
    const emptyEl = $("[data-builder-pd-activity-empty]");
    const events = collectRecentActivity(Store);
    if (!listEl) return;
    if (!events.length) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    listEl.innerHTML = events
      .map(
        (e) =>
          `<li>` +
          `<span class="builder-pd-timeline__type">${escapeHtml(e.label)}</span>` +
          `<span class="builder-pd-list__meta"><a href="${projectLink(e.projectId)}">${escapeHtml(e.projectName)}</a> · ${escapeHtml(formatDateTime(e.at))}</span>` +
          (e.detail ? `<span class="builder-pd-timeline__detail">${escapeHtml(e.detail)}</span>` : "") +
          `</li>`
      )
      .join("");
  }

  function renderBottomStats(Store) {
    const finance = Store.getFinanceSummary?.() || {};
    const invoice = Store.getInvoiceSummary?.() || {};
    const docs = Store.getDocumentSummary?.() || {};
    const visionCount = countVisionDiagnoses(Store);

    const revenue = $("[data-builder-pd-revenue]");
    const profit = $("[data-builder-pd-profit]");
    const outstanding = $("[data-builder-pd-outstanding]");
    const vision = $("[data-builder-pd-vision]");
    const documents = $("[data-builder-pd-documents]");

    if (revenue) revenue.textContent = formatYen(Store, invoice.totalInvoice);
    if (profit) profit.textContent = formatYen(Store, finance.totalGrossProfit);
    if (outstanding) outstanding.textContent = `${finance.unpaidCount || 0} 件`;
    if (vision) vision.textContent = `${visionCount} 件`;
    if (documents) documents.textContent = `${docs.totalDocuments || 0} 件`;
  }

  function refresh() {
    const Store = global.TasuBuilderProjectStore;
    if (!Store) return;
    Store.ensureSeed?.();

    renderKpiCards(Store);

    renderProjectList(
      $("[data-builder-pd-today-list]"),
      $("[data-builder-pd-today-empty]"),
      $("[data-builder-pd-today-count]"),
      Store.getTodayProjects?.() || [],
      (p) => `${p.schedulePhaseLabel || "—"} · ${p.scheduleStartDate || ""} → ${p.scheduleEndDate || ""}`
    );

    renderProjectList(
      $("[data-builder-pd-active-list]"),
      $("[data-builder-pd-active-empty]"),
      $("[data-builder-pd-active-count]"),
      Store.getWorkingProjects?.() || [],
      (p) => `${p.completion?.completionStatusLabel || "施工中"} · ${p.customerName || "—"}`
    );

    renderNotificationList(Store);
    renderActivity(Store);
    renderBottomStats(Store);

    renderProjectList(
      $("[data-builder-pd-upcoming-list]"),
      $("[data-builder-pd-upcoming-empty]"),
      $("[data-builder-pd-upcoming-count]"),
      Store.getThisWeekProjects?.() || [],
      (p) => `日程 ${p.scheduleStartDate || "—"} → ${p.scheduleEndDate || "—"}`
    );
  }

  function init() {
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuBuilderProjectDashboard = { init, refresh };
})(typeof window !== "undefined" ? window : globalThis);
