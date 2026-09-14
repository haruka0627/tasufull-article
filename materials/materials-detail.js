/**
 * TASFUL Materials — 素材詳細ページ共通テンプレート
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

  function renderTags(tags, opts = {}) {
    const clickable = !!opts.clickable;
    return (tags || [])
      .map((t) => {
        if (clickable) {
          return `<a class="mat-detail-tag mat-detail-tag--link" href="${escapeHtml(tagSearchHref(t))}">${escapeHtml(t)}</a>`;
        }
        return `<span class="mat-detail-tag">${escapeHtml(t)}</span>`;
      })
      .join("");
  }

  function tagSearchHref(tag) {
    return `/materials/list.html?q=${encodeURIComponent(String(tag || ""))}`;
  }

  /** @type {Record<string, { label: string, key: string }[]>} */
  const META_BY_CATEGORY = {
    web: [
      { label: "形式", key: "meta_format" },
      { label: "構成", key: "meta_pages" },
      { label: "対応ブラウザ / Responsive", key: "meta_compatibility" },
      { label: "更新日", key: "meta_updated" },
    ],
    code: [
      { label: "言語", key: "meta_language" },
      { label: "構成", key: "meta_pages" },
      { label: "対応環境", key: "meta_compatibility" },
      { label: "更新日", key: "meta_updated" },
    ],
    bgm: [
      { label: "形式", key: "meta_format" },
      { label: "長さ", key: "meta_duration" },
      { label: "BPM", key: "meta_bpm" },
      { label: "ループ", key: "meta_loop" },
    ],
    sfx: [
      { label: "形式", key: "meta_format" },
      { label: "長さ", key: "meta_duration" },
      { label: "用途", key: "meta_usage" },
      { label: "更新日", key: "meta_updated" },
    ],
    template: [
      { label: "形式", key: "meta_format" },
      { label: "サイズ", key: "meta_size" },
      { label: "ページ数", key: "meta_pages" },
      { label: "更新日", key: "meta_updated" },
    ],
    presentation: [
      { label: "ページ数", key: "meta_pages" },
      { label: "比率", key: "meta_ratio" },
      { label: "形式", key: "meta_presentation_formats" },
      { label: "更新日", key: "meta_updated" },
    ],
    document: [
      { label: "用途", key: "meta_document_usage" },
      { label: "文字数", key: "meta_char_count" },
      { label: "形式", key: "meta_document_formats" },
      { label: "更新日", key: "meta_updated" },
    ],
    icon: [
      { label: "点数", key: "icon_count_display" },
      { label: "形式", key: "meta_format_exports" },
      { label: "サイズ", key: "meta_size_range" },
      { label: "更新日", key: "meta_updated" },
    ],
    image: [
      { label: "形式", key: "meta_format" },
      { label: "解像度", key: "meta_resolution" },
      { label: "サイズ", key: "meta_size" },
      { label: "更新日", key: "meta_updated" },
    ],
    illustration: [
      { label: "解像度", key: "meta_resolution" },
      { label: "背景透過", key: "meta_transparent" },
      { label: "商用利用", key: "commercial_use" },
      { label: "編集可否", key: "meta_editable" },
      { label: "AI生成", key: "meta_ai_generated" },
      { label: "作者", key: "meta_author" },
      { label: "公開日", key: "meta_published" },
      { label: "更新日", key: "meta_updated" },
    ],
    background: [
      { label: "解像度", key: "meta_resolution" },
      { label: "比率", key: "meta_ratio" },
      { label: "背景透過", key: "meta_transparent" },
      { label: "AI生成", key: "meta_ai_generated" },
      { label: "商用利用", key: "commercial_use" },
      { label: "推奨用途", key: "meta_recommended_usage" },
      { label: "カラー", key: "meta_color" },
      { label: "容量", key: "file_size" },
    ],
    tool: [
      { label: "種別", key: "meta_tool_type" },
      { label: "利用形式", key: "meta_usage_form" },
      { label: "出力形式", key: "meta_tool_output_formats" },
      { label: "更新日", key: "meta_updated" },
    ],
  };

  function isIcon(item) {
    return item && item.category_id === "icon";
  }

  function isCode(item) {
    return item && item.category_id === "code";
  }

  function isDocument(item) {
    return item && item.category_id === "document";
  }

  function isTool(item) {
    return item && item.category_id === "tool";
  }

  function isPresentation(item) {
    return item && item.category_id === "presentation";
  }

  function isIllustration(item) {
    return item && item.category_id === "illustration";
  }

  function isBackground(item) {
    return item && item.category_id === "background";
  }

  function hasUsageScenarios(item) {
    return isIllustration(item) || isBackground(item) || isIcon(item);
  }

  function hasAiAssist(item) {
    return (
      isIllustration(item) ||
      isBackground(item) ||
      isIcon(item) ||
      isCode(item) ||
      isDocument(item) ||
      isTool(item) ||
      isPresentation(item)
    );
  }

  function categoryListHref(item) {
    if (item.category_id === "illustration") {
      return "/materials/list.html?category=illustration";
    }
    if (item.category_id === "background") {
      return "/materials/list.html?category=background";
    }
    if (item.category_id === "icon") {
      return "/materials/list.html?category=icon";
    }
    if (item.category_id === "code") {
      return "/materials/list.html?category=code";
    }
    if (item.category_id === "document") {
      return "/materials/list.html?category=text";
    }
    if (item.category_id === "tool") {
      return "/materials/list.html?category=tool";
    }
    if (item.category_id === "presentation") {
      return "/materials/list.html?category=presentation";
    }
    return `/materials/list.html?category=${encodeURIComponent(item.category_id)}`;
  }

  function metaCardValue(item, key) {
    if (key === "meta_usage") {
      return (item.usage_tags || []).slice(0, 2).join(" · ") || "—";
    }
    if (key === "meta_compatibility") {
      return item.meta_compatibility || item.environment || "—";
    }
    if (key === "meta_points") {
      return item.meta_points || item.meta_pages || "—";
    }
    if (key === "meta_ratio") {
      return item.meta_ratio || item.meta_size || "—";
    }
    if (key === "meta_language") {
      return item.meta_language || item.meta_format || "—";
    }
    const val = item[key];
    return val != null && String(val).trim() !== "" ? String(val) : "—";
  }

  function renderMetaCards(item) {
    const spec = META_BY_CATEGORY[item.category_id] || META_BY_CATEGORY.template;
    const cards = spec.map((field) => ({
      label: field.label,
      value: metaCardValue(item, field.key),
    }));
    const extraClass = isIllustration(item)
      ? " mat-detail-meta--illustration"
      : isBackground(item)
        ? " mat-detail-meta--background"
        : isIcon(item)
          ? " mat-detail-meta--icon"
          : "";

    return (
      `<ul class="mat-detail-meta${extraClass}">` +
      cards
        .map(
          (c) =>
            `<li class="mat-detail-meta__item">` +
            `<span class="mat-detail-meta__label">${escapeHtml(c.label)}</span>` +
            `<span class="mat-detail-meta__value">${escapeHtml(c.value)}</span>` +
            `</li>`
        )
        .join("") +
      `</ul>`
    );
  }

  function isImageMaterial(item) {
    return item.category_id === "image" || item.category_id === "illustration" || item.category_id === "background";
  }

  function renderBackgroundBadges(item) {
    if (item.category_id !== "background") return "";
    const labels = item.preview_bg_labels || [];
    if (!labels.length) return "";
    return (
      `<div class="mat-detail-preview__bg-badges" aria-hidden="true">` +
      labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("") +
      `</div>`
    );
  }

  function renderBackgroundDeviceSwitcher() {
    return (
      `<div class="mat-detail-bg-devices" role="tablist" aria-label="表示サイズ">` +
      `<button type="button" class="mat-detail-bg-device is-active" role="tab" aria-selected="true" data-bg-device="pc">PC</button>` +
      `<button type="button" class="mat-detail-bg-device" role="tab" aria-selected="false" data-bg-device="tablet">タブレット</button>` +
      `<button type="button" class="mat-detail-bg-device" role="tab" aria-selected="false" data-bg-device="mobile">スマホ</button>` +
      `</div>`
    );
  }

  function renderIllustrationPreviewLoader() {
    return (
      `<div class="mat-detail-preview__loader" data-mat-preview-skeleton aria-hidden="true">` +
      `<span class="mat-detail-preview__skeleton"></span>` +
      `</div>` +
      `<div class="mat-detail-preview__error" data-mat-preview-error hidden>` +
      `<p class="mat-detail-preview__error-text">画像を読み込めませんでした</p>` +
      `<button type="button" class="mat-detail-btn mat-detail-btn--ghost mat-detail-preview__reload" data-mat-preview-reload>再読み込み</button>` +
      `</div>`
    );
  }

  function renderPreviewImage(item) {
    const images = item.preview_images || [];
    if (isImageMaterial(item) && images.length) {
      const first = images[0];
      const bgBadges = renderBackgroundBadges(item);
      const thumbs =
        images.length > 1
          ? `<div class="mat-detail-preview__thumbs" role="tablist" aria-label="プレビュー切替">` +
            images
              .map(
                (v, i) =>
                  `<button type="button" class="mat-detail-preview__thumb mat-detail-preview__thumb--sample${i === 0 ? " is-active" : ""}" role="tab" aria-selected="${i === 0 ? "true" : "false"}" data-preview-src="${escapeHtml(v.src)}" data-preview-alt="${escapeHtml(v.alt || item.title)}" aria-label="${escapeHtml(v.label || "プレビュー")}">` +
                  `<img src="${escapeHtml(v.src)}" alt="" loading="lazy" decoding="async">` +
                  `</button>`
              )
              .join("") +
            `</div>`
          : "";

      const previewExtraClass = isIllustration(item)
        ? " mat-detail-preview--illustration"
        : isBackground(item)
          ? " mat-detail-preview--background"
          : "";
      const deviceSwitcher = isBackground(item) ? renderBackgroundDeviceSwitcher() : "";
      const wrapState = isIllustration(item) ? ' data-mat-preview-state="loading"' : "";
      const loader = isIllustration(item) ? renderIllustrationPreviewLoader() : "";

      return (
        `<div class="mat-detail-preview mat-detail-preview--image mat-detail-preview--sample${previewExtraClass}" data-mat-detail-preview="image"${isBackground(item) ? ' data-mat-bg-preview="true"' : ""}>` +
        deviceSwitcher +
        `<div class="mat-detail-preview__device mat-detail-preview__device--pc" data-bg-device-frame="pc">` +
        `<div class="mat-detail-preview__main-wrap" data-mat-preview-wrap${wrapState}>` +
        loader +
        `<button type="button" class="mat-detail-preview__main mat-detail-preview__main--sample" data-mat-detail-preview-main data-mat-lightbox-src="${escapeHtml(first.src)}"${isBackground(item) ? ' data-mat-lightbox-enhanced="true"' : ""} aria-label="プレビューを拡大">` +
        `<img src="${escapeHtml(first.src)}" data-mat-preview-img data-src="${escapeHtml(first.src)}" alt="${escapeHtml(first.alt || item.title)}" loading="eager" decoding="async">` +
        bgBadges +
        `<span class="mat-detail-preview__zoom-hint" aria-hidden="true">クリックで拡大</span>` +
        `</button>` +
        `</div>` +
        `</div>` +
        thumbs +
        `</div>`
      );
    }

    const variants = item.preview_variants || [];
    const first = variants[0] || { thumb_style: item.thumbnail_style };
    return (
      `<div class="mat-detail-preview mat-detail-preview--image" data-mat-detail-preview="image">` +
      `<div class="mat-detail-preview__main materials-card__thumb materials-card__thumb--${escapeHtml(first.thumb_style)}" data-mat-detail-preview-main aria-hidden="true"></div>` +
      (variants.length > 1
        ? `<div class="mat-detail-preview__thumbs" role="tablist" aria-label="プレビュー切替">` +
          variants
            .map(
              (v, i) =>
                `<button type="button" class="mat-detail-preview__thumb materials-card__thumb materials-card__thumb--${escapeHtml(v.thumb_style)}${i === 0 ? " is-active" : ""}" role="tab" aria-selected="${i === 0 ? "true" : "false"}" data-thumb-style="${escapeHtml(v.thumb_style)}" aria-label="${escapeHtml(v.label || "プレビュー")}"></button>`
            )
            .join("") +
          `</div>`
        : "") +
      `</div>`
    );
  }

  /** @type {Record<string, string>} */
  const ICON_SVG_PATHS = {
    home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    search:
      '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    mail:
      '<rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m4 8 8 5 8-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    phone:
      '<path d="M7 4h3l1.5 4-2 1.2a11 11 0 0 0 5.3 5.3L17 12.5 21 14v3a2 2 0 0 1-2.2 2A16 16 0 0 1 6 7.2 2 2 0 0 1 8 5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    user:
      '<circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    settings:
      '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    calendar:
      '<rect x="4" y="5" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    camera:
      '<path d="M4 8h4l2-2h4l2 2h4v10H4V8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    heart:
      '<path d="M12 20s-7-4.4-7-9.5a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10.5C19 15.6 12 20 12 20z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    star:
      '<path d="M12 3.5 14.2 9l5.8.5-4.4 3.8 1.3 5.7L12 16.8 7.1 19l1.3-5.7L4 9.5l5.8-.5L12 3.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    bell:
      '<path d="M12 4a4 4 0 0 0-4 4v3l-2 3h12l-2-3V8a4 4 0 0 0-4-4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    bookmark:
      '<path d="M6 4h12v16l-6-4-6 4V4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    share:
      '<circle cx="18" cy="5" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="19" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11l8-4M8 13l8 4" stroke="currentColor" stroke-width="1.8"/>',
    download:
      '<path d="M12 4v10M8 11l4 4 4-4M5 20h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    upload:
      '<path d="M12 20V10M8 14l4-4 4 4M5 4h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    edit:
      '<path d="M4 20h4l10-10-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    trash:
      '<path d="M4 7h16M9 7V5h6v2M7 7l1 14h8l1-14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    minus: '<path d="M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    check: '<path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    menu: '<path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    grid:
      '<rect x="4" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    list:
      '<path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="18" r="1" fill="currentColor"/>',
    filter:
      '<path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    map:
      '<path d="M4 6l6-2 6 2 4-1v14l-6 2-6-2-4 1V6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 4v16M16 6v16" stroke="currentColor" stroke-width="1.8"/>',
    image:
      '<rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><path d="m4 17 5-5 3 3 3-4 5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    video:
      '<rect x="3" y="7" width="13" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 10 5-3v10l-5-3V10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    mic:
      '<rect x="9" y="4" width="6" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    lock:
      '<rect x="6" y="10" width="12" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V8a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    unlock:
      '<rect x="6" y="10" width="12" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 10V8a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    eye:
      '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    link:
      '<path d="M10 14a4 4 0 0 1 0-5.7l1.3-1.3a4 4 0 0 1 5.7 5.7l-1.3 1.3M14 10a4 4 0 0 1 0 5.7l-1.3 1.3a4 4 0 0 1-5.7-5.7l1.3-1.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    cloud:
      '<path d="M8 19h9a4 4 0 0 0 .5-8A5 5 0 0 0 8 7a4 4 0 0 0-1 7.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    wifi:
      '<path d="M5 12.5a11 11 0 0 1 14 0M8.5 16a6 6 0 0 1 7 0M12 19.5h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    "brand-x":
      '<path d="M5 5l14 14M19 5 5 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    "brand-fb":
      '<path d="M14 8h2.5a2.5 2.5 0 0 1 0 5H14v6h-4V8h4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    "brand-ig":
      '<rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16.5" cy="7.5" r="1" fill="currentColor"/>',
    "brand-yt":
      '<rect x="4" y="7" width="16" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M11 10l5 2-5 2V10z" fill="currentColor"/>',
    "brand-line":
      '<rect x="6" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 10h6M9 14h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    "brand-gh":
      '<path d="M9 20c-3-1-4-3-4-6V8a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v6c0 3-1 5-4 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="11" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    "brand-slack":
      '<path d="M8 8h3v3H8zM13 8h3v3h-3zM8 13h3v3H8zM13 13h3v3h-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    "brand-pin":
      '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 9v6M9 12h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    "brand-tt":
      '<path d="M9 6v12l6-6-6-6z" fill="currentColor"/><path d="M15 6v3a4 4 0 0 0 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    "brand-threads":
      '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 10c1.5-1 4-.5 4 2s-2.5 3-4 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    "brand-li":
      '<rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11v5M8 8v.01M12 16v-3a2 2 0 0 1 4 0v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    "brand-wa":
      '<path d="M12 4a7 7 0 0 0-6 10l-1 4 4-1A7 7 0 1 0 12 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    "brand-tg":
      '<path d="M5 12l14-6-6 14-2-5-6-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  };

  function renderIconGlyphSvg(glyphKey, size) {
    const px = size || 28;
    const inner = ICON_SVG_PATHS[glyphKey] || ICON_SVG_PATHS.home;
    return `<svg class="mat-detail-icon-glyph" width="${px}" height="${px}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  }

  function resolveIconSetIcons(iconSet) {
    if (!iconSet || !iconSet.icons?.length) return [];
    const byId = new Map(iconSet.icons.map((icon) => [icon.id, icon]));
    const previewIds = iconSet.preview_icon_ids || iconSet.icons.slice(0, 8).map((i) => i.id);
    const preview = previewIds.map((id) => byId.get(id)).filter(Boolean);
    return { preview, all: iconSet.icons };
  }

  function renderIconSetPreviewItem(icon) {
    return (
      `<div class="mat-detail-icon-set__item" title="${escapeHtml(icon.label)}">` +
      `<span class="mat-detail-icon-set__thumb">${renderIconGlyphSvg(icon.glyph, 26)}</span>` +
      `<span class="mat-detail-icon-set__label">${escapeHtml(icon.label)}</span>` +
      `</div>`
    );
  }

  function renderPreviewIconGrid(item) {
    const iconSet = item.icon_set;
    if (isIcon(item) && iconSet?.icons?.length) {
      const { preview, all } = resolveIconSetIcons(iconSet);
      const formats = item.export_formats || iconSet.export_formats || [];
      const formatBadges = formats
        .map(
          (fmt) =>
            `<span class="mat-detail-icon-format__badge mat-detail-icon-format__badge--${escapeHtml(String(fmt).toLowerCase())}">${escapeHtml(fmt)}</span>`
        )
        .join("");
      return (
        `<div class="mat-detail-preview mat-detail-preview--icons mat-detail-preview--icon-set" data-mat-detail-preview="icon-grid">` +
        `<div class="mat-detail-icon-set">` +
        `<div class="mat-detail-icon-set__head">` +
        `<p class="mat-detail-icon-set__title">収録アイコン（${escapeHtml(String(iconSet.count || all.length))}点）</p>` +
        `<div class="mat-detail-icon-format__badges" aria-label="対応形式">${formatBadges}</div>` +
        `</div>` +
        `<div class="mat-detail-icon-set__grid">` +
        preview.map((icon) => renderIconSetPreviewItem(icon)).join("") +
        `</div>` +
        `<div class="mat-detail-icon-set__foot">` +
        `<button type="button" class="mat-detail-btn mat-detail-btn--ghost mat-detail-icon-set__all" data-icon-set-open>すべて見る（${escapeHtml(String(all.length))}点）</button>` +
        `</div>` +
        `</div>` +
        `<p class="mat-detail-preview__hint">SVG素材 · ${escapeHtml(item.meta_size_range || "16px〜512px")} · ${escapeHtml(item.icon_count_display || item.meta_pages || "複数点")}</p>` +
        `</div>`
      );
    }

    const styles = ["icon-grid", "template-card", "web-hamburger", "audio-sfx", "image-cat", "code-typing"];
    return (
      `<div class="mat-detail-preview mat-detail-preview--icons" data-mat-detail-preview="icon-grid">` +
      `<div class="mat-detail-icon-grid">` +
      styles
        .map(
          (s) =>
            `<span class="mat-detail-icon-grid__item materials-card__thumb materials-card__thumb--${s}" aria-hidden="true"></span>`
        )
        .join("") +
      `</div>` +
      `<p class="mat-detail-preview__hint">${escapeHtml(item.meta_pages || "複数点")} · ${escapeHtml(item.meta_format)}</p>` +
      `</div>`
    );
  }

  function renderIconFormatsSection(item) {
    if (!isIcon(item)) return "";
    const formats = item.export_formats || [];
    const future = item.future_export_features || [];
    if (!formats.length && !future.length) return "";
    const formatBadges = formats
      .map(
        (fmt) =>
          `<span class="mat-detail-icon-format__badge mat-detail-icon-format__badge--${escapeHtml(String(fmt).toLowerCase())}">${escapeHtml(fmt)}</span>`
      )
      .join("");
    const futureActions = future
      .map(
        (feat) =>
          `<button type="button" class="mat-detail-icon-format__future" disabled title="準備中">` +
          `${escapeHtml(feat.label)}<span class="mat-detail-icon-format__soon">準備中</span>` +
          `</button>`
      )
      .join("");
    return (
      `<section class="mat-detail-card mat-detail-section mat-detail-icon-formats" aria-labelledby="matDetailIconFormatsTitle">` +
      `<h2 id="matDetailIconFormatsTitle" class="mat-detail-section__title">対応形式</h2>` +
      `<p class="mat-detail-icon-formats__lead">SVG素材として提供。PNG書き出し・ZIP一括ダウンロードに対応しています。</p>` +
      `<div class="mat-detail-icon-format__badges" role="list">${formatBadges}</div>` +
      (futureActions
        ? `<div class="mat-detail-icon-format__future-row" aria-label="今後追加予定">${futureActions}</div>`
        : "") +
      `</section>`
    );
  }

  function renderIconStyleSection(item) {
    if (!isIcon(item)) return "";
    const styles = item.icon_styles || [];
    if (!styles.length) return "";
    return (
      `<section class="mat-detail-card mat-detail-section mat-detail-icon-styles" aria-labelledby="matDetailIconStylesTitle">` +
      `<h2 id="matDetailIconStylesTitle" class="mat-detail-section__title">スタイル</h2>` +
      `<div class="mat-detail-icon-styles__chips" role="list">` +
      styles
        .map(
          (label) =>
            `<a class="mat-detail-icon-styles__chip" role="listitem" href="${escapeHtml(tagSearchHref(label))}">${escapeHtml(label)}</a>`
        )
        .join("") +
      `</div>` +
      `</section>`
    );
  }

  function renderIconSizeChips(sizes) {
    const list = sizes || [];
    if (!list.length) return "—";
    return (
      `<div class="mat-detail-icon-sizes">` +
      list
        .map((px) => `<span class="mat-detail-icon-sizes__chip">${escapeHtml(String(px))}px</span>`)
        .join("") +
      `</div>`
    );
  }

  function renderIconSoftwareChips(software) {
    const list = software || [];
    if (!list.length) return "—";
    return (
      `<div class="mat-detail-icon-software">` +
      list.map((name) => `<span class="mat-detail-icon-software__chip">${escapeHtml(name)}</span>`).join("") +
      `</div>`
    );
  }

  function renderPreviewAudio(item) {
    const isBgm = item.category_id === "bgm";
    const duration = item.meta_duration || "0:00";
    const formats = (item.file_formats || []).length
      ? item.file_formats
      : String(item.meta_format || "WAV / MP3")
          .split(/[/·,]/)
          .map((s) => s.trim())
          .filter(Boolean);
    const formatLabel = formats.map((f) => escapeHtml(f)).join(" · ");
    const waveBars = Array.from({ length: 40 }, (_, i) => {
      const h = 28 + Math.abs(Math.sin(i * 0.45)) * 52 + (i % 4) * 6;
      return `<span class="mat-detail-audio-player__bar" style="height:${h.toFixed(0)}%"></span>`;
    }).join("");

    const specs = isBgm
      ? `<ul class="mat-detail-audio-player__specs">` +
        `<li>BPM: ${escapeHtml(item.meta_bpm || "—")}</li>` +
        `<li>ループ: ${escapeHtml(item.meta_loop || "—")}</li>` +
        `</ul>`
      : `<ul class="mat-detail-audio-player__specs">` +
        `<li>用途: ${escapeHtml((item.usage_tags || []).join(" · ") || "—")}</li>` +
        `</ul>`;

    return (
      `<div class="mat-detail-preview mat-detail-preview--audio" data-mat-detail-preview="audio">` +
      `<div class="mat-detail-audio-player" data-mat-audio-player>` +
      `<p class="mat-detail-audio-player__title">${escapeHtml(item.title)}</p>` +
      `<div class="mat-detail-audio-player__wave" aria-hidden="true" data-mat-audio-waveform>` +
      waveBars +
      `</div>` +
      `<div class="mat-detail-audio-player__controls">` +
      `<button type="button" class="mat-detail-audio-player__play" disabled aria-label="再生（準備中）">` +
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>` +
      `</button>` +
      `<div class="mat-detail-audio-player__track">` +
      `<div class="mat-detail-audio-player__seek-row">` +
      `<span class="mat-detail-audio-player__time-current">0:00</span>` +
      `<input type="range" class="mat-detail-audio-player__range" value="0" min="0" max="100" disabled aria-label="再生位置">` +
      `<span class="mat-detail-audio-player__time-total">${escapeHtml(duration)}</span>` +
      `</div>` +
      `<div class="mat-detail-audio-player__formats-row">` +
      `<span class="mat-detail-audio-player__formats">${formatLabel}</span>` +
      `</div>` +
      `</div>` +
      `</div>` +
      specs +
      `</div>` +
      `<p class="mat-detail-preview__hint">音声プレビューは今後接続予定</p>` +
      `</div>`
    );
  }

  function resolveCodeDemoType(item) {
    if (item.code_demo_type) return item.code_demo_type;
    if (item.slug === "web-hamburger-menu") return "hamburger";
    if (item.slug === "web-wp-sns-share") return "share-buttons";
    if (item.slug === "code-typing-effect") return "typing";
    if (item.slug === "code-contact-form") return "form";
    return "card";
  }

  function renderCodeDemoVisual(item) {
    const type = resolveCodeDemoType(item);
    const demos = {
      hamburger:
        `<div class="mat-code-demo mat-code-demo--menu" aria-hidden="true">` +
        `<div class="mat-code-demo__bar">` +
        `<span class="mat-code-demo__logo">Site</span>` +
        `<button type="button" class="mat-code-demo__burger" tabindex="-1"><span></span><span></span><span></span></button>` +
        `</div>` +
        `<div class="mat-code-demo__panel">` +
        `<span>ホーム</span><span>サービス</span><span>お問い合わせ</span>` +
        `</div></div>`,
      "share-buttons":
        `<div class="mat-code-demo mat-code-demo--share" aria-hidden="true">` +
        `<p class="mat-code-demo__share-label">この記事をシェア</p>` +
        `<div class="mat-code-demo__share-row">` +
        `<span class="mat-code-demo__share-btn mat-code-demo__share-btn--x">X</span>` +
        `<span class="mat-code-demo__share-btn mat-code-demo__share-btn--fb">Facebook</span>` +
        `<span class="mat-code-demo__share-btn mat-code-demo__share-btn--line">LINE</span>` +
        `</div></div>`,
      card:
        `<div class="mat-code-demo mat-code-demo--card" aria-hidden="true">` +
        `<div class="mat-code-demo__card-thumb"></div>` +
        `<div class="mat-code-demo__card-body">` +
        `<span class="mat-code-demo__card-title">カードタイトル</span>` +
        `<span class="mat-code-demo__card-text">説明文が入ります</span>` +
        `<span class="mat-code-demo__card-btn">詳しく見る</span>` +
        `</div></div>`,
      form:
        `<div class="mat-code-demo mat-code-demo--form" aria-hidden="true">` +
        `<label class="mat-code-demo__field"><span>お名前</span><i></i></label>` +
        `<label class="mat-code-demo__field"><span>メール</span><i></i></label>` +
        `<span class="mat-code-demo__submit">送信する</span>` +
        `</div>`,
      typing:
        `<div class="mat-code-demo mat-code-demo--typing" data-code-typing-demo data-typing-full="Welcome to TASFUL">` +
        `<div class="mat-code-demo__typing-stage">` +
        `<span class="mat-code-demo__typing-text" data-typing-text></span>` +
        `<span class="mat-code-demo__typing-cursor" aria-hidden="true"></span>` +
        `</div>` +
        `<div class="mat-code-demo__controls">` +
        `<button type="button" class="mat-code-demo__ctrl mat-code-demo__ctrl--play" data-code-demo-play>` +
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>再生` +
        `</button>` +
        `<button type="button" class="mat-code-demo__ctrl mat-code-demo__ctrl--reset" data-code-demo-reset>リセット</button>` +
        `</div></div>`,
    };
    return demos[type] || demos.card;
  }

  function resolveCodeFilesForRender(item) {
    if (item.code_files?.length) return item.code_files;
    const preview = item.code_preview || "";
    const tree = item.file_tree || [];
    if (!tree.length) {
      return preview ? [{ filename: "snippet.txt", language: "text", content: preview }] : [];
    }
    const jsIdx = tree.findIndex((f) => /\.js$/i.test(f));
    const targetIdx = jsIdx >= 0 ? jsIdx : tree.length - 1;
    return tree.map((filename, index) => ({
      filename,
      language: /\.css$/i.test(filename) ? "css" : /\.js$/i.test(filename) ? "javascript" : /\.html?$/i.test(filename) ? "html" : "text",
      content: index === targetIdx && preview ? preview : `/* ${filename} — ダウンロード後に内容を確認できます */`,
    }));
  }

  function renderCodeDependencyChips(item) {
    const deps = item.code_dependencies || [];
    if (!deps.length) return "";
    return (
      `<div class="mat-detail-code-deps" aria-label="依存関係">` +
      deps
        .map((label) => `<span class="mat-detail-code-deps__chip">${escapeHtml(label)}</span>`)
        .join("") +
      `</div>`
    );
  }

  function renderCodeFileTabs(files) {
    if (!files.length) return "";
    return (
      `<div class="mat-detail-code-tabs" role="tablist" aria-label="ファイル">` +
      files
        .map(
          (file, index) =>
            `<button type="button" class="mat-detail-code-tabs__tab${index === 0 ? " is-active" : ""}" role="tab" aria-selected="${index === 0 ? "true" : "false"}" data-code-tab="${index}">${escapeHtml(file.filename)}</button>`
        )
        .join("") +
      `</div>`
    );
  }

  function renderCodePanels(files) {
    if (!files.length) return `<pre class="mat-detail-code"><code>// コードプレビュー</code></pre>`;
    return files
      .map(
        (file, index) =>
          `<pre class="mat-detail-code${index === 0 ? " is-active" : ""}" data-code-panel="${index}"${index === 0 ? "" : " hidden"}><code>${escapeHtml(file.content)}</code></pre>`
      )
      .join("");
  }

  function renderCodeSetupSteps(item) {
    const steps = item.code_setup_steps || [];
    if (!isCode(item) || !steps.length) return "";
    return (
      `<div class="mat-detail-code-setup">` +
      `<p class="mat-detail-code-setup__title">導入手順</p>` +
      `<ol class="mat-detail-code-setup__list">` +
      steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("") +
      `</ol></div>`
    );
  }

  function renderPreviewCode(item) {
    const files = resolveCodeFilesForRender(item);
    const demoControls = resolveCodeDemoType(item) === "typing";
    return (
      `<div class="mat-detail-preview mat-detail-preview--code mat-detail-preview--code-enhanced" data-mat-detail-preview="code">` +
      renderCodeDependencyChips(item) +
      `<div class="mat-detail-code-split">` +
      `<div class="mat-detail-code-demo">` +
      `<div class="mat-detail-code-demo__head">` +
      `<p class="mat-detail-code-demo__label">プレビュー</p>` +
      (demoControls ? `<span class="mat-detail-code-demo__hint">再生でアニメーションを確認</span>` : "") +
      `</div>` +
      renderCodeDemoVisual(item) +
      `</div>` +
      `<div class="mat-detail-code-source">` +
      `<div class="mat-detail-code-source__head">` +
      `<p class="mat-detail-code-demo__label">コード</p>` +
      renderCodeFileTabs(files) +
      `</div>` +
      `<div class="mat-detail-code-block">` +
      `<button type="button" class="mat-detail-code-copy" data-code-copy aria-label="コードをコピー">` +
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>` +
      `<span data-code-copy-label>コピー</span>` +
      `</button>` +
      `<div class="mat-detail-code-panels">${renderCodePanels(files)}</div>` +
      `</div></div></div>` +
      renderCodeSetupSteps(item) +
      `</div>`
    );
  }

  function renderPreviewDocument(item) {
    const doc = item.document_preview || {};
    const layout = item.document_layout || doc.layout || "generic";
    return (
      `<div class="mat-detail-preview mat-detail-preview--document mat-detail-preview--document-enhanced" data-mat-detail-preview="document" data-doc-layout="${escapeHtml(layout)}">` +
      `<div class="mat-doc-paper-wrap">` +
      `<div class="mat-doc-paper mat-doc-paper--${escapeHtml(layout)}">` +
      renderDocumentPaperContent(item, doc, layout) +
      `</div></div>` +
      renderDocumentFormatBadges(item) +
      renderDocumentCopyBar() +
      renderDocumentSetupSteps(item) +
      `</div>`
    );
  }

  function renderDocumentSectionFields(fields) {
    if (!fields?.length) return "";
    return (
      `<dl class="mat-doc-paper__fields">` +
      fields
        .map(
          (field) =>
            `<div class="mat-doc-paper__field">` +
            `<dt>${escapeHtml(field.label)}</dt>` +
            `<dd>${escapeHtml(field.value)}</dd>` +
            `</div>`
        )
        .join("") +
      `</dl>`
    );
  }

  function renderDocumentSectionBullets(bullets) {
    if (!bullets?.length) return "";
    return (
      `<ul class="mat-doc-paper__list">` +
      bullets.map((line) => `<li>${escapeHtml(line)}</li>`).join("") +
      `</ul>`
    );
  }

  function renderDocumentSections(sections) {
    if (!sections?.length) return "";
    return sections
      .map(
        (section) =>
          `<section class="mat-doc-paper__section">` +
          `<h3 class="mat-doc-paper__section-title">${escapeHtml(section.heading || "")}</h3>` +
          renderDocumentSectionFields(section.fields) +
          renderDocumentSectionBullets(section.bullets) +
          (section.body ? `<p class="mat-doc-paper__section-body">${escapeHtml(section.body)}</p>` : "") +
          `</section>`
      )
      .join("");
  }

  function renderDocumentPaperContent(item, doc, layout) {
    const title = doc.title || item.title || "文例・文章テンプレート";
    const dateLabel = doc.date_label || "";
    const greeting = doc.greeting || "";
    const body = doc.body || "";
    const bullets = doc.bullets || [];
    const signoff = doc.signoff || "";
    const signature = doc.signature || null;

    if (layout === "resume") {
      return (
        `<header class="mat-doc-paper__header">` +
        `<h2 class="mat-doc-paper__title">${escapeHtml(title)}</h2>` +
        (dateLabel ? `<p class="mat-doc-paper__date">${escapeHtml(dateLabel)}</p>` : "") +
        `</header>` +
        renderDocumentSections(doc.sections) +
        (signoff ? `<footer class="mat-doc-paper__footer"><p>${escapeHtml(signoff)}</p></footer>` : "")
      );
    }

    if (layout === "invoice") {
      const lineItems = doc.line_items || [];
      return (
        `<header class="mat-doc-paper__header mat-doc-paper__header--invoice">` +
        `<div>` +
        `<h2 class="mat-doc-paper__title">${escapeHtml(title)}</h2>` +
        (doc.invoice_no ? `<p class="mat-doc-paper__meta">No. ${escapeHtml(doc.invoice_no)}</p>` : "") +
        `</div>` +
        (dateLabel ? `<p class="mat-doc-paper__date">${escapeHtml(dateLabel)}</p>` : "") +
        `</header>` +
        renderDocumentSections(doc.sections) +
        (lineItems.length
          ? `<table class="mat-doc-paper__table" aria-label="請求明細">` +
            `<thead><tr><th>品目</th><th>数量</th><th>単位</th><th>金額</th></tr></thead>` +
            `<tbody>` +
            lineItems
              .map(
                (row) =>
                  `<tr>` +
                  `<td>${escapeHtml(row.name)}</td>` +
                  `<td>${escapeHtml(row.qty)}</td>` +
                  `<td>${escapeHtml(row.unit)}</td>` +
                  `<td>${escapeHtml(row.amount)}</td>` +
                  `</tr>`
              )
              .join("") +
            `</tbody>` +
            (doc.total
              ? `<tfoot><tr><td colspan="3">合計</td><td>${escapeHtml(doc.total)}</td></tr></tfoot>`
              : "") +
            `</table>`
          : "") +
        (signoff ? `<footer class="mat-doc-paper__footer"><p>${escapeHtml(signoff)}</p></footer>` : "")
      );
    }

    if (layout === "email") {
      return (
        `<header class="mat-doc-paper__header mat-doc-paper__header--email">` +
        `<p class="mat-doc-paper__label">件名</p>` +
        `<h2 class="mat-doc-paper__title">${escapeHtml(title.replace(/^件名：/, ""))}</h2>` +
        (dateLabel ? `<p class="mat-doc-paper__date">${escapeHtml(dateLabel)}</p>` : "") +
        `</header>` +
        `<div class="mat-doc-paper__divider" aria-hidden="true"></div>` +
        (greeting ? `<p class="mat-doc-paper__greeting">${escapeHtml(greeting)}</p>` : "") +
        (body ? `<p class="mat-doc-paper__body">${escapeHtml(body)}</p>` : "") +
        renderDocumentSectionBullets(bullets) +
        (signoff ? `<p class="mat-doc-paper__sign">${escapeHtml(signoff)}</p>` : "") +
        (signature
          ? `<div class="mat-doc-paper__signature">` +
            (signature.company ? `<p>${escapeHtml(signature.company)}</p>` : "") +
            (signature.department ? `<p>${escapeHtml(signature.department)}</p>` : "") +
            (signature.name ? `<p class="mat-doc-paper__signature-name">${escapeHtml(signature.name)}</p>` : "") +
            `</div>`
          : "")
      );
    }

    return (
      `<header class="mat-doc-paper__header">` +
      `<h2 class="mat-doc-paper__title">${escapeHtml(title)}</h2>` +
      (dateLabel ? `<p class="mat-doc-paper__date">${escapeHtml(dateLabel)}</p>` : "") +
      `</header>` +
      `<div class="mat-doc-paper__divider" aria-hidden="true"></div>` +
      (greeting ? `<p class="mat-doc-paper__greeting">${escapeHtml(greeting)}</p>` : "") +
      (body ? `<p class="mat-doc-paper__body">${escapeHtml(body)}</p>` : "") +
      renderDocumentSectionBullets(bullets) +
      renderDocumentSections(doc.sections) +
      (signoff ? `<p class="mat-doc-paper__sign">${escapeHtml(signoff)}</p>` : "")
    );
  }

  function renderDocumentFormatBadges(item) {
    const formats = item.document_export_formats || [];
    if (!formats.length) return "";
    return (
      `<div class="mat-detail-doc-formats" aria-label="対応形式">` +
      formats
        .map(
          (fmt) =>
            `<span class="mat-detail-doc-formats__badge mat-detail-doc-formats__badge--${escapeHtml(String(fmt).toLowerCase())}">${escapeHtml(fmt)}</span>`
        )
        .join("") +
      `</div>`
    );
  }

  function renderDocumentCopyBar() {
    const actions = [
      { type: "body", label: "本文をコピー" },
      { type: "heading", label: "見出しだけコピー" },
      { type: "markdown", label: "Markdownコピー" },
      { type: "plain", label: "プレーンテキストコピー" },
    ];
    return (
      `<div class="mat-detail-doc-copy" aria-label="コピー">` +
      actions
        .map(
          (action) =>
            `<button type="button" class="mat-detail-doc-copy__btn" data-doc-copy="${escapeHtml(action.type)}">` +
            `<span data-doc-copy-label>${escapeHtml(action.label)}</span>` +
            `</button>`
        )
        .join("") +
      `</div>`
    );
  }

  function renderDocumentSetupSteps(item) {
    const steps = item.document_setup_steps || [];
    if (!isDocument(item) || !steps.length) return "";
    return (
      `<div class="mat-detail-doc-setup">` +
      `<p class="mat-detail-doc-setup__title">使い方</p>` +
      `<ol class="mat-detail-doc-setup__list">` +
      steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("") +
      `</ol></div>`
    );
  }

  function renderDocumentToolsChips(tools) {
    const list = tools || [];
    if (!list.length) return "—";
    return (
      `<div class="mat-detail-doc-tools">` +
      list.map((name) => `<span class="mat-detail-doc-tools__chip">${escapeHtml(name)}</span>`).join("") +
      `</div>`
    );
  }

  function toolFormatBadgeClass(fmt) {
    const key = String(fmt || "").toUpperCase();
    if (key === "透過PNG") return "pngalpha";
    if (key === "PNG") return "png";
    if (key === "SVG") return "svg";
    if (key === "JPG") return "jpg";
    return "default";
  }

  function renderToolOutputFormats(item) {
    const formats = item.tool_output_formats || [];
    if (!formats.length) return "";
    return (
      `<div class="mat-detail-tool-formats" aria-label="出力形式">` +
      formats
        .map(
          (fmt) =>
            `<span class="mat-detail-tool-formats__badge mat-detail-tool-formats__badge--${escapeHtml(toolFormatBadgeClass(fmt))}">${escapeHtml(fmt)}</span>`
        )
        .join("") +
      `</div>`
    );
  }

  function renderToolSetupSteps(item) {
    const steps = item.tool_setup_steps || [];
    if (!isTool(item) || !steps.length) return "";
    return (
      `<div class="mat-detail-tool-setup">` +
      `<p class="mat-detail-tool-setup__title">使い方</p>` +
      `<ol class="mat-detail-tool-setup__list">` +
      steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("") +
      `</ol></div>`
    );
  }

  function renderLogoMakerTool(item) {
    const styles = [
      { id: "simple", label: "シンプル" },
      { id: "rounded", label: "丸型" },
      { id: "luxury", label: "高級感" },
      { id: "pop", label: "ポップ" },
      { id: "business", label: "ビジネス" },
    ];
    const fonts = [
      { id: "gothic", label: "ゴシック体" },
      { id: "mincho", label: "明朝体" },
      { id: "rounded", label: "丸ゴシック" },
      { id: "hand", label: "手写き風" },
    ];
    const samples = ["TASFUL", "SAMPLE", "MY BRAND"];
    return (
      `<div class="mat-tool-logo" data-tool-logo-maker>` +
      `<div class="mat-tool-logo__layout">` +
      `<div class="mat-tool-logo__form">` +
      `<label class="mat-tool-logo__field">` +
      `<span class="mat-tool-logo__label">ロゴ名</span>` +
      `<input type="text" class="mat-tool-logo__input" data-logo-name value="MY BRAND" maxlength="40" placeholder="例: MY BRAND">` +
      `</label>` +
      `<label class="mat-tool-logo__field">` +
      `<span class="mat-tool-logo__label">サブタイトル</span>` +
      `<input type="text" class="mat-tool-logo__input" data-logo-subtitle value="Your tagline" maxlength="60" placeholder="例: Your tagline">` +
      `</label>` +
      `<div class="mat-tool-logo__row">` +
      `<label class="mat-tool-logo__field mat-tool-logo__field--color">` +
      `<span class="mat-tool-logo__label">カラー</span>` +
      `<input type="color" class="mat-tool-logo__color" data-logo-color value="#2563eb" aria-label="ロゴカラー">` +
      `</label>` +
      `<label class="mat-tool-logo__field mat-tool-logo__field--font">` +
      `<span class="mat-tool-logo__label">フォント</span>` +
      `<select class="mat-tool-logo__select" data-logo-font aria-label="フォント">` +
      fonts.map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.label)}</option>`).join("") +
      `</select>` +
      `</label>` +
      `</div>` +
      `<div class="mat-tool-logo__styles" role="radiogroup" aria-label="スタイル">` +
      `<span class="mat-tool-logo__label">スタイル</span>` +
      `<div class="mat-tool-logo__style-chips">` +
      styles
        .map(
          (style, index) =>
            `<button type="button" class="mat-tool-logo__style${index === 0 ? " is-active" : ""}" role="radio" aria-checked="${index === 0 ? "true" : "false"}" data-logo-style="${escapeHtml(style.id)}">${escapeHtml(style.label)}</button>`
        )
        .join("") +
      `</div></div>` +
      `<div class="mat-tool-logo__samples">` +
      `<span class="mat-tool-logo__label">サンプル</span>` +
      `<div class="mat-tool-logo__sample-chips">` +
      samples
        .map(
          (sample) =>
            `<button type="button" class="mat-tool-logo__sample" data-logo-sample="${escapeHtml(sample)}">${escapeHtml(sample)}</button>`
        )
        .join("") +
      `</div></div>` +
      `<button type="button" class="mat-tool-logo__generate mat-detail-btn mat-detail-btn--primary" data-logo-generate>${escapeHtml(item.button_label || "無料で使う")}</button>` +
      `</div>` +
      `<div class="mat-tool-logo__preview-area">` +
      `<p class="mat-tool-logo__preview-label">プレビュー</p>` +
      `<div class="mat-tool-logo__result-wrap">` +
      `<div class="mat-tool-logo__placeholder" data-logo-placeholder>ロゴ名を入力して「無料で使う」を押してください</div>` +
      `<div class="mat-tool-logo__result" data-logo-result hidden>` +
      `<div class="mat-tool-logo__mark mat-tool-logo__mark--simple" data-logo-mark style="--logo-color:#2563eb">` +
      `<span class="mat-tool-logo__mark-icon" data-logo-icon aria-hidden="true">M</span>` +
      `<div class="mat-tool-logo__mark-text">` +
      `<strong data-logo-display-name>MY BRAND</strong>` +
      `<small data-logo-display-sub>Your tagline</small>` +
      `</div></div></div></div>` +
      `<div class="mat-tool-logo__actions" data-logo-actions hidden>` +
      `<button type="button" class="mat-tool-logo__action" data-logo-save="png">PNG保存</button>` +
      `<button type="button" class="mat-tool-logo__action" data-logo-save="svg">SVG保存</button>` +
      `<button type="button" class="mat-tool-logo__action" data-logo-copy-text>コピー</button>` +
      `<button type="button" class="mat-tool-logo__action mat-tool-logo__action--ghost" data-logo-remake>もう一度作る</button>` +
      `</div></div></div>` +
      renderToolOutputFormats(item) +
      renderToolSetupSteps(item) +
      `</div>`
    );
  }

  function renderPreviewTool(item) {
    const demo = item.tool_demo_type || "generic";
    if (demo === "logo-maker") {
      return (
        `<div class="mat-detail-preview mat-detail-preview--tool mat-detail-preview--tool-logo" data-mat-detail-preview="tool">` +
        renderLogoMakerTool(item) +
        `</div>`
      );
    }
    let panel = "";
    if (demo === "qr-generator") {
      panel =
        `<div class="mat-tool-preview mat-tool-preview--qr" aria-hidden="true">` +
        `<label class="mat-tool-preview__field"><span>URL / テキスト</span><i>https://example.com</i></label>` +
        `<span class="mat-tool-preview__btn">${escapeHtml(item.button_label || "無料で使う")}</span>` +
        `<div class="mat-tool-preview__result">` +
        `<span class="mat-tool-preview__qr"></span>` +
        `<span class="mat-tool-preview__result-label">プレビュー</span>` +
        `</div></div>`;
    } else {
      panel =
        `<div class="mat-tool-preview mat-tool-preview--generic" aria-hidden="true">` +
        `<label class="mat-tool-preview__field"><span>入力</span><i></i></label>` +
        `<span class="mat-tool-preview__btn">${escapeHtml(item.button_label || "無料で使う")}</span>` +
        `<div class="mat-tool-preview__result mat-tool-preview__result--text">結果がここに表示されます</div>` +
        `</div>`;
    }
    return (
      `<div class="mat-detail-preview mat-detail-preview--tool" data-mat-detail-preview="tool">` +
      panel +
      `<p class="mat-detail-preview__hint">${escapeHtml(item.meta_tool_type || "Webツール")} · ${escapeHtml(item.meta_usage_form || "ブラウザで利用")}</p>` +
      `</div>`
    );
  }

  function renderPresentationSoftwareChips(software) {
    const list = software || [];
    if (!list.length) return "—";
    return (
      `<div class="mat-detail-pres-software">` +
      list.map((name) => `<span class="mat-detail-pres-software__chip">${escapeHtml(name)}</span>`).join("") +
      `</div>`
    );
  }

  function renderPresentationSlideBody(slide) {
    const layout = slide.layout || "content";
    if (layout === "title") {
      return (
        `<div class="mat-pres-slide__title-layout">` +
        `<h3 class="mat-pres-slide__heading mat-pres-slide__heading--hero">${escapeHtml(slide.heading || "")}</h3>` +
        (slide.subheading ? `<p class="mat-pres-slide__sub">${escapeHtml(slide.subheading)}</p>` : "") +
        (slide.note ? `<p class="mat-pres-slide__note">${escapeHtml(slide.note)}</p>` : "") +
        `</div>`
      );
    }
    if (layout === "closing") {
      return (
        `<div class="mat-pres-slide__title-layout mat-pres-slide__title-layout--closing">` +
        `<h3 class="mat-pres-slide__heading">${escapeHtml(slide.heading || "")}</h3>` +
        (slide.subheading ? `<p class="mat-pres-slide__sub">${escapeHtml(slide.subheading)}</p>` : "") +
        (slide.note ? `<p class="mat-pres-slide__note">${escapeHtml(slide.note)}</p>` : "") +
        `</div>`
      );
    }
    if (layout === "two-column") {
      return (
        `<div class="mat-pres-slide__content-layout">` +
        `<h3 class="mat-pres-slide__heading">${escapeHtml(slide.heading || "")}</h3>` +
        `<div class="mat-pres-slide__columns">` +
        `<ul class="mat-pres-slide__list">${(slide.left || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` +
        `<ul class="mat-pres-slide__list">${(slide.right || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` +
        `</div></div>`
      );
    }
    if (layout === "chart") {
      const labels = slide.chart_labels || ["A", "B", "C", "D"];
      return (
        `<div class="mat-pres-slide__content-layout">` +
        `<h3 class="mat-pres-slide__heading">${escapeHtml(slide.heading || "")}</h3>` +
        `<div class="mat-pres-slide__chart" aria-hidden="true">` +
        labels
          .map(
            (label, index) =>
              `<span class="mat-pres-slide__bar" style="--bar-height:${48 + index * 14}%"><i>${escapeHtml(label)}</i></span>`
          )
          .join("") +
        `</div></div>`
      );
    }
    return (
      `<div class="mat-pres-slide__content-layout">` +
      `<h3 class="mat-pres-slide__heading">${escapeHtml(slide.heading || "")}</h3>` +
      `<ul class="mat-pres-slide__list">${(slide.bullets || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` +
      `</div>`
    );
  }

  function renderPresentationSlidePanel(slide, index, total) {
    return (
      `<div class="mat-pres-slide${index === 0 ? " is-active" : ""}" data-pres-slide="${index}"${index === 0 ? "" : " hidden"} role="tabpanel" aria-label="${escapeHtml(slide.label || `スライド ${index + 1}`)}">` +
      `<div class="mat-pres-slide__frame">` +
      renderPresentationSlideBody(slide) +
      `<span class="mat-pres-slide__page">${index + 1} / ${total}</span>` +
      `</div></div>`
    );
  }

  function renderPresentationFormatBadges(formats) {
    if (!formats?.length) return "—";
    return (
      `<div class="mat-detail-pres-formats" aria-label="ダウンロード形式">` +
      formats
        .map((fmt) => {
          const label = fmt === "Canva" ? "Canva（対応素材のみ）" : fmt;
          const slug = String(fmt).toLowerCase().replace(/\s+/g, "-");
          return `<span class="mat-detail-pres-formats__badge mat-detail-pres-formats__badge--${escapeHtml(slug)}">${escapeHtml(label)}</span>`;
        })
        .join("") +
      `</div>`
    );
  }

  function renderPresentationSlideInfo(item) {
    const chips = [
      item.meta_pages ? `全${escapeHtml(String(item.meta_pages).replace(/枚$/, ""))}ページ` : "",
      item.meta_ratio || item.meta_size ? escapeHtml(item.meta_ratio || item.meta_size) : "",
      item.presentation_editable ? "編集可能" : "",
      "PowerPoint対応",
      "Google Slides対応",
    ].filter(Boolean);
    return (
      `<div class="mat-detail-pres-info" aria-label="スライド情報">` +
      chips.map((text) => `<span class="mat-detail-pres-info__chip">${text}</span>`).join("") +
      `</div>`
    );
  }

  function renderPresentationSetupSteps(item) {
    const steps = item.presentation_setup_steps || [];
    if (!isPresentation(item) || !steps.length) return "";
    return (
      `<div class="mat-detail-pres-setup">` +
      `<p class="mat-detail-pres-setup__title">使い方</p>` +
      `<ol class="mat-detail-pres-setup__list">` +
      steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("") +
      `</ol></div>`
    );
  }

  function renderPresentationUsageScenarios(item) {
    const scenarios = item.presentation_usage_scenarios || [];
    if (!isPresentation(item) || !scenarios.length) return "";
    return (
      `<section class="mat-detail-card mat-detail-section mat-detail-pres-usage" aria-labelledby="matDetailPresUsageTitle">` +
      `<h2 id="matDetailPresUsageTitle" class="mat-detail-section__title">おすすめ利用シーン</h2>` +
      `<div class="mat-detail-pres-usage__chips" role="list">` +
      scenarios
        .map(
          (label) =>
            `<a class="mat-detail-pres-usage__chip" role="listitem" href="${escapeHtml(tagSearchHref(label))}">${escapeHtml(label)}</a>`
        )
        .join("") +
      `</div></section>`
    );
  }

  function renderPresentationAiCustomizeCta(item) {
    if (!isPresentation(item)) return "";
    const prompt = `「${item.title || "プレゼン資料"}」テンプレートを用途に合わせてカスタマイズする方法を提案してください`;
    return (
      `<div class="mat-detail-pres-ai-cta">` +
      `<a class="mat-detail-pres-ai-cta__link" href="${escapeHtml(buildAiWorkspaceHref(prompt))}">` +
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/></svg>` +
      `このテンプレートをAIでカスタマイズ` +
      `</a></div>`
    );
  }

  function renderPresentationPreview(item) {
    const slides = item.presentation_slides || [];
    const total = slides.length || 10;
    const formats = item.presentation_export_formats || [];
    return (
      `<div class="mat-detail-preview mat-detail-preview--presentation" data-mat-detail-preview="presentation" data-pres-total="${total}">` +
      `<div class="mat-pres-viewer" data-presentation-viewer>` +
      `<div class="mat-pres-viewer__layout">` +
      `<div class="mat-pres-viewer__thumbs" role="tablist" aria-label="スライド一覧">` +
      slides
        .map(
          (slide, index) =>
            `<button type="button" class="mat-pres-viewer__thumb${index === 0 ? " is-active" : ""}" role="tab" aria-selected="${index === 0 ? "true" : "false"}" data-pres-tab="${index}" aria-label="${escapeHtml(slide.label || `スライド ${index + 1}`)}">` +
            `<span class="mat-pres-viewer__thumb-num">${index + 1}</span>` +
            `<span class="mat-pres-viewer__thumb-mini mat-pres-viewer__thumb-mini--${escapeHtml(slide.layout || "content")}"></span>` +
            `<span class="mat-pres-viewer__thumb-label">${escapeHtml(slide.label || `Slide ${index + 1}`)}</span>` +
            `</button>`
        )
        .join("") +
      `</div>` +
      `<div class="mat-pres-viewer__main">` +
      `<div class="mat-pres-viewer__toolbar">` +
      `<button type="button" class="mat-pres-viewer__nav" data-pres-prev aria-label="前のスライド">前へ</button>` +
      `<span class="mat-pres-viewer__counter" data-pres-counter>1 / ${total}</span>` +
      `<button type="button" class="mat-pres-viewer__nav" data-pres-next aria-label="次のスライド">次へ</button>` +
      `</div>` +
      `<div class="mat-pres-viewer__stage" data-pres-stage>` +
      slides.map((slide, index) => renderPresentationSlidePanel(slide, index, total)).join("") +
      `</div></div></div>` +
      renderPresentationSlideInfo(item) +
      renderPresentationFormatBadges(formats) +
      renderPresentationSetupSteps(item) +
      `</div></div>`
    );
  }

  function renderPreview(item) {
    switch (item.preview_type) {
      case "icon-grid":
        return renderPreviewIconGrid(item);
      case "audio":
        return renderPreviewAudio(item);
      case "code":
        return renderPreviewCode(item);
      case "document":
        return renderPreviewDocument(item);
      case "tool":
        return renderPreviewTool(item);
      case "presentation":
        return renderPresentationPreview(item);
      case "image":
      default:
        return renderPreviewImage(item);
    }
  }

  function renderRecommended(list) {
    return (
      `<ul class="mat-detail-recommended">` +
      (list || [])
        .map(
          (line) =>
            `<li><span class="mat-detail-recommended__check" aria-hidden="true">✓</span>${escapeHtml(line)}</li>`
        )
        .join("") +
      `</ul>`
    );
  }

  function renderUsageScenarios(item) {
    const scenarios = item.usage_scenarios || [];
    if (!hasUsageScenarios(item) || !scenarios.length) return "";
    return (
      `<section class="mat-detail-card mat-detail-section mat-detail-usage" aria-labelledby="matDetailUsageTitle">` +
      `<h2 id="matDetailUsageTitle" class="mat-detail-section__title">おすすめ用途</h2>` +
      `<div class="mat-detail-usage__chips" role="list">` +
      scenarios
        .map(
          (label) =>
            `<span class="mat-detail-usage__chip" role="listitem">${escapeHtml(label)}</span>`
        )
        .join("") +
      `</div>` +
      `</section>`
    );
  }

  function buildAiWorkspaceHref(prompt) {
    const params = new URLSearchParams({ source: "materials" });
    const text = String(prompt || "").trim();
    if (text) params.set("q", text);
    return `/ai-workspace?${params.toString()}`;
  }

  function renderStyleTags(item) {
    const groups = item.style_tag_groups || [];
    if (!isBackground(item) || !groups.length) return "";
    return (
      `<section class="mat-detail-card mat-detail-section mat-detail-style-tags" aria-labelledby="matDetailStyleTagsTitle">` +
      `<h2 id="matDetailStyleTagsTitle" class="mat-detail-section__title">タグ</h2>` +
      `<div class="mat-detail-style-tags__groups">` +
      groups
        .map(
          (group) =>
            `<div class="mat-detail-style-tags__group">` +
            `<p class="mat-detail-style-tags__label">${escapeHtml(group.label)}</p>` +
            `<div class="mat-detail-style-tags__chips">` +
            (group.tags || [])
              .map((tag) => `<span class="mat-detail-style-tags__chip">${escapeHtml(tag)}</span>`)
              .join("") +
            `</div></div>`
        )
        .join("") +
      `</div></section>`
    );
  }

  function renderColorPalette(item) {
    const palette = item.color_palette || [];
    if (!isBackground(item) || !palette.length) return "";
    return (
      `<section class="mat-detail-card mat-detail-section mat-detail-palette" aria-labelledby="matDetailPaletteTitle">` +
      `<h2 id="matDetailPaletteTitle" class="mat-detail-section__title">カラーパレット</h2>` +
      `<ul class="mat-detail-palette__list">` +
      palette
        .map(
          (swatch) =>
            `<li class="mat-detail-palette__item">` +
            `<span class="mat-detail-palette__swatch" style="--swatch-color:${escapeHtml(swatch.hex)}" title="${escapeHtml(swatch.hex)}"></span>` +
            `<span class="mat-detail-palette__name">${escapeHtml(swatch.label || swatch.hex)}</span>` +
            `<span class="mat-detail-palette__hex">${escapeHtml(swatch.hex)}</span>` +
            `</li>`
        )
        .join("") +
      `</ul></section>`
    );
  }

  function renderAiAssistPanel(item) {
    const suggestions = item.ai_suggestions || [];
    if (!hasAiAssist(item) || !suggestions.length) return "";
    const lead = isBackground(item)
      ? "AIに相談して、似た背景や色違い・昼夜版をすぐに探せます"
      : isIcon(item)
        ? "AIに相談して、似たアイコンや同シリーズ・色違いをすぐに探せます"
        : isCode(item)
          ? "AIに相談して、コードのカスタマイズやフレームワーク変換をすぐに試せます"
          : isDocument(item)
            ? "AIに相談して、文面の書き換えやトーン調整をすぐに試せます"
            : isTool(item)
              ? "AIに相談して、ロゴ案やデザイン調整をすぐに試せます"
              : isPresentation(item)
                ? "AIに相談して、プレゼン内容の作成やスライド追加・発表原稿をすぐに試せます"
                : "AIに相談して、似た素材やデザイン案をすぐに探せます";
    return (
      `<section class="mat-detail-card mat-detail-section mat-detail-ai" aria-labelledby="matDetailAiTitle">` +
      `<div class="mat-detail-ai__head">` +
      `<h2 id="matDetailAiTitle" class="mat-detail-section__title">TASFUL AIでさらに活用</h2>` +
      `<p class="mat-detail-ai__lead">${escapeHtml(lead)}</p>` +
      `</div>` +
      `<div class="mat-detail-ai__actions">` +
      suggestions
        .map(
          (s) =>
            `<a class="mat-detail-ai__btn" href="${escapeHtml(buildAiWorkspaceHref(s.prompt))}">` +
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M5 19l1 2 2 1-1-2-2-1zM19 5l1 2 2 1-1-2-2-1z"/></svg>` +
            `${escapeHtml(s.label)}` +
            `</a>`
        )
        .join("") +
      `</div>` +
      `</section>`
    );
  }

  function renderTrustList() {
    const lines = ["個人・商用利用OK", "クレジット表記不要", "会員登録でさらに便利に"];
    return (
      `<ul class="mat-detail-trust">` +
      lines
        .map(
          (line) =>
            `<li><span class="mat-detail-trust__check" aria-hidden="true">✓</span>${escapeHtml(line)}</li>`
        )
        .join("") +
      `</ul>`
    );
  }

  function renderActionButtons(item) {
    const Download = global.TasuMaterialsDownload;
    const Fav = global.TasuMaterialsFavorites;
    const label =
      Download?.primaryButtonLabel?.(item) ||
      (isTool(item) ? item?.button_label || "無料で使う" : "広告を見て無料ダウンロード");
    const favSaved = Boolean(Fav?.isFavorited?.(item?.id));
    const favLabel = favSaved ? "お気に入り済み" : "お気に入りに追加";
    const primaryIcon = isTool(item)
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 3l14 9-14 9V3z"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 19h16"/></svg>`;
    return (
      `<div class="mat-detail-actions">` +
      `<p class="mat-detail-dl-hint" data-mat-dl-hint></p>` +
      `<button type="button" class="mat-detail-btn mat-detail-btn--primary" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      primaryIcon +
      `<span data-mat-download-label>${escapeHtml(label)}</span>` +
      `</button>` +
      `<button type="button" class="mat-detail-btn mat-detail-btn--ghost mat-detail-btn--favorite${favSaved ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favSaved ? "true" : "false"}" aria-label="${favSaved ? "お気に入りから削除" : "お気に入りに追加"}">` +
      `<svg class="mat-detail-btn__heart" width="18" height="18" viewBox="0 0 24 24" fill="${favSaved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z"/></svg>` +
      `<span data-mat-favorite-label>${favLabel}</span>` +
      `</button>` +
      `<p class="mat-detail-actions__note">お気に入りは<a href="/materials/mypage.html#favorites">ダッシュボードのお気に入り</a>に保存されます。</p>` +
      `</div>`
    );
  }

  /** @param {object} item @param {{ mobile?: boolean }} [opts] */
  function renderActionsCard(item, opts = {}) {
    const mobileClass = opts.mobile ? " mat-detail-actions--mobile" : "";
    const presAiCta = isPresentation(item) ? renderPresentationAiCustomizeCta(item) : "";
    return (
      `<div class="mat-detail-card mat-detail-card--actions${mobileClass}">` +
      renderActionButtons(item) +
      presAiCta +
      `</div>`
    );
  }

  function renderSignupCard() {
    return (
      `<div class="mat-detail-card mat-detail-signup-card">` +
      `<h2 class="mat-detail-card__title">会員登録でもっと便利に</h2>` +
      `<ul class="mat-detail-signup-card__benefits">` +
      `<li><span class="mat-detail-signup-card__check" aria-hidden="true">✓</span>お気に入り保存</li>` +
      `<li><span class="mat-detail-signup-card__check" aria-hidden="true">✓</span>ダウンロード履歴</li>` +
      `<li><span class="mat-detail-signup-card__check" aria-hidden="true">✓</span>AIおすすめ</li>` +
      `</ul>` +
      `<a href="/signup" class="mat-detail-btn mat-detail-btn--primary mat-detail-signup-card__btn">無料会員登録</a>` +
      `</div>`
    );
  }

  function renderAboutRows(item) {
    const commercial = item.commercial_use || "個人・商用利用OK";
    const rows = [
      {
        dt: "カテゴリ",
        dd: `<span class="mat-detail-badge" style="--cat-color:${escapeHtml(item.category_color)}">${escapeHtml(item.category_name)}</span>`,
      },
      {
        dt: "タグ",
        dd: `<div class="mat-detail-tags">${renderTags(item.tags, { clickable: isIcon(item) || isCode(item) || isDocument(item) || isTool(item) || isPresentation(item) })}</div>`,
      },
    ];

    if (item.category_id === "tool") {
      rows.push({ dt: "種別", dd: escapeHtml(item.meta_tool_type || "—") });
      rows.push({ dt: "利用形式", dd: escapeHtml(item.meta_usage_form || "—") });
      rows.push({ dt: "出力形式", dd: escapeHtml(item.meta_tool_output_formats || "—") });
      rows.push({ dt: "対応環境", dd: escapeHtml(item.meta_compatibility || item.environment || "—") });
      rows.push({ dt: "会員登録", dd: escapeHtml(item.meta_tool_signup_required || "—") });
    } else if (item.category_id === "document") {
      rows.push({ dt: "用途", dd: escapeHtml(item.meta_document_usage || item.meta_usage || "—") });
      rows.push({ dt: "文字数", dd: escapeHtml(item.meta_char_count || "—") });
      rows.push({ dt: "対応形式", dd: escapeHtml(item.meta_document_formats || item.meta_format) });
      rows.push({ dt: "編集可能", dd: escapeHtml(item.meta_document_editable || "—") });
      rows.push({ dt: "印刷対応", dd: escapeHtml(item.meta_document_print || "—") });
      rows.push({ dt: "推奨ツール", dd: renderDocumentToolsChips(item.document_recommended_tools) });
      rows.push({ dt: "ファイルサイズ", dd: escapeHtml(item.file_size || "—") });
    } else if (item.category_id === "code") {
      rows.push({ dt: "言語", dd: escapeHtml(item.meta_language || item.meta_format) });
      rows.push({ dt: "ファイル構成", dd: escapeHtml(item.meta_file_structure || "—") });
      rows.push({ dt: "依存関係", dd: escapeHtml(item.meta_dependencies || "—") });
      rows.push({ dt: "対応ブラウザ", dd: escapeHtml(item.meta_browser_support || item.meta_compatibility || "—") });
      rows.push({ dt: "難易度", dd: escapeHtml(item.meta_difficulty || "—") });
      rows.push({ dt: "ファイルサイズ", dd: escapeHtml(item.file_size || "—") });
    } else if (item.category_id === "illustration") {
      rows.push({ dt: "ファイル形式", dd: escapeHtml(item.meta_format) });
      rows.push({ dt: "ファイルサイズ", dd: escapeHtml(item.file_size || "—") });
      rows.push({ dt: "点数", dd: escapeHtml(item.meta_points || item.meta_pages || "—") });
      rows.push({ dt: "動作環境", dd: escapeHtml(item.environment || "—") });
    } else if (item.category_id === "background") {
      rows.push({ dt: "ファイル形式", dd: escapeHtml(item.meta_format) });
      rows.push({ dt: "解像度", dd: escapeHtml(item.meta_resolution || "—") });
      rows.push({ dt: "ファイルサイズ", dd: escapeHtml(item.file_size || "—") });
      rows.push({ dt: "比率", dd: escapeHtml(item.meta_ratio || item.meta_size || "—") });
    } else if (item.category_id === "icon") {
      rows.push({ dt: "収録点数", dd: escapeHtml(item.icon_count_display || item.meta_pages || "—") });
      rows.push({ dt: "対応形式", dd: escapeHtml(item.meta_format_exports || item.meta_format) });
      rows.push({ dt: "対応サイズ", dd: renderIconSizeChips(item.icon_sizes) });
      rows.push({ dt: "スタイル", dd: escapeHtml(item.meta_icon_styles || "—") });
      rows.push({ dt: "対応ソフト", dd: renderIconSoftwareChips(item.compatible_software) });
      rows.push({ dt: "ファイルサイズ", dd: escapeHtml(item.file_size || "—") });
    } else if (item.category_id === "presentation") {
      rows.push({ dt: "ページ数", dd: escapeHtml(item.meta_pages || "—") });
      rows.push({ dt: "編集可能", dd: escapeHtml(item.meta_presentation_editable || item.presentation_editable || "—") });
      rows.push({ dt: "アスペクト比", dd: escapeHtml(item.meta_ratio || item.meta_size || "—") });
      rows.push({ dt: "推奨ソフト", dd: renderPresentationSoftwareChips(item.presentation_recommended_software) });
      rows.push({ dt: "印刷対応", dd: escapeHtml(item.meta_presentation_print || item.presentation_print || "—") });
      rows.push({ dt: "ダウンロード形式", dd: renderPresentationFormatBadges(item.presentation_export_formats) });
    } else {
      rows.push({ dt: "ファイル形式", dd: escapeHtml(item.meta_format) });
      rows.push({ dt: "ファイルサイズ", dd: escapeHtml(item.file_size || "—") });
      rows.push({ dt: "動作環境", dd: escapeHtml(item.environment || "—") });
    }

    rows.push({ dt: "商用利用", dd: escapeHtml(commercial) });

    return rows
      .map(
        (row) =>
          `<div class="mat-detail-about__row"><dt>${escapeHtml(row.dt)}</dt><dd>${row.dd}</dd></div>`
      )
      .join("");
  }

  function renderSidebar(item) {
    return (
      `<aside class="mat-detail-sidebar">` +
      renderActionsCard(item) +
      renderSignupCard() +
      `<div class="mat-detail-card">` +
      `<h2 class="mat-detail-card__title">安心してご利用いただけます</h2>` +
      renderTrustList() +
      `</div>` +
      `<div class="mat-detail-card">` +
      `<h2 class="mat-detail-card__title">この素材について</h2>` +
      `<dl class="mat-detail-about">` +
      renderAboutRows(item) +
      `</dl></div></aside>`
    );
  }

  function renderImageDetailExtras(item) {
    const lines = item.image_detail_lines || [];
    if (!isImageMaterial(item) || !lines.length) return "";
    return (
      `<ul class="mat-detail-image-specs">` +
      lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("") +
      `</ul>`
    );
  }

  function renderMain(item) {
    return (
      `<div class="mat-detail-main">` +
      `<span class="mat-detail-badge mat-detail-badge--lg" style="--cat-color:${escapeHtml(item.category_color)}">${escapeHtml(item.category_name)}</span>` +
      `<h1 class="mat-detail-title">${escapeHtml(item.title)}</h1>` +
      `<p class="mat-detail-lead">${escapeHtml(item.description)}</p>` +
      renderMetaCards(item) +
      `<div class="mat-detail-card mat-detail-card--preview">` +
      renderPreview(item) +
      `</div>` +
      renderActionsCard(item, { mobile: true }) +
      renderIconFormatsSection(item) +
      renderIconStyleSection(item) +
      renderUsageScenarios(item) +
      renderPresentationUsageScenarios(item) +
      renderStyleTags(item) +
      renderColorPalette(item) +
      renderAiAssistPanel(item) +
      `<div class="mat-detail-desc-row">` +
      `<section class="mat-detail-card mat-detail-section" aria-labelledby="matDetailDescTitle">` +
      `<h2 id="matDetailDescTitle" class="mat-detail-section__title">商品の説明</h2>` +
      `<p class="mat-detail-section__body">${escapeHtml(item.long_description)}</p>` +
      renderImageDetailExtras(item) +
      `</section>` +
      `<section class="mat-detail-card mat-detail-section" aria-labelledby="matDetailRecTitle">` +
      `<h2 id="matDetailRecTitle" class="mat-detail-section__title">こんな方におすすめ</h2>` +
      renderRecommended(item.recommended_for) +
      `</section>` +
      `</div></div>`
    );
  }

  function renderBreadcrumb(item) {
    const showCategoryCrumb =
      isIllustration(item) || isBackground(item) || isIcon(item) || isCode(item) || isDocument(item) || isTool(item) || isPresentation(item);
    const categoryCrumb = showCategoryCrumb
      ? `<a href="${categoryListHref(item)}">${escapeHtml(item.category_name)}</a>` +
        `<span class="mat-detail-breadcrumb__sep" aria-hidden="true">›</span>`
      : "";
    return (
      `<nav class="mat-detail-breadcrumb" aria-label="パンくず">` +
      `<a href="/materials/">ホーム</a>` +
      `<span class="mat-detail-breadcrumb__sep" aria-hidden="true">›</span>` +
      `<a href="/materials/index.html">無料素材</a>` +
      `<span class="mat-detail-breadcrumb__sep" aria-hidden="true">›</span>` +
      categoryCrumb +
      `<span aria-current="page">${escapeHtml(item.title)}</span>` +
      `</nav>`
    );
  }

  function renderRelated(items, card, opts = {}) {
    if (!items || !items.length) return "";
    const grid = card.renderCardGrid(items, { carousel: !!opts.carousel, carouselLabel: "関連する素材" });
    return (
      `<section class="mat-detail-related" aria-labelledby="matDetailRelatedTitle">` +
      `<div class="mat-detail-related__head">` +
      `<h2 id="matDetailRelatedTitle" class="mat-detail-related__title">関連する素材</h2>` +
      `<a class="mat-detail-related__more" href="/materials/list.html">もっと見る &gt;</a>` +
      `</div>` +
      `<div class="mat-detail-related__grid-wrap">` +
      grid +
      `</div>` +
      `</section>`
    );
  }

  function renderDetailPage(item, related, card, opts = {}) {
    return (
      renderBreadcrumb(item) +
      `<div class="mat-detail-layout">` +
      renderMain(item) +
      renderSidebar(item) +
      `</div>` +
      renderRelated(related, card, opts)
    );
  }

  function ensureLightbox() {
    let el = document.getElementById("mat-detail-lightbox");
    if (el) return el;

    el = document.createElement("div");
    el.id = "mat-detail-lightbox";
    el.className = "mat-detail-lightbox";
    el.hidden = true;
    el.innerHTML =
      `<div class="mat-detail-lightbox__backdrop" data-mat-lightbox-close tabindex="-1" aria-hidden="true"></div>` +
      `<div class="mat-detail-lightbox__dialog" role="dialog" aria-modal="true" aria-label="画像プレビュー">` +
      `<button type="button" class="mat-detail-lightbox__close" data-mat-lightbox-close aria-label="閉じる">×</button>` +
      `<div class="mat-detail-lightbox__toolbar" data-mat-lightbox-toolbar hidden>` +
      `<button type="button" class="mat-detail-lightbox__zoom is-active" data-lb-zoom="fit">Fit</button>` +
      `<button type="button" class="mat-detail-lightbox__zoom" data-lb-zoom="100">100%</button>` +
      `<button type="button" class="mat-detail-lightbox__zoom" data-lb-zoom="200">200%</button>` +
      `</div>` +
      `<div class="mat-detail-lightbox__stage" data-mat-lightbox-stage>` +
      `<img class="mat-detail-lightbox__img is-zoom-fit" data-mat-lightbox-img alt="">` +
      `</div>` +
      `<p class="mat-detail-lightbox__hint" aria-hidden="true">Escで閉じる · 外側クリックで閉じる · ピンチで拡大</p>` +
      `</div>`;
    document.body.appendChild(el);

    el.querySelectorAll("[data-mat-lightbox-close]").forEach((node) => {
      node.addEventListener("click", () => closeLightbox());
    });

    el.querySelector(".mat-detail-lightbox__dialog")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeLightbox();
    });

    global.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && el && !el.hidden) closeLightbox();
    });

    wireLightboxPinchZoom(el);
    wireLightboxZoomControls(el);

    return el;
  }

  function applyLightboxZoomMode(lightboxEl, mode) {
    const img = lightboxEl?.querySelector("[data-mat-lightbox-img]");
    const toolbar = lightboxEl?.querySelector("[data-mat-lightbox-toolbar]");
    if (!img) return;
    img.classList.remove("is-zoom-fit", "is-zoom-100", "is-zoom-200");
    if (mode === "100") img.classList.add("is-zoom-100");
    else if (mode === "200") img.classList.add("is-zoom-200");
    else img.classList.add("is-zoom-fit");
    if (lightboxEl._resetZoom && mode === "fit") lightboxEl._resetZoom();
    else if (lightboxEl._resetZoom) lightboxEl._resetZoom();
    toolbar?.querySelectorAll("[data-lb-zoom]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-lb-zoom") === mode);
    });
    lightboxEl.dataset.lbZoomMode = mode;
  }

  function wireLightboxZoomControls(lightboxEl) {
    const toolbar = lightboxEl.querySelector("[data-mat-lightbox-toolbar]");
    if (!toolbar) return;
    toolbar.querySelectorAll("[data-lb-zoom]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyLightboxZoomMode(lightboxEl, btn.getAttribute("data-lb-zoom") || "fit");
      });
    });
  }

  function wireLightboxPinchZoom(lightboxEl) {
    const stage = lightboxEl.querySelector("[data-mat-lightbox-stage]");
    const img = lightboxEl.querySelector("[data-mat-lightbox-img]");
    if (!stage || !img) return;

    let scale = 1;
    let startDist = 0;
    let startScale = 1;

    function touchDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    function applyScale(next) {
      scale = Math.min(4, Math.max(1, next));
      img.style.transform = scale === 1 ? "" : `scale(${scale})`;
      stage.dataset.scale = String(scale);
    }

    stage.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length === 2) {
          startDist = touchDistance(event.touches);
          startScale = scale;
        }
      },
      { passive: true }
    );

    stage.addEventListener(
      "touchmove",
      (event) => {
        if (event.touches.length !== 2 || !startDist) return;
        event.preventDefault();
        const dist = touchDistance(event.touches);
        applyScale(startScale * (dist / startDist));
      },
      { passive: false }
    );

    stage.addEventListener("touchend", () => {
      if (scale <= 1.05) applyScale(1);
      startDist = 0;
    });

    lightboxEl._resetZoom = () => applyScale(1);
  }

  function openLightbox(src, alt, opts) {
    const options = opts || {};
    const el = ensureLightbox();
    const img = el.querySelector("[data-mat-lightbox-img]");
    const toolbar = el.querySelector("[data-mat-lightbox-toolbar]");
    if (img) {
      img.src = src;
      img.alt = alt || "";
    }
    if (toolbar) toolbar.hidden = !options.enhanced;
    applyLightboxZoomMode(el, "fit");
    if (el._resetZoom) el._resetZoom();
    el.hidden = false;
    document.body.classList.add("mat-detail-lightbox-open");
    el.querySelector(".mat-detail-lightbox__close")?.focus();
  }

  function closeLightbox() {
    const el = document.getElementById("mat-detail-lightbox");
    if (!el) return;
    el.hidden = true;
    document.body.classList.remove("mat-detail-lightbox-open");
    if (el._resetZoom) el._resetZoom();
    const img = el.querySelector("[data-mat-lightbox-img]");
    if (img) img.removeAttribute("src");
  }

  function ensureIconSetModal() {
    let el = document.getElementById("mat-detail-icon-set-modal");
    if (el) return el;

    el = document.createElement("div");
    el.id = "mat-detail-icon-set-modal";
    el.className = "mat-detail-icon-set-modal";
    el.hidden = true;
    el.innerHTML =
      `<div class="mat-detail-icon-set-modal__backdrop" data-icon-set-close tabindex="-1" aria-hidden="true"></div>` +
      `<div class="mat-detail-icon-set-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="matIconSetModalTitle">` +
      `<div class="mat-detail-icon-set-modal__head">` +
      `<h2 id="matIconSetModalTitle" class="mat-detail-icon-set-modal__title">収録アイコン一覧</h2>` +
      `<button type="button" class="mat-detail-icon-set-modal__close" data-icon-set-close aria-label="閉じる">×</button>` +
      `</div>` +
      `<div class="mat-detail-icon-set-modal__grid" data-icon-set-grid></div>` +
      `<p class="mat-detail-icon-set-modal__hint" aria-hidden="true">Escで閉じる · 外側クリックで閉じる</p>` +
      `</div>`;
    document.body.appendChild(el);

    el.querySelectorAll("[data-icon-set-close]").forEach((node) => {
      node.addEventListener("click", () => closeIconSetModal());
    });

    el.querySelector(".mat-detail-icon-set-modal__dialog")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeIconSetModal();
    });

    global.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && el && !el.hidden) closeIconSetModal();
    });

    return el;
  }

  function openIconSetModal(iconSet) {
    if (!iconSet?.icons?.length) return;
    const el = ensureIconSetModal();
    const grid = el.querySelector("[data-icon-set-grid]");
    const title = el.querySelector("#matIconSetModalTitle");
    if (title) title.textContent = `収録アイコン一覧（${iconSet.count || iconSet.icons.length}点）`;
    if (grid) {
      grid.innerHTML = iconSet.icons.map((icon) => renderIconSetPreviewItem(icon)).join("");
    }
    el.hidden = false;
    document.body.classList.add("mat-detail-icon-set-modal-open");
    el.querySelector(".mat-detail-icon-set-modal__close")?.focus();
  }

  function closeIconSetModal() {
    const el = document.getElementById("mat-detail-icon-set-modal");
    if (!el) return;
    el.hidden = true;
    document.body.classList.remove("mat-detail-icon-set-modal-open");
    const grid = el.querySelector("[data-icon-set-grid]");
    if (grid) grid.innerHTML = "";
  }

  function wireIconSetModal(root, item) {
    const btn = root.querySelector("[data-icon-set-open]");
    if (!btn || !item?.icon_set?.icons?.length) return;
    btn.addEventListener("click", () => openIconSetModal(item.icon_set));
  }

  function setPreviewImageState(wrap, state) {
    if (!wrap) return;
    wrap.setAttribute("data-mat-preview-state", state);
    const skeleton = wrap.querySelector("[data-mat-preview-skeleton]");
    const errorEl = wrap.querySelector("[data-mat-preview-error]");
    if (skeleton) skeleton.hidden = state !== "loading";
    if (errorEl) errorEl.hidden = state !== "error";
  }

  function wirePreviewImageLoader(root) {
    const wrap = root.querySelector("[data-mat-preview-wrap]");
    if (!wrap) return;

    const img = wrap.querySelector("[data-mat-preview-img]");
    const reloadBtn = wrap.querySelector("[data-mat-preview-reload]");
    const src = img?.getAttribute("data-src") || img?.getAttribute("src") || "";

    if (/\.svg(\?|$)/i.test(src)) {
      setPreviewImageState(wrap, "loaded");
    } else {
      bindPreviewImage(wrap, img);
    }

    reloadBtn?.addEventListener("click", () => {
      if (!img) return;
      const nextSrc = img.getAttribute("data-src") || img.src;
      bindPreviewImage(wrap, img, nextSrc, true);
    });
  }

  function bindPreviewImage(wrap, img, forcedSrc, forceReload) {
    if (!wrap || !img) return;
    const src = forcedSrc || img.getAttribute("data-src") || img.getAttribute("src") || "";
    if (!src) return;

    setPreviewImageState(wrap, "loading");

    let settled = false;
    const markLoaded = () => {
      if (settled) return;
      settled = true;
      setPreviewImageState(wrap, "loaded");
    };
    const markError = () => {
      if (settled) return;
      settled = true;
      setPreviewImageState(wrap, "error");
    };

    const srcHint = src || img.currentSrc || img.src || "";
    const isSvg = /\.svg(\?|$)/i.test(srcHint);
    const finalize = () => {
      if (img.naturalWidth > 0 || isSvg) markLoaded();
      else markError();
    };

    img.onload = () => finalize();
    img.onerror = markError;

    if (forceReload) {
      img.removeAttribute("src");
      img.src = src;
      return;
    }

    if (img.complete) finalize();
  }

  function wireImageLightbox(root) {
    root.querySelectorAll("[data-mat-lightbox-src]").forEach((main) => {
      main.addEventListener("click", () => {
        const src = main.getAttribute("data-mat-lightbox-src");
        const img = main.querySelector("img");
        const enhanced = main.getAttribute("data-mat-lightbox-enhanced") === "true";
        if (src) openLightbox(src, img?.alt || "", { enhanced });
      });
    });
  }

  function getActiveCodePanelText(previewRoot) {
    const panel = previewRoot.querySelector(".mat-detail-code.is-active") || previewRoot.querySelector("[data-code-panel]:not([hidden])");
    return panel?.textContent || "";
  }

  function copyTextToClipboard(text) {
    const value = String(text || "");
    if (!value) return Promise.resolve(false);
    if (navigator.clipboard && global.isSecureContext) {
      return navigator.clipboard.writeText(value).then(
        () => true,
        () => copyTextToClipboardFallback(value)
      );
    }
    return Promise.resolve(copyTextToClipboardFallback(value));
  }

  function copyTextToClipboardFallback(value) {
    try {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  function wireCodeFileTabs(previewRoot) {
    const tabs = previewRoot.querySelectorAll("[data-code-tab]");
    const panels = previewRoot.querySelectorAll("[data-code-panel]");
    if (!tabs.length || !panels.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const index = tab.getAttribute("data-code-tab");
        tabs.forEach((btn) => {
          const active = btn === tab;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        panels.forEach((panel) => {
          const active = panel.getAttribute("data-code-panel") === index;
          panel.classList.toggle("is-active", active);
          panel.hidden = !active;
        });
      });
    });
  }

  function wireCodeCopyButton(previewRoot) {
    const copyBtn = previewRoot.querySelector("[data-code-copy]");
    const label = previewRoot.querySelector("[data-code-copy-label]");
    if (!copyBtn || !label) return;

    let resetTimer = null;
    copyBtn.addEventListener("click", () => {
      const text = getActiveCodePanelText(previewRoot);
      copyTextToClipboard(text).then((ok) => {
        if (!ok) return;
        label.textContent = "コピーしました";
        copyBtn.classList.add("is-copied");
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          label.textContent = "コピー";
          copyBtn.classList.remove("is-copied");
        }, 1800);
      });
    });
  }

  function wireTypingDemo(previewRoot) {
    const demo = previewRoot.querySelector("[data-code-typing-demo]");
    if (!demo) return;

    const textEl = demo.querySelector("[data-typing-text]");
    const playBtn = previewRoot.querySelector("[data-code-demo-play]");
    const resetBtn = previewRoot.querySelector("[data-code-demo-reset]");
    const fullText = demo.getAttribute("data-typing-full") || "Welcome to TASFUL";
    let timer = null;
    let index = 0;

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function reset() {
      stop();
      index = 0;
      if (textEl) textEl.textContent = "";
    }

    function play() {
      reset();
      timer = setInterval(() => {
        index += 1;
        if (textEl) textEl.textContent = fullText.slice(0, index);
        if (index >= fullText.length) stop();
      }, 120);
    }

    playBtn?.addEventListener("click", play);
    resetBtn?.addEventListener("click", reset);
  }

  function wireCodePreview(root) {
    const preview = root.querySelector("[data-mat-detail-preview='code']");
    if (!preview) return;
    wireCodeFileTabs(preview);
    wireCodeCopyButton(preview);
    wireTypingDemo(preview);
  }

  function buildDocumentCopyContent(item) {
    const doc = item.document_preview || {};
    const heading = doc.title || item.title || "";
    const lines = [];

    if (doc.date_label) lines.push(doc.date_label);
    if (doc.greeting) lines.push(doc.greeting);
    if (doc.body) lines.push(doc.body);
    if (doc.bullets?.length) lines.push(...doc.bullets.map((b) => `・${b}`));

    if (doc.sections?.length) {
      doc.sections.forEach((section) => {
        if (section.heading) lines.push(`【${section.heading}】`);
        (section.fields || []).forEach((field) => lines.push(`${field.label}：${field.value}`));
        (section.bullets || []).forEach((b) => lines.push(`・${b}`));
        if (section.body) lines.push(section.body);
      });
    }

    if (doc.line_items?.length) {
      lines.push("【明細】");
      doc.line_items.forEach((row) => {
        lines.push(`${row.name}\t${row.qty}${row.unit || ""}\t${row.amount}`);
      });
      if (doc.total) lines.push(`合計：${doc.total}`);
    }

    if (doc.signoff) lines.push(doc.signoff);
    if (doc.signature) {
      if (doc.signature.company) lines.push(doc.signature.company);
      if (doc.signature.department) lines.push(doc.signature.department);
      if (doc.signature.name) lines.push(doc.signature.name);
    }

    const body = lines.filter(Boolean).join("\n");
    let markdown = `# ${heading.replace(/^件名：/, "")}\n\n`;
    if (doc.date_label) markdown += `*${doc.date_label}*\n\n`;
    if (doc.greeting) markdown += `${doc.greeting}\n\n`;
    if (doc.body) markdown += `${doc.body}\n\n`;
    if (doc.bullets?.length) {
      markdown += doc.bullets.map((b) => `- ${b}`).join("\n") + "\n\n";
    }
    if (doc.sections?.length) {
      doc.sections.forEach((section) => {
        if (section.heading) markdown += `## ${section.heading}\n\n`;
        (section.fields || []).forEach((field) => {
          markdown += `- **${field.label}**: ${field.value}\n`;
        });
        (section.bullets || []).forEach((b) => {
          markdown += `- ${b}\n`;
        });
        if (section.body) markdown += `\n${section.body}\n\n`;
      });
    }
    if (doc.signoff) markdown += `\n${doc.signoff}\n`;

    return {
      heading,
      body,
      markdown: markdown.trim(),
      plain: body,
    };
  }

  function wireDocumentPreview(root, item) {
    const preview = root.querySelector("[data-mat-detail-preview='document']");
    if (!preview || !isDocument(item)) return;

    const copyContent = buildDocumentCopyContent(item);
    const copyMap = {
      body: copyContent.body,
      heading: copyContent.heading,
      markdown: copyContent.markdown,
      plain: copyContent.plain,
    };

    preview.querySelectorAll("[data-doc-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-doc-copy") || "body";
        const text = copyMap[type] || copyContent.body;
        const label = btn.querySelector("[data-doc-copy-label]");
        const defaultLabel = label?.textContent || "コピー";

        copyTextToClipboard(text).then((ok) => {
          if (!ok || !label) return;
          label.textContent = "コピーしました";
          btn.classList.add("is-copied");
          setTimeout(() => {
            label.textContent = defaultLabel;
            btn.classList.remove("is-copied");
          }, 1800);
        });
      });
    });
  }

  function wireLogoMakerTool(root, item) {
    const tool = root.querySelector("[data-tool-logo-maker]");
    if (!tool) return;

    const nameInput = tool.querySelector("[data-logo-name]");
    const subtitleInput = tool.querySelector("[data-logo-subtitle]");
    const colorInput = tool.querySelector("[data-logo-color]");
    const fontSelect = tool.querySelector("[data-logo-font]");
    const generateBtn = tool.querySelector("[data-logo-generate]");
    const placeholder = tool.querySelector("[data-logo-placeholder]");
    const result = tool.querySelector("[data-logo-result]");
    const actions = tool.querySelector("[data-logo-actions]");
    const mark = tool.querySelector("[data-logo-mark]");
    const iconEl = tool.querySelector("[data-logo-icon]");
    const displayName = tool.querySelector("[data-logo-display-name]");
    const displaySub = tool.querySelector("[data-logo-display-sub]");

    const FONT_MAP = {
      gothic: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      mincho: '"Yu Mincho", "Hiragino Mincho ProN", serif',
      rounded: '"Arial Rounded MT Bold", "M PLUS Rounded 1c", sans-serif',
      hand: '"Segoe Script", "Comic Sans MS", cursive',
    };

    let activeStyle = "simple";

    function getInitial(name) {
      const trimmed = String(name || "").trim();
      return trimmed ? trimmed.charAt(0).toUpperCase() : "L";
    }

    function flashAction(btn, message) {
      if (!btn) return;
      const defaultLabel = btn.getAttribute("data-default-label") || btn.textContent;
      if (!btn.getAttribute("data-default-label")) btn.setAttribute("data-default-label", defaultLabel);
      btn.textContent = message;
      btn.classList.add("is-done");
      setTimeout(() => {
        btn.textContent = defaultLabel;
        btn.classList.remove("is-done");
      }, 1800);
    }

    function generateLogo() {
      const name = String(nameInput?.value || "").trim() || "MY BRAND";
      const subtitle = String(subtitleInput?.value || "").trim();
      const color = colorInput?.value || "#2563eb";
      const fontKey = fontSelect?.value || "gothic";

      if (displayName) displayName.textContent = name;
      if (displaySub) {
        displaySub.textContent = subtitle;
        displaySub.hidden = !subtitle;
      }
      if (iconEl) iconEl.textContent = getInitial(name);
      if (mark) {
        mark.style.setProperty("--logo-color", color);
        mark.className = `mat-tool-logo__mark mat-tool-logo__mark--${activeStyle}`;
        mark.style.fontFamily = FONT_MAP[fontKey] || FONT_MAP.gothic;
      }

      if (placeholder) placeholder.hidden = true;
      if (result) result.hidden = false;
      if (actions) actions.hidden = false;
    }

    function resetLogo() {
      if (placeholder) placeholder.hidden = false;
      if (result) result.hidden = true;
      if (actions) actions.hidden = true;
    }

    tool.querySelectorAll("[data-logo-style]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeStyle = btn.getAttribute("data-logo-style") || "simple";
        tool.querySelectorAll("[data-logo-style]").forEach((b) => {
          const active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-checked", active ? "true" : "false");
        });
        if (result && !result.hidden) generateLogo();
      });
    });

    tool.querySelectorAll("[data-logo-sample]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (nameInput) nameInput.value = btn.getAttribute("data-logo-sample") || "";
        generateLogo();
      });
    });

    generateBtn?.addEventListener("click", generateLogo);

    tool.querySelectorAll("[data-logo-save]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-logo-save") || "png";
        flashAction(btn, type === "svg" ? "保存しました" : "保存しました");
      });
    });

    tool.querySelector("[data-logo-copy-text]")?.addEventListener("click", (event) => {
      const btn = event.currentTarget;
      const name = String(nameInput?.value || "").trim();
      const subtitle = String(subtitleInput?.value || "").trim();
      const text = [name, subtitle].filter(Boolean).join("\n");
      copyTextToClipboard(text).then((ok) => {
        if (ok) flashAction(btn, "コピーしました");
      });
    });

    tool.querySelector("[data-logo-remake]")?.addEventListener("click", () => {
      resetLogo();
      nameInput?.focus();
    });

    [nameInput, subtitleInput, colorInput, fontSelect].forEach((el) => {
      el?.addEventListener("input", () => {
        if (result && !result.hidden) generateLogo();
      });
      el?.addEventListener("change", () => {
        if (result && !result.hidden) generateLogo();
      });
    });

    generateLogo();
  }

  function wireToolPreview(root, item) {
    if (item?.tool_demo_type === "logo-maker" || item?.slug === "logo-maker-tool") {
      wireLogoMakerTool(root, item);
    }
  }

  function wireBackgroundDevicePreview(root) {
    const preview = root.querySelector("[data-mat-bg-preview]");
    if (!preview) return;
    const frame = preview.querySelector("[data-bg-device-frame]");
    preview.querySelectorAll("[data-bg-device]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const device = btn.getAttribute("data-bg-device") || "pc";
        if (frame) {
          frame.className = `mat-detail-preview__device mat-detail-preview__device--${device}`;
          frame.setAttribute("data-bg-device-frame", device);
        }
        preview.querySelectorAll("[data-bg-device]").forEach((b) => {
          const active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", active ? "true" : "false");
        });
      });
    });
  }

  function wirePreviewThumbs(root) {
    const preview = root.querySelector("[data-mat-detail-preview='image']");
    if (!preview) return;
    const main = preview.querySelector("[data-mat-detail-preview-main]");
    const mainImg = main?.querySelector("img");

    preview.querySelectorAll("[data-preview-src]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const src = btn.getAttribute("data-preview-src");
        const alt = btn.getAttribute("data-preview-alt") || "";
        if (!src || !mainImg) return;
        mainImg.src = src;
        mainImg.alt = alt;
        mainImg.setAttribute("data-src", src);
        if (main.closest("[data-mat-preview-wrap]")) {
          const wrapEl = main.closest("[data-mat-preview-wrap]");
          setPreviewImageState(wrapEl, "loading");
          mainImg.onload = () => {
            const srcHint = src || mainImg.currentSrc || mainImg.src || "";
            const ok = mainImg.naturalWidth > 0 || /\.svg(\?|$)/i.test(srcHint);
            setPreviewImageState(wrapEl, ok ? "loaded" : "error");
          };
          mainImg.onerror = () => setPreviewImageState(wrapEl, "error");
        }
        if (main.hasAttribute("data-mat-lightbox-src")) {
          main.setAttribute("data-mat-lightbox-src", src);
        }
        preview.querySelectorAll("[data-preview-src]").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
      });
    });

    preview.querySelectorAll("[data-thumb-style]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const style = btn.getAttribute("data-thumb-style");
        if (!style || !main || mainImg) return;
        main.className = `mat-detail-preview__main materials-card__thumb materials-card__thumb--${style}`;
        preview.querySelectorAll("[data-thumb-style]").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
      });
    });
  }

  function wirePresentationViewer(root) {
    const preview = root.querySelector("[data-mat-detail-preview='presentation']");
    if (!preview) return;

    const total = parseInt(preview.getAttribute("data-pres-total") || "1", 10);
    let index = 0;
    const counter = preview.querySelector("[data-pres-counter]");
    const slides = preview.querySelectorAll("[data-pres-slide]");
    const thumbs = preview.querySelectorAll("[data-pres-tab]");
    const prevBtn = preview.querySelector("[data-pres-prev]");
    const nextBtn = preview.querySelector("[data-pres-next]");

    function goTo(nextIndex) {
      index = Math.max(0, Math.min(total - 1, nextIndex));
      slides.forEach((el, idx) => {
        const active = idx === index;
        el.classList.toggle("is-active", active);
        el.hidden = !active;
      });
      thumbs.forEach((el, idx) => {
        const active = idx === index;
        el.classList.toggle("is-active", active);
        el.setAttribute("aria-selected", active ? "true" : "false");
      });
      if (counter) counter.textContent = `${index + 1} / ${total}`;
      if (prevBtn) prevBtn.disabled = index === 0;
      if (nextBtn) nextBtn.disabled = index >= total - 1;
    }

    prevBtn?.addEventListener("click", () => goTo(index - 1));
    nextBtn?.addEventListener("click", () => goTo(index + 1));
    thumbs.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = parseInt(btn.getAttribute("data-pres-tab") || "0", 10);
        goTo(tab);
      });
    });
    goTo(0);
  }

  function bindMaterialsReportTarget(item) {
    if (!item || !document.body) return;
    const listingId = String(item.id || item.slug || "").trim();
    if (listingId) document.body.dataset.listingId = listingId;
    document.body.dataset.detailType = "material_asset";
    const owner = String(item.creator_user_id || item.creatorId || "").trim();
    if (owner) document.body.dataset.sellerUserId = owner;
    try {
      global.dispatchEvent(new CustomEvent("tasu:listing-applied"));
    } catch {
      /* optional */
    }
  }

  async function hydrateCreatorHandoff(root, item) {
    const Data = global.TasuMaterialsData;
    if (!root || !item || !Data?.canonicalCreatorId) return;
    if (root.querySelector("[data-mat-detail-creator]")) return;
    const creatorId = Data.canonicalCreatorId(item);
    if (!creatorId) return;
    const href = Data.creatorPageHref(creatorId);
    if (!href) return;
    let profile = null;
    try {
      profile = await global.TasuListingSellerProfile?.fetchSellerProfile?.(creatorId);
    } catch {
      profile = null;
    }
    const name = escapeHtml(profile?.displayName || creatorId);
    const avatar = escapeHtml(profile?.avatarUrl || "");
    const html =
      `<a class="mat-detail-creator" data-mat-detail-creator data-creator-id="${escapeHtml(creatorId)}" href="${escapeHtml(href)}">` +
      `<img class="mat-detail-creator__avatar" src="${avatar}" alt="" width="36" height="36">` +
      `<span class="mat-detail-creator__name">${name}</span>` +
      `</a>`;
    const title = root.querySelector("h1.mat-detail-title, h1.product-title, h1");
    if (title) title.insertAdjacentHTML("afterend", html);
    else root.insertAdjacentHTML("afterbegin", html);
  }

  async function mountDetailPage() {
    const Data = global.TasuMaterialsData;
    const Card = global.TasuMaterialsDownloadCard;
    const root = document.querySelector("[data-materials-detail-root]");
    if (!Data || !Card || !root) return;

    try {
      await global.TasuMaterialsMetrics?.ensureLoaded?.();
    } catch {
      /* metrics optional */
    }

    const slug = new URLSearchParams(global.location.search).get("slug");
    let item = await Data.repository.fetchItemBySlug(slug);
    let related = [];

    if (!item && global.TasuMaterialsBackgroundDetail?.resolveQaItem) {
      item = global.TasuMaterialsBackgroundDetail.resolveQaItem(slug);
      if (item) {
        related = global.TasuMaterialsBackgroundDetail.resolveQaRelated?.(item) || [];
      }
    }

    if (!item && global.TasuMaterialsIllustrationDetail?.resolveQaItem) {
      item = global.TasuMaterialsIllustrationDetail.resolveQaItem(slug);
      if (item) {
        related = global.TasuMaterialsIllustrationDetail.resolveQaRelated?.(item) || [];
      }
    }

    if (!item && global.TasuMaterialsBgmDetail?.resolveQaItem) {
      item = global.TasuMaterialsBgmDetail.resolveQaItem(slug);
      if (item) {
        related = global.TasuMaterialsBgmDetail.resolveQaRelated?.(item) || [];
      }
    }

    if (!item && global.TasuMaterialsDocumentDetail?.resolveQaItem) {
      item = global.TasuMaterialsDocumentDetail.resolveQaItem(slug);
      if (item) {
        related = global.TasuMaterialsDocumentDetail.resolveQaRelated?.(item) || [];
      }
    }

    if (!item) {
      root.innerHTML = `<div class="mat-detail-empty"><p>素材が見つかりません。</p><p><a href="/materials/index.html">無料ダウンロードTOPへ</a></p></div>`;
      document.title = "素材が見つかりません | TASFUL Materials";
      return;
    }

    bindMaterialsReportTarget(item);

    if (!related.length) {
      related = await Data.repository.fetchRelatedItems(item, 5);
    }

    if (item.category_id === "web" && global.TasuMaterialsWebDetail?.mount) {
      await global.TasuMaterialsWebDetail.mount(root, item, related);
      await hydrateCreatorHandoff(root, item);
      return;
    }

    if (item.category_id === "code" && global.TasuMaterialsCodeDetail?.mount) {
      await global.TasuMaterialsCodeDetail.mount(root, item, related);
      await hydrateCreatorHandoff(root, item);
      return;
    }

    if (item.category_id === "document" && global.TasuMaterialsDocumentDetail?.mount) {
      await global.TasuMaterialsDocumentDetail.mount(root, item, related);
      await hydrateCreatorHandoff(root, item);
      return;
    }

    if (item.category_id === "presentation" && global.TasuMaterialsPresentationDetail?.mount) {
      await global.TasuMaterialsPresentationDetail.mount(root, item, related);
      await hydrateCreatorHandoff(root, item);
      return;
    }

    if (item.category_id === "template" && global.TasuMaterialsTemplateDetail?.mount) {
      await global.TasuMaterialsTemplateDetail.mount(root, item, related);
      await hydrateCreatorHandoff(root, item);
      return;
    }

    if (item.category_id === "icon" && global.TasuMaterialsIconDetail?.mount) {
      await global.TasuMaterialsIconDetail.mount(root, item, related);
      await hydrateCreatorHandoff(root, item);
      return;
    }

    if (item.category_id === "background" && global.TasuMaterialsBackgroundDetail?.mount) {
      await global.TasuMaterialsBackgroundDetail.mount(root, item, related);
      await hydrateCreatorHandoff(root, item);
      return;
    }

    if (item.category_id === "illustration" && global.TasuMaterialsIllustrationDetail?.mount) {
      await global.TasuMaterialsIllustrationDetail.mount(root, item, related);
      await hydrateCreatorHandoff(root, item);
      return;
    }

    if (item.category_id === "image" && global.TasuMaterialsImageDetail?.mount) {
      await global.TasuMaterialsImageDetail.mount(root, item, related);
      await hydrateCreatorHandoff(root, item);
      return;
    }

    if (item.category_id === "bgm" && global.TasuMaterialsBgmDetail?.mount) {
      await global.TasuMaterialsBgmDetail.mount(root, item, related);
      await hydrateCreatorHandoff(root, item);
      return;
    }

    if (item.category_id === "sfx" && global.TasuMaterialsSfxDetail?.mount) {
      await global.TasuMaterialsSfxDetail.mount(root, item, related);
      await hydrateCreatorHandoff(root, item);
      return;
    }

    const useCarousel = global.matchMedia("(max-width: 768px)").matches;
    root.innerHTML = renderDetailPage(item, related, Card, { carousel: useCarousel });
    document.title = `${item.title} | TASFUL Materials`;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", item.description || "");

    wirePreviewThumbs(root);
    wireImageLightbox(root);
    wirePreviewImageLoader(root);
    wireBackgroundDevicePreview(root);
    wireIconSetModal(root, item);
    wireCodePreview(root);
    wireDocumentPreview(root, item);
    wireToolPreview(root, item);
    wirePresentationViewer(root);
    global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(root, item);
    await hydrateCreatorHandoff(root, item);
  }

  global.TasuMaterialsDetail = {
    renderDetailPage,
    mountDetailPage,
    hydrateCreatorHandoff,
  };

  if (document.body && document.body.getAttribute("data-page") === "materials_detail") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        mountDetailPage().catch(() => {});
      });
    } else {
      mountDetailPage().catch(() => {});
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
