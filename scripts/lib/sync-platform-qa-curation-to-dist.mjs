#!/usr/bin/env node
/**
 * ローカル dev（8788）向け — dist に Q&A 整理モード用アセットを同期
 * 本番 build:pages 後でも npm run dev で整理UIを復元する
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIST = path.join(ROOT, "deploy/cloudflare/dist");

const SYNC_ROOT_FILES = [
  "platform-qa-admin-config.js",
  "platform-qa-admin-ui.js",
  "platform-qa-curation.js",
  "platform-qa-curation-ui.js",
  "platform-qa-data.js",
  "platform-qa-article.js",
  "platform-qa-ai-icon.js",
  "platform-qa.css",
  "platform-qa-articles.generated.js",
  "platform-qa-keywords.generated.js",
  "platform-qa-ai-bridge.js",
  "ai-consult-bridge.js",
  "ai-workspace-chat.js",
  "ai-workspace.html",
];

const SYNC_HELP_JS = ["help/help-index.js", "help/help-article.js", "help/curation.js"];

const SYNC_HELP_HTML = ["help/index.html", "help/view.html"];

const ADMIN_SNIPPET =
  '  <script src="/platform-qa-admin-config.js"></script>\n' +
  '  <script src="/platform-qa-admin-ui.js"></script>\n';

function forceCopy(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function injectAdminScripts(html) {
  if (!html.includes("platform-qa-data.js")) return html;
  if (html.includes("platform-qa-admin-ui.js")) return html;
  return html.replace(
    /(<script[^>]+src="[^"]*platform-qa-data\.js"[^>]*><\/script>)/i,
    `$1\n${ADMIN_SNIPPET}`,
  );
}

function walkHtml(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkHtml(p, fn);
    else if (ent.name.endsWith(".html")) fn(p);
  }
}

export function syncPlatformQaCurationToDist() {
  if (!fs.existsSync(DIST)) return { copied: 0, htmlPatched: 0 };

  let copied = 0;
  for (const name of SYNC_ROOT_FILES) {
    if (forceCopy(path.join(ROOT, name), path.join(DIST, name))) copied += 1;
  }

  for (const rel of SYNC_HELP_JS) {
    if (forceCopy(path.join(ROOT, rel), path.join(DIST, rel))) copied += 1;
  }

  for (const rel of SYNC_HELP_HTML) {
    if (forceCopy(path.join(ROOT, rel), path.join(DIST, rel))) copied += 1;
  }

  const helpSrc = path.join(ROOT, "help");
  const helpDest = path.join(DIST, "help");
  if (fs.existsSync(helpSrc)) {
    walkHtml(helpSrc, (srcFile) => {
      const rel = path.relative(helpSrc, srcFile);
      if (forceCopy(srcFile, path.join(helpDest, rel))) copied += 1;
    });
  }

  let htmlPatched = 0;
  walkHtml(helpDest, (filePath) => {
    const raw = fs.readFileSync(filePath, "utf8");
    const next = injectAdminScripts(raw);
    if (next !== raw) {
      fs.writeFileSync(filePath, next, "utf8");
      htmlPatched += 1;
    }
  });

  const awsSrc = path.join(ROOT, "ai-workspace.html");
  const awsDist = path.join(DIST, "ai-workspace", "index.html");
  if (fs.existsSync(awsSrc)) {
    let html = fs.readFileSync(awsSrc, "utf8");
    if (!/<base\s+href="/i.test(html)) {
      html = html.replace(/<head>/i, "<head>\n  <base href=\"/\">");
    }
    fs.mkdirSync(path.dirname(awsDist), { recursive: true });
    fs.writeFileSync(awsDist, html);
    copied += 1;
  }

  return { copied, htmlPatched };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = syncPlatformQaCurationToDist();
  console.log("[sync-platform-qa-curation-to-dist]", result);
}
