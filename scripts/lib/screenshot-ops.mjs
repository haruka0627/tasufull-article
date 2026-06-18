import fs from "node:fs";
import path from "node:path";

/** 主判定フォルダ — index.html のギャラリー・総合判定の唯一のソース */
export const PRIMARY_FOLDER = "shop-store-final-review";

/** 単体検証・デバッグ用（index.html 非掲載） */
export const DEBUG_PARENT = "_debug";

/** ルート index に載せないフォルダ（単体検証・一時用途） */
export const DEBUG_ONLY_FOLDERS = new Set([
  "shop-store-review-gauge",
  "shop-store-flow-header",
  "shop-products-ia-reorder",
  "talk-shop-notify-cta",
]);

/**
 * @param {string} root リポジトリルート
 * @param {string} [folder]
 */
export function primaryScreenshotsDir(root, folder = PRIMARY_FOLDER) {
  const dir = path.join(root, "screenshots", folder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * @param {string} root
 * @param {string} name 例: shop-store-review-gauge
 */
export function debugScreenshotsDir(root, name) {
  const dir = path.join(root, "screenshots", DEBUG_PARENT, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export { finalizeScreenshotRun, finalizeFromOutDir, inferScreenshotFolderId } from "./finalize-screenshot-run.mjs";

/**
 * @param {string} folderId screenshots/ 直下のフォルダ名
 */
export function isDebugFolder(folderId) {
  return (
    !folderId ||
    folderId.startsWith("_") ||
    folderId === DEBUG_PARENT ||
    folderId.startsWith(`${DEBUG_PARENT}/`)
  );
}

/**
 * screenshots/index.html に載せるフォルダか
 * @param {string} folderId
 */
export function shouldIncludeScreenshotFolder(folderId) {
  if (!folderId || isDebugFolder(folderId)) return false;
  if (DEBUG_ONLY_FOLDERS.has(folderId)) return false;
  if (/bench|debug-only/i.test(folderId)) return false;
  return true;
}
