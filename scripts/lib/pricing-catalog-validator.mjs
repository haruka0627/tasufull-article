#!/usr/bin/env node
/**
 * TASFUL Pricing Catalog — structural validator (P0 · no external JSON Schema engine)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CATALOG_PATH = path.join(ROOT, "shared", "pricing", "tasful-pricing-catalog.json");
export const SCHEMA_PATH = path.join(ROOT, "shared", "pricing", "pricing-catalog.schema.json");

/** @type {readonly string[]} */
export const REQUIRED_SKUS = Object.freeze([
  "platform_match_job_contact",
  "platform_match_general_contact",
  "platform_match_connect_rate",
  "platform_boost_featured_7d",
  "platform_boost_featured_30d",
  "platform_boost_pr_30d",
  "platform_sponsor_ads_placeholder",
  "platform_urgent_priority_placeholder",
  "platform_verified_badge_placeholder",
  "tasful_ai_lite",
  "tasful_ai_pro",
  "tasful_ai_max_placeholder",
  "builder_contact_reveal",
]);

const BILLING_TYPES = new Set(["fixed", "percent", "subscription", "usage", "placeholder"]);
const STATUSES = new Set(["active", "draft", "planned"]);
const DOMAINS = new Set(["platform", "tasful_ai", "builder", "business_directory", "tlv"]);

/**
 * @param {unknown} catalog
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validatePricingCatalog(catalog) {
  const errors = [];
  const warnings = [];

  if (!catalog || typeof catalog !== "object") {
    return { ok: false, errors: ["catalog must be an object"], warnings };
  }

  const c = /** @type {Record<string, unknown>} */ (catalog);

  if (c.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (typeof c.updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(c.updatedAt)) {
    errors.push("updatedAt must be YYYY-MM-DD");
  }
  if (c.defaultCurrency !== "JPY") errors.push("defaultCurrency must be JPY");

  const skus = c.skus;
  if (!skus || typeof skus !== "object" || Array.isArray(skus)) {
    errors.push("skus must be an object");
    return { ok: false, errors, warnings };
  }

  const skuMap = /** @type {Record<string, Record<string, unknown>>} */ (skus);

  for (const required of REQUIRED_SKUS) {
    if (!skuMap[required]) errors.push(`missing required sku: ${required}`);
  }

  for (const [key, raw] of Object.entries(skuMap)) {
    const entry = raw;
    const prefix = `skus.${key}`;

    if (!entry || typeof entry !== "object") {
      errors.push(`${prefix}: must be an object`);
      continue;
    }

    const sku = String(entry.sku || "");
    if (sku !== key) errors.push(`${prefix}: sku field must match key (${sku} !== ${key})`);

    for (const field of ["domain", "label", "description", "billingType", "currency", "provisional", "enabled", "status"]) {
      if (!(field in entry)) errors.push(`${prefix}: missing ${field}`);
    }

    if (!DOMAINS.has(String(entry.domain))) errors.push(`${prefix}: invalid domain`);
    if (!BILLING_TYPES.has(String(entry.billingType))) errors.push(`${prefix}: invalid billingType`);
    if (!STATUSES.has(String(entry.status))) errors.push(`${prefix}: invalid status`);
    if (entry.currency !== "JPY") errors.push(`${prefix}: currency must be JPY`);
    if (entry.provisional !== true) warnings.push(`${prefix}: provisional should be true in P0`);
    if (typeof entry.enabled !== "boolean") errors.push(`${prefix}: enabled must be boolean`);

    const billingType = String(entry.billingType);

    if (billingType === "fixed" || billingType === "subscription") {
      if (typeof entry.amount !== "number" || entry.amount < 0) {
        errors.push(`${prefix}: amount required for ${billingType}`);
      }
    }

    if (billingType === "percent") {
      if (typeof entry.percent !== "number" || entry.percent < 0 || entry.percent > 100) {
        errors.push(`${prefix}: percent required (0-100)`);
      }
      if (typeof entry.minimumAmount !== "number" || entry.minimumAmount < 0) {
        errors.push(`${prefix}: minimumAmount required for percent`);
      }
    }

    if (billingType === "placeholder" && entry.enabled === true) {
      warnings.push(`${prefix}: placeholder sku should usually be enabled=false`);
    }

    if (entry.stripePriceEnvKey != null && typeof entry.stripePriceEnvKey !== "string") {
      errors.push(`${prefix}: stripePriceEnvKey must be string`);
    }

    if (entry.limits != null) {
      if (typeof entry.limits !== "object" || Array.isArray(entry.limits)) {
        errors.push(`${prefix}: limits must be object`);
      }
    }

    if (entry.features != null && !Array.isArray(entry.features)) {
      errors.push(`${prefix}: features must be array`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * @returns {{ catalog: Record<string, unknown>, result: ReturnType<typeof validatePricingCatalog> }}
 */
export function loadAndValidateCatalog(catalogPath = CATALOG_PATH) {
  const text = fs.readFileSync(catalogPath, "utf8");
  const catalog = JSON.parse(text);
  const result = validatePricingCatalog(catalog);
  return { catalog, result };
}
