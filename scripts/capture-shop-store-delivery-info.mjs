#!/usr/bin/env node
/**
 * 店舗販売 — 配送・発送情報表示検証（PC1280 / 390px）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "shop-store-shipping-fields");
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

const FALLBACK = {
  delivery_method: "店舗指定",
  shipping_estimate: "店舗に確認",
  shipping_fee: "要確認",
  handoff_method: "配送",
  return_policy: "店舗の返品条件をご確認ください",
};

const base = await findDevServerBaseUrl({ probePath: "detail-shop-store-product.html" });
const report = {
  base,
  deliveryDisplay: "PASS",
  purchaseFlow: "PENDING",
  notificationFlow: "PENDING",
  allPass: true,
  cases: [],
};

async function readDelivery(page, context) {
  if (context === "detail") {
    return page.evaluate(() => {
      const wrap = document.querySelector("[data-shop-product-delivery-wrap]");
      const rows = [...document.querySelectorAll("[data-shop-product-delivery] .shop-store-delivery__row")].map(
        (row) => ({
          label: row.querySelector("dt")?.textContent?.trim() || "",
          value: row.querySelector("dd")?.textContent?.trim() || "",
        })
      );
      return { sectionVisible: wrap?.hidden === false, rowCount: rows.length, rows };
    });
  }
  return page.evaluate(() => {
    const wrap = document.querySelector("[data-shop-store-checkout-delivery]");
    const rows = [...document.querySelectorAll("[data-shop-store-checkout-delivery] .shop-store-delivery__row")].map(
      (row) => ({
        label: row.querySelector("dt")?.textContent?.trim() || "",
        value: row.querySelector("dd")?.textContent?.trim() || "",
      })
    );
    return { sectionVisible: Boolean(wrap?.innerHTML?.trim()), rowCount: rows.length, rows };
  });
}

function hasRow(rows, label) {
  return rows.some((r) => r.label === label && r.value);
}

function evalDetail(rows) {
  return (
    rows.length === 5 &&
    hasRow(rows, "配送方法") &&
    hasRow(rows, "発送目安") &&
    hasRow(rows, "送料") &&
    hasRow(rows, "受け渡し方法") &&
    hasRow(rows, "返品・キャンセル条件")
  );
}

function evalCheckout(rows) {
  return (
    rows.length === 4 &&
    !rows.some((r) => r.label === "受け渡し方法") &&
    hasRow(rows, "配送方法") &&
    hasRow(rows, "発送目安") &&
    hasRow(rows, "送料") &&
    hasRow(rows, "返品・キャンセル条件")
  );
}

const browser = await chromium.launch({ headless: true });

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
        await page.waitForTimeout(1800);

        const detail = await readDelivery(page, "detail");
        row.detail = detail;
        await page.screenshot({ path: path.join(OUT, `${caseId}-01-detail.png`), fullPage: false });

        if (mode === "cart") {
          await page.locator("[data-shop-product-add-cart]").click({ force: true });
          await page.waitForTimeout(400);
          await page.goto(buildLocalPageUrl(base, "shop-store-checkout.html?mode=cart"), {
            waitUntil: "domcontentloaded",
          });
        } else {
          await page.locator("[data-shop-product-buy-now]").click({ force: true });
          await page.waitForURL(/shop-store-checkout\.html/, { timeout: 15000 });
        }
        await page.waitForTimeout(1500);

        const checkout = await readDelivery(page, "checkout");
        row.checkout = checkout;
        await page.screenshot({ path: path.join(OUT, `${caseId}-02-checkout.png`), fullPage: false });

        await page.evaluate(() =>
          document.querySelector("[data-shop-store-checkout-submit], [data-shop-store-checkout-submit-aside]")?.click()
        );
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(OUT, `${caseId}-03-complete.png`), fullPage: false });

        row.pass =
          detail.sectionVisible &&
          evalDetail(detail.rows) &&
          checkout.sectionVisible &&
          evalCheckout(checkout.rows) &&
          page.url().includes("shop-store-complete");

        if (!row.pass) {
          report.deliveryDisplay = "FAIL";
          report.allPass = false;
        }
      } catch (err) {
        row.error = String(err?.message || err);
        report.deliveryDisplay = "FAIL";
        report.allPass = false;
      } finally {
        report.cases.push(row);
        await page.close();
      }
    }
  }
}

// 未入力 fallback
{
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    buildLocalPageUrl(
      base,
      `detail-shop-store-product.html?shopId=${encodeURIComponent(SHOP)}&productId=demo-restaurant-0`
    ),
    { waitUntil: "domcontentloaded" }
  );
  await page.evaluate(() => {
    const Delivery = window.TasuShopStoreDeliveryInfo;
    const list = document.querySelector("[data-shop-product-delivery]");
    const wrap = document.querySelector("[data-shop-product-delivery-wrap]");
    if (list && Delivery) {
      list.innerHTML = Delivery.renderRowsHtml({});
      wrap?.removeAttribute("hidden");
    }
  });
  const emptyCheck = await page.evaluate((fb) => {
    const rows = [...document.querySelectorAll("[data-shop-product-delivery] .shop-store-delivery__row")].map(
      (row) => ({
        label: row.querySelector("dt")?.textContent?.trim() || "",
        value: row.querySelector("dd")?.textContent?.trim() || "",
      })
    );
    return {
      rowCount: rows.length,
      rows,
      matchesFallback: rows.every((r, i) => {
        const expected = [
          ["配送方法", fb.delivery_method],
          ["発送目安", fb.shipping_estimate],
          ["送料", fb.shipping_fee],
          ["受け渡し方法", fb.handoff_method],
          ["返品・キャンセル条件", fb.return_policy],
        ][i];
        return expected && r.label === expected[0] && r.value === expected[1];
      }),
    };
  }, FALLBACK);
  report.emptyFallback = emptyCheck;
  if (!emptyCheck.matchesFallback || emptyCheck.rowCount !== 5) {
    report.deliveryDisplay = "FAIL";
    report.allPass = false;
  }
  await page.screenshot({ path: path.join(OUT, "empty-fallback-390.png"), fullPage: false });
  await page.close();
}

await browser.close();

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
          /* try previous line */
        }
      }
      resolve({ ...(json || {}), exitCode: code, raw: out.slice(-800) });
    });
  });
}

const purchase = await runScript("capture-shop-store-purchase-flow.mjs");
report.purchaseFlow = purchase.exitCode === 0 && purchase.ok ? "PASS" : "FAIL";
if (report.purchaseFlow !== "PASS") {
  report.purchaseFlowDetail = purchase;
  report.allPass = false;
}

const notify = await runScript("capture-shop-store-notify-compact.mjs");
report.notificationFlow = notify.exitCode === 0 && notify.allPass ? "PASS" : "FAIL";
if (report.notificationFlow !== "PASS") {
  report.notificationFlowDetail = notify;
  report.allPass = false;
}

report.ok = report.cases.filter((c) => c.pass).length;
report.ng = report.cases.filter((c) => !c.pass).length;

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      deliveryDisplay: report.deliveryDisplay,
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
