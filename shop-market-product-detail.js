/**
 * TASFUL市場 — 商品詳細（shop-search と同一カタログ）
 */
(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;

  window.__tasfulMarketDetailShelfImgError = function (img) {
    const card = img?.closest?.(".tasful-market-search-mini");
    if (!card || card.classList.contains("tasful-market-search-mini--placeholder")) return;
    card.remove();
  };

  window.__tasfulMarketDetailMainImgError = function (img) {
    window.__tasfulMarketImgError?.(img);
  };

  const FOLLOW_KEY = "tasu_market_followed_sellers";

  const TRUST_DEFAULTS = {
    connectVerified: true,
    identityVerified: true,
    completedDeals: 198,
    repeatRate: 42,
    averageReplyMinutes: 18,
    ratingBreakdown: { 5: 78, 4: 15, 3: 4, 2: 2, 1: 1 },
  };

  const TRUST_TOOLTIPS = {
    connect:
      "TASFUL市場が、品質・梱包・配送対応など一定基準を満たしていると確認した出品者です。",
    identity: "公的証明書による本人確認が完了している出品者です。",
  };

  const state = {
    product: null,
    pool: [],
    shopId: "",
    productId: "",
    qty: 1,
    gallery: [],
    reviewStars: 0,
    openReview: false,
    bundleItems: [],
    relatedExpanded: false,
  };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(s) {
    return Data?.esc?.(s) ?? String(s ?? "");
  }

  function readParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      shopId: String(params.get("shopId") || params.get("shop_id") || "").trim(),
      productId: String(params.get("productId") || params.get("product_id") || "").trim(),
      openReview: ["1", "true"].includes(String(params.get("review") || "").trim().toLowerCase()),
    };
  }

  function setStatus(message, isError) {
    const el = $("[data-tasful-product-status]");
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.style.color = isError ? "#b91c1c" : "#6b7280";
  }

  function hideStatus() {
    const el = $("[data-tasful-product-status]");
    if (el) el.hidden = true;
  }

  function showMain() {
    $("[data-tasful-product-main]")?.removeAttribute("hidden");
  }

  function formatHeroPrice(product) {
    const base = Data.normalizePriceBase(product.price);
    if (!base || base === "¥—") return "¥—";
    return base;
  }

  function formatPriceHtml(product) {
    return `${esc(formatHeroPrice(product))} <span class="tasful-market-product-hero__price-tax">(税込)</span>`;
  }

  function resolveRatingBreakdown(product) {
    const seed = Data.seedFromProduct?.(product) ?? 0;
    const base = { ...TRUST_DEFAULTS.ratingBreakdown };
    const shift = seed % 5;
    if (shift) {
      base[5] = Math.max(55, base[5] - shift);
      base[4] = Math.min(25, base[4] + Math.floor(shift / 2));
    }
    return base;
  }

  function resolveTrustData(product) {
    const profile = Data.buildSellerProfile(product);
    return {
      connectVerified:
        product?.connectVerified != null ? Boolean(product.connectVerified) : TRUST_DEFAULTS.connectVerified,
      identityVerified: Boolean(
        product?.identityVerified ?? product?.identity_verified ?? profile.identityVerified ?? TRUST_DEFAULTS.identityVerified
      ),
      completedDeals:
        Number(product?.completedDeals ?? product?.completed_deals ?? profile.salesCount) ||
        TRUST_DEFAULTS.completedDeals,
      repeatRate:
        Number(product?.repeatRate ?? product?.repeat_rate ?? profile.repeatRate) || TRUST_DEFAULTS.repeatRate,
      averageReplyMinutes:
        Number(product?.averageReplyMinutes ?? product?.average_reply_minutes ?? profile.averageReplyMinutes) ||
        TRUST_DEFAULTS.averageReplyMinutes,
      ratingBreakdown: resolveRatingBreakdown(product),
    };
  }

  function buildTrustBadgeHtml(type, label) {
    const tipId = `tasful-trust-tip-${type}`;
    const tip = TRUST_TOOLTIPS[type] || "";
    return `<span class="tasful-market-product-trust__badge-group"><span class="tasful-market-product-trust__badge tasful-market-product-trust__badge--${type}">${esc(label)}</span><button type="button" class="tasful-market-product-trust__help" aria-label="${Data.escAttr(`${label}について`)}" aria-describedby="${tipId}" data-tasful-trust-help="${type}"><span aria-hidden="true">?</span></button><span class="tasful-market-product-trust__tooltip" id="${tipId}" role="tooltip">${esc(tip)}</span></span>`;
  }

  function buildTrustLinesHtml(trust) {
    const lines = [];
    if (trust.connectVerified) {
      lines.push(buildTrustBadgeHtml("connect", "Connect認証済み"));
    }
    if (trust.identityVerified) {
      lines.push(buildTrustBadgeHtml("identity", "本人確認済み"));
    }
    lines.push(`<span class="tasful-market-product-trust__meta">取引${esc(trust.completedDeals)}件</span>`);
    lines.push(`<span class="tasful-market-product-trust__meta">リピーター率${esc(trust.repeatRate)}%</span>`);
    lines.push(`<span class="tasful-market-product-trust__meta">平均返信${esc(trust.averageReplyMinutes)}分</span>`);
    return lines.join("");
  }

  function shipSummary(product) {
    const sameDay = Data.isSameDayShipping?.(product);
    const days = sameDay ? "当日発送" : product.shipDays || "1〜2日以内発送";
    const deadline = sameDay ? "（あと3時間以内の注文）" : "";
    const free = product.freeShipping ? "送料無料" : "";
    return { sameDay, days, deadline, free };
  }

  function stockLabel(product) {
    if (product.inStock === false) return { text: "在庫なし", low: true };
    const seed = Data.seedFromProduct?.(product) ?? 0;
    if (seed % 7 === 0) return { text: "残りわずか", low: true };
    return { text: "在庫あり", low: false };
  }

  function applyMainImage(img, src, label) {
    if (!img) return;
    img.alt = "";
    img.onerror = () => window.__tasfulMarketImgError?.(img);
    img.src = src || Data.getFallbackImageUrl();
  }

  function renderThumbnails(product) {
    const wrap = $("[data-tasful-product-thumbs]");
    const mainImg = $("[data-tasful-product-image]");
    const caption = $("[data-tasful-product-thumb-caption]");
    if (!wrap || !mainImg) return;

    state.gallery = Data.getProductGallery(product);
    if (!state.gallery.length) {
      state.gallery = [{ id: "main", src: Data.resolvePrimaryImage(product), label: "商品画像", kind: "main" }];
    }

    wrap.innerHTML = state.gallery
      .map(
        (item, i) =>
          `<button type="button" class="tasful-market-product-thumbs__btn${i === 0 ? " is-active" : ""}" data-tasful-product-thumb="${i}" data-tasful-product-thumb-label="${Data.escAttr(item.label)}" aria-label="${Data.escAttr(item.label)}"><img src="${Data.escAttr(item.src)}" alt="" width="56" height="56" decoding="async"${Data.productImageOnErrorAttr()}></button>`
      )
      .join("");

    const first = state.gallery[0];
    applyMainImage(mainImg, first?.src, first?.label || "商品画像");
    if (caption) {
      caption.hidden = !first?.label;
      caption.textContent = first?.label || "";
    }
  }

  function renderRecommendPoints(product) {
    const list = $("[data-tasful-product-points]");
    if (!list) return;
    const points = Data.buildRecommendPoints(product);
    list.innerHTML = points.map((p) => `<li>${esc(p)}</li>`).join("");
  }

  function renderBrand(product) {
    const el = $("[data-tasful-product-brand]");
    if (!el) return;
    const profile = Data.buildSellerProfile(product);
    el.innerHTML = `<a href="${Data.escAttr(profile.shopUrl)}">${esc(product.shopName || profile.name)}</a>`;
  }

  function renderTrustBlock(product) {
    const el = $("[data-tasful-product-trust]");
    if (!el) return;
    el.innerHTML = buildTrustLinesHtml(resolveTrustData(product));
  }

  function renderCommerceBlocks(product) {
    const ship = shipSummary(product);
    const stock = stockLabel(product);
    const priceHtml = formatPriceHtml(product);

    const centerPrice = $("[data-tasful-product-price]");
    if (centerPrice) centerPrice.innerHTML = priceHtml;

    const mobilePrice = $("[data-tasful-product-price-mobile]");
    if (mobilePrice) mobilePrice.innerHTML = priceHtml;

    const buyboxPrice = $("[data-tasful-product-buybox-price]");
    if (buyboxPrice) buyboxPrice.innerHTML = priceHtml;

    const shipFreeEls = document.querySelectorAll("[data-tasful-product-ship-free]");
    shipFreeEls.forEach((shipFree) => {
      shipFree.hidden = !product.freeShipping;
      shipFree.textContent = "送料無料";
    });

    const shipDays = $("[data-tasful-product-ship-days]");
    const shipDeadline = $("[data-tasful-product-ship-deadline]");
    const shipDaysMobile = $("[data-tasful-product-ship-days-mobile]");
    const shipFreeMobile = $("[data-tasful-product-ship-free-mobile]");
    if (shipDays) shipDays.textContent = ship.days;
    if (shipDaysMobile) shipDaysMobile.textContent = ship.days;
    if (shipFreeMobile) {
      shipFreeMobile.hidden = !product.freeShipping;
      shipFreeMobile.textContent = "送料無料";
    }
    if (shipDeadline) {
      shipDeadline.hidden = !ship.sameDay;
      shipDeadline.textContent = ship.deadline;
    }

    const buyboxShip = $("[data-tasful-product-buybox-ship]");
    if (buyboxShip) {
      const parts = [ship.days];
      if (product.freeShipping) parts.unshift("送料無料");
      buyboxShip.textContent = parts.join(" · ");
    }

    const stockEls = document.querySelectorAll("[data-tasful-product-stock], [data-tasful-product-buybox-stock]");
    stockEls.forEach((stockEl) => {
      stockEl.textContent = stock.text;
      stockEl.classList.toggle("is-low", stock.low);
    });

    const connectEl = $("[data-tasful-product-connect]");
    if (connectEl) connectEl.hidden = true;
  }

  function renderCenterAbout(product) {
    const list = $("[data-tasful-product-about-inline-list]");
    if (!list) return;
    const bullets = Data.buildProductFeatureBullets?.(product) || Data.buildAboutBullets(product);
    list.innerHTML = bullets.slice(0, 5).map((b) => `<li>${esc(b)}</li>`).join("");
  }

  function buildSellerLinks(product) {
    const profile = Data.buildSellerProfile(product);
    const shopId = String(product?.shopId || profile.shopId || "").trim();
    const storeTop = `detail-shop-store.html?id=${encodeURIComponent(shopId)}`;
    const products = `shop-products.html?id=${encodeURIComponent(shopId)}`;
    const storeReviews = `${storeTop}#reviews`;
    return { profile, shopId, storeTop, products, storeReviews };
  }

  function buildVerifyBadgeHtml(trust) {
    const parts = [];
    if (trust.connectVerified) {
      parts.push(`<span class="tasful-market-product-verify__item">✓ Connect認証済み</span>`);
    }
    if (trust.identityVerified) {
      parts.push(`<span class="tasful-market-product-verify__item">✓ 本人確認済み</span>`);
    }
    return parts.join("");
  }

  function buildRatingLabelHtml(product, profile) {
    const stars = esc(Data.formatStarDisplay(product.ratingScore || profile.rating));
    const score = esc(Data.formatReviewScore(product.ratingScore || profile.rating));
    const reviewCount = Number(product.reviewCount ?? profile.reviewCount) || 0;
    return `<span class="tasful-market-product-rating-line" aria-label="評価 ${score}、レビュー${reviewCount}件"><span class="tasful-market-product-rating-line__stars" aria-hidden="true">${stars}</span> <span class="tasful-market-product-rating-line__score">${score}</span></span><span class="tasful-market-product-rating-line__reviews">レビュー${esc(reviewCount)}件</span>`;
  }

  function buildDealsLabelHtml(trust) {
    return `<span class="tasful-market-product-deals-line">取引${esc(trust.completedDeals)}件</span>`;
  }

  function renderBuyboxTrust(product) {
    const el = $("[data-tasful-product-buybox-trust]");
    if (!el) return;
    const profile = Data.buildSellerProfile(product);
    const trust = resolveTrustData(product);
    const badges = buildVerifyBadgeHtml(trust);
    el.innerHTML = `${badges ? `<div class="tasful-market-product-buybox__trust-badges">${badges}</div>` : ""}<p class="tasful-market-product-buybox__trust-rating">${buildRatingLabelHtml(product, profile)}</p><p class="tasful-market-product-buybox__trust-deals">${buildDealsLabelHtml(trust)}</p>`;
  }

  function renderBuyboxStore(product) {
    const el = $("[data-tasful-product-buybox-store]");
    if (!el) return;
    const { profile, storeTop, products, storeReviews } = buildSellerLinks(product);
    const trust = resolveTrustData(product);
    const badges = buildVerifyBadgeHtml(trust);
    el.innerHTML = `<h3 class="tasful-market-product-buybox__store-name"><a href="${Data.escAttr(storeTop)}">${esc(profile.name)}</a></h3><p class="tasful-market-product-buybox__store-rating">${buildRatingLabelHtml(product, profile)}</p><p class="tasful-market-product-buybox__store-meta"><span class="tasful-market-product-buybox__store-reviews">レビュー${esc(profile.reviewCount)}件</span><span class="tasful-market-product-buybox__store-sep"> / </span><span class="tasful-market-product-buybox__store-deals">取引${esc(trust.completedDeals)}件</span></p>${badges ? `<div class="tasful-market-product-buybox__store-badges">${badges}</div>` : ""}<div class="tasful-market-product-buybox__store-actions"><a class="tasful-market-product-buybox__store-btn" href="${Data.escAttr(storeTop)}">店舗TOPを見る</a><a class="tasful-market-product-buybox__store-btn" href="${Data.escAttr(products)}">店舗の商品一覧</a><a class="tasful-market-product-buybox__store-btn" href="${Data.escAttr(storeReviews)}">店舗レビュー</a><button type="button" class="tasful-market-product-buybox__store-btn tasful-market-product-buybox__store-btn--follow" data-tasful-product-buybox-follow>フォローする</button></div>`;
    syncSellerFollowButton();
  }

  function renderBuyboxSeller(product) {
    renderBuyboxTrust(product);
    renderBuyboxStore(product);
  }

  function renderSpecsMini(product) {
    const el = $("[data-tasful-product-specs-mini]");
    if (!el) return;
    const ship = shipSummary(product);
    const shipText = [product.freeShipping ? "送料無料" : "", ship.days].filter(Boolean).join(" · ");
    const miniRows = [
      { label: "配送", value: shipText || ship.days },
      { label: "カテゴリ", value: Data.resolveCategoryDisplay?.(product) || product.categoryBlob?.split(/\s+/)[0] || "その他" },
      { label: "発送元", value: product.shopName || "国内" },
    ];
    el.innerHTML = `<table class="tasful-market-product-specs-mini__table"><tbody>${miniRows
      .map((row) => `<tr><th>${esc(row.label)}</th><td>${esc(row.value)}</td></tr>`)
      .join("")}</tbody></table>`;
  }

  function renderHero(product) {
    const conditionEl = $("[data-tasful-product-condition]");
    if (conditionEl) {
      conditionEl.textContent = product.conditionLabel || "新品";
      conditionEl.className = `tasful-market-product-hero__condition tasful-market-product-hero__condition--${product.conditionType || "new"}`;
    }

    const titleEl = $("[data-tasful-product-title]");
    if (titleEl) titleEl.textContent = product.title;

    const ratingEl = $("[data-tasful-product-rating]");
    if (ratingEl) {
      const profile = Data.buildSellerProfile(product);
      ratingEl.innerHTML = `${buildRatingLabelHtml(product, profile)} <a class="tasful-market-product-hero__reviews-link" href="#product-reviews">レビューを見る</a>`;
    }

    renderBrand(product);
    renderTrustBlock(product);
    renderCommerceBlocks(product);
    renderCenterAbout(product);
    renderBuyboxSeller(product);
    renderSpecsMini(product);
    renderThumbnails(product);
    renderRecommendPoints(product);
    syncFavoriteButton();
  }

  function isSellerFollowed(shopId) {
    try {
      const raw = JSON.parse(localStorage.getItem(FOLLOW_KEY) || "[]");
      return Array.isArray(raw) && raw.includes(String(shopId || "").trim());
    } catch {
      return false;
    }
  }

  function toggleSellerFollow(shopId) {
    const key = String(shopId || "").trim();
    if (!key) return false;
    try {
      const raw = JSON.parse(localStorage.getItem(FOLLOW_KEY) || "[]");
      const set = new Set(Array.isArray(raw) ? raw.map(String) : []);
      const followed = set.has(key);
      if (followed) set.delete(key);
      else set.add(key);
      localStorage.setItem(FOLLOW_KEY, JSON.stringify([...set]));
      return !followed;
    } catch {
      return false;
    }
  }

  function syncSellerFollowButton() {
    const btns = document.querySelectorAll("[data-tasful-product-seller-follow], [data-tasful-product-buybox-follow]");
    if (!btns.length || !state.product) return;
    const followed = isSellerFollowed(state.product.shopId);
    btns.forEach((btn) => {
      btn.classList.toggle("is-active", followed);
      btn.textContent = followed ? "フォロー中" : "フォローする";
      btn.setAttribute("aria-pressed", followed ? "true" : "false");
    });
  }

  function renderSellerCard(product) {
    const profile = Data.buildSellerProfile(product);
    const trust = resolveTrustData(product);
    const { storeTop, products, storeReviews } = buildSellerLinks(product);
    const nameEl = $("[data-tasful-product-seller-name]");
    if (nameEl) nameEl.textContent = profile.name;

    const ratingEl = $("[data-tasful-product-seller-rating]");
    if (ratingEl) {
      ratingEl.innerHTML = `${esc(Data.formatStarDisplay(profile.rating))} ${esc(Data.formatReviewScore(profile.rating))}`;
    }

    const reviewsEl = $("[data-tasful-product-seller-reviews]");
    if (reviewsEl) reviewsEl.textContent = `レビュー${profile.reviewCount}件`;

    const salesEl = $("[data-tasful-product-seller-sales]");
    if (salesEl) salesEl.textContent = `取引${trust.completedDeals}件`;

    const badgesEl = $("[data-tasful-product-seller-badges]");
    if (badgesEl) {
      const badges = [];
      if (profile.connectVerified) badges.push("Connect認証済み");
      if (profile.identityVerified) badges.push("本人確認済み");
      badgesEl.innerHTML = badges.map((b) => `<li>${esc(b)}</li>`).join("");
    }

    const storeTopBtn = $("[data-tasful-product-seller-store-top]");
    if (storeTopBtn) storeTopBtn.href = storeTop;
    const productsBtn = $("[data-tasful-product-seller-products]");
    if (productsBtn) productsBtn.href = products;
    const reviewsLinkBtn = $("[data-tasful-product-seller-reviews-link]");
    if (reviewsLinkBtn) reviewsLinkBtn.href = storeReviews;

    syncSellerFollowButton();
  }

  function renderAbout(product) {
    const list = $("[data-tasful-product-about-list]");
    if (!list) return;
    const bullets = Data.buildAboutBullets(product);
    list.innerHTML = bullets.map((b) => `<li>${esc(b)}</li>`).join("");
  }

  function renderSpecs(product) {
    const wrap = $("[data-tasful-product-specs]");
    if (!wrap) return;
    const rows = Data.buildSpecRows(product);
    const tableRows = [
      ...rows,
      {
        id: "category",
        label: "カテゴリ",
        value: Data.resolveCategoryDisplay?.(product) || product.categoryBlob || "その他",
      },
    ];
    wrap.innerHTML = `<table class="tasful-market-product-specs__table"><tbody>${tableRows
      .map((row) => `<tr><th scope="row">${esc(row.label)}</th><td>${esc(row.value)}</td></tr>`)
      .join("")}</tbody></table>`;
  }

  function renderShipping(product) {
    const wrap = $("[data-tasful-product-shipping-body]");
    const section = $("[data-tasful-product-shipping]");
    if (!wrap || !section) return;
    const rows = Data.buildShippingDetail?.(product) || [];
    if (!rows.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    wrap.innerHTML = `<ul class="tasful-market-product-shipping__list">${rows
      .map(
        (row) =>
          `<li class="tasful-market-product-shipping__item"><span class="tasful-market-product-shipping__label">${esc(row.label)}</span><span class="tasful-market-product-shipping__value">${esc(row.value)}</span></li>`
      )
      .join("")}</ul>`;
  }

  function buildDistStarLabel(star) {
    return `<span class="tasful-market-product-reviews__dist-label">${star}つ星</span>`;
  }

  function buildReviewDistributionHtml(product) {
    const trust = resolveTrustData(product);
    const breakdown = trust.ratingBreakdown;
    const rows = [5, 4, 3, 2, 1]
      .map((star) => {
        const pct = breakdown[star] ?? 0;
        return `<div class="tasful-market-product-reviews__dist-row">${buildDistStarLabel(star)}<div class="tasful-market-product-reviews__dist-bar" aria-hidden="true"><span style="width:${pct}%"></span></div><span class="tasful-market-product-reviews__dist-pct">${pct}%</span></div>`;
      })
      .join("");
    return `<div class="tasful-market-product-reviews__distribution" aria-label="評価の内訳">${rows}</div>`;
  }

  function buildReviewSummary(product) {
    const blob = `${product.categoryBlob || ""} ${product.title || ""}`;
    if (/洋書|書籍|本|文具/i.test(blob)) {
      return "お客様は読みやすさ、届いた状態の良さ、コスパの高さを高く評価しています。梱包の丁寧さや発送の速さについても好意的な声が多く見られます。";
    }
    if (/食品|スイーツ|パン|コーヒー/i.test(blob)) {
      return "お客様は味の満足度、鮮度、梱包の丁寧さを高く評価しています。ギフト用途でも好評という声が多く見られます。";
    }
    return "お客様は品質、届くスピード、梱包の丁寧さを高く評価しています。説明どおりの商品で満足しているという声が多く見られます。";
  }

  function buildReviewTags(product) {
    const seed = Data.seedFromProduct?.(product) ?? 0;
    const blob = `${product.categoryBlob || ""} ${product.title || ""}`;
    const pool = /洋書|書籍|本|文具/i.test(blob)
      ? ["読みやすさ", "コスパ", "梱包", "品質", "発送の速さ", "状態の良さ"]
      : /食品|スイーツ|パン|コーヒー/i.test(blob)
        ? ["味", "鮮度", "梱包", "コスパ", "発送の速さ", "品質"]
        : ["品質", "コスパ", "梱包", "発送の速さ", "状態の良さ", "説明どおり"];
    return pool.slice(0, 6).map((label, i) => ({
      label,
      count: ((seed + i * 17) % 48) + 12,
    }));
  }

  function buildReviewTagsHtml(product) {
    const tags = buildReviewTags(product);
    return tags
      .map(
        (tag) =>
          `<button type="button" class="tasful-market-product-reviews__tag"><span class="tasful-market-product-reviews__tag-label">${esc(tag.label)}</span><span class="tasful-market-product-reviews__tag-count">(${esc(tag.count)})</span></button>`
      )
      .join("");
  }

  function buildReviewMediaHtml(product, reviews) {
    const items = collectReviewMediaItems(product, reviews);
    if (!items.length) return "";
    return `<section class="tasful-market-product-reviews__media-section" aria-label="お客様の写真と動画"><div class="tasful-market-product-reviews__media-head"><h3 class="tasful-market-product-reviews__media-title">お客様の写真と動画</h3></div><div class="tasful-market-product-reviews__photos">${items.map(buildReviewMediaSlot).join("")}</div></section>`;
  }

  function buildReviewScoreOverviewHtml(product) {
    const reviewCount = Number(product.reviewCount) || 0;
    return `<div class="tasful-market-product-reviews__score-block" data-tasful-product-reviews-score><div class="tasful-market-product-reviews__score-main"><p class="tasful-market-product-reviews__stars-big" aria-hidden="true">${esc(Data.formatStarDisplay(product.ratingScore))}</p><p class="tasful-market-product-reviews__score-outof"><span class="tasful-market-product-reviews__score-value">${esc(Data.formatReviewScore(product.ratingScore))}</span></p><p class="tasful-market-product-reviews__score-count">レビュー${esc(reviewCount)}件</p></div>${buildReviewDistributionHtml(product)}</div>`;
  }

  function renderReviewOverview(product, reviews) {
    const wrap = $("[data-tasful-product-reviews-overview]");
    if (!wrap) return;
    const tagsHtml = buildReviewTagsHtml(product);
    const mediaHtml = buildReviewMediaHtml(product, reviews);
    wrap.innerHTML = `${buildReviewScoreOverviewHtml(product)}<section class="tasful-market-product-reviews__opinions" aria-label="お客様のご意見"><h3 class="tasful-market-product-reviews__opinions-title">レビュータグ</h3><div class="tasful-market-product-reviews__tags" role="list">${tagsHtml}</div></section>${mediaHtml}`;
  }

  function collectReviewMediaItems(product, reviews) {
    const items = [];
    const gallery = Data.getProductGallery(product);
    reviews.forEach((review, index) => {
      if (!review.photoUrl || !Data.isUsableImageUrl?.(review.photoUrl)) return;
      items.push({
        src: review.photoUrl,
        stars: review.stars,
        isVideo: index === 0,
        duration: "0:22",
        label: review.title || "レビュー写真",
      });
    });
    gallery.slice(1, 4).forEach((img) => {
      if (items.length >= 6) return;
      if (items.some((item) => item.src === img.src)) return;
      items.push({
        src: img.src,
        stars: Math.round(product.ratingScore || 5),
        isVideo: false,
        duration: "",
        label: img.label || "商品写真",
      });
    });
    return items.slice(0, 6);
  }

  function buildReviewMediaSlot(item) {
    const videoHtml = item.isVideo
      ? `<span class="tasful-market-product-reviews__media-play" aria-hidden="true">▶</span><span class="tasful-market-product-reviews__media-duration">${esc(item.duration)}</span>`
      : "";
    const stars = "★".repeat(Math.max(0, Math.min(5, item.stars || 0)));
    return `<button type="button" class="tasful-market-product-reviews__photo-slot${item.isVideo ? " is-video" : ""}" aria-label="${Data.escAttr(item.label)}"><img src="${Data.escAttr(item.src)}" alt="" loading="lazy" decoding="async" width="132" height="132"${Data.productImageOnErrorAttr()}>${videoHtml}<span class="tasful-market-product-reviews__media-stars" aria-hidden="true">${stars}</span></button>`;
  }

  function buildReviewCardHtml(review, product) {
    const initial = String(review.author || "購").replace(/購入者/, "").trim().charAt(0) || "購";
    const category = Data.resolveCategoryDisplay?.(product) || product.category || "商品";
    const helpful = ((Data.seedFromProduct?.(product) ?? 0) + review.stars * 3) % 9 + 1;
    return `<article class="tasful-market-product-reviews__item"><div class="tasful-market-product-reviews__item-head"><span class="tasful-market-product-reviews__avatar" aria-hidden="true">${esc(initial)}</span><span class="tasful-market-product-reviews__author">${esc(review.author)}</span></div><p class="tasful-market-product-reviews__stars">${"★".repeat(review.stars)}${"☆".repeat(5 - review.stars)} <span class="tasful-market-product-reviews__item-title">${esc(review.title)}</span></p><p class="tasful-market-product-reviews__meta">${esc(review.date)}に日本でレビュー済み</p><p class="tasful-market-product-reviews__variant">カテゴリ: ${esc(category)} | TASFUL市場で購入</p><p class="tasful-market-product-reviews__item-body">${esc(review.body)}</p><p class="tasful-market-product-reviews__helpful">${esc(helpful)}人のお客様が「参考になった」と考えています</p></article>`;
  }

  function renderReviews(product) {
    const reviews = Data.buildSampleReviews(product, 3);
    renderReviewOverview(product, reviews);

    const list = $("[data-tasful-product-reviews-list]");
    if (list) {
      list.innerHTML = reviews.map((r) => buildReviewCardHtml(r, product)).join("");
    }

    renderReviewCompose(product);
  }

  function shouldOpenReviewComposeFromLocation() {
    if (state.openReview) return true;
    const hash = String(window.location.hash || "").replace(/^#/, "").trim();
    return hash === "tasful-product-review-compose" || hash === "product-reviews" || hash === "tasful-product-reviews";
  }

  function syncReviewStarButtons() {
    const stars = Math.max(0, Math.min(5, Number(state.reviewStars) || 0));
    $("[data-tasful-product-review-stars]")?.querySelectorAll("[data-tasful-product-review-star]").forEach((btn) => {
      const value = parseInt(btn.getAttribute("data-tasful-product-review-star") || "0", 10);
      btn.classList.toggle("is-active", value === stars && stars > 0);
      btn.classList.toggle("is-filled", value <= stars && stars > 0);
      btn.setAttribute("aria-checked", value === stars ? "true" : "false");
    });
  }

  function openReviewCompose(options) {
    const compose = $("[data-tasful-product-review-compose]");
    const openBtn = $("[data-tasful-product-review-open]");
    if (!compose) return;
    compose.hidden = false;
    compose.classList.add("is-open");
    if (openBtn) openBtn.hidden = true;
    if (options?.scroll !== false) {
      compose.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const focusTarget =
      compose.querySelector("[data-tasful-product-review-title]") ||
      compose.querySelector("[data-tasful-product-review-star='5']");
    if (options?.focus !== false && focusTarget) {
      window.setTimeout(() => focusTarget.focus(), options?.scroll === false ? 0 : 320);
    }
  }

  function renderReviewCompose(product) {
    const compose = $("[data-tasful-product-review-compose]");
    const openBtn = $("[data-tasful-product-review-open]");
    const lead = $("[data-tasful-product-review-compose-lead]");
    if (!compose) return;

    if (lead) {
      lead.textContent = `${product.shopName || "出品者"} · ${product.title || "商品"} のレビューを入力できます。`;
    }

    const autoOpen = shouldOpenReviewComposeFromLocation();
    if (autoOpen) {
      openReviewCompose({ scroll: true, focus: true });
    } else {
      compose.hidden = true;
      compose.classList.remove("is-open");
      if (openBtn) openBtn.hidden = false;
    }
    syncReviewStarButtons();
  }

  function submitReviewCompose() {
    const stars = Math.max(0, Math.min(5, Number(state.reviewStars) || 0));
    const title = String($("[data-tasful-product-review-title]")?.value || "").trim();
    const body = String($("[data-tasful-product-review-body]")?.value || "").trim();
    if (stars < 1) {
      alert("星評価を選択してください。");
      return;
    }
    if (!title) {
      alert("タイトルを入力してください。");
      $("[data-tasful-product-review-title]")?.focus();
      return;
    }
    if (body.length < 10) {
      alert("レビュー本文は10文字以上入力してください。");
      $("[data-tasful-product-review-body]")?.focus();
      return;
    }
    const submitBtn = $("[data-tasful-product-review-submit]");
    const doneEl = $("[data-tasful-product-review-done]");
    if (submitBtn) submitBtn.disabled = true;
    if (doneEl) doneEl.hidden = false;
  }

  function getRelatedVisibleLimit() {
    if (window.matchMedia("(min-width: 1280px)").matches) return 8;
    if (window.matchMedia("(min-width: 768px)").matches) return 6;
    return 4;
  }

  function syncRelatedShelfVisibility() {
    const grid = $("[data-tasful-product-shelf-related]");
    const moreBtn = $("[data-tasful-product-related-more]");
    if (!grid) return;

    const cards = grid.querySelectorAll(".tasful-market-search-mini");
    const limit = getRelatedVisibleLimit();
    const expanded = Boolean(state.relatedExpanded);
    const hiddenCount = Math.max(0, cards.length - limit);

    cards.forEach((card, index) => {
      const hide = !expanded && index >= limit;
      card.classList.toggle("is-related-hidden", hide);
      card.toggleAttribute("hidden", hide);
      card.setAttribute("aria-hidden", hide ? "true" : "false");
    });

    grid.classList.toggle("is-collapsed", !expanded && hiddenCount > 0);
    grid.classList.toggle("is-expanded", expanded);

    if (moreBtn) {
      const showMore = !expanded && hiddenCount > 0;
      moreBtn.hidden = !showMore;
      moreBtn.textContent = `もっと見る（あと${hiddenCount}件）`;
    }
  }

  function renderShelf(containerSel, candidates, pool, options = {}) {
    const el = $(containerSel);
    if (!el) return;
    const shelf = Data.pickShelfProducts(candidates, pool, {
      count: 8,
      minItems: options.minItems ?? 3,
      excludeId: state.product?.id,
      strictPool: Boolean(options.strictPool),
    });
    el.innerHTML = shelf.html;
  }

  function renderRelatedProducts(product, pool) {
    const related = Data.getRelatedProducts(product, pool, 8);
    renderShelf("[data-tasful-product-shelf-related]", related, pool, { strictPool: true, minItems: 1, count: 8 });
    state.relatedExpanded = false;
    syncRelatedShelfVisibility();
  }

  function parseYen(price) {
    return Data.parsePriceYen?.(price) || 0;
  }

  function formatBundleTotalYen(items) {
    const totalYen = (items || []).reduce((sum, p) => sum + parseYen(p.price), 0);
    return totalYen > 0 ? `¥${totalYen.toLocaleString("ja-JP")}` : "—";
  }

  function buildBundleLegacyItemsHtml(bundle) {
    return bundle
      .map((p, i) => {
        const plus = i < bundle.length - 1 ? `<span class="tasful-market-product-bundle__plus" aria-hidden="true">+</span>` : "";
        return `${plus}<a class="tasful-market-product-bundle__item" href="${Data.escAttr(Data.productHref(p))}"><img src="${Data.escAttr(Data.resolvePrimaryImage(p))}" alt="" width="120" height="120" loading="lazy" decoding="async"${Data.productImageOnErrorAttr()}><span class="tasful-market-product-bundle__item-title">${esc(p.title)}</span><span class="tasful-market-product-bundle__item-price">${esc(Data.formatMiniPrice(p.price))}</span></a>`;
      })
      .join("");
  }

  function buildBundlePickerHtml(bundle) {
    return `<ul class="tasful-market-product-bundle__picker">${bundle
      .map((p, i) => {
        const locked = i === 0;
        const plus =
          i > 0
            ? `<li class="tasful-market-product-bundle__picker-plus" aria-hidden="true"><span>+</span></li>`
            : "";
        return `${plus}<li class="tasful-market-product-bundle__picker-row${locked ? " is-locked" : ""}"><label class="tasful-market-product-bundle__picker-label"><input type="checkbox" class="tasful-market-product-bundle__check" data-bundle-index="${i}" checked${locked ? " disabled" : ""}><img class="tasful-market-product-bundle__picker-thumb" src="${Data.escAttr(Data.resolvePrimaryImage(p))}" alt="" width="56" height="56" loading="lazy" decoding="async"${Data.productImageOnErrorAttr()}><span class="tasful-market-product-bundle__picker-text"><span class="tasful-market-product-bundle__picker-title">${esc(p.title)}</span><span class="tasful-market-product-bundle__picker-price">${esc(Data.formatMiniPrice(p.price))}</span></span></label></li>`;
      })
      .join("")}</ul>`;
  }

  function syncBundleTotal(wrap) {
    if (!wrap || !state.bundleItems.length) return;
    const selected = state.bundleItems.filter((p, i) => {
      if (i === 0) return true;
      const cb = wrap.querySelector(`[data-bundle-index="${i}"]`);
      return Boolean(cb?.checked);
    });
    const totalEl = wrap.querySelector("[data-tasful-product-bundle-total]");
    if (totalEl) totalEl.textContent = formatBundleTotalYen(selected);
  }

  function getSelectedBundleProducts(wrap) {
    if (!state.bundleItems.length) return [];
    const root = wrap || $("[data-tasful-product-bundle-body]");
    return state.bundleItems.filter((p, i) => {
      if (i === 0) return true;
      const cb = root?.querySelector(`[data-bundle-index="${i}"]`);
      return Boolean(cb?.checked);
    });
  }

  function renderFrequentlyBought(product, pool) {
    const wrap = $("[data-tasful-product-bundle-body]");
    if (!wrap) return;
    const extras = Data.getFrequentlyBoughtTogether?.(product, pool, 2) || [];
    if (extras.length < 2) {
      state.bundleItems = [];
      $("[data-tasful-product-frequently-bought]")?.setAttribute("hidden", "");
      return;
    }
    $("[data-tasful-product-frequently-bought]")?.removeAttribute("hidden");
    const bundle = [product, ...extras];
    state.bundleItems = bundle;
    const totalText = formatBundleTotalYen(bundle);
    wrap.innerHTML = `${buildBundlePickerHtml(bundle)}<div class="tasful-market-product-bundle__items tasful-market-product-bundle__items--legacy" aria-hidden="true">${buildBundleLegacyItemsHtml(bundle)}</div><div class="tasful-market-product-bundle__footer"><p class="tasful-market-product-bundle__total">合計: <strong data-tasful-product-bundle-total>${esc(totalText)}</strong> <span>(税込)</span></p><button type="button" class="tasful-market-product-bundle__btn" data-tasful-product-bundle-add>まとめてカートに入れる</button></div>`;
    wrap.querySelectorAll(".tasful-market-product-bundle__check").forEach((cb) => {
      cb.addEventListener("change", () => syncBundleTotal(wrap));
    });
    wrap.querySelector("[data-tasful-product-bundle-add]")?.addEventListener("click", () => {
      const selected = getSelectedBundleProducts(wrap);
      selected.forEach((p) => {
        Data.incrementCartCount(1, {
          shopId: p.shopId,
          productId: p.productId,
          title: p.title,
          price: p.price,
          image: p.image,
          shopName: p.shopName,
          conditionLabel: p.conditionLabel,
          connectVerified: p.connectVerified,
          freeShipping: p.freeShipping,
        });
      });
      const btn = wrap.querySelector("[data-tasful-product-bundle-add]");
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = "追加しました";
        btn.disabled = true;
        window.setTimeout(() => {
          btn.textContent = prev;
          btn.disabled = false;
        }, 1400);
      }
    });
  }

  function renderDescription(product) {
    const wrap = $("[data-tasful-product-description-sections]");
    const sectionEl = $("[data-tasful-product-description]");
    if (!wrap) return;
    const sections = Data.buildDescriptionSections?.(product) || [];
    if (!sections.length) {
      wrap.innerHTML = "";
      if (sectionEl) sectionEl.hidden = true;
      return;
    }
    if (sectionEl) sectionEl.hidden = false;
    wrap.innerHTML = sections
      .map((section, index) => {
        const reverse = index % 2 === 1;
        return `<article class="tasful-market-product-description__section${reverse ? " is-reverse" : ""}"><div class="tasful-market-product-description__media"><img src="${Data.escAttr(section.image)}" alt="${Data.escAttr(section.title)}" loading="lazy" decoding="async" width="640" height="480"${Data.productImageOnErrorAttr()}></div><div class="tasful-market-product-description__copy"><h3 class="tasful-market-product-description__section-title">${esc(section.title)}</h3><p class="tasful-market-product-description__section-body">${esc(section.description)}</p></div></article>`;
      })
      .join("");
  }

  function renderShelves(product, pool) {
    const browsed = Data.getBrowsedProducts(pool, 8).filter((p) => p.id !== product.id);
    const recent = Data.getRecentProducts(pool).filter((p) => p.id !== product.id);
    const recentItems = recent.length ? recent.slice(0, 8) : browsed.slice(0, 8);

    renderShelf("[data-tasful-product-shelf-browsed]", browsed, pool);
    renderRelatedProducts(product, pool);
    renderShelf("[data-tasful-product-shelf-recent]", recentItems, pool);
  }

  function syncFavoriteButton() {
    const btn = $("[data-tasful-product-favorite]");
    if (!btn || !state.product) return;
    const saved = Data.isFavorite(state.product.id);
    btn.classList.toggle("is-active", saved);
    btn.setAttribute("aria-pressed", saved ? "true" : "false");
    btn.textContent = saved ? "♥ お気に入り済み" : "♡ お気に入り";
  }

  function getQuantity() {
    const sel = $("[data-tasful-product-qty]") || $("[data-tasful-product-qty-pc]");
    const n = parseInt(sel?.value || "1", 10);
    return Math.min(99, Math.max(1, Number.isFinite(n) ? n : 1));
  }

  function syncQuantitySelects(value) {
    const qty = String(Math.min(10, Math.max(1, value)));
    const mobile = $("[data-tasful-product-qty]");
    const pc = $("[data-tasful-product-qty-pc]");
    if (mobile) mobile.value = qty;
    if (pc) pc.value = qty;
    state.qty = parseInt(qty, 10);
  }

  function flashCartButton(btn) {
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = "追加しました";
    btn.disabled = true;
    window.setTimeout(() => {
      btn.textContent = prev;
      btn.disabled = false;
    }, 1200);
  }

  function addToCart() {
    if (!state.product) return;
    const qty = getQuantity();
    Data.incrementCartCount(qty, {
      shopId: state.shopId,
      productId: state.productId,
      title: state.product.title,
      price: state.product.price,
      image: state.product.image,
      shopName: state.product.shopName,
      conditionLabel: state.product.conditionLabel,
      connectVerified: state.product.connectVerified,
      freeShipping: state.product.freeShipping,
    });
    flashCartButton($("[data-tasful-product-add-cart]"));
    flashCartButton($("[data-tasful-product-add-cart-pc]"));
  }

  function buyNow() {
    const p = state.product;
    if (!p) return;
    const qty = getQuantity();
    const price = p.priceYen || Data.parsePriceYen(p.price) || 0;
    if (price < 1) {
      alert("この商品は価格未設定のため、お問い合わせください。");
      return;
    }
    const url = `shop-market-checkout.html?mode=buyNow&shopId=${encodeURIComponent(state.shopId)}&productId=${encodeURIComponent(state.productId)}&quantity=${qty}`;
    window.location.href = url;
  }

  function resolveSectionElement(sectionId) {
    if (sectionId === "product-about") {
      const inline = document.getElementById("product-about");
      const mobile = document.querySelector(".tasful-market-product-about--mobile");
      if (window.matchMedia("(min-width: 1025px)").matches) return inline || mobile;
      return mobile || inline;
    }
    return document.getElementById(sectionId);
  }

  function getSectionScrollOffset() {
    const header = document.querySelector("[data-tasful-market-header]");
    const nav = $("[data-tasful-product-section-nav]");
    const headerH = header?.getBoundingClientRect().height || 0;
    const navH = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().height : 0;
    return headerH + navH + 12;
  }

  function scrollToProductSection(sectionId) {
    const el = resolveSectionElement(sectionId);
    if (!el) return;
    const offset = getSectionScrollOffset();
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function syncSectionNav() {
    const nav = $("[data-tasful-product-section-nav]");
    if (!nav) return;
    const descriptionHidden = $("[data-tasful-product-description]")?.hidden;
    const descLink = nav.querySelector('[data-tasful-section-link="product-description"]');
    const descItem = descLink?.closest("li");
    if (descItem) descItem.hidden = Boolean(descriptionHidden);
    if (descLink) descLink.classList.toggle("is-disabled", Boolean(descriptionHidden));

    const reviewsTab = nav.querySelector("[data-tasful-product-reviews-tab]");
    if (reviewsTab) {
      const count = Math.max(0, Number(state.product?.reviewCount) || 0);
      reviewsTab.textContent = count > 0 ? `レビュー ${count}` : "レビュー";
    }
  }

  function bindSectionNav() {
    const nav = $("[data-tasful-product-section-nav]");
    if (!nav) return;

    nav.addEventListener("click", (e) => {
      const link = e.target.closest("[data-tasful-section-link]");
      if (!link || link.classList.contains("is-disabled")) return;
      if (link.tagName === "A") e.preventDefault();
      const sectionId = link.getAttribute("data-tasful-section-link");
      if (!sectionId) return;
      scrollToProductSection(sectionId);
      nav.querySelectorAll("[data-tasful-section-link]").forEach((el) => {
        el.classList.toggle("is-active", el === link);
        el.setAttribute("aria-selected", el === link ? "true" : "false");
      });
    });
  }

  function bindEvents() {
    $("[data-tasful-product-related-more]")?.addEventListener("click", () => {
      state.relatedExpanded = true;
      syncRelatedShelfVisibility();
    });

    if (!bindEvents._relatedResizeBound) {
      bindEvents._relatedResizeBound = true;
      window.addEventListener("resize", () => {
        if (state.product) syncRelatedShelfVisibility();
      });
    }

    $("[data-tasful-product-add-cart]")?.addEventListener("click", addToCart);
    $("[data-tasful-product-add-cart-pc]")?.addEventListener("click", addToCart);
    $("[data-tasful-product-buy-now]")?.addEventListener("click", buyNow);
    $("[data-tasful-product-buy-now-pc]")?.addEventListener("click", buyNow);
    $("[data-tasful-product-qty]")?.addEventListener("change", (e) => syncQuantitySelects(e.target.value));
    $("[data-tasful-product-qty-pc]")?.addEventListener("change", (e) => syncQuantitySelects(e.target.value));
    $("[data-tasful-product-favorite]")?.addEventListener("click", () => {
      if (!state.product) return;
      Data.toggleFavorite(state.product.id, state.product);
      syncFavoriteButton();
    });

    $("[data-tasful-product-thumbs]")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tasful-product-thumb]");
      if (!btn) return;
      const index = parseInt(btn.getAttribute("data-tasful-product-thumb") || "0", 10);
      const item = state.gallery[index];
      const main = $("[data-tasful-product-image]");
      const caption = $("[data-tasful-product-thumb-caption]");
      if (item && main) applyMainImage(main, item.src, item.label);
      if (caption && item?.label) {
        caption.hidden = false;
        caption.textContent = item.label;
      }
      $("[data-tasful-product-thumbs]")?.querySelectorAll(".tasful-market-product-thumbs__btn").forEach((el) => {
        el.classList.toggle("is-active", el === btn);
      });
    });

    $("[data-tasful-product-seller-follow]")?.addEventListener("click", () => {
      if (!state.product) return;
      toggleSellerFollow(state.product.shopId);
      syncSellerFollowButton();
    });

    document.addEventListener("click", (e) => {
      const followBtn = e.target.closest("[data-tasful-product-buybox-follow]");
      if (!followBtn || !state.product) return;
      toggleSellerFollow(state.product.shopId);
      syncSellerFollowButton();
    });

    $("[data-tasful-product-reviews-more]")?.addEventListener("click", () => {
      scrollToProductSection("product-reviews");
    });

    $("[data-tasful-product-review-open]")?.addEventListener("click", () => openReviewCompose());
    $("[data-tasful-product-review-stars]")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tasful-product-review-star]");
      if (!btn) return;
      state.reviewStars = parseInt(btn.getAttribute("data-tasful-product-review-star") || "0", 10);
      syncReviewStarButtons();
    });
    $("[data-tasful-product-review-submit]")?.addEventListener("click", submitReviewCompose);
    bindSectionNav();
  }

  function renderBreadcrumb(product) {
    const profile = Data.buildSellerProfile(product);
    const shopLabel = product.shopName || profile.name || "出品者";
    const shopHref = profile.shopUrl || "shop-store.html";
    const productsHref = state.shopId
      ? `shop-products.html?id=${encodeURIComponent(state.shopId)}`
      : shopHref;
    window.TasuCommonBreadcrumb?.setParentChain?.([
      { label: shopLabel, href: shopHref },
      { label: "商品一覧", href: productsHref },
    ]);
    window.TasuCommonBreadcrumb?.setCurrentLabel(product.title || "商品");
  }

  function renderPage() {
    const product = state.product;
    if (!product) return;
    hideStatus();
    showMain();
    renderBreadcrumb(product);
    renderHero(product);
    renderSellerCard(product);
    renderAbout(product);
    renderDescription(product);
    renderShipping(product);
    renderSpecs(product);
    renderFrequentlyBought(product, state.pool);
    renderReviews(product);
    renderShelves(product, state.pool);
    syncSectionNav();
    document.title = `${product.title} | TASFUL市場`;
    Data.pushRecentItem(product);
  }

  async function init() {
    if (document.body.dataset.page !== "shop_market_product") return;
    if (!Data) {
      setStatus("商品データの読み込みに失敗しました。", true);
      return;
    }

    const { shopId, productId, openReview } = readParams();
    state.shopId = shopId;
    state.productId = productId;
    state.openReview = openReview;

    if (!shopId || !productId) {
      setStatus("店舗または商品が指定されていません。", true);
      return;
    }

    setStatus("読み込み中…", false);
    bindEvents();

    state.pool = await Data.loadProductPool();
    state.product = Data.enrichProductImage(Data.findProduct(state.pool, shopId, productId));

    if (!state.product) {
      setStatus("商品が見つかりませんでした。", true);
      return;
    }

    renderPage();
    window.TasfulMarketHeader?.syncHeaderOffset?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
