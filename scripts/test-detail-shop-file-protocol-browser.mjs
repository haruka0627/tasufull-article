#!/usr/bin/env node
/**
 * detail-shop.html — localhost + file:// 直開き E2E
 *
 *   node scripts/test-detail-shop-file-protocol-browser.mjs
 *   BASE_URL=http://localhost:5180 node scripts/test-detail-shop-file-protocol-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const DEMO_ID = "shop-store-demo-other-001";
const DEMO_TITLE = "地域セレクト商品の販売相談";

const FILE_SHOP_URL =
  pathToFileURL(path.join(PROJECT_ROOT, "detail-shop.html")).href +
  `?id=${encodeURIComponent(DEMO_ID)}`;

/** @type {{ step: string; ok: boolean; detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function isIgnorableConsoleError(text) {
  const t = String(text || "");
  return (
    t.includes("Failed to load resource") ||
    t.includes("net::ERR_") ||
    t.includes("favicon") ||
    t.includes("404") ||
    t.includes("supabase") ||
    t.includes("Supabase") ||
    t.includes("Unsafe attempt to load URL") ||
    t.includes("Not allowed to load local resource") ||
    t.includes("[TasuSupabase]")
  );
}

function isFatalConsoleError(text) {
  const t = String(text || "");
  if (isIgnorableConsoleError(t)) return false;
  if (/global is not defined/i.test(t)) return true;
  return t.includes("ReferenceError") || t.includes("TypeError");
}

async function waitShopLoaded(page) {
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" &&
      (document.querySelector("[data-biz-detail-title]")?.textContent || "").includes("地域セレクト"),
    { timeout: 20000 }
  );
}

async function verifyDemoVisible(page, label) {
  const data = await page.evaluate(() => ({
    protocol: location.protocol,
    title: document.querySelector("[data-biz-detail-title]")?.textContent?.trim() || "",
    rootHidden: document.querySelector("[data-biz-detail-root]")?.hidden,
    listingLoaded: document.body.dataset.listingLoaded || "",
    listingId: document.body.dataset.listingId || "",
  }));

  if (data.title.includes(DEMO_TITLE)) pass(`${label}: デモタイトル`);
  else fail(`${label}: デモタイトル`, data.title);

  if (!data.rootHidden) pass(`${label}: 詳細ルート表示`);
  else fail(`${label}: 詳細ルート表示`, "hidden");

  if (data.listingLoaded === "true") pass(`${label}: listingLoaded`);
  else fail(`${label}: listingLoaded`, data.listingLoaded);

  if (data.listingId === DEMO_ID || data.title.includes("地域セレクト")) {
    pass(`${label}: 掲載ID`, data.listingId || "(title ok)");
  } else {
    fail(`${label}: 掲載ID`, data.listingId);
  }

  const box = await page.evaluate(() =>
    document.querySelector("[data-biz-detail-root]")?.getBoundingClientRect()
  );
  if (box && box.width > 280) pass(`${label}: レイアウト`, `${Math.round(box.width)}px`);
  else fail(`${label}: レイアウト`, `${box?.width ?? 0}px`);
}

async function runLocalhostCases(page, consoleErrors) {
  console.log("\n=== localhost ===\n");
  const urls = [
    { label: "id なし", url: `${BASE}/detail-shop.html` },
    { label: "demo=other", url: `${BASE}/detail-shop.html?demo=other` },
    { label: "明示 id", url: `${BASE}/detail-shop.html?id=${DEMO_ID}` },
  ];

  for (const { label, url } of urls) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await waitShopLoaded(page);
    await verifyDemoVisible(page, `localhost ${label}`);
  }
}

async function runFileProtocolCase(page, consoleErrors) {
  console.log("\n=== file:// 直開き相当 ===\n");
  console.log(`  URL: ${FILE_SHOP_URL}\n`);

  await page.goto(FILE_SHOP_URL, { waitUntil: "domcontentloaded" });
  await waitShopLoaded(page);
  await verifyDemoVisible(page, "file://");

  const hasGlobalError = consoleErrors.some((t) => /global is not defined/i.test(t));
  if (!hasGlobalError) pass("file://: global is not defined なし");
  else fail("file://: global is not defined なし", consoleErrors.find((t) => /global/i.test(t)));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitShopLoaded(page);
  await verifyDemoVisible(page, "file:// スマホ");
}

async function main() {
  console.log(`\ndetail-shop file:// 対応 E2E\n`);
  const consoleErrors = [];
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isIgnorableConsoleError(text)) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (err) => {
    const text = String(err?.message || err);
    if (!isFatalConsoleError(text) && isIgnorableConsoleError(text)) return;
    consoleErrors.push(text);
  });

  await runLocalhostCases(page, consoleErrors);
  consoleErrors.length = 0;
  await runFileProtocolCase(page, consoleErrors);

  const fatal = consoleErrors.filter(isFatalConsoleError);
  if (fatal.length === 0) {
    pass("console 致命的エラーなし");
  } else {
    fail("console 致命的エラーなし", fatal.slice(0, 3).join(" | "));
  }

    });
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n--- 結果: ${ok}/${results.length} OK ---\n`);
  await closeAllBrowsers();
  process.exit(ok === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
