/**
 * TASFUL Materials — TOP（Screenshot to Code Option 4 UI）
 * UI 正本 = materials-top.css / index.html。Contract は既存 Data / Download / Favorite / Ads。
 */
(function (global) {
  "use strict";

  const Data = () => global.TasuMaterialsData;
  const Ad = () => global.TasuMaterialsAdSlot;
  const Fav = () => global.TasuMaterialsFavorites;
  const Download = () => global.TasuMaterialsDownload;

  /** 一覧 query 正本（document → text）。CATEGORIES は変更しない */
  const LIST_QUERY_BY_ID = Object.freeze({
    document: "text",
  });

  /** 公開表示名（specialty Option 4 と整合。CATEGORIES.name は変更しない） */
  const UI_LABEL_BY_ID = Object.freeze({
    document: "文例・文章テンプレート",
    presentation: "プレゼンテンプレート",
    code: "コード素材",
    icon: "アイコン素材",
    image: "写真",
  });

  const CATEGORY_ICON_CLASS = Object.freeze({
    sfx: "red",
    bgm: "purple",
    image: "teal",
    illustration: "pink",
    background: "sky",
    web: "violet",
    code: "cyan",
    template: "purple",
    icon: "blue",
    presentation: "orange",
    document: "cyan",
    tool: "green",
    overlay: "violet",
    frame: "pink",
    telop: "orange",
    transition: "cyan",
  });

  const CATEGORY_FA_ICON = Object.freeze({
    sfx: "fas fa-volume-up",
    bgm: "fas fa-music",
    image: "far fa-image",
    illustration: "fas fa-drafting-compass",
    background: "far fa-image",
    web: "fas fa-globe",
    code: "fas fa-code",
    template: "far fa-list-alt",
    icon: "far fa-smile",
    presentation: "fas fa-desktop",
    document: "far fa-file-alt",
    tool: "fas fa-wrench",
    overlay: "fas fa-layer-group",
    frame: "far fa-square",
    telop: "fas fa-closed-captioning",
    transition: "fas fa-play",
  });

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function categoryLabel(catOrItem) {
    const id = catOrItem?.id || catOrItem?.category_id || "";
    if (UI_LABEL_BY_ID[id]) return UI_LABEL_BY_ID[id];
    return pickStr(catOrItem?.name, catOrItem?.category_name, id);
  }

  function categoryListHref(cat) {
    const id = cat?.id || cat?.code || "";
    const q = LIST_QUERY_BY_ID[id] || cat?.code || id;
    return `/materials/list.html?category=${encodeURIComponent(q)}`;
  }

  function detailHref(item) {
    return `/materials/detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
  }

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(String(url || ""));
  }


  function preferCommittedPreviewPath(src) {
    const s = String(src || "").trim();
    if (!s) return "";
    const m = s.match(/\/materials\/generated\/downloads\/image\/([^/?#]+)\.(png|jpe?g|webp)$/i);
    if (m) return "/materials/generated/previews/image/" + m[1] + ".jpg";
    return s;
  }

  function isServedPreviewPath(src) {
    const s = String(src || "");
    return /\/materials\/images\/previews\//i.test(s) || /\/materials\/generated\/previews\//i.test(s);
  }

  function resolveThumbSrc(item) {
    const images = Array.isArray(item.preview_images) ? item.preview_images : [];
    const candidates = [];
    for (let i = 0; i < images.length; i += 1) {
      const img = images[i];
      candidates.push(pickStr(img && (img.src || img.url || img)));
    }
    candidates.push(
      item.thumbnail_url,
      item.preview_image,
      item.preview_url,
      item.image_url,
      item.image,
      item.cover_url
    );
    for (let i = 0; i < candidates.length; i += 1) {
      const src = preferCommittedPreviewPath(pickStr(candidates[i]));
      if (src && isImageUrl(src) && isServedPreviewPath(src)) return src;
    }
    for (let i = 0; i < candidates.length; i += 1) {
      const src = preferCommittedPreviewPath(pickStr(candidates[i]));
      if (/\/materials\/generated\/downloads\//i.test(src)) continue;
      if (src && isImageUrl(src)) return src;
    }
    return "";
  }

  function truncate(str, n) {
    const s = String(str || "");
    if (s.length <= n) return s;
    return `${s.slice(0, n - 1)}…`;
  }

  function renderMaterialCard(item) {
    const href = detailHref(item);
    const thumb = resolveThumbSrc(item);
    const label = categoryLabel(item);
    const favOn = !!Fav()?.isFavorited?.(item.id);
    const dlLabel = Download()?.primaryButtonLabel?.(item) || item.button_label || "無料ダウンロード";
    const media = thumb
      ? `<a href="${href}" tabindex="-1" aria-hidden="true"><img class="card-image" src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true;this.removeAttribute('src');"></a>`
      : `<a class="card-ph" href="${href}" tabindex="-1" aria-hidden="true"><i class="${escapeHtml(CATEGORY_FA_ICON[item.category_id] || "far fa-file")}" aria-hidden="true"></i></a>`;

    return (
      `<article class="material-card" data-materials-card data-item-id="${escapeHtml(item.id)}">` +
      `<span class="material-card__badge">${escapeHtml(label)}</span>` +
      `<button type="button" class="material-card__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="お気に入り">` +
      `<i class="${favOn ? "fas" : "far"} fa-heart" aria-hidden="true"></i>` +
      `<span class="visually-hidden" data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      media +
      `<div class="card-body">` +
      `<h3 class="card-title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<p class="card-description">${escapeHtml(truncate(item.description || "", 42))}</p>` +
      `<button type="button" class="download-link" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      `<i class="fas fa-download" aria-hidden="true"></i>` +
      `<span data-mat-download-label>${escapeHtml(dlLabel)}</span>` +
      `</button>` +
      `</div>` +
      `</article>`
    );
  }

  function renderRankingItem(item, rank) {
    const href = detailHref(item);
    const thumb = resolveThumbSrc(item);
    const label = categoryLabel(item);
    const thumbHtml = thumb
      ? `<img class="rank-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true;this.removeAttribute('src');">`
      : `<span class="rank-thumb rank-thumb--ph" aria-hidden="true"><i class="${escapeHtml(CATEGORY_FA_ICON[item.category_id] || "far fa-file")}"></i></span>`;
    return (
      `<a class="ranking-item" href="${href}">` +
      `<span class="rank-number">${rank}</span>` +
      thumbHtml +
      `<span class="rank-meta">` +
      `<span class="rank-title">${escapeHtml(item.title)}</span>` +
      `<span class="rank-tag">${escapeHtml(label)}</span>` +
      `</span>` +
      `</a>`
    );
  }

  function renderCategoryCard(cat) {
    const href = categoryListHref(cat);
    const iconClass = CATEGORY_ICON_CLASS[cat.id] || "blue";
    const fa = CATEGORY_FA_ICON[cat.id] || "far fa-folder";
    return (
      `<a class="category-card" href="${href}">` +
      `<span class="category-icon ${iconClass}" aria-hidden="true"><i class="${fa}"></i></span>` +
      `<span class="category-label">${escapeHtml(categoryLabel(cat))}</span>` +
      `</a>`
    );
  }

  function renderHeaderCategoryLinks(categories) {
    return (
      categories.map((cat) => `<a href="${categoryListHref(cat)}">${escapeHtml(categoryLabel(cat))}</a>`).join("") +
      `<a href="/materials/list.html">すべてのカテゴリ</a>`
    );
  }

  function renderFooterCategoryLinks(categories) {
    return categories
      .slice(0, 6)
      .map((cat) => `<a href="${categoryListHref(cat)}">${escapeHtml(categoryLabel(cat))}</a>`)
      .join("");
  }

  function renderServices(services) {
    return (services || [])
      .map((svc) => {
        const variant = svc.variant === "dark" ? "dark" : "light";
        const href = String(svc.href || "").replace(/^\.\.\//, "/");
        let img = "";
        if (svc.image_src) {
          const src = String(svc.image_src).startsWith("/")
            ? svc.image_src
            : `/materials/${svc.image_src}`;
          const webp = svc.image_webp
            ? String(svc.image_webp).startsWith("/")
              ? svc.image_webp
              : `/materials/${svc.image_webp}`
            : "";
          img =
            `<picture>` +
            (webp ? `<source type="image/webp" srcset="${escapeHtml(webp)}">` : "") +
            `<img class="service-image" src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">` +
            `</picture>`;
        }
        return (
          `<a class="service-card ${variant}" href="${escapeHtml(href)}">` +
          `<div class="service-title">${escapeHtml(svc.title)}</div>` +
          `<div class="service-copy">${escapeHtml(svc.description)}</div>` +
          `<span class="service-cta">${escapeHtml(svc.button_label)}</span>` +
          img +
          `</a>`
        );
      })
      .join("");
  }

  function renderKeywords(keywords, className) {
    return (keywords || [])
      .map(
        (kw) =>
          `<a class="${className}" href="/materials/list.html?q=${encodeURIComponent(kw)}">${escapeHtml(kw)}</a>`
      )
      .join("");
  }

  function wireSearchForms() {
    document.querySelectorAll(".search-form").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = form.querySelector('[name="q"]')?.value || "";
        global.location.href = `/materials/list.html?q=${encodeURIComponent(String(q).trim())}`;
      });
    });
  }

  function wireHeaderChrome() {
    const categoryToggle = document.getElementById("categoryToggle");
    const categoryDropdown = document.getElementById("categoryDropdown");
    const mobileMenuButton = document.getElementById("mobileMenuButton");
    const mobileDrawer = document.getElementById("mobileDrawer");

    if (categoryToggle && categoryDropdown) {
      categoryToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = !categoryDropdown.classList.contains("open");
        categoryDropdown.classList.toggle("open", open);
        categoryToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      document.addEventListener("click", () => {
        categoryDropdown.classList.remove("open");
        categoryToggle.setAttribute("aria-expanded", "false");
      });
      categoryDropdown.addEventListener("click", (e) => e.stopPropagation());
    }

    if (mobileMenuButton && mobileDrawer) {
      mobileMenuButton.addEventListener("click", () => {
        const open = !mobileDrawer.classList.contains("open");
        mobileDrawer.classList.toggle("open", open);
        mobileMenuButton.setAttribute("aria-expanded", open ? "true" : "false");
        mobileMenuButton.innerHTML = open
          ? '<i class="fas fa-times" aria-hidden="true"></i>'
          : '<i class="fas fa-bars" aria-hidden="true"></i>';
      });
      mobileDrawer.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
          mobileDrawer.classList.remove("open");
          mobileMenuButton.setAttribute("aria-expanded", "false");
          mobileMenuButton.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';
        });
      });
    }

    document.querySelectorAll("[data-carousel]").forEach((button) => {
      button.addEventListener("click", () => {
        const grid = document.getElementById(button.getAttribute("data-carousel"));
        if (!grid || !grid.firstElementChild) return;
        if (button.getAttribute("data-direction") === "next") {
          grid.appendChild(grid.firstElementChild);
        } else {
          grid.insertBefore(grid.lastElementChild, grid.firstElementChild);
        }
      });
    });
  }

  function wireItemActions(root, items) {
    const byId = new Map((items || []).map((it) => [it.id, it]));
    root.querySelectorAll("[data-materials-card]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const item = byId.get(id);
      if (item) Download()?.wireDownloadAndFavorite?.(card, item);
    });
  }

  async function mountPage() {
    const data = Data();
    const ad = Ad();
    if (!data) return;

    try {
      await global.TasuMaterialsMetrics?.ensureLoaded?.();
    } catch {
      /* metrics optional */
    }

    const [categories, popular, newest, ranking] = await Promise.all([
      data.repository.fetchCategories(),
      data.repository.fetchPopularItems(5),
      data.repository.fetchNewItems(5),
      data.repository.fetchRanking(5),
    ]);

    const popularRoot = document.querySelector("[data-materials-popular]");
    const newestRoot = document.querySelector("[data-materials-newest]");
    const categoryRoot = document.querySelector("[data-materials-categories]");
    const rankingRoot = document.querySelector("[data-materials-ranking]");
    const rankingMobileRoot = document.querySelector("[data-materials-ranking-mobile]");
    const keywordsRoot = document.querySelector("[data-materials-keywords]");
    const headerCats = document.querySelector("[data-materials-header-categories]");
    const mobileCats = document.querySelector("[data-materials-mobile-categories]");

    if (popularRoot) popularRoot.innerHTML = popular.map(renderMaterialCard).join("");
    if (newestRoot) newestRoot.innerHTML = newest.map(renderMaterialCard).join("");
    if (categoryRoot) categoryRoot.innerHTML = categories.map(renderCategoryCard).join("");

    const rankingHtml = ranking.map((item, i) => renderRankingItem(item, i + 1)).join("");
    if (rankingRoot) rankingRoot.innerHTML = rankingHtml;
    if (rankingMobileRoot) rankingMobileRoot.innerHTML = rankingHtml;

    const servicesHtml = renderServices(data.RECOMMENDED_SERVICES);
    document.querySelectorAll("[data-materials-services]").forEach((el) => {
      el.innerHTML = servicesHtml;
    });

    if (keywordsRoot) keywordsRoot.innerHTML = renderKeywords(data.POPULAR_KEYWORDS, "");
    if (headerCats) headerCats.innerHTML = renderHeaderCategoryLinks(categories);
    if (mobileCats) mobileCats.innerHTML = renderHeaderCategoryLinks(categories);
    global.TasuMaterialsSiteFooter?.fill?.({
      categories,
      keywords: data.POPULAR_KEYWORDS,
    });

    const isMobile = global.matchMedia("(max-width: 900px)").matches;
    document.querySelectorAll("[data-materials-ad-mount]").forEach((el) => {
      let preset = el.getAttribute("data-materials-ad-mount") || "rectangle";
      if (isMobile && preset === "rectangle") preset = "mobileBanner";
      el.innerHTML = ad?.renderAdSlot?.({ preset }) || "";
      el.classList.remove("ad-placeholder");
    });
    ad?.mountAdSlots?.(document);

    wireSearchForms();
    wireHeaderChrome();
    wireItemActions(document, [...popular, ...newest]);
  }

  global.TasuMaterialsPage = { mountPage };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      mountPage().catch(() => {});
    });
  } else {
    mountPage().catch(() => {});
  }
})(typeof window !== "undefined" ? window : globalThis);
