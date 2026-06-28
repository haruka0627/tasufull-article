/**
 * ZEGO 環境変数読込 · 検証（secret 値はログに出さない）
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * @param {string} [envPath]
 */
export function loadDotEnvFile(envPath = path.join(ROOT, ".env")) {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^\s*([^#=]+)=(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1].trim()]) process.env[m[1].trim()] = v;
  }
}

/**
 * @returns {{
 *   ok: boolean,
 *   appId: number,
 *   server: string,
 *   serverSecret: string,
 *   missing: string[],
 *   hints: string[]
 * }}
 */
export function readZegoEnv() {
  loadDotEnvFile();

  const appId = Number(process.env.ZEGO_APP_ID || 0);
  const server = String(process.env.ZEGO_SERVER || process.env.ZEGO_SERVER_URL || "").trim();
  const serverSecret = String(process.env.ZEGO_SERVER_SECRET || "").trim();
  const missing = [];
  const hints = [];

  if (!appId) missing.push("ZEGO_APP_ID");
  if (!server) missing.push("ZEGO_SERVER");
  if (!serverSecret) missing.push("ZEGO_SERVER_SECRET");
  if (serverSecret && serverSecret.length !== 32) {
    hints.push("ZEGO_SERVER_SECRET は 32 byte である必要があります");
  }

  return {
    ok: missing.length === 0 && (!serverSecret || serverSecret.length === 32),
    appId,
    server,
    serverSecret,
    missing,
    hints,
  };
}

/** @param {string} key */
export function maskEnvValue(key) {
  const v = String(process.env[key] || "").trim();
  if (!v) return "(unset)";
  if (key.includes("SECRET")) return `***(${v.length} chars)`;
  if (v.length <= 8) return "***";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}
