#!/usr/bin/env node
/**
 * Gate-C — 検索エンジン遮断（robots.txt / meta robots / X-Robots-Tag）検証
 *
 *   node scripts/verify-gate-c-search-blocking.mjs
 *   node scripts/verify-gate-c-search-blocking.mjs --base https://tasufull-article.pages.dev
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "deploy", "cloudflare", "dist");
const REPO = path.join(__dirname, "..");

const ROBOTS_META = 'content="noindex,nofollow,noarchive"';
const HEADERS_NEEDLE = "X-Robots-Tag: noindex, nofollow, noarchive";

function fail(msg) {
  console.error(`[verify-gate-c] FAIL: ${msg}`);
  process.exitCode = 1;
}

function pass(msg) {
  console.log(`[verify-gate-c] PASS: ${msg}`);
}

function walkHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkHtml(p, out);
    else if (ent.name.endsWith(".html")) out.push(p);
  }
  return out;
}

function checkDist() {
  let ok = true;
  const setFail = (m) => {
    fail(m);
    ok = false;
  };

  const robotsPath = path.join(DIST, "robots.txt");
  if (!fs.existsSync(robotsPath)) setFail("robots.txt missing in dist");
  else {
    const robots = fs.readFileSync(robotsPath, "utf8");
    if (!/User-agent:\s*\*/i.test(robots) || !/Disallow:\s*\//i.test(robots)) {
      setFail("robots.txt content invalid");
    } else if (/^Sitemap:/im.test(robots)) {
      setFail("robots.txt must not contain Sitemap directive");
    } else pass("robots.txt present and Disallow: /");
  }

  const headersPath = path.join(DIST, "_headers");
  if (!fs.existsSync(headersPath)) setFail("_headers missing");
  else if (!fs.readFileSync(headersPath, "utf8").includes(HEADERS_NEEDLE)) {
    setFail("_headers missing global X-Robots-Tag");
  } else pass("_headers has X-Robots-Tag on /*");

  const htmlFiles = walkHtml(DIST);
  if (htmlFiles.length === 0) setFail("no HTML in dist");
  const missing = [];
  const duplicate = [];
  const FRAGMENT_SKIP = new Set([
    "source/wix/iwasho-header.embed.html",
    "source/wix/iwasho-footer.embed.html",
    "source/wix/iwasho-hero.embed.html",
    "source/wix/tasful-company-home.embed.html",
    "_worker_shared_sections.html",
  ]);
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, "utf8");
    const rel = path.relative(DIST, f).replace(/\\/g, "/");
    if (FRAGMENT_SKIP.has(rel)) continue;
    const matches = [...html.matchAll(/<meta\s+name=["']robots["'][^>]*>/gi)];
    if (matches.length === 0) missing.push(rel);
    else if (matches.length > 1) duplicate.push(rel);
    else if (!matches[0][0].includes(ROBOTS_META)) {
      missing.push(`${rel} (wrong content)`);
    }
  }
  if (missing.length) setFail(`HTML missing unified robots meta: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` (+${missing.length - 5})` : ""}`);
  else {
    const pageCount = htmlFiles.length - FRAGMENT_SKIP.size;
    pass(`${pageCount} page HTML files have single noindex meta (${FRAGMENT_SKIP.size} embed fragments skipped — X-Robots-Tag only)`);
  }
  if (duplicate.length) setFail(`duplicate robots meta: ${duplicate.slice(0, 3).join(", ")}`);

  const sitemapGlob = ["sitemap.xml", "sitemap_index.xml"];
  for (const name of sitemapGlob) {
    if (fs.existsSync(path.join(DIST, name))) setFail(`${name} must not be in dist`);
  }
  if (ok) pass("no sitemap.xml in dist");

  const ogHits = [];
  function scanOg(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) scanOg(p);
      else if (ent.name.endsWith(".html")) {
        const t = fs.readFileSync(p, "utf8");
        if (/property=["']og:url["']/i.test(t) || /rel=["']canonical["']/i.test(t)) {
          ogHits.push(path.relative(DIST, p).replace(/\\/g, "/"));
        }
      }
    }
  }
  if (fs.existsSync(DIST)) scanOg(DIST);
  if (ogHits.length) setFail(`og:url or canonical in dist HTML: ${ogHits.slice(0, 3).join(", ")}`);
  else pass("no og:url / canonical in dist HTML");

  return ok;
}

async function checkLive(base) {
  const url = base.replace(/\/$/, "");
  let ok = true;
  const setFail = (m) => {
    fail(m);
    ok = false;
  };

  try {
    const robotsRes = await fetch(`${url}/robots.txt`);
    const robotsText = await robotsRes.text();
    if (!robotsRes.ok) setFail(`GET /robots.txt → ${robotsRes.status}`);
    else if (!/Disallow:\s*\//i.test(robotsText)) setFail("live robots.txt missing Disallow: /");
    else pass(`live /robots.txt → ${robotsRes.status}`);

    const sample = [`${url}/index.html`, `${url}/talk-home.html`, `${url}/live/index.html`];
    for (const u of sample) {
      const res = await fetch(u, { redirect: "manual" });
      const xRobots = res.headers.get("x-robots-tag") || "";
      const status = res.status;
      if (status === 200 && !xRobots.toLowerCase().includes("noindex")) {
        setFail(`${u} → ${status} but no X-Robots-Tag noindex (got: ${xRobots || "(none)"})`);
      } else if ([301, 302, 303, 307, 308, 403].includes(status)) {
        pass(`${u} → ${status} (Access or redirect — header check skipped)`);
      } else if (xRobots.toLowerCase().includes("noindex")) {
        pass(`${u} → ${status} X-Robots-Tag: ${xRobots}`);
      } else {
        setFail(`${u} → ${status} unexpected`);
      }
    }
  } catch (e) {
    setFail(`live probe failed: ${e.message}`);
    ok = false;
  }
  return ok;
}

async function main() {
  const baseIdx = process.argv.indexOf("--base");
  const base = baseIdx >= 0 ? process.argv[baseIdx + 1] : null;

  if (!fs.existsSync(DIST)) {
    fail("dist missing — run: npm run build:pages");
    process.exit(1);
  }

  const distOk = checkDist();
  let liveOk = true;
  if (base) liveOk = await checkLive(base);

  if (distOk && liveOk && !process.exitCode) {
    console.log("[verify-gate-c] ALL PASS");
  } else {
    process.exit(1);
  }
}

main();
