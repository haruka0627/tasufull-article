#!/usr/bin/env node
/**
 * Phase 2-D: restore user-visible static Japanese from clean backup (UTF-8).
 * Preserves post-backup deltas: listing-ai-badge.css, 掲載管理 banner link.
 *
 * Usage:
 *   node scripts/apply-phase2d-static-restore.mjs [--verify-vite] [file.html ...]
 */
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import { fixBusinessServiceHtml, fixGeneralDetailHtml } from "./lib/phase2d-html-fix.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const BACKUP_ROOT = path.join(ROOT, "backups", "_phase2d-extract");

const RESTORE_FROM_BACKUP = [
  "detail-skill.html",
  "detail-worker.html",
  "detail-job.html",
  "detail-product.html",
  "detail-shop.html",
  "detail-business-service.html",
];

const FIX_IN_PLACE = ["detail-general.html", "detail-shop-product.html"];

function metrics(text) {
  return {
    ufffd: (text.match(/\uFFFD/g) || []).length,
    eClose: (text.match(/E\/[a-z]+>/gi) || []).length,
    strayE: (text.match(/[ぁ-ん一-龥ァ-ヶ]E[^/\s<>"']/g) || []).length,
    q2: (text.match(/\?\?/g) || []).length,
    q5: (text.match(/\?{5,}/g) || []).length,
    ebr: (text.match(/Ebr>/g) || []).length,
  };
}

function total(m) {
  return m.ufffd + m.eClose + m.strayE + m.q2 + m.q5 + m.ebr;
}

function patchPremiumBanner(text) {
  const banner = `  <div class="tasu-banner">
    <div class="tasu-text">
      🚀 <span class="logo">TASFUL</span>プラットフォームへようこそ　
      <a href="/post" class="link">今月システム利用料5％！</a>　
      ｜　
      <a href="listing-management.html" class="link accent">掲載管理</a>　
      ｜　
      <span style="color: #94a3b8;"></span>
    </div>
  </div>`;
  return text.replace(/<div class="tasu-banner">[\s\S]*?<\/div>\s*\n\s*<nav class="section-nav"/, `${banner}\n\n  <nav class="section-nav"`);
}

function patchListingAiBadge(text) {
  if (text.includes("listing-ai-badge.css")) return text;
  return text.replace(
    /(<link rel="stylesheet" href="listing-detail-page\.css">)\s*\n/,
    `$1\n  <link rel="stylesheet" href="listing-ai-badge.css">\n`
  );
}

function patchBusinessServiceBanner(text) {
  if (text.includes("listing-management.html")) return text;
  return text.replace(
    /<a href="index\.html" class="link accent">一覧トップ<\/a>/,
    '<a href="listing-management.html" class="link accent">掲載管理</a>'
  );
}

function patchShopBanner(text) {
  if (text.includes("listing-management.html")) {
    return text;
  }
  return text.replace(
    /(<a href="index\.html" class="link accent">一覧トップ<\/a>)/,
    '$1　｜　\n      <a href="listing-management.html" class="link accent">掲載管理</a>'
  );
}

/** Post-restore: keep favorite localStorage wiring (detail-shop / business-service). */
function patchFavoriteScripts(rel, text) {
  const block = `  <script src="listing-local-store.js"></script>
  <script src="favorite-store.js"></script>
  <script src="favorite-actions.js"></script>
`;
  if (text.includes("favorite-store.js")) return text;

  if (rel === "detail-shop.html") {
    const next = text.replace(
      /(\s*<script src="detail-shop-store\.js"><\/script>[\r\n]+)(\s*<script src="detail-shop-store-bottom\.js"><\/script>)/,
      `$1${block}$2`
    );
    if (next !== text) return next;
  }
  if (rel === "detail-business-service.html") {
    const next = text.replace(
      /(\s*<script src="\.\/detail-business-service-sticky-nav\.js"><\/script>[\r\n]+)(\s*<script src="\.\/detail-business-service-loader\.js"><\/script>)/,
      `$1${block}$2`
    );
    if (next !== text) return next;
  }
  return text;
}

function applyPostRestore(rel, text) {
  let out = text;
  out = out.replace(/読み込んでぁす/g, "読み込んでいます");
  out = out.replace(/プラットへようこそ/g, "プラットフォームへようこそ");

  if (/detail-(skill|worker|product|job)\.html$/.test(rel)) {
    out = patchListingAiBadge(out);
    out = patchPremiumBanner(out);
  }
  if (rel === "detail-business-service.html") {
    out = patchBusinessServiceBanner(out);
    out = patchFavoriteScripts(rel, out);
  }
  if (rel === "detail-general.html") {
    out = patchBusinessServiceBanner(out.replace(
      /<a href="index\.html" class="link accent">[^<]*<\/a>/,
      '<a href="listing-management.html" class="link accent">掲載管理</a>'
    ));
  }
  if (rel === "detail-shop.html") {
    out = patchShopBanner(out);
    out = patchFavoriteScripts(rel, out);
  }
  if (rel === "detail-shop-product.html") {
    out = out.replace(/啁E/g, "商品");
    out = out.replace(/プラチEフォーム/g, "プラットフォーム");
  }
  if (rel === "detail-product.html") {
    for (const key of [
      "description",
      "category",
      "condition",
      "price-note",
      "stock",
      "specs",
      "shipping",
    ]) {
      out = out.replace(
        new RegExp(`" data-listing-product-${key.replace("-", "\\-")}-block"`, "g"),
        '"'
      );
    }
  }
  return out;
}

async function verifyVite(rel, html) {
  const server = await createServer({ root: ROOT, server: { middlewareMode: true } });
  try {
    await server.transformIndexHtml(`/${rel}`, html);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e).split("\n")[0] };
  } finally {
    await server.close();
  }
}

async function restoreOne(rel, { verify }) {
  const abs = path.join(ROOT, rel);
  const before = fs.readFileSync(abs, "utf8");
  const beforeM = metrics(before);

  let after;
  if (RESTORE_FROM_BACKUP.includes(rel)) {
    const backupPath = path.join(BACKUP_ROOT, rel);
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Missing backup: ${backupPath}`);
    }
    after = fs.readFileSync(backupPath, "utf8");
  } else if (FIX_IN_PLACE.includes(rel)) {
    after = rel === "detail-general.html" ? fixGeneralDetailHtml(before) : before;
  } else {
    throw new Error(`Unknown target: ${rel}`);
  }

  after = applyPostRestore(rel, after);
  fs.writeFileSync(abs, after, "utf8");

  const afterM = metrics(after);
  const row = {
    file: rel,
    changed: before !== after,
    before: { ...beforeM, total: total(beforeM) },
    after: { ...afterM, total: total(afterM) },
  };

  if (verify) {
    row.vite = await verifyVite(rel, after);
  }
  return row;
}

const args = process.argv.slice(2);
const verify = args.includes("--verify-vite");
const files = args.filter((a) => !a.startsWith("--"));

const targets = files.length
  ? files
  : [...RESTORE_FROM_BACKUP, ...FIX_IN_PLACE];

const results = [];
for (const rel of targets) {
  results.push(await restoreOne(rel, { verify: verify }));
}

console.log(JSON.stringify({ backupRoot: BACKUP_ROOT, results }, null, 2));

const bad = results.filter((r) => r.after.total > 0 || r.vite?.ok === false);
process.exit(bad.length ? 1 : 0);
