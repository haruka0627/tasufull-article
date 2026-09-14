/**
 * TASFUL Materials — 背景素材詳細 STC Full Retransplant
 * Source: reports/materials-stc-audit/canonical/background-detail.html
 * 公開表示名「背景素材」。操作=青。プレビューは自然アスペクト（h-auto・非crop）。
 * Download / Favorite / Related / Preview URL Contract は既存接続。schema 追加なし。
 */
(function (global) {
  "use strict";

  const DISPLAY_NAME = "背景素材";
  const GENERIC_TAGS = new Set(["background", "背景", "背景素材", "png", "jpg", "jpeg", "webp", "svg"]);

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

  function isQaFixtureMode() {
    return new URLSearchParams(global.location.search).get("qa_fixture") === "1";
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
    return pickStr(fromPreview, item.thumbnail_url, item.preview_image, item.preview_url, item.image_url, item.image, item.download_url);
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

  function detailHref(item) {
    const qs = new URLSearchParams();
    qs.set("slug", String(item.slug || item.id || ""));
    if (isQaFixtureMode() || item._qa_fixture) qs.set("qa_fixture", "1");
    return `detail.html?${qs.toString()}`;
  }

  function listHref() {
    const base = "/materials/list.html?category=background";
    return isQaFixtureMode() ? `${base}&qa_fixture=1` : base;
  }

  function usageLinesFromItem(item) {
    const fromRecommended = (item.recommended_for || item.usage_tags || []).map((x) => String(x).trim()).filter(Boolean);
    if (fromRecommended.length) return fromRecommended.slice(0, 4);
    const joined = pickStr(item.meta_recommended_usage);
    if (joined && joined !== "—") {
      return joined.split(/[·•|/]/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
    }
    const lines = item.image_detail_lines || item.background_detail_lines || [];
    return lines.map((x) => String(x).trim()).filter(Boolean).slice(0, 4);
  }

  function buildInfoRows(item) {
    const rows = [
      ["ファイル形式", formatLabel(item)],
      ["サイズ", sizeLabel(item) || ""],
      ["ファイルサイズ", pickStr(item.file_size, item.meta_file_size) || ""],
      ["解像度", pickStr(item.meta_dpi, item.dpi) || ""],
      ["カラーモード", pickStr(item.meta_color_mode, item.color_mode) || ""],
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
      `<article class="mat-bg-d-related-card" data-bg-d-related data-item-id="${escapeHtml(item.id)}">` +
        `<a class="mat-bg-d-related-card__media" href="${href}" aria-label="${escapeHtml(item.title)}">` +
          (thumb
            ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
            : `<span class="mat-bg-d-related-card__fallback" aria-hidden="true"></span>`) +
        `</a>` +
        `<div class="mat-bg-d-related-card__body">` +
          `<h3 class="mat-bg-d-related-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
          `<div class="mat-bg-d-related-card__foot">` +
            `<span class="mat-bg-d-related-card__meta"><span class="mat-bg-d-star" aria-hidden="true">★</span>${rating}<span class="mat-bg-d-related-card__dlcount">${dl}</span></span>` +
            `<button type="button" class="mat-bg-d-related-card__dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
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
    const dlLabel = Download?.primaryButtonLabel?.(item) || item.button_label || "広告を見て無料ダウンロード";
    const formats = (item.file_formats || []).length
      ? item.file_formats
      : String(item.meta_format || "JPG").split(/[/·,]/).map((s) => s.trim()).filter(Boolean);
    const previewSrc = resolvePreviewSrc(item);
    const size = sizeLabel(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const ratingCount = Number(item.rating_count || 0);
    const hrefList = listHref();
    const usageLines = usageLinesFromItem(item);
    const desc = pickStr(item.long_description, item.description) || `${DISPLAY_NAME}です。`;
    const relatedBg = (related || []).filter((r) => r && r.category_id === "background" && r.id !== item.id);
    const infoRows = buildInfoRows(item);
    const licenseLead = pickStr(item.commercial_use, "商用利用OK・クレジット表記不要");

    const formatOptions = formats
      .map((f, i) => {
        const upper = String(f).toUpperCase();
        const label = upper === "JPG" || upper === "JPEG" ? "JPG（高画質）" : upper === "PNG" ? "PNG" : upper;
        return `<option value="${escapeHtml(upper)}"${i === 0 ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("");
    const sizeSelect = size ? `<option selected>オリジナル (${escapeHtml(size)})</option>` : `<option selected>オリジナル</option>`;

    const previewBody = previewSrc
      ? `<div class="mat-bg-d-preview__frame" data-bg-d-frame data-mat-preview-state="loading">` +
          `<div class="mat-bg-d-preview__skeleton" data-bg-d-skeleton aria-hidden="true"></div>` +
          `<img class="mat-bg-d-preview__img" data-bg-d-img data-src="${escapeHtml(previewSrc)}" src="${escapeHtml(previewSrc)}" alt="${escapeHtml(item.title)}" decoding="async">` +
          `<div class="mat-bg-d-preview__error" data-bg-d-error hidden>` +
            `<p>背景プレビューを読み込めませんでした</p>` +
            `<button type="button" data-bg-d-reload>再読み込み</button>` +
          `</div>` +
        `</div>` +
        `<div class="mat-bg-d-preview__toolbar">` +
          `<button type="button" class="mat-bg-d-preview__expand" data-bg-d-expand aria-label="背景を拡大表示">⛶</button>` +
          `<button type="button" class="mat-bg-d-res is-active" disabled ${size ? "" : ''}>オリジナル${size ? ` (${escapeHtml(size)})` : ""}</button>` +
          `<button type="button" class="mat-bg-d-res" disabled>1920×1080</button>` +
          `<button type="button" class="mat-bg-d-res" disabled>1280×720</button>` +
          `<button type="button" class="mat-bg-d-res" disabled>800×450</button>` +
          `<button type="button" class="mat-bg-d-res mat-bg-d-res--copy" disabled>区間をコピー</button>` +
        `</div>`
      : `<div class="mat-bg-d-preview__empty">背景プレビューURLがありません</div>`;

    return (
      `<div class="mat-bg-d" data-bg-detail data-item-id="${escapeHtml(item.id)}">` +
        `<div class="mat-bg-d-back-mobile"><a href="${hrefList}"><span aria-hidden="true">‹</span> ${DISPLAY_NAME}一覧に戻る</a></div>` +
        `<nav class="mat-bg-d-crumb" aria-label="パンくず">` +
          `<a href="/materials/">ホーム</a><span aria-hidden="true">›</span>` +
          `<a href="/materials/index.html">素材を探す</a><span aria-hidden="true">›</span>` +
          `<a href="${hrefList}">${DISPLAY_NAME}一覧</a><span aria-hidden="true">›</span>` +
          `<span aria-current="page">${escapeHtml(item.title)}</span>` +
        `</nav>` +
        `<div class="mat-bg-d-layout">` +
          `<div class="mat-bg-d-main">` +
            `<div class="mat-bg-d-head">` +
              `<div class="mat-bg-d-head__badges">` +
                `<span class="mat-bg-d-badge">${DISPLAY_NAME}</span>` +
                (item.is_free !== false ? `<span class="mat-bg-d-free">無料</span>` : "") +
              `</div>` +
              `<h1 class="mat-bg-d-title">${escapeHtml(item.title)}</h1>` +
              `<p class="mat-bg-d-lead">${escapeHtml(item.description || "")}</p>` +
              `<div class="mat-bg-d-tags">${tags.map((t) => `<span class="mat-bg-d-tag">${escapeHtml(t)}</span>`).join("")}</div>` +
              `<div class="mat-bg-d-stats">` +
                `<span class="mat-bg-d-stats__rating"><span class="mat-bg-d-star" aria-hidden="true">★</span><b>${rating}</b>${ratingCount ? `<span class="mat-bg-d-stats__count">(${formatCount(ratingCount)})</span>` : ""}</span>` +
                `<span class="mat-bg-d-stats__dl"><span aria-hidden="true">↓</span><b>${formatCount(item.download_count)}</b><span>ダウンロード</span></span>` +
                `<button type="button" class="mat-bg-d-stats__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
                  `<span class="mat-bg-d-heart" aria-hidden="true"></span>` +
                  `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
                `</button>` +
              `</div>` +
            `</div>` +
            `<section class="mat-bg-d-preview" data-bg-d-preview aria-label="背景プレビュー">${previewBody}</section>` +
            `<div class="mat-bg-d-mobile-fav-wrap">` +
              `<button type="button" class="mat-bg-d-mobile-fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
                `<span class="mat-bg-d-heart" aria-hidden="true"></span>` +
                `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
              `</button>` +
            `</div>` +
            `<div class="mat-bg-d-tabs" data-bg-d-tabs>` +
              `<div class="mat-bg-d-tabs__nav" role="tablist" aria-label="詳細タブ">` +
                `<button type="button" class="mat-bg-d-tabs__tab is-active" role="tab" aria-selected="true" data-bg-d-tab="desc">説明</button>` +
                `<button type="button" class="mat-bg-d-tabs__tab" role="tab" aria-selected="false" data-bg-d-tab="usage">利用シーン</button>` +
                `<button type="button" class="mat-bg-d-tabs__tab" role="tab" aria-selected="false" data-bg-d-tab="related">関連素材</button>` +
                `<button type="button" class="mat-bg-d-tabs__tab" role="tab" aria-selected="false" data-bg-d-tab="comments">コメント</button>` +
              `</div>` +
              `<div class="mat-bg-d-tabs__panel is-active" data-bg-d-panel="desc">` +
                `<div class="mat-bg-d-desc-grid">` +
                  `<div>` +
                    `<p class="mat-bg-d-desc">${escapeHtml(desc)}</p>` +
                    (usageLines.length ? `<ul class="mat-bg-d-bullets">${usageLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "") +
                  `</div>` +
                  (previewSrc ? `<div class="mat-bg-d-desc-thumb" aria-hidden="true"><img src="${escapeHtml(previewSrc)}" alt="" loading="lazy" decoding="async"></div>` : "") +
                `</div>` +
              `</div>` +
              `<div class="mat-bg-d-tabs__panel" data-bg-d-panel="usage" hidden>` +
                (usageLines.length
                  ? `<ul class="mat-bg-d-bullets">${usageLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
                  : `<p class="mat-bg-d-empty-note">利用シーンの詳細は準備中です。</p>`) +
              `</div>` +
              `<div class="mat-bg-d-tabs__panel" data-bg-d-panel="related" hidden><p class="mat-bg-d-empty-note">下記の関連${DISPLAY_NAME}セクションをご覧ください。</p></div>` +
              `<div class="mat-bg-d-tabs__panel" data-bg-d-panel="comments" hidden><p class="mat-bg-d-empty-note">コメントは準備中です。</p></div>` +
            `</div>` +
            `<section class="mat-bg-d-related" aria-labelledby="matBgRelatedTitle">` +
              `<div class="mat-bg-d-related__head">` +
                `<h2 id="matBgRelatedTitle"><span class="mat-bg-d-related__ico" aria-hidden="true">▦</span>この素材を使用している人はこちらの素材も使っています</h2>` +
                `<a href="${hrefList}">すべて見る ›</a>` +
              `</div>` +
              (relatedBg.length
                ? `<div class="mat-bg-d-related__grid">${relatedBg.slice(0, 5).map(renderRelatedCard).join("")}</div>`
                : `<p class="mat-bg-d-empty-note">関連する${DISPLAY_NAME}はまだありません。</p>`) +
            `</section>` +
          `</div>` +
          `<aside class="mat-bg-d-aside" aria-label="${DISPLAY_NAME}サイドバー">` +
            `<div class="mat-bg-d-side-card">` +
              `<h3 class="mat-bg-d-side-card__title"><span class="mat-bg-d-side-card__accent" aria-hidden="true">↓</span>ダウンロード</h3>` +
              `<p class="mat-detail-dl-hint" data-mat-dl-hint></p>` +
              `<div class="mat-bg-d-fields-row">` +
                `<label class="mat-bg-d-field"><span>ファイル形式 <span class="mat-bg-d-field__rec">推奨</span></span>` +
                `<select data-bg-d-format aria-label="ファイル形式">${formatOptions || "<option>JPG</option>"}</select></label>` +
                `<label class="mat-bg-d-field"><span>サイズ</span>` +
                `<select ${size ? "" : "disabled "}aria-label="サイズ">${sizeSelect}</select></label>` +
              `</div>` +
              `<button type="button" class="mat-bg-d-dl-cta" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}"><span data-mat-download-label>${escapeHtml(dlLabel)}</span></button>` +
              `<p class="mat-bg-d-dl-note">※ クレジット表記不要で、商用利用が可能です</p>` +
            `</div>` +
            `<div class="mat-bg-d-side-card">` +
              `<h3 class="mat-bg-d-side-card__title"><span class="mat-bg-d-side-card__accent" aria-hidden="true">ℹ</span>素材情報</h3>` +
              `<dl class="mat-bg-d-info">${infoRows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}</dl>` +
            `</div>` +
            `<div class="mat-bg-d-side-card">` +
              `<h3 class="mat-bg-d-side-card__title"><span class="mat-bg-d-side-card__accent" aria-hidden="true">⛨</span>ライセンス</h3>` +
              `<p class="mat-bg-d-license__lead">${escapeHtml(licenseLead)}</p>` +
              `<p class="mat-bg-d-license__sub">再配布・販売は禁止されています</p>` +
              `<a class="mat-bg-d-license__link" href="/company/legal/materials.html">ライセンス詳細を見る ›</a>` +
            `</div>` +
            `<div class="mat-bg-d-side-card">` +
              `<h3 class="mat-bg-d-side-card__title"><span class="mat-bg-d-side-card__accent" aria-hidden="true">#</span>タグ</h3>` +
              `<div class="mat-bg-d-side-tags">${tags.map((t) => `<a class="mat-bg-d-side-tag" href="/materials/list.html?category=background&q=${encodeURIComponent(t)}${isQaFixtureMode() ? "&qa_fixture=1" : ""}">${escapeHtml(t)}</a>`).join("")}</div>` +
              (tags.length ? `<a class="mat-bg-d-side-more" href="${hrefList}">すべてのタグを見る (${tags.length}) ›</a>` : "") +
            `</div>` +
          `</aside>` +
        `</div>` +
        `<div class="mat-bg-d-lightbox" data-bg-d-lightbox hidden>` +
          `<button type="button" class="mat-bg-d-lightbox__close" data-bg-d-lightbox-close aria-label="閉じる">×</button>` +
          `<img data-bg-d-lightbox-img alt="">` +
        `</div>` +
        `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
  }

  function wireTabs(root) {
    const tabs = root.querySelectorAll("[data-bg-d-tab]");
    const panels = root.querySelectorAll("[data-bg-d-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-bg-d-tab");
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach((p) => {
          const on = p.getAttribute("data-bg-d-panel") === id;
          p.classList.toggle("is-active", on);
          p.hidden = !on;
        });
      });
    });
  }

  function setPreviewState(frame, state) {
    if (!frame) return;
    frame.setAttribute("data-mat-preview-state", state);
    const skeleton = frame.querySelector("[data-bg-d-skeleton]");
    const errorEl = frame.querySelector("[data-bg-d-error]");
    if (skeleton) skeleton.hidden = state !== "loading";
    if (errorEl) errorEl.hidden = state !== "error";
  }

  function wirePreview(root) {
    const frame = root.querySelector("[data-bg-d-frame]");
    const img = root.querySelector("[data-bg-d-img]");
    if (!frame || !img) return;

    const markLoaded = () => setPreviewState(frame, "ready");
    const markError = () => setPreviewState(frame, "error");

    if (img.complete && img.naturalWidth > 0) markLoaded();
    else {
      setPreviewState(frame, "loading");
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markError, { once: true });
    }

    root.querySelector("[data-bg-d-reload]")?.addEventListener("click", () => {
      const src = img.getAttribute("data-src") || img.src;
      setPreviewState(frame, "loading");
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markError, { once: true });
      img.src = "";
      img.src = src + (src.includes("?") ? "&" : "?") + "_r=" + Date.now();
    });

    const lightbox = root.querySelector("[data-bg-d-lightbox]");
    const lightboxImg = root.querySelector("[data-bg-d-lightbox-img]");
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
    root.querySelector("[data-bg-d-expand]")?.addEventListener("click", open);
    img.addEventListener("click", open);
    root.querySelector("[data-bg-d-lightbox-close]")?.addEventListener("click", close);
    lightbox?.addEventListener("click", (e) => {
      if (e.target === lightbox) close();
    });
  }

  async function mount(root, item, related) {
    if (!root || !item || item.category_id !== "background") return false;
    root.innerHTML = renderShell(item, related || []);
    document.title = `${item.title} | TASFUL Materials`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", item.description || "");

    wireTabs(root);
    wirePreview(root);

    global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(root, item);

    const byId = new Map((related || []).map((r) => [r.id, r]));
    root.querySelectorAll("[data-bg-d-related]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const rel = byId.get(id);
      if (rel) global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(card, rel);
    });

    return true;
  }

  function destroy() {
    document.body.style.overflow = "";
  }

  /** Uncommitted QA fixtures only — never written to Index/Inventory. */
  const QA_FIXTURES = Object.freeze({
    "background-gradient-soft": {
      id: "qa-fixture-background-gradient-soft",
      slug: "background-gradient-soft",
      title: "ソフトグラデーション背景",
      category_id: "background",
      description: "Webやサムネイル向けのソフトなグラデーション背景素材です。",
      tags: ["背景", "グラデーション", "パステル", "シンプル"],
      file_formats: ["JPG", "PNG"],
      download_count: 1840,
      rating: 4.8,
      rating_count: 96,
      updated_at: "2026-06-22T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: "/materials/images/previews/background-gradient-soft.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-gradient-soft.svg", alt: "ソフトグラデーション背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-gradient-soft-qa.svg",
      meta_resolution: "3840 × 2160 px",
      meta_size: "16:9",
      file_size: "約 2.4 MB",
      long_description:
        "柔らかな色合いのグラデーション背景素材です。Webデザイン、バナー、サムネイル、プレゼン資料など幅広くご利用いただけます。",
      recommended_for: [
        "ナチュラルで清潔感のある背景を探している方",
        "テキストやオブジェクトが映える明るい背景が欲しい方",
        "Web・印刷物・スライドなど幅広く利用したい方",
        "商用利用OK・クレジット表記不要の素材を探している方",
      ],
      commercial_use: "商用利用OK・クレジット表記不要",
      _qa_fixture: true,
    },
    "background-cafe": {
      id: "qa-fixture-background-cafe",
      slug: "background-cafe",
      title: "お洒落なカフェ背景",
      category_id: "background",
      description: "Webや動画の背景に使えるお洒落なカフェ写真素材です。",
      tags: ["背景", "カフェ", "写真", "テクスチャ"],
      file_formats: ["JPG", "PNG"],
      download_count: 1260,
      rating: 4.5,
      rating_count: 63,
      updated_at: "2026-06-29T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: "/materials/images/previews/background-cafe.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-cafe.svg", alt: "お洒落なカフェ背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-cafe-qa.svg",
      meta_resolution: "5760 × 3240 px",
      meta_size: "16:9",
      file_size: "約 4.1 MB",
      long_description: "お洒落なカフェの雰囲気を活かした背景素材です。動画・ブログ・LPのビジュアルに適しています。",
      recommended_for: ["カフェ・ライフスタイル系のコンテンツ向け", "動画やWebの背景に使える写真素材を探している方"],
      commercial_use: "商用利用OK・クレジット表記不要",
      _qa_fixture: true,
    },
    "background-nature-forest": {
      id: "qa-fixture-background-nature-forest",
      slug: "background-nature-forest",
      title: "森の自然風景背景",
      category_id: "background",
      description: "動画・ブログ・LP向けの森の自然風景背景素材です。",
      tags: ["背景", "自然", "風景", "森"],
      file_formats: ["JPG", "PNG"],
      download_count: 980,
      rating: 4.6,
      rating_count: 54,
      updated_at: "2026-06-25T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: "/materials/images/previews/background-nature-forest.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-nature-forest.svg", alt: "森の自然風景背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-nature-forest-qa.svg",
      meta_resolution: "3840 × 2160 px",
      meta_size: "16:9",
      file_size: "約 3.2 MB",
      long_description: "緑豊かな森をイメージした自然風景背景です。旅行・アウトドア・ライフスタイル系のコンテンツに最適です。",
      recommended_for: ["自然・風景系のビジュアルを探している方", "動画やブログの背景に使いたい方"],
      commercial_use: "商用利用OK・クレジット表記不要",
      _qa_fixture: true,
    },
    "background-abstract-pattern": {
      id: "qa-fixture-background-abstract-pattern",
      slug: "background-abstract-pattern",
      title: "抽象幾何パターン背景",
      category_id: "background",
      description: "テック系・クリエイティブ向けの抽象幾何パターン背景です。",
      tags: ["背景", "抽象", "パターン", "幾何"],
      file_formats: ["JPG", "PNG", "SVG"],
      download_count: 760,
      rating: 4.4,
      rating_count: 38,
      updated_at: "2026-06-18T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: "/materials/images/previews/background-abstract-pattern.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-abstract-pattern.svg", alt: "抽象幾何パターン背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-abstract-pattern-qa.svg",
      meta_resolution: "3840 × 2160 px",
      meta_size: "16:9",
      file_size: "約 1.8 MB",
      long_description: "幾何学模様をベースにした抽象パターン背景です。テック・クリエイティブ・イベントビジュアルに適しています。",
      recommended_for: ["抽象・パターン背景を探している方", "テック系コンテンツの見た目を整えたい方"],
      commercial_use: "商用利用OK・クレジット表記不要",
      _qa_fixture: true,
    },
    "background-business-minimal": {
      id: "qa-fixture-background-business-minimal",
      slug: "background-business-minimal",
      title: "ビジネスシンプル背景",
      category_id: "background",
      description: "資料・プレゼン・コーポレートサイト向けのシンプル背景です。",
      tags: ["背景", "ビジネス", "シンプル", "資料"],
      file_formats: ["JPG", "PNG"],
      download_count: 1520,
      rating: 4.7,
      rating_count: 88,
      updated_at: "2026-06-27T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: "/materials/images/previews/background-business-minimal.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-business-minimal.svg", alt: "ビジネスシンプル背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-business-minimal-qa.svg",
      meta_resolution: "3840 × 2160 px",
      meta_size: "16:9",
      file_size: "約 1.2 MB",
      long_description: "余白が多く読みやすいビジネス向けシンプル背景です。プレゼン資料やコーポレートサイトに最適です。",
      recommended_for: ["ビジネス資料の背景を探している方", "シンプルで落ち着いたビジュアルが欲しい方"],
      commercial_use: "商用利用OK・クレジット表記不要",
      _qa_fixture: true,
    },
    "background-seasonal-autumn": {
      id: "qa-fixture-background-seasonal-autumn",
      slug: "background-seasonal-autumn",
      title: "秋の季節イベント背景",
      category_id: "background",
      description: "秋のキャンペーンや季節特集向けのイベント背景素材です。",
      tags: ["背景", "季節", "秋", "イベント"],
      file_formats: ["JPG", "PNG"],
      download_count: 640,
      rating: 4.5,
      rating_count: 41,
      updated_at: "2026-06-12T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: "/materials/images/previews/background-seasonal-autumn.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-seasonal-autumn.svg", alt: "秋の季節イベント背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-seasonal-autumn-qa.svg",
      meta_resolution: "3840 × 2160 px",
      meta_size: "16:9",
      file_size: "約 2.1 MB",
      long_description: "紅葉をイメージした秋の季節イベント背景です。キャンペーンバナーや季節特集に適しています。",
      recommended_for: ["季節キャンペーンを打ち出したい方", "秋らしいビジュアルを探している方"],
      commercial_use: "商用利用OK・クレジット表記不要",
      _qa_fixture: true,
    },
    "background-starry-sky": {
      id: "qa-fixture-background-starry-sky",
      slug: "background-starry-sky",
      title: "星空・宇宙背景",
      category_id: "background",
      description: "夜空・宇宙・幻想系コンテンツ向けの星空背景素材です。",
      tags: ["背景", "宇宙", "空", "星"],
      file_formats: ["JPG", "PNG"],
      download_count: 2100,
      rating: 4.9,
      rating_count: 132,
      updated_at: "2026-06-30T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: "/materials/images/previews/background-starry-sky.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-starry-sky.svg", alt: "星空・宇宙背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-starry-sky-qa.svg",
      meta_resolution: "5760 × 3240 px",
      meta_size: "16:9",
      file_size: "約 3.6 MB",
      long_description: "月と星が輝く夜空をイメージした宇宙・空の背景です。幻想系・ゲーム・配信背景に最適です。",
      recommended_for: ["宇宙・夜空のビジュアルを探している方", "配信やゲームの背景に使いたい方"],
      commercial_use: "商用利用OK・クレジット表記不要",
      _qa_fixture: true,
    },
    "background-cyberpunk-room": {
      id: "qa-fixture-background-cyberpunk-room",
      slug: "background-cyberpunk-room",
      title: "サイバーパンク部屋背景",
      category_id: "background",
      description: "ゲームやSF系コンテンツ向けのサイバーパンク部屋背景です。",
      tags: ["背景", "サイバーパンク", "部屋", "近未来"],
      file_formats: ["JPG", "PNG"],
      download_count: 1180,
      rating: 4.7,
      rating_count: 71,
      updated_at: "2026-06-20T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: "/materials/images/previews/background-cyberpunk-room.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-cyberpunk-room.svg", alt: "サイバーパンク部屋背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-cyberpunk-room-qa.svg",
      meta_resolution: "5760 × 3240 px",
      meta_size: "16:9",
      file_size: "約 4.5 MB",
      long_description: "ネオンと近未来の室内をイメージしたサイバーパンク風背景です。ゲーム・配信・SF系コンテンツに最適です。",
      recommended_for: ["ゲームや配信の背景に使いたい方", "SF・近未来テイストのビジュアルを探している方"],
      commercial_use: "商用利用OK・クレジット表記不要",
      _qa_fixture: true,
    },
  });

  function resolveQaItem(slug) {
    if (!isQaFixtureMode()) return null;
    const raw = QA_FIXTURES[String(slug || "")];
    if (!raw) return null;
    const data = global.TasuMaterialsData;
    const enriched = data?.enrichDetail ? data.enrichDetail({ ...raw }) : { ...raw };
    return {
      ...enriched,
      preview_images: raw.preview_images,
      download_url: raw.download_url,
      downloadable: raw.downloadable !== false,
      download_kind: raw.download_kind || "file",
      download_filename: raw.download_filename || enriched.download_filename,
      meta_resolution: raw.meta_resolution || enriched.meta_resolution,
      meta_size: raw.meta_size || enriched.meta_size,
      file_size: raw.file_size || enriched.file_size,
      long_description: raw.long_description || enriched.long_description,
      recommended_for: raw.recommended_for || enriched.recommended_for,
      commercial_use: raw.commercial_use || enriched.commercial_use,
      _qa_fixture: true,
    };
  }

  function resolveQaRelated(item) {
    if (!isQaFixtureMode()) return [];
    return Object.keys(QA_FIXTURES)
      .filter((slug) => slug !== item.slug)
      .map((slug) => resolveQaItem(slug))
      .filter(Boolean);
  }

  global.TasuMaterialsBackgroundDetail = {
    mount,
    destroy,
    resolveQaItem,
    resolveQaRelated,
    isBackgroundItem(item) {
      return !!(item && item.category_id === "background");
    },
    resolvePreviewSrc,
  };
})(typeof window !== "undefined" ? window : globalThis);
