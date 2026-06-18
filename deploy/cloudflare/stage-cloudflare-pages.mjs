#!/usr/bin/env node
/**
 * NB-1A draft — Cloudflare Pages 用ステージングビルド
 *
 * 使い方（ローカル検証）:
 *   TASFUL_SUPABASE_URL=https://ddojquacsyqesrjhcvmn.supabase.co \
 *   TASFUL_SUPABASE_ANON_KEY=eyJ... \
 *   node deploy/cloudflare/stage-cloudflare-pages.mjs
 *
 * CF Pages 環境変数（Encrypted）に同名を設定し、build command で本スクリプトを実行する。
 * 本番では currentUserId / me を含めない（auth-current-user.js が JWT のみを正とする）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(__dirname, "dist");

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  "reports",
  "supabase",
  "backups",
  "screenshots",
  "deploy",
  ".tmp.driveupload",
]);

const EXCLUDE_FILES = new Set([
  "package.json",
  "package-lock.json",
  "vite.config.js",
  ".gitignore",
  ".env",
  ".env.local",
  "chat-supabase-config.js",
  "chat-supabase-config.local.js",
]);

function shouldSkip(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  const parts = norm.split("/");
  if (parts.some((p) => EXCLUDE_DIRS.has(p))) return true;
  const base = parts[parts.length - 1];
  if (EXCLUDE_FILES.has(base)) return true;
  if (base.endsWith(".log")) return true;
  if (base.startsWith(".git-")) return true;

  if (parts[0] === "scripts") {
    if (parts.includes("lib")) return true;
    if (parts.length === 1) return false;
    if (base.startsWith("_")) return true;
    if (base.endsWith(".mjs")) return true;
    if (base.endsWith(".html")) return true;
    if (base === "export-real-device-localStorage-console.js") return true;
    if (!base.endsWith(".js")) return true;
  }

  return false;
}

function copyRecursive(src, dest, rel = "") {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (shouldSkip(rel)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name), rel ? `${rel}/${name}` : name);
    }
    return;
  }
  if (shouldSkip(rel)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function writeChatSupabaseConfig() {
  const url = process.env.TASFUL_SUPABASE_URL?.trim();
  const anonKey = process.env.TASFUL_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    console.error(
      "[stage-cloudflare-pages] ERROR: TASFUL_SUPABASE_URL and TASFUL_SUPABASE_ANON_KEY are required."
    );
    process.exit(1);
  }
  const body = `/**
 * Generated at deploy — do not commit. Source: deploy/cloudflare/stage-cloudflare-pages.mjs
 */
window.TASU_CHAT_SUPABASE_CONFIG = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)},
};

window.TASU_TALK_CALL_CONFIG = window.TASU_TALK_CALL_CONFIG || {};
`;
  fs.writeFileSync(path.join(OUT_DIR, "chat-supabase-config.js"), body, "utf8");
}

function copyCfMeta() {
  for (const name of ["_redirects", "_headers"]) {
    const src = path.join(__dirname, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(OUT_DIR, name));
    }
  }
}

function main() {
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const name of fs.readdirSync(REPO_ROOT)) {
    const src = path.join(REPO_ROOT, name);
    if (name === "deploy") {
      // builder/ 等はルート直下のみコピー。deploy/ 自体は除外。
      continue;
    }
    copyRecursive(src, path.join(OUT_DIR, name), name);
  }

  writeChatSupabaseConfig();
  copyCfMeta();

  console.log(`[stage-cloudflare-pages] OK → ${OUT_DIR}`);
}

main();
