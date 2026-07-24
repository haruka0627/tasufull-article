/**
 * Playwright viewport — 実ブラウザ（Chrome 100% ズーム）と同条件の撮影 SSOT
 *
 * - viewport = window.innerWidth / innerHeight（ブラウザ UI 除くコンテンツ領域）
 * - deviceScaleFactor: 1（100% ズーム相当）
 * - isMobile: false（デスクトップ CSS メディアクエリ）
 * - screenshot: fullPage=false（ページ viewport 全体）· scale=css
 */
import fs from "node:fs";
import path from "node:path";

/** @typedef {{ id: string, width: number, height: number, label: string, expectMq?: { mq960: boolean, mq480: boolean, mq1200: boolean } }} QaViewport */

/** QA 正本（_global.mdc / qa.mdc） */
export const BUILDER_QA_VIEWPORTS = Object.freeze([
  Object.freeze({
    id: "1280",
    width: 1280,
    height: 900,
    label: "1280×900",
    expectMq: Object.freeze({ mq960: false, mq480: false, mq1200: false }),
  }),
  Object.freeze({
    id: "768",
    width: 768,
    height: 1024,
    label: "768×1024",
    expectMq: Object.freeze({ mq960: true, mq480: false, mq1200: true }),
  }),
  Object.freeze({
    id: "390",
    width: 390,
    height: 844,
    label: "390×844",
    expectMq: Object.freeze({ mq960: true, mq480: true, mq1200: true }),
  }),
]);

/** 実 PC ワイド表示（1440 以上 · 100% ズーム） */
export const BUILDER_PC_WIDE_VIEWPORTS = Object.freeze([
  Object.freeze({
    id: "1440",
    width: 1440,
    height: 900,
    label: "1440×900",
    expectMq: Object.freeze({ mq960: false, mq480: false, mq1200: false }),
  }),
  Object.freeze({
    id: "1600",
    width: 1600,
    height: 900,
    label: "1600×900",
    expectMq: Object.freeze({ mq960: false, mq480: false, mq1200: false }),
  }),
  Object.freeze({
    id: "1920",
    width: 1920,
    height: 1080,
    label: "1920×1080",
    expectMq: Object.freeze({ mq960: false, mq480: false, mq1200: false }),
  }),
]);

/** project-calendar PC レイアウト確認（QA 1280 + 実 PC ワイド） */
export const BUILDER_PROJECT_CALENDAR_PC_VIEWPORTS = Object.freeze([
  BUILDER_QA_VIEWPORTS.find((v) => v.id === "1280"),
  ...BUILDER_PC_WIDE_VIEWPORTS,
]);

/** 実ブラウザ相当の desktop context（タッチ/モバイル UA なし） */
export const DESKTOP_BROWSER_CONTEXT = Object.freeze({
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
  locale: "ja-JP",
  colorScheme: "light",
});

/**
 * @param {import('playwright').Browser} browser
 * @param {QaViewport} viewport
 */
export async function createBrowserLikePage(browser, viewport) {
  const context = await browser.newContext({
    ...DESKTOP_BROWSER_CONTEXT,
    viewport: { width: viewport.width, height: viewport.height },
    screen: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  return { context, page };
}

/**
 * 実ブラウザと同条件か（innerWidth · DPR · matchMedia）
 * @param {import('playwright').Page} page
 * @param {QaViewport} viewport
 */
export async function readBrowserLikeEnv(page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    devicePixelRatio: window.devicePixelRatio,
    mq960: window.matchMedia("(max-width: 960px)").matches,
    mq480: window.matchMedia("(max-width: 480px)").matches,
    mq1200: window.matchMedia("(max-width: 1200px)").matches,
  }));
}

/**
 * @param {import('playwright').Page} page
 * @param {QaViewport} viewport
 * @returns {{ ok: boolean, env: Awaited<ReturnType<typeof readBrowserLikeEnv>>, errors: string[] }}
 */
export async function assertBrowserLikeEnv(page, viewport) {
  const env = await readBrowserLikeEnv(page);
  const errors = [];
  if (env.innerWidth !== viewport.width) {
    errors.push(`innerWidth ${env.innerWidth} !== viewport ${viewport.width}`);
  }
  if (env.innerHeight !== viewport.height) {
    errors.push(`innerHeight ${env.innerHeight} !== viewport ${viewport.height}`);
  }
  if (env.devicePixelRatio !== 1) {
    errors.push(`devicePixelRatio ${env.devicePixelRatio} !== 1 (Chrome 100% 相当)`);
  }
  if (viewport.expectMq) {
    for (const [key, expected] of Object.entries(viewport.expectMq)) {
      if (env[key] !== expected) {
        errors.push(`matchMedia ${key}=${env[key]} expected ${expected}`);
      }
    }
  }
  return { ok: errors.length === 0, env, errors };
}

/**
 * スクリーンショット前の安定化（フォント · レイアウト）
 * @param {import('playwright').Page} page
 */
export async function preparePageForScreenshot(page) {
  try {
    await page.evaluate(() => document.fonts.ready);
  } catch {
    /* ignore */
  }
  await page.waitForTimeout(150);
}

/**
 * viewport 全体のページスクリーンショット（要素切り取りではない）
 * @param {import('playwright').Page} page
 * @param {string} filePath
 */
export async function capturePageViewportScreenshot(page, filePath) {
  await preparePageForScreenshot(page);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await page.screenshot({
    path: filePath,
    fullPage: false,
    scale: "css",
    animations: "disabled",
  });
}

/** PNG IHDR から CSS ピクセル寸法を読む */
export function readPngCssDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") {
    return null;
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * @param {string} filePath
 * @param {QaViewport} viewport
 */
export function assertScreenshotMatchesViewport(filePath, viewport) {
  const dim = readPngCssDimensions(filePath);
  if (!dim) return { ok: false, error: `invalid PNG: ${filePath}` };
  if (dim.width !== viewport.width || dim.height !== viewport.height) {
    return {
      ok: false,
      error: `PNG ${dim.width}×${dim.height} !== viewport ${viewport.width}×${viewport.height}`,
      dim,
    };
  }
  return { ok: true, dim };
}
