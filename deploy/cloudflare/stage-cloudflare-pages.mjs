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
import { verifyTlvDist, TLV_REQUIRED_DIST } from "../../scripts/lib/tlv-dist-manifest.mjs";

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
  let url = process.env.TASFUL_SUPABASE_URL?.trim();
  let anonKey = process.env.TASFUL_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    const localCfg = path.join(REPO_ROOT, "chat-supabase-config.js");
    if (fs.existsSync(localCfg)) {
      const js = fs.readFileSync(localCfg, "utf8");
      url = url || js.match(/url:\s*"([^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
      anonKey = anonKey || js.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";
      if (url && anonKey) {
        console.warn(
          "[stage-cloudflare-pages] TASFUL_SUPABASE_* unset — using chat-supabase-config.js (local build only)",
        );
      }
    }
  }

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

function writeTlvFeatureFlags() {
  const publicEnabled = String(process.env.TLV_PUBLIC_ENABLED || "false").toLowerCase() === "true";
  const privateTestEnabled = String(process.env.TLV_PRIVATE_TEST_ENABLED ?? "true").toLowerCase() !== "false";
  const emails = String(process.env.TLV_ALLOWED_TEST_EMAILS || "rubi.hiro0613@gmail.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const body = `/**
 * Generated at deploy — TLV Phase 14 private production test
 * Do not commit dist copy. Source: deploy/cloudflare/stage-cloudflare-pages.mjs
 */
(function (global) {
  "use strict";
  global.TLV_FEATURE_FLAGS = Object.freeze({
    publicEnabled: ${publicEnabled},
    privateTestEnabled: ${privateTestEnabled},
    allowedTestEmails: Object.freeze(${JSON.stringify(emails)}),
  });
})(typeof window !== "undefined" ? window : globalThis);
`;
  const liveDir = path.join(OUT_DIR, "live");
  fs.mkdirSync(liveDir, { recursive: true });
  fs.writeFileSync(path.join(liveDir, "tlv-feature-flags.js"), body, "utf8");
  console.log(
    `[stage-cloudflare-pages] TLV flags public=${publicEnabled} privateTest=${privateTestEnabled} emails=${emails.length}`,
  );
}

const ROBOTS_META = '<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">';
const ROBOTS_META_RE = /<meta\s+name=["']robots["'][^>]*\/?>/gi;

function applySearchBlockingToHtml(html) {
  if (!/<head[\s>]/i.test(html)) return html;
  if (ROBOTS_META_RE.test(html)) {
    ROBOTS_META_RE.lastIndex = 0;
    return html.replace(ROBOTS_META_RE, ROBOTS_META);
  }
  return html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n  ${ROBOTS_META}`);
}

function walkHtmlFiles(dir, fn) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkHtmlFiles(p, fn);
    else if (ent.name.endsWith(".html")) fn(p);
  }
}

function applySearchBlockingToDist() {
  let htmlCount = 0;
  walkHtmlFiles(OUT_DIR, (filePath) => {
    const raw = fs.readFileSync(filePath, "utf8");
    const next = applySearchBlockingToHtml(raw);
    if (next !== raw) fs.writeFileSync(filePath, next, "utf8");
    htmlCount += 1;
  });
  console.log(`[stage-cloudflare-pages] search-blocking: ${htmlCount} HTML files (meta robots)`);
}

function copyCfMeta() {
  const required = ["robots.txt", "_headers"];
  const optional = ["_redirects"];

  for (const name of [...required, ...optional]) {
    const src = path.join(__dirname, name);
    const dest = path.join(OUT_DIR, name);
    if (!fs.existsSync(src)) {
      if (required.includes(name)) {
        console.error(`[stage-cloudflare-pages] ERROR: required file missing: ${src}`);
        process.exit(1);
      }
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log(`[stage-cloudflare-pages] copied ${name} → dist/${name}`);
  }

  for (const name of required) {
    const dest = path.join(OUT_DIR, name);
    if (!fs.existsSync(dest)) {
      console.error(`[stage-cloudflare-pages] ERROR: dist/${name} was not created`);
      process.exit(1);
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

  copyCfMeta();

  writeChatSupabaseConfig();
  writeTlvFeatureFlags();
  applySearchBlockingToDist();

  const tlvErrors = verifyTlvDist(REPO_ROOT, path.relative(REPO_ROOT, OUT_DIR));
  if (tlvErrors.length) {
    console.error("[stage-cloudflare-pages] ERROR: TLV pages missing or invalid in dist:");
    for (const e of tlvErrors) console.error(`  - ${e}`);
    console.error("  Ensure live/ TLV files exist in the build context (git-tracked for Cloudflare Pages).");
    process.exit(1);
  }
  console.log(`[stage-cloudflare-pages] TLV pages OK (${TLV_REQUIRED_DIST.length} files)`);

  console.log(`[stage-cloudflare-pages] OK → ${OUT_DIR}`);
}

main();
