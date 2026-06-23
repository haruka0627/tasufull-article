#!/usr/bin/env node
/**
 * P16 AI Landing Pages smoke — 6 LP + dist sync + P15 regression
 *
 *   node scripts/smoke-match-p16-ai-landing-pages.mjs
 *   node scripts/smoke-match-p16-ai-landing-pages.mjs --skip-sync
 *   node scripts/smoke-match-p16-ai-landing-pages.mjs --skip-edge
 *   node scripts/smoke-match-p16-ai-landing-pages.mjs --base http://127.0.0.1:8788
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
import { MATCH_SYNC_FILES } from "./smoke-match-p15-l5-dist-sync.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MATCH_SRC = path.join(ROOT, "match");
const MATCH_DST = path.join(ROOT, "deploy/cloudflare/dist/match");
const AI_SRC = path.join(ROOT, "ai-workspace-links.js");
const AI_DST = path.join(ROOT, "deploy/cloudflare/dist/ai-workspace-links.js");
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
]);

const P16_PAGES = Object.freeze([
  { key: "ai-love-advice", file: "match-ai-love-advice.html", probe: "[data-match-ai-landing]", mode: "match-love-advice" },
  { key: "ai-marriage-advice", file: "match-ai-marriage-advice.html", probe: "[data-match-ai-landing]", mode: "match-marriage-advice" },
  { key: "ai-profile-coach", file: "match-ai-profile-coach.html", probe: "[data-match-ai-landing]", mode: "match-profile-coach" },
  { key: "ai-message-coach", file: "match-ai-message-coach.html", probe: "[data-match-ai-landing]", mode: "match-message-coach" },
  { key: "ai-compatibility-detail", file: "match-ai-compatibility-detail.html", probe: "[data-match-ai-landing]", mode: "match-compatibility-detail" },
  { key: "ai-date-coach", file: "match-ai-date-coach.html", probe: "[data-match-ai-landing]", mode: "match-date-coach" },
]);

const ALL_PAGES = Object.freeze([...CORE_PAGES, ...P15_PAGES, ...P16_PAGES]);

const OLD_MODES = Object.freeze([
  "match-love-consult",
  "match-marriage-consult",
  "match-compatibility-deep",
]);

const FORBIDDEN_BODY = [/last_active_at/i, /viewed_at/i, /オンライン中/];

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
  if (mismatches.length) throw new Error(mismatches.join("; "));
  return MATCH_SYNC_FILES.length + 1;
}

function checkNoOldModesInSource() {
  const htmlFiles = fs.readdirSync(MATCH_SRC).filter((f) => f.endsWith(".html"));
  const hits = [];
  for (const file of htmlFiles) {
    const text = fs.readFileSync(path.join(MATCH_SRC, file), "utf8");
    for (const mode of OLD_MODES) {
      if (text.includes(mode)) hits.push(`${file}:${mode}`);
    }
  }
  if (hits.length) throw new Error(`legacy modes remain: ${hits.join(", ")}`);
  pass("canonical AI modes", `no legacy modes in ${htmlFiles.length} HTML files`);
}

function checkLpStaticOnly() {
  for (const page of P16_PAGES) {
    const filePath = path.join(MATCH_SRC, page.file);
    const text = fs.readFileSync(filePath, "utf8");
    if (text.includes("<iframe")) throw new Error(`${page.file} contains iframe`);
    if (/match-api\.js|match-p15-wiring\.js|supabase/i.test(text)) {
      throw new Error(`${page.file} loads AI/API wiring`);
    }
    if (!text.includes('data-ai-mode="' + page.mode + '"')) {
      throw new Error(`${page.file} missing mode ${page.mode}`);
    }
    if (!text.includes("TASFUL AIで相談する")) {
      throw new Error(`${page.file} missing primary CTA label`);
    }
  }
  pass("P16 LP static structure", "6 pages · no iframe · no match-api");
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
  for (const page of ALL_PAGES) {
    const url = `${base}/match/${page.file}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${page.key} HTTP ${res.status} ${url}`);
  }
  pass("HTTP 200", `${ALL_PAGES.length} pages @ ${base}/match/`);
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
    const hasIframe = await page.evaluate(() => !!document.querySelector("iframe"));
    if (hasIframe) throw new Error(`${pageDef.key} iframe present @${viewport.label}`);

    if (pageErrors.length) throw new Error(`${pageDef.key} pageerror: ${pageErrors[0]}`);
    if (consoleErrors.length) throw new Error(`${pageDef.key} console.error: ${consoleErrors[0]}`);
  }

  await page.close();
}

async function runVisualSmoke(base) {
  await withPlaywrightBrowser(async (browser) => {
    for (const viewport of MATCH_UI_VIEWPORTS) {
      for (const pageDef of ALL_PAGES) {
        await auditPage(browser, base, pageDef, viewport);
      }
      pass(`Visual ${viewport.label}`, `${ALL_PAGES.length} pages · ${isMatchMinViewport(viewport) ? "overflow only" : "console 0 · no iframe"}`);
    }
  });
}

async function runP16CtaSmoke(base) {
  await withPlaywrightBrowser(async (browser) => {
    for (const pageDef of P16_PAGES) {
      const page = await browser.newPage({ viewport: matchViewportSize(MATCH_SCREENSHOT_VIEWPORT) });
      const url = `${base}/match/${pageDef.file}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

      const check = await page.evaluate((expectedMode) => {
        const cta = document.querySelector("[data-match-ai-cta]");
        if (!cta) return { ok: false, reason: "missing CTA" };
        const href = cta.getAttribute("href") || "";
        if (href === "#" || !href.includes("ai-workspace.html")) {
          return { ok: false, reason: "unresolved href" };
        }
        if (!href.includes("mode=" + expectedMode)) {
          return { ok: false, reason: "wrong mode in href" };
        }
        if (!href.includes("returnTo=")) {
          return { ok: false, reason: "missing returnTo" };
        }
        if ((cta.textContent || "").trim() !== "TASFUL AIで相談する") {
          return { ok: false, reason: "wrong CTA label" };
        }
        if (document.querySelector("iframe")) return { ok: false, reason: "iframe" };
        return { ok: true, href };
      }, pageDef.mode);

      await page.close();
      if (!check.ok) throw new Error(`${pageDef.key}: ${check.reason || "CTA failed"}`);
    }
    pass("P16 CTA URLs", "6 LP · buildMatchCtaUrl · mode + returnTo · label OK");
  });
}

async function runNoMatchAiApiSmoke(base) {
  await withPlaywrightBrowser(async (browser) => {
    for (const pageDef of P16_PAGES) {
      const page = await browser.newPage({ viewport: matchViewportSize(MATCH_SCREENSHOT_VIEWPORT) });
      const requests = [];
      page.on("request", (req) => {
        const u = req.url();
        if (/supabase|functions\/v1|openai|anthropic|gemini/i.test(u)) {
          requests.push(u);
        }
      });
      await page.goto(`${base}/match/${pageDef.file}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.close();
      if (requests.length) throw new Error(`${pageDef.key} AI API request: ${requests[0]}`);
    }
    pass("MATCH AI API calls", "0 requests on 6 LP pages");
  });
}

function runP15Regression() {
  const r = spawnSync(
    "node",
    ["scripts/smoke-match-p15-l5-dist-sync.mjs", "--skip-sync", ...(skipEdge ? ["--skip-edge"] : [])],
    { cwd: ROOT, encoding: "utf8", shell: true },
  );
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "P15 L5 regression failed").slice(0, 800));
  }
  pass("P15 L5 smoke regression", skipEdge ? "--skip-sync --skip-edge" : "--skip-sync");
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
  console.log("P16 AI Landing Pages smoke");

  let server;
  try {
    checkNoOldModesInSource();
    checkLpStaticOnly();

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
    await runP16CtaSmoke(server.base);
    await runNoMatchAiApiSmoke(server.base);

    runP15Regression();
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
    console.log("Judgment: READY_FOR_MATCH_P16_RELEASE_CANDIDATE_LOCAL");
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
