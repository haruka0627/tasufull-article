/**
 * TASFUL Page Gen — SEO & structured data builder (Phase 1 common engine)
 *
 * SEO text may start from an AI suggestion, but length, composition and
 * JSON-LD are produced deterministically so search output cannot be
 * hallucinated.
 */
(function (global) {
  "use strict";

  function S() {
    return global.TasuPageGenSchema;
  }

  function R() {
    return global.TasuPageGenRegistry;
  }

  function clamp(value, max) {
    const s = S().trimText(value, 0);
    if (s.length <= max) return s;
    return `${s.slice(0, Math.max(0, max - 1))}…`;
  }

  function areaLabel(doc) {
    const areas = doc?.profile?.areas || [];
    if (!areas.length) return "";
    if (areas.length === 1) return areas[0];
    return `${areas[0]}ほか${areas.length - 1}エリア`;
  }

  function categoryLabel(doc) {
    return (
      S().trimText(doc?.category?.name, 60) ||
      S().trimText(doc?.service_type, 60) ||
      R().getPageKind(doc?.page_kind)?.label ||
      ""
    );
  }

  /** Deterministic title: 事業者名 | カテゴリ — エリア */
  function buildTitle(doc, suggestion) {
    const limits = S().LIMITS;
    const suggested = S().trimText(suggestion, 0);
    if (suggested) return clamp(suggested, limits.SEO_TITLE);
    const name = S().trimText(doc?.profile?.name, 0) || "TASFUL 掲載ページ";
    const parts = [name];
    const cat = categoryLabel(doc);
    if (cat) parts.push(cat);
    const area = areaLabel(doc);
    const base = area ? `${parts.join(" | ")} — ${area}` : parts.join(" | ");
    return clamp(base, limits.SEO_TITLE);
  }

  function buildDescription(doc, suggestion) {
    const limits = S().LIMITS;
    const suggested = S().trimText(suggestion, 0);
    if (suggested) return clamp(suggested, limits.SEO_DESCRIPTION);
    const summary = S().trimText(doc?.profile?.summary, 0);
    if (summary) return clamp(summary, limits.SEO_DESCRIPTION);
    const name = S().trimText(doc?.profile?.name, 0);
    const area = areaLabel(doc);
    const cat = categoryLabel(doc);
    return clamp([name, cat, area].filter(Boolean).join(" · "), limits.SEO_DESCRIPTION);
  }

  function buildKeywords(doc) {
    const out = [];
    const push = (v) => {
      const s = S().trimText(v, 40);
      if (s && !out.includes(s)) out.push(s);
    };
    push(doc?.profile?.name);
    push(categoryLabel(doc));
    push(doc?.service_type);
    (doc?.profile?.areas || []).slice(0, 5).forEach(push);
    (doc?.profile?.strengths || []).slice(0, 3).forEach(push);
    return out.slice(0, 12);
  }

  /**
   * @param {object} doc
   * @param {{ title?: string, description?: string, canonical?: string, noindex?: boolean }} [suggestion]
   */
  function buildSeo(doc, suggestion) {
    const title = buildTitle(doc, suggestion?.title);
    const description = buildDescription(doc, suggestion?.description);
    const image = doc?.profile?.images?.[0]?.url || "";
    return {
      title,
      description,
      keywords: buildKeywords(doc),
      canonical: S().trimText(suggestion?.canonical ?? doc?.seo?.canonical, 300),
      noindex: suggestion?.noindex != null ? Boolean(suggestion.noindex) : Boolean(doc?.seo?.noindex),
      og: {
        title,
        description,
        image: S().trimText(image, 300),
      },
    };
  }

  function applySeo(doc, suggestion) {
    doc.seo = buildSeo(doc, suggestion);
    return doc.seo;
  }

  function faqItems(doc) {
    const faqBlock = (doc?.blocks || []).find((b) => b.type === "faq" && b.visible !== false);
    return faqBlock?.props?.items || [];
  }

  /** JSON-LD is generated from PageDoc only — never from model output. */
  function buildStructuredData(doc, options) {
    const type = R().resolveJsonLdType(doc?.page_kind);
    const name = S().trimText(doc?.profile?.name, 120);
    const description = S().trimText(doc?.seo?.description || doc?.profile?.summary, 300);
    const areas = doc?.profile?.areas || [];
    const image = doc?.profile?.images?.[0]?.url || "";

    const node = {
      "@context": "https://schema.org",
      "@type": type,
      name,
    };
    if (description) node.description = description;
    if (image) node.image = image;
    if (options?.url) node.url = String(options.url);
    if (areas.length) node.areaServed = areas.slice(0, 10);
    const cat = categoryLabel(doc);
    if (cat) {
      if (type === "Service") node.serviceType = cat;
      else node.additionalType = cat;
    }
    if (doc?.profile?.hours_text) node.openingHours = S().trimText(doc.profile.hours_text, 200);
    if (doc?.profile?.price_text) {
      node.offers = {
        "@type": "Offer",
        priceSpecification: {
          "@type": "PriceSpecification",
          description: S().trimText(doc.profile.price_text, 200),
        },
      };
    }

    const faq = faqItems(doc);
    if (faq.length) {
      return {
        "@context": "https://schema.org",
        "@graph": [
          node,
          {
            "@type": "FAQPage",
            mainEntity: faq.slice(0, 8).map((it) => ({
              "@type": "Question",
              name: it.q,
              acceptedAnswer: { "@type": "Answer", text: it.a },
            })),
          },
        ],
      };
    }
    return node;
  }

  function applyStructuredData(doc, options) {
    doc.structured_data = buildStructuredData(doc, options);
    return doc.structured_data;
  }

  global.TasuPageGenSeo = {
    buildTitle,
    buildDescription,
    buildKeywords,
    buildSeo,
    applySeo,
    buildStructuredData,
    applyStructuredData,
  };
})(typeof window !== "undefined" ? window : globalThis);
