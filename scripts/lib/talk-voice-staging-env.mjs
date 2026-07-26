#!/usr/bin/env node
/**
 * TALK Voice Phase 2 — Staging env schema + guards (no secrets printed).
 * SSOT refs: docs/supabase-environments.md · reports/tasful-supabase-staging-project-manifest.json
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getProductionRef,
  getStagingRef,
  loadManifest,
} from "./supabase-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const STAGING_ENV_EXAMPLE = path.join(root, ".env.staging.example");
export const STAGING_ENV_FILE = path.join(root, ".env.staging");

const PLACEHOLDER_RE =
  /^(REPLACE_[A-Z0-9_]+|INJECT_[A-Z0-9_]+|CHANGE_ME|TODO|YOUR_[A-Z0-9_]+|<.*>|xxx)$/i;

/** Keys whose values must never be printed (length / set-only). */
export const SECRET_KEYS = new Set([
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TASFUL_SUPABASE_ANON_KEY",
  "AUTH_HOOK_L2_ALLOWLIST_PASSWORD",
  "TALK_VOICE_TURN_SHARED_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
]);

/**
 * @typedef {{
 *   key: string,
 *   required: boolean,
 *   secret?: boolean,
 *   section: string,
 *   description: string,
 *   placeholderOk?: boolean,
 * }} EnvField
 */

/** @type {EnvField[]} */
export const TALK_VOICE_STAGING_ENV_FIELDS = [
  {
    key: "SUPABASE_PROJECT_REF",
    required: true,
    section: "supabase",
    description: "Staging project ref only (ahlxuyvhzqdqaojiywmu)",
  },
  {
    key: "SUPABASE_URL",
    required: true,
    section: "supabase",
    description: "Staging Supabase HTTPS URL",
  },
  {
    key: "SUPABASE_ANON_KEY",
    required: true,
    secret: true,
    section: "supabase",
    description: "Staging anon key (Dashboard / CLI · never commit)",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    secret: true,
    section: "supabase",
    description: "Staging service_role (local/Edge only · never commit)",
  },
  {
    key: "BD_PRODUCTION_PROJECT_REF",
    required: true,
    section: "guards",
    description: "Production ref constant for abort guards",
  },
  {
    key: "TASFUL_SUPABASE_URL",
    required: true,
    section: "build",
    description: "Staging URL injected into chat-supabase-config / Functions",
  },
  {
    key: "TASFUL_SUPABASE_ANON_KEY",
    required: true,
    secret: true,
    section: "build",
    description: "Staging anon for 8788 / build:pages",
  },
  {
    key: "TALK_VOICE_STAGING_HOSTNAME",
    required: true,
    section: "talk-voice",
    description: "Staging app hostname (not Production Pages host)",
  },
  {
    key: "TALK_VOICE_STAGING_ALLOWED_ORIGINS",
    required: true,
    section: "talk-voice",
    description: "Comma-separated Staging origins (must include http://127.0.0.1:8788)",
  },
  {
    key: "TALK_VOICE_STAGING_JWT_ISSUER",
    required: true,
    section: "talk-voice",
    description: "Staging Auth issuer https://<staging-ref>.supabase.co/auth/v1",
  },
  {
    key: "TALK_VOICE_STAGING_JWT_AUDIENCE",
    required: true,
    section: "talk-voice",
    description: "Staging JWT audience (typically authenticated)",
  },
  {
    key: "TALK_VOICE_SELF_HOSTED_TURN_ENABLED",
    required: true,
    section: "talk-voice",
    description: "Feature flag for Staging self-hosted TURN (true|false)",
  },
  {
    key: "TALK_VOICE_CONNECTION_TELEMETRY_ENABLED",
    required: true,
    section: "talk-voice",
    description: "Connection/route telemetry flag (true|false)",
  },
  {
    key: "TALK_VOICE_TURN_HOST",
    required: true,
    section: "turn",
    description: "Staging TURN DNS hostname (no Production host)",
  },
  {
    key: "TALK_VOICE_TURN_UDP_PORT",
    required: true,
    section: "turn",
    description: "TURN UDP port (3478)",
  },
  {
    key: "TALK_VOICE_TURN_TCP_PORT",
    required: true,
    section: "turn",
    description: "TURN TCP port (3478)",
  },
  {
    key: "TALK_VOICE_TURN_TLS_PORT",
    required: true,
    section: "turn",
    description: "TURN TLS port (443 preferred for Staging E2E)",
  },
  {
    key: "TALK_VOICE_TURN_REALM",
    required: true,
    section: "turn",
    description: "coturn realm (usually matches TURN host)",
  },
  {
    key: "TALK_VOICE_TURN_SHARED_SECRET",
    required: true,
    secret: true,
    section: "turn",
    description: "HMAC REST shared secret ≥32 chars (secret manager only)",
  },
  {
    key: "TALK_VOICE_TURN_TLS_CERT_PATH",
    required: true,
    section: "turn",
    description: "Path string for fullchain PEM (not committed; presence check only)",
  },
  {
    key: "TALK_VOICE_TURN_TLS_KEY_PATH",
    required: true,
    section: "turn",
    description: "Path string for private key PEM (not committed)",
  },
  {
    key: "TALK_VOICE_TURN_CREDENTIAL_API_URL",
    required: true,
    section: "api",
    description: "Staging credential API base (e.g. http://127.0.0.1:8788/api/talk-voice-turn-credentials)",
  },
  {
    key: "TALK_VOICE_TELEMETRY_SINK",
    required: true,
    section: "api",
    description: "Telemetry sink id (session_columns|noop) — no Production URL",
  },
  {
    key: "AUTH_HOOK_L2_ALLOWLIST_PASSWORD",
    required: false,
    secret: true,
    section: "optional",
    description: "Staging Auth test password (optional · Staging-only user)",
  },
  {
    key: "TALK_VOICE_TURN_FORCE_RELAY_TEST",
    required: false,
    section: "optional",
    description: "Internal iceTransportPolicy=relay force (Staging only)",
  },
  {
    key: "TALK_VOICE_TURN_CREDENTIAL_TTL_SEC",
    required: false,
    section: "optional",
    description: "Credential TTL seconds (300–1800 · default 1200)",
  },
  {
    key: "TALK_VOICE_TURN_EXTERNAL_IP",
    required: false,
    section: "optional",
    description: "coturn external-ip mapping hint (docs/runbook)",
  },
  {
    key: "TALK_VOICE_TURN_RELAY_IP",
    required: false,
    section: "optional",
    description: "coturn relay-ip hint (docs/runbook)",
  },
  {
    key: "SITE_URL",
    required: false,
    section: "optional",
    description: "Staging SITE_URL (8788 or Preview · never Production)",
  },
];

export function parseEnvText(text) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

export function loadEnvFile(filePath = STAGING_ENV_FILE) {
  if (!existsSync(filePath)) return null;
  return parseEnvText(readFileSync(filePath, "utf8"));
}

export function isSecretKey(key) {
  return SECRET_KEYS.has(key) || /SECRET|PASSWORD|SERVICE_ROLE|PRIVATE|PKEY/i.test(key);
}

export function redactValue(key, value) {
  if (value == null || value === "") return "(empty)";
  if (!isSecretKey(key)) return String(value);
  return `set(len=${String(value).length})`;
}

export function isPlaceholder(value) {
  const v = String(value || "").trim();
  if (!v) return true;
  if (PLACEHOLDER_RE.test(v)) return true;
  if (/example\.invalid/i.test(v)) return true;
  if (/^<.*>$/.test(v)) return true;
  return false;
}

export function productionHostPatterns() {
  const manifest = loadManifest();
  const prodRef = getProductionRef();
  const prodHost = String(manifest?.cloudflare_pages?.production_host || "tasufull-article.pages.dev");
  return [
    prodRef,
    prodHost,
    `${prodRef}.supabase.co`,
    `https://${prodRef}.supabase.co`,
    "https://tasufull-article.pages.dev",
    "tasufull-article.pages.dev",
  ];
}

export function containsProductionMarker(value) {
  const raw = String(value || "").toLowerCase();
  if (!raw) return false;
  const prodRef = getProductionRef().toLowerCase();
  for (const p of productionHostPatterns()) {
    if (raw.includes(String(p).toLowerCase())) return true;
  }
  if (raw.includes(prodRef)) return true;
  return false;
}

function isTruthyFlag(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function parsePort(value, expected) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return { ok: false, error: "invalid_port" };
  if (expected != null && n !== expected) {
    return { ok: false, error: `expected_port_${expected}`, port: n };
  }
  return { ok: true, port: n };
}

/**
 * Validate Staging env map. Never mutates DB / TURN.
 * @param {Record<string, string>} env
 * @param {{ requireSecretsFilled?: boolean, allowPlaceholders?: boolean }} [opts]
 */
export function validateTalkVoiceStagingEnv(env, opts = {}) {
  const requireSecretsFilled = opts.requireSecretsFilled !== false;
  const allowPlaceholders = opts.allowPlaceholders === true;
  const stagingRef = getStagingRef();
  const productionRef = getProductionRef();
  /** @type {{ level: 'error'|'warn', code: string, key?: string, message: string }[]} */
  const issues = [];
  /** @type {string[]} */
  const missing = [];
  /** @type {string[]} */
  const present = [];

  const expectedIssuer = `https://${stagingRef}.supabase.co/auth/v1`;
  const expectedUrl = `https://${stagingRef}.supabase.co`;

  for (const field of TALK_VOICE_STAGING_ENV_FIELDS) {
    const raw = env?.[field.key];
    const value = raw == null ? "" : String(raw).trim();
    const empty = value === "";
    const placeholder = isPlaceholder(value);

    if (field.required && (empty || (!allowPlaceholders && placeholder && !field.placeholderOk))) {
      missing.push(field.key);
      issues.push({
        level: "error",
        code: empty ? "missing" : "placeholder",
        key: field.key,
        message: empty
          ? `${field.key} is required`
          : `${field.key} still has a placeholder/empty-like value`,
      });
      continue;
    }

    if (!field.required && (empty || placeholder)) {
      continue;
    }

    present.push(field.key);

    // BD_PRODUCTION_PROJECT_REF intentionally stores the Production ref for abort guards.
    if (field.key !== "BD_PRODUCTION_PROJECT_REF" && containsProductionMarker(value)) {
      issues.push({
        level: "error",
        code: "production_value",
        key: field.key,
        message: `${field.key} contains a Production host/ref — Staging-only values required`,
      });
    }
  }

  const projectRef = String(env?.SUPABASE_PROJECT_REF || "").trim();
  if (projectRef && projectRef !== stagingRef) {
    issues.push({
      level: "error",
      code: "wrong_project_ref",
      key: "SUPABASE_PROJECT_REF",
      message: `SUPABASE_PROJECT_REF must be Staging ${stagingRef} (got ${projectRef})`,
    });
  }
  if (projectRef === productionRef) {
    issues.push({
      level: "error",
      code: "production_ref",
      key: "SUPABASE_PROJECT_REF",
      message: "SUPABASE_PROJECT_REF equals Production — abort",
    });
  }

  for (const urlKey of ["SUPABASE_URL", "TASFUL_SUPABASE_URL"]) {
    const u = String(env?.[urlKey] || "").trim().replace(/\/$/, "");
    if (!u) continue;
    if (u !== expectedUrl) {
      issues.push({
        level: "error",
        code: "wrong_supabase_url",
        key: urlKey,
        message: `${urlKey} must be ${expectedUrl}`,
      });
    }
  }

  const guardProd = String(env?.BD_PRODUCTION_PROJECT_REF || "").trim();
  if (guardProd && guardProd !== productionRef) {
    issues.push({
      level: "error",
      code: "bad_production_guard",
      key: "BD_PRODUCTION_PROJECT_REF",
      message: `BD_PRODUCTION_PROJECT_REF must equal manifest Production ${productionRef}`,
    });
  }

  const issuer = String(env?.TALK_VOICE_STAGING_JWT_ISSUER || "").trim().replace(/\/$/, "");
  if (issuer && issuer !== expectedIssuer) {
    issues.push({
      level: "error",
      code: "wrong_issuer",
      key: "TALK_VOICE_STAGING_JWT_ISSUER",
      message: `JWT issuer must be Staging ${expectedIssuer}`,
    });
  }

  const audience = String(env?.TALK_VOICE_STAGING_JWT_AUDIENCE || "").trim();
  if (audience && audience !== "authenticated") {
    issues.push({
      level: "warn",
      code: "unexpected_audience",
      key: "TALK_VOICE_STAGING_JWT_AUDIENCE",
      message: `JWT audience is "${audience}" (expected authenticated for Supabase access tokens)`,
    });
  }

  const origins = String(env?.TALK_VOICE_STAGING_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (origins.length) {
    if (!origins.includes("http://127.0.0.1:8788")) {
      issues.push({
        level: "error",
        code: "missing_local_origin",
        key: "TALK_VOICE_STAGING_ALLOWED_ORIGINS",
        message: "allowed origins must include http://127.0.0.1:8788",
      });
    }
    for (const origin of origins) {
      if (containsProductionMarker(origin)) {
        issues.push({
          level: "error",
          code: "production_origin",
          key: "TALK_VOICE_STAGING_ALLOWED_ORIGINS",
          message: `origin rejected (Production marker): ${origin}`,
        });
      }
    }
  }

  const hostname = String(env?.TALK_VOICE_STAGING_HOSTNAME || "").trim().toLowerCase();
  if (hostname) {
    if (containsProductionMarker(hostname) || hostname === "localhost") {
      issues.push({
        level: "error",
        code: "bad_hostname",
        key: "TALK_VOICE_STAGING_HOSTNAME",
        message: "Staging hostname must not be Production or bare localhost",
      });
    }
  }

  const turnHost = String(env?.TALK_VOICE_TURN_HOST || "").trim().toLowerCase();
  if (turnHost && (containsProductionMarker(turnHost) || turnHost === "localhost")) {
    issues.push({
      level: "error",
      code: "bad_turn_host",
      key: "TALK_VOICE_TURN_HOST",
      message: "TURN host must be Staging-only (not Production / localhost)",
    });
  }

  for (const [key, expected] of [
    ["TALK_VOICE_TURN_UDP_PORT", 3478],
    ["TALK_VOICE_TURN_TCP_PORT", 3478],
    ["TALK_VOICE_TURN_TLS_PORT", 443],
  ]) {
    const v = String(env?.[key] || "").trim();
    if (!v) continue;
    const parsed = parsePort(v, expected);
    if (!parsed.ok) {
      issues.push({
        level: "error",
        code: parsed.error,
        key,
        message: `${key} must be ${expected} for Phase 2 Staging matrix`,
      });
    }
  }

  const secret = String(env?.TALK_VOICE_TURN_SHARED_SECRET || "");
  if (requireSecretsFilled && secret && !isPlaceholder(secret) && secret.length < 32) {
    issues.push({
      level: "error",
      code: "short_turn_secret",
      key: "TALK_VOICE_TURN_SHARED_SECRET",
      message: "TALK_VOICE_TURN_SHARED_SECRET must be at least 32 characters (value not shown)",
    });
  }

  const apiUrl = String(env?.TALK_VOICE_TURN_CREDENTIAL_API_URL || "").trim();
  if (apiUrl) {
    if (containsProductionMarker(apiUrl)) {
      issues.push({
        level: "error",
        code: "production_api",
        key: "TALK_VOICE_TURN_CREDENTIAL_API_URL",
        message: "credential API URL must not target Production",
      });
    }
    if (!/\/api\/talk-voice-turn-credentials\/?$/.test(apiUrl.replace(/\?.*$/, ""))) {
      issues.push({
        level: "error",
        code: "bad_api_path",
        key: "TALK_VOICE_TURN_CREDENTIAL_API_URL",
        message: "credential API URL must end with /api/talk-voice-turn-credentials",
      });
    }
  }

  const tlsCert = String(env?.TALK_VOICE_TURN_TLS_CERT_PATH || "").trim();
  const tlsKey = String(env?.TALK_VOICE_TURN_TLS_KEY_PATH || "").trim();
  if (tlsCert && isPlaceholder(tlsCert) === false && !path.isAbsolute(tlsCert) && !tlsCert.startsWith("/")) {
    issues.push({
      level: "warn",
      code: "relative_cert_path",
      key: "TALK_VOICE_TURN_TLS_CERT_PATH",
      message: "TLS cert path should be an absolute host path (string check only · file not read)",
    });
  }
  if (tlsKey && containsProductionMarker(tlsKey)) {
    issues.push({
      level: "error",
      code: "production_key_path",
      key: "TALK_VOICE_TURN_TLS_KEY_PATH",
      message: "TLS key path rejected (Production marker)",
    });
  }

  const featureOn = isTruthyFlag(env?.TALK_VOICE_SELF_HOSTED_TURN_ENABLED);
  const telemetryOn = isTruthyFlag(env?.TALK_VOICE_CONNECTION_TELEMETRY_ENABLED);
  if (String(env?.TALK_VOICE_SELF_HOSTED_TURN_ENABLED || "").trim() && !/^(true|false|1|0|yes|no|on|off)$/i.test(String(env.TALK_VOICE_SELF_HOSTED_TURN_ENABLED).trim())) {
    issues.push({
      level: "error",
      code: "bad_feature_flag",
      key: "TALK_VOICE_SELF_HOSTED_TURN_ENABLED",
      message: "feature flag must be boolean-like",
    });
  }

  const errors = issues.filter((i) => i.level === "error");
  return {
    ok: errors.length === 0 && missing.length === 0,
    stagingRef,
    productionRef,
    expectedIssuer,
    expectedUrl,
    missing,
    present,
    issues,
    flags: {
      selfHostedTurnEnabled: featureOn,
      connectionTelemetryEnabled: telemetryOn,
    },
  };
}

export function summarizeValidation(result) {
  const lines = [];
  lines.push(`staging_ref=${result.stagingRef}`);
  lines.push(`production_ref_guard=${result.productionRef}`);
  lines.push(`ok=${result.ok}`);
  if (result.missing.length) {
    lines.push(`missing_or_placeholder=${result.missing.join(",")}`);
  }
  for (const issue of result.issues) {
    const key = issue.key ? `${issue.key}: ` : "";
    lines.push(`${issue.level.toUpperCase()} ${issue.code} - ${key}${issue.message}`);
  }
  return lines.join("\n");
}

export function listEnvMatrix() {
  return TALK_VOICE_STAGING_ENV_FIELDS.map((f) => ({
    key: f.key,
    required: f.required,
    secret: Boolean(f.secret || isSecretKey(f.key)),
    section: f.section,
    description: f.description,
  }));
}
