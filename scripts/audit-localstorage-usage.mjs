#!/usr/bin/env node
/**
 * localStorage キー棚卸し（調査用・読み取りのみ）
 *   node scripts/audit-localstorage-usage.mjs
 *   node scripts/audit-localstorage-usage.mjs --json > /tmp/ls-audit.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "backups",
  "screenshots",
  "supabase/.temp",
]);

const KEY_PATTERNS = [
  /(?:const|let|var)\s+(\w+_KEY)\s*=\s*["']([^"']+)["']/g,
  /localStorage\.(?:getItem|setItem|removeItem)\(\s*["']([^"']+)["']/g,
  /localStorage\[`([^`]+)`\]/g,
  /storageKey:\s*["']([^"']+)["']/g,
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(name.name)) continue;
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full, out);
    else if (/\.(js|mjs|html|ts)$/.test(name.name)) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

function scanFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const keys = new Set();
  for (const re of KEY_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const key = m[2] || m[1];
      if (key && !key.includes("${")) keys.add(key);
    }
  }
  return [...keys];
}

function inferCategory(key) {
  if (/^tasu_support_|^tasu_connect_/.test(key)) return "support";
  if (/^tasu_ai_ops_/.test(key)) return "ai_ops";
  if (/^tasful:builder:|^tasful_builder/.test(key)) return "builder";
  if (/^tasful_chat_|^tasu_chat_/.test(key)) return "chat";
  if (/^tasful_talk_|^tasful:talk:/.test(key)) return "talk";
  if (/favorite|favourites/i.test(key)) return "favorites";
  if (/^tasu_member_|^tasful_last_profile|^tasu_member_/.test(key)) return "member";
  if (/^tasful_listings|^tasu_listings|^tasu_business_listings/.test(key)) return "listings";
  if (/^tasu_anpi_/.test(key)) return "anpi";
  if (/^tasu_genai_|^tasu_tripo_/.test(key)) return "genai";
  if (/^tasu_service_deals|^tasu_business_service/.test(key)) return "business_service";
  if (/^tasu_shop_|^shop_store/.test(key)) return "shop";
  if (/^tasu-supabase|^sb-/.test(key)) return "auth";
  if (/^tasful_payment|^tasful_notification|^tasful_agent/.test(key)) return "settings";
  if (/mock|dev_mode|debug|seed|hint|preview|admin_v1|rls_mock/i.test(key)) return "dev_ui";
  return "other";
}

function suggestTable(key, cat) {
  const map = {
    support: {
      tasu_support_tickets_v1: "support_tickets",
      tasu_support_events_v1: "support_events",
      tasu_connect_issues_v1: "connect_issues",
      tasu_support_admin_notifications_v1: "support_admin_notifications",
    },
    ai_ops: {
      tasu_ai_ops_cases_v1: "ai_ops_cases",
      tasu_ai_ops_events_v1: "ai_ops_events",
      tasu_ai_ops_admin_notifications_v1: "ai_ops_admin_notifications",
    },
    builder: {
      "tasful:builder:mvp:v1": "builder_mvp_state (JSONB) or normalized tables",
      "tasful:builder:mvp:threads:v1": "builder_threads",
      "tasful:builder:partner_evaluations:v1": "builder_partner_evaluations",
      "tasful:builder:partner_status_events:v1": "builder_partner_status_events",
      "tasful:builder:partner_visibility:v1": "builder_partner_visibility",
      "tasful:builder:admin:partners:v1": "builder_partners",
    },
    chat: {
      tasful_chat_threads: "transaction_rooms / consult_threads",
      tasful_chat_messages: "transaction_messages / consult_messages",
      tasu_chat_seed_v1: "transaction_* (migrate then drop seed)",
    },
    talk: {
      tasful_talk_notifications: "talk_notifications",
      tasful_talk_ai_drafts: "talk_ai_drafts",
      tasful_talk_broadcast_drafts: "talk_broadcast_drafts",
      tasful_talk_follow_store: "talk_follow_subscriptions",
      tasful_talk_notification_settings: "talk_notification_settings",
      tasful_talk_sync_pending_v1: "talk_sync_queue",
    },
    favorites: {
      tasful_favorites: "member_favorites",
      tasu_favorites_v1: "member_favorites",
      tasful_favorite_listings: "member_favorites (legacy)",
    },
    listings: {
      tasful_listings: "listings",
      tasu_listings_v1: "listings",
    },
    member: {
      tasu_member_session: "auth session (Supabase Auth primary)",
      tasu_member_signups: "member_profiles / signups",
    },
  };
  if (map[cat]?.[key]) return map[cat][key];
  if (cat === "support") return "support_*";
  if (cat === "ai_ops") return "ai_ops_*";
  if (cat === "builder") return "builder_*";
  if (cat === "talk") return "talk_*";
  if (cat === "chat") return "transaction_* / talk_ops_messages";
  if (cat === "favorites") return "member_favorites";
  if (cat === "listings") return "listings";
  if (cat === "anpi") return "anpi_*";
  if (cat === "dev_ui") return "— (keep local)";
  if (cat === "auth") return "Supabase Auth (SDK)";
  return "TBD";
}

function shouldMigrateToSupabase(key, cat) {
  if (cat === "dev_ui" || cat === "auth") return "no";
  if (cat === "genai" && /dev_mode|debug|rotation/.test(key)) return "no";
  if (/seed|seeded|fanout|pending|recent_actions|follow_only/.test(key)) return "cache";
  if (cat === "support" || cat === "ai_ops" || cat === "builder") return "yes";
  if (cat === "talk" && !/seed|fanout|settings/.test(key)) return "yes";
  if (cat === "chat") return "yes";
  if (cat === "favorites" || cat === "listings") return "yes";
  if (cat === "member" && key === "tasu_member_session") return "hybrid";
  if (cat === "business_service" || cat === "shop") return "yes";
  if (cat === "anpi") return "yes";
  return "review";
}

function priority(key, cat, migrate) {
  if (migrate === "no" || migrate === "cache") return "low";
  if (cat === "support" || cat === "ai_ops") return "high";
  if (cat === "builder" && /partner_eval|mvp:threads|admin:partners/.test(key)) return "high";
  if (cat === "talk" && /notifications|ai_drafts|broadcast/.test(key)) return "high";
  if (key === "tasful_chat_threads" || key === "tasful_chat_messages") return "high";
  if (cat === "favorites" || cat === "listings") return "medium";
  if (cat === "member") return "medium";
  if (cat === "anpi") return "medium";
  if (cat === "genai" || cat === "shop" || cat === "settings") return "low";
  return "medium";
}

function main() {
  const files = walk(ROOT);
  const byKey = new Map();

  for (const file of files) {
    const keys = scanFile(file);
    for (const key of keys) {
      if (!byKey.has(key)) {
        byKey.set(key, { key, files: new Set(), category: inferCategory(key) });
      }
      byKey.get(key).files.add(rel(file));
    }
  }

  const rows = [...byKey.values()]
    .map((r) => {
      const migrate = shouldMigrateToSupabase(r.key, r.category);
      return {
        key: r.key,
        files: [...r.files].sort(),
        category: r.category,
        migrate,
        priority: priority(r.key, r.category, migrate),
        table: suggestTable(r.key, r.category),
      };
    })
    .sort((a, b) => {
      const po = { high: 0, medium: 1, low: 2 };
      return (po[a.priority] - po[b.priority]) || a.key.localeCompare(b.key);
    });

  const high = rows.filter((r) => r.priority === "high");
  const summary = {
    scannedFiles: files.length,
    uniqueKeys: rows.length,
    highPriority: high.length,
    byCategory: Object.fromEntries(
      [...new Set(rows.map((r) => r.category))].map((c) => [
        c,
        rows.filter((r) => r.category === c).length,
      ])
    ),
  };

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ summary, rows }, null, 2));
    return;
  }

  console.log("# localStorage audit summary\n");
  console.log(`Scanned files: ${summary.scannedFiles}`);
  console.log(`Unique keys: ${summary.uniqueKeys}`);
  console.log(`High priority (Supabase): ${summary.highPriority}\n`);
  console.log("By category:", JSON.stringify(summary.byCategory, null, 2));
  console.log("\n## High priority keys\n");
  for (const r of high) {
    console.log(`- ${r.key} → ${r.table} (${r.files.slice(0, 3).join(", ")}${r.files.length > 3 ? "…" : ""})`);
  }
  console.log("\nRun with --json for full machine-readable output.");
}

main();
