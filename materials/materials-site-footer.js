/**
 * TASFUL Materials — shared site-footer fill (TOP / List / Detail).
 * Markup SSOT: materials-site-footer.html (copied from TOP footer).
 */
(function (global) {
  "use strict";

  const LIST_QUERY_BY_ID = Object.freeze({
    document: "text",
  });

  const UI_LABEL_BY_ID = Object.freeze({
    document: "文例・文章テンプレート",
    presentation: "プレゼンテンプレート",
    code: "コード素材",
    icon: "アイコン素材",
    image: "写真",
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

  function categoryLabel(catOrItem) {
    const id = catOrItem?.id || catOrItem?.category_id || "";
    if (UI_LABEL_BY_ID[id]) return UI_LABEL_BY_ID[id];
    return pickStr(catOrItem?.name, catOrItem?.category_name, id);
  }

  function categoryListHref(cat) {
    const id = cat?.id || cat?.code || "";
    const q = LIST_QUERY_BY_ID[id] || cat?.code || id;
    return `/materials/list.html?category=${encodeURIComponent(q)}`;
  }

  function renderFooterCategoryLinks(categories) {
    return (categories || [])
      .slice(0, 6)
      .map((cat) => `<a href="${categoryListHref(cat)}">${escapeHtml(categoryLabel(cat))}</a>`)
      .join("");
  }

  function renderKeywords(keywords, className) {
    return (keywords || [])
      .map(
        (kw) =>
          `<a class="${className}" href="/materials/list.html?q=${encodeURIComponent(kw)}">${escapeHtml(kw)}</a>`
      )
      .join("");
  }

  function fill(payload) {
    const footerKeywords = document.querySelector("[data-materials-footer-keywords]");
    const footerCats = document.querySelector("[data-materials-footer-categories]");
    if (!footerKeywords && !footerCats) return;
    const keywords = payload?.keywords;
    const categories = payload?.categories;
    if (footerKeywords && keywords) {
      footerKeywords.innerHTML = renderKeywords(keywords, "keyword-pill");
    }
    if (footerCats && categories) {
      footerCats.innerHTML = renderFooterCategoryLinks(categories);
    }
  }

  async function mount() {
    const data = global.TasuMaterialsData;
    if (!data) return;
    const footerKeywords = document.querySelector("[data-materials-footer-keywords]");
    const footerCats = document.querySelector("[data-materials-footer-categories]");
    if (!footerKeywords && !footerCats) return;
    let categories = [];
    try {
      if (footerCats) categories = await data.repository.fetchCategories();
    } catch {
      categories = [];
    }
    fill({
      categories,
      keywords: data.POPULAR_KEYWORDS,
    });
  }

  global.TasuMaterialsSiteFooter = { fill, mount };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      mount().catch(() => {});
    });
  } else {
    mount().catch(() => {});
  }
})(typeof window !== "undefined" ? window : globalThis);
