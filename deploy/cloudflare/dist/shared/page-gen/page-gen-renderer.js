/**
 * TASFUL Page Gen — shared renderer (Phase 1 common engine)
 *
 * The only place PageDoc becomes HTML. Every value passes through
 * escapeHtml, so model output can never inject markup.
 */
(function (global) {
  "use strict";

  function S() {
    return global.TasuPageGenSchema;
  }

  function Blocks() {
    return global.TasuPageGenBlocks;
  }

  function Actions() {
    return global.TasuPageGenActions;
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Safe href: only relative paths and http(s). */
  function safeUrl(value) {
    const s = String(value ?? "").trim();
    if (!s) return "";
    if (/^(https?:)?\/\//i.test(s)) return s;
    if (/^[\w./?=&#%-]+$/.test(s)) return s;
    return "";
  }

  function paragraphs(text) {
    return String(text ?? "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p class="pg-text">${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function section(type, id, inner, heading) {
    if (!inner) return "";
    const head = heading ? `<h2 class="pg-section__title">${esc(heading)}</h2>` : "";
    return (
      `<section class="pg-section pg-section--${esc(type)}" data-pg-block="${esc(id)}" data-pg-block-type="${esc(type)}">` +
      head +
      inner +
      `</section>`
    );
  }

  const renderers = {
    hero(block, doc) {
      const p = block.props || {};
      const title = p.title || doc.profile?.name || "";
      if (!title && !p.lead) return "";
      const img = safeUrl(p.image_url || doc.profile?.images?.[0]?.url);
      const alt = doc.media_plan?.find((item) => item.role === "hero")?.alt || doc.profile?.images?.[0]?.alt || title;
      return (
        `<header class="pg-hero" data-pg-block="${esc(block.id)}" data-pg-block-type="hero">` +
        (img ? `<div class="pg-hero__media"><img src="${esc(img)}" alt="${esc(alt)}" loading="lazy"></div>` : "") +
        `<h1 class="pg-hero__title">${esc(title)}</h1>` +
        (p.lead ? `<p class="pg-hero__lead">${esc(p.lead)}</p>` : "") +
        `</header>`
      );
    },

    about(block) {
      const p = block.props || {};
      return section("about", block.id, paragraphs(p.body), p.heading || "紹介");
    },

    services(block) {
      const p = block.props || {};
      const items = p.items || [];
      if (!items.length) return "";
      const inner =
        `<ul class="pg-list pg-list--services">` +
        items
          .map(
            (it) =>
              `<li class="pg-list__item">` +
              `<span class="pg-list__name">${esc(it.name)}</span>` +
              (it.description ? `<span class="pg-list__desc">${esc(it.description)}</span>` : "") +
              `</li>`,
          )
          .join("") +
        `</ul>`;
      return section("services", block.id, inner, p.heading || "サービス");
    },

    pricing(block) {
      const p = block.props || {};
      const items = p.items || [];
      const rows = items.length
        ? `<ul class="pg-list pg-list--pricing">` +
          items
            .map(
              (it) =>
                `<li class="pg-list__item">` +
                `<span class="pg-list__name">${esc(it.name)}</span>` +
                `<span class="pg-list__price">${esc(it.price_text)}</span>` +
                `</li>`,
            )
            .join("") +
          `</ul>`
        : "";
      const note = p.note ? `<p class="pg-note">${esc(p.note)}</p>` : "";
      const disclaimer = `<p class="pg-disclaimer">表示は目安です。実際の金額はお問い合わせ後に確定します。</p>`;
      const inner = rows || note ? `${rows}${note}${disclaimer}` : "";
      return section("pricing", block.id, inner, p.heading || "料金の目安");
    },

    faq(block) {
      const p = block.props || {};
      const items = p.items || [];
      if (!items.length) return "";
      const inner =
        `<dl class="pg-faq">` +
        items
          .map(
            (it) =>
              `<dt class="pg-faq__q">${esc(it.q)}</dt><dd class="pg-faq__a">${esc(it.a)}</dd>`,
          )
          .join("") +
        `</dl>`;
      return section("faq", block.id, inner, p.heading || "よくある質問");
    },

    gallery(block) {
      const p = block.props || {};
      const images = (p.images || []).filter((img) => safeUrl(img.url));
      if (!images.length) return "";
      const inner =
        `<div class="pg-gallery">` +
        images
          .map(
            (img) =>
              `<figure class="pg-gallery__item"><img src="${esc(safeUrl(img.url))}" alt="${esc(img.alt)}" loading="lazy"></figure>`,
          )
          .join("") +
        `</div>`;
      return section("gallery", block.id, inner, p.heading || "写真");
    },

    area(block, doc) {
      const p = block.props || {};
      const areas = p.areas?.length ? p.areas : doc.profile?.areas || [];
      if (!areas.length && !p.note) return "";
      const inner =
        (areas.length
          ? `<ul class="pg-chips">${areas.map((a) => `<li class="pg-chips__item">${esc(a)}</li>`).join("")}</ul>`
          : "") + (p.note ? `<p class="pg-note">${esc(p.note)}</p>` : "");
      return section("area", block.id, inner, p.heading || "対応エリア");
    },

    hours(block, doc) {
      const p = block.props || {};
      const value = p.text || doc.profile?.hours_text || "";
      if (!value) return "";
      return section("hours", block.id, `<p class="pg-text">${esc(value)}</p>`, p.heading || "営業時間");
    },

    contact(block, doc) {
      const p = block.props || {};
      const contact = doc.profile?.contact || {};
      const rows = [];
      if (p.show_phone && contact.phone) rows.push(`<li class="pg-def__row">電話: ${esc(contact.phone)}</li>`);
      if (p.show_email && contact.email) rows.push(`<li class="pg-def__row">メール: ${esc(contact.email)}</li>`);
      const note = p.note ? `<p class="pg-note">${esc(p.note)}</p>` : "";
      const listHtml = rows.length ? `<ul class="pg-def">${rows.join("")}</ul>` : "";
      const inner = `${listHtml}${note}`;
      return section("contact", block.id, inner, p.heading || "お問い合わせ");
    },

    related_links(block, doc) {
      const p = block.props || {};
      const items = p.items?.length ? p.items : doc.internal_links || [];
      if (!items.length) return "";
      const inner =
        `<ul class="pg-related-links">` +
        items
          .map(
            (item) =>
              `<li class="pg-related-links__item">` +
              `<button type="button" class="pg-related-links__btn" data-pg-internal-ref="${esc(item.target_ref)}" data-pg-link-kind="${esc(item.kind)}">${esc(item.label)}</button>` +
              `</li>`,
          )
          .join("") +
        `</ul>`;
      return section("related_links", block.id, inner, p.heading || "関連ページ");
    },

    cta(block, doc) {
      const p = block.props || {};
      const action = Actions()?.resolveActionForBlock
        ? Actions().resolveActionForBlock(doc, p.action)
        : null;
      const label = p.label || action?.label || "";
      if (!label) return "";
      const kind = action?.kind || p.action || "";
      const flow = action?.tasfulFlow || "";
      const routeRef = action?.config?.route_ref || "";
      const inner =
        (p.note ? `<p class="pg-note">${esc(p.note)}</p>` : "") +
        `<button type="button" class="pg-cta__btn" data-pg-action="${esc(kind)}" data-pg-tasful-flow="${esc(flow)}" data-pg-route-ref="${esc(routeRef)}">${esc(label)}</button>`;
      return section("cta", block.id, inner, p.heading || "");
    },

    notice(block) {
      const p = block.props || {};
      return section("notice", block.id, paragraphs(p.body), p.heading || "ご案内");
    },
  };

  function renderBlock(block, doc) {
    if (!block || block.visible === false) return "";
    if (Blocks().isBlockEmpty(block)) return "";
    const fn = renderers[block.type];
    if (!fn) return "";
    return fn(block, doc) || "";
  }

  function previewBanner(options) {
    if (!options?.preview) return "";
    const label = options.previewLabel || "プレビュー — この内容はまだ公開されていません";
    return `<div class="pg-preview-banner" role="status">${esc(label)}</div>`;
  }

  function aiDisclaimer(options) {
    if (options?.hideAiDisclaimer) return "";
    return `<p class="pg-ai-disclaimer">この文章は AI が作成した下書きです。公開前に内容をご確認ください。</p>`;
  }

  function structuredDataScript(doc, options) {
    if (!options?.includeStructuredData) return "";
    const data = doc.structured_data;
    if (!data || !Object.keys(data).length) return "";
    // "<" cannot appear inside a script element without escaping.
    const json = JSON.stringify(data).replace(/</g, "\\u003c");
    return `<script type="application/ld+json">${json}</script>`;
  }

  /**
   * @param {object} doc PageDoc
   * @param {{ preview?: boolean, includeStructuredData?: boolean, hideAiDisclaimer?: boolean }} [options]
   * @returns {string} HTML fragment
   */
  function render(doc, options) {
    const normalized = S().isPlainObject(doc) ? doc : S().createPageDoc({});
    const body = (normalized.blocks || []).map((b) => renderBlock(b, normalized)).join("");
    return (
      `<article class="pg-page" data-pg-page="${esc(normalized.id)}" data-pg-surface="${esc(normalized.surface)}" data-pg-kind="${esc(normalized.page_kind)}">` +
      previewBanner(options) +
      body +
      aiDisclaimer(options) +
      structuredDataScript(normalized, options) +
      `</article>`
    );
  }

  function renderHead(doc) {
    const seo = doc?.seo || {};
    const tags = [
      `<title>${esc(seo.title)}</title>`,
      `<meta name="description" content="${esc(seo.description)}">`,
      seo.noindex ? `<meta name="robots" content="noindex">` : "",
      seo.canonical ? `<link rel="canonical" href="${esc(safeUrl(seo.canonical))}">` : "",
      `<meta property="og:title" content="${esc(seo.og?.title || seo.title)}">`,
      `<meta property="og:description" content="${esc(seo.og?.description || seo.description)}">`,
      seo.og?.image ? `<meta property="og:image" content="${esc(safeUrl(seo.og.image))}">` : "",
    ];
    return tags.filter(Boolean).join("");
  }

  global.TasuPageGenRenderer = {
    escapeHtml: esc,
    safeUrl,
    renderBlock,
    render,
    renderHead,
  };
})(typeof window !== "undefined" ? window : globalThis);
