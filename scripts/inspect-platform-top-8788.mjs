#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "platform-top-verify");
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");

const URLS = [
  { key: "root", path: "/" },
  { key: "index-top", path: "/index-top" },
];

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];

async function inspectPage(page) {
  return page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        exists: true,
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
        height: Math.round(r.height),
        width: Math.round(r.width),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        overflow: cs.overflow,
        position: cs.position,
      };
    };

    const hero = document.querySelector(".tas-hero");
    const heroInner = document.querySelector(".tas-hero__inner");
    const heroCards = document.querySelector(".tas-hero__cards");
    const footer = document.querySelector(".top-site-footer");
    const footerGrid = document.querySelector(".top-site-footer__grid");
    const footerBar = document.querySelector(".top-site-footer__bar");

    const sheets = [...document.styleSheets]
      .map((s) => s.href)
      .filter(Boolean)
      .map((h) => h.replace(location.origin, ""));

    return {
      url: location.href,
      title: document.title,
      bodyClass: document.body.className,
      dataPage: document.body.dataset.page,
      stylesheets: sheets,
      hero: pick(".tas-hero"),
      heroInner: pick(".tas-hero__inner"),
      heroCards: pick(".tas-hero__cards"),
      heroTitle: pick(".tas-hero__title"),
      heroCardCount: document.querySelectorAll(".tas-hero__card").length,
      footer: pick(".top-site-footer"),
      footerGrid: pick(".top-site-footer__grid"),
      footerBar: pick(".top-site-footer__bar"),
      footerGridText: footerGrid?.exists
        ? document.querySelector(".top-site-footer__grid")?.textContent?.slice(0, 80)
        : null,
      docHeight: document.documentElement.scrollHeight,
      viewportH: window.innerHeight,
      footerInViewport:
        footer && footer.getBoundingClientRect().bottom > 0 &&
        footer.getBoundingClientRect().top < window.innerHeight,
      heroCardRects: [...document.querySelectorAll(".tas-hero__card")].map((el, i) => {
        const r = el.getBoundingClientRect();
        return { i, h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top) };
      }),
    };
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { base: BASE, pages: {} };

  for (const u of URLS) {
    const pre = await fetch(`${BASE}${u.path}`);
    report.pages[u.key] = { path: u.path, httpStatus: pre.status };
  }

  await withPlaywrightBrowser(async (browser) => {
    for (const u of URLS) {
      report.pages[u.key].viewports = {};
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
        });
        const page = await context.newPage();
        const errors = [];
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
        });
        const res = await page.goto(`${BASE}${u.path}`, {
          waitUntil: "networkidle",
          timeout: 60000,
        });
        await page.waitForTimeout(600);
        const data = await inspectPage(page);
        const shot = path.join(OUT, `${u.key}-${vp.name}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        report.pages[u.key].viewports[vp.name] = {
          status: res?.status(),
          ...data,
          consoleErrors: errors.length,
          screenshot: shot.replace(/\\/g, "/"),
        };
        await context.close();
      }
    }
  });

  const outPath = path.join(OUT, "report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
