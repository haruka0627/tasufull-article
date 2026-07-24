#!/usr/bin/env node
/**
 * Supabase Production / Staging environment helpers.
 * SSOT refs: reports/tasful-supabase-staging-project-manifest.json
 * Human doc: docs/supabase-environments.md
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST_PATH = path.join(root, "reports", "tasful-supabase-staging-project-manifest.json");

/** @typedef {{ schema_version: number, production: { ref: string, url: string }, staging: { ref: string, url: string } }} SupabaseManifest */

let _manifest = null;

export function loadManifest() {
  if (_manifest) return _manifest;
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Supabase manifest missing: ${MANIFEST_PATH}`);
  }
  _manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  return _manifest;
}

export function getProductionRef() {
  const fromEnv = String(process.env.BD_PRODUCTION_PROJECT_REF || "").trim();
  if (fromEnv) return fromEnv;
  return loadManifest().production.ref;
}

export function getStagingRef() {
  const fromEnv = String(
    process.env.SUPABASE_STAGING_PROJECT_REF || process.env.STAGING_SUPABASE_PROJECT_REF || "",
  ).trim();
  if (fromEnv) return fromEnv;
  return loadManifest().staging.ref;
}

export function getProductionUrl() {
  const fromEnv = String(process.env.TASFUL_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  if (fromEnv && fromEnv.includes(getProductionRef())) return fromEnv.replace(/\/$/, "");
  return loadManifest().production.url.replace(/\/$/, "");
}

export function getStagingUrl() {
  const ref = getStagingRef();
  const fromEnv = String(process.env.TASFUL_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  if (fromEnv && fromEnv.includes(ref)) return fromEnv.replace(/\/$/, "");
  return loadManifest().staging.url.replace(/\/$/, "");
}

export function getLinkedProjectRef() {
  const configPath = path.join(root, "supabase", ".temp", "project-ref");
  if (existsSync(configPath)) {
    return readFileSync(configPath, "utf8").trim();
  }
  const configToml = path.join(root, "supabase", "config.toml");
  if (existsSync(configToml)) {
    const m = readFileSync(configToml, "utf8").match(/project_id\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  }
  return String(process.env.SUPABASE_PROJECT_REF || "").trim();
}

/**
 * Load .env.staging into process.env (does not override already-set keys).
 */
export function loadStagingDotEnv() {
  const envPath = path.join(root, ".env.staging");
  if (!existsSync(envPath)) return false;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
  return true;
}

/**
 * Staging remote checks: refuse when CLI link targets Production.
 * @returns {{ ok: boolean, linked: string, productionRef: string, stagingRef: string, message: string }}
 */
export function checkStagingNotProductionLinked() {
  const productionRef = getProductionRef();
  const stagingRef = getStagingRef();
  const linked = getLinkedProjectRef();

  if (!linked) {
    return {
      ok: true,
      linked,
      productionRef,
      stagingRef,
      message: "no CLI link detected — set SUPABASE_PROJECT_REF or supabase link before --remote",
    };
  }

  if (linked === productionRef) {
    return {
      ok: false,
      linked,
      productionRef,
      stagingRef,
      message: `linked ref ${linked} matches Production — use Staging link (${stagingRef}) for Staging remote checks`,
    };
  }

  if (linked === stagingRef) {
    return {
      ok: true,
      linked,
      productionRef,
      stagingRef,
      message: `linked=${linked} (Staging) ≠ prod=${productionRef}`,
    };
  }

  return {
    ok: true,
    linked,
    productionRef,
    stagingRef,
    message: `linked=${linked} is neither manifest staging (${stagingRef}) nor production (${productionRef}) — verify intent`,
  };
}

/**
 * Production-target scripts: optional guard when CLI link is Staging.
 */
export function checkProductionTargetAllowed() {
  const productionRef = getProductionRef();
  const stagingRef = getStagingRef();
  const linked = getLinkedProjectRef();
  if (!linked) {
    return { ok: true, linked, message: "no CLI link — using explicit Production ref / env" };
  }
  if (linked === stagingRef) {
    return {
      ok: false,
      linked,
      message: `CLI linked to Staging (${stagingRef}) — unlink or link Production (${productionRef}) before Production DB ops`,
    };
  }
  if (linked === productionRef) {
    return { ok: true, linked, message: `linked=${linked} (Production)` };
  }
  return { ok: true, linked, message: `linked=${linked} — verify Production intent` };
}
