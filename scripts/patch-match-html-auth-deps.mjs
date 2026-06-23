#!/usr/bin/env node
/**
 * Insert Supabase auth deps + match-bootstrap.js into MATCH HTML pages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MATCH_DIR = path.join(ROOT, "match");

const AUTH_DEPS = [
  '  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
  '  <script src="../chat-supabase-config.js"></script>',
  '  <script src="../auth-current-user.js"></script>',
  '  <script src="../tasu-supabase-client.js"></script>',
].join("\n");

const BOOTSTRAP = '  <script src="match-bootstrap.js"></script>';

function patchFile(filePath) {
  let html = fs.readFileSync(filePath, "utf8");
  let changed = false;

  if (html.includes('src="match-auth.js"') && !html.includes("chat-supabase-config.js")) {
    html = html.replace(
      /(\s*)<script src="match-auth\.js"><\/script>/,
      `\n${AUTH_DEPS}\n$1<script src="match-auth.js"></script>`,
    );
    changed = true;
  }

  if (html.includes('src="match-api.js"') && !html.includes('src="match-bootstrap.js"')) {
    html = html.replace(
      /(<script src="match-api\.js"><\/script>)/,
      `$1\n${BOOTSTRAP}`,
    );
    changed = true;
  }

  if (html.includes('src="match-api.js"') && !html.includes('src="match-beta-gate.js"')) {
    if (html.includes('src="match-bootstrap.js"')) {
      html = html.replace(
        /(<script src="match-bootstrap\.js"><\/script>)/,
        `$1\n  <script src="match-beta-gate.js"></script>`,
      );
    } else {
      html = html.replace(
        /(<script src="match-api\.js"><\/script>)/,
        `$1\n  <script src="match-beta-gate.js"></script>`,
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
  patchFile(path.join(MATCH_DIR, name));
}
