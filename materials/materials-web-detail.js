/**
 * TASFUL Materials — Web素材 詳細 Option 4 UI（category=web のみ）
 * 公開表示名「Web素材」。操作=青。
 * Preview 画像が無い場合は既存 thumbnail_style プレースホルダのみ（生成 pipeline 禁止）。
 * Download / Favorite / Related Contract は既存接続。schema 追加なし。
 */
(function (global) {
  "use strict";

  const DISPLAY_NAME = "Web素材";
  /** BGM related と同様: Desktop 4列1段で完結（「すべて見る」で残りへ） */
  const RELATED_DISPLAY_LIMIT = 4;
  const GENERIC_TAGS = new Set([
    "web",
    "web-material",
    "web素材",
    "ja",
  ]);

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

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(String(url || ""));
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
    const candidates = [
      fromPreview,
      item.thumbnail_url,
      item.preview_image,
      item.preview_url,
      item.image_url,
      item.image,
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const u = pickStr(candidates[i]);
      if (u && isImageUrl(u)) return u;
    }
    return "";
  }

  function thumbStyleClass(item) {
    const style = pickStr(item.thumbnail_style, "web-hamburger");
    return `materials-card__thumb--${style}`;
  }

  function formatLabel(item) {
    if (item.download_kind === "zip" || /\.zip(\?|#|$)/i.test(String(item.download_url || ""))) {
      const parts = (item.file_formats || []).map((f) => String(f).toUpperCase());
      if (parts.length) return `ZIP（${parts.join(" / ")}）`;
      return "ZIP";
    }
    const formats = item.file_formats || [];
    if (formats.length) return formats.map((f) => String(f).toUpperCase()).join(" / ");
    return pickStr(item.meta_format, "—");
  }

  function detailHref(item) {
    return `detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
  }

  function listHref() {
    return "/materials/list.html?category=web";
  }

  function usageLinesFromItem(item) {
    const fromRecommended = (item.recommended_for || item.usage_tags || [])
      .map((x) => String(x).trim())
      .filter(Boolean);
    if (fromRecommended.length) return fromRecommended.slice(0, 5);
    const joined = pickStr(item.meta_recommended_usage);
    if (joined && joined !== "—") {
      return joined
        .split(/[·•|/]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
    }
    return [];
  }

  function buildInfoRows(item) {
    const fileSize = pickStr(item.file_size, item.meta_file_size);
    const fileCount = pickStr(item.meta_pages, item.meta_points);
    const compat = pickStr(item.meta_compatibility, item.meta_browser_support);
    const published = pickStr(item.meta_published, item.meta_updated);
    const responsive =
      /responsive|レスポンシブ/i.test(compat) || /responsive|レスポンシブ/i.test(String(item.meta_responsive || ""))
        ? pickStr(item.meta_responsive, "対応（meta）")
        : "";

    const rows = [
      ["ファイル形式", formatLabel(item)],
      ["ファイルサイズ", fileSize || ""],
      ["ファイル数", fileCount && fileCount !== "—" ? fileCount : ""],
      ["対応ブラウザ", compat && compat !== "—" ? compat : ""],
      ["レスポンシブ", responsive || ""],
      ["カテゴリ", DISPLAY_NAME],
      ["公開日", published || ""],
      ["素材ID", pickStr(item.slug, item.id)],
    ];
    return rows.filter(([, v]) => String(v || "").trim());
  }

  function relatedThumb(item) {
    return resolvePreviewSrc(item);
  }

  function renderRelatedCard(item) {
    const href = detailHref(item);
    const thumb = relatedThumb(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const tags = itemTags(item);
    const format = formatLabel(item);
    const subBits = [tags[0] || "", format && format !== "—" ? format : ""].filter(Boolean);
    const sub = subBits.join(" · ");
    return (
      `<article class="mat-web-d-related-card" data-web-d-related data-item-id="${escapeHtml(item.id)}">` +
      `<a class="mat-web-d-related-card__media" href="${href}" aria-label="${escapeHtml(item.title)}">` +
      (thumb
        ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
        : `<span class="mat-web-d-related-card__fallback ${escapeHtml(thumbStyleClass(item))}" aria-hidden="true">` +
          `<span class="mat-web-d-related-card__fallback-label">Web</span>` +
          `</span>`) +
      `</a>` +
      `<div class="mat-web-d-related-card__body">` +
      `<h3 class="mat-web-d-related-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      (sub ? `<p class="mat-web-d-related-card__sub">${escapeHtml(sub)}</p>` : "") +
      `<div class="mat-web-d-related-card__foot">` +
      `<span class="mat-web-d-related-card__meta"><span class="mat-web-d-star" aria-hidden="true">★</span>${rating}</span>` +
      `<span class="mat-web-d-related-card__meta"><span aria-hidden="true">↓</span>${dl}</span>` +
      `<button type="button" class="mat-web-d-related-card__dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
      `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
      `<span aria-hidden="true">↓</span>` +
      `</button>` +
      `</div>` +
      `</div>` +
      `</article>`
    );
  }

  function renderShell(item, related) {
    const Fav = global.TasuMaterialsFavorites;
    const Download = global.TasuMaterialsDownload;
    const tags = itemTags(item);
    const favOn = Fav?.isFavorited?.(item.id);
    const dlLabel =
      Download?.primaryButtonLabel?.(item) || item.button_label || "広告を見て無料ダウンロード";
    const previewSrc = resolvePreviewSrc(item);
    const codePreview = pickStr(item.code_preview);
    const rating = Number(item.rating || 0).toFixed(1);
    const ratingCount = Number(item.rating_count || 0);
    const hrefList = listHref();
    const usageLines = usageLinesFromItem(item);
    const desc = pickStr(item.long_description, item.description) || "Web素材です。";
    const relatedWeb = (related || []).filter((r) => r && r.category_id === "web" && r.id !== item.id);
    const infoRows = buildInfoRows(item);
    const licenseLead = pickStr(item.commercial_use, "商用利用OK・クレジット表記不要");
    const formatSelectLabel =
      item.download_kind === "zip" || /\.zip(\?|#|$)/i.test(String(item.download_url || ""))
        ? "ZIP（圧縮ファイル）"
        : formatLabel(item);

    const previewInner = previewSrc
      ? `<div class="mat-web-d-preview__frame" data-web-d-frame data-mat-preview-state="loading">` +
        `<div class="mat-web-d-preview__skeleton" data-web-d-skeleton aria-hidden="true"></div>` +
        `<img class="mat-web-d-preview__img" data-web-d-img data-src="${escapeHtml(previewSrc)}" src="${escapeHtml(previewSrc)}" alt="${escapeHtml(item.title)}" decoding="async">` +
        `<div class="mat-web-d-preview__error" data-web-d-error hidden aria-hidden="true"></div>` +
        `</div>`
      : `<div class="mat-web-d-preview__frame mat-web-d-preview__frame--placeholder" data-web-d-frame data-mat-preview-state="ready">` +
        `<div class="mat-web-d-preview__placeholder ${escapeHtml(thumbStyleClass(item))}" aria-hidden="true">` +
        `<span class="mat-web-d-preview__placeholder-label">Web Preview</span>` +
        `<span class="mat-web-d-preview__placeholder-note">プレビュー画像なし</span>` +
        `</div>` +
        `</div>`;

    const codeBlock = codePreview
      ? `<pre class="mat-web-d-code" data-web-d-code><code>${escapeHtml(codePreview)}</code></pre>` +
        `<button type="button" class="mat-web-d-copy" data-web-d-copy>区間をコピー</button>`
      : "";

    return (
      `<div class="mat-web-d" data-web-detail data-item-id="${escapeHtml(item.id)}">` +
      `<div class="mat-web-d-back-mobile">` +
      `<a href="${hrefList}"><span aria-hidden="true">‹</span> Web素材一覧に戻る</a>` +
      `</div>` +
      `<nav class="mat-web-d-crumb" aria-label="パンくず">` +
      `<a href="/materials/">ホーム</a><span aria-hidden="true">›</span>` +
      `<a href="/materials/index.html">素材を探す</a><span aria-hidden="true">›</span>` +
      `<a href="${hrefList}">Web素材一覧</a><span aria-hidden="true">›</span>` +
      `<span aria-current="page">${escapeHtml(item.title)}</span>` +
      `</nav>` +
      `<div class="mat-web-d-layout">` +
      `<div class="mat-web-d-main">` +
      `<div class="mat-web-d-head">` +
      `<div class="mat-web-d-head__badges">` +
      `<span class="mat-web-d-badge">${DISPLAY_NAME}</span>` +
      (item.is_free !== false ? `<span class="mat-web-d-free">無料</span>` : "") +
      `</div>` +
      `<h1 class="mat-web-d-title">${escapeHtml(item.title)}</h1>` +
      `<p class="mat-web-d-lead">${escapeHtml(item.description || "")}</p>` +
      `<div class="mat-web-d-tags">` +
      tags.map((t) => `<span class="mat-web-d-tag">${escapeHtml(t)}</span>`).join("") +
      `</div>` +
      `<div class="mat-web-d-stats">` +
      `<span class="mat-web-d-stats__rating"><span class="mat-web-d-star" aria-hidden="true">★</span>` +
      `<b>${rating}</b>${ratingCount ? `<span class="mat-web-d-stats__count">(${formatCount(ratingCount)})</span>` : ""}</span>` +
      `<span class="mat-web-d-stats__dl"><span aria-hidden="true">↓</span><b>${formatCount(item.download_count)}</b>` +
      `<span class="mat-web-d-stats__dl-label">ダウンロード</span></span>` +
      `<button type="button" class="mat-web-d-stats__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<span class="mat-web-d-heart" aria-hidden="true"></span>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</div>` +
      `</div>` +
      `<section class="mat-web-d-preview-card" aria-label="Webプレビュー">` +
      previewInner +
      `<div class="mat-web-d-preview__toolbar">` +
      `<button type="button" class="mat-web-d-preview__expand" data-web-d-expand ${previewSrc ? "" : "disabled title=\"\""} aria-label="プレビューを拡大">⤢</button>` +
      `<button type="button" class="mat-web-d-device is-active" data-web-d-preview-btn ${previewSrc ? "" : "disabled"}>プレビュー</button>` +
      `<button type="button" class="mat-web-d-device" disabled>デスクトップ版</button>` +
      `<button type="button" class="mat-web-d-device" disabled>タブレット版</button>` +
      `<button type="button" class="mat-web-d-device" disabled>スマホ版</button>` +
      (codePreview
        ? ""
        : `<button type="button" class="mat-web-d-device" disabled>区間をコピー</button>`) +
      `</div>` +
      codeBlock +
      `<div class="mat-web-d-tabs" data-web-d-tabs>` +
      `<div class="mat-web-d-tabs__nav" role="tablist" aria-label="詳細タブ">` +
      `<button type="button" class="mat-web-d-tabs__tab is-active" role="tab" aria-selected="true" data-web-d-tab="desc">説明</button>` +
      `<button type="button" class="mat-web-d-tabs__tab" role="tab" aria-selected="false" data-web-d-tab="usage">利用シーン</button>` +
      `<button type="button" class="mat-web-d-tabs__tab" role="tab" aria-selected="false" data-web-d-tab="related">関連素材</button>` +
      `<button type="button" class="mat-web-d-tabs__tab" role="tab" aria-selected="false" data-web-d-tab="comments">コメント</button>` +
      `</div>` +
      `<div class="mat-web-d-tabs__panel is-active" data-web-d-panel="desc">` +
      `<div class="mat-web-d-desc-grid">` +
      `<div>` +
      `<p class="mat-web-d-desc">${escapeHtml(desc)}</p>` +
      (usageLines.length
        ? `<ul class="mat-web-d-bullets">` +
          usageLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("") +
          `</ul>`
        : "") +
      `</div>` +
      `<div class="mat-web-d-desc-thumb ${escapeHtml(thumbStyleClass(item))}" aria-hidden="true">` +
      (previewSrc
        ? `<img src="${escapeHtml(previewSrc)}" alt="" loading="lazy" decoding="async">`
        : `<span class="mat-web-d-desc-thumb__label">Web</span>`) +
      `</div>` +
      `</div>` +
      `</div>` +
      `<div class="mat-web-d-tabs__panel" data-web-d-panel="usage" hidden>` +
      (usageLines.length
        ? `<ul class="mat-web-d-bullets">` +
          usageLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("") +
          `</ul>`
        : `<p class="mat-web-d-empty-note">利用シーンの詳細は準備中です。</p>`) +
      `</div>` +
      `<div class="mat-web-d-tabs__panel" data-web-d-panel="related" hidden>` +
      `<p class="mat-web-d-empty-note">下記の関連Web素材セクションをご覧ください。</p>` +
      `</div>` +
      `<div class="mat-web-d-tabs__panel" data-web-d-panel="comments" hidden>` +
      `<p class="mat-web-d-empty-note">コメントは準備中です。</p>` +
      `</div>` +
      `</div>` +
      `</section>` +
      `</div>` +
      `<aside class="mat-web-d-aside" aria-label="Web素材サイドバー">` +
      `<div class="mat-web-d-side-card">` +
      `<h3 class="mat-web-d-side-card__title"><span class="mat-web-d-side-card__accent" aria-hidden="true">↓</span>ダウンロード</h3>` +
      `<p class="mat-detail-dl-hint" data-mat-dl-hint></p>` +
      `<div class="mat-web-d-fields">` +
      `<label class="mat-web-d-field"><span>ファイル形式 <span class="mat-web-d-field__rec">推奨</span></span>` +
      `<select aria-label="ファイル形式"><option selected>${escapeHtml(formatSelectLabel)}</option></select></label>` +
      `<label class="mat-web-d-field"><span>ライセンス</span>` +
      `<select disabled aria-label="ライセンス"><option>標準ライセンス</option></select></label>` +
      `</div>` +
      `<button type="button" class="mat-web-d-dl-cta" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      `<span data-mat-download-label>${escapeHtml(dlLabel)}</span>` +
      `</button>` +
      `<p class="mat-web-d-dl-note">※ クレジット表記不要で、商用利用が可能です</p>` +
      `</div>` +
      `<div class="mat-web-d-side-card">` +
      `<h3 class="mat-web-d-side-card__title"><span class="mat-web-d-side-card__accent" aria-hidden="true">☰</span>素材情報</h3>` +
      `<dl class="mat-web-d-info">` +
      infoRows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("") +
      `</dl>` +
      `</div>` +
      `<div class="mat-web-d-side-card">` +
      `<h3 class="mat-web-d-side-card__title"><span class="mat-web-d-side-card__accent" aria-hidden="true">⛨</span>ライセンス</h3>` +
      `<p class="mat-web-d-license__lead">${escapeHtml(licenseLead)}</p>` +
      `<p class="mat-web-d-license__sub">再配布・販売は禁止されています</p>` +
      `<a class="mat-web-d-license__link" href="/company/legal/materials.html">ライセンス詳細を見る ›</a>` +
      `</div>` +
      `<div class="mat-web-d-side-card">` +
      `<h3 class="mat-web-d-side-card__title"><span class="mat-web-d-side-card__accent" aria-hidden="true">#</span>タグ</h3>` +
      `<div class="mat-web-d-side-tags">` +
      tags
        .map(
          (t) =>
            `<a class="mat-web-d-side-tag" href="/materials/list.html?category=web&q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`
        )
        .join("") +
      `</div>` +
      (tags.length
        ? `<a class="mat-web-d-side-more" href="${hrefList}">すべてのタグを見る (${tags.length}) ›</a>`
        : "") +
      `</div>` +
      `</aside>` +
      /* Desktop右レール: 戻る + accordion + お気に入りのみ。
         中央カラム Download / 素材情報と重複する rail-card は Desktop 構造から除外。
         Mobile では .mat-web-d-rail 全体が非表示で、Download は中央 aside を使用。 */
      `<aside class="mat-web-d-rail" aria-label="Web素材ナビ">` +
      `<a class="mat-web-d-rail__back" href="${hrefList}"><span aria-hidden="true">‹</span> Web素材一覧に戻る</a>` +
      `<div class="mat-web-d-accordion" data-web-d-accordion>` +
      [
        ["info", "素材情報"],
        ["desc", "説明"],
        ["usage", "利用シーン"],
        ["related", "関連素材"],
        ["tags", "タグ"],
        ["comments", "コメント"],
      ]
        .map(
          ([id, label]) =>
            `<button type="button" class="mat-web-d-accordion__btn" data-web-d-acc="${id}">` +
            `<span>${label}</span><span aria-hidden="true">▾</span></button>` +
            `<div class="mat-web-d-accordion__panel" data-web-d-acc-panel="${id}" hidden></div>`
        )
        .join("") +
      `</div>` +
      `<button type="button" class="mat-web-d-rail-fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<span class="mat-web-d-heart" aria-hidden="true"></span>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</aside>` +
      `</div>` +
      `<section class="mat-web-d-related" aria-labelledby="matWebRelatedTitle">` +
      `<div class="mat-web-d-related__head">` +
      `<h2 id="matWebRelatedTitle"><span class="mat-web-d-related__ico" aria-hidden="true">〰</span>この素材を使用している人はこちらの素材も使っています</h2>` +
      `<a href="${hrefList}">すべて見る ›</a>` +
      `</div>` +
      (relatedWeb.length
        ? `<div class="mat-web-d-related__grid">${relatedWeb.slice(0, RELATED_DISPLAY_LIMIT).map(renderRelatedCard).join("")}</div>`
        : `<p class="mat-web-d-empty-note">関連するWeb素材はまだありません。</p>`) +
      `</section>` +
      `<div class="mat-web-d-lightbox" data-web-d-lightbox hidden>` +
      `<button type="button" class="mat-web-d-lightbox__close" data-web-d-lightbox-close aria-label="閉じる">×</button>` +
      `<img data-web-d-lightbox-img alt="">` +
      `</div>` +
      `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
  }

  function wireTabs(root) {
    const tabs = root.querySelectorAll("[data-web-d-tab]");
    const panels = root.querySelectorAll("[data-web-d-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-web-d-tab");
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach((p) => {
          const on = p.getAttribute("data-web-d-panel") === id;
          p.classList.toggle("is-active", on);
          p.hidden = !on;
        });
      });
    });
  }

  function setPreviewState(frame, state) {
    if (!frame) return;
    frame.setAttribute("data-mat-preview-state", state);
    const skeleton = frame.querySelector("[data-web-d-skeleton]");
    const errorEl = frame.querySelector("[data-web-d-error]");
    if (skeleton) {
      skeleton.hidden = state !== "loading";
      skeleton.setAttribute("aria-hidden", state !== "loading" ? "true" : "false");
    }
    if (errorEl) {
      if (state === "error") {
        errorEl.hidden = false;
        errorEl.setAttribute("aria-hidden", "false");
        errorEl.innerHTML =
          "<p>Webプレビューを読み込めませんでした</p>" +
          '<button type="button" data-web-d-reload>再読み込み</button>';
        errorEl.querySelector("[data-web-d-reload]")?.addEventListener(
          "click",
          () => {
            const img = frame.querySelector("[data-web-d-img]");
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
    const frame = root.querySelector("[data-web-d-frame]");
    const img = root.querySelector("[data-web-d-img]");
    if (frame && img) {
      const markLoaded = () => setPreviewState(frame, "ready");
      const markError = () => setPreviewState(frame, "error");
      if (img.complete && img.naturalWidth > 0) markLoaded();
      else {
        setPreviewState(frame, "loading");
        img.addEventListener("load", markLoaded, { once: true });
        img.addEventListener("error", markError, { once: true });
      }

      const lightbox = root.querySelector("[data-web-d-lightbox]");
      const lightboxImg = root.querySelector("[data-web-d-lightbox-img]");
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
      root.querySelector("[data-web-d-expand]")?.addEventListener("click", open);
      img.addEventListener("click", open);
      root.querySelector("[data-web-d-lightbox-close]")?.addEventListener("click", close);
      lightbox?.addEventListener("click", (e) => {
        if (e.target === lightbox) close();
      });
    }

    root.querySelector("[data-web-d-copy]")?.addEventListener("click", async () => {
      const code = root.querySelector("[data-web-d-code] code")?.textContent || "";
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        const toast = root.querySelector("[data-mat-toast]");
        if (toast) {
          toast.hidden = false;
          toast.textContent = "コードをコピーしました";
          setTimeout(() => {
            toast.hidden = true;
          }, 1600);
        }
      } catch {
        /* ignore */
      }
    });
  }

  function wireAccordion(root, item, relatedWeb) {
    const info =
      `<dl class="mat-web-d-info">` +
      buildInfoRows(item)
        .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`)
        .join("") +
      `</dl>`;
    const desc = pickStr(item.long_description, item.description) || "";
    const usage = usageLinesFromItem(item);
    const tags = itemTags(item);
    const panels = {
      info,
      desc: `<p class="mat-web-d-desc">${escapeHtml(desc)}</p>`,
      usage: usage.length
        ? `<ul class="mat-web-d-bullets">${usage.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
        : `<p class="mat-web-d-empty-note"></p>`,
      related: relatedWeb.length
        ? `<p class="mat-web-d-empty-note">${relatedWeb.length}件の関連素材があります（メイン列を参照）</p>`
        : `<p class="mat-web-d-empty-note">関連Web素材はまだありません。</p>`,
      tags: tags.length
        ? `<div class="mat-web-d-side-tags">${tags.map((t) => `<span class="mat-web-d-side-tag">${escapeHtml(t)}</span>`).join("")}</div>`
        : `<p class="mat-web-d-empty-note"></p>`,
      comments: `<p class="mat-web-d-empty-note"></p>`,
    };

    root.querySelectorAll("[data-web-d-acc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-web-d-acc");
        const panel = root.querySelector(`[data-web-d-acc-panel="${id}"]`);
        if (!panel) return;
        const open = panel.hidden;
        root.querySelectorAll("[data-web-d-acc-panel]").forEach((p) => {
          p.hidden = true;
        });
        if (open) {
          panel.innerHTML = panels[id] || "";
          panel.hidden = false;
        }
      });
    });
  }

  async function mount(root, item, related) {
    if (!root || !item || item.category_id !== "web") return false;
    const relatedList = related || [];
    const relatedWeb = relatedList.filter((r) => r && r.category_id === "web" && r.id !== item.id);
    root.innerHTML = renderShell(item, relatedList);
    document.title = `${item.title} | TASFUL Materials`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", item.description || "");

    wireTabs(root);
    wirePreview(root);
    wireAccordion(root, item, relatedWeb);

    global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(root, item);

    const byId = new Map(relatedList.map((r) => [r.id, r]));
    root.querySelectorAll("[data-web-d-related]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const rel = byId.get(id);
      if (rel) global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(card, rel);
    });

    return true;
  }

  function destroy() {
    document.body.style.overflow = "";
  }

  global.TasuMaterialsWebDetail = {
    mount,
    destroy,
    isWebItem(item) {
      return !!(item && item.category_id === "web");
    },
    resolvePreviewSrc,
  };
})(typeof window !== "undefined" ? window : globalThis);
