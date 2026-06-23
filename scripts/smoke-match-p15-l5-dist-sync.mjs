#!/usr/bin/env node
/**
 * P15-L5 dist sync smoke — match/ → deploy/cloudflare/dist/match/
 * UI viewports: 390×844 (baseline) · 390×667 (min) · 393×852 (iPhone)
 *
 *   node scripts/smoke-match-p15-l5-dist-sync.mjs
 *   node scripts/smoke-match-p15-l5-dist-sync.mjs --skip-edge
 *   node scripts/smoke-match-p15-l5-dist-sync.mjs --skip-sync
 *   node scripts/smoke-match-p15-l5-dist-sync.mjs --base http://127.0.0.1:8788
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";
import {
  MATCH_SCREENSHOT_VIEWPORT,
  MATCH_UI_VIEWPORTS,
  assertMatchNoHorizontalOverflow,
  isMatchMinViewport,
  matchViewportSize,
} from "./lib/match-viewports.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MATCH_SRC = path.join(ROOT, "match");
const MATCH_DST = path.join(ROOT, "deploy/cloudflare/dist/match");
const AI_SRC = path.join(ROOT, "ai-workspace-links.js");
const AI_DST = path.join(ROOT, "deploy/cloudflare/dist/ai-workspace-links.js");
/** Root auth deps referenced by match/*.html (../chat-supabase-config.js etc.) */
const ROOT_AUTH_SYNC = Object.freeze([
  { src: "chat-supabase-config.js", dst: "chat-supabase-config.js" },
  { src: "auth-current-user.js", dst: "auth-current-user.js" },
  { src: "tasu-supabase-client.js", dst: "tasu-supabase-client.js" },
]);
const PROD_PARITY_BASE = STANDARD_LOCAL_BASE;

const skipSync = process.argv.includes("--skip-sync");
const skipEdge = process.argv.includes("--skip-edge");

function parseBaseArg() {
  const idx = process.argv.indexOf("--base");
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1].replace(/\/$/, "");
  }
  return null;
}

/** @type {readonly string[]} */
export const MATCH_SYNC_FILES = Object.freeze([
  "match-api.js",
  "match-auth.js",
  "match-bootstrap.js",
  "match-beta-gate.js",
  "match-login-gate.js",
  "match-wiring.js",
  "match-core-wiring.js",
  "match-profile-wiring.js",
  "match-feed-wiring.js",
  "match-unmatch-wiring.js",
  "match-verification-wiring.js",
  "match-admin-wiring.js",
  "match-mock.js",
  "match-data-stub.js",
  "match-data-render.js",
  "match-p15-wiring.js",
  "match-p15-render.js",
  "match-ai-cta.js",
  "match.css",
  "match-top.html",
  "match-profile-create.html",
  "match-swipe.html",
  "match-list.html",
  "match-talk-bridge.html",
  "match-safety.html",
  "match-report.html",
  "match-block.html",
  "match-verify.html",
  "match-admin.html",
  "match-mypage.html",
  "match-review.html",
  "match-favorites.html",
  "match-footprints.html",
  "match-search-saved.html",
  "match-search.html",
  "match-search-results.html",
  "match-ai-love-advice.html",
  "match-ai-marriage-advice.html",
  "match-ai-profile-coach.html",
  "match-ai-message-coach.html",
  "match-ai-compatibility-detail.html",
  "match-ai-date-coach.html",
]);

const CORE_PAGES = Object.freeze([
  { key: "top", file: "match-top.html", probe: ".match-top-hero" },
  { key: "profile-create", file: "match-profile-create.html", probe: "[data-match-profile-wizard]" },
  { key: "swipe", file: "match-swipe.html", probe: "[data-match-swipe-action='like']" },
  { key: "list", file: "match-list.html", probe: "[data-match-pair-list]" },
  { key: "talk-bridge", file: "match-talk-bridge.html", probe: "[data-match-talk-cta]" },
  { key: "safety", file: "match-safety.html", probe: ".match-safety-hero" },
  { key: "report", file: "match-report.html", probe: "[data-report-submit]" },
  { key: "block", file: "match-block.html", probe: "[data-match-block-list]" },
  { key: "verify", file: "match-verify.html", probe: "[data-verify-panel='1']" },
]);

const P15_PAGES = Object.freeze([
  { key: "favorites", file: "match-favorites.html", probe: "[data-match-favorite-list]" },
  { key: "footprints", file: "match-footprints.html", probe: "[data-match-footprint-list]" },
  { key: "search-saved", file: "match-search-saved.html", probe: "[data-match-saved-search-list]" },
  { key: "search", file: "match-search.html", probe: "[data-match-search-form]" },
  { key: "search-results", file: "match-search-results.html", probe: "[data-match-search-results-list]" },
]);

const FORBIDDEN_BODY = [/last_active_at/i, /viewed_at/i];

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function syncDistFiles() {
  if (!fs.existsSync(MATCH_SRC)) throw new Error(`missing ${MATCH_SRC}`);
  fs.mkdirSync(MATCH_DST, { recursive: true });

  const copied = [];
  for (const rel of MATCH_SYNC_FILES) {
    const src = path.join(MATCH_SRC, rel);
    const dst = path.join(MATCH_DST, rel);
    if (!fs.existsSync(src)) throw new Error(`missing source ${rel}`);
    copyFile(src, dst);
    copied.push(rel);
  }

  if (!fs.existsSync(AI_SRC)) throw new Error("missing ai-workspace-links.js");
  copyFile(AI_SRC, AI_DST);
  copied.push("ai-workspace-links.js (dist root)");

  for (const { src, dst } of ROOT_AUTH_SYNC) {
    const srcPath = path.join(ROOT, src);
    const dstPath = path.join(ROOT, "deploy/cloudflare/dist", dst);
    if (!fs.existsSync(srcPath)) throw new Error(`missing ${src}`);
    copyFile(srcPath, dstPath);
    copied.push(`${dst} (dist root)`);
  }

  return copied;
}

function verifyHashMatch() {
  const mismatches = [];
  for (const rel of MATCH_SYNC_FILES) {
    const src = path.join(MATCH_SRC, rel);
    const dst = path.join(MATCH_DST, rel);
    if (!fs.existsSync(dst)) {
      mismatches.push(`missing dist ${rel}`);
      continue;
    }
    if (sha256File(src) !== sha256File(dst)) {
      mismatches.push(`hash drift ${rel}`);
    }
  }
  if (sha256File(AI_SRC) !== sha256File(AI_DST)) {
    mismatches.push("hash drift ai-workspace-links.js");
  }
  for (const { src, dst } of ROOT_AUTH_SYNC) {
    const srcPath = path.join(ROOT, src);
    const dstPath = path.join(ROOT, "deploy/cloudflare/dist", dst);
    if (!fs.existsSync(dstPath)) {
      mismatches.push(`missing dist ${dst}`);
      continue;
    }
    if (sha256File(srcPath) !== sha256File(dstPath)) {
      mismatches.push(`hash drift ${dst}`);
    }
  }
  if (mismatches.length) throw new Error(mismatches.join("; "));
  return MATCH_SYNC_FILES.length + 1;
}

function contentType(filePath) {
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

function startDistStaticServer(port) {
  const distRoot = path.join(ROOT, "deploy/cloudflare/dist");
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
        const filePath = path.join(distRoot, rel);
        if (!filePath.startsWith(distRoot)) {
          res.writeHead(403);
          res.end("forbidden");
          return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.writeHead(404);
          res.end("not found");
          return;
        }
        res.writeHead(200, { "Content-Type": contentType(filePath) });
        res.end(fs.readFileSync(filePath));
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({
        base: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

async function probeBase(base) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${base}/match/match-top.html`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveProdParityBase() {
  const argBase = parseBaseArg();
  if (argBase) return { base: argBase, close: async () => {}, external: true };

  if (await probeBase(PROD_PARITY_BASE)) {
    return { base: PROD_PARITY_BASE, close: async () => {}, external: true };
  }

  const port = 8788;
  const server = await startDistStaticServer(port);
  return { ...server, external: false };
}

async function checkHttp200(base) {
  const all = [...CORE_PAGES, ...P15_PAGES];
  for (const page of all) {
    const url = `${base}/match/${page.file}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${page.key} HTTP ${res.status} ${url}`);
  }
  pass("HTTP 200", `${all.length} pages @ ${base}/match/`);
}

async function auditPage(browser, base, pageDef, viewport) {
  const page = await browser.newPage({ viewport: matchViewportSize(viewport) });
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const url = `${base}/match/${pageDef.file}`;
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  if (!res || res.status() >= 400) {
    throw new Error(`${pageDef.key} HTTP ${res?.status()} @${viewport.label}`);
  }

  if (!isMatchMinViewport(viewport)) {
    if (pageDef.probe) {
      const probe = await page.$(pageDef.probe);
      if (!probe) throw new Error(`${pageDef.key} probe missing @${viewport.label}`);
    }

    const bodyText = await page.evaluate(() => document.body?.innerText || "");
    for (const re of FORBIDDEN_BODY) {
      if (re.test(bodyText)) throw new Error(`${pageDef.key} forbidden ${re} @${viewport.label}`);
    }
  }

  await assertMatchNoHorizontalOverflow(page, pageDef.key, viewport);

  if (!isMatchMinViewport(viewport)) {
    if (pageErrors.length) throw new Error(`${pageDef.key} pageerror: ${pageErrors[0]}`);
    if (consoleErrors.length) throw new Error(`${pageDef.key} console.error: ${consoleErrors[0]}`);
  }

  await page.close();
}

async function runVisualSmoke(base) {
  const all = [...CORE_PAGES, ...P15_PAGES];
  await withPlaywrightBrowser(async (browser) => {
    for (const viewport of MATCH_UI_VIEWPORTS) {
      for (const pageDef of all) {
        await auditPage(browser, base, pageDef, viewport);
      }
      pass(`Visual ${viewport.label}`, `${all.length} pages · ${isMatchMinViewport(viewport) ? "overflow only" : "console 0"}`);
    }
  });
}

async function runAiCtaSmoke(base) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: matchViewportSize(MATCH_SCREENSHOT_VIEWPORT) });
    await page.goto(`${base}/match/match-mypage.html`, { waitUntil: "networkidle", timeout: 30000 });

    const checks = await page.evaluate(() => {
      const ctas = Array.from(document.querySelectorAll("[data-match-ai-cta]"));
      if (!ctas.length) return { ok: false, reason: "no CTA elements" };
      const bad = ctas.find((el) => {
        const href = el.getAttribute("href") || "";
        return !href.includes("ai-workspace.html") || !href.includes("mode=") || href === "#";
      });
      if (bad) return { ok: false, reason: "unresolved CTA href" };
      const hasIframe = !!document.querySelector("iframe[src*='ai-workspace']");
      if (hasIframe) return { ok: false, reason: "embedded AI iframe" };
      return { ok: true, count: ctas.length };
    });

    if (!checks.ok) throw new Error(checks.reason || "AI CTA check failed");
    pass("TASFUL AI CTA links", `${checks.count} CTAs · link-only · no iframe`);
  });
}

function runEdgeSmoke() {
  const r = spawnSync("node", ["scripts/smoke-match-p15-l3-edge.mjs", "--skip-deploy", "--skip-grants"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "edge smoke failed").slice(0, 600));
  }
  pass("Linked ref P15 Edge smoke", "L3 --skip-deploy --skip-grants");
}

async function main() {
  console.log("P15-L5 dist sync smoke");

  let server;
  try {
    if (!skipSync) {
      const copied = syncDistFiles();
      pass("dist sync", `${copied.length} files copied`);
    } else {
      pass("dist sync", "skipped (--skip-sync)");
    }

    const hashCount = verifyHashMatch();
    pass("hash match", `${hashCount} files source=dist`);

    server = await resolveProdParityBase();
    console.log(`  prod-parity base=${server.base}${server.external ? " (existing)" : " (started)"}`);

    await checkHttp200(server.base);
    await runVisualSmoke(server.base);
    await runAiCtaSmoke(server.base);

    if (!skipEdge) {
      runEdgeSmoke();
    } else {
      pass("Linked ref P15 Edge smoke", "skipped (--skip-edge)");
    }

    const ng = results.filter((r) => !r.ok);
    console.log(`\nSmoke result: ${ng.length === 0 ? "PASS" : "FAIL"} (${results.length} checks)`);
    if (ng.length) {
      console.log("Judgment: BLOCKED_WITH_REASON");
      process.exit(1);
    }
    console.log("Judgment: READY_FOR_P15_RELEASE_CANDIDATE_LOCAL");
  } catch (e) {
    fail("smoke run", e.message);
    console.log("Judgment: BLOCKED_WITH_REASON");
    process.exit(1);
  } finally {
    await closeAllBrowsers();
    if (server?.close && !server.external) await server.close();
  }
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) main();
