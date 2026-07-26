#!/usr/bin/env node
/**
 * dev / verify 起動前に deploy/cloudflare/dist を確認
 * robots.txt · _headers が無い場合は deploy/cloudflare/ から同期
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnvFile } from "./lib/zego-env.mjs";
import { writeLiveZegoConfigToDist } from "./lib/write-live-zego-config.mjs";
import { writePlatformZegoConfigToDist } from "./lib/write-platform-zego-config.mjs";
import { syncPagesDevVars } from "./lib/sync-pages-dev-vars.mjs";
import { syncPlatformQaCurationToDist } from "./lib/sync-platform-qa-curation-to-dist.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CF_DIR = path.join(ROOT, "deploy/cloudflare");
const DIST = path.join(CF_DIR, "dist");
const marker = path.join(DIST, "index.html");

const ROOT_SYNC_EXT = new Set([".js", ".css", ".html"]);
const ROOT_SYNC_SKIP = new Set([
  "chat-supabase-config.js",
  "chat-supabase-config.local.js",
  "platform-qa-admin-ui.js",
  "platform-qa-curation.js",
  "platform-qa-curation-ui.js",
  "platform-qa-dev.js",
]);

const CF_META = ["robots.txt", "_headers", "_redirects"];
const FUNCTIONS_SRC = path.join(CF_DIR, "functions");
const FUNCTIONS_DEST = path.join(DIST, "functions");
const LIVE_SRC = path.join(ROOT, "live");
const LIVE_DEST = path.join(DIST, "live");

function copyFileIfChanged(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    return true;
  }
  const srcStat = fs.statSync(src);
  const destStat = fs.statSync(dest);
  if (srcStat.mtimeMs > destStat.mtimeMs || srcStat.size !== destStat.size) {
    fs.copyFileSync(src, dest);
    return true;
  }
  const srcBuf = fs.readFileSync(src);
  const destBuf = fs.readFileSync(dest);
  if (!srcBuf.equals(destBuf)) {
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

function syncLiveDir() {
  if (!fs.existsSync(LIVE_SRC)) return 0;
  let synced = 0;
  const walk = (rel = "") => {
    const srcDir = rel ? path.join(LIVE_SRC, rel) : LIVE_SRC;
    for (const name of fs.readdirSync(srcDir)) {
      const relPath = rel ? `${rel}/${name}` : name;
      const src = path.join(LIVE_SRC, relPath);
      const dest = path.join(LIVE_DEST, relPath);
      if (fs.statSync(src).isDirectory()) {
        walk(relPath);
      } else if (copyFileIfChanged(src, dest)) {
        synced += 1;
      }
    }
  };
  walk();
  return synced;
}

function syncPagesFunctions() {
  if (!fs.existsSync(FUNCTIONS_SRC)) return 0;
  let synced = 0;
  const walk = (rel = "") => {
    const srcDir = rel ? path.join(FUNCTIONS_SRC, rel) : FUNCTIONS_SRC;
    for (const name of fs.readdirSync(srcDir)) {
      const relPath = rel ? `${rel}/${name}` : name;
      const src = path.join(FUNCTIONS_SRC, relPath);
      const dest = path.join(FUNCTIONS_DEST, relPath);
      if (fs.statSync(src).isDirectory()) {
        walk(relPath);
      } else if (copyFileIfChanged(src, dest)) {
        synced += 1;
      }
    }
  };
  walk();
  return synced;
}

function syncCfMeta() {
  let synced = 0;
  for (const name of CF_META) {
    const src = path.join(CF_DIR, name);
    const dest = path.join(DIST, name);
    if (!fs.existsSync(src)) continue;
    const needsCopy = !fs.existsSync(dest) || fs.readFileSync(src, "utf8") !== fs.readFileSync(dest, "utf8");
    if (needsCopy) {
      fs.copyFileSync(src, dest);
      synced += 1;
      console.log(`[ensure-pages-dist] synced ${name} → dist/${name}`);
    }
  }
  return synced;
}

/**
 * Local Wrangler only: write Staging url/anon into dist/chat-supabase-config.js.
 * Never writes service_role. Never mutates repo-root chat-supabase-config.js
 * (Production build continues to use root / build:pages injection).
 */
function syncChatSupabaseConfigForDev() {
  const dest = path.join(DIST, "chat-supabase-config.js");
  const stagingPath = path.join(ROOT, ".env.staging");
  const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
  const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";

  function parseEnvFile(file) {
    const map = new Map();
    if (!fs.existsSync(file)) return map;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 0) continue;
      map.set(line.slice(0, i).trim(), line.slice(i + 1).trim());
    }
    return map;
  }

  const staging = parseEnvFile(stagingPath);
  const url = String(
    staging.get("TASFUL_SUPABASE_URL") || staging.get("SUPABASE_URL") || "",
  )
    .trim()
    .replace(/\/$/, "");
  const anonKey = String(
    staging.get("TASFUL_SUPABASE_ANON_KEY") || staging.get("SUPABASE_ANON_KEY") || "",
  ).trim();

  if (url.includes(STAGING_REF) && anonKey && !/service_role|sb_secret/i.test(anonKey)) {
    const js =
      `/**\n` +
      ` * AUTO-GENERATED for local Wrangler (npm run dev) — Staging only.\n` +
      ` * Source: .env.staging · Do not commit dist copy · No service_role.\n` +
      ` * Production builds use repo chat-supabase-config.js / build injection.\n` +
      ` */\n` +
      `window.TASU_CHAT_SUPABASE_CONFIG = {\n` +
      `  url: ${JSON.stringify(url)},\n` +
      `  anonKey: ${JSON.stringify(anonKey)},\n` +
      `  currentUserId: "u_me",\n` +
      `  me: {\n` +
      `    id: "u_me",\n` +
      `    displayName: "あなた",\n` +
      `    avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=ME",\n` +
      `  },\n` +
      `};\n\n` +
      `window.__MATCH_FUNCTIONS_BASE__ =\n` +
      `  window.__MATCH_FUNCTIONS_BASE__ ||\n` +
      `  ${JSON.stringify(`${url}/functions/v1`)};\n\n` +
      `window.TASU_TALK_CALL_CONFIG = window.TASU_TALK_CALL_CONFIG || {\n` +
      `  webPushVapidPublicKey: "",\n` +
      `  pushIncomingEnabled: false,\n` +
      `  pushSubscribeEnabled: false,\n` +
      `};\n`;
    fs.writeFileSync(dest, js, "utf8");
    console.log(
      `[ensure-pages-dist] wrote dist/chat-supabase-config.js from .env.staging (${STAGING_REF})`,
    );
    return true;
  }

  // Fallback: copy root config only if dist lacks a usable anon key.
  const src = path.join(ROOT, "chat-supabase-config.js");
  if (!fs.existsSync(src)) return false;
  const rootJs = fs.readFileSync(src, "utf8");
  const rootAnon = rootJs.match(/anonKey:\s*"(eyJ[^"]+|sb_[^"]+)"/)?.[1] || "";
  if (!rootAnon) return false;
  if (fs.existsSync(dest)) {
    const distAnon = fs.readFileSync(dest, "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] || "";
    if (distAnon.startsWith("eyJ") && distAnon.length > 80) return false;
  }
  if (rootJs.includes(PRODUCTION_REF)) {
    console.warn(
      "[ensure-pages-dist] .env.staging incomplete — dist chat config may stay Production; set Staging vars",
    );
  }
  fs.copyFileSync(src, dest);
  console.log("[ensure-pages-dist] synced chat-supabase-config.js from repo root (fallback)");
  return true;
}

/**
 * ルート直下の .js / .css / .html のうち dist に未存在のものを
 * 増分同期する（stage-cloudflare-pages.mjs の copyRecursive と同じ
 * 除外ルールを dev 起動時にも適用）。
 */
function syncRootStaticAssets() {
  let synced = 0;
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!ROOT_SYNC_EXT.has(ext)) continue;
    if (ROOT_SYNC_SKIP.has(ent.name)) continue;
    if (ent.name.endsWith(".log") || ent.name.startsWith(".git-")) continue;

    const src = path.join(ROOT, ent.name);
    const dest = path.join(DIST, ent.name);
    if (copyFileIfChanged(src, dest)) {
      synced += 1;
    }
  }
  if (synced > 0) {
    console.log(`[ensure-pages-dist] synced ${synced} root asset(s) → dist/`);
  }
  return synced;
}

/**
 * build の applyRootTopRouting と同様 — dev 増分同期後も `/` が platform TOP になるよう維持。
 * syncRootStaticAssets が repo 直下 index.html（legacy market）を dist に上書きするため。
 */
function applyRootTopRoutingToDist() {
  const distIndex = path.join(DIST, "index.html");
  const distIndexTop = path.join(DIST, "index-top.html");
  if (!fs.existsSync(distIndexTop) || !fs.existsSync(distIndex)) return false;

  const marketDir = path.join(DIST, "market");
  const marketIndex = path.join(marketDir, "index.html");
  fs.mkdirSync(marketDir, { recursive: true });
  if (!fs.existsSync(marketIndex)) {
    fs.copyFileSync(distIndex, marketIndex);
  }
  fs.copyFileSync(distIndexTop, distIndex);
  return true;
}

if (!fs.existsSync(marker)) {
  console.error("[ensure-pages-dist] deploy/cloudflare/dist が見つかりません。");
  console.error("  npm run build:pages");
  console.error("  npm run dev");
  process.exit(1);
}

const missingRequired = ["robots.txt", "_headers"].filter((n) => !fs.existsSync(path.join(DIST, n)));
if (missingRequired.length) {
  console.warn(`[ensure-pages-dist] missing in dist: ${missingRequired.join(", ")} — syncing from deploy/cloudflare/`);
  syncCfMeta();
}

const stillMissing = ["robots.txt", "_headers"].filter((n) => !fs.existsSync(path.join(DIST, n)));
if (stillMissing.length) {
  console.error(`[ensure-pages-dist] required files still missing: ${stillMissing.join(", ")}`);
  console.error("  npm run build:pages");
  process.exit(1);
}

const rootSynced = syncRootStaticAssets();
syncChatSupabaseConfigForDev();
if (applyRootTopRoutingToDist()) {
  console.log("[ensure-pages-dist] root routing: index-top.html → dist/index.html");
}

const liveSynced = syncLiveDir();
if (liveSynced > 0) {
  console.log(`[ensure-pages-dist] synced live/ → dist/live/ (${liveSynced} file(s))`);
}

const fnSynced = syncPagesFunctions();
if (fnSynced > 0) {
  console.log(`[ensure-pages-dist] synced functions/ → dist/functions/ (${fnSynced} file(s))`);
}

loadDotEnvFile();
const devVars = syncPagesDevVars(DIST);
const sb = devVars.stagingSupabase || { ok: false, issues: ["unknown"] };
console.log(
  `[ensure-pages-dist] synced dist/.dev.vars (ZEGO_APP_ID=${devVars.presence.ZEGO_APP_ID}, ZEGO_SERVER=${devVars.presence.ZEGO_SERVER}, ZEGO_SERVER_SECRET=${devVars.presence.ZEGO_SERVER_SECRET ? `present(${devVars.zegoSecretLen} chars)` : "missing"}, SUPABASE_URL=${devVars.presence.SUPABASE_URL}, SUPABASE_ANON_KEY=${devVars.presence.SUPABASE_ANON_KEY}, SUPABASE_SERVICE_ROLE_KEY=${devVars.presence.SUPABASE_SERVICE_ROLE_KEY}, staging_ok=${sb.ok})`,
);
if (!sb.ok) {
  console.warn(
    `[ensure-pages-dist] Supabase staging vars incomplete: ${(sb.issues || []).join(", ")} — set .env.staging (see docs/supabase-environments.md)`,
  );
}

const zegoCfg = writeLiveZegoConfigToDist(LIVE_DEST);
if (zegoCfg.ok) {
  console.log(`[ensure-pages-dist] generated dist/live/live-zego-config.js (appId=${zegoCfg.appId})`);
}

const platformLiveDest = path.join(DIST, "platform-live");
const platformCfg = writePlatformZegoConfigToDist(platformLiveDest);
if (platformCfg.ok) {
  console.log(`[ensure-pages-dist] generated dist/platform-live/platform-live-zego-config.js (appId=${platformCfg.appId})`);
}

const qaSync = syncPlatformQaCurationToDist();
if (qaSync.copied > 0 || qaSync.htmlPatched > 0) {
  console.log(
    `[ensure-pages-dist] Q&A curation sync: ${qaSync.copied} file(s), ${qaSync.htmlPatched} HTML patched`,
  );
}
