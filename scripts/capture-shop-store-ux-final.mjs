#!/usr/bin/env node
/**
 * 店舗販売導線 — 最終UX検証（画像 / 完了画面 / 導線監査）
 */
import { finalizeVerification } from "./lib/finalize-verification.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "shop-store-ux-final");
fs.mkdirSync(OUT, { recursive: true });

const SHOP = "demo-shop-haru-cafe";
const PRODUCTS = [
  { id: "demo-restaurant-0", label: "demo" },
  { id: "p-0", label: "p" },
];
const VIEWPORTS = [
  { label: "1280", width: 1280, height: 900 },
  { label: "390", width: 390, height: 844 },
];

const base = await findDevServerBaseUrl({ probePath: "shop-vendors.html" });
const report = {
  base,
  imageDisplay: "PASS",
  flowAudit: "PASS",
  completeScreen: "PASS",
  productIdMaintained: "PASS",
  purchaseFlow: "PENDING",
  notificationFlow: "PENDING",
  allPass: true,
  cases: [],
  flowSteps: [],
};

function isUsableSrc(src) {
  const s = String(src || "").trim();
  return Boolean(s && s !== "#" && !/^javascript:/i.test(s));
}

async function readProductImage(page) {
  return page.evaluate(() => {
    const img = document.querySelector("[data-shop-product-image]");
    const rect = img?.getBoundingClientRect?.();
    return {
      src: img?.currentSrc || img?.src || "",
      naturalWidth: img?.naturalWidth || 0,
      naturalHeight: img?.naturalHeight || 0,
      complete: Boolean(img?.complete),
      visible: Boolean(rect && rect.width > 40 && rect.height > 40),
    };
  });
}

function runScript(script) {
  return new Promise((resolve) => {
    const child = spawn("node", [path.join(__dirname, script)], {
      cwd: path.join(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    const append = (d) => {
      out += d.toString();
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("close", (code) => {
      const lines = out.trim().split("\n").filter(Boolean);
      let json = null;
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        try {
          json = JSON.parse(lines[i]);
          break;
        } catch {
          /* continue */
        }
      }
      resolve({ ...(json || {}), exitCode: code });
    });
  });
}

await withPlaywrightBrowser(async (browser) => {const purchase = await runScript("capture-shop-store-purchase-flow.mjs");
report.purchaseFlow = purchase.exitCode === 0 && purchase.ok ? "PASS" : "FAIL";
if (report.purchaseFlow !== "PASS") report.allPass = false;

const notify = await runScript("capture-shop-store-notify-compact.mjs");
report.notificationFlow = notify.exitCode === 0 && notify.allPass ? "PASS" : "FAIL";
if (report.notificationFlow !== "PASS") report.allPass = false;

for (const vp of VIEWPORTS) {
  for (const prod of PRODUCTS) {
    for (const mode of ["cart", "buyNow"]) {
      const caseId = `${prod.label}-${mode}-${vp.label}`;
      const row = { caseId, productId: prod.id, mode, viewport: vp.label, pass: false };
      const page = await browser.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      try {
        await page.goto(buildLocalPageUrl(base, "shop-vendors.html"), { waitUntil: "domcontentloaded" });
        await page.evaluate(() => {
          localStorage.removeItem("tasu_market_cart_items");
          localStorage.removeItem("tasu_market_cart_count");
        });

        const detailUrl = `detail-shop-store-product.html?shopId=${encodeURIComponent(SHOP)}&productId=${encodeURIComponent(prod.id)}`;
        await page.goto(buildLocalPageUrl(base, detailUrl), { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(1200);
        await page
          .waitForFunction(
            () => {
              const img = document.querySelector("[data-shop-product-image]");
              return Boolean(img?.complete && img.naturalWidth > 0);
            },
            { timeout: 12000 }
          )
          .catch(() => null);
        await page.waitForTimeout(400);

        const image = await readProductImage(page);
        row.image = image;
        await page.screenshot({ path: path.join(OUT, `${caseId}-01-detail.png`), fullPage: false });

        const urlParams = new URL(page.url()).searchParams;
        row.shopIdInUrl = urlParams.get("shopId");
        row.productIdInUrl = urlParams.get("productId");

        if (mode === "cart") {
          await page.locator("[data-shop-product-add-cart]").click({ force: true });
          await page.waitForTimeout(500);
          await page.goto(buildLocalPageUrl(base, "shop-store-checkout.html?mode=cart"), {
            waitUntil: "domcontentloaded",
          });
        } else {
          await page.locator("[data-shop-product-buy-now]").click({ force: true });
          await page.waitForURL(/shop-store-checkout\.html/, { timeout: 15000 });
        }
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(OUT, `${caseId}-02-checkout.png`), fullPage: false });

        await page.evaluate(() =>
          document.querySelector("[data-shop-store-checkout-submit], [data-shop-store-checkout-submit-aside]")?.click()
        );
        await page.waitForTimeout(1500);

        const complete = await page.evaluate(() => ({
          shop: document.querySelector("[data-shop-store-complete-shop]")?.textContent?.trim() || "",
          product: document.querySelector("[data-shop-store-complete-product]")?.textContent?.trim() || "",
          orderId: document.querySelector("[data-shop-store-complete-order-id]")?.textContent?.trim() || "",
          total: document.querySelector("[data-shop-store-complete-total]")?.textContent?.trim() || "",
          onComplete: /shop-store-complete/.test(location.pathname),
        }));
        row.complete = complete;
        await page.screenshot({ path: path.join(OUT, `${caseId}-03-complete.png`), fullPage: false });

        const imageOk =
          isUsableSrc(image.src) && image.naturalWidth > 0 && image.naturalHeight > 0 && image.visible;
        const idsOk = row.shopIdInUrl === SHOP && row.productIdInUrl === prod.id;
        const completeOk =
          complete.onComplete &&
          complete.shop &&
          complete.product &&
          complete.orderId &&
          /^TS-/.test(complete.orderId) &&
          /¥/.test(complete.total);

        row.pass = imageOk && idsOk && completeOk;
        if (!imageOk) {
          report.imageDisplay = "FAIL";
          report.allPass = false;
        }
        if (!idsOk) {
          report.productIdMaintained = "FAIL";
          report.allPass = false;
        }
        if (!completeOk) {
          report.completeScreen = "FAIL";
          report.allPass = false;
        }
      } catch (err) {
        row.error = String(err?.message || err);
        report.imageDisplay = "FAIL";
        report.allPass = false;
      } finally {
        report.cases.push(row);
        await page.close();
      }
    }
  }
}

// 導線監査（1280）
{
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  const steps = [];

  async function audit(name, pass, detail) {
    steps.push({ name, pass, detail });
    if (!pass) {
      report.flowAudit = "FAIL";
      report.allPass = false;
    }
  }

  try {
    await page.goto(buildLocalPageUrl(base, "shop-vendors.html"), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await audit("shop-vendors", !page.url().includes("404"), page.url());
    await page.screenshot({ path: path.join(OUT, "flow-01-vendors-1280.png"), fullPage: false });

    await page.goto(buildLocalPageUrl(base, `detail-shop-store.html?id=${encodeURIComponent(SHOP)}`), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1500);
    await audit("detail-shop-store", page.url().includes("detail-shop-store"), page.url());
    await page.screenshot({ path: path.join(OUT, "flow-02-shop-1280.png"), fullPage: false });

    await page.goto(buildLocalPageUrl(base, `shop-products.html?id=${encodeURIComponent(SHOP)}`), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1500);
    const cardHref = await page.evaluate(() => document.querySelector(".shop-products-card__link")?.href || "");
    await audit("shop-products link", /detail-shop-store-product/.test(cardHref), cardHref);
    await page.screenshot({ path: path.join(OUT, "flow-03-products-1280.png"), fullPage: false });

    if (cardHref) {
      await page.goto(cardHref, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      const img = await readProductImage(page);
      await audit("product detail image", isUsableSrc(img.src) && img.naturalWidth > 0, img.src);
      const backHref = await page.evaluate(() => document.querySelector("[data-shop-product-shop-link]")?.href || "");
      await audit("back to shop", /detail-shop-store/.test(backHref), backHref);
      await page.screenshot({ path: path.join(OUT, "flow-04-detail-1280.png"), fullPage: false });
    }
  } catch (err) {
    await audit("flow audit error", false, String(err?.message || err));
  }

  report.flowSteps = steps;
  await page.close();
}

});

report.ok = report.cases.filter((c) => c.pass).length;
report.ng = report.cases.filter((c) => !c.pass).length;

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

console.log(
  JSON.stringify(
    {
      imageDisplay: report.imageDisplay,
      completeScreen: report.completeScreen,
      flowAudit: report.flowAudit,
      productIdMaintained: report.productIdMaintained,
      purchaseFlow: report.purchaseFlow,
      notificationFlow: report.notificationFlow,
      allPass: report.allPass,
      ok: report.ok,
      ng: report.ng,
    },
    null,
    2
  )
);

await finalizeVerification(path.join(__dirname, ".."), { primaryFolder: "shop-store-ux-final" });

await closeAllBrowsers();
