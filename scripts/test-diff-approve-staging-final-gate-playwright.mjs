#!/usr/bin/env node
/**
 * Playwright smoke — Final Apply Gate / Simulation UI (no real Apply)
 *   node scripts/test-diff-approve-staging-final-gate-playwright.mjs --base http://127.0.0.1:8788
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE =
  (baseIdx >= 0 && args[baseIdx + 1]) ||
  process.env.DIFF_APPROVE_BASE ||
  "http://127.0.0.1:8788";

let pass = 0;
let fail = 0;
function ok(l) {
  pass += 1;
  console.log(`  ✓ ${l}`);
}
function bad(l, d) {
  fail += 1;
  console.log(`  ✗ ${l}${d ? ` — ${d}` : ""}`);
}

async function checkViewport(page, width, label) {
  await page.setViewportSize({ width, height: 900 });
  const res = await page.goto(`${BASE}/admin-diff-approve.html`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  if (res && res.status() === 200) ok(`${label} page HTTP`);
  else bad(`${label} page HTTP`, String(res?.status()));

  const badges = await page.locator(".dda-badge").allTextContents();
  const joined = badges.join(" ");
  if (/STAGING/.test(joined) && /SIMULATION ONLY|DRY RUN/.test(joined))
    ok(`${label} badges`);
  else bad(`${label} badges`, joined);

  const applyBtns = await page
    .locator("button")
    .evaluateAll((nodes) =>
      nodes
        .map((n) => (n.textContent || "").trim())
        .filter((t) => t === "Apply" || t === "Execute" || t === "Provider Execute")
    );
  if (applyBtns.length === 0) ok(`${label} no Apply/Execute button`);
  else bad(`${label} Apply buttons`, applyBtns.join(","));

  const forbiddenNet = [];
  page.on("request", (req) => {
    const u = req.url();
    if (/\/apply$|\/execute$|openai\.com|api\.anthropic|generativelanguage/.test(u)) {
      forbiddenNet.push(u);
    }
  });
  await page.waitForTimeout(500);
  if (forbiddenNet.length === 0) ok(`${label} no Apply/Provider network`);
  else bad(`${label} network`, forbiddenNet[0]);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
console.log(`Base: ${BASE}`);
try {
  await checkViewport(page, 1280, "desktop");
  await checkViewport(page, 390, "mobile");
} finally {
  await browser.close();
}

const summary = {
  pass,
  fail,
  verdict: fail === 0 ? "PASS_STAGING_FINAL_GATE_PLAYWRIGHT" : "FAIL",
};
writeFileSync(
  path.join(
    ROOT,
    "reports/diff-approve-staging-final-gate-playwright-summary.json"
  ),
  JSON.stringify(summary, null, 2)
);
console.log(`\npass=${pass} fail=${fail}`);
if (fail) process.exit(1);
console.log(summary.verdict);
