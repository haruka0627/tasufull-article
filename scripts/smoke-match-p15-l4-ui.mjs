#!/usr/bin/env node
/**
 * P15-L4 UI smoke — repo match/ pages · 390×844 / 390×667 / 393×852 · console error 0
 *
 *   node scripts/smoke-match-p15-l4-ui.mjs
 *   node scripts/smoke-match-p15-l4-ui.mjs --base http://127.0.0.1:8791
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  MATCH_UI_VIEWPORTS,
  assertMatchNoHorizontalOverflow,
  isMatchMinViewport,
  matchViewportSize,
} from "./lib/match-viewports.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CORE_PAGES = Object.freeze([
  { key: "top", file: "match/match-top.html", probe: ".match-top-hero" },
  { key: "profile-create", file: "match/match-profile-create.html", probe: "[data-match-profile-wizard]" },
  { key: "swipe", file: "match/match-swipe.html", probe: "[data-match-swipe-action='like']" },
  { key: "list", file: "match/match-list.html", probe: "[data-match-pair-list]" },
  { key: "talk-bridge", file: "match/match-talk-bridge.html", probe: "[data-match-talk-cta]" },
  { key: "safety", file: "match/match-safety.html", probe: ".match-safety-hero" },
  { key: "report", file: "match/match-report.html", probe: "[data-report-submit]" },
  { key: "block", file: "match/match-block.html", probe: "[data-match-block-list]" },
  { key: "verify", file: "match/match-verify.html", probe: "[data-verify-panel='1']" },
]);

const P15_PAGES = Object.freeze([
  { key: "favorites", file: "match/match-favorites.html", probe: "[data-match-favorite-list]" },
  { key: "footprints", file: "match/match-footprints.html", probe: "[data-match-footprint-list]" },
  { key: "search-saved", file: "match/match-search-saved.html", probe: "[data-match-saved-search-list]" },
]);

const P15_API_METHODS = Object.freeze([
  "favoriteUser",
  "unfavoriteUser",
  "listFavorites",
  "recordProfileView",
  "listProfileViews",
  "saveSearch",
  "listSavedSearches",
  "deleteSavedSearch",
  "getCompatibility",
  "getProfileCompleteness",
  "updateActivity",
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

function parseBaseArg() {
  const idx = process.argv.indexOf("--base");
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1].replace(/\/$/, "");
  }
  return null;
}

function contentType(filePath) {
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

function startStaticServer(root, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "match/match-review.html";
        const filePath = path.join(root, rel);
        if (!filePath.startsWith(root)) {
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

async function resolveBaseUrl() {
  const argBase = parseBaseArg();
  if (argBase) return { base: argBase, close: async () => {} };
  const server = await startStaticServer(ROOT, 8791);
  return server;
}

async function runP15ApiSmoke(base) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: matchViewportSize(MATCH_UI_VIEWPORTS[0]) });
    const res = await page.goto(`${base}/match/match-review.html`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    if (!res || res.status() >= 400) throw new Error(`review HTTP ${res?.status()}`);

    const checks = await page.evaluate(async (methods) => {
      const api = window.TasfulMatchAPI;
      if (!api) return { ok: false, reason: "TasfulMatchAPI missing" };
      if (api.mode !== "client_stub") return { ok: false, reason: "mode not client_stub" };

      for (const m of methods) {
        if (typeof api[m] !== "function") return { ok: false, reason: `missing ${m}` };
      }

      const fav = await api.favoriteUser({ target_user_id: "stub-user-yui", source: "profile" });
      const listFav = await api.listFavorites({ limit: 5 });
      const unfav = await api.unfavoriteUser({ target_user_id: "stub-user-yui" });
      const view = await api.recordProfileView({ viewed_user_id: "stub-user-yui" });
      const footprints = await api.listProfileViews({ limit: 5 });
      const save = await api.saveSearch({
        name: "smoke",
        filters_json: { age_min: 20 },
        is_default: false,
      });
      const searches = await api.listSavedSearches({});
      const del = await api.deleteSavedSearch({ id: save.search_id });
      const compat = await api.getCompatibility({ target_user_id: "stub-user-yui" });
      const complete = await api.getProfileCompleteness({});
      const activity = await api.updateActivity({});

      const payloads = [fav, listFav, unfav, view, footprints, save, searches, del, compat, complete, activity];
      const json = JSON.stringify(payloads);
      if (json.includes("last_active_at")) return { ok: false, reason: "last_active_at in API response" };
      if (!activity.activity_label) return { ok: false, reason: "activity_label missing" };
      if (footprints.items?.[0]?.viewed_at) return { ok: false, reason: "viewed_at leaked" };

      const ai = window.TasuAiWorkspaceLinks?.buildMatchCtaUrl?.({
        mode: "match-profile-coach",
        q: "test",
        returnTo: "/match/match-mypage.html",
      });
      if (!ai || !ai.includes("returnTo=")) return { ok: false, reason: "buildMatchCtaUrl returnTo" };

      return { ok: true, mode: api.mode, ai };
    }, P15_API_METHODS);

    if (!checks.ok) throw new Error(checks.reason || "api smoke failed");
    pass("P15 API client_stub", `${P15_API_METHODS.length} methods · no timestamp leak`);
  });
}

async function auditPage(browser, base, pageDef, viewport) {
  const page = await browser.newPage({ viewport: matchViewportSize(viewport) });
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const url = `${base}/${pageDef.file.replace(/\\/g, "/")}`;
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  if (!res || res.status() >= 400) {
    throw new Error(`${pageDef.key} HTTP ${res?.status()} @${viewport.label}`);
  }

  if (!isMatchMinViewport(viewport)) {
    if (pageDef.probe) {
      const probe = await page.$(pageDef.probe);
      if (!probe) throw new Error(`${pageDef.key} probe missing @${viewport.label}: ${pageDef.probe}`);
    }

    const bodyText = await page.evaluate(() => document.body?.innerText || "");
    for (const re of FORBIDDEN_BODY) {
      if (re.test(bodyText)) throw new Error(`${pageDef.key} forbidden text ${re} @${viewport.label}`);
    }
  }

  await assertMatchNoHorizontalOverflow(page, pageDef.key, viewport);

  if (!isMatchMinViewport(viewport)) {
    if (pageErrors.length) throw new Error(`${pageDef.key} pageerror @${viewport.label}: ${pageErrors[0]}`);
    if (consoleErrors.length) {
      throw new Error(`${pageDef.key} console.error @${viewport.label}: ${consoleErrors[0]}`);
    }
  }

  await page.close();
}

async function runVisualSmoke(base) {
  const allPages = [...CORE_PAGES, ...P15_PAGES];
  await withPlaywrightBrowser(async (browser) => {
    for (const viewport of MATCH_UI_VIEWPORTS) {
      for (const pageDef of allPages) {
        await auditPage(browser, base, pageDef, viewport);
      }
      pass(
        `Visual ${viewport.label}`,
        `${allPages.length} pages · ${isMatchMinViewport(viewport) ? "overflow only" : "console 0 · no overflow"}`,
      );
    }
  });
}

function verifyDistUntouched() {
  const distApi = path.join(ROOT, "deploy/cloudflare/dist/match/match-api.js");
  if (!fs.existsSync(distApi)) {
    pass("dist untouched", "dist match-api.js absent (ok)");
    return;
  }
  const src = fs.readFileSync(path.join(ROOT, "match/match-api.js"), "utf8");
  const dst = fs.readFileSync(distApi, "utf8");
  if (src === dst) {
    fail("dist untouched", "match-api.js matches dist — expected L5 sync only");
    return;
  }
  if (!dst.includes("favoriteUser")) {
    pass("dist untouched", "P15 not synced to dist");
  } else {
    fail("dist untouched", "dist already contains P15 — unexpected");
  }
}

async function main() {
  console.log("P15-L4 UI smoke");
  let server;
  try {
    server = await resolveBaseUrl();
    console.log(`  base=${server.base}`);

    await runP15ApiSmoke(server.base);
    await runVisualSmoke(server.base);
    verifyDistUntouched();

    const ng = results.filter((r) => !r.ok);
    console.log(`\nSmoke result: ${ng.length === 0 ? "PASS" : "FAIL"} (${results.length} checks)`);
    if (ng.length) {
      console.log("Judgment: BLOCKED_WITH_REASON");
      process.exit(1);
    }
    console.log("Judgment: READY_FOR_P15_L5_DIST_SYNC");
  } catch (e) {
    fail("smoke run", e.message);
    console.log("Judgment: BLOCKED_WITH_REASON");
    process.exit(1);
  } finally {
    await closeAllBrowsers();
    if (server?.close) await server.close();
  }
}

main();
