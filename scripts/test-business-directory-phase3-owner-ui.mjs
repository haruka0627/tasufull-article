#!/usr/bin/env node
/**
 * Business Directory Phase 3 — Owner UI static + browser smoke
 *   node scripts/test-business-directory-phase3-owner-ui.mjs
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const BD = "business-directory";
const pages = ["index.html", "new.html", "edit.html"];
const jsFiles = [
  "business-directory-owner.js",
  "business-directory-common.js",
  "business-directory-plan.js",
  "business-directory-categories.js",
  "business-directory-local-store.js",
];

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

console.log("=== Business Directory Phase 3 — Owner UI ===\n");

for (const p of pages) {
  const rel = `${BD}/${p}`;
  if (fs.existsSync(path.join(root, rel))) ok(`${rel} exists`);
  else bad(`${rel} exists`);
}

for (const j of jsFiles) {
  const rel = `${BD}/${j}`;
  if (fs.existsSync(path.join(root, rel))) ok(`${rel} exists`);
  else bad(`${rel} exists`);
}

if (fs.existsSync(path.join(root, `${BD}/business-directory.css`))) ok("business-directory.css exists");
else bad("business-directory.css exists");

const indexHtml = read(`${BD}/index.html`);
const newHtml = read(`${BD}/new.html`);
const editHtml = read(`${BD}/edit.html`);
const ownerJs = read(`${BD}/business-directory-owner.js`);
const planJs = read(`${BD}/business-directory-plan.js`);
const memberAuth = read("member-auth.js");

mustInclude(indexHtml, "data-bd-page=\"dashboard\"", "dashboard page hook");
mustInclude(indexHtml, "data-bd-create-btn", "dashboard create button");
mustInclude(indexHtml, "data-bd-listings", "dashboard listings host");
mustInclude(indexHtml, "business-directory-repository.js", "dashboard loads repository");

mustInclude(newHtml, "data-bd-new-form", "new form");
mustInclude(newHtml, "shop_retail", "listing type shop");
mustInclude(newHtml, "business_service", "listing type business");
mustInclude(newHtml, "data-bd-action=\"create_draft_listing\"", "create draft action hook");
mustInclude(newHtml, "short_description", "minimal short description field");
mustInclude(newHtml, 'name="photo"', "single photo field");
mustInclude(newHtml, "shop_sales_genre", "shop-only field");
mustInclude(newHtml, "service_summary", "service-only field");
mustInclude(newHtml, "data-bd-type-field", "type-specific field toggles");

mustInclude(editHtml, "data-bd-edit-form", "edit form");
mustInclude(editHtml, "data-bd-tab=\"preview\"", "preview tab");
mustInclude(editHtml, "data-bd-submit-review", "submit review button");
mustInclude(editHtml, "data-bd-action=\"submit_listing_for_review\"", "submit action hook");
mustInclude(editHtml, "data-bd-review-pending", "review pending banner");
mustInclude(editHtml, "data-bd-reject-reason", "reject reason host");
mustInclude(editHtml, "data-bd-locked-tab=\"TLV\"", "TLV locked tab");
mustInclude(editHtml, "data-bd-locked-tab=\"SNS\"", "SNS locked tab");
mustInclude(editHtml, "data-bd-locked-tab=\"実績\"", "achievements locked tab");

mustInclude(ownerJs, "getOwnerListings", "owner JS uses getOwnerListings");
mustInclude(ownerJs, "createDraftListing", "owner JS uses createDraftListing");
mustInclude(ownerJs, "updateDraftListing", "owner JS uses updateDraftListing");
mustInclude(ownerJs, "submitListingForReview", "owner JS uses submitListingForReview");
mustInclude(ownerJs, "getOwnerListingDetail", "owner JS uses getOwnerListingDetail");
mustInclude(ownerJs, "review_requested", "edit lock for review_requested");
mustInclude(ownerJs, "isEditLocked", "edit lock helper");

mustInclude(planJs, "maxPhotos: 1", "free photo limit");
mustInclude(ownerJs, "Coming soon", "plan change coming soon");

mustInclude(memberAuth, "business-directory-dashboard", "member auth guard dashboard");
mustInclude(memberAuth, "business-directory-new", "member auth guard new");
mustInclude(memberAuth, "business-directory-edit", "member auth guard edit");

// Marketplace / Platform non-interference
// Marketplace pages — owner/admin wiring forbidden; public list entry (Phase 5) allowed
const marketplaceFiles = ["shop-store.html", "business.html", "post.html", "listing-management.html"];
for (const f of marketplaceFiles) {
  const full = path.join(root, f);
  if (!fs.existsSync(full)) continue;
  const src = read(f);
  if (f === "shop-store.html" || f === "business.html") {
    const badOwner = ["business-directory/index", "business-directory/new", "business-directory/edit", "business-directory/admin"].some((p) => src.includes(p));
    if (!badOwner) ok(`${f} no owner/admin bd wiring`);
    else bad(`${f} owner/admin bd wiring`);
    continue;
  }
  if (!src.includes("business-directory")) ok(`no bd wiring in ${f}`);
  else bad(`${f} modified with business-directory reference`);
}

console.log("\n--- browser smoke (bdMock=1) ---\n");

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  return "application/octet-stream";
}

function startTempServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(String(req.url || "/").split("?")[0]);
        const rel = urlPath === "/" ? "/business-directory/index.html" : urlPath;
        const filePath = path.join(root, rel.replace(/^\//, "").replace(/\//g, path.sep));
        if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.statusCode = 404;
          res.end("not found");
          return;
        }
        res.setHeader("Content-Type", contentType(filePath));
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

async function browserSmoke() {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.log("SKIP: playwright not installed");
    return;
  }

  const port = 9877;
  let server;
  try {
    server = await startTempServer(port);
  } catch (e) {
    bad("temp static server", String(e.message || e));
    return;
  }

  const base = `http://127.0.0.1:${port}/business-directory`;
  const q = "?bdMock=1&devSkipAuth=1";
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    bad("browser launch", String(e.message || e));
    server.close();
    return;
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${base}/index.html${q}`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector("[data-bd-create-btn]", { timeout: 8000 });
    ok("browser: dashboard visible");

    await page.goto(`${base}/new.html${q}`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector("[data-bd-new-form]", { timeout: 8000 });
    ok("browser: new form visible");

    await page.locator('input[value="business_service"]').click();
    const shopHidden = await page.locator('[data-bd-type-field="shop_retail"]').isHidden();
    const bizVisible = await page.locator('[data-bd-type-field="business_service"]').isVisible();
    if (shopHidden && bizVisible) ok("browser: type toggle shows service fields");
    else bad("browser: type toggle");

    await page.evaluate(() => {
      localStorage.setItem(
        "bd_mock_listings_v1",
        JSON.stringify([
          {
            id: "mock-1",
            display_name: "テスト掲載",
            listing_type: "shop_retail",
            status: "review_requested",
            plan_code: "free",
            service_areas: ["東京都"],
            updated_at: new Date().toISOString(),
          },
        ]),
      );
    });
    await page.goto(`${base}/edit.html?id=mock-1&bdMock=1&devSkipAuth=1`, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await page.waitForSelector("[data-bd-review-pending]", { timeout: 8000 });
    const pendingVisible = await page.locator("[data-bd-review-pending]").isVisible();
    if (pendingVisible) ok("browser: review_requested lock banner");
    else bad("browser: review_requested lock banner");

    await page.locator('[data-bd-tab="publish"]').click();
    const submitDisabled = await page.locator("[data-bd-submit-review]").isDisabled().catch(() => true);
    if (submitDisabled) ok("browser: submit disabled while review_requested");
    else bad("browser: submit should be disabled");

    await page.locator('[data-bd-tab="tlv"]').click();
    const lockedText = await page.locator('[data-bd-tab-panel="tlv"]').innerText();
    if (lockedText.includes("MVP 対象外")) ok("browser: TLV locked tab");
    else bad("browser: TLV locked tab");
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
