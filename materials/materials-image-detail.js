/**
 * TASFUL Materials — 画像素材 詳細（Screenshot-to-Code 正本の完全移植）
 * category=image のみ。canonical: reports/materials-stc-audit/canonical/image-detail.html (main)
 * 公開表示名「画像」。操作=青 / カテゴリ識別=緑。音声UIは使用しない。
 * Download / Favorite / Related / Image URL Contract は既存のまま接続。
 */
(function (global) {
  "use strict";

  const GENERIC_TAGS = new Set(["image", "png", "jpg", "jpeg", "webp", "画像", "画像素材"]);

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
    const num = Number(n) || 0;
    return num.toLocaleString("ja-JP");
  }

  function itemTags(item) {
    return (item.tags || [])
      .map((t) => String(t).trim())
      .filter((t) => t && !GENERIC_TAGS.has(t.toLowerCase()) && !GENERIC_TAGS.has(t));
  }

  function resolvePreviewSrc(item) {
    const images = Array.isArray(item.preview_images) ? item.preview_images : [];
    const first = images[0];
    const fromPreview = pickStr(
      first && (first.src || first.url || first),
      typeof first === "string" ? first : ""
    );
    return pickStr(
      fromPreview,
      item.thumbnail_url,
      item.preview_image,
      item.preview_url,
      item.image_url,
      item.image,
      item.download_url
    );
  }

  function sizeLabel(item) {
    return pickStr(
      item.meta_resolution,
      item.meta_size,
      item.width && item.height ? `${item.width}×${item.height}` : "",
      item.image_width && item.image_height ? `${item.image_width}×${item.image_height}` : ""
    );
  }

  function formatLabel(item) {
    const formats = item.file_formats || [];
    if (formats.length) return formats.map((f) => String(f).toUpperCase()).join(" / ");
    return pickStr(item.meta_format, "—");
  }

  const RELATED_DISPLAY_LIMIT = 4;

  function renderRelatedCardsHtml(items) {
    const ImageList = global.TasuMaterialsImageList;
    if (!ImageList?.renderCard) return "";
    return items
      .slice(0, RELATED_DISPLAY_LIMIT)
      .map((item) => ImageList.renderCard(item))
      .join("");
  }

  function buildInfoRows(item) {
    const size = sizeLabel(item);
    const author = pickStr(item.meta_author, item.author, item.source);
    const authorOk = author && !/^[-—–]$/.test(author);
    const rows = [
      ["ファイル形式", formatLabel(item)],
      ["サイズ", size],
      ["ファイルサイズ", pickStr(item.file_size)],
      ["解像度", pickStr(item.meta_dpi, item.dpi)],
      ["カラーモード", pickStr(item.meta_color_mode, item.color_mode)],
      ["撮影方向", pickStr(item.meta_orientation, item.orientation)],
      ["公開日", pickStr(item.meta_published, item.meta_updated)],
      ["素材ID", pickStr(item.slug, item.id)],
    ];
    if (authorOk) {
      rows.splice(6, 0, ["作者 / 出典", author]);
    }
    return rows.filter(([, v]) => !!v);
  }

  function renderShell(item, related) {
    const Fav = global.TasuMaterialsFavorites;
    const Download = global.TasuMaterialsDownload;
    const tags = itemTags(item);
    const favOn = Fav?.isFavorited?.(item.id);
    const dlLabel =
      Download?.primaryButtonLabel?.(item) || item.button_label || "広告を見て無料ダウンロード";
    const formats = (item.file_formats || []).length
      ? item.file_formats
      : String(item.meta_format || "PNG")
          .split(/[/·,]/)
          .map((s) => s.trim())
          .filter(Boolean);
    const previewSrc = resolvePreviewSrc(item);
    const size = sizeLabel(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const ratingCount = Number(item.rating_count || 0);
    const listHref = "/materials/list.html?category=image";
    const usageLines = (item.recommended_for || item.usage_tags || [])
      .map((x) => String(x).trim())
      .filter((x) => x && !GENERIC_TAGS.has(x.toLowerCase()) && !GENERIC_TAGS.has(x))
      .slice(0, 4);
    const desc = pickStr(item.long_description, item.description) || "画像素材です。";
    const relatedImg = (related || []).filter((r) => r && r.category_id === "image" && r.id !== item.id);
    const relatedFallback = (relatedImg.length
      ? relatedImg
      : (related || []).filter((r) => r && r.id !== item.id)
    ).slice(0, RELATED_DISPLAY_LIMIT);

    const formatOptions = formats
      .map((f, i) => {
        const upper = String(f).toUpperCase();
        const label = upper === "JPG" || upper === "JPEG" ? "JPG（高画質） 推奨" : `${upper} 推奨`;
        return `<option value="${escapeHtml(upper)}"${i === 0 ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("");

    const infoRows = buildInfoRows(item);

    const sizeSelect = size
      ? `<option selected>オリジナル (${escapeHtml(size)})</option>`
      : `<option selected>オリジナル</option>`;

    const resButtons = size
      ? `<button type="button" class="mat-img-d-res is-active" disabled>オリジナル (${escapeHtml(size)})</button>` +
        `<button type="button" class="mat-img-d-res" disabled>その他サイズ</button>`
      : `<button type="button" class="mat-img-d-res is-active" disabled>オリジナル</button>`;

    return (
      `<div class="mat-img-d" data-img-detail data-item-id="${escapeHtml(item.id)}">` +
      `<div class="mat-img-d-back-mobile">` +
      `<a href="${listHref}"><span aria-hidden="true">‹</span> 画像一覧に戻る</a>` +
      `</div>` +
      `<nav class="mat-img-d-crumb" aria-label="パンくず">` +
      `<a href="/materials/">ホーム</a><span aria-hidden="true">›</span>` +
      `<a href="/materials/index.html">素材を探す</a><span aria-hidden="true">›</span>` +
      `<a href="${listHref}">画像一覧</a><span aria-hidden="true">›</span>` +
      `<span aria-current="page">${escapeHtml(item.title)}</span>` +
      `</nav>` +
      `<div class="mat-img-d-layout">` +
      `<div class="mat-img-d-main">` +
      `<div class="mat-img-d-head">` +
      `<div class="mat-img-d-head__badges">` +
      `<span class="mat-img-d-badge">画像</span>` +
      (item.is_free !== false ? `<span class="mat-img-d-free">無料</span>` : "") +
      `</div>` +
      `<h1 class="mat-img-d-title">${escapeHtml(item.title)}</h1>` +
      `<p class="mat-img-d-lead">${escapeHtml(item.description || "")}</p>` +
      `<div class="mat-img-d-tags">` +
      tags.map((t) => `<span class="mat-img-d-tag">${escapeHtml(t)}</span>`).join("") +
      `</div>` +
      `<div class="mat-img-d-stats">` +
      `<span class="mat-img-d-stats__rating"><span class="mat-img-d-star" aria-hidden="true">★</span>` +
      `<b>${rating}</b>${ratingCount ? `<span class="mat-img-d-stats__count">(${formatCount(ratingCount)})</span>` : ""}</span>` +
      `<span class="mat-img-d-stats__dl"><span aria-hidden="true">↓</span><b>${formatCount(item.download_count)}</b>` +
      `<span class="mat-img-d-stats__dl-label">ダウンロード</span></span>` +
      `<button type="button" class="mat-img-d-stats__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<span class="mat-img-d-heart" aria-hidden="true"></span>` +
      `<span class="mat-img-d-stats__fav-label" data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</div>` +
      `</div>` +
      `<section class="mat-img-d-preview" data-img-d-preview aria-label="画像プレビュー">` +
      (previewSrc
        ? `<div class="mat-img-d-preview__frame" data-img-d-frame data-mat-preview-state="loading">` +
          `<div class="mat-img-d-preview__skeleton" data-img-d-skeleton aria-hidden="true"></div>` +
          `<img class="mat-img-d-preview__img" data-img-d-img data-src="${escapeHtml(previewSrc)}" src="${escapeHtml(previewSrc)}" alt="${escapeHtml(item.title)}" decoding="async">` +
          `<button type="button" class="mat-img-d-preview__expand" data-img-d-expand aria-label="画像を拡大">⛶</button>` +
          (size
            ? `<span class="mat-img-d-preview__size-badge" aria-hidden="true">${escapeHtml(size)}</span>`
            : "") +
          `<div class="mat-img-d-preview__error" data-img-d-error hidden>` +
          `<p>画像を読み込めませんでした</p>` +
          `<button type="button" data-img-d-reload>再読み込み</button>` +
          `</div>` +
          `</div>`
        : `<div class="mat-img-d-preview__empty">画像プレビューを準備中です</div>`) +
      `</section>` +
      `<div class="mat-img-d-res-row">` +
      resButtons +
      `<button type="button" class="mat-img-d-res mat-img-d-res--copy" disabled>区間をコピー</button>` +
      `</div>` +
      `<div class="mat-img-d-tabs" data-img-d-tabs>` +
      `<div class="mat-img-d-tabs__nav" role="tablist" aria-label="詳細タブ">` +
      `<button type="button" class="mat-img-d-tabs__tab is-active" role="tab" aria-selected="true" data-img-d-tab="desc">説明</button>` +
      `<button type="button" class="mat-img-d-tabs__tab" role="tab" aria-selected="false" data-img-d-tab="usage">利用シーン</button>` +
      `<button type="button" class="mat-img-d-tabs__tab" role="tab" aria-selected="false" data-img-d-tab="related">関連素材</button>` +
      `<button type="button" class="mat-img-d-tabs__tab" role="tab" aria-selected="false" data-img-d-tab="comments">コメント</button>` +
      `</div>` +
      `<div class="mat-img-d-tabs__panel is-active" data-img-d-panel="desc">` +
      `<div class="mat-img-d-desc-grid">` +
      `<div>` +
      `<p class="mat-img-d-desc">${escapeHtml(desc)}</p>` +
      (usageLines.length
        ? `<ul class="mat-img-d-bullets">` +
          usageLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("") +
          `</ul>`
        : "") +
      `</div>` +
      (previewSrc
        ? `<div class="mat-img-d-desc-thumb" aria-hidden="true"><img src="${escapeHtml(previewSrc)}" alt="" loading="lazy" decoding="async"></div>`
        : "") +
      `</div>` +
      `</div>` +
      `<div class="mat-img-d-tabs__panel" data-img-d-panel="usage" hidden>` +
      (usageLines.length
        ? `<ul class="mat-img-d-bullets">` +
          usageLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("") +
          `</ul>`
        : `<p class="mat-img-d-empty-note">利用シーンデータはまだありません</p>`) +
      `</div>` +
      `<div class="mat-img-d-tabs__panel" data-img-d-panel="related" hidden>` +
      `<p class="mat-img-d-empty-note">下記の関連素材セクションをご覧ください。</p>` +
      `</div>` +
      `<div class="mat-img-d-tabs__panel" data-img-d-panel="comments" hidden>` +
      `<p class="mat-img-d-empty-note">コメント機能は準備中です</p>` +
      `</div>` +
      `</div>` +
      `<section class="mat-img-d-related" aria-labelledby="matImgRelatedTitle">` +
      `<div class="mat-img-d-related__head">` +
      `<h2 id="matImgRelatedTitle"><span class="mat-img-d-related__ico" aria-hidden="true">▦</span>この素材を使用している人はこんな素材も使っています</h2>` +
      `<a href="${listHref}">すべて見る ›</a>` +
      `</div>` +
      (relatedFallback.length
        ? `<div class="mat-img-d-related__grid">${renderRelatedCardsHtml(relatedFallback)}</div>`
        : `<p class="mat-img-d-empty-note">関連する画像素材はまだありません。</p>`) +
      `</section>` +
      `</div>` +
      `<aside class="mat-img-d-aside">` +
      `<div class="mat-img-d-side-card mat-img-d-side-card--dl">` +
      `<h3 class="mat-img-d-side-card__title"><span class="mat-img-d-side-card__accent" aria-hidden="true">↓</span>ダウンロード</h3>` +
      `<p class="mat-detail-dl-hint" data-mat-dl-hint></p>` +
      `<div class="mat-img-d-fields-row">` +
      `<label class="mat-img-d-field"><span>ファイル形式</span>` +
      `<select data-img-d-format aria-label="ファイル形式">${formatOptions || "<option>PNG</option>"}</select></label>` +
      `<label class="mat-img-d-field"><span>サイズ</span>` +
      `<select ${size ? "" : "disabled "}aria-label="サイズ">${sizeSelect}</select></label>` +
      `</div>` +
      `<button type="button" class="mat-img-d-dl-cta" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      `<span data-mat-download-label>${escapeHtml(dlLabel)}</span>` +
      `</button>` +
      `<p class="mat-img-d-dl-note">※ クレジット表記不要で、商用利用が可能です</p>` +
      `</div>` +
      `<div class="mat-img-d-side-card mat-img-d-side-card--desktop">` +
      `<h3 class="mat-img-d-side-card__title"><span class="mat-img-d-side-card__accent" aria-hidden="true">ℹ</span>素材情報</h3>` +
      `<dl class="mat-img-d-info">` +
      infoRows
        .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`)
        .join("") +
      `</dl>` +
      `</div>` +
      `<div class="mat-img-d-side-card mat-img-d-side-card--desktop">` +
      `<h3 class="mat-img-d-side-card__title"><span class="mat-img-d-side-card__accent" aria-hidden="true">⛨</span>ライセンス</h3>` +
      `<p class="mat-img-d-license__lead">${escapeHtml(item.commercial_use || "商用利用OK・クレジット表記不要")}</p>` +
      `<p class="mat-img-d-license__sub">再配布・販売は禁止されています</p>` +
      `<a class="mat-img-d-license__link" href="/company/legal/materials.html">ライセンス詳細を見る ›</a>` +
      `</div>` +
      `<div class="mat-img-d-side-card mat-img-d-side-card--desktop">` +
      `<h3 class="mat-img-d-side-card__title"><span class="mat-img-d-side-card__accent" aria-hidden="true">#</span>タグ</h3>` +
      `<div class="mat-img-d-side-tags">` +
      tags
        .map(
          (t) =>
            `<a class="mat-img-d-side-tag" href="/materials/list.html?category=image&q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`
        )
        .join("") +
      `</div>` +
      `</div>` +
      `</aside>` +
      `</div>` +
      `<button type="button" class="mat-img-d-mobile-fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<span class="mat-img-d-heart" aria-hidden="true"></span>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `<div class="mat-img-d-mobile-acc">` +
      `<details open><summary>素材情報</summary>` +
      `<dl class="mat-img-d-info">` +
      infoRows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("") +
      `</dl></details>` +
      `<details><summary>説明</summary><p class="mat-img-d-desc">${escapeHtml(desc)}</p></details>` +
      `<details><summary>利用シーン</summary>` +
      (usageLines.length
        ? `<ul class="mat-img-d-bullets">` + usageLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("") + `</ul>`
        : `<p class="mat-img-d-empty-note">利用シーンデータはまだありません</p>`) +
      `</details>` +
      `<details><summary>関連素材</summary><p class="mat-img-d-empty-note">上部の関連素材セクションをご覧ください。</p></details>` +
      `<details><summary>タグ</summary><div class="mat-img-d-side-tags">` +
      tags.map((t) => `<span class="mat-img-d-side-tag">${escapeHtml(t)}</span>`).join("") +
      `</div></details>` +
      `<details><summary>コメント</summary><p class="mat-img-d-empty-note">コメント機能は準備中です</p></details>` +
      `</div>` +
      `<div class="mat-img-d-lightbox" data-img-d-lightbox hidden>` +
      `<button type="button" class="mat-img-d-lightbox__close" data-img-d-lightbox-close aria-label="閉じる">×</button>` +
      `<img data-img-d-lightbox-img alt="">` +
      `</div>` +
      `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
  }

  function wireTabs(root) {
    const tabs = root.querySelectorAll("[data-img-d-tab]");
    const panels = root.querySelectorAll("[data-img-d-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-img-d-tab");
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach((p) => {
          const on = p.getAttribute("data-img-d-panel") === id;
          p.classList.toggle("is-active", on);
          p.hidden = !on;
        });
      });
    });
  }

  function setPreviewState(frame, state) {
    if (!frame) return;
    frame.setAttribute("data-mat-preview-state", state);
    const skeleton = frame.querySelector("[data-img-d-skeleton]");
    const errorEl = frame.querySelector("[data-img-d-error]");
    if (skeleton) skeleton.hidden = state !== "loading";
    if (errorEl) errorEl.hidden = state !== "error";
  }

  function wirePreview(root) {
    const frame = root.querySelector("[data-img-d-frame]");
    const img = root.querySelector("[data-img-d-img]");
    if (!frame || !img) return;

    const markLoaded = () => setPreviewState(frame, "ready");
    const markError = () => setPreviewState(frame, "error");

    if (img.complete && img.naturalWidth > 0) markLoaded();
    else {
      setPreviewState(frame, "loading");
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markError, { once: true });
    }

    root.querySelector("[data-img-d-reload]")?.addEventListener("click", () => {
      const src = img.getAttribute("data-src") || img.src;
      setPreviewState(frame, "loading");
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markError, { once: true });
      img.src = "";
      img.src = src + (src.includes("?") ? "&" : "?") + "_r=" + Date.now();
    });

    const lightbox = root.querySelector("[data-img-d-lightbox]");
    const lightboxImg = root.querySelector("[data-img-d-lightbox-img]");
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
    root.querySelector("[data-img-d-expand]")?.addEventListener("click", open);
    img.addEventListener("click", open);
    root.querySelector("[data-img-d-lightbox-close]")?.addEventListener("click", close);
    lightbox?.addEventListener("click", (e) => {
      if (e.target === lightbox) close();
    });
  }

  async function mount(root, item, related) {
    if (!root || !item || item.category_id !== "image") return false;
    root.innerHTML = renderShell(item, related || []);
    document.title = `${item.title} | TASFUL Materials`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", item.description || "");

    wireTabs(root);
    wirePreview(root);

    global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(root, item);

    const byId = new Map((related || []).map((r) => [r.id, r]));
    const relatedSection = root.querySelector(".mat-img-d-related");
    relatedSection?.querySelectorAll("[data-img-card]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const rel = byId.get(id);
      if (rel) global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(card, rel);
    });

    return true;
  }

  function destroy() {
    document.body.style.overflow = "";
  }

  global.TasuMaterialsImageDetail = {
    mount,
    destroy,
    isImageItem(item) {
      return !!(item && item.category_id === "image");
    },
    resolvePreviewSrc,
  };
})(typeof window !== "undefined" ? window : globalThis);
