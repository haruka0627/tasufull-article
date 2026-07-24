/**
 * Builder General Jobs — Cloudflare deploy flag resolution (Phase 2 · RL-04)
 * Used by stage-cloudflare-pages.mjs and verify scripts.
 */
export const STAGING_SUPABASE_REF = "ahlxuyvhzqdqaojiywmu";
export const PRODUCTION_SUPABASE_REF = "ddojquacsyqesrjhcvmn";
export const CF_PRODUCTION_BRANCH = "cf-pages-deploy";
export const DEPLOY_FLAGS_VERSION = "p2-01";

/**
 * @param {string | undefined} raw
 * @returns {boolean | undefined}
 */
export function parseBoolEnv(raw) {
  if (raw === undefined || raw === null) return undefined;
  const v = String(raw).trim().toLowerCase();
  if (!v) return undefined;
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return undefined;
}

/**
 * @param {string | undefined} raw
 * @returns {"local" | "supabase" | undefined}
 */
export function parseStorageModeEnv(raw) {
  if (raw === undefined || raw === null) return undefined;
  const v = String(raw).trim().toLowerCase();
  if (!v) return undefined;
  if (v === "local" || v === "supabase") return v;
  return undefined;
}

/**
 * @param {string} supabaseUrl
 * @returns {"staging" | "production" | "unknown"}
 */
export function detectSupabaseTier(supabaseUrl) {
  const url = String(supabaseUrl || "");
  if (url.includes(STAGING_SUPABASE_REF)) return "staging";
  if (url.includes(PRODUCTION_SUPABASE_REF)) return "production";
  return "unknown";
}

/**
 * @returns {"local" | "preview" | "production"}
 */
export function detectCfDeployTarget(env = process.env) {
  if (env.CF_PAGES !== "1") return "local";
  const branch = String(env.CF_PAGES_BRANCH || "").trim();
  return branch === CF_PRODUCTION_BRANCH ? "production" : "preview";
}

/**
 * Preview must use Staging ref · Production must use Production ref.
 * @param {string} supabaseUrl
 * @param {NodeJS.ProcessEnv} [env]
 */
export function validateSupabaseTierAlignment(supabaseUrl, env = process.env) {
  const supabaseTier = detectSupabaseTier(supabaseUrl);
  const cfDeployTarget = detectCfDeployTarget(env);
  if (cfDeployTarget === "local") {
    return { ok: true, supabaseTier, cfDeployTarget, reason: "" };
  }
  if (cfDeployTarget === "production" && supabaseTier === "staging") {
    return {
      ok: false,
      supabaseTier,
      cfDeployTarget,
      reason: "Production deploy must not use Staging Supabase URL (Preview→Staging / Production→Production)",
    };
  }
  if (cfDeployTarget === "preview" && supabaseTier === "production") {
    return {
      ok: false,
      supabaseTier,
      cfDeployTarget,
      reason: "Preview deploy must not use Production Supabase URL (Preview→Staging / Production→Production)",
    };
  }
  return { ok: true, supabaseTier, cfDeployTarget, reason: "" };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveBuilderDeployFlags(env = process.env) {
  const storageMode = parseStorageModeEnv(env.TASU_BUILDER_STORAGE_MODE);
  const generalJobsRepo = parseBoolEnv(env.TASU_BUILDER_GENERAL_JOBS_REPO);
  return {
    storageMode,
    generalJobsRepo,
    hasStorageMode: storageMode !== undefined,
    hasGeneralJobsRepo: generalJobsRepo !== undefined,
  };
}

/**
 * @param {{
 *   storageMode?: "local" | "supabase";
 *   generalJobsRepo?: boolean;
 *   supabaseTier: string;
 *   cfDeployTarget: string;
 * }} opts
 */
export function renderBuilderDeployFlagsJs(opts) {
  const lines = [
    "/**",
    " * Generated at deploy — do not commit dist copy.",
    " * Source: deploy/cloudflare/stage-cloudflare-pages.mjs · scripts/lib/builder-deploy-flags.mjs",
    " */",
    "(function (global) {",
    '  "use strict";',
  ];

  if (opts.storageMode !== undefined) {
    lines.push(`  global.TASU_BUILDER_STORAGE_MODE = ${JSON.stringify(opts.storageMode)};`);
  }
  if (opts.generalJobsRepo !== undefined) {
    lines.push(`  global.TASU_BUILDER_GENERAL_JOBS_REPO = ${opts.generalJobsRepo};`);
  }

  lines.push(
    "  global.TASU_BUILDER_DEPLOY_FLAGS_META = Object.freeze({",
    `    version: ${JSON.stringify(DEPLOY_FLAGS_VERSION)},`,
    `    supabaseTier: ${JSON.stringify(opts.supabaseTier)},`,
    `    cfDeployTarget: ${JSON.stringify(opts.cfDeployTarget)},`,
    `    injectedStorageMode: ${opts.storageMode !== undefined},`,
    `    injectedGeneralJobsRepo: ${opts.generalJobsRepo !== undefined},`,
    "  });",
    "})(typeof window !== \"undefined\" ? window : globalThis);",
    ""
  );

  return lines.join("\n");
}
