/**
 * 390×667 mp4 デモ動画 — 共通ヘルパー（市場・Builder・TALK 等で流用）
 */
import { devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import {
  finalizeContextVideoMp4,
  mobileVideoContextOptions,
  probeMp4DurationSec,
} from "./playwright-video-mp4.mjs";

/** iPhone SE 相当（390×667・実機表示サイズ） */
export const DEMO_VIEWPORT_390 = Object.freeze({ width: 390, height: 667 });

export const DEMO_DEVICE_PROFILE = Object.freeze({
  ...devices["iPhone SE"],
  deviceScaleFactor: 2,
});

export const DEFAULT_STEP_PAUSE_MS = 1000;
export const DEFAULT_DEST_PAUSE_MS = 1800;
export const DEFAULT_LIST_PAUSE_MS = 900;

/** @param {import('playwright').Page} page @param {number} [ms] */
export async function demoPause(page, ms = DEFAULT_STEP_PAUSE_MS) {
  await page.waitForTimeout(ms);
}

/**
 * @param {import('playwright').Browser} browser
 * @param {string} tmpDir
 * @param {import('playwright').BrowserContextOptions['storageState']} [storageState]
 */
export async function openDemoVideoContext(browser, tmpDir, storageState) {
  fs.mkdirSync(tmpDir, { recursive: true });
  return browser.newContext({
    ...mobileVideoContextOptions(DEMO_VIEWPORT_390, tmpDir, DEMO_DEVICE_PROFILE),
    ...(storageState ? { storageState } : {}),
  });
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').BrowserContext} context
 * @param {string} mp4Path
 */
export async function closeDemoVideoContext(page, context, mp4Path) {
  await finalizeContextVideoMp4(page, context, mp4Path);
  const durationSec = await probeMp4DurationSec(mp4Path);
  return {
    path: mp4Path.replace(/\\/g, "/"),
    durationSec,
    durationLabel: durationSec != null ? `${durationSec}秒` : "—",
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {number} [destPauseMs]
 */
export async function tapMobileBack(page, destPauseMs = DEFAULT_DEST_PAUSE_MS) {
  const back = page.locator("[data-tasu-talk-back], [data-tasu-mobile-back], [data-detail-back]").first();
  if (await back.count()) {
    await back.waitFor({ state: "visible", timeout: 12000 });
    await demoPause(page, destPauseMs);
    await back.click({ timeout: 15000 });
    return;
  }
  await demoPause(page, destPauseMs);
  await page.goBack({ timeout: 15000 });
}

/**
 * @param {string} outPath
 * @param {object} payload
 */
export function writeDemoVideoManifest(outPath, payload) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  return outPath;
}

/**
 * @param {Array<{ fileName: string, path: string, durationSec: number|null, description: string }>} submissions
 */
export function formatVideoSubmissionList(submissions) {
  return submissions.map((v) => ({
    fileName: v.fileName,
    duration: v.durationSec != null ? `${v.durationSec}秒` : "—",
    content: v.description,
    path: v.path,
  }));
}
