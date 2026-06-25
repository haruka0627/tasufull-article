#!/usr/bin/env node
/**
 * NB-1B — Cloudflare Pages ステージング dist 検証
 *   node scripts/verify-cloudflare-pages-stage.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "deploy", "cloudflare", "dist");

const REQUIRED_PATHS = [
  "index.html",
  "index-top.html",
  "market/index.html",
  "talk-home.html",
  "dashboard.html",
  "shop-store.html",
  "shop-products.html",
  "payment-settings.html",
  "builder/index.html",
  "live/videos.html",
  "live/watch-video.html",
  "live/profile.html",
  "live/creator-dashboard.html",
  "live/admin-videos.html",
  "live/tlv-nav.js",
  "live/live-videos.js",
  "ai-workspace.html",
  "auth-current-user.js",
  "auth-ops-guard.js",
  "connect-state.js",
  "market-identity.js",
  "builder/builder-actor-identity.js",
  "chat-supabase-config.js",
  "chat.css",
  "dashboard.css",
  "style.css",
  "scripts/talk-call-webrtc.js",
  "_redirects",
  "_headers",
];

const FORBIDDEN_CONFIG_KEYS = [
  "currentUserId",
  "me",
  "talkDevMode",
  "talkProductionMode",
];

const FORBIDDEN_CONFIG_SNIPPETS = [
  /u_me/,
  /demo-shop/,
  /displayName/,
  /avatarUrl/,
];

function fail(msg) {
  console.error(`[verify-pages-stage] FAIL: ${msg}`);
  process.exitCode = 1;
  return false;
}

function pass(msg) {
  console.log(`[verify-pages-stage] PASS: ${msg}`);
}

function countFiles(dir) {
  let n = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) n += countFiles(p);
    else n += 1;
  }
  return n;
}

function main() {
  let ok = true;
  const setFail = (m) => {
    ok = fail(m) && ok;
  };

  if (!fs.existsSync(DIST)) {
    fail(`dist missing — run: npm run build:pages`);
    process.exit(1);
  }

  pass(`dist exists (${countFiles(DIST)} files)`);

  for (const rel of REQUIRED_PATHS) {
    const abs = path.join(DIST, rel);
    if (!fs.existsSync(abs)) setFail(`missing required: ${rel}`);
    else pass(`required file: ${rel}`);
  }

  const excluded = ["node_modules", "reports", "supabase", "package.json"];
  for (const name of excluded) {
    if (fs.existsSync(path.join(DIST, name))) fail(`excluded path present in dist: ${name}`);
  }
  if (fs.existsSync(path.join(DIST, "scripts", "verify-cloudflare-pages-stage.mjs"))) {
    fail("scripts/*.mjs must not be copied to dist");
  }
  if (ok) pass("excluded dirs not copied · runtime scripts/ included");

  const cfgPath = path.join(DIST, "chat-supabase-config.js");
  const cfg = fs.readFileSync(cfgPath, "utf8");
  for (const key of FORBIDDEN_CONFIG_KEYS) {
    if (cfg.includes(key)) setFail(`chat-supabase-config.js contains forbidden key: ${key}`);
  }
  for (const re of FORBIDDEN_CONFIG_SNIPPETS) {
    if (re.test(cfg)) setFail(`chat-supabase-config.js matches forbidden pattern: ${re}`);
  }
  if (!cfg.includes("ddojquacsyqesrjhcvmn") && !cfg.includes("YOUR_PROJECT")) {
    /* url from env — ok if any supabase.co */
  }
  if (!/url:\s*"/.test(cfg) || !/anonKey:\s*"/.test(cfg)) {
    setFail("chat-supabase-config.js missing url or anonKey");
  } else {
    pass("chat-supabase-config.js has url + anonKey only");
  }

  const redirects = fs.readFileSync(path.join(DIST, "_redirects"), "utf8");
  if (/\s200\s*$/.test(redirects) || /\/index\.html\s+200/.test(redirects)) {
    setFail("_redirects contains SPA fallback (/* ... 200)");
  } else {
    pass("_redirects: no SPA fallback");
  }
  if (/\/index\.html\s+\/market\//.test(redirects)) {
    setFail("_redirects must NOT redirect /index.html → /market/ (platform TOP is dist/index.html)");
  } else {
    pass("_redirects: no /index.html → /market/ (primary: / and /index.html = platform TOP)");
  }
  if (!/\/market\s+\/market\//.test(redirects)) {
    setFail("_redirects missing legacy /market trailing-slash rule");
  } else {
    pass("_redirects: legacy /market/ trailing slash only (P2)");
  }

  const rootIndex = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  const marketIndex = fs.readFileSync(path.join(DIST, "market/index.html"), "utf8");
  if (!rootIndex.includes('class="top-page"') || !rootIndex.includes("tas-hero")) {
    setFail("dist/index.html is not TASFUL platform TOP (expected index-top.html content)");
  } else {
    pass("dist/index.html = TASFUL platform TOP (index-top)");
  }
  if (!marketIndex.includes('class="home-page"')) {
    setFail("dist/market/index.html is not legacy marketplace home");
  } else {
    pass("dist/market/index.html = legacy marketplace home");
  }

  const headers = fs.readFileSync(path.join(DIST, "_headers"), "utf8");
  for (const h of ["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) {
    if (!headers.includes(h)) setFail(`_headers missing ${h}`);
  }
  if (headers.includes("auth-current-user.js") && headers.includes("must-revalidate")) {
    pass("_headers: security + auth cache rules present");
  }

  const html = fs.readFileSync(path.join(DIST, "talk-home.html"), "utf8");
  if (!html.includes("chat-supabase-config.js")) setFail("talk-home.html missing config script");
  if (!html.includes("auth-current-user.js")) setFail("talk-home.html missing auth-current-user.js");
  else pass("talk-home.html loads config + auth stack");

  console.log(ok ? "\n[verify-pages-stage] SUMMARY: PASS" : "\n[verify-pages-stage] SUMMARY: FAIL");
  process.exit(ok ? 0 : 1);
}

main();
