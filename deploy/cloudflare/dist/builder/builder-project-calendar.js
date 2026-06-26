/**
 * Builder Project Calendar — Phase 6-B
 */
(function (global) {
  "use strict";

  const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

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

  function formatDateJa(dateStr) {
    const Store = global.TasuBuilderProjectStore;
    const d = Store?.parseDateOnly?.(dateStr);
    if (!d) return dateStr || "—";
    return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
  }

  function detailUrl(projectId) {
    return `project-detail.html?id=${encodeURIComponent(projectId)}`;
  }

  let viewMode = "month";
  let anchorDate = new Date();

  function getStore() {
    return global.TasuBuilderProjectStore;
  }

  function setAnchor(d) {
    anchorDate = new Date(d);
    anchorDate.setHours(12, 0, 0, 0);
  }

  function monthLabel(d) {
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  }

  function weekLabel(Store) {
    const range = Store.getWeekRange(Store.toDateOnlyString(anchorDate));
    return `${formatDateJa(range.start)} – ${formatDateJa(range.end)}`;
  }

  function renderMiniList(listEl, projects, emptyText) {
    if (!listEl) return;
    if (!projects.length) {
      listEl.innerHTML = `<li><span class="builder-pc-mini-list__meta">${escapeHtml(emptyText)}</span></li>`;
      return;
    }
    const Store = getStore();
    listEl.innerHTML = projects
      .map((p) => {
        const delay = Store?.isDelayedProject?.(p);
        const range = `${formatDateJa(p.scheduleStartDate)} → ${formatDateJa(p.scheduleEndDate)}`;
        return (
          `<li>` +
          `<a href="${detailUrl(p.id)}">${escapeHtml(p.name)}</a>` +
          `<span class="builder-pc-mini-list__meta">${escapeHtml(p.schedulePhaseLabel)} · ${escapeHtml(range)}${delay ? " · 遅延" : ""}</span>` +
          `</li>`
        );
      })
      .join("");
  }

  function renderWidgets() {
    const Store = getStore();
    if (!Store) return;
    Store.ensureSeed?.();
    renderMiniList($("[data-builder-pc-today]"), Store.getTodayProjects(), "本日の予定案件はありません");
    renderMiniList($("[data-builder-pc-week]"), Store.getThisWeekProjects(), "今週の予定案件はありません");
    renderMiniList($("[data-builder-pc-delayed]"), Store.getDelayedProjects(), "遅延案件はありません");
  }

  function projectsForDay(dateStr, projects) {
    const Store = getStore();
    return projects.filter((p) => Store.isDateInRange(dateStr, p.scheduleStartDate, p.scheduleEndDate));
  }

  function renderMonth() {
    const wrap = $("[data-builder-pc-calendar-body]");
    const label = $("[data-builder-pc-period-label]");
    const Store = getStore();
    if (!wrap || !Store) return;

    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    if (label) label.textContent = monthLabel(anchorDate);

    const first = new Date(year, month, 1, 12, 0, 0, 0);
    const startOffset = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);

    const projects = Store.listScheduledProjects();
    const today = Store.todayDateOnly();
    let html = '<div class="builder-pc-month"><div class="builder-pc-month__head">';
    WEEKDAYS.forEach((w) => {
      html += `<span>${w}</span>`;
    });
    html += '</div><div class="builder-pc-month__grid">';

    for (let i = 0; i < 42; i += 1) {
      const cell = new Date(gridStart);
      cell.setDate(gridStart.getDate() + i);
      const dateStr = Store.toDateOnlyString(cell);
      const inMonth = cell.getMonth() === month;
      const dayProjects = projectsForDay(dateStr, projects);
      const classes = ["builder-pc-day"];
      if (!inMonth) classes.push("builder-pc-day--muted");
      if (dateStr === today) classes.push("builder-pc-day--today");

      html += `<div class="${classes.join(" ")}">`;
      html += `<span class="builder-pc-day__num">${cell.getDate()}</span>`;
      dayProjects.slice(0, 3).forEach((p) => {
        const delay = Store.isDelayedProject(p);
        html +=
          `<a class="builder-pc-event${delay ? " builder-pc-event--delay" : ""}" href="${detailUrl(p.id)}" title="${escapeHtml(p.name)}">` +
          `${escapeHtml(p.name)}</a>`;
      });
      if (dayProjects.length > 3) {
        html += `<span class="builder-pc-mini-list__meta">+${dayProjects.length - 3}件</span>`;
      }
      html += "</div>";
    }
    html += "</div></div>";
    wrap.innerHTML = html;
  }

  function renderWeek() {
    const wrap = $("[data-builder-pc-calendar-body]");
    const label = $("[data-builder-pc-period-label]");
    const Store = getStore();
    if (!wrap || !Store) return;

    const range = Store.getWeekRange(Store.toDateOnlyString(anchorDate));
    if (label) label.textContent = weekLabel(Store);

    const start = Store.parseDateOnly(range.start);
    const projects = Store.listScheduledProjects();
    const today = Store.todayDateOnly();

    let html = '<div class="builder-pc-week">';
    html += '<div class="builder-pc-week__row">';
    for (let i = 0; i < 7; i += 1) {
      const cell = new Date(start);
      cell.setDate(start.getDate() + i);
      const dateStr = Store.toDateOnlyString(cell);
      const isToday = dateStr === today;
      html +=
        `<div class="builder-pc-week__cell builder-pc-week__head${isToday ? " builder-pc-day--today" : ""}">` +
        `${WEEKDAYS[i]}<br>${cell.getMonth() + 1}/${cell.getDate()}` +
        `</div>`;
    }
    html += '</div><div class="builder-pc-week__row">';

    for (let i = 0; i < 7; i += 1) {
      const cell = new Date(start);
      cell.setDate(start.getDate() + i);
      const dateStr = Store.toDateOnlyString(cell);
      const dayProjects = projectsForDay(dateStr, projects);
      html += `<div class="builder-pc-week__cell">`;
      dayProjects.forEach((p) => {
        const delay = Store.isDelayedProject(p);
        html +=
          `<a class="builder-pc-event${delay ? " builder-pc-event--delay" : ""}" href="${detailUrl(p.id)}">` +
          `${escapeHtml(p.name)}<br><span class="builder-pc-mini-list__meta">${escapeHtml(p.schedulePhaseLabel)}</span></a>`;
      });
      if (!dayProjects.length) html += `<span class="builder-pc-mini-list__meta">—</span>`;
      html += "</div>";
    }
    html += "</div></div>";
    wrap.innerHTML = html;
  }

  function renderCalendar() {
    if (viewMode === "week") renderWeek();
    else renderMonth();
  }

  function refresh() {
    renderWidgets();
    renderCalendar();
  }

  function shiftPeriod(delta) {
    if (viewMode === "week") {
      anchorDate.setDate(anchorDate.getDate() + delta * 7);
    } else {
      anchorDate.setMonth(anchorDate.getMonth() + delta);
    }
    refresh();
  }

  function bindToolbar() {
    $("[data-builder-pc-prev]")?.addEventListener("click", () => shiftPeriod(-1));
    $("[data-builder-pc-next]")?.addEventListener("click", () => shiftPeriod(1));
    $("[data-builder-pc-today-btn]")?.addEventListener("click", () => {
      setAnchor(new Date());
      refresh();
    });

    document.querySelectorAll("[data-builder-pc-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        viewMode = btn.getAttribute("data-builder-pc-view") || "month";
        document.querySelectorAll("[data-builder-pc-view]").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
        });
        refresh();
      });
    });
  }

  function init() {
    const Store = getStore();
    if (!Store) return;
    Store.ensureSeed?.();
    setAnchor(new Date());
    bindToolbar();
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuBuilderProjectCalendar = { init, refresh, renderCalendar };
})(typeof window !== "undefined" ? window : globalThis);
