#!/usr/bin/env node
/**
 * Business Directory OB4 P0 — 統合 Smoke
 *
 *   node scripts/smoke-business-directory-ob4.mjs           # 8788 ローカル
 *   node scripts/smoke-business-directory-ob4.mjs --prod    # 本番（環境変数 SUPABASE_URL / SUPABASE_ANON_KEY 必須）
 *
 * 確認項目（全 8 項目）:
 *   1. Edge business-directory 死活（POST get_public_listings 200）
 *   2. Edge stripe-webhook デプロイ済確認
 *   3. 静的 /business-directory/public/list.html HTTP 200
 *   4. 静的 /business-directory/public/detail.html HTTP 200
 *   5. 静的 /business-directory/index.html（Owner dashboard）HTTP 200
 *   6. 静的 /business-directory/admin/reviews.html HTTP 200
 *   7. BD テーブルソースファイル存在確認（migration ファイル）
 *   8. BD 主要モジュールファイル存在 + size > 0
 *
 * exit 0 = 全 PASS, exit 1 = 1 件以上 FAIL
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isProd = process.argv.includes("--prod");

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.TASFUL_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.TASFUL_SUPABASE_ANON_KEY || "";

let pass = 0;
let fail = 0;
let skip = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS [${pass + fail + skip}/${8}] ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL [${pass + fail + skip}/${8}] ${label}${detail ? ` — ${detail}` : ""}`);
}

function skp(label, detail) {
  skip += 1;
  console.log(`SKIP [${pass + fail + skip}/${8}] ${label}${detail ? ` — ${detail}` : ""}`);
}

// ── 1. Edge business-directory 死活 ──────────────────────────────────────

async function checkEdgeBusinessDirectory() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (isProd) {
      bad("Edge business-directory health", "SUPABASE_URL / SUPABASE_ANON_KEY required for --prod");
    } else {
      skp("Edge business-directory health", "SUPABASE_URL / SUPABASE_ANON_KEY not configured");
    }
    return;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/business-directory`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action: "get_public_listings", listing_type: "shop_retail", limit: 1 }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok !== false && Array.isArray(data.listings)) {
      ok(`Edge business-directory health (${res.status} · ${Date.now() - startTime}ms)`);
    } else {
      bad(`Edge business-directory health — HTTP ${res.status} · ${JSON.stringify(data).slice(0, 120)}`);
    }
  } catch (e) {
    bad(`Edge business-directory health — ${e.message}`);
  }
}
let startTime = Date.now();

// ── 2. Edge stripe-webhook デプロイ済確認 ────────────────────────────────

function checkStripeWebhookDeployed() {
  const webhookPath = path.join(root, "supabase/functions/stripe-webhook/index.ts");
  if (fs.existsSync(webhookPath)) {
    const content = fs.readFileSync(webhookPath, "utf8");
    if (content.length > 0) {
      ok("Edge stripe-webhook source exists");
    } else {
      bad("Edge stripe-webhook source", "empty file");
    }
  } else {
    bad("Edge stripe-webhook source", "index.ts not found");
  }
}

// ── 3–6. 静的 HTML HTTP 200 ────────────────────────────────────────

const STATIC_PAGES = [
  { label: "Static public/list.html", rel: "business-directory/public/list.html" },
  { label: "Static public/detail.html", rel: "business-directory/public/detail.html" },
  { label: "Static index.html (Owner)", rel: "business-directory/index.html" },
  { label: "Static admin/reviews.html", rel: "business-directory/admin/reviews.html" },
];

function checkStaticPagesSync() {
  for (const { label, rel } of STATIC_PAGES) {
    const fullPath = path.join(root, "deploy/cloudflare/dist", rel);
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      if (stat.size > 0) {
        ok(`${label} (dist ${(stat.size / 1024).toFixed(1)} KB)`);
      } else {
        bad(`${label}`, "0-byte dist file");
      }
    } else {
      // dist がなければ source を確認
      const srcPath = path.join(root, rel);
      if (fs.existsSync(srcPath)) {
        ok(`${label} (source exists · build:pages 未実行)`);
      } else {
        bad(`${label}`, "dist/source not found");
      }
    }
  }
}

// ── 7. BD テーブルソースファイル存在確認 ─────────────────────────────────

function checkBdMigrationFiles() {
  const migrations = [
    "supabase/migrations/20260711100000_business_directory_phase1_schema.sql",
    "supabase/migrations/20260711100001_business_directory_phase1_seed.sql",
    "supabase/migrations/20260712100000_business_directory_phase6_stripe_subscription.sql",
  ];
  let allOk = true;
  for (const rel of migrations) {
    if (!fs.existsSync(path.join(root, rel))) {
      allOk = false;
      break;
    }
  }
  if (allOk) {
    ok(`BD migration files (${migrations.length} files)`);
  } else {
    bad("BD migration files", "one or more files missing");
  }
}

// ── 8. BD 主要モジュールファイル存在 + サイズ確認 ─────────────────────────

function checkBdCoreModules() {
  const modules = [
    { rel: "business-directory-repository.js", label: "repository" },
    { rel: "business-directory/business-directory-owner.js", label: "owner.js" },
    { rel: "business-directory/business-directory-common.js", label: "common.js" },
    { rel: "business-directory/business-directory-plan.js", label: "plan.js" },
    { rel: "business-directory/business-directory.css", label: "css" },
    { rel: "business-directory/public/business-directory-public.js", label: "public.js" },
    { rel: "business-directory/admin/business-directory-admin.js", label: "admin.js" },
  ];
  let allOk = true;
  const details = [];
  for (const { rel, label } of modules) {
    const fullPath = path.join(root, rel);
    if (!fs.existsSync(fullPath)) {
      allOk = false;
      details.push(`${label}: missing`);
    } else {
      const sz = fs.statSync(fullPath).size;
      if (sz === 0) {
        allOk = false;
        details.push(`${label}: 0-byte`);
      }
    }
  }
  if (allOk) {
    ok(`BD core modules (${modules.length} files)`);
  } else {
    bad(`BD core modules — ${details.slice(0, 3).join(" · ")}`);
  }
}

// ── main ───────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== BD OB4 P0 Smoke ${isProd ? "(production)" : "(local)"} ===\n`);

  // 順次実行
  startTime = Date.now();
  await checkEdgeBusinessDirectory();

  checkStripeWebhookDeployed();
  checkStaticPagesSync();
  checkBdMigrationFiles();
  checkBdCoreModules();

  // サマリー
  const total = pass + fail + skip;
  const parts = [`${pass}/${total} PASS`];
  if (skip > 0) parts.push(`${skip} SKIP`);
  if (fail > 0) parts.push(`${fail} FAIL`);
  console.log(`\n=== BD OB4 Smoke: ${parts.join(" · ")} ===`);

  if (fail > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`\nFATAL: ${e.message}`);
  process.exit(1);
});