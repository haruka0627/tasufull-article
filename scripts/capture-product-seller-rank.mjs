import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "product-seller-rank");
const PRODUCTS = ["demo_product_001", "product_set_2026"];
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    const url = `http://127.0.0.1:${port}/detail-product.html?id=demo_product_001`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const base = await findBaseUrl();
console.log("Base URL:", base);

const browser = await chromium.launch({ headless: true });

for (const productId of PRODUCTS) {
  for (const shot of [
    { suffix: "390", width: 390, height: 844, mobile: true },
    { suffix: "1280", width: 1280, height: 900, mobile: false },
  ]) {
    const page = await browser.newPage({
      viewport: { width: shot.width, height: shot.height },
    });
    const url = `${base}/detail-product.html?id=${productId}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(shot.mobile ? 7000 : 4000);

    const selector = shot.mobile
      ? "[data-tasu-mdetail-seller-host], .tasu-mdetail-section__body [data-listing-seller]"
      : "#section-seller";

    const el = await page.$(selector);
    if (el) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    }

    const metrics = await page.evaluate((isMobile) => {
      const root = isMobile
        ? document.querySelector("[data-tasu-mdetail-seller-host], [data-listing-seller]")
        : document.querySelector("#section-seller");
      const avatar = root?.querySelector("[data-seller-avatar], .profile-avatar");
      const chip = root?.querySelector("[data-seller-rank-chip], .seller-rank-chip");
      const name = root?.querySelector("[data-seller-display-name], .seller-name");
      const cs = (node) => (node ? getComputedStyle(node) : null);
      const avatarCs = cs(avatar);
      const chipCs = cs(chip);
      const nameCs = cs(name);
      return {
        hasListingSellerHost: !!root?.hasAttribute("data-listing-seller"),
        avatarClasses: avatar?.className || null,
        chipClasses: chip?.className || null,
        nameClasses: name?.className || null,
        avatarBorderColor: avatarCs?.borderColor || null,
        chipBackground: chipCs?.backgroundImage || chipCs?.backgroundColor || null,
        chipColor: chipCs?.color || null,
        nameColor: nameCs?.color || null,
        nameWebkitFill: nameCs?.webkitTextFillColor || null,
      };
    }, shot.mobile);

    console.log(`${productId} ${shot.suffix}px:`, JSON.stringify(metrics));

    const outPath = path.join(OUT_DIR, `${productId}-seller-${shot.suffix}.png`);
    if (el) {
      await el.screenshot({ path: outPath });
    } else {
      await page.screenshot({ path: outPath, fullPage: false });
    }
    console.log("Saved:", outPath);

    await page.close();
  }
}

await browser.close();
console.log("Done.");
