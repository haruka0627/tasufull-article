#!/usr/bin/env node
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const url = "http://127.0.0.1:8788/iwasho/services";

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  const data = await page.evaluate(() => {
    const firstCharLeft = (el) => {
      if (!el) return null;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
      });
      const textNode = walker.nextNode();
      if (!textNode) return el.getBoundingClientRect().left;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 1);
      return range.getBoundingClientRect().left;
    };
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left * 10) / 10, width: Math.round(r.width * 10) / 10 };
    };
    return {
      logoBox: box(".iw-site-header__logo"),
      logoText: Math.round(firstCharLeft(document.querySelector(".iw-site-header__logo")) * 10) / 10,
      breadcrumbBox: box(".iw-svc-breadcrumb"),
      breadcrumbText: Math.round(firstCharLeft(document.querySelector(".iw-svc-breadcrumb")) * 10) / 10,
      titleBox: box(".iw-svc-hero__title"),
      titleText: Math.round(firstCharLeft(document.querySelector(".iw-svc-hero__title")) * 10) / 10,
      leadBox: box(".iw-svc-hero__lead"),
      leadText: Math.round(firstCharLeft(document.querySelector(".iw-svc-hero__lead")) * 10) / 10,
      headerInner: box(".iw-site-header__inner"),
      heroInner: {
        ...box(".iw-svc-hero__inner"),
        paddingLeft: getComputedStyle(document.querySelector(".iw-svc-hero__inner")).paddingLeft,
      },
    };
  });
  console.log(JSON.stringify(data, null, 2));
});
