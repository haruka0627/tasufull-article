/**
 * 店舗商品一覧（shop-products.html）
 */
(function () {
  "use strict";

  const PAGE_SIZE = 12;
  const FAV_KEY = "tasu_shop_store_favorites";
  const DEFAULT_DESC =
    "厳選した素材と丁寧な仕込み。店舗ならではの味わいをお楽しみください。";

  const state = {
    shop: null,
    categoryKey: "retail",
    filterCategories: ["すべて"],
    products: [],
    filtered: [],
    visibleLimit: PAGE_SIZE,
    activeCategory: "すべて",
    sort: "recommended",
    keyword: "",
    priceMin: null,
    priceMax: null,
    commitment: {
      recommended: false,
      new: false,
      sale: false,
      popular: false,
      instock: false,
    },
    scenes: {},
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, "&#39;");
  }

  const SHOP_ID_ALIASES = {
    "demo-shop-kichi-dining": "demo-shop-kiichi-dining",
  };

  function getShopId() {
    const raw = new URLSearchParams(window.location.search).get("id")?.trim() || "";
    return SHOP_ID_ALIASES[raw] || raw;
  }

  function buildDetailUrl(id) {
    return id ? `detail-shop-store.html?id=${encodeURIComponent(id)}` : "detail-shop-store.html";
  }

  function parsePriceNum(raw) {
    const s = String(raw || "");
    const m = s.replace(/,/g, "").match(/(\d+)/);
    return m ? Number(m[1]) : null;
  }

  function formatPriceDisplay(num) {
    if (num == null || Number.isNaN(num)) return "";
    return `¥${num.toLocaleString("ja-JP")}`;
  }

  function inferSceneTags(raw, categoryKey) {
    if (Array.isArray(raw?.sceneTags) && raw.sceneTags.length) return raw.sceneTags;
    const text = `${raw?.title || ""} ${raw?.description || ""} ${raw?.category || ""}`.toLowerCase();
    const tags = [];
    if (/朝|モーニング|breakfast/.test(text)) tags.push("breakfast");
    if (/ランチ|昼|弁当/.test(text)) tags.push("lunch");
    if (/カフェ|コーヒー|ティー|ドリンク/.test(text)) tags.push("cafe");
    if (/ディナー|夜|コース|宴会|和食|居酒屋/.test(text)) tags.push("dinner");
    if (/ギフト|贈答|セット|ボトル/.test(text)) tags.push("gift");
    if (categoryKey === "restaurant" && !tags.length) tags.push("lunch", "dinner");
    return tags;
  }

  function inferBadges(p) {
    const badges = [];
    const tag = String(p.tag || "").trim();
    if (p.isNew || /new|新着|限定/i.test(tag)) badges.push({ label: "NEW", kind: "new" });
    if (p.isPopular || /人気|popular/i.test(tag)) badges.push({ label: "人気", kind: "popular" });
    if (p.isSale || /sale|セール/i.test(tag)) badges.push({ label: "SALE", kind: "sale" });
    if (p.priceWas) {
      const hasSaleBadge = badges.some((b) => b.kind === "sale");
      if (!hasSaleBadge) badges.push({ label: "SALE", kind: "sale" });
    }
    if (!badges.length && p.isRecommended) badges.push({ label: "人気", kind: "popular" });
    return badges.slice(0, 2);
  }

  function firstImageUrl(...values) {
    for (const v of values) {
      if (Array.isArray(v)) {
        const nested = firstImageUrl(...v);
        if (nested) return nested;
        continue;
      }
      const url = String(v ?? "").trim();
      if (url && url !== "null" && url !== "undefined") return url;
    }
    return "";
  }

  function resolveProductImages(raw, shop, categoryKey) {
    const cfg = window.TasuShopProductsConfig;
    const categoryFallback = cfg.getCategoryFallbackImage(categoryKey);
    const brandPlaceholder = cfg.getBrandPlaceholderUri();
    const productUrl = firstImageUrl(
      raw?.image,
      raw?.imageUrl,
      raw?.image_url,
      raw?.product_image_url,
      raw?.img,
      raw?.images
    );
    const shopUrl = firstImageUrl(
      shop?.image_url,
      shop?.main_image,
      shop?.thumbnail_url,
      shop?.gallery_urls,
      shop?.images
    );
    const image = productUrl || shopUrl || categoryFallback;
    const usesFallback = !productUrl && !shopUrl;
    return { image, categoryFallback, brandPlaceholder, usesFallback };
  }

  window.tasuShopProductsImgFallback = function (img) {
    if (!img) return;
    const media = img.closest(".shop-products-card__media, .shop-products-store-image-wrap");
    if (!img.dataset.spTriedFallback && img.dataset.spFallback) {
      img.dataset.spTriedFallback = "1";
      img.src = img.dataset.spFallback;
      media?.classList.add("shop-products-card__media--fallback");
      return;
    }
    if (!img.dataset.spTriedBrand && img.dataset.spBrand) {
      img.dataset.spTriedBrand = "1";
      img.src = img.dataset.spBrand;
      media?.classList.remove("shop-products-card__media--fallback");
      media?.classList.add("shop-products-card__media--brand");
    }
  };

  function popularityScore(p) {
    let score = 0;
    if (p.isPopular) score += 3;
    if (p.isRecommended) score += 2;
    if (p.badges.some((b) => b.kind === "popular")) score += 2;
    if (p.isNew) score += 1;
    return score;
  }

  function normalizeProduct(raw, index, categoryKey, shop) {
    const title = String(raw?.title || raw?.product_name || raw?.name || "").trim();
    if (!title) return null;
    const imgs = resolveProductImages(raw, shop, categoryKey);
    const priceStr = String(raw?.price || raw?.price_text || "").trim();
    const priceWas = String(raw?.priceWas || raw?.price_was || raw?.original_price || "").trim();
    const salePrice = raw?.salePrice || raw?.sale_price;
    const priceNum = parsePriceNum(salePrice || priceStr);
    const wasNum = parsePriceNum(priceWas);
    const hasSale = Boolean(priceWas || (wasNum != null && priceNum != null && wasNum > priceNum));
    const stock = String(raw?.stock || raw?.stock_status || raw?.stock_label || "").trim();
    const soldOut = /売切|sold\s*out|在庫なし|欠品/i.test(stock);
    const tag = String(raw?.tag || "").trim();
    const isNew = /new|新着|限定/i.test(tag);
    const isPopular = /人気|popular/i.test(tag);
    const isRecommended = /人気|おすすめ/i.test(tag);
    const isSale = hasSale || Boolean(salePrice || /sale|セール/i.test(tag));

    const p = {
      id: String(raw?.id || raw?.product_id || `p-${index}`),
      title,
      description: String(raw?.description || raw?.product_description || "").trim() || DEFAULT_DESC,
      price: priceStr || (priceNum != null ? formatPriceDisplay(priceNum) : "¥—"),
      priceNum: priceNum ?? 0,
      priceWas: hasSale ? priceWas || (wasNum != null ? formatPriceDisplay(wasNum) : "") : "",
      priceWasNum: wasNum,
      category: String(raw?.category || raw?.product_category || "その他").trim() || "その他",
      image: imgs.image,
      categoryFallback: imgs.categoryFallback,
      brandPlaceholder: imgs.brandPlaceholder,
      usesFallback: imgs.usesFallback,
      tag,
      stock,
      soldOut,
      inStock: !soldOut,
      isRecommended,
      isNew,
      isPopular,
      isSale,
      sceneTags: inferSceneTags(raw, categoryKey),
    };
    p.badges = inferBadges(p);
    return p;
  }

  function collectProductsFromShop(shop, categoryKey) {
    const buckets = [
      shop?.products,
      shop?.items,
      shop?.product_list,
      shop?.form_data?.products,
      shop?.category_extra?.shop_store?.products,
    ];
    const raw = [];
    buckets.forEach((list) => {
      if (Array.isArray(list)) raw.push(...list);
    });
    return raw.map((r, i) => normalizeProduct(r, i, categoryKey, shop)).filter(Boolean);
  }

  function mergeProducts(shopProducts, demoProducts) {
    const seen = new Set();
    const out = [];
    [...shopProducts, ...demoProducts].forEach((p) => {
      const key = `${p.title}::${p.price}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(p);
    });
    return out;
  }

  function buildFilterCategoriesList() {
    const fromProducts = state.products.map((p) => p.category).filter(Boolean);
    state.filterCategories = window.TasuShopProductsConfig.buildFilterCategories(
      state.categoryKey,
      fromProducts
    );
  }

  function hasActiveFilters() {
    if (state.keyword.trim()) return true;
    if (state.activeCategory && state.activeCategory !== "すべて") return true;
    if (state.priceMin != null || state.priceMax != null) return true;
    if (Object.values(state.commitment).some(Boolean)) return true;
    if (Object.values(state.scenes).some(Boolean)) return true;
    return false;
  }

  async function loadShop(id) {
    const key = String(id || "").trim();
    const loader = window.TasuDetailShopStoreLoader;
    if (loader?.fetchShopStoreDetailById) {
      const hit = await loader.fetchShopStoreDetailById(key);
      if (hit) return hit;
    }
    if (loader?.isShopStoreOtherDemoId?.(key)) {
      window.TasuListingLocalStore?.ensureShopStoreOtherDemo?.();
      const local = loader.loadLocalShopRecord?.(key);
      if (local) return local;
      return loader.getFallbackShopListing?.(key) || loader.buildShopStoreOtherDemoInline?.({ id: key }) || null;
    }
    if (window.TasuListingLocalStore?.fetchById) {
      window.TasuListingLocalStore.ensureShopStoreOtherDemo?.();
      const record = window.TasuListingLocalStore.fetchById(key);
      if (record && window.TasuListingLocalStore.resolveListingTypeKey?.(record) === "shop_store") {
        const local = loader?.loadLocalShopRecord?.(key);
        if (local) return local;
        return window.TasuListingLocalStore.toDetailListing?.(record) || record;
      }
    }
    if (window.TasuShopStoreDemo?.getById && /^demo-shop-/.test(key)) {
      return window.TasuShopStoreDemo.getById(key);
    }
    return null;
  }

  function getCategoryLabel(shop, categoryKey) {
    if (window.TasuShopDetailCategory?.getConfigForListing) {
      return window.TasuShopDetailCategory.getConfigForListing(shop).categoryLabel || "";
    }
    const map = {
      restaurant: "飲食・カフェ",
      retail: "小売・物販",
      vintage_brand: "古着・ブランド",
      goods_interior: "雑貨・インテリア",
      food_retail: "食品販売",
      hobby_anime: "ホビー・アニメ・トレカ",
      pet: "ペット用品",
      tools_equipment: "工具・機材・買取",
      other: "その他",
    };
    return map[categoryKey] || "店舗・販売";
  }

  function shopHeroImage(shop) {
    return (
      shop?.image_url ||
      shop?.main_image ||
      shop?.image ||
      shop?.thumbnail_url ||
      (Array.isArray(shop?.gallery_urls) ? shop.gallery_urls[0] : "") ||
      (Array.isArray(shop?.gallery) ? shop.gallery[0] : "") ||
      (Array.isArray(shop?.images) ? shop.images[0] : "") ||
      ""
    );
  }

  function shopName(shop) {
    const extra = shop?.category_extra?.shop_store || shop?.form_data?.category_extra?.shop_store || {};
    return String(extra.shop_name || shop?.company_name || shop?.title || "店舗").trim();
  }

  function buildStars(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const filled = Math.min(5, Math.max(0, Math.round(r)));
    return "★".repeat(filled) + "☆".repeat(5 - filled);
  }

  function isFavorite(id) {
    try {
      const list = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      return Array.isArray(list) && list.includes(id);
    } catch {
      return false;
    }
  }

  function toggleFavorite(id) {
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      if (!Array.isArray(list)) list = [];
    } catch {
      list = [];
    }
    const idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(id);
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
  }

  function applyFilters() {
    let list = [...state.products];
    const kw = state.keyword.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(kw) ||
          p.description.toLowerCase().includes(kw) ||
          p.category.toLowerCase().includes(kw)
      );
    }
    if (state.activeCategory && state.activeCategory !== "すべて") {
      list = list.filter(
        (p) => p.category === state.activeCategory || p.category.includes(state.activeCategory)
      );
    }
    if (state.priceMin != null) list = list.filter((p) => p.priceNum >= state.priceMin);
    if (state.priceMax != null) list = list.filter((p) => p.priceNum > 0 && p.priceNum <= state.priceMax);
    if (state.commitment.recommended) list = list.filter((p) => p.isRecommended);
    if (state.commitment.new) list = list.filter((p) => p.isNew);
    if (state.commitment.sale) list = list.filter((p) => p.isSale);
    if (state.commitment.popular) {
      list = list.filter((p) => p.isPopular || p.isRecommended || p.badges.some((b) => b.kind === "popular"));
    }
    if (state.commitment.instock) list = list.filter((p) => p.inStock && !p.soldOut);

    const activeScenes = Object.entries(state.scenes)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (activeScenes.length) {
      list = list.filter((p) => activeScenes.some((s) => p.sceneTags.includes(s)));
    }

    if (state.sort === "price_asc") {
      list.sort((a, b) => a.priceNum - b.priceNum);
    } else if (state.sort === "price_desc") {
      list.sort((a, b) => b.priceNum - a.priceNum);
    } else if (state.sort === "new") {
      list.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || b.priceNum - a.priceNum);
    } else if (state.sort === "popular") {
      list.sort((a, b) => popularityScore(b) - popularityScore(a) || b.priceNum - a.priceNum);
    } else {
      list.sort((a, b) => popularityScore(b) - popularityScore(a) || a.priceNum - b.priceNum);
    }

    state.filtered = list;
    state.visibleLimit = PAGE_SIZE;
  }

  function renderBreadcrumb(shop) {
    const name = shopName(shop);
    const listLabel = state.categoryKey === "restaurant" ? "メニュー一覧" : "商品一覧";
    const detailHref = buildDetailUrl(shop.id);
    window.TasuCommonBreadcrumb?.ensureParentEntry?.({
      label: name,
      href: detailHref,
    });
    window.TasuCommonBreadcrumb?.setCurrentLabel(listLabel);
  }

  function renderShopHero(shop) {
    const wrap = $("[data-shop-products-hero]");
    if (!wrap) return;
    const id = String(shop.id || "").trim();
    const name = shopName(shop);
    const catLabel = getCategoryLabel(shop, state.categoryKey);
    const rating = Number(shop.rating || 0) || 4.8;
    const reviews = Number(shop.review_count || shop.reviewCount || 0) || 0;
    const favCount = Math.max(reviews, 12);
    const favOn = isFavorite(id);
    const img = shopHeroImage(shop) || window.TasuShopProductsConfig.getCategoryFallbackImage(state.categoryKey);
    const heroFallback = escAttr(
      window.TasuShopProductsConfig.getCategoryFallbackImage(state.categoryKey)
    );
    const brandFallback = escAttr(window.TasuShopProductsConfig.getBrandPlaceholderUri());

    wrap.className = "shop-products-store-card shop-products-hero";
    wrap.innerHTML = `
      <div class="shop-products-store-image-wrap">
        <img
          class="shop-products-store-image"
          src="${escAttr(img)}"
          alt=""
          width="120"
          height="120"
          loading="eager"
          decoding="async"
          data-sp-fallback="${heroFallback}"
          data-sp-brand="${brandFallback}"
          onerror="window.tasuShopProductsImgFallback(this)"
        >
      </div>
      <div class="shop-products-store-main">
        <p class="shop-products-store-category">${esc(catLabel)}</p>
        <h1 class="shop-products-store-name">${esc(name)}</h1>
        <div class="shop-products-store-meta">
          <div class="shop-products-rating-row">
            <div class="shop-products-rating-group" aria-label="評価 ${esc(rating.toFixed(1))}">
              <span class="shop-products-rating-stars" aria-hidden="true">${esc(buildStars(rating))}</span>
              <span class="shop-products-rating-score">${esc(rating.toFixed(1))}</span>
              <span class="shop-products-rating-count">（${esc(String(reviews))}件の口コミ）</span>
            </div>
            <a class="shop-products-detail-btn" href="${escAttr(buildDetailUrl(id))}">ショップ詳細を見る</a>
          </div>
        </div>
      </div>
      <div class="shop-products-favorite-area">
        <button
          type="button"
          class="shop-products-favorite-btn shop-products-fav-btn${favOn ? " is-active" : ""}"
          data-shop-fav-shop="${escAttr(id)}"
          aria-label="お気に入りに追加"
        >
          <span class="shop-products-favorite-btn__icon" aria-hidden="true">${favOn ? "♥" : "♡"}</span>
          お気に入りに追加
        </button>
        <span class="shop-products-favorite-count" aria-label="お気に入り${esc(String(favCount))}件">${esc(String(favCount))}</span>
      </div>
    `;
  }

  function renderCommitmentFilters() {
    const host = $("[data-shop-products-filter-commitment]");
    if (!host) return;
    const options = window.TasuShopProductsConfig.getCommitmentOptions();
    host.innerHTML = options
      .map(
        (o) => `
        <label class="shop-products-filter__check">
          <input type="checkbox" data-filter-commitment="${escAttr(o.id)}" ${
          state.commitment[o.id] ? "checked" : ""
        }>
          <span>${esc(o.label)}</span>
        </label>`
      )
      .join("");
  }

  function renderSidebarFilters() {
    const catHost = $("[data-shop-products-filter-categories]");
    const sceneHost = $("[data-shop-products-filter-scenes]");
    if (!catHost) return;

    catHost.innerHTML = state.filterCategories
      .map(
        (label) =>
          `<button type="button" class="shop-products-filter__link${
            state.activeCategory === label ? " is-active" : ""
          }" data-filter-category="${escAttr(label)}">${esc(label)}</button>`
      )
      .join("");

    if (sceneHost) {
      const scenes = window.TasuShopProductsConfig.getSceneOptions(state.categoryKey);
      sceneHost.innerHTML = scenes
        .map(
          (s) => `
        <label class="shop-products-filter__check">
          <input type="checkbox" data-filter-scene="${escAttr(s.id)}" ${state.scenes[s.id] ? "checked" : ""}>
          <span>${esc(s.label)}</span>
        </label>`
        )
        .join("");
    }
    renderCommitmentFilters();
  }

  function buildLeadText() {
    const copy = window.TasuShopProductsConfig.getPageCopy(state.categoryKey);
    const name = state.shop ? shopName(state.shop) : "店舗";
    return `${name}${copy.leadSuffix || "の商品をご覧ください。"}`;
  }

  function mountControls() {
    const controls = $("[data-shop-products-controls]");
    const chips = $("[data-shop-products-chips]");
    const grid = $("[data-shop-products-grid]");
    if (!controls || !grid) {
      console.warn("[shop-products] controls mount failed — DOM missing");
      return false;
    }
    controls.hidden = false;
    controls.style.display = "";
    if (chips) {
      chips.hidden = false;
      chips.style.display = "";
    }
    console.log("[shop-products] controls mounted");
    return true;
  }

  function renderHeading() {
    const copy = window.TasuShopProductsConfig.getPageCopy(state.categoryKey);
    const titleEl = $("[data-shop-products-title]");
    const leadEl = $("[data-shop-products-lead]");
    if (titleEl) titleEl.textContent = copy.title || "商品一覧";
    if (leadEl) leadEl.textContent = buildLeadText();
  }

  function renderControls() {
    mountControls();
    renderHeading();

    const total = state.products.length;
    const shown = state.filtered.length;
    const totalEl = $("[data-shop-products-count-total]");
    const filteredEl = $("[data-shop-products-count-filtered]");
    if (totalEl) totalEl.textContent = `全${total}件`;
    if (filteredEl) {
      if (hasActiveFilters()) {
        filteredEl.textContent = `検索後：該当${shown}件`;
        filteredEl.hidden = false;
      } else {
        filteredEl.hidden = true;
      }
    }

    const selectCat = $("#productCategorySelect") || $("[data-shop-products-select-category]");
    if (selectCat) {
      selectCat.innerHTML = state.filterCategories
        .map((c) => {
          const label = c === "すべて" ? "カテゴリを選択" : c;
          return `<option value="${escAttr(c)}">${esc(label)}</option>`;
        })
        .join("");
      selectCat.value = state.activeCategory;
    }

    const sortEl = $("#productSortSelect") || $("[data-shop-products-sort]");
    if (sortEl) sortEl.value = state.sort;

    const searchEl = $("#productSearchInput") || $("[data-shop-products-search]");
    if (searchEl && searchEl.value !== state.keyword) searchEl.value = state.keyword;

    console.log("[shop-products] filtered count", shown);
  }

  function renderCategoryChips() {
    const host = $("[data-shop-products-chips]");
    if (!host) return;
    host.innerHTML = state.filterCategories
      .map(
        (label) =>
          `<button type="button" class="shop-products-chip${
            state.activeCategory === label ? " is-active" : ""
          }" data-filter-category="${escAttr(label)}" role="tab" aria-selected="${
            state.activeCategory === label
          }">${esc(label)}</button>`
      )
      .join("");
  }

  function buildProductDetailUrl(productId) {
    const shopId = getShopId() || String(state.shop?.id || state.shop?.demo_id || "").trim();
    const pid = String(productId || "").trim();
    if (!shopId || !pid) return "detail-shop-store-product.html";
    return `detail-shop-store-product.html?shopId=${encodeURIComponent(shopId)}&productId=${encodeURIComponent(pid)}`;
  }

  function buildProductCard(p) {
    const badges = p.badges
      .map(
        (b) =>
          `<span class="shop-products-card__badge shop-products-card__badge--${escAttr(b.kind)}">${esc(b.label)}</span>`
      )
      .join("");
    const showTax = !/税込/.test(p.price);
    const priceHtml = p.priceWas
      ? `<span class="shop-products-card__price shop-products-card__price--sale">${esc(p.price)}</span><span class="shop-products-card__price-was">${esc(p.priceWas)}</span>`
      : `<span class="shop-products-card__price">${esc(p.price)}</span>`;
    const taxHtml = showTax ? `<small class="shop-products-card__tax">（税込）</small>` : "";
    const detailHref = buildProductDetailUrl(p.id);
    const mediaClass = "shop-products-card__media product-card-image";
    return `
      <article class="shop-products-card product-card${p.soldOut ? " is-sold-out" : ""}" data-product-id="${escAttr(p.id)}">
        <a class="shop-products-card__link" href="${escAttr(detailHref)}" aria-label="${escAttr(p.title)}の詳細">
        <div class="${mediaClass}">
          <img
            src="${escAttr(p.image)}"
            alt=""
            loading="lazy"
            decoding="async"
            data-sp-fallback="${escAttr(p.categoryFallback)}"
            data-sp-brand="${escAttr(p.brandPlaceholder)}"
            onerror="window.tasuShopProductsImgFallback(this)"
          >
          ${badges ? `<div class="shop-products-card__badges">${badges}</div>` : ""}
          <button type="button" class="shop-products-card__fav" data-product-fav="${escAttr(p.id)}" aria-label="お気に入り">♡</button>
          ${p.soldOut ? '<span class="shop-products-card__soldout">SOLD OUT</span>' : ""}
        </div>
        <div class="shop-products-card__body product-card-body">
          <h3 class="shop-products-card__name">${esc(p.title)}</h3>
          <p class="shop-products-card__desc">${esc(p.description)}</p>
          <div class="shop-products-card__price-row product-card-price">${priceHtml}${taxHtml}</div>
        </div>
        </a>
      </article>
    `;
  }

  function renderGrid() {
    const grid = $("[data-shop-products-grid]");
    const empty = $("[data-shop-products-empty]");
    const moreWrap = $("[data-shop-products-more-wrap]");
    const moreBtn = $("[data-shop-products-more]");
    if (!grid) return;

    const slice = state.filtered.slice(0, state.visibleLimit);
    if (!slice.length) {
      grid.innerHTML = "";
      if (empty) empty.hidden = false;
      if (moreWrap) moreWrap.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    grid.innerHTML = slice.map(buildProductCard).join("");

    const remaining = Math.max(0, state.filtered.length - state.visibleLimit);
    if (moreWrap) moreWrap.hidden = remaining <= 0;
    if (moreBtn && remaining > 0) {
      moreBtn.textContent = `もっと見る（残り${remaining}件）`;
    }
  }

  function renderPagination() {
    const host = $("[data-shop-products-pagination]");
    if (!host) return;
    const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    const current = Math.ceil(state.visibleLimit / PAGE_SIZE);
    if (totalPages <= 1) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    const pages = [];
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
      pages.push(
        `<button type="button" class="shop-products-page__num${i === current ? " is-active" : ""}" data-page="${i}">${i}</button>`
      );
    }
    host.innerHTML = `${pages.join("")}${totalPages > 5 ? '<span class="shop-products-page__dots">…</span>' : ""}`;
  }

  function renderServices() {
    const host = $("[data-shop-products-services]");
    if (!host) return;
    const perks = window.TasuShopProductsConfig.getServicePerks(state.categoryKey);
    const cards = perks
      .map((p) => {
        const inquiryCls = /お問い合わせ/.test(p.title) ? " shop-products-service--inquiry" : "";
        const inner = `
        <span class="shop-products-service__icon" aria-hidden="true">${esc(p.icon)}</span>
        <h3 class="shop-products-service__title">${esc(p.title)}</h3>
        <p class="shop-products-service__text">${esc(p.text)}</p>`;
        if (p.ctaHref) {
          return `<a class="shop-products-service${inquiryCls}" href="${escAttr(p.ctaHref)}">${inner}</a>`;
        }
        return `<div class="shop-products-service${inquiryCls}">${inner}</div>`;
      })
      .join("");
    host.hidden = false;
    host.innerHTML = `
      <div class="shop-products-block__head">
        <h2 class="shop-products-block__title">サービス情報</h2>
      </div>
      <div class="shop-products-services__grid">${cards}</div>
    `;
  }

  function clampReviewText(text, max = 72) {
    const t = String(text || "").trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
  }

  function renderReviews() {
    const host = $("[data-shop-products-reviews]");
    if (!host || !state.shop) return;
    const shop = state.shop;
    const id = String(shop.id || "").trim();
    const rating = Number(shop.rating || 0) || 4.8;
    const count = Number(shop.review_count || shop.reviewCount || 0) || 35;
    const reviews = window.TasuShopProductsConfig.getDemoReviews(state.categoryKey);
    const detailUrl = `${buildDetailUrl(id)}#section-reviews`;
    const items = reviews
      .slice(0, 2)
      .map(
        (r) => `
      <article class="shop-products-review">
        <div class="shop-products-review__meta">
          <span class="shop-products-review__stars" aria-hidden="true">${esc(buildStars(r.rating))}</span>
          <span class="shop-products-review__name">${esc(r.name)}</span>
          <time class="shop-products-review__date" datetime="${escAttr(r.date)}">${esc(r.date)}</time>
        </div>
        <p class="shop-products-review__text">${esc(clampReviewText(r.text))}</p>
      </article>`
      )
      .join("");

    host.hidden = false;
    host.innerHTML = `
      <div class="shop-products-block__head">
        <h2 class="shop-products-block__title">口コミ</h2>
        <a class="shop-products-block__link" href="${escAttr(detailUrl)}">すべて見る ›</a>
      </div>
      <div class="shop-products-reviews__summary" aria-label="評価 ${esc(rating.toFixed(1))}">
        <span class="shop-products-reviews__score">${esc(rating.toFixed(1))}</span>
        <span class="shop-products-reviews__stars" aria-hidden="true">${esc(buildStars(rating))}</span>
        <span class="shop-products-reviews__count">（${esc(String(count))}件）</span>
      </div>
      <div class="shop-products-reviews__list">${items}</div>
    `;
  }

  function pickRecommendedProducts(limit = 4) {
    return [...state.products]
      .sort((a, b) => popularityScore(b) - popularityScore(a) || b.priceNum - a.priceNum)
      .slice(0, limit);
  }

  function renderRecommended() {
    const host = $("[data-shop-products-recommended]");
    if (!host) return;
    const picks = pickRecommendedProducts(4);
    if (!picks.length) {
      host.hidden = true;
      return;
    }
    const title = state.categoryKey === "restaurant" ? "おすすめメニュー" : "おすすめ商品";
    host.hidden = false;
    host.innerHTML = `
      <div class="shop-products-block__head">
        <h2 class="shop-products-block__title">${esc(title)}</h2>
      </div>
      <div class="shop-products-recommended__rail">
        <div class="shop-products-recommended__grid" aria-label="${escAttr(title)}">${picks.map(buildProductCard).join("")}</div>
      </div>
    `;
  }

  function bindFilterEvents() {
    $all("[data-filter-commitment]").forEach((el) => {
      el.addEventListener("change", () => {
        const key = el.getAttribute("data-filter-commitment");
        if (key) state.commitment[key] = el.checked;
        refresh();
      });
    });
    $all("[data-filter-scene]").forEach((el) => {
      el.addEventListener("change", () => {
        const key = el.getAttribute("data-filter-scene");
        if (key) state.scenes[key] = el.checked;
        refresh();
      });
    });
  }

  function refresh() {
    applyFilters();
    renderControls();
    renderCategoryChips();
    renderSidebarFilters();
    bindFilterEvents();
    renderGrid();
    renderPagination();
  }

  function bindEvents() {
    document.addEventListener("click", (ev) => {
      const catBtn = ev.target.closest("[data-filter-category]");
      if (catBtn) {
        state.activeCategory = catBtn.getAttribute("data-filter-category") || "すべて";
        const sel = $("[data-shop-products-select-category]");
        if (sel) sel.value = state.activeCategory;
        refresh();
        return;
      }
      const pageBtn = ev.target.closest("[data-page]");
      if (pageBtn) {
        const page = Number(pageBtn.getAttribute("data-page")) || 1;
        state.visibleLimit = page * PAGE_SIZE;
        renderGrid();
        renderPagination();
        window.scrollTo({ top: $("[data-shop-products-grid]")?.offsetTop - 100 || 0, behavior: "smooth" });
        return;
      }
      const moreBtn = ev.target.closest("[data-shop-products-more]");
      if (moreBtn) {
        state.visibleLimit += PAGE_SIZE;
        renderGrid();
        renderPagination();
        return;
      }
      const shopFav = ev.target.closest("[data-shop-fav-shop]");
      if (shopFav) {
        toggleFavorite(shopFav.getAttribute("data-shop-fav-shop"));
        if (state.shop) renderShopHero(state.shop);
        return;
      }
      const prodFav = ev.target.closest("[data-product-fav]");
      if (prodFav) {
        ev.preventDefault();
        ev.stopPropagation();
        prodFav.classList.toggle("is-active");
        prodFav.textContent = prodFav.classList.contains("is-active") ? "♥" : "♡";
        return;
      }
      const filterToggle = ev.target.closest("[data-shop-products-filter-toggle]");
      if (filterToggle) {
        $("[data-shop-products-sidebar]")?.classList.toggle("is-open");
      }
    });

    $("[data-shop-products-search]")?.addEventListener("input", (ev) => {
      state.keyword = ev.target.value || "";
      refresh();
    });

    $("[data-shop-products-select-category]")?.addEventListener("change", (ev) => {
      state.activeCategory = ev.target.value || "すべて";
      refresh();
    });

    $("[data-shop-products-sort]")?.addEventListener("change", (ev) => {
      state.sort = ev.target.value || "recommended";
      refresh();
    });

    $(".shop-products-search__btn")?.addEventListener("click", () => {
      const input = $("#productSearchInput") || $("[data-shop-products-search]");
      if (input) state.keyword = input.value || "";
      refresh();
    });

    $("[data-shop-products-price-apply]")?.addEventListener("click", () => {
      const min = $("[data-shop-products-price-min]")?.value;
      const max = $("[data-shop-products-price-max]")?.value;
      state.priceMin = min ? Number(min) : null;
      state.priceMax = max ? Number(max) : null;
      refresh();
    });
  }

  function showError(message) {
    const main = $("[data-shop-products-main]");
    if (main) {
      main.innerHTML = `<div class="shop-products-error"><p>${esc(message)}</p><a href="shop-vendors.html">店舗一覧へ戻る</a></div>`;
    }
  }

  async function init() {
    const id = getShopId();
    console.log("[shop-products] load", id);
    if (!id) {
      showError("店舗IDが指定されていません。");
      return;
    }

    const shop = await loadShop(id);
    if (!shop) {
      showError("店舗が見つかりませんでした。");
      return;
    }

    state.shop = shop;
    state.categoryKey = window.TasuShopProductsConfig.resolveCategoryKey(shop);
    document.body.dataset.shopProductsCategory = state.categoryKey;

    const shopProducts = collectProductsFromShop(shop, state.categoryKey);
    const demoRaw = window.TasuShopProductsConfig.getDemoProducts(state.categoryKey, id);
    const demoProducts = demoRaw.map((r, i) => normalizeProduct(r, i, state.categoryKey, shop)).filter(Boolean);
    state.products = mergeProducts(shopProducts, demoProducts);
    const skipExtraDemo = /kiichi-dining|kichi-dining/.test(id);
    if (state.products.length < 8 && !skipExtraDemo) {
      const extra = window.TasuShopProductsConfig
        .getDemoProducts(state.categoryKey)
        .map((r, i) => normalizeProduct(r, i, state.categoryKey, shop))
        .filter(Boolean);
      state.products = mergeProducts(state.products, extra);
    }

    buildFilterCategoriesList();

    const copy = window.TasuShopProductsConfig.getPageCopy(state.categoryKey);
    document.title = `${shopName(shop)} — ${copy.title} | TASFUL`;

    renderBreadcrumb(shop);
    renderShopHero(shop);
    renderServices();
    renderReviews();
    renderRecommended();
    mountControls();
    bindEvents();
    refresh();

    window.scrollTo(0, 0);
    if (global.history?.scrollRestoration) global.history.scrollRestoration = "manual";

    console.log("[shop-products] ready", state.categoryKey, id, state.products.length);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
