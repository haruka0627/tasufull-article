/**

 * wrangler pages dev 用 — repo root .env / .env.staging → deploy/cloudflare/dist/.dev.vars

 *

 * Pages Functions の context.env は --env-file だけでは載らないことがある。

 * CWD=dist の .dev.vars が Function binding の正本（DEEPSEEK / ZEGO / Supabase 共通）。

 *

 * Supabase 系は **.env.staging 優先**（Platform Request / Staging E2E 用）。

 * Secret 値はログに出さない · presence のみ。

 */

import fs from "node:fs";

import path from "node:path";

import { fileURLToPath } from "node:url";

import { loadDotEnvFile } from "./zego-env.mjs";

import { getProductionRef, getStagingRef } from "./supabase-env.mjs";



const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const STAGING_REF = getStagingRef();

const PRODUCTION_REF = getProductionRef();



/** Pages Function context.env に載せるキー */

export const PAGES_FUNCTION_ENV_KEYS = Object.freeze([

  "ZEGO_APP_ID",

  "ZEGO_SERVER",

  "ZEGO_SERVER_SECRET",

  "DEEPSEEK_API_KEY",

  "GEMINI_API_KEY",

  "SUPABASE_URL",

  "SUPABASE_ANON_KEY",

  "SUPABASE_SERVICE_ROLE_KEY",

  "TASFUL_SUPABASE_URL",

  "TASFUL_SUPABASE_ANON_KEY",

  "STRIPE_SECRET_KEY",

  "STRIPE_WEBHOOK_SECRET",

  "PLATFORM_REQUEST_STRIPE_SIMULATE",

]);



/** Staging 優先で .env.staging から読む Supabase キー */

export const SUPABASE_STAGING_PRIORITY_KEYS = Object.freeze([

  "SUPABASE_URL",

  "SUPABASE_ANON_KEY",

  "SUPABASE_SERVICE_ROLE_KEY",

  "TASFUL_SUPABASE_URL",

  "TASFUL_SUPABASE_ANON_KEY",

]);



/** @param {string} content */

export function parseDevVarsFile(content) {

  /** @type {Map<string, string>} */

  const map = new Map();

  for (const line of String(content || "").split(/\r?\n/)) {

    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const m = /^\s*([^#=]+)=(.*)$/.exec(line);

    if (!m) continue;

    let v = m[2].trim();

    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {

      v = v.slice(1, -1);

    }

    map.set(m[1].trim(), v);

  }

  return map;

}



/** @param {string} filePath */

function parseEnvFile(filePath) {

  if (!fs.existsSync(filePath)) return new Map();

  return parseDevVarsFile(fs.readFileSync(filePath, "utf8"));

}



function pickStr() {

  for (let i = 0; i < arguments.length; i += 1) {

    const s = String(arguments[i] ?? "").trim();

    if (s) return s;

  }

  return "";

}



function readChatSupabaseConfig() {

  const cfgPath = path.join(ROOT, "chat-supabase-config.js");

  if (!fs.existsSync(cfgPath)) return { url: "", anonKey: "" };

  const js = fs.readFileSync(cfgPath, "utf8");

  return {

    url: js.match(/url:\s*"(https:[^"]+)"/)?.[1]?.replace(/\/$/, "") || "",

    anonKey: js.match(/anonKey:\s*"(eyJ[^"]+|sb_[^"]+)"/)?.[1] || "",

  };

}



/**

 * @param {string} url

 */

export function refFromSupabaseUrl(url) {

  const m = String(url || "").match(/https:\/\/([^.]+)\.supabase\.co/);

  return m ? m[1] : "";

}



/**

 * @param {string} jwt

 */

export function refFromSupabaseJwt(jwt) {

  try {

    const part = String(jwt || "").split(".")[1];

    if (!part) return "";

    const payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

    return String(payload.ref || "").trim();

  } catch {

    return "";

  }

}



/**

 * @param {Map<string, string>} map

 */

export function validateStagingSupabaseVars(map) {

  const issues = [];

  const url = pickStr(map.get("TASFUL_SUPABASE_URL"), map.get("SUPABASE_URL"));

  const anon = pickStr(map.get("TASFUL_SUPABASE_ANON_KEY"), map.get("SUPABASE_ANON_KEY"));

  const service = pickStr(map.get("SUPABASE_SERVICE_ROLE_KEY"));



  const urlRef = refFromSupabaseUrl(url);

  if (!url) issues.push("missing_supabase_url");

  else if (urlRef === PRODUCTION_REF) issues.push("production_url_forbidden");

  else if (urlRef && urlRef !== STAGING_REF) issues.push(`unexpected_url_ref:${urlRef}`);



  if (!anon) issues.push("missing_supabase_anon_key");



  if (!service) issues.push("missing_service_role_key");

  else {

    const role = (() => {

      try {

        const payload = JSON.parse(

          Buffer.from(service.split(".")[1], "base64url").toString("utf8")

        );

        return String(payload.role || "");

      } catch {

        return "";

      }

    })();

    const srRef = refFromSupabaseJwt(service);

    if (role !== "service_role") issues.push("service_role_jwt_invalid_role");

    if (srRef === PRODUCTION_REF) issues.push("production_service_role_forbidden");

    else if (srRef && srRef !== STAGING_REF) issues.push(`unexpected_service_role_ref:${srRef}`);

  }



  return { ok: issues.length === 0, issues, urlRef: urlRef || STAGING_REF };

}



/**

 * @param {Map<string, string>} map

 * @param {string[]} [keyOrder]

 */

export function serializeDevVars(map, keyOrder = [...PAGES_FUNCTION_ENV_KEYS]) {

  const lines = [

    "# Local Pages Functions dev — do not commit (gitignore)",

    "# Synced from repo root .env + .env.staging via scripts/lib/sync-pages-dev-vars.mjs",

    "# Supabase keys: .env.staging priority (Staging only for Platform Request match-sync)",

    "",

  ];

  const written = new Set();

  for (const key of keyOrder) {

    const v = map.get(key);

    if (v) {

      lines.push(`${key}=${v}`);

      written.add(key);

    }

  }

  for (const [key, v] of map) {

    if (written.has(key) || !v) continue;

    lines.push(`${key}=${v}`);

  }

  return `${lines.join("\n")}\n`;

}



/**

 * Build Pages Functions env map: ZEGO/DeepSeek from .env · Supabase from .env.staging first.

 */

export function buildPagesFunctionEnvMap() {

  const fromEnv = parseEnvFile(path.join(ROOT, ".env"));

  const fromStaging = parseEnvFile(path.join(ROOT, ".env.staging"));

  const chatCfg = readChatSupabaseConfig();



  /** @type {Map<string, string>} */

  const merged = new Map();



  for (const key of PAGES_FUNCTION_ENV_KEYS) {

    if (SUPABASE_STAGING_PRIORITY_KEYS.includes(key)) {

      const v = pickStr(fromStaging.get(key), fromEnv.get(key));

      if (v) merged.set(key, v);

    } else {

      const v = pickStr(fromEnv.get(key), fromStaging.get(key));

      if (v) merged.set(key, v);

    }

  }



  if (!merged.get("TASFUL_SUPABASE_URL") && chatCfg.url.includes(STAGING_REF)) {

    merged.set("TASFUL_SUPABASE_URL", chatCfg.url);

  }

  if (!merged.get("SUPABASE_URL") && merged.get("TASFUL_SUPABASE_URL")) {

    merged.set("SUPABASE_URL", merged.get("TASFUL_SUPABASE_URL"));

  }

  if (!merged.get("TASFUL_SUPABASE_ANON_KEY") && chatCfg.anonKey) {

    merged.set("TASFUL_SUPABASE_ANON_KEY", chatCfg.anonKey);

  }

  if (!merged.get("SUPABASE_ANON_KEY") && merged.get("TASFUL_SUPABASE_ANON_KEY")) {

    merged.set("SUPABASE_ANON_KEY", merged.get("TASFUL_SUPABASE_ANON_KEY"));

  }



  return merged;

}



/**

 * @param {string} [distDir]

 * @param {string} [envPath] — legacy: also load into process.env before build

 */

export function syncPagesDevVars(distDir = path.join(ROOT, "deploy/cloudflare/dist"), envPath) {

  loadDotEnvFile(envPath);

  const stagingPath = path.join(ROOT, ".env.staging");

  if (fs.existsSync(stagingPath)) {

    for (const line of fs.readFileSync(stagingPath, "utf8").split(/\r?\n/)) {

      const m = /^\s*([^#=]+)=(.*)$/.exec(line);

      if (!m) continue;

      let v = m[2].trim();

      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {

        v = v.slice(1, -1);

      }

      if (!process.env[m[1].trim()]) process.env[m[1].trim()] = v;

    }

  }



  const merged = buildPagesFunctionEnvMap();

  const stagingCheck = validateStagingSupabaseVars(merged);



  const dest = path.join(distDir, ".dev.vars");

  fs.mkdirSync(distDir, { recursive: true });

  fs.writeFileSync(dest, serializeDevVars(merged), "utf8");



  const zegoAppId = merged.get("ZEGO_APP_ID") || "";

  const zegoServer = merged.get("ZEGO_SERVER") || "";

  const zegoSecret = merged.get("ZEGO_SERVER_SECRET") || "";



  return {

    ok: true,

    path: dest,

    presence: {

      ZEGO_APP_ID: Boolean(String(zegoAppId).trim()),

      ZEGO_SERVER: Boolean(String(zegoServer).trim()),

      ZEGO_SERVER_SECRET: Boolean(String(zegoSecret).trim()),

      DEEPSEEK_API_KEY: Boolean(String(merged.get("DEEPSEEK_API_KEY") || "").trim()),

      GEMINI_API_KEY: Boolean(String(merged.get("GEMINI_API_KEY") || "").trim()),

      SUPABASE_URL: Boolean(String(merged.get("SUPABASE_URL") || "").trim()),

      SUPABASE_ANON_KEY: Boolean(String(merged.get("SUPABASE_ANON_KEY") || "").trim()),

      SUPABASE_SERVICE_ROLE_KEY: Boolean(String(merged.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim()),

      TASFUL_SUPABASE_URL: Boolean(String(merged.get("TASFUL_SUPABASE_URL") || "").trim()),

      TASFUL_SUPABASE_ANON_KEY: Boolean(String(merged.get("TASFUL_SUPABASE_ANON_KEY") || "").trim()),

    },

    stagingSupabase: stagingCheck,

    zegoSecretLen: String(zegoSecret).trim().length,

    zegoRuntimeReady:

      Boolean(Number(zegoAppId)) && String(zegoSecret).trim().length === 32,

  };

}


