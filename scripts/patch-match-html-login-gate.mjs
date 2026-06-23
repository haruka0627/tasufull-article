#!/usr/bin/env node
/**
 * Insert login gate script + data-match-requires-login on protected MATCH pages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MATCH_DIR = path.join(ROOT, "match");

const PROTECTED = new Set([
  "match-profile-create.html",
  "match-mypage.html",
  "match-swipe.html",
  "match-list.html",
  "match-verify.html",
  "match-block.html",
  "match-report.html",
  "match-safety.html",
  "match-talk-bridge.html",
  "match-search.html",
  "match-search-results.html",
  "match-search-saved.html",
  "match-favorites.html",
  "match-footprints.html",
]);

function patchFile(filePath, name) {
  let html = fs.readFileSync(filePath, "utf8");
  let changed = false;

  if (PROTECTED.has(name) && !html.includes("data-match-requires-login")) {
    html = html.replace(/<body([^>]*)>/i, '<body$1 data-match-requires-login="1">');
    changed = true;
  }

  if (html.includes('src="match-api.js"') && !html.includes('src="match-login-gate.js"')) {
    if (html.includes('src="match-beta-gate.js"')) {
      html = html.replace(
        /(<script src="match-beta-gate\.js"><\/script>)/,
        `$1\n  <script src="match-login-gate.js"></script>`,
      );
    } else if (html.includes('src="match-bootstrap.js"')) {
      html = html.replace(
        /(<script src="match-bootstrap\.js"><\/script>)/,
        `$1\n  <script src="match-login-gate.js"></script>`,
      );
    } else {
      html = html.replace(
        /(<script src="match-api\.js"><\/script>)/,
        `$1\n  <script src="match-login-gate.js"></script>`,
      );
    }
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, html, "utf8");
    console.log("patched:", path.relative(ROOT, filePath));
  }
}

for (const name of fs.readdirSync(MATCH_DIR)) {
  if (!name.endsWith(".html")) continue;
  patchFile(path.join(MATCH_DIR, name), name);
}
