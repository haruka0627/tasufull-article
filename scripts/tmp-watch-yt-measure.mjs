#!/usr/bin/env node
/**
 * Measure watch-page layout metrics + selector red-outline probe.
 * Usage: node scripts/tmp-watch-yt-measure.mjs [--label before|after]
 */
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const VIDEO_ID = "4d7e3650-b441-4598-9723-475a956cf68a";
const BASE = `http://127.0.0.1:8788/live/watch-video?id=${VIDEO_ID}`;
const OUT_DIR = path.resolve("scripts/tmp-watch-ratio-shots");
const label = process.argv.includes("--label")
  ? process.argv[process.argv.indexOf("--label") + 1]
  : "snapshot";

const VIEWPORTS = [
  { w: 1280, h: 900, name: "1280" },
  { w: 1440, h: 900, name: "1440" },
  { w: 1920, h: 1080, name: "1920" },
];

const RED_PROBE_SELECTORS = [
  'body[data-page="live-watch-video"] .tlv-watch-layout',
  'body[data-page="live-watch-video"] .tlv-watch-main',
  'body[data-page="live-watch-video"] .tlv-watch-sidebar',
  'body[data-page="live-watch-video"] .live-watch__player-wrap',
  'body[data-page="live-watch-video"] .tlv-related-list--yt',
  'body[data-page="live-watch-video"] .tlv-related-list--yt .tlv-related-list__thumb',
  ".tlv-watch-layout",
  ".tlv-watch-main",
  ".live-watch__player-wrap",
];

function rect(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    w: Math.round(r.width),
    h: Math.round(r.height),
    x: Math.round(r.x),
    y: Math.round(r.y),
  };
}

function cs(el, props) {
  if (!el) return null;
  const s = getComputedStyle(el);
  return Object.fromEntries(props.map((p) => [p, s[p]]));
}

async function measurePage(page) {
  return page.evaluate(
    ({ redProbeSelectors }) => {
      const pick = (sel) => document.querySelector(sel);

      const layout = pick(".tlv-watch-layout");
      const main = pick(".tlv-watch-main");
      const sidebar = pick(".tlv-watch-sidebar");
      const playerWrap = pick(".live-watch__player-wrap");
      const player = pick("video.live-watch__player");
      const relatedList = pick(".tlv-related-list--yt");
      const thumb = pick(".tlv-related-list--yt .tlv-related-list__thumb");
      const item = pick(".tlv-related-list--yt .tlv-related-list__item");
      const desktopMain = pick(".tlv-desktop-main--watch");

      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
      };
      const cs = (el, props) => {
        if (!el) return null;
        const s = getComputedStyle(el);
        return Object.fromEntries(props.map((p) => [p, s[p]]));
      };

      const redProbe = {};
      for (const sel of redProbeSelectors) {
        const el = document.querySelector(sel);
        if (!el) {
          redProbe[sel] = { exists: false };
          continue;
        }
        const outline = getComputedStyle(el).outlineColor;
        const outlineWidth = getComputedStyle(el).outlineWidth;
        redProbe[sel] = {
          exists: true,
          outlineColor: outline,
          outlineWidth,
          matchesBodyScope: document.body.getAttribute("data-page") === "live-watch-video",
        };
      }

      return {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        media1024: window.matchMedia("(min-width: 1024px)").matches,
        bodyDataPage: document.body.getAttribute("data-page"),
        elements: {
          desktopMain: { rect: rect(desktopMain), cs: cs(desktopMain, ["maxWidth", "padding", "width"]) },
          layout: {
            rect: rect(layout),
            cs: cs(layout, ["display", "gridTemplateColumns", "gap", "maxWidth", "outline", "outlineColor"]),
          },
          main: { rect: rect(main), cs: cs(main, ["width", "maxWidth"]) },
          sidebar: {
            rect: rect(sidebar),
            cs: cs(sidebar, ["width", "minWidth", "maxWidth"]),
          },
          playerWrap: {
            rect: rect(playerWrap),
            cs: cs(playerWrap, ["width", "maxWidth", "aspectRatio", "maxHeight"]),
          },
          player: {
            rect: rect(player),
            cs: cs(player, ["width", "height", "maxHeight", "objectFit"]),
          },
          relatedList: { rect: rect(relatedList) },
          thumb: {
            rect: rect(thumb),
            cs: cs(thumb, ["width", "height", "minWidth"]),
          },
          item: { rect: rect(item), cs: cs(item, ["display", "gap"]) },
        },
        redProbe,
      };
    },
    { redProbeSelectors: RED_PROBE_SELECTORS }
  );
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = { label, capturedAt: new Date().toISOString(), viewports: {} };

await withPlaywrightSession(
  async ({ browser }) => {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      await page.goto(BASE, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForSelector(".tlv-watch-layout", { timeout: 60000 });
      await page.waitForTimeout(2500);

      const metrics = await measurePage(page);
      results.viewports[vp.name] = metrics;

      const shotPath = path.join(OUT_DIR, `watch-${label}-${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      results.viewports[vp.name].screenshot = shotPath;

      await page.close();
    }
  },
  { viewport: { width: 1280, height: 900 } }
);

const reportPath = path.join(OUT_DIR, `watch-metrics-${label}.json`);
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

console.log(`\n=== watch layout metrics (${label}) ===\n`);
for (const [name, m] of Object.entries(results.viewports)) {
  const e = m.elements;
  console.log(`[${name}px] viewport ${m.viewport.w}x${m.viewport.h}`);
  console.log(
    `  playerWrap: ${e.playerWrap?.rect?.w}x${e.playerWrap?.rect?.h}px | grid gap: ${e.layout?.cs?.gap}`
  );
  console.log(
    `  sidebar: ${e.sidebar?.rect?.w}px | thumb: ${e.thumb?.rect?.w}x${e.thumb?.rect?.h}px`
  );
  console.log(`  layout grid: ${e.layout?.cs?.gridTemplateColumns}`);
  console.log(`  screenshot: ${m.screenshot}`);
}
console.log(`\nFull report: ${reportPath}`);
