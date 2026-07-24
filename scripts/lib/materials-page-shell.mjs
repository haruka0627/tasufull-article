/**
 * Materials ページ — Platform 共通 header/footer（index-top.html 正本経由）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLATFORM_SHELL_CSS,
  renderPlatformPortalFooter,
  renderPlatformPortalHeader,
} from "./platform-portal-shell.mjs";

export { PLATFORM_SHELL_CSS };

export const PLATFORM_PORTAL_HEADER_PLACEHOLDER = "<!-- @platform-portal-header -->";
export const PLATFORM_PORTAL_FOOTER_PLACEHOLDER = "<!-- @platform-portal-footer -->";

const HEADER_RE =
  /<!-- @platform-portal-header -->|<header class="top-site-header[\s\S]*?<\/header>\s*/;
const FOOTER_RE =
  /<!-- @platform-portal-footer -->|<footer class="top-site-footer"[\s\S]*?<\/footer>\s*/;

const TABBAR_MOUNT =
  '  <div data-tasful-portal-tabbar-mount></div>\n  <script src="/platform-portal-tabbar.js"></script>\n';

/** @param {string} html */
export function applyMaterialsPlatformShell(html) {
  let next = html;
  next = next.replace(HEADER_RE, `${renderPlatformPortalHeader()}\n`);
  next = next.replace(FOOTER_RE, `${renderPlatformPortalFooter()}\n`);
  if (!next.includes("data-tasful-portal-tabbar-mount")) {
    next = next.replace(/(\s*<script src="\/materials\/)/, `\n${TABBAR_MOUNT}$1`);
  }
  return next;
}

/** @param {string} html — ソース HTML をプレースホルダー化（コピー実装を除去） */
export function stripMaterialsShellToPlaceholders(html) {
  let next = html;
  next = next.replace(HEADER_RE, `${PLATFORM_PORTAL_HEADER_PLACEHOLDER}\n`);
  next = next.replace(FOOTER_RE, `${PLATFORM_PORTAL_FOOTER_PLACEHOLDER}\n`);
  return next;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const MATERIALS_HTML_TARGETS = Object.freeze([
  "materials/index.html",
  "materials/list.html",
  "materials/detail.html",
]);

/** dist 内 Materials HTML に Platform シェルを注入 */
export function applyMaterialsPlatformShellToDist(distDir) {
  let count = 0;
  for (const rel of MATERIALS_HTML_TARGETS) {
    const file = path.join(distDir, rel);
    if (!fs.existsSync(file)) continue;
    const out = applyMaterialsPlatformShell(fs.readFileSync(file, "utf8"));
    fs.writeFileSync(file, out, "utf8");
    count += 1;
  }
  return count;
}
