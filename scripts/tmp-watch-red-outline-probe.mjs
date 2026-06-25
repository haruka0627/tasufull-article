#!/usr/bin/env node
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(
  "http://127.0.0.1:8788/live/watch-video?id=4d7e3650-b441-4598-9723-475a956cf68a",
  { waitUntil: "networkidle", timeout: 120000 }
);
await page.waitForSelector(".tlv-watch-layout");

const selectors = [
  'body[data-page="live-watch-video"] .tlv-watch-layout',
  'body[data-page="live-watch-video"] .tlv-watch-main',
  'body[data-page="live-watch-video"] .tlv-watch-sidebar',
  'body[data-page="live-watch-video"] .live-watch__player-wrap',
  'body[data-page="live-watch-video"] .tlv-related-list--yt',
  'body[data-page="live-watch-video"] .tlv-related-list--yt .tlv-related-list__thumb',
];

for (const sel of selectors) {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el) el.style.setProperty("outline", "5px solid red", "important");
  }, sel);
}

const probe = await page.evaluate((sels) => {
  const out = {};
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (!el) {
      out[sel] = { exists: false };
      continue;
    }
    const cs = getComputedStyle(el);
    out[sel] = {
      exists: true,
      outlineColor: cs.outlineColor,
      outlineWidth: cs.outlineWidth,
      redWorks: cs.outlineColor === "rgb(255, 0, 0)" || cs.outlineWidth === "5px",
    };
  }
  return out;
}, selectors);

console.log(JSON.stringify(probe, null, 2));
await page.screenshot({ path: "scripts/tmp-watch-ratio-shots/watch-red-outline-probe-1280.png" });
await browser.close();
