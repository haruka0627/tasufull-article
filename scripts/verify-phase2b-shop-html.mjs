#!/usr/bin/env node
/**
 * Verify Phase 2-B shop HTML: encoding + required DOM hooks for page JS.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const PAGE_HOOKS = {
  "shop-store.html": {
    js: "shop-store-page.js",
    selectors: [
      "[data-shop-store-market-header]",
      "[data-shop-platform-categories]",
      "[data-shop-store-filter-form]",
      "[data-shop-store-subcategory]",
      "#shop-store-area",
      "[data-shop-store-sidebar-form]",
      "[data-shop-store-check]",
      "[data-shop-store-area-pref]",
      "[data-shop-store-filter-clear]",
      "[data-shop-store-grid]",
      "[data-shop-store-empty]",
      "[data-shop-store-count]",
      "[data-shop-load-more]",
      "#shop-store-results",
      "[data-shop-quicktag]",
    ],
    ids: ["shopStoreKeyword", "shopStoreCategory", "shopStoreArea", "shopStoreSalesType"],
  },
  "detail-shop.html": {
    js: "detail-shop-store.js",
    selectors: [
      "[data-detail-type='shop_store']",
      "[data-biz-detail-root]",
      "[data-listing-detail-status]",
      "[data-biz-detail-breadcrumb]",
      "[data-shop-restaurant-tabs]",
      "#section-products",
      "#section-shop-cases",
      "#section-shop-bottom",
      "#section-reviews",
      "#section-faq",
      "[data-shop-restaurant-body]",
      "[data-biz-detail-sticky-bar]",
    ],
  },
  "detail-shop-product.html": {
    js: "detail-shop-product-page.js",
    selectors: [
      "[data-page='shop_product_detail']",
      "[data-shop-product-main]",
      "[data-shop-product-breadcrumb]",
      "[data-shop-product-status]",
      "[data-shop-product-layout]",
      "[data-shop-product-image]",
      "[data-shop-product-shop-name]",
      "[data-shop-product-title]",
      "[data-shop-product-price]",
      "[data-shop-product-qty]",
      "[data-shop-product-buy]",
      "[data-shop-product-inquiry]",
      "[data-shop-product-desc-wrap]",
      "[data-shop-product-description]",
      "[data-qty-minus]",
      "[data-qty-plus]",
    ],
    ids: ["shopProductQty"],
  },
  "shop-products.html": {
    js: "shop-products-page.js",
    selectors: [
      "[data-page='shop_products']",
      "[data-shop-products-main]",
      "[data-shop-products-breadcrumb]",
      "[data-shop-products-hero]",
      "[data-shop-products-info-stack]",
      "[data-shop-products-services]",
      "[data-shop-products-reviews]",
      "[data-shop-products-recommended]",
      "[data-shop-products-sidebar]",
      "[data-shop-products-filter-categories]",
      "[data-shop-products-price-min]",
      "[data-shop-products-price-max]",
      "[data-shop-products-price-apply]",
      "[data-shop-products-filter-commitment]",
      "[data-shop-products-filter-scenes]",
      "[data-shop-products-controls]",
      "[data-shop-products-title]",
      "[data-shop-products-lead]",
      "[data-shop-products-search]",
      "[data-shop-products-select-category]",
      "[data-shop-products-sort]",
      "[data-shop-products-count-total]",
      "[data-shop-products-count-filtered]",
      "[data-shop-products-chips]",
      "[data-shop-products-empty]",
      "[data-shop-products-grid]",
      "[data-shop-products-more-wrap]",
      "[data-shop-products-more]",
      "[data-shop-products-pagination]",
      "[data-shop-products-services]",
      "[data-shop-products-filter-toggle]",
    ],
    ids: ["productSearchInput", "productCategorySelect", "productSortSelect"],
  },
};

function countPattern(text, re) {
  return (text.match(re) || []).length;
}

function verifyHtml(file, spec) {
  const abs = path.join(ROOT, file);
  const html = fs.readFileSync(abs, "utf8");
  const missing = [];
  for (const sel of spec.selectors || []) {
    if (sel.startsWith("#")) {
      const id = sel.slice(1);
      if (!html.includes(`id="${id}"`)) missing.push(sel);
    } else if (sel.startsWith("[data-")) {
      const attr = sel.match(/\[([^\]=]+)/)?.[1];
      if (attr && !html.includes(attr)) missing.push(sel);
    } else if (!html.includes(sel.replace(/'/g, '"'))) {
      missing.push(sel);
    }
  }
  for (const id of spec.ids || []) {
    if (!html.includes(`id="${id}"`)) missing.push(`#${id}`);
  }
  return {
    file,
    ufffd: countPattern(html, /\uFFFD/g),
    eCorrupt: countPattern(html, /E�/g) + countPattern(html, /[一-龥ぁ-ん]E[^\/\s<"']/g),
    brokenTags: countPattern(html, /[^<]\/(?:span|a|h[1-6]|div|option|label|p|section|button)>/g),
    scripts: (html.match(/<script/g) || []).length,
    missingHooks: missing,
    ok: missing.length === 0 && !countPattern(html, /\uFFFD/g) && !countPattern(html, /E�/g),
  };
}

const results = Object.entries(PAGE_HOOKS).map(([file, spec]) => verifyHtml(file, spec));
console.log(JSON.stringify(results, null, 2));
const allOk = results.every((r) => r.ok && r.brokenTags === 0);
process.exit(allOk ? 0 : 1);
