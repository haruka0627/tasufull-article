#!/usr/bin/env node
/** Verify Q&A dev mode (?qa_dev=1) on 8788 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = "http://127.0.0.1:8788";

await withPlaywrightBrowser(async (browser) => {
  let failed = false;

  async function checkPage(url, label, expectAdmin) {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
    const data = await page.evaluate(() => ({
      adminEnabled: window.PlatformQaAdmin?.isEnabled?.() === true,
      isDevHost: window.PlatformQaAdminConfig?.isDevHost?.() === true,
      qaDev: window.PlatformQaAdminConfig?.getQaDevQuery?.(),
      banner: Boolean(document.querySelector("[data-qa-admin-banner]")),
      deleteBtns: document.querySelectorAll("[data-qa-admin-delete]").length,
      exportBtns: document.querySelectorAll("[data-qa-admin-export-lines]").length,
      total: window.PlatformQaData?.getStats?.()?.articleCount,
      deletedApplied: window.PlatformQaData?.isCurationActive?.() === true,
    }));

    console.log(`=== ${label} ===`);
    console.log(JSON.stringify(data, null, 2));
    if (consoleErrors.length) console.log("console errors:", consoleErrors);

    const ok =
      data.isDevHost === true &&
      data.adminEnabled === expectAdmin &&
      (expectAdmin ? data.banner && data.deleteBtns > 0 && data.exportBtns === 1 : !data.banner && data.deleteBtns === 0) &&
      (expectAdmin ? data.deletedApplied : !data.deletedApplied) &&
      consoleErrors.length === 0;

    if (!ok) {
      console.error(`FAIL ${label}`);
      failed = true;
    } else {
      console.log(`PASS ${label}`);
    }
    await page.close();
    return data;
  }

  await checkPage(`${BASE}/help/`, "normal /help/", false);
  await checkPage(`${BASE}/help/?qa_dev=0`, "/help/?qa_dev=0", false);
  await checkPage(`${BASE}/help/?qa_dev=1`, "/help/?qa_dev=1", true);

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(`${BASE}/help/?qa_dev=1`, { waitUntil: "networkidle", timeout: 120000 });

  await page.evaluate(() => {
    localStorage.setItem("tasu_qa_deleted_slugs", JSON.stringify(["signup", "pricing"]));
  });
  await page.reload({ waitUntil: "networkidle" });

  const withStorage = await page.evaluate(() => ({
    total: window.PlatformQaData?.getStats?.()?.articleCount,
    deletedCount: window.PlatformQaData?.getDeletedCount?.(),
    hasSignup: Boolean(window.PlatformQaData?.getBySlug?.("signup")),
  }));
  console.log("=== with localStorage deletions + qa_dev=1 ===");
  console.log(JSON.stringify(withStorage, null, 2));
  if (withStorage.deletedCount !== 2 || withStorage.hasSignup) {
    console.error("FAIL localStorage deletions not applied in qa_dev=1");
    failed = true;
  } else {
    console.log("PASS localStorage deletions applied in qa_dev=1");
  }

  await page.goto(`${BASE}/help/`, { waitUntil: "networkidle" });
  const prodModeStorage = await page.evaluate(() => ({
    total: window.PlatformQaData?.getStats?.()?.articleCount,
    hasSignup: Boolean(window.PlatformQaData?.getBySlug?.("signup")),
    curation: window.PlatformQaData?.isCurationActive?.(),
  }));
  console.log("=== normal mode ignores localStorage deletions ===");
  console.log(JSON.stringify(prodModeStorage, null, 2));
  if (!prodModeStorage.curation && prodModeStorage.hasSignup && prodModeStorage.total >= 4390) {
    console.log("PASS normal mode ignores localStorage deletions");
  } else {
    console.error("FAIL normal mode should ignore localStorage deletions");
    failed = true;
  }

  await page.goto(`${BASE}/help/?qa_dev=1`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    if (window.PlatformQaData?.deleteArticle) {
      const articles = window.PlatformQaData.searchArticles("", "all");
      const target = articles.find((a) => a.slug === "apply") || articles[0];
      if (target?.slug) window.PlatformQaData.deleteArticle(target.slug);
    }
  });
  try {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  } catch {
    /* ignore */
  }
  await page.click("[data-qa-admin-export-lines]");
  await page.waitForTimeout(300);
  const copied = await page.evaluate(async () => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return "";
    }
  });
  console.log("=== export copy (lines) ===");
  console.log(copied.slice(0, 200));
  const exportOk =
    copied.includes("apply") &&
    copied.includes("signup") &&
    copied.includes("pricing") &&
    copied.includes("tasu_qa_deleted_slugs");
  if (!exportOk) {
    console.error("FAIL export copy");
    failed = true;
  } else {
    console.log("PASS export copy");
  }

  if (consoleErrors.length) {
    console.error("FAIL console errors on export flow:", consoleErrors);
    failed = true;
  }

  await page.close();
  await closeAllBrowsers();

  if (failed) process.exit(1);
  console.log("\nAll qa dev mode checks PASS");
});
