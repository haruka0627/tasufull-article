/**
 * TASFUL Materials — 一覧左Sidebar 共通カテゴリ Navigation
 * SSOT: TasuMaterialsData.LIST_SIDEBAR_CATEGORIES（CATEGORIES 順 · document query = text）
 * 件数: materials-index の実在 Inventory のみ（qa_fixture / dummy を混ぜない）
 */
(function (global) {
  "use strict";

  const ICONS = Object.freeze({
    sfx: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
    bgm: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>',
    image:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5z"/></svg>',
    illustration:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>',
    background:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16v16H4V4zm2 2v12h12V6H6z"/></svg>',
    web: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 4h18v16H3V4zm2 4v10h14V8H5zm0-2h14V6H5z"/></svg>',
    code: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6zm5.2 0l4.6-4.6L14.6 7.4 16 6l6 6-6 6z"/></svg>',
    template:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 2h9l5 5v15H6zm8 1.5V8h4.5z"/></svg>',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm3.5 5.5l-2 5-5 2 2-5z"/></svg>',
    presentation:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 3H3v14h8v2H7v2h10v-2h-4v-2h8zM5 15V5h14v10z"/></svg>',
    document:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 2h9l5 5v15H6zm8 1.5V8h4.5zM8 12h8v1.5H8zm0 3h8v1.5H8z"/></svg>',
    tool: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6l-3 3-4.3-4.3C.6 7.1 1 10.1 3 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.4-.4.4-1 0-1.4z"/></svg>',
  });

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isQaFixtureMode() {
    try {
      if (typeof global.location === "undefined" || !global.location) return false;
      return new URLSearchParams(String(global.location.search || "")).get("qa_fixture") === "1";
    } catch (_err) {
      return false;
    }
  }

  function getSidebarCategories() {
    const data = global.TasuMaterialsData;
    if (data && Array.isArray(data.LIST_SIDEBAR_CATEGORIES) && data.LIST_SIDEBAR_CATEGORIES.length) {
      return data.LIST_SIDEBAR_CATEGORIES;
    }
    return [];
  }

  function countPublishedByCategory() {
    const data = global.TasuMaterialsData;
    if (typeof data?.countPublishedInventoryByCategory === "function") {
      return data.countPublishedInventoryByCategory() || {};
    }
    if (typeof data?.repository?.countPublishedInventoryByCategory === "function") {
      return data.repository.countPublishedInventoryByCategory() || {};
    }
    const counts = {};
    getSidebarCategories().forEach((cat) => {
      counts[cat.id] = 0;
    });
    return counts;
  }

  function listHref(queryId) {
    const params = new URLSearchParams();
    if (queryId) params.set("category", queryId);
    if (isQaFixtureMode()) params.set("qa_fixture", "1");
    const qs = params.toString();
    return qs ? `list.html?${qs}` : "list.html";
  }

  function renderNav(opts) {
    const activeId = opts && opts.activeId ? String(opts.activeId) : "";
    const counts = (opts && opts.counts) || countPublishedByCategory();
    const cats = getSidebarCategories();
    const rows = cats
      .map((cat) => {
        const queryId = cat.queryId || (cat.id === "document" ? "text" : cat.id);
        const label = cat.label || cat.name || cat.id;
        const count = Number(counts[cat.id]) || 0;
        const active = cat.id === activeId;
        const icon = ICONS[cat.id] || ICONS.template;
        return (
          `<a class="mat-list-side-cat${active ? " is-active" : ""}" href="${escapeHtml(listHref(queryId))}"${
            active ? ' aria-current="page"' : ""
          }>` +
          `<span class="mat-list-side-cat__ico" aria-hidden="true">${icon}</span>` +
          `<span class="mat-list-side-cat__name">${escapeHtml(label)}</span>` +
          `<span class="mat-list-side-cat__count">${count.toLocaleString("ja-JP")}</span>` +
          `</a>`
        );
      })
      .join("");
    return `<nav class="mat-list-side-cats" aria-label="素材カテゴリ">${rows}</nav>`;
  }

  global.TasuMaterialsListSidebar = {
    getSidebarCategories,
    countPublishedByCategory,
    renderNav,
    listHref,
  };
})(typeof window !== "undefined" ? window : globalThis);
