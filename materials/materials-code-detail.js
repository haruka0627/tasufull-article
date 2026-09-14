/**
 * TASFUL Materials — コード素材 詳細 Option 4 UI（category=code のみ）
 * 公開表示名「コード素材」（CATEGORIES.name「コードスニペット」は変更しない）。
 * Code / Download / Favorite / Related は既存 Contract 接続。実行 sandbox 追加なし。
 * 言語は file_formats / 既知 tags / 明示 meta のみ（本文からの推測禁止）。
 */
(function (global) {
  "use strict";

  const DISPLAY_NAME = "コード素材";
  /** Desktop 4列1段で完結（「すべて見る」で残りへ） */
  const RELATED_DISPLAY_LIMIT = 4;
  const OPS_BLUE = "#2563eb";
  const GENERIC_TAGS = new Set([
    "code",
    "code-material",
    "コード",
    "コード素材",
    "スニペット",
  ]);

  const FORMAT_LABELS = Object.freeze({
    PY: "Python",
    PYTHON: "Python",
    JS: "JavaScript",
    TS: "TypeScript",
    HTML: "HTML",
    CSS: "CSS",
    SQL: "SQL",
    JSON: "JSON",
    SH: "Shell",
    SHELL: "Shell",
    PHP: "PHP",
    CSV: "CSV",
  });

  /** enrichDetail が CATEGORY_META_DEFAULTS から載せるプレースホルダ（捏造表示を避ける） */
  const CODE_META_PLACEHOLDERS = Object.freeze({
    file_size: "約 0.05 MB",
    meta_pages: "3ファイル",
    meta_language: "HTML / CSS / JS",
    meta_compatibility: "モダンブラウザ",
    meta_browser_support: "モダンブラウザ対応",
    meta_difficulty: "初級",
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

  function formatLabel(fmt) {
    const key = String(fmt || "").toUpperCase();
    return FORMAT_LABELS[key] || key;
  }

  function itemTags(item) {
    return (item.tags || [])
      .map((t) => String(t).trim())
      .filter((t) => t && !GENERIC_TAGS.has(t.toLowerCase()) && !GENERIC_TAGS.has(t));
  }

  function languageBadge(item) {
    const formats = item.file_formats || [];
    if (formats.length) {
      return formats.slice(0, 3).map((f) => formatLabel(f)).join(" / ");
    }
    const tags = itemTags(item);
    const langTag = tags.find(
      (t) => FORMAT_LABELS[String(t).toUpperCase()] || /^(python|javascript|typescript|react|php|html|css)$/i.test(t)
    );
    if (langTag) return FORMAT_LABELS[String(langTag).toUpperCase()] || langTag;
    const meta = pickStr(item.meta_language);
    if (meta && meta !== "—" && meta !== CODE_META_PLACEHOLDERS.meta_language) {
      return meta.split(/[/·,]/)[0].trim();
    }
    return "";
  }

  function realMeta(value, placeholderKey) {
    const s = pickStr(value);
    if (!s || s === "—") return "";
    const ph = CODE_META_PLACEHOLDERS[placeholderKey];
    if (ph && s === ph) return "";
    if (Object.values(CODE_META_PLACEHOLDERS).includes(s)) return "";
    return s;
  }

  function listHref() {
    return "/materials/list.html?category=code";
  }

  function detailHref(item) {
    return `detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
  }

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(String(url || ""));
  }

  function resolvePreviewSrc(item) {
    const images = Array.isArray(item.preview_images) ? item.preview_images : [];
    const first = images[0];
    const fromPreview = pickStr(
      first && (first.src || first.url || first),
      typeof first === "string" ? first : ""
    );
    const candidates = [fromPreview, item.thumbnail_url, item.preview_image, item.preview_url, item.image_url, item.image];
    for (let i = 0; i < candidates.length; i += 1) {
      const u = pickStr(candidates[i]);
      if (u && isImageUrl(u)) return u;
    }
    return "";
  }

  /** 既存 Contract の code_files / code_preview のみ（プレースホルダ本文は除外） */
  function resolveCodePanels(item) {
    const files = Array.isArray(item.code_files) ? item.code_files : [];
    const realFiles = files
      .map((f) => ({
        filename: pickStr(f.filename, "snippet"),
        language: pickStr(f.language, "text"),
        label: pickStr(f.label, f.language, f.filename, "Code"),
        content: pickStr(f.content),
      }))
      .filter((f) => f.content && !/ダウンロード後に内容を確認/.test(f.content));

    if (realFiles.length) return realFiles;

    const preview = pickStr(item.code_preview);
    if (preview) {
      const lang = languageBadge(item) || "Code";
      return [{ filename: "snippet", language: "text", label: lang.split(" / ")[0] || "Code", content: preview }];
    }
    return [];
  }

  function formatSelectLabel(item) {
    if (item.download_kind === "zip" || /\.zip(\?|#|$)/i.test(String(item.download_url || ""))) {
      const parts = (item.file_formats || []).map((f) => String(f).toUpperCase());
      return parts.length ? `ZIP（${parts.join(" / ")}）` : "ZIP（圧縮ファイル）";
    }
    const formats = item.file_formats || [];
    if (formats.length) return formats.map((f) => String(f).toUpperCase()).join(" / ");
    return "—";
  }

  function buildInfoRows(item) {
    const lang = languageBadge(item);
    const fileSize = realMeta(item.file_size, "file_size") || realMeta(item.meta_file_size, "file_size");
    const fileCount = realMeta(item.meta_pages, "meta_pages");
    const browser =
      realMeta(item.meta_browser_support, "meta_browser_support") ||
      realMeta(item.meta_compatibility, "meta_compatibility");
    const published = pickStr(item.meta_published, item.meta_updated);
    const license = pickStr(item.license_label, item.commercial_use);

    return [
      ["言語 / 形式", lang || "—"],
      ["ファイル形式", formatSelectLabel(item)],
      ["ファイルサイズ", fileSize || "—"],
      ["ファイル数", fileCount || "—"],
      ["対応ブラウザ", browser || "—"],
      ["カテゴリ", DISPLAY_NAME],
      ["ライセンス", license && license !== "—" ? license : "—"],
      ["公開日", published || "—"],
      ["素材ID", pickStr(item.slug, item.id)],
    ];
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

  function renderCodeLines(content) {
    const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
    if (!lines.length || (lines.length === 1 && !lines[0])) {
      return `<div class="mat-code-d-code__empty">コードプレビューは準備中です</div>`;
    }
    return lines
      .map((line, i) => {
        const n = i + 1;
        return (
          `<div class="mat-code-d-code__line">` +
          `<span class="mat-code-d-code__ln" aria-hidden="true">${n}</span>` +
          `<span class="mat-code-d-code__text">${escapeHtml(line) || " "}</span>` +
          `</div>`
        );
      })
      .join("");
  }

  function renderRelatedCard(item) {
    const href = detailHref(item);
    const thumb = resolvePreviewSrc(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const lang = languageBadge(item);
    const snippet = pickStr(item.code_preview);
    return (
      `<article class="mat-code-d-related-card" data-code-d-related data-item-id="${escapeHtml(item.id)}">` +
      `<a class="mat-code-d-related-card__media" href="${href}" aria-label="${escapeHtml(item.title)}">` +
      `<span class="mat-code-d-related-card__badges">` +
      `<span class="mat-code-d-related-card__badge">${DISPLAY_NAME}</span>` +
      (item.is_free !== false ? `<span class="mat-code-d-related-card__free">無料</span>` : "") +
      `</span>` +
      (thumb
        ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
        : snippet
          ? `<pre class="mat-code-d-related-card__snippet"><code>${escapeHtml(snippet.slice(0, 160))}</code></pre>`
          : `<span class="mat-code-d-related-card__fallback" aria-hidden="true"><span>&lt;/&gt;</span>${lang ? `<small>${escapeHtml(lang)}</small>` : ""}</span>`) +
      `</a>` +
      `<h3 class="mat-code-d-related-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<div class="mat-code-d-related-card__foot">` +
      `<span class="mat-code-d-related-card__meta"><span class="mat-code-d-star" aria-hidden="true">★</span>${rating}</span>` +
      `<span class="mat-code-d-related-card__meta"><span aria-hidden="true">↓</span>${dl}</span>` +
      `<button type="button" class="mat-code-d-related-card__dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
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
    const rating = Number(item.rating || 0).toFixed(1);
    const ratingCount = Number(item.rating_count || 0);
    const hrefList = listHref();
    const desc = pickStr(item.long_description, item.description) || "コード素材です。";
    const relatedCode = (related || []).filter((r) => r && r.category_id === "code" && r.id !== item.id);
    const infoRows = buildInfoRows(item);
    const usageLines = usageLinesFromItem(item);
    const panels = resolveCodePanels(item);
    const hasCode = panels.length > 0;
    const previewSrc = resolvePreviewSrc(item);
    const lang = languageBadge(item);
    const licenseLead = pickStr(item.commercial_use, "商用利用OK・クレジット表記不要");
    const formatSel = formatSelectLabel(item);

    const tabButtons = hasCode
      ? panels
          .map(
            (p, i) =>
              `<button type="button" class="mat-code-d-code__tab${i === 0 ? " is-active" : ""}" role="tab" aria-selected="${i === 0 ? "true" : "false"}" data-code-d-tab="${i}">${escapeHtml(p.label)}</button>`
          )
          .join("")
      : `<button type="button" class="mat-code-d-code__tab is-active" role="tab" aria-selected="true" disabled>${escapeHtml(lang || "Code")}</button>`;

    const panelHtml = hasCode
      ? panels
          .map(
            (p, i) =>
              `<div class="mat-code-d-code__panel${i === 0 ? " is-active" : ""}" data-code-d-panel="${i}"${i === 0 ? "" : " hidden"} data-code-d-content>${renderCodeLines(p.content)}</div>`
          )
          .join("")
      : `<div class="mat-code-d-code__panel is-active" data-code-d-panel="0">` +
        `<div class="mat-code-d-code__placeholder">` +
        `<span class="mat-code-d-code__placeholder-ico" aria-hidden="true">&lt;/&gt;</span>` +
        `<p>コードプレビューはまだありません</p>` +
        `<p class="mat-code-d-code__placeholder-note">ダウンロードで本体を取得できます</p>` +
        `</div></div>`;

    const copyButtons = hasCode
      ? panels
          .map(
            (p, i) =>
              `<button type="button" class="mat-code-d-action" data-code-d-copy="${i}">${escapeHtml(p.label)}をコピー</button>`
          )
          .join("")
      : `<button type="button" class="mat-code-d-action" disabled>コードをコピー</button>`;

    return (
      `<div class="mat-code-d" data-code-detail data-item-id="${escapeHtml(item.id)}" style="--mat-code-ops:${OPS_BLUE}">` +
      `<div class="mat-code-d-back-mobile">` +
      `<a href="${hrefList}"><span aria-hidden="true">‹</span> コード素材一覧に戻る</a>` +
      `</div>` +
      `<nav class="mat-code-d-crumb" aria-label="パンくず">` +
      `<a href="/materials/">ホーム</a><span aria-hidden="true">›</span>` +
      `<a href="/materials/index.html">素材を探す</a><span aria-hidden="true">›</span>` +
      `<a href="${hrefList}">コード素材一覧</a><span aria-hidden="true">›</span>` +
      `<span aria-current="page">${escapeHtml(item.title)}</span>` +
      `</nav>` +
      `<div class="mat-code-d-layout">` +
      `<div class="mat-code-d-main">` +
      `<header class="mat-code-d-head">` +
      `<div class="mat-code-d-head__badges">` +
      `<span class="mat-code-d-badge">${DISPLAY_NAME}</span>` +
      (item.is_free !== false ? `<span class="mat-code-d-free">無料</span>` : "") +
      (lang ? `<span class="mat-code-d-lang">${escapeHtml(lang)}</span>` : "") +
      `</div>` +
      `<h1 class="mat-code-d-title">${escapeHtml(item.title)}</h1>` +
      `<p class="mat-code-d-lead">${escapeHtml(item.description || "")}</p>` +
      `<div class="mat-code-d-tags">` +
      tags.map((t) => `<span class="mat-code-d-tag">${escapeHtml(t)}</span>`).join("") +
      `</div>` +
      `<div class="mat-code-d-stats">` +
      `<span class="mat-code-d-stats__rating"><span class="mat-code-d-star" aria-hidden="true">★</span>` +
      `<b>${rating}</b>${ratingCount ? `<span class="mat-code-d-stats__count">(${formatCount(ratingCount)})</span>` : ""}</span>` +
      `<span class="mat-code-d-stats__dl"><span aria-hidden="true">↓</span><b>${formatCount(item.download_count)}</b>` +
      `<span class="mat-code-d-stats__dl-label">ダウンロード</span></span>` +
      `<button type="button" class="mat-code-d-stats__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<span class="mat-code-d-heart" aria-hidden="true"></span>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</div>` +
      `</header>` +
      `<section class="mat-code-d-code" aria-label="コードプレビュー">` +
      `<div class="mat-code-d-code__toolbar">` +
      `<div class="mat-code-d-code__tabs" role="tablist" aria-label="コードファイル">${tabButtons}</div>` +
      `<button type="button" class="mat-code-d-code__fullscreen" disabled>全画面で表示</button>` +
      `</div>` +
      `<div class="mat-code-d-code__body">${panelHtml}</div>` +
      `</section>` +
      `<div class="mat-code-d-actions">` +
      `<button type="button" class="mat-code-d-action mat-code-d-action--primary" disabled>プレビュー</button>` +
      copyButtons +
      `<button type="button" class="mat-code-d-action mat-code-d-action--dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      `<span aria-hidden="true">↓</span> <span data-mat-download-label>${escapeHtml(dlLabel)}</span>` +
      `</button>` +
      `</div>` +
      `<div class="mat-code-d-tabs" data-code-d-tabs>` +
      `<div class="mat-code-d-tabs__nav" role="tablist" aria-label="詳細タブ">` +
      `<button type="button" class="mat-code-d-tabs__tab is-active" role="tab" aria-selected="true" data-code-d-sect="desc">説明</button>` +
      `<button type="button" class="mat-code-d-tabs__tab" role="tab" aria-selected="false" data-code-d-sect="usage">利用シーン</button>` +
      `<button type="button" class="mat-code-d-tabs__tab" role="tab" aria-selected="false" data-code-d-sect="custom">カスタマイズ方法</button>` +
      `<button type="button" class="mat-code-d-tabs__tab" role="tab" aria-selected="false" data-code-d-sect="related">関連素材</button>` +
      `<button type="button" class="mat-code-d-tabs__tab" role="tab" aria-selected="false" data-code-d-sect="comments">コメント</button>` +
      `</div>` +
      `<div class="mat-code-d-tabs__panel is-active" data-code-d-sect-panel="desc">` +
      `<div class="mat-code-d-desc-grid">` +
      `<div>` +
      `<p class="mat-code-d-desc">${escapeHtml(desc)}</p>` +
      (usageLines.length
        ? `<ul class="mat-code-d-bullets">${usageLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
        : "") +
      `</div>` +
      `<div class="mat-code-d-desc-aside" aria-hidden="true">` +
      (previewSrc
        ? `<img src="${escapeHtml(previewSrc)}" alt="" loading="lazy" decoding="async">`
        : `<span class="mat-code-d-desc-aside__ph">&lt;/&gt;</span>`) +
      `</div>` +
      `</div>` +
      `</div>` +
      `<div class="mat-code-d-tabs__panel" data-code-d-sect-panel="usage" hidden>` +
      (usageLines.length
        ? `<ul class="mat-code-d-bullets">${usageLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
        : `<p class="mat-code-d-empty-note">利用シーンデータはまだありません。</p>`) +
      `</div>` +
      `<div class="mat-code-d-tabs__panel" data-code-d-sect-panel="custom" hidden>` +
      `<p class="mat-code-d-empty-note">カスタマイズ手順は準備中です。</p>` +
      `</div>` +
      `<div class="mat-code-d-tabs__panel" data-code-d-sect-panel="related" hidden>` +
      `<p class="mat-code-d-empty-note">下記の関連コード素材セクションをご覧ください。</p>` +
      `</div>` +
      `<div class="mat-code-d-tabs__panel" data-code-d-sect-panel="comments" hidden>` +
      `<p class="mat-code-d-empty-note">コメント機能は準備中です。</p>` +
      `</div>` +
      `</div>` +
      `<section class="mat-code-d-related" aria-labelledby="matCodeRelatedTitle">` +
      `<div class="mat-code-d-related__head">` +
      `<h2 id="matCodeRelatedTitle"><span class="mat-code-d-related__ico" aria-hidden="true">〰</span>この素材を使用している人はこちらの素材も使っています</h2>` +
      `<a href="${hrefList}">すべて見る ›</a>` +
      `</div>` +
      (relatedCode.length
        ? `<div class="mat-code-d-related__grid">${relatedCode.slice(0, RELATED_DISPLAY_LIMIT).map(renderRelatedCard).join("")}</div>`
        : `<p class="mat-code-d-empty-note">関連するコード素材はまだありません。</p>`) +
      `</section>` +
      `</div>` +
      `<aside class="mat-code-d-aside" aria-label="コード素材サイドバー">` +
      `<a class="mat-code-d-aside__back" href="${hrefList}"><span aria-hidden="true">‹</span> コード素材一覧に戻る</a>` +
      `<div class="mat-code-d-side-card">` +
      `<h3 class="mat-code-d-side-card__title"><span class="mat-code-d-side-card__accent" aria-hidden="true">↓</span>ダウンロード</h3>` +
      `<p class="mat-detail-dl-hint" data-mat-dl-hint></p>` +
      `<div class="mat-code-d-fields">` +
      `<label class="mat-code-d-field"><span>ファイル形式</span>` +
      `<select aria-label="ファイル形式"><option selected>${escapeHtml(formatSel)}</option></select></label>` +
      `<label class="mat-code-d-field"><span>ライセンス</span>` +
      `<select disabled aria-label="ライセンス"><option>標準ライセンス</option></select></label>` +
      `</div>` +
      `<button type="button" class="mat-code-d-dl-cta" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      `<span data-mat-download-label>${escapeHtml(dlLabel)}</span>` +
      `</button>` +
      `<p class="mat-code-d-dl-note">※ クレジット表記不要で、商用利用が可能です</p>` +
      `</div>` +
      `<div class="mat-code-d-side-card">` +
      `<h3 class="mat-code-d-side-card__title"><span class="mat-code-d-side-card__accent" aria-hidden="true">☰</span>素材情報</h3>` +
      `<dl class="mat-code-d-info">` +
      infoRows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("") +
      `</dl>` +
      `</div>` +
      `<div class="mat-code-d-side-card">` +
      `<h3 class="mat-code-d-side-card__title"><span class="mat-code-d-side-card__accent" aria-hidden="true">#</span>タグ</h3>` +
      `<div class="mat-code-d-side-tags">` +
      tags
        .map(
          (t) =>
            `<a class="mat-code-d-side-tag" href="/materials/list.html?category=code&q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`
        )
        .join("") +
      `</div>` +
      (tags.length
        ? `<a class="mat-code-d-side-more" href="${hrefList}">すべてのタグを見る (${tags.length}) ›</a>`
        : `<p class="mat-code-d-empty-note">タグはありません。</p>`) +
      `</div>` +
      `<div class="mat-code-d-side-card">` +
      `<h3 class="mat-code-d-side-card__title">ライセンス</h3>` +
      `<p class="mat-code-d-license__lead">${escapeHtml(licenseLead)}</p>` +
      `<p class="mat-code-d-license__sub">再配布・販売は禁止されています</p>` +
      `<a class="mat-code-d-license__link" href="/company/legal/materials.html">ライセンス詳細を見る ›</a>` +
      `</div>` +
      `<button type="button" class="mat-code-d-rail-fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<span class="mat-code-d-heart" aria-hidden="true"></span>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</aside>` +
      `</div>` +
      `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
  }

  function wireCodeTabs(root) {
    const tabs = root.querySelectorAll("[data-code-d-tab]");
    const panels = root.querySelectorAll("[data-code-d-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        if (tab.disabled) return;
        const id = tab.getAttribute("data-code-d-tab");
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach((p) => {
          const on = p.getAttribute("data-code-d-panel") === id;
          p.classList.toggle("is-active", on);
          p.hidden = !on;
        });
      });
    });
  }

  function wireSectionTabs(root) {
    const tabs = root.querySelectorAll("[data-code-d-sect]");
    const panels = root.querySelectorAll("[data-code-d-sect-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-code-d-sect");
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach((p) => {
          const on = p.getAttribute("data-code-d-sect-panel") === id;
          p.classList.toggle("is-active", on);
          p.hidden = !on;
        });
      });
    });
  }

  function copyText(text) {
    const value = String(text || "");
    if (!value) return Promise.resolve(false);
    if (navigator.clipboard && global.isSecureContext) {
      return navigator.clipboard.writeText(value).then(
        () => true,
        () => fallbackCopy(value)
      );
    }
    return Promise.resolve(fallbackCopy(value));
  }

  function fallbackCopy(value) {
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

  function showToast(root, message) {
    const toast = root.querySelector("[data-mat-toast]");
    if (!toast) return;
    toast.hidden = false;
    toast.textContent = message;
    setTimeout(() => {
      toast.hidden = true;
    }, 1600);
  }

  function wireCopy(root) {
    root.querySelectorAll("[data-code-d-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = btn.getAttribute("data-code-d-copy");
        const panel = root.querySelector(`[data-code-d-panel="${idx}"]`);
        const text =
          panel?.querySelectorAll(".mat-code-d-code__text")
            ? [...panel.querySelectorAll(".mat-code-d-code__text")].map((el) => el.textContent).join("\n")
            : panel?.textContent || "";
        copyText(text).then((ok) => {
          if (!ok) return;
          const prev = btn.textContent;
          btn.textContent = "コピーしました";
          btn.classList.add("is-copied");
          showToast(root, "コードをコピーしました");
          setTimeout(() => {
            btn.textContent = prev;
            btn.classList.remove("is-copied");
          }, 1600);
        });
      });
    });
  }

  async function mount(root, item, related) {
    if (!root || !item || item.category_id !== "code") return false;

    const relatedList = related || [];
    root.innerHTML = renderShell(item, relatedList);
    document.title = `${item.title} | TASFUL Materials`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", item.description || "");

    wireCodeTabs(root);
    wireSectionTabs(root);
    wireCopy(root);

    global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(root, item);

    const byId = new Map(relatedList.map((r) => [r.id, r]));
    root.querySelectorAll("[data-code-d-related]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const rel = byId.get(id);
      if (rel) global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(card, rel);
    });

    return true;
  }

  function destroy() {
    /* no-op */
  }

  global.TasuMaterialsCodeDetail = {
    mount,
    destroy,
    isCodeItem(item) {
      return !!(item && item.category_id === "code");
    },
    DISPLAY_NAME,
  };
})(typeof window !== "undefined" ? window : globalThis);
