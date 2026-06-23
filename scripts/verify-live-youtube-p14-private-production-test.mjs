#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 14 — private production test prep
 *
 *   npm run verify:live-youtube-p14
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { closeAllBrowsers } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TLV_PAGES = [
  "live/index.html",
  "live/videos.html",
  "live/watch-video.html",
  "live/profile.html",
  "live/my-videos.html",
  "live/video-upload.html",
  "live/creator-dashboard.html",
  "live/admin-videos.html",
];

const ROBOTS_SNIPPET = 'content="noindex,nofollow,noarchive,nosnippet"';

const GENERAL_SURFACES = [
  "dashboard.html",
  "index-top.html",
  "company/index.html",
  "company/services.html",
];

const summary = { pass: 0, fail: 0, skip: 0 };
const failures = [];

function pass(id, detail = "") {
  summary.pass += 1;
  console.log(`  PASS  ${id}${detail ? ` — ${detail}` : ""}`);
}

function fail(id, detail = "") {
  summary.fail += 1;
  failures.push(`${id}${detail ? `: ${detail}` : ""}`);
  console.log(`  FAIL  ${id}${detail ? ` — ${detail}` : ""}`);
}

function skip(id, detail = "") {
  summary.skip += 1;
  console.log(`  SKIP  ${id}${detail ? ` — ${detail}` : ""}`);
}

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function verifyNoindexMeta() {
  console.log("\n=== A. noindex / TLV pages ===\n");
  for (const rel of TLV_PAGES) {
    const html = read(rel);
    if (html.includes(ROBOTS_SNIPPET)) pass(`noindex:${path.basename(rel)}`);
    else fail(`noindex:${path.basename(rel)}`);
    if (html.includes("tlv-feature-flags.js") && html.includes("tlv-private-test-gate.js")) {
      pass(`flags-script:${path.basename(rel)}`);
    } else fail(`flags-script:${path.basename(rel)}`);
  }

  const flagsJs = read("live/tlv-feature-flags.js");
  if (flagsJs.includes("publicEnabled") && flagsJs.includes("rubi.hiro0613@gmail.com")) pass("code-tlv-feature-flags");
  else fail("code-tlv-feature-flags");

  const gateJs = read("live/tlv-private-test-gate.js");
  if (gateJs.includes("tlv-private-test-banner") && gateJs.includes("isTlvPublicNavigationEnabled")) {
    pass("code-tlv-private-test-gate");
  } else fail("code-tlv-private-test-gate");
}

function verifyRobotsAndHeaders() {
  console.log("\n=== B. robots.txt / headers ===\n");
  const robots = read("deploy/cloudflare/robots.txt");
  if (/Disallow:\s*\//.test(robots)) pass("robots-disallow-root");
  else fail("robots-disallow-root");
  if (robots.includes("/live/")) pass("robots-live-comment");
  else fail("robots-live-comment");

  const headers = read("deploy/cloudflare/_headers");
  if (headers.includes("nosnippet") && headers.includes("/live/*")) pass("headers-live-nosnippet");
  else fail("headers-live-nosnippet");

  const stage = read("deploy/cloudflare/stage-cloudflare-pages.mjs");
  if (stage.includes("writeTlvFeatureFlags") && stage.includes("TLV_ALLOWED_TEST_EMAILS")) {
    pass("stage-tlv-flags");
  } else fail("stage-tlv-flags");
}

function verifyLeakagePrevention() {
  console.log("\n=== C. URL leakage prevention ===\n");

  const distDir = path.join(ROOT, "deploy/cloudflare/dist");
  if (existsSync(distDir)) {
    const hasSitemap = (function walk(d) {
      for (const name of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, name.name);
        if (name.isDirectory()) {
          if (walk(p)) return true;
        } else if (/^sitemap.*\.xml$/i.test(name.name)) return true;
      }
      return false;
    })(distDir);
    if (!hasSitemap) pass("dist-no-sitemap");
    else fail("dist-no-sitemap");
  } else {
    skip("dist-no-sitemap", "dist not built");
  }

  for (const rel of GENERAL_SURFACES) {
    if (!existsSync(path.join(ROOT, rel))) {
      skip(`surface:${rel}`, "missing");
      continue;
    }
    const html = read(rel);
    if (/href=["']live\//i.test(html) || /og:url[^>]+live\//i.test(html)) {
      fail(`surface-no-live-link:${rel}`);
    } else {
      pass(`surface-no-live-link:${rel}`);
    }
  }

  for (const rel of TLV_PAGES) {
    const html = read(rel);
    if (/<meta[^>]+property=["']og:url["']/i.test(html)) fail(`og-url:${path.basename(rel)}`);
    else pass(`og-url-absent:${path.basename(rel)}`);
    if (/<link[^>]+rel=["']canonical["'][^>]+live\//i.test(html)) fail(`canonical:${path.basename(rel)}`);
    else pass(`canonical-safe:${path.basename(rel)}`);
  }
}

function verifyDistSync() {
  console.log("\n=== D. dist sync ===\n");
  const filePairs = [
    ["live/tlv-private-test-gate.js", "deploy/cloudflare/dist/live/tlv-private-test-gate.js"],
    ["deploy/cloudflare/robots.txt", "deploy/cloudflare/dist/robots.txt"],
    ["deploy/cloudflare/_headers", "deploy/cloudflare/dist/_headers"],
    ["live/live.css", "deploy/cloudflare/dist/live/live.css"],
  ];
  for (const [src, dest] of filePairs) {
    if (!existsSync(path.join(ROOT, dest))) {
      fail(`dist:${dest}`, "missing — run npm run build:pages");
      continue;
    }
    if (read(src) === read(dest)) pass(`dist-sync:${path.basename(dest)}`);
    else fail(`dist-sync:${path.basename(dest)}`, "out of date — run npm run build:pages");
  }

  const flagsDest = path.join(ROOT, "deploy/cloudflare/dist/live/tlv-feature-flags.js");
  if (!existsSync(flagsDest)) {
    fail("dist:deploy/cloudflare/dist/live/tlv-feature-flags.js", "missing — run npm run build:pages");
  } else {
    const built = read("deploy/cloudflare/dist/live/tlv-feature-flags.js");
    const dev = read("live/tlv-feature-flags.js");
    const flagOk =
      /publicEnabled:\s*false/.test(built) &&
      /privateTestEnabled:\s*true/.test(built) &&
      built.includes("rubi.hiro0613@gmail.com") &&
      /publicEnabled:\s*false/.test(dev) &&
      /privateTestEnabled:\s*true/.test(dev);
    if (flagOk) pass("dist-sync:tlv-feature-flags.js");
    else fail("dist-sync:tlv-feature-flags.js", "private test flags mismatch — run npm run build:pages");
  }
}

function verifyRegression() {
  console.log("\n=== E. Regression ===\n");
  const r = spawnSync(process.execPath, ["scripts/verify-live-youtube-p13-security-abuse.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/Result:\s*PASS/.test(out) && (r.status ?? 1) === 0) pass("regression:verify:live-youtube-p13");
  else fail("regression:verify:live-youtube-p13", out.split("\n").slice(-10).join(" | "));
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 14 Private Production Test ===\n");
  verifyNoindexMeta();
  verifyRobotsAndHeaders();
  verifyLeakagePrevention();
  verifyDistSync();
  verifyRegression();
  await closeAllBrowsers();

  console.log("\n--- Summary ---");
  console.log(`  PASS: ${summary.pass}`);
  console.log(`  FAIL: ${summary.fail}`);
  console.log(`  SKIP: ${summary.skip}`);
  console.log(`\nResult: ${summary.fail ? "FAIL" : "PASS"}\n`);
  if (failures.length) for (const f of failures) console.log(`  - ${f}`);
  process.exit(summary.fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
