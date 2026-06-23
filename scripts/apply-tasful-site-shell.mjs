#!/usr/bin/env node
/**
 * Apply TASFUL common header/footer (homepage version) to all corporate pages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PAGE_NAV,
  SHELL_CSS,
  SHELL_PAGE_PATHS,
  renderTasfulFooter,
  renderTasfulHeader,
} from "./lib/tasful-site-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "deploy", "cloudflare", "dist");

const HEADER_RE = /<header class="(?:custom-header|corp-header|iw-site-header)">[\s\S]*?<\/header>\s*/;
const FOOTER_RE = /<footer class="(?:modern-footer|corp-footer)">[\s\S]*?<\/footer>\s*/;
const IW_FOOTER_RE = /\s*<div class="footer-wrapper">[\s\S]*?<div class="copyright">[\s\S]*?<\/div>\s*<\/div>\s*/;
const INLINE_FOOTER_STYLE_RE =
  /\s*<style>\s*\/\* =+\s*\nWix Reset & Layout \(原型維持\)[\s\S]*?\.link-col:last-child \{ grid-column: span 2; \}\s*\}\s*<\/style>\s*/;
const MENU_SCRIPT_RE = /\s*<script src="\/tas-hp-header-menu\.js" defer><\/script>\s*/gi;

function ensureShellCss(html) {
  let next = html
    .replace(/\s*<link rel="stylesheet" href="\/corp-header\.css" \/?>\s*/g, "\n")
    .replace(/\s*<link rel="stylesheet" href="\/corp-footer\.css" \/?>\s*/g, "\n");

  for (const href of SHELL_CSS) {
    next = next.replace(new RegExp(`\\s*<link rel="stylesheet" href="${href.replace(/\//g, "\\/")}" \\/?>\\s*`, "g"), "\n");
  }

  const shellBlock = SHELL_CSS.map((href) => `  <link rel="stylesheet" href="${href}" />`).join("\n");
  if (/<meta name="description"[^>]*>/i.test(next)) {
    next = next.replace(/(<meta name="description"[^>]*>\s*)/i, `$1${shellBlock}\n`);
  } else {
    next = next.replace(/(<meta name="viewport"[^>]*>\s*)/i, `$1${shellBlock}\n`);
  }
  return next;
}

function ensureBodyClass(html) {
  return html.replace(/<body([^>]*)>/, (match, attrs) => {
    if (/class="([^"]*)"/.test(attrs)) {
      return match.replace(/class="([^"]*)"/, (_, classes) => {
        let next = classes;
        if (!/\bcorp-body\b/.test(next)) next = `corp-body ${next}`;
        if (!/\bcorp-body--tasful-hp\b/.test(next)) next = `${next} corp-body--tasful-hp`;
        return `class="${next.trim()}"`;
      });
    }
    return `<body class="corp-body corp-body--tasful-hp"${attrs}>`;
  });
}

function applyShell(html, currentNavId) {
  let next = ensureShellCss(html);
  next = ensureBodyClass(next);
  next = next.replace(IW_FOOTER_RE, "\n");
  next = next.replace(HEADER_RE, "");
  next = next.replace(FOOTER_RE, "");
  next = next.replace(INLINE_FOOTER_STYLE_RE, "\n");
  next = next.replace(MENU_SCRIPT_RE, "\n");

  const header = renderTasfulHeader(currentNavId);
  const footer = renderTasfulFooter();

  next = next.replace(/(<body[^>]*>\s*)/, `$1${header}\n`);
  next = next.replace(/(\s*<\/body>)/, `\n${footer}\n$1`);
  return next;
}

function writeBoth(rel, html) {
  const src = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(src), { recursive: true });
  fs.writeFileSync(src, html, "utf8");
  const dist = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(dist), { recursive: true });
  fs.writeFileSync(dist, html, "utf8");
  return rel;
}

let updated = 0;
for (const rel of SHELL_PAGE_PATHS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.warn("skip (missing):", rel);
    continue;
  }
  const html = fs.readFileSync(file, "utf8");
  const next = applyShell(html, PAGE_NAV[rel] ?? null);
  writeBoth(rel, next);
  if (next !== html) {
    updated += 1;
    console.log("updated:", rel);
  } else {
    console.log("synced:", rel);
  }
}

console.log(`Done. ${updated} page(s) updated.`);
