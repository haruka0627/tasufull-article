(function () {
  "use strict";

  const Data = window.PlatformQaData;
  const Article = window.PlatformQaArticle;
  const Admin = window.PlatformQaAdmin;
  if (!Data || !Article) return;

  const adminMode = Admin?.isEnabled?.() === true;
  if (adminMode) Admin?.applyBodyClass?.();

  const LIST_PAGE_SIZE = 8;
  const POPULAR_MOBILE_LIMIT = 3;

  const searchForm = document.querySelector("[data-help-search-form]");
  const searchInput = document.querySelector("[data-help-search-input]");
  const categoriesEl = document.querySelector("[data-help-categories]");
  const popularEl = document.querySelector("[data-help-popular]");
  const popularToggle = document.querySelector("[data-help-popular-toggle]");
  const popularToggleLabel = document.querySelector("[data-help-popular-toggle-label]");
  const listEl = document.querySelector("[data-help-list]");
  const emptyEl = document.querySelector("[data-help-empty]");
  const sortEl = document.querySelector("[data-help-sort]");
  const listMoreBtn = document.querySelector("[data-help-list-more]");
  const listMoreLabel = document.querySelector("[data-help-list-more-label]");
  const searchMetaEl = document.querySelector("[data-help-search-meta]");

  let activeCategory = "all";
  let listExpanded = false;
  let popularExpanded = false;

  const FEATURED_META = {
    signup: { icon: "account" },
    pricing: { icon: "pricing" },
    "direct-trading": { icon: "trading" },
    "search-no-results": { icon: "search" },
    beginner: { icon: "account" },
    "ai-workspace-start": { icon: "ai" },
    "tlv-start": { icon: "tlv" },
    "talk-start": { icon: "talk" },
  };

  function escapeHtml(s) {
    return Article.escapeHtml(s);
  }

  function iconSvg(name) {
    if (name === "ai" && window.PlatformQaAiIcon?.render) {
      return window.PlatformQaAiIcon.render("sm");
    }
    const icons = {
      all:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
      account:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M5 20c1.5-4 13.5-4 15 0"/></svg>',
      pricing:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h3a1.5 1.5 0 1 1 0 3h-2a1.5 1.5 0 1 0 0 3h3"/></svg>',
      search:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
      apply:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 10h8M8 14h5"/></svg>',
      listing:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
      trading:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4 9v12h16V9z"/><path d="M9 14h6"/></svg>',
      trouble:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
      platform:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg>',
      ai:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4 9v12h16V9z"/><circle cx="12" cy="13" r="2"/></svg>',
      tlv:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="8 5 19 12 8 19 8 5"/></svg>',
      talk:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
      material:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16v10H4z"/><path d="M8 7V5h8v2"/></svg>',
      security:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 5 6v6c0 4 3 7 7 8 4-1 7-4 7-8V6z"/></svg>',
      legal:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 4h10v16H7z"/><path d="M10 8h6M10 12h6M10 16h4"/></svg>',
      other:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18" cy="12" r="1.5" fill="currentColor"/></svg>',
    };
    return icons[name] || icons.other;
  }

  function adminActionsHtml(item) {
    if (!adminMode || !Admin?.renderActionsHtml) return "";
    return Admin.renderActionsHtml(item);
  }

  function bindAdminActions(root) {
    if (!adminMode || !Admin?.bindActions) return;
    Admin.bindActions(root, {
      onDeleted: () => {
        refreshAfterAdminChange();
      },
    });
  }

  function refreshAfterAdminChange() {
    Admin?.refreshBanner?.();
    renderPopular();
    renderList();
  }

  function initBreadcrumb() {
    const bc = window.TasuCommonBreadcrumb;
    if (!bc?.setTrail) return;
    bc.setTrail(
      [
        { label: "ホーム", href: "/index-top.html" },
        { label: "ヘルプ・Q&A" },
      ],
      { replace: true, source: "help-hub" },
    );
  }

  function renderCategories() {
    categoriesEl.innerHTML = Data.QA_CATEGORIES.map((cat) => {
      const labelHtml = String(cat.label || "")
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br>");
      return (
        `<button type="button" class="platform-qa-hub-category${cat.id === activeCategory ? " is-active" : ""}"` +
        ` data-help-category="${escapeHtml(cat.id)}" role="tab" aria-selected="${cat.id === activeCategory}">` +
        `<span class="platform-qa-hub-category__icon">${iconSvg(cat.icon || cat.id)}</span>` +
        `<span class="platform-qa-hub-category__label">${labelHtml}</span>` +
        `</button>`
      );
    }).join("");

    categoriesEl.querySelectorAll("[data-help-category]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.getAttribute("data-help-category") || "all";
        listExpanded = false;
        renderCategories();
        renderPopular();
        renderList();
      });
    });
  }

  function renderPopular() {
    const items = Data.getFeatured();
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const visible = isMobile && !popularExpanded ? items.slice(0, POPULAR_MOBILE_LIMIT) : items;

    popularEl.innerHTML = visible
      .map((item, index) => {
        const iconKey = FEATURED_META[item.slug]?.icon || item.category;
        const card =
          `<a class="platform-qa-hub-popular-card" href="${escapeHtml(Data.detailUrl(item.slug))}">` +
          `<span class="platform-qa-hub-popular-card__rank">${index + 1}</span>` +
          `<span class="platform-qa-hub-popular-card__icon">${iconSvg(iconKey)}</span>` +
          `<h3 class="platform-qa-hub-popular-card__title">${escapeHtml(item.title)}</h3>` +
          `<p class="platform-qa-hub-popular-card__summary">${escapeHtml(item.summary)}</p>` +
          `<span class="platform-qa-hub-popular-card__link">詳しく見る →</span>` +
          `</a>`;
        if (!adminMode) return card;
        return (
          `<div class="platform-qa-hub-popular-item" data-qa-slug="${escapeHtml(item.slug)}">` +
          card +
          adminActionsHtml(item) +
          `</div>`
        );
      })
      .join("");

    bindAdminActions(popularEl);

    if (popularToggle) {
      const showToggle = isMobile && items.length > POPULAR_MOBILE_LIMIT;
      popularToggle.hidden = !showToggle;
      popularToggle.setAttribute("aria-expanded", popularExpanded ? "true" : "false");
      if (popularToggleLabel) {
        popularToggleLabel.textContent = popularExpanded ? "閉じる" : "もっと見る";
      }
    }
  }

  function renderListRow(item) {
    const iconKey = item.category;
    const row =
      `<a class="platform-qa-hub-list-row" href="${escapeHtml(Data.detailUrl(item.slug))}">` +
      `<span class="platform-qa-hub-list-row__icon">${iconSvg(iconKey)}</span>` +
      `<span class="platform-qa-hub-list-row__main">` +
      `<span class="platform-qa-hub-list-row__question">${escapeHtml(item.question)}</span>` +
      `<span class="platform-qa-hub-list-row__meta">` +
      `<span class="platform-qa-hub-list-row__tag">${escapeHtml(Data.getCategoryListLabel(item.category))}</span>` +
      `<time class="platform-qa-hub-list-row__date" datetime="${escapeHtml(item.updatedAt)}">${escapeHtml(Data.formatListDate(item.updatedAt))}</time>` +
      `</span>` +
      `</span>` +
      `<span class="platform-qa-hub-list-row__chev" aria-hidden="true">›</span>` +
      `</a>`;
    if (!adminMode) return row;
    return (
      `<div class="platform-qa-hub-list-item" data-qa-slug="${escapeHtml(item.slug)}">` +
      row +
      adminActionsHtml(item) +
      `</div>`
    );
  }

  function renderList() {
    const query = searchInput?.value || "";
    const hasQuery = Boolean(query.trim());
    const sortKey =
      hasQuery && (sortEl?.value || "relevance") === "relevance"
        ? "relevance"
        : sortEl?.value || "date-desc";
    let items = Data.searchArticles(query, activeCategory);
    if (sortKey !== "relevance") {
      items = Data.sortArticles(items, sortKey);
    }

    const total = items.length;
    const visible = listExpanded ? items : items.slice(0, LIST_PAGE_SIZE);

    listEl.innerHTML = visible.map(renderListRow).join("");
    bindAdminActions(listEl);
    if (emptyEl) emptyEl.hidden = total > 0;

    if (searchMetaEl) {
      if (hasQuery || activeCategory !== "all") {
        const catLabel =
          activeCategory !== "all" ? Data.getCategoryListLabel(activeCategory) : "";
        const parts = [];
        if (hasQuery) parts.push(`「${query.trim()}」`);
        if (catLabel) parts.push(catLabel);
        searchMetaEl.textContent = `${parts.join(" · ")}の検索結果 ${total}件`;
        searchMetaEl.hidden = false;
      } else {
        searchMetaEl.textContent = `全${total}件のQ&A`;
        searchMetaEl.hidden = false;
      }
    }

    if (listMoreBtn && listMoreLabel) {
      const showMore = total > LIST_PAGE_SIZE && !listExpanded;
      listMoreBtn.hidden = !showMore;
      listMoreLabel.textContent = `もっと見る（全${total}件）`;
    }
  }

  searchForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    listExpanded = false;
    renderList();
  });

  searchInput?.addEventListener("input", () => {
    listExpanded = false;
    if (sortEl && searchInput.value.trim()) {
      sortEl.value = "relevance";
    }
    renderList();
  });

  sortEl?.addEventListener("change", renderList);

  listMoreBtn?.addEventListener("click", () => {
    listExpanded = true;
    renderList();
  });

  popularToggle?.addEventListener("click", () => {
    popularExpanded = !popularExpanded;
    renderPopular();
  });

  window.addEventListener("resize", () => {
    renderPopular();
  });

  initBreadcrumb();
  if (adminMode) {
    Admin?.mountBanner?.(document.querySelector(".platform-qa-hub"));
    Data.onChange?.(refreshAfterAdminChange);
  }
  renderCategories();
  renderPopular();
  renderList();
})();
