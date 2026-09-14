/**
 * TASFUL Materials — イラスト素材 詳細 Option 4 UI（category=illustration のみ）
 * 公開表示名「イラスト素材」。操作・カテゴリ識別=indigo / プレビュー=object-contain。
 * 音声波形UI・画像素材詳細の単純コピーは使わない。
 * Download / Favorite / Related / Preview URL Contract は既存のまま接続。
 */
(function (global) {
  "use strict";

  const GENERIC_TAGS = new Set([
    "illustration",
    "illust",
    "イラスト",
    "イラスト素材",
    "png",
    "jpg",
    "jpeg",
    "svg",
    "webp",
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
    return pickStr(item.meta_format);
  }

  function isQaFixtureMode() {
    return new URLSearchParams(global.location.search).get("qa_fixture") === "1";
  }

  function detailHref(item) {
    const qs = new URLSearchParams();
    qs.set("slug", String(item.slug || item.id || ""));
    if (isQaFixtureMode() || item._qa_fixture) qs.set("qa_fixture", "1");
    return `detail.html?${qs.toString()}`;
  }

  function buildInfoRows(item) {
    const size = sizeLabel(item);
    const transparent = pickStr(item.meta_transparent, item.image_transparent);
    const author = pickStr(item.meta_author, item.author, item.source);
    const authorOk = author && !/^[-—–]$/.test(author);
    const rows = [
      ["ファイル形式", formatLabel(item)],
      ["サイズ", size],
      ["ファイルサイズ", pickStr(item.file_size)],
      ["解像度", pickStr(item.meta_dpi, item.dpi)],
      ["カラーモード", pickStr(item.meta_color_mode, item.color_mode)],
      ["公開日", pickStr(item.meta_published, item.meta_updated)],
      ["素材ID", pickStr(item.slug, item.id)],
    ];
    if (transparent && transparent !== "—") {
      rows.splice(2, 0, ["背景透過", transparent]);
    }
    if (authorOk) {
      rows.splice(rows.length - 1, 0, ["作者 / 出典", author]);
    }
    return rows.filter(([, v]) => !!v);
  }

  function renderRelatedCard(item) {
    const href = detailHref(item);
    const thumb = resolvePreviewSrc(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    return (
      `<article class="mat-ill-d-related-card" data-ill-d-related data-item-id="${escapeHtml(item.id)}">` +
      `<a class="mat-ill-d-related-card__media" href="${href}" aria-label="${escapeHtml(item.title)}">` +
      (thumb
        ? `<img class="mat-ill-d-related-card__img" src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
        : `<span class="mat-ill-d-related-card__fallback" aria-hidden="true"></span>`) +
      `</a>` +
      `<h3 class="mat-ill-d-related-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<div class="mat-ill-d-related-card__foot">` +
      `<span class="mat-ill-d-related-card__meta"><span class="mat-ill-d-star" aria-hidden="true">★</span>${rating}` +
      `<span class="mat-ill-d-related-card__dlcount">${dl}</span></span>` +
      `<button type="button" class="mat-ill-d-related-card__dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
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
    const dlLabel =
      Download?.primaryButtonLabel?.(item) || item.button_label || "広告を見て無料ダウンロード";
    const formats = (item.file_formats || []).length
      ? item.file_formats
      : String(item.meta_format || "")
          .split(/[/·,]/)
          .map((s) => s.trim())
          .filter(Boolean);
    const previewSrc = resolvePreviewSrc(item);
    const size = sizeLabel(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const ratingCount = Number(item.rating_count || 0);
    const listHref =
      "/materials/list.html?category=illustration" + (isQaFixtureMode() || item._qa_fixture ? "&qa_fixture=1" : "");
    const usageLines = (item.recommended_for || item.usage_scenarios || item.usage_tags || [])
      .map((x) => String(x).trim())
      .filter((x) => x && !GENERIC_TAGS.has(x.toLowerCase()) && !GENERIC_TAGS.has(x))
      .slice(0, 4);
    const desc = pickStr(item.long_description, item.description) || "イラスト素材です。";
    const relatedIll = (related || []).filter(
      (r) => r && r.category_id === "illustration" && r.id !== item.id
    );
    const relatedFallback = relatedIll.length
      ? relatedIll
      : (related || []).filter((r) => r && r.id !== item.id).slice(0, 5);
    const infoRows = buildInfoRows(item);

    const formatOptions = (formats.length ? formats : ["PNG"])
      .map((f, i) => {
        const upper = String(f).toUpperCase();
        const label =
          upper === "PNG"
            ? "PNG 推奨"
            : upper === "SVG"
              ? "SVG"
              : upper === "JPG" || upper === "JPEG"
                ? "JPG"
                : upper;
        return `<option value="${escapeHtml(upper)}"${i === 0 ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("");

    const sizeSelect = size
      ? `<option selected>オリジナル（${escapeHtml(size)}）</option>`
      : `<option selected>オリジナル</option>`;

    const resButtons = size
      ? `<button type="button" class="mat-ill-d-res is-active" disabled>オリジナル（${escapeHtml(size)}）</button>` +
        `<button type="button" class="mat-ill-d-res" disabled>その他サイズ</button>`
      : `<button type="button" class="mat-ill-d-res is-active" disabled>オリジナル</button>`;

    return (
      `<div class="mat-ill-d" data-ill-detail data-item-id="${escapeHtml(item.id)}">` +
      `<div class="mat-ill-d-back-mobile">` +
      `<a href="${listHref}"><span aria-hidden="true">‹</span> イラスト一覧に戻る</a>` +
      `</div>` +
      `<nav class="mat-ill-d-crumb" aria-label="パンくず">` +
      `<a href="/materials/">ホーム</a><span aria-hidden="true">›</span>` +
      `<a href="/materials/index.html">素材を探す</a><span aria-hidden="true">›</span>` +
      `<a href="${listHref}">イラスト一覧</a><span aria-hidden="true">›</span>` +
      `<span aria-current="page">${escapeHtml(item.title)}</span>` +
      `</nav>` +
      `<div class="mat-ill-d-layout">` +
      /* LEFT */
      `<div class="mat-ill-d-main">` +
      `<div class="mat-ill-d-head">` +
      `<div class="mat-ill-d-head__badges">` +
      `<span class="mat-ill-d-badge">イラスト</span>` +
      (item.is_free !== false ? `<span class="mat-ill-d-free">無料</span>` : "") +
      `</div>` +
      `<h1 class="mat-ill-d-title">${escapeHtml(item.title)}</h1>` +
      `<p class="mat-ill-d-lead">${escapeHtml(item.description || "")}</p>` +
      `<div class="mat-ill-d-tags">` +
      tags.map((t) => `<span class="mat-ill-d-tag">${escapeHtml(t)}</span>`).join("") +
      `</div>` +
      `<div class="mat-ill-d-stats">` +
      `<span class="mat-ill-d-stats__rating"><span class="mat-ill-d-star" aria-hidden="true">★</span>` +
      `<b>${rating}</b>${ratingCount ? `<span class="mat-ill-d-stats__count">(${formatCount(ratingCount)})</span>` : ""}</span>` +
      `<span class="mat-ill-d-stats__dl"><span aria-hidden="true">↓</span>${formatCount(item.download_count)} ダウンロード</span>` +
      `<button type="button" class="mat-ill-d-stats__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<span class="mat-ill-d-heart" aria-hidden="true"></span>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</div>` +
      `</div>` +
      `<section class="mat-ill-d-preview-card" data-ill-d-preview aria-label="イラストプレビュー">` +
      (previewSrc
        ? `<div class="mat-ill-d-preview__stage" data-ill-d-frame data-mat-preview-state="loading">` +
          `<div class="mat-ill-d-preview__skeleton" data-ill-d-skeleton aria-hidden="true"></div>` +
          `<img class="mat-ill-d-preview__img" data-ill-d-img data-src="${escapeHtml(previewSrc)}" src="${escapeHtml(previewSrc)}" alt="${escapeHtml(item.title)}" decoding="async">` +
          `<div class="mat-ill-d-preview__error" data-ill-d-error hidden>` +
          `<p>イラストを読み込めませんでした</p>` +
          `<button type="button" data-ill-d-reload>再読み込み</button>` +
          `</div>` +
          `</div>`
        : `<div class="mat-ill-d-preview__empty">プレビューを準備中です</div>`) +
      `<div class="mat-ill-d-preview__tools">` +
      `<button type="button" class="mat-ill-d-toolbtn" data-ill-d-expand aria-label="拡大表示" ${previewSrc ? "" : "disabled"}>⛶</button>` +
      resButtons +
      `<button type="button" class="mat-ill-d-res mat-ill-d-res--copy" disabled>区間をコピー</button>` +
      `</div>` +
      `</section>` +
      `<section class="mat-ill-d-tabs-card" data-ill-d-tabs>` +
      `<div class="mat-ill-d-tabs__nav" role="tablist" aria-label="詳細タブ">` +
      `<button type="button" class="mat-ill-d-tabs__tab is-active" role="tab" aria-selected="true" data-ill-d-tab="desc">説明</button>` +
      `<button type="button" class="mat-ill-d-tabs__tab" role="tab" aria-selected="false" data-ill-d-tab="usage">利用シーン</button>` +
      `<button type="button" class="mat-ill-d-tabs__tab" role="tab" aria-selected="false" data-ill-d-tab="related">関連素材</button>` +
      `<button type="button" class="mat-ill-d-tabs__tab" role="tab" aria-selected="false" data-ill-d-tab="comments">コメント</button>` +
      `</div>` +
      `<div class="mat-ill-d-tabs__panel is-active" data-ill-d-panel="desc">` +
      `<div class="mat-ill-d-desc-grid">` +
      `<div>` +
      `<p class="mat-ill-d-desc">${escapeHtml(desc)}</p>` +
      (usageLines.length
        ? `<ul class="mat-ill-d-bullets">` +
          usageLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("") +
          `</ul>`
        : "") +
      `</div>` +
      `<div class="mat-ill-d-desc-art" aria-hidden="true"><span class="mat-ill-d-desc-art__mark">✎</span></div>` +
      `</div>` +
      `</div>` +
      `<div class="mat-ill-d-tabs__panel" data-ill-d-panel="usage" hidden>` +
      (usageLines.length
        ? `<ul class="mat-ill-d-bullets">` +
          usageLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("") +
          `</ul>`
        : `<p class="mat-ill-d-empty-note">利用シーンデータはまだありません</p>`) +
      `</div>` +
      `<div class="mat-ill-d-tabs__panel" data-ill-d-panel="related" hidden>` +
      `<p class="mat-ill-d-empty-note">下記の関連素材セクションをご覧ください。</p>` +
      `</div>` +
      `<div class="mat-ill-d-tabs__panel" data-ill-d-panel="comments" hidden>` +
      `<p class="mat-ill-d-empty-note">コメント機能は準備中です</p>` +
      `</div>` +
      `</section>` +
      `<section class="mat-ill-d-related" aria-labelledby="matIllRelatedTitle">` +
      `<div class="mat-ill-d-related__head">` +
      `<h2 id="matIllRelatedTitle"><span class="mat-ill-d-related__ico" aria-hidden="true">▦</span>この素材を使用している人はこちらの素材も使っています</h2>` +
      `<a href="${listHref}">すべて見る ›</a>` +
      `</div>` +
      (relatedFallback.length
        ? `<div class="mat-ill-d-related__grid">${relatedFallback.slice(0, 5).map(renderRelatedCard).join("")}</div>`
        : `<p class="mat-ill-d-empty-note">関連するイラスト素材はまだありません。</p>`) +
      `</section>` +
      `</div>` +
      /* MIDDLE */
      `<aside class="mat-ill-d-aside">` +
      `<div class="mat-ill-d-side-card mat-ill-d-side-card--dl">` +
      `<h3 class="mat-ill-d-side-card__title"><span class="mat-ill-d-side-card__accent" aria-hidden="true">↓</span>ダウンロード</h3>` +
      `<p class="mat-detail-dl-hint" data-mat-dl-hint></p>` +
      `<div class="mat-ill-d-fields-row">` +
      `<label class="mat-ill-d-field"><span>ファイル形式</span>` +
      `<select data-ill-d-format aria-label="ファイル形式">${formatOptions}</select></label>` +
      `<label class="mat-ill-d-field"><span>サイズ</span>` +
      `<select ${size ? "" : "disabled "}aria-label="サイズ">${sizeSelect}</select></label>` +
      `</div>` +
      `<button type="button" class="mat-ill-d-dl-cta" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      `<span data-mat-download-label>${escapeHtml(dlLabel)}</span>` +
      `</button>` +
      `<p class="mat-ill-d-dl-note">※ クレジット表記不要で、商用利用が可能です</p>` +
      `</div>` +
      `<div class="mat-ill-d-side-card mat-ill-d-side-card--desktop">` +
      `<h3 class="mat-ill-d-side-card__title"><span class="mat-ill-d-side-card__accent" aria-hidden="true">⚙</span>素材情報</h3>` +
      `<dl class="mat-ill-d-info">` +
      infoRows
        .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`)
        .join("") +
      `</dl>` +
      `</div>` +
      `<div class="mat-ill-d-side-card mat-ill-d-side-card--desktop">` +
      `<h3 class="mat-ill-d-side-card__title"><span class="mat-ill-d-side-card__accent" aria-hidden="true">⛨</span>ライセンス</h3>` +
      `<p class="mat-ill-d-license__lead">${escapeHtml(item.commercial_use || "商用利用OK・クレジット表記不要")}</p>` +
      `<p class="mat-ill-d-license__sub">再配布・販売は禁止されています</p>` +
      `<a class="mat-ill-d-license__link" href="/company/legal/materials.html">ライセンス詳細を見る ›</a>` +
      `</div>` +
      `<div class="mat-ill-d-side-card mat-ill-d-side-card--desktop">` +
      `<h3 class="mat-ill-d-side-card__title"><span class="mat-ill-d-side-card__accent" aria-hidden="true">#</span>タグ</h3>` +
      `<div class="mat-ill-d-side-tags">` +
      tags
        .map(
          (t) =>
            `<a class="mat-ill-d-side-tag" href="/materials/list.html?category=illustration&q=${encodeURIComponent(t)}${isQaFixtureMode() || item._qa_fixture ? "&qa_fixture=1" : ""}">${escapeHtml(t)}</a>`
        )
        .join("") +
      `</div>` +
      `</div>` +
      `</aside>` +
      /* RIGHT rail — illustration mini preview (NO audio) */
      `<aside class="mat-ill-d-rail" aria-label="イラスト素材サイド">` +
      `<a class="mat-ill-d-rail__back" href="${listHref}"><span aria-hidden="true">‹</span> イラスト一覧に戻る</a>` +
      `<section class="mat-ill-d-rail-card">` +
      `<div class="mat-ill-d-head__badges">` +
      `<span class="mat-ill-d-badge">イラスト</span>` +
      (item.is_free !== false ? `<span class="mat-ill-d-free">無料</span>` : "") +
      `</div>` +
      `<h3 class="mat-ill-d-rail-card__title">${escapeHtml(item.title)}</h3>` +
      `<p class="mat-ill-d-rail-card__lead">${escapeHtml(item.description || "")}</p>` +
      `<div class="mat-ill-d-rail-card__tags">` +
      tags.slice(0, 5).map((t) => `<span class="mat-ill-d-tag">${escapeHtml(t)}</span>`).join("") +
      `</div>` +
      `<div class="mat-ill-d-rail-card__stats">` +
      `<span><span class="mat-ill-d-star" aria-hidden="true">★</span><b>${rating}</b>` +
      `${ratingCount ? `<span class="mat-ill-d-stats__count">(${formatCount(ratingCount)})</span>` : ""}</span>` +
      `<span class="mat-ill-d-stats__dl"><span aria-hidden="true">↓</span>${formatCount(item.download_count)}</span>` +
      `<button type="button" class="mat-ill-d-stats__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="お気に入り">` +
      `<span class="mat-ill-d-heart" aria-hidden="true"></span>` +
      `</button>` +
      `</div>` +
      (previewSrc
        ? `<div class="mat-ill-d-rail-preview"><img src="${escapeHtml(previewSrc)}" alt="" loading="lazy" decoding="async"></div>`
        : `<div class="mat-ill-d-rail-preview mat-ill-d-rail-preview--empty">プレビュー準備中</div>`) +
      `</section>` +
      `<section class="mat-ill-d-rail-card mat-ill-d-side-card--dl">` +
      `<h3 class="mat-ill-d-side-card__title"><span class="mat-ill-d-side-card__accent" aria-hidden="true">↓</span>ダウンロード</h3>` +
      `<label class="mat-ill-d-field"><span>ファイル形式</span>` +
      `<select aria-label="ファイル形式（レール）">${formatOptions}</select></label>` +
      `<label class="mat-ill-d-field"><span>サイズ</span>` +
      `<select ${size ? "" : "disabled "}aria-label="サイズ（レール）">${sizeSelect}</select></label>` +
      `<button type="button" class="mat-ill-d-dl-cta" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      `<span data-mat-download-label>${escapeHtml(dlLabel)}</span>` +
      `</button>` +
      `<p class="mat-ill-d-dl-note">※ クレジット表記不要で、商用利用が可能です</p>` +
      `</section>` +
      `<div class="mat-ill-d-rail-acc">` +
      `<button type="button" data-ill-d-rail-jump="info">素材情報 <span>▼</span></button>` +
      `<button type="button" data-ill-d-rail-jump="desc">説明 <span>▼</span></button>` +
      `<button type="button" data-ill-d-rail-jump="usage">利用シーン <span>▼</span></button>` +
      `<button type="button" data-ill-d-rail-jump="related">関連素材 <span>▼</span></button>` +
      `<button type="button" data-ill-d-rail-jump="tags">タグ <span>▼</span></button>` +
      `<button type="button" disabled>コメント <span>▼</span></button>` +
      `</div>` +
      `<button type="button" class="mat-ill-d-rail-fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<span class="mat-ill-d-heart" aria-hidden="true"></span>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</aside>` +
      `</div>` +
      `<button type="button" class="mat-ill-d-mobile-fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<span class="mat-ill-d-heart" aria-hidden="true"></span>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `<div class="mat-ill-d-mobile-acc">` +
      `<details open><summary>素材情報</summary>` +
      `<dl class="mat-ill-d-info">` +
      infoRows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("") +
      `</dl></details>` +
      `<details><summary>説明</summary><p class="mat-ill-d-desc">${escapeHtml(desc)}</p></details>` +
      `<details><summary>利用シーン</summary>` +
      (usageLines.length
        ? `<ul class="mat-ill-d-bullets">` + usageLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("") + `</ul>`
        : `<p class="mat-ill-d-empty-note">利用シーンデータはまだありません</p>`) +
      `</details>` +
      `<details><summary>関連素材</summary><p class="mat-ill-d-empty-note">上部の関連素材セクションをご覧ください。</p></details>` +
      `<details><summary>タグ</summary><div class="mat-ill-d-side-tags">` +
      tags.map((t) => `<span class="mat-ill-d-side-tag">${escapeHtml(t)}</span>`).join("") +
      `</div></details>` +
      `<details><summary>コメント</summary><p class="mat-ill-d-empty-note">コメント機能は準備中です</p></details>` +
      `</div>` +
      `<div class="mat-ill-d-lightbox" data-ill-d-lightbox hidden>` +
      `<button type="button" class="mat-ill-d-lightbox__close" data-ill-d-lightbox-close aria-label="閉じる">×</button>` +
      `<img data-ill-d-lightbox-img alt="">` +
      `</div>` +
      `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
  }

  function wireTabs(root) {
    const tabs = root.querySelectorAll("[data-ill-d-tab]");
    const panels = root.querySelectorAll("[data-ill-d-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-ill-d-tab");
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach((p) => {
          const on = p.getAttribute("data-ill-d-panel") === id;
          p.classList.toggle("is-active", on);
          p.hidden = !on;
        });
      });
    });
  }

  function setPreviewState(frame, state) {
    if (!frame) return;
    frame.setAttribute("data-mat-preview-state", state);
    const skeleton = frame.querySelector("[data-ill-d-skeleton]");
    const errorEl = frame.querySelector("[data-ill-d-error]");
    if (skeleton) skeleton.hidden = state !== "loading";
    if (errorEl) errorEl.hidden = state !== "error";
  }

  function wirePreview(root) {
    const frame = root.querySelector("[data-ill-d-frame]");
    const img = root.querySelector("[data-ill-d-img]");
    if (!frame || !img) return;

    const markLoaded = () => setPreviewState(frame, "ready");
    const markError = () => setPreviewState(frame, "error");

    if (img.complete && img.naturalWidth > 0) markLoaded();
    else {
      setPreviewState(frame, "loading");
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markError, { once: true });
    }

    root.querySelector("[data-ill-d-reload]")?.addEventListener("click", () => {
      const src = img.getAttribute("data-src") || img.src;
      setPreviewState(frame, "loading");
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markError, { once: true });
      img.src = "";
      img.src = src + (src.includes("?") ? "&" : "?") + "_r=" + Date.now();
    });

    const lightbox = root.querySelector("[data-ill-d-lightbox]");
    const lightboxImg = root.querySelector("[data-ill-d-lightbox-img]");
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
    root.querySelector("[data-ill-d-expand]")?.addEventListener("click", open);
    img.addEventListener("click", open);
    root.querySelector("[data-ill-d-lightbox-close]")?.addEventListener("click", close);
    lightbox?.addEventListener("click", (e) => {
      if (e.target === lightbox) close();
    });
  }

  async function mount(root, item, related) {
    if (!root || !item || item.category_id !== "illustration") return false;
    root.innerHTML = renderShell(item, related || []);
    document.title = `${item.title} | TASFUL Materials`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", item.description || "");

    wireTabs(root);
    wirePreview(root);
    global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(root, item);

    root.querySelectorAll("[data-ill-d-rail-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-ill-d-rail-jump");
        const map = {
          info: ".mat-ill-d-side-card--desktop",
          desc: "[data-ill-d-tab='desc']",
          usage: "[data-ill-d-tab='usage']",
          related: ".mat-ill-d-related",
          tags: ".mat-ill-d-side-tags",
        };
        const tab = key === "desc" || key === "usage" ? root.querySelector(map[key]) : null;
        if (tab) tab.click();
        const target = root.querySelector(map[key] || "");
        target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      });
    });

    const byId = new Map((related || []).map((r) => [r.id, r]));
    root.querySelectorAll("[data-ill-d-related]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const rel = byId.get(id);
      if (rel) global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(card, rel);
    });

    return true;
  }

  function destroy() {
    document.body.style.overflow = "";
  }

  /**
   * Local QA fixtures only (PUBLIC_INVENTORY_EMPTY).
   * Enabled with ?qa_fixture=1 — does NOT write Index/Inventory.
   */
  const QA_PREVIEW_OFFICE = "/materials/images/previews/illustration-office-worker.svg";
  const QA_PREVIEW_CHAR = "/materials/images/previews/illustration-simple-character.svg";
  const QA_PREVIEW_MEDICAL = "/materials/images/previews/illustration-medical-staff.svg";
  const QA_PREVIEW_CAT = "/materials/images/previews/illustration-cute-cat.svg";
  const QA_PREVIEW_SPRING = "/materials/images/previews/illustration-seasonal-spring.svg";
  const QA_FIXTURES = Object.freeze({
    "illustration-office-worker": {
      id: "qa-fixture-illustration-office-worker",
      slug: "illustration-office-worker",
      title: "パソコンを使う会社員イラスト",
      category_id: "illustration",
      description: "ビジネス記事や資料向けの会社員イラスト素材です。",
      tags: ["イラスト", "ビジネス", "会社員"],
      file_formats: ["PNG", "SVG"],
      download_count: 1280,
      rating: 4.6,
      rating_count: 84,
      updated_at: "2026-06-21T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: QA_PREVIEW_OFFICE,
      preview_images: [{ id: "main", src: QA_PREVIEW_OFFICE, alt: "パソコンを使う会社員イラスト" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "illustration-office-worker-qa.svg",
      meta_resolution: "2400 × 1800 px",
      meta_transparent: "あり（PNG）",
      long_description:
        "ビジネス記事や社内資料、プレゼン資料向けの会社員イラスト素材です。フラットなデザインで読みやすく、背景透過PNGも同梱しています。",
      recommended_for: [
        "ビジネス系コンテンツの見た目を整えたい方",
        "記事や資料にイラストを添えたい方",
        "統一感のある素材を探している方",
      ],
      _qa_fixture: true,
    },
    "illustration-simple-character": {
      id: "qa-fixture-illustration-simple-character",
      slug: "illustration-simple-character",
      title: "シンプルキャラクターイラスト",
      category_id: "illustration",
      description: "SNSやLP向けのシンプルなキャラクターイラストです。",
      tags: ["イラスト", "キャラクター", "シンプル"],
      file_formats: ["PNG", "SVG"],
      download_count: 980,
      rating: 4.7,
      rating_count: 62,
      updated_at: "2026-06-20T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: QA_PREVIEW_CHAR,
      preview_images: [{ id: "main", src: QA_PREVIEW_CHAR, alt: "シンプルキャラクターイラスト" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "illustration-simple-character-qa.svg",
      meta_resolution: "2000 × 2000 px",
      meta_transparent: "あり（PNG / SVG）",
      long_description:
        "SNS投稿やLP、プレゼン資料に使いやすいシンプルなキャラクターイラストです。",
      recommended_for: [
        "親しみやすいイラスト素材を探している方",
        "SNSやブログのアイキャッチに使いたい方",
      ],
      _qa_fixture: true,
    },
    "illustration-medical-staff": {
      id: "qa-fixture-illustration-medical-staff",
      slug: "illustration-medical-staff",
      title: "医療スタッフイラスト",
      category_id: "illustration",
      description: "病院・クリニックの案内や記事向けの医療スタッフイラストです。",
      tags: ["イラスト", "医療", "人物"],
      file_formats: ["PNG", "SVG"],
      download_count: 640,
      rating: 4.5,
      rating_count: 41,
      updated_at: "2026-06-18T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: QA_PREVIEW_MEDICAL,
      preview_images: [{ id: "main", src: QA_PREVIEW_MEDICAL, alt: "医療スタッフイラスト" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "illustration-medical-staff-qa.svg",
      meta_resolution: "2000 × 1500 px",
      meta_transparent: "あり（PNG）",
      long_description:
        "医療機関の案内ページやヘルスケア記事向けの医療スタッフイラストです。透過PNGに対応しています。",
      recommended_for: [
        "医療・ヘルスケア系のコンテンツを作る方",
        "案内ページに人物イラストを添えたい方",
      ],
      _qa_fixture: true,
    },
    "illustration-cute-cat": {
      id: "qa-fixture-illustration-cute-cat",
      slug: "illustration-cute-cat",
      title: "かわいい猫イラスト",
      category_id: "illustration",
      description: "ブログやSNS向けのかわいい猫イラスト素材です。",
      tags: ["イラスト", "猫", "かわいい"],
      file_formats: ["PNG", "SVG"],
      download_count: 2100,
      rating: 4.9,
      rating_count: 156,
      updated_at: "2026-06-22T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: QA_PREVIEW_CAT,
      preview_images: [{ id: "main", src: QA_PREVIEW_CAT, alt: "かわいい猫イラスト" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "illustration-cute-cat-qa.svg",
      meta_resolution: "1800 × 1800 px",
      meta_transparent: "あり（PNG / SVG）",
      long_description:
        "ブログやSNS投稿のアイキャッチに使いやすいかわいい猫イラストです。",
      recommended_for: [
        "ペット・ライフスタイル系の投稿を作る方",
        "親しみやすいビジュアルを探している方",
      ],
      _qa_fixture: true,
    },
    "illustration-seasonal-spring": {
      id: "qa-fixture-illustration-seasonal-spring",
      slug: "illustration-seasonal-spring",
      title: "春の季節イラスト",
      category_id: "illustration",
      description: "春のキャンペーンや季節記事向けのイラスト素材です。",
      tags: ["イラスト", "季節", "春"],
      file_formats: ["PNG", "SVG"],
      download_count: 520,
      rating: 4.4,
      rating_count: 33,
      updated_at: "2026-06-15T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: QA_PREVIEW_SPRING,
      preview_images: [{ id: "main", src: QA_PREVIEW_SPRING, alt: "春の季節イラスト" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "illustration-seasonal-spring-qa.svg",
      meta_resolution: "2400 × 1500 px",
      meta_transparent: "なし",
      long_description:
        "春のキャンペーンバナーや季節特集記事向けのイラスト素材です。",
      recommended_for: [
        "季節キャンペーンを打ち出したい方",
        "春らしいビジュアルを探している方",
      ],
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
      meta_transparent: raw.meta_transparent || enriched.meta_transparent,
      long_description: raw.long_description || enriched.long_description,
      recommended_for: raw.recommended_for || enriched.recommended_for,
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

  global.TasuMaterialsIllustrationDetail = {
    mount,
    destroy,
    resolveQaItem,
    resolveQaRelated,
    isIllustrationItem(item) {
      return !!(item && item.category_id === "illustration");
    },
    resolvePreviewSrc,
  };
})(typeof window !== "undefined" ? window : globalThis);
