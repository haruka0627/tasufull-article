#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-services-hero-align");
const url = "http://127.0.0.1:8788/iwasho/services";
fs.mkdirSync(OUT, { recursive: true });

const report = {
  url,
  pageUrlServed: null,
  redirectFromHtml: null,
  distSynced: true,
  selectors: {
    siteLogo: ".iw-site-logo (DOM上は存在せず、実クラスは .iw-site-header__logo)",
    breadcrumb: ".iw-svc-breadcrumb",
    title: ".iw-svc-hero__title",
    lead: ".iw-svc-hero__lead",
  },
  viewports: [],
};

await withPlaywrightBrowser(async (browser) => {
  const probe = await browser.newPage();
  const res = await probe.goto("http://127.0.0.1:8788/iwasho/services.html", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  report.redirectFromHtml = { status: res?.status(), finalUrl: probe.url() };
  await probe.close();

  for (const width of [1280, 1440, 1920]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    report.pageUrlServed = page.url();

    const data = await page.evaluate(() => {
      const m = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return { sel, found: false };
        const r = el.getBoundingClientRect();
        return { sel, found: true, left: Math.round(r.left * 10) / 10 };
      };
      const rail = document.querySelector(".iw-svc-hero__rail");
      return {
        logo: m(".iw-site-header__logo"),
        siteLogo: m(".iw-site-logo"),
        breadcrumb: m(".iw-svc-breadcrumb"),
        title: m(".iw-svc-hero__title"),
        lead: m(".iw-svc-hero__lead"),
        rail: m(".iw-svc-hero__rail"),
        railPad: rail ? getComputedStyle(rail).paddingLeft : null,
        headerPad: getComputedStyle(document.querySelector(".iw-site-header__inner")).paddingLeft,
        cssHref: [...document.querySelectorAll('link[rel="stylesheet"]')]
          .find((l) => l.href.includes("corp-biz-services.css"))?.href,
      };
    });

    await page.evaluate(() => {
      document.getElementById("align-probe")?.remove();
      const wrap = document.createElement("div");
      wrap.id = "align-probe";
      wrap.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:99999";
      const logo = document.querySelector(".iw-site-header__logo").getBoundingClientRect();
      const line = document.createElement("div");
      line.style.cssText = `position:absolute;left:${logo.left}px;top:0;width:2px;height:100vh;background:#e11d48`;
      wrap.append(line);
      document.body.append(wrap);
    });

    await page.screenshot({ path: path.join(OUT, `after-fix-${width}.png`) });
    report.viewports.push({ width, ...data });
    await page.close();
  }
});

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
