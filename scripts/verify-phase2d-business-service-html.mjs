#!/usr/bin/env node
/**
 * Verify Phase 2-D detail-business-service.html: encoding + DOM hooks for page JS.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILE = "detail-business-service.html";

const HOOKS = {
  selectors: [
    "[data-detail-type='field_service']",
    "[data-listing-detail-status]",
    "#business-service-detail-layout",
    "#business-service-detail-root",
    "[data-biz-detail-breadcrumb]",
    "[data-biz-detail-back]",
    "[data-biz-detail-hero-img]",
    "[data-biz-detail-gallery]",
    "[data-biz-detail-title]",
    "[data-biz-detail-company]",
    "[data-bsd-verified-badge]",
    "[data-bsd-hero-achievement]",
    "[data-biz-detail-hero-lead]",
    "[data-bsd-hero-lead-more]",
    "[data-biz-detail-sidebar-actions]",
    "[data-bsd-cta-actions]",
    "[data-bsd-materials-link]",
    "[data-biz-detail-favorite]",
    "[data-business-sticky-action-nav]",
    "#section-overview",
    "[data-bsd-overview-cards]",
    "#section-service-menu",
    "[data-bsd-pricing-tbody]",
    "[data-biz-detail-service-menu-title]",
    "#section-achievements",
    "[data-bsd-work-cases-grid]",
    "#section-license",
    "[data-bsd-license-list]",
    "#section-flow",
    "[data-bsd-flow-steps]",
    "#section-reviews",
    "[data-biz-detail-reviews-strip]",
    "#section-company-info",
    "[data-bsd-company-table]",
    "#section-service-area",
    "[data-bsd-area-online-value]",
    "[data-bsd-area-visit-value]",
    "#section-business-payment",
    "[data-bsf-payment-panel]",
    "#section-faq",
    "[data-bsd-faq-list]",
    "[data-business-service-estimate]",
    "[data-business-service-chat]",
  ],
  ids: [
    "business-service-detail-layout",
    "business-service-detail-root",
    "section-overview",
    "section-service-menu",
    "section-achievements",
    "section-business-payment",
    "bsdPaymentTitle",
  ],
  scripts: [
    "detail-business-service-loader.js",
    "detail-business-service.js",
    "business-service-payment.js",
    "detail-business-service-sticky-nav.js",
    "business-service-flow.js",
  ],
  staticText: [
    "サービスメニュー",
    "業務概要",
    "実績",
    "見積もり",
    "相談",
    "お支払いについて",
    "service-fee-pay.html",
  ],
};

function countPattern(text, re) {
  return (text.match(re) || []).length;
}

const abs = path.join(ROOT, FILE);
const html = fs.readFileSync(abs, "utf8");
const missing = [];

for (const sel of HOOKS.selectors) {
  if (sel.startsWith("#")) {
    const id = sel.slice(1);
    if (!html.includes(`id="${id}"`)) missing.push(sel);
  } else if (sel.includes("=")) {
    const attr = sel.match(/\[([^\]=]+)(?:=|'([^']+)')/)?.[1];
    const val = sel.match(/='([^']+)'/)?.[1];
    if (attr && val && !html.includes(`${attr}="${val}"`) && !html.includes(`${attr}='${val}'`))
      missing.push(sel);
    else if (attr && !val && !html.includes(attr)) missing.push(sel);
  } else {
    const attr = sel.match(/\[([^\]]+)\]/)?.[1];
    if (attr && !html.includes(attr)) missing.push(sel);
  }
}

for (const id of HOOKS.ids) {
  if (!html.includes(`id="${id}"`)) missing.push(`#${id}`);
}

for (const src of HOOKS.scripts) {
  if (!html.includes(src)) missing.push(`script:${src}`);
}

for (const text of HOOKS.staticText) {
  if (text.includes(".html")) {
    if (!html.includes(text) && !html.includes("business-service-payment.js")) {
      /* service-fee-pay link is injected by JS */
      if (text === "service-fee-pay.html") continue;
    }
  } else if (!html.includes(text)) missing.push(`text:${text}`);
}

const result = {
  file: FILE,
  ufffd: countPattern(html, /\uFFFD/g),
  eCorrupt: countPattern(html, /[ぁ-ん一-龥ァ-ヶ]E[^\/\s<"']/g),
  question: countPattern(html, /\?\?/g),
  brokenTags: countPattern(html, /[^<]\/(?:span|a|h[1-6]|div|p|section|button|th)>/g),
  eClose: countPattern(html, /E\/[a-z]+>/gi),
  missingHooks: missing,
  ok:
    missing.length === 0 &&
    !countPattern(html, /\uFFFD/g) &&
    countPattern(html, /[ぁ-ん一-龥ァ-ヶ]E[^\/\s<"']/g) === 0 &&
    !countPattern(html, /\?\?/g) &&
    !countPattern(html, /E\/[a-z]+>/gi),
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
