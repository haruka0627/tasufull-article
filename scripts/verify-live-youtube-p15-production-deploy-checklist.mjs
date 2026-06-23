#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 15 — pre-production deploy final checklist
 *
 *   npm run verify:live-youtube-p15
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { verifyTlvDist, verifyTlvGitTracked } from "./lib/tlv-dist-manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CHECKLIST = "reports/tlv-phase15-production-deploy-checklist.md";
const ACCESS_GUIDE = "reports/tlv-cloudflare-access-private-test-guide.md";
const PHASE14_RESULT = "reports/talk-youtube-phase14-private-production-test-result.md";

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

const GENERAL_SURFACES = [
  "dashboard.html",
  "index-top.html",
  "company/index.html",
  "company/services.html",
  "builder/index.html",
  "builder/user-dashboard.html",
];

const ROBOTS_SNIPPET = 'content="noindex,nofollow,noarchive,nosnippet"';
const SERVICE_ROLE_RE = /"role"\s*:\s*"service_role"|sb_secret_[A-Za-z0-9_-]{10,}|serviceRoleKey\s*:|SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s#]+/i;

function hasServiceRoleLeak(body) {
  return SERVICE_ROLE_RE.test(body);
}

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

function findSitemapsWithLive(dir) {
  const hits = [];
  if (!existsSync(dir)) return hits;
  (function walk(d) {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/^sitemap.*\.xml$/i.test(ent.name)) {
        const body = readFileSync(p, "utf8");
        if (/\/live\//i.test(body)) hits.push(path.relative(ROOT, p));
      }
    }
  })(dir);
  return hits;
}

function verifyDocs() {
  console.log("\n=== A. Phase 15 docs ===\n");
  for (const rel of [CHECKLIST, ACCESS_GUIDE, PHASE14_RESULT]) {
    if (!existsSync(path.join(ROOT, rel))) {
      fail(`doc:${path.basename(rel)}`, "missing");
      continue;
    }
    const body = read(rel);
    pass(`doc:${path.basename(rel)}`);
    if (rel === CHECKLIST) {
      if (body.includes("TLV_PUBLIC_ENABLED") && body.includes("rubi.hiro0613@gmail.com")) {
        pass("checklist-env-flags");
      } else fail("checklist-env-flags");
      if (body.includes("Disallow: /") && body.includes("noindex")) pass("checklist-seo");
      else fail("checklist-seo");
      if (body.includes("npm run verify:live-youtube-p15") && body.includes("npm run build:pages")) {
        pass("checklist-build-steps");
      } else fail("checklist-build-steps");
      if (body.includes("/live/*") && body.includes("緊急遮断")) pass("checklist-access-summary");
      else fail("checklist-access-summary");
      if (body.includes("qualified view") && body.includes("console error 0")) pass("checklist-smoke");
      else fail("checklist-smoke");
      if (body.includes("事故防止") && body.includes("TLV_PUBLIC_ENABLED=true")) pass("checklist-accident-rules");
      else fail("checklist-accident-rules");
    }
    if (rel === ACCESS_GUIDE && body.includes("/live/*") && body.includes("rubi.hiro0613@gmail.com")) {
      pass("access-guide-email-path");
    } else if (rel === ACCESS_GUIDE) {
      fail("access-guide-email-path");
    }
  }
}

function verifyPrivateFlags() {
  console.log("\n=== B. TLV private test flags ===\n");
  const devFlags = read("live/tlv-feature-flags.js");
  if (/publicEnabled:\s*false/.test(devFlags)) pass("flags-dev-public-false");
  else fail("flags-dev-public-false");
  if (/privateTestEnabled:\s*true/.test(devFlags)) pass("flags-dev-private-true");
  else fail("flags-dev-private-true");
  if (devFlags.includes("rubi.hiro0613@gmail.com")) pass("flags-dev-allowed-email");
  else fail("flags-dev-allowed-email");

  const stage = read("deploy/cloudflare/stage-cloudflare-pages.mjs");
  if (stage.includes("TLV_PUBLIC_ENABLED") && stage.includes("TLV_ALLOWED_TEST_EMAILS")) {
    pass("stage-env-vars");
  } else fail("stage-env-vars");
  if (stage.includes("writeTlvFeatureFlags")) pass("stage-write-flags");
  else fail("stage-write-flags");
}

function verifyRobotsAndNoindex() {
  console.log("\n=== C. robots.txt / noindex ===\n");
  const robots = read("deploy/cloudflare/robots.txt");
  if (/Disallow:\s*\//.test(robots)) pass("robots-disallow-root");
  else fail("robots-disallow-root");

  for (const rel of TLV_PAGES) {
    const html = read(rel);
    if (html.includes(ROBOTS_SNIPPET)) pass(`noindex:${path.basename(rel)}`);
    else fail(`noindex:${path.basename(rel)}`);
  }
}

function verifyLeakageAndSecrets() {
  console.log("\n=== D. URL leakage / secrets ===\n");

  for (const rel of ["chat-supabase-config.js", "deploy/cloudflare/stage-cloudflare-pages.mjs"]) {
    const body = read(rel);
    if (hasServiceRoleLeak(body)) fail(`no-service-role:${path.basename(rel)}`);
    else pass(`no-service-role:${path.basename(rel)}`);
  }

  for (const rel of GENERAL_SURFACES) {
    if (!existsSync(path.join(ROOT, rel))) {
      skip(`nav-no-live:${rel}`, "missing");
      continue;
    }
    const html = read(rel);
    if (/href=["'][^"']*\/live\//i.test(html) || /href=["']live\//i.test(html)) {
      fail(`nav-no-live:${rel}`);
    } else {
      pass(`nav-no-live:${rel}`);
    }
  }

  const sitemapHits = [
    ...findSitemapsWithLive(ROOT),
    ...findSitemapsWithLive(path.join(ROOT, "deploy/cloudflare/dist")),
  ];
  if (!sitemapHits.length) pass("sitemap-no-live");
  else fail("sitemap-no-live", sitemapHits.join(", "));

  const distDir = path.join(ROOT, "deploy/cloudflare/dist");
  if (existsSync(distDir)) {
    let hasAnySitemap = false;
    (function walk(d) {
      for (const ent of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/^sitemap.*\.xml$/i.test(ent.name)) hasAnySitemap = true;
      }
    })(distDir);
    if (!hasAnySitemap) pass("dist-no-sitemap-file");
    else skip("dist-no-sitemap-file", "sitemap exists but no /live/ refs");
  } else {
    skip("dist-no-sitemap-file", "dist not built");
  }
}

function verifyTlvRouting() {
  console.log("\n=== F. TLV dist / git routing ===\n");

  const distErrors = verifyTlvDist(ROOT);
  if (!distErrors.length) pass("dist-tlv-pages", `${TLV_PAGES.length}+ files`);
  else {
    for (const e of distErrors) fail("dist-tlv-pages", e);
  }

  const gitErrors = verifyTlvGitTracked(ROOT);
  if (!gitErrors.length) pass("git-tlv-tracked");
  else {
    for (const e of gitErrors) fail("git-tlv-tracked", e);
  }

  const redirects = read("deploy/cloudflare/_redirects");
  if (!/\/live\/.*shop-store/i.test(redirects)) pass("redirects-no-live-to-market");
  else fail("redirects-no-live-to-market", "unexpected /live/ → market rule in _redirects");
}

function verifyRegression() {
  console.log("\n=== E. Phase 14 regression ===\n");
  const r = spawnSync(process.execPath, ["scripts/verify-live-youtube-p14-private-production-test.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 40 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/Result:\s*PASS/.test(out) && (r.status ?? 1) === 0) pass("regression:verify:live-youtube-p14");
  else fail("regression:verify:live-youtube-p14", out.split("\n").slice(-12).join(" | "));
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 15 Production Deploy Checklist ===\n");
  verifyDocs();
  verifyPrivateFlags();
  verifyRobotsAndNoindex();
  verifyLeakageAndSecrets();
  verifyTlvRouting();
  verifyRegression();

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
