#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-services-hero-align");
const base = await findDevServerBaseUrl({ probePath: "iwasho/services.html" });
const url = buildLocalPageUrl(base, "iwasho/services.html");
fs.mkdirSync(OUT, { recursive: true });

const widths = [1280, 1440, 1920];
const report = { url, capturedAt: new Date().toISOString(), viewports: [] };

await withPlaywrightBrowser(async (browser) => {
  for (const width of widths) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    const data = await page.evaluate(() => {
      const pick = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          left: Math.round(r.left),
          top: Math.round(r.top),
          width: Math.round(r.width),
          paddingLeft: cs.paddingLeft,
          marginLeft: cs.marginLeft,
          className: el.className,
        };
      };
      return {
        logo: pick(document.querySelector(".iw-site-header__logo")),
        headerInner: pick(document.querySelector(".iw-site-header__inner")),
        heroInner: pick(document.querySelector(".iw-svc-hero__inner")),
        heroContent: pick(document.querySelector(".iw-svc-hero__content")),
        breadcrumb: pick(document.querySelector(".iw-svc-breadcrumb")),
        title: pick(document.querySelector(".iw-svc-hero__title")),
        lead: pick(document.querySelector(".iw-svc-hero__lead")),
        heroBanner: pick(document.querySelector(".iw-svc-hero__banner")),
        dom: {
          heroInner: document.querySelector(".iw-svc-hero__inner")?.outerHTML?.slice(0, 200),
          classes: [
            ".iw-svc-hero__inner",
            ".iw-svc-breadcrumb",
            ".iw-svc-hero__title",
            ".iw-svc-hero__lead",
          ].map((sel) => ({ sel, found: !!document.querySelector(sel) })),
        },
      };
    });

    await page.screenshot({ path: path.join(OUT, `hero-${width}.png`), fullPage: false });
    report.viewports.push({ width, ...data, deltaLogoToTitle: data.title && data.logo ? data.title.left - data.logo.left : null });
    await ctx.close();
  }
});

fs.writeFileSync(path.join(OUT, "measure.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
