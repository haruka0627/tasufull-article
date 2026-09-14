/**
 * TASFUL Materials — 文例・文章テンプレート 詳細 Option 4 UI（category_id=document のみ）
 * URL 一覧 query: category=text / 公開表示名「文例・文章テンプレート」
 * CATEGORIES.id `document` と query id `text` は変更しない。
 * Text / Copy / Download / Favorite / Related は既存 Contract 接続。
 * 公開 Inventory 0件時は ?qa_fixture=1 の未コミット fixture のみ。
 */
(function (global) {
  "use strict";

  const DISPLAY_NAME = "文例・文章テンプレート";
  const QUERY_CATEGORY = "text";
  const DATA_CATEGORY = "document";
  const ACCENT = "#5D50E6";

  const GENERIC_TAGS = new Set([
    "document",
    "文書",
    "文書テンプレート",
    "文章",
    "文章素材",
    "text",
  ]);

  /** enrichDetail のプレースホルダ（捏造表示回避） */
  const DOC_META_PLACEHOLDERS = Object.freeze({
    meta_char_count: "約800文字",
    meta_document_usage: "ビジネス文書",
    file_size: "約 0.1 MB",
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

  function isQaFixtureMode() {
    return new URLSearchParams(global.location.search).get("qa_fixture") === "1";
  }

  function listHref() {
    const base = `/materials/list.html?category=${QUERY_CATEGORY}`;
    return isQaFixtureMode() ? `${base}&qa_fixture=1` : base;
  }

  function detailHref(item) {
    const qs = new URLSearchParams();
    qs.set("slug", String(item.slug || item.id || ""));
    if (isQaFixtureMode() || item._qa_fixture) qs.set("qa_fixture", "1");
    return `detail.html?${qs.toString()}`;
  }

  function itemTags(item) {
    return (item.tags || [])
      .map((t) => String(t).trim())
      .filter((t) => t && !GENERIC_TAGS.has(t.toLowerCase()) && !GENERIC_TAGS.has(t));
  }

  function realMeta(value, placeholderKey) {
    const s = pickStr(value);
    if (!s || s === "—") return "";
    const ph = DOC_META_PLACEHOLDERS[placeholderKey];
    if (ph && s === ph) return "";
    if (Object.values(DOC_META_PLACEHOLDERS).includes(s)) return "";
    return s;
  }

  function formatSelectLabel(item) {
    const formats = item.file_formats || [];
    if (formats.length) {
      const primary = String(formats[0]).toUpperCase();
      const rest = formats.map((f) => String(f).toUpperCase()).join(" / ");
      if (primary === "TXT") return `TXT（テキスト）`;
      return rest;
    }
    return "—";
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

  /** 既存 classic と同契約の Copy 本文（document_preview のみ） */
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
    return {
      heading,
      body,
      plain: body,
    };
  }

  function stripUnsafe(text) {
    return String(text || "").replace(/<[^>]*>/g, "");
  }

  function nl2brEscaped(text) {
    return escapeHtml(stripUnsafe(text)).replace(/\r\n|\r|\n/g, "<br>");
  }

  function hasDocumentBody(item) {
    const copy = buildDocumentCopyContent(item);
    return !!pickStr(copy.body);
  }

  /** Option 4 本文プレビュー（plain text 安全表示） */
  function renderDocumentPaper(item) {
    const doc = item.document_preview || {};
    if (!hasDocumentBody(item)) {
      return (
        `<div class="mat-doc-d-paper mat-doc-d-paper--empty">` +
        `<p>本文プレビューはまだありません</p>` +
        `</div>`
      );
    }

    const parts = [];

    if (doc.sections?.length) {
      doc.sections.forEach((section) => {
        if (section.heading) {
          parts.push(
            `<h3 class="mat-doc-d-paper__h">${escapeHtml(stripUnsafe(section.heading))}</h3>`
          );
        }
        if (section.body) {
          parts.push(`<p class="mat-doc-d-paper__p">${nl2brEscaped(section.body)}</p>`);
        }
        if (section.bullets?.length) {
          parts.push(
            `<ul class="mat-doc-d-paper__ul">` +
              section.bullets
                .map(
                  (b) =>
                    `<li><span class="mat-doc-d-paper__check" aria-hidden="true">✓</span>${escapeHtml(stripUnsafe(b))}</li>`
                )
                .join("") +
              `</ul>`
          );
        }
        (section.fields || []).forEach((field) => {
          parts.push(
            `<p class="mat-doc-d-paper__p"><strong>${escapeHtml(stripUnsafe(field.label))}：</strong>${escapeHtml(stripUnsafe(field.value))}</p>`
          );
        });
      });
    } else {
      if (doc.title) {
        parts.push(`<h3 class="mat-doc-d-paper__h">${escapeHtml(stripUnsafe(doc.title))}</h3>`);
      }
      if (doc.date_label) {
        parts.push(`<p class="mat-doc-d-paper__meta">${escapeHtml(stripUnsafe(doc.date_label))}</p>`);
      }
      if (doc.greeting) {
        parts.push(`<p class="mat-doc-d-paper__p">${nl2brEscaped(doc.greeting)}</p>`);
      }
      if (doc.body) {
        parts.push(`<p class="mat-doc-d-paper__p">${nl2brEscaped(doc.body)}</p>`);
      }
      if (doc.bullets?.length) {
        parts.push(
          `<ul class="mat-doc-d-paper__ul">` +
            doc.bullets
              .map(
                (b) =>
                  `<li><span class="mat-doc-d-paper__check" aria-hidden="true">✓</span>${escapeHtml(stripUnsafe(b))}</li>`
              )
              .join("") +
            `</ul>`
        );
      }
      if (doc.signoff) {
        parts.push(`<p class="mat-doc-d-paper__p">${nl2brEscaped(doc.signoff)}</p>`);
      }
      if (doc.signature) {
        const sig = [doc.signature.company, doc.signature.department, doc.signature.name]
          .map((x) => pickStr(x))
          .filter(Boolean);
        if (sig.length) {
          parts.push(`<p class="mat-doc-d-paper__p">${sig.map((s) => escapeHtml(s)).join("<br>")}</p>`);
        }
      }
    }

    return `<div class="mat-doc-d-paper" data-doc-d-paper>${parts.join("")}</div>`;
  }

  function buildInfoRows(item) {
    const formats = formatSelectLabel(item);
    const fileSize = realMeta(item.file_size, "file_size") || realMeta(item.meta_file_size, "file_size");
    const charCount =
      realMeta(item.meta_char_count, "meta_char_count") ||
      realMeta(item.document_char_count, "meta_char_count");
    const usage =
      realMeta(item.document_usage, "meta_document_usage") ||
      realMeta(item.meta_document_usage, "meta_document_usage");
    const lang = pickStr(item.meta_language, item.language);
    const published = publishedLabel(item);
    const license = pickStr(item.license_label, item.commercial_use);

    return [
      ["カテゴリ", DISPLAY_NAME],
      ["ファイル形式", formats],
      ["ファイルサイズ", fileSize || "—"],
      ["文字数", charCount || "—"],
      ["行数", "—"],
      ["言語", lang && lang !== "—" ? lang : "—"],
      ["用途", usage || "—"],
      ["公開日", published || "—"],
      ["素材ID", pickStr(item.slug, item.id)],
      ["ライセンス", license && license !== "—" ? license : "—"],
    ];
  }

  function usageLinesFromItem(item) {
    const fromRecommended = (item.recommended_for || item.usage_tags || [])
      .map((x) => String(x).trim())
      .filter(Boolean);
    if (fromRecommended.length) return fromRecommended.slice(0, 5);
    const usage = pickStr(item.document_usage, item.meta_document_usage);
    if (usage && usage !== DOC_META_PLACEHOLDERS.meta_document_usage) return [usage];
    return [];
  }

  function textPreviewSnippet(item) {
    const copy = buildDocumentCopyContent(item);
    const text = stripUnsafe(copy.body || item.description || "");
    if (!text) return "";
    const oneLine = text.replace(/\s+/g, " ").trim();
    return oneLine.length > 90 ? oneLine.slice(0, 87) + "…" : oneLine;
  }

  function renderRelatedCard(item) {
    const href = detailHref(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const tags = itemTags(item).slice(0, 3);
    const preview = textPreviewSnippet(item);
    return (
      `<article class="mat-doc-d-related-card" data-doc-d-related data-item-id="${escapeHtml(item.id)}">` +
      `<a class="mat-doc-d-related-card__link" href="${href}">` +
      `<span class="mat-doc-d-related-card__badges">` +
      `<span class="mat-doc-d-related-card__badge">${DISPLAY_NAME}</span>` +
      (item.is_free !== false ? `<span class="mat-doc-d-related-card__free">無料</span>` : "") +
      `</span>` +
      `<h3 class="mat-doc-d-related-card__title">${escapeHtml(item.title)}</h3>` +
      (preview
        ? `<p class="mat-doc-d-related-card__preview">${escapeHtml(preview)}</p>`
        : `<p class="mat-doc-d-related-card__preview mat-doc-d-related-card__preview--empty">プレビュー準備中</p>`) +
      `<div class="mat-doc-d-related-card__tags">${tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>` +
      `<div class="mat-doc-d-related-card__foot">` +
      `<span><span class="mat-doc-d-star" aria-hidden="true">★</span>${rating}</span>` +
      `<span><span aria-hidden="true">↓</span>${dl}</span>` +
      `</div>` +
      `</a>` +
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
    const desc = pickStr(item.long_description, item.description) || `${DISPLAY_NAME}です。`;
    const relatedDocs = (related || []).filter(
      (r) => r && r.category_id === DATA_CATEGORY && r.id !== item.id
    );
    const infoRows = buildInfoRows(item);
    const usageLines = usageLinesFromItem(item);
    const hasBody = hasDocumentBody(item);
    const licenseLead = pickStr(item.commercial_use, "商用利用OK・クレジット表記不要");
    const formatSel = formatSelectLabel(item);
    const copyReady = hasBody;

    const tagChips = tags.map((t) => `<span class="mat-doc-d-tag">${escapeHtml(t)}</span>`).join("");

    const sideTags = tags
      .map(
        (t) =>
          `<a class="mat-doc-d-side-tag" href="/materials/list.html?category=${QUERY_CATEGORY}&q=${encodeURIComponent(t)}${isQaFixtureMode() ? "&qa_fixture=1" : ""}">${escapeHtml(t)}</a>`
      )
      .join("");

    return (
      `<div class="mat-doc-d" data-doc-detail data-item-id="${escapeHtml(item.id)}" style="--mat-doc-ops:${ACCENT}">` +
      `<div class="mat-doc-d-back-mobile">` +
      `<a href="${hrefList}"><span aria-hidden="true">‹</span> ${DISPLAY_NAME}一覧に戻る</a>` +
      `</div>` +
      `<nav class="mat-doc-d-crumb" aria-label="パンくず">` +
      `<a href="/materials/">ホーム</a><span aria-hidden="true">›</span>` +
      `<a href="/materials/index.html">素材を探す</a><span aria-hidden="true">›</span>` +
      `<a href="${hrefList}">${DISPLAY_NAME}一覧</a><span aria-hidden="true">›</span>` +
      `<span aria-current="page">${escapeHtml(item.title)}</span>` +
      `</nav>` +
      `<div class="mat-doc-d-layout">` +
      `<section class="mat-doc-d-main">` +
      `<div class="mat-doc-d-head__badges">` +
      `<span class="mat-doc-d-badge">${DISPLAY_NAME}</span>` +
      (item.is_free !== false ? `<span class="mat-doc-d-free">無料</span>` : "") +
      `</div>` +
      `<h1 class="mat-doc-d-title">${escapeHtml(item.title)}</h1>` +
      `<p class="mat-doc-d-lead">${escapeHtml(item.description || "")}</p>` +
      `<div class="mat-doc-d-tags">${tagChips}</div>` +
      `<div class="mat-doc-d-stats">` +
      `<span class="mat-doc-d-stats__rating"><span class="mat-doc-d-star" aria-hidden="true">★</span>` +
      `<b>${rating}</b>${ratingCount ? `<span class="mat-doc-d-stats__count">（${formatCount(ratingCount)}）</span>` : ""}</span>` +
      `<span class="mat-doc-d-stats__dl"><span aria-hidden="true">↓</span>${formatCount(item.download_count)} ダウンロード</span>` +
      `<button type="button" class="mat-doc-d-stats__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<span class="mat-doc-d-heart" aria-hidden="true"></span>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      (copyReady
        ? `<button type="button" class="mat-doc-d-stats__copy" data-doc-d-copy="body">本文をコピー</button>`
        : `<button type="button" class="mat-doc-d-stats__copy" disabled>本文をコピー</button>`) +
      `</div>` +
      renderDocumentPaper(item) +
      `<div class="mat-doc-d-actions">` +
      (copyReady
        ? `<button type="button" class="mat-doc-d-action mat-doc-d-action--primary" data-doc-d-copy="body">本文をコピー</button>`
        : `<button type="button" class="mat-doc-d-action mat-doc-d-action--primary" disabled>本文をコピー</button>`) +
      `<button type="button" class="mat-doc-d-action mat-doc-d-action--dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      `<span aria-hidden="true">↓</span> <span data-mat-download-label>${escapeHtml(dlLabel)}</span>` +
      `</button>` +
      `</div>` +
      `<div class="mat-doc-d-tabs" data-doc-d-tabs>` +
      `<div class="mat-doc-d-tabs__nav" role="tablist" aria-label="詳細タブ">` +
      `<button type="button" class="mat-doc-d-tabs__tab is-active" role="tab" aria-selected="true" data-doc-d-sect="desc">説明</button>` +
      `<button type="button" class="mat-doc-d-tabs__tab" role="tab" aria-selected="false" data-doc-d-sect="usage">利用シーン</button>` +
      `<button type="button" class="mat-doc-d-tabs__tab" role="tab" aria-selected="false" data-doc-d-sect="custom">カスタマイズ方法</button>` +
      `<button type="button" class="mat-doc-d-tabs__tab" role="tab" aria-selected="false" data-doc-d-sect="related">関連素材</button>` +
      `<button type="button" class="mat-doc-d-tabs__tab" role="tab" aria-selected="false" data-doc-d-sect="comments">コメント</button>` +
      `</div>` +
      `<div class="mat-doc-d-tabs__panel is-active" data-doc-d-sect-panel="desc">` +
      `<div class="mat-doc-d-desc-grid">` +
      `<div>` +
      `<p class="mat-doc-d-desc">${nl2brEscaped(desc)}</p>` +
      (usageLines.length
        ? `<ul class="mat-doc-d-bullets">${usageLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
        : "") +
      `</div>` +
      `</div>` +
      `</div>` +
      `<div class="mat-doc-d-tabs__panel" data-doc-d-sect-panel="usage" hidden>` +
      (usageLines.length
        ? `<ul class="mat-doc-d-bullets">${usageLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
        : `<p class="mat-doc-d-empty-note">利用シーンデータはまだありません。</p>`) +
      `</div>` +
      `<div class="mat-doc-d-tabs__panel" data-doc-d-sect-panel="custom" hidden>` +
      `<p class="mat-doc-d-empty-note">カスタマイズ手順は準備中です。</p>` +
      `</div>` +
      `<div class="mat-doc-d-tabs__panel" data-doc-d-sect-panel="related" hidden>` +
      `<p class="mat-doc-d-empty-note">下記の関連${DISPLAY_NAME}セクションをご覧ください。</p>` +
      `</div>` +
      `<div class="mat-doc-d-tabs__panel" data-doc-d-sect-panel="comments" hidden>` +
      `<p class="mat-doc-d-empty-note">コメント機能は準備中です。</p>` +
      `</div>` +
      `</div>` +
      `<section class="mat-doc-d-related" aria-labelledby="matDocRelatedTitle">` +
      `<div class="mat-doc-d-related__head">` +
      `<h2 id="matDocRelatedTitle">関連する${DISPLAY_NAME}</h2>` +
      `<a href="${hrefList}">すべて見る ›</a>` +
      `</div>` +
      (relatedDocs.length
        ? `<div class="mat-doc-d-related__grid">${relatedDocs.slice(0, 5).map(renderRelatedCard).join("")}</div>`
        : `<p class="mat-doc-d-empty-note">関連する${DISPLAY_NAME}はまだありません。</p>`) +
      `</section>` +
      `</section>` +
      `<section class="mat-doc-d-mid" aria-label="ダウンロードと素材情報">` +
      `<div class="mat-doc-d-side-card">` +
      `<h2 class="mat-doc-d-side-card__title"><span class="mat-doc-d-side-card__accent" aria-hidden="true">↓</span>ダウンロード</h2>` +
      `<p class="mat-detail-dl-hint" data-mat-dl-hint></p>` +
      `<div class="mat-doc-d-fields">` +
      `<label class="mat-doc-d-field"><span>ファイル形式</span>` +
      `<select aria-label="ファイル形式"><option selected>${escapeHtml(formatSel)}</option></select></label>` +
      `<label class="mat-doc-d-field"><span>ライセンス</span>` +
      `<select disabled aria-label="ライセンス"><option>標準ライセンス</option></select></label>` +
      `</div>` +
      `<button type="button" class="mat-doc-d-dl-cta" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      `<span data-mat-download-label>${escapeHtml(dlLabel)}</span>` +
      `</button>` +
      `<p class="mat-doc-d-dl-note">※ クレジット表記不要で、商用利用が可能です</p>` +
      `</div>` +
      `<div class="mat-doc-d-side-card">` +
      `<h2 class="mat-doc-d-side-card__title"><span class="mat-doc-d-side-card__accent" aria-hidden="true">☰</span>素材情報</h2>` +
      `<dl class="mat-doc-d-info">` +
      infoRows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("") +
      `</dl>` +
      `</div>` +
      `<div class="mat-doc-d-side-card">` +
      `<h2 class="mat-doc-d-side-card__title"><span class="mat-doc-d-side-card__accent" aria-hidden="true">✓</span>ライセンス</h2>` +
      `<p class="mat-doc-d-license__lead">${escapeHtml(licenseLead)}</p>` +
      `<p class="mat-doc-d-license__sub">再配布・販売は禁止されています</p>` +
      `<a class="mat-doc-d-license__link" href="/company/legal/materials.html">ライセンス詳細を見る ›</a>` +
      `</div>` +
      `<div class="mat-doc-d-side-card">` +
      `<h2 class="mat-doc-d-side-card__title"><span class="mat-doc-d-side-card__accent" aria-hidden="true">#</span>タグ</h2>` +
      `<div class="mat-doc-d-side-tags">${sideTags || `<p class="mat-doc-d-empty-note">タグはありません。</p>`}</div>` +
      (tags.length
        ? `<a class="mat-doc-d-side-more" href="${hrefList}">すべてのタグを見る（${tags.length}） ›</a>`
        : "") +
      `</div>` +
      `</section>` +
      `<aside class="mat-doc-d-aside" aria-label="${DISPLAY_NAME}サイドバー">` +
      `<a class="mat-doc-d-aside__back" href="${hrefList}"><span aria-hidden="true">‹</span> ${DISPLAY_NAME}一覧に戻る</a>` +
      `<div class="mat-doc-d-side-card mat-doc-d-side-card--summary">` +
      `<div class="mat-doc-d-head__badges mat-doc-d-head__badges--sm">` +
      `<span class="mat-doc-d-badge">${DISPLAY_NAME}</span>` +
      (item.is_free !== false ? `<span class="mat-doc-d-free">無料</span>` : "") +
      `</div>` +
      `<h3 class="mat-doc-d-summary__title">${escapeHtml(item.title)}</h3>` +
      `<p class="mat-doc-d-summary__lead">${escapeHtml(item.description || "")}</p>` +
      `<div class="mat-doc-d-tags mat-doc-d-tags--sm">${tags
        .slice(0, 3)
        .map((t) => `<span class="mat-doc-d-tag">${escapeHtml(t)}</span>`)
        .join("")}</div>` +
      `<div class="mat-doc-d-summary__meta">` +
      `<span><span class="mat-doc-d-star" aria-hidden="true">★</span><b>${rating}</b>${ratingCount ? `（${formatCount(ratingCount)}）` : ""}</span>` +
      `<span><span aria-hidden="true">↓</span>${formatCount(item.download_count)}</span>` +
      `</div>` +
      `</div>` +
      `<div class="mat-doc-d-side-card">` +
      `<h3 class="mat-doc-d-side-card__title"><span class="mat-doc-d-side-card__accent" aria-hidden="true">↓</span>ダウンロード</h3>` +
      `<label class="mat-doc-d-field"><span>ファイル形式</span>` +
      `<select aria-label="ファイル形式（サイド）"><option selected>${escapeHtml(formatSel)}</option></select></label>` +
      `<label class="mat-doc-d-field"><span>ライセンス</span>` +
      `<select disabled aria-label="ライセンス（サイド）"><option>標準ライセンス</option></select></label>` +
      `<button type="button" class="mat-doc-d-dl-cta" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      `<span data-mat-download-label>${escapeHtml(dlLabel)}</span>` +
      `</button>` +
      `<p class="mat-doc-d-dl-note">※ クレジット表記不要で、商用利用が可能です</p>` +
      `</div>` +
      `<div class="mat-doc-d-accordion">` +
      `<button type="button" class="mat-doc-d-acc" data-doc-d-acc="info">素材情報 <span aria-hidden="true">▾</span></button>` +
      `<div class="mat-doc-d-acc-panel" data-doc-d-acc-panel="info" hidden>` +
      `<dl class="mat-doc-d-info">${infoRows
        .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`)
        .join("")}</dl>` +
      `</div>` +
      `<button type="button" class="mat-doc-d-acc" data-doc-d-acc="desc">説明 <span aria-hidden="true">▾</span></button>` +
      `<div class="mat-doc-d-acc-panel" data-doc-d-acc-panel="desc" hidden><p class="mat-doc-d-desc">${nl2brEscaped(desc)}</p></div>` +
      `<button type="button" class="mat-doc-d-acc" data-doc-d-acc="usage">利用シーン <span aria-hidden="true">▾</span></button>` +
      `<div class="mat-doc-d-acc-panel" data-doc-d-acc-panel="usage" hidden>` +
      (usageLines.length
        ? `<ul class="mat-doc-d-bullets">${usageLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
        : `<p class="mat-doc-d-empty-note">利用シーンデータはまだありません。</p>`) +
      `</div>` +
      `<button type="button" class="mat-doc-d-acc" data-doc-d-acc="custom">カスタマイズ方法 <span aria-hidden="true">▾</span></button>` +
      `<div class="mat-doc-d-acc-panel" data-doc-d-acc-panel="custom" hidden><p class="mat-doc-d-empty-note">カスタマイズ手順は準備中です。</p></div>` +
      `<button type="button" class="mat-doc-d-acc" data-doc-d-acc="related">関連素材 <span aria-hidden="true">▾</span></button>` +
      `<div class="mat-doc-d-acc-panel" data-doc-d-acc-panel="related" hidden><p class="mat-doc-d-empty-note">下記セクションをご覧ください。</p></div>` +
      `<button type="button" class="mat-doc-d-acc" data-doc-d-acc="tags">タグ <span aria-hidden="true">▾</span></button>` +
      `<div class="mat-doc-d-acc-panel" data-doc-d-acc-panel="tags" hidden><div class="mat-doc-d-side-tags">${sideTags}</div></div>` +
      `<button type="button" class="mat-doc-d-acc" data-doc-d-acc="comments">コメント <span aria-hidden="true">▾</span></button>` +
      `<div class="mat-doc-d-acc-panel" data-doc-d-acc-panel="comments" hidden><p class="mat-doc-d-empty-note">コメント機能は準備中です。</p></div>` +
      `</div>` +
      `<button type="button" class="mat-doc-d-rail-fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<span class="mat-doc-d-heart" aria-hidden="true"></span>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</aside>` +
      `</div>` +
      `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
  }

  function wireSectionTabs(root) {
    const tabs = root.querySelectorAll("[data-doc-d-sect]");
    const panels = root.querySelectorAll("[data-doc-d-sect-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-doc-d-sect");
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach((p) => {
          const on = p.getAttribute("data-doc-d-sect-panel") === id;
          p.classList.toggle("is-active", on);
          p.hidden = !on;
        });
      });
    });
  }

  function wireAccordion(root) {
    root.querySelectorAll("[data-doc-d-acc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-doc-d-acc");
        const panel = root.querySelector(`[data-doc-d-acc-panel="${id}"]`);
        if (!panel) return;
        const open = panel.hidden;
        panel.hidden = !open;
        btn.classList.toggle("is-open", open);
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

  function wireCopy(root, item) {
    const copyContent = buildDocumentCopyContent(item);
    const map = {
      body: copyContent.body,
      plain: copyContent.plain,
      heading: copyContent.heading,
    };
    root.querySelectorAll("[data-doc-d-copy]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (btn.disabled) return;
        const type = btn.getAttribute("data-doc-d-copy") || "body";
        const text = map[type] || copyContent.body;
        copyText(text).then((ok) => {
          if (!ok) return;
          const prev = btn.textContent;
          btn.textContent = "コピーしました";
          btn.classList.add("is-copied");
          showToast(root, "本文をコピーしました");
          setTimeout(() => {
            btn.textContent = prev;
            btn.classList.remove("is-copied");
          }, 1600);
        });
      });
    });
  }

  async function mount(root, item, related) {
    if (!root || !item || item.category_id !== DATA_CATEGORY) return false;

    const relatedList = related || [];
    root.innerHTML = renderShell(item, relatedList);
    document.title = `${item.title} | TASFUL Materials`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", item.description || "");

    wireSectionTabs(root);
    wireAccordion(root);
    wireCopy(root, item);

    global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(root, item);

    return true;
  }

  function destroy() {
    /* no-op */
  }

  /**
   * Local QA fixtures only (PUBLIC_INVENTORY_EMPTY).
   * Enabled with ?qa_fixture=1 — does NOT write Index/Inventory.
   * Slugs align with materials-document-list.js fixtures.
   */
  const QA_FIXTURES = Object.freeze({
    "qa-document-business-email": {
      id: "qa-fixture-document-business-email",
      slug: "qa-document-business-email",
      title: "ビジネスメール（基本）",
      category_id: DATA_CATEGORY,
      description: "社外向けの丁寧なビジネスメール文例",
      tags: ["ビジネス", "メール", "文書"],
      file_formats: ["DOCX", "TXT"],
      download_count: 12,
      rating: 4.8,
      rating_count: 40,
      updated_at: "2026-07-01T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      downloadable: true,
      download_kind: "file",
      download_filename: "qa-business-email.txt",
      download_url: "/materials/generated/downloads/document/qa-business-email.txt",
      document_usage: "ビジネスメール",
      meta_char_count: "約320文字",
      document_preview: {
        layout: "email",
        greeting: "いつもお世話になっております。",
        body:
          "株式会社〇〇の〇〇です。平素より格別のご高配を賜り、誠にありがとうございます。先日お話しした件につきまして、下記の通りご連絡いたします。\n詳細は https://example.com/very/long/path/to/resource/documentation/overview?utm_source=qa&utm_medium=materials&utm_campaign=document_overflow_check_abcdefghijklmnopqrstuvwxyz をご参照ください。",
        signoff: "何卒よろしくお願いいたします。",
      },
      _qa_fixture: true,
    },
    "qa-document-interview-mail": {
      id: "qa-fixture-document-interview-mail",
      slug: "qa-document-interview-mail",
      title: "面接日程のご案内メール",
      category_id: DATA_CATEGORY,
      description: "応募者への面接日程調整メール",
      tags: ["採用", "メール", "案内"],
      file_formats: ["DOCX", "TXT"],
      download_count: 20,
      rating: 4.9,
      rating_count: 55,
      updated_at: "2026-07-05T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      downloadable: true,
      download_kind: "file",
      download_filename: "qa-interview-mail.txt",
      download_url: "/materials/generated/downloads/document/qa-interview-mail.txt",
      document_usage: "採用メール",
      meta_char_count: "約280文字",
      document_preview: {
        greeting: "このたびは〇〇にご応募いただき、誠にありがとうございます。",
        body: "書類選考の結果、ぜひ一度面接にてお話を伺いたくご連絡いたしました。ご都合の良い日程を2〜3候補ご返信ください。",
      },
      _qa_fixture: true,
    },
    "qa-document-thanks-meeting": {
      id: "qa-fixture-document-thanks-meeting",
      slug: "qa-document-thanks-meeting",
      title: "打ち合わせ後のお礼メール",
      category_id: DATA_CATEGORY,
      description: "商談・打ち合わせ後のお礼文例",
      tags: ["ビジネス", "お礼", "メール"],
      file_formats: ["TXT"],
      download_count: 8,
      rating: 4.7,
      rating_count: 22,
      updated_at: "2026-07-10T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      downloadable: true,
      download_kind: "file",
      download_filename: "qa-thanks-meeting.txt",
      download_url: "/materials/generated/downloads/document/qa-thanks-meeting.txt",
      document_usage: "お礼メール",
      meta_char_count: "約210文字",
      document_preview: {
        greeting: "先日はお忙しい中お時間をいただき、ありがとうございました。",
        body: "大変参考になるお話を伺うことができ、今後の参考とさせていただきます。引き続きどうぞよろしくお願いいたします。",
      },
      _qa_fixture: true,
    },
    "qa-document-self-intro": {
      id: "qa-fixture-document-self-intro",
      slug: "qa-document-self-intro",
      title: "自己紹介文（プロフィール用）",
      category_id: DATA_CATEGORY,
      description: "SNS・ブログ・プロフィール向け自己紹介",
      tags: ["自己紹介", "プロフィール", "文書"],
      file_formats: ["TXT", "MD"],
      download_count: 25,
      rating: 4.9,
      rating_count: 80,
      updated_at: "2026-07-12T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      downloadable: true,
      download_kind: "file",
      download_filename: "qa-self-intro.txt",
      download_url: "/materials/generated/downloads/document/qa-self-intro.txt",
      document_usage: "自己紹介",
      meta_char_count: "約180文字",
      document_preview: {
        body: "はじめまして！〇〇と申します。このたびはプロフィールをご覧いただき、ありがとうございます。私は〇〇を専門としており、わかりやすい伝え方を大切にしています。",
      },
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
      document_preview: raw.document_preview || enriched.document_preview || {},
      document_usage: raw.document_usage || enriched.document_usage,
      meta_char_count: raw.meta_char_count || enriched.meta_char_count,
      download_url: raw.download_url,
      downloadable: raw.downloadable !== false,
      download_kind: raw.download_kind || enriched.download_kind || "file",
      download_filename: raw.download_filename || enriched.download_filename,
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

  global.TasuMaterialsDocumentDetail = {
    mount,
    destroy,
    resolveQaItem,
    resolveQaRelated,
    isDocumentItem(item) {
      return !!(item && item.category_id === DATA_CATEGORY);
    },
    DISPLAY_NAME,
  };
})(typeof window !== "undefined" ? window : globalThis);
