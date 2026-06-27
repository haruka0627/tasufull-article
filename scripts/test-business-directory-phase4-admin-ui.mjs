#!/usr/bin/env node
/**
 * Business Directory Phase 4 — Admin / Ops UI tests
 *   node scripts/test-business-directory-phase4-admin-ui.mjs
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ADMIN = "business-directory/admin";

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

console.log("=== Business Directory Phase 4 — Admin UI ===\n");

mustInclude(read(`${ADMIN}/reviews.html`), "data-bd-admin-queue", "reviews queue host");
mustInclude(read(`${ADMIN}/reviews.html`), "business-directory-repository.js", "reviews loads repository");
mustInclude(read(`${ADMIN}/listing.html`), "data-bd-admin-detail-readonly", "readonly detail host");
mustInclude(read(`${ADMIN}/listing.html`), "data-bd-admin-audit-logs", "audit log host");
mustInclude(read(`${ADMIN}/listing.html`), "data-bd-admin-approve", "approve button");
mustInclude(read(`${ADMIN}/listing.html`), "data-bd-admin-reject", "reject button");
mustInclude(read(`${ADMIN}/listing.html`), "data-bd-admin-suspend", "suspend button");
mustInclude(read(`${ADMIN}/listing.html`), "data-bd-admin-restore", "restore button");
mustInclude(read(`${ADMIN}/reviews.html`), "入力代行", "no proxy input notice");

const adminJs = read(`${ADMIN}/business-directory-admin.js`);
mustInclude(adminJs, "getReviewQueue", "admin uses getReviewQueue");
mustInclude(adminJs, "getOpsListingDetail", "admin uses getOpsListingDetail");
mustInclude(adminJs, "approveListing", "admin uses approveListing");
mustInclude(adminJs, "rejectListing", "admin uses rejectListing");
mustInclude(adminJs, "差戻し理由は必須", "reject reason required client");
mustInclude(adminJs, "停止理由は必須", "suspend reason required client");

const listingHtml = read(`${ADMIN}/listing.html`);
const editableInputs = (listingHtml.match(/<(input|textarea|select)\b/gi) || []).length;
const reasonOnly = (listingHtml.match(/data-bd-admin-reason-only/g) || []).length;
if (editableInputs === reasonOnly) ok("listing inputs are reason-only");
else bad("listing inputs are reason-only", `inputs=${editableInputs} reason=${reasonOnly}`);

if (!listingHtml.includes('type="text"') && !listingHtml.includes("<select")) {
  ok("no listing edit text inputs");
} else bad("no listing edit text inputs");

const repoJs = read("business-directory-repository.js");
mustInclude(repoJs, "getOpsListingDetail", "repository getOpsListingDetail");
mustInclude(repoJs, "getListingAuditLogs", "repository getListingAuditLogs");

const serviceTs = read("supabase/functions/_shared/business-directory.ts");
mustInclude(serviceTs, "getOpsListingDetail", "service getOpsListingDetail");
mustInclude(serviceTs, "reject_reason_note required", "service reject note required");
mustInclude(serviceTs, "reason required", "service suspend reason required");

const ownerIndex = read("business-directory/index.html");
if (!ownerIndex.includes("bd-admin")) ok("owner dashboard unchanged by admin");
else bad("owner dashboard admin leak");

for (const f of ["shop-store.html", "business.html", "post.html", "listing-management.html", "admin-operations-dashboard.html"]) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  const src = read(f);
  if (!src.includes("business-directory/admin")) ok(`no admin wiring in ${f}`);
  else bad(`${f} has admin bd reference`);
}

mustInclude(read("member-auth.js"), "business-directory-admin-reviews", "auth guard reviews");

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

console.log("\n--- browser smoke (bdAdminMock=1) ---\n");

async function browserSmoke() {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.log("SKIP: playwright not installed");
    return;
  }
  const port = 9878;
  const server = await startTempServer(port);
  const base = `http://127.0.0.1:${port}/business-directory/admin`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(`${base}/reviews.html?bdAdminMock=1&devSkipAuth=1`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-bd-admin-queue] table", { timeout: 8000 });
    ok("browser: review queue table");

    await page.goto(`${base}/listing.html?id=admin-mock-1&bdAdminMock=1&devSkipAuth=1`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-bd-admin-detail-readonly]", { timeout: 8000 });
    ok("browser: readonly detail");

    await page.locator("[data-bd-admin-reject]").click();
    const toast = await page.locator("[data-bd-admin-toast]").innerText().catch(() => "");
    if (toast.includes("必須")) ok("browser: reject requires reason");
    else bad("browser: reject requires reason", toast);

    await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("bd_admin_mock_v1") || "{}");
      if (store.listings?.[0]) store.listings[0].status = "published";
      localStorage.setItem("bd_admin_mock_v1", JSON.stringify(store));
    });
    await page.reload();
    const suspendVisible = await page.locator('[data-bd-admin-actions="published"]').isVisible();
    if (suspendVisible) ok("browser: published actions visible");
    else bad("browser: published actions");

    await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("bd_admin_mock_v1") || "{}");
      if (store.listings?.[0]) store.listings[0].status = "suspended";
      localStorage.setItem("bd_admin_mock_v1", JSON.stringify(store));
    });
    await page.reload();
    const restoreVisible = await page.locator('[data-bd-admin-actions="restore"]').isVisible();
    if (restoreVisible) ok("browser: restore actions for suspended");

    await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("bd_admin_mock_v1") || "{}");
      if (store.listings?.[0]) store.listings[0].status = "archived";
      localStorage.setItem("bd_admin_mock_v1", JSON.stringify(store));
    });
    await page.reload();
    const archivedVisible = await page.locator('[data-bd-admin-actions="archived"]').isVisible();
    const approveHidden = await page.locator('[data-bd-admin-actions="review_requested"]').isHidden();
    if (archivedVisible && approveHidden) ok("browser: archived no ops actions");
    else bad("browser: archived state");
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
