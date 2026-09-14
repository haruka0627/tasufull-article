/**
 * TASFUL Materials — プレゼンテンプレート 詳細 Option 4 UI（category_id=presentation）
 * 公開表示名「プレゼンテンプレート」（CATEGORIES.name「プレゼン資料」は変更しない）
 * Preview / Download / Favorite / Related は既存 Contract 接続。
 * 画像のない slide / format 変換 / PPTX生成は追加しない。
 */
(function (global) {
  "use strict";

  const DISPLAY_NAME = "プレゼンテンプレート";
  const DATA_CATEGORY = "presentation";
  const QUERY_CATEGORY = "presentation";
  const ACCENT = "#2563eb";
  /** Desktop 4列1段（「すべて見る」で残りへ） */
  const RELATED_DISPLAY_LIMIT = 4;

  const GENERIC_TAGS = new Set([
    "presentation",
    "プレゼン",
    "プレゼン資料",
    "プレゼンテンプレート",
    "pptx",
    "ppt",
  ]);

  const META_PLACEHOLDERS = Object.freeze({
    meta_pages: "10枚",
    meta_size: "16:9",
    file_size: "約 2.1 MB",
    environment: "PowerPoint 2016 以降",
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

  function formatCount(n) {
    return (Number(n) || 0).toLocaleString("ja-JP");
  }

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(String(url || ""));
  }

  function realMeta(value, placeholderKey) {
    const s = pickStr(value);
    if (!s || s === "—") return "";
    const ph = META_PLACEHOLDERS[placeholderKey];
    if (ph && s === ph) return "";
    if (Object.values(META_PLACEHOLDERS).includes(s)) return "";
    return s;
  }

  function itemTags(item) {
    return (item.tags || [])
      .map((t) => String(t).trim())
      .filter((t) => t && !GENERIC_TAGS.has(t.toLowerCase()) && !GENERIC_TAGS.has(t));
  }

  function listHref() {
    return `/materials/list.html?category=${QUERY_CATEGORY}`;
  }

  function detailHref(item) {
    return `detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
  }

  function publishedLabel(item) {
    const raw = pickStr(item.meta_published, item.meta_updated, item.updated_at);
    if (!raw) return "";
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}/${m}/${day}`;
    }
    return raw;
  }

  function formatSelectLabel(item) {
    const formats = item.file_formats || [];
    if (formats.length) {
      const primary = String(formats[0]).toUpperCase();
      if (primary === "PPTX") return "PPTX（PowerPoint）";
      return formats.map((f) => String(f).toUpperCase()).join(" / ");
    }
    const exportFormats = item.presentation_export_formats || [];
    if (exportFormats.length) return String(exportFormats[0]);
    return "—";
  }

  function formatInfoLabel(item) {
    const formats = item.file_formats || [];
    if (formats.length) return formats.map((f) => String(f).toUpperCase()).join(" / ");
    return "—";
  }

  /** 既存 Contract の実画像 URL のみ（捏造・生成なし） */
  function resolvePreviewImages(item) {
    const out = [];
    const seen = new Set();
    const push = (src, label) => {
      const u = pickStr(src);
      if (!u || !isImageUrl(u) || seen.has(u)) return;
      seen.add(u);
      out.push({ src: u, label: pickStr(label, `スライド ${out.length + 1}`) });
    };

    const images = Array.isArray(item.preview_images) ? item.preview_images : [];
    images.forEach((img, i) => {
      push(img && (img.src || img.url || img), img && img.label ? img.label : `プレビュー ${i + 1}`);
    });

    push(item.thumbnail_url, "表紙");
    push(item.preview_image, "プレビュー");
    push(item.preview_url, "プレビュー");
    push(item.image_url, "画像");
    push(item.image, "画像");

    const slides = Array.isArray(item.presentation_slides) ? item.presentation_slides : [];
    slides.forEach((slide, i) => {
      push(
        slide && (slide.src || slide.url || slide.image || slide.thumbnail),
        slide && (slide.label || slide.title) ? slide.label || slide.title : `スライド ${i + 1}`
      );
    });

    return out;
  }

  function buildInfoRows(item) {
    const pages =
      realMeta(item.meta_pages, "meta_pages") ||
      realMeta(item.presentation_slide_count, "meta_pages");
    const ratio =
      realMeta(item.meta_ratio, "meta_size") ||
      realMeta(item.meta_size, "meta_size") ||
      realMeta(item.presentation_aspect_ratio, "meta_size");
    const fileSize = realMeta(item.file_size, "file_size") || realMeta(item.meta_file_size, "file_size");
    const env = realMeta(item.environment, "environment");
    const soft = Array.isArray(item.presentation_recommended_software)
      ? item.presentation_recommended_software.filter(Boolean).join(" / ")
      : "";
    const usage = pickStr(item.presentation_usage, item.meta_presentation_usage, item.subcategory);
    const license = pickStr(item.license_label, item.commercial_use);

    return [
      ["カテゴリ", DISPLAY_NAME],
      ["ファイル形式", formatInfoLabel(item)],
      ["スライドサイズ", ratio || "—"],
      ["スライド数", pages || "—"],
      ["ファイルサイズ", fileSize || "—"],
      ["対応ソフト", soft || env || "—"],
      ["用途", usage || "—"],
      ["公開日", publishedLabel(item) || "—"],
      ["素材ID", pickStr(item.slug, item.id)],
      ["ライセンス", license && license !== "—" ? license : "—"],
    ];
  }

  function usageLinesFromItem(item) {
    const scenarios = item.presentation_usage_scenarios || item.usage_scenarios || item.recommended_for || [];
    const fromList = scenarios.map((x) => String(x).trim()).filter(Boolean);
    if (fromList.length) return fromList.slice(0, 6);
    const usage = pickStr(item.presentation_usage, item.subcategory);
    return usage ? [usage] : [];
  }

  function resolveThumbSrc(item) {
    const imgs = resolvePreviewImages(item);
    return imgs[0]?.src || "";
  }

  function renderRelatedCard(item) {
    const href = detailHref(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const thumb = resolveThumbSrc(item);
    const fmt = (item.file_formats || []).map((f) => String(f).toUpperCase()).join(" / ");
    return (
      `<article class="mat-pres-d-related-card" data-pres-d-related data-item-id="${escapeHtml(item.id)}">` +
      `<div class="mat-pres-d-related-card__media">` +
      `<a href="${href}" aria-label="${escapeHtml(item.title)}">` +
      (thumb
        ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
        : `<span class="mat-pres-d-related-card__ph" aria-hidden="true">▣</span>`) +
      `</a>` +
      `<button type="button" class="mat-pres-d-related-card__dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
      `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
      `<span aria-hidden="true">↓</span>` +
      `</button>` +
      `</div>` +
      `<h3 class="mat-pres-d-related-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      (fmt ? `<p class="mat-pres-d-related-card__fmt">${escapeHtml(fmt)}</p>` : "") +
      `<div class="mat-pres-d-related-card__foot">` +
      `<span><span class="mat-pres-d-star" aria-hidden="true">★</span>${rating}</span>` +
      `<span><span aria-hidden="true">↓</span>${dl}</span>` +
      `</div>` +
      `</article>`
    );
  }

  function renderPreviewBlock(images) {
    if (!images.length) {
      return (
        `<div class="mat-pres-d-preview mat-pres-d-preview--empty" data-pres-d-preview>` +
        `<div class="mat-pres-d-preview__empty">` +
        `<span aria-hidden="true">▣</span>` +
        `<p>プレビュー画像はまだありません</p>` +
        `</div>` +
        `</div>`
      );
    }

    const main = images[0];
    const hasMulti = images.length > 1;
    return (
      `<div class="mat-pres-d-preview" data-pres-d-preview data-pres-d-total="${images.length}">` +
      `<div class="mat-pres-d-preview__stage">` +
      `<img class="mat-pres-d-preview__img" data-pres-d-main src="${escapeHtml(main.src)}" alt="${escapeHtml(main.label)}" decoding="async">` +
      (hasMulti
        ? `<button type="button" class="mat-pres-d-preview__nav mat-pres-d-preview__nav--prev" data-pres-d-prev aria-label="前のスライド">‹</button>` +
          `<button type="button" class="mat-pres-d-preview__nav mat-pres-d-preview__nav--next" data-pres-d-next aria-label="次のスライド">›</button>`
        : "") +
      `</div>` +
      `</div>` +
      (hasMulti
        ? `<div class="mat-pres-d-thumbs" role="tablist" aria-label="スライド一覧">` +
          images
            .map(
              (img, i) =>
                `<button type="button" class="mat-pres-d-thumb${i === 0 ? " is-active" : ""}" role="tab" aria-selected="${i === 0 ? "true" : "false"}" data-pres-d-thumb="${i}" aria-label="${escapeHtml(img.label)}">` +
                `<img src="${escapeHtml(img.src)}" alt="" loading="lazy" decoding="async">` +
                `</button>`
            )
            .join("") +
          `</div>`
        : "")
    );
  }

  function renderShell(item, related) {
    const Fav = global.TasuMaterialsFavorites;
    const Download = global.TasuMaterialsDownload;
    const tags = itemTags(item);
    const favOn = Fav?.isFavorited?.(item.id);
    const dlLabel =
      Download?.primaryButtonLabel?.(item) || item.button_label || "広告を見て無料ダウンロード";
    const rating = Number(item.rating || 0).toFixed(1);
    const ratingCount = Number(item.rating_count || 0);
    const hrefList = listHref();
    const desc = pickStr(item.long_description, item.description) || "プレゼンテンプレートです。";
    const relatedPres = (related || []).filter(
      (r) => r && r.category_id === DATA_CATEGORY && r.id !== item.id
    );
    const infoRows = buildInfoRows(item);
    const usageLines = usageLinesFromItem(item);
    const images = resolvePreviewImages(item);
    const licenseLead = pickStr(item.commercial_use, "商用利用OK・クレジット表記不要");
    const formatSel = formatSelectLabel(item);
    const ratioOpt =
      realMeta(item.meta_ratio, "meta_size") ||
      realMeta(item.meta_size, "meta_size") ||
      "—";

    const tagChips = tags.map((t) => `<span class="mat-pres-d-tag">${escapeHtml(t)}</span>`).join("");
    const sideTags = tags
      .map(
        (t) =>
          `<a class="mat-pres-d-side-tag" href="/materials/list.html?category=${QUERY_CATEGORY}&q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`
      )
      .join("");

    return (
      `<div class="mat-pres-d" data-pres-detail data-item-id="${escapeHtml(item.id)}" style="--mat-pres-ops:${ACCENT}">` +
      `<div class="mat-pres-d-back-mobile">` +
      `<a href="${hrefList}"><span aria-hidden="true">‹</span> プレゼンテンプレート一覧に戻る</a>` +
      `</div>` +
      `<nav class="mat-pres-d-crumb" aria-label="パンくず">` +
      `<a href="/materials/">ホーム</a><span aria-hidden="true">›</span>` +
      `<a href="/materials/index.html">素材を探す</a><span aria-hidden="true">›</span>` +
      `<a href="${hrefList}">プレゼンテンプレート一覧</a><span aria-hidden="true">›</span>` +
      `<span aria-current="page">${escapeHtml(item.title)}</span>` +
      `</nav>` +
      `<div class="mat-pres-d-layout">` +
      `<section class="mat-pres-d-main">` +
      `<div class="mat-pres-d-head__badges">` +
      `<span class="mat-pres-d-badge">${DISPLAY_NAME}</span>` +
      (item.is_free !== false ? `<span class="mat-pres-d-free">無料</span>` : "") +
      `</div>` +
      `<h1 class="mat-pres-d-title">${escapeHtml(item.title)}</h1>` +
      `<p class="mat-pres-d-lead">${escapeHtml(item.description || "")}</p>` +
      `<div class="mat-pres-d-tags">${tagChips}</div>` +
      `<div class="mat-pres-d-stats">` +
      `<span class="mat-pres-d-stats__rating"><span class="mat-pres-d-star" aria-hidden="true">★</span>` +
      `<b>${rating}</b>${ratingCount ? `<span class="mat-pres-d-stats__count">（${formatCount(ratingCount)}）</span>` : ""}</span>` +
      `<span class="mat-pres-d-stats__dl"><span aria-hidden="true">↓</span><b>${formatCount(item.download_count)}</b>` +
      `<span class="mat-pres-d-stats__dl-label">ダウンロード</span></span>` +
      `<button type="button" class="mat-pres-d-stats__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<span class="mat-pres-d-heart" aria-hidden="true"></span>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</div>` +
      renderPreviewBlock(images) +
      `<div class="mat-pres-d-tabs" data-pres-d-tabs>` +
      `<div class="mat-pres-d-tabs__nav" role="tablist" aria-label="詳細タブ">` +
      `<button type="button" class="mat-pres-d-tabs__tab is-active" role="tab" aria-selected="true" data-pres-d-sect="desc">説明</button>` +
      `<button type="button" class="mat-pres-d-tabs__tab" role="tab" aria-selected="false" data-pres-d-sect="slides">収録スライド</button>` +
      `<button type="button" class="mat-pres-d-tabs__tab" role="tab" aria-selected="false" data-pres-d-sect="usage">利用シーン</button>` +
      `<button type="button" class="mat-pres-d-tabs__tab" role="tab" aria-selected="false" data-pres-d-sect="custom">カスタマイズ方法</button>` +
      `<button type="button" class="mat-pres-d-tabs__tab" role="tab" aria-selected="false" data-pres-d-sect="related">関連素材</button>` +
      `<button type="button" class="mat-pres-d-tabs__tab" role="tab" aria-selected="false" data-pres-d-sect="comments">コメント</button>` +
      `</div>` +
      `<div class="mat-pres-d-tabs__panel is-active" data-pres-d-sect-panel="desc">` +
      `<p class="mat-pres-d-desc">${escapeHtml(desc)}</p>` +
      (usageLines.length
        ? `<ul class="mat-pres-d-bullets">${usageLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
        : "") +
      `</div>` +
      `<div class="mat-pres-d-tabs__panel" data-pres-d-sect-panel="slides" hidden>` +
      (images.length > 1
        ? `<p class="mat-pres-d-desc">収録プレビュー画像：${images.length} 枚（既存 Asset のみ）</p>`
        : `<p class="mat-pres-d-empty-note">収録プレビュー画像は準備中です。</p>`) +
      `</div>` +
      `<div class="mat-pres-d-tabs__panel" data-pres-d-sect-panel="usage" hidden>` +
      (usageLines.length
        ? `<ul class="mat-pres-d-bullets">${usageLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
        : `<p class="mat-pres-d-empty-note">利用シーンデータはまだありません。</p>`) +
      `</div>` +
      `<div class="mat-pres-d-tabs__panel" data-pres-d-sect-panel="custom" hidden>` +
      `<p class="mat-pres-d-empty-note">カスタマイズ手順は準備中です。</p>` +
      `</div>` +
      `<div class="mat-pres-d-tabs__panel" data-pres-d-sect-panel="related" hidden>` +
      `<p class="mat-pres-d-empty-note">下記の関連プレゼンテンプレートをご覧ください。</p>` +
      `</div>` +
      `<div class="mat-pres-d-tabs__panel" data-pres-d-sect-panel="comments" hidden>` +
      `<p class="mat-pres-d-empty-note">コメント機能は準備中です。</p>` +
      `</div>` +
      `</div>` +
      `</section>` +
      `<aside class="mat-pres-d-aside" aria-label="プレゼンテンプレートサイドバー">` +
      `<a class="mat-pres-d-aside__back" href="${hrefList}"><span aria-hidden="true">‹</span> プレゼンテンプレート一覧に戻る</a>` +
      `<div class="mat-pres-d-side-card">` +
      `<h2 class="mat-pres-d-side-card__title"><span class="mat-pres-d-side-card__accent" aria-hidden="true">↓</span>ダウンロード</h2>` +
      `<p class="mat-detail-dl-hint" data-mat-dl-hint></p>` +
      `<label class="mat-pres-d-field"><span>ファイル形式</span>` +
      `<select aria-label="ファイル形式"><option selected>${escapeHtml(formatSel)}</option></select></label>` +
      `<label class="mat-pres-d-field"><span>サイズ</span>` +
      `<select ${ratioOpt === "—" ? "disabled" : ""} aria-label="スライドサイズ">` +
      `<option selected>${escapeHtml(ratioOpt)}</option>` +
      `</select></label>` +
      `<button type="button" class="mat-pres-d-dl-cta" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      `<span data-mat-download-label>${escapeHtml(dlLabel)}</span>` +
      `</button>` +
      `<p class="mat-pres-d-dl-note">※ クレジット表記不要で、商用利用が可能です</p>` +
      `</div>` +
      `<div class="mat-pres-d-side-card">` +
      `<h2 class="mat-pres-d-side-card__title"><span class="mat-pres-d-side-card__accent" aria-hidden="true">ℹ</span>素材情報</h2>` +
      `<dl class="mat-pres-d-info">` +
      infoRows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("") +
      `</dl>` +
      `</div>` +
      `<div class="mat-pres-d-side-card">` +
      `<h2 class="mat-pres-d-side-card__title"><span class="mat-pres-d-side-card__accent" aria-hidden="true">✓</span>ライセンス</h2>` +
      `<p class="mat-pres-d-license__lead">${escapeHtml(licenseLead)}</p>` +
      `<p class="mat-pres-d-license__sub">再配布・販売は禁止されています</p>` +
      `<a class="mat-pres-d-license__link" href="/company/legal/materials.html">ライセンス詳細を見る ›</a>` +
      `</div>` +
      `<div class="mat-pres-d-side-card">` +
      `<h2 class="mat-pres-d-side-card__title"><span class="mat-pres-d-side-card__accent" aria-hidden="true">#</span>タグ</h2>` +
      `<div class="mat-pres-d-side-tags">${sideTags || `<p class="mat-pres-d-empty-note">タグはありません。</p>`}</div>` +
      (tags.length
        ? `<a class="mat-pres-d-side-more" href="${hrefList}">すべてのタグを見る（${tags.length}） ›</a>`
        : "") +
      `</div>` +
      `<button type="button" class="mat-pres-d-rail-fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<span class="mat-pres-d-heart" aria-hidden="true"></span>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</aside>` +
      `</div>` +
      `<section class="mat-pres-d-related" aria-labelledby="matPresRelatedTitle">` +
      `<div class="mat-pres-d-related__head">` +
      `<h2 id="matPresRelatedTitle"><span aria-hidden="true">〰</span>この素材を使用している人はこちらの素材も使っています</h2>` +
      `<a href="${hrefList}">すべて見る ›</a>` +
      `</div>` +
      (relatedPres.length
        ? `<div class="mat-pres-d-related__grid">${relatedPres.slice(0, RELATED_DISPLAY_LIMIT).map(renderRelatedCard).join("")}</div>`
        : `<p class="mat-pres-d-empty-note">関連するプレゼンテンプレートはまだありません。</p>`) +
      `</section>` +
      `</div>`
    );
  }

  function wireSectionTabs(root) {
    const tabs = root.querySelectorAll("[data-pres-d-sect]");
    const panels = root.querySelectorAll("[data-pres-d-sect-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-pres-d-sect");
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach((p) => {
          const on = p.getAttribute("data-pres-d-sect-panel") === id;
          p.classList.toggle("is-active", on);
          p.hidden = !on;
        });
      });
    });
  }

  function wirePreviewGallery(root, images) {
    if (!images.length) return;
    let index = 0;
    const main = root.querySelector("[data-pres-d-main]");
    const thumbs = root.querySelectorAll("[data-pres-d-thumb]");

    const show = (i) => {
      index = (i + images.length) % images.length;
      if (main) {
        main.src = images[index].src;
        main.alt = images[index].label;
      }
      thumbs.forEach((t, ti) => {
        const on = ti === index;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
    };

    thumbs.forEach((t) => {
      t.addEventListener("click", () => {
        const i = Number(t.getAttribute("data-pres-d-thumb") || 0);
        show(i);
      });
    });
    root.querySelector("[data-pres-d-prev]")?.addEventListener("click", () => show(index - 1));
    root.querySelector("[data-pres-d-next]")?.addEventListener("click", () => show(index + 1));
  }

  async function mount(root, item, related) {
    if (!root || !item || item.category_id !== DATA_CATEGORY) return false;

    const relatedList = related || [];
    const images = resolvePreviewImages(item);
    root.innerHTML = renderShell(item, relatedList);
    document.title = `${item.title} | TASFUL Materials`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", item.description || "");

    wireSectionTabs(root);
    wirePreviewGallery(root, images);

    global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(root, item);

    const byId = new Map(relatedList.map((r) => [r.id, r]));
    root.querySelectorAll("[data-pres-d-related]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const rel = byId.get(id);
      if (rel) global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(card, rel);
    });

    return true;
  }

  function destroy() {
    /* no-op */
  }

  global.TasuMaterialsPresentationDetail = {
    mount,
    destroy,
    isPresentationItem(item) {
      return !!(item && item.category_id === DATA_CATEGORY);
    },
    DISPLAY_NAME,
  };
})(typeof window !== "undefined" ? window : globalThis);
