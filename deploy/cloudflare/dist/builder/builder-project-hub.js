/**
 * Builder Project Hub — 案件一覧（Phase 6-A）
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

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return String(iso);
    }
  }

  function statusClass(status) {
    return `builder-ph-status builder-ph-status--${String(status || "inquiry").replace(/-/g, "_")}`;
  }

  function getFiltersFromForm() {
    return {
      q: $("[data-builder-ph-q]")?.value || "",
      category: $("[data-builder-ph-category]")?.value || "",
      status: $("[data-builder-ph-status]")?.value || "",
    };
  }

  function fillSelectOptions() {
    const Store = global.TasuBuilderProjectStore;
    const catSel = $("[data-builder-ph-category]");
    const stSel = $("[data-builder-ph-status]");
    if (!Store || !catSel || !stSel) return;

    Store.CATEGORIES.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      catSel.appendChild(opt);
    });
    Store.STATUSES.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.label;
      stSel.appendChild(opt);
    });
  }

  function formatYen(amount) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.formatYen?.(amount) || `¥${Number(amount || 0).toLocaleString("ja-JP")}`;
  }

  function paymentClass(status) {
    return `builder-ph-payment--${String(status || "unpaid").replace(/-/g, "_")}`;
  }

  function renderFinanceSummary() {
    const Store = global.TasuBuilderProjectStore;
    const wrap = $("[data-builder-ph-finance-summary]");
    if (!Store || !wrap) return;
    const s = Store.getFinanceSummary?.() || {};
    wrap.innerHTML =
      `<div class="builder-ph-finance-stat"><p class="builder-ph-finance-stat__label">総見積額</p><p class="builder-ph-finance-stat__value">${escapeHtml(formatYen(s.totalEstimate))}</p></div>` +
      `<div class="builder-ph-finance-stat"><p class="builder-ph-finance-stat__label">総原価</p><p class="builder-ph-finance-stat__value">${escapeHtml(formatYen(s.totalCost))}</p></div>` +
      `<div class="builder-ph-finance-stat"><p class="builder-ph-finance-stat__label">総粗利</p><p class="builder-ph-finance-stat__value">${escapeHtml(formatYen(s.totalGrossProfit))}</p></div>` +
      `<div class="builder-ph-finance-stat${s.unpaidCount ? " builder-ph-finance-stat--warn" : ""}"><p class="builder-ph-finance-stat__label">未入金</p><p class="builder-ph-finance-stat__value">${escapeHtml(String(s.unpaidCount || 0))} 件</p></div>` +
      `<div class="builder-ph-finance-stat${s.overdueCount ? " builder-ph-finance-stat--warn" : ""}"><p class="builder-ph-finance-stat__label">支払遅延</p><p class="builder-ph-finance-stat__value">${escapeHtml(String(s.overdueCount || 0))} 件</p></div>`;
  }

  function formatScheduleRange(p) {
    if (!p.scheduleStartDate && !p.scheduleEndDate) return "—";
    const s = p.scheduleStartDate || "—";
    const e = p.scheduleEndDate || "—";
    return `${s} → ${e}`;
  }

  function renderTable(projects) {
    const tbody = $("[data-builder-ph-tbody]");
    const empty = $("[data-builder-ph-empty]");
    const count = $("[data-builder-ph-count]");
    if (!tbody) return;

    if (count) count.textContent = `${projects.length} 件`;

    if (!projects.length) {
      tbody.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    tbody.innerHTML = projects
      .map(
        (p) =>
          `<tr>` +
          `<td><a href="project-detail.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.id)}</a></td>` +
          `<td>${escapeHtml(p.name)}</td>` +
          `<td>${escapeHtml(p.categoryLabel)}</td>` +
          `<td>${escapeHtml(p.customerName || "—")}</td>` +
          `<td>${escapeHtml(p.assignedVendor || "—")}</td>` +
          `<td><span class="${statusClass(p.status)}">${escapeHtml(p.statusLabel)}</span></td>` +
          `<td>${escapeHtml(p.schedulePhaseLabel || "—")}</td>` +
          `<td>${escapeHtml(formatScheduleRange(p))}</td>` +
          `<td class="builder-ph-table__num">${escapeHtml(formatYen(p.finance?.estimateAmount))}</td>` +
          `<td class="builder-ph-table__num">${escapeHtml(formatYen(p.finance?.costAmount))}</td>` +
          `<td class="builder-ph-table__num">${escapeHtml(formatYen(p.finance?.grossProfit))}</td>` +
          `<td><span class="${paymentClass(p.finance?.paymentStatus)}">${escapeHtml(p.finance?.paymentStatusLabel || "—")}</span></td>` +
          `<td>${escapeHtml(formatDate(p.updatedAt))}</td>` +
          `</tr>`
      )
      .join("");
  }

  function refresh() {
    const Store = global.TasuBuilderProjectStore;
    if (!Store?.searchProjects) return;
    renderFinanceSummary();
    renderTable(Store.searchProjects(getFiltersFromForm()));
  }

  function bindSearch() {
    const form = $("[data-builder-ph-search-form]");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      refresh();
    });
    $("[data-builder-ph-q]")?.addEventListener("input", () => refresh());
    $("[data-builder-ph-category]")?.addEventListener("change", () => refresh());
    $("[data-builder-ph-status]")?.addEventListener("change", () => refresh());
  }

  function init() {
    fillSelectOptions();
    bindSearch();
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuBuilderProjectHub = { init, refresh };
})(typeof window !== "undefined" ? window : globalThis);
