#!/usr/bin/env node
/**
 * Verify tasful-pricing-catalog.json + generated artifacts
 *
 *   node scripts/verify-pricing-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATALOG_PATH,
  SCHEMA_PATH,
  REQUIRED_SKUS,
  loadAndValidateCatalog,
  validatePricingCatalog,
} from "./lib/pricing-catalog-validator.mjs";

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

let pass = 0;
let fail = 0;

function ok(step, detail = "") {
  pass += 1;
  console.log(`PASS ${step}${detail ? ` · ${detail}` : ""}`);
}

function bad(step, detail = "") {
  fail += 1;
  console.error(`FAIL ${step}${detail ? ` — ${detail}` : ""}`);
}

function assert(cond, step, detail = "") {
  if (cond) ok(step, detail);
  else bad(step, detail);
}

function verifySchemaFile() {
  assert(fs.existsSync(SCHEMA_PATH), "schema file exists", path.relative(ROOT, SCHEMA_PATH));
  try {
    JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
    ok("schema JSON parse");
  } catch (e) {
    bad("schema JSON parse", String(e?.message || e));
  }
}

function verifyCatalogFile() {
  assert(fs.existsSync(CATALOG_PATH), "catalog file exists", path.relative(ROOT, CATALOG_PATH));
  const { catalog, result } = loadAndValidateCatalog(CATALOG_PATH);
  assert(result.ok, "catalog structural validation", result.errors.join("; ") || "ok");
  for (const w of result.warnings) console.warn(`WARN ${w}`);

  const skuKeys = Object.keys(catalog.skus || {});
  assert(skuKeys.length >= REQUIRED_SKUS.length, "sku count", String(skuKeys.length));

  for (const id of REQUIRED_SKUS) {
    assert(Boolean(catalog.skus?.[id]), `required sku ${id}`);
    assert(catalog.skus[id].provisional === true, `${id} provisional`);
  }

  return catalog;
}

function verifyGeneratedArtifacts(catalog) {
  assert(fs.existsSync(OUT_JS), "generated JS exists", path.relative(ROOT, OUT_JS));
  assert(fs.existsSync(OUT_TS), "generated TS exists", path.relative(ROOT, OUT_TS));

  const jsText = fs.readFileSync(OUT_JS, "utf8");
  const tsText = fs.readFileSync(OUT_TS, "utf8");

  assert(jsText.includes("AUTO-GENERATED"), "JS header");
  assert(tsText.includes("AUTO-GENERATED"), "TS header");
  assert(jsText.includes("TasuPricingCatalog"), "JS export global");
  assert(tsText.includes("TASFUL_PRICING_CATALOG"), "TS export const");

  for (const id of REQUIRED_SKUS) {
    assert(jsText.includes(`"${id}"`), `JS embeds ${id}`);
    assert(tsText.includes(`"${id}"`), `TS embeds ${id}`);
  }

  // Embedded catalog should match source amounts (smoke)
  assert(jsText.includes('"amount": 550'), "JS platform/builder 550");
  assert(jsText.includes('"percent": 5'), "JS connect rate 5%");
  assert(jsText.includes("STRIPE_GENAI_PRICE_PRO_980"), "JS stripe env key preserved");

  const embedded = jsText.match(/const CATALOG = (\{[\s\S]*?\n\});/);
  if (embedded) {
    try {
      const parsed = JSON.parse(embedded[1]);
      assert(parsed.updatedAt === catalog.updatedAt, "JS catalog sync updatedAt");
      assert(
        parsed.skus?.platform_match_job_contact?.amount === catalog.skus?.platform_match_job_contact?.amount,
        "JS catalog sync job fee"
      );
    } catch (e) {
      bad("JS embedded catalog parse", String(e?.message || e));
    }
  } else {
    bad("JS embedded catalog extract");
  }
}

function main() {
  console.log("=== verify-pricing-catalog ===\n");
  verifySchemaFile();
  const catalog = verifyCatalogFile();
  verifyGeneratedArtifacts(catalog);

  console.log(`\n=== RESULT: ${fail === 0 ? "PASS" : "FAIL"} (${pass}/${pass + fail}) ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
