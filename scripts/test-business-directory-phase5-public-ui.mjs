#!/usr/bin/env node
/**
 * Business Directory Phase 5 — Public UI tests
 *   node scripts/test-business-directory-phase5-public-ui.mjs
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const PUBLIC = "business-directory/public";

let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function mustInclude(hay, needle, label) {
  if (hay.includes(needle)) ok(label);
  else bad(label, `missing: ${needle}`);
}

console.log("=== Business Directory Phase 5 — Public UI ===\n");

mustInclude(read(`${PUBLIC}/list.html`), "data-bd-public-page=\"list\"", "list page hook");
mustInclude(read(`${PUBLIC}/list.html`), "data-bd-public-grid", "list grid");
mustInclude(read(`${PUBLIC}/list.html`), "shop_retail", "shop type filter");
mustInclude(read(`${PUBLIC}/list.html`), "business_service", "business type filter");
mustInclude(read(`${PUBLIC}/list.html`), 'name="q"', "keyword filter");
mustInclude(read(`${PUBLIC}/list.html`), 'name="category"', "category filter");
mustInclude(read(`${PUBLIC}/list.html`), 'name="region"', "region filter");
mustInclude(read(`${PUBLIC}/list.html`), 'name="sort"', "sort filter");
mustInclude(read(`${PUBLIC}/detail.html`), "data-bd-public-detail", "detail host");

const pubJs = read(`${PUBLIC}/business-directory-public.js`);
mustInclude(pubJs, "getPublicListings", "uses getPublicListings");
mustInclude(pubJs, "getPublicListingDetail", "uses getPublicListingDetail");
mustInclude(pubJs, "bdPublicMock", "public mock mode");
mustInclude(pubJs, "status !== \"published\"", "mock excludes non-published");
mustInclude(pubJs, "external_redirect", "hp_mode redirect");
mustInclude(pubJs, "full_page", "hp_mode full page");
mustInclude(pubJs, "TLV", "TLV placeholder");
mustInclude(pubJs, "SNS", "SNS placeholder");

mustInclude(read("index-top.html"), "business-directory/public/list.html", "market TOP BD entry");
mustInclude(read("business.html"), "business-directory/public/list.html", "business page BD entry");
mustInclude(read("shop-store.html"), "business-directory/public/list.html", "shop-store BD entry");

const ownerIdx = read("business-directory/index.html");
if (!ownerIdx.includes("bd-public")) ok("owner UI unchanged");
else bad("owner UI public leak");

const adminRev = read("business-directory/admin/reviews.html");
if (!adminRev.includes("bd-public")) ok("admin UI unchanged");
else bad("admin UI public leak");

function startTempServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(String(req.url || "/").split("?")[0]);
        const filePath = path.join(root, urlPath.replace(/^\//, "").replace(/\//g, path.sep));
        if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.statusCode = 404;
          res.end("not found");
          return;
        }
        res.end(fs.readFileSync(filePath));
      } catch (e) {
        res.statusCode = 500;
        res.end(String(e.message || e));
      }
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

console.log("\n--- browser smoke (bdPublicMock=1) ---\n");

async function browserSmoke() {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.log("SKIP: playwright not installed");
    return;
  }
  const port = 9879;
  const server = await startTempServer(port);
  const base = `http://127.0.0.1:${port}/business-directory/public`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(`${base}/list.html?bdPublicMock=1`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-bd-public-card]", { timeout: 8000 });
    const count = await page.locator("[data-bd-public-card]").count();
    if (count === 2) ok("browser: published only (2 cards, draft hidden)");
    else bad("browser: published count", String(count));

    await page.locator('select[name="type"]').selectOption("business_service");
    await page.locator('input[name="q"]').fill("山田");
    await page.locator("[data-bd-public-filters] button[type=submit]").click();
    await page.waitForURL(/type=business_service/);
    await page.waitForTimeout(400);
    const filtered = await page.locator("[data-bd-public-card]").count();
    if (filtered >= 1) ok("browser: keyword + type filter");
    else bad("browser: filter result");

    await page.goto(`${base}/detail.html?slug=yamada-koumuten&type=business_service&bdPublicMock=1`, {
      waitUntil: "domcontentloaded",
    });
    const redirectText = await page.locator("[data-bd-public-detail]").innerText();
    if (redirectText.includes("公式サイト") && redirectText.includes("送客")) ok("browser: external_redirect CTA");
    else bad("browser: external_redirect");

    await page.goto(`${base}/detail.html?slug=tanaka-shop&type=shop_retail&bdPublicMock=1`, {
      waitUntil: "domcontentloaded",
    });
    const fullText = await page.locator("[data-bd-public-detail]").innerText();
    if (fullText.includes("簡易HP") && fullText.includes("営業時間")) ok("browser: full_page detail");
    else bad("browser: full_page detail");

    if (fullText.includes("TLV") && fullText.includes("SNS")) ok("browser: TLV/SNS placeholders");
    else bad("browser: placeholders");
  } catch (e) {
    bad("browser smoke", String(e.message || e));
  } finally {
    await browser.close();
    server.close();
  }
}

await browserSmoke();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
