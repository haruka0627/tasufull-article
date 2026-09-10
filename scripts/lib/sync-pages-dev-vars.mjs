/**
 * wrangler pages dev 用 — repo root .env → deploy/cloudflare/dist/.dev.vars
 *
 * Pages Functions の context.env は --env-file だけでは載らないことがある。
 * CWD=dist の .dev.vars が Function binding の正本（DEEPSEEK / ZEGO 共通）。
 *
 * Secret 値はログに出さない · presence のみ。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnvFile } from "./zego-env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Pages Function context.env に載せるキー（.env から同期） */
export const PAGES_FUNCTION_ENV_KEYS = Object.freeze([
  "ZEGO_APP_ID",
  "ZEGO_SERVER",
  "ZEGO_SERVER_SECRET",
  "DEEPSEEK_API_KEY",
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

/**
 * @param {Map<string, string>} map
 * @param {string[]} [keyOrder]
 */
export function serializeDevVars(map, keyOrder = [...PAGES_FUNCTION_ENV_KEYS]) {
  const lines = [
    "# Local Pages Functions dev — do not commit (gitignore)",
    "# Synced from repo root .env via scripts/lib/sync-pages-dev-vars.mjs",
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
 * @param {string} [distDir]
 * @param {string} [envPath]
 */
export function syncPagesDevVars(distDir = path.join(ROOT, "deploy/cloudflare/dist"), envPath) {
  loadDotEnvFile(envPath);

  const dest = path.join(distDir, ".dev.vars");
  /** @type {Map<string, string>} */
  const merged = fs.existsSync(dest)
    ? parseDevVarsFile(fs.readFileSync(dest, "utf8"))
    : new Map();

  for (const key of PAGES_FUNCTION_ENV_KEYS) {
    const v = String(process.env[key] || "").trim();
    if (v) merged.set(key, v);
  }

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
    },
    zegoSecretLen: String(zegoSecret).trim().length,
    zegoRuntimeReady:
      Boolean(Number(zegoAppId)) &&
      String(zegoSecret).trim().length === 32,
  };
}
