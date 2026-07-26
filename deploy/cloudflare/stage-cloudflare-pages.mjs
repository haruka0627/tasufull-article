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
import {
  detectCfDeployTarget,
  detectSupabaseTier,
  renderBuilderDeployFlagsJs,
  resolveBuilderDeployFlags,
  validateSupabaseTierAlignment,
} from "../../scripts/lib/builder-deploy-flags.mjs";

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
  ".env.staging",
  "chat-supabase-config.js",
  "chat-supabase-config.local.js",
]);

/** Dotenv family must never land in Pages dist (secrets / local-only). */
function isDotEnvFamily(base) {
  return base === ".env" || base.startsWith(".env.");
}

function shouldSkip(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  const parts = norm.split("/");
  if (parts.some((p) => EXCLUDE_DIRS.has(p))) return true;
  const base = parts[parts.length - 1];
  if (EXCLUDE_FILES.has(base)) return true;
  if (isDotEnvFamily(base)) return true;
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
  const productionBuild =
    String(process.env.CF_PAGES_ENV || "").toLowerCase() === "production" ||
    String(process.env.CF_PAGES_BRANCH || "") === "cf-pages-deploy";
  const flag = (name) =>
    !productionBuild && /^(1|true|yes|on)$/i.test(String(process.env[name] || ""));
  const talkVoiceFlags = {
    selfHostedTurnEnabled: flag("TALK_VOICE_SELF_HOSTED_TURN_ENABLED"),
    turnForceRelayTest: flag("TALK_VOICE_TURN_FORCE_RELAY_TEST"),
    connectionTelemetryEnabled: flag("TALK_VOICE_CONNECTION_TELEMETRY_ENABLED"),
    // Production assets must ignore ?talkDev=1 entitlement / static-TURN bypass.
    allowTalkDevFixture: !productionBuild,
  };
  const body = `/**
 * Generated at deploy — do not commit. Source: deploy/cloudflare/stage-cloudflare-pages.mjs
 */
window.TASU_CHAT_SUPABASE_CONFIG = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)},
};

window.TASU_TALK_CALL_CONFIG = window.TASU_TALK_CALL_CONFIG || {};
Object.assign(window.TASU_TALK_CALL_CONFIG, ${JSON.stringify(talkVoiceFlags)});
`;
  fs.writeFileSync(path.join(OUT_DIR, "chat-supabase-config.js"), body, "utf8");
  return url.replace(/\/$/, "");
}

const BUILDER_DEPLOY_FLAGS_MARKER = "builder-general-jobs-deploy-flags.js";

function writeBuilderGeneralJobsDeployFlags(supabaseUrl) {
  const alignment = validateSupabaseTierAlignment(supabaseUrl);
  if (!alignment.ok) {
    console.error(`[stage-cloudflare-pages] ERROR: ${alignment.reason}`);
    console.error(
      `[stage-cloudflare-pages]   supabaseTier=${alignment.supabaseTier} cfDeployTarget=${alignment.cfDeployTarget}`,
    );
    process.exit(1);
  }

  const flags = resolveBuilderDeployFlags();
  const body = renderBuilderDeployFlagsJs({
    storageMode: flags.storageMode,
    generalJobsRepo: flags.generalJobsRepo,
    supabaseTier: alignment.supabaseTier,
    cfDeployTarget: alignment.cfDeployTarget,
  });

  const builderDir = path.join(OUT_DIR, "builder");
  fs.mkdirSync(builderDir, { recursive: true });
  fs.writeFileSync(path.join(builderDir, "builder-general-jobs-deploy-flags.js"), body, "utf8");

  const flagSummary = [
    flags.hasStorageMode ? `STORAGE_MODE=${flags.storageMode}` : "STORAGE_MODE=(unset→staging-flags/local default)",
    flags.hasGeneralJobsRepo
      ? `GENERAL_JOBS_REPO=${flags.generalJobsRepo}`
      : "GENERAL_JOBS_REPO=(unset→staging-flags/local default)",
  ].join(" · ");

  console.log(
    `[stage-cloudflare-pages] Builder flags tier=${alignment.supabaseTier} cf=${alignment.cfDeployTarget} · ${flagSummary}`,
  );
}

function injectBuilderDeployFlagsToDist() {
  const builderDir = path.join(OUT_DIR, "builder");
  if (!fs.existsSync(builderDir)) return;

  let injected = 0;
  let skipped = 0;
  walkHtmlFiles(builderDir, (filePath) => {
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.includes("builder-config.js")) {
      skipped += 1;
      return;
    }
    if (raw.includes(BUILDER_DEPLOY_FLAGS_MARKER)) return;

    const snippet = '<script src="builder-general-jobs-deploy-flags.js"></script>';
    const next = raw.replace(
      /(\s*<script\s+src="builder-config\.js"><\/script>)/i,
      `\n    ${snippet}$1`,
    );
    if (next === raw) return;
    fs.writeFileSync(filePath, next, "utf8");
    injected += 1;
  });

  console.log(
    `[stage-cloudflare-pages] builder deploy-flags script: ${injected} HTML injected, ${skipped} without builder-config`,
  );
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
    liveSessionManagerEnabled: false,
    usePlatformLive: false,
  });
  Object.defineProperty(global, "TLV_LIVE_SESSION_MANAGER_ENABLED", {
    get() {
      return global.TLV_FEATURE_FLAGS?.liveSessionManagerEnabled === true;
    },
    configurable: true,
  });
  Object.defineProperty(global, "TLV_USE_PLATFORM_LIVE", {
    get() {
      return global.TLV_FEATURE_FLAGS?.usePlatformLive === true;
    },
    configurable: true,
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

const SITE_ASSISTANT_MARKER = "tasful-site-assistant.css";

function siteAssistantAssetPrefix(filePath) {
  const rel = path.relative(OUT_DIR, filePath).replace(/\\/g, "/");
  const depth = Math.max(0, rel.split("/").length - 1);
  return depth ? "../".repeat(depth) : "";
}

function buildSiteAssistantSnippet(filePath) {
  const prefix = siteAssistantAssetPrefix(filePath);
  return [
    `<link rel="stylesheet" href="${prefix}tasful-site-assistant.css">`,
    `<script src="${prefix}tasful-site-assistant-adapter.js" defer></script>`,
    `<script src="${prefix}tasful-site-assistant.js" defer></script>`,
  ].join("\n  ");
}

function shouldSkipSiteAssistant(filePath) {
  const rel = path.relative(OUT_DIR, filePath).replace(/\\/g, "/").toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  const skipExact = new Set([
    "ai-workspace.html",
    "gen-ai-workspace.html",
    "admin-operations-dashboard.html",
    "talk-ops-room.html",
    "builder-ai.html",
  ]);
  if (skipExact.has(base)) return true;
  if (rel.includes("/live/admin-")) return true;
  if (base.startsWith("admin-")) return true;
  return false;
}

function injectSiteAssistantToHtml(html, filePath) {
  if (!/<\/body>/i.test(html)) return html;
  if (html.includes(SITE_ASSISTANT_MARKER)) return html;
  const snippet = buildSiteAssistantSnippet(filePath);
  return html.replace(/<\/body>/i, `  ${snippet}\n</body>`);
}

function applySiteAssistantToDist() {
  let injected = 0;
  let skipped = 0;
  walkHtmlFiles(OUT_DIR, (filePath) => {
    if (shouldSkipSiteAssistant(filePath)) {
      skipped += 1;
      return;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const next = injectSiteAssistantToHtml(raw, filePath);
    if (next !== raw) {
      fs.writeFileSync(filePath, next, "utf8");
      injected += 1;
    }
  });
  console.log(
    `[stage-cloudflare-pages] site-assistant: ${injected} HTML injected, ${skipped} skipped`,
  );
}

/**
 * Site root `/` must serve TASFUL platform TOP (index-top.html).
 * Repo root index.html is the legacy marketplace home → dist/market/index.html.
 */
function applyRootTopRouting() {
  const distIndex = path.join(OUT_DIR, "index.html");
  const distIndexTop = path.join(OUT_DIR, "index-top.html");
  const marketDir = path.join(OUT_DIR, "market");
  const marketIndex = path.join(marketDir, "index.html");

  if (!fs.existsSync(distIndexTop)) {
    console.error("[stage-cloudflare-pages] ERROR: index-top.html missing in dist");
    process.exit(1);
  }
  if (!fs.existsSync(distIndex)) {
    console.error("[stage-cloudflare-pages] ERROR: index.html missing in dist");
    process.exit(1);
  }

  fs.mkdirSync(marketDir, { recursive: true });
  fs.copyFileSync(distIndex, marketIndex);
  fs.copyFileSync(distIndexTop, distIndex);

  console.log(
    "[stage-cloudflare-pages] root routing: index-top.html → dist/index.html, legacy market → market/index.html",
  );
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

function copyPagesFunctions() {
  const srcDir = path.join(__dirname, "functions");
  const destDir = path.join(OUT_DIR, "functions");
  if (!fs.existsSync(srcDir)) {
    console.warn("[stage-cloudflare-pages] functions/ not found — skipping Pages Functions copy");
    return;
  }
  fs.mkdirSync(destDir, { recursive: true });
  copyRecursive(srcDir, destDir, "functions");
  console.log("[stage-cloudflare-pages] copied deploy/cloudflare/functions → dist/functions");
}

/** Fail closed if any dotenv family file was copied into dist (never log contents). */
function assertNoDotEnvInDist() {
  const hits = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (isDotEnvFamily(ent.name)) {
        hits.push(path.relative(OUT_DIR, full).replace(/\\/g, "/"));
      }
    }
  };
  walk(OUT_DIR);
  if (hits.length) {
    console.error("[stage-cloudflare-pages] ERROR: dotenv family files must not appear in dist:");
    for (const h of hits) console.error(`  - ${h}`);
    process.exit(1);
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
  copyPagesFunctions();

  assertNoDotEnvInDist();

  writeChatSupabaseConfig();
  const supabaseUrl = (() => {
    try {
      const cfg = fs.readFileSync(path.join(OUT_DIR, "chat-supabase-config.js"), "utf8");
      return cfg.match(/url:\s*"([^"]+)"/)?.[1] || "";
    } catch {
      return "";
    }
  })();
  writeBuilderGeneralJobsDeployFlags(supabaseUrl);
  writeTlvFeatureFlags();
  applyRootTopRouting();
  applySearchBlockingToDist();
  applySiteAssistantToDist();
  injectBuilderDeployFlagsToDist();

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
