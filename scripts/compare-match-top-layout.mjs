#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports", "screenshots", "match-top-lp");
fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://127.0.0.1:8788/match/match-top.html", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector(".match-top-shell__bg");

  const m = await page.evaluate(() => {
    const shell = document.querySelector(".match-top-shell");
    const bg = document.querySelector(".match-top-shell__bg");
    const shellR = shell.getBoundingClientRect();
    const bgR = bg.getBoundingClientRect();
    const pts = {};
    for (const sel of [".match-top-header", ".match-top-hero__title", ".match-top-cta", ".match-top-login"]) {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      pts[sel] = { top: Math.round(r.top - shellR.top), bottom: Math.round(r.bottom - shellR.top) };
    }
    return {
      shellH: Math.round(shellR.height),
      bgH: Math.round(bgR.height),
      bgW: Math.round(bgR.width),
      cloudStartEst: Math.round(bgR.height * 0.855),
      pts,
    };
  });
  console.log(JSON.stringify(m, null, 2));

  await page.locator(".match-top-shell").screenshot({ path: path.join(OUT, "match-top-390-v2.png") });

  const refPage = await browser.newPage({ viewport: { width: 563, height: 1024 } });
  await refPage.goto(`http://127.0.0.1:8788/match/images/top/ref-mockup.png`);
  await refPage.screenshot({
    path: path.join(OUT, "ref-mockup-390-crop.png"),
    clip: { x: 128, y: 0, width: 563, height: 1024 },
  });

  const comparePage = await browser.newPage({ viewport: { width: 820, height: 900 } });
  await comparePage.setContent(`<!DOCTYPE html><html><head><style>
    body{margin:0;display:flex;gap:8px;background:#eee;padding:8px}
    img{width:390px;height:auto;border:1px solid #ddd;border-radius:8px}
    figcaption{font:12px sans-serif;text-align:center;color:#666;margin-top:4px}
    figure{margin:0}
  </style></head><body>
    <figure><img src="file:///${path.join(OUT, "ref-mockup-390-crop.png").replace(/\\/g, "/")}" /><figcaption>参考</figcaption></figure>
    <figure><img src="file:///${path.join(OUT, "match-top-390-v2.png").replace(/\\/g, "/")}" /><figcaption>実装</figcaption></figure>
  </body></html>`);
  await comparePage.screenshot({ path: path.join(OUT, "compare-390-side-by-side.png"), fullPage: true });

  await page.close();
  await refPage.close();
  await comparePage.close();
});

await closeAllBrowsers();
