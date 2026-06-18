#!/usr/bin/env node
/**
 * Verify Phase 2-C checkout HTML encoding + DOM hooks for page JS.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const SPECS = {
  "checkout.html": {
    body: '[data-page="shop_checkout"]',
    hooks: [
      "data-checkout-status",
      "data-checkout-card",
      "data-checkout-shop-name",
      "data-checkout-product-name",
      "data-checkout-unit-price",
      "data-checkout-quantity",
      "data-checkout-total",
      "data-checkout-seller-amount",
      "data-checkout-platform-fee",
      "data-checkout-recipient-note",
      "data-checkout-pay",
      "data-checkout-back",
      "data-checkout-demo-note",
    ],
    scripts: ["shop-checkout.js", "checkout-page.js"],
  },
  "order-complete.html": {
    body: '[data-page="shop_order_complete"]',
    hooks: [
      "data-order-complete-status",
      "data-order-complete-card",
      "data-order-id",
      "data-order-product-name",
      "data-order-quantity",
      "data-order-total",
      "data-order-seller-amount",
      "data-order-platform-fee",
      "data-order-shop-link",
    ],
    scripts: ["shop-checkout.js", "order-complete-page.js"],
  },
  "service-fee-pay.html": {
    body: '[data-page="service_fee_pay"]',
    hooks: [
      "data-fee-status",
      "data-fee-card",
      "data-fee-deal-id",
      "data-fee-agreed",
      "data-fee-amount",
      "data-fee-stripe-pay",
      "data-fee-bank",
    ],
    scripts: ["service-deals-db.js", "service-fee-pay.js"],
  },
};

function verify(name, spec) {
  const html = fs.readFileSync(path.join(ROOT, name), "utf8");
  const missing = spec.hooks.filter((h) => !html.includes(h));
  const missingScripts = spec.scripts.filter((s) => !html.includes(`src="${s}"`));
  const brokenTags = (html.match(/[^<]\/(?:span|a|h[1-6]|div|option|label|dt|dd|p|section|button)>/g) || [])
    .length;
  return {
    file: name,
    ufffd: (html.match(/\uFFFD/g) || []).length,
    eCorrupt: (html.match(/E�/g) || []).length + (html.match(/[一-龥ぁ-ん]E[^\/\s<"']/g) || []).length,
    questionMarks: (html.match(/\?\?/g) || []).length,
    brokenTags,
    missingHooks: missing,
    missingScripts,
    ok:
      missing.length === 0 &&
      missingScripts.length === 0 &&
      brokenTags === 0 &&
      !(html.match(/\uFFFD/g) || []).length &&
      !(html.match(/\?\?/g) || []).length,
  };
}

const results = Object.entries(SPECS).map(([name, spec]) => verify(name, spec));
console.log(JSON.stringify(results, null, 2));
process.exit(results.every((r) => r.ok) ? 0 : 1);
