#!/usr/bin/env node
/**
 * YouTube vs TLV watch layout comparison
 * node scripts/tmp-watch-yt-ratio-compare.mjs [--tlv-only] [--after]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "scripts", "tmp-watch-ratio-shots");
const TLV_ID = "4d7e3650-b441-4598-9723-475a956cf68a";
const YT_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
  { width: 1920, height: 900 },
];

fs.mkdirSync(OUT, { recursive: true });

function pct(part, total) {
  if (!total) return null;
  return Math.round((part / total) * 1000) / 10;
}

async function measureYouTube(page) {
  await page.goto(YT_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(5000);

  // Dismiss consent if present
  for (const sel of [
    'button[aria-label*="Accept"]',
    'button[aria-label*="同意"]',
    "tp-yt-paper-button#button",
    'form[action*="consent"] button',
  ]) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click().catch(() => null);
      await page.waitForTimeout(1500);
      break;
    }
  }

  await page.waitForSelector("#movie_player, ytd-watch-flexy", { timeout: 60000 }).catch(() => null);
  await page.waitForTimeout(2000);

  return page.evaluate(() => {
    const pick = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) };
    };

    const player =
      document.querySelector("#movie_player") ||
      document.querySelector(".html5-video-player") ||
      document.querySelector("ytd-player #container");
    const primary = document.querySelector("#primary");
    const secondary = document.querySelector("#secondary");
    const columns = document.querySelector("#columns") || document.querySelector("ytd-watch-flexy #columns");

    const playerRect = pick(player);
    const primaryRect = pick(primary);
    const secondaryRect = pick(secondary);
    const columnsRect = pick(columns);

    const contentW = columnsRect?.w || primaryRect && secondaryRect
      ? primaryRect.w + secondaryRect.w + Math.max(0, (secondaryRect.x - (primaryRect.x + primaryRect.w)))
      : null;

    return {
      player: playerRect,
      primary: primaryRect,
      secondary: secondaryRect,
      columns: columnsRect,
      contentWidth: contentW,
      gridGap:
        primaryRect && secondaryRect
          ? Math.max(0, secondaryRect.x - (primaryRect.x + primaryRect.w))
          : null,
    };
  });
}

async function measureTlv(page, label) {
  const url = `http://127.0.0.1:8788/live/watch-video?id=${TLV_ID}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector(".tlv-watch-layout", { timeout: 60000 });
  await page.waitForTimeout(3000);

  const shot = path.join(OUT, `tlv-${label}-${page.viewportSize().width}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  const m = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) };
    };
    const layout = document.querySelector(".tlv-watch-layout");
    const main = pick(".tlv-watch-main");
    const sidebar = pick(".tlv-watch-sidebar");
    const player = pick(".live-watch__player-wrap");
    const outer = pick(".tlv-desktop-main--watch");
    const layoutRect = layout ? layout.getBoundingClientRect() : null;
    const thumb = document.querySelector(".tlv-related-list--yt .tlv-related-list__thumb");
    const card = document.querySelector(".tlv-related-list--yt .tlv-related-list__item");
    const thumbRect = thumb ? thumb.getBoundingClientRect() : null;
    const cardRect = card ? card.getBoundingClientRect() : null;
    const vpW = window.innerWidth;
    const playerX = player?.x ?? null;
    const rightMargin = sidebar ? Math.round(vpW - (sidebar.x + sidebar.w)) : null;
    return {
      viewport: vpW,
      layout: layoutRect ? Math.round(layoutRect.width) : null,
      main,
      sidebar,
      player,
      playerStartX: playerX,
      rightMargin,
      outer: outer,
      relatedCardWidth: cardRect ? Math.round(cardRect.width) : null,
      relatedThumbWidth: thumbRect ? Math.round(thumbRect.width) : null,
      gap: main && sidebar ? Math.max(0, sidebar.x - (main.x + main.w)) : null,
      gridCols: layout ? getComputedStyle(layout).gridTemplateColumns : null,
      sidebarClamp: layout
        ? getComputedStyle(document.documentElement).getPropertyValue("--tlv-watch-sidebar-w").trim()
        : null,
    };
  });

  return { ...m, screenshot: shot };
}

function summarize(name, data) {
  const contentW = data.contentWidth || data.layout || data.columns?.w;
  const playerW = data.player?.w;
  const sideW = data.secondary?.w || data.sidebar?.w;
  return {
    label: name,
    contentWidth: contentW,
    playerWidth: playerW,
    sidebarWidth: sideW,
    playerStartX: data.playerStartX ?? data.player?.x ?? null,
    rightMargin: data.rightMargin ?? null,
    viewport: data.viewport ?? null,
    relatedCardWidth: data.relatedCardWidth ?? null,
    relatedThumbWidth: data.relatedThumbWidth ?? null,
    gap: data.gridGap ?? data.gap,
    playerPct: pct(playerW, contentW),
    sidebarPct: pct(sideW, contentW),
    gridCols: data.gridCols || null,
  };
}

const tlvOnly = process.argv.includes("--tlv-only");
const tagArg = process.argv.indexOf("--tag");
const tag = tagArg >= 0 ? process.argv[tagArg + 1] : process.argv.includes("--after") ? "after" : "before";
const report = { youtube: [], tlv: [] };

if (!tlvOnly) {
  for (const vp of VIEWPORTS) {
    await withPlaywrightSession(
      async ({ page }) => {
        const raw = await measureYouTube(page);
        const shot = path.join(OUT, `youtube-${vp.width}.png`);
        await page.screenshot({ path: shot, fullPage: false });
        report.youtube.push({
          viewport: vp.width,
          ...summarize("YouTube", raw),
          raw,
          screenshot: shot,
        });
      },
      { viewport: vp }
    );
  }
}

for (const vp of VIEWPORTS) {
  await withPlaywrightSession(
    async ({ page }) => {
      const raw = await measureTlv(page, tag);
      report.tlv.push({
        viewport: vp.width,
        ...summarize(`TLV-${tag}`, raw),
        raw,
        screenshot: raw.screenshot,
      });
    },
    { viewport: vp }
  );
}

const outJson = path.join(OUT, `report-${tag}.json`);
fs.writeFileSync(outJson, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("Wrote", outJson);
