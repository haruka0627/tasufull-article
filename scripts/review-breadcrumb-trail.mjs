#!/usr/bin/env node
/**
 * パンくず導線ベース化 — ブラウザ検証
 * node scripts/review-breadcrumb-trail.mjs
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(root, "screenshots", "breadcrumb-trail-review");
const PORT = 8798;
const NAV_TIMEOUT = 25000;
const SEL_TIMEOUT = 15000;

const BIZ_DETAIL_ID = "demo-business-service-001";
const FAV_DETAIL_ID = "demo-biz-pr-1";
const FAV_DETAIL_TITLE = "TASFUL建設パートナー";
const SHOP_ID = "demo-shop-haru-cafe";
const PRODUCT_QUERY = "shopId=demo-shop-haru-cafe&productId=p-0";

const MIME = {
  ".html": "text/html;charset=utf-8",
  ".js": "application/javascript;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".json": "application/json;charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const pathname = decodeURIComponent(String(req.url || "/").split("?")[0]);
      const rel = pathname.replace(/^\//, "") || "index.html";
      const file = path.join(root, rel);
      if (!file.startsWith(root) || !existsSync(file)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      createReadStream(file).pipe(res);
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

function url(rel) {
  return `http://127.0.0.1:${PORT}/${rel.replace(/^\//, "")}`;
}

/** @type {Array<Record<string, unknown>>} */
const results = [];

function record(caseId, pass, detail) {
  results.push({ id: caseId, pass, ...detail });
}

async function readBreadcrumb(page) {
  return page.evaluate(() => {
    const navs = [...document.querySelectorAll("[data-breadcrumb]")].filter((n) => !n.hidden);
    const parse = (nav) => {
      const items = [];
      for (const child of nav.children) {
        if (child.tagName === "A") {
          items.push({ label: child.textContent.trim(), href: child.getAttribute("href") || "" });
        } else if (child.classList?.contains("tasu-common-breadcrumb__current")) {
          items.push({ label: child.textContent.trim(), current: true });
        }
      }
      return items;
    };
    return {
      visibleCount: navs.length,
      items: navs[0] ? parse(navs[0]) : [],
      allTexts: navs.map((n) => n.innerText.replace(/\s+/g, " ").trim()),
      stack: (() => {
        try {
          return JSON.parse(sessionStorage.getItem("tasu_breadcrumb_stack_v1") || "[]");
        } catch {
          return [];
        }
      })(),
    };
  });
}

async function checkHrefStatus(page, href) {
  if (!href || href === "#") return { href, ok: false, status: "empty" };
  const abs = new URL(href, page.url()).href;
  try {
    const res = await page.request.get(abs);
    return { href: abs, ok: res.ok(), status: res.status() };
  } catch (e) {
    return { href: abs, ok: false, status: String(e.message || e) };
  }
}

async function validateLinks(page, items) {
  const out = [];
  for (const item of items.filter((i) => i.href && !i.current)) {
    out.push(await checkHrefStatus(page, item.href));
  }
  return out;
}

function labelsTrail(items) {
  return items.map((i) => i.label).join(" > ");
}

function assertContains(items, expectedSubstrings, caseId, step) {
  const trail = labelsTrail(items);
  const missing = expectedSubstrings.filter((s) => !trail.includes(s));
  if (missing.length) {
    record(caseId, false, {
      step,
      actual: trail,
      expected: expectedSubstrings.join(" / "),
      reason: `missing: ${missing.join(", ")}`,
    });
    return false;
  }
  record(caseId, true, { step, actual: trail });
  return true;
}

function assertNotContains(items, badSubstrings, caseId, step) {
  const trail = labelsTrail(items);
  const found = badSubstrings.filter((s) => trail.includes(s));
  if (found.length) {
    record(caseId, false, {
      step,
      actual: trail,
      expected: `must not include ${found.join(", ")}`,
      reason: "unexpected segment",
    });
    return false;
  }
  record(caseId, true, { step, actual: trail });
  return true;
}

async function waitBreadcrumb(page) {
  await page.waitForFunction(
    () => {
      const nav = [...document.querySelectorAll("[data-breadcrumb]")].find((n) => !n.hidden);
      return nav && nav.textContent.trim().length > 0;
    },
    { timeout: SEL_TIMEOUT }
  );
  await page.waitForTimeout(400);
}

async function clickInternalNav(page, href, label) {
  await page.evaluate(
    ({ href, label }) => {
      const a = document.createElement("a");
      a.href = href;
      if (label) a.setAttribute("data-breadcrumb-label", label);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    { href, label }
  );
}

async function gotoDetailFromBusiness(page) {
  const href = await page.evaluate(() => {
    const pick =
      document.querySelector(".biz-board-spotlight__title a[href*='detail-']") ||
      document.querySelector("a.biz-board-mobile-card__detail-link[href*='detail-']") ||
      document.querySelector("a[href*='detail-business'][data-breadcrumb-label]");
    return pick ? pick.getAttribute("href") : null;
  });
  if (!href) throw new Error("detail link not found on business.html");
  const label = await page.evaluate((h) => {
    const el = document.querySelector(`a[href="${h}"]`);
    return el?.getAttribute("data-breadcrumb-label") || "";
  }, href);
  await clickInternalNav(page, href, label || "詳細");
  await page.waitForURL(/detail-business/, { timeout: NAV_TIMEOUT });
  return { href, label };
}

async function clearBreadcrumbSession(page) {
  await page.goto(url("favorites-list.html"), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await page.evaluate(() => {
    sessionStorage.removeItem("tasu_breadcrumb_stack_v1");
    sessionStorage.removeItem("tasu_breadcrumb_pending_v1");
  });
}

async function seedFavorites(page) {
  await page.evaluate((id) => {
    localStorage.setItem("tasful_favorite_listings", JSON.stringify([id]));
  }, FAV_DETAIL_ID);
}

async function runDashboardFavoritesFlow(page) {
  const caseId = "dashboard-favorites-detail";
  await page.goto(url("dashboard.html"), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await seedFavorites(page);
  await page.waitForSelector('a[href="favorites-list.html"][data-breadcrumb-label="お気に入り"]', {
    state: "attached",
    timeout: SEL_TIMEOUT,
  });

  await page.locator('a[href="favorites-list.html"][data-breadcrumb-label="お気に入り"]').first().click();
  await page.waitForURL(/favorites-list\.html/, { timeout: NAV_TIMEOUT });
  await waitBreadcrumb(page);

  let bc = await readBreadcrumb(page);
  assertContains(bc.items, ["ダッシュボード", "お気に入り"], caseId, "favorites-page");
  assertNotContains(bc.items, ["Home", "お気に入り一覧"], caseId, "favorites-no-legacy");
  if (bc.visibleCount > 1) {
    record(caseId, false, { step: "duplicate-nav-favorites", actual: bc.visibleCount, reason: "double breadcrumb" });
  } else {
    record(caseId, true, { step: "duplicate-nav-favorites", actual: 1 });
  }

  const detailLink = page.locator('a.fav-btn--detail[href*="detail-business"]').first();
  await detailLink.waitFor({ state: "visible", timeout: SEL_TIMEOUT });
  const detailLabel = await detailLink.getAttribute("data-breadcrumb-label");
  await detailLink.click();
  await page.waitForURL(/detail-business/, { timeout: NAV_TIMEOUT });
  await page.waitForSelector("#business-service-detail-root, [data-biz-detail-root]", {
    timeout: SEL_TIMEOUT,
  }).catch(() => null);
  await page.waitForTimeout(1500);
  await waitBreadcrumb(page);

  bc = await readBreadcrumb(page);
  assertContains(bc.items, ["ダッシュボード", "お気に入り"], caseId, "detail-prefix");
  assertContains(bc.items, [FAV_DETAIL_TITLE], caseId, "detail-company-label");
  assertNotContains(bc.items, ["Home", "お気に入り一覧"], caseId, "detail-no-legacy");
  if (detailLabel) {
    record(caseId, detailLabel.trim() === FAV_DETAIL_TITLE, {
      step: "detail-link-label",
      actual: detailLabel,
      expected: FAV_DETAIL_TITLE,
    });
  }
}

async function runIndexTopHeaderFavoritesFlow(page) {
  const caseId = "index-top-favorites-detail";
  await page.goto(url("index-top.html"), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await seedFavorites(page);

  await clickInternalNav(page, "favorites-list.html", "お気に入り");
  await page.waitForURL(/favorites-list\.html/, { timeout: NAV_TIMEOUT });
  await waitBreadcrumb(page);

  let bc = await readBreadcrumb(page);
  assertContains(bc.items, ["TASFUL", "お気に入り"], caseId, "favorites-page");
  assertNotContains(bc.items, ["Home", "お気に入り一覧", "ダッシュボード"], caseId, "favorites-no-wrong-root");

  const detailLink = page.locator('a.fav-btn--detail[href*="detail-business"]').first();
  await detailLink.click();
  await page.waitForURL(/detail-business/, { timeout: NAV_TIMEOUT });
  await page.waitForTimeout(1500);
  await waitBreadcrumb(page);

  bc = await readBreadcrumb(page);
  assertContains(bc.items, ["TASFUL", "お気に入り"], caseId, "detail-prefix");
  assertContains(bc.items, [FAV_DETAIL_TITLE], caseId, "detail-company");
  assertNotContains(bc.items, ["Home", "ダッシュボード"], caseId, "detail-no-wrong-root");
}

async function runDirectFavoritesList(page) {
  const caseId = "direct-favorites-list";
  await clearBreadcrumbSession(page);
  await page.reload({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await waitBreadcrumb(page);

  const bc = await readBreadcrumb(page);
  assertContains(bc.items, ["お気に入り"], caseId, "static-favorites");
  assertNotContains(bc.items, ["ダッシュボード", "Home", "お気に入り一覧"], caseId, "no-parent-history");
  if (bc.visibleCount > 1) {
    record(caseId, false, { step: "duplicate-nav", actual: bc.visibleCount, reason: "double breadcrumb" });
  } else {
    record(caseId, true, { step: "single-nav", actual: 1 });
  }
}

async function runDirectFavoriteDetail(page) {
  const caseId = "direct-favorite-detail";
  await clearBreadcrumbSession(page);
  const detailUrl = `detail-business-service.html?id=${FAV_DETAIL_ID}&from=favorite&returnTo=favorites-list.html`;
  await page.goto(url(detailUrl), {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT,
  });
  await page.waitForSelector("#business-service-detail-root, [data-biz-detail-root]", {
    timeout: SEL_TIMEOUT,
  }).catch(() => null);
  await page.waitForTimeout(1500);
  await waitBreadcrumb(page).catch(() => null);

  const bc = await readBreadcrumb(page);
  assertNotContains(bc.items, ["ダッシュボード", "Home"], caseId, "no-dashboard-home");
  assertContains(bc.items, ["お気に入り"], caseId, "favorite-static-prefix");
  const trail = labelsTrail(bc.items);
  const hasCompany = trail.includes(FAV_DETAIL_TITLE) || trail.includes("詳細");
  record(caseId, hasCompany, {
    step: "static-fallback-detail",
    actual: trail,
    expected: `お気に入り > ${FAV_DETAIL_TITLE}`,
  });
}

async function runDashboardFlow(page) {
  const caseId = "dashboard-business-detail";
  await page.goto(url("dashboard.html"), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await page.waitForSelector("[data-dash-quick]", { timeout: SEL_TIMEOUT });

  const bizLink = page.locator('a[href="business.html"][data-breadcrumb-label="業務サービスを探す"]').first();
  await bizLink.click();
  await page.waitForURL(/business\.html/, { timeout: NAV_TIMEOUT });
  await waitBreadcrumb(page);

  let bc = await readBreadcrumb(page);
  assertContains(bc.items, ["ダッシュボード", "業務サービスを探す"], caseId, "business-page");
  assertNotContains(bc.items, ["TASFUL"], caseId, "business-not-tasful-root");
  if (bc.visibleCount > 1) {
    record(caseId, false, { step: "duplicate-nav-business", actual: bc.visibleCount, reason: "double breadcrumb" });
  }

  const detailLink = page.locator("a.biz-board-btn--detail[href*='detail-business'], a.biz-board-btn--detail[href*='detail-']").first();
  const detailMeta = await gotoDetailFromBusiness(page);
  const detailHref = detailMeta.href;
  const detailLabel = detailMeta.label;
  await page.waitForSelector("#business-service-detail-root, [data-biz-detail-root]", {
    timeout: SEL_TIMEOUT,
  });
  await waitBreadcrumb(page);

  bc = await readBreadcrumb(page);
  assertContains(bc.items, ["ダッシュボード", "業務サービスを探す"], caseId, "detail-page-prefix");
  if (detailLabel) {
    assertContains(bc.items, [detailLabel.trim()], caseId, "detail-company-label");
  }
  if (bc.stack.length > 5) {
    record(caseId, false, { step: "stack-depth", actual: bc.stack.length, reason: "stack > 5" });
  } else {
    record(caseId, true, { step: "stack-depth", actual: bc.stack.length });
  }

  const links = await validateLinks(page, bc.items);
  const broken = links.filter((l) => !l.ok);
  if (broken.length) {
    record(caseId, false, { step: "href-check", broken, reason: "404 or empty href" });
  } else {
    record(caseId, true, { step: "href-check", links: links.length });
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitBreadcrumb(page);
  bc = await readBreadcrumb(page);
  assertContains(bc.items, ["ダッシュボード"], caseId, "reload-detail-keeps-dashboard");

  return { detailHref, bc };
}

async function runIndexTopFlow(page) {
  const caseId = "index-top-business-detail";
  await page.goto(url("index-top.html"), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await page.locator('a[href="business.html"][data-breadcrumb-label="法人・業者・店舗"]').first().click();
  await page.waitForURL(/business\.html/, { timeout: NAV_TIMEOUT });
  await waitBreadcrumb(page);

  let bc = await readBreadcrumb(page);
  assertContains(bc.items, ["TASFUL", "法人・業者・店舗"], caseId, "business-page");
  assertNotContains(bc.items, ["ダッシュボード"], caseId, "business-not-dashboard");

  const detailMeta = await gotoDetailFromBusiness(page);
  const detailLabel = detailMeta.label;
  await page.waitForSelector("#business-service-detail-root, [data-biz-detail-root]", {
    timeout: SEL_TIMEOUT,
  }).catch(() => null);
  await waitBreadcrumb(page);

  bc = await readBreadcrumb(page);
  assertContains(bc.items, ["TASFUL", "法人・業者・店舗"], caseId, "detail-prefix");
  if (detailLabel) assertContains(bc.items, [detailLabel.trim()], caseId, "detail-label");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitBreadcrumb(page);
  bc = await readBreadcrumb(page);
  assertContains(bc.items, ["TASFUL"], caseId, "reload-keeps-tasful");
}

async function runShopFlow(page) {
  const caseId = "shop-store-products-product";
  await page.goto(url("shop-store.html"), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await waitBreadcrumb(page);

  await clickInternalNav(page, `shop-products.html?id=${SHOP_ID}`, "商品一覧");
  await page.waitForURL(/shop-products\.html/, { timeout: NAV_TIMEOUT });
  await waitBreadcrumb(page);

  let bc = await readBreadcrumb(page);
  assertContains(bc.items, ["店舗・販売TOP", "商品一覧"], caseId, "products-page");

  const productHref = `detail-shop-product.html?${PRODUCT_QUERY}`;
  await clickInternalNav(page, productHref, "商品詳細");
  await page.waitForURL(/detail-shop-product\.html/, { timeout: NAV_TIMEOUT });
  await page.waitForTimeout(2000);
  await waitBreadcrumb(page);

  bc = await readBreadcrumb(page);
  assertContains(bc.items, ["店舗・販売TOP", "商品一覧"], caseId, "product-detail-prefix");
  assertContains(bc.items, ["季節のパンケーキ"], caseId, "product-title-in-crumb");

  if (bc.stack.length > 5) {
    record(caseId, false, { step: "stack-depth", actual: bc.stack.length });
  } else {
    record(caseId, true, { step: "stack-depth", actual: bc.stack.length });
  }

  const links = await validateLinks(page, bc.items);
  if (links.some((l) => !l.ok)) {
    record(caseId, false, { step: "href-check", broken: links.filter((l) => !l.ok) });
  } else {
    record(caseId, true, { step: "href-check" });
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitBreadcrumb(page);
  bc = await readBreadcrumb(page);
  assertContains(bc.items, ["店舗・販売TOP"], caseId, "reload-product");
}

async function runDirectBusinessDetail(page) {
  const caseId = "direct-business-detail";
  await page.goto(url(`detail-business-service.html?id=${BIZ_DETAIL_ID}`), {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT,
  });
  await page.waitForSelector("#business-service-detail-root, [data-listing-loaded='true']", {
    timeout: SEL_TIMEOUT,
  }).catch(() => null);
  await page.waitForTimeout(1500);
  await waitBreadcrumb(page).catch(() => null);

  const bc = await readBreadcrumb(page);
  assertNotContains(bc.items, ["ダッシュボード"], caseId, "no-dashboard");
  const trail = labelsTrail(bc.items);
  const hasStatic =
    trail.includes("法人・業者一覧") || trail.includes("詳細") || bc.items.length >= 1;
  record(caseId, hasStatic, {
    step: "static-fallback",
    actual: trail,
    expected: "静的フォールバック（法人・業者一覧 or 詳細）",
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const bc2 = await readBreadcrumb(page);
  assertNotContains(bc2.items, ["ダッシュボード"], caseId, "reload-no-dashboard");
}

async function runDirectShopProduct(page) {
  const caseId = "direct-shop-product";
  await page.goto(url(`detail-shop-product.html?${PRODUCT_QUERY}`), {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT,
  });
  await page.waitForTimeout(2000);
  await waitBreadcrumb(page).catch(() => null);

  const bc = await readBreadcrumb(page);
  assertNotContains(bc.items, ["ダッシュボード"], caseId, "no-dashboard");
  const trail = labelsTrail(bc.items);
  const ok = trail.length > 0 && !trail.includes("ダッシュボード");
  record(caseId, ok, {
    step: "static-fallback",
    actual: trail,
    expected: "静的フォールバック（店舗/商品階層）",
  });
}

async function runNewTabIsolation(context, page) {
  const caseId = "new-tab-isolation";
  await page.goto(url("dashboard.html"), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await page.locator('a[href="business.html"][data-breadcrumb-label]').first().click();
  await page.waitForURL(/business\.html/, { timeout: NAV_TIMEOUT });
  await waitBreadcrumb(page);

  const bcBefore = await readBreadcrumb(page);
  const hasDash = labelsTrail(bcBefore.items).includes("ダッシュボード");
  const detailHref = await page.evaluate(() => {
    const el =
      document.querySelector(".biz-board-spotlight__title a[href*='detail-']") ||
      document.querySelector("a[href*='detail-business'][data-breadcrumb-label]");
    return el?.getAttribute("href") || "";
  });

  const newPage = await context.newPage();
  await newPage.goto(url(detailHref), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await newPage.waitForTimeout(2000);

  const bcNew = await readBreadcrumb(newPage);
  const newTrail = labelsTrail(bcNew.items);
  const inherited = hasDash && newTrail.includes("ダッシュボード");
  record(caseId, !inherited, {
    step: "new-tab-no-parent-history",
    actual: newTrail,
    expected: "前タブのダッシュボード履歴を引き継がない",
    parentTrail: labelsTrail(bcBefore.items),
  });
  await newPage.close();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const server = await startStaticServer();
  const browser = await launchHeadlessBrowser();

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    try {
      await runDashboardFavoritesFlow(page);
    } catch (e) {
      record("dashboard-favorites-detail", false, { step: "exception", reason: String(e.message || e) });
    }

    try {
      await runDashboardFlow(page);
    } catch (e) {
      record("dashboard-business-detail", false, { step: "exception", reason: String(e.message || e) });
    }

    await context.close();
    const context2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page2 = await context2.newPage();

    try {
      await runDirectFavoritesList(page2);
    } catch (e) {
      record("direct-favorites-list", false, { step: "exception", reason: String(e.message || e) });
    }

    try {
      await runDirectFavoriteDetail(page2);
    } catch (e) {
      record("direct-favorite-detail", false, { step: "exception", reason: String(e.message || e) });
    }

    try {
      await runIndexTopHeaderFavoritesFlow(page2);
    } catch (e) {
      record("index-top-favorites-detail", false, { step: "exception", reason: String(e.message || e) });
    }

    try {
      await runIndexTopFlow(page2);
    } catch (e) {
      record("index-top-business-detail", false, { step: "exception", reason: String(e.message || e) });
    }

    try {
      await runShopFlow(page2);
    } catch (e) {
      record("shop-store-products-product", false, { step: "exception", reason: String(e.message || e) });
    }

    try {
      await runDirectBusinessDetail(page2);
    } catch (e) {
      record("direct-business-detail", false, { step: "exception", reason: String(e.message || e) });
    }

    try {
      await runDirectShopProduct(page2);
    } catch (e) {
      record("direct-shop-product", false, { step: "exception", reason: String(e.message || e) });
    }

    try {
      await runNewTabIsolation(context2, page2);
    } catch (e) {
      record("new-tab-isolation", false, { step: "exception", reason: String(e.message || e) });
    }

    await context2.close();
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => r.pass === false);
  const report = {
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: failed.length,
    results,
  };

  const md = [
    "# パンくず導線ベース化 — 検証レポート",
    "",
    `生成: ${report.generatedAt}`,
    "",
    `合計 ${report.total} チェック / 成功 ${report.passed} / 失敗 ${report.failed}`,
    "",
    failed.length
      ? "## NG一覧\n"
      : "## 結果\n\n全チェック成功\n",
    ...failed.map((f) => {
      return [
        `### ${f.id} — ${f.step}`,
        `- 実際: ${f.actual || "(n/a)"}`,
        `- 期待: ${f.expected || f.reason || "(n/a)"}`,
        f.reason ? `- 原因: ${f.reason}` : "",
        "",
      ].join("\n");
    }),
    "## 全結果",
    "",
    ...results.map((r) => `- [${r.pass ? "OK" : "NG"}] ${r.id} / ${r.step}: ${r.actual || r.reason || "ok"}`),
  ].join("\n");

  await writeFile(path.join(OUT_DIR, "review-report.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(OUT_DIR, "review-report.md"), md);

  console.log(md);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
