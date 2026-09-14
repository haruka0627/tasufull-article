/**
 * TASFUL Materials — ダウンロードカード共通コンポーネント
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

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(String(url || ""));
  }


  function preferCommittedPreviewPath(src) {
    const s = String(src || "").trim();
    if (!s) return "";
    // Map slim-tree downloads URLs to committed preview thumbs when possible.
    const m = s.match(/\/materials\/generated\/downloads\/image\/([^/?#]+)\.(png|jpe?g|webp)$/i);
    if (m) {
      const base = m[1];
      return "/materials/generated/previews/image/" + base + ".jpg";
    }
    return s;
  }

  function isServedPreviewPath(src) {
    const s = String(src || "");
    return /\/materials\/images\/previews\//i.test(s) || /\/materials\/generated\/previews\//i.test(s);
  }

  function resolveThumbSrc(item) {
    const images = Array.isArray(item?.preview_images) ? item.preview_images : [];
    const first = images[0];
    const fromPreview = pickStr(
      first && (first.src || first.url || first),
      typeof first === "string" ? first : ""
    );
    const candidates = [
      fromPreview,
      item && item.preview_url,
      item && item.thumbnail_url,
      item && item.preview_image,
      item && item.image_url,
      item && item.image,
      item && item.cover_url,
      item && item.download_url,
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const src = preferCommittedPreviewPath(pickStr(candidates[i]));
      if (src && isImageUrl(src) && isServedPreviewPath(src)) return src;
    }
    for (let i = 0; i < candidates.length; i += 1) {
      const src = preferCommittedPreviewPath(pickStr(candidates[i]));
      // Never use downloads/image for card thumbs — slim Pages tree omits those bytes.
      if (/\/materials\/generated\/downloads\//i.test(src)) continue;
      if (src && isImageUrl(src)) return src;
    }
    return "";
  }

  function renderThumbMedia(item) {
    const src = resolveThumbSrc(item);
    const icon = renderThumbIcon(item.category_id);
    if (!src) return icon;
    return (
      icon +
      `<img class="materials-card__thumb-img" src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" data-mat-thumb-img onload="if(!this.naturalWidth){this.onerror&&this.onerror();}" onerror="this.hidden=true;this.removeAttribute('src');this.removeAttribute('onload');">`
    );
  }

  function formatCount(n) {
    const num = Number(n) || 0;
    if (num >= 10000) return `${(num / 10000).toFixed(1).replace(/\.0$/, "")}万`;
    if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return String(num);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      return "—";
    }
  }

  function renderStars(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const full = Math.round(r);
    let html = "";
    for (let i = 1; i <= 5; i += 1) {
      html += `<span class="materials-card__star${i <= full ? " is-on" : ""}" aria-hidden="true">★</span>`;
    }
    return html;
  }

  function thumbIconSvg(categoryId) {
    const icons = {
      template:
        '<rect x="5" y="4" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      document:
        '<path d="M8 4h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 4v4h4M10 13h6M10 17h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      bgm:
        '<path d="M9 18V6l12-3v13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="6" cy="18" r="2" fill="currentColor"/><circle cx="18" cy="15" r="2" fill="currentColor"/>',
      sfx:
        '<path d="M5 10v4h3l4 4V6L8 10H5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      icon:
        '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 12h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      web:
        '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/>',
      presentation:
        '<rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 18v3M8 21h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      image:
        '<rect x="4" y="6" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="11" r="2" fill="currentColor"/><path d="m4 17 5-5 4 4 3-3 4 4" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>',
      illustration:
        '<path d="M4 20l4-9 4 5 4-7 4 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" fill="currentColor"/>',
      background:
        '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 15l5-5 4 4 3-3 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      code:
        '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 4l-4 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
      tool:
        '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-1.4-1.4 2.1-2.1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    };
    return icons[categoryId] || icons.template;
  }

  function renderThumbIcon(categoryId) {
    return (
      `<span class="materials-card__thumb-icon" aria-hidden="true">` +
      `<svg viewBox="0 0 24 24" width="36" height="36">${thumbIconSvg(categoryId || "template")}</svg>` +
      `</span>`
    );
  }

  function renderFormatTags(formats) {
    const list = formats || [];
    if (!list.length) return "";
    return (
      `<div class="materials-card__format-tags" aria-label="ファイル形式">` +
      list
        .map((f) => `<span class="materials-card__format-tag">${escapeHtml(f)}</span>`)
        .join("") +
      `</div>`
    );
  }

  function renderListCard(item) {
    const href = `detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
    const catColor = escapeHtml(item.category_color || "#64748b");
    const formats = item.file_formats || [];
    const freeBadge = item.is_free ? `<span class="materials-card__free-badge">無料</span>` : "";
    const adMark = item.is_ad_supported
      ? `<span class="materials-card__ad-mark" aria-label="広告あり">広告</span>`
      : "";
    const ratingNum = Number(item.rating || 0).toFixed(1);
    const dlCount = formatCount(item.download_count);

    return (
      `<article class="materials-card materials-card--list" data-materials-card data-item-id="${escapeHtml(item.id)}">` +
      `<a class="materials-card__thumb-link" href="${href}" tabindex="-1" aria-hidden="true">` +
      `<div class="materials-card__thumb materials-card__thumb--${escapeHtml(item.thumbnail_style || "default")}">` +
      renderThumbMedia(item) +
      `<span class="materials-card__category-badge" style="--cat-color:${catColor}">${escapeHtml(item.category_name || "")}</span>` +
      freeBadge +
      adMark +
      `</div>` +
      `</a>` +
      `<div class="materials-card__body">` +
      `<h3 class="materials-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<p class="materials-card__desc">${escapeHtml(item.description)}</p>` +
      renderFormatTags(formats) +
      `<p class="materials-card__meta-line">` +
      `<span class="materials-card__meta-line-item">★${ratingNum}</span>` +
      `<span class="materials-card__meta-sep" aria-hidden="true">・</span>` +
      `<span class="materials-card__meta-line-item">↓${dlCount}</span>` +
      `<span class="materials-card__meta-sep" aria-hidden="true">・</span>` +
      `<span class="materials-card__meta-line-item">${formatDate(item.updated_at)}</span>` +
      `</p>` +
      `<a class="materials-card__btn" href="${href}">${escapeHtml(item.button_label || "無料ダウンロード")}</a>` +
      `</div>` +
      `</article>`
    );
  }

  /**
   * @param {object} item
   * @param {object} [opts]
   * @param {"grid"|"ranking"|"list"} [opts.variant]
   */
  function renderDownloadCard(item, opts = {}) {
    const variant = opts.variant || "grid";
    if (variant === "ranking") {
      return renderRankingRow(item, opts);
    }
    if (variant === "list") {
      return renderListCard(item);
    }

    const href = `detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
    const catColor = escapeHtml(item.category_color || "#64748b");
    const tags = (item.tags || []).slice(0, 3);
    const formats = (item.file_formats || []).join(" / ");
    const freeBadge = item.is_free
      ? `<span class="materials-card__free-badge">無料</span>`
      : "";
    const adLabel = item.is_ad_supported
      ? `<span class="materials-card__ad-label">広告あり</span>`
      : "";

    return (
      `<article class="materials-card" data-materials-card data-item-id="${escapeHtml(item.id)}">` +
      `<a class="materials-card__thumb-link" href="${href}" tabindex="-1" aria-hidden="true">` +
      `<div class="materials-card__thumb materials-card__thumb--${escapeHtml(item.thumbnail_style || "default")}">` +
      renderThumbMedia(item) +
      `<span class="materials-card__category-badge" style="--cat-color:${catColor}">${escapeHtml(item.category_name || "")}</span>` +
      freeBadge +
      `</div>` +
      `</a>` +
      `<div class="materials-card__body">` +
      `<h3 class="materials-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<p class="materials-card__desc">${escapeHtml(item.description)}</p>` +
      (formats ? `<p class="materials-card__formats">${escapeHtml(formats)}</p>` : "") +
      `<div class="materials-card__tags" aria-label="タグ">` +
      tags.map((t) => `<span class="materials-card__tag">${escapeHtml(t)}</span>`).join("") +
      `</div>` +
      `<div class="materials-card__meta">` +
      `<span class="materials-card__meta-item" title="ダウンロード数">⬇ ${formatCount(item.download_count)}</span>` +
      `<span class="materials-card__meta-item materials-card__rating" title="評価">${renderStars(item.rating)}<span class="materials-card__rating-num">${Number(item.rating || 0).toFixed(1)}</span></span>` +
      `<span class="materials-card__meta-item">${formatDate(item.updated_at)}</span>` +
      adLabel +
      `</div>` +
      `<a class="materials-card__btn" href="${href}">${escapeHtml(item.button_label || "無料ダウンロード")}</a>` +
      `</div>` +
      `</article>`
    );
  }

  function renderRankingRow(item, opts = {}) {
    const rank = opts.rank || item.popularity_rank || 0;
    const href = `detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
    return (
      `<li class="materials-ranking__item">` +
      `<span class="materials-ranking__num">${rank}</span>` +
      `<a class="materials-ranking__link" href="${href}">` +
      `<span class="materials-ranking__thumb materials-card__thumb materials-card__thumb--${escapeHtml(item.thumbnail_style || "default")} materials-card__thumb--xs" aria-hidden="true">${renderThumbMedia(item)}</span>` +
      `<span class="materials-ranking__title">${escapeHtml(item.title)}</span>` +
      `</a>` +
      `</li>`
    );
  }

  function renderCardGrid(items, opts = {}) {
    const cards = (items || []).map((item) => renderDownloadCard(item, opts)).join("");
    const gridClass = opts.carousel
      ? "materials-card-grid materials-card-grid--carousel"
      : "materials-card-grid";
    const ariaLabel = opts.carouselLabel || "人気のダウンロード";
    const aria = opts.carousel ? ` role="region" aria-label="${escapeHtml(ariaLabel)}"` : "";
    return `<div class="${gridClass}" data-materials-card-grid${opts.carousel ? " data-materials-carousel" : ""}${aria}>${cards}</div>`;
  }

  global.TasuMaterialsDownloadCard = {
    renderDownloadCard,
    renderCardGrid,
    resolveThumbSrc,
    formatCount,
    formatDate,
  };
})(typeof window !== "undefined" ? window : globalThis);
