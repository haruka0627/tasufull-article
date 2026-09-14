/**
 * TASFUL Materials — アイコン素材詳細 STC Full Retransplant
 * Source: reports/materials-stc-audit/canonical/icon-detail.html (detail chrome only —
 * the canonical page pastes an unrelated SFX waveform/audio-player block which is a clear
 * copy error for this category and is intentionally omitted; all other STC structure kept).
 * 公開表示名「アイコン素材」。操作=青 / バッジ=indigo。プレビューは object-contain + チェッカー（透過視認）。Asset 非加工。
 * Download / Favorite / Related Contract は既存接続。schema 追加なし。
 */
(function (global) {
  "use strict";

  const DISPLAY_NAME = "アイコン素材";
  /** BGM related と同様: Desktop 4列1段で完結（「すべて見る」で残りへ） */
  const RELATED_DISPLAY_LIMIT = 4;
  const GENERIC_TAGS = new Set(["icon", "アイコン", "アイコン素材", "png", "jpg", "jpeg", "webp", "svg"]);

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

  function itemTags(item) {
    return (item.tags || [])
      .map((t) => String(t).trim())
      .filter((t) => t && !GENERIC_TAGS.has(t.toLowerCase()) && !GENERIC_TAGS.has(t));
  }

  function resolvePreviewSrc(item) {
    const images = Array.isArray(item.preview_images) ? item.preview_images : [];
    const first = images[0];
    const fromPreview = pickStr(first && (first.src || first.url || first), typeof first === "string" ? first : "");
    const set = item.icon_set;
    const fromSet = pickStr(
      set && Array.isArray(set.preview_urls) ? set.preview_urls[0] : "",
      set && Array.isArray(set.icons) && set.icons[0] ? set.icons[0].src : ""
    );
    return pickStr(fromPreview, fromSet, item.thumbnail_url, item.preview_image, item.preview_url, item.image_url, item.image, item.download_url);
  }

  function sizeLabel(item) {
    return pickStr(
      item.meta_resolution,
      item.width && item.height ? `${item.width}×${item.height}` : "",
      item.image_width && item.image_height ? `${item.image_width}×${item.image_height}` : ""
    );
  }

  function formatLabel(item) {
    const formats = item.file_formats || [];
    if (formats.length) return formats.map((f) => String(f).toUpperCase()).join(" / ");
    return pickStr(item.meta_format, "—");
  }

  function detailHref(item) {
    return `detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
  }

  function listHref() {
    return "/materials/list.html?category=icon";
  }

  function usageLinesFromItem(item) {
    const fromRecommended = (item.recommended_for || item.usage_tags || []).map((x) => String(x).trim()).filter(Boolean);
    if (fromRecommended.length) return fromRecommended.slice(0, 4);
    const joined = pickStr(item.meta_recommended_usage);
    if (joined && joined !== "—") {
      return joined.split(/[·•|/]/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
    }
    return [];
  }

  function buildInfoRows(item) {
    const rows = [
      ["ファイル形式", formatLabel(item)],
      ["サイズ", sizeLabel(item) || ""],
      ["ファイルサイズ", pickStr(item.file_size, item.meta_file_size) || ""],
      ["カテゴリ", DISPLAY_NAME],
      ["公開日", pickStr(item.meta_published, item.meta_updated) || ""],
      ["素材ID", pickStr(item.slug, item.id)],
    ];
    return rows.filter(([, v]) => String(v || "").trim());
  }

  function renderRelatedCard(item) {
    const href = detailHref(item);
    const thumb = resolvePreviewSrc(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    return (
      `<article class="mat-icon-d-related-card" data-icon-d-related data-item-id="${escapeHtml(item.id)}">` +
        `<div class="mat-icon-d-related-card__badges">` +
          `<span class="mat-icon-d-related-card__badge">${DISPLAY_NAME}</span>` +
          (item.is_free !== false ? `<span class="mat-icon-d-related-card__free">無料</span>` : "") +
        `</div>` +
        `<a class="mat-icon-d-related-card__media" href="${href}" aria-label="${escapeHtml(item.title)}">` +
          (thumb
            ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
            : `<span class="mat-icon-d-related-card__fallback" aria-hidden="true"></span>`) +
        `</a>` +
        `<h3 class="mat-icon-d-related-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
        `<div class="mat-icon-d-related-card__foot">` +
          `<span class="mat-icon-d-related-card__meta"><span class="mat-icon-d-star" aria-hidden="true">★</span>${rating}<span class="mat-icon-d-related-card__dlcount">${dl}</span></span>` +
          `<button type="button" class="mat-icon-d-related-card__dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
            `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
            `<span aria-hidden="true">↓</span>` +
          `</button>` +
        `</div>` +
      `</article>`
    );
  }

  function renderShell(item, related) {
    const Fav = global.TasuMaterialsFavorites;
    const Download = global.TasuMaterialsDownload;
    const tags = itemTags(item);
    const favOn = Fav?.isFavorited?.(item.id);
    const dlLabel = Download?.primaryButtonLabel?.(item) || item.button_label || "広告を見て無料ダウンロード";
    const formats = (item.file_formats || []).length
      ? item.file_formats
      : String(item.meta_format || "").split(/[/·,]/).map((s) => s.trim()).filter(Boolean);
    const previewSrc = resolvePreviewSrc(item);
    const size = sizeLabel(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const ratingCount = Number(item.rating_count || 0);
    const hrefList = listHref();
    const usageLines = usageLinesFromItem(item);
    const desc = pickStr(item.long_description, item.description) || `${DISPLAY_NAME}です。`;
    const relatedIcon = (related || []).filter((r) => r && r.category_id === "icon" && r.id !== item.id);
    const infoRows = buildInfoRows(item);
    const licenseLead = pickStr(item.commercial_use, "商用利用OK・クレジット表記不要");

    const formatOptions = (formats.length ? formats : ["PNG"])
      .map((f, i) => {
        const upper = String(f).toUpperCase();
        const label = upper === "SVG" ? "SVG（ベクター）" : upper;
        return `<option value="${escapeHtml(upper)}"${i === 0 ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("");
    const sizeSelect = size ? `<option selected>オリジナル (${escapeHtml(size)})</option>` : `<option selected>オリジナル</option>`;

    const primaryFmt = formats[0] ? String(formats[0]).toUpperCase() : "PNG";
    const originalBtnLabel = size
      ? `オリジナル (${escapeHtml(size)})`
      : primaryFmt === "SVG"
        ? "オリジナル (ベクター/SVG)"
        : `オリジナル (${escapeHtml(primaryFmt)})`;

    const previewBody = previewSrc
      ? `<div class="mat-icon-d-preview__frame" data-icon-d-frame data-mat-preview-state="loading">` +
          `<div class="mat-icon-d-preview__skeleton" data-icon-d-skeleton aria-hidden="true"></div>` +
          `<img class="mat-icon-d-preview__img" data-icon-d-img data-src="${escapeHtml(previewSrc)}" src="${escapeHtml(previewSrc)}" alt="${escapeHtml(item.title)}" decoding="async">` +
          `<div class="mat-icon-d-preview__error" data-icon-d-error hidden aria-hidden="true"></div>` +
        `</div>` +
        `<div class="mat-icon-d-preview__toolbar">` +
          `<button type="button" class="mat-icon-d-preview__expand" data-icon-d-expand aria-label="プレビューを拡大">プレビュー</button>` +
          `<button type="button" class="mat-icon-d-res is-active" disabled>${originalBtnLabel}</button>` +
          `<button type="button" class="mat-icon-d-res" disabled>PNG (512px)</button>` +
          `<button type="button" class="mat-icon-d-res" disabled>PNG (1024px)</button>` +
          `<button type="button" class="mat-icon-d-res" disabled>ICO (256px)</button>` +
          `<button type="button" class="mat-icon-d-res mat-icon-d-res--bulk" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}"><span data-mat-download-label>ダウンロード</span></button>` +
        `</div>`
      : `<div class="mat-icon-d-preview__empty">アイコンプレビューURLがありません</div>`;

    return (
      `<div class="mat-icon-d" data-icon-detail data-item-id="${escapeHtml(item.id)}">` +
        `<div class="mat-icon-d-back-mobile"><a href="${hrefList}"><span aria-hidden="true">‹</span> ${DISPLAY_NAME}一覧に戻る</a></div>` +
        `<nav class="mat-icon-d-crumb" aria-label="パンくず">` +
          `<a href="/materials/">ホーム</a><span aria-hidden="true">›</span>` +
          `<a href="/materials/index.html">素材を探す</a><span aria-hidden="true">›</span>` +
          `<a href="${hrefList}">${DISPLAY_NAME}一覧</a><span aria-hidden="true">›</span>` +
          `<span aria-current="page">${escapeHtml(item.title)}</span>` +
        `</nav>` +
        `<div class="mat-icon-d-layout">` +
          `<div class="mat-icon-d-main">` +
            `<div class="mat-icon-d-head">` +
              `<div class="mat-icon-d-head__badges">` +
                `<span class="mat-icon-d-badge">${DISPLAY_NAME}</span>` +
                (item.is_free !== false ? `<span class="mat-icon-d-free">無料</span>` : "") +
              `</div>` +
              `<h1 class="mat-icon-d-title">${escapeHtml(item.title)}</h1>` +
              `<p class="mat-icon-d-lead">${escapeHtml(item.description || "")}</p>` +
              `<div class="mat-icon-d-tags">${tags.map((t) => `<span class="mat-icon-d-tag">${escapeHtml(t)}</span>`).join("")}</div>` +
              `<div class="mat-icon-d-stats">` +
                `<span class="mat-icon-d-stats__rating"><span class="mat-icon-d-star" aria-hidden="true">★</span><b>${rating}</b>${ratingCount ? `<span class="mat-icon-d-stats__count">(${formatCount(ratingCount)})</span>` : ""}</span>` +
                `<span class="mat-icon-d-stats__dl"><span aria-hidden="true">↓</span><b>${formatCount(item.download_count)}</b><span>ダウンロード</span></span>` +
                `<button type="button" class="mat-icon-d-stats__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
                  `<span class="mat-icon-d-heart" aria-hidden="true"></span>` +
                  `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
                `</button>` +
              `</div>` +
            `</div>` +
            `<section class="mat-icon-d-preview" data-icon-d-preview aria-label="アイコンプレビュー">${previewBody}</section>` +
            `<div class="mat-icon-d-mobile-fav-wrap">` +
              `<button type="button" class="mat-icon-d-mobile-fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
                `<span class="mat-icon-d-heart" aria-hidden="true"></span>` +
                `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
              `</button>` +
            `</div>` +
            `<div class="mat-icon-d-tabs" data-icon-d-tabs>` +
              `<div class="mat-icon-d-tabs__nav" role="tablist" aria-label="詳細タブ">` +
                `<button type="button" class="mat-icon-d-tabs__tab is-active" role="tab" aria-selected="true" data-icon-d-tab="desc">説明</button>` +
                `<button type="button" class="mat-icon-d-tabs__tab" role="tab" aria-selected="false" data-icon-d-tab="usage">利用シーン</button>` +
                `<button type="button" class="mat-icon-d-tabs__tab" role="tab" aria-selected="false" data-icon-d-tab="related">関連素材</button>` +
                `<button type="button" class="mat-icon-d-tabs__tab" role="tab" aria-selected="false" data-icon-d-tab="comments">コメント</button>` +
              `</div>` +
              `<div class="mat-icon-d-tabs__panel is-active" data-icon-d-panel="desc">` +
                `<div class="mat-icon-d-desc-grid">` +
                  `<div>` +
                    `<p class="mat-icon-d-desc">${escapeHtml(desc)}</p>` +
                    (usageLines.length ? `<ul class="mat-icon-d-bullets">${usageLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "") +
                  `</div>` +
                  (previewSrc ? `<div class="mat-icon-d-desc-thumb" aria-hidden="true"><img src="${escapeHtml(previewSrc)}" alt="" loading="lazy" decoding="async"></div>` : "") +
                `</div>` +
              `</div>` +
              `<div class="mat-icon-d-tabs__panel" data-icon-d-panel="usage" hidden>` +
                (usageLines.length
                  ? `<ul class="mat-icon-d-bullets">${usageLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
                  : `<p class="mat-icon-d-empty-note">利用シーンの詳細は準備中です。</p>`) +
              `</div>` +
              `<div class="mat-icon-d-tabs__panel" data-icon-d-panel="related" hidden><p class="mat-icon-d-empty-note">下記の関連${DISPLAY_NAME}セクションをご覧ください。</p></div>` +
              `<div class="mat-icon-d-tabs__panel" data-icon-d-panel="comments" hidden><p class="mat-icon-d-empty-note">コメントは準備中です。</p></div>` +
            `</div>` +
            `<section class="mat-icon-d-related" aria-labelledby="matIconRelatedTitle">` +
              `<div class="mat-icon-d-related__head">` +
                `<h2 id="matIconRelatedTitle"><span class="mat-icon-d-related__ico" aria-hidden="true">↓</span>この素材を使用している人はこちらの素材も使っています</h2>` +
                `<a href="${hrefList}">すべて見る ›</a>` +
              `</div>` +
              (relatedIcon.length
                ? `<div class="mat-icon-d-related__grid">${relatedIcon.slice(0, RELATED_DISPLAY_LIMIT).map(renderRelatedCard).join("")}</div>`
                : `<p class="mat-icon-d-empty-note">関連する${DISPLAY_NAME}はまだありません。</p>`) +
            `</section>` +
          `</div>` +
          `<aside class="mat-icon-d-aside" aria-label="${DISPLAY_NAME}サイドバー">` +
            `<div class="mat-icon-d-side-card">` +
              `<h3 class="mat-icon-d-side-card__title"><span class="mat-icon-d-side-card__accent" aria-hidden="true">↓</span>ダウンロード</h3>` +
              `<p class="mat-detail-dl-hint" data-mat-dl-hint></p>` +
              `<div class="mat-icon-d-fields">` +
                `<label class="mat-icon-d-field"><span>ファイル形式 <span class="mat-icon-d-field__rec">推奨</span></span>` +
                `<select data-icon-d-format aria-label="ファイル形式">${formatOptions}</select></label>` +
                `<label class="mat-icon-d-field"><span>サイズ</span>` +
                `<select ${size ? "" : "disabled "}aria-label="サイズ">${sizeSelect}</select></label>` +
              `</div>` +
              `<button type="button" class="mat-icon-d-dl-cta" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}"><span data-mat-download-label>${escapeHtml(dlLabel)}</span></button>` +
              `<p class="mat-icon-d-dl-note">※ クレジット表記不要で、商用利用が可能です</p>` +
            `</div>` +
            `<div class="mat-icon-d-side-card">` +
              `<h3 class="mat-icon-d-side-card__title"><span class="mat-icon-d-side-card__accent" aria-hidden="true">ℹ</span>素材情報</h3>` +
              `<dl class="mat-icon-d-info">${infoRows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}</dl>` +
            `</div>` +
            `<div class="mat-icon-d-side-card">` +
              `<h3 class="mat-icon-d-side-card__title"><span class="mat-icon-d-side-card__accent" aria-hidden="true">⛨</span>ライセンス</h3>` +
              `<p class="mat-icon-d-license__lead">${escapeHtml(licenseLead)}</p>` +
              `<p class="mat-icon-d-license__sub">再配布・販売は禁止されています</p>` +
              `<a class="mat-icon-d-license__link" href="/company/legal/materials.html">ライセンス詳細を見る ›</a>` +
            `</div>` +
            `<div class="mat-icon-d-side-card">` +
              `<h3 class="mat-icon-d-side-card__title"><span class="mat-icon-d-side-card__accent" aria-hidden="true">#</span>タグ</h3>` +
              `<div class="mat-icon-d-side-tags">${tags.map((t) => `<a class="mat-icon-d-side-tag" href="/materials/list.html?category=icon&q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`).join("")}</div>` +
              (tags.length ? `<a class="mat-icon-d-side-more" href="${hrefList}">すべてのタグを見る (${tags.length}) ›</a>` : "") +
            `</div>` +
          `</aside>` +
        `</div>` +
        `<div class="mat-icon-d-lightbox" data-icon-d-lightbox hidden>` +
          `<button type="button" class="mat-icon-d-lightbox__close" data-icon-d-lightbox-close aria-label="閉じる">×</button>` +
          `<img data-icon-d-lightbox-img alt="">` +
        `</div>` +
        `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
  }

  function wireTabs(root) {
    const tabs = root.querySelectorAll("[data-icon-d-tab]");
    const panels = root.querySelectorAll("[data-icon-d-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-icon-d-tab");
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach((p) => {
          const on = p.getAttribute("data-icon-d-panel") === id;
          p.classList.toggle("is-active", on);
          p.hidden = !on;
        });
      });
    });
  }

  function setPreviewState(frame, state) {
    if (!frame) return;
    frame.setAttribute("data-mat-preview-state", state);
    const skeleton = frame.querySelector("[data-icon-d-skeleton]");
    const errorEl = frame.querySelector("[data-icon-d-error]");
    if (skeleton) {
      skeleton.hidden = state !== "loading";
      skeleton.setAttribute("aria-hidden", state !== "loading" ? "true" : "false");
    }
    if (errorEl) {
      if (state === "error") {
        errorEl.hidden = false;
        errorEl.setAttribute("aria-hidden", "false");
        errorEl.innerHTML = "<p>アイコンプレビューを読み込めませんでした</p>" + '<button type="button" data-icon-d-reload>再読み込み</button>';
        errorEl.querySelector("[data-icon-d-reload]")?.addEventListener(
          "click",
          () => {
            const img = frame.querySelector("[data-icon-d-img]");
            if (!img) return;
            const src = img.getAttribute("data-src") || img.src;
            setPreviewState(frame, "loading");
            img.addEventListener("load", () => setPreviewState(frame, "ready"), { once: true });
            img.addEventListener("error", () => setPreviewState(frame, "error"), { once: true });
            img.src = "";
            img.src = src + (src.includes("?") ? "&" : "?") + "_r=" + Date.now();
          },
          { once: true }
        );
      } else {
        errorEl.hidden = true;
        errorEl.setAttribute("aria-hidden", "true");
        errorEl.innerHTML = "";
      }
    }
  }

  function wirePreview(root) {
    const frame = root.querySelector("[data-icon-d-frame]");
    const img = root.querySelector("[data-icon-d-img]");
    if (!frame || !img) return;

    const markLoaded = () => setPreviewState(frame, "ready");
    const markError = () => setPreviewState(frame, "error");

    if (img.complete && img.naturalWidth > 0) markLoaded();
    else {
      setPreviewState(frame, "loading");
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markError, { once: true });
    }

    const lightbox = root.querySelector("[data-icon-d-lightbox]");
    const lightboxImg = root.querySelector("[data-icon-d-lightbox-img]");
    const open = () => {
      if (!lightbox || !lightboxImg) return;
      lightboxImg.src = img.currentSrc || img.src;
      lightboxImg.alt = img.alt || "";
      lightbox.hidden = false;
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      if (!lightbox) return;
      lightbox.hidden = true;
      document.body.style.overflow = "";
    };
    root.querySelector("[data-icon-d-expand]")?.addEventListener("click", open);
    img.addEventListener("click", open);
    root.querySelector("[data-icon-d-lightbox-close]")?.addEventListener("click", close);
    lightbox?.addEventListener("click", (e) => {
      if (e.target === lightbox) close();
    });
  }

  async function mount(root, item, related) {
    if (!root || !item || item.category_id !== "icon") return false;
    root.innerHTML = renderShell(item, related || []);
    document.title = `${item.title} | TASFUL Materials`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", item.description || "");

    wireTabs(root);
    wirePreview(root);

    global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(root, item);

    const byId = new Map((related || []).map((r) => [r.id, r]));
    root.querySelectorAll("[data-icon-d-related]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const rel = byId.get(id);
      if (rel) global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(card, rel);
    });

    return true;
  }

  function destroy() {
    document.body.style.overflow = "";
  }

  global.TasuMaterialsIconDetail = {
    mount,
    destroy,
    isIconItem(item) {
      return !!(item && item.category_id === "icon");
    },
    resolvePreviewSrc,
  };
})(typeof window !== "undefined" ? window : globalThis);
