#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-services-hero-align");
const url = "http://127.0.0.1:8788/iwasho/services";
const urlHtml = "http://127.0.0.1:8788/iwasho/services.html";
fs.mkdirSync(OUT, { recursive: true });

const widths = [1280, 1440, 1920];
const report = { url, urlHtml, capturedAt: new Date().toISOString(), viewports: [] };

const measure = () => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, found: false };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      sel,
      found: true,
      left: Math.round(r.left * 10) / 10,
      top: Math.round(r.top * 10) / 10,
      width: Math.round(r.width * 10) / 10,
      paddingLeft: cs.paddingLeft,
      marginLeft: cs.marginLeft,
      paddingInline: cs.paddingInline,
    };
  };
  const heroInner = document.querySelector(".iw-svc-hero__inner");
  const cssHref = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    logo: pick(".iw-site-header__logo"),
    breadcrumb: pick(".iw-svc-breadcrumb"),
    title: pick(".iw-svc-hero__title"),
    lead: pick(".iw-svc-hero__lead"),
    headerInner: pick(".iw-site-header__inner"),
    heroInner: pick(".iw-svc-hero__inner"),
    heroContent: pick(".iw-svc-hero__content"),
    heroInnerPaddingLeft: heroInner ? getComputedStyle(heroInner).paddingLeft : null,
    stylesheets: cssHref,
    pageUrl: location.href,
  };
};

await withPlaywrightBrowser(async (browser) => {
  for (const width of widths) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    const data = await page.evaluate(measure);
    data.delta = {
      breadcrumbMinusLogo: data.breadcrumb.found && data.logo.found ? data.breadcrumb.left - data.logo.left : null,
      titleMinusLogo: data.title.found && data.logo.found ? data.title.left - data.logo.left : null,
      leadMinusLogo: data.lead.found && data.logo.found ? data.lead.left - data.logo.left : null,
    };
    await page.screenshot({ path: path.join(OUT, `services-url-${width}.png`), fullPage: false });
    report.viewports.push({ width, ...data });
    await ctx.close();
  }
});

fs.writeFileSync(path.join(OUT, "measure-url.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
