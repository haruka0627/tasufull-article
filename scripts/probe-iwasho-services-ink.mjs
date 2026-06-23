#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-services-hero-align");
const url = "http://127.0.0.1:8788/iwasho/services";
fs.mkdirSync(OUT, { recursive: true });

function leftmostInk(png, yStart, yEnd, threshold = 240) {
  let minX = png.width;
  for (let y = yStart; y < yEnd; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) << 2;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      const a = png.data[i + 3];
      if (a > 10 && (r < threshold || g < threshold || b < threshold)) {
        if (x < minX) minX = x;
      }
    }
  }
  return minX === png.width ? null : minX;
}

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

  const boxes = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    return {
      logo: r(".iw-site-header__logo"),
      breadcrumb: r(".iw-svc-breadcrumb"),
      title: r(".iw-svc-hero__title"),
    };
  });

  const shotPath = path.join(OUT, "pixel-probe-1280.png");
  await page.screenshot({ path: shotPath });

  const png = PNG.sync.read(fs.readFileSync(shotPath));
  const probe = {
    logoInk: leftmostInk(png, Math.round(boxes.logo.top), Math.round(boxes.logo.top + boxes.logo.height)),
    breadcrumbInk: leftmostInk(png, Math.round(boxes.breadcrumb.top), Math.round(boxes.breadcrumb.top + 20)),
    titleInk: leftmostInk(png, Math.round(boxes.title.top), Math.round(boxes.title.top + 30)),
    logoBoxLeft: Math.round(boxes.logo.left),
    breadcrumbBoxLeft: Math.round(boxes.breadcrumb.left),
    titleBoxLeft: Math.round(boxes.title.left),
  };
  probe.deltaInkBreadcrumbMinusLogo = probe.breadcrumbInk - probe.logoInk;
  probe.deltaInkTitleMinusLogo = probe.titleInk - probe.logoInk;
  console.log(JSON.stringify(probe, null, 2));
});
