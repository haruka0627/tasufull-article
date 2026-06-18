#!/usr/bin/env node
/**
 * HP-MIGRATION-3 — 企業 HP 目視レビュー用スクリーンショット + 自動チェック
 *   node scripts/capture-corp-hp-visual-review.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeAllBrowsers, withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/hp-migration-3-visual-review");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];

const PAGES = [
  { slug: "iwasho-index", path: "/iwasho/" },
  { slug: "iwasho-about", path: "/iwasho/about.html" },
  { slug: "iwasho-services", path: "/iwasho/services.html" },
  { slug: "iwasho-partners", path: "/iwasho/partners.html" },
  { slug: "iwasho-contact", path: "/iwasho/contact.html" },
  { slug: "iwasho-privacy", path: "/iwasho/privacy.html" },
  { slug: "company-index", path: "/company/" },
  { slug: "company-about", path: "/company/about.html" },
  { slug: "company-services", path: "/company/services.html" },
  { slug: "company-vision", path: "/company/vision.html" },
  { slug: "company-faq", path: "/company/faq.html" },
  { slug: "company-contact", path: "/company/contact.html" },
  { slug: "company-terms", path: "/company/legal/terms.html" },
  { slug: "company-privacy", path: "/company/legal/privacy.html" },
  { slug: "company-tokushoho", path: "/company/legal/tokushoho.html" },
];

async function findBase() {
  for (const port of [8788, 5173, 5500]) {
    const base = `http://127.0.0.1:${port}`;
    try {
      const res = await fetch(`${base}/iwasho/`, { method: "GET" });
      if (res.ok) return base;
    } catch {
      /* next */
    }
  }
  throw new Error("Serve dist first: npx --yes serve deploy/cloudflare/dist -p 8788");
}

async function auditPage(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflowX = doc.scrollWidth > doc.clientWidth + 1;
    const header = document.querySelector(".corp-header");
    const footer = document.querySelector(".corp-footer");
    const headerRect = header?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const wix = /\bwix\b|100vw|biz-badge-top|class="btn-l/i.test(document.body.innerHTML);
    const inlineStyles = document.querySelectorAll("[style]").length;
    const brokenAnchors = [...document.querySelectorAll('a[href^="#"]')].filter((a) => {
      const id = a.getAttribute("href").slice(1);
      return id && !document.getElementById(id);
    }).map((a) => a.getAttribute("href"));
    const imgs = [...document.querySelectorAll("img")].map((img) => {
      const r = img.getBoundingClientRect();
      return {
        src: img.getAttribute("src"),
        ok: img.complete && img.naturalWidth > 0,
        w: r.width,
        h: r.height,
      };
    });
    return {
      overflowX,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      headerHeight: headerRect?.height ?? null,
      footerVisible: footerRect ? footerRect.top < window.innerHeight : false,
      wixMarkers: wix,
      inlineStyleCount: inlineStyles,
      brokenAnchors,
      imgs,
    };
  });
}

async function checkLinks(base, browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const results = [];
  for (const p of PAGES) {
    const url = `${base}${p.path}`;
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const status = res?.status() ?? 0;
    const hrefs = await page.$$eval("a[href]", (as) =>
      as.map((a) => a.getAttribute("href")).filter(Boolean)
    );
    const internal = [...new Set(hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//")))];
    for (const href of internal) {
      const target = href.startsWith("/") ? `${base}${href}` : href;
      try {
        const r = await page.goto(target.split("#")[0], { waitUntil: "domcontentloaded", timeout: 20000 });
        results.push({ from: p.path, href, status: r?.status() ?? 0, ok: (r?.status() ?? 0) === 200 });
      } catch (e) {
        results.push({ from: p.path, href, status: 0, ok: false, err: String(e.message || e) });
      }
    }
    results.push({ page: p.path, pageStatus: status, ok: status === 200 });
  }
  await ctx.close();
  return results;
}

const base = await findBase();
fs.mkdirSync(OUT, { recursive: true });

const audits = [];
const shots = [];
let linkResults = [];

await withPlaywrightBrowser(async (browser) => {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    try {
      for (const p of PAGES) {
        const url = `${base}${p.path}`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
        await page.waitForTimeout(300);
        const file = path.join(OUT, `${p.slug}-${vp.id}-top.png`);
        await page.screenshot({ path: file, fullPage: false });
        shots.push(path.relative(ROOT, file).replace(/\\/g, "/"));
        const audit = await auditPage(page);
        audits.push({ page: p.path, viewport: vp.id, ...audit });
        if (p.slug.includes("index") && vp.id === "390") {
          const menuFile = path.join(OUT, `${p.slug}-${vp.id}-nav-open.png`);
          await page
            .locator(".corp-nav, .iwasho-home-nav")
            .first()
            .evaluate((el) => {
              el.open = true;
            })
            .catch(() => null);
          await page.screenshot({ path: menuFile, fullPage: false });
          shots.push(path.relative(ROOT, menuFile).replace(/\\/g, "/"));
        }
      }
    } finally {
      await page.close().catch(() => null);
      await ctx.close().catch(() => null);
    }
  }

  linkResults = await checkLinks(base, browser);
});

await closeAllBrowsers();

const reportJson = { base, shots, audits, linkResults };
fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(reportJson, null, 2));

const issues = [];
for (const a of audits) {
  if (a.overflowX) issues.push(`overflow-x: ${a.page} @ ${a.viewport}px (${a.scrollWidth}/${a.clientWidth})`);
  if (a.brokenAnchors?.length) issues.push(`broken anchor ${a.page} @ ${a.viewport}: ${a.brokenAnchors.join(", ")}`);
  if (a.wixMarkers) issues.push(`wix marker ${a.page} @ ${a.viewport}`);
  for (const img of a.imgs || []) {
    if (!img.ok) issues.push(`broken img ${a.page}: ${img.src}`);
  }
}
const badLinks = linkResults.filter((r) => r.href && !r.ok);
for (const l of badLinks) issues.push(`link ${l.from} → ${l.href} status=${l.status}`);

console.log(`[hp-migration-3] base=${base}`);
console.log(`[hp-migration-3] screenshots=${shots.length} → ${path.relative(ROOT, OUT)}`);
console.log(`[hp-migration-3] issues=${issues.length}`);
for (const i of issues) console.log(`  - ${i}`);
await closeAllBrowsers();
process.exit(issues.some((i) => i.startsWith("overflow") || i.startsWith("link")) ? 1 : 0);
