/**
 * TASFUL Platform 共通 header / footer — index-top.html 正本から抽出
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const INDEX_TOP = path.join(ROOT, "index-top.html");

const HEADER_RE = /<header class="top-site-header[\s\S]*?<\/header>/;
const FOOTER_RE = /<footer class="top-site-footer"[\s\S]*?<\/footer>/;

export const PLATFORM_SHELL_CSS = ["/style.css", "/top.css", "/tasful-ai-logo.css?v=4"];

/** @param {string} html */
function absolutizePlatformPaths(html) {
  return html
    .replace(/\bhref="index-top\.html"/g, 'href="/index-top.html"')
    .replace(/\bhref="(?!\/|#|https?:|mailto:)([^"]+)"/g, 'href="/$1"')
    .replace(/\bsrc="images\//g, 'src="/images/');
}

function readIndexTop() {
  return fs.readFileSync(INDEX_TOP, "utf8");
}

/** @param {{ activeNav?: string | null }} [options] */
export function renderPlatformPortalHeader(options = {}) {
  const { activeNav = null } = options;
  const match = readIndexTop().match(HEADER_RE);
  if (!match) throw new Error("Platform header not found in index-top.html");

  let header = absolutizePlatformPaths(match[0]);
  header = header.replace(
    '<a href="#footerColGuide">ご利用ガイド</a>',
    '<a href="/help/">ご利用ガイド</a>',
  );
  if (activeNav === "guide") {
    header = header.replace(
      '<a href="/help/">ご利用ガイド</a>',
      '<a href="/help/" aria-current="page">ご利用ガイド</a>',
    );
  }
  return header;
}

export function renderPlatformPortalFooter() {
  const match = readIndexTop().match(FOOTER_RE);
  if (!match) throw new Error("Platform footer not found in index-top.html");
  let footer = absolutizePlatformPaths(match[0]);
  footer = footer.replace(
    '<li><a href="/company/faq.html">よくある質問</a></li>',
    '<li><a href="/help/">よくある質問</a></li>',
  );
  return footer;
}
