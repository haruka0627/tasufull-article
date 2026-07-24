#!/usr/bin/env node
/**
 * Generate frontend + Edge pricing config artifacts from tasful-pricing-catalog.json
 *
 *   node scripts/generate-pricing-config.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG_PATH, loadAndValidateCatalog } from "./lib/pricing-catalog-validator.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_JS = path.join(ROOT, "shared", "pricing", "generated", "tasful-pricing-config.js");
const OUT_TS = path.join(
  ROOT,
  "supabase",
  "functions",
  "_shared",
  "generated",
  "tasful-pricing-config.ts"
);
const OUT_SNAPSHOT = path.join(
  ROOT,
  "shared",
  "pricing",
  "generated",
  "tasful-pricing-snapshot.js"
);

/** P1 Platform matching + Boost · P2 TASFUL AI — embedded in snapshot fallback */
const P1_SKU_IDS = [
  "platform_match_job_contact",
  "platform_match_general_contact",
  "platform_match_connect_rate",
  "platform_boost_featured_7d",
  "platform_boost_featured_30d",
  "platform_boost_pr_30d",
];

const P2_AI_SKU_IDS = [
  "tasful_ai_lite",
  "tasful_ai_pro",
  "tasful_ai_max_placeholder",
];

const P3_AI_ADDON_SKU_IDS = [
  "tasful_ai_addon_2d_live_300",
  "tasful_ai_addon_3d_generate_500",
];

const SNAPSHOT_SKU_IDS = [...P1_SKU_IDS, ...P2_AI_SKU_IDS, ...P3_AI_ADDON_SKU_IDS];

function buildSnapshotSkus(catalog) {
  const out = {};
  for (const id of SNAPSHOT_SKU_IDS) {
    const row = catalog.skus?.[id];
    if (row) out[id] = row;
  }
  return out;
}

function buildBrowserJs(catalog) {
  const generatedAt = new Date().toISOString();
  const payload = JSON.stringify(catalog, null, 2);
  const fallbackSkus = JSON.stringify(buildSnapshotSkus(catalog), null, 2);

  return `/**
 * AUTO-GENERATED — do not edit.
 * Source: shared/pricing/tasful-pricing-catalog.json
 * Generator: scripts/generate-pricing-config.mjs
 * Generated: ${generatedAt}
 */
(function (global) {
  "use strict";

  /** @type {Record<string, unknown>} */
  const CATALOG = ${payload};

  const SKU_MAP = CATALOG.skus || {};
  const FALLBACK_SKUS = ${fallbackSkus};

  function getSku(skuId) {
    const id = String(skuId || "").trim();
    if (!id) return null;
    return SKU_MAP[id] || FALLBACK_SKUS[id] || null;
  }

  function isProvisional(skuId) {
    const row = getSku(skuId);
    return row?.provisional === true;
  }

  function isEnabled(skuId) {
    const row = getSku(skuId);
    return row?.enabled === true;
  }

  function formatYen(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "—";
    return "¥" + n.toLocaleString("ja-JP");
  }

  function calcPercentFee(skuId, gmvYen) {
    const row = getSku(skuId);
    if (!row || row.billingType !== "percent") return null;
    const gmv = Math.max(0, Number(gmvYen) || 0);
    const pct = Number(row.percent) || 0;
    const min = Math.max(0, Number(row.minimumAmount) || 0);
    const raw = Math.floor(gmv * (pct / 100));
    return Math.max(min, raw);
  }

  function getFixedAmount(skuId) {
    const row = getSku(skuId);
    if (!row) return null;
    if (row.billingType === "fixed" || row.billingType === "subscription") {
      return Number(row.amount);
    }
    return null;
  }

  global.TasuPricingCatalog = {
    SOURCE: "shared/pricing/tasful-pricing-catalog.json",
    GENERATED_AT: ${JSON.stringify(generatedAt)},
    schemaVersion: CATALOG.schemaVersion,
    updatedAt: CATALOG.updatedAt,
    defaultCurrency: CATALOG.defaultCurrency,
    skus: SKU_MAP,
    getSku,
    isProvisional,
    isEnabled,
    formatYen,
    calcPercentFee,
    getFixedAmount,
    fallbackSkus: FALLBACK_SKUS,
  };
})(typeof window !== "undefined" ? window : globalThis);
`;
}

function buildSnapshotJs(catalog) {
  const generatedAt = new Date().toISOString();
  const skus = JSON.stringify(buildSnapshotSkus(catalog), null, 2);
  return `/**
 * AUTO-GENERATED — do not edit.
 * Source: shared/pricing/tasful-pricing-catalog.json (P1+P2 snapshot)
 * Generator: scripts/generate-pricing-config.mjs
 * Generated: ${generatedAt}
 */
(function (global) {
  "use strict";
  global.TasuPricingSnapshot = {
    SOURCE: "shared/pricing/tasful-pricing-catalog.json",
    GENERATED_AT: ${JSON.stringify(generatedAt)},
    skus: ${skus},
  };
})(typeof window !== "undefined" ? window : globalThis);
`;
}

function buildEdgeTs(catalog) {
  const generatedAt = new Date().toISOString();
  const payload = JSON.stringify(catalog, null, 2);
  const skuIds = Object.keys(catalog.skus || {});
  const skuUnion = skuIds.map((id) => JSON.stringify(id)).join(" | ") || "never";

  return `/**
 * AUTO-GENERATED — do not edit.
 * Source: shared/pricing/tasful-pricing-catalog.json
 * Generator: scripts/generate-pricing-config.mjs
 * Generated: ${generatedAt}
 */

export type PricingBillingType = "fixed" | "percent" | "subscription" | "usage" | "placeholder";
export type PricingStatus = "active" | "draft" | "planned";
export type PricingSkuId = ${skuUnion};

export type PricingLimits = {
  daily?: Record<string, number | null>;
  monthly?: Record<string, unknown>;
};

export type PricingSku = {
  sku: string;
  domain: string;
  label: string;
  description: string;
  billingType: PricingBillingType;
  amount?: number;
  currency: string;
  percent?: number;
  minimumAmount?: number;
  durationDays?: number;
  provisional: boolean;
  enabled: boolean;
  status: PricingStatus;
  stripePriceEnvKey?: string;
  limits?: PricingLimits;
  features?: string[];
};

export type PricingCatalog = {
  schemaVersion: number;
  updatedAt: string;
  defaultCurrency: string;
  skus: Record<string, PricingSku>;
};

export const TASFUL_PRICING_CATALOG = ${payload} as PricingCatalog;

const SKU_MAP: Record<string, PricingSku> = TASFUL_PRICING_CATALOG.skus;

export function getPricingSku(skuId: string): PricingSku | null {
  const id = String(skuId || "").trim();
  if (!id) return null;
  return SKU_MAP[id] ?? null;
}

export function isPricingProvisional(skuId: string): boolean {
  return getPricingSku(skuId)?.provisional === true;
}

export function isPricingEnabled(skuId: string): boolean {
  return getPricingSku(skuId)?.enabled === true;
}

export function calcPricingPercentFee(skuId: string, gmvYen: number): number | null {
  const row = getPricingSku(skuId);
  if (!row || row.billingType !== "percent") return null;
  const gmv = Math.max(0, Number(gmvYen) || 0);
  const pct = Number(row.percent) || 0;
  const min = Math.max(0, Number(row.minimumAmount) || 0);
  const raw = Math.floor(gmv * (pct / 100));
  return Math.max(min, raw);
}

export function getPricingFixedAmount(skuId: string): number | null {
  const row = getPricingSku(skuId);
  if (!row) return null;
  if (row.billingType === "fixed" || row.billingType === "subscription") {
    return Number(row.amount);
  }
  return null;
}

export function resolveStripePriceEnvKey(skuId: string): string {
  return String(getPricingSku(skuId)?.stripePriceEnvKey || "").trim();
}

export function formatPricingYen(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return "¥" + n.toLocaleString("ja-JP");
}
`;
}

function main() {
  const { catalog, result } = loadAndValidateCatalog(CATALOG_PATH);
  if (!result.ok) {
    console.error("FAIL catalog validation:");
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  for (const w of result.warnings) console.warn(`WARN ${w}`);

  fs.mkdirSync(path.dirname(OUT_JS), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_TS), { recursive: true });

  const js = buildBrowserJs(catalog);
  const ts = buildEdgeTs(catalog);
  const snapshot = buildSnapshotJs(catalog);

  fs.writeFileSync(OUT_JS, js, "utf8");
  fs.writeFileSync(OUT_TS, ts, "utf8");
  fs.writeFileSync(OUT_SNAPSHOT, snapshot, "utf8");

  const skuCount = Object.keys(catalog.skus || {}).length;
  console.log(`OK generate-pricing-config (${skuCount} SKUs)`);
  console.log(`  JS: ${path.relative(ROOT, OUT_JS)}`);
  console.log(`  TS: ${path.relative(ROOT, OUT_TS)}`);
  console.log(`  Snapshot: ${path.relative(ROOT, OUT_SNAPSHOT)}`);
}

main();
