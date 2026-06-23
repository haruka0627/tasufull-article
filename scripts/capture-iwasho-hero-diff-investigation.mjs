#!/usr/bin/env node
/**
 * IWASHO hero display diff investigation
 *   node scripts/capture-iwasho-hero-diff-investigation.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-hero-diff");
const TARGET_URL_PATH = "/iwasho/";

const VIEWPORTS = [
  { id: "1280x900", width: 1280, height: 900, deviceScaleFactor: 1 },
  { id: "1920x900", width: 1920, height: 900, deviceScaleFactor: 1 },
  { id: "1440x900", width: 1440, height: 900, deviceScaleFactor: 1 },
  { id: "1280x900-dpr2", width: 1280, height: 900, deviceScaleFactor: 2 },
];

const base = await findDevServerBaseUrl({ probePath: "iwasho/index.html" });
const targetUrl = `${base}${TARGET_URL_PATH}`;
fs.mkdirSync(OUT, { recursive: true });

const cssProbe = await fetch(`${base}/corp-biz-home.css`, { cache: "no-store" });
const cssText = await cssProbe.text();
const cssHeroBlock = cssText.slice(
  cssText.indexOf("/* ===== Hero"),
  cssText.indexOf("/* ===== Section head")
);

const report = {
  capturedAt: new Date().toISOString(),
  base,
  targetUrl,
  expectedUrl: "http://127.0.0.1:8788/iwasho/",
  urlMatch: targetUrl.replace(/\/$/, "") === "http://127.0.0.1:8788/iwasho",
  css: {
    status: cssProbe.status,
    etag: cssProbe.headers.get("etag"),
    lastModified: cssProbe.headers.get("last-modified"),
    contentLength: cssProbe.headers.get("content-length"),
    hasHeroBgImgRule: cssText.includes(".iw-hero-bg"),
    hasOldIwHeroBgUnsplash: /iw-hero__bg[\s\S]*unsplash/.test(cssText),
    heroBlockSnippet: cssHeroBlock.slice(0, 600),
  },
  previousCaptureMethod: {
    note: "hero-1280.png was taken via page.locator('.iw-hero').screenshot() — excludes header (80px)",
    includesHeader: false,
  },
  viewports: [],
};

await withPlaywrightBrowser(async (browser) => {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
    });
    const page = await ctx.newPage();
    const imageRequests = [];

    page.on("request", (req) => {
      if (req.resourceType() === "image") {
        imageRequests.push(req.url());
      }
    });

    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60000 });
    await page.evaluate(() => window.scrollTo(0, 0));

    const pageUrl = page.url();
    const audit = await page.evaluate(() => {
      const header = document.querySelector(".iw-site-header");
      const hero = document.querySelector(".iw-hero");
      const img = document.querySelector(".iw-hero-bg");
      const overlay = document.querySelector(".iw-hero__overlay");
      const inner = document.querySelector(".iw-hero__inner");
      const hr = hero?.getBoundingClientRect();
      const hdr = header?.getBoundingClientRect();
      const ir = img?.getBoundingClientRect();
      const styles = (el) => (el ? getComputedStyle(el) : null);
      const imgCs = styles(img);
      const overlayCs = styles(overlay);
      const heroCs = styles(hero);
      const cssLinks = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => ({
        href: l.href,
        sheet: !!l.sheet,
      }));
      return {
        viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
        scrollY: window.scrollY,
        pageUrl: location.href,
        header: hdr
          ? { top: Math.round(hdr.top), height: Math.round(hdr.height), bottom: Math.round(hdr.bottom) }
          : null,
        hero: hr
          ? { top: Math.round(hr.top), height: Math.round(hr.height), bottom: Math.round(hr.bottom), width: Math.round(hr.width) }
          : null,
        heroImg: ir
          ? { top: Math.round(ir.top), height: Math.round(ir.height), width: Math.round(ir.width) }
          : null,
        heroInnerTop: inner ? Math.round(inner.getBoundingClientRect().top) : null,
        imgSrc: img?.getAttribute("src"),
        imgCurrentSrc: img?.currentSrc,
        imgNatural: img ? { w: img.naturalWidth, h: img.naturalHeight } : null,
        imgObjectFit: imgCs?.objectFit,
        imgObjectPosition: imgCs?.objectPosition,
        heroHeightCss: heroCs?.height,
        heroOverflow: heroCs?.overflow,
        overlayBackground: overlayCs?.background?.slice(0, 120),
        overlayOpacity: overlayCs?.opacity,
        cssLinks,
      };
    });

    const topClipH = Math.min(vp.height, (audit.hero?.bottom ?? 620) + 8);
    const topFull = path.join(OUT, `page-top-${vp.id}.png`);
    await page.screenshot({
      path: topFull,
      fullPage: false,
      clip: { x: 0, y: 0, width: vp.width, height: topClipH },
    });

    const heroOnly = path.join(OUT, `hero-only-${vp.id}.png`);
    await page.locator(".iw-hero").screenshot({ path: heroOnly });

    const headerPlusHero = path.join(OUT, `header-hero-${vp.id}.png`);
    await page.screenshot({
      path: headerPlusHero,
      fullPage: false,
      clip: {
        x: 0,
        y: 0,
        width: vp.width,
        height: Math.min(vp.height, (audit.header?.height ?? 80) + (audit.hero?.height ?? 540)),
      },
    });

    report.viewports.push({
      viewport: vp.id,
      configured: { width: vp.width, height: vp.height, dpr: vp.deviceScaleFactor },
      pageUrl,
      urlMatchesTarget: pageUrl.replace(/\/$/, "") === targetUrl.replace(/\/$/, ""),
      audit,
      heroImageRequests: imageRequests.filter((u) => u.includes("hero-bg")),
      screenshots: {
        pageTop: path.relative(ROOT, topFull).replace(/\\/g, "/"),
        heroOnly: path.relative(ROOT, heroOnly).replace(/\\/g, "/"),
        headerHero: path.relative(ROOT, headerPlusHero).replace(/\\/g, "/"),
      },
    });

    await page.close();
    await ctx.close();
  }
});

await closeAllBrowsers();

report.findings = [
  report.urlMatch
    ? "Capture uses http://127.0.0.1:8788/iwasho/ (via findDevServerBaseUrl)"
    : `Capture base differs: ${base}`,
  "Previous hero-1280.png used .iw-hero locator only — header (80px sticky) excluded",
  "Real browser shows header + hero; old capture started at hero top (y=0 of section, not page)",
  report.css.hasOldIwHeroBgUnsplash
    ? "WARNING: served CSS still contains old unsplash iw-hero__bg"
    : "Served CSS has no old unsplash hero background",
];

fs.writeFileSync(path.join(OUT, "investigation.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
