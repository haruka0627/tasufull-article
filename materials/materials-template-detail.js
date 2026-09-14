/**
 * TASFUL Materials — テンプレート詳細 STC Exact Transplant
 * category_id=template · STC 3カラム DOM/CSS 正本 · 既存 Favorite/Download Contract 再接続
 * CDN デモ画像・捏造メタ禁止。preview 無しは placeholder slot。
 */
(function (global) {
  "use strict";

  const DISPLAY_NAME = "テンプレート";
  const DATA_CATEGORY = "template";
  const QUERY_CATEGORY = "template";
  const RELATED_DISPLAY_LIMIT = 4;
  /** Mobile stacked layout（covers 390 QA）. Desktop rail accordion stays collapsed nav. */
  const MOBILE_INFO_MQ = "(max-width: 760px)";

  const GENERIC_TAGS = new Set([
    "template",
    "テンプレート",
    "ja",
    "xlsx",
    "xls",
    "docx",
    "pdf",
    "ai",
    "psd",
  ]);

  const META_PLACEHOLDERS = Object.freeze({
    meta_pages: "10枚",
    meta_size: "A4",
    file_size: "約 1.0 MB",
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
    return `/materials/detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
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

  function resolvePreviewImages(item) {
    const out = [];
    const seen = new Set();
    const push = (src, label) => {
      const u = pickStr(src);
      if (!u || !isImageUrl(u) || seen.has(u)) return;
      seen.add(u);
      out.push({ src: u, label: pickStr(label, `プレビュー ${out.length + 1}`) });
    };
    const images = Array.isArray(item.preview_images) ? item.preview_images : [];
    images.forEach((img, i) => {
      push(img && (img.src || img.url || img), img && img.label ? img.label : `プレビュー ${i + 1}`);
    });
    push(item.thumbnail_url, "サムネイル");
    push(item.preview_image, "プレビュー");
    push(item.preview_url, "プレビュー");
    push(item.image_url, "画像");
    push(item.image, "画像");
    return out;
  }

  function formatOptionsHtml(item) {
    const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
    if (!formats.length) return `<option selected>—</option>`;
    return formats
      .map((f, i) => `<option value="${escapeHtml(f)}"${i === 0 ? " selected" : ""}>${escapeHtml(f)}</option>`)
      .join("");
  }

  function sizeOptionHtml(item) {
    const size =
      realMeta(item.meta_size, "meta_size") ||
      realMeta(item.meta_ratio, "meta_size") ||
      "";
    if (!size) return `<option value="" selected>—</option>`;
    return `<option value="${escapeHtml(size)}" selected>${escapeHtml(size)}</option>`;
  }

  function buildInfoRows(item) {
    const formats = (item.file_formats || []).map((f) => String(f).toUpperCase()).join(" / ") || "—";
    const size = realMeta(item.meta_size, "meta_size") || "—";
    const pages = realMeta(item.meta_pages, "meta_pages") || "—";
    const fileSize = realMeta(item.file_size, "file_size") || "—";
    const published = publishedLabel(item) || "—";
    return [
      ["ファイル形式", formats],
      ["サイズ", size],
      ["ページ数", pages],
      ["ファイルサイズ", fileSize],
      ["公開日", published],
      ["素材ID", pickStr(item.id) || "—"],
    ];
  }

  function bulletLines(item) {
    const lines = [];
    const usage = pickStr(item.meta_usage, item.subcategory);
    if (usage) lines.push(`用途: ${usage}`);
    const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
    if (formats.length) lines.push(`${formats.join(" / ")} 形式に対応`);
    if (item.is_free !== false) lines.push("商用利用OK・クレジット表記不要");
    const tags = itemTags(item).slice(0, 3);
    if (tags.length) lines.push(`キーワード: ${tags.join(" / ")}`);
    return lines;
  }

  function renderRelatedCard(item) {
    const href = detailHref(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const images = resolvePreviewImages(item);
    const thumb = images[0]?.src || "";
    return (
      `<article class="material-mini" data-tpl-d-related data-item-id="${escapeHtml(item.id)}">` +
      `<a class="mini-cover" href="${href}" aria-label="${escapeHtml(item.title)}">` +
      (thumb
        ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
        : "") +
      `<span class="badge badge-blue">${DISPLAY_NAME}</span>` +
      (item.is_free !== false ? `<span class="free">無料</span>` : "") +
      `</a>` +
      `<div class="mini-title"><a href="${href}">${escapeHtml(item.title)}</a></div>` +
      `<div class="mini-stats">` +
      `<i class="fas fa-star" aria-hidden="true"></i>${rating}` +
      `<i class="fas fa-download" aria-hidden="true"></i>${dl}` +
      `<button type="button" class="mini-download" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
      `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
      `<i class="fas fa-download" aria-hidden="true"></i>` +
      `</button>` +
      `</div>` +
      `</article>`
    );
  }

  function renderPreviewBlock(images) {
    if (!images.length) {
      return (
        `<div class="preview-card soft-card" aria-label="テンプレートプレビュー" data-tpl-d-preview>` +
        `<div class="main-slide-wrap">` +
        `<div class="preview-placeholder" aria-hidden="true"><i class="fas fa-file-alt"></i><span>プレビュー準備中</span></div>` +
        `</div>` +
        `</div>`
      );
    }
    const main = images[0];
    const hasMulti = images.length > 1;
    const thumbs = images.slice(0, 5);
    return (
      `<div class="preview-card soft-card" aria-label="テンプレートプレビュー" data-tpl-d-preview data-tpl-d-total="${images.length}">` +
      `<div class="main-slide-wrap">` +
      `<img class="main-slide" data-tpl-d-main src="${escapeHtml(main.src)}" alt="${escapeHtml(main.label)}" decoding="async">` +
      `</div>` +
      (hasMulti
        ? `<div class="thumb-strip">` +
          `<button class="carousel-arrow carousel-prev" type="button" data-tpl-d-prev aria-label="前のプレビュー"><i class="fas fa-chevron-left"></i></button>` +
          `<div class="thumb-list">` +
          thumbs
            .map(
              (img, i) =>
                `<button class="thumb${i === 0 ? " active" : ""}" type="button" data-tpl-d-thumb="${i}" aria-label="${escapeHtml(img.label)}">` +
                `<img src="${escapeHtml(img.src)}" alt="" loading="lazy" decoding="async">` +
                `</button>`
            )
            .join("") +
          `</div>` +
          `<button class="carousel-arrow carousel-next" type="button" data-tpl-d-next aria-label="次のプレビュー"><i class="fas fa-chevron-right"></i></button>` +
          `</div>`
        : "") +
      `</div>`
    );
  }

  function renderShell(item, related) {
    const Fav = global.TasuMaterialsFavorites;
    const Download = global.TasuMaterialsDownload;
    const tags = itemTags(item);
    const favOn = !!Fav?.isFavorited?.(item.id);
    const dlLabel =
      Download?.primaryButtonLabel?.(item) || item.button_label || "無料ダウンロード";
    const rating = Number(item.rating || 0).toFixed(1);
    const ratingCount = Number(item.rating_count || 0);
    const hrefList = listHref();
    const desc = pickStr(item.long_description, item.description) || "テンプレートです。";
    const relatedItems = (related || [])
      .filter((r) => r && r.category_id === DATA_CATEGORY && r.id !== item.id)
      .slice(0, RELATED_DISPLAY_LIMIT);
    const infoRows = buildInfoRows(item);
    const bullets = bulletLines(item);
    const images = resolvePreviewImages(item);
    const licenseLead = pickStr(item.commercial_use, "商用利用OK・クレジット表記不要");
    const commentLabel = ratingCount > 0 ? `コメント（${formatCount(ratingCount)}）` : "コメント";
    const headTags = tags.slice(0, 8);
    const allTags = tags;
    const heart = favOn ? "fas fa-heart" : "far fa-heart";

    const chipHtml = headTags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("");
    const tagPanelHtml = allTags.map((t) => `<a class="chip" href="${hrefList}&q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`).join("");
    const infoTable = infoRows
      .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
      .join("");
    const bulletHtml = bullets.length
      ? `<ul class="check-list">${bullets.map((b) => `<li><i class="fas fa-check-circle" aria-hidden="true"></i>${escapeHtml(b)}</li>`).join("")}</ul>`
      : "";

    return (
      `<div data-tpl-detail data-item-id="${escapeHtml(item.id)}">` +
      `<div class="mat-tpl-d-back-mobile">` +
      `<a href="${hrefList}"><span aria-hidden="true">‹</span> テンプレート一覧に戻る</a>` +
      `</div>` +
      `<nav class="breadcrumb" aria-label="パンくずリスト">` +
      `<a href="/materials/">ホーム</a><i class="fas fa-chevron-right" aria-hidden="true"></i>` +
      `<a href="/materials/">素材を探す</a><i class="fas fa-chevron-right" aria-hidden="true"></i>` +
      `<a href="${hrefList}">テンプレート一覧</a><i class="fas fa-chevron-right" aria-hidden="true"></i>` +
      `<span>${escapeHtml(item.title)}</span>` +
      `</nav>` +
      `<div class="page-grid">` +
      `<section class="left-column" aria-label="素材プレビューと説明">` +
      `<div class="product-head">` +
      `<div class="badge-row">` +
      `<span class="badge badge-blue">${DISPLAY_NAME}</span>` +
      (item.is_free !== false ? `<span class="badge badge-green">無料</span>` : "") +
      `</div>` +
      `<h1 class="product-title">${escapeHtml(item.title)}</h1>` +
      `<p class="product-subtitle">${escapeHtml(item.description || "")}</p>` +
      (chipHtml ? `<div class="chip-row" aria-label="タグ">${chipHtml}</div>` : "") +
      `<div class="stats-row">` +
      `<span class="stat"><i class="fas fa-star" aria-hidden="true"></i>${rating}${ratingCount ? `（${formatCount(ratingCount)}）` : ""}</span>` +
      `<span class="stat"><i class="fas fa-download" aria-hidden="true"></i>${formatCount(item.download_count)} ダウンロード</span>` +
      `<button class="stat inline-favorite${favOn ? " is-favorited" : ""}" type="button" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<i class="${heart}" aria-hidden="true"></i><span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</div></div>` +
      renderPreviewBlock(images) +
      `<div class="detail-tabs" role="tablist" data-tpl-d-tabs>` +
      `<button class="detail-tab active" type="button" role="tab" aria-selected="true" data-tpl-d-tab="description">説明</button>` +
      `<button class="detail-tab" type="button" role="tab" aria-selected="false" data-tpl-d-tab="contents">収録内容</button>` +
      `<button class="detail-tab" type="button" role="tab" aria-selected="false" data-tpl-d-tab="scene">利用シーン</button>` +
      `<button class="detail-tab" type="button" role="tab" aria-selected="false" data-tpl-d-tab="customize">カスタマイズ方法</button>` +
      `<button class="detail-tab" type="button" role="tab" aria-selected="false" data-tpl-d-tab="related">関連素材</button>` +
      `<button class="detail-tab" type="button" role="tab" aria-selected="false" data-tpl-d-tab="comments">${escapeHtml(commentLabel)}</button>` +
      `</div>` +
      `<div class="description-panel" id="tplTabPanel" role="tabpanel" data-tpl-d-panel>` +
      `<div data-tpl-d-desc-default>` +
      `<p class="description-lead">${escapeHtml(desc)}</p>` +
      bulletHtml +
      `</div></div>` +
      `</section>` +
      `<aside class="middle-column" aria-label="ダウンロードと素材情報">` +
      `<section class="soft-card panel download-panel" data-tpl-d-anchor="download">` +
      `<h2 class="section-title"><i class="fas fa-download" aria-hidden="true"></i>ダウンロード</h2>` +
      `<p class="mat-detail-dl-hint" data-mat-dl-hint></p>` +
      `<div class="download-form">` +
      `<div class="field"><label for="tplFormatMain">ファイル形式</label>` +
      `<select id="tplFormatMain" data-tpl-d-format aria-label="ファイル形式">${formatOptionsHtml(item)}</select></div>` +
      `<div class="field"><label for="tplSizeMain">サイズ</label>` +
      `<select id="tplSizeMain" data-tpl-d-size aria-label="サイズ">${sizeOptionHtml(item)}</select></div>` +
      `</div>` +
      `<button class="download-primary" type="button" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}">` +
      `<span data-mat-download-label>${escapeHtml(dlLabel)}</span></button>` +
      `<p class="download-note">※ クレジット表記不要で、商用利用が可能です</p>` +
      `</section>` +
      `<section class="soft-card panel info-panel" id="tpl-sec-info" data-tpl-d-anchor="info">` +
      `<h2 class="section-title"><span class="soundmark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>素材情報</h2>` +
      `<table class="info-table"><tbody>${infoTable}</tbody></table>` +
      `</section>` +
      `<section class="soft-card panel license-panel" data-tpl-d-anchor="license">` +
      `<h2 class="section-title"><i class="fas fa-shield-alt" aria-hidden="true"></i>ライセンス</h2>` +
      `<p class="license-copy">${escapeHtml(licenseLead)}<br>再配布・販売は禁止されています</p>` +
      `<a class="license-link" href="/company/legal/materials.html">ライセンス詳細を見る<i class="fas fa-chevron-right" aria-hidden="true"></i></a>` +
      `</section>` +
      `<section class="soft-card panel tag-panel" id="tpl-sec-tags" data-tpl-d-anchor="tags">` +
      `<h2 class="section-title"><i class="fas fa-tag" aria-hidden="true"></i>タグ</h2>` +
      `<div class="tag-wrap">${tagPanelHtml || `<span class="chip">—</span>`}</div>` +
      (allTags.length
        ? `<a href="${hrefList}" class="tag-more">すべてのタグを見る（${allTags.length}）<i class="fas fa-chevron-right" aria-hidden="true"></i></a>`
        : "") +
      `</section>` +
      `</aside>` +
      /* Desktop右レール: 戻る + accordion ナビ + お気に入り。関連素材は下部実カードのみ（Accordion 側は重複のため非掲載）。
         Mobile ≤760: CSS で常時表示 Information Section（Chevron / 開閉なし）。 */
      `<aside class="right-column" aria-label="テンプレートナビ">` +
      `<a class="rail-back" href="${hrefList}"><i class="fas fa-chevron-left" aria-hidden="true"></i>テンプレート一覧に戻る</a>` +
      `<section class="soft-card accordion-card" data-tpl-d-accordion>` +
      accordionItem("info", "素材情報", escapeHtml(infoRows.map(([k, v]) => `${k}: ${v}`).join(" / "))) +
      accordionItem("contents", "収録内容", escapeHtml(desc)) +
      accordionItem("scene", "利用シーン", escapeHtml(bullets.join(" / ") || "利用シーンは準備中です。")) +
      accordionItem("customize", "カスタマイズ方法", "対応ソフトでテキスト・レイアウトを編集してご利用ください。") +
      accordionItem("tags", "タグ", allTags.length ? escapeHtml(allTags.join(" / ")) : "タグはまだありません。") +
      accordionItem("comments", commentLabel, "コメント機能は準備中です。") +
      `</section>` +
      `<button class="favorite-large${favOn ? " is-favorited" : ""}" type="button" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}">` +
      `<i class="${heart}" aria-hidden="true"></i>` +
      `<span data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
      `</button>` +
      `</aside>` +
      `</div>` +
      `<section class="recommend-section" id="related" data-tpl-d-related-section data-tpl-d-anchor="related">` +
      `<div class="recommend-head">` +
      `<span class="soundmark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>` +
      `この素材を使用している人はこちらの素材も使っています` +
      `<a class="recommend-more" href="${hrefList}">すべて見る<i class="fas fa-chevron-right" aria-hidden="true"></i></a>` +
      `</div>` +
      (relatedItems.length
        ? `<div class="material-cards">${relatedItems.map(renderRelatedCard).join("")}</div>`
        : `<p class="tab-alt" style="margin-top:10px">関連テンプレートはまだありません。</p>`) +
      `</section>` +
      `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
  }

  function wirePreview(root, images) {
    if (!images.length) return;
    let active = 0;
    const main = root.querySelector("[data-tpl-d-main]");
    const thumbs = [...root.querySelectorAll("[data-tpl-d-thumb]")];
    const setSlide = (index) => {
      active = (index + images.length) % images.length;
      if (main) {
        main.src = images[active].src;
        main.alt = images[active].label;
      }
      thumbs.forEach((t, i) => t.classList.toggle("active", i === active));
    };
    thumbs.forEach((t) => {
      t.addEventListener("click", () => setSlide(Number(t.getAttribute("data-tpl-d-thumb") || 0)));
    });
    root.querySelector("[data-tpl-d-prev]")?.addEventListener("click", () => setSlide(active - 1));
    root.querySelector("[data-tpl-d-next]")?.addEventListener("click", () => setSlide(active + 1));
  }

  function wireTabs(root, item, images) {
    const panel = root.querySelector("[data-tpl-d-panel]");
    const defaultHtml = root.querySelector("[data-tpl-d-desc-default]")?.outerHTML || "";
    const bullets = bulletLines(item);
    const desc = pickStr(item.long_description, item.description) || "テンプレートです。";
    const content = {
      contents: images.length
        ? `<div class="tab-alt"><strong>収録内容</strong><br>プレビュー画像 ${images.length} 点（既存 Asset のみ）</div>`
        : `<div class="tab-alt"><strong>収録内容</strong><br>プレビュー画像は準備中です。ダウンロード形式は素材情報をご確認ください。</div>`,
      scene: bullets.length
        ? `<div class="tab-alt"><strong>おすすめの利用シーン</strong><br>${escapeHtml(bullets.join(" / "))}</div>`
        : `<div class="tab-alt"><strong>利用シーン</strong><br>利用シーンデータはまだありません。</div>`,
      customize: `<div class="tab-alt"><strong>カスタマイズ方法</strong><br>対応ソフトでテキスト・レイアウト・配色を編集してご利用ください。</div>`,
      related: `<div class="tab-alt"><strong>関連素材</strong><br>下記の関連テンプレートをご覧ください。</div>`,
      comments: `<div class="tab-alt"><strong>コメント</strong><br>コメント機能は準備中です。</div>`,
    };
    root.querySelectorAll("[data-tpl-d-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        root.querySelectorAll("[data-tpl-d-tab]").forEach((t) => {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        const key = tab.getAttribute("data-tpl-d-tab");
        if (!panel) return;
        panel.innerHTML = key === "description" ? defaultHtml : content[key] || defaultHtml;
      });
    });
  }

  function accordionItem(nav, label, html) {
    return (
      `<div class="accordion-item" data-tpl-d-nav-item="${escapeHtml(nav)}">` +
      `<button class="accordion-trigger" type="button" data-tpl-d-nav="${escapeHtml(nav)}">${escapeHtml(label)}<i class="fas fa-chevron-down" aria-hidden="true"></i></button>` +
      `<div class="accordion-content">${html}</div></div>`
    );
  }

  function isMobileInfoLayout() {
    return typeof window !== "undefined" && window.matchMedia(MOBILE_INFO_MQ).matches;
  }

  function activateTab(root, key) {
    const tab = root.querySelector(`[data-tpl-d-tab="${key}"]`);
    if (tab) tab.click();
  }

  function wireAccordion(root) {
    const scrollTargets = {
      info: '[data-tpl-d-anchor="info"]',
      contents: "[data-tpl-d-panel]",
      scene: "[data-tpl-d-panel]",
      customize: "[data-tpl-d-panel]",
      tags: '[data-tpl-d-anchor="tags"]',
      comments: "[data-tpl-d-panel]",
    };
    const tabKeys = new Set(["contents", "scene", "customize", "comments"]);

    root.querySelectorAll(".accordion-trigger").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        if (isMobileInfoLayout()) return;
        const item = trigger.parentElement;
        const willOpen = !item.classList.contains("open");
        item.classList.toggle("open");
        if (!willOpen) return;

        const nav = trigger.getAttribute("data-tpl-d-nav") || "";
        if (tabKeys.has(nav)) activateTab(root, nav);
        const sel = scrollTargets[nav];
        const target = sel ? root.querySelector(sel) : null;
        if (target && typeof target.scrollIntoView === "function") {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  function syncFavoriteIcons(root, item) {
    const Fav = global.TasuMaterialsFavorites;
    const on = !!Fav?.isFavorited?.(item.id);
    root.querySelectorAll("[data-mat-favorite-btn]").forEach((btn) => {
      Fav?.updateButton?.(btn, item);
      const icon = btn.querySelector("i.fa-heart");
      if (icon) {
        icon.classList.toggle("far", !on);
        icon.classList.toggle("fas", on);
      }
    });
  }

  async function mount(root, item, related) {
    if (!root || !item || item.category_id !== DATA_CATEGORY) return false;
    const enriched = global.TasuMaterialsData?.enrichDetail?.(item) || item;
    const relatedList = related || [];
    const images = resolvePreviewImages(enriched);
    root.innerHTML = renderShell(enriched, relatedList);
    document.title = `${enriched.title} | TASFUL Materials`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", enriched.description || "");

    const detailRoot = root.querySelector("[data-tpl-detail]") || root;
    wirePreview(detailRoot, images);
    wireTabs(detailRoot, enriched, images);
    wireAccordion(detailRoot);

    const Download = global.TasuMaterialsDownload;
    const head = detailRoot.querySelector(".product-head");
    const middle = detailRoot.querySelector(".middle-column");
    const right = detailRoot.querySelector(".right-column");
    if (head) Download?.wireDownloadAndFavorite?.(head, enriched);
    if (middle) Download?.wireDownloadAndFavorite?.(middle, enriched);
    if (right) Download?.wireDownloadAndFavorite?.(right, enriched);
    syncFavoriteIcons(detailRoot, enriched);

    const byId = new Map(relatedList.map((r) => [r.id, r]));
    detailRoot.querySelectorAll("[data-tpl-d-related]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const rel = byId.get(id);
      if (rel) Download?.wireDownloadAndFavorite?.(card, rel);
    });

    if (detailRoot.__tplFavIconHandler) {
      global.removeEventListener("tasful-favorites-changed", detailRoot.__tplFavIconHandler);
    }
    detailRoot.__tplFavIconHandler = () => syncFavoriteIcons(detailRoot, enriched);
    global.addEventListener("tasful-favorites-changed", detailRoot.__tplFavIconHandler);

    return true;
  }

  global.TasuMaterialsTemplateDetail = {
    mount,
    DISPLAY_NAME,
    DATA_CATEGORY,
  };
})(typeof window !== "undefined" ? window : globalThis);
