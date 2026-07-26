/**
 * Platform Page Gen — public detail reflection
 * Listens for listing load and applies PageDoc SEO / CTA / optional article body.
 */
(function (global) {
  "use strict";

  function Adapter() {
    return global.TasuPlatformPageGenAdapter;
  }
  function Renderer() {
    return global.TasuPageGenRenderer;
  }

  function applySeo(doc) {
    if (!doc?.seo) return;
    if (doc.seo.title) document.title = String(doc.seo.title);
    const ensureMeta = (attr, key, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", String(content));
    };
    ensureMeta("name", "description", doc.seo.description);
    ensureMeta("property", "og:title", doc.seo.og?.title || doc.seo.title);
    ensureMeta("property", "og:description", doc.seo.og?.description || doc.seo.description);
    if (doc.seo.og?.image) ensureMeta("property", "og:image", doc.seo.og.image);
    if (doc.seo.noindex) ensureMeta("name", "robots", "noindex");

    if (doc.structured_data && Object.keys(doc.structured_data).length) {
      let script = document.getElementById("tasu-page-gen-jsonld");
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "tasu-page-gen-jsonld";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(doc.structured_data).replace(/</g, "\\u003c");
    }
  }

  function applyCta(listing, cta) {
    if (!cta?.can_show) return;
    document.querySelectorAll("[data-listing-primary-cta]").forEach((el) => {
      el.textContent = cta.label;
      el.setAttribute("data-pg-action", cta.action_kind);
      el.setAttribute("data-pg-tasful-flow", cta.tasful_flow);
      el.setAttribute("data-pg-route-ref", cta.route_ref);
      // Keep existing href if already an internal TASFUL path; never set external http.
      const href = el.getAttribute("href") || "";
      if (/^https?:/i.test(href) || /^mailto:|^tel:/i.test(href)) {
        el.removeAttribute("href");
        el.setAttribute("role", "button");
      }
    });
  }

  function applyArticle(doc) {
    if (!Renderer() || !doc) return;
    let host = document.querySelector("[data-page-gen-public]");
    if (!host) {
      const main =
        document.querySelector("main") ||
        document.querySelector("[data-listing-detail]") ||
        document.body;
      host = document.createElement("section");
      host.setAttribute("data-page-gen-public", "");
      host.className = "pg-public-mount";
      main.appendChild(host);
    }
    host.innerHTML = Renderer().render(doc, {
      preview: false,
      includeStructuredData: false,
      hideAiDisclaimer: doc.meta?.status === "published",
    });
  }

  function onListing(listing) {
    if (!Adapter() || !listing) return;
    const doc = Adapter().extractPageDoc(listing);
    if (!doc) return;
    const cta = Adapter().resolveCta(listing);
    applySeo(doc);
    applyCta(listing, cta);
    applyArticle(doc);
  }

  function init() {
    if (typeof document === "undefined" || typeof global.addEventListener !== "function") return;
    global.addEventListener("tasu:listing-loaded", (ev) => {
      onListing(ev.detail?.listing || ev.detail);
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  global.TasuPlatformPageGenDetail = {
    applySeo,
    applyCta,
    applyArticle,
    onListing,
  };
})(typeof window !== "undefined" ? window : globalThis);
