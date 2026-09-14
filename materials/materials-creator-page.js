/**
 * TASFUL Materials — public Creator Page
 * Reuses existing catalog query, list category cards, and TASFUL Account profile.
 */
(function (global) {
  "use strict";

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readCreatorId() {
    try {
      return String(new URLSearchParams(global.location.search).get("id") || "").trim();
    } catch (_err) {
      return "";
    }
  }

  function readCategory() {
    const List = global.TasuMaterialsListPage;
    const raw = new URLSearchParams(global.location.search).get("category") || "";
    return List?.normalizeCategory ? List.normalizeCategory(raw) : String(raw || "").trim();
  }

  function categoryToFilterId(chipCategory) {
    if (chipCategory === "text") return "document";
    return chipCategory || "";
  }

  function preserveQaHref(href) {
    const raw = String(href || "").trim();
    if (!raw) return raw;
    try {
      const qa = new URLSearchParams(global.location.search).get("qa_fixture") === "1";
      if (!qa) return raw;
      const url = new URL(raw, global.location.href);
      url.searchParams.set("qa_fixture", "1");
      if (url.pathname === "/detail.html") url.pathname = "/materials/detail.html";
      return url.pathname + url.search + url.hash;
    } catch (_err) {
      return raw;
    }
  }

  function isKnownAccountCreator(id, profile) {
    if (!id) return false;
    if (id === "u_me") return true;
    const demo = global.TasuListingSellerProfile?.DEMO_PROFILES;
    if (demo && demo[id]) return true;
    const source = String(profile?.source || "");
    return source === "supabase" || source === "demo";
  }

  function renderHeader(profile, creatorId) {
    const name = escapeHtml(profile?.displayName || creatorId || "クリエイター");
    const avatar = escapeHtml(profile?.avatarUrl || "");
    return (
      `<div class="mat-creator-header" data-creator-id="${escapeHtml(creatorId)}">` +
      `<img class="mat-creator-header__avatar" src="${avatar}" alt="" width="88" height="88">` +
      `<div class="mat-creator-header__body">` +
      `<h1 class="mat-creator-header__name">${name}</h1>` +
      `</div>` +
      `</div>`
    );
  }

  function renderChips(activeCategory, chips) {
    return (chips || [])
      .map((chip) => {
        const id = chip.id || "";
        const current = id === activeCategory;
        return (
          `<button type="button" class="materials-list-chip${current ? " is-active" : ""}" data-creator-chip data-category="${escapeHtml(id)}"${current ? ' aria-current="true"' : ""}>` +
          `${escapeHtml(chip.label)}` +
          `</button>`
        );
      })
      .join("");
  }

  function rewriteDetailHrefs(root) {
    if (!root) return;
    root.querySelectorAll('a[href*="detail.html"]').forEach((anchor) => {
      const href = anchor.getAttribute("href");
      const next = preserveQaHref(href);
      if (next && next !== href) anchor.setAttribute("href", next);
    });
  }

  function renderVisibleCards(root, items) {
    const List = global.TasuMaterialsListPage;
    if (!root) return;
    if (!items.length) {
      root.innerHTML =
        '<div class="mat-creator-empty" data-creator-empty><p>公開中の素材はまだありません。</p></div>';
      return;
    }
    if (!List?.renderCategoryCard) {
      root.innerHTML = '<p class="materials-list-empty">カードを表示できません。</p>';
      return;
    }
    root.innerHTML =
      '<div class="materials-all-card-grid" data-materials-all-grid data-creator-card-grid>' +
      items.map((item) => List.renderCategoryCard(item)).join("") +
      "</div>";
    List.wireMixedListContracts?.(root, items);
    rewriteDetailHrefs(root);
  }

  async function mountCreatorPage() {
    const Data = global.TasuMaterialsData;
    const headerEl = document.querySelector("[data-creator-header]");
    const chipsEl = document.querySelector("[data-creator-chips]");
    const titleEl = document.querySelector("[data-creator-section-title]");
    const gridEl = document.querySelector("[data-creator-grid]");
    const moreWrap = document.querySelector("[data-creator-more]");
    const moreBtn = document.querySelector("[data-creator-more-btn]");
    if (!Data || !headerEl || !gridEl) return;

    const creatorId = readCreatorId();
    if (!creatorId) {
      headerEl.innerHTML = "";
      if (chipsEl) chipsEl.hidden = true;
      if (titleEl) titleEl.hidden = true;
      if (moreWrap) moreWrap.hidden = true;
      gridEl.innerHTML =
        '<div class="mat-creator-invalid" data-creator-invalid><p>クリエイターが見つかりません。</p><p><a href="/materials/">Materials TOPへ</a></p></div>';
      document.title = "クリエイターが見つかりません | TASFUL Materials";
      return;
    }

    const allPublic = await Data.repository.fetchPublicItemsByCreatorId(creatorId, "newest");
    let profile = null;
    try {
      profile = await global.TasuListingSellerProfile?.fetchSellerProfile?.(creatorId);
    } catch (_err) {
      profile = null;
    }

    if (!allPublic.length && !isKnownAccountCreator(creatorId, profile)) {
      headerEl.innerHTML = "";
      if (chipsEl) chipsEl.hidden = true;
      if (titleEl) titleEl.hidden = true;
      if (moreWrap) moreWrap.hidden = true;
      gridEl.innerHTML =
        '<div class="mat-creator-invalid" data-creator-invalid><p>クリエイターが見つかりません。</p><p><a href="/materials/">Materials TOPへ</a></p></div>';
      document.title = "クリエイターが見つかりません | TASFUL Materials";
      return;
    }

    headerEl.innerHTML = renderHeader(profile, creatorId);
    document.title = `${profile?.displayName || creatorId} | TASFUL Materials`;

    const chips = Data.LIST_CATEGORY_CHIPS || [];
    if (chipsEl) {
      chipsEl.hidden = false;
      chipsEl.innerHTML = renderChips(readCategory(), chips);
    }
    if (titleEl) titleEl.hidden = false;

    const pageSize = Data.LIST_PAGE_SIZE || 12;
    let visibleCount = pageSize;

    function filteredItems() {
      const category = categoryToFilterId(readCategory());
      if (!category) return allPublic.slice();
      return allPublic.filter((item) => item.category_id === category);
    }

    function paint() {
      const filtered = filteredItems();
      const slice = filtered.slice(0, visibleCount);
      renderVisibleCards(gridEl, slice);
      if (moreWrap) moreWrap.hidden = filtered.length <= visibleCount;
      if (!filtered.length && allPublic.length) {
        gridEl.innerHTML =
          '<div class="mat-creator-empty" data-creator-empty><p>このカテゴリの公開素材はありません。</p></div>';
      }
    }

    function bindChips() {
      chipsEl?.querySelectorAll("[data-creator-chip]").forEach((btn) => {
        btn.addEventListener("click", onChip);
      });
    }

    function onChip(ev) {
      const btn = ev.currentTarget;
      const next = String(btn.getAttribute("data-category") || "");
      const url = new URL(global.location.href);
      if (next) url.searchParams.set("category", next);
      else url.searchParams.delete("category");
      global.history.pushState({ materialsCreator: true }, "", url);
      visibleCount = pageSize;
      if (chipsEl) chipsEl.innerHTML = renderChips(next, chips);
      bindChips();
      paint();
    }

    bindChips();

    moreBtn?.addEventListener("click", () => {
      visibleCount += pageSize;
      paint();
    });

    global.addEventListener("popstate", () => {
      visibleCount = pageSize;
      if (chipsEl) {
        chipsEl.innerHTML = renderChips(readCategory(), chips);
        bindChips();
      }
      paint();
    });

    paint();
  }

  global.TasuMaterialsCreatorPage = {
    mountCreatorPage,
    readCreatorId,
  };

  if (document.body && document.body.getAttribute("data-page") === "materials_creator") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        mountCreatorPage().catch(function () {});
      });
    } else {
      mountCreatorPage().catch(function () {});
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
