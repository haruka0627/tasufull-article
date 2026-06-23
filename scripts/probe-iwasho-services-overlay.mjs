#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-services-hero-align");
const url = "http://127.0.0.1:8788/iwasho/services";
fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

  const data = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      const r = el?.getBoundingClientRect();
      return r ? { left: r.left, top: r.top, height: r.height } : null;
    };
    const logo = pick(".iw-site-header__logo");
    const bc = pick(".iw-svc-breadcrumb");
    const title = pick(".iw-svc-hero__title");
    const lead = pick(".iw-svc-hero__lead");

    document.getElementById("align-probe")?.remove();
    const wrap = document.createElement("div");
    wrap.id = "align-probe";
    wrap.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:99999";
    const line = (x, color, label) => {
      const el = document.createElement("div");
      el.style.cssText = `position:absolute;left:${x}px;top:0;width:2px;height:100vh;background:${color}`;
      const tag = document.createElement("div");
      tag.textContent = label;
      tag.style.cssText = `position:absolute;left:${x + 4}px;top:4px;font:12px monospace;background:${color};color:#fff;padding:2px 4px`;
      wrap.append(el, tag);
    };
    line(logo.left, "#e11d48", `logo ${Math.round(logo.left)}`);
    line(bc.left, "#2563eb", `bc ${Math.round(bc.left)}`);
    line(title.left, "#16a34a", `h1 ${Math.round(title.left)}`);
    line(lead.left, "#ca8a04", `lead ${Math.round(lead.left)}`);
    document.body.append(wrap);
    return {
      logo: Math.round(logo.left * 10) / 10,
      breadcrumb: Math.round(bc.left * 10) / 10,
      title: Math.round(title.left * 10) / 10,
      lead: Math.round(lead.left * 10) / 10,
      siteLogoExists: !!document.querySelector(".iw-site-logo"),
      headerLogoClass: document.querySelector(".iw-site-header__logo")?.className,
    };
  });

  await page.screenshot({ path: path.join(OUT, "align-probe-1280.png") });
  console.log(JSON.stringify(data, null, 2));
});
